import { describe, it, expect } from "vitest";
import { duracaoLactacao, resumoLactacoes } from "./lactacoes.calc.js";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const hoje = D("2026-05-28");

describe("duracaoLactacao", () => {
  it("encerrada: dias entre início e fim", () => {
    expect(duracaoLactacao({ dtInicio: D("2023-08-29"), dtFim: D("2024-12-13") } as any, hoje)).toBe(472);
  });
  it("aberta: dias entre início e hoje", () => {
    expect(duracaoLactacao({ dtInicio: D("2026-05-01"), dtFim: null } as any, hoje)).toBe(27);
  });
});

describe("resumoLactacoes", () => {
  it("agrega total, vida produtiva, DEL da aberta e média das que têm produção", () => {
    const r = resumoLactacoes(
      [
        { numero: 1, dtInicio: D("2022-01-01"), dtFim: D("2022-11-01"), producaoTotal: 8000, producao305: 7000, duracaoDias: 304, motivoSecagem: "Rotina" },
        { numero: 2, dtInicio: D("2023-01-01"), dtFim: D("2023-11-01"), producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: "Baixa produção" },
        { numero: 3, dtInicio: D("2026-05-01"), dtFim: null, producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: null },
      ] as any,
      hoje,
    );
    expect(r.total).toBe(3);
    expect(r.emCurso).toBe(true);
    expect(r.delAtual).toBe(27);
    // vida produtiva = 304 (enc.1) + 304 (enc.2: 2023-01-01→2023-11-01) + 27 (aberta) = 635
    expect(r.vidaProdutivaDias).toBe(635);
    expect(r.producaoMediaCiclo).toBe(8000); // só a lactação 1 tem produção
  });

  it("sem produção em nenhuma → producaoMediaCiclo null", () => {
    const r = resumoLactacoes(
      [{ numero: 1, dtInicio: D("2022-01-01"), dtFim: D("2022-11-01"), producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: null }] as any,
      hoje,
    );
    expect(r.producaoMediaCiclo).toBeNull();
    expect(r.emCurso).toBe(false);
    expect(r.delAtual).toBeNull();
  });
});
