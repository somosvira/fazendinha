import { Hono } from "hono";
import { listarPropriedades } from "../services/propriedade.js";

// Multi-propriedade (Fatia 0): lista os sítios ativos. O front só mostra o
// seletor quando há ≥2 — com 1 propriedade a camada fica invisível.
export const propriedadeRouter = new Hono().get("/propriedades", async (c) => c.json(await listarPropriedades()));
