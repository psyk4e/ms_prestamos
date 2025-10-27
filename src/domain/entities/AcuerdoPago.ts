/**
 * Entity representing a payment agreement
 */
export interface AcuerdoPago {
  id?: number;
  creditoId: number;
  clienteId: string;
  plazosPagar: number;
  fechaPago: string; // Format: YYYY-MM-DD
  periodicidad: string;
  comentario?: string;
  fechaCreacion?: Date;
  estado?: string;
  saldoCancelacion: number;
  montoAcuerdoPago: number;
}

/**
 * Filter interface for payment agreement queries
 */
export interface AcuerdoPagoFilter {
  creditoId?: number;
  clienteId?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  saldoCancelacion?: number;
}

/**
 * Response interface for payment agreement operations
 */
export interface AcuerdoPagoResponse {
  success: boolean;
  message: string;
  data?: AcuerdoPago;
  error?: string;
}