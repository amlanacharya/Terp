import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type UserRole = 'admin' | 'manager' | 'accountant' | 'operator' | 'viewer';

export interface AuthTokenPayload {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'travelerp-local-dev-secret';
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '12h' });
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing authorization token.' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function roleCheck(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'You do not have access to this resource.' });
      return;
    }

    next();
  };
}
