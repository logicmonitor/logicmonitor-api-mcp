import axios, { AxiosInstance, AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import winston from 'winston';
import { performance } from 'perf_hooks';
import { 
  LMDevice, 
  LMDeviceGroup, 
  LMCollector,
  LMAlert,
  LMWebsite,
  LMWebsiteGroup,
  LMPaginatedResponse,
  LMAlertPaginatedResponse,
  LMErrorResponse 
} from '../types/logicmonitor.js';
import { formatLogicMonitorFilter } from '../utils/filters.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { LogicMonitorApiError } from './errors.js';

export type LogicMonitorHttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface LogicMonitorRequestContext {
  endpoint: string;
  method: LogicMonitorHttpMethod;
  params?: Record<string, unknown>;
  payload?: unknown;
}

export interface LogicMonitorResponseMeta extends LogicMonitorRequestContext {
  status: number;
  requestId?: string;
  durationMs?: number;
  timestamp: string;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
}

export interface ApiResult<T> {
  data: T;
  raw: unknown;
  meta: LogicMonitorResponseMeta;
}

export interface ApiListResult<T> {
  items: T[];
  total: number;
  searchId?: string;
  raw: LMPaginatedResponse<T> & {
    pages?: Array<{
      offset: number;
      size: number;
      returned: number;
    }>;
  };
  meta: LogicMonitorResponseMeta & {
    pagination: {
      requestedSize: number;
      initialOffset: number;
      effectivePageSize: number;
      pagesFetched: number;
    };
  };
}

export class LogicMonitorClient {
  private axiosInstance: AxiosInstance;
  private logger: winston.Logger;

  constructor(
    account: string,
    bearerToken: string,
    logger?: winston.Logger
  ) {
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    this.axiosInstance = axios.create({
      baseURL: `https://${account}.logicmonitor.com/santaba/rest`,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'X-Version': '3'
      },
      timeout: 30000
    });

    this.axiosInstance.interceptors.response.use(
      response => {
        // Extract and store rate limit information
        const rateLimitInfo = rateLimiter.extractRateLimitInfo(response.headers as AxiosHeaders);
        if (rateLimitInfo) {
          rateLimiter.updateRateLimitInfo('api-request', rateLimitInfo);
          this.logger.debug('Rate limit info updated', rateLimitInfo);
        }
        return response;
      },
      this.handleError.bind(this)
    );
  }

  private extractRequestId(headers: AxiosHeaders | Record<string, unknown>): string | undefined {
    const source = typeof (headers as AxiosHeaders).toJSON === 'function'
      ? (headers as AxiosHeaders).toJSON()
      : headers;

    const candidate = (source as Record<string, unknown>)['x-request-id']
      ?? (source as Record<string, unknown>)['x-logicmonitor-requestid']
      ?? (source as Record<string, unknown>)['x-lm-request-id'];

    if (Array.isArray(candidate)) {
      return candidate[0];
    }

    return typeof candidate === 'string' ? candidate : undefined;
  }

  private buildRateLimitMeta(headers: AxiosHeaders | Record<string, unknown>) {
    const info = rateLimiter.extractRateLimitInfo(headers as AxiosHeaders);
    if (!info) {
      return undefined;
    }

    return {
      limit: info.limit,
      remaining: info.remaining,
      reset: info.resetTime,
      windowSeconds: info.window
    };
  }

  private createResponseMeta<T>(
    response: AxiosResponse<T>,
    context: LogicMonitorRequestContext,
    durationMs: number
  ): LogicMonitorResponseMeta {
    const headers = response.headers as AxiosHeaders;
    return {
      ...context,
      status: response.status,
      requestId: this.extractRequestId(headers),
      durationMs,
      timestamp: new Date().toISOString(),
      rateLimit: this.buildRateLimitMeta(headers)
    };
  }

  private handleError(error: AxiosError<LMErrorResponse>) {
    if (error.response) {
      const { status, data } = error.response;
      
      // Extract rate limit info from error response
      const rateLimitInfo = rateLimiter.extractRateLimitInfo(error.response.headers as AxiosHeaders);
      if (rateLimitInfo) {
        rateLimiter.updateRateLimitInfo('api-request', rateLimitInfo);
        this.logger.debug('Rate limit info from error response', rateLimitInfo);
      }
      
      // Check if this is a rate limit error
      if (status === 429) {
        this.logger.warn('Rate limit exceeded', { 
          path: error.config?.url,
          rateLimitInfo 
        });
        // Re-throw the error to let the rate limiter handle retry
        throw error;
      }
      
      const headers = error.response.headers as AxiosHeaders;
      const headersJson = typeof headers.toJSON === 'function' ? headers.toJSON() : headers;
      const rawRequestId = headersJson['x-request-id'] || headersJson['x-logicmonitor-requestid'];
      const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
      const message = data?.errorMessage || 'Unknown error';

      this.logger.error('LogicMonitor API error', { 
        status, 
        message,
        path: error.config?.url,
        code: data?.errorCode
      });
      
      throw new LogicMonitorApiError(`LogicMonitor API error: ${message}`, {
        status,
        code: data?.errorCode,
        requestId,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method,
        responseBody: data
      });
    } else if (error.request) {
      this.logger.error('Network error', { message: error.message });
      throw new LogicMonitorApiError(`Network error: ${error.message}`, {
        code: 'NETWORK_ERROR'
      });
    } else {
      this.logger.error('Request error', { message: error.message });
      throw new LogicMonitorApiError(`Request error: ${error.message}`, {
        code: 'REQUEST_ERROR'
      });
    }
  }

  /**
   * Generic pagination helper that automatically fetches all pages
   * @param endpoint - The API endpoint to paginate
   * @param params - Request parameters including optional size/offset
   * @returns Combined results from all pages
   */
  private async paginateAll<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiListResult<T>> {
    const requestedSize = params?.size ?? 1000;
    const baseOffset = params?.offset ?? 0;
    const requestContext: LogicMonitorRequestContext = {
      endpoint,
      method: 'get',
      params: { ...params, size: requestedSize, offset: baseOffset }
    };

    let offset = baseOffset;
    const allItems: T[] = [];
    let totalCount = 0;
    let searchId: string | undefined;
    let hasMore = true;
    const pages: Array<{ offset: number; size: number; returned: number }> = [];
    const startedAt = performance.now();
    let meta: LogicMonitorResponseMeta | undefined;

    this.logger.debug(`Starting pagination for ${endpoint}`, {
      initialSize: requestedSize,
      initialOffset: offset,
      params
    });

    while (hasMore) {
      const pageStartedAt = performance.now();
      try {
        const response = await this.axiosInstance.get<LMPaginatedResponse<T>>(endpoint, {
          params: { ...params, size: requestedSize, offset }
        });
        const duration = performance.now() - pageStartedAt;

        const data = response.data;
        if (!data || typeof data.total !== 'number') {
          this.logger.warn('Invalid pagination response structure', { endpoint, data });
          break;
        }

        if (!meta) {
          meta = this.createResponseMeta(response, requestContext, duration);
        }

        if (typeof data.searchId === 'string') {
          searchId = data.searchId;
        }

        // On first iteration, capture the total count
        if (offset === baseOffset) {
          totalCount = data.total;
        }

        const items = Array.isArray(data.items) ? data.items : [];
        allItems.push(...items);
        pages.push({
          offset,
          size: requestedSize,
          returned: items.length
        });

        this.logger.debug(`Fetched page for ${endpoint}`, {
          offset,
          requestedSize,
          returnedSize: items.length,
          totalSoFar: allItems.length,
          total: totalCount
        });

        if (items.length === 0 || allItems.length >= totalCount) {
          hasMore = false;
        } else {
          offset += items.length;
        }
      } catch (error) {
        this.logger.error(`Pagination failed for ${endpoint}`, {
          offset,
          error: error instanceof Error ? error.message : error
        });
        throw error;
      }
    }

    const totalDuration = performance.now() - startedAt;
    if (!meta) {
      meta = {
        ...requestContext,
        status: 200,
        durationMs: totalDuration,
        timestamp: new Date().toISOString()
      };
    } else {
      meta.durationMs = totalDuration;
    }

    this.logger.info(`Pagination complete for ${endpoint}`, {
      pagesFetched: pages.length,
      totalItems: allItems.length,
      expectedTotal: totalCount
    });

    return {
      items: allItems,
      total: totalCount,
      searchId,
      raw: {
        total: totalCount,
        searchId,
        items: allItems,
        pages
      },
      meta: {
        ...meta,
        pagination: {
          requestedSize,
          initialOffset: baseOffset,
          effectivePageSize: pages.length > 0 ? pages[0].returned : 0,
          pagesFetched: pages.length
        }
      }
    };
  }

  // Device Management Methods
  async listDevices(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    start?: number;
    end?: number;
    netflowFilter?: string;
    includeDeletedResources?: boolean;
  }): Promise<ApiListResult<LMDevice>> {
    const formattedParams: Record<string, unknown> = {
      ...params,
      filter: params?.filter ? formatLogicMonitorFilter(params.filter) : undefined,
      fields: params?.fields ?? '*'
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    this.logger.debug('Device list request', {
      originalFilter: params?.filter,
      formattedFilter: sanitizedParams.filter,
      params: sanitizedParams
    });
    
    return this.paginateAll<LMDevice>('/device/devices', sanitizedParams);
  }

  async getDevice(deviceId: number, params?: {
    fields?: string;
    start?: number;
    end?: number;
    netflowFilter?: string;
    needStcGrpAndSortedCP?: boolean;
  }): Promise<ApiResult<LMDevice>> {
    const queryParams = Object.fromEntries(
      Object.entries({
        ...params,
        fields: params?.fields ?? '*'
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    try {
      const response = await this.axiosInstance.get(`/device/devices/${deviceId}`, {
        params: queryParams
      });
      const duration = performance.now() - startedAt;

      this.logger.debug('Get device response', {
        deviceId,
        hasData: !!response.data,
        hasNestedData: !!(response.data?.data),
        keys: response.data ? Object.keys(response.data) : []
      });
      
      // LogicMonitor API might return the device directly or wrapped in a data property
      const device = response.data.data || response.data;
      
      if (!device || typeof device.id === 'undefined') {
        throw new Error(`Invalid device response structure for device ${deviceId}`);
      }
      
      return {
        data: device,
        raw: response.data,
        meta: this.createResponseMeta(response, requestContext, duration)
      };
    } catch (error) {
      this.logger.error('Failed to get device', { 
        deviceId,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  async createDevice(device: {
    displayName: string;
    name: string;
    hostGroupIds: number[];
    preferredCollectorId: number;
    disableAlerting?: boolean;
    customProperties?: Array<{ name: string; value: string }>;
  }): Promise<ApiResult<LMDevice>> {
    // Convert hostGroupIds array to comma-separated string
    const payload = {
      name: device.name,  // LogicMonitor API expects 'name' field
      displayName: device.displayName,
      hostGroupIds: device.hostGroupIds.join(','),
      preferredCollectorId: device.preferredCollectorId,
      disableAlerting: device.disableAlerting ?? false,
      customProperties: device.customProperties || []
    };
    
    this.logger.debug('Creating device', { payload });

    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/device/devices',
      method: 'post',
      payload
    };

    const startedAt = performance.now();
    try {
      const response = await this.axiosInstance.post('/device/devices', payload);
      const duration = performance.now() - startedAt;
      const raw = response.data;
      const created = raw?.data ?? raw;
      if (!created || typeof created.id === 'undefined') {
        throw new Error('Invalid device response structure returned from create.');
      }
      this.logger.debug('Device created successfully', { deviceId: created?.id });
      return {
        data: created,
        raw,
        meta: this.createResponseMeta(response, requestContext, duration)
      };
    } catch (error) {
      this.logger.error('Failed to create device', { 
        payload, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  async updateDevice(deviceId: number, updates: Partial<{
    displayName: string;
    hostGroupIds: number[];
    disableAlerting: boolean;
    customProperties: Array<{ name: string; value: string }>;
  }>): Promise<ApiResult<LMDevice>> {
    // Convert hostGroupIds array to comma-separated string if present
    const payload: Record<string, unknown> = { ...updates };
    if (updates.hostGroupIds) {
      payload.hostGroupIds = updates.hostGroupIds.join(',');
    }

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}`,
      method: 'patch',
      payload
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/device/devices/${deviceId}`, payload);
    const duration = performance.now() - startedAt;

    const raw = response.data;
    const device = raw?.data ?? raw;

    if (!device || typeof device.id === 'undefined') {
      throw new Error(`Invalid device response structure for device ${deviceId}`);
    }

    return {
      data: device,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteDevice(deviceId: number): Promise<ApiResult<{ deviceId: number }>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/device/devices/${deviceId}`);
    const duration = performance.now() - startedAt;

    return {
      data: { deviceId },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // Device Group Management Methods
  async listDeviceGroups(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    parentId?: number;
  }): Promise<ApiListResult<LMDeviceGroup>> {
    const formattedParams: Record<string, unknown> = {
      ...params,
      filter: params?.filter ? formatLogicMonitorFilter(params.filter) : undefined,
      fields: params?.fields ?? '*'
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    this.logger.debug('Device groups list request', { 
      originalFilter: params?.filter,
      formattedFilter: sanitizedParams.filter,
      params: sanitizedParams 
    });
    
    return this.paginateAll<LMDeviceGroup>('/device/groups', sanitizedParams);
  }

  async getDeviceGroup(groupId: number, params?: { fields?: string }): Promise<ApiResult<LMDeviceGroup>> {
    const queryParams = Object.fromEntries(
      Object.entries({
        ...params,
        fields: params?.fields ?? '*'
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/groups/${groupId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    try {
      const response = await this.axiosInstance.get(`/device/groups/${groupId}`, {
        params: queryParams
      });
      const duration = performance.now() - startedAt;
      this.logger.debug('Get device group response', { 
        groupId,
        hasData: !!response.data,
        hasNestedData: !!(response.data?.data),
        keys: response.data ? Object.keys(response.data) : []
      });
      
      // LogicMonitor API might return the group directly or wrapped in a data property
      const group = response.data.data || response.data;
      
      if (!group || typeof group.id === 'undefined') {
        throw new Error(`Invalid device group response structure for group ${groupId}`);
      }
      
      return {
        data: group,
        raw: response.data,
        meta: this.createResponseMeta(response, requestContext, duration)
      };
    } catch (error) {
      this.logger.error('Failed to get device group', { 
        groupId,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  async createDeviceGroup(group: {
    name: string;
    parentId: number;
    description?: string;
    appliesTo?: string;
    customProperties?: Array<{ name: string; value: string }>;
  }): Promise<ApiResult<LMDeviceGroup>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/device/groups',
      method: 'post',
      payload: group
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/device/groups', group);
    const duration = performance.now() - startedAt;

    const raw = response.data;
    const deviceGroup = raw?.data ?? raw;

    if (!deviceGroup || typeof deviceGroup.id === 'undefined') {
      throw new Error(`Invalid device group response structure for group ${group.name}`);
    }

    return {
      data: deviceGroup,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateDeviceGroup(groupId: number, updates: Partial<{
    name: string;
    description: string;
    appliesTo: string;
    customProperties: Array<{ name: string; value: string }>;
  }>): Promise<ApiResult<LMDeviceGroup>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/groups/${groupId}`,
      method: 'patch',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/device/groups/${groupId}`, updates);
    const duration = performance.now() - startedAt;

    const raw = response.data;
    const deviceGroup = raw?.data ?? raw;

    if (!deviceGroup || typeof deviceGroup.id === 'undefined') {
      throw new Error(`Invalid device group response structure for group ${groupId}`);
    }

    return {
      data: deviceGroup,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteDeviceGroup(groupId: number, params?: {
    deleteChildren?: boolean;
  }): Promise<ApiResult<{ groupId: number; deleteChildren: boolean }>> {
    const queryParams = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/groups/${groupId}`,
      method: 'delete',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/device/groups/${groupId}`, { params: queryParams });
    const duration = performance.now() - startedAt;

    return {
      data: { groupId, deleteChildren: params?.deleteChildren ?? false },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // Website Management Methods
  async listWebsites(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    collectorIds?: string;
  }): Promise<ApiListResult<LMWebsite>> {
    const formattedParams: Record<string, unknown> = {
      ...params,
      filter: params?.filter ? formatLogicMonitorFilter(params.filter) : undefined,
      fields: params?.fields ?? '*'
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    return this.paginateAll<LMWebsite>('/website/websites', sanitizedParams);
  }

  async getWebsite(websiteId: number, params?: { fields?: string }): Promise<ApiResult<LMWebsite>> {
    const queryParams = Object.fromEntries(
      Object.entries({
        ...params,
        fields: params?.fields ?? '*'
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/websites/${websiteId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/website/websites/${websiteId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;
    
    const raw = response.data;
    const website = raw?.data ?? raw;
    
    if (!website || typeof website.id === 'undefined') {
      throw new Error(`Invalid website response structure for website ${websiteId}`);
    }
    
    return {
      data: website,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createWebsite(websiteData: {
    name: string;
    domain: string;
    type: 'webcheck' | 'pingcheck';
    groupId: number;
    description?: string;
    disableAlerting?: boolean;
    stopMonitoring?: boolean;
    useDefaultAlertSetting?: boolean;
    useDefaultLocationSetting?: boolean;
    pollingInterval?: number;
    properties?: Array<{ name: string; value: string }>;
    steps?: Array<{
      url: string;
      HTTPMethod?: string;
      statusCode?: string;
      description?: string;
    }>;
  }): Promise<ApiResult<LMWebsite>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/website/websites',
      method: 'post',
      payload: websiteData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/website/websites', websiteData);
    const duration = performance.now() - startedAt;
    
    const raw = response.data;
    const website = raw?.data ?? raw;

    if (!website || typeof website.id === 'undefined') {
      throw new Error(`Invalid website response structure for website ${websiteData.name}`);
    }

    return {
      data: website,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateWebsite(websiteId: number, updates: {
    name?: string;
    description?: string;
    disableAlerting?: boolean;
    stopMonitoring?: boolean;
    useDefaultAlertSetting?: boolean;
    useDefaultLocationSetting?: boolean;
    pollingInterval?: number;
    properties?: Array<{ name: string; value: string }>;
  }): Promise<ApiResult<LMWebsite>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/websites/${websiteId}`,
      method: 'patch',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/website/websites/${websiteId}`, updates);
    const duration = performance.now() - startedAt;

    const raw = response.data;
    const website = raw?.data ?? raw;

    if (!website || typeof website.id === 'undefined') {
      throw new Error(`Invalid website response structure for website ${websiteId}`);
    }

    return {
      data: website,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteWebsite(websiteId: number): Promise<ApiResult<{ websiteId: number }>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/websites/${websiteId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/website/websites/${websiteId}`);
    const duration = performance.now() - startedAt;

    return {
      data: { websiteId },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // Website Group Management Methods
  async listWebsiteGroups(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
  }): Promise<ApiListResult<LMWebsiteGroup>> {
    const formattedParams: Record<string, unknown> = {
      ...params,
      filter: params?.filter ? formatLogicMonitorFilter(params.filter) : undefined,
      fields: params?.fields ?? '*'
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    return this.paginateAll<LMWebsiteGroup>('/website/groups', sanitizedParams);
  }

  async getWebsiteGroup(groupId: number, params?: { fields?: string }): Promise<ApiResult<LMWebsiteGroup>> {
    const queryParams = Object.fromEntries(
      Object.entries({
        ...params,
        fields: params?.fields ?? '*'
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/groups/${groupId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/website/groups/${groupId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;
    
    const raw = response.data;
    const websiteGroup = raw?.data ?? raw;
    
    if (!websiteGroup || typeof websiteGroup.id === 'undefined') {
      throw new Error(`Invalid website group response structure for group ${groupId}`);
    }
    
    return {
      data: websiteGroup,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createWebsiteGroup(group: {
    name: string;
    parentId: number;
    description?: string;
    disableAlerting?: boolean;
    stopMonitoring?: boolean;
    properties?: Array<{ name: string; value: string }>;
  }): Promise<ApiResult<LMWebsiteGroup>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/website/groups',
      method: 'post',
      payload: group
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/website/groups', group);
    const duration = performance.now() - startedAt;

    const raw = response.data;
    const websiteGroup = raw?.data ?? raw;

    if (!websiteGroup || typeof websiteGroup.id === 'undefined') {
      throw new Error(`Invalid website group response structure for group ${group.name}`);
    }

    return {
      data: websiteGroup,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateWebsiteGroup(groupId: number, updates: {
    name?: string;
    description?: string;
    disableAlerting?: boolean;
    stopMonitoring?: boolean;
    properties?: Array<{ name: string; value: string }>;
  }): Promise<ApiResult<LMWebsiteGroup>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/groups/${groupId}`,
      method: 'patch',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/website/groups/${groupId}`, updates);
    const duration = performance.now() - startedAt;

    const raw = response.data;
    const websiteGroup = raw?.data ?? raw;

    if (!websiteGroup || typeof websiteGroup.id === 'undefined') {
      throw new Error(`Invalid website group response structure for group ${groupId}`);
    }

    return {
      data: websiteGroup,
      raw,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteWebsiteGroup(groupId: number, params?: {
    deleteChildren?: boolean;
  }): Promise<ApiResult<{ groupId: number; deleteChildren: boolean }>> {
    const queryParams = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/groups/${groupId}`,
      method: 'delete',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/website/groups/${groupId}`, { params: queryParams });
    const duration = performance.now() - startedAt;

    return {
      data: { groupId, deleteChildren: params?.deleteChildren ?? false },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // Collector Management Methods
  async listCollectors(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
  }): Promise<ApiListResult<LMCollector>> {
    const formattedParams: Record<string, unknown> = {
      ...params,
      filter: params?.filter ? formatLogicMonitorFilter(params.filter) : undefined,
      fields: params?.fields ?? '*'
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    this.logger.debug('Collectors list request', { 
      originalFilter: params?.filter,
      formattedFilter: sanitizedParams.filter,
      params: sanitizedParams 
    });
    
    return this.paginateAll<LMCollector>('/setting/collector/collectors', sanitizedParams);
  }

  // Alert methods
  async listAlerts(params?: {
    filter?: string;
    fields?: string;
    size?: number;
    offset?: number;
    sort?: string;
    needMessage?: boolean;
    customColumns?: string;
  }): Promise<ApiListResult<LMAlert>> {
    const formattedParams: Record<string, unknown> = {
      ...params,
      filter: params?.filter ? formatLogicMonitorFilter(params.filter) : undefined,
      fields: params?.fields ?? '*'
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );

    const pageSize = typeof sanitizedParams.size === 'number' ? sanitizedParams.size : 50;
    const initialOffset = typeof sanitizedParams.offset === 'number' ? sanitizedParams.offset : 0;

    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/alert/alerts',
      method: 'get',
      params: { ...sanitizedParams, size: pageSize, offset: initialOffset }
    };

    const pages: Array<{ offset: number; size: number; returned: number }> = [];
    const allItems: LMAlert[] = [];
    const startedAt = performance.now();

    let meta: LogicMonitorResponseMeta | undefined;
    let currentOffset = initialOffset;
    let reportedTotal: number | undefined;
    let fetchMore = true;

    while (fetchMore) {
      const pageStarted = performance.now();
      const response = await this.axiosInstance.get('/alert/alerts', {
        params: { ...sanitizedParams, size: pageSize, offset: currentOffset }
      });
      const duration = performance.now() - pageStarted;

      if (!meta) {
        meta = this.createResponseMeta(response, requestContext, duration);
      }

      const page = response.data as LMAlertPaginatedResponse;
      const items = Array.isArray(page.items) ? page.items : [];
      allItems.push(...items);

      pages.push({
        offset: currentOffset,
        size: pageSize,
        returned: items.length
      });

      reportedTotal = page.total;

      this.logger.debug('Fetched alert page', {
        offset: currentOffset,
        returned: items.length,
        reportedTotal
      });

      if (items.length < pageSize) {
        fetchMore = false;
      } else if (typeof reportedTotal === 'number') {
        if (reportedTotal >= 0 && allItems.length >= reportedTotal) {
          fetchMore = false;
        } else if (reportedTotal < 0 && allItems.length >= Math.abs(reportedTotal)) {
          fetchMore = false;
        } else {
          currentOffset += pageSize;
        }
      } else {
        currentOffset += pageSize;
      }
    }

    const totalDuration = performance.now() - startedAt;
    if (!meta) {
      meta = {
        ...requestContext,
        status: 200,
        durationMs: totalDuration,
        timestamp: new Date().toISOString()
      };
    } else {
      meta.durationMs = totalDuration;
    }

    const total = allItems.length;

    return {
      items: allItems,
      total,
      raw: {
        total,
        items: allItems,
        pages
      },
      meta: {
        ...meta,
        pagination: {
          requestedSize: pageSize,
          initialOffset,
          effectivePageSize: pages[0]?.returned ?? 0,
          pagesFetched: pages.length
        }
      }
    };
  }

  async getAlert(alertId: string): Promise<ApiResult<LMAlert>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/alert/alerts/${alertId}`,
      method: 'get'
    };

    const startedAt = performance.now();
    try {
      const response = await this.axiosInstance.get(`/alert/alerts/${alertId}`);
      const duration = performance.now() - startedAt;
      this.logger.debug('Get alert response', { 
        alertId,
        hasData: !!response.data,
        hasNestedData: !!(response.data?.data),
        keys: response.data ? Object.keys(response.data) : []
      });
      
      const raw = response.data;
      const alert = raw?.data ?? raw;
      
      if (!alert || typeof alert.id === 'undefined') {
        throw new Error(`Invalid alert response structure for alert ${alertId}`);
      }
      
      return {
        data: alert,
        raw,
        meta: this.createResponseMeta(response, requestContext, duration)
      };
    } catch (error) {
      this.logger.error('Error getting alert', { alertId, error });
      throw error;
    }
  }

  async ackAlert(alertId: string, ackComment: string): Promise<ApiResult<{ alertId: string; ackComment: string }>> {
    const payload = { ackComment };
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/alert/alerts/${alertId}/ack`,
      method: 'post',
      payload
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post(`/alert/alerts/${alertId}/ack`, payload);
    const duration = performance.now() - startedAt;

    return {
      data: { alertId, ackComment },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async addAlertNote(alertId: string, note: string): Promise<ApiResult<{ alertId: string; note: string }>> {
    const payload = { ackComment: note };
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/alert/alerts/${alertId}/note`,
      method: 'post',
      payload
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post(`/alert/alerts/${alertId}/note`, payload);
    const duration = performance.now() - startedAt;

    return {
      data: { alertId, note },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async escalateAlert(alertId: string): Promise<ApiResult<{ alertId: string }>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/alert/alerts/${alertId}/escalate`,
      method: 'post'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post(`/alert/alerts/${alertId}/escalate`);
    const duration = performance.now() - startedAt;

    return {
      data: { alertId },
      raw: response.data ?? null,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }
}
