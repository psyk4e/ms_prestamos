import { Router } from 'express';
import { DocumentsController } from '../controllers/DocumentsController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';

/**
 * Routes for secure document/image serving from Azure Blob Storage
 */
export class DocumentsRoutes {
  private router: Router;
  private documentsController: DocumentsController;
  private authMiddleware: AuthMiddleware;

  constructor(
    documentsController: DocumentsController,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.documentsController = documentsController;
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/documents/:imagePath
     * @description Serves a stored image/document from Azure Blob Storage
     * @access Private (requires authentication)
     * @param imagePath - The path to the blob in storage (URL encoded)
     */
    this.router.get(
      '/:imagePath(*)', // Use (*) to capture the full path including slashes
      this.authMiddleware.authenticate,
      this.documentsController.getImage
    );

    /**
     * @route GET /api/v1/documents/:imagePath/metadata
     * @description Gets metadata without downloading the full blob
     * @access Private (requires authentication)
     * @param imagePath - The path to the blob in storage (URL encoded)
     */
    this.router.get(
      '/:imagePath(*)/metadata',
      this.authMiddleware.authenticate,
      this.documentsController.getDocumentMetadata
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default DocumentsRoutes;