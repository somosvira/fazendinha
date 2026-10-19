import { describe, expect, it } from "vitest";
import {
  filtrarParticipantes,
  ordenarParticipantes,
  pendenciaRascunho,
  blocosConfirmacao,
} from "./visitas-regras";
import type { ParticipanteVisita } from "./visitas-api";
const p = (
  id: string,
  ordem: number,
  status: string,
  motivos: string[],
): ParticipanteVisita => ({
  id,
  ordem,
  animalId: id,
  status,
  rascunho: null,
  snapshot: { brinco: id, motivos },
});
describe("transcrição da visita", () => {
  it("combina filtros gerais por AND, motivos por OR e preserva ordem do papel", () => {
    const entrada = [
      p("Vaca 3", 3, "PENDENTE", ["Retorno"]),
      p("Vaca 1", 1, "PENDENTE", ["Diagnóstico"]),
      p("Vaca 2", 2, "CONFIRMADO", ["Retorno"]),
      p("Novilha", 4, "PENDENTE", ["Diagnóstico"]),
    ];
    expect(
      filtrarParticipantes(entrada, {
        q: "Vaca",
        status: "PENDENTE",
        motivos: ["Retorno", "Diagnóstico"],
      }).map((p) => p.id),
    ).toEqual(["Vaca 1", "Vaca 3"]);
    expect(entrada[0].ordem).toBe(3);
    expect(ordenarParticipantes(entrada).map((p) => p.ordem)).toEqual([
      1, 2, 3, 4,
    ]);
  });
  it("não confirma sexo fetal, descarte ou pendência sem informação necessária", () => {
    expect(pendenciaRascunho({ resultado: "SEXAGEM" })).toMatch(/sexo fetal/);
    expect(
      pendenciaRascunho({ resultado: "NEGATIVO", conduta: "DESCARTE" }),
    ).toMatch(/motivo/);
    expect(pendenciaRascunho({ status: "NAO_ATENDIDO" })).toMatch(/motivo/);
    expect(pendenciaRascunho({ resultado: "NAO_AVALIADO" })).toBeNull();
    expect(
      pendenciaRascunho({ status: "ADIADO", motivo: "Animal indisponível" }),
    ).toBeNull();
  });
  it("divide 120 participantes em blocos atômicos de 100 e 20 sem perder ordem", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `p${i + 1}`);
    const blocos = blocosConfirmacao(ids);
    expect(blocos.map(b => b.length)).toEqual([100, 20]);
    expect(blocos.flat()).toEqual(ids);
    expect(blocos.every(b => b.length <= 100)).toBe(true);
  });
});
