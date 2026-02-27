/** Registration input */
export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
  tenant_slug: string;
}

/** Login input */
export interface LoginInput {
  email: string;
  password: string;
  tenant_slug: string;
}

/** Token pair returned on auth success */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** User record (public-facing, no password_hash) */
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Role record */
export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/** Permission record */
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

/** Update user input */
export interface UpdateUserInput {
  display_name?: string;
  status?: string;
}

/** Create role input */
export interface CreateRoleInput {
  name: string;
  description?: string;
}

/** Update role input */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

/** Assign/unassign role input */
export interface RoleAssignInput {
  user_id: string;
}
