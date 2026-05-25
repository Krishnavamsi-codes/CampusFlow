import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'iiits_live_rooms_secret_key_2026_super_secure_key';

export interface CRUserPayload {
  id: string;
  username: string;
  name: string;
  batch: string;
  section: number;
}

export interface AuthenticatedRequest extends Request {
  user?: CRUserPayload;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as CRUserPayload;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token is invalid or expired' });
  }
}
