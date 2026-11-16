import type { EntradaImpacto, PreviaImpactos } from "./impactos-api";
export function previaImpactosTeste(entrada: EntradaImpacto): PreviaImpactos {
  return {
    versao: 1,
    entrada,
    revisao: "a".repeat(64),
    exigeConfirmacao: true,
    dispositivos: [{ id: "insercao", data: "2026-10-01" }],
    itens: [
      {
        participacaoId: "participacao",
        protocolo: {
          nome: "Preparo autorizado",
          versao: 2,
          finalidade: "IATF",
        },
        efeito: "RETIRAR",
        regras: [
          { id: "regra", motivo: "Conferência configurada do procedimento" },
        ],
        tarefas: [
          {
            id: "tarefa",
            nomeSnapshot: "Próxima aplicação",
            etapa: { nome: "Aplicação" },
            previstaPara: "2026-10-11",
          },
        ],
        automacoes: [
          { id: "job", estado: "AGENDADA", programadaPara: "2026-10-11" },
        ],
        dispositivos: [{ id: "insercao", data: "2026-10-01" }],
      },
    ],
  };
}
