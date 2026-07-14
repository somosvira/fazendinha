import { prisma } from "../db.js";
import type { Context } from "hono";
import { z } from "zod";

// Multi-propriedade — resolução de escopo num só lugar (Fatia 0 = fundação).
// Fazenda de 1 sítio: a principal é resolvida por default e a camada fica invisível.

export interface PropriedadeDTO {
  id: number;
  nome: string;
  apelido: string | null;
  cidade: string | null;
  uf: string | null;
  principal: boolean;
  ativo: boolean;
  ordem: number;
}

const dto = (p: {
  id: number; nome: string; apelido: string | null; cidade: string | null; uf: string | null; principal: boolean; ativo: boolean; ordem: number;
}): PropriedadeDTO => ({ id: p.id, nome: p.nome, apelido: p.apelido, cidade: p.cidade, uf: p.uf, principal: p.principal, ativo: p.ativo, ordem: p.ordem });

export async function listarPropriedades(): Promise<PropriedadeDTO[]> {
  const ps = await prisma.propriedade.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }] });
  return ps.map(dto);
}

// id da propriedade principal (default de escrita). Cache de processo — a principal
// não muda em runtime; invalida sozinho se o processo reiniciar.
let _principalId: number | null = null;
export async function propriedadePrincipalId(): Promise<number> {
  if (_principalId != null) return _principalId;
  const p =
    (await prisma.propriedade.findFirst({ where: { principal: true }, orderBy: { id: "asc" } })) ??
    (await prisma.propriedade.findFirst({ orderBy: { id: "asc" } }));
  if (!p) throw new Error("nenhuma propriedade cadastrada");
  _principalId = p.id;
  return p.id;
}

// Escopo default de leitura quando NÃO há request HTTP para consultar (ex.:
// mensagens do WhatsApp): 1 sítio → a principal (invisível); N → consolidado.
export async function escopoPadraoLeitura(): Promise<number | null> {
  const total = await prisma.propriedade.count({ where: { ativo: true } });
  return total <= 1 ? propriedadePrincipalId() : null;
}

// Escopo de LEITURA a partir do request (header X-Propriedade-Id ou ?propriedadeId=):
//   explícito            → aquele id
//   ausente + 1 sítio    → a principal (invisível)
//   ausente + N sítios   → null (consolidado, sem filtro)
export async function resolverEscopoLeitura(c: Context): Promise<number | null> {
  const raw = c.req.header("X-Propriedade-Id") ?? c.req.query("propriedadeId");
  if (raw != null && raw !== "") {
    const id = Number(raw);
    if (Number.isInteger(id)) return id;
  }
  return escopoPadraoLeitura();
}

// Garante a fundação em runtime, IDEMPOTENTE. Necessário porque prod aplica o
// schema via `prisma db push`, que NÃO roda o SQL de seed/backfill da migration —
// sem isto a tabela nasceria vazia e os propriedadeId ficariam NULL (a Fatia 1
// filtraria por principal e o rebanho todo sumiria). Chamado no boot.
// Nome neutro (não hardcoda "Rio Novo" — sistema é revendido); o dono renomeia na UI.
export async function garantirFundacaoPropriedade(): Promise<void> {
  const total = await prisma.propriedade.count();
  if (total === 0) {
    await prisma.propriedade.create({ data: { nome: "Propriedade principal", apelido: "Sede", principal: true } });
  }
  _principalId = null; // invalida cache; recomputa a principal (recém-criada ou existente)
  const pid = await propriedadePrincipalId();
  await prisma.animal.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.grupo.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.movimentoEstoque.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.lancamento.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.loteCorte.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.piquete.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.talhao.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.lavoura.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.funcionario.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.safraCultivo.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.silo.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
  await prisma.caixinha.updateMany({ where: { propriedadeId: null }, data: { propriedadeId: pid } });
}

// ── Cadastro de propriedades (Fatia 1) ──────────────────────────────────────
export class PropriedadeError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "NOME_DUPLICADO", m: string) {
    super(m);
  }
}

export const propriedadeSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(80),
  apelido: z.string().max(40).optional(),
  cidade: z.string().max(80).optional(),
  uf: z.string().length(2, "UF deve ter 2 letras").optional(),
  principal: z.boolean().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});
export type PropriedadeInput = z.infer<typeof propriedadeSchema>;

// Só uma principal por vez; ao marcar uma, desmarca as demais.
async function fixarPrincipalUnica(id: number) {
  await prisma.propriedade.updateMany({ where: { id: { not: id }, principal: true }, data: { principal: false } });
  _principalId = id;
}

export async function criarPropriedade(input: PropriedadeInput): Promise<PropriedadeDTO> {
  if (await prisma.propriedade.findUnique({ where: { nome: input.nome } })) throw new PropriedadeError("NOME_DUPLICADO", `propriedade ${input.nome} já existe`);
  const p = await prisma.propriedade.create({
    data: { nome: input.nome, apelido: input.apelido, cidade: input.cidade, uf: input.uf?.toUpperCase(), principal: input.principal ?? false, ativo: input.ativo ?? true, ordem: input.ordem ?? 0 },
  });
  if (input.principal) await fixarPrincipalUnica(p.id);
  return dto(p);
}

export async function editarPropriedade(id: number, input: PropriedadeInput): Promise<PropriedadeDTO> {
  if (!(await prisma.propriedade.findUnique({ where: { id } }))) throw new PropriedadeError("NAO_ENCONTRADO", "propriedade não encontrada");
  const homonima = await prisma.propriedade.findUnique({ where: { nome: input.nome } });
  if (homonima && homonima.id !== id) throw new PropriedadeError("NOME_DUPLICADO", `propriedade ${input.nome} já existe`);
  const p = await prisma.propriedade.update({
    where: { id },
    data: { nome: input.nome, apelido: input.apelido, cidade: input.cidade, uf: input.uf?.toUpperCase(), principal: input.principal, ativo: input.ativo, ordem: input.ordem },
  });
  if (input.principal) await fixarPrincipalUnica(id);
  else _principalId = null; // a principal pode ter mudado noutro campo; recomputa on demand
  return dto(p);
}

// Escopo de ESCRITA: id explícito no payload → header/query (site ativo) → principal.
export async function resolverEscopoEscrita(c: Context, explicitoId?: number | null): Promise<number> {
  if (explicitoId != null) return explicitoId;
  const raw = c.req.header("X-Propriedade-Id") ?? c.req.query("propriedadeId");
  if (raw != null && raw !== "") {
    const id = Number(raw);
    if (Number.isInteger(id)) return id;
  }
  return propriedadePrincipalId();
}
