import { CreditoAtrasado, CreditoAtrasadoFilter } from '../entities/CreditoAtrasado';

export interface ICreditoAtrasadoRepository {
  findByNumCredito(numCredito: number): Promise<CreditoAtrasado | null>;
  findByCliente(cliente: string): Promise<CreditoAtrasado[]>;
  findAll(filter?: CreditoAtrasadoFilter): Promise<CreditoAtrasado[]>;
  findWithPagination(
    filter?: CreditoAtrasadoFilter,
    page?: number,
    limit?: number
  ): Promise<{
    data: CreditoAtrasado[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}