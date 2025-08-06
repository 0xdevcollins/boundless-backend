import axios, { AxiosResponse } from "axios";

export interface TrustlessWorkConfig {
  baseURL: string;
  apiKey: string;
}

export interface TrustlessWorkStakeholders {
  marker: string;
  approver: string;
  releaser: string;
  resolver: string;
  receiver: string;
  platformAddress?: string;
}

export interface TrustlessWorkMilestone {
  description: string;
  amount: number;
  payoutPercentage: number;
}

export interface TrustlessWorkEscrowRequest {
  engagementId: string;
  title: string;
  description: string;
  roles: TrustlessWorkStakeholders;
  platformFee: number;
  trustline: {
    address: string;
    decimals: number;
  };
  receiverMemo?: number;
  milestones?: TrustlessWorkMilestone[];
}

export interface TrustlessWorkEscrowResponse {
  escrowAddress: string;
  xdr: string;
  network: string;
}

export interface TrustlessWorkFundRequest {
  escrowAddress: string;
  amount: number;
}

export interface TrustlessWorkFundResponse {
  xdr: string;
  network: string;
}

export interface TrustlessWorkMilestoneApprovalRequest {
  escrowAddress: string;
  milestoneIndex: number;
}

export interface TrustlessWorkMilestoneStatusRequest {
  escrowAddress: string;
  milestoneIndex: number;
  status: "complete" | "incomplete";
}

export interface TrustlessWorkReleaseRequest {
  escrowAddress: string;
  milestoneIndex?: number; // For multi-release escrows
}

export class TrustlessWorkService {
  private config: TrustlessWorkConfig;

  constructor(config: TrustlessWorkConfig) {
    this.config = config;
  }

  private async makeRequest<T>(
    method: "GET" | "POST",
    endpoint: string,
    data?: any,
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await axios({
        method,
        url: `${this.config.baseURL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        data,
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Trustless Work API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`,
        );
      }
      throw new Error(`Trustless Work API Error: ${error.message}`);
    }
  }

  /**
   * Deploy a multi-release escrow contract
   */
  async deployMultiReleaseEscrow(
    request: TrustlessWorkEscrowRequest,
  ): Promise<TrustlessWorkEscrowResponse> {
    return this.makeRequest<TrustlessWorkEscrowResponse>(
      "POST",
      "/deployer/multi-release",
      request,
    );
  }

  /**
   * Deploy a single-release escrow contract
   */
  async deploySingleReleaseEscrow(
    request: TrustlessWorkEscrowRequest,
  ): Promise<TrustlessWorkEscrowResponse> {
    return this.makeRequest<TrustlessWorkEscrowResponse>(
      "POST",
      "/deployer/single-release",
      request,
    );
  }

  /**
   * Fund an escrow contract
   */
  async fundEscrow(
    type: "single" | "multi",
    request: TrustlessWorkFundRequest,
  ): Promise<TrustlessWorkFundResponse> {
    return this.makeRequest<TrustlessWorkFundResponse>(
      "POST",
      `/escrow/${type}/fund-escrow`,
      request,
    );
  }

  /**
   * Approve a milestone
   */
  async approveMilestone(
    type: "single" | "multi",
    request: TrustlessWorkMilestoneApprovalRequest,
  ): Promise<{ xdr: string }> {
    return this.makeRequest<{ xdr: string }>(
      "POST",
      `/escrow/${type}/approve-milestone`,
      request,
    );
  }

  /**
   * Change milestone status
   */
  async changeMilestoneStatus(
    type: "single" | "multi",
    request: TrustlessWorkMilestoneStatusRequest,
  ): Promise<{ xdr: string }> {
    return this.makeRequest<{ xdr: string }>(
      "POST",
      `/escrow/${type}/change-milestone-status`,
      request,
    );
  }

  /**
   * Release funds from escrow
   */
  async releaseFunds(
    type: "single" | "multi",
    request: TrustlessWorkReleaseRequest,
  ): Promise<{ xdr: string }> {
    return this.makeRequest<{ xdr: string }>(
      "POST",
      `/escrow/${type}/release-funds`,
      request,
    );
  }

  /**
   * Release milestone funds (multi-release only)
   */
  async releaseMilestoneFunds(
    request: TrustlessWorkReleaseRequest,
  ): Promise<{ xdr: string }> {
    return this.makeRequest<{ xdr: string }>(
      "POST",
      "/escrow/multi/release-milestone-funds",
      request,
    );
  }

  /**
   * Get escrow details
   */
  async getEscrow(
    type: "single" | "multi",
    escrowAddress: string,
  ): Promise<any> {
    return this.makeRequest<any>(
      "GET",
      `/escrow/${type}/get-escrow?escrowAddress=${escrowAddress}`,
    );
  }

  /**
   * Submit a signed transaction
   */
  async submitTransaction(xdr: string): Promise<{ hash: string }> {
    return this.makeRequest<{ hash: string }>(
      "POST",
      "/helper/send-transaction",
      { xdr },
    );
  }

  /**
   * Set trustline for escrow wallet
   */
  async setTrustline(
    escrowAddress: string,
    tokenAddress: string,
  ): Promise<{ xdr: string }> {
    return this.makeRequest<{ xdr: string }>("POST", "/helper/set-trustline", {
      escrowAddress,
      tokenAddress,
    });
  }
}

// Default configuration
export const createTrustlessWorkService = (): TrustlessWorkService => {
  const config: TrustlessWorkConfig = {
    baseURL:
      process.env.TRUSTLESS_WORK_API_URL || "https://api.trustlesswork.com",
    apiKey: process.env.TRUSTLESS_WORK_API_KEY || "",
  };

  if (!config.apiKey) {
    throw new Error("TRUSTLESS_WORK_API_KEY environment variable is required");
  }

  return new TrustlessWorkService(config);
};
