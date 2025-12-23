import { AgentRequest, AgentRequestFilter, AgentRequestResponse } from '../entities/AgentRequest';

export interface LoanApplicationUpdateData {
  status?: string;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  approvedBy?: string | null;
  decisionComment?: string | null;
  updatedAt?: Date;
}

export interface CreditEvaluationUpdateData {
  creditDecision: 'APROBADO' | 'RECHAZADO';
  evaluationNotes?: string;
  evaluatedBy?: string;
  updatedAt?: Date;
}

export interface IAgentRequestRepository {
  findMany(filter: AgentRequestFilter): Promise<{ data: AgentRequestResponse[], total: number }>;
  findById(id: string): Promise<AgentRequestResponse | null>;
  findByExternalId(externalId: string): Promise<AgentRequestResponse | null>;
  findByStatus(status: string, page: number, limit: number): Promise<{ data: AgentRequestResponse[], total: number }>;
  countSince(since?: Date): Promise<number>;
  create(data: Partial<AgentRequest>): Promise<AgentRequestResponse>;
  update(id: string, data: Partial<AgentRequest>): Promise<AgentRequestResponse | null>;
  delete(id: string): Promise<boolean>;
  // Loan decision methods
  updateLoanApplication(id: string, data: LoanApplicationUpdateData): Promise<void>;
  updateCreditEvaluation(loanApplicationId: string, data: CreditEvaluationUpdateData): Promise<void>;
}