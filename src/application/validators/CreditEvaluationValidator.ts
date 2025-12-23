import Joi from 'joi';

export class CreditEvaluationValidator {
  private static readonly creditEvaluationSchema = Joi.object({
    profile: Joi.object({
      nombre: Joi.string().required().min(2).max(50),
      tipoDocumento: Joi.string().required().valid('cedula', 'pasaporte'),
      numeroDocumento: Joi.string().required().min(1),
      fechaNacimiento: Joi.string()
        .required()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .message('Fecha de nacimiento debe tener formato YYYY-MM-DD'),
      tipoPrestamo: Joi.string().required().valid('personal', 'vehicular', 'hipotecario', 'comercial'),
      montoSolicitado: Joi.number().required().min(1000).max(500000),
      plazoMeses: Joi.number().required().integer().min(6).max(60),
      periodoPago: Joi.string().required().valid('semanal', 'quincenal', 'mensual'),
      ingresosMensuales: Joi.number().required().min(0),
      gastosMensuales: Joi.number().required().min(0),
      tiempoLaborando: Joi.number().required().min(0)
    }).required()
  });

  static validateCreditEvaluationRequest(data: any) {
    const { error, value } = this.creditEvaluationSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message).join(', ');
      throw new Error(`Validation error: ${errors}`);
    }

    return value;
  }
}


