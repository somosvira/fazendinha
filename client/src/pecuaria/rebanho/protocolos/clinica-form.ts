import { dataHoraISO } from "../reproducao/CampoDataIatf";
import type { TarefaOperacional } from "./api";
import type { DadosClinicos, ItemClinico } from "./clinica-api";
export function dadosClinicosIniciais(tarefa: TarefaOperacional): DadosClinicos {
  const p = tarefa.tarefaOrigem.planejadoSnapshot?.etapa;
  return { momento: "", responsavel: "", tipoExameId: p?.planoExame?.tipoExameId ?? p?.planoAvaliacao?.tipoExameId ?? tarefa.tarefaOrigem.parametros?.tipoExameId ?? "",
    informarResultado: false, resultado: "", resultados: [], valorResultado: "", observacao: "", motivoDesvio: "", tipoTentativa: p?.planoTentativa?.tipo ?? "IA", origem: "ESTOQUE", materialId: p?.planoTentativa?.materialId ?? "", partidaId: "", operacaoServicoId: "", quantidade: p?.planoTentativa?.quantidade ? String(p.planoTentativa.quantidade) : "", justificativaSemOrigem: "", cienciaValidadeDesconhecida: false, documentacaoExcepcional: false, motivoDocumentacaoExcepcional: "", touroId: "", touroExternoId: "", tentativaId: "", gestacaoId: "", sexoFetal: "", finalidade: p?.planoAvaliacao?.tipo ?? "DIAGNOSTICO", motivoVinculoDesconhecido: "", retornoEm: "", previsaoParto: "", cienciaSanitaria: false, cienciaRecalendarioLegado: false, reprodutorExterno: true };
}
export function montarItemClinico(tarefa: TarefaOperacional, d: DadosClinicos): ItemClinico {
  const tipo = tarefa.tarefaOrigem.tipo;
  if (tipo !== "EXAME" && tipo !== "TENTATIVA" && tipo !== "AVALIACAO") throw new Error("Esta ação não possui formulário clínico compatível.");
  const item: ItemClinico = { tipo, tarefaId: tarefa.id, animalId: tarefa.animal.id, propriedadeId: tarefa.propriedadeId, data: d.momento.slice(0, 10), realizadaEm: dataHoraISO(d.momento),
    ...(d.responsavel.trim() ? { responsavel: d.responsavel.trim() } : {}), ...(d.motivoDesvio.trim() ? { desvio: { motivo: d.motivoDesvio.trim() } } : {}),
    cienciaRecalendarioLegado: d.cienciaRecalendarioLegado };
  if (tipo === "EXAME") {
    if (!d.tipoExameId || !d.formato?.formatoExameHash) throw new Error(`Selecione o tipo e confira o formato do exame de ${tarefa.animal.brinco}.`);
    Object.assign(item, { tipoExameId: d.tipoExameId, formatoExameHash: d.formato.formatoExameHash, ...(d.observacao.trim() ? { observacao: d.observacao.trim() } : {}), ...(d.operacaoServicoId ? { operacaoServicoId: d.operacaoServicoId } : {}) });
    if (d.informarResultado) {
      if (d.formato.tipoResultado === "MULTIPLO") { if (!d.resultados.length) throw new Error(`Informe o resultado de ${tarefa.animal.brinco} ou registre somente a coleta.`); item.resultados = d.resultados; }
      else {
        if (!d.valorResultado.trim()) throw new Error(`Informe o resultado de ${tarefa.animal.brinco} ou registre somente a coleta.`);
        if (d.formato.tipoResultado === "NUMERO") { const v = Number(d.valorResultado.replace(",", ".")); if (!Number.isFinite(v)) throw new Error("Informe um resultado numérico válido."); item.resultadoNumero = v; }
        else item[d.formato.tipoResultado === "OPCAO" ? "resultadoOpcao" : "resultadoTexto"] = d.valorResultado;
      }
    }
  } else if (tipo === "TENTATIVA") {
    Object.assign(item, { tipoTentativa: d.tipoTentativa, origem: d.origem, cienciaSanitaria: d.cienciaSanitaria,
      ...(d.tipoTentativa !== "COBERTURA" && d.materialId ? { materialId: d.materialId } : {}), ...(d.tipoTentativa === "COBERTURA" ? { touroId: d.touroId || undefined, touroExternoId: d.touroExternoId || undefined } : {}),
      ...(d.tipoTentativa !== "COBERTURA" && d.quantidade ? { quantidade: d.quantidade } : {}), ...(d.tipoTentativa !== "COBERTURA" && d.origem === "ESTOQUE" && d.partidaId ? { partidaId: d.partidaId } : {}), ...(d.operacaoServicoId ? { operacaoServicoId: d.operacaoServicoId } : {}),
      ...(d.justificativaSemOrigem.trim() ? { justificativaSemOrigem: d.justificativaSemOrigem.trim() } : {}), cienciaValidadeDesconhecida: d.cienciaValidadeDesconhecida,
      documentacaoExcepcional: d.documentacaoExcepcional, ...(d.motivoDocumentacaoExcepcional.trim() ? { motivoDocumentacaoExcepcional: d.motivoDocumentacaoExcepcional.trim() } : {}), ...(d.observacao.trim() ? { observacao: d.observacao.trim() } : {}) });
  } else if (tipo === "AVALIACAO") {
    if (!d.resultado || d.resultado === "NAO_AVALIADO") throw new Error(`Informe o resultado da avaliação de ${tarefa.animal.brinco}. Não atendimento exige justificativa própria na tarefa.`);
    if (!d.tipoExameId || !d.formato?.formatoExameHash) throw new Error(`Selecione o tipo e confira o formato da avaliação de ${tarefa.animal.brinco}.`);
    Object.assign(item, { resultado: d.resultado, finalidade: d.finalidade, tipoExameId: d.tipoExameId, formatoExameHash: d.formato.formatoExameHash, cienciaSanitaria: d.cienciaSanitaria,
      ...(d.resultados.length ? { resultados: d.resultados } : {}), ...(d.tentativaId ? { tentativaId: d.tentativaId } : {}), ...(d.gestacaoId ? { gestacaoId: d.gestacaoId } : {}), ...(d.sexoFetal ? { sexoFetal: d.sexoFetal } : {}),
      ...(d.motivoVinculoDesconhecido.trim() ? { motivoVinculoDesconhecido: d.motivoVinculoDesconhecido.trim() } : {}), ...(d.retornoEm ? { retornoEm: d.retornoEm } : {}), ...(d.previsaoParto ? { previsaoParto: d.previsaoParto } : {}), ...(d.observacao.trim() ? { observacao: d.observacao.trim() } : {}),
      ...(d.demandaAcompanhamentoId ? { demandaAcompanhamentoId: d.demandaAcompanhamentoId, reavaliacao: true } : {}) });
  } else throw new Error("Esta ação não possui formulário clínico compatível.");
  return item;
}
