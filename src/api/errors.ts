export interface LogicMonitorErrorDetails {
  status?: number;
  code?: string;
  requestId?: string;
  requestUrl?: string;
  requestMethod?: string;
  responseBody?: unknown;
}

export class LogicMonitorApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly requestId?: string;
  public readonly requestUrl?: string;
  public readonly requestMethod?: string;
  public readonly responseBody?: unknown;

  constructor(message: string, details: LogicMonitorErrorDetails = {}) {
    super(message);
    this.name = 'LogicMonitorApiError';
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.requestUrl = details.requestUrl;
    this.requestMethod = details.requestMethod;
    this.responseBody = details.responseBody;
  }
}

export const isLogicMonitorApiError = (error: unknown): error is LogicMonitorApiError => {
  return error instanceof LogicMonitorApiError;
};
