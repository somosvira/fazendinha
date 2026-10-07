import { prisma } from "../../../db.js";
import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
import { nomeExameHistorico } from "./exames.js";
import { alocacaoLoteSanitario, loteAplicacaoDTO } from "./lotes.js";

const animal = { select: { id: true, brinco: true, nome: true } } as const;
const propriedade = { select: { id: true, nome: true } } as const;
const ocorrencia = { select: { id: true, doencaNomeSnapshot: true, inicio: true, fim: true, status: true } } as const;
const tarefa = { select: { id: true, previstaPara: true, dispensadaEm: true, execucaoId: true, parametros: true } } as const;
const escopo = (id: string, propriedadeId: number | null) => ({ id, ...(propriedadeId == null ? {} : { propriedadeId }) });

export async function obterOcorrencia(id: string, propriedadeId: number | null) {
  const fato = await prisma.ocorrenciaSanitaria.findFirst({ where: escopo(id, propriedadeId), include: {
    animal, propriedade, doenca: { select: { id: true, nome: true } },
    aplicacoes: { where: propriedadeId == null ? {} : { propriedadeId }, orderBy: { data: "desc" }, include: { movimentoEstoque: { select: { alocacaoPartidaEstoques: alocacaoLoteSanitario } } } },
    exames: { where: propriedadeId == null ? {} : { propriedadeId }, orderBy: { data: "desc" }, include: { tipoExame: { select: { nome: true } } } },
    execucoes: { where: propriedadeId == null ? {} : { propriedadeId }, include: { protocolo: { select: { nome: true, versao: true } } } },
  } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Ocorrência não encontrada neste sítio");
  return { ...fato, doenca: { ...fato.doenca, nome: fato.doencaNomeSnapshot ?? fato.doenca.nome },
    aplicacoes: fato.aplicacoes.map((a) => ({ ...a, ...loteAplicacaoDTO(a) })),
    exames: fato.exames.map((e) => ({ ...e, tipoExame: { nome: nomeExameHistorico(e.formatoSnapshot, e.tipoExame.nome) } })) };
}

export async function obterAplicacao(id: string, propriedadeId: number | null) {
  const fato = await prisma.aplicacaoProduto.findFirst({ where: escopo(id, propriedadeId), include: {
    animal, propriedade, ocorrencia, tarefa,
    produto: { select: { id: true, nome: true, unidade: true } },
    itemCompraDireta: { select: { id: true, quantidade: true, unidade: true, valorTotal: true,
      operacao: { select: { id: true, numero: true, descricao: true, data: true } } } },
    movimentoEstoque: { select: { id: true, data: true, origem: true, status: true, operacaoId: true, itemOperacaoId: true, revertidoPor: { select: { id: true } },
      alocacaoPartidaEstoques: { select: { partidaId: true, quantidade: true, partida: { select: { nome: true, codigo: true, validade: true, lotePrincipalId: true, lotePrincipal: { select: { nome: true } } } } } } } },
  } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada neste sítio");
  const { itemCompraDireta, ...historico } = fato;
  const soma = itemCompraDireta ? await prisma.aplicacaoProduto.aggregate({ where: { itemCompraDiretaId: itemCompraDireta.id, status: "VALIDO" }, _sum: { quantidadeCompraDireta: true } }) : null;
  const quantidadeDestinada = soma?._sum.quantidadeCompraDireta ?? new Prisma.Decimal(0);
  return { ...historico, ...loteAplicacaoDTO(fato), estorno: fato.movimentoEstoque?.revertidoPor ?? null, compraDireta: itemCompraDireta ? {
    ...itemCompraDireta, quantidade: itemCompraDireta.quantidade.toString(),
    quantidadeDestinada: quantidadeDestinada.toString(), quantidadeDisponivel: itemCompraDireta.quantidade.minus(quantidadeDestinada).toString(),
  } : null };
}

export async function obterExame(id: string, propriedadeId: number | null) {
  const fato = await prisma.exameAnimal.findFirst({ where: escopo(id, propriedadeId), include: { animal, propriedade, ocorrencia, tarefa, tipoExame: { select: { nome: true } } } });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado neste sítio");
  return { ...fato, tipoExame: { nome: nomeExameHistorico(fato.formatoSnapshot, fato.tipoExame.nome) } };
}

export async function obterExecucao(id: string, propriedadeId: number | null) {
  const fato = await prisma.execucaoProtocoloSanitario.findFirst({ where: escopo(id, propriedadeId), include: {
    animal, propriedade, ocorrencia, protocolo: { include: { etapas: { orderBy: { ordem: "asc" } } } },
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
    ["valor", "valorProdutoAtribuido", "valorServicoAtribuido", "valorTotal", "valorUnitario", "custoUnitario"].includes(campo) ? null : ocultarCustosDetalhe(v)]));
}
