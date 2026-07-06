// Cria um Lancamento real a partir de um upload pendente confirmado pelo
// usuário no form de Lançar Gasto. Esta rota é o "commit" do fluxo web: aqui
// é onde o upload finalmente vira parte do histórico.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  confirmarPendenteECriarLancamento,
  criarLancamentoDireto,
} from "../services/notaFiscal/confirmarPendente.js";
import { montarDadosLancamento } from "../services/lancamentos/montar.js";
import { listarLancamentos } from "../services/lancamentos-list.js";

const schema = z.object({
  // Opcional: presente → cria o Lancamento amarrando a NF pendente; ausente →
  // cria só o Lancamento (gasto sem foto / receita, que normalmente não tem NF).
  pendenteId: z.number().int().positive().optional(),
  natureza: z.enum(["DEBITO", "CREDITO"]).default("DEBITO"),

  // Form manda strings BR; parseamos aqui pra falhar com mensagem clara.
  valorBR: z.string().min(1),
  dataBR: z.string().min(1),

  categoriaId: z.number().int().positive(),
  centroCustoId: z.number().int().positive(),
  contaBancariaId: z.number().int().positive().nullable().optional(),

  // Fornecedor: ID se o usuário escolheu da lista, nome se digitou um novo.
  fornecedorId: z.number().int().positive().nullable().optional(),
  fornecedorNome: z.string().trim().min(1).nullable().optional(),

  // pago=true marca LIQUIDADO e usa a mesma data como dataLiquidacao.
  pago: z.boolean().default(false),
  descricao: z.string().trim().max(1000).nullable().optional(),
  numeroDocumento: z.string().trim().max(50).nullable().optional(),
});

// GET /lancamentos — listagem geral paginada (leitura). Query validada.
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const listQuerySchema = z.object({
  from: z.string().regex(DIA_RE, "from inválido (use YYYY-MM-DD)").optional(),
  to: z.string().regex(DIA_RE, "to inválido (use YYYY-MM-DD)").optional(),
  natureza: z.enum(["DEBITO", "CREDITO"]).optional(),
  situacao: z.enum(["ABERTO", "LIQUIDADO", "LIQUIDADO_PARCIAL"]).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// "2026-05-31" -> Date(UTC meia-noite). Datas @db.Date são meia-noite UTC, então
// `to` inclusivo funciona com lte (mesma convenção do drill do dashboard).
const parseDiaUTC = (s?: string): Date | undefined =>
  s ? new Date(`${s}T00:00:00.000Z`) : undefined;

// "38.450,00" / "230,00" / "230" -> "38450.00"
function parseValorBR(raw: string): string | null {
  const limpo = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const n = Number(limpo);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

// "28/05/2026" -> Date(UTC 2026-05-28)
function parseDataBR(raw: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null;
  }
  return d;
}

export const lancamentosRouter = new Hono().post(
  "/lancamentos",
  zValidator("json", schema),
  async (c) => {
    const body = c.req.valid("json");

    const valor = parseValorBR(body.valorBR);
    if (!valor) return c.json({ erro: "valor inválido" }, 400);

    const data = parseDataBR(body.dataBR);
    if (!data) return c.json({ erro: "data inválida (use dd/mm/aaaa)" }, 400);

    // Resolve fornecedor: ID > nome (upsert por unique nome).
    let clienteFornecedorId: number | null = null;
    if (body.fornecedorId) {
      const f = await prisma.clienteFornecedor.findUnique({ where: { id: body.fornecedorId } });
      if (!f) return c.json({ erro: "fornecedor não encontrado" }, 400);
      clienteFornecedorId = f.id;
    } else if (body.fornecedorNome && body.fornecedorNome.length > 0) {
      const nome = body.fornecedorNome.trim();
      const f = await prisma.clienteFornecedor.upsert({
        where: { nome },
        update: {},
        create: { nome },
      });
      clienteFornecedorId = f.id;
    }

    // Sanidade das FKs (categoria/centro de custo/conta).
    const [cat, cc] = await Promise.all([
      prisma.categoria.findUnique({ where: { id: body.categoriaId } }),
      prisma.centroCusto.findUnique({ where: { id: body.centroCustoId } }),
    ]);
    if (!cat) return c.json({ erro: "categoria inválida" }, 400);
    if (!cc) return c.json({ erro: "centro de custo inválido" }, 400);
    if (body.contaBancariaId != null) {
      const conta = await prisma.contaBancaria.findUnique({ where: { id: body.contaBancariaId } });
      if (!conta) return c.json({ erro: "conta bancária inválida" }, 400);
    }

    const dados = montarDadosLancamento(body, { valor, data, clienteFornecedorId });

    const mesFechado = (ano: number, mes: number) =>
      c.json(
        {
          erro: `Mês ${mes.toString().padStart(2, "0")}/${ano} está fechado contabilmente.`,
          codigo: "MES_FECHADO",
        },
        423,
      );

    // Sem pendente: cria só o Lancamento (sem foto). Receita e gastos sem NF.
    if (body.pendenteId == null) {
      const r = await criarLancamentoDireto(dados);
      if (r.ok) return c.json({ lancamentoId: r.lancamento.id, arquivoId: null }, 201);
      if (r.codigo === "MES_FECHADO") return mesFechado(r.ano, r.mes);
      return c.json({ erro: r.mensagem, codigo: r.codigo }, 500);
    }

    // Com pendente: promove o upload a Lancamento + NotaFiscalArquivo.
    const r = await confirmarPendenteECriarLancamento({ pendenteId: body.pendenteId, dados });

    if (r.ok) {
      return c.json({ lancamentoId: r.lancamento.id, arquivoId: r.arquivo.id }, 201);
    }
    if (r.codigo === "PENDENTE_INVALIDA") {
      return c.json({ erro: r.mensagem, codigo: r.codigo }, 409);
    }
    if (r.codigo === "MES_FECHADO") {
      return mesFechado(r.ano, r.mes);
    }
    return c.json({ erro: r.mensagem, codigo: r.codigo }, 500);
  },
).get("/lancamentos", zValidator("query", listQuerySchema), async (c) => {
  const q = c.req.valid("query");
  const lista = await listarLancamentos({
    from: parseDiaUTC(q.from),
    to: parseDiaUTC(q.to),
    natureza: q.natureza,
    situacao: q.situacao,
    categoriaId: q.categoriaId,
    q: q.q,
    limit: q.limit,
    offset: q.offset,
  });
  return c.json(lista);
});
