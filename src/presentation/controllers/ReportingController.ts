import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { ReportingUseCase } from '../../application/use-cases/ReportingUseCase';
import { CustomLogger } from '../../infrastructure/services/CustomLogger';

/**
 * Controller for Reporting operations - System Usage Reports
 */
export class ReportingController {
  constructor(
    private readonly reportingUseCase: ReportingUseCase,
    private readonly logger: CustomLogger
  ) { }

  /**
   * Generate system usage report in PDF format
   */
  generateSystemUsageReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      this.logger.info('Generating system usage report', {
        authenticated: req.isAuthenticated,
        query: req.query
      });

      // Extract filters from query parameters
      const filters = {
        startDate: req.query.startDate ? (req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? (req.query.endDate as string) : undefined,
        status: req.query.status as string,
        userId: req.query.userId as string
      };

      // Extract options from query parameters
      const options = {
        format: (req.query.format as 'pdf' | 'excel') || 'pdf',
        language: (req.query.language as 'es' | 'en') || 'es',
        includeCharts: req.query.includeCharts !== 'false',
        includeTables: req.query.includeTables !== 'false'
      };

      // Generate the report
      const reportData = await this.reportingUseCase.generateSystemUsageReport(filters);

      // Check format and respond accordingly
      if (options.format === 'pdf') {
        // Generate PDF using ReportingService
        const pdfBuffer = await this.reportingUseCase.generatePdfReport(reportData);

        // Set appropriate headers for PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="system-usage-report.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF buffer as binary data
        res.end(pdfBuffer, 'binary');
        return;
      } else {
        // Return JSON data
        res.json({
          success: true,
          data: reportData,
          timestamp: new Date().toISOString()
        });
      }

      this.logger.info('System usage report generated successfully', {
        authenticated: req.isAuthenticated,
        totalApplications: reportData.totalApplications
      });

    } catch (error: any) {
      this.logger.error('Error generating system usage report');

      await this.sendError(req, res, 500, 'REPORT_GENERATION_ERROR',
        'Error al generar el reporte del sistema');
    }
  };

  /**
   * Get available report filters
   */
  getReportFilters = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      this.logger.info('Getting available report filters', {
        authenticated: req.isAuthenticated
      });

      // For now, return static filters - could be enhanced to be dynamic
      const filters = {
        statuses: ['PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW'],
        riskLevels: ['LOW', 'MEDIUM', 'HIGH'],
        dateRange: {
          earliest: new Date(2023, 0, 1), // January 1, 2023
          latest: new Date()
        },
        formats: ['pdf'],
        languages: ['es', 'en']
      };

      await this.sendSuccess(req, res, 200, filters);

    } catch (error: any) {
      this.logger.error('Error getting report filters');

      await this.sendError(req, res, 500, 'FILTERS_ERROR',
        'Error al obtener los filtros disponibles');
    }
  };

  /**
   * Get report generation status (for future async implementation)
   */
  getReportStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;

      this.logger.info('Getting report status', {
        authenticated: req.isAuthenticated,
        reportId
      });

      // For now, return a simple status - could be enhanced for async processing
      const status = {
        reportId,
        status: 'completed',
        progress: 100,
        createdAt: new Date(),
        completedAt: new Date()
      };

      await this.sendSuccess(req, res, 200, status);

    } catch (error: any) {
      this.logger.error('Error getting report status');

      await this.sendError(req, res, 500, 'STATUS_ERROR',
        'Error al obtener el estado del reporte');
    }
  };

  /**
   * Send success response
   */
  private async sendSuccess(req: AuthenticatedRequest, res: Response, statusCode: number, data: any): Promise<void> {
    const clientName = this.getClientName(req);

    const response = {
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      client: clientName
    };

    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  private async sendError(req: AuthenticatedRequest, res: Response, statusCode: number, error: string, message: string): Promise<void> {
    const clientName = this.getClientName(req);

    const response = {
      success: false,
      error: {
        code: error,
        message: message,
        timestamp: new Date().toISOString()
      },
      client: clientName
    };

    res.status(statusCode).json(response);
  }

  /**
   * Get client name from request headers
   */
  private getClientName(req: AuthenticatedRequest): string | undefined {
    return req.headers['x-client-name'] as string || 'unknown';
  }
}