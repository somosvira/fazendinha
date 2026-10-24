import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { consultaAcoesCadastroSchema } from "./cadastros.schemas.js";

const procedimentoSelect = {
  id: true, nome: true, tipo: true, diaRelativo: true, unidadeIntervalo: true,
  configuracao: true, dose: true, unidade: true, via: true, tipoAplicacaoNomeSnapshot: true,
  produto: { select: { nome: true } }, tipoExame: { select: { nome: true } },
  material: { select: { produto: { select: { nome: true, unidade: true } } } },
} as const;
type Procedimento = Prisma.EtapaProtocoloGetPayload<{ select: typeof procedimentoSelect }>;
const objeto = (value: Prisma.JsonValue | undefined): Prisma.JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const texto = (value: Prisma.JsonValue | undefined) => typeof value === "string" && value.trim() ? value : null;
/** Somente dados do modelo: não inclui custos, saldos ou fatos de animais. */
export function apresentarProcedimentoCadastro(e: Procedimento) {
  const c = objeto(e.configuracao), refs = objeto(c.referencias), aplicacao = objeto(c.planoAplicacao);
  const produto = objeto(refs.produto), produtoSnapshot = objeto(c.produtoSnapshot), exame = objeto(refs.exame), material = objeto(refs.material);
  const tentativa = objeto(c.planoTentativa);
  const tipoTentativa = texto(c.tentativaTipo) ?? texto(tentativa.tipo);
  const procedimento = e.tipo === "APLICACAO" ? (c.subtipo === "INSERCAO_DISPOSITIVO" ? "Inserção de dispositivo" : "Aplicação de produto")
    : e.tipo === "RETIRADA" ? "Retirada de dispositivo"
    : e.tipo === "TENTATIVA" ? (tipoTentativa === "TE" ? "Transferência de embrião" : tipoTentativa === "IA" ? "Inseminação artificial" : "Tentativa reprodutiva")
    : e.tipo === "EXAME" || e.tipo === "AVALIACAO" ? "Exame / diagnóstico" : "Manejo cadastrado";
  return { id: e.id, nome: e.nome, procedimento,
    intervalo: typeof c.intervalo === "number" ? c.intervalo : e.diaRelativo,
    unidadeIntervalo: texto(c.unidade) ?? e.unidadeIntervalo,
    referencia: e.tipo === "APLICACAO" ? texto(produto.nome) ?? texto(produtoSnapshot.nome) ?? e.produto?.nome ?? null
      : e.tipo === "EXAME" || e.tipo === "AVALIACAO" ? texto(exame.nome) ?? e.tipoExame?.nome ?? null
      : e.tipo === "TENTATIVA" ? texto(material.produtoNome) ?? texto(material.nome) ?? texto(objeto(material.produto).nome) ?? e.material?.produto.nome ?? null : null,
    definirMaterialNoAtendimento: e.tipo === "TENTATIVA" && !e.material && !Object.keys(tentativa).length,
    quantidade: e.tipo === "APLICACAO" ? texto(aplicacao.dose) ?? e.dose?.toString() ?? null
      : e.tipo === "TENTATIVA" && typeof tentativa.quantidade === "number" ? String(tentativa.quantidade) : null,
    unidadeQuantidade: e.tipo === "APLICACAO" ? texto(aplicacao.unidadeDose) ?? e.unidade
      : e.tipo === "TENTATIVA" && Object.keys(tentativa).length ? texto(material.unidade) ?? e.material?.produto.unidade ?? null : null,
    via: texto(aplicacao.via) ?? e.via ?? texto(produto.viaPadrao) ?? texto(produtoSnapshot.viaPadrao),
    orientacaoUso: texto(produto.orientacaoUso) ?? texto(produtoSnapshot.orientacaoUso),
  };
}
const ordem = [{ ordem: "asc" }, { id: "asc" }] as const;
const paginaValida = (total: number, pagina: number, tamanho: number) => Math.min(pagina, Math.max(1, Math.ceil(total / tamanho)));
async function conferirVersao(tx: Prisma.TransactionClient, id: string, revisao?: string) {
  const p = await tx.protocolo.findUnique({ where: { id }, select: { atualizadoEm: true } });
  if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Versão de protocolo não encontrada");
  if (revisao && p.atualizadoEm.toISOString() !== revisao) throw new RebanhoError("CONFLITO", "Esta versão mudou. Feche os detalhes e consulte a lista novamente.");
}
/** Etapas explícitas primeiro; procedimentos sem grupo permanecem separados, em sua ordem original. */
export async function listarEstruturaCadastro(id: string, input: unknown) {
  const f = consultaAcoesCadastroSchema.parse(input);
  return prisma.$transaction(async tx => {
    await conferirVersao(tx, id, f.revisao);
    const totalMomentos = await tx.momentoProtocolo.count({ where: { protocoloId: id } });
    const totalSemEtapa = await tx.etapaProtocolo.count({ where: { protocoloId: id, momentoId: null } });
    const total = totalMomentos + totalSemEtapa, pagina = paginaValida(total, f.pagina, f.porPagina), skip = (pagina - 1) * f.porPagina;
    const momentos = skip < totalMomentos ? await tx.momentoProtocolo.findMany({
      where: { protocoloId: id }, orderBy: [...ordem], skip, take: Math.min(f.porPagina, totalMomentos - skip),
      select: { id: true, nome: true, instrucoesGerais: true, modoAtendimento: true, _count: { select: { etapas: true } },
        etapas: { orderBy: [...ordem], take: 10, select: procedimentoSelect } },
    }) : [];
    const avulsos = momentos.length < f.porPagina ? await tx.etapaProtocolo.findMany({
      where: { protocoloId: id, momentoId: null }, orderBy: [...ordem], skip: Math.max(0, skip - totalMomentos), take: f.porPagina - momentos.length, select: procedimentoSelect,
    }) : [];
    const itens = [...momentos.map(m => ({ id: m.id, nome: m.nome, agrupada: true, instrucoesGerais: m.instrucoesGerais, modoAtendimento: m.modoAtendimento,
      procedimentos: { itens: m.etapas.map(apresentarProcedimentoCadastro), total: m._count.etapas, pagina: 1, porPagina: 10 } })),
      ...avulsos.map(e => ({ id: e.id, nome: e.nome, agrupada: false, instrucoesGerais: null, modoAtendimento: null,
        procedimentos: { itens: [apresentarProcedimentoCadastro(e)], total: 1, pagina: 1, porPagina: 10 } }))];
    return { itens, total, pagina, porPagina: f.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
export async function listarProcedimentosEtapaCadastro(id: string, momentoId: string, input: unknown) {
  const f = consultaAcoesCadastroSchema.parse(input);
  return prisma.$transaction(async tx => {
    await conferirVersao(tx, id, f.revisao);
    const momento = await tx.momentoProtocolo.findFirst({ where: { id: momentoId, protocoloId: id }, select: { id: true } });
    if (!momento) throw new RebanhoError("NAO_ENCONTRADO", "Etapa não encontrada nesta versão");
    const where = { protocoloId: id, momentoId }, total = await tx.etapaProtocolo.count({ where });
    const pagina = paginaValida(total, f.pagina, f.porPagina);
    const itens = await tx.etapaProtocolo.findMany({ where, orderBy: [...ordem], skip: (pagina - 1) * f.porPagina, take: f.porPagina, select: procedimentoSelect });
    return { itens: itens.map(apresentarProcedimentoCadastro), total, pagina, porPagina: f.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
