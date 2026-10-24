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
  animalId: z.string().uuid().optional(), posicaoId: z.string().uuid().optional(),
  natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO", "A_CLASSIFICAR"]).optional(),
  pagina: z.coerce.number().int().positive().default(1), tamanho: z.coerce.number().int().min(1).max(100).default(30),
}).strict().refine(v => v.inicio <= v.fim && (Date.parse(v.fim) - Date.parse(v.inicio)) / 86400000 < 366,
  "Consulte até 366 dias, com início anterior ao fim");
export type ConsultaProducaoLeite = z.infer<typeof consultaProducaoLeiteSchema>;

/** Consulta medições pela data de produção; retirada e fechamento não são fontes de litros. */
export async function consultarProducaoLeite(propriedadeId: number, input: ConsultaProducaoLeite, exportacao = false) {
  const filtro = consultaProducaoLeiteSchema.parse(input);
  return prisma.$transaction(async tx => {
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
      const estado = pendente ? "FINALIDADE_PENDENTE" : !temFolha
        ? contexto.estado === "SEM_ANIMAIS_ELEGIVEIS" ? "SEM_ANIMAIS_ELEGIVEIS" : "SEM_FOLHA"
        : !celulas.length ? !geral && contexto.estado === "SEM_ANIMAIS_ELEGIVEIS" ? "SEM_ANIMAIS_ELEGIVEIS" : "SEM_PARTICIPANTES" : totais.completa ? "COMPLETA" : "PARCIAL";
      ritmo.push({ data, ...totais, estado });
    }
    const agrupar = (chave: (linha: typeof linhas[number]) => string) => {
      const grupos = new Map<string, typeof linhas>();
      for (const linha of linhas) { const id = chave(linha); const grupo = grupos.get(id) ?? []; grupo.push(linha); grupos.set(id, grupo); }
      return [...grupos].map(([id, grupo]) => ({ id, ...resumirProducao(grupo) }));
    };
    const hoje = hojeFazendaDate().toISOString().slice(0, 10);
    return { propriedadeId, periodo: { inicio: filtro.inicio, fim: filtro.fim },
      mesEmAndamento: filtro.inicio.slice(0, 7) === hoje.slice(0, 7) || filtro.fim.slice(0, 7) === hoje.slice(0, 7),
      totais: resumirProducao(linhas), ritmo,
      coberturaCompleta: ritmo.length > 0 && ritmo.every(d => d.estado === "COMPLETA" || d.estado === "SEM_ANIMAIS_ELEGIVEIS"),
      porAnimal: agrupar(l => l.animalId ?? "").filter(g => g.id !== ""), porOrdenha: agrupar(l => l.posicaoId), porNatureza: agrupar(l => l.natureza),
      itens: exportacao ? linhas : linhas.slice((filtro.pagina - 1) * filtro.tamanho, filtro.pagina * filtro.tamanho),
      total: linhas.length, pagina: filtro.pagina, tamanho: filtro.tamanho,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
