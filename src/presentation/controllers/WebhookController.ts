import { Request, Response } from 'express';
import { CreditoAtrasadoService } from '../../application/services/CreditoAtrasadoService';
import { ValidationService } from '../../application/services/ValidationService';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';

export class WebhookController {
  constructor(
    private readonly creditoService: CreditoAtrasadoService,
    private readonly webhookLogService: IWebhookLogService
  ) { }

  // GET /webhook/credito/:numCredito
  getCreditoByNumero = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { numCredito } = req.params;

      // Validar parámetros
      const validatedData = ValidationService.validateNumCredito({
        numCredito: parseInt(numCredito, 10)
      });

      const credito = await this.creditoService.getCreditoByNumero(validatedData.numCredito);

      if (!credito) {
        const response = {
          error: 'Not Found',
          message: `No se encontró información para el crédito número ${validatedData.numCredito}`,
          timestamp: new Date().toISOString()
        };

        await this.logResponse(req, response, false);
        res.status(404).json(response);
        return;
      }

      const response = {
        success: true,
        data: credito,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
      await this.handleError(req, res, error);
    }
  };

  // GET /webhook/cliente/:clienteId/creditos
  getCreditosByCliente = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { clienteId } = req.params;

      // Validar parámetros
      const validatedData = ValidationService.validateCliente({ cliente: clienteId });

      const creditos = await this.creditoService.getCreditosByCliente(validatedData.cliente);

      const response = {
        success: true,
        data: creditos,
        count: creditos.length,
        timestamp: new Date().toISOString()
      };

      await this.logResponse(req, response, true);
      res.status(200).json(response);
    } catch (error) {
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
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      };

      // Validar parámetros
      const validatedData = ValidationService.validateFilter(queryParams);

      const { page, limit, ...filter } = validatedData;

      // Si se especifica paginación
      if (page && limit) {
        const result = await this.creditoService.getCreditosWithPagination(filter, page, limit);

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
        const creditos = await this.creditoService.getAllCreditos(filter);

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
      await this.handleError(req, res, error);
    }
  };

  // POST /webhook/credito (para consultas más complejas)
  postCreditoQuery = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const validatedData = ValidationService.validateFilter(req.body);

      const creditos = await this.creditoService.getAllCreditos(validatedData);

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
}