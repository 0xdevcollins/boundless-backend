// import { Networks } from "@stellar/stellar-sdk";
// import { contractService } from "./contract.service";
// import {
//   UnsignedTransaction,
//   EntityType,
//   Status,
//   MilestoneStatus,
//   CreateCampaignParams,
//   FundCampaignParams,
//   CreateGrantParams,
//   CreateHackathonParams,
//   CreateMilestoneParams,
//   ReleaseMilestoneParams,
//   UpdateMilestoneParams,
//   ApproveMilestoneParams,
//   RejectMilestoneParams,
//   RaiseDisputeParams,
// } from "../types/contract";

// /**
//  * Boundless Contract Service - Specialized service for Boundless smart contract operations
//  *
//  * This service provides high-level methods for all Boundless contract operations:
//  * - Campaign Management
//  * - Grant Management
//  * - Hackathon Management
//  * - Milestone Management
//  * - Escrow Management
//  */
// export class BoundlessContractService {
//   private contractId: string;
//   private defaultNetwork: Networks;

//   constructor(contractId: string, network: Networks = Networks.TESTNET) {
//     this.contractId = contractId;
//     this.defaultNetwork = network;
//   }

//   // ============================================================================
//   // CONTRACT MANAGEMENT
//   // ============================================================================

//   /**
//    * Initialize the Boundless contract
//    */
//   async initializeContract(
//     sourceAccount: string,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "initialize",
//       [admin], // admin: Address
//       network,
//     );
//   }

//   /**
//    * Get contract admin
//    */
//   async getContractAdmin(
//     sourceAccount: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_admin",
//       [],
//       network,
//     );
//   }

//   /**
//    * Get contract version
//    */
//   async getContractVersion(
//     sourceAccount: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_version",
//       [],
//       network,
//     );
//   }

//   // ============================================================================
//   // CAMPAIGN MANAGEMENT
//   // ============================================================================

//   /**
//    * Create a new campaign
//    */
//   async createCampaign(
//     sourceAccount: string,
//     params: CreateCampaignParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "create_campaign",
//       [
//         params.owner, // owner: Address
//         params.title, // title: Symbol
//         params.description, // description: Symbol
//         params.goal, // goal: i128
//         params.escrow_contract_id, // escrow_contract_id: Address
//         params.milestones, // milestones: Vec<Milestone>
//       ],
//       network,
//     );
//   }

//   /**
//    * Fund a campaign
//    */
//   async fundCampaign(
//     sourceAccount: string,
//     params: FundCampaignParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "fund_campaign",
//       [
//         params.campaign_id, // campaign_id: u64
//         params.backer, // backer: Address
//         params.amount, // amount: i128
//       ],
//       network,
//     );
//   }

//   /**
//    * Release funds for a milestone
//    */
//   async releaseFunds(
//     sourceAccount: string,
//     campaignId: number,
//     milestoneId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "release_funds",
//       [
//         campaignId, // campaign_id: u64
//         milestoneId, // milestone_id: u64
//       ],
//       network,
//     );
//   }

//   /**
//    * Get campaign information
//    */
//   async getCampaign(
//     sourceAccount: string,
//     campaignId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_campaign",
//       [campaignId], // campaign_id: u64
//       network,
//     );
//   }

//   /**
//    * Complete a campaign (admin only)
//    */
//   async completeCampaign(
//     sourceAccount: string,
//     campaignId: number,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "complete_campaign",
//       [
//         campaignId, // campaign_id: u64
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Cancel a campaign (admin only)
//    */
//   async cancelCampaign(
//     sourceAccount: string,
//     campaignId: number,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "cancel_campaign",
//       [
//         campaignId, // campaign_id: u64
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Update campaign status (admin only)
//    */
//   async updateCampaignStatus(
//     sourceAccount: string,
//     campaignId: number,
//     status: Status,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "update_campaign_status",
//       [
//         campaignId, // campaign_id: u64
//         status, // status: Status
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Get campaign backers
//    */
//   async getCampaignBackers(
//     sourceAccount: string,
//     campaignId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_campaign_backers",
//       [campaignId], // campaign_id: u64
//       network,
//     );
//   }

//   // ============================================================================
//   // GRANT MANAGEMENT
//   // ============================================================================

//   /**
//    * Create a new grant
//    */
//   async createGrant(
//     sourceAccount: string,
//     params: CreateGrantParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "create_grant",
//       [
//         params.sponsor, // sponsor: Address
//         params.title, // title: Symbol
//         params.description, // description: Symbol
//         params.pool, // pool: i128
//         params.winners, // winners: u32
//       ],
//       network,
//     );
//   }

//   /**
//    * Apply to a grant
//    */
//   async applyToGrant(
//     sourceAccount: string,
//     grantId: number,
//     project: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "apply_to_grant",
//       [
//         grantId, // grant_id: u64
//         project, // project: Symbol
//       ],
//       network,
//     );
//   }

//   /**
//    * Get grant information
//    */
//   async getGrant(
//     sourceAccount: string,
//     grantId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_grant",
//       [grantId], // grant_id: u64
//       network,
//     );
//   }

//   /**
//    * Complete a grant (admin only)
//    */
//   async completeGrant(
//     sourceAccount: string,
//     grantId: number,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "complete_grant",
//       [
//         grantId, // grant_id: u64
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Cancel a grant (admin only)
//    */
//   async cancelGrant(
//     sourceAccount: string,
//     grantId: number,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "cancel_grant",
//       [
//         grantId, // grant_id: u64
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Select grant winners (admin only)
//    */
//   async selectGrantWinners(
//     sourceAccount: string,
//     grantId: number,
//     winners: string[],
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "select_grant_winners",
//       [
//         grantId, // grant_id: u64
//         winners, // winners: Vec<Address>
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Get grant applications
//    */
//   async getGrantApplications(
//     sourceAccount: string,
//     grantId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_grant_applications",
//       [grantId], // grant_id: u64
//       network,
//     );
//   }

//   /**
//    * Get grant winners
//    */
//   async getGrantWinners(
//     sourceAccount: string,
//     grantId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_grant_winners",
//       [grantId], // grant_id: u64
//       network,
//     );
//   }

//   /**
//    * Update grant status (admin only)
//    */
//   async updateGrantStatus(
//     sourceAccount: string,
//     grantId: number,
//     status: Status,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "update_grant_status",
//       [
//         grantId, // grant_id: u64
//         status, // status: Status
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   // ============================================================================
//   // HACKATHON MANAGEMENT
//   // ============================================================================

//   /**
//    * Create a new hackathon
//    */
//   async createHackathon(
//     sourceAccount: string,
//     params: CreateHackathonParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "create_hackathon",
//       [
//         params.organizer, // organizer: Address
//         params.title, // title: Symbol
//         params.description, // description: Symbol
//         params.theme, // theme: Symbol
//         params.prize_pool, // prize_pool: i128
//       ],
//       network,
//     );
//   }

//   /**
//    * Submit hackathon entry
//    */
//   async submitHackathonEntry(
//     sourceAccount: string,
//     hackathonId: number,
//     project: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "submit_hackathon_entry",
//       [
//         hackathonId, // hackathon_id: u64
//         project, // project: Symbol
//       ],
//       network,
//     );
//   }

//   /**
//    * Get hackathon information
//    */
//   async getHackathon(
//     sourceAccount: string,
//     hackathonId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_hackathon",
//       [hackathonId], // hackathon_id: u64
//       network,
//     );
//   }

//   /**
//    * Complete a hackathon (admin only)
//    */
//   async completeHackathon(
//     sourceAccount: string,
//     hackathonId: number,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "complete_hackathon",
//       [
//         hackathonId, // hackathon_id: u64
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Cancel a hackathon (admin only)
//    */
//   async cancelHackathon(
//     sourceAccount: string,
//     hackathonId: number,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "cancel_hackathon",
//       [
//         hackathonId, // hackathon_id: u64
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Judge hackathon entry
//    */
//   async judgeHackathonEntry(
//     sourceAccount: string,
//     hackathonId: number,
//     project: string,
//     score: number,
//     judge: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "judge_hackathon_entry",
//       [
//         hackathonId, // hackathon_id: u64
//         project, // project: Symbol
//         score, // score: u32
//         judge, // judge: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Select hackathon winners (admin only)
//    */
//   async selectHackathonWinners(
//     sourceAccount: string,
//     hackathonId: number,
//     winners: string[],
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "select_hackathon_winners",
//       [
//         hackathonId, // hackathon_id: u64
//         winners, // winners: Vec<Address>
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Get hackathon entries
//    */
//   async getHackathonEntries(
//     sourceAccount: string,
//     hackathonId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_hackathon_entries",
//       [hackathonId], // hackathon_id: u64
//       network,
//     );
//   }

//   /**
//    * Get hackathon winners
//    */
//   async getHackathonWinners(
//     sourceAccount: string,
//     hackathonId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_hackathon_winners",
//       [hackathonId], // hackathon_id: u64
//       network,
//     );
//   }

//   /**
//    * Update hackathon status (admin only)
//    */
//   async updateHackathonStatus(
//     sourceAccount: string,
//     hackathonId: number,
//     status: Status,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "update_hackathon_status",
//       [
//         hackathonId, // hackathon_id: u64
//         status, // status: Status
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Add hackathon judge (admin only)
//    */
//   async addHackathonJudge(
//     sourceAccount: string,
//     hackathonId: number,
//     judge: string,
//     name: string,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "add_hackathon_judge",
//       [
//         hackathonId, // hackathon_id: u64
//         judge, // judge: Address
//         name, // name: Symbol
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Remove hackathon judge (admin only)
//    */
//   async removeHackathonJudge(
//     sourceAccount: string,
//     hackathonId: number,
//     judge: string,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "remove_hackathon_judge",
//       [
//         hackathonId, // hackathon_id: u64
//         judge, // judge: Address
//         admin, // admin: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Get hackathon judges
//    */
//   async getHackathonJudges(
//     sourceAccount: string,
//     hackathonId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_hackathon_judges",
//       [hackathonId], // hackathon_id: u64
//       network,
//     );
//   }

//   // ============================================================================
//   // MILESTONE MANAGEMENT
//   // ============================================================================

//   /**
//    * Create a milestone for any entity type
//    */
//   async createMilestone(
//     sourceAccount: string,
//     params: CreateMilestoneParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "create_milestone",
//       [
//         params.entity_id, // entity_id: u64
//         params.entity_type, // entity_type: EntityType
//         params.description, // description: Symbol
//         params.amount, // amount: i128
//       ],
//       network,
//     );
//   }

//   /**
//    * Release a milestone
//    */
//   async releaseMilestone(
//     sourceAccount: string,
//     params: ReleaseMilestoneParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "release_milestone",
//       [
//         params.entity_id, // entity_id: u64
//         params.entity_type, // entity_type: EntityType
//         params.milestone_id, // milestone_id: u64
//       ],
//       network,
//     );
//   }

//   /**
//    * Update milestone status
//    */
//   async updateMilestone(
//     sourceAccount: string,
//     params: UpdateMilestoneParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "update_milestone",
//       [
//         params.entity_id, // entity_id: u64
//         params.entity_type, // entity_type: EntityType
//         params.milestone_id, // milestone_id: u64
//         params.status, // status: MilestoneStatus
//       ],
//       network,
//     );
//   }

//   /**
//    * Approve a milestone
//    */
//   async approveMilestone(
//     sourceAccount: string,
//     params: ApproveMilestoneParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "approve_milestone",
//       [
//         params.entity_id, // entity_id: u64
//         params.entity_type, // entity_type: EntityType
//         params.milestone_id, // milestone_id: u64
//         params.approver, // approver: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Reject a milestone
//    */
//   async rejectMilestone(
//     sourceAccount: string,
//     params: RejectMilestoneParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "reject_milestone",
//       [
//         params.entity_id, // entity_id: u64
//         params.entity_type, // entity_type: EntityType
//         params.milestone_id, // milestone_id: u64
//         params.rejector, // rejector: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Raise a dispute for a milestone
//    */
//   async raiseDispute(
//     sourceAccount: string,
//     params: RaiseDisputeParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "raise_dispute",
//       [
//         params.entity_id, // entity_id: u64
//         params.entity_type, // entity_type: EntityType
//         params.milestone_id, // milestone_id: u64
//         params.reason, // reason: Symbol
//       ],
//       network,
//     );
//   }

//   /**
//    * Get milestone information
//    */
//   async getMilestone(
//     sourceAccount: string,
//     entityId: number,
//     entityType: EntityType,
//     milestoneId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_milestone",
//       [
//         entityId, // entity_id: u64
//         entityType, // entity_type: EntityType
//         milestoneId, // milestone_id: u64
//       ],
//       network,
//     );
//   }

//   /**
//    * Get all milestones for an entity
//    */
//   async getEntityMilestones(
//     sourceAccount: string,
//     entityId: number,
//     entityType: EntityType,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_entity_milestones",
//       [
//         entityId, // entity_id: u64
//         entityType, // entity_type: EntityType
//       ],
//       network,
//     );
//   }

//   // ============================================================================
//   // ESCROW MANAGEMENT
//   // ============================================================================

//   /**
//    * Link escrow contract to campaign
//    */
//   async linkEscrow(
//     sourceAccount: string,
//     campaignId: number,
//     escrowContractId: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "link_escrow",
//       [
//         campaignId, // campaign_id: u64
//         escrowContractId, // escrow_contract_id: Address
//       ],
//       network,
//     );
//   }

//   /**
//    * Get escrow contract for campaign
//    */
//   async getEscrowContract(
//     sourceAccount: string,
//     campaignId: number,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "get_escrow_contract",
//       [campaignId], // campaign_id: u64
//       network,
//     );
//   }

//   /**
//    * Validate escrow contract
//    */
//   async validateEscrowContract(
//     sourceAccount: string,
//     escrowContractId: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction> {
//     return contractService.createUnsignedTransaction(
//       sourceAccount,
//       this.contractId,
//       "validate_escrow_contract",
//       [escrowContractId], // escrow_contract_id: Address
//       network,
//     );
//   }

//   // ============================================================================
//   // BATCH OPERATIONS
//   // ============================================================================

//   /**
//    * Create multiple transactions for a campaign workflow
//    */
//   async createCampaignWorkflow(
//     sourceAccount: string,
//     campaignParams: CreateCampaignParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction[]> {
//     const transactions: UnsignedTransaction[] = [];

//     // 1. Create campaign
//     transactions.push(
//       await this.createCampaign(sourceAccount, campaignParams, network),
//     );

//     // 2. Link escrow (if provided)
//     if (campaignParams.escrow_contract_id) {
//       // Note: We'll need the campaign ID from the first transaction result
//       // This is a simplified example - in practice, you'd handle the campaign ID
//       transactions.push(
//         await this.linkEscrow(
//           sourceAccount,
//           0, // This would be the actual campaign ID
//           campaignParams.escrow_contract_id,
//           network,
//         ),
//       );
//     }

//     return transactions;
//   }

//   /**
//    * Create multiple transactions for milestone management
//    */
//   async createMilestoneWorkflow(
//     sourceAccount: string,
//     entityId: number,
//     entityType: EntityType,
//     milestones: Array<{ description: string; amount: string }>,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction[]> {
//     const transactions: UnsignedTransaction[] = [];

//     // Create all milestones
//     for (const milestone of milestones) {
//       transactions.push(
//         await this.createMilestone(
//           sourceAccount,
//           {
//             entity_id: entityId,
//             entity_type: entityType,
//             description: milestone.description,
//             amount: milestone.amount,
//           },
//           network,
//         ),
//       );
//     }

//     return transactions;
//   }

//   /**
//    * Create multiple transactions for grant workflow
//    */
//   async createGrantWorkflow(
//     sourceAccount: string,
//     grantParams: CreateGrantParams,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction[]> {
//     const transactions: UnsignedTransaction[] = [];

//     // 1. Create grant
//     transactions.push(
//       await this.createGrant(sourceAccount, grantParams, network),
//     );

//     return transactions;
//   }

//   /**
//    * Create multiple transactions for hackathon workflow
//    */
//   async createHackathonWorkflow(
//     sourceAccount: string,
//     hackathonParams: CreateHackathonParams,
//     judges: Array<{ address: string; name: string }>,
//     admin: string,
//     network: Networks = this.defaultNetwork,
//   ): Promise<UnsignedTransaction[]> {
//     const transactions: UnsignedTransaction[] = [];

//     // 1. Create hackathon
//     transactions.push(
//       await this.createHackathon(sourceAccount, hackathonParams, network),
//     );

//     // 2. Add judges
//     for (const judge of judges) {
//       transactions.push(
//         await this.addHackathonJudge(
//           sourceAccount,
//           0, // This would be the actual hackathon ID
//           judge.address,
//           judge.name,
//           admin,
//           network,
//         ),
//       );
//     }

//     return transactions;
//   }

//   // ============================================================================
//   // UTILITY METHODS
//   // ============================================================================

//   /**
//    * Get contract ID
//    */
//   getContractId(): string {
//     return this.contractId;
//   }

//   /**
//    * Get default network
//    */
//   getDefaultNetwork(): Networks {
//     return this.defaultNetwork;
//   }

//   /**
//    * Set contract ID
//    */
//   setContractId(contractId: string): void {
//     this.contractId = contractId;
//   }

//   /**
//    * Set default network
//    */
//   setDefaultNetwork(network: Networks): void {
//     this.defaultNetwork = network;
//   }
// }

// // Export a factory function to create instances
// export function createBoundlessContractService(
//   contractId: string,
//   network: Networks = Networks.TESTNET,
// ): BoundlessContractService {
//   return new BoundlessContractService(contractId, network);
// }
