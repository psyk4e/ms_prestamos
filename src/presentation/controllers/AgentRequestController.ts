import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { AgentRequestUseCase } from '../../application/use-cases/AgentRequestUseCase';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';
import { AgentRequestValidator } from '../../application/validators/AgentRequestValidator';
import { LoanDecisionValidator } from '../../application/validators/LoanDecisionValidator';
import { AzureBlobStorageService } from '../../infrastructure/services/AzureBlobStorageService';

/**
 * Controller for Agent Request operations - Desktop Integration
 */
export class AgentRequestController {
  constructor(
    private readonly agentRequestUseCase: AgentRequestUseCase,
    private readonly webhookLogService: IWebhookLogService,
    private readonly azureBlobStorageService: AzureBlobStorageService
  ) { }

  // BigInt -> string sanitizer to prevent JSON serialization errors
  private sanitizeBigInt = (value: any): any => {
    if (value instanceof Date) return value.toISOString();
    if (value && value.constructor && value.constructor.name === 'Decimal') {
      try {
        if (typeof (value as any).toNumber === 'function') return (value as any).toNumber();
        return Number((value as any).toString());
      } catch {
        return (value as any).toString();
      }
    }
    // Convert objects that stringify to non-default tokens (Decimal-like) 
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as any).toString === 'function'
    ) {
      const str = (value as any).toString();
      if (str !== '[object Object]') {
        const num = Number(str);
        return Number.isNaN(num) ? str : num;
      }
    }
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map((v) => this.sanitizeBigInt(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.sanitizeBigInt(v)])
      );
    }
    return value;
  };

  /**
   * GET /api/v1/agent-requests - Get all agent requests with optional filters
   */
  getAgentRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { status, page = '1', limit = '10', since, fase } = req.query as any;

      // Map numeric status codes to DB status strings
      const statusMap: Record<string, string> = {
        '1': 'in_progress',
        '2': 'completed',
        '3': 'approved',
        '4': 'rejected',
        '5': 'cancelled',
      };
      const mappedStatus = typeof status === 'string' && statusMap[status] ? statusMap[status] : (status as string | undefined);

      // Map numeric fase codes to DB faseActual strings
      const faseMap: Record<string, string> = {
        '1': 'pre_calificacion',
        '2': 'datos_personales',
        '3': 'documentacion',
        '4': 'revision',
      };
      const mappedFaseActual = typeof fase === 'string' && faseMap[fase] ? faseMap[fase] : (fase as string | undefined);

      // Validate query parameters
      const validatedData = AgentRequestValidator.validateListParams({
        status: mappedStatus,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        since: since as string,
        faseActual: mappedFaseActual,
      });

      const result = await this.agentRequestUseCase.getAgentRequests(validatedData);

      // Log successful operation
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: true,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { count: result.data.length, total: result.total }
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          page: validatedData.page,
          limit: validatedData.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / validatedData.limit)
        },
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

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * GET /api/v1/agent-requests/:id - Get agent request by ID
   */
  getAgentRequestById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { id } = req.params;

      // Validate parameters
      const validatedData = AgentRequestValidator.validateId({ id });

      const agentRequest = await this.agentRequestUseCase.getAgentRequestById(validatedData.id);

      if (!agentRequest) {
        const response = {
          success: false,
          error: 'Not Found',
          message: `No se encontró la solicitud con ID: ${validatedData.id}`,
          timestamp: new Date().toISOString()
        };

        // Log not found
        await this.webhookLogService.log({
          endpoint: req.originalUrl,
          method: req.method,
          success: false,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          response: { error: 'Agent request not found' }
        });

        res.status(404).json(response);
        return;
      }

      // Log successful operation
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: true,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { agentRequestId: agentRequest.id }
      });

      res.status(200).json({
        success: true,
        data: this.sanitizeBigInt(agentRequest),
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

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * GET /api/v1/agent-requests/:id/documents - Get documents for agent request
   */
  getAgentRequestDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { id, filename } = req.params;
      const clientName = this.getClientName(req);

      // Validate parameters
      const validatedData = AgentRequestValidator.validateDocumentWithFilenameParams({ id, filename });

      // Get agent request to extract identificacion and userId
      const agentRequest = await this.agentRequestUseCase.getAgentRequestById(validatedData.id);

      if (!agentRequest) {
        await this.sendError(req, res, 404, 'Agent request not found', `No se encontró la solicitud con ID: ${validatedData.id}`, clientName);
        return;
      }

      // Extract identificacion and userId from agent request
      const identificacion = agentRequest.personalData?.cedula;
      const userId = agentRequest.userId;

      if (!identificacion || !userId) {
        await this.sendError(req, res, 400, 'Missing identification or userId', 'No se encontró la identificación o userId del usuario en la solicitud', clientName);
        return;
      }

      // Format blob path as {identificacion}-{userId}/{filename}
      const blobPath = `${identificacion}-${userId}/${validatedData.filename}`;

      // Get document from Azure Blob Storage
      const documentBuffer = await this.azureBlobStorageService.getBlob(blobPath);
      const metadata = await this.azureBlobStorageService.getBlobMetadata(blobPath);

      if (!documentBuffer || !metadata) {
        await this.sendError(req, res, 404, 'Document not found', `No se encontró el documento: ${filename}`, clientName);
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Content-Length', documentBuffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      // Log successful operation
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: true,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: {
          agentRequestId: validatedData.id,
          filename: filename,
          blobPath: blobPath,
          contentType: metadata.contentType,
          size: documentBuffer.length
        }
      });

      // Send the document
      res.send(documentBuffer);

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

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * GET /api/v1/agent-requests/status/:status - Get agent requests by status
   */
  getAgentRequestsByStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { status } = req.params;
      const { page = '1', limit = '10' } = req.query;

      // Map numeric status codes to DB status strings
      const statusMap: Record<string, string> = {
        '1': 'in_progress',
        '2': 'completed',
        '3': 'approved',
        '4': 'rejected',
        '5': 'cancelled',
      };
      const mappedStatus = statusMap[status] ?? status;

      // Validate parameters
      const validatedData = AgentRequestValidator.validateStatusParams({
        status: mappedStatus,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      });

      const result = await this.agentRequestUseCase.getAgentRequestsByStatus(
        validatedData.status,
        validatedData.page,
        validatedData.limit
      );

      // Log successful operation
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: true,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { status: validatedData.status, count: result.data.length, total: result.total }
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          page: validatedData.page,
          limit: validatedData.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / validatedData.limit)
        },
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

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * GET /api/v1/agent-requests/count - Get count of requests since timestamp
   */
  getAgentRequestsCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { since } = req.query;

      // Validate parameters
      const validatedData = AgentRequestValidator.validateCountParams({
        since: since as string
      });

      const count = await this.agentRequestUseCase.getAgentRequestsCount(validatedData.since);

      // Log successful operation
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: true,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { count, since: validatedData.since }
      });

      res.status(200).json({
        success: true,
        count,
        since: validatedData.since,
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

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * GET /api/v1/agent-requests/:id/documents/:documentPath(*) - Serve specific document
   */
  getAgentRequestDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { id, documentPath } = req.params;
      const clientName = this.getClientName(req);

      // Validate parameters
      const validatedData = AgentRequestValidator.validateId({ id });

      // Verify agent request exists
      const agentRequest = await this.agentRequestUseCase.getAgentRequestById(validatedData.id);
      if (!agentRequest) {
        await this.sendError(req, res, 404, 'Agent request not found', `No se encontró la solicitud con ID: ${validatedData.id}`, clientName);
        return;
      }

      // Get document from Azure Blob Storage
      const documentBuffer = await this.azureBlobStorageService.getBlob(validatedData.documentPath);
      const metadata = await this.azureBlobStorageService.getBlobMetadata(validatedData.documentPath);

      if (!documentBuffer || !metadata) {
        await this.sendError(req, res, 404, 'Document not found', `No se encontró el documento: ${validatedData.documentPath}`, clientName);
        return;
      }

      // Log successful operation
      await this.webhookLogService.log({
        endpoint: req.originalUrl,
        method: req.method,
        success: true,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        response: { agentRequestId: id, documentPath: validatedData.documentPath, size: documentBuffer.length }
      });

      // Set appropriate headers
      res.set({
        'Content-Type': metadata.contentType,
        'Content-Length': documentBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Last-Modified': metadata.lastModified?.toUTCString() || new Date().toUTCString()
      });

      res.send(documentBuffer);

    } catch (error) {
      const clientName = this.getClientName(req);
      await this.sendError(req, res, 500, 'Internal Server Error', error instanceof Error ? error.message : 'Unknown error occurred', clientName);
    }
  };

  // Helper methods for standardized responses
  private getClientName(req: AuthenticatedRequest): string | undefined {
    const headerName = req.get('x-client-name') || req.get('X-Client-Name');
    const queryName = (req.query.clientName as string) || (req.query.client as string);
    const name = headerName || queryName;
    return name ? String(name) : undefined;
  }

  private async sendSuccess(req: AuthenticatedRequest, res: Response, statusCode: number, data: any, clientName?: string): Promise<void> {
    const response = {
      success: true,
      data: this.sanitizeBigInt(data),
      timestamp: new Date().toISOString()
    };

    // Log successful operation
    await this.webhookLogService.log({
      endpoint: req.originalUrl,
      method: req.method,
      success: true,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      response: { statusCode, dataType: typeof data }
    });

    res.status(statusCode).json(response);
  }

  private async sendError(req: AuthenticatedRequest, res: Response, statusCode: number, error: string, message: string, clientName?: string): Promise<void> {
    const response = {
      success: false,
      error,
      message,
      timestamp: new Date().toISOString()
    };

    // Log error
    await this.webhookLogService.log({
      endpoint: req.originalUrl,
      method: req.method,
      success: false,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      response: { error, message }
    });

    res.status(statusCode).json(response);
  }

  /**
   * POST /api/v1/agent-requests/loan-decision - Processes a loan decision (approve/reject)
   * @param req - Express request object with loan decision data in body
   * @param res - Express response object
   */
  processLoanDecision = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate and transform request data
      const validatedData = LoanDecisionValidator.validateLoanDecision(req.body);

      // Log the request
      await this.logRequest(req, {
        request: validatedData
      });

      // Process loan decision using use case
      const result = await this.agentRequestUseCase.processLoanDecision({
        loanApplicationId: validatedData.loanApplicationId,
        approved: validatedData.approved,
        comentario: validatedData.comentario
      });

      if (!result.success) {
        const response = {
          success: false,
          message: result.message,
          error: result.error,
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

      await this.sendError(req, res, 500, 'Internal Server Error', error instanceof Error ? error.message : 'An unexpected error occurred');
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
}