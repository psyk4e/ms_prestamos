import { Response } from 'express';
import { CreditoAtrasadoValidator } from '../../application/validators/CreditoAtrasadoValidator';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { CreditoAtrasadoUseCase } from '../../application/use-cases/CreditoAtrasadoUseCase';
import { AgentRequestUseCase } from '../../application/use-cases/AgentRequestUseCase';
import { LoanDecisionValidator } from '../../application/validators/LoanDecisionValidator';
import { CreditEvaluationUseCase } from '../../application/use-cases/CreditEvaluationUseCase';
import { CreditEvaluationValidator } from '../../application/validators/CreditEvaluationValidator';

export class WebhookController {
  constructor(
    private readonly creditoUseCase: CreditoAtrasadoUseCase,
    private readonly webhookLogService: IWebhookLogService,
    private readonly agentRequestUseCase: AgentRequestUseCase,
    private readonly creditEvaluationUseCase: CreditEvaluationUseCase
  ) { }

  // GET /webhook/credito/:numCredito
  getCreditoByNumero = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { numCredito } = req.params;

      // Validar parámetros
      const validatedData = CreditoAtrasadoValidator.validateNumCredito({
        numCredito: parseInt(numCredito, 10)
      });

      const credito = await this.creditoUseCase.getCreditoByNumero(validatedData.numCredito);

      if (!credito) {
        const response = {
          error: 'Not Found',
          message: `No se encontró información para el crédito número ${validatedData.numCredito}`,
          timestamp: new Date().toISOString()
        };

        await this.webhookLogService.log({
          endpoint: '/webhook/credito/:numCredito',
          method: 'GET',
          ip: req.ip,
          userAgent: req.get('user-agent'),
          authKey: req.headers['auth-key'] as string,
          success: false,
          response: response
        });

        res.status(404).json(response);
        return;
      }

      const response = {
        success: true,
        data: credito,
        timestamp: new Date().toISOString()
      };

