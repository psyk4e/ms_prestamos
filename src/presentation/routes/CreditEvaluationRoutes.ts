import { Router } from 'express';
import { CreditEvaluationController } from '../controllers/CreditEvaluationController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';

export class CreditEvaluationRoutes {
  private router: Router;
  private creditEvaluationController: CreditEvaluationController;
  private authMiddleware: AuthMiddleware;

  constructor(
    creditEvaluationController: CreditEvaluationController,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.creditEvaluationController = creditEvaluationController;
    this.authMiddleware = authMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Aplicar rate limiting a todas las rutas
    this.router.use(SecurityMiddleware.createRateLimiter());

    // Aplicar autenticación a todas las rutas
    this.router.use(this.authMiddleware.authenticate);

    // POST /api/v1/credit-evaluation - Evaluar perfil crediticio
    this.router.post('/', this.creditEvaluationController.evaluateCredit);
  }

  getRouter(): Router {
    return this.router;
  }
}


