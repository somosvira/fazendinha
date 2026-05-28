import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "dev-secret";
const APP_USER = process.env.APP_USER ?? "admin";
const APP_PASSWORD = process.env.APP_PASSWORD ?? "rionovo";

export function autenticar(usuario: string, senha: string): string | null {
  if (usuario === APP_USER && senha === APP_PASSWORD) {
    return jwt.sign({ sub: usuario }, SECRET, { expiresIn: "12h" });
  }
  return null;
}

// Middleware: exige Bearer token (ou token via ?token= para downloads).
export function exigirAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : (req.query.token as string | undefined);
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
