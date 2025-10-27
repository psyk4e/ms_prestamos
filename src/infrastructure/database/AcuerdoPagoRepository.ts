import { IAcuerdoPagoRepository } from '../../domain/interfaces/IAcuerdoPagoRepository';
import { AcuerdoPago, AcuerdoPagoFilter } from '../../domain/entities/AcuerdoPago';
import { prisma } from './PrismaClient';

/**
 * Repository implementation for payment agreements using Prisma queryRaw
 */
export class AcuerdoPagoRepository implements IAcuerdoPagoRepository {

  /**
   * Saves a new payment agreement to the tbl_acuerdospagos_ctes table
   * @param acuerdoPago - Payment agreement data to save
   * @returns Promise resolving to the saved payment agreement with generated ID
   */
  async save(acuerdoPago: AcuerdoPago): Promise<AcuerdoPago> {
    const result = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO tbl_acuerdospagos_ctes (
        no_credito, 
        cod_cliente, 
        cuotas_seleccionadas, 
        fecha_pago,
        periodicidad,
        saldoCancelacion,
        monto_cuota_acuerdo,
        comentario
      )
      OUTPUT INSERTED.id
      VALUES (
        ${acuerdoPago.creditoId},
        ${acuerdoPago.clienteId},
        ${acuerdoPago.plazosPagar},
        ${acuerdoPago.fechaPago},
        ${acuerdoPago.periodicidad},
        ${acuerdoPago.saldoCancelacion},
        ${acuerdoPago.montoAcuerdoPago},
        ${acuerdoPago.comentario || null}
      )
    `;

    const insertedId = result[0]?.id;
    if (!insertedId) {
      throw new Error('Failed to insert payment agreement');
    }

    return {
      ...acuerdoPago,
      id: insertedId,
      fechaCreacion: new Date(),
      estado: 'ACTIVO'
    };
  }

  /**
   * Finds a payment agreement by its ID
   * @param id - Payment agreement ID
   * @returns Promise resolving to the payment agreement or null if not found
   */
  async findById(id: number): Promise<AcuerdoPago | null> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        no_credito as creditoId,
        cod_cliente as clienteId,
        cuotas_seleccionadas as plazosPagar,
        fecha_pago as fechaPago,
        periodicidad,
        comentario,
        estado
      FROM tbl_acuerdospagos_ctes
      WHERE id = ${id}
    `;

    return result.length > 0 ? this.mapToDomain(result[0]) : null;
  }

  /**
   * Finds payment agreements by credit ID
   * @param creditoId - Credit ID to search for
   * @returns Promise resolving to an array of payment agreements
   */
  async findByCreditoId(creditoId: number): Promise<AcuerdoPago[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        no_credito as creditoId,
        cod_cliente as clienteId,
        cuotas_seleccionadas as plazosPagar,
        fecha_pago as fechaPago,
        periodicidad,
        comentario,
        estado
      FROM tbl_acuerdospagos_ctes
      WHERE no_credito = ${creditoId}
      ORDER BY createdAt DESC
    `;

    return result.map(item => this.mapToDomain(item));
  }

  /**
   * Finds payment agreements by client ID
   * @param clienteId - Client ID to search for
   * @returns Promise resolving to an array of payment agreements
   */
  async findByClienteId(clienteId: string): Promise<AcuerdoPago[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        no_credito as creditoId,
        cod_cliente as clienteId,
        cuotas_seleccionadas as plazosPagar,
        fecha_pago as fechaPago,
        periodicidad,
        comentario,
        estado
      FROM tbl_acuerdospagos_ctes
      WHERE cod_cliente = ${clienteId}
      ORDER BY createdAt DESC
    `;

    return result.map(item => this.mapToDomain(item));
  }

  /**
   * Finds all payment agreements with optional filtering
   * @param filter - Optional filter criteria
   * @returns Promise resolving to an array of payment agreements
   */
  async findAll(filter?: AcuerdoPagoFilter): Promise<AcuerdoPago[]> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filter?.creditoId) {
      whereClause += ` AND no_credito = ${filter.creditoId}`;
    }

    if (filter?.clienteId) {
      whereClause += ` AND cod_cliente = '${filter.clienteId}'`;
    }

    if (filter?.estado) {
      whereClause += ` AND estado = '${filter.estado}'`;
    }

    if (filter?.fechaDesde) {
      whereClause += ` AND createdAt >= '${filter.fechaDesde}'`;
    }

    if (filter?.fechaHasta) {
      whereClause += ` AND createdAt <= '${filter.fechaHasta}'`;
    }

    const query = `
      SELECT 
        id,
        no_credito as creditoId,
        cod_cliente as clienteId,
        cuotas_seleccionadas as plazosPagar,
        fecha_pago as fechaPago,
        periodicidad,
        saldoCancelacion,
        monto_cuota_acuerdo as montoAcuerdoPago,
        comentario,
        estado
      FROM tbl_acuerdospagos_ctes
      ${whereClause}
      ORDER BY createdAt DESC
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(query);
    return result.map(item => this.mapToDomain(item));
  }

  /**
   * Maps database result to domain entity
   * @param prismaResult - Raw database result
   * @returns Mapped AcuerdoPago entity
   */
  private mapToDomain(prismaResult: any): AcuerdoPago {
    return {
      id: prismaResult.id,
      creditoId: prismaResult.creditoId,
      clienteId: prismaResult.clienteId,
      plazosPagar: prismaResult.plazosPagar,
      fechaPago: prismaResult.fechaPago,
      periodicidad: prismaResult.periodicidad,
      comentario: prismaResult.comentario,
      fechaCreacion: prismaResult.fechaCreacion,
      estado: prismaResult.estado,
      saldoCancelacion: prismaResult.saldoCancelacion,
      montoAcuerdoPago: prismaResult.montoAcuerdoPago,
    };
  }
}