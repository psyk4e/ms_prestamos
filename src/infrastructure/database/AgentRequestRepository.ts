import { IAgentRequestRepository } from '../../domain/interfaces/IAgentRequestRepository';
import { AgentRequest, AgentRequestFilter, AgentRequestResponse } from '../../domain/entities/AgentRequest';
import { PrismaClient as PostgresClient } from '@prisma-postgres/client';

// Create PostgreSQL client instance
// Prisma will automatically use DATABASE_URL_POSTGRES from environment variables
// as defined in the schema.prisma datasource configuration
const postgresClient = new PostgresClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
});

export class AgentRequestRepository implements IAgentRequestRepository {
  /**
   * Converts a Long object (from database) to a number
   * Handles both Long objects {low, high, unsigned} and regular numbers/BigInts
   */
  private convertLongToNumber(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    
    // If it's already a number or BigInt, convert directly
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      // Try parsing as JSON first (might be a Long object)
      if (value.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && 'low' in parsed) {
            // Long object: value = low + (high * 0x100000000)
            const low = parsed.low || 0;
            const high = parsed.high || 0;
            return low + (high * 0x100000000);
          }
        } catch {
          // JSON parse failed, fall through to number conversion
        }
      }
      // Try to parse as number
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    }
    
    // If it's an object with low/high properties (Long object)
    if (value && typeof value === 'object' && 'low' in value) {
      const low = value.low || 0;
      const high = value.high || 0;
      return low + (high * 0x100000000);
    }
    
    // Try to convert to number
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private buildPersonalData(user: any | null): any {
    if (!user) return null;
    return {
      nombre: user.nombre ?? undefined,
      apellido: user.apellido ?? undefined,
      cedula: user.identificacion ?? undefined,
      tipoDocumento: user.tipoDocumento ?? undefined,
      telefono: user.telefonoPrincipal ?? undefined,
      telefonoSecundario: user.telefonoSecundario ?? undefined,
      email: user.email ?? undefined,
      fechaNacimiento: user.fechaNacimiento ?? undefined,
      direccion: user.direccion ?? undefined,
      ciudad: user.ciudad ?? undefined,
      provincia: user.provincia ?? undefined,
      codigoPostal: user.codigoPostal ?? undefined,
      estadoCivil: user.estadoCivil ?? undefined,
      genero: user.genero ?? undefined,
      nacionalidad: user.nacionalidad ?? undefined,
      profesion: user.profesion ?? undefined,
      nivelEducativo: user.nivelEducativo ?? undefined,
      ingresosMensuales: user.ingresosMensuales ? Number(user.ingresosMensuales) : undefined,
      status: user.status ?? undefined,
      externalClientId: user.externalClientId ?? undefined,
      clientSource: user.clientSource ?? undefined,
    };
  }

  private mapToResponse(application: any, user: any | null, personalDetail?: any | null, evaluation?: any | null, docs?: any[] | null, primaryAddress?: any | null): AgentRequestResponse {
    const basePersonal = this.buildPersonalData(user);

    // Agregar dirección primaria si existe
    const personalWithAddress = primaryAddress ? {
      ...basePersonal,
      direccionPrimaria: {
        direccion: primaryAddress.direccion ?? undefined,
        latitud: primaryAddress.latitud ? Number(primaryAddress.latitud) : undefined,
        longitud: primaryAddress.longitud ? Number(primaryAddress.longitud) : undefined,
        isPrimary: primaryAddress.isPrimary ?? undefined,
        updatedAt: primaryAddress.updatedAt ?? undefined,
      }
    } : basePersonal;

    const enrichedPersonal = personalDetail ? {
      ...personalWithAddress,
      conyuge: {
        nombre: personalDetail.conyugeNombre ?? undefined,
        apellido: personalDetail.conyugeApellido ?? undefined,
        documento: personalDetail.conyugeCedula ?? undefined,
        telefono: personalDetail.conyugeTelefono ?? undefined,
        email: personalDetail.conyugeEmail ?? undefined,
        trabajo: personalDetail.conyugeTrabajo ?? undefined,
        salario: personalDetail.conyugeSalario ?? undefined,
        tipoDocumento: personalDetail.conyugeTipoDocumento ?? undefined,
      },
      numeroHijos: personalDetail.numeroHijos ?? undefined,
      personasDependientes: personalDetail.personasDependientes ?? undefined,
      tipoVivienda: personalDetail.tipoVivienda ?? undefined,
      tiempoResidenciaMeses: personalDetail.tiempoResidenciaMeses ?? undefined,
    } : personalWithAddress;

    const mappedDocs = (docs || []).map((d: any) => ({
      id: d.id,
      type: d.documentType,
      name: d.documentName,
      path: d.filePath ?? undefined,
      url: d.fileUrl ?? undefined,
      status: d.validationStatus ?? undefined,
      validationNotes: d.validationNotes ?? undefined,
      uploadedAt: d.uploadedAt ?? undefined,
      validatedAt: d.validatedAt ?? undefined,
      expiresAt: d.expiresAt ?? undefined,
      mimeType: d.mimeType ?? undefined,
      size: this.convertLongToNumber(d.fileSizeRaw || d.fileSize),
      required: d.isRequired ?? undefined,
      createdAt: d.createdAt ?? undefined,
      updatedAt: d.updatedAt ?? undefined,
    }));

    // Metadata del préstamo
    const prestamoMetadata = {
      montoSolicitado: application.montoSolicitado ? Number(application.montoSolicitado) : undefined,
      plazoMeses: application.plazoMeses ?? undefined,
      periodoPago: application.periodoPago ?? undefined,
      tiempoLaborandoMeses: application.tiempoLaborandoMeses ?? undefined,
      salarioMensual: application.salarioMensual ? Number(application.salarioMensual) : undefined,
      gastosMensuales: application.gastosMensuales ? Number(application.gastosMensuales) : undefined,
    };

    // Metadata de validación/evaluación
    const metaEval = evaluation ? {
      evaluationScore: evaluation.evaluationScore ? Number(evaluation.evaluationScore) : undefined,
      riskLevel: evaluation.riskLevel ?? undefined,
      creditDecision: evaluation.creditDecision ?? undefined,
      requestedAmount: evaluation.requestedAmount ? Number(evaluation.requestedAmount) : undefined,
      approvedAmount: evaluation.approvedAmount ? Number(evaluation.approvedAmount) : undefined,
      approvalPercentage: evaluation.approvalPercentage ? Number(evaluation.approvalPercentage) : undefined,
      evaluationType: evaluation.evaluationType ?? undefined,
      evaluationVersion: evaluation.evaluationVersion ?? undefined,
      evaluatedBy: evaluation.evaluatedBy ?? undefined,
      evaluationNotes: evaluation.evaluationNotes ?? undefined,
      evaluationData: evaluation.evaluationData ?? undefined,
      evaluatedAt: evaluation.createdAt ?? undefined,
      updatedAt: evaluation.updatedAt ?? undefined,
    } : {};

    return {
      id: application.id,
      externalId: application.trackingNumber?.toString?.() ?? application.id,
      status: application.status ?? 'pending',
      userId: application.userId,
      personalData: enrichedPersonal,
      documents: mappedDocs.length ? mappedDocs : null,
      metadata: {
        completionPercentage: application.completionPercentage ? Number(application.completionPercentage) : undefined,
        autoActivationReady: application.autoActivationReady ?? undefined,
        faseActual: application.faseActual ?? undefined,
        bloqueActual: application.bloqueActual ?? undefined,
        tipoPrestamo: application.tipoPrestamo ?? undefined,
        prestamo: prestamoMetadata,
        validation: metaEval,
        // Fechas importantes de la solicitud
        submittedAt: application.submittedAt ?? undefined,
        rejectedAt: application.rejectedAt ?? undefined,
      },
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      completedAt: application.approvedAt ?? null,
    } as AgentRequestResponse;
  }

  async findMany(filter: AgentRequestFilter): Promise<{ data: AgentRequestResponse[], total: number }> {
    const skip = (filter.page - 1) * filter.limit;

    const whereClause: any = {};
    if (filter.status) whereClause.status = filter.status;
    if (filter.since) whereClause.createdAt = { gte: filter.since };
    if (filter.faseActual) whereClause.faseActual = filter.faseActual;

    const [applications, total] = await Promise.all([
      // Query loan applications
      postgresClient.loanApplication.findMany({
        where: whereClause,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
      }),
      postgresClient.loanApplication.count({ where: whereClause }),
    ]);

    // Fetch users in batch
    const userIds = applications.map((a: any) => a.userId).filter(Boolean);
    const users = userIds.length
      ? await postgresClient.user.findMany({ where: { userId: { in: userIds } } })
      : [];
    const userById = new Map(users.map((u: any) => [u.userId, u]));

    return {
      data: applications.map((app: any) => this.mapToListResponse(app, userById.get(app.userId) || null)),
      total,
    };
  }

  async findById(id: string): Promise<AgentRequestResponse | null> {
    const app = await postgresClient.loanApplication.findUnique({ where: { id } });
    if (!app) return null;

    // Use raw SQL query for documents to handle Long object conversion in file_size
    // The file_size might be stored as a JSON object (Long) or as a regular BigInt
    const docsQuery = `
      SELECT 
        id,
        user_id as "userId",
        loan_application_id as "loanApplicationId",
        document_type as "documentType",
        document_name as "documentName",
        file_path as "filePath",
        file_url as "fileUrl",
        file_size::text as "fileSizeRaw",
        mime_type as "mimeType",
        validation_status as "validationStatus",
        validation_notes as "validationNotes",
        is_required as "isRequired",
        uploaded_at as "uploadedAt",
        validated_at as "validatedAt",
        expires_at as "expiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM documents
      WHERE loan_application_id = $1::uuid
      ORDER BY uploaded_at DESC
    `;

    const [user, personalDetail, evaluation, docsRaw, primaryAddress] = await Promise.all([
      postgresClient.user.findUnique({ where: { userId: app.userId } }),
      postgresClient.personalDetail.findFirst({ where: { loanApplicationId: id }, orderBy: { updatedAt: 'desc' } }),
      postgresClient.creditEvaluation.findFirst({ where: { loanApplicationId: id, isActive: true }, orderBy: { updatedAt: 'desc' } }),
      postgresClient.$queryRawUnsafe(docsQuery, id) as Promise<any[]>,
      app.userId ? postgresClient.userAddress.findFirst({
        where: { userId: app.userId, isPrimary: true },
        orderBy: { updatedAt: 'desc' }
      }) : null,
    ]);

    return this.mapToResponse(app, user || null, personalDetail || null, evaluation || null, docsRaw || [], primaryAddress || null);
  }

  async findByExternalId(externalId: string): Promise<AgentRequestResponse | null> {
    // externalId maps to trackingNumber (int)
    const tracking = Number(externalId);
    const app = await postgresClient.loanApplication.findFirst({ where: { trackingNumber: tracking } });
    if (!app) return null;

    const [user, primaryAddress] = await Promise.all([
      postgresClient.user.findUnique({ where: { userId: app.userId } }),
      app.userId ? postgresClient.userAddress.findFirst({
        where: { userId: app.userId, isPrimary: true },
        orderBy: { updatedAt: 'desc' }
      }) : null,
    ]);

    return this.mapToResponse(app, user || null, null, null, null, primaryAddress || null);
  }

  async findByStatus(status: string, page: number, limit: number): Promise<{ data: AgentRequestResponse[], total: number }> {
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      postgresClient.loanApplication.findMany({
        where: { status },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      postgresClient.loanApplication.count({ where: { status } }),
    ]);

    const userIds = applications.map((a: any) => a.userId).filter(Boolean);
    const users = userIds.length
      ? await postgresClient.user.findMany({ where: { userId: { in: userIds } } })
      : [];
    const userById = new Map(users.map((u: any) => [u.userId, u]));

    return {
      data: applications.map((app: any) => this.mapToListResponse(app, userById.get(app.userId) || null)),
      total,
    };
  }

  async findByDocumentId(documentId: string): Promise<AgentRequestResponse | null> {
    // Use raw SQL to handle Long object conversion in file_size
    const docQuery = `
      SELECT 
        id,
        user_id as "userId",
        loan_application_id as "loanApplicationId",
        document_type as "documentType",
        document_name as "documentName",
        file_path as "filePath",
        file_url as "fileUrl",
        file_size::text as "fileSizeRaw",
        mime_type as "mimeType",
        validation_status as "validationStatus",
        validation_notes as "validationNotes",
        is_required as "isRequired",
        uploaded_at as "uploadedAt",
        validated_at as "validatedAt",
        expires_at as "expiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM documents
      WHERE id = $1::uuid
    `;
    
    const docsRaw = await postgresClient.$queryRawUnsafe(docQuery, documentId) as any[];
    if (!docsRaw || docsRaw.length === 0) return null;
    
    const doc = docsRaw[0];
    const app = await postgresClient.loanApplication.findUnique({ where: { id: doc.loanApplicationId || '' } });
    if (!app) return null;

    const [user, primaryAddress] = await Promise.all([
      postgresClient.user.findUnique({ where: { userId: app.userId } }),
      app.userId ? postgresClient.userAddress.findFirst({
        where: { userId: app.userId, isPrimary: true },
        orderBy: { updatedAt: 'desc' }
      }) : null,
    ]);

    return this.mapToResponse(app, user || null, null, null, [doc], primaryAddress || null);
  }

  async countSince(since?: Date): Promise<number> {
    const whereClause: any = {};
    if (since) whereClause.createdAt = { gte: since };
    return await postgresClient.loanApplication.count({ where: whereClause });
  }

  async create(_data: Partial<AgentRequest>): Promise<AgentRequestResponse> {
    // Creating loan applications through this endpoint is not supported; throw or map minimal
    throw new Error('Create not supported for loan applications via AgentRequestRepository');
  }

  async update(_id: string, _data: Partial<AgentRequest>): Promise<AgentRequestResponse | null> {
    // Updating loan applications through this endpoint is not supported
    return null;
  }

  async delete(_id: string): Promise<boolean> {
    // Deleting loan applications through this endpoint is not supported
    return false;
  }

  private mapToListResponse(application: any, user: any | null): AgentRequestResponse {
    const basePersonal = user ? {
      cedula: user.identificacion ?? undefined,
      nombre: user.nombre ?? undefined,
      apellido: user.apellido ?? undefined,
      telefono: user.telefono ?? undefined,
      email: user.email ?? undefined,
    } : null;

    // Metadata básica del préstamo para listas
    const prestamoMetadata = {
      montoSolicitado: application.montoSolicitado ? Number(application.montoSolicitado) : undefined,
      plazoMeses: application.plazoMeses ?? undefined,
      periodoPago: application.periodoPago ?? undefined,
    };

    return {
      id: application.id,
      externalId: application.trackingNumber?.toString?.() ?? application.id,
      status: application.status ?? 'pending',
      userId: application.userId,
      personalData: basePersonal,
      documents: null,
      metadata: {
        completionPercentage: application.completionPercentage ? Number(application.completionPercentage) : undefined,
        faseActual: application.faseActual ?? undefined,
        tipoPrestamo: application.tipoPrestamo ?? undefined,
        prestamo: prestamoMetadata,
      },
      createdAt: application.createdAt || new Date(),
      updatedAt: application.updatedAt || new Date(),
      completedAt: application.approvedAt ?? null,
    };
  }
}

