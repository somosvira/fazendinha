import { Router } from "express";
import { z } from "zod";
import { autenticar } from "../auth.js";

export const authRouter = Router();

const loginSchema = z.object({ usuario: z.string(), senha: z.string() });

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
  const token = autenticar(parsed.data.usuario, parsed.data.senha);
  if (!token) return res.status(401).json({ error: "Usuário ou senha incorretos" });
  res.json({ token });
});
