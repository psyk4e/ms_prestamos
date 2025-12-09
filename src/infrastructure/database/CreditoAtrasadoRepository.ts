import { ICreditoAtrasadoRepository } from '../../domain/interfaces/ICreditoAtrasadoRepository';
import { CreditoAtrasado, CreditoAtrasadoFilter } from '../../domain/entities/CreditoAtrasado';
import { prisma } from './PrismaClient';

export class CreditoAtrasadoRepository implements ICreditoAtrasadoRepository {
  async findByNumCredito(numCredito: number): Promise<CreditoAtrasado | null> {
    const result = await prisma.$queryRaw<CreditoAtrasado[]>`
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [cliente], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], saldoPonerseAlDia AS [ponerseAlDia]
      FROM View_creditos_atrasados
      WHERE num_credito = ${numCredito}
    `;
    return result.map((item: any) => this.mapToDomain(item))[0] || null;
  }

  /**
   * Finds credits by client code with optional notification type filtering
   * @param cliente - Client code
   * @param notificationType - Type of notification scenario to filter by:
   *   - 'early': Credits with 1-2 overdue installments
   *   - 'late': Credits with 3+ overdue installments
   *   - undefined: All credits without filtering by overdue installments
   * @returns Promise resolving to an array of credits for the client
   */
  async findByCliente(cliente: string, notificationType?: 'early' | 'late'): Promise<CreditoAtrasado[]> {
    let result: CreditoAtrasado[];

    let whereClause = `cod_cliente = ${cliente}`;

    if (notificationType === 'early') {
      // Filter for credits with 1-2 overdue installments
      whereClause += ` AND CANT_CUOTAS >= 1 AND CANT_CUOTAS <= 2`;
    } else if (notificationType === 'late') {
      // Filter for credits with 3+ overdue installments
      whereClause += ` AND CANT_CUOTAS >= 3`;
    }

    result = await prisma.$queryRawUnsafe<CreditoAtrasado[]>(`
      SELECT num_credito as [creditoId], 
            cod_cliente as [clienteId], 
            CLIENTE as [cliente], 
            CANT_CUOTAS as [cuotasVencidas],
            'Notificación de atraso en cuota' AS [concepto], 
            DESDE as [desde],
            cuotas,
            saldoPonerseAlDia AS [ponerseAlDia],
            saldoCancelacion AS [saldoCancelacion]
      FROM View_creditos_atrasados
      WHERE ${whereClause}
    `);

    return result.map((item: any) => this.mapToDomain(item));
  }

  /**
   * Finds credits by client identification number
   * @param identificacion - Client identification number
   * @returns Promise resolving to an array of credits for the client
   */
  async findByIdentificacion(identificacion: string): Promise<CreditoAtrasado[]> {
    const result = await prisma.$queryRaw<CreditoAtrasado[]>`
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [nombre], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], saldoPonerseAlDia AS [ponerseAlDia],
      '18296035518' as [phoneNumber]
      FROM View_creditos_atrasados
      WHERE identificacion = ${identificacion}
    `;
    return result.map((item: any) => this.mapToDomain(item));
  }

  /**
   * Retrieves all credits with optional filtering including notification type filtering at database level
   * @param filter - Optional filter criteria for credits
   * @param notificationType - Type of notification scenario to filter by:
   *   - 'early': Credits with 1-2 overdue installments
   *   - 'late': Credits with 3+ overdue installments
   *   - undefined: All credits without filtering by overdue installments
   * @returns Promise resolving to an array of credits
   */
  async findAll(_?: CreditoAtrasadoFilter, notificationType?: 'early' | 'late'): Promise<CreditoAtrasado[]> {
    let whereClause = '';

    if (notificationType === 'early') {
      // Filter for credits with 1-2 overdue installments
      whereClause = 'WHERE CANT_CUOTAS >= 1 AND CANT_CUOTAS <= 2';
    } else if (notificationType === 'late') {
      // Filter for credits with 3+ overdue installments
      whereClause = 'WHERE CANT_CUOTAS >= 3';
    }

    const baseQuery = `
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [nombre], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], saldoPonerseAlDia AS [ponerseAlDia],
      '18296035518' as [phoneNumber]
      FROM View_creditos_atrasados
      ${whereClause}
    `;

    const result = await prisma.$queryRawUnsafe<CreditoAtrasado[]>(baseQuery);
    return result.map((item: any) => this.mapToDomain(item)).slice(0, 5);
  }

  /**
   * Retrieves credits with pagination and optional filtering including notification type filtering at database level
   * @param filter - Optional filter criteria for credits
   * @param notificationType - Type of notification scenario to filter by:
   *   - 'early': Credits with 1-2 overdue installments
   *   - 'late': Credits with 3+ overdue installments
   *   - undefined: All credits without filtering by overdue installments
   * @param page - Page number (1-based)
   * @param limit - Number of items per page
   * @returns Promise resolving to paginated credits data
   */
  async findWithPagination(
    filter?: CreditoAtrasadoFilter,
    notificationType?: 'early' | 'late',
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

    let whereClause = '';

    if (notificationType === 'early') {
      // Filter for credits with 1-2 overdue installments
      whereClause = 'WHERE CANT_CUOTAS >= 1 AND CANT_CUOTAS <= 2';
    } else if (notificationType === 'late') {
      // Filter for credits with 3+ overdue installments
      whereClause = 'WHERE CANT_CUOTAS >= 3';
    }

    // Get total count with filtering
    const countQuery = `SELECT COUNT(*) as count FROM View_creditos_atrasados ${whereClause}`;
    const totalResult = await prisma.$queryRawUnsafe<{ count: number }[]>(countQuery);
    const total = totalResult[0]?.count || 0;

    // Get paginated data with filtering
    const dataQuery = `
      SELECT num_credito as [creditoId], cod_cliente as [clienteId], CLIENTE as [nombre], CANT_CUOTAS as [cuotasVencidas],'Notificación de atraso en cuota' AS [concepto], DESDE as [desde], SaldoPonerseAlDia AS [ponerseAlDia],
      '18296035518' as [phoneNumber]
      FROM View_creditos_atrasados
      ${whereClause}
      ORDER BY num_credito
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `; //TODO colocar el numero real de la persona
    const result = await prisma.$queryRawUnsafe<CreditoAtrasado[]>(dataQuery);

    return {
      data: result.map((item: any) => this.mapToDomain(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapToDomain(prismaResult: any): CreditoAtrasado {
    return {
      creditoId: prismaResult.creditoId,
      clienteId: prismaResult.clienteId,
      nombre: prismaResult.nombre,
      cuotasVencidas: prismaResult.cuotasVencidas,
      concepto: prismaResult.concepto,
      desde: prismaResult.desde,
      ponerseAlDia: Number(prismaResult.ponerseAlDia),
      phoneNumber: prismaResult.phoneNumber,
      cuotas: Number(prismaResult.cuotas),
      saldoCancelacion: Number(prismaResult.saldoCancelacion),
    };
  }
}