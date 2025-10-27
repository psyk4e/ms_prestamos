export interface WebhookLogData {
  endpoint: string;
  method: string;
  ip?: string;
  userAgent?: string;
  authKey?: string;
  success: boolean;
  response?: object;
  request?: object | string;
}

export interface IWebhookLogService {
  log(data: WebhookLogData): Promise<void>;
  getLogsByEndpoint(endpoint: string, limit?: number): Promise<WebhookLogData[]>;
  getLogsByDateRange(startDate: Date, endDate: Date): Promise<WebhookLogData[]>;
}