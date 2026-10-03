import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthJWTPayload, UserRole } from '../types/index.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'rydwala_production_super_secret_jwt_key_2026';

export interface AuthenticatedRequest extends Request {
  user?: AuthJWTPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    // In dev / test we can check if client passed direct x-user-id / x-user-role header for easy API testing
    const devUserId = req.headers['x-user-id'] as string;
    const devUserRole = req.headers['x-user-role'] as UserRole;
    if (devUserId && devUserRole) {
      req.user = {
        userId: devUserId,
        role: devUserRole,
        name: (req.headers['x-user-name'] as string) || 'Authorized User',
      };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid authentication token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthJWTPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token.' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
};
