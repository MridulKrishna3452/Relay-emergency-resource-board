import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env, isProd } from '../lib/env';
import { prisma } from '../lib/prisma';
import { asyncHandler, forbidden, unauthorized } from '../lib/errors';
import type { Role } from '../lib/constants';

export const COOKIE_NAME = 'relay_token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Strips secrets before sending a user to the client. */
export function publicUser(u: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u;
  return rest;
}

/**
 * Reads the JWT from the httpOnly cookie or an `Authorization: Bearer` header
 * and loads the user fresh from the DB (so verification changes apply instantly).
 * Never fails: routes decide whether auth is required.
 */
export const attachUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user) req.user = user;
    } catch {
      // invalid/expired token -> treat as anonymous
    }
  }
  next();
});

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role as Role)) {
      return next(forbidden(`This action is only available to: ${roles.join(', ').toLowerCase()}s.`));
    }
    next();
  };

export const requireApprovedVolunteer: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'VOLUNTEER') return next(forbidden('Only volunteers can do this.'));
  if (req.user.verificationStatus !== 'APPROVED') {
    const msg =
      req.user.verificationStatus === 'REJECTED'
        ? 'Your volunteer verification was rejected, so you cannot accept requests.'
        : 'Your volunteer account is pending verification by an admin. You can accept requests once approved.';
    return next(forbidden(msg));
  }
  next();
};
