import { linhasProducaoGeralTx } from "./producao-geral-consulta.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { consultarPopulacaoPeriodoLeiteTx } from "./populacao-periodo.js";
import { folhaLeiteDTO } from "./producao.js";
import { resumirProducao } from "./producao.calc.js";
import { dataLeiteSchema } from "./schemas.js";
import { RebanhoError, hojeFazendaDate } from "../rebanho/regras.js";

export const consultaProducaoLeiteSchema = z.object({
  inicio: dataLeiteSchema, fim: dataLeiteSchema,
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
  animalId: z.string().uuid().optional(), posicaoId: z.string().uuid().optional(),
  natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO", "A_CLASSIFICAR"]).optional(),
  agrupamento: z.enum(["DIA", "MES"]).optional(),
  pagina: z.coerce.number().int().positive().max(100000).default(1), tamanho: z.coerce.number().int().min(1).max(100).default(30),
}).strict().refine(v => v.inicio <= v.fim && (Date.parse(v.fim) - Date.parse(v.inicio)) / 86400000 < 366,
  "Consulte até 366 dias, com início anterior ao fim");
export type ConsultaProducaoLeite = z.infer<typeof consultaProducaoLeiteSchema>;

type FiltroProducao = ConsultaProducaoLeite & { pagina: number; tamanho: number };
type EstadoDia = "FINALIDADE_PENDENTE" | "SEM_ANIMAIS_ELEGIVEIS" | "SEM_FOLHA" | "SEM_PARTICIPANTES" | "COMPLETA" | "PARCIAL";

/** Linhas, ritmo diário e ordenhas de um sítio, sem paginação. */
async function calcularSitioTx(tx: Prisma.TransactionClient, propriedadeId: number, filtro: FiltroProducao) {
    const where = { propriedadeId, dataOperacional: { gte: new Date(filtro.inicio), lte: new Date(filtro.fim) } };
    const quantidade = await tx.medicaoLeite.count({ where: { sessao: { dia: where } } });
    if (quantidade > 50_000) throw new RebanhoError("VALIDACAO", "Consulte um período menor: limite de 50 mil medições");
    const incluirEntrada = { movimento: { select: { produtoId: true, quantidade: true } }, classificacoes: { orderBy: { versao: "desc" as const }, take: 1 } };
    const dias = await tx.diaProducaoLeite.findMany({ where, include: {
      configuracao: { include: { ordenhas: { orderBy: { ordem: "asc" } } } },
      sessoes: { include: { entradasEstoque: { include: incluirEntrada } }, orderBy: { ordem: "asc" } },
      participantes: { include: { medicoes: { include: { origensEstoque: { where: { ativo: true }, include: { entrada: { include: incluirEntrada } } } } } }, orderBy: [{ brinco: "asc" }, { animalId: "asc" }] },
    }, orderBy: { dataOperacional: "asc" } });
    const folhas = dias.map(folhaLeiteDTO);
    const populacao = await consultarPopulacaoPeriodoLeiteTx(tx, propriedadeId, filtro.inicio, filtro.fim, filtro.animalId);
    const individuais = folhas.filter(f => !!filtro.animalId || f.configuracao?.fonteProducao !== "GERAL").flatMap(f => f.animais.flatMap(a => a.medicoes.map(m => ({
      fonte: "INDIVIDUAL" as const, tanqueId: null, data: f.dataOperacional, animalId: a.animalId, brinco: a.brinco, nome: a.nome, finalidade: a.finalidade,
      posicaoId: m.posicaoId, ordenha: f.sessoes.find(s => s.posicaoId === m.posicaoId)?.nome ?? "Ordenha",
      natureza: m.confirmacaoEstoque?.natureza && m.confirmacaoEstoque.natureza !== "NAO_INFORMADA" ? m.confirmacaoEstoque.natureza : "A_CLASSIFICAR", estado: m.estado, litros: m.litros,
      confirmada: m.confirmacaoEstoque !== null,
    })))).filter(l => (!filtro.animalId || l.animalId === filtro.animalId) &&
      (!filtro.posicaoId || l.posicaoId === filtro.posicaoId) && (!filtro.natureza || l.natureza === filtro.natureza));
    const gerais = filtro.animalId ? [] : (await linhasProducaoGeralTx(tx, dias)).filter(l => (!filtro.posicaoId || l.posicaoId === filtro.posicaoId) && (!filtro.natureza || l.natureza === filtro.natureza));
    const linhas = [...individuais, ...gerais].sort((a,b) => a.data.localeCompare(b.data) || a.ordenha.localeCompare(b.ordenha) || a.brinco.localeCompare(b.brinco));
    const ritmo = [];
    for (let d = new Date(filtro.inicio); d <= new Date(filtro.fim); d.setUTCDate(d.getUTCDate() + 1)) {
      const data = d.toISOString().slice(0, 10), celulas = linhas.filter(l => l.data === data);
      const totais = resumirProducao(celulas);
      const contexto = populacao.find(p => p.data === data)!;
      const temFolha = folhas.some(f => f.dataOperacional === data);
      const geral = !filtro.animalId && folhas.some(f => f.dataOperacional === data && f.configuracao?.fonteProducao === "GERAL");
      const pendente = !geral && (contexto.estado === "FINALIDADE_PENDENTE" || celulas.some(c => c.finalidade && c.finalidade.estado !== "COMPROVADA"));
      const estado: EstadoDia = pendente ? "FINALIDADE_PENDENTE" : !temFolha
        ? contexto.estado === "SEM_ANIMAIS_ELEGIVEIS" ? "SEM_ANIMAIS_ELEGIVEIS" : "SEM_FOLHA"
        : !celulas.length ? !geral && contexto.estado === "SEM_ANIMAIS_ELEGIVEIS" ? "SEM_ANIMAIS_ELEGIVEIS" : "SEM_PARTICIPANTES" : totais.completa ? "COMPLETA" : "PARCIAL";
      ritmo.push({ data, ...totais, estado });
    }
    // Posições e rótulos vêm de cada folha histórica. Nenhum turno é fixado no cliente.
    const ordenhas = [...new Map(folhas.flatMap(f => f.sessoes.map(s => [s.posicaoId, {
      posicaoId: s.posicaoId, nome: s.nome, ordem: s.ordem,
    }] as const))).values()].sort((a, b) => a.ordem - b.ordem || a.posicaoId.localeCompare(b.posicaoId));
    return { linhas, ritmo, ordenhas };
}
type LinhaProducao = Awaited<ReturnType<typeof calcularSitioTx>>["linhas"][number];
type DiaRitmo = Awaited<ReturnType<typeof calcularSitioTx>>["ritmo"][number];
type Ordenha = Awaited<ReturnType<typeof calcularSitioTx>>["ordenhas"][number];