      await this.webhookLogService.log({
        endpoint: '/webhook/credito/:numCredito',
        method: 'GET',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        authKey: req.headers['auth-key'] as string,
        success: true,
        response: response
      });
      res.status(200).json(response);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          message: 'Validation failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      await this.handleError(req, res, error);
    }
  };

  /**
   * Retrieves credits by client ID with optional notification type filtering
   * @param req - Express request object with clienteId param and optional notificationType query
   * @param res - Express response object
   */
  // GET /webhook/cliente/:clienteId/creditos?notificationType=early|late
  getCreditosByCliente = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clienteId } = req.params;
      const notificationType = req.query.notificationType as 'early' | 'late' | undefined;

      // Validar parámetros
      const validatedData = CreditoAtrasadoValidator.validateCliente({ cliente: clienteId });

      const creditos = await this.creditoUseCase.getCreditosByCliente(validatedData.cliente, notificationType);

      const response = {
        success: true,
        data: creditos,
        count: creditos.length,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          message: 'Validation failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      await this.handleError(req, res, error);
    }
  };

  /**
   * Retrieves credits by client identification number
   * @param req - Express request object with identificacion query parameter
   * @param res - Express response object
   */
  getCreditosByIdentificacion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const identificacion = req.query.identificacion as string;

      if (!identificacion) {
        const response = {
          success: false,
          message: 'El parámetro identificacion es requerido',
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      const validatedData = CreditoAtrasadoValidator.validateCliente({ cliente: identificacion });

      const creditos = await this.creditoUseCase.getCreditosByIdentificacion(validatedData.cliente);

      const response = {
        success: true,
        data: creditos,
        count: creditos.length,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          message: 'Validation failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      await this.handleError(req, res, error);
    }
  };

  // GET /webhook/creditos
  getAllCreditos = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const queryParams = {
        numCredito: req.query.numCredito ? parseInt(req.query.numCredito as string, 10) : undefined,
        cliente: req.query.cliente as string,
        fechaDesde: req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : undefined,
        fechaHasta: req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        notificationType: req.query.notificationType as 'early' | 'late' | undefined
      };

      // Validar parámetros
      const validatedData = CreditoAtrasadoValidator.validateFilter(queryParams);

      const { page, limit, notificationType, ...filter } = validatedData;

      // Si se especifica paginación
      if (page && limit) {
        const result = await this.creditoUseCase.getCreditosWithPagination(filter, page, limit, notificationType);

        const response = {
          success: true,
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages
          },
          timestamp: new Date().toISOString()
        };

        // Agregar headers de paginación
        res.set({
          'X-Total-Count': result.total.toString(),
          'X-Page': result.page.toString(),
          'X-Per-Page': result.limit.toString(),
          'X-Total-Pages': result.totalPages.toString()
        });

        await this.logResponse(req, response, true);
        res.status(200).json(response);
      } else {
        // Sin paginación
        const creditos = await this.creditoUseCase.getAllCreditos(filter, notificationType);

        const response = {
          success: true,
          data: creditos,
          count: creditos.length,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, true);
        res.status(200).json(response);
      }
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          message: 'Validation failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      await this.handleError(req, res, error);
    }
  };

  // POST /webhook/credito (para consultas más complejas)
  postCreditoQuery = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const validatedData = CreditoAtrasadoValidator.validateFilter(req.body);

      const creditos = await this.creditoUseCase.getAllCreditos(validatedData);

      const response = {
        success: true,
        data: creditos,
        count: creditos.length,
        query: validatedData,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          message: 'Validation failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      await this.handleError(req, res, error);
    }
  };

  private async logResponse(req: AuthenticatedRequest, response: any, success: boolean): Promise<void> {
    try {
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        authKey: '***masked***',
        success,
        response
      });
    } catch (error) {
      console.error('Error logging webhook response:', error);
    }
  }

  private async handleError(req: AuthenticatedRequest, res: Response, error: any): Promise<void> {
    console.error('Webhook error:', error);

    const response = {
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    await this.logResponse(req, response, false);
    res.status(500).json(response);
  }

  /**
   * POST /webhook/loan-decision - Processes a loan decision (approve/reject)
   * @param req - Express request object with loan decision data in body
   * @param res - Express response object
   */
  processLoanDecision = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Get approvedBy from header (priority) or body
      const approvedByHeader = req.headers['x-approved-by'] as string;
      const requestBody = { ...req.body };
      if (approvedByHeader) {
        requestBody.approvedBy = approvedByHeader;
      }

      // Validate and transform request data
      const validatedData = LoanDecisionValidator.validateLoanDecision(requestBody);

      // Log the request (without approvedBy in sensitive logs)
      await this.logRequest(req, {
        request: {
          loanApplicationId: validatedData.loanApplicationId,
          approved: validatedData.approved,
          comentario: validatedData.comentario,
          approvedBy: validatedData.approvedBy ? '***masked***' : undefined
        }
      });

      // Process loan decision using use case
      const result = await this.agentRequestUseCase.processLoanDecision({
        loanApplicationId: validatedData.loanApplicationId,
        approved: validatedData.approved,
        comentario: validatedData.comentario,
        approvedBy: validatedData.approvedBy
      });

      if (!result.success) {
        const response = {
          success: false,
          data: {
            message: result.message,
            error: result.error,
          },
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);

        // Determine appropriate status code based on error type
        let statusCode = 422;
        if (result.error === 'LOAN_APPLICATION_NOT_FOUND') {
          statusCode = 404;
        } else if (result.error === 'STATUS_IMMUTABLE') {
          statusCode = 409; // Conflict
        } else if (result.error === 'NO_ACTIVE_EVALUATION' || result.error === 'USER_DATA_NOT_FOUND' || result.error === 'PHONE_NUMBER_NOT_FOUND') {
          statusCode = 400; // Bad Request
        }

        res.status(statusCode).json(response);
        return;
      }

      const response = {
        success: true,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          message: 'Validation failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(422).json(response);
        return;
      }

      await this.handleError(req, res, error);
    }
  };

  private async logRequest(req: AuthenticatedRequest, requestData: object): Promise<void> {
    try {
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        authKey: '***masked***',
        success: true,
        request: JSON.stringify(requestData)
      });
    } catch (error) {
      console.error('Error logging request:', error);
    }
  }

  /**
   * POST /webhook/credit-evaluation - Evalúa un perfil crediticio
   * @param req - Express request object with credit evaluation data in body
   * @param res - Express response object
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
        const response = {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      const response = {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
      // Handle validation errors specifically
      if (error instanceof Error && error.message.startsWith('Validation error:')) {
        const response = {
          success: false,
          error: 'Validation Error',
          message: error.message,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(400).json(response);
        return;
      }

      // Log error
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: false,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      await this.handleError(req, res, error);
    }
  };
}