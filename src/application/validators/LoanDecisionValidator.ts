import Joi from 'joi';

export interface LoanDecisionRequest {
  loanApplicationId: string;
  approved: boolean;
  comentario?: string;
  approvedBy?: string;
}

export class LoanDecisionValidator {
  private static readonly loanDecisionSchema = Joi.object({
    loanApplicationId: Joi.string().uuid().required().messages({
      'string.guid': 'El loanApplicationId debe ser un UUID válido',
      'any.required': 'El loanApplicationId es requerido'
    }),
    approved: Joi.boolean().required().messages({
      'boolean.base': 'El campo approved debe ser un valor booleano',
      'any.required': 'El campo approved es requerido'
    }),
    comentario: Joi.string().max(1000).optional().allow('', null).messages({
      'string.max': 'El comentario no puede exceder 1000 caracteres'
    }),
    approvedBy: Joi.string().max(255).optional().allow('', null).messages({
      'string.max': 'El campo approvedBy no puede exceder 255 caracteres'
    })
  });

  static validateLoanDecision(data: any): LoanDecisionRequest {
    const { error, value } = this.loanDecisionSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message).join(', ');
      throw new Error(`Validation error: ${errors}`);
    }

    return value;
  }

  static validateLoanApplicationIdParam(params: any): { loanApplicationId: string } {
    const schema = Joi.object({
      loanApplicationId: Joi.string().uuid().required().messages({
        'string.guid': 'El loanApplicationId debe ser un UUID válido',
        'any.required': 'El loanApplicationId es requerido'
      })
    });

    const { error, value } = schema.validate(params, {
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
