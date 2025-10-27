import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { ChartService } from './ChartService';
import * as fs from 'fs';
import * as path from 'path';

// Configure pdfMake fonts - fix the vfs initialization
try {
  (pdfMake as any).vfs = (pdfFonts as any).vfs || {};
} catch (error) {
  console.warn('Could not initialize pdfMake fonts:', error);
  (pdfMake as any).vfs = {};
}

export interface ReportData {
  // Loan Applications Summary
  totalApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  pendingApplications: number;

  // Financial Metrics
  totalAmountRequested: number;
  totalAmountApproved: number;
  averageRequestedAmount: number;
  averageApprovedAmount: number;

  // Time-based Analytics
  applicationsThisMonth: number;
  applicationsLastMonth: number;
  growthRate: number;

  // Status Distribution
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;

  // Monthly Trends
  monthlyTrends: Array<{
    month: string;
    applications: number;
    approvals: number;
    totalAmount: number;
  }>;

  // Risk Distribution
  riskDistribution: Array<{
    riskLevel: string;
    count: number;
    percentage: number;
  }>;

  // Document Statistics
  documentStats: Array<{
    documentType: string;
    totalUploaded: number;
    validated: number;
    pending: number;
  }>;

  // Demographics
  demographics: {
    byGender: Array<{ gender: string; count: number }>;
    byAge: Array<{ ageRange: string; count: number }>;
    byProvince: Array<{ province: string; count: number }>;
  };

  // Performance Metrics
  averageProcessingTime: number;
  completionRate: number;

  // Additional Analysis
  loanTypeDistribution?: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  termDistribution?: Array<{
    termRange: string;
    count: number;
    averageAmount: number;
  }>;

  // Report Metadata
  generatedAt: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
}

export class ReportingService {
  private chartService: ChartService;

  constructor() {
    this.chartService = new ChartService();
  }

