import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Networks } from "@stellar/stellar-sdk";

export interface SorobanNetworkConfig {
  networkPassphrase: string;
  networkUrl: string;
  contractId?: string;
}

// Default to testnet if not specified
const getNetworkPassphrase = (): string => {
  const network = process.env.STELLAR_NETWORK?.toLowerCase() || "testnet";
  
  switch (network) {
    case "mainnet":
      return Networks.PUBLIC;
    case "testnet":
      return Networks.TESTNET;
    case "futurenet":
      return Networks.FUTURENET;
    default:
      return Networks.TESTNET;
  }
};

// Configure Soroban network settings
export const sorobanConfig: SorobanNetworkConfig = {
  networkPassphrase: getNetworkPassphrase(),
  networkUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  contractId: process.env.FUNDING_CONTRACT_ID,
};

// Define project funding contract WASM hash (example format)
export const PROJECT_FUNDING_CONTRACT_WASM_HASH = process.env.PROJECT_FUNDING_CONTRACT_WASM_HASH || "";

// Transaction timeout in seconds
export const TX_TIMEOUT_SECONDS = Number.parseInt(process.env.TX_TIMEOUT_SECONDS || "30", 10);

// Maximum transaction retries
export const MAX_TX_RETRIES = Number.parseInt(process.env.MAX_TX_RETRIES || "3", 10);

// Server admin key for contract management (should be stored securely in production)
export const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "";

// Gas parameters
export const DEFAULT_FEE = Number.parseInt(process.env.DEFAULT_FEE || "100", 10);
export const DEFAULT_GAS_BUDGET = Number.parseInt(process.env.DEFAULT_GAS_BUDGET || "1000000", 10);

// Export a function to validate configuration
export const validateSorobanConfig = (): boolean => {
  if (!sorobanConfig.networkUrl) {
    console.error("Error: Missing STELLAR_RPC_URL in environment variables");
    return false;
  }
  
  if (!ADMIN_SECRET_KEY) {
    console.error("Warning: Missing ADMIN_SECRET_KEY in environment variables");
    // Still return true as this might be acceptable in dev environment
  }
  
  return true;
}; 