/**
 * Boundless Contract Constants
 *
 * This file contains all the constants used in the Boundless smart contract
 * including entity types, status enums, and common values.
 */

import { Networks } from "@stellar/stellar-sdk";

// ============================================================================
// ENTITY TYPES
// ============================================================================

export const ENTITY_TYPES = {
  CAMPAIGN: 0,
  GRANT: 1,
  HACKATHON: 2,
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// ============================================================================
// STATUS ENUMS
// ============================================================================

export const STATUS = {
  DRAFT: 0,
  ACTIVE: 1,
  COMPLETED: 2,
  CANCELLED: 3,
  PAUSED: 4,
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

// ============================================================================
// MILESTONE STATUS
// ============================================================================

export const MILESTONE_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  DISPUTED: 3,
  RELEASED: 4,
} as const;

export type MilestoneStatus =
  (typeof MILESTONE_STATUS)[keyof typeof MILESTONE_STATUS];

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

export const NETWORKS = {
  TESTNET: Networks.TESTNET,
  MAINNET: Networks.PUBLIC,
  FUTURENET: Networks.FUTURENET,
  SANDBOX: Networks.SANDBOX,
} as const;

export const NETWORK_CONFIGS = {
  [Networks.TESTNET]: {
    name: "Testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    chainId: "testnet",
  },
  [Networks.PUBLIC]: {
    name: "Mainnet",
    rpcUrl: "https://soroban-mainnet.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    chainId: "mainnet",
  },
  [Networks.FUTURENET]: {
    name: "Futurenet",
    rpcUrl: "https://soroban-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    networkPassphrase: "Test SDF Future Network ; October 2022",
    chainId: "futurenet",
  },
  [Networks.SANDBOX]: {
    name: "Sandbox",
    rpcUrl: "https://soroban-sandbox.stellar.org",
    horizonUrl: "https://horizon-sandbox.stellar.org",
    networkPassphrase: "Local Sandbox Stellar Network ; September 2022",
    chainId: "sandbox",
  },
  ["Standalone Network ; February 2017" as any]: {
    name: "Standalone",
    rpcUrl: "http://localhost:8000",
    horizonUrl: "http://localhost:8000",
    networkPassphrase: "Standalone Network ; February 2017",
    chainId: "standalone",
  },
} as const;

// ============================================================================
// CONTRACT METHODS
// ============================================================================

export const CONTRACT_METHODS = {
  // Contract Management
  INITIALIZE: "initialize",
  UPGRADE: "upgrade",
  GET_ADMIN: "get_admin",
  GET_VERSION: "get_version",

  // Campaign Management
  CREATE_CAMPAIGN: "create_campaign",
  FUND_CAMPAIGN: "fund_campaign",
  RELEASE_FUNDS: "release_funds",
  GET_CAMPAIGN: "get_campaign",
  COMPLETE_CAMPAIGN: "complete_campaign",
  CANCEL_CAMPAIGN: "cancel_campaign",
  UPDATE_CAMPAIGN_STATUS: "update_campaign_status",
  GET_CAMPAIGN_BACKERS: "get_campaign_backers",

  // Grant Management
  CREATE_GRANT: "create_grant",
  APPLY_TO_GRANT: "apply_to_grant",
  GET_GRANT: "get_grant",
  COMPLETE_GRANT: "complete_grant",
  CANCEL_GRANT: "cancel_grant",
  SELECT_GRANT_WINNERS: "select_grant_winners",
  GET_GRANT_APPLICATIONS: "get_grant_applications",
  GET_GRANT_WINNERS: "get_grant_winners",
  UPDATE_GRANT_STATUS: "update_grant_status",

  // Hackathon Management
  CREATE_HACKATHON: "create_hackathon",
  SUBMIT_HACKATHON_ENTRY: "submit_hackathon_entry",
  GET_HACKATHON: "get_hackathon",
  COMPLETE_HACKATHON: "complete_hackathon",
  CANCEL_HACKATHON: "cancel_hackathon",
  JUDGE_HACKATHON_ENTRY: "judge_hackathon_entry",
  SELECT_HACKATHON_WINNERS: "select_hackathon_winners",
  GET_HACKATHON_ENTRIES: "get_hackathon_entries",
  GET_HACKATHON_WINNERS: "get_hackathon_winners",
  UPDATE_HACKATHON_STATUS: "update_hackathon_status",
  ADD_HACKATHON_JUDGE: "add_hackathon_judge",
  REMOVE_HACKATHON_JUDGE: "remove_hackathon_judge",
  GET_HACKATHON_JUDGES: "get_hackathon_judges",

  // Milestone Management
  RELEASE_MILESTONE: "release_milestone",
  UPDATE_MILESTONE: "update_milestone",
  APPROVE_MILESTONE: "approve_milestone",
  REJECT_MILESTONE: "reject_milestone",
  RAISE_DISPUTE: "raise_dispute",
  CREATE_MILESTONE: "create_milestone",
  GET_MILESTONE: "get_milestone",
  GET_ENTITY_MILESTONES: "get_entity_milestones",

  // Escrow Management
  LINK_ESCROW: "link_escrow",
  GET_ESCROW_CONTRACT: "get_escrow_contract",
  VALIDATE_ESCROW_CONTRACT: "validate_escrow_contract",
} as const;

// ============================================================================
// COMMON VALUES
// ============================================================================

export const COMMON_VALUES = {
  // Fee values (in stroops)
  DEFAULT_FEE: "100",
  HIGH_FEE: "1000",
  LOW_FEE: "50",

  // Time values (in seconds)
  ONE_MINUTE: 60,
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
  ONE_MONTH: 2592000,

  // Amount values (in stroops)
  MIN_AMOUNT: "1000", // 0.00001 XLM
  MAX_AMOUNT: "9223372036854775807", // Max i128 value

  // Limits
  MAX_MILESTONES_PER_CAMPAIGN: 50,
  MAX_GRANT_WINNERS: 100,
  MAX_HACKATHON_JUDGES: 20,
  MAX_HACKATHON_ENTRIES: 1000,
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // General errors
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_PARAMETERS: "INVALID_PARAMETERS",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Campaign errors
  CAMPAIGN_NOT_FOUND: "CAMPAIGN_NOT_FOUND",
  CAMPAIGN_ALREADY_EXISTS: "CAMPAIGN_ALREADY_EXISTS",
  CAMPAIGN_GOAL_REACHED: "CAMPAIGN_GOAL_REACHED",
  CAMPAIGN_NOT_ACTIVE: "CAMPAIGN_NOT_ACTIVE",
  INSUFFICIENT_CAMPAIGN_FUNDS: "INSUFFICIENT_CAMPAIGN_FUNDS",

  // Grant errors
  GRANT_NOT_FOUND: "GRANT_NOT_FOUND",
  GRANT_ALREADY_EXISTS: "GRANT_ALREADY_EXISTS",
  GRANT_NOT_ACTIVE: "GRANT_NOT_ACTIVE",
  ALREADY_APPLIED_TO_GRANT: "ALREADY_APPLIED_TO_GRANT",
  INSUFFICIENT_GRANT_POOL: "INSUFFICIENT_GRANT_POOL",

  // Hackathon errors
  HACKATHON_NOT_FOUND: "HACKATHON_NOT_FOUND",
  HACKATHON_ALREADY_EXISTS: "HACKATHON_ALREADY_EXISTS",
  HACKATHON_NOT_ACTIVE: "HACKATHON_NOT_ACTIVE",
  ALREADY_SUBMITTED_ENTRY: "ALREADY_SUBMITTED_ENTRY",
  JUDGE_NOT_FOUND: "JUDGE_NOT_FOUND",
  JUDGE_ALREADY_EXISTS: "JUDGE_ALREADY_EXISTS",

  // Milestone errors
  MILESTONE_NOT_FOUND: "MILESTONE_NOT_FOUND",
  MILESTONE_ALREADY_EXISTS: "MILESTONE_ALREADY_EXISTS",
  MILESTONE_NOT_PENDING: "MILESTONE_NOT_PENDING",
  MILESTONE_ALREADY_APPROVED: "MILESTONE_ALREADY_APPROVED",
  MILESTONE_ALREADY_REJECTED: "MILESTONE_ALREADY_REJECTED",
  MILESTONE_ALREADY_RELEASED: "MILESTONE_ALREADY_RELEASED",

  // Escrow errors
  ESCROW_CONTRACT_NOT_FOUND: "ESCROW_CONTRACT_NOT_FOUND",
  ESCROW_CONTRACT_INVALID: "ESCROW_CONTRACT_INVALID",
  ESCROW_ALREADY_LINKED: "ESCROW_ALREADY_LINKED",
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get entity type name from value
 */
export function getEntityTypeName(entityType: EntityType): string {
  const typeMap = {
    [ENTITY_TYPES.CAMPAIGN]: "Campaign",
    [ENTITY_TYPES.GRANT]: "Grant",
    [ENTITY_TYPES.HACKATHON]: "Hackathon",
  };
  return typeMap[entityType] || "Unknown";
}

/**
 * Get status name from value
 */
export function getStatusName(status: Status): string {
  const statusMap = {
    [STATUS.DRAFT]: "Draft",
    [STATUS.ACTIVE]: "Active",
    [STATUS.COMPLETED]: "Completed",
    [STATUS.CANCELLED]: "Cancelled",
    [STATUS.PAUSED]: "Paused",
  };
  return statusMap[status] || "Unknown";
}

/**
 * Get milestone status name from value
 */
export function getMilestoneStatusName(status: MilestoneStatus): string {
  const statusMap = {
    [MILESTONE_STATUS.PENDING]: "Pending",
    [MILESTONE_STATUS.APPROVED]: "Approved",
    [MILESTONE_STATUS.REJECTED]: "Rejected",
    [MILESTONE_STATUS.DISPUTED]: "Disputed",
    [MILESTONE_STATUS.RELEASED]: "Released",
  };
  return statusMap[status] || "Unknown";
}

/**
 * Get network name from Networks enum
 */
export function getNetworkName(network: Networks): string {
  return (NETWORK_CONFIGS as any)[network]?.name || "Unknown";
}

/**
 * Validate entity type
 */
export function isValidEntityType(
  entityType: number,
): entityType is EntityType {
  return Object.values(ENTITY_TYPES).includes(entityType as EntityType);
}

/**
 * Validate status
 */
export function isValidStatus(status: number): status is Status {
  return Object.values(STATUS).includes(status as Status);
}

/**
 * Validate milestone status
 */
export function isValidMilestoneStatus(
  status: number,
): status is MilestoneStatus {
  return Object.values(MILESTONE_STATUS).includes(status as MilestoneStatus);
}

/**
 * Convert stroops to XLM
 */
export function stroopsToXLM(stroops: string): number {
  return parseInt(stroops) / 10000000;
}

/**
 * Convert XLM to stroops
 */
export function xlmToStroops(xlm: number): string {
  return Math.floor(xlm * 10000000).toString();
}

/**
 * Format amount for display
 */
export function formatAmount(amount: string, decimals: number = 7): string {
  const num = parseInt(amount);
  const xlm = num / Math.pow(10, decimals);
  return xlm.toFixed(decimals);
}

/**
 * Get default fee for network
 */
export function getDefaultFee(network: Networks): string {
  // Different networks might have different fee requirements
  switch (network) {
    case Networks.PUBLIC:
      return COMMON_VALUES.DEFAULT_FEE;
    case Networks.TESTNET:
      return COMMON_VALUES.LOW_FEE;
    case Networks.FUTURENET:
      return COMMON_VALUES.LOW_FEE;
    case Networks.SANDBOX:
      return COMMON_VALUES.LOW_FEE;
    default:
      return COMMON_VALUES.DEFAULT_FEE;
  }
}

/**
 * Check if address is valid Stellar address
 */
export function isValidStellarAddress(address: string): boolean {
  // Basic Stellar address validation
  return /^G[A-Z0-9]{55}$/.test(address);
}

/**
 * Check if contract ID is valid
 */
export function isValidContractId(contractId: string): boolean {
  // Basic contract ID validation
  return /^C[A-Z0-9]{55}$/.test(contractId);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ENTITY_TYPES,
  STATUS,
  MILESTONE_STATUS,
  NETWORKS,
  NETWORK_CONFIGS,
  CONTRACT_METHODS,
  COMMON_VALUES,
  ERROR_CODES,
  getEntityTypeName,
  getStatusName,
  getMilestoneStatusName,
  getNetworkName,
  isValidEntityType,
  isValidStatus,
  isValidMilestoneStatus,
  stroopsToXLM,
  xlmToStroops,
  formatAmount,
  getDefaultFee,
  isValidStellarAddress,
  isValidContractId,
};
