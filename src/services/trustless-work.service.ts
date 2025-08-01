import axios from "axios";

const TRUSTLESS_WORK_API_BASE =
  process.env.TRUSTLESS_WORK_API_BASE || "https://trustless-work-demo/api";

export async function trustlessWorkAction(
  action: "approve" | "release" | "reject" | "dispute",
  data: any,
) {
  try {
    let endpoint = "";
    let method = "post";
    switch (action) {
      case "approve":
        endpoint = `/milestones/${data.milestoneId}/approve`;
        break;
      case "release":
        endpoint = `/milestones/${data.milestoneId}/release`;
        break;
      case "reject":
        endpoint = `/milestones/${data.milestoneId}/reject`;
        break;
      case "dispute":
        endpoint = `/milestones/${data.milestoneId}/dispute`;
        break;
      default:
        throw new Error("Unknown Trustless Work action");
    }
    const url = `${TRUSTLESS_WORK_API_BASE}${endpoint}`;
    const response = await axios({
      url,
      method,
      data,
      timeout: 10000,
    });
    if (!response.data || !response.data.success) {
      throw new Error("Trustless Work API error");
    }
    return response.data;
  } catch (err) {
    throw new Error("Trustless Work API failure");
  }
}
