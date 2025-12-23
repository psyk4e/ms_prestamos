import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { CreditEvaluationUseCase } from '../../application/use-cases/CreditEvaluationUseCase';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';
import { CreditEvaluationValidator } from '../../application/validators/CreditEvaluationValidator';

/**
 * Controller para evaluación de crédito
 */
export class CreditEvaluationController {
  constructor(
    private readonly creditEvaluationUseCase: CreditEvaluationUseCase,
    private readonly webhookLogService: IWebhookLogService
  ) {}

  /**
   * POST /api/v1/credit-evaluation - Evalúa un perfil crediticio
   */
  evaluateCredit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validar datos de entrada
      const validatedData = CreditEvaluationValidator.validateCreditEvaluationRequest(req.body);

      // Ejecutar evaluación
      const result = await this.creditEvaluationUseCase.evaluateCreditProfile(validatedData.profile);

      // Log de la operación
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: result.success,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: {
          approved: result.data?.evaluacion.decision === 'APROBADO',
          score: result.data?.evaluacion.puntuacion,
          riskLevel: result.data?.evaluacion.nivelRiesgo
        }
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Log error
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: false,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };
}


