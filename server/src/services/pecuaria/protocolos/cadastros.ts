import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { consultaCadastroProtocoloSchema, consultaAcoesCadastroSchema, type ConsultaCadastroProtocolo } from "./cadastros.schemas.js";
const metaSelect = { id: true, nome: true, descricao: true, tipo: true, versao: true, ativo: true, publicado: true, publicadoEm: true, atualizadoEm: true, referenciaTecnica: true, _count: { select: { etapas: true, execucoes: true, rodadas: true } } } as const;
type Meta = Prisma.ProtocoloGetPayload<{ select: typeof metaSelect }>;
function apresentarMeta(p: Meta) {
  const { _count, ...dados } = p;
  return { ...dados, totalEtapas: _count.etapas, utilizada: _count.execucoes > 0 || _count.rodadas > 0 };
}
export function filtroCadastroProtocolo(input: ConsultaCadastroProtocolo): Prisma.ProtocoloWhereInput {
  return { tipo: input.tipo,
    ...(input.busca ? { OR: [{ nome: { contains: input.busca, mode: "insensitive" } }, { descricao: { contains: input.busca, mode: "insensitive" } }] } : {}),
    ...(input.situacao === "INATIVA" ? { ativo: false } : input.situacao === "RASCUNHO" ? { ativo: true, publicado: false, publicadoEm: null } : input.situacao === "PUBLICADA" ? { ativo: true, publicado: true } : {}),
  };
}
const paginaValida = (total: number, pagina: number, porPagina: number) => Math.min(pagina, Math.max(1, Math.ceil(total / porPagina)));
/** Contagem e página compartilham o mesmo snapshot, sem carregar árvores de ações. */
export async function listarCadastrosProtocolos(input: ConsultaCadastroProtocolo) {
  const f = consultaCadastroProtocoloSchema.parse(input);
  return prisma.$transaction(async tx => {
    const where = filtroCadastroProtocolo(f);
    const total = await tx.protocolo.count({ where });
    const pagina = paginaValida(total, f.pagina, f.porPagina);
    const itens = await tx.protocolo.findMany({ where, select: metaSelect, orderBy: [{ nome: "asc" }, { versao: "desc" }, { id: "asc" }], skip: (pagina - 1) * f.porPagina, take: f.porPagina });
    return { itens: itens.map(apresentarMeta), total, pagina, porPagina: f.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
export async function obterCadastroProtocolo(id: string) {
  return prisma.$transaction(async tx => {
    const p = await tx.protocolo.findUnique({ where: { id }, select: metaSelect });
    if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Versão de protocolo não encontrada");
    const ultima = await tx.protocolo.findFirst({ where: { tipo: p.tipo, nome: p.nome }, select: { versao: true }, orderBy: { versao: "desc" } });
    return { ...apresentarMeta(p), proximaVersao: (ultima?.versao ?? p.versao) + 1 };
  }, { isolationLevel: "RepeatableRead" });
}
export async function listarAcoesCadastroProtocolo(id: string, input: unknown) {
  const f = consultaAcoesCadastroSchema.parse(input);
  return prisma.$transaction(async tx => {
    const p = await tx.protocolo.findUnique({ where: { id }, select: { tipo: true, atualizadoEm: true } });
    if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Versão de protocolo não encontrada");
    if (f.revisao && p.atualizadoEm.toISOString() !== f.revisao) throw new RebanhoError("CONFLITO", "Esta versão mudou. Feche o editor e abra novamente para carregar as ações atuais.");
    const where = { protocoloId: id };
    const total = await tx.etapaProtocolo.count({ where });
    const pagina = paginaValida(total, f.pagina, f.porPagina);
    const etapas = await tx.etapaProtocolo.findMany({ where, include: { momento: { select: { nome: true, ordem: true } } }, orderBy: [{ ordem: "asc" }, { id: "asc" }], skip: (pagina - 1) * f.porPagina, take: f.porPagina });
    const itens = etapas.map(e => p.tipo === "REPRODUTIVO"
      ? { ...(e.configuracao && typeof e.configuracao === "object" && !Array.isArray(e.configuracao) ? e.configuracao : {}), id: e.id, ordem: e.ordem, momento: e.momento }
      : { id: e.id, ordem: e.ordem, nome: e.nome, tipo: e.tipo, diaRelativo: e.diaRelativo, produtoId: e.produtoId, tipoExameId: e.tipoExameId, tipoAplicacaoId: e.tipoAplicacaoId, tipoAplicacaoNomeSnapshot: e.tipoAplicacaoNomeSnapshot, dose: e.dose?.toString() ?? null, unidade: e.unidade, via: e.via, configuracao: e.configuracao, momento: e.momento });
    return { itens, total, pagina, porPagina: f.porPagina, revisao: p.atualizadoEm.toISOString() };
  }, { isolationLevel: "RepeatableRead" });
}
