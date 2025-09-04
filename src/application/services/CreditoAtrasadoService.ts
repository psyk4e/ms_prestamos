import { ICreditoAtrasadoRepository } from '../../domain/interfaces/ICreditoAtrasadoRepository';
import { CreditoAtrasado, CreditoAtrasadoFilter, CreditoAtrasadoResponse } from '../../domain/entities/CreditoAtrasado';

export class CreditoAtrasadoService {
  constructor(private readonly creditoRepository: ICreditoAtrasadoRepository) { }

  async getCreditoByNumero(numCredito: number): Promise<CreditoAtrasadoResponse | null> {
    const credito = await this.creditoRepository.findByNumCredito(numCredito);

    if (!credito) {
      return null;
    }

    return this.mapToResponse(credito);
  }

  async getCreditosByCliente(cliente: string): Promise<CreditoAtrasadoResponse[]> {
    const creditos = await this.creditoRepository.findByCliente(cliente);
    return creditos.map(credito => this.mapToResponse(credito));
  }

  async getAllCreditos(filter?: CreditoAtrasadoFilter): Promise<CreditoAtrasadoResponse[]> {
    const creditos = await this.creditoRepository.findAll(filter);
    return creditos.map(credito => this.mapToResponse(credito));
  }

  async getCreditosWithPagination(
    filter?: CreditoAtrasadoFilter,
    page: number = 1,
    limit: number = 10
  ) {
    const result = await this.creditoRepository.findWithPagination(filter, page, limit);

    return {
      ...result,
      data: result?.data?.map(credito => this.mapToResponse(credito))
    };
  }

  private mapToResponse(credito: CreditoAtrasado): CreditoAtrasadoResponse {
    return {
      creditoId: credito.creditoId,
      clienteId: credito.clienteId,
      cliente: credito.cliente,
      cuotasVencidas: credito.cuotasVencidas,
      concepto: credito.concepto,
      desde: credito.desde,
      ponerseAlDia: credito.ponerseAlDia
    };
  }
}