// Require this first!
require('../instrument');

import express, { Application } from 'express';
import * as Sentry from '@sentry/node';
import { config } from './infrastructure/config/AppConfig';
import { SecurityMiddleware } from './presentation/middleware/SecurityMiddleware';
import { AuthMiddleware } from './presentation/middleware/AuthMiddleware';
import { WebhookRoutes } from './presentation/routes/WebhookRoutes';
import { ApiRoutes } from './presentation/routes/ApiRoutes';
import { AgentRequestRoutes } from './presentation/routes/AgentRequestRoutes';
import { DocumentsRoutes } from './presentation/routes/DocumentsRoutes';
import { ReportingRoutes } from './presentation/routes/ReportingRoutes';
import { WebhookController } from './presentation/controllers/WebhookController';
import { AcuerdoPagoController } from './presentation/controllers/AcuerdoPagoController';
import { AgentRequestController } from './presentation/controllers/AgentRequestController';
import { DocumentsController } from './presentation/controllers/DocumentsController';
import { ReportingController } from './presentation/controllers/ReportingController';
import { CreditoAtrasadoRepository } from './infrastructure/database/CreditoAtrasadoRepository';
import { AcuerdoPagoRepository } from './infrastructure/database/AcuerdoPagoRepository';
import { AgentRequestRepository } from './infrastructure/database/AgentRequestRepository';
import { SentryLogService } from './infrastructure/services/SentryLogService';
import { AzureBlobStorageService } from './infrastructure/services/AzureBlobStorageService';
import { N8nWebhookService } from './infrastructure/services/N8nWebhookService';
import { DatabaseConnection } from './infrastructure/database/PrismaClient';
import { PrismaClient as PostgresClient } from '@prisma-postgres/client';
import { CreditoAtrasadoUseCase } from './application/use-cases/CreditoAtrasadoUseCase';
import { AcuerdoPagoUseCase } from './application/usecases/AcuerdoPagoUseCase';
import { AgentRequestUseCase } from './application/use-cases/AgentRequestUseCase';
import { ReportingUseCase } from './application/use-cases/ReportingUseCase';
import { CreditEvaluationUseCase } from './application/use-cases/CreditEvaluationUseCase';
import { ReportingService } from './infrastructure/services/ReportingService';
import { logger } from './infrastructure/services/CustomLogger';

class App {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.initializeMiddlewares();
    this.initializeDependencies();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Middleware de seguridad básica
    this.app.use(SecurityMiddleware.createHelmetMiddleware());
    this.app.use(SecurityMiddleware.createCorsMiddleware());
    this.app.use(SecurityMiddleware.createCompressionMiddleware());

    // Middleware para parsing de JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Middleware de logging
    this.app.use(SecurityMiddleware.requestLogger);

    // Trust proxy para obtener IP real detrás de proxies/load balancers
    this.app.set('trust proxy', 1);
  }

  private initializeDependencies(): void {
    // Inicializar dependencias siguiendo el patrón de inyección de dependencias

    // Instancia del cliente de PostgreSQL para reportes
    const postgresClient = new PostgresClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });

    // Capa de infraestructura
    const webhookLogService = new SentryLogService();
    const creditoRepository = new CreditoAtrasadoRepository();
    const acuerdoPagoRepository = new AcuerdoPagoRepository();
    const agentRequestRepository = new AgentRequestRepository();
    const azureBlobStorageService = new AzureBlobStorageService();
    const reportingService = new ReportingService();
    const n8nWebhookService = new N8nWebhookService();

    // Capa de aplicación
    const creditoAtrasadoUseCase = new CreditoAtrasadoUseCase(creditoRepository);
    const acuerdoPagoUseCase = new AcuerdoPagoUseCase(acuerdoPagoRepository);
    const agentRequestUseCase = new AgentRequestUseCase(agentRequestRepository, n8nWebhookService);
    const reportingUseCase = new ReportingUseCase(postgresClient, reportingService, logger);
    const creditEvaluationUseCase = new CreditEvaluationUseCase();

    // Capa de presentación
    const authMiddleware = new AuthMiddleware(webhookLogService);
    const webhookController = new WebhookController(creditoAtrasadoUseCase, webhookLogService, agentRequestUseCase, creditEvaluationUseCase);
    const acuerdoPagoController = new AcuerdoPagoController(acuerdoPagoUseCase, webhookLogService);
    const agentRequestController = new AgentRequestController(agentRequestUseCase, webhookLogService, azureBlobStorageService);
    const documentsController = new DocumentsController(webhookLogService);
    const reportingController = new ReportingController(reportingUseCase, logger);

    // Rutas
    const webhookRoutes = new WebhookRoutes(webhookController, acuerdoPagoController, authMiddleware);
    const apiRoutes = new ApiRoutes(webhookController, authMiddleware);
    const agentRequestRoutes = new AgentRequestRoutes(agentRequestController, authMiddleware);
    const documentsRoutes = new DocumentsRoutes(documentsController, authMiddleware);
    const reportingRoutes = new ReportingRoutes(reportingController, authMiddleware);

    // Registrar rutas
    this.app.use('/webhook', webhookRoutes.getRouter());
    this.app.use('/api/v1', apiRoutes.getRouter());
    this.app.use('/api/v1/agent-requests', agentRequestRoutes.getRouter());
    this.app.use('/api/v1/documents', documentsRoutes.getRouter());
    this.app.use('/api/v1/reports', reportingRoutes.getRouter());
  }

  private initializeRoutes(): void {
    // Ruta raíz
    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'MS Prestamos - Webhook Service',
        version: '1.0.0',
        status: 'OK',
        timestamp: new Date().toISOString(),
        endpoints: {
          webhook: '/webhook',
          api: '/api/v1',
          health: '/api/v1/health',
          docs: '/api/v1/docs'
        }
      });
    });

    // Health check global
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      });
    });

    // // Debug endpoint para verificar Sentry (solo en desarrollo)
    // if (config.nodeEnv === 'development') {
    //   this.app.get('/debug-sentry', (req, res) => {
    //     throw new Error('My first Sentry error!');
    //   });
    // }
  }

  private initializeErrorHandling(): void {
    // Middleware para rutas no encontradas
    this.app.use(SecurityMiddleware.notFoundHandler);

    // Sentry error handler - debe ir después de todas las rutas pero antes de otros error handlers
    Sentry.setupExpressErrorHandler(this.app);

    // Middleware global de manejo de errores
    this.app.use(SecurityMiddleware.errorHandler);
  }

  public getApp(): Application {
    return this.app;
  }

  public async start(): Promise<void> {
    try {
      // Verificar conexión a la base de datos
      // await this.checkDatabaseConnection();

      // Iniciar servidor
      this.app.listen(this.port, async () => {
        await logger.info('🚀 Server started successfully', {
          port: this.port,
          environment: config.nodeEnv,
          webhookEndpoint: `http://localhost:${this.port}/webhook`,
          apiDocs: `http://localhost:${this.port}/api/v1/docs`,
          healthCheck: `http://localhost:${this.port}/health`
        });

        if (config.nodeEnv === 'development') {
          await logger.info('🔧 Development mode enabled', {
            exampleWebhookCall: `curl -X GET "http://localhost:${this.port}/webhook/credito/87" -H "x-auth-key: ${config.authKey}"`
          });
        }
      });

      // Manejo graceful de cierre
      this.setupGracefulShutdown();

    } catch (error) {
      await logger.error('❌ Failed to start server:', error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  }

  private async checkDatabaseConnection(): Promise<void> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$connect();
      await logger.info('✅ Database connection established');
    } catch (error) {
      await logger.error('❌ Database connection failed:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      await logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);

      try {
        // Cerrar conexión a la base de datos
        await DatabaseConnection.disconnect();
        await logger.info('✅ Database connection closed');

        await logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        await logger.error('❌ Error during graceful shutdown:', error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
      }
    };

    // Escuchar señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejo de errores no capturados
    process.on('unhandledRejection', async (reason, promise) => {
      await logger.error('❌ Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
        promiseInfo: String(promise)
      });
    });

    process.on('uncaughtException', async (error) => {
      await logger.error('❌ Uncaught Exception', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
  }
}

// Inicializar la aplicación
const appInstance = new App();
const expressApp = appInstance.getApp();

// Para Vercel: exportar la app de Express como default
// Vercel detectará automáticamente la app y la ejecutará
export default expressApp;

// Para desarrollo local: iniciar el servidor con app.listen
// Solo se ejecuta si no estamos en Vercel (donde PORT se asigna automáticamente)
if (process.env.VERCEL !== '1') {
  appInstance.start().catch(async (error) => {
    await logger.error('❌ Application failed to start', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  });
}