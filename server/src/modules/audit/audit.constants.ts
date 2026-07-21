export const AUDIT_EVENT_ACTIONS = {
  AUTH_LOGIN_SUCCEEDED: 'auth.login_succeeded',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT: 'auth.login_blocked_disabled_account',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REFRESH_TOKEN_ROTATED: 'auth.refresh_token_rotated',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',
  ACCESS_RBAC_DENIED: 'access.rbac_denied',
  ACCESS_COURSE_BOUNDARY_DENIED: 'access.course_boundary_denied',
  ADMIN_ACCOUNT_CREATED: 'admin.account_created',
  ADMIN_ACCOUNT_UPDATED: 'admin.account_updated',
  ADMIN_ACCOUNT_DISABLED: 'admin.account_disabled',
  ADMIN_ACCOUNT_ENABLED: 'admin.account_enabled',
  ADMIN_ACCOUNT_ROLE_CHANGED: 'admin.account_role_changed',
  ADMIN_USER_PASSWORD_RESET: 'admin.user_password_reset',
  ADMIN_COURSE_CREATED: 'admin.course_created',
  ADMIN_COURSE_UPDATED: 'admin.course_updated',
  ADMIN_COURSE_ARCHIVED: 'admin.course_archived',
  ADMIN_COURSE_MEMBER_ADDED: 'admin.course_member_added',
  ADMIN_COURSE_MEMBER_REMOVED: 'admin.course_member_removed',
  ADMIN_COURSE_MEMBER_ROLE_CHANGED: 'admin.course_member_role_changed',
  CHAT_SESSION_DELETED: 'chat.session_deleted',
  CHAT_SESSION_ACCESS_DENIED: 'chat.session_access_denied',
  MATERIAL_UPLOAD_SUCCEEDED: 'material.upload_succeeded',
  MATERIAL_UPLOAD_DENIED: 'material.upload_denied',
  MATERIAL_UPLOAD_FAILED: 'material.upload_failed',
} as const

export type AuditEventAction =
  (typeof AUDIT_EVENT_ACTIONS)[keyof typeof AUDIT_EVENT_ACTIONS]

export const AUDIT_TARGET_TYPES = {
  AUTH_SESSION: 'auth_session',
  USER: 'user',
  COURSE: 'course',
  COURSE_MEMBERSHIP: 'course_membership',
  MATERIAL: 'material',
  CHAT_SESSION: 'chat_session',
  MESSAGE: 'message',
  SYSTEM: 'system',
} as const

export type AuditTargetType =
  (typeof AUDIT_TARGET_TYPES)[keyof typeof AUDIT_TARGET_TYPES]
