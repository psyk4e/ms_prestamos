import { z } from 'zod';

export class AcuerdoPagoValidator {
  // Schema for creating a payment agreement
  private static readonly createAcuerdoPagoSchema = z.object({
    creditoId: z.coerce.number({
      message: 'creditoId debe ser un número'
    }).int('creditoId debe ser un número entero').positive('creditoId debe ser un número válido mayor a 0'),

    clienteId: z.string({
      message: 'clienteId debe ser una cadena'
    }).min(1, 'clienteId debe ser una cadena válida').trim(),

    plazosPagar: z.coerce.number({
      message: 'plazosPagar debe ser un número'
    }).int('plazosPagar debe ser un número entero').positive('plazosPagar debe ser un número válido mayor a 0'),

    fechaPago: z.string({
      message: 'fechaPago debe ser una cadena'
    }).regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaPago debe estar en formato YYYY-MM-DD')
      .refine((date) => {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      }, 'fechaPago debe ser una fecha válida'),

    periodicidad: z.enum(['semanal', 'quincenal', 'mensual'], {
      message: 'periodicidad debe ser semanal, quincenal o mensual'
    }),

    saldoCancelacion: z.coerce.number({
      message: 'saldoCancelacion debe ser un número'
    }).positive('saldoCancelacion debe ser un número válido mayor a 0'),

    montoAcuerdoPago: z.coerce.number({
      message: 'montoAcuerdoPago debe ser un número'
    }).positive('montoAcuerdoPago debe ser un número válido mayor a 0'),
    comentario: z.string().optional()
  });

  // Schema for creditoId parameter validation
  private static readonly creditoIdParamSchema = z.object({
    creditoId: z.coerce.number({
      message: 'creditoId debe ser un número'
    }).int('creditoId debe ser un número entero').positive('creditoId debe ser un número válido mayor a 0')
  });

  // Schema for clienteId parameter validation
  private static readonly clienteIdParamSchema = z.object({
    clienteId: z.string().min(1, 'clienteId debe ser una cadena válida').trim()
  });

  /**
   * Validates payment agreement creation data
   * @param data - Raw data to validate
   * @returns Validated and transformed data
   * @throws Error if validation fails
   */
  static validateCreateAcuerdoPago(data: any) {
    try {
      return this.createAcuerdoPagoSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Validation error: ${firstError.message}`);
      }
      throw error;
    }
  }

  /**
   * Validates creditoId parameter
   * @param data - Raw data containing creditoId
   * @returns Validated and transformed data with numeric creditoId
   * @throws Error if validation fails
   */
  static validateCreditoIdParam(data: any) {
    try {
      return this.creditoIdParamSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Validation error: ${firstError.message}`);
      }
      throw error;
    }
  }

  /**
   * Validates clienteId parameter
   * @param data - Raw data containing clienteId
   * @returns Validated and transformed data
   * @throws Error if validation fails
   */
  static validateClienteIdParam(data: any) {
    try {
      return this.clienteIdParamSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Validation error: ${firstError.message}`);
      }
      throw error;
    }
  }
}