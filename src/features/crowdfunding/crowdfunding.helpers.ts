import Vote from "../../models/vote.model";
import { USER_SELECT_FIELDS } from "./crowdfunding.constants";

export const populateProjectUserData = (query: any) => {
  return query
    .populate("creator", USER_SELECT_FIELDS)
    .populate("team.userId", USER_SELECT_FIELDS)
    .populate("funding.contributors.user", USER_SELECT_FIELDS)
    .populate("voting.voters.userId", USER_SELECT_FIELDS);
};

export const populateVotingData = async (project: any): Promise<any> => {
  if (!project || !project._id) return project;

  try {
    const votes = await Vote.find({ projectId: project._id })
      .populate("userId", USER_SELECT_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    const voters = votes.map((vote: any) => ({
      userId: vote.userId,
      vote: vote.value === 1 ? "positive" : "negative",
      votedAt: vote.createdAt,
    }));

    project.voting.voters = voters;
    return project;
  } catch (error) {
    console.error("Error populating voting data:", error);
    return project;
  }
};

export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
};
