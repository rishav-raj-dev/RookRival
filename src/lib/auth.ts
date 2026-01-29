import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export interface JWTPayload {
  userId: string;
  username: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const token = request.cookies.get('token')?.value;
  
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export function createAuthResponse(token: string, data: any) {
  const response = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      'Content-Type': 'application/json',
    },
  });
}
