import { IWebhookLogService, WebhookLogData } from '../../domain/interfaces/IWebhookLogService';
import { prisma } from '../database/PrismaClient';

export class WebhookLogService implements IWebhookLogService {
  async log(data: WebhookLogData): Promise<void> {
    // Log solo en consola ya que no tenemos permisos de escritura en la BD
    console.log(`[${new Date().toISOString()}] ${data.method} ${data.endpoint} - ${data.success ? 'SUCCESS' : 'FAILED'} - ${data.ip}`);
  }

  async getLogsByEndpoint(endpoint: string, limit: number = 100): Promise<any[]> {
    throw new Error('Método getLogsByEndpoint no implementado');
  }

  async getLogsByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    throw new Error('Método getLogsByDateRange no implementado');
  }
}