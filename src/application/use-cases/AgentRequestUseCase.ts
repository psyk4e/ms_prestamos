import { IAgentRequestRepository, LoanApplicationUpdateData } from '../../domain/interfaces/IAgentRequestRepository';
import { AgentRequest, AgentRequestFilter, AgentRequestResponse } from '../../domain/entities/AgentRequest';
import { logger } from '../../infrastructure/services/CustomLogger';
import { WhatsAppMessageService } from '../../infrastructure/services/WhatsAppMessageService';
import { N8nWebhookService } from '../../infrastructure/services/N8nWebhookService';

export interface LoanDecisionRequest {
  loanApplicationId: string;
  approved: boolean;
  comentario?: string;
  approvedBy?: string;
}

export interface LoanDecisionResponse {
  success: boolean;
  message: string;
  data?: {
    loanApplicationId: string;
    trackingNumber: number;
    status: string;
    decision: 'APROBADO' | 'RECHAZADO';
  };
  error?: string;
}

export class AgentRequestUseCase {
  constructor(
    private readonly agentRequestRepository: IAgentRequestRepository,
    private readonly n8nWebhookService: N8nWebhookService
  ) { }

  async getAgentRequests(filter: AgentRequestFilter): Promise<{ data: AgentRequestResponse[], total: number }> {
    try {
      logger.info(`Getting agent requests with filter: ${JSON.stringify(filter)}`);

      const result = await this.agentRequestRepository.findMany(filter);

      logger.info(`Found ${result.data.length} agent requests out of ${result.total} total`);
      return result;
    } catch (error) {
      logger.error('Error getting agent requests:', error as Error);
      throw error;
    }
  }

  async getAgentRequestById(id: string): Promise<AgentRequestResponse | null> {
    try {
      logger.info(`Getting agent request by ID: ${id}`);

      const agentRequest = await this.agentRequestRepository.findById(id);

      if (agentRequest) {
        logger.info(`Found agent request: ${agentRequest.id}`);
      } else {
        logger.warn(`Agent request not found: ${id}`);
      }

      return agentRequest;
    } catch (error) {
      logger.error(`Error getting agent request by ID ${id}:`, error as Error);
      throw error;
    }
  }

  async getAgentRequestsByStatus(status: string, page: number, limit: number): Promise<{ data: AgentRequestResponse[], total: number }> {
    try {
      logger.info(`Getting agent requests by status: ${status}, page: ${page}, limit: ${limit}`);

      const result = await this.agentRequestRepository.findByStatus(status, page, limit);

      logger.info(`Found ${result.data.length} agent requests with status ${status}`);
      return result;
    } catch (error) {
      logger.error(`Error getting agent requests by status ${status}:`, error as Error);
      throw error;
    }
  }

  async getAgentRequestDocuments(id: string): Promise<any[] | null> {
    try {
      logger.info(`Getting documents for agent request: ${id}`);

      const agentRequest = await this.agentRequestRepository.findById(id);

      if (!agentRequest) {
        logger.warn(`Agent request not found for documents: ${id}`);
        return null;
      }

      // Return documents as provided by repository (array or null)
      const documents = Array.isArray(agentRequest.documents) ? agentRequest.documents : [];

      logger.info(`Found ${documents.length} documents for agent request: ${id}`);
      return documents;
    } catch (error) {
      logger.error(`Error getting documents for agent request ${id}:`, error as Error);
      throw error;
    }
  }

  async getAgentRequestsCount(since?: Date): Promise<number> {
    try {
      logger.info(`Getting agent requests count since: ${since}`);

      const count = await this.agentRequestRepository.countSince(since);

      logger.info(`Found ${count} agent requests since ${since}`);
      return count;
    } catch (error) {
      logger.error(`Error getting agent requests count since ${since}:`, error as Error);
      throw error;
    }
  }

  async createAgentRequest(data: Partial<AgentRequest>): Promise<AgentRequestResponse> {
    try {
      logger.info(`Creating new agent request with external ID: ${data.externalId}`);

      const agentRequest = await this.agentRequestRepository.create(data);

      logger.info(`Created agent request: ${agentRequest.id}`);
      return agentRequest;
    } catch (error) {
      logger.error('Error creating agent request:', error as Error);
      throw error;
    }
  }

