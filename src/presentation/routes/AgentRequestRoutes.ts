import { Router } from 'express';
import { AgentRequestController } from '../controllers/AgentRequestController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';

export class AgentRequestRoutes {
  private router: Router;
  private agentRequestController: AgentRequestController;
  private authMiddleware: AuthMiddleware;

  constructor(
    agentRequestController: AgentRequestController,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.agentRequestController = agentRequestController;
    this.authMiddleware = authMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Apply rate limiting to all agent request routes
    this.router.use(SecurityMiddleware.createRateLimiter());

    // Apply authentication to all agent request routes
    this.router.use(this.authMiddleware.authenticate);

    // Agent Request Routes

    // GET /api/v1/agent-requests/count - Get count (must be before /:id route)
    this.router.get('/count', this.agentRequestController.getAgentRequestsCount);

    // GET /api/v1/agent-requests/status/:status - Get by status
    this.router.get('/status/:status', this.agentRequestController.getAgentRequestsByStatus);

    // GET /api/v1/agent-requests/:id/documents/:filename - Get specific document by filename (must be before documentPath route)
    this.router.get('/:id/documents/:filename', this.agentRequestController.getAgentRequestDocuments);

    // GET /api/v1/agent-requests/:id/documents/:documentPath(*) - Serve specific document
    this.router.get('/:id/documents/:documentPath(*)', this.agentRequestController.getAgentRequestDocument);

    // GET /api/v1/agent-requests/:id - Get request by ID
    this.router.get('/:id', this.agentRequestController.getAgentRequestById);

    // GET /api/v1/agent-requests - Get all requests with filters
    this.router.get('/', this.agentRequestController.getAgentRequests);
  }

  getRouter(): Router {
    return this.router;
  }
}