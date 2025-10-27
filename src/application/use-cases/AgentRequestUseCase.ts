import { IAgentRequestRepository } from '../../domain/interfaces/IAgentRequestRepository';
import { AgentRequest, AgentRequestFilter, AgentRequestResponse } from '../../domain/entities/AgentRequest';
import { logger } from '../../infrastructure/services/CustomLogger';

export class AgentRequestUseCase {
  constructor(private readonly agentRequestRepository: IAgentRequestRepository) { }

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
}