/** Agrupamentos, cobertura e paginação a partir das linhas já filtradas (um sítio ou vários). */
function montarConsulta(filtro: FiltroProducao, linhas: LinhaProducao[], ritmo: DiaRitmo[], ordenhas: Ordenha[], exportacao: boolean) {
    const agrupar = (chave: (linha: LinhaProducao) => string) => {
      const grupos = new Map<string, LinhaProducao[]>();
      for (const linha of linhas) { const id = chave(linha); const grupo = grupos.get(id) ?? []; grupo.push(linha); grupos.set(id, grupo); }
      return [...grupos].map(([id, grupo]) => ({ id, ...resumirProducao(grupo) }));
    };
    const gruposPorPeriodo = new Map<string, DiaRitmo[]>();
    for (const dia of ritmo) {
      const chave = filtro.agrupamento === "MES" ? dia.data.slice(0, 7) : dia.data;
      const grupo = gruposPorPeriodo.get(chave) ?? [];
      grupo.push(dia); gruposPorPeriodo.set(chave, grupo);
    }
    const grupos = [...gruposPorPeriodo].map(([periodo, diasGrupo]) => {
      const datas = new Set(diasGrupo.map(d => d.data));
      const selecionadas = linhas.filter(l => datas.has(l.data));
      const medidas = selecionadas.filter(l => l.estado === "MEDIDO" && l.litros !== null);
      const origensComprovadas = medidas.length > 0 && medidas.every(l => l.fonte === "INDIVIDUAL" ? !!l.animalId : "animaisOrigem" in l && l.animaisOrigem.length > 0);
      const vacasOrdenhadas = filtro.agrupamento === "MES" || !origensComprovadas ? null : new Set(medidas.flatMap(l => l.fonte === "INDIVIDUAL" ? [l.animalId!] : "animaisOrigem" in l ? l.animaisOrigem : [])).size;
      const resumo = resumirProducao(selecionadas);
      const completa = diasGrupo.every(d => d.estado === "COMPLETA" || d.estado === "SEM_ANIMAIS_ELEGIVEIS");
      const mediaPorVaca = completa && vacasOrdenhadas !== null && vacasOrdenhadas > 0 && resumo.litros !== null ? new Prisma.Decimal(resumo.litros).div(vacasOrdenhadas).toNumber() : null;
      return { periodo, ...resumo, vacasOrdenhadas, mediaPorVaca, completa,
        turnos: ordenhas.filter(o => !filtro.posicaoId || filtro.posicaoId === o.posicaoId).map(o => ({
          ...o, ...resumirProducao(selecionadas.filter(l => l.posicaoId === o.posicaoId)),
        })),
      };
    });
    const hoje = hojeFazendaDate().toISOString().slice(0, 10);
    return { periodo: { inicio: filtro.inicio, fim: filtro.fim },
      mesEmAndamento: filtro.inicio.slice(0, 7) === hoje.slice(0, 7) || filtro.fim.slice(0, 7) === hoje.slice(0, 7),
      totais: resumirProducao(linhas), ritmo,
      agrupamento: filtro.agrupamento ?? "DIA", ordenhas, grupos,
      coberturaCompleta: ritmo.length > 0 && ritmo.every(d => d.estado === "COMPLETA" || d.estado === "SEM_ANIMAIS_ELEGIVEIS"),
      porAnimal: agrupar(l => l.animalId ?? "").filter(g => g.id !== ""), porOrdenha: agrupar(l => l.posicaoId), porNatureza: agrupar(l => l.natureza),
      itens: exportacao ? linhas : linhas.slice((filtro.pagina - 1) * filtro.tamanho, filtro.pagina * filtro.tamanho),
      total: linhas.length, pagina: filtro.pagina, tamanho: filtro.tamanho,
    };
}

