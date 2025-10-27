import { Response } from 'express';
import { AcuerdoPagoUseCase } from '../../application/usecases/AcuerdoPagoUseCase';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { AcuerdoPago } from '../../domain/entities/AcuerdoPago';
import { AcuerdoPagoValidator } from '../../application/validators/AcuerdoPagoValidator';

/**
 * Controller for payment agreement operations
 */
export class AcuerdoPagoController {
  constructor(
    private readonly acuerdoPagoUseCase: AcuerdoPagoUseCase,
    private readonly webhookLogService: IWebhookLogService
  ) { }

  /**
   * POST /api/v1/acuerdos-pago - Creates a new payment agreement
   * @param req - Express request object with payment agreement data in body
   * @param res - Express response object
   */
  createAcuerdoPago = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate and transform request data using Zod
      const validatedData = AcuerdoPagoValidator.validateCreateAcuerdoPago(req.body);

      // Log the request
      await this.logRequest(req, {
        request: validatedData
      });

      // Create payment agreement using use case
      const result = await this.acuerdoPagoUseCase.createAcuerdoPago(validatedData);

      if (!result.success) {
        const response = {
          success: false,
          message: result.message,
          error: result.error,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(422).json(response);
        return;
      }

      const response = {
        success: true,
        message: result.message,
        data: result.data,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(201).json(response);
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

  /**
   * GET /api/v1/acuerdos-pago/credito/:creditoId - Gets payment agreements by credit ID
   * @param req - Express request object with creditoId parameter
   * @param res - Express response object
   */
  getAcuerdosByCreditoId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate creditoId parameter using Zod
      const validatedParams = AcuerdoPagoValidator.validateCreditoIdParam(req.params);

      const result = await this.acuerdoPagoUseCase.getAcuerdosByCreditoId(validatedParams.creditoId);

      const response = {
        success: result.success,
        message: result.message,
        data: result.data,
        count: Array.isArray(result.data) ? result.data.length : 0,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, result.success);
      res.status(result.success ? 200 : 500).json(response);
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

  /**
   * GET /api/v1/acuerdos-pago/cliente/:clienteId - Gets payment agreements by client ID
   * @param req - Express request object with clienteId parameter
   * @param res - Express response object
   */
  getAcuerdosByClienteId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate clienteId parameter using Zod
      const validatedParams = AcuerdoPagoValidator.validateClienteIdParam(req.params);

      const result = await this.acuerdoPagoUseCase.getAcuerdosByClienteId(validatedParams.clienteId);

      const response = {
        success: result.success,
        message: result.message,
        data: result.data,
        count: Array.isArray(result.data) ? result.data.length : 0,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, result.success);
      res.status(result.success ? 200 : 500).json(response);
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
   * Logs the incoming request for audit purposes
   * @param req - Express request object
   * @param requestData - Request data to log
   */
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
   * Logs the response for audit purposes
   * @param req - Express request object
   * @param response - Response data to log
   * @param success - Whether the operation was successful
   */
  private async logResponse(req: AuthenticatedRequest, response: object, success: boolean): Promise<void> {
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
      console.error('Error logging response:', error);
    }
  }

  /**
   * Handles errors and sends appropriate response
   * @param req - Express request object
   * @param res - Express response object
   * @param error - Error that occurred
   */
  private async handleError(req: AuthenticatedRequest, res: Response, error: any): Promise<void> {
    console.error('AcuerdoPago controller error:', error);

    const response = {
      success: false,
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    await this.logResponse(req, response, false);
    res.status(500).json(response);
  }
}