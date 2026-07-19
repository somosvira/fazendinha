import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { simularCenarioPrecoLeite, simularCenarioRacao } from "../services/simulacao.js";
import { resolverEscopoLeitura } from "../services/propriedade.js";

// Simulação financeira read-only: só lê o dashboard real e simula. Nunca grava.

const precoLeiteSchema = z.object({
  variacaoPct: z.number().min(-100).max(100), // ex.: 10 = +10%, -15 = −15%
});

const racaoSchema = z
  .object({
    variacaoPct: z.number().min(-100).max(200).optional(),
    custoVacaDiaNovo: z.number().min(0).max(9999).optional(), // R$/vaca/dia absoluto
    periodoDias: z.number().int().min(1).max(365).optional(),
  })
  .refine((v) => v.variacaoPct !== undefined || v.custoVacaDiaNovo !== undefined, {
    message: "informe variacaoPct ou custoVacaDiaNovo",
  });

export const simulacaoRouter = new Hono()
  .post("/simulacao/preco-leite", zValidator("json", precoLeiteSchema), async (c) => {
    const { variacaoPct } = c.req.valid("json");
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await simularCenarioPrecoLeite(variacaoPct, propriedadeId));
  })
  .post("/simulacao/racao", zValidator("json", racaoSchema), async (c) => {
    const { variacaoPct, custoVacaDiaNovo, periodoDias } = c.req.valid("json");
    const propriedadeId = await resolverEscopoLeitura(c);
    return c.json(await simularCenarioRacao({ variacaoPct, custoVacaDiaNovo }, periodoDias ?? 30, propriedadeId));
  });
