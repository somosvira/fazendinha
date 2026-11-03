import type { AplicacaoProduto, ClassificacaoCustoPecuaria } from "@prisma/client";
import { componentesDaFonte, consolidarCustos, type ClassificacaoCusto } from "../custos/custos.calc.js";

/** A mesma composição do custo direto, sem somar o total do atendimento ao fato. */
export function custoAplicacao(fato: Pick<AplicacaoProduto, "id" | "animalId" | "propriedadeId" | "data" | "nomeProdutoAplicado" | "status" | "consumoMantido" | "origemInsumo" | "movimentoEstoqueId" | "operacaoServicoId" | "valorProdutoAtribuido" | "valorServicoAtribuido"> & { classificacaoCusto?: Pick<ClassificacaoCustoPecuaria, "finalidade" | "materialNaoAplicavel" | "servicoNaoAplicavel" | "coberturaServico" | "valorMaterialDocumentado"> | null }) {
  if (fato.status === "ANULADO" && !fato.consumoMantido) return null;
  const c = fato.classificacaoCusto;
  return consolidarCustos(componentesDaFonte({
    id: fato.id, tipo: "APLICACAO", animalId: fato.animalId, propriedadeId: fato.propriedadeId ?? 0,
    data: fato.data.toISOString().slice(0, 10), descricao: fato.nomeProdutoAplicado,
    estadoFato: fato.status, participacaoId: null, origemMaterial: fato.origemInsumo === "SEM_ORIGEM_JUSTIFICADA" ? "DOCUMENTADA" : fato.origemInsumo,
    movimentoEstoqueId: fato.movimentoEstoqueId, operacaoServicoId: fato.operacaoServicoId,
    valorMaterial: fato.valorProdutoAtribuido, valorServico: fato.valorServicoAtribuido,
    classificacao: c ? { finalidade: c.finalidade as ClassificacaoCusto["finalidade"], materialNaoAplicavel: c.materialNaoAplicavel,
      servicoNaoAplicavel: c.servicoNaoAplicavel, coberturaServico: c.coberturaServico as ClassificacaoCusto["coberturaServico"], valorMaterialDocumentado: c.valorMaterialDocumentado } : null,
  }));
}
