import {
  CreditEvaluationProfile,
  CreditEvaluationResponse,
  FactorScores,
  LoanDetails
} from '../../domain/entities/CreditEvaluation';
import { logger } from '../../infrastructure/services/CustomLogger';

export class CreditEvaluationUseCase {
  /**
   * Evalúa un perfil crediticio y calcula los detalles del préstamo
   */
  async evaluateCreditProfile(profile: CreditEvaluationProfile): Promise<CreditEvaluationResponse> {
    try {
      // Validar campos requeridos
      this.validateProfile(profile);

      // Calcular edad
      const age = this.calculateAge(profile.fechaNacimiento);
      if (age < 18 || age > 70) {
        return {
          success: false,
          error: `Edad fuera del rango permitido (18-70 años). Edad calculada: ${age}`
        };
      }

      // Criterios de evaluación
      const evalCriteria = {
        incomeDebtRatio: {
          excellent: 25,
          good: 35,
          fair: 45,
          poor: 55
        },
        employmentStability: {
          excellent: 48,
          good: 36,
          fair: 24,
          poor: 12
        },
        loanIncomeRatio: {
          excellent: 3,
          good: 4,
          fair: 5,
          poor: 6
        },
        ageRange: {
          min: 18,
          max: 70,
          optimalMin: 25,
          optimalMax: 55
        },
        documentScores: {
          'cedula': 100,
          'pasaporte': 90
        }
      };

      // Calcular puntuaciones individuales
      const scores = this.calculateFactorScores(profile, age, evalCriteria);

      // Calcular puntuación general
      const overallScore = this.calculateOverallScore(scores);

      // Determinar nivel de riesgo y aprobación
      const riskLevel = this.determineRiskLevel(overallScore);
      const approved = overallScore >= 70;

      // Calcular detalles del préstamo
      const loanDetails = this.calculateLoanDetails(
        overallScore,
        profile.montoSolicitado,
        profile.periodoPago,
        riskLevel
      );

      return {
        success: true,
        data: {
          solicitante: {
            nombre: profile.nombre,
            edad: age,
            tipoDocumento: profile.tipoDocumento
          },
          evaluacion: {
            puntuacion: Math.round(overallScore * 10) / 10,
            nivelRiesgo: riskLevel,
            decision: approved ? 'APROBADO' : 'RECHAZADO'
          },
          prestamo: {
            tipoSolicitud: profile.tipoPrestamo,
            montoSolicitado: profile.montoSolicitado,
            montoAprobado: loanDetails.montoAprobado,
            porcentajeAprobacion: Math.round((loanDetails.montoAprobado / profile.montoSolicitado) * 100)
          },
          pago: {
            periodo: profile.periodoPago,
            numeroPagos: loanDetails.periodicidad,
            montoPorPago: loanDetails.montoPorPeriodo,
            plazoMeses: profile.plazoMeses,
            tasaInteresAnual: loanDetails.tasaInteresAnual
          },
          factoresClave: {
            relacionIngresoGasto: Math.round((profile.gastosMensuales / profile.ingresosMensuales) * 100),
            estabilidadLaboral: profile.tiempoLaborando,
            capacidadPago: Math.round(
              ((profile.ingresosMensuales - profile.gastosMensuales) /
                (loanDetails.montoPorPeriodo *
                  (profile.periodoPago === 'mensual' ? 1 : profile.periodoPago === 'quincenal' ? 2 : 4))) *
              100
            )
          }
        }
      };
    } catch (error) {
      logger.error('Error en evaluación crediticia:', error as Error);
      return {
        success: false,
        error: `Error en la evaluación crediticia: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  /**
   * Valida que el perfil tenga todos los campos requeridos
   */
  private validateProfile(profile: CreditEvaluationProfile): void {
    const requiredFields: (keyof CreditEvaluationProfile)[] = [
      'nombre',
      'tipoDocumento',
      'numeroDocumento',
      'fechaNacimiento',
      'tipoPrestamo',
      'montoSolicitado',
      'plazoMeses',
      'periodoPago',
      'ingresosMensuales',
      'gastosMensuales',
      'tiempoLaborando'
    ];

    for (const field of requiredFields) {
      if (profile[field] === undefined || profile[field] === null) {
        throw new Error(`Campo requerido faltante: ${String(field)}`);
      }
    }
  }

  /**
   * Calcula la edad a partir de la fecha de nacimiento
   */
  private calculateAge(fechaNacimiento: string): number {
    const today = new Date();
    const birthDate = new Date(fechaNacimiento);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Calcula las puntuaciones individuales de cada factor
   */
  private calculateFactorScores(
    profile: CreditEvaluationProfile,
    age: number,
    criteria: any
  ): FactorScores {
    const scores: Partial<FactorScores> = {};

    // Income to Debt Ratio Score
    const monthlyIncome = profile.ingresosMensuales || 0;
    const monthlyExpenses = profile.gastosMensuales || 0;
    const incomeDebtRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100;

    if (incomeDebtRatio <= criteria.incomeDebtRatio.excellent) {
      scores.incomeDebtRatio = 100;
    } else if (incomeDebtRatio <= criteria.incomeDebtRatio.good) {
      scores.incomeDebtRatio = 85;
    } else if (incomeDebtRatio <= criteria.incomeDebtRatio.fair) {
      scores.incomeDebtRatio = 70;
    } else if (incomeDebtRatio <= criteria.incomeDebtRatio.poor) {
      scores.incomeDebtRatio = 50;
    } else {
      scores.incomeDebtRatio = 25;
    }

    // Employment Stability Score
    const employmentMonths = profile.tiempoLaborando || 0;
    if (employmentMonths >= criteria.employmentStability.excellent) {
      scores.employmentStability = 100;
    } else if (employmentMonths >= criteria.employmentStability.good) {
      scores.employmentStability = 85;
    } else if (employmentMonths >= criteria.employmentStability.fair) {
      scores.employmentStability = 70;
    } else if (employmentMonths >= criteria.employmentStability.poor) {
      scores.employmentStability = 50;
    } else {
      scores.employmentStability = 25;
    }

    // Loan to Income Ratio Score
    const loanAmount = profile.montoSolicitado || 0;
    const annualIncome = monthlyIncome * 12;
    const loanIncomeRatio = annualIncome > 0 ? loanAmount / annualIncome : 999;

    if (loanIncomeRatio <= criteria.loanIncomeRatio.excellent) {
      scores.loanIncomeRatio = 100;
    } else if (loanIncomeRatio <= criteria.loanIncomeRatio.good) {
      scores.loanIncomeRatio = 85;
    } else if (loanIncomeRatio <= criteria.loanIncomeRatio.fair) {
      scores.loanIncomeRatio = 70;
    } else if (loanIncomeRatio <= criteria.loanIncomeRatio.poor) {
      scores.loanIncomeRatio = 50;
    } else {
      scores.loanIncomeRatio = 25;
    }

    // Age Factor Score
    if (age >= criteria.ageRange.optimalMin && age <= criteria.ageRange.optimalMax) {
      scores.ageFactor = 100;
    } else if (age >= criteria.ageRange.min && age <= criteria.ageRange.max) {
      scores.ageFactor = 85;
    } else {
      scores.ageFactor = 50;
    }

    // Document Type Score
    const docType = (profile.tipoDocumento || '').toLowerCase();
    scores.documentTypeFactor = criteria.documentScores[docType] || 80;

    return scores as FactorScores;
  }

  /**
   * Calcula la puntuación general ponderada
   */
  private calculateOverallScore(scores: FactorScores): number {
    const weights: Record<keyof FactorScores, number> = {
      incomeDebtRatio: 0.3,
      employmentStability: 0.25,
      loanIncomeRatio: 0.25,
      ageFactor: 0.1,
      documentTypeFactor: 0.1
    };

    let totalScore = 0;
    for (const [factor, score] of Object.entries(scores) as [keyof FactorScores, number][]) {
      totalScore += score * (weights[factor] || 0);
    }

    return Math.round(totalScore * 10) / 10;
  }

  /**
   * Determina el nivel de riesgo basado en la puntuación
   */
  private determineRiskLevel(score: number): string {
    if (score >= 85) return 'VERY_LOW';
    if (score >= 75) return 'LOW';
    if (score >= 65) return 'MEDIUM';
    if (score >= 50) return 'ALTO';
    return 'VERY_HIGH';
  }

  /**
   * Calcula la periodicidad según la calificación y período de pago
   */
  private calculatePeriodicidad(calificacion: number, periodoPago: string): number {
    const calificacionPercent = calificacion / 100;

    if (periodoPago === 'semanal') {
      if (calificacionPercent <= 0.70) return 8;
      if (calificacionPercent <= 0.85) return 13;
      if (calificacionPercent <= 1.00) return 15;
    } else if (periodoPago === 'quincenal') {
      if (calificacionPercent <= 0.70) return 4;
      if (calificacionPercent <= 0.85) return 7;
      if (calificacionPercent <= 1.00) return 8;
    } else if (periodoPago === 'mensual') {
      if (calificacionPercent <= 0.70) return 3;
      if (calificacionPercent <= 0.85) return 6;
      if (calificacionPercent <= 1.00) return 12;
    }

    return 0;
  }

  /**
   * Calcula la tasa de interés anual basada en el score y nivel de riesgo
   */
  private calculateInterestRate(score: number, riskLevel: string): number {
    let interestRate: number;

    if (score >= 85) {
      // VERY_LOW risk: 8-12% annual
      interestRate = 8 + ((100 - score) / 15) * 4;
    } else if (score >= 75) {
      // LOW risk: 12-16% annual
      interestRate = 12 + ((85 - score) / 10) * 4;
    } else if (score >= 65) {
      // MEDIUM risk: 16-20% annual
      interestRate = 16 + ((75 - score) / 10) * 4;
    } else if (score >= 50) {
      // HIGH risk: 20-25% annual
      interestRate = 20 + ((65 - score) / 15) * 5;
    } else {
      // VERY_HIGH risk: 25-30% annual
      interestRate = 25 + ((50 - score) / 50) * 5;
    }

    // Asegurar que la tasa esté dentro de límites razonables
    interestRate = Math.max(8, Math.min(30, interestRate));

    return Math.round(interestRate * 100) / 100;
  }

  /**
   * Calcula todos los detalles del préstamo
   */
  private calculateLoanDetails(
    score: number,
    montoSolicitado: number,
    periodoPago: string,
    riskLevel: string
  ): LoanDetails {
    const calificacion = score;

    // Monto aprobado = calificación × monto solicitado
    const montoAprobado = (calificacion / 100) * montoSolicitado;

    // Calcular periodicidad
    const periodicidad = this.calculatePeriodicidad(calificacion, periodoPago);

    // Calcular tasa de interés anual
    const tasaInteresAnual = this.calculateInterestRate(score, riskLevel);

    // Calcular cuota (simple division as per original tool)
    const montoPorPeriodo = periodicidad > 0 ? montoAprobado / periodicidad : 0;

    return {
      calificacion,
      montoSolicitado,
      montoAprobado: Math.round(montoAprobado * 100) / 100,
      periodoPago: periodoPago as 'semanal' | 'quincenal' | 'mensual',
      periodicidad,
      montoPorPeriodo: Math.round(montoPorPeriodo * 100) / 100,
      tasaInteresAnual
    };
  }
}
