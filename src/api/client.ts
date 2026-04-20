import axios, { AxiosInstance, AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import winston from 'winston';
import { performance } from 'perf_hooks';
import { 
  LMDevice, 
  LMDeviceGroup, 
  LMCollector,
  LMAlert,
  LMWebsite,
  LMWebsiteGroup,
  LMUser,
  LMAPIToken,
  LMDashboard,
  LMCollectorGroup,
  LMDeviceDatasource,
  LMDeviceDatasourceInstance,
  LMDeviceData,
  LMSDT,
  LMOpsNote,
  LMPaginatedResponse,
  LMAlertPaginatedResponse,
  LMErrorResponse 
} from '../types/logicmonitor.js';
import { formatLogicMonitorFilter } from '../utils/filters.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { LogicMonitorApiError } from './errors.js';
import { getKnownFields } from '../utils/fieldMetadata.js';
import type { ResolvedLMCredentials, SessionLMCredentials } from '../auth/lmCredentials.js';
import { fetchPortalSession } from './sessionAuth.js';

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

export interface LogicMonitorClientOptions {
  timeoutMs?: number;
}

export interface ApiListResult<T> {
  items: T[];
  total: number;
  searchId?: string;
  raw: {
    combined: LMPaginatedResponse<T>;
    pages: Array<{
      offset: number;
      size: number;
      returned: number;
      response: unknown;
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

const DEVICE_FILTER_FIELDS = getKnownFields('device');
const DEVICE_GROUP_FILTER_FIELDS = getKnownFields('deviceGroup');
const WEBSITE_FILTER_FIELDS = getKnownFields('website');
const WEBSITE_GROUP_FILTER_FIELDS = getKnownFields('websiteGroup');
const COLLECTOR_FILTER_FIELDS = getKnownFields('collector');
const ALERT_FILTER_FIELDS = getKnownFields('alert');

export class LogicMonitorClient {
  private axiosInstance: AxiosInstance;
  private logger: winston.Logger;
  private readonly account: string;
  private portalUiBaseUrl: string;

  constructor(
    credentials: ResolvedLMCredentials,
    logger?: winston.Logger,
    options: LogicMonitorClientOptions = {}
  ) {
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    const timeout = options.timeoutMs ?? 30000;
    this.account = credentials.kind === 'bearer'
      ? credentials.lm_account.trim().toLowerCase()
      : credentials.lm_portal.trim().toLowerCase();
    this.portalUiBaseUrl = `https://${this.account}.logicmonitor.com/santaba/uiv4`;

    this.axiosInstance = credentials.kind === 'bearer'
      ? axios.create({
          baseURL: `https://${this.account}.logicmonitor.com/santaba/rest`,
          headers: {
            'Authorization': `Bearer ${credentials.lm_bearer_token}`,
            'Content-Type': 'application/json',
            'X-Version': '3'
          },
          timeout
        })
      : axios.create({
          headers: {
            'Content-Type': 'application/json',
            'X-Version': '3'
          },
          timeout
        });

    if (credentials.kind === 'session') {
      this.axiosInstance.interceptors.request.use(
        (requestConfig) => this.attachSessionAuth(credentials, timeout, requestConfig)
      );
    }

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

  private async attachSessionAuth(
    credentials: SessionLMCredentials,
    timeoutMs: number,
    requestConfig: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    const session = await fetchPortalSession(credentials, timeoutMs);
    const headers = AxiosHeaders.from(requestConfig.headers ?? {});

    headers.delete('Authorization');
    headers.set('Content-Type', 'application/json');
    headers.set('X-Version', '3');
    headers.set('cookie', `JSESSIONID=${session.jSessionId};`);
    headers.set('x-csrf-token', session.csrfToken);

    requestConfig.baseURL = `${session.portalBaseUrl}/santaba/rest`;
    this.portalUiBaseUrl = `${session.portalBaseUrl}/santaba/uiv4`;
    requestConfig.headers = headers;
    return requestConfig;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: Record<string, any>,
    autoPaginate: boolean = true
  ): Promise<ApiListResult<T>> {
    const requestedSize = params?.size ?? 1000;
    const baseOffset = params?.offset ?? 0;
    const requestContext: LogicMonitorRequestContext = {
      endpoint,
      method: 'get',
      params: { ...params, size: requestedSize, offset: baseOffset }
    };

    const MAX_PAGES = 100;
    let offset = baseOffset;
    const allItems: T[] = [];
    let totalCount = 0;
    let searchId: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const pages: Array<{ offset: number; size: number; returned: number; response: unknown }> = [];
    const startedAt = performance.now();
    let meta: LogicMonitorResponseMeta | undefined;

    this.logger.debug(`Starting pagination for ${endpoint}`, {
      initialSize: requestedSize,
      initialOffset: offset,
      autoPaginate,
      params
    });

    while (hasMore) {
      pageCount++;
      if (pageCount > MAX_PAGES) {
        this.logger.warn(`Pagination safety limit reached for ${endpoint}`, {
          pageCount: MAX_PAGES,
          totalItems: allItems.length,
          expectedTotal: totalCount
        });
        break;
      }

      const pageStartedAt = performance.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageParams: Record<string, any> = { ...params, size: requestedSize, offset };
        if (searchId) {
          pageParams.searchId = searchId;
        }

        const response = await this.axiosInstance.get<LMPaginatedResponse<T>>(endpoint, {
          params: pageParams
        });
        const duration = performance.now() - pageStartedAt;

        const data = response.data;
        if (!data || typeof data.total !== 'number') {
          throw new LogicMonitorApiError(
            `Invalid pagination response structure from ${endpoint}: missing total or items`,
            { status: response.status, requestUrl: endpoint, requestMethod: 'get' }
          );
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
          returned: items.length,
          response: response.data
        });

        this.logger.debug(`Fetched page for ${endpoint}`, {
          offset,
          requestedSize,
          returnedSize: items.length,
          totalSoFar: allItems.length,
          total: totalCount,
          autoPaginate
        });

        // If autoPaginate is false, stop after first page
        if (!autoPaginate) {
          hasMore = false;
        } else if (items.length === 0 || allItems.length >= totalCount) {
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

    const combined: LMPaginatedResponse<T> = {
      total: totalCount,
      searchId,
      items: allItems
    };

    return {
      items: allItems,
      total: totalCount,
      searchId,
      raw: {
        combined,
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
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMDevice>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const formattedParams: Record<string, unknown> = {
      ...restParams,
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: DEVICE_FILTER_FIELDS,
            resourceName: 'device'
          })
        : undefined
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    this.logger.debug('Device list request', {
      originalFilter: restParams?.filter,
      formattedFilter: sanitizedParams.filter,
      params: sanitizedParams,
      autoPaginate
    });
    
    return this.paginateAll<LMDevice>('/device/devices', sanitizedParams, autoPaginate);
  }

  async getDevice(deviceId: number, params?: {
    fields?: string;
    start?: number;
    end?: number;
    netflowFilter?: string;
    needStcGrpAndSortedCP?: boolean;
  }): Promise<ApiResult<LMDevice>> {
    // Only pass valid API parameters, not MCP-specific ones
    const { fields, start, end, netflowFilter, needStcGrpAndSortedCP } = params || {};
    
    // Note: For GET endpoints, fields=* returns empty object, so we omit it to get all fields
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined,
        start,
        end,
        netflowFilter,
        needStcGrpAndSortedCP
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    this.logger.debug('Get device request', {
      deviceId,
      queryParams
    });

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

      // LogicMonitor API for GET /device/devices/{id} returns the device object directly
      // Axios wraps it as response.data, so response.data IS the device object
      this.logger.info('Get device raw response', {
        deviceId,
        responseDataType: typeof response.data,
        responseDataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        responseDataJson: JSON.stringify(response.data),
        hasDataProperty: response.data && typeof response.data === 'object' && 'data' in response.data,
        hasIdProperty: response.data && typeof response.data === 'object' && 'id' in response.data,
        statusCode: response.status,
        url: response.config?.url,
        fullUrl: response.request?.path
      });
      
      let device;
      
      if (response.data && typeof response.data === 'object') {
        // Check if response has a nested 'data' property (some endpoints wrap it)
        if ('data' in response.data && response.data.data !== undefined && typeof response.data.data === 'object') {
          device = response.data.data;
          this.logger.debug('Using nested data property');
        } else {
          // For GET /device/devices/{id}, response.data IS the device itself
          device = response.data;
          this.logger.debug('Using response.data directly as device');
        }
      } else {
        this.logger.error('Invalid response structure', {
          deviceId,
          responseType: typeof response.data,
          responseData: JSON.stringify(response.data)
        });
        throw new Error(`Invalid device response for device ${deviceId}: response.data is not an object`);
      }
      
      if (!device || typeof device !== 'object') {
        this.logger.error('Invalid device data', {
          deviceId,
          deviceType: typeof device,
          responseData: JSON.stringify(response.data)
        });
        throw new Error(`Invalid device response structure for device ${deviceId}: expected object, got ${typeof device}`);
      }
      
      // Check if we got an empty object (device not found or no data returned)
      const deviceKeys = Object.keys(device);
      if (deviceKeys.length === 0) {
        this.logger.warn('Empty device response', {
          deviceId,
          statusCode: response.status,
          responseData: JSON.stringify(response.data)
        });
        throw new Error(`Device ${deviceId} not found or returned empty response`);
      }
      
      // Verify we at least have an id field (basic sanity check)
      if (typeof device.id === 'undefined') {
        this.logger.warn('Device response missing id field', {
          deviceId,
          keys: deviceKeys,
          hasId: 'id' in device
        });
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

    // Add opType=replace to preserve existing properties when updating customProperties
    const queryParams = updates.customProperties ? { opType: 'replace' } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}`,
      method: 'patch',
      payload,
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/device/devices/${deviceId}`, payload, { params: queryParams });
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
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMDeviceGroup>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const formattedParams: Record<string, unknown> = {
      ...restParams,
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: DEVICE_GROUP_FILTER_FIELDS,
            resourceName: 'device group'
          })
        : undefined
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    this.logger.debug('Device groups list request', { 
      originalFilter: restParams?.filter,
      formattedFilter: sanitizedParams.filter,
      params: sanitizedParams,
      autoPaginate
    });
    
    return this.paginateAll<LMDeviceGroup>('/device/groups', sanitizedParams, autoPaginate);
  }

  async getDeviceGroup(groupId: number, params?: { fields?: string }): Promise<ApiResult<LMDeviceGroup>> {
    const { fields } = params || {};
    
    // Note: For GET endpoints, fields=* returns empty object, so we omit it to get all fields
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
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
      // LogicMonitor API with X-Version: 3 returns the group object directly
      const group = response.data;
      
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
    // Add opType=replace to preserve existing properties when updating customProperties
    const queryParams = updates.customProperties ? { opType: 'replace' } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/groups/${groupId}`,
      method: 'patch',
      payload: updates,
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/device/groups/${groupId}`, updates, { params: queryParams });
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
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMWebsite>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const formattedParams: Record<string, unknown> = {
      ...restParams,
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: WEBSITE_FILTER_FIELDS,
            resourceName: 'website'
          })
        : undefined
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    return this.paginateAll<LMWebsite>('/website/websites', sanitizedParams, autoPaginate);
  }

  async getWebsite(websiteId: number, params?: { fields?: string }): Promise<ApiResult<LMWebsite>> {
    const { fields } = params || {};
    
    // Note: For GET endpoints, fields=* returns empty object, so we omit it to get all fields
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
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
    
    // LogicMonitor API with X-Version: 3 returns the website object directly
    const website = response.data;
    
    if (!website || typeof website.id === 'undefined') {
      throw new Error(`Invalid website response structure for website ${websiteId}`);
    }
    
    return {
      data: website,
      raw: response.data,
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
    // Add opType=replace to preserve existing properties when updating properties
    const queryParams = updates.properties ? { opType: 'replace' } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/websites/${websiteId}`,
      method: 'patch',
      payload: updates,
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/website/websites/${websiteId}`, updates, { params: queryParams });
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
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMWebsiteGroup>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const formattedParams: Record<string, unknown> = {
      ...restParams,
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: WEBSITE_GROUP_FILTER_FIELDS,
            resourceName: 'website group'
          })
        : undefined
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    return this.paginateAll<LMWebsiteGroup>('/website/groups', sanitizedParams, autoPaginate);
  }

  async getWebsiteGroup(groupId: number, params?: { fields?: string }): Promise<ApiResult<LMWebsiteGroup>> {
    const { fields } = params || {};
    
    // Note: For GET endpoints, fields=* returns empty object, so we omit it to get all fields
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
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
    
    // LogicMonitor API with X-Version: 3 returns the website group object directly
    const websiteGroup = response.data;
    
    if (!websiteGroup || typeof websiteGroup.id === 'undefined') {
      throw new Error(`Invalid website group response structure for group ${groupId}`);
    }
    
    return {
      data: websiteGroup,
      raw: response.data,
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
    // Add opType=replace to preserve existing properties when updating properties
    const queryParams = updates.properties ? { opType: 'replace' } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/website/groups/${groupId}`,
      method: 'patch',
      payload: updates,
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/website/groups/${groupId}`, updates, { params: queryParams });
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
    // Convert boolean to integer for API (0 or 1)
    const queryParams: Record<string, number> = {};
    if (params?.deleteChildren !== undefined) {
      queryParams.deleteChildren = params.deleteChildren ? 1 : 0;
    }

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
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMCollector>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const formattedParams: Record<string, unknown> = {
      ...restParams,
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: COLLECTOR_FILTER_FIELDS,
            resourceName: 'collector'
          })
        : undefined
    };

    const sanitizedParams = Object.fromEntries(
      Object.entries(formattedParams).filter(([, value]) => value !== undefined && value !== null)
    );
    
    this.logger.debug('Collectors list request', { 
      originalFilter: restParams?.filter,
      formattedFilter: sanitizedParams.filter,
      params: sanitizedParams,
      autoPaginate
    });
    
    return this.paginateAll<LMCollector>('/setting/collector/collectors', sanitizedParams, autoPaginate);
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
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMAlert>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const formattedParams: Record<string, unknown> = {
      ...restParams,
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: ALERT_FILTER_FIELDS,
            resourceName: 'alert'
          })
        : undefined
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

    const pages: Array<{ offset: number; size: number; returned: number; response: unknown }> = [];
    const allItems: LMAlert[] = [];
    const startedAt = performance.now();

    let meta: LogicMonitorResponseMeta | undefined;
    let currentOffset = initialOffset;
    let reportedTotal: number | undefined;
    let fetchMore = true;
    let searchId: string | undefined;

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!searchId && typeof (page as any)?.searchId === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        searchId = (page as any).searchId;
      }

      pages.push({
        offset: currentOffset,
        size: pageSize,
        returned: items.length,
        response: page
      });

      reportedTotal = page.total;

      this.logger.debug('Fetched alert page', {
        offset: currentOffset,
        returned: items.length,
        reportedTotal,
        autoPaginate
      });

      // If autoPaginate is false, stop after first page
      if (!autoPaginate) {
        fetchMore = false;
      } else if (items.length < pageSize) {
        fetchMore = false;
      } else if (typeof reportedTotal === 'number') {
        if (reportedTotal >= 0 && allItems.length >= reportedTotal) {
          fetchMore = false;
        } else if (reportedTotal < 0) {
          // Negative total is an LM API quirk meaning "more items than could be counted"
          // Continue fetching - items.length < pageSize check above handles exhaustion
          currentOffset += items.length;
        } else {
          currentOffset += items.length;
        }
      } else {
        currentOffset += items.length;
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

    const combined: LMAlertPaginatedResponse = {
      total,
      items: allItems,
      searchId
    };

    return {
      items: allItems,
      total,
      raw: {
        combined,
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
      
      // LogicMonitor API with X-Version: 3 returns the alert object directly
      const alert = response.data;
      
      if (!alert || typeof alert.id === 'undefined') {
        throw new Error(`Invalid alert response structure for alert ${alertId}`);
      }
      
      return {
        data: alert,
        raw: response.data,
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

  // User Management Methods
  async listUsers(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMUser>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams: Record<string, unknown> = {
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: new Set(['username', 'email', 'firstName', 'lastName', 'status', 'roles']),
            resourceName: 'user'
          })
        : undefined,
      size: restParams?.size ?? 50,
      offset: restParams?.offset ?? 0,
      fields: restParams?.fields
    };
    
    return this.paginateAll<LMUser>('/setting/admins', sanitizedParams, autoPaginate);
  }

  async getUser(userId: number, params?: { fields?: string }): Promise<ApiResult<LMUser>> {
    const { fields } = params || {};
    
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/admins/${userId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/setting/admins/${userId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;
    
    const user = response.data;
    
    if (!user || typeof user.id === 'undefined') {
      throw new Error(`Invalid user response structure for user ${userId}`);
    }
    
    return {
      data: user,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createUser(userData: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: Array<{ id: number }>;
    password?: string;
    phone?: string;
    smsEmail?: string;
    timezone?: string;
    note?: string;
    apionly?: boolean;
    forcePasswordChange?: boolean;
    contactMethod?: string;
  }): Promise<ApiResult<LMUser>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/setting/admins',
      method: 'post',
      payload: userData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/setting/admins', userData);
    const duration = performance.now() - startedAt;
    
    const user = response.data;
    
    if (!user || typeof user.id === 'undefined') {
      throw new Error('Invalid user response structure returned from create.');
    }
    
    return {
      data: user,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateUser(userId: number, updates: Record<string, unknown>): Promise<ApiResult<LMUser>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/admins/${userId}`,
      method: 'patch',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/setting/admins/${userId}`, updates);
    const duration = performance.now() - startedAt;
    
    const user = response.data;
    
    if (!user || typeof user.id === 'undefined') {
      throw new Error(`Invalid user response structure for user ${userId}`);
    }
    
    return {
      data: user,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteUser(userId: number): Promise<ApiResult<void>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/admins/${userId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/setting/admins/${userId}`);
    const duration = performance.now() - startedAt;
    
    return {
      data: undefined,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async listUserAPITokens(userId: number): Promise<{ items: LMAPIToken[]; total: number; raw: unknown; meta: LogicMonitorResponseMeta }> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/admins/${userId}/apitokens`,
      method: 'get'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/setting/admins/${userId}/apitokens`);
    const duration = performance.now() - startedAt;
    
    const items = response.data.items || [];
    const total = response.data.total || items.length;
    
    return {
      items,
      total,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createUserAPIToken(userId: number, tokenData: { note: string }): Promise<ApiResult<LMAPIToken>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/admins/${userId}/apitokens`,
      method: 'post',
      payload: tokenData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post(`/setting/admins/${userId}/apitokens`, tokenData);
    const duration = performance.now() - startedAt;
    
    const token = response.data;
    
    if (!token || typeof token.accessId === 'undefined') {
      throw new Error('Invalid API token response structure returned from create.');
    }
    
    return {
      data: token,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteUserAPIToken(userId: number, tokenId: number): Promise<ApiResult<void>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/admins/${userId}/apitokens/${tokenId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/setting/admins/${userId}/apitokens/${tokenId}`);
    const duration = performance.now() - startedAt;
    
    return {
      data: undefined,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // Dashboard Management Methods
  async listDashboards(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMDashboard>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams: Record<string, unknown> = {
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: new Set(['name', 'description', 'groupId', 'owner', 'template']),
            resourceName: 'dashboard'
          })
        : undefined,
      size: restParams?.size ?? 50,
      offset: restParams?.offset ?? 0,
      fields: restParams?.fields
    };
    
    return this.paginateAll<LMDashboard>('/dashboard/dashboards', sanitizedParams, autoPaginate);
  }

  async getDashboard(dashboardId: number, params?: { fields?: string }): Promise<ApiResult<LMDashboard>> {
    const { fields } = params || {};
    
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/dashboard/dashboards/${dashboardId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/dashboard/dashboards/${dashboardId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;
    
    const dashboard = response.data;
    
    if (!dashboard || typeof dashboard.id === 'undefined') {
      throw new Error(`Invalid dashboard response structure for dashboard ${dashboardId}`);
    }
    
    return {
      data: dashboard,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createDashboard(dashboardData: {
    name: string;
    groupId: number;
    description?: string;
    widgetsConfig?: string;
    widgetTokens?: Array<{ name: string; value: string }>;
    template?: boolean;
    sharable?: boolean;
  }): Promise<ApiResult<LMDashboard>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/dashboard/dashboards',
      method: 'post',
      payload: dashboardData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/dashboard/dashboards', dashboardData);
    const duration = performance.now() - startedAt;
    
    const dashboard = response.data;
    
    if (!dashboard || typeof dashboard.id === 'undefined') {
      throw new Error('Invalid dashboard response structure returned from create.');
    }
    
    return {
      data: dashboard,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateDashboard(dashboardId: number, updates: Record<string, unknown>): Promise<ApiResult<LMDashboard>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/dashboard/dashboards/${dashboardId}`,
      method: 'patch',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/dashboard/dashboards/${dashboardId}`, updates);
    const duration = performance.now() - startedAt;
    
    const dashboard = response.data;
    
    if (!dashboard || typeof dashboard.id === 'undefined') {
      throw new Error(`Invalid dashboard response structure for dashboard ${dashboardId}`);
    }
    
    return {
      data: dashboard,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteDashboard(dashboardId: number): Promise<ApiResult<void>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/dashboard/dashboards/${dashboardId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/dashboard/dashboards/${dashboardId}`);
    const duration = performance.now() - startedAt;
    
    return {
      data: undefined,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // Collector Group Management Methods
  async listCollectorGroups(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMCollectorGroup>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams: Record<string, unknown> = {
      filter: restParams?.filter
        ? formatLogicMonitorFilter(restParams.filter, {
            allowedFields: new Set(['name', 'description', 'numOfCollectors', 'autoBalance']),
            resourceName: 'collectorGroup'
          })
        : undefined,
      size: restParams?.size ?? 50,
      offset: restParams?.offset ?? 0,
      fields: restParams?.fields
    };
    
    return this.paginateAll<LMCollectorGroup>('/setting/collector/groups', sanitizedParams, autoPaginate);
  }

  async getCollectorGroup(groupId: number, params?: { fields?: string }): Promise<ApiResult<LMCollectorGroup>> {
    const { fields } = params || {};
    
    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/collector/groups/${groupId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/setting/collector/groups/${groupId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;
    
    const group = response.data;
    
    if (!group || typeof group.id === 'undefined') {
      throw new Error(`Invalid collector group response structure for group ${groupId}`);
    }
    
    return {
      data: group,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createCollectorGroup(groupData: {
    name: string;
    description: string;
    autoBalance?: boolean;
    autoBalanceInstanceCountThreshold?: number;
    customProperties?: Array<{ name: string; value: string }>;
  }): Promise<ApiResult<LMCollectorGroup>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/setting/collector/groups',
      method: 'post',
      payload: groupData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/setting/collector/groups', groupData);
    const duration = performance.now() - startedAt;
    
    const group = response.data;
    
    if (!group || typeof group.id === 'undefined') {
      throw new Error('Invalid collector group response structure returned from create.');
    }
    
    return {
      data: group,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateCollectorGroup(groupId: number, updates: Record<string, unknown>): Promise<ApiResult<LMCollectorGroup>> {
    // Add opType=replace to preserve existing properties when updating customProperties
    const queryParams = updates.customProperties ? { opType: 'replace' } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/collector/groups/${groupId}`,
      method: 'patch',
      payload: updates,
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/setting/collector/groups/${groupId}`, updates, { params: queryParams });
    const duration = performance.now() - startedAt;
    
    const group = response.data;
    
    if (!group || typeof group.id === 'undefined') {
      throw new Error(`Invalid collector group response structure for group ${groupId}`);
    }
    
    return {
      data: group,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteCollectorGroup(groupId: number): Promise<ApiResult<void>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/collector/groups/${groupId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/setting/collector/groups/${groupId}`);
    const duration = performance.now() - startedAt;
    
    return {
      data: undefined,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  /**
   * List device datasources
   */
  async listDeviceDatasources(deviceId: number, params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMDeviceDatasource>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams = restParams ? {
      ...restParams,
      fields: restParams.fields && restParams.fields !== '*' ? restParams.fields : undefined
    } : {};

    return this.paginateAll<LMDeviceDatasource>(`/device/devices/${deviceId}/devicedatasources`, sanitizedParams, autoPaginate);
  }

  /**
   * Get a specific device datasource
   */
  async getDeviceDatasource(deviceId: number, datasourceId: number, params?: {
    fields?: string;
  }): Promise<ApiResult<LMDeviceDatasource>> {
    const queryParams = params?.fields && params.fields !== '*' ? { fields: params.fields } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}/devicedatasources/${datasourceId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(
      `/device/devices/${deviceId}/devicedatasources/${datasourceId}`,
      { params: queryParams }
    );
    const duration = performance.now() - startedAt;

    if (!response.data || typeof response.data !== 'object') {
      throw new LogicMonitorApiError(
        `Device datasource ${datasourceId} for device ${deviceId} not found or returned empty response`,
        {
          status: response.status,
          requestId: this.extractRequestId(response.headers as AxiosHeaders),
          requestUrl: requestContext.endpoint
        }
      );
    }

    return {
      data: response.data.data || response.data,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  /**
   * List device datasource instances
   */
  async listDeviceDatasourceInstances(deviceId: number, datasourceId: number, params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMDeviceDatasourceInstance>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams = restParams ? {
      ...restParams,
      fields: restParams.fields && restParams.fields !== '*' ? restParams.fields : undefined
    } : {};

    return this.paginateAll<LMDeviceDatasourceInstance>(
      `/device/devices/${deviceId}/devicedatasources/${datasourceId}/instances`,
      sanitizedParams,
      autoPaginate
    );
  }

  /**
   * Get a specific device datasource instance
   */
  async getDeviceDatasourceInstance(
    deviceId: number,
    datasourceId: number,
    instanceId: number,
    params?: { fields?: string }
  ): Promise<ApiResult<LMDeviceDatasourceInstance>> {
    const queryParams = params?.fields && params.fields !== '*' ? { fields: params.fields } : {};

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}/devicedatasources/${datasourceId}/instances/${instanceId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(
      `/device/devices/${deviceId}/devicedatasources/${datasourceId}/instances/${instanceId}`,
      { params: queryParams }
    );
    const duration = performance.now() - startedAt;

    if (!response.data || typeof response.data !== 'object') {
      throw new LogicMonitorApiError(
        `Device datasource instance ${instanceId} not found or returned empty response`,
        {
          status: response.status,
          requestId: this.extractRequestId(response.headers as AxiosHeaders),
          requestUrl: requestContext.endpoint
        }
      );
    }

    return {
      data: response.data.data || response.data,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  /**
   * Get device data (metrics) for a specific datasource instance
   */
  async getDeviceData(
    deviceId: number,
    datasourceId: number,
    instanceId: number,
    params?: {
      start?: number;
      end?: number;
      datapoints?: string;
      format?: string;
      aggregate?: string;
    }
  ): Promise<ApiResult<LMDeviceData>> {
    const queryParams = Object.fromEntries(
      Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/device/devices/${deviceId}/devicedatasources/${datasourceId}/instances/${instanceId}/data`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(
      `/device/devices/${deviceId}/devicedatasources/${datasourceId}/instances/${instanceId}/data`,
      { params: queryParams }
    );
    const duration = performance.now() - startedAt;

    if (!response.data || typeof response.data !== 'object') {
      throw new LogicMonitorApiError(
        `Device data for instance ${instanceId} not found or returned empty response`,
        {
          status: response.status,
          requestId: this.extractRequestId(response.headers as AxiosHeaders),
          requestUrl: requestContext.endpoint
        }
      );
    }

    return {
      data: response.data,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // SDT Management Methods
  async listSdts(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMSDT>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams: Record<string, unknown> = {
      filter: restParams?.filter || undefined,
      size: restParams?.size ?? 50,
      offset: restParams?.offset ?? 0,
      fields: restParams?.fields
    };

    return this.paginateAll<LMSDT>('/sdt/sdts', sanitizedParams, autoPaginate);
  }

  async getSdt(sdtId: string, params?: { fields?: string }): Promise<ApiResult<LMSDT>> {
    const { fields } = params || {};

    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/sdt/sdts/${sdtId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/sdt/sdts/${sdtId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;

    const sdt = response.data;

    if (!sdt || typeof sdt.id === 'undefined') {
      throw new Error(`Invalid SDT response structure for SDT ${sdtId}`);
    }

    return {
      data: sdt,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createSdt(sdtData: Record<string, unknown>): Promise<ApiResult<LMSDT>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/sdt/sdts',
      method: 'post',
      payload: sdtData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/sdt/sdts', sdtData);
    const duration = performance.now() - startedAt;

    const sdt = response.data;

    if (!sdt || typeof sdt.id === 'undefined') {
      throw new Error('Invalid SDT response structure returned from create.');
    }

    return {
      data: sdt,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateSdt(sdtId: string, updates: Record<string, unknown>): Promise<ApiResult<LMSDT>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/sdt/sdts/${sdtId}`,
      method: 'put',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.put(`/sdt/sdts/${sdtId}`, updates);
    const duration = performance.now() - startedAt;

    const sdt = response.data;

    if (!sdt || typeof sdt.id === 'undefined') {
      throw new Error(`Invalid SDT response structure for SDT ${sdtId}`);
    }

    return {
      data: sdt,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteSdt(sdtId: string): Promise<ApiResult<void>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/sdt/sdts/${sdtId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/sdt/sdts/${sdtId}`);
    const duration = performance.now() - startedAt;

    return {
      data: undefined,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  // OpsNote Management Methods
  async listOpsNotes(params?: {
    filter?: string;
    size?: number;
    offset?: number;
    fields?: string;
    autoPaginate?: boolean;
  }): Promise<ApiListResult<LMOpsNote>> {
    const { autoPaginate = true, ...restParams } = params || {};
    const sanitizedParams: Record<string, unknown> = {
      filter: restParams?.filter || undefined,
      size: restParams?.size ?? 50,
      offset: restParams?.offset ?? 0,
      fields: restParams?.fields
    };

    return this.paginateAll<LMOpsNote>('/setting/opsnotes', sanitizedParams, autoPaginate);
  }

  async getOpsNote(noteId: string, params?: { fields?: string }): Promise<ApiResult<LMOpsNote>> {
    const { fields } = params || {};

    const queryParams = Object.fromEntries(
      Object.entries({
        fields: fields && fields !== '*' ? fields : undefined
      }).filter(([, value]) => value !== undefined && value !== null)
    );

    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/opsnotes/${noteId}`,
      method: 'get',
      params: queryParams
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.get(`/setting/opsnotes/${noteId}`, {
      params: queryParams
    });
    const duration = performance.now() - startedAt;

    const note = response.data;

    if (!note || typeof note.id === 'undefined') {
      throw new Error(`Invalid OpsNote response structure for note ${noteId}`);
    }

    return {
      data: note,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async createOpsNote(noteData: Record<string, unknown>): Promise<ApiResult<LMOpsNote>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: '/setting/opsnotes',
      method: 'post',
      payload: noteData
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.post('/setting/opsnotes', noteData);
    const duration = performance.now() - startedAt;

    const note = response.data;

    if (!note || typeof note.id === 'undefined') {
      throw new Error('Invalid OpsNote response structure returned from create.');
    }

    return {
      data: note,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async updateOpsNote(noteId: string, updates: Record<string, unknown>): Promise<ApiResult<LMOpsNote>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/opsnotes/${noteId}`,
      method: 'patch',
      payload: updates
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.patch(`/setting/opsnotes/${noteId}`, updates);
    const duration = performance.now() - startedAt;

    const note = response.data;

    if (!note || typeof note.id === 'undefined') {
      throw new Error(`Invalid OpsNote response structure for note ${noteId}`);
    }

    return {
      data: note,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  async deleteOpsNote(noteId: string): Promise<ApiResult<void>> {
    const requestContext: LogicMonitorRequestContext = {
      endpoint: `/setting/opsnotes/${noteId}`,
      method: 'delete'
    };

    const startedAt = performance.now();
    const response = await this.axiosInstance.delete(`/setting/opsnotes/${noteId}`);
    const duration = performance.now() - startedAt;

    return {
      data: undefined,
      raw: response.data,
      meta: this.createResponseMeta(response, requestContext, duration)
    };
  }

  getAccount(): string {
    return this.account;
  }

  getPortalUiBaseUrl(): string {
    return this.portalUiBaseUrl;
  }
}
