import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { dataCaixa, garantirMesAberto } from "../services/fechamento.js";

export const lancamentosRouter = Router();

const lancamentoSchema = z.object({
  natureza: z.enum(["CREDITO", "DEBITO"]),
  valor: z.number().positive(),
  dataCompetencia: z.coerce.date(),
  dataVencimento: z.coerce.date(),
  dataLiquidacao: z.coerce.date().nullable().optional(),
  situacao: z.enum(["ABERTO", "LIQUIDADO", "LIQUIDADO_PARCIAL"]).default("ABERTO"),
  estornado: z.boolean().default(false),
  numeroDocumento: z.string().nullable().optional(),
  numeroParcela: z.number().int().nullable().optional(),
  totalParcelas: z.number().int().nullable().optional(),
  descricao: z.string().nullable().optional(),
  categoriaId: z.number().int(),
  centroCustoId: z.number().int(),
  contaBancariaId: z.number().int().nullable().optional(),
  clienteFornecedorId: z.number().int().nullable().optional(),
});

lancamentosRouter.get("/", async (req, res) => {
  const { situacao, centroCustoId } = req.query;
  const lancs = await prisma.lancamento.findMany({
    where: {
      ...(situacao ? { situacao: situacao as any } : {}),
      ...(centroCustoId ? { centroCustoId: Number(centroCustoId) } : {}),
    },
    include: {
      categoria: { include: { grupoCategoria: true } },
      centroCusto: true,
      contaBancaria: true,
      clienteFornecedor: true,
    },
    orderBy: [{ dataVencimento: "desc" }],
    take: 500,
  });
  res.json(lancs);
});

lancamentosRouter.post("/", async (req, res) => {
  const parsed = lancamentoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const dataLiquidacao = data.situacao === "LIQUIDADO" ? data.dataLiquidacao ?? data.dataVencimento : null;

  const erro = await garantirMesAberto(dataCaixa({ dataLiquidacao, dataVencimento: data.dataVencimento }));
  if (erro) return res.status(403).json({ error: erro });

  const novo = await prisma.lancamento.create({ data: { ...data, dataLiquidacao } });
  res.status(201).json(novo);
});

lancamentosRouter.put("/:id", async (req, res) => {
  const parsed = lancamentoSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const atual = await prisma.lancamento.findUnique({ where: { id: Number(req.params.id) } });
  if (!atual) return res.status(404).json({ error: "Lançamento não encontrado" });

  // Bloqueia se o estado atual OU o novo estado cair em mês fechado.
  const erroAtual = await garantirMesAberto(dataCaixa(atual));
  if (erroAtual) return res.status(403).json({ error: `Não é possível editar: ${erroAtual}` });
  const novaVenc = parsed.data.dataVencimento ?? atual.dataVencimento;
  const novaLiq = parsed.data.dataLiquidacao !== undefined ? parsed.data.dataLiquidacao : atual.dataLiquidacao;
  const erroNovo = await garantirMesAberto(dataCaixa({ dataLiquidacao: novaLiq, dataVencimento: novaVenc }));
  if (erroNovo) return res.status(403).json({ error: `Destino bloqueado: ${erroNovo}` });

  const upd = await prisma.lancamento.update({ where: { id: Number(req.params.id) }, data: parsed.data });
  res.json(upd);
});

lancamentosRouter.delete("/:id", async (req, res) => {
  const atual = await prisma.lancamento.findUnique({ where: { id: Number(req.params.id) } });
  if (!atual) return res.status(404).json({ error: "Lançamento não encontrado" });
  const erro = await garantirMesAberto(dataCaixa(atual));
  if (erro) return res.status(403).json({ error: `Não é possível excluir: ${erro}` });
  await prisma.lancamento.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});
