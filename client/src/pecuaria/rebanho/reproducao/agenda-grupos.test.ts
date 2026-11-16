import { expect, it } from "vitest";
import { agruparAgendaReprodutiva } from "./agenda-grupos";
const base = { origem: "TAREFA_IATF", origemId: "t", animalId: "a", data: "2026-11-03", status: "PENDENTE", propriedadeId: 1, programacaoId: "p", etapaId: "e", momentoId: "m" };
it("agrupa etapa verdadeira antes de paginar e conta animais distintos", () => {
  const grupos = agruparAgendaReprodutiva([base, { ...base, origemId: "t2", etapaId: "e2" }, { ...base, origemId: "t3", animalId: "b" }, { ...base, origemId: "t4", programacaoId: "outra" }], i => i.data);
  expect(grupos).toHaveLength(2); expect(grupos[0].animais).toBe(2); expect(grupos[0].itens).toHaveLength(3);
});
it("não agrupa legado por mera coincidência de data nem mistura previsões indefinidas", () => {
  const grupos = agruparAgendaReprodutiva([{ ...base, momentoId: undefined, etapaId: undefined }, { ...base, origemId: "t2", momentoId: undefined, etapaId: undefined }, { ...base, origemId: "t3", data: null }, base], i => i.data);
  expect(grupos).toHaveLength(4);
});
