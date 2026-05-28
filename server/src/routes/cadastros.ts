import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const cadastrosRouter = Router();

// --------------------------------------------------------------------------
// Leitura
// --------------------------------------------------------------------------
cadastrosRouter.get("/centros-custo", async (_req, res) => {
  res.json(await prisma.centroCusto.findMany({ orderBy: { ordem: "asc" } }));
});
cadastrosRouter.get("/grupos", async (_req, res) => {
  res.json(
    await prisma.grupoCategoria.findMany({ orderBy: { ordem: "asc" }, include: { categorias: { orderBy: { nome: "asc" } } } })
  );
});
cadastrosRouter.get("/categorias", async (_req, res) => {
  res.json(await prisma.categoria.findMany({ orderBy: { nome: "asc" }, include: { grupoCategoria: true } }));
});
cadastrosRouter.get("/contas", async (_req, res) => {
  res.json(await prisma.contaBancaria.findMany({ orderBy: { nome: "asc" } }));
});
cadastrosRouter.get("/fornecedores", async (_req, res) => {
  res.json(await prisma.clienteFornecedor.findMany({ orderBy: { nome: "asc" } }));
});

// --------------------------------------------------------------------------
// Helpers de CRUD genérico
// --------------------------------------------------------------------------
async function emUso(res: any, count: number, label: string): Promise<boolean> {
  if (count > 0) {
    res.status(409).json({ error: `Não é possível excluir: ${count} ${label} vinculado(s).` });
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// Centro de Custo
// --------------------------------------------------------------------------
const centroSchema = z.object({ nome: z.string().min(1), ehInvestimento: z.boolean().default(false), ordem: z.number().int().default(0) });
cadastrosRouter.post("/centros-custo", async (req, res) => {
  const p = centroSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    res.status(201).json(await prisma.centroCusto.create({ data: p.data }));
  } catch {
    res.status(409).json({ error: "Já existe um centro com esse nome" });
  }
});
cadastrosRouter.put("/centros-custo/:id", async (req, res) => {
  const p = centroSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  res.json(await prisma.centroCusto.update({ where: { id: Number(req.params.id) }, data: p.data }));
});
cadastrosRouter.delete("/centros-custo/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (await emUso(res, await prisma.lancamento.count({ where: { centroCustoId: id } }), "lançamento(s)")) return;
  await prisma.centroCusto.delete({ where: { id } });
  res.status(204).end();
});

// --------------------------------------------------------------------------
// Grupo de Categoria
// --------------------------------------------------------------------------
const grupoSchema = z.object({ nome: z.string().min(1), ordem: z.number().int().default(0) });
cadastrosRouter.post("/grupos", async (req, res) => {
  const p = grupoSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    res.status(201).json(await prisma.grupoCategoria.create({ data: p.data }));
  } catch {
    res.status(409).json({ error: "Já existe um grupo com esse nome" });
  }
});
cadastrosRouter.put("/grupos/:id", async (req, res) => {
  const p = grupoSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  res.json(await prisma.grupoCategoria.update({ where: { id: Number(req.params.id) }, data: p.data }));
});
cadastrosRouter.delete("/grupos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (await emUso(res, await prisma.categoria.count({ where: { grupoCategoriaId: id } }), "categoria(s)")) return;
  await prisma.grupoCategoria.delete({ where: { id } });
  res.status(204).end();
});

// --------------------------------------------------------------------------
// Categoria
// --------------------------------------------------------------------------
const categoriaSchema = z.object({ nome: z.string().min(1), grupoCategoriaId: z.number().int() });
cadastrosRouter.post("/categorias", async (req, res) => {
  const p = categoriaSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    res.status(201).json(await prisma.categoria.create({ data: p.data }));
  } catch {
    res.status(409).json({ error: "Categoria já existe nesse grupo" });
  }
});
cadastrosRouter.put("/categorias/:id", async (req, res) => {
  const p = categoriaSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  res.json(await prisma.categoria.update({ where: { id: Number(req.params.id) }, data: p.data }));
});
cadastrosRouter.delete("/categorias/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (await emUso(res, await prisma.lancamento.count({ where: { categoriaId: id } }), "lançamento(s)")) return;
  await prisma.categoria.delete({ where: { id } });
  res.status(204).end();
});

// --------------------------------------------------------------------------
// Conta Bancária
// --------------------------------------------------------------------------
const contaSchema = z.object({ nome: z.string().min(1), banco: z.string().nullable().optional(), saldoInicial: z.number().default(0) });
cadastrosRouter.post("/contas", async (req, res) => {
  const p = contaSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    res.status(201).json(await prisma.contaBancaria.create({ data: p.data }));
  } catch {
    res.status(409).json({ error: "Já existe uma conta com esse nome" });
  }
});
cadastrosRouter.put("/contas/:id", async (req, res) => {
  const p = contaSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  res.json(await prisma.contaBancaria.update({ where: { id: Number(req.params.id) }, data: p.data }));
});
cadastrosRouter.delete("/contas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (await emUso(res, await prisma.lancamento.count({ where: { contaBancariaId: id } }), "lançamento(s)")) return;
  await prisma.contaBancaria.delete({ where: { id } });
  res.status(204).end();
});

// --------------------------------------------------------------------------
// Cliente / Fornecedor
// --------------------------------------------------------------------------
const fornecedorSchema = z.object({ nome: z.string().min(1), documento: z.string().nullable().optional() });
cadastrosRouter.post("/fornecedores", async (req, res) => {
  const p = fornecedorSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    res.status(201).json(await prisma.clienteFornecedor.create({ data: p.data }));
  } catch {
    res.status(409).json({ error: "Já existe um cliente/fornecedor com esse nome" });
  }
});
cadastrosRouter.put("/fornecedores/:id", async (req, res) => {
  const p = fornecedorSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  res.json(await prisma.clienteFornecedor.update({ where: { id: Number(req.params.id) }, data: p.data }));
});
cadastrosRouter.delete("/fornecedores/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (await emUso(res, await prisma.lancamento.count({ where: { clienteFornecedorId: id } }), "lançamento(s)")) return;
  await prisma.clienteFornecedor.delete({ where: { id } });
  res.status(204).end();
});
