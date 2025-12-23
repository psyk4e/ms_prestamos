export interface CreditEvaluationProfile {
  nombre: string;
  tipoDocumento: 'cedula' | 'pasaporte';
  numeroDocumento: string;
  fechaNacimiento: string; // YYYY-MM-DD
  tipoPrestamo: 'personal' | 'vehicular' | 'hipotecario' | 'comercial';
  montoSolicitado: number;
  plazoMeses: number;
  periodoPago: 'semanal' | 'quincenal' | 'mensual';
  ingresosMensuales: number;
  gastosMensuales: number;
  tiempoLaborando: number; // meses
}

export interface CreditEvaluationRequest {
  profile: CreditEvaluationProfile;
}

export interface FactorScores {
  incomeDebtRatio: number;
  employmentStability: number;
  loanIncomeRatio: number;
  ageFactor: number;
  documentTypeFactor: number;
}

export interface LoanDetails {
  calificacion: number;
  montoSolicitado: number;
  montoAprobado: number;
  periodoPago: 'semanal' | 'quincenal' | 'mensual';
  periodicidad: number; // número de pagos
  montoPorPeriodo: number; // cuota calculada
  tasaInteresAnual: number;
}

export interface CreditEvaluationResponse {
  success: boolean;
  data?: {
    solicitante: {
      nombre: string;
      edad: number;
      tipoDocumento: string;
    };
    evaluacion: {
      puntuacion: number;
      nivelRiesgo: string;
      decision: 'APROBADO' | 'RECHAZADO';
    };
    prestamo: {
      tipoSolicitud: string;
      montoSolicitado: number;
      montoAprobado: number;
      porcentajeAprobacion: number;
    };
    pago: {
      periodo: string;
      numeroPagos: number;
      montoPorPago: number;
      plazoMeses: number;
      tasaInteresAnual: number;
    };
    factoresClave: {
      relacionIngresoGasto: number;
      estabilidadLaboral: number;
      capacidadPago: number;
    };
  };
  error?: string;
}

