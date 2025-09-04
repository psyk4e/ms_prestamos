import { ICreditoAtrasadoRepository } from '../../domain/interfaces/ICreditoAtrasadoRepository';
import { CreditoAtrasado, CreditoAtrasadoFilter } from '../../domain/entities/CreditoAtrasado';
import { prisma } from './PrismaClient';

export class CreditoAtrasadoRepository implements ICreditoAtrasadoRepository {
  async findByNumCredito(numCredito: number): Promise<CreditoAtrasado | null> {
    const result = await prisma.$queryRaw<CreditoAtrasado[]>`
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [cliente], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], TotalAdeudado AS [ponerseAlDia]
      FROM View_creditos_atrasados
      WHERE num_credito = ${numCredito}
    `;
    return result.map((item) => this.mapToDomain(item))[0] || null;
  }

  async findByCliente(cliente: string): Promise<CreditoAtrasado[]> {
    const result = await prisma.$queryRaw<CreditoAtrasado[]>`
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [cliente], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], TotalAdeudado AS [ponerseAlDia]
      FROM View_creditos_atrasados
      WHERE cod_cliente = ${cliente}
    `;
    return result.map((item) => this.mapToDomain(item));
  }

  //TODO use this filter in the future
  async findAll(filter?: CreditoAtrasadoFilter): Promise<CreditoAtrasado[]> {
    const result = await prisma.$queryRaw<CreditoAtrasado[]>`
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [cliente], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], TotalAdeudado AS [ponerseAlDia]
      FROM View_creditos_atrasados
    `;
    return result.map((item) => this.mapToDomain(item));
  }

  async findWithPagination(
    filter?: CreditoAtrasadoFilter,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: CreditoAtrasado[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    const result = await prisma.$queryRaw<CreditoAtrasado[]>`
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [cliente], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], TotalAdeudado AS [ponerseAlDia]
      FROM View_creditos_atrasados
      LIMIT ${limit} OFFSET ${offset}
    `;
    return {
      data: result.map((item) => this.mapToDomain(item)),
      total: result.length,
      page,
      limit,
      totalPages: Math.ceil(result.length / limit),
    };
  }

  private mapToDomain(prismaResult: any): CreditoAtrasado {
    return {
      creditoId: prismaResult.creditoId,
      clienteId: prismaResult.clienteId,
      cliente: prismaResult.cliente,
      cuotasVencidas: prismaResult.cuotasVencidas,
      concepto: prismaResult.concepto,
      desde: prismaResult.desde,
      ponerseAlDia: Number(prismaResult.ponerseAlDia),
    };
  }
}