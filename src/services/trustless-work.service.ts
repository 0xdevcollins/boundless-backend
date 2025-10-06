import axios, { AxiosResponse } from "axios";

const TRUSTLESS_WORK_API_URL =
  process.env.TRUSTLESS_WORK_API_URL || "https://trustless.work/api";
const TRUSTLESS_WORK_API_KEY = process.env.TRUSTLESS_WORK_API_KEY;

function getHeaders() {
  return TRUSTLESS_WORK_API_KEY
    ? { Authorization: `Bearer ${TRUSTLESS_WORK_API_KEY}` }
    : {};
}

export async function releaseFundsToMilestone({
  campaignId,
  milestoneId,
}: {
  campaignId: string;
  milestoneId: string;
}) {
  try {
    const res = await axios.post(
      `${TRUSTLESS_WORK_API_URL}/release`,
      { campaignId, milestoneId },
      { headers: getHeaders() },
    );
    return res.data;
  } catch (err) {
    throw new Error("Trustless Work API release failed");
  }
}

export async function markMilestoneApproved({
  campaignId,
  milestoneId,
}: {
  campaignId: string;
  milestoneId: string;
}) {
  try {
    const res = await axios.post(
      `${TRUSTLESS_WORK_API_URL}/approve`,
      { campaignId, milestoneId },
      { headers: getHeaders() },
    );
    return res.data;
  } catch (err) {
    throw new Error("Trustless Work API approve failed");
  }
}

export async function disputeMilestone({
  campaignId,
  milestoneId,
  reason,
}: {
  campaignId: string;
  milestoneId: string;
  reason: string;
}) {
  try {
    const res = await axios.post(
      `${TRUSTLESS_WORK_API_URL}/dispute`,
      { campaignId, milestoneId, reason },
      { headers: getHeaders() },
    );
    return res.data;
  } catch (err) {
    throw new Error("Trustless Work API dispute failed");
  }
}

export interface TrustlessWorkConfig {
  baseURL: string;
  apiKey: string;
}

export interface TrustlessWorkStakeholders {
  serviceProvider: string;
  approver: string;
  releaseSigner: string;
  disputeResolver: string;
  receiver: string;
  platformAddress?: string;
}

export interface TrustlessWorkMilestone {
  description: string;
  amount: number;
  payoutPercentage: number;
}

export interface TrustlessWorkEscrowRequest {
  signer: string;
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
  status: string;
  unsignedTransaction: string;
}

export interface TrustlessWorkFundRequest {
  contractId: string;
  signer: string;
  amount: number;
}

export interface TrustlessWorkFundResponse {
  status: string;
  unsignedTransaction: string;
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
  milestoneIndex?: number;
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
          "x-api-key": this.config.apiKey,
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

  async deployMultiReleaseEscrow(
    request: TrustlessWorkEscrowRequest,
  ): Promise<TrustlessWorkEscrowResponse> {
    return this.makeRequest<TrustlessWorkEscrowResponse>(
      "POST",
      "/deployer/multi-release",
      request,
    );
  }

  async deploySingleReleaseEscrow(
    request: TrustlessWorkEscrowRequest,
  ): Promise<TrustlessWorkEscrowResponse> {
    return this.makeRequest<TrustlessWorkEscrowResponse>(
      "POST",
      "/deployer/single-release",
      request,
    );
  }

  async fundEscrow(
    type: "single" | "multi",
    request: TrustlessWorkFundRequest,
  ): Promise<TrustlessWorkFundResponse> {
    return this.makeRequest<TrustlessWorkFundResponse>(
      "POST",
      `/escrow/${type}-release/fund-escrow`,
      request,
    );
  }

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

  async releaseMilestoneFunds(
    request: TrustlessWorkReleaseRequest,
  ): Promise<{ xdr: string }> {
    return this.makeRequest<{ xdr: string }>(
      "POST",
      "/escrow/multi/release-milestone-funds",
      request,
    );
  }

  async getEscrow(
    type: "single" | "multi",
    escrowAddress: string,
  ): Promise<any> {
    return this.makeRequest<any>(
      "GET",
      `/escrow/${type}/get-escrow?escrowAddress=${escrowAddress}`,
    );
  }

  async submitTransaction(signedXdr: string): Promise<any> {
    const response = await this.makeRequest<any>(
      "POST",
      "/helper/send-transaction",
      { signedXdr },
    );
    return response;
  }

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
