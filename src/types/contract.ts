import { Transaction, Networks } from "@stellar/stellar-sdk";

/**
 * Contract interaction types for Soroban smart contracts
 */

export interface ContractConfig {
  network: Networks;
  rpcUrl: string;
  horizonUrl: string;
  contractId: string;
}

export interface UnsignedTransaction {
  transaction: Transaction;
  networkPassphrase: string;
  contractId: string;
  operation: string;
  parameters?: any[];
  metadata?: {
    description?: string;
    estimatedFee?: string;
    timestamp?: string;
  };
}

export interface SignedTransaction {
  transaction: Transaction;
  signatures: string[];
  networkPassphrase: string;
  contractId: string;
  operation: string;
  parameters?: any[];
  metadata?: {
    description?: string;
    estimatedFee?: string;
    timestamp?: string;
    signedAt?: string;
  };
}

export interface TransactionMergeRequest {
  transactions: UnsignedTransaction[];
  mergeStrategy?: "sequential" | "parallel";
  metadata?: {
    description?: string;
    estimatedTotalFee?: string;
  };
}

export interface MergedTransaction {
  transaction: Transaction;
  networkPassphrase: string;
  operations: Array<{
    contractId: string;
    operation: string;
    parameters?: any[];
  }>;
  metadata?: {
    description?: string;
    estimatedTotalFee?: string;
    mergedAt?: string;
    originalTransactionCount: number;
  };
}

export interface ContractOperation {
  contractId: string;
  method: string;
  parameters: any[];
  sourceAccount?: string;
  fee?: string;
  memo?: string;
}

export interface ContractCallResult {
  success: boolean;
  result?: any;
  error?: string;
  transactionHash?: string;
  cost?: {
    cpuInstructions: number;
    memoryBytes: number;
    fee: string;
  };
}

export interface ContractDeployResult {
  success: boolean;
  contractId?: string;
  transactionHash?: string;
  error?: string;
  cost?: {
    cpuInstructions: number;
    memoryBytes: number;
    fee: string;
  };
}

export interface NetworkInfo {
  network: Networks;
  networkPassphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  chainId: string;
}

export interface AccountInfo {
  accountId: string;
  sequence: string;
  balance: string;
  subentryCount: number;
  flags: {
    authRequired: boolean;
    authRevocable: boolean;
    authImmutable: boolean;
    authClawbackEnabled: boolean;
  };
}

export interface ContractInfo {
  contractId: string;
  address: string;
  network: Networks;
  deployedAt?: string;
  lastUpdated?: string;
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    author?: string;
  };
}

export interface TransactionSimulation {
  success: boolean;
  result?: any;
  error?: string;
  cost?: {
    cpuInstructions: number;
    memoryBytes: number;
    fee: string;
  };
  events?: Array<{
    type: string;
    data: any;
  }>;
}

export interface ContractServiceConfig {
  defaultNetwork: Networks;
  networks: {
    [key: string]: NetworkInfo;
  };
  defaultFee: string;
  maxRetries: number;
  retryDelay: number;
}

// Boundless Contract Entity Types
export enum EntityType {
  CAMPAIGN = 0,
  GRANT = 1,
  HACKATHON = 2,
}

// Boundless Contract Status Types
export enum Status {
  DRAFT = 0,
  ACTIVE = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  PAUSED = 4,
}

// Boundless Contract Milestone Status
export enum MilestoneStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
  DISPUTED = 3,
  RELEASED = 4,
}

// Contract Management Methods
export type ContractManagementMethod =
  | "initialize"
  | "upgrade"
  | "get_admin"
  | "get_version";

// Campaign Management Methods
export type CampaignManagementMethod =
  | "create_campaign"
  | "fund_campaign"
  | "release_funds"
  | "get_campaign"
  | "complete_campaign"
  | "cancel_campaign"
  | "update_campaign_status"
  | "get_campaign_backers";

// Grant Management Methods
export type GrantManagementMethod =
  | "create_grant"
  | "apply_to_grant"
  | "get_grant"
  | "complete_grant"
  | "cancel_grant"
  | "select_grant_winners"
  | "get_grant_applications"
  | "get_grant_winners"
  | "update_grant_status";

