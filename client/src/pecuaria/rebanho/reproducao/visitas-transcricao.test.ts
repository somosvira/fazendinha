import { expect, it } from "vitest";
import { dadosConfirmacaoVisita } from "./visitas-transcricao";
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
