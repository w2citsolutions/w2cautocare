import type { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

// Raw token payload shape coming from jwt.verify
type RawJwtPayload = JwtPayload & {
  sub?: string;
  email?: string;
  name?: string;
};

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as RawJwtPayload;

    if (!decoded.sub || !decoded.email || !decoded.name) {
      throw new Error("Invalid token payload");
    }

    const userId = Number.parseInt(decoded.sub, 10);
    if (Number.isNaN(userId)) {
      throw new Error("Invalid sub in token");
    }

    req.user = {
      id: userId,
      email: decoded.email,
      name: decoded.name,
    };

    return next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
