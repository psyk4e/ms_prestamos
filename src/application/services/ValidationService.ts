import Joi from 'joi';

export class ValidationService {
  private static readonly numCreditoSchema = Joi.object({
    numCredito: Joi.number().integer().positive().required()
  });

  private static readonly clienteSchema = Joi.object({
    cliente: Joi.string().min(1).max(255).required()
  });

  private static readonly filterSchema = Joi.object({
    numCredito: Joi.number().integer().positive().optional(),
    cliente: Joi.string().min(1).max(255).optional(),
    fechaDesde: Joi.date().optional(),
    fechaHasta: Joi.date().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  });

  private static readonly authKeySchema = Joi.object({
    authKey: Joi.string().required()
  });

  static validateNumCredito(data: any) {
    const { error, value } = this.numCreditoSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  static validateCliente(data: any) {
    const { error, value } = this.clienteSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  static validateFilter(data: any) {
    const { error, value } = this.filterSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  static validateAuthKey(data: any) {
    const { error, value } = this.authKeySchema.validate(data);
    if (error) {
      throw new Error(`Authentication error: ${error.details[0].message}`);
    }
    return value;
  }
}