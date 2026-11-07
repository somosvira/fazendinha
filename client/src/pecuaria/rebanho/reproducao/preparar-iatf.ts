import { navegarPara } from "../../../router";
/** Navegação posterior ao recibo; não confirma nem reenvia o atendimento clínico. */
export function abrirPreparacaoIatf(animaisIds: string[], propriedadeId: number) {
  if (!animaisIds.length || !Number.isInteger(propriedadeId) || propriedadeId <= 0) throw new Error("Não foi possível identificar os animais e o sítio para preparar o protocolo.");
  const params = new URLSearchParams({ rotina: "programacoes", sitio: String(propriedadeId), acao: "prepararIatf", pedidoPreparacao: crypto.randomUUID(), retorno: window.location.pathname + window.location.search + window.location.hash });
  for (const id of [...new Set(animaisIds)].slice(0, 100)) params.append("animalIndicado", id);
  navegarPara(`/pecuaria/reproducao?${params}`);
}
