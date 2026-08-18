/**
 * Workspace & Team Collaboration Type Definitions
 * AutoDiagram Video Generator - Iteration 67 Phase B1
 */
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
    storageLimit: number;
    storageUsed: number;
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
        daily: Array<{
            date: string;
            usage: number;
        }>;
        weekly: Array<{
            week: string;
            usage: number;
        }>;
    };
}
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
export interface WorkspaceActivity {
    id: string;
    workspaceId: string;
    userId: string;
    action: WorkspaceActivityAction;
    resourceType: 'workspace' | 'member' | 'job' | 'settings' | 'quota';
    resourceId: string;
    details: Record<string, unknown>;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
}
export type WorkspaceActivityAction = 'workspace.created' | 'workspace.updated' | 'workspace.deleted' | 'member.invited' | 'member.joined' | 'member.role_changed' | 'member.removed' | 'member.suspended' | 'settings.updated' | 'quota.exceeded' | 'job.created' | 'job.completed' | 'job.failed';
export interface Permission {
    id: string;
    name: string;
    description: string;
    category: 'workspace' | 'members' | 'jobs' | 'settings' | 'billing';
}
export declare const PERMISSIONS: {
    readonly WORKSPACE_VIEW: "workspace:view";
    readonly WORKSPACE_EDIT: "workspace:edit";
    readonly WORKSPACE_DELETE: "workspace:delete";
    readonly WORKSPACE_SETTINGS: "workspace:settings";
    readonly MEMBERS_VIEW: "members:view";
    readonly MEMBERS_INVITE: "members:invite";
    readonly MEMBERS_MANAGE: "members:manage";
    readonly MEMBERS_REMOVE: "members:remove";
    readonly JOBS_CREATE: "jobs:create";
    readonly JOBS_VIEW: "jobs:view";
    readonly JOBS_VIEW_ALL: "jobs:view:all";
    readonly JOBS_CANCEL: "jobs:cancel";
    readonly JOBS_DELETE: "jobs:delete";
    readonly SETTINGS_VIEW: "settings:view";
    readonly SETTINGS_EDIT: "settings:edit";
    readonly BILLING_VIEW: "billing:view";
    readonly BILLING_MANAGE: "billing:manage";
};
export type PermissionKey = keyof typeof PERMISSIONS;
export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
    workspaceId?: string;
}
/** System role keys corresponding to WorkspaceMember.role values. */
export type SystemRoleKey = 'owner' | 'admin' | 'editor' | 'viewer';
export declare const SYSTEM_ROLES: Record<SystemRoleKey, Role>;
