import { Router } from 'express';
import { ReportingController } from '../controllers/ReportingController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { SecurityMiddleware } from '../middleware/SecurityMiddleware';

/**
 * Routes for Reporting operations - System Usage Reports
 */
export class ReportingRoutes {
  private router: Router;
  private reportingController: ReportingController;
  private authMiddleware: AuthMiddleware;

  constructor(
    reportingController: ReportingController,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.reportingController = reportingController;
    this.authMiddleware = authMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Apply rate limiting to all reporting routes (more restrictive for reports)
    this.router.use(SecurityMiddleware.createRateLimiter());

    // Apply authentication to all reporting routes
    this.router.use(this.authMiddleware.authenticate);

    // Reporting Routes

    // GET /api/v1/reports/filters - Get available report filters
    this.router.get('/filters', this.reportingController.getReportFilters);

    // GET /api/v1/reports/status/:reportId - Get report generation status
    this.router.get('/status/:reportId', this.reportingController.getReportStatus);

    // GET /api/v1/reports/system-usage - Generate system usage report
    // Query parameters:
    // - startDate: ISO date string (optional)
    // - endDate: ISO date string (optional)
    // - status: loan application status filter (optional)
    // - userId: specific user filter (optional)
    // - riskLevel: risk level filter (optional)
    // - format: 'pdf' (default)
    // - language: 'es' | 'en' (default: 'es')
    // - includeCharts: boolean (default: true)
    // - includeTables: boolean (default: true)
    this.router.get('/system-usage', this.reportingController.generateSystemUsageReport);
  }

  getRouter(): Router {
    return this.router;
  }
}