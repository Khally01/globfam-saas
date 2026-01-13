import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.error('Auth error: No token provided');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Verify session exists and is valid
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      console.error('Auth error: Invalid or expired session', { sessionId: decoded.sessionId, exists: !!session, expired: session ? session.expiresAt < new Date() : 'N/A' });
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired session'
      });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      organizationId: session.user.organizationId,
      role: session.user.role
    };

    next();
  } catch (error) {
    console.error('Auth error: Invalid token', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid token'
    });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Authorization failed',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};