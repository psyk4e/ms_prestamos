import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';

export class WebhookRoutes {
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
    // Aplicar rate limiting a todas las rutas del webhook
    this.router.use(SecurityMiddleware.createRateLimiter());

    // Aplicar autenticación a todas las rutas del webhook
    this.router.use(this.authMiddleware.authenticate);

    // Rutas principales del webhook

    // GET /webhook/credito/:numCredito - Obtener crédito por número
    this.router.get(
      '/credito/:numCredito',
      this.webhookController.getCreditoByNumero
    );

    // GET /webhook/cliente/:cliente - Obtener créditos por cliente
    this.router.get(
      '/cliente/:clienteId/creditos',
      this.webhookController.getCreditosByCliente
    );

    // GET /webhook/creditos - Obtener todos los créditos con filtros opcionales
    this.router.get(
      '/creditos',
      this.webhookController.getAllCreditos
    );

    // POST /webhook/credito - Consulta compleja de créditos
    this.router.post(
      '/credito',
      this.webhookController.postCreditoQuery
    );

    // Ruta de health check específica para webhook (sin autenticación)
    this.router.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        service: 'Webhook Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  public getRouter(): Router {
    return this.router;
  }
}