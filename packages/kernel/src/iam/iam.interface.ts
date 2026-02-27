import type { JwtPayload } from '@rasid/shared';
import type {
  RegisterInput,
  LoginInput,
  TokenPair,
  User,
  Role,
  Permission,
} from './iam.types.js';

/** K1 — IAM Service Interface (public contract) */
export interface IIamService {
  register(input: RegisterInput): Promise<{ user: User; token: TokenPair }>;
  login(input: LoginInput): Promise<TokenPair>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  validateToken(accessToken: string): Promise<JwtPayload>;
  getUserRoles(userId: string, tenantId: string): Promise<Role[]>;
  getUserPermissions(userId: string, tenantId: string): Promise<Permission[]>;
}
