import { logger } from './CustomLogger';

export interface N8nWebhookPayload {
  resultado: 'aprobado' | 'rechazado';
  loanApplicationId: string;
  telefono: string;
  email?: string;
  nombre: string;
  montoSolicitado: number;
  montoAprobado?: number;
  comentario?: string;
  mensajeWhatsApp: string;
  trackingNumber: number;
  [key: string]: any;
}

export class N8nWebhookService {
  private readonly n8nWebhookUrl: string;
  private readonly n8nApiKey: string;

  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || '';
    this.n8nApiKey = process.env.N8N_API_KEY || '';

    if (!this.n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_URL environment variable is required');
    }
    if (!this.n8nApiKey) {
      throw new Error('N8N_API_KEY environment variable is required');
    }
  }

  /**
   * Envía una notificación al webhook de n8n con la decisión de la solicitud
   */
  async notifyLoanDecision(payload: N8nWebhookPayload): Promise<void> {
    try {
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.n8nApiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`N8n webhook request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      await logger.info('N8n webhook notification sent successfully', {
        loanApplicationId: payload.loanApplicationId,
        resultado: payload.resultado,
        status: response.status
      });
    } catch (error) {
      await logger.error('Error sending notification to N8n webhook', error instanceof Error ? error : new Error(String(error)), {
        loanApplicationId: payload.loanApplicationId,
        resultado: payload.resultado
      });
      throw error;
    }
  }
}
