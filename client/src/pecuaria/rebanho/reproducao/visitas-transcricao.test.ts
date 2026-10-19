import { expect, it } from "vitest";
import { contextoTranscricao, dadosConfirmacaoVisita, ehAvaliacaoTarefa, pendenciaAvaliacaoTarefa, resultadoPrincipalVisita } from "./visitas-transcricao";
import type { ParticipanteVisita } from "./visitas-api";
it("preserva dados do procedimento IATF e converte horário no fuso da fazenda", () => {
  expect(
    dadosConfirmacaoVisita("TAREFA_IATF", {
      status: "CONFIRMADO",
      realizadaEm: "2026-10-13T08:00",
      motivo: "Execução fora do horário",
      dados: { tipo: "IA", materialId: "m" },
    }),
  ).toEqual({
    realizadaEm: "2026-10-13T11:00:00.000Z",
    motivo: "Execução fora do horário",
    dados: { tipo: "IA", materialId: "m" },
  });
  expect(
    dadosConfirmacaoVisita("INICIAR_IATF", {
      participanteIatfId: "p",
      inicioEfetivo: "2026-10-13T08:00",
    }),
  ).toEqual({
    participanteIatfId: "p",
    inicioEfetivo: "2026-10-13T11:00:00.000Z",
  });
});

it.each(["TAREFA_IATF", "INICIAR_IATF"] as const)("%s não executa procedimento em atendimento adiado ou ausente", tipo => {
  for (const status of ["ADIADO", "NAO_ATENDIDO"]) expect(dadosConfirmacaoVisita(tipo, {status, motivo: "Não veio ao curral"})).toEqual({});
});
it("preserva ciência explícita da indicação", () => {
  expect(dadosConfirmacaoVisita("AVALIACAO_REPRODUTIVA", {conduta: "IATF", cienciaSanitaria: false})).toEqual({conduta: "IATF", cienciaSanitaria: false});
});

it("adapta avaliação IATF ao resultado principal e mantém vínculos obrigatórios", () => {
  const participante: ParticipanteVisita = { id: "p", animalId: "a", ordem: 1, status: "PENDENTE", rascunho: null,
    snapshot: { tarefaPlanejada: { origem: "REPRODUTIVA", tarefa: { id: "t", animalId: "a", tipo: "AVALIACAO" } } } };
  expect(ehAvaliacaoTarefa(participante)).toBe(true);
  expect(resultadoPrincipalVisita("TAREFA_IATF", participante, { dados: { resultado: "POSITIVO" } })).toBe("Prenhez confirmada");
  expect(pendenciaAvaliacaoTarefa({ resultado: "POSITIVO" })).toMatch(/vincule a tentativa/i);
  expect(pendenciaAvaliacaoTarefa({ resultado: "POSITIVO", tentativaId: "tentativa" })).toBeNull();
  expect(pendenciaAvaliacaoTarefa({ resultado: "SEXAGEM" })).toMatch(/sexo fetal/i);
});

it("contexto mantém DEL zero, RP não e dados históricos desconhecidos", async () => {
  const { contextoTranscricao } = await import("./visitas-transcricao");
  expect(contextoTranscricao({ situacaoProdutiva: "LACTANTE", del: 0,
    ultimoParto: { id: "p", data: "2026-10-13", tipo: "NORMAL" }, retencaoPlacenta: false,
    tentativa: { id: "t", data: "2026-09-13", tipo: "IA" },
  }, "2026-10-13")).toMatchObject({ lactacao: "DEL 0", rp: "Não", tentativa: "IA há 30 dias" });
  expect(contextoTranscricao({ ultimoParto: { id: "p", data: "2026-10-13", tipo: "NORMAL" } }, "2026-10-13"))
    .toMatchObject({ rp: "Não informado", lactacao: "Lactação não informada" });
  expect(contextoTranscricao({}, "2026-10-13").rp).toBe("Sem parto registrado");
});


it("preserva Vazia mesmo com tentativa anterior e restrição", () => {
  expect(contextoTranscricao({ situacao: "VAZIA", tentativa: { id: "t", data: "2026-09-13", tipo: "IA" },
    restricoes: [{ id: "r", tipo: "TEMPORARIA", motivo: "Acompanhamento sanitário" }],
  }, "2026-10-13").situacao).toBe("Vazia · Restrição reprodutiva");
});
it("preserva Gestante comprovada por situação inicial sem objeto de gestação", () => {
  expect(contextoTranscricao({ situacao: "GESTANTE", gestacao: null }, "2026-10-13").situacao).toBe("Gestante");
});
it("situação desconhecida não vira diagnóstico pendente pela tentativa nem é apagada pela restrição", () => {
  expect(contextoTranscricao({ situacao: "DESCONHECIDA", tentativa: { id: "t", data: "2026-09-13", tipo: "IA" },
    restricoes: [{ id: "r", tipo: "TEMPORARIA", motivo: "Acompanhamento sanitário" }],
  }, "2026-10-13").situacao).toBe("Desconhecida · Restrição reprodutiva");
});
it("só apresenta diagnóstico pendente quando preservado no estado canônico", () => {
  expect(contextoTranscricao({ situacao: "AGUARDANDO_DIAGNOSTICO" }, "2026-10-13").situacao).toBe("Aguardando diagnóstico");
  expect(contextoTranscricao({ tentativa: { id: "t", data: "2026-09-13", tipo: "IA" } }, "2026-10-13").situacao).toBe("Situação não preservada");
});
