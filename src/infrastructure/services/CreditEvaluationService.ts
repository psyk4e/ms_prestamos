import { ExcelAnalyzerService, LoanProfile, EvaluationResult, CreditEvaluationCriteria } from './ExcelAnalyzerService';
import { logger } from './CustomLogger';

/**
 * Interface for credit evaluation request
 */
export interface CreditEvaluationRequest {
  profile: LoanProfile;
  customCriteria?: Partial<CreditEvaluationCriteria>;
  includeDetailedAnalysis?: boolean;
}

/**
 * Interface for detailed evaluation analysis
 */
export interface DetailedEvaluationAnalysis {
  financialRatios: {
    debtToIncomeRatio: number;
    loanToIncomeRatio: number;
    disposableIncome: number;
    monthlyPaymentEstimate: number;
    paymentToIncomeRatio: number;
  };
  riskFactors: {
    ageRisk: string;
    employmentRisk: string;
    debtRisk: string;
    loanSizeRisk: string;
    documentRisk: string;
  };
  strengths: string[];
  weaknesses: string[];
  mitigationStrategies: string[];
}

/**
 * Interface for comprehensive evaluation result
 */
export interface ComprehensiveEvaluationResult extends EvaluationResult {
  detailedAnalysis?: DetailedEvaluationAnalysis;
  alternativeOptions?: {
    suggestedLoanAmount?: number;
    suggestedTerm?: number;
    requiredDownPayment?: number;
    coSignerRecommended?: boolean;
  };
}

/**
 * Service for comprehensive credit evaluation and loan assessment
 */
export class CreditEvaluationService {
  private excelAnalyzer: ExcelAnalyzerService;

  constructor() {
    this.excelAnalyzer = new ExcelAnalyzerService();
  }

  /**
   * Performs comprehensive credit evaluation
   */
  async evaluateCredit(request: CreditEvaluationRequest): Promise<ComprehensiveEvaluationResult> {
    try {
      logger.info('Starting comprehensive credit evaluation', {
        applicantName: request.profile.nombre,
        loanAmount: request.profile.monto_solicitado
      });

      // Update criteria if custom criteria provided
      if (request.customCriteria) {
        this.excelAnalyzer.updateCriteria(request.customCriteria);
      }

      // Perform basic evaluation
      const basicResult = this.excelAnalyzer.evaluateProfile(request.profile);

      // Create comprehensive result
      const comprehensiveResult: ComprehensiveEvaluationResult = {
        ...basicResult
      };

      // Add detailed analysis if requested
      if (request.includeDetailedAnalysis) {
        comprehensiveResult.detailedAnalysis = this.generateDetailedAnalysis(request.profile, basicResult);
        comprehensiveResult.alternativeOptions = this.generateAlternativeOptions(request.profile, basicResult);
      }

      logger.info('Credit evaluation completed', {
        applicantName: request.profile.nombre,
        score: comprehensiveResult.score,
        approved: comprehensiveResult.approved,
        riskLevel: comprehensiveResult.risk_level
      });

      return comprehensiveResult;

    } catch (error) {
      logger.error('Error in credit evaluation', error instanceof Error ? error : new Error('Unknown error'), {
        applicantName: request.profile.nombre
      });
      throw error;
    }
  }

