import { IWebhookLogService, WebhookLogData } from '../../domain/interfaces/IWebhookLogService';
import { prisma } from '../database/PrismaClient';
import { logger } from './CustomLogger';

export class WebhookLogService implements IWebhookLogService {
  async log(data: WebhookLogData): Promise<void> {
    // Log using custom logger
    await logger.info('Webhook request processed', {
      method: data.method,
      endpoint: data.endpoint,
      success: data.success,
      ip: data.ip,
      timestamp: new Date().toISOString(),
      response: data.response
    });
  }

  async getLogsByEndpoint(endpoint: string, limit: number = 100): Promise<any[]> {
    throw new Error('Método getLogsByEndpoint no implementado');
  }

  async getLogsByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    throw new Error('Método getLogsByDateRange no implementado');
  }
}