  async updateAgentRequest(id: string, data: Partial<AgentRequest>): Promise<AgentRequestResponse | null> {
    try {
      logger.info(`Updating agent request: ${id}`);

      const agentRequest = await this.agentRequestRepository.update(id, data);

      if (agentRequest) {
        logger.info(`Updated agent request: ${agentRequest.id}`);
      } else {
        logger.warn(`Agent request not found for update: ${id}`);
      }

      return agentRequest;
    } catch (error) {
      logger.error(`Error updating agent request ${id}:`, error as Error);
      throw error;
    }
  }

  async processLoanDecision(request: LoanDecisionRequest): Promise<LoanDecisionResponse> {
    try {
      logger.info(`Processing loan decision for application: ${request.loanApplicationId}`, {
        approved: request.approved,
        approvedBy: request.approvedBy
      });

      // Get the loan application
      const loanApplication = await this.agentRequestRepository.findById(request.loanApplicationId);

      if (!loanApplication) {
        return {
          success: false,
          message: 'Loan application not found',
          error: 'LOAN_APPLICATION_NOT_FOUND'
        };
      }

      // Check if application is already in a final state
      if (loanApplication.status === 'approved' || loanApplication.status === 'rejected') {
        return {
          success: false,
          message: 'Loan application status cannot be changed',
          error: 'STATUS_IMMUTABLE'
        };
      }

      // Get user data for notification
      const userData = loanApplication.personalData;
      if (!userData) {
        return {
          success: false,
          message: 'User data not found for loan application',
          error: 'USER_DATA_NOT_FOUND'
        };
      }

      const phoneNumber = loanApplication.userId; // ID del usuario de whatsapp canal
      if (!phoneNumber) {
        return {
          success: false,
          message: 'Phone number not found for user',
          error: 'PHONE_NUMBER_NOT_FOUND'
        };
      }

      const decision = request.approved ? 'APROBADO' : 'RECHAZADO';
      const now = new Date();

      // Update loan application
      const loanApplicationUpdate: LoanApplicationUpdateData = {
        status: request.approved ? 'approved' : 'rejected',
        approvedAt: request.approved ? now : null,
        rejectedAt: request.approved ? null : now,
        approvedBy: request.approvedBy || null,
        decisionComment: request.comentario || null,
        updatedAt: now
      };

      await this.agentRequestRepository.updateLoanApplication(request.loanApplicationId, loanApplicationUpdate);

      // Prepare notification payload (without approvedBy)
      const notificationPayload = {
        resultado: request.approved ? 'aprobado' : 'rechazado' as 'aprobado' | 'rechazado',
        loanApplicationId: request.loanApplicationId,
        telefono: phoneNumber,
        email: userData.email,
        nombre: `${userData.nombre || ''} ${userData.apellido || ''}`.trim(),
        montoSolicitado: loanApplication.metadata?.prestamo?.montoSolicitado || 0,
        montoAprobado: request.approved ? (loanApplication.metadata?.prestamo?.montoSolicitado || 0) : undefined,
        comentario: request.comentario,
        trackingNumber: loanApplication.externalId ? parseInt(loanApplication.externalId, 10) : 0,
        mensajeWhatsApp: request.approved
          ? `¡Felicidades! Tu préstamo ha sido aprobado. Monto: $${loanApplication.metadata?.prestamo?.montoSolicitado || 0}`
          : `Lamentamos informarte que tu solicitud de préstamo ha sido rechazada.${request.comentario ? ` Motivo: ${request.comentario}` : ''}`
      };

      // Send notification to N8n (without approvedBy)
      try {
        await this.n8nWebhookService.notifyLoanDecision(notificationPayload);
      } catch (notificationError) {
        logger.error('Error sending notification to N8n', notificationError as Error, {
          loanApplicationId: request.loanApplicationId
        });
        // Don't fail the entire operation if notification fails
      }

      return {
        success: true,
        message: `Loan application ${request.approved ? 'approved' : 'rejected'} successfully`,
        data: {
          loanApplicationId: request.loanApplicationId,
          trackingNumber: loanApplication.externalId ? parseInt(loanApplication.externalId, 10) : 0,
          status: request.approved ? 'approved' : 'rejected',
          decision: decision,
        }
      };
    } catch (error) {
      logger.error('Error processing loan decision', error as Error, {
        loanApplicationId: request.loanApplicationId
      });
      return {
        success: false,
        message: 'Error processing loan decision',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }
}