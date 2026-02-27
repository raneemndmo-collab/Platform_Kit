import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@rasid/shared';
import { UnauthorizedError } from '@rasid/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'rasid-dev-secret-key-min-32-chars-ok!!';

/**
 * Auth middleware — validates JWT access token.
 * Attaches jwtPayload to request.
 * Must run BEFORE tenant middleware.
 */
export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (request as FastifyRequest & { jwtPayload: JwtPayload }).jwtPayload = payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}
