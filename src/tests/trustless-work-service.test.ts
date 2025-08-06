import {
  TrustlessWorkService,
  createTrustlessWorkService,
} from "../services/trustless-work.service";
import axios from "axios";

// Mock axios
jest.mock("axios");
const mockedAxios = jest.mocked(axios);

describe("Trustless Work Service", () => {
  let service: TrustlessWorkService;
  const mockConfig = {
    baseURL: "https://api.trustlesswork.com",
    apiKey: "test-api-key",
  };

  beforeEach(() => {
    service = new TrustlessWorkService(mockConfig);
    jest.clearAllMocks();
  });

  describe("Service Initialization", () => {
    it("should create service with config", () => {
      expect(service).toBeInstanceOf(TrustlessWorkService);
    });

    it("should throw error when API key is missing", () => {
      // Mock process.env to not have API key
      const originalEnv = process.env.TRUSTLESS_WORK_API_KEY;
      delete process.env.TRUSTLESS_WORK_API_KEY;

      expect(() => createTrustlessWorkService()).toThrow(
        "TRUSTLESS_WORK_API_KEY environment variable is required",
      );

      // Restore original env
      process.env.TRUSTLESS_WORK_API_KEY = originalEnv;
    });
  });

  describe("Deploy Multi-Release Escrow", () => {
    const mockRequest = {
      engagementId: "test-engagement",
      title: "Test Campaign",
      description: "Test description",
      roles: {
        marker: "marker_address",
        approver: "approver_address",
        releaser: "releaser_address",
        resolver: "resolver_address",
        receiver: "receiver_address",
      },
      platformFee: 2.5,
      trustline: {
        address: "USDC_ADDRESS",
        decimals: 6,
      },
      milestones: [
        {
          description: "Milestone 1",
          amount: 5000,
          payoutPercentage: 50,
        },
      ],
    };

    it("should deploy multi-release escrow successfully", async () => {
      const mockResponse = {
        escrowAddress: "escrow_address_123",
        xdr: "test_xdr_string",
        network: "testnet",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.deployMultiReleaseEscrow(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/deployer/multi-release",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });

    it("should handle deployment failure", async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 400,
          data: { message: "Invalid request" },
        },
      } as any);

      await expect(
        service.deployMultiReleaseEscrow(mockRequest),
      ).rejects.toThrow("Trustless Work API Error: 400 - Invalid request");
    });
  });

  describe("Deploy Single-Release Escrow", () => {
    const mockRequest = {
      engagementId: "test-engagement",
      title: "Test Campaign",
      description: "Test description",
      roles: {
        marker: "marker_address",
        approver: "approver_address",
        releaser: "releaser_address",
        resolver: "resolver_address",
        receiver: "receiver_address",
      },
      platformFee: 2.5,
      trustline: {
        address: "USDC_ADDRESS",
        decimals: 6,
      },
    };

    it("should deploy single-release escrow successfully", async () => {
      const mockResponse = {
        escrowAddress: "escrow_address_123",
        xdr: "test_xdr_string",
        network: "testnet",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.deploySingleReleaseEscrow(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/deployer/single-release",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });
  });

  describe("Fund Escrow", () => {
    const mockRequest = {
      escrowAddress: "escrow_address_123",
      amount: 5000,
    };

    it("should fund escrow successfully", async () => {
      const mockResponse = {
        xdr: "fund_xdr_string",
        network: "testnet",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.fundEscrow("multi", mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/escrow/multi/fund-escrow",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });

    it("should handle funding failure", async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 500,
          data: { message: "Funding failed" },
        },
      } as any);

      await expect(service.fundEscrow("multi", mockRequest)).rejects.toThrow(
        "Trustless Work API Error: 500 - Funding failed",
      );
    });
  });

  describe("Approve Milestone", () => {
    const mockRequest = {
      escrowAddress: "escrow_address_123",
      milestoneIndex: 0,
    };

    it("should approve milestone successfully", async () => {
      const mockResponse = {
        xdr: "approval_xdr_string",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.approveMilestone("multi", mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/escrow/multi/approve-milestone",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });
  });

  describe("Change Milestone Status", () => {
    const mockRequest = {
      escrowAddress: "escrow_address_123",
      milestoneIndex: 0,
      status: "complete" as const,
    };

    it("should change milestone status successfully", async () => {
      const mockResponse = {
        xdr: "status_xdr_string",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.changeMilestoneStatus("multi", mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/escrow/multi/change-milestone-status",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });
  });

  describe("Release Funds", () => {
    const mockRequest = {
      escrowAddress: "escrow_address_123",
      milestoneIndex: 0,
    };

    it("should release funds successfully", async () => {
      const mockResponse = {
        xdr: "release_xdr_string",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.releaseFunds("multi", mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/escrow/multi/release-funds",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });
  });

  describe("Release Milestone Funds", () => {
    const mockRequest = {
      escrowAddress: "escrow_address_123",
      milestoneIndex: 0,
    };

    it("should release milestone funds successfully", async () => {
      const mockResponse = {
        xdr: "milestone_release_xdr_string",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.releaseMilestoneFunds(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/escrow/multi/release-milestone-funds",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: mockRequest,
      });
    });
  });

  describe("Get Escrow Details", () => {
    it("should get escrow details successfully", async () => {
      const mockResponse = {
        escrowAddress: "escrow_address_123",
        balance: 10000,
        milestones: [
          { description: "Phase 1", amount: 5000, status: "pending" },
        ],
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.getEscrow("multi", "escrow_address_123");

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "GET",
        url: "https://api.trustlesswork.com/escrow/multi/get-escrow?escrowAddress=escrow_address_123",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
      });
    });
  });

  describe("Submit Transaction", () => {
    it("should submit transaction successfully", async () => {
      const mockResponse = {
        hash: "transaction_hash_123",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.submitTransaction("test_xdr_string");

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/helper/send-transaction",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: { xdr: "test_xdr_string" },
      });
    });
  });

  describe("Set Trustline", () => {
    it("should set trustline successfully", async () => {
      const mockResponse = {
        xdr: "trustline_xdr_string",
      };

      mockedAxios.mockResolvedValue({
        data: mockResponse,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);

      const result = await service.setTrustline(
        "escrow_address_123",
        "token_address_123",
      );

      expect(result).toEqual(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.trustlesswork.com/helper/set-trustline",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        data: {
          escrowAddress: "escrow_address_123",
          tokenAddress: "token_address_123",
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      mockedAxios.mockRejectedValue(new Error("Network error") as any);

      await expect(
        service.getEscrow("multi", "escrow_address_123"),
      ).rejects.toThrow("Trustless Work API Error: Network error");
    });

    it("should handle API errors without response", async () => {
      const error = new Error("API error");
      (error as any).response = undefined;
      mockedAxios.mockRejectedValue(error as any);

      await expect(
        service.getEscrow("multi", "escrow_address_123"),
      ).rejects.toThrow("Trustless Work API Error: API error");
    });

    it("should handle API errors with response", async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      } as any);

      await expect(
        service.getEscrow("multi", "escrow_address_123"),
      ).rejects.toThrow("Trustless Work API Error: 500 - Server error");
    });

    it("should handle API errors without data message", async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 500,
          statusText: "Internal Server Error",
        },
      } as any);

      await expect(
        service.getEscrow("multi", "escrow_address_123"),
      ).rejects.toThrow(
        "Trustless Work API Error: 500 - Internal Server Error",
      );
    });
  });
});
