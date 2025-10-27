import { IAcuerdoPagoRepository } from '../../domain/interfaces/IAcuerdoPagoRepository';
import { AcuerdoPago, AcuerdoPagoResponse } from '../../domain/entities/AcuerdoPago';

/**
 * Use case for payment agreement operations
 */
export class AcuerdoPagoUseCase {
  constructor(private acuerdoPagoRepository: IAcuerdoPagoRepository) { }

  /**
   * Creates a new payment agreement with business validation
   * @param acuerdoPagoData - Payment agreement data
   * @returns Promise resolving to operation result
   */
  async createAcuerdoPago(acuerdoPagoData: AcuerdoPago): Promise<AcuerdoPagoResponse> {
    try {

      // Check if there's already an active agreement for this credit
      const existingAgreements = await this.acuerdoPagoRepository.findByCreditoId(acuerdoPagoData.creditoId);
      const activeAgreement = existingAgreements.find(agreement => agreement.estado === 'A');

      if (activeAgreement) {
        return {
          success: false,
          message: 'Ya existe un acuerdo de pago activo para este crédito',
          error: 'ACTIVE_AGREEMENT_EXISTS'
        };
      }

      // Save the payment agreement
      const savedAcuerdo = await this.acuerdoPagoRepository.save(acuerdoPagoData);

      return {
        success: true,
        message: 'Acuerdo de pago creado exitosamente',
        data: savedAcuerdo
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Retrieves payment agreements by credit ID
   * @param creditoId - Credit ID
   * @returns Promise resolving to operation result
   */
  async getAcuerdosByCreditoId(creditoId: number): Promise<AcuerdoPagoResponse> {
    try {
      const acuerdos = await this.acuerdoPagoRepository.findByCreditoId(creditoId);

      return {
        success: true,
        message: 'Acuerdos de pago obtenidos exitosamente',
        data: acuerdos as any // Type assertion for array response
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener acuerdos de pago',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Retrieves payment agreements by client ID
   * @param clienteId - Client ID
   * @returns Promise resolving to operation result
   */
  async getAcuerdosByClienteId(clienteId: string): Promise<AcuerdoPagoResponse> {
    try {
      const acuerdos = await this.acuerdoPagoRepository.findByClienteId(clienteId);

      return {
        success: true,
        message: 'Acuerdos de pago obtenidos exitosamente',
        data: acuerdos as any // Type assertion for array response
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener acuerdos de pago',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}