import { CustomPermissions } from "../models/organization.model";

export const DEFAULT_PERMISSIONS: CustomPermissions = {
  create_edit_profile: {
    owner: true,
    admin: { value: true, note: "edit only" },
    member: false,
  },
  manage_hackathons_grants: {
    owner: true,
    admin: true,
    member: false,
  },
  publish_hackathons: {
    owner: true,
    admin: false,
    member: false,
  },
  view_analytics: {
    owner: true,
    admin: true,
    member: true,
  },
  invite_remove_members: {
    owner: true,
    admin: true,
    member: false,
  },
  assign_roles: {
    owner: true,
    admin: false,
    member: false,
  },
  post_announcements: {
    owner: true,
    admin: false,
    member: false,
  },
  comment_discussions: {
    owner: true,
    admin: true,
    member: true,
  },
  access_submissions: {
    owner: true,
    admin: true,
    member: { value: true, note: "view only, unless assigned as judge" },
  },
  delete_organization: {
    owner: true,
    admin: false,
    member: false,
  },
};
