import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { FinanceiroError } from "../../financeiro/regras.js";

/** Vínculos operacionais de um Serviço ou compra direta, sem criar nova despesa. */
export async function listarOrigemFinanceira(operacaoId: string, propriedadeId: number | null) {
  const operacao = await prisma.operacao.findFirst({ where: { id: operacaoId, ...(propriedadeId == null ? {} : { propriedadeId }) },
    select: { id: true, tipo: true, propriedadeId: true, valorTotal: true, itens: { select: { id: true, descricao: true, quantidade: true, unidade: true, produtoId: true, estocavel: true } } } });
  if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada neste sítio");
  const [aplicacoes, exames, execucoes] = await Promise.all([
    prisma.aplicacaoProduto.findMany({ where: { OR: [{ operacaoServicoId: operacaoId }, { itemCompraDiretaId: { in: operacao.itens.map((i) => i.id) } }] },
      select: { id: true, propriedadeId: true, animalId: true, animal: { select: { brinco: true } }, data: true, status: true, nomeProdutoAplicado: true, origemInsumo: true, quantidadeCompraDireta: true, itemCompraDiretaId: true, valorProdutoAtribuido: true, valorServicoAtribuido: true, operacaoServicoId: true } }),
    prisma.exameAnimal.findMany({ where: { operacaoServicoId: operacaoId }, select: { id: true, propriedadeId: true, animalId: true, animal: { select: { brinco: true } }, data: true, status: true, tipoExame: { select: { nome: true } }, valorServicoAtribuido: true } }),
    prisma.execucaoProtocoloSanitario.findMany({ where: { operacaoServicoId: operacaoId }, select: { id: true, propriedadeId: true, animalId: true, animal: { select: { brinco: true } }, inicio: true, canceladaEm: true, protocolo: { select: { nome: true } }, valorServicoAtribuido: true } }),
  ]);
  const fatos = [
    ...aplicacoes.map((a) => ({ tipo: "APLICACAO" as const, id: a.id, propriedadeId: a.propriedadeId, animalId: a.animalId, animalBrinco: a.animal.brinco, data: a.data, nome: a.nomeProdutoAplicado, situacao: a.status, origemInsumo: a.origemInsumo, itemCompraDiretaId: a.itemCompraDiretaId, quantidadeDestinada: a.quantidadeCompraDireta?.toString() ?? null, custoProduto: a.valorProdutoAtribuido?.toString() ?? null, rateioServico: a.valorServicoAtribuido?.toString() ?? null })),
    ...exames.map((e) => ({ tipo: "EXAME" as const, id: e.id, propriedadeId: e.propriedadeId, animalId: e.animalId, animalBrinco: e.animal.brinco, data: e.data, nome: e.tipoExame.nome, situacao: e.status, origemInsumo: null, itemCompraDiretaId: null, quantidadeDestinada: null, custoProduto: null, rateioServico: e.valorServicoAtribuido?.toString() ?? null })),
    ...execucoes.map((p) => ({ tipo: "PROTOCOLO" as const, id: p.id, propriedadeId: p.propriedadeId, animalId: p.animalId, animalBrinco: p.animal.brinco, data: p.inicio, nome: p.protocolo.nome, situacao: p.canceladaEm ? "CANCELADO" : "ATIVO", origemInsumo: null, itemCompraDiretaId: null, quantidadeDestinada: null, custoProduto: null, rateioServico: p.valorServicoAtribuido?.toString() ?? null })),
  ];
  const itensDiretos = operacao.tipo === "COMPRA_CONSUMO_DIRETO" ? operacao.itens.filter((i) => !i.estocavel && i.produtoId).map((i) => {
    const destinada = aplicacoes.filter((a) => a.itemCompraDiretaId === i.id && a.status === "VALIDO").reduce((s, a) => s.plus(a.quantidadeCompraDireta ?? 0), new Prisma.Decimal(0));
    return { id: i.id, descricao: i.descricao, unidade: i.unidade, quantidadeComprada: i.quantidade.toString(), quantidadeDestinada: destinada.toString(), quantidadeDisponivel: i.quantidade.minus(destinada).toString() };
  }) : [];
  return { operacaoId, fatos, itensDiretos };
}
