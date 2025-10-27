import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { AzureBlobStorageService } from '../../infrastructure/services/AzureBlobStorageService';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';
import { CustomLogger } from '../../infrastructure/services/CustomLogger';

/**
 * Controller for secure image serving from Azure Blob Storage
 */
export class DocumentsController {
  private readonly azureBlobService: AzureBlobStorageService;
  private readonly logger: CustomLogger;

  constructor(
    private readonly webhookLogService: IWebhookLogService
  ) {
    this.azureBlobService = new AzureBlobStorageService();
    this.logger = new CustomLogger({
      serviceName: 'DocumentsController'
    });
  }

  /**
   * Serves an image from Azure Blob Storage securely
   * GET /api/images/:imagePath
   */
  getImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const clientName = this.getClientName(req);

    try {
      // Log the webhook request
      await this.webhookLogService.log({
        endpoint: '/api/v1/documents',
        method: 'GET',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        request: { imagePath: req.params.imagePath, clientName }
      });

      const { imagePath: DocumentPath } = req.params;

      if (!DocumentPath) {
        this.sendError(res, 400, 'MISSING_PATH', 'Document path is required', clientName);
        return;
      }

      // Get document metadata first to check if it exists and get content type
      const metadata = await this.azureBlobService.getBlobMetadata(DocumentPath);

      if (!metadata.exists) {
        this.sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found', clientName);
        return;
      }

      // Get the document buffer
      const documentBuffer = await this.azureBlobService.getBlob(DocumentPath);

      // Set appropriate headers
      if (clientName) {
        res.set('X-Client-Name', clientName);
      }
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': documentBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Last-Modified': metadata.lastModified?.toUTCString() || new Date().toUTCString(),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      });

      // Send the document
      res.send(documentBuffer);



      // Log successful response
      const duration = Date.now() - startTime;
      this.logger.info(`Document served successfully: ${DocumentPath}`, {
        duration,
        size: documentBuffer.length,
        contentType: metadata.contentType,
        clientName
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Failed to serve document: ${req.params.imagePath}`,
        error instanceof Error ? error : new Error(String(error)));

      this.sendError(res, 500, 'DOCUMENT_RETRIEVAL_ERROR', 'Failed to retrieve document', clientName, { duration, error: errorMessage });
    }
  };

  /**
   * Gets document metadata without downloading the full document
   * GET /api/documents/:documentPath/metadata
   */
  getDocumentMetadata = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const clientName = this.getClientName(req);

    try {
      await this.webhookLogService.log({
        endpoint: '/api/v1/documents/metadata',
        method: 'GET',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        success: true,
        request: { imagePath: req.params.imagePath, clientName }
      });

      const { imagePath } = req.params;

      if (!imagePath) {
        this.sendError(res, 400, 'MISSING_IMAGE_PATH', 'Image path is required', clientName);
        return;
      }

      if (!this.azureBlobService.isValidImagePath(imagePath)) {
        this.sendError(res, 400, 'INVALID_IMAGE_TYPE', 'Invalid image file type', clientName);
        return;
      }

      const metadata = await this.azureBlobService.getBlobMetadata(imagePath);

      if (!metadata.exists) {
        this.sendError(res, 404, 'IMAGE_NOT_FOUND', 'Image not found', clientName);
        return;
      }

      const response = {
        exists: metadata.exists,
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
        lastModified: metadata.lastModified?.toISOString(),
        sanitizedPath: this.sanitizePathForResponse(imagePath)
      };

      this.sendSuccess(res, 'Image metadata retrieved', response, clientName);

    } catch (error) {
      this.logger.error(`Failed to get image metadata: ${req.params.imagePath}`,
        error instanceof Error ? error : new Error(String(error)));

      this.sendError(res, 500, 'METADATA_RETRIEVAL_ERROR', 'Failed to retrieve image metadata', clientName);
    }
  };

  /**
   * Sanitizes headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = ['content-type', 'user-agent', 'accept', 'accept-language'];

    for (const [key, value] of Object.entries(headers)) {
      if (allowedHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitizes the image path for response to remove sensitive information
   */
  private sanitizePathForResponse(imagePath: string): string {
    // Remove any potential sensitive information like account numbers or IDs
    // Keep only the filename part for security
    const parts = imagePath.split('/');
    return parts[parts.length - 1]; // Return only the filename
  }

  // Helper to extract client name from header or query
  private getClientName(req: AuthenticatedRequest): string | undefined {
    const headerName = req.get('x-client-name') || req.get('X-Client-Name');
    const queryName = (req.query.clientName as string) || (req.query.client as string);
    const name = headerName || queryName;
    return name ? String(name) : undefined;
  }

  // Standardized JSON success response
  private sendSuccess(res: Response, message: string, data?: any, clientName?: string): void {
    res.json({ success: true, code: 'OK', message, clientName, data });
  }

  // Standardized JSON error response
  private sendError(
    res: Response,
    status: number,
    code: string,
    message: string,
    clientName?: string,
    details?: any
  ): void {
    res.status(status).json({ success: false, code, message, clientName, details });
  }
}