import * as XLSX from 'xlsx';
import { logger } from './CustomLogger';

/**
 * Interface for loan application profile
 */
export interface LoanProfile {
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_nacimiento: string;
  tipo_prestamo: string;
  monto_solicitado: number;
  plazo_meses: number;
  periodo_pago: string;
  salario_mensual: number;
  gastos_mensuales: number;
  tiempo_laborando: number;
}

/**
 * Interface for credit evaluation criteria
 */
export interface CreditEvaluationCriteria {
  income_to_debt_ratio: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  employment_stability: {
    excellent: number; // months
    good: number;
    fair: number;
    poor: number;
  };
  loan_to_income_ratio: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  age_factors: {
    min_age: number;
    max_age: number;
    optimal_min: number;
    optimal_max: number;
  };
}

/**
 * Interface for evaluation result
 */
export interface EvaluationResult {
  score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  approved: boolean;
  factors: {
    income_debt_ratio: number;
    employment_stability: number;
    loan_income_ratio: number;
    age_factor: number;
    document_type_factor: number;
  };
  recommendations: string[];
}

/**
 * Service for analyzing Excel files and extracting credit evaluation logic
 */
export class ExcelAnalyzerService {
  private criteria: CreditEvaluationCriteria;

  constructor() {
    // Default criteria based on common banking practices
    this.criteria = {
      income_to_debt_ratio: {
        excellent: 0.3, // 30% or less debt to income
        good: 0.4,      // 40% or less
        fair: 0.5,      // 50% or less
        poor: 0.6       // More than 60%
      },
      employment_stability: {
        excellent: 36,  // 3+ years
        good: 24,       // 2+ years
        fair: 12,       // 1+ year
        poor: 6         // Less than 6 months
      },
      loan_to_income_ratio: {
        excellent: 3.0, // 3x annual income or less
        good: 4.0,      // 4x annual income
        fair: 5.0,      // 5x annual income
        poor: 6.0       // More than 6x annual income
      },
      age_factors: {
        min_age: 18,
        max_age: 70,
        optimal_min: 25,
        optimal_max: 55
      }
    };
  }

  /**
   * Reads and analyzes Excel file to extract evaluation criteria
   */
  async analyzeExcelFile(filePath: string): Promise<any> {
    try {
      logger.info('Starting Excel file analysis', { filePath });

      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      logger.info('Excel file loaded successfully', {
        sheetNames,
        totalSheets: sheetNames.length
      });

      const analysisResult: any = {
        sheets: {},
        extractedCriteria: null,
        rawData: {}
      };

      // Process each sheet
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Store raw data
        analysisResult.rawData[sheetName] = jsonData;

        // Analyze sheet structure
        const firstRow = Array.isArray(jsonData[0]) ? jsonData[0] : [];
        analysisResult.sheets[sheetName] = {
          rowCount: jsonData.length,
          columnCount: firstRow.length,
          headers: firstRow,
          sampleData: jsonData.slice(1, 6) // First 5 data rows
        };

        logger.info(`Processed sheet: ${sheetName}`, {
          rows: jsonData.length,
          columns: firstRow.length
        });
      }

      // Try to extract evaluation criteria from the data
      analysisResult.extractedCriteria = this.extractEvaluationCriteria(analysisResult.rawData);

      return analysisResult;

    } catch (error) {
      logger.error('Error analyzing Excel file', error instanceof Error ? error : new Error('Unknown error'), {
        filePath
      });
      throw new Error(`Failed to analyze Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extracts evaluation criteria from raw Excel data
   */
  private extractEvaluationCriteria(rawData: any): CreditEvaluationCriteria | null {
    try {
      // Look for patterns in the data that might indicate evaluation criteria
      for (const sheetName in rawData) {
        const sheetData = rawData[sheetName];

        // Look for keywords that might indicate evaluation criteria
        const criteriaKeywords = [
          'ratio', 'income', 'debt', 'employment', 'stability',
          'score', 'evaluation', 'criteria', 'risk', 'factor'
        ];

        for (let i = 0; i < sheetData.length; i++) {
          const row = sheetData[i];
          if (Array.isArray(row)) {
            const rowText = row.join(' ').toLowerCase();

            // Check if this row contains evaluation criteria
            if (criteriaKeywords.some(keyword => rowText.includes(keyword))) {
              logger.info(`Found potential criteria in sheet ${sheetName}, row ${i}`, { row });
            }
          }
        }
      }

      // For now, return the default criteria
      // In a real implementation, you would parse the Excel data to extract actual criteria
      return this.criteria;

    } catch (error) {
      logger.error('Error extracting evaluation criteria', error instanceof Error ? error : new Error('Unknown error'));
      return null;
    }
  }

  /**
   * Evaluates a loan profile based on extracted criteria
   */
  evaluateProfile(profile: LoanProfile): EvaluationResult {
    try {
      logger.info('Starting profile evaluation', { profile });

      // Calculate age from birth date
      const birthDate = new Date(profile.fecha_nacimiento);
      const age = new Date().getFullYear() - birthDate.getFullYear();

      // Calculate financial ratios
      const monthlyDebtRatio = profile.gastos_mensuales / profile.salario_mensual;
      const annualIncome = profile.salario_mensual * 12;
      const loanToIncomeRatio = profile.monto_solicitado / annualIncome;

      // Calculate individual factor scores (0-100)
      const factors = {
        income_debt_ratio: this.calculateIncomeDebtScore(monthlyDebtRatio),
        employment_stability: this.calculateEmploymentScore(profile.tiempo_laborando),
        loan_income_ratio: this.calculateLoanIncomeScore(loanToIncomeRatio),
        age_factor: this.calculateAgeScore(age),
        document_type_factor: this.calculateDocumentTypeScore(profile.tipo_documento)
      };

      // Calculate weighted total score
      const totalScore = (
        factors.income_debt_ratio * 0.3 +      // 30% weight
        factors.employment_stability * 0.25 +   // 25% weight
        factors.loan_income_ratio * 0.25 +     // 25% weight
        factors.age_factor * 0.15 +            // 15% weight
        factors.document_type_factor * 0.05    // 5% weight
      );

      // Determine risk level and approval
      const { risk_level, approved } = this.determineRiskAndApproval(totalScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(factors, profile);

      const result: EvaluationResult = {
        score: Math.round(totalScore * 100) / 100,
        risk_level,
        approved,
        factors,
        recommendations
      };

      logger.info('Profile evaluation completed', { result });

      return result;

    } catch (error) {
      logger.error('Error evaluating profile', error instanceof Error ? error : new Error('Unknown error'), {
        profileData: profile
      });
      throw new Error(`Failed to evaluate profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate income to debt ratio score
   */
  private calculateIncomeDebtScore(ratio: number): number {
    if (ratio <= this.criteria.income_to_debt_ratio.excellent) return 100;
    if (ratio <= this.criteria.income_to_debt_ratio.good) return 80;
    if (ratio <= this.criteria.income_to_debt_ratio.fair) return 60;
    if (ratio <= this.criteria.income_to_debt_ratio.poor) return 40;
    return 20;
  }

  /**
   * Calculate employment stability score
   */
  private calculateEmploymentScore(months: number): number {
    if (months >= this.criteria.employment_stability.excellent) return 100;
    if (months >= this.criteria.employment_stability.good) return 80;
    if (months >= this.criteria.employment_stability.fair) return 60;
    if (months >= this.criteria.employment_stability.poor) return 40;
    return 20;
  }

  /**
   * Calculate loan to income ratio score
   */
  private calculateLoanIncomeScore(ratio: number): number {
    if (ratio <= this.criteria.loan_to_income_ratio.excellent) return 100;
    if (ratio <= this.criteria.loan_to_income_ratio.good) return 80;
    if (ratio <= this.criteria.loan_to_income_ratio.fair) return 60;
    if (ratio <= this.criteria.loan_to_income_ratio.poor) return 40;
    return 20;
  }

  /**
   * Calculate age factor score
   */
  private calculateAgeScore(age: number): number {
    if (age < this.criteria.age_factors.min_age || age > this.criteria.age_factors.max_age) {
      return 0;
    }

    if (age >= this.criteria.age_factors.optimal_min && age <= this.criteria.age_factors.optimal_max) {
      return 100;
    }

    // Gradual decrease outside optimal range
    if (age < this.criteria.age_factors.optimal_min) {
      const distance = this.criteria.age_factors.optimal_min - age;
      return Math.max(60, 100 - (distance * 5));
    } else {
      const distance = age - this.criteria.age_factors.optimal_max;
      return Math.max(60, 100 - (distance * 3));
    }
  }

  /**
   * Calculate document type score
   */
  private calculateDocumentTypeScore(documentType: string): number {
    const scores: { [key: string]: number } = {
      'cedula': 100,
      'pasaporte': 90,
      'licencia': 80,
      'otro': 60
    };

    return scores[documentType.toLowerCase()] || 60;
  }

  /**
   * Determine risk level and approval based on total score
   */
  private determineRiskAndApproval(score: number): { risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH', approved: boolean } {
    if (score >= 80) {
      return { risk_level: 'LOW', approved: true };
    } else if (score >= 65) {
      return { risk_level: 'MEDIUM', approved: true };
    } else if (score >= 50) {
      return { risk_level: 'HIGH', approved: false };
    } else {
      return { risk_level: 'VERY_HIGH', approved: false };
    }
  }

  /**
   * Generate recommendations based on evaluation factors
   */
  private generateRecommendations(factors: any, profile: LoanProfile): string[] {
    const recommendations: string[] = [];

    if (factors.income_debt_ratio < 60) {
      recommendations.push('Consider reducing monthly expenses or increasing income before applying');
    }

    if (factors.employment_stability < 60) {
      recommendations.push('Employment stability is a concern. Consider waiting until you have more job tenure');
    }

    if (factors.loan_income_ratio < 60) {
      recommendations.push('Requested loan amount is high relative to income. Consider a smaller loan amount');
    }

    if (factors.age_factor < 80) {
      recommendations.push('Age factor may affect loan terms. Consider shorter loan periods');
    }

    if (profile.plazo_meses > 60) {
      recommendations.push('Consider a shorter loan term to reduce total interest paid');
    }

    if (recommendations.length === 0) {
      recommendations.push('Profile meets all criteria for loan approval');
    }

    return recommendations;
  }

  /**
   * Get current evaluation criteria
   */
  getCriteria(): CreditEvaluationCriteria {
    return this.criteria;
  }

  /**
   * Update evaluation criteria
   */
  updateCriteria(newCriteria: Partial<CreditEvaluationCriteria>): void {
    this.criteria = { ...this.criteria, ...newCriteria };
    logger.info('Evaluation criteria updated', { newCriteria });
  }
}