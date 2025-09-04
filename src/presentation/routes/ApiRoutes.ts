import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';

export class ApiRoutes {
  private router: Router;
  private webhookController: WebhookController;
  private authMiddleware: AuthMiddleware;

  constructor(
    webhookController: WebhookController,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.webhookController = webhookController;
    this.authMiddleware = authMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Aplicar rate limiting más permisivo para API
    this.router.use(SecurityMiddleware.createRateLimiter());

    // Aplicar autenticación opcional para algunas rutas de API
    this.router.use(this.authMiddleware.optionalAuth);

    // Rutas de la API v1

    // GET /api/v1/health - Health check público
    this.router.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        service: 'MS Prestamos API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // GET /api/v1/info - Información del servicio
    this.router.get('/info', (req, res) => {
      res.status(200).json({
        service: 'MS Prestamos - Webhook Service',
        version: '1.0.0',
        description: 'Microservicio para consulta de información de créditos atrasados',
        endpoints: {
          webhook: {
            base: '/webhook',
            authentication: 'required',
            methods: ['GET', 'POST'],
            routes: [
              'GET /webhook/credito/:numCredito',
              'GET /webhook/cliente/:cliente',
              'GET /webhook/creditos',
              'POST /webhook/credito'
            ]
          },
          api: {
            base: '/api/v1',
            authentication: 'optional',
            methods: ['GET'],
            routes: [
              'GET /api/v1/health',
              'GET /api/v1/info',
              'GET /api/v1/docs'
            ]
          }
        },
        authentication: {
          type: 'API Key',
          header: 'x-auth-key',
          query: 'authKey'
        },
        rateLimit: {
          windowMs: process.env.RATE_LIMIT_WINDOW_MS || '900000',
          maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || '100'
        },
        timestamp: new Date().toISOString()
      });
    });

    // GET /api/v1/docs - Documentación básica de la API
    this.router.get('/docs', (req, res) => {
      res.status(200).json({
        title: 'MS Prestamos - Webhook API Documentation',
        version: '1.0.0',
        description: 'API para consulta de información de créditos atrasados basada en la vista View_creditos_atrasados',
        baseUrl: req.protocol + '://' + req.get('host'),
        authentication: {
          description: 'Todas las rutas del webhook requieren autenticación mediante API Key',
          methods: [
            {
              type: 'Header',
              name: 'x-auth-key',
              example: 'x-auth-key: your-api-key-here'
            },
            {
              type: 'Query Parameter',
              name: 'authKey',
              example: '?authKey=your-api-key-here'
            }
          ]
        },
        endpoints: {
          '/webhook/credito/:numCredito': {
            method: 'GET',
            description: 'Obtiene información de un crédito específico por número',
            parameters: {
              numCredito: 'Número del crédito (entero positivo)'
            },
            example: '/webhook/credito/87',
            response: {
              cliente: 'string',
              cuotasVencidas: 'number',
              concepto: 'string',
              desde: 'date',
              ponerseAlDia: 'number'
            }
          },
          '/webhook/cliente/:cliente': {
            method: 'GET',
            description: 'Obtiene todos los créditos atrasados de un cliente',
            parameters: {
              cliente: 'Nombre del cliente (string)'
            },
            example: '/webhook/cliente/Juan%20Perez'
          },
          '/webhook/creditos': {
            method: 'GET',
            description: 'Obtiene créditos con filtros opcionales y paginación',
            queryParameters: {
              numCredito: 'Filtrar por número de crédito',
              cliente: 'Filtrar por nombre de cliente',
              fechaDesde: 'Filtrar desde fecha (YYYY-MM-DD)',
              fechaHasta: 'Filtrar hasta fecha (YYYY-MM-DD)',
              page: 'Número de página (default: 1)',
              limit: 'Elementos por página (default: 10, max: 100)'
            },
            example: '/webhook/creditos?page=1&limit=10&cliente=Juan'
          },
          '/webhook/credito': {
            method: 'POST',
            description: 'Consulta compleja de créditos mediante body JSON',
            body: {
              numCredito: 'number (optional)',
              cliente: 'string (optional)',
              fechaDesde: 'string (optional, YYYY-MM-DD)',
              fechaHasta: 'string (optional, YYYY-MM-DD)'
            }
          }
        },
        examples: {
          sqlQuery: 'SELECT CLIENTE,CANT_CUOTAS as [CUOTAS VENCIDAS],\'Notificación de atraso en cuota\' AS [CONCEPTO],DESDE,TotalAdeudado AS [PONERSE AL DIA] FROM View_creditos_atrasados WHERE num_credito = 87',
          curlExample: `curl -X GET "${req.protocol}://${req.get('host')}/webhook/credito/87" -H "x-auth-key: your-api-key-here"`
        },
        timestamp: new Date().toISOString()
      });
    });

    // Ruta para estadísticas básicas (requiere autenticación)
    this.router.get('/stats', this.authMiddleware.authenticate, async (req, res) => {
      try {
        // Aquí podrías agregar lógica para estadísticas básicas
        res.status(200).json({
          message: 'Statistics endpoint - To be implemented',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Error retrieving statistics',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  public getRouter(): Router {
    return this.router;
  }
}