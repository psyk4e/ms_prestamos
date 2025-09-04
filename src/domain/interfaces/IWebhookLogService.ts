export interface WebhookLogData {
  endpoint: string;
  method: string;
  ip?: string;
  userAgent?: string;
  authKey?: string;
  success: boolean;
  response?: any;
}

export interface IWebhookLogService {
  log(data: WebhookLogData): Promise<void>;
  getLogsByEndpoint(endpoint: string, limit?: number): Promise<any[]>;
  getLogsByDateRange(startDate: Date, endDate: Date): Promise<any[]>;
}