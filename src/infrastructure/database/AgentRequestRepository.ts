import { IAgentRequestRepository } from '../../domain/interfaces/IAgentRequestRepository';
import { AgentRequest, AgentRequestFilter, AgentRequestResponse } from '../../domain/entities/AgentRequest';
// @ts-ignore - Prisma client is generated during build
import { PrismaClient as PostgresClient } from '@prisma-postgres/client';

// Create PostgreSQL client instance
const postgresClient = new PostgresClient({
  datasources: {
    postgres_db: {
      url: process.env.DATABASE_URL_POSTGRES
    }
  }
});

export class AgentRequestRepository implements IAgentRequestRepository {
  private buildPersonalData(user: any | null): any {
    if (!user) return null;
    return {
      nombre: user.nombre ?? undefined,
      apellido: user.apellido ?? undefined,
      cedula: user.identificacion ?? undefined,
      telefono: user.telefonoPrincipal ?? undefined,
      email: user.email ?? undefined,
      direccion: user.direccion ?? undefined,
      estadoCivil: user.estadoCivil ?? undefined,
      genero: user.genero ?? undefined,
      nacionalidad: user.nacionalidad ?? undefined,
      profesion: user.profesion ?? undefined,
      nivelEducativo: user.nivelEducativo ?? undefined,
    };
  }

  private mapToResponse(application: any, user: any | null, personalDetail?: any | null, evaluation?: any | null, docs?: any[] | null): AgentRequestResponse {
    const basePersonal = this.buildPersonalData(user);
    const enrichedPersonal = personalDetail ? {
      ...basePersonal,
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
    } : basePersonal;

    const mappedDocs = (docs || []).map((d: any) => ({
      id: d.id,
      type: d.documentType,
      name: d.documentName,
      // path: d.filePath ?? undefined,
      // status: d.validationStatus ?? undefined,
      // uploadedAt: d.uploadedAt ?? undefined,
      // validatedAt: d.validatedAt ?? undefined,
      // expiresAt: d.expiresAt ?? undefined,
      mimeType: d.mimeType ?? undefined,
      size: d.fileSize ?? undefined,
      // required: d.isRequired ?? undefined,
    }));

    const metaEval = evaluation ? {
      evaluationScore: evaluation.evaluationScore ?? undefined,
      riskLevel: evaluation.riskLevel ?? undefined,
      creditDecision: evaluation.creditDecision ?? undefined,
      requestedAmount: evaluation.requestedAmount ?? undefined,
      approvedAmount: evaluation.approvedAmount ?? undefined,
      approvalPercentage: evaluation.approvalPercentage ?? undefined,
      evaluationType: evaluation.evaluationType ?? undefined,
      evaluationVersion: evaluation.evaluationVersion ?? undefined,
      evaluatedBy: evaluation.evaluatedBy ?? undefined,
      evaluationNotes: evaluation.evaluationNotes ?? undefined,
    } : {};

    return {
      id: application.id,
      externalId: application.trackingNumber?.toString?.() ?? application.id,
      status: application.status ?? 'pending',
      userId: application.userId,
      personalData: enrichedPersonal,
      documents: mappedDocs.length ? mappedDocs : null,
      metadata: {
        completionPercentage: application.completionPercentage ?? undefined,
        autoActivationReady: application.autoActivationReady ?? undefined,
        faseActual: application.faseActual ?? undefined,
        bloqueActual: application.bloqueActual ?? undefined,
        tipoPrestamo: application.tipoPrestamo ?? undefined,
        evaluation: metaEval,
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
      (postgresClient as any).loanApplication.findMany({
        where: whereClause,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
      }),
      (postgresClient as any).loanApplication.count({ where: whereClause }),
    ]);

    // Fetch users in batch
    const userIds = applications.map((a: any) => a.userId).filter(Boolean);
    const users = userIds.length
      ? await (postgresClient as any).user.findMany({ where: { userId: { in: userIds } } })
      : [];
    const userById = new Map(users.map((u: any) => [u.userId, u]));

    return {
      data: applications.map((app: any) => this.mapToListResponse(app, userById.get(app.userId) || null)),
      total,
    };
  }

  async findById(id: string): Promise<AgentRequestResponse | null> {
    const app = await (postgresClient as any).loanApplication.findUnique({ where: { id } });
    if (!app) return null;

    const [user, personalDetail, evaluation, docs] = await Promise.all([
      (postgresClient as any).user.findUnique({ where: { userId: app.userId } }),
      (postgresClient as any).personalDetail.findFirst({ where: { loanApplicationId: id }, orderBy: { updatedAt: 'desc' } }),
      (postgresClient as any).creditEvaluation.findFirst({ where: { loanApplicationId: id, isActive: true }, orderBy: { updatedAt: 'desc' } }),
      (postgresClient as any).document.findMany({ where: { loanApplicationId: id }, orderBy: { uploadedAt: 'desc' } }),
    ]);

    return this.mapToResponse(app, user || null, personalDetail || null, evaluation || null, docs || []);
  }

  async findByExternalId(externalId: string): Promise<AgentRequestResponse | null> {
    // externalId maps to trackingNumber (int)
    const tracking = Number(externalId);
    const app = await (postgresClient as any).loanApplication.findFirst({ where: { trackingNumber: tracking } });
    if (!app) return null;
    const user = await (postgresClient as any).user.findUnique({ where: { userId: app.userId } });
    return this.mapToResponse(app, user || null);
  }

  async findByStatus(status: string, page: number, limit: number): Promise<{ data: AgentRequestResponse[], total: number }> {
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      (postgresClient as any).loanApplication.findMany({
        where: { status },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (postgresClient as any).loanApplication.count({ where: { status } }),
    ]);

    const userIds = applications.map((a: any) => a.userId).filter(Boolean);
    const users = userIds.length
      ? await (postgresClient as any).user.findMany({ where: { userId: { in: userIds } } })
      : [];
    const userById = new Map(users.map((u: any) => [u.userId, u]));

    return {
      data: applications.map((app: any) => this.mapToListResponse(app, userById.get(app.userId) || null)),
      total,
    };
  }

  async findByDocumentId(documentId: string): Promise<AgentRequestResponse | null> {
    const doc = await (postgresClient as any).document.findUnique({ where: { documentId } });
    if (!doc) return null;
    const app = await (postgresClient as any).loanApplication.findUnique({ where: { id: doc.loanApplicationId } });
    if (!app) return null;
    const user = await (postgresClient as any).user.findUnique({ where: { userId: app.userId } });
    return this.mapToResponse(app, user || null);
  }

  async countSince(since?: Date): Promise<number> {
    const whereClause: any = {};
    if (since) whereClause.createdAt = { gte: since };
    return await (postgresClient as any).loanApplication.count({ where: whereClause });
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

  private mapToListResponse(application: any, user: any | null): Partial<AgentRequestResponse> {
    const basePersonal = user ? {
      cedula: user.identificacion ?? undefined,
      nombre: user.nombre ?? undefined,
      apellido: user.apellido ?? undefined,
      telefono: user.telefono ?? undefined,
      email: user.email ?? undefined,
    } : {};

    return {
      id: application.id,
      externalId: application.trackingNumber?.toString?.() ?? application.id,
      status: application.status ?? 'pending',
      userId: application.userId,
      personalData: basePersonal,
      metadata: {
        completionPercentage: application.completionPercentage ?? undefined,
        faseActual: application.faseActual ?? undefined,
        tipoPrestamo: application.tipoPrestamo ?? undefined,
      },
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}

