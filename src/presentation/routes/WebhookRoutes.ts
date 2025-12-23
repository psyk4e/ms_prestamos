import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { AcuerdoPagoController } from '../controllers/AcuerdoPagoController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';

export class WebhookRoutes {
  private router: Router;
  private webhookController: WebhookController;
  private acuerdoPagoController: AcuerdoPagoController;
  private authMiddleware: AuthMiddleware;

  constructor(
    webhookController: WebhookController,
    acuerdoPagoController: AcuerdoPagoController,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.webhookController = webhookController;
    this.acuerdoPagoController = acuerdoPagoController;
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

    // GET /webhook/creditos/identificacion - Obtener créditos por número de identificación
    this.router.get(
      '/creditos/identificacion',
      this.webhookController.getCreditosByIdentificacion
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

    // POST /webhook/loan-decision - Process loan decision (approve/reject)
    this.router.post(
      '/loan-decision',
      this.webhookController.processLoanDecision
    );

    // Payment Agreement Routes
    // POST /webhook/acuerdos-pago - Create new payment agreement
    this.router.post(
      '/acuerdos-pago',
      this.acuerdoPagoController.createAcuerdoPago
    );

    // GET /webhook/acuerdos-pago/credito/:creditoId - Get agreements by credit ID
    this.router.get(
      '/acuerdos-pago/credito/:creditoId',
      this.acuerdoPagoController.getAcuerdosByCreditoId
    );

    // GET /webhook/acuerdos-pago/cliente/:clienteId - Get agreements by client ID
    this.router.get(
      '/acuerdos-pago/cliente/:clienteId',
      this.acuerdoPagoController.getAcuerdosByClienteId
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