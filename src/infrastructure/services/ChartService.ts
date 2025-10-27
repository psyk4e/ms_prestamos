import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';

export interface ChartImageOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  // Optional plugin loading per documentation
  plugins?: {
    modern?: any[]; // e.g., ['chartjs-plugin-annotation'] or [require('chartjs-plugin-annotation')]
  };
}

export class ChartService {
  private readonly defaultWidth = 800;
  private readonly defaultHeight = 400;
  private readonly defaultBackgroundColor = '#ffffff';

  // Reuse canvases by dimensions/background per docs (memory management)
  private canvasCache = new Map<string, ChartJSNodeCanvas>();

  // Fonts to register on each created canvas instance
  private fontsToRegister: Array<{ path: string; options: { family: string; weight?: string; style?: string } }> = [];

  // Helper: check if all values are zero
  private allZero(values: number[]): boolean {
    return values.length === 0 || values.every(v => v === 0);
  }

  /**
   * Register a font to be used by Chart.js (registered on all existing and future canvases)
   */
  public registerFont(path: string, options: { family: string; weight?: string; style?: string }): void {
    this.fontsToRegister.push({ path, options });
    // Apply to existing instances
    for (const canvas of this.canvasCache.values()) {
      try {
        canvas.registerFont(path, options);
      } catch (err) {
        // Prevent crash if OS/font not available; best-effort as per docs
        console.warn('Font registration warning:', err);
      }
    }
  }

  /**
   * Get or create a reusable ChartJSNodeCanvas instance
   */
  private getCanvas(options: ChartImageOptions = {}): ChartJSNodeCanvas {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    const backgroundColour = options.backgroundColor || this.defaultBackgroundColor;
    const key = `${width}x${height}:${backgroundColour}`;

    const existing = this.canvasCache.get(key);
    if (existing) return existing;

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour,
      plugins: options.plugins,
      chartCallback: (ChartJS) => {
        // Global config examples per docs
        ChartJS.defaults.responsive = false;
        ChartJS.defaults.maintainAspectRatio = false;
        ChartJS.defaults.elements.line.borderWidth = 2;
        ChartJS.defaults.font.size = 12;
        ChartJS.defaults.font.family = 'Arial, sans-serif';
      }
    });

    // Register queued fonts
    for (const f of this.fontsToRegister) {
      try {
        chartJSNodeCanvas.registerFont(f.path, f.options);
      } catch (err) {
        console.warn('Font registration warning:', err);
      }
    }

    this.canvasCache.set(key, chartJSNodeCanvas);
    return chartJSNodeCanvas;
  }

  /**
   * Convenience: render chart to Buffer
   */
  public async renderToBuffer(configuration: ChartConfiguration, options: ChartImageOptions = {}): Promise<Buffer> {
    const canvas = this.getCanvas(options);
    return canvas.renderToBuffer(configuration);
  }

  /**
   * Convenience: render chart to DataURL (PNG by default)
   */
  public async renderToDataURL(configuration: ChartConfiguration, options: ChartImageOptions = {}): Promise<string> {
    const canvas = this.getCanvas(options);
    return canvas.renderToDataURL(configuration);
  }

  /**
   * Convenience: render chart to Stream
   */
  public renderToStream(configuration: ChartConfiguration, options: ChartImageOptions = {}): NodeJS.ReadableStream {
    const canvas = this.getCanvas(options);
    return canvas.renderToStream(configuration);
  }

  /**
   * Generate a chart image as base64 Data URL string
   */
  async generateChartImage(
    chartConfig: ChartConfiguration,
    options: ChartImageOptions = {}
  ): Promise<string> {
    try {
      const buffer = await this.renderToBuffer(chartConfig, options);
      const base64Image = buffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    } catch (error) {
      console.error('Error generating chart image:', error);
      throw new Error(`Failed to generate chart image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple chart images
   */
  async generateMultipleChartImages(
    charts: Array<{ config: ChartConfiguration; options?: ChartImageOptions }>,
  ): Promise<string[]> {
    const promises = charts.map(({ config, options }) =>
      this.generateChartImage(config, options)
    );

    return Promise.all(promises);
  }

  /**
   * Create a pie chart configuration for status distribution
   */
  createStatusPieChart(data: Array<{ status: string; count: number; percentage: number }>): ChartConfiguration {
    const baseColors = ['#4CAF50', '#F44336', '#FF9800', '#2196F3', '#9C27B0'];
    const counts = data.map(item => item.count);

    // If no data at all, render a neutral placeholder chart
    if (this.allZero(counts)) {
      return {
        type: 'pie',
        data: {
          labels: ['Sin datos'],
          datasets: [{
            data: [1],
            backgroundColor: ['#BDBDBD'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'Distribución por Estado (sin datos)',
              font: { size: 16, weight: 'bold' },
              padding: 20
            }
          }
        }
      };
    }

    // Filter out zero categories to avoid cluttered legends
    const nonZero = data.filter(item => item.count > 0);
    const labels = nonZero.map(item => this.translateStatus(item.status));
    const values = nonZero.map(item => item.count);
    const colors = baseColors.slice(0, nonZero.length);

    return {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 20, usePointStyle: true }
          },
          title: {
            display: true,
            text: 'Distribución por Estado',
            font: { size: 16, weight: 'bold' },
            padding: 20
          }
        }
      }
    };
  }

  /**
   * Create a line chart configuration for monthly trends
   */
  createMonthlyTrendsChart(data: Array<{ month: string; applications: number; approvals: number }>): ChartConfiguration {
    return {
      type: 'line',
      data: {
        labels: data.map(item => item.month),
        datasets: [
          {
            label: 'Solicitudes',
            data: data.map(item => item.applications),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Aprobaciones',
            data: data.map(item => item.approvals),
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          title: {
            display: true,
            text: 'Tendencias Mensuales',
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: 20
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        }
      }
    };
  }

  /**
   * Create a bar chart configuration for risk distribution
   */
  createRiskDistributionChart(data: Array<{ riskLevel: string; count: number; percentage: number }>): ChartConfiguration {
    const colors = ['#4CAF50', '#FF9800', '#F44336'];

    return {
      type: 'bar',
      data: {
        labels: data.map(item => this.translateRiskLevel(item.riskLevel)),
        datasets: [{
          label: 'Cantidad',
          data: data.map(item => item.count),
          backgroundColor: colors.slice(0, data.length),
          borderColor: colors.slice(0, data.length),
          borderWidth: 2
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Distribución de Riesgo',
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: 20
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    };
  }

  /**
   * Translate status to Spanish
   */
  private translateStatus(status: string): string {
    const translations: { [key: string]: string } = {
      'APPROVED': 'Aprobado',
      'REJECTED': 'Rechazado',
      'PENDING': 'Pendiente',
      'UNDER_REVIEW': 'En Revisión'
    };
    return translations[status] || status;
  }

  /**
   * Translate risk level to Spanish
   */
  private translateRiskLevel(riskLevel: string): string {
    const translations: { [key: string]: string } = {
      'LOW': 'Bajo Riesgo',
      'MEDIUM': 'Riesgo Medio',
      'HIGH': 'Alto Riesgo',
      'Low Risk': 'Bajo Riesgo',
      'Medium Risk': 'Riesgo Medio',
      'High Risk': 'Alto Riesgo'
    };
    return translations[riskLevel] || riskLevel;
  }
}