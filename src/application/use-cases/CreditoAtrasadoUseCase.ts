import { ICreditoAtrasadoRepository } from '../../domain/interfaces/ICreditoAtrasadoRepository';
import { CreditoAtrasado, CreditoAtrasadoFilter, CreditoAtrasadoResponse } from '../../domain/entities/CreditoAtrasado';
import { logger } from '../../infrastructure/services/CustomLogger';

export class CreditoAtrasadoUseCase {
  constructor(private readonly creditoRepository: ICreditoAtrasadoRepository) { }

  async getCreditoByNumero(numCredito: number): Promise<CreditoAtrasadoResponse | null> {
    const credito = await this.creditoRepository.findByNumCredito(numCredito);

    if (!credito) {
      return null;
    }

    return this.mapToResponse(credito);
  }

  /**
   * Retrieves credits by client code with optional notification type filtering
   * @param cliente - Client code
   * @param notificationType - Type of notification scenario to filter by:
   *   - 'early': Credits with 1-2 overdue installments (3 days before payment reminder)
   *   - 'late': Credits with 3+ overdue installments (weekly reminders on Mon/Fri)
   *   - undefined: All credits without filtering by overdue installments
   * @returns Promise resolving to an array of credit responses with quota ranges
   */
  async getCreditosByCliente(cliente: string, notificationType?: 'early' | 'late'): Promise<CreditoAtrasadoResponse[]> {
    const creditos = await this.creditoRepository.findByCliente(cliente, notificationType);
    if (!creditos) {
      return [];
    }

    return creditos.map(credito => this.mapToResponseWithCuotas(credito));
  }

  /**
   * Retrieves credits by client identification number with quota calculation
   * @param identificacion - Client identification number
   * @returns Promise resolving to an array of credit responses with quota ranges
   */
  async getCreditosByIdentificacion(identificacion: string): Promise<CreditoAtrasadoResponse[]> {
    const creditos = await this.creditoRepository.findByIdentificacion(identificacion);
    if (!creditos) {
      return [];
    }

    return creditos.map(credito => this.mapToResponseWithCuotas(credito));
  }

  /**
   * Retrieves all overdue credits with optional filtering for different notification scenarios
   * @param filter - Optional filter criteria for credits
   * @param notificationType - Type of notification scenario to filter by:
   *   - 'early': Credits with 1-2 overdue installments (3 days before payment reminder)
   *   - 'late': Credits with 3+ overdue installments (weekly reminders on Mon/Fri)
   *   - undefined: All credits without filtering by overdue installments
   * @returns Promise resolving to an array of credit responses
   * @example
   * // Get credits for early notification (1-2 overdue installments)
   * const earlyCredits = await getAllCreditos(filter, 'early');
   * 
   * // Get credits for late notification (3+ overdue installments)
   * const lateCredits = await getAllCreditos(filter, 'late');
   */
  async getAllCreditos(
    filter?: CreditoAtrasadoFilter,
    notificationType?: 'early' | 'late'
  ): Promise<CreditoAtrasadoResponse[]> {
    try {
      const creditos = await this.creditoRepository.findAll(filter, notificationType);
      await logger.info('Retrieved all overdue credits', {
        creditCount: creditos?.length || 0,
        operation: 'getAllCreditos',
        notificationType,
        filter
      });

      if (!creditos) {
        return [];
      }

      return creditos.map(credito => this.mapToResponse(credito));
    } catch (error) {
      await logger.error('Error retrieving all overdue credits', error as Error);
      throw new Error(`Failed to retrieve all overdue credits: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves overdue credits with pagination and optional notification type filtering
   * @param filter - Optional filter criteria for credits
   * @param page - Page number for pagination (default: 1)
   * @param limit - Number of items per page (default: 10)
   * @param notificationType - Type of notification scenario to filter by:
   *   - 'early': Credits with 1-2 overdue installments (3 days before payment reminder)
   *   - 'late': Credits with 3+ overdue installments (weekly reminders on Mon/Fri)
   *   - undefined: All credits without filtering by overdue installments
   * @returns Promise resolving to paginated credit responses
   * @example
   * // Get paginated credits for early notification
   * const earlyCredits = await getCreditosWithPagination(filter, 1, 10, 'early');
   */
  async getCreditosWithPagination(
    filter?: CreditoAtrasadoFilter,
    page: number = 1,
    limit: number = 10,
    notificationType?: 'early' | 'late'
  ) {

    const result = await this.creditoRepository.findWithPagination(filter, notificationType, page, limit);
    return {
      ...result,
      data: result?.data?.map(credito => this.mapToResponse(credito)) || []
    };
  }

  /**
   * Calculates the dynamic range of possible quotas for a payment agreement
   * based on client data.
   * 
   * @param {CreditoAtrasado} credito - Credit object with client data
   * @param {number} montoMinimoCuota - Minimum accepted amount per quota (default: 500)
   * @returns {Object} - { minCuotas, maxCuotas }
   */
  private calcularRangoCuotasDinamico(credito: CreditoAtrasado, montoMinimoCuota: number = 500): { minCuotas: number; maxCuotas: number } {
    const montoBase = credito.ponerseAlDia;
    let minCuotas = 1;
    let maxCuotas = 1;

    // MontoBase -> Total Adeudado por el cliente
    // periodicidad -> semanal, quincenal o mensual
    // CuotasPagos -> Cantidad de cuotas en base al MontoBase y la periodicidad
    // 

    // Initial range based on amount
    if (montoBase < 10000) {
      minCuotas = 1;
      maxCuotas = 6;
    } else if (montoBase >= 10000 && montoBase <= 50000) {
      minCuotas = 3;
      maxCuotas = 12;
    } else if (montoBase > 50000 && montoBase <= 200000) {
      minCuotas = 6;
      maxCuotas = 24;
    } else if (montoBase > 200000) {
      minCuotas = 12;
      maxCuotas = 36;
    } // DEMO????
    //TODO como escalar esta parte tomando en cuando los diferentes clientes.

    // Adjust maximum if the resulting quota would be too small
    while (montoBase / maxCuotas < montoMinimoCuota && maxCuotas > minCuotas) {
      maxCuotas--;
    }

    return {
      minCuotas,
      maxCuotas
    };
  }

  /**
   * Base mapping method that creates the core CreditoAtrasadoResponse structure
   * @param credito - The credit data to map
   * @returns Base CreditoAtrasadoResponse without optional fields
   */
  private mapToResponse(credito: CreditoAtrasado): CreditoAtrasadoResponse {
    return {
      creditoId: credito.creditoId,
      clienteId: credito.clienteId,
      nombre: credito.nombre,
      cuotasVencidas: credito.cuotasVencidas,
      concepto: credito.concepto,
      desde: credito.desde,
      ponerseAlDia: credito.ponerseAlDia,
      phoneNumber: credito.phoneNumber,
      saldoCancelacion: credito.saldoCancelacion,
    };
  }

  /**
   * Enhanced mapping method that includes quota calculation
   * Used specifically for client quota responses
   * @param credito - The credit data to map
   * @returns CreditoAtrasadoResponse with quota range included
   */
  private mapToResponseWithCuotas(credito: CreditoAtrasado): CreditoAtrasadoResponse {
    const baseResponse = this.mapToResponse(credito);
    const rangoCuotas = this.calcularRangoCuotasDinamico(credito);

    return {
      ...baseResponse,
      cuotas: {
        min: rangoCuotas.minCuotas,
        max: rangoCuotas.maxCuotas,
        cantidad: credito.cuotas,
      }
    };
  }
}