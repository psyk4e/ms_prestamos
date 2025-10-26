export interface AgentRequest {
  id: string;
  externalId: string;
  status: string;
  personalData?: string;
  documents?: string;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface AgentRequestResponse {
  id: string;
  externalId: string;
  status: string;
  userId?: string;
  personalData?: any;
  documents?: any;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface AgentRequestFilter {
  status?: string;
  page: number;
  limit: number;
  since?: Date;
  faseActual?: string;
}

export interface AgentRequestDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedAt: Date;
}

export interface AgentRequestPersonalData {
  nombre?: string;
  apellido?: string;
  cedula?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  estadoCivil?: string;
  conyugeNombre?: string;
  conyugeIdentificacion?: string;
  conyugeTipoDocumento?: string;
  conyugeTelefono?: string;
}

export interface AgentRequestMetadata {
  dataQualityScore?: number;
  validationErrors?: string[];
  processingTime?: number;
  source?: string;
  version?: string;
}