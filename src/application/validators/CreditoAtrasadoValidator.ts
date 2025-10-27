import { z } from 'zod';

export class CreditoAtrasadoValidator {
  private static readonly numCreditoSchema = z.object({
    numCredito: z.coerce.number({
      message: 'numCredito debe ser un número'
    }).int('numCredito debe ser un número entero').positive('numCredito debe ser un número positivo')
  });

  private static readonly clienteSchema = z.object({
    cliente: z.string({
      message: 'cliente debe ser una cadena'
    }).min(1, 'cliente debe tener al menos 1 caracter').max(255, 'cliente no puede exceder 255 caracteres')
  });

  private static readonly filterSchema = z.object({
    numCredito: z.coerce.number({
      message: 'numCredito debe ser un número'
    }).int('numCredito debe ser un número entero').positive('numCredito debe ser un número positivo').optional(),
    
    cliente: z.string({
      message: 'cliente debe ser una cadena'
    }).min(1, 'cliente debe tener al menos 1 caracter').max(255, 'cliente no puede exceder 255 caracteres').optional(),
    
    fechaDesde: z.date({
      message: 'fechaDesde debe ser una fecha válida'
    }).optional(),
    
    fechaHasta: z.date({
      message: 'fechaHasta debe ser una fecha válida'
    }).optional(),
    
    page: z.coerce.number({
      message: 'page debe ser un número'
    }).int('page debe ser un número entero').min(1, 'page debe ser mayor o igual a 1').optional(),
    
    limit: z.coerce.number({
      message: 'limit debe ser un número'
    }).int('limit debe ser un número entero').min(1, 'limit debe ser mayor o igual a 1').max(100, 'limit no puede exceder 100').optional(),
    
    notificationType: z.enum(['early', 'late'], {
      message: 'notificationType debe ser "early" o "late"'
    }).optional()
  });

  private static readonly authKeySchema = z.object({
    authKey: z.string({
      message: 'authKey debe ser una cadena'
    }).min(1, 'authKey es requerido')
  });

  static validateNumCredito(data: any) {
    try {
      return this.numCreditoSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Validation error: ${firstError.message}`);
      }
      throw error;
    }
  }

  static validateCliente(data: any) {
    try {
      return this.clienteSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Validation error: ${firstError.message}`);
      }
      throw error;
    }
  }

  static validateFilter(data: any) {
    try {
      return this.filterSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Validation error: ${firstError.message}`);
      }
      throw error;
    }
  }

  static validateAuthKey(data: any) {
    try {
      return this.authKeySchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        throw new Error(`Authentication error: ${firstError.message}`);
      }
      throw error;
    }
  }
}