export type UserProfile = {
  user_id: string;
  username: string;
  role?: string;
  // site_admin: P2 permission-model addition. When true, the user is a
  // member of the root team and has site-wide admin privileges (audit
  // log read, plugin registry, etc.). Older backends may omit this
  // field — UI gating must treat missing/undefined as "unknown" and
  // fall back to the legacy role==='admin' check.
  site_admin?: boolean;
  email?: string;
  email_verified?: boolean;
  icon_url?: string;
  bio?: string;
  is_online?: boolean;
  device_type?: string;
  last_seen_at?: string;
};

export type EmailVerificationResponse = {
  message?: string;
  error?: string;
  email?: string;
  email_verified?: boolean;
};
