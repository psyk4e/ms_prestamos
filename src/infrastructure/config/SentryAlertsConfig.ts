import * as Sentry from '@sentry/node';
import { logger } from '../services/CustomLogger';

// Configuración de alertas y umbrales para logs críticos
export interface AlertThreshold {
  level: 'warning' | 'error' | 'fatal';
  count: number;
  timeWindow: number; // en minutos
  enabled: boolean;
}

export interface SentryAlertsConfig {
  thresholds: {
    criticalErrors: AlertThreshold;
    authenticationFailures: AlertThreshold;
    businessCriticalOperations: AlertThreshold;
    rateLimitExceeded: AlertThreshold;
  };
  notifications: {
    email: string[];
    slack?: {
      webhook: string;
      channel: string;
    };
  };
  sampling: {
    errorSampleRate: number;
    performanceSampleRate: number;
    profilesSampleRate: number;
  };
}

// Configuración por defecto
export const defaultAlertsConfig: SentryAlertsConfig = {
  thresholds: {
    criticalErrors: {
      level: 'fatal',
      count: 1, // Alertar inmediatamente en errores críticos
      timeWindow: 1,
      enabled: true
    },
    authenticationFailures: {
      level: 'warning',
      count: 10, // Alertar si hay más de 10 fallos de auth en 5 minutos
      timeWindow: 5,
      enabled: true
    },
    businessCriticalOperations: {
      level: 'error',
      count: 3, // Alertar si hay 3 errores en operaciones críticas en 10 minutos
      timeWindow: 10,
      enabled: true
    },
    rateLimitExceeded: {
      level: 'warning',
      count: 50, // Alertar si se excede rate limit 50 veces en 15 minutos
      timeWindow: 15,
      enabled: true
    }
  },
  notifications: {
    email: [
      process.env.ALERT_EMAIL || 'admin@empresa.com',
      process.env.DEV_TEAM_EMAIL || 'dev-team@empresa.com'
    ],
    slack: process.env.SLACK_WEBHOOK ? {
      webhook: process.env.SLACK_WEBHOOK,
      channel: process.env.SLACK_CHANNEL || '#alerts'
    } : undefined
  },
  sampling: {
    errorSampleRate: 1.0, // Capturar 100% de errores
    performanceSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  }
};

// Clase para manejar alertas personalizadas
export class SentryAlertsManager {
  private config: SentryAlertsConfig;
  private alertCounters = new Map<string, { count: number; windowStart: number }>();

  constructor(config: SentryAlertsConfig = defaultAlertsConfig) {
    this.config = config;
  }

  // Verificar si se debe enviar una alerta
  shouldTriggerAlert(alertType: keyof SentryAlertsConfig['thresholds'], level: string): boolean {
    const threshold = this.config.thresholds[alertType];

    if (!threshold.enabled || threshold.level !== level) {
      return false;
    }

    const now = Date.now();
    const windowMs = threshold.timeWindow * 60 * 1000;
    const key = `${alertType}-${level}`;

    // Obtener o crear contador
    let counter = this.alertCounters.get(key);
    if (!counter || (now - counter.windowStart) > windowMs) {
      counter = { count: 0, windowStart: now };
      this.alertCounters.set(key, counter);
    }

    counter.count++;

    // Verificar si se alcanzó el umbral
    if (counter.count >= threshold.count) {
      // Resetear contador para evitar spam de alertas
      this.alertCounters.set(key, { count: 0, windowStart: now });
      return true;
    }

    return false;
  }

  // Enviar alerta crítica
  async sendCriticalAlert(message: string, context: any): Promise<void> {
    try {
      // Configurar scope específico para alertas
      Sentry.withScope((scope) => {
        scope.setTag('alert.type', 'critical');
        scope.setTag('alert.priority', 'high');
        scope.setLevel('fatal');

        scope.setContext('alert', {
          message,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          service: 'ms-prestamos-webhook',
          ...context
        });

        // Capturar como excepción crítica
        Sentry.captureException(new Error(`CRITICAL ALERT: ${message}`));
      });

      // Enviar notificaciones adicionales si están configuradas
      await this.sendExternalNotifications(message, context, 'critical');

    } catch (error) {
      console.error('Error sending critical alert:', error);
    }
  }

  // Enviar notificaciones externas (email, Slack, etc.)
  private async sendExternalNotifications(message: string, context: any, priority: string): Promise<void> {
    // Aquí se pueden implementar integraciones con servicios externos
    // Por ahora, solo log estructurado
    const notification = {
      type: 'external_notification',
      priority,
      message,
      context,
      timestamp: new Date().toISOString(),
      recipients: this.config.notifications
    };

    await logger.info('External notification sent', {
      notificationType: 'EXTERNAL_NOTIFICATION',
      notification: notification
    });

    // TODO: Implementar envío real de emails y Slack
    // - Integración con SendGrid/AWS SES para emails
    // - Webhook de Slack para notificaciones
  }

  // Configurar umbrales dinámicamente
  updateThreshold(alertType: keyof SentryAlertsConfig['thresholds'], newThreshold: Partial<AlertThreshold>): void {
    this.config.thresholds[alertType] = {
      ...this.config.thresholds[alertType],
      ...newThreshold
    };
  }

  // Obtener estadísticas de alertas
  getAlertStats(): { [key: string]: { count: number; windowStart: number } } {
    const stats: { [key: string]: { count: number; windowStart: number } } = {};

    for (const [key, value] of this.alertCounters.entries()) {
      stats[key] = { ...value };
    }

    return stats;
  }

  // Limpiar contadores antiguos
  cleanupOldCounters(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hora

    for (const [key, counter] of this.alertCounters.entries()) {
      if ((now - counter.windowStart) > maxAge) {
        this.alertCounters.delete(key);
      }
    }
  }
}

// Instancia singleton del manager de alertas
export const alertsManager = new SentryAlertsManager();

// Configurar limpieza automática cada hora
setInterval(() => {
  alertsManager.cleanupOldCounters();
}, 60 * 60 * 1000);