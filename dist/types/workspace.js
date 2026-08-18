// src/types/workspace.ts
var PERMISSIONS = {
  // Workspace Permissions
  WORKSPACE_VIEW: "workspace:view",
  WORKSPACE_EDIT: "workspace:edit",
  WORKSPACE_DELETE: "workspace:delete",
  WORKSPACE_SETTINGS: "workspace:settings",
  // Member Permissions
  MEMBERS_VIEW: "members:view",
  MEMBERS_INVITE: "members:invite",
  MEMBERS_MANAGE: "members:manage",
  MEMBERS_REMOVE: "members:remove",
  // Job Permissions
  JOBS_CREATE: "jobs:create",
  JOBS_VIEW: "jobs:view",
  JOBS_VIEW_ALL: "jobs:view:all",
  JOBS_CANCEL: "jobs:cancel",
  JOBS_DELETE: "jobs:delete",
  // Settings Permissions
  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",
  // Billing Permissions (Future)
  BILLING_VIEW: "billing:view",
  BILLING_MANAGE: "billing:manage"
};
var SYSTEM_ROLES = {
  owner: {
    id: "owner",
    name: "Owner",
    description: "Full access to all workspace resources",
    permissions: Object.values(PERMISSIONS),
    isSystem: true
  },
  admin: {
    id: "admin",
    name: "Admin",
    description: "Administrative access with member management",
    permissions: [
      PERMISSIONS.WORKSPACE_VIEW,
      PERMISSIONS.WORKSPACE_EDIT,
      PERMISSIONS.WORKSPACE_SETTINGS,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.MEMBERS_INVITE,
      PERMISSIONS.MEMBERS_MANAGE,
      PERMISSIONS.JOBS_CREATE,
      PERMISSIONS.JOBS_VIEW_ALL,
      PERMISSIONS.JOBS_CANCEL,
      PERMISSIONS.JOBS_DELETE,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_EDIT
    ],
    isSystem: true
  },
  editor: {
    id: "editor",
    name: "Editor",
    description: "Can create and manage own jobs",
    permissions: [
      PERMISSIONS.WORKSPACE_VIEW,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.JOBS_CREATE,
      PERMISSIONS.JOBS_VIEW,
      PERMISSIONS.JOBS_CANCEL,
      PERMISSIONS.SETTINGS_VIEW
    ],
    isSystem: true
  },
  viewer: {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to workspace resources",
    permissions: [
      PERMISSIONS.WORKSPACE_VIEW,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.JOBS_VIEW,
      PERMISSIONS.SETTINGS_VIEW
    ],
    isSystem: true
  }
};
export {
  PERMISSIONS,
  SYSTEM_ROLES
};