  // Minimalist table layout: outer border only, subtle color, compact padding
  private readonly minimalistTableLayout = {
    hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0.75 : 0),
    vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 0.75 : 0),
    hLineColor: (_i: number, _node: any) => '#DCEFE2',
    vLineColor: (_i: number, _node: any) => '#DCEFE2',
    paddingLeft: (_i: number, _node: any) => 6,
    paddingRight: (_i: number, _node: any) => 6,
    paddingTop: (_i: number, _node: any) => 6,
    paddingBottom: (_i: number, _node: any) => 6
  };

  private getCompanyLogo(): string {
    try {
      const logoPath = path.join(__dirname, '../../../src/assets/logo/logo_asapneg.png');
      const logoBuffer = fs.readFileSync(logoPath);
      return 'data:image/png;base64,' + logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Could not load company logo:', error);
      return '';
    }
  }

  /**
   * Generate chart images for the report
   */
  private async generateChartImages(data: ReportData): Promise<{
    statusChart?: string;
    trendsChart?: string;
    riskChart?: string;
  }> {
    try {
      const chartImages: { statusChart?: string; trendsChart?: string; riskChart?: string } = {};

      // Generate status distribution chart if data exists
      if (data.statusDistribution && data.statusDistribution.length > 0) {
        const statusChartConfig = this.chartService.createStatusPieChart(data.statusDistribution);
        chartImages.statusChart = await this.chartService.generateChartImage(statusChartConfig, {
          width: 600,
          height: 400
        });
      }

      // Generate monthly trends chart if data exists
      if (data.monthlyTrends && data.monthlyTrends.length > 0) {
        const trendsChartConfig = this.chartService.createMonthlyTrendsChart(data.monthlyTrends);
        chartImages.trendsChart = await this.chartService.generateChartImage(trendsChartConfig, {
          width: 700,
          height: 400
        });
      }

      // Generate risk distribution chart if data exists
      if (data.riskDistribution && data.riskDistribution.length > 0) {
        const riskChartConfig = this.chartService.createRiskDistributionChart(data.riskDistribution);
        chartImages.riskChart = await this.chartService.generateChartImage(riskChartConfig, {
          width: 600,
          height: 400
        });
      }

      return chartImages;
    } catch (error) {
      console.error('Error generating chart images:', error);
      return {}; // Return empty object if chart generation fails
    }
  }

  /**
   * Generate comprehensive system usage report
   */
  async generateSystemUsageReport(data: ReportData): Promise<Buffer> {
    // Generate chart images
    const chartImages = await this.generateChartImages(data);
    const companyLogo = this.getCompanyLogo();

    const docDefinition: TDocumentDefinitions = {
      content: [
        // Header with Logo and Company Info
        {
          columns: [
            companyLogo ? {
              image: companyLogo,
              width: 90,
              height: 40
            } : {
              text: '',
              width: 100
            },
            {
              stack: [
                {
                  text: 'ASAPNEG',
                  style: 'companyName',
                  alignment: 'center'
                },
                {
                  text: 'Préstamos ASAPNEG',
                  style: 'companySubtitle',
                  alignment: 'center'
                }
              ],
              width: '*'
            },
            {
              text: `Generado: ${this.formatDate(data.generatedAt)}`,
              style: 'headerDate',
              alignment: 'right',
              width: 120
            }
          ],
          margin: [0, 0, 0, 30] as [number, number, number, number]
        },

        // Main Title
        {
          text: 'Reporte de Uso del Sistema de Préstamos',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 10] as [number, number, number, number]
        },

        // Report Period
        {
          text: `Período: ${this.formatDate(data.reportPeriod.startDate)} - ${this.formatDate(data.reportPeriod.endDate)}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 30]
        },

        // Summary Section
        this.createSummaryTable(data),

        // Applications Overview with Chart
        { text: 'Resumen de Solicitudes', style: 'sectionHeader', pageBreak: 'before' },
        this.createApplicationsOverviewTable(data),

        // Status Distribution Chart
        ...(chartImages.statusChart ? [{
          image: chartImages.statusChart,
          width: 400,
          alignment: 'center' as const,
          margin: [0, 10, 0, 20] as [number, number, number, number]
        }] : []),

        // Financial Analysis
        { text: 'Análisis Financiero', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
        this.createFinancialAnalysisTable(data),

        // Monthly Trends Chart
        ...(chartImages.trendsChart ? [{
          image: chartImages.trendsChart,
          width: 500,
          alignment: 'center' as const,
          margin: [0, 10, 0, 20] as [number, number, number, number]
        }] : []),

        // Risk Analysis
        { text: 'Análisis de Riesgo', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
        this.createRiskAnalysisTable(data),

        // Risk Distribution Chart
        ...(chartImages.riskChart ? [{
          image: chartImages.riskChart,
          width: 400,
          alignment: 'center' as const,
          margin: [0, 10, 0, 20] as [number, number, number, number]
        }] : []),

        // Demographics
        { text: 'Análisis Demográfico', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
        this.createDemographicsTable(data),

        // Document Analysis
        { text: 'Análisis de Documentos', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
        this.createDocumentAnalysisTable(data),

        // Performance Metrics
        { text: 'Métricas de Rendimiento', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
        this.createPerformanceMetricsTable(data),

        // Loan Type Analysis (New Section)
        ...(data.loanTypeDistribution && data.loanTypeDistribution.length > 0 ? [
          { text: 'Análisis por Tipo de Préstamo', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
          this.createLoanTypeTable(data)
        ] : []),

        // Term Analysis (New Section)
        ...(data.termDistribution && data.termDistribution.length > 0 ? [
          { text: 'Análisis por Plazo', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
          this.createTermTable(data)
        ] : []),

        // Recommendations
        { text: 'Recomendaciones', style: 'sectionHeader', margin: [0, 20, 0, 10] as [number, number, number, number] },
        this.generateRecommendations(data)
      ],

      styles: {
        header: {
          fontSize: 22,
          bold: true,
          color: '#297833'
        },
        companyName: {
          fontSize: 18,
          bold: true,
          color: '#297833'
        },
        companySubtitle: {
          fontSize: 12,
          color: '#297833'
        },
        headerDate: {
          fontSize: 10,
          color: '#666666'
        },
        subheader: {
          fontSize: 14,
          italics: true,
          color: '#666666'
        },
        sectionHeader: {
          fontSize: 16,
          bold: true,
          color: '#297833',
          margin: [0, 15, 0, 10] as [number, number, number, number]
        },
        tableHeader: {
          bold: true,
          fontSize: 12,
          color: 'white',
          fillColor: '#297833'
        },
        footer: {
          fontSize: 10,
          italics: true,
          color: '#999999'
        }
      },

      defaultStyle: {
        fontSize: 10,
        lineHeight: 1.3
      }
    };

    return new Promise((resolve, reject) => {
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    });
  }

  private createSummaryTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*'],
        body: [
          [
            { text: 'Métrica', style: 'tableHeader' },
            { text: 'Valor', style: 'tableHeader' },
            { text: 'Métrica', style: 'tableHeader' },
            { text: 'Valor', style: 'tableHeader' }
          ],
          [
            'Total Solicitudes',
            data.totalApplications.toString(),
            'Solicitudes Aprobadas',
            data.approvedApplications.toString()
          ],
          [
            'Solicitudes Rechazadas',
            data.rejectedApplications.toString(),
            'Solicitudes Pendientes',
            data.pendingApplications.toString()
          ],
          [
            'Monto Total Solicitado',
            `$${data.totalAmountRequested.toLocaleString()}`,
            'Monto Total Aprobado',
            `$${data.totalAmountApproved.toLocaleString()}`
          ],
          [
            'Promedio Solicitado',
            `$${data.averageRequestedAmount.toLocaleString()}`,
            'Promedio Aprobado',
            `$${data.averageApprovedAmount.toLocaleString()}`
          ]
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createApplicationsOverviewTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Estado', style: 'tableHeader' },
            { text: 'Cantidad', style: 'tableHeader' },
            { text: 'Porcentaje', style: 'tableHeader' }
          ],
          ...data.statusDistribution.map(item => [
            this.translateStatus(item.status),
            item.count.toString(),
            `${item.percentage.toFixed(1)}%`
          ])
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createFinancialAnalysisTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*'],
        body: [
          [
            { text: 'Métrica Financiera', style: 'tableHeader' },
            { text: 'Valor', style: 'tableHeader' }
          ],
          [
            'Monto Total Solicitado',
            `$${data.totalAmountRequested.toLocaleString()}`
          ],
          [
            'Monto Total Aprobado',
            `$${data.totalAmountApproved.toLocaleString()}`
          ],
          [
            'Promedio por Solicitud',
            `$${data.averageRequestedAmount.toLocaleString()}`
          ],
          [
            'Promedio Aprobado',
            `$${data.averageApprovedAmount.toLocaleString()}`
          ],
          [
            'Tasa de Aprobación',
            `${(((data.approvedApplications ?? 0) / (data.totalApplications || 1)) * 100).toFixed(1)}%`
          ]
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createRiskAnalysisTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Nivel de Riesgo', style: 'tableHeader' },
            { text: 'Cantidad', style: 'tableHeader' },
            { text: 'Porcentaje', style: 'tableHeader' }
          ],
          ...data.riskDistribution.map(item => [
            this.translateRiskLevel(item.riskLevel),
            item.count.toString(),
            `${item.percentage.toFixed(1)}%`
          ])
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createDemographicsTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*'],
        body: [
          [
            { text: 'Género', style: 'tableHeader' },
            { text: 'Cantidad', style: 'tableHeader' },
            { text: 'Rango de Edad', style: 'tableHeader' },
            { text: 'Cantidad', style: 'tableHeader' }
          ],
          ...data.demographics.byGender.map((gender, index) => [
            this.translateGender(gender.gender),
            gender.count.toString(),
            data.demographics.byAge[index]?.ageRange || '',
            data.demographics.byAge[index]?.count?.toString() || ''
          ])
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createDocumentAnalysisTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*'],
        body: [
          [
            { text: 'Tipo de Documento', style: 'tableHeader' },
            { text: 'Total Subidos', style: 'tableHeader' },
            { text: 'Validados', style: 'tableHeader' },
            { text: 'Pendientes', style: 'tableHeader' }
          ],
          ...data.documentStats.map(doc => [
            this.translateDocumentType(doc.documentType),
            doc.totalUploaded.toString(),
            doc.validated.toString(),
            doc.pending.toString()
          ])
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createPerformanceMetricsTable(data: ReportData): Content {
    return {
      table: {
        headerRows: 1,
        widths: ['*', '*'],
        body: [
          [
            { text: 'Métrica de Rendimiento', style: 'tableHeader' },
            { text: 'Valor', style: 'tableHeader' }
          ],
          [
            'Tiempo Promedio de Procesamiento',
            `${data.averageProcessingTime} días`
          ],
          [
            'Tasa de Completitud',
            `${data.completionRate.toFixed(1)}%`
          ],
          [
            'Solicitudes Este Mes',
            data.applicationsThisMonth.toString()
          ],
          [
            'Solicitudes Mes Anterior',
            data.applicationsLastMonth.toString()
          ],
          [
            'Tasa de Crecimiento',
            `${data.growthRate > 0 ? '+' : ''}${data.growthRate.toFixed(1)}%`
          ]
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createLoanTypeTable(data: ReportData): Content {
    if (!data.loanTypeDistribution || data.loanTypeDistribution.length === 0) {
      return {
        text: 'No hay datos de distribución por tipo de préstamo disponibles',
        style: 'defaultStyle',
        margin: [0, 0, 0, 20]
      };
    }

    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Tipo de Préstamo', style: 'tableHeader' },
            { text: 'Cantidad', style: 'tableHeader' },
            { text: 'Porcentaje', style: 'tableHeader' }
          ],
          ...data.loanTypeDistribution.map(item => [
            this.translateLoanType(item.type),
            item.count.toString(),
            `${item.percentage.toFixed(1)}%`
          ])
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private createTermTable(data: ReportData): Content {
    if (!data.termDistribution || data.termDistribution.length === 0) {
      return {
        text: 'No hay datos de distribución por plazo disponibles',
        style: 'defaultStyle',
        margin: [0, 0, 0, 20]
      };
    }

    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Rango de Plazo', style: 'tableHeader' },
            { text: 'Cantidad', style: 'tableHeader' },
            { text: 'Monto Promedio', style: 'tableHeader' }
          ],
          ...data.termDistribution.map(item => [
            item.termRange,
            item.count.toString(),
            `$${item.averageAmount.toLocaleString()}`
          ])
        ]
      },
      layout: this.minimalistTableLayout,
      margin: [0, 0, 0, 20]
    };
  }

  private generateRecommendations(data: ReportData): Content {
    const recommendations = [];

    if (data.growthRate < 0) {
      recommendations.push('• Considerar estrategias de marketing para aumentar las solicitudes');
    }

    if (data.completionRate < 80) {
      recommendations.push('• Mejorar el proceso de seguimiento para aumentar la tasa de completitud');
    }

    if (data.averageProcessingTime > 7) {
      recommendations.push('• Optimizar el proceso de evaluación para reducir tiempos de respuesta');
    }

    const approvalRate = (data.approvedApplications / data.totalApplications) * 100;
    if (approvalRate < 50) {
      recommendations.push('• Revisar criterios de aprobación para mejorar la tasa de aceptación');
    }

    return {
      ul: recommendations.length > 0 ? recommendations : ['• El sistema está funcionando dentro de parámetros normales']
    };
  }

  private translateStatus(status: string): string {
    const translations: { [key: string]: string } = {
      'pending': 'Pendiente',
      'approved': 'Aprobado',
      'rejected': 'Rechazado',
      'in_review': 'En Revisión'
    };
    return translations[status] || status;
  }

  private translateRiskLevel(riskLevel: string): string {
    const translations: { [key: string]: string } = {
      'low': 'Bajo',
      'medium': 'Medio',
      'high': 'Alto'
    };
    return translations[riskLevel] || riskLevel;
  }

  private translateGender(gender: string): string {
    const translations: { [key: string]: string } = {
      'male': 'Masculino',
      'female': 'Femenino',
      'other': 'Otro'
    };
    return translations[gender] || gender;
  }

  private translateDocumentType(docType: string): string {
    const translations: { [key: string]: string } = {
      'identity': 'Identificación',
      'income': 'Comprobante de Ingresos',
      'employment': 'Certificado Laboral',
      'bank_statement': 'Estado de Cuenta'
    };
    return translations[docType] || docType;
  }

  private translateLoanType(loanType: string): string {
    const translations: { [key: string]: string } = {
      'personal': 'Personal',
      'business': 'Empresarial',
      'mortgage': 'Hipotecario',
      'vehicle': 'Vehículo',
      'education': 'Educativo',
      'emergency': 'Emergencia'
    };
    return translations[loanType] || loanType;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}