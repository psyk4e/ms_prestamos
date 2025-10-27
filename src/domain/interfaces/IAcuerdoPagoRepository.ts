import { AcuerdoPago, AcuerdoPagoFilter } from '../entities/AcuerdoPago';

/**
 * Repository interface for payment agreement operations
 */
export interface IAcuerdoPagoRepository {
  /**
   * Saves a new payment agreement to the database
   * @param acuerdoPago - Payment agreement data to save
   * @returns Promise resolving to the saved payment agreement with generated ID
   */
  save(acuerdoPago: AcuerdoPago): Promise<AcuerdoPago>;

  /**
   * Finds a payment agreement by its ID
   * @param id - Payment agreement ID
   * @returns Promise resolving to the payment agreement or null if not found
   */
  findById(id: number): Promise<AcuerdoPago | null>;

  /**
   * Finds payment agreements by credit ID
   * @param creditoId - Credit ID to search for
   * @returns Promise resolving to an array of payment agreements
   */
  findByCreditoId(creditoId: number): Promise<AcuerdoPago[]>;

  /**
   * Finds payment agreements by client ID
   * @param clienteId - Client ID to search for
   * @returns Promise resolving to an array of payment agreements
   */
  findByClienteId(clienteId: string): Promise<AcuerdoPago[]>;

  /**
   * Finds all payment agreements with optional filtering
   * @param filter - Optional filter criteria
   * @returns Promise resolving to an array of payment agreements
   */
  findAll(filter?: AcuerdoPagoFilter): Promise<AcuerdoPago[]>;
}