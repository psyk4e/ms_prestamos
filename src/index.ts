// Require this first!
require('../instrument');

import express, { Application } from 'express';
import * as Sentry from '@sentry/node';
import { config } from './infrastructure/config/AppConfig';
import { SecurityMiddleware } from './presentation/middleware/SecurityMiddleware';
import { AuthMiddleware } from './presentation/middleware/AuthMiddleware';
import { WebhookRoutes } from './presentation/routes/WebhookRoutes';
import { ApiRoutes } from './presentation/routes/ApiRoutes';
import { WebhookController } from './presentation/controllers/WebhookController';
import { CreditoAtrasadoService } from './application/services/CreditoAtrasadoService';
import { CreditoAtrasadoRepository } from './infrastructure/database/CreditoAtrasadoRepository';
import { SentryLogService } from './infrastructure/services/SentryLogService';
import { DatabaseConnection } from './infrastructure/database/PrismaClient';

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
    
    // Capa de infraestructura
     const creditoRepository = new CreditoAtrasadoRepository();
     const webhookLogService = new SentryLogService();
    
    // Capa de aplicación
    const creditoService = new CreditoAtrasadoService(creditoRepository);
    
    // Capa de presentación
    const authMiddleware = new AuthMiddleware(webhookLogService);
    const webhookController = new WebhookController(creditoService, webhookLogService);
    
    // Rutas
    const webhookRoutes = new WebhookRoutes(webhookController, authMiddleware);
    const apiRoutes = new ApiRoutes(webhookController, authMiddleware);
    
    // Registrar rutas
    this.app.use('/webhook', webhookRoutes.getRouter());
    this.app.use('/api/v1', apiRoutes.getRouter());
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

    // Debug endpoint para verificar Sentry (solo en desarrollo)
    if (config.nodeEnv === 'development') {
      this.app.get('/debug-sentry', (req, res) => {
        throw new Error('My first Sentry error!');
      });
    }
  }

  private initializeErrorHandling(): void {
    // Middleware para rutas no encontradas
    this.app.use(SecurityMiddleware.notFoundHandler);
    
    // Sentry error handler - debe ir después de todas las rutas pero antes de otros error handlers
    Sentry.setupExpressErrorHandler(this.app);
    
    // Middleware global de manejo de errores
    this.app.use(SecurityMiddleware.errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Verificar conexión a la base de datos
      await this.checkDatabaseConnection();
      
      // Iniciar servidor
      this.app.listen(this.port, () => {
        console.log(`🚀 Server running on port ${this.port}`);
        console.log(`📊 Environment: ${config.nodeEnv}`);
        console.log(`🔗 Webhook endpoint: http://localhost:${this.port}/webhook`);
        console.log(`📚 API documentation: http://localhost:${this.port}/api/v1/docs`);
        console.log(`❤️  Health check: http://localhost:${this.port}/health`);
        
        if (config.nodeEnv === 'development') {
          console.log(`\n🔧 Development mode enabled`);
          console.log(`📝 Example webhook call:`);
          console.log(`   curl -X GET "http://localhost:${this.port}/webhook/credito/87" -H "x-auth-key: ${config.authKey}"`);
        }
      });
      
      // Manejo graceful de cierre
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async checkDatabaseConnection(): Promise<void> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$connect();
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      try {
        // Cerrar conexión a la base de datos
        await DatabaseConnection.disconnect();
        console.log('✅ Database connection closed');
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Escuchar señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Manejo de errores no capturados
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
  }
}

// Inicializar y ejecutar la aplicación
const app = new App();
app.start().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});