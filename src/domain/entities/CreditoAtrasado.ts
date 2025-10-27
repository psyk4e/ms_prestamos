export interface CreditoAtrasado {
  creditoId: number;
  clienteId: string;
  nombre: string;
  cuotasVencidas: number;
  concepto: string;
  desde: Date;
  ponerseAlDia: number;
  cuotas: number;
  saldoCancelacion: number;
  phoneNumber: string;
}

export interface CreditoAtrasadoFilter {
  numCredito?: number;
  cliente?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

export interface CreditoAtrasadoResponse {
  creditoId: number;
  clienteId: string;
  nombre: string;
  cuotasVencidas: number;
  concepto: string;
  desde: Date;
  ponerseAlDia: number;
  phoneNumber: string;
  saldoCancelacion: number;
  cuotas?: {
    min: number;
    max: number;
    cantidad: number;
  };
}