import Joi from 'joi';

export class AgentRequestValidator {
  private static readonly listParamsSchema = Joi.object({
    status: Joi.string().optional().valid('pending', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled', 'processing', 'failed'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    since: Joi.string().isoDate().optional(),
    faseActual: Joi.string().optional().valid('pre_calificacion', 'datos_personales', 'documentacion', 'revision')
  });

  private static readonly idSchema = Joi.object({
    id: Joi.string().required().min(1)
  });

  private static readonly statusParamsSchema = Joi.object({
    status: Joi.string().required().valid('pending', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled', 'processing', 'failed'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  });

  private static readonly countParamsSchema = Joi.object({
    since: Joi.string().isoDate().required()
  });

  private static readonly documentParamsSchema = Joi.object({
    id: Joi.string().required().min(1),
    documentPath: Joi.string().required().min(1).pattern(/^[a-zA-Z0-9\-_\/\.]+$/)
  });

  private static readonly documentWithFilenameParamsSchema = Joi.object({
    id: Joi.string().required().min(1),
    filename: Joi.string().required().min(1).pattern(/^[a-zA-Z0-9\-_\.]+$/)
  });

  static validateListParams(data: any) {
    const { error, value } = this.listParamsSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    // Convert since string to Date if provided
    if (value.since) {
      value.since = new Date(value.since);
    }

    return value;
  }

  static validateId(data: any) {
    const { error, value } = this.idSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  static validateStatusParams(data: any) {
    const { error, value } = this.statusParamsSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  static validateCountParams(data: any) {
    const { error, value } = this.countParamsSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    // Convert since string to Date
    value.since = new Date(value.since);

    return value;
  }

  static validateDocumentParams(data: any) {
    const { error, value } = this.documentParamsSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  static validateDocumentWithFilenameParams(data: any) {
    const { error, value } = this.documentWithFilenameParamsSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }
}