// Hackathon Management Methods
export type HackathonManagementMethod =
  | "create_hackathon"
  | "submit_hackathon_entry"
  | "get_hackathon"
  | "complete_hackathon"
  | "cancel_hackathon"
  | "judge_hackathon_entry"
  | "select_hackathon_winners"
  | "get_hackathon_entries"
  | "get_hackathon_winners"
  | "update_hackathon_status"
  | "add_hackathon_judge"
  | "remove_hackathon_judge"
  | "get_hackathon_judges";

// Milestone Management Methods
export type MilestoneManagementMethod =
  | "release_milestone"
  | "update_milestone"
  | "approve_milestone"
  | "reject_milestone"
  | "raise_dispute"
  | "create_milestone"
  | "get_milestone"
  | "get_entity_milestones";

// Escrow Management Methods
export type EscrowManagementMethod =
  | "link_escrow"
  | "get_escrow_contract"
  | "validate_escrow_contract";

// Combined Contract Method Type
export type ContractMethod =
  | ContractManagementMethod
  | CampaignManagementMethod
  | GrantManagementMethod
  | HackathonManagementMethod
  | MilestoneManagementMethod
  | EscrowManagementMethod;

export interface ContractMethodConfig {
  method: ContractMethod;
  parameters: any[];
  description?: string;
  requiresAuth?: boolean;
  estimatedFee?: string;
}

// Boundless Contract Data Types
export interface Milestone {
  id: number;
  description: string;
  amount: string; // i128 as string
  status: MilestoneStatus;
  created_at: number;
  updated_at: number;
}

export interface Campaign {
  id: number;
  owner: string; // Address
  title: string;
  description: string;
  goal: string; // i128 as string
  raised: string; // i128 as string
  status: Status;
  escrow_contract_id: string; // Address
  milestones: Milestone[];
  created_at: number;
  updated_at: number;
}

export interface Grant {
  id: number;
  sponsor: string; // Address
  title: string;
  description: string;
  pool: string; // i128 as string
  winners: number;
  status: Status;
  applications: string[]; // Vec<Symbol>
  winners_list: string[]; // Vec<Address>
  created_at: number;
  updated_at: number;
}

export interface Hackathon {
  id: number;
  organizer: string; // Address
  title: string;
  description: string;
  theme: string;
  prize_pool: string; // i128 as string
  status: Status;
  entries: string[]; // Vec<Symbol>
  winners: string[]; // Vec<Address>
  judges: Judge[];
  created_at: number;
  updated_at: number;
}

export interface Judge {
  address: string; // Address
  name: string;
  added_at: number;
}

export interface Backer {
  address: string; // Address
  amount: string; // i128 as string
  backed_at: number;
}

// Boundless Contract Method Parameters
export interface CreateCampaignParams {
  owner: string; // Address
  title: string; // Symbol
  description: string; // Symbol
  goal: string; // i128 as string
  escrow_contract_id: string; // Address
  milestones: Milestone[];
}

export interface FundCampaignParams {
  campaign_id: number;
  backer: string; // Address
  amount: string; // i128 as string
}

export interface CreateGrantParams {
  sponsor: string; // Address
  title: string; // Symbol
  description: string; // Symbol
  pool: string; // i128 as string
  winners: number;
}

export interface CreateHackathonParams {
  organizer: string; // Address
  title: string; // Symbol
  description: string; // Symbol
  theme: string; // Symbol
  prize_pool: string; // i128 as string
}

export interface CreateMilestoneParams {
  entity_id: number;
  entity_type: EntityType;
  description: string; // Symbol
  amount: string; // i128 as string
}

export interface ReleaseMilestoneParams {
  entity_id: number;
  entity_type: EntityType;
  milestone_id: number;
}

export interface UpdateMilestoneParams {
  entity_id: number;
  entity_type: EntityType;
  milestone_id: number;
  status: MilestoneStatus;
}

export interface ApproveMilestoneParams {
  entity_id: number;
  entity_type: EntityType;
  milestone_id: number;
  approver: string; // Address
}

export interface RejectMilestoneParams {
  entity_id: number;
  entity_type: EntityType;
  milestone_id: number;
  rejector: string; // Address
}

export interface RaiseDisputeParams {
  entity_id: number;
  entity_type: EntityType;
  milestone_id: number;
  reason: string; // Symbol
}
