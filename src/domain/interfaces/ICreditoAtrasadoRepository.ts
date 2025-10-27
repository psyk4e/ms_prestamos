import { CreditoAtrasado, CreditoAtrasadoFilter } from '../entities/CreditoAtrasado';

export interface ICreditoAtrasadoRepository {
  findByNumCredito(numCredito: number): Promise<CreditoAtrasado | null>;
  findByCliente(cliente: string, notificationType?: 'early' | 'late'): Promise<CreditoAtrasado[]>;
  findByIdentificacion(identificacion: string): Promise<CreditoAtrasado[]>;
  findAll(filter?: CreditoAtrasadoFilter, notificationType?: 'early' | 'late'): Promise<CreditoAtrasado[]>;
  findWithPagination(
    filter?: CreditoAtrasadoFilter,
    notificationType?: 'early' | 'late',
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