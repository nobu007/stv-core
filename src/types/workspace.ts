/**
 * Workspace & Team Collaboration Type Definitions
 * AutoDiagram Video Generator - Iteration 67 Phase B1
 */

// ============================================================================
// Workspace Types
// ============================================================================

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  settings: WorkspaceSettings;
  quota: WorkspaceQuota;
  members: WorkspaceMember[];
}

export interface WorkspaceSettings {
  allowMemberInvites: boolean;
  defaultMemberRole: 'editor' | 'viewer';
  requireApprovalForInvites: boolean;
  maxMembers: number;
  features: {
    realTimeCollaboration: boolean;
    advancedAnalytics: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };
}

export interface WorkspaceQuota {
  monthlyProcessingLimit: number;
  monthlyProcessingUsed: number;
  storageLimit: number; // bytes
  storageUsed: number; // bytes
  concurrentJobsLimit: number;
  membersLimit: number;
  resetDate: Date;
}

export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
  joinedAt: Date;
  invitedBy?: string;
  status: 'active' | 'invited' | 'suspended';
}

// ============================================================================
// Workspace Request Types
// ============================================================================

export interface CreateWorkspaceRequest {
  name: string;
  slug?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions?: string[];
  message?: string;
}

export interface UpdateMemberRoleRequest {
  userId: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions?: string[];
}

// ============================================================================
// Workspace Response Types
// ============================================================================

export interface WorkspaceListResponse {
  workspaces: Workspace[];
  totalCount: number;
}

export interface WorkspaceDetailResponse {
  workspace: Workspace;
  members: WorkspaceMemberDetail[];
  usage: WorkspaceUsageStats;
}

export interface WorkspaceMemberDetail extends WorkspaceMember {
  user: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  };
  lastActiveAt?: Date;
  activityStats: {
    jobsCreated: number;
    videosGenerated: number;
    lastJobAt?: Date;
  };
}

export interface WorkspaceUsageStats {
  currentPeriod: {
    processingUsed: number;
    processingLimit: number;
    storageUsed: number;
    storageLimit: number;
    activeJobs: number;
    jobsLimit: number;
  };
  trends: {
    daily: Array<{ date: string; usage: number }>;
    weekly: Array<{ week: string; usage: number }>;
  };
}

// ============================================================================
// Invitation Types
// ============================================================================

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[];
  invitedBy: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

export interface AcceptInvitationRequest {
  invitationId: string;
  token: string;
}

// ============================================================================
// Activity & Audit Log Types
// ============================================================================

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  userId: string;
  action: WorkspaceActivityAction;
  resourceType: 'workspace' | 'member' | 'job' | 'settings' | 'quota';
  resourceId: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export type WorkspaceActivityAction =
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'member.invited'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'member.suspended'
  | 'settings.updated'
  | 'quota.exceeded'
  | 'job.created'
  | 'job.completed'
  | 'job.failed';

// ============================================================================
// Permission System Types
// ============================================================================

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'workspace' | 'members' | 'jobs' | 'settings' | 'billing';
}

export const PERMISSIONS = {
  // Workspace Permissions
  WORKSPACE_VIEW: 'workspace:view',
  WORKSPACE_EDIT: 'workspace:edit',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_SETTINGS: 'workspace:settings',

  // Member Permissions
  MEMBERS_VIEW: 'members:view',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_MANAGE: 'members:manage',
  MEMBERS_REMOVE: 'members:remove',

  // Job Permissions
  JOBS_CREATE: 'jobs:create',
  JOBS_VIEW: 'jobs:view',
  JOBS_VIEW_ALL: 'jobs:view:all',
  JOBS_CANCEL: 'jobs:cancel',
  JOBS_DELETE: 'jobs:delete',

  // Settings Permissions
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',

  // Billing Permissions (Future)
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// ============================================================================
// Role Definitions
// ============================================================================

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  workspaceId?: string;
}

export const SYSTEM_ROLES: Record<string, Role> = {
  owner: {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all workspace resources',
    permissions: Object.values(PERMISSIONS),
    isSystem: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access with member management',
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
      PERMISSIONS.SETTINGS_EDIT,
    ],
    isSystem: true,
  },
  editor: {
    id: 'editor',
    name: 'Editor',
    description: 'Can create and manage own jobs',
    permissions: [
      PERMISSIONS.WORKSPACE_VIEW,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.JOBS_CREATE,
      PERMISSIONS.JOBS_VIEW,
      PERMISSIONS.JOBS_CANCEL,
      PERMISSIONS.SETTINGS_VIEW,
    ],
    isSystem: true,
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to workspace resources',
    permissions: [
      PERMISSIONS.WORKSPACE_VIEW,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.JOBS_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
    ],
    isSystem: true,
  },
};
