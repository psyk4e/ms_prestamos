import { IWebhookLogService, WebhookLogData } from '../../domain/interfaces/IWebhookLogService';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
import { alertsManager, SentryAlertsManager } from '../config/SentryAlertsConfig';

// Enum para niveles de logging profesionales
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warning',
  ERROR = 'error',
  CRITICAL = 'fatal'
}

// Interface para metadatos de auditoría
interface AuditMetadata {
  traceId: string;
  sessionId: string;
  timestamp: string;
  environment: string;
  service: string;
  version: string;
  userId?: string;
  correlationId?: string;
}

export class SentryLogService implements IWebhookLogService {
  private readonly serviceName = 'ms-prestamos-webhook';
  private readonly serviceVersion = process.env.npm_package_version || '1.0.0';
  private readonly environment = process.env.NODE_ENV || 'development';
  
  // Endpoints que no requieren logging detallado (filtros)
  private readonly lowPriorityEndpoints = [
    '/health',
    '/ping',
    '/metrics',
    '/favicon.ico'
  ];
  
  // Rate limiting para logs (evitar spam)
  private readonly logRateLimit = new Map<string, number>();
  private readonly rateLimitWindow = 60000; // 1 minuto
  private readonly maxLogsPerWindow = 10;
  private alertsManager: SentryAlertsManager;

  constructor(customAlertsManager?: SentryAlertsManager) {
    this.alertsManager = customAlertsManager || alertsManager;
  }