/**
 * Situação consolidada de um dia: completa só quando todo sítio com animais está completo;
 * qualquer pendência de finalidade prevalece; sem folha em nenhum sítio continua sem folha.
 */
export function combinarEstadosDia(estados: EstadoDia[]): EstadoDia {
  if (estados.includes("FINALIDADE_PENDENTE")) return "FINALIDADE_PENDENTE";
  if (estados.every(e => e === "SEM_ANIMAIS_ELEGIVEIS")) return "SEM_ANIMAIS_ELEGIVEIS";
  if (estados.every(e => e === "COMPLETA" || e === "SEM_ANIMAIS_ELEGIVEIS")) return "COMPLETA";
  if (estados.every(e => e === "SEM_FOLHA" || e === "SEM_ANIMAIS_ELEGIVEIS")) return "SEM_FOLHA";
  if (estados.every(e => e === "SEM_PARTICIPANTES" || e === "SEM_FOLHA" || e === "SEM_ANIMAIS_ELEGIVEIS")) return "SEM_PARTICIPANTES";
  return "PARCIAL";
}

/**
 * Consulta medições pela data de produção; retirada e fechamento não são fontes de litros.
 * `propriedadeId` null = Consolidado: soma os sítios ativos, agrupa ordenhas pelo nome do turno
 * e devolve a produção de cada sítio em `porSitio`.
 */
export async function consultarProducaoLeite(propriedadeId: number | null, input: ConsultaProducaoLeite, exportacao = false) {
  const filtro = consultaProducaoLeiteSchema.parse(input);
  return prisma.$transaction(async tx => {
    if (propriedadeId != null) {
      const { linhas, ritmo, ordenhas } = await calcularSitioTx(tx, propriedadeId, filtro);
      return { propriedadeId, consolidado: false as const, ...montarConsulta(filtro, linhas, ritmo, ordenhas, exportacao) };
    }
    const sitios = await tx.propriedade.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: [{ principal: "desc" }, { nome: "asc" }] });
    const chaveTurno = (nome: string) => `turno:${nome.trim().toLocaleLowerCase("pt-BR")}`;
    const porSitioCalculado: Array<{ sitio: { id: number; nome: string }; ritmo: DiaRitmo[]; ordenhas: Ordenha[]; linhas: Array<LinhaProducao & { propriedadeId: number; sitio: string }> }> = [];
    for (const sitio of sitios) {
      const calculo = await calcularSitioTx(tx, sitio.id, { ...filtro, posicaoId: undefined });
      const nomeDaPosicao = new Map(calculo.ordenhas.map(o => [o.posicaoId, o.nome]));
      porSitioCalculado.push({ sitio, ...calculo, linhas: calculo.linhas.map(l => ({ ...l, propriedadeId: sitio.id, sitio: sitio.nome, posicaoId: chaveTurno(nomeDaPosicao.get(l.posicaoId) ?? l.ordenha) })) });
    }
    const turnos = new Map<string, Ordenha>();
    for (const o of porSitioCalculado.flatMap(c => c.ordenhas)) {
      const id = chaveTurno(o.nome), atual = turnos.get(id);
      if (!atual || o.ordem < atual.ordem) turnos.set(id, { posicaoId: id, nome: o.nome, ordem: o.ordem });
    }
    const ordenhas = [...turnos.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    const linhas = porSitioCalculado.flatMap(c => c.linhas).filter(l => !filtro.posicaoId || l.posicaoId === filtro.posicaoId)
      .sort((a, b) => a.data.localeCompare(b.data) || a.ordenha.localeCompare(b.ordenha) || a.sitio.localeCompare(b.sitio) || a.brinco.localeCompare(b.brinco));
    const ritmo = (porSitioCalculado[0]?.ritmo ?? []).map(dia => ({
      data: dia.data, ...resumirProducao(linhas.filter(l => l.data === dia.data)),
      estado: combinarEstadosDia(porSitioCalculado.map(c => c.ritmo.find(r => r.data === dia.data)!.estado)),
    }));
    return { propriedadeId: null, consolidado: true as const, ...montarConsulta(filtro, linhas, ritmo, ordenhas, exportacao),
      porSitio: porSitioCalculado.map(c => ({ propriedadeId: c.sitio.id, nome: c.sitio.nome, ...resumirProducao(c.linhas.filter(l => !filtro.posicaoId || l.posicaoId === filtro.posicaoId)) })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
