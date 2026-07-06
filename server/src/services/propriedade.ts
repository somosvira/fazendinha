import { prisma } from "../db.js";
import type { Context } from "hono";

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
  const total = await prisma.propriedade.count({ where: { ativo: true } });
  return total <= 1 ? propriedadePrincipalId() : null;
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
}