  async log(data: WebhookLogData): Promise<void> {
    try {
      // Filtrar logs de poca importancia
      if (this.shouldSkipLogging(data)) {
        return;
      }

      // Aplicar rate limiting
      if (this.isRateLimited(data)) {
        return;
      }

      // Generar metadatos de auditoría
      const auditMetadata = this.generateAuditMetadata(data);
      
      // Determinar nivel de log profesional
      const logLevel = this.determineLogLevel(data);
      
      // Solo enviar a Sentry logs importantes (WARN, ERROR, CRITICAL)
      if (this.shouldSendToSentry(logLevel)) {
        await this.sendToSentry(data, auditMetadata, logLevel);
      }
      
      // Log estructurado en consola para desarrollo
      if (this.environment === 'development') {
        this.logToConsole(data, auditMetadata, logLevel);
      }
      
    } catch (error) {
      // Fallback logging crítico
      console.error('[SENTRY_LOG_ERROR]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
        timestamp: new Date().toISOString()
      });
    }
  }

  private shouldSkipLogging(data: WebhookLogData): boolean {
    // Filtrar endpoints de baja prioridad
    return this.lowPriorityEndpoints.some(endpoint => 
      data.endpoint.includes(endpoint)
    );
  }

  private isRateLimited(data: WebhookLogData): boolean {
    const key = `${data.ip}-${data.endpoint}`;
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Limpiar entradas antiguas
    for (const [k, timestamp] of this.logRateLimit.entries()) {
      if (timestamp < windowStart) {
        this.logRateLimit.delete(k);
      }
    }
    
    // Contar logs en la ventana actual
    const logsInWindow = Array.from(this.logRateLimit.entries())
      .filter(([k]) => k.startsWith(`${data.ip}-`))
      .length;
    
    if (logsInWindow >= this.maxLogsPerWindow) {
      return true;
    }
    
    this.logRateLimit.set(key, now);
    return false;
  }

  private generateAuditMetadata(data: WebhookLogData): AuditMetadata {
    return {
      traceId: randomUUID(),
      sessionId: this.generateSessionId(data.ip),
      timestamp: new Date().toISOString(),
      environment: this.environment,
      service: this.serviceName,
      version: this.serviceVersion,
      correlationId: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  private generateSessionId(ip: string | undefined): string {
    // Generar un ID de sesión basado en IP y tiempo
    const safeIp = ip || 'unknown';
    const hash = Buffer.from(`${safeIp}-${new Date().toDateString()}`).toString('base64');
    return hash.substring(0, 16);
  }

  private determineLogLevel(data: WebhookLogData): LogLevel {
    if (!data.success) {
      // Determinar severidad del error basado en el endpoint y contexto
      if (data.endpoint.includes('/critical') || data.endpoint.includes('/payment')) {
        return LogLevel.CRITICAL;
      }
      return LogLevel.ERROR;
    }
    
    // Para requests exitosos, usar INFO solo para endpoints importantes
    if (data.endpoint.includes('/webhook/credito')) {
      return LogLevel.INFO;
    }
    
    return LogLevel.DEBUG;
  }

  private shouldSendToSentry(level: LogLevel): boolean {
    // Solo enviar logs importantes a Sentry para evitar ruido
    return [LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL].includes(level);
  }

  private async sendToSentry(data: WebhookLogData, metadata: AuditMetadata, level: LogLevel): Promise<void> {
    Sentry.withScope((scope) => {
      // Tags para filtrado y búsqueda
      scope.setTag('service', metadata.service);
      scope.setTag('environment', metadata.environment);
      scope.setTag('webhook.endpoint', data.endpoint);
      scope.setTag('webhook.method', data.method);
      scope.setTag('webhook.success', data.success);
      scope.setTag('log.level', level);
      scope.setTag('trace.id', metadata.traceId);
      
      // Contexto de auditoría completo
      scope.setContext('audit', metadata as any);
      scope.setContext('webhook', {
        endpoint: data.endpoint,
        method: data.method,
        ip: data.ip,
        userAgent: data.userAgent,
        success: data.success,
        responseTime: 0, // No disponible en WebhookLogData
        statusCode: data.success ? 200 : 500
      });
      
      // Contexto de negocio
      scope.setContext('business', {
        operation: this.extractBusinessOperation(data.endpoint),
        criticality: this.getBusinessCriticality(data.endpoint),
        dataClassification: 'confidential'
      });
      
      // Usuario para trazabilidad
      scope.setUser({
        ip_address: data.ip,
        userAgent: data.userAgent,
        sessionId: metadata.sessionId
      });
      
      // Fingerprint para agrupación inteligente
      scope.setFingerprint([
        data.endpoint,
        data.method,
        data.success ? 'success' : 'failure'
      ]);
      
      // Mensaje estructurado
      const message = this.createStructuredMessage(data, metadata, level);
      
      // Verificar alertas antes de capturar (sin await para evitar bloqueo)
      this.checkAndTriggerAlerts(data, level, message, metadata).catch(error => {
        console.error('Error in alert checking:', error);
      });
      
      // Capturar según el nivel
      if (level === LogLevel.CRITICAL) {
        Sentry.captureException(new Error(message));
      } else {
        Sentry.captureMessage(message, level as any);
      }
    });
  }

  private extractBusinessOperation(endpoint: string): string {
    if (endpoint.includes('/credito')) return 'credit_query';
    if (endpoint.includes('/payment')) return 'payment_processing';
    if (endpoint.includes('/auth')) return 'authentication';
    return 'general_webhook';
  }

  private getBusinessCriticality(endpoint: string): 'low' | 'medium' | 'high' | 'critical' {
    if (endpoint.includes('/payment') || endpoint.includes('/critical')) return 'critical';
    if (endpoint.includes('/credito')) return 'high';
    if (endpoint.includes('/auth')) return 'medium';
    return 'low';
  }

  private createStructuredMessage(data: WebhookLogData, metadata: AuditMetadata, level: LogLevel): string {
    const operation = this.extractBusinessOperation(data.endpoint);
    const status = data.success ? 'SUCCESS' : 'FAILED';
    
    return `[${level.toUpperCase()}] ${operation} | ${data.method} ${data.endpoint} | ${status} | TraceID: ${metadata.traceId}`;
  }

  private logToConsole(data: WebhookLogData, metadata: AuditMetadata, level: LogLevel): void {
    const logEntry = {
      level: level.toUpperCase(),
      timestamp: metadata.timestamp,
      traceId: metadata.traceId,
      service: metadata.service,
      webhook: {
        method: data.method,
        endpoint: data.endpoint,
        success: data.success,
        ip: data.ip,
        userAgent: data.userAgent
      },
      audit: metadata
    };
    
    console.log(JSON.stringify(logEntry, null, 2));
  }

  async getLogsByEndpoint(endpoint: string, limit: number = 100): Promise<any[]> {
    throw new Error('Método getLogsByEndpoint no implementado - usar Sentry dashboard para consultar logs');
  }

  async getLogsByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    throw new Error('Método getLogsByDateRange no implementado - usar Sentry dashboard para consultar logs');
  }

  // Verificar y disparar alertas según umbrales configurados
  private async checkAndTriggerAlerts(
    data: WebhookLogData, 
    level: LogLevel, 
    message: string, 
    metadata: AuditMetadata
  ): Promise<void> {
    try {
      // Verificar alertas por tipo de evento
      if (level === LogLevel.CRITICAL) {
        if (this.alertsManager.shouldTriggerAlert('criticalErrors', 'fatal')) {
          await this.alertsManager.sendCriticalAlert(
            `Error crítico en webhook: ${message}`,
            {
              endpoint: data.endpoint,
              method: data.method,
              ip: data.ip,
              traceId: metadata.traceId,
              timestamp: metadata.timestamp
            }
          );
        }
      }
      
      // Alertas por fallos de autenticación
      if (!data.success && data.endpoint.includes('/webhook/')) {
        if (this.alertsManager.shouldTriggerAlert('authenticationFailures', 'warning')) {
          await this.alertsManager.sendCriticalAlert(
            `Múltiples fallos de autenticación detectados`,
            {
              endpoint: data.endpoint,
              ip: data.ip,
              userAgent: data.userAgent,
              recentFailures: this.getRecentAuthFailures()
            }
          );
        }
      }
      
      // Alertas por operaciones críticas de negocio
      if (this.isBusinessCriticalOperation(data.endpoint) && !data.success) {
        if (this.alertsManager.shouldTriggerAlert('businessCriticalOperations', 'error')) {
          await this.alertsManager.sendCriticalAlert(
            `Fallo en operación crítica de negocio`,
            {
              operation: data.endpoint,
              method: data.method,
              correlationId: metadata.correlationId,
              userId: metadata.userId
            }
          );
        }
      }
      
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }
  
  // Verificar si es una operación crítica de negocio
  private isBusinessCriticalOperation(endpoint: string): boolean {
    const criticalPatterns = [
      '/webhook/credito/',
      '/api/v1/creditos/',
      '/api/v1/payments/',
      '/api/v1/transactions/'
    ];
    
    return criticalPatterns.some(pattern => endpoint.includes(pattern));
  }
  
  // Obtener estadísticas de fallos de autenticación recientes
  private getRecentAuthFailures(): any {
    // Implementar lógica para obtener fallos recientes
    // Por ahora retornamos información básica
    return {
      count: 'N/A',
      timeWindow: '5 minutes',
      note: 'Detailed stats available in Sentry dashboard'
    };
  }
}