import { prisma } from "../../db.js";
import { inicioDePalavra } from "../../lib/busca-palavras.js";
import type { ConsultaCatalogo } from "./catalogos.schemas.js";

// Mesma normalização de public.normalizar_nome_produto_v1 (migration 20261108120000).
const ACENTOS_ORIGEM = "ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ";
const ACENTOS_DESTINO = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy";
export function normalizarNomeCatalogo(nome: string): string {
  return [...nome.trim().replace(/\s+/g, " ")].map(c => { const i = ACENTOS_ORIGEM.indexOf(c); return i < 0 ? c : ACENTOS_DESTINO[i]; }).join("").toLowerCase();
}

// Filtro comum às consultas dos catálogos: situação (ou o item selecionado) e busca por início de palavra no nome normalizado.
function filtro(input: ConsultaCatalogo) {
  return {
    ...(input.selecionadoId ? { id: input.selecionadoId } : input.ativo === undefined ? {} : { ativo: input.ativo === "true" }),
    ...inicioDePalavra("nomeNormalizado", normalizarNomeCatalogo(input.busca)),
  };
}
function paginar(total: number, input: ConsultaCatalogo) {
  const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
  return { pagina, skip: (pagina - 1) * input.porPagina, take: input.porPagina };
}
const ordem = [{ nomeNormalizado: "asc" as const }, { id: "asc" as const }];
const resposta = <T extends { nomeNormalizado: string }>(itens: T[], total: number, pagina: number, porPagina: number) =>
  ({ itens: itens.map(({ nomeNormalizado, ...item }) => item), total, pagina, porPagina });

export const listarFabricantes = (input: ConsultaCatalogo) => prisma.$transaction(async tx => {
  const where = filtro(input), total = await tx.fabricanteProduto.count({ where }), p = paginar(total, input);
  return resposta(await tx.fabricanteProduto.findMany({ where, orderBy: ordem, skip: p.skip, take: p.take }), total, p.pagina, input.porPagina);
}, { isolationLevel: "RepeatableRead" });
export const listarClassificacoesTecnicas = (input: ConsultaCatalogo) => prisma.$transaction(async tx => {
  const where = filtro(input), total = await tx.classificacaoTecnicaProduto.count({ where }), p = paginar(total, input);
  return resposta(await tx.classificacaoTecnicaProduto.findMany({ where, orderBy: ordem, skip: p.skip, take: p.take }), total, p.pagina, input.porPagina);
}, { isolationLevel: "RepeatableRead" });
export const listarPrincipiosAtivos = (input: ConsultaCatalogo) => prisma.$transaction(async tx => {
  const where = filtro(input), total = await tx.principioAtivo.count({ where }), p = paginar(total, input);
  return resposta(await tx.principioAtivo.findMany({ where, orderBy: ordem, skip: p.skip, take: p.take }), total, p.pagina, input.porPagina);
}, { isolationLevel: "RepeatableRead" });