  /**
   * Evaluates multiple profiles for batch processing
   */
  async evaluateMultipleProfiles(profiles: LoanProfile[]): Promise<ComprehensiveEvaluationResult[]> {
    try {
      logger.info('Starting batch credit evaluation', { profileCount: profiles.length });

      const results: ComprehensiveEvaluationResult[] = [];

      for (const profile of profiles) {
        try {
          const result = await this.evaluateCredit({
            profile,
            includeDetailedAnalysis: false
          });
          results.push(result);
        } catch (error) {
          logger.error('Error evaluating individual profile in batch', error instanceof Error ? error : new Error('Unknown error'), {
            applicantName: profile.nombre
          });

          // Add failed result to maintain array consistency
          results.push({
            score: 0,
            risk_level: 'VERY_HIGH',
            approved: false,
            factors: {
              income_debt_ratio: 0,
              employment_stability: 0,
              loan_income_ratio: 0,
              age_factor: 0,
              document_type_factor: 0
            },
            recommendations: ['Evaluation failed - please review application manually']
          });
        }
      }

      logger.info('Batch credit evaluation completed', {
        totalProfiles: profiles.length,
        successfulEvaluations: results.filter(r => r.score > 0).length
      });

      return results;

    } catch (error) {
      logger.error('Error in batch credit evaluation', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  /**
   * Generates detailed financial analysis
   */
  private generateDetailedAnalysis(profile: LoanProfile, basicResult: EvaluationResult): DetailedEvaluationAnalysis {
    // Calculate financial ratios
    const debtToIncomeRatio = profile.gastos_mensuales / profile.salario_mensual;
    const annualIncome = profile.salario_mensual * 12;
    const loanToIncomeRatio = profile.monto_solicitado / annualIncome;
    const disposableIncome = profile.salario_mensual - profile.gastos_mensuales;

    // Estimate monthly payment (simple calculation)
    const monthlyInterestRate = 0.12 / 12; // Assuming 12% annual rate
    const monthlyPaymentEstimate = (profile.monto_solicitado * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, profile.plazo_meses)) /
      (Math.pow(1 + monthlyInterestRate, profile.plazo_meses) - 1);
    const paymentToIncomeRatio = monthlyPaymentEstimate / profile.salario_mensual;

    // Calculate age
    const birthDate = new Date(profile.fecha_nacimiento);
    const age = new Date().getFullYear() - birthDate.getFullYear();

    // Determine risk factors
    const riskFactors = {
      ageRisk: this.assessAgeRisk(age),
      employmentRisk: this.assessEmploymentRisk(profile.tiempo_laborando),
      debtRisk: this.assessDebtRisk(debtToIncomeRatio),
      loanSizeRisk: this.assessLoanSizeRisk(loanToIncomeRatio),
      documentRisk: this.assessDocumentRisk(profile.tipo_documento)
    };

    // Generate strengths and weaknesses
    const strengths = this.identifyStrengths(profile, basicResult);
    const weaknesses = this.identifyWeaknesses(profile, basicResult);
    const mitigationStrategies = this.generateMitigationStrategies(weaknesses, profile);

    return {
      financialRatios: {
        debtToIncomeRatio,
        loanToIncomeRatio,
        disposableIncome,
        monthlyPaymentEstimate,
        paymentToIncomeRatio
      },
      riskFactors,
      strengths,
      weaknesses,
      mitigationStrategies
    };
  }

  /**
   * Generates alternative loan options
   */
  private generateAlternativeOptions(profile: LoanProfile, basicResult: EvaluationResult): any {
    const alternatives: any = {};

    // If not approved, suggest alternatives
    if (!basicResult.approved) {
      // Suggest lower loan amount
      const maxRecommendedLoan = profile.salario_mensual * 12 * 3; // 3x annual income
      if (profile.monto_solicitado > maxRecommendedLoan) {
        alternatives.suggestedLoanAmount = Math.floor(maxRecommendedLoan);
      }

      // Suggest longer term to reduce monthly payment
      if (profile.plazo_meses < 72) {
        alternatives.suggestedTerm = Math.min(72, profile.plazo_meses + 12);
      }

      // Suggest down payment
      const suggestedDownPayment = profile.monto_solicitado * 0.2; // 20% down payment
      alternatives.requiredDownPayment = suggestedDownPayment;

      // Recommend co-signer for high-risk cases
      if (basicResult.risk_level === 'HIGH' || basicResult.risk_level === 'VERY_HIGH') {
        alternatives.coSignerRecommended = true;
      }
    }

    return alternatives;
  }

  /**
   * Assess age-related risk
   */
  private assessAgeRisk(age: number): string {
    if (age < 25) return 'Young applicant - limited credit history expected';
    if (age > 60) return 'Approaching retirement - income stability concern';
    if (age >= 25 && age <= 45) return 'Prime age group - low risk';
    return 'Mature applicant - stable income expected';
  }

  /**
   * Assess employment stability risk
   */
  private assessEmploymentRisk(months: number): string {
    if (months < 6) return 'Very new employment - high risk';
    if (months < 12) return 'Recent employment - moderate risk';
    if (months < 24) return 'Established employment - low risk';
    return 'Long-term employment - very low risk';
  }

  /**
   * Assess debt-to-income risk
   */
  private assessDebtRisk(ratio: number): string {
    if (ratio > 0.6) return 'Very high debt burden - high risk';
    if (ratio > 0.5) return 'High debt burden - moderate risk';
    if (ratio > 0.3) return 'Moderate debt burden - low risk';
    return 'Low debt burden - very low risk';
  }

  /**
   * Assess loan size risk
   */
  private assessLoanSizeRisk(ratio: number): string {
    if (ratio > 6) return 'Loan amount too high relative to income';
    if (ratio > 4) return 'Large loan relative to income - monitor closely';
    if (ratio > 3) return 'Moderate loan size - acceptable';
    return 'Conservative loan size - low risk';
  }

  /**
   * Assess document type risk
   */
  private assessDocumentRisk(documentType: string): string {
    const riskLevels: { [key: string]: string } = {
      'cedula': 'National ID - lowest risk',
      'pasaporte': 'Passport - low risk, verify residency',
      'licencia': 'License - moderate risk, additional verification needed',
      'otro': 'Other document - high risk, thorough verification required'
    };

    return riskLevels[documentType.toLowerCase()] || 'Unknown document type - high risk';
  }

  /**
   * Identify applicant strengths
   */
  private identifyStrengths(profile: LoanProfile, result: EvaluationResult): string[] {
    const strengths: string[] = [];

    if (result.factors.employment_stability >= 80) {
      strengths.push(`Excellent employment stability (${profile.tiempo_laborando} months)`);
    }

    if (result.factors.loan_income_ratio >= 80) {
      strengths.push('Conservative loan amount relative to income');
    }

    if (result.factors.age_factor >= 90) {
      strengths.push('Optimal age group for lending');
    }

    if (profile.salario_mensual >= 100000) {
      strengths.push('High monthly income provides good repayment capacity');
    }

    const disposableIncome = profile.salario_mensual - profile.gastos_mensuales;
    if (disposableIncome >= 50000) {
      strengths.push('Substantial disposable income available');
    }

    if (profile.tipo_documento === 'cedula') {
      strengths.push('National identification document provides verification ease');
    }

    return strengths;
  }

  /**
   * Identify applicant weaknesses
   */
  private identifyWeaknesses(profile: LoanProfile, result: EvaluationResult): string[] {
    const weaknesses: string[] = [];

    if (result.factors.income_debt_ratio < 60) {
      weaknesses.push('High debt-to-income ratio may strain repayment capacity');
    }

    if (result.factors.employment_stability < 60) {
      weaknesses.push('Limited employment history increases risk');
    }

    if (result.factors.loan_income_ratio < 60) {
      weaknesses.push('Loan amount is high relative to income');
    }

    if (profile.plazo_meses > 60) {
      weaknesses.push('Long loan term increases total interest cost');
    }

    const disposableIncome = profile.salario_mensual - profile.gastos_mensuales;
    if (disposableIncome < 30000) {
      weaknesses.push('Limited disposable income for loan payments');
    }

    // Calculate age
    const birthDate = new Date(profile.fecha_nacimiento);
    const age = new Date().getFullYear() - birthDate.getFullYear();

    if (age < 25) {
      weaknesses.push('Young age may indicate limited credit experience');
    }

    if (age > 55) {
      weaknesses.push('Age approaching retirement may affect long-term repayment');
    }

    return weaknesses;
  }

  /**
   * Generate mitigation strategies
   */
  private generateMitigationStrategies(weaknesses: string[], profile: LoanProfile): string[] {
    const strategies: string[] = [];

    if (weaknesses.some(w => w.includes('debt-to-income'))) {
      strategies.push('Consider debt consolidation or reduction before loan approval');
      strategies.push('Require proof of debt reduction plan');
    }

    if (weaknesses.some(w => w.includes('employment history'))) {
      strategies.push('Request employment verification and contract details');
      strategies.push('Consider requiring a co-signer or guarantor');
    }

    if (weaknesses.some(w => w.includes('loan amount'))) {
      strategies.push('Reduce loan amount or increase down payment');
      strategies.push('Consider shorter loan term to reduce risk');
    }

    if (weaknesses.some(w => w.includes('disposable income'))) {
      strategies.push('Require detailed budget analysis');
      strategies.push('Consider income verification from multiple sources');
    }

    if (weaknesses.some(w => w.includes('age'))) {
      strategies.push('Adjust loan terms based on age-related factors');
      strategies.push('Consider life insurance requirement');
    }

    return strategies;
  }

  /**
   * Get current evaluation criteria
   */
  getCriteria(): CreditEvaluationCriteria {
    return this.excelAnalyzer.getCriteria();
  }

  /**
   * Update evaluation criteria
   */
  updateCriteria(newCriteria: Partial<CreditEvaluationCriteria>): void {
    this.excelAnalyzer.updateCriteria(newCriteria);
    logger.info('Credit evaluation criteria updated', { newCriteria });
  }

  /**
   * Generate evaluation report in text format
   */
  generateTextReport(result: ComprehensiveEvaluationResult, profile: LoanProfile): string {
    let report = '=== CREDIT EVALUATION REPORT ===\n\n';

    // Applicant Information
    report += 'APPLICANT INFORMATION:\n';
    report += `Name: ${profile.nombre}\n`;
    report += `Document: ${profile.tipo_documento} - ${profile.numero_documento}\n`;
    report += `Birth Date: ${profile.fecha_nacimiento}\n`;
    report += `Employment Time: ${profile.tiempo_laborando} months\n\n`;

    // Loan Request
    report += 'LOAN REQUEST:\n';
    report += `Type: ${profile.tipo_prestamo}\n`;
    report += `Amount: $${profile.monto_solicitado.toLocaleString()}\n`;
    report += `Term: ${profile.plazo_meses} months\n`;
    report += `Payment Frequency: ${profile.periodo_pago}\n\n`;

    // Financial Information
    report += 'FINANCIAL INFORMATION:\n';
    report += `Monthly Income: $${profile.salario_mensual.toLocaleString()}\n`;
    report += `Monthly Expenses: $${profile.gastos_mensuales.toLocaleString()}\n`;
    report += `Disposable Income: $${(profile.salario_mensual - profile.gastos_mensuales).toLocaleString()}\n\n`;

    // Evaluation Results
    report += 'EVALUATION RESULTS:\n';
    report += `Overall Score: ${result.score}/100\n`;
    report += `Risk Level: ${result.risk_level}\n`;
    report += `Decision: ${result.approved ? 'APPROVED' : 'DECLINED'}\n\n`;

    // Factor Scores
    report += 'FACTOR SCORES:\n';
    report += `Income/Debt Ratio: ${result.factors.income_debt_ratio}/100\n`;
    report += `Employment Stability: ${result.factors.employment_stability}/100\n`;
    report += `Loan/Income Ratio: ${result.factors.loan_income_ratio}/100\n`;
    report += `Age Factor: ${result.factors.age_factor}/100\n`;
    report += `Document Type: ${result.factors.document_type_factor}/100\n\n`;

    // Recommendations
    report += 'RECOMMENDATIONS:\n';
    result.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });

    // Detailed Analysis (if available)
    if (result.detailedAnalysis) {
      report += '\nDETAILED ANALYSIS:\n';

      report += '\nStrengths:\n';
      result.detailedAnalysis.strengths.forEach((strength, index) => {
        report += `• ${strength}\n`;
      });

      report += '\nWeaknesses:\n';
      result.detailedAnalysis.weaknesses.forEach((weakness, index) => {
        report += `• ${weakness}\n`;
      });

      report += '\nMitigation Strategies:\n';
      result.detailedAnalysis.mitigationStrategies.forEach((strategy, index) => {
        report += `• ${strategy}\n`;
      });
    }

    // Alternative Options (if available)
    if (result.alternativeOptions) {
      report += '\nALTERNATIVE OPTIONS:\n';

      if (result.alternativeOptions.suggestedLoanAmount) {
        report += `Suggested Loan Amount: $${result.alternativeOptions.suggestedLoanAmount.toLocaleString()}\n`;
      }

      if (result.alternativeOptions.suggestedTerm) {
        report += `Suggested Term: ${result.alternativeOptions.suggestedTerm} months\n`;
      }

      if (result.alternativeOptions.requiredDownPayment) {
        report += `Required Down Payment: $${result.alternativeOptions.requiredDownPayment.toLocaleString()}\n`;
      }

      if (result.alternativeOptions.coSignerRecommended) {
        report += `Co-signer Recommended: Yes\n`;
      }
    }

    report += '\n=== END OF REPORT ===';

    return report;
  }
}