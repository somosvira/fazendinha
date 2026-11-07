import type { EtapaProtocolo } from "./api";
/** Pendências vencidas primeiro; depois a próxima previsão ainda aberta. */
export function etapaPrioritaria(etapas: EtapaProtocolo[], hoje: Date): EtapaProtocolo | undefined {
  const abertas=etapas.filter(e=>e.contagens.pendentes>0 || e.contagens.previstos>0 || (e.contagens.acompanhamentosPendentes??0)>0);
  const dia=hoje.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
  const chave=(e:EtapaProtocolo)=>e.previstaPara?.slice(0,10) ?? "9999-12-31";
  return [...abertas].sort((a,b)=>Number(chave(a)>dia)-Number(chave(b)>dia) || chave(a).localeCompare(chave(b)) || a.ordem-b.ordem)[0] ?? etapas[0];
}
