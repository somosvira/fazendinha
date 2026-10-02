import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { nomeExameHistorico } from "./exames.js";

const animal = { select: { id: true, brinco: true, nome: true } } as const;
const ocorrencia = { select: { id: true, doencaNomeSnapshot: true, inicio: true, fim: true, status: true } } as const;
const tarefa = { select: { id: true, previstaPara: true, dispensadaEm: true, execucaoId: true, parametros: true } } as const;
const escopo = (id: string, propriedadeId: number | null) => ({ id, ...(propriedadeId == null ? {} : { propriedadeId }) });

export async function obterOcorrencia(id: string, propriedadeId: number | null) {
  const fato = await prisma.ocorrenciaSanitaria.findFirst({ where: escopo(id, propriedadeId), include: {
    animal, doenca: { select: { id: true, nome: true } },
    aplicacoes: { where: propriedadeId == null ? {} : { propriedadeId }, orderBy: { data: "desc" } },
    exames: { where: propriedadeId == null ? {} : { propriedadeId }, orderBy: { data: "desc" }, include: { tipoExame: { select: { nome: true } } } },
    execucoes: { where: propriedadeId == null ? {} : { propriedadeId }, include: { protocolo: { select: { nome: true, versao: true } } } },
  } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Ocorrência não encontrada neste sítio");
  return { ...fato, doenca: { ...fato.doenca, nome: fato.doencaNomeSnapshot ?? fato.doenca.nome },
    exames: fato.exames.map((e) => ({ ...e, tipoExame: { nome: nomeExameHistorico(e.formatoSnapshot, e.tipoExame.nome) } })) };
}

export async function obterAplicacao(id: string, propriedadeId: number | null) {
  const fato = await prisma.aplicacaoProduto.findFirst({ where: escopo(id, propriedadeId), include: {
    animal, ocorrencia, tarefa,
    movimentoEstoque: { select: { id: true, data: true, origem: true, operacaoId: true, itemOperacaoId: true } },
  } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada neste sítio");
  return fato;
}

export async function obterExame(id: string, propriedadeId: number | null) {
  const fato = await prisma.exameAnimal.findFirst({ where: escopo(id, propriedadeId), include: { animal, ocorrencia, tarefa, tipoExame: { select: { nome: true } } } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado neste sítio");
  return { ...fato, tipoExame: { nome: nomeExameHistorico(fato.formatoSnapshot, fato.tipoExame.nome) } };
}

export async function obterExecucao(id: string, propriedadeId: number | null) {
  const fato = await prisma.execucaoProtocoloSanitario.findFirst({ where: escopo(id, propriedadeId), include: {
    animal, ocorrencia, protocolo: { include: { etapas: { orderBy: { ordem: "asc" } } } },
    tarefas: { orderBy: { previstaPara: "asc" }, include: {
      aplicacoes: { where: propriedadeId == null ? {} : { propriedadeId }, select: { id: true, data: true, status: true, nomeProdutoAplicado: true } },
      exames: { where: propriedadeId == null ? {} : { propriedadeId }, select: { id: true, data: true, status: true, formatoSnapshot: true } },
    } },
  } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Execução não encontrada neste sítio");
  return fato;
}

/** Valores podem aparecer também nos fatos vinculados de uma ocorrência. */
export function ocultarCustosDetalhe(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ocultarCustosDetalhe);
  if (!valor || typeof valor !== "object" || valor instanceof Date || "toJSON" in valor) return valor;
  return Object.fromEntries(Object.entries(valor).map(([campo, v]) => [campo,
    campo === "valorProdutoAtribuido" || campo === "valorServicoAtribuido" ? null : ocultarCustosDetalhe(v)]));
}
