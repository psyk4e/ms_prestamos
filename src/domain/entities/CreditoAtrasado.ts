export interface CreditoAtrasado {
  creditoId: number;
  clienteId: string;
  cliente: string;
  cuotasVencidas: number;
  concepto: string;
  desde: Date;
  ponerseAlDia: number;
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
  cliente: string;
  cuotasVencidas: number;
  concepto: string;
  desde: Date;
  ponerseAlDia: number;
}