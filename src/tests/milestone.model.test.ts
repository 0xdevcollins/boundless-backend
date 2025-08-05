import mongoose from "mongoose";
import Milestone from "../models/milestone.model";

// Simple unit tests without database - more reliable and faster
describe("Milestone Model - Unit Tests", () => {
  const baseMilestone = {
    campaignId: new mongoose.Types.ObjectId(),
    title: "Test Milestone",
    description: "Test milestone description",
    index: 1,
  };

  describe("Schema Validation", () => {
    it("should have correct schema structure", () => {
      const milestone = new Milestone(baseMilestone);

      expect(milestone.campaignId).toBeDefined();
      expect(milestone.title).toBe("Test Milestone");
      expect(milestone.description).toBe("Test milestone description");
      expect(milestone.index).toBe(1);
      expect(milestone.status).toBe("pending"); // Default value
    });

    it("should set default status to pending", () => {
      const milestone = new Milestone(baseMilestone);
      expect(milestone.status).toBe("pending");
    });

    it("should allow all valid status values", () => {
      const validStatuses = [
        "pending",
        "submitted",
        "in-progress",
        "pending-review",
        "approved",
        "rejected",
        "revision-requested",
        "completed",
      ];

      validStatuses.forEach((status) => {
        const milestone = new Milestone({
          ...baseMilestone,
          status: status as any,
        });
        expect(milestone.status).toBe(status);
      });
    });

    it("should have optional fields undefined when not provided", () => {
      const milestone = new Milestone(baseMilestone);
      expect(milestone.proofUrl).toBeUndefined();
      expect(milestone.adminNote).toBeUndefined();
    });

    it("should set optional fields when provided", () => {
      const milestoneWithOptionals = new Milestone({
        ...baseMilestone,
        proofUrl: "https://example.com/proof",
        adminNote: "Test admin note",
      });

      expect(milestoneWithOptionals.proofUrl).toBe("https://example.com/proof");
      expect(milestoneWithOptionals.adminNote).toBe("Test admin note");
    });
  });

  describe("Validation Errors", () => {
    it("should require campaignId", () => {
      const milestone = new Milestone({
        title: "Test",
        description: "Test description",
        index: 1,
      });

      const validationError = milestone.validateSync();
      expect(validationError?.errors.campaignId).toBeDefined();
    });

    it("should require title", () => {
      const milestone = new Milestone({
        campaignId: new mongoose.Types.ObjectId(),
        description: "Test description",
        index: 1,
      });

      const validationError = milestone.validateSync();
      expect(validationError?.errors.title).toBeDefined();
    });

    it("should require description", () => {
      const milestone = new Milestone({
        campaignId: new mongoose.Types.ObjectId(),
        title: "Test",
        index: 1,
      });

      const validationError = milestone.validateSync();
      expect(validationError?.errors.description).toBeDefined();
    });

    it("should require index", () => {
      const milestone = new Milestone({
        campaignId: new mongoose.Types.ObjectId(),
        title: "Test",
        description: "Test description",
      });

      const validationError = milestone.validateSync();
      expect(validationError?.errors.index).toBeDefined();
    });

    it("should reject invalid status values", () => {
      const milestone = new Milestone({
        ...baseMilestone,
        status: "invalid-status" as any,
      });

      const validationError = milestone.validateSync();
      expect(validationError?.errors.status).toBeDefined();
    });
  });

  describe("Model Methods", () => {
    it("should convert to JSON correctly", () => {
      const milestone = new Milestone(baseMilestone);
      const json = milestone.toJSON();

      expect(json.title).toBe("Test Milestone");
      expect(json.status).toBe("pending");
      expect(json.campaignId).toBeDefined();
    });

    it("should convert to Object correctly", () => {
      const milestone = new Milestone(baseMilestone);
      const obj = milestone.toObject();

      expect(obj.title).toBe("Test Milestone");
      expect(obj.status).toBe("pending");
      expect(obj.campaignId).toBeDefined();
    });
  });
});
