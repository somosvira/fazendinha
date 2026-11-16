import type { GrupoPlanner } from "./planner-api";
import type { CabecalhoProtocolo } from "../protocolos/api";
export function grupoVisaoGeral(
  id: string,
  data: string | null,
  extra: Partial<GrupoPlanner> = {},
): GrupoPlanner {
  return {
    grupo: { origem: "PROTOCOLO", identidade: id },
    nome: `Etapa ${id}`,
    secao: "REPRODUCAO",
    janela: data ? "DIA" : "SEM_PREVISAO",
    tipo: "TAREFA_IATF",
    protocolo: { id: "modelo", nome: "Modelo", versao: 1 },
    turma: { id, nome: `Programação ${id}` },
    etapa: { id: `etapa-${id}`, nome: `Etapa ${id}`, ordem: 1 },
    previstaPara: data,
    precisaoTemporal: "DIA",
    criterios: null,
    totalAnimais: 6,
    totalProcedimentos: 6,
    emVisitaAberta: 0,
    contexto: { programacaoId: id },
    ...extra,
  };
}
export function execucaoVisaoGeral(
  id: string,
  modo: CabecalhoProtocolo["modo"] = "COLETIVO",
): CabecalhoProtocolo {
  return {
    id,
    modo,
    tipo: "REPRODUTIVO",
    nome: `Execução ${id}`,
    protocolo: { id: "modelo", nome: "Modelo", versao: 1 },
    propriedadeId: 7,
    inicioReferencia: "2026-10-01",
    precisaoTemporal: "DIA",
    status: "ABERTA",
    animal: null,
    participantesTotal: 6,
    contagens: {
      total: 6,
      atendidos: 0,
      pendentes: 6,
      atrasadas: 0,
      naoAtendidos: 0,
      adiados: 0,
      semRegistro: 6,
      previstos: 0,
      regularizacoes: 0,
      encerradas: 0,
    },
  };
}
