import { describe, it, expect } from "vitest";
import { duracaoLactacao, resumoLactacoes, producaoCiclo, normalizarData, curvaCicloCorrente } from "./lactacoes.calc.js";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const hoje = D("2026-05-28");
const ctrl = (data: string, pesoTotal: number) => ({ data: D(data), pesoTotal });

describe("normalizarData", () => {
  it("remove a hora mantendo a data civil da fazenda", () => {
    expect(normalizarData(new Date("2026-05-28T15:00:00-03:00"))).toEqual(D("2026-05-28"));
  });

  it("não avança o dia na fronteira Brasil/UTC", () => {
    expect(normalizarData(new Date("2026-05-29T01:00:00Z"))).toEqual(D("2026-05-28"));
  });
});

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

  it("média/ciclo usa produção estimada dos controles quando o Ideagri não traz total", () => {
    const r = resumoLactacoes(
      [
        // sem valor do Ideagri, mas com estimativa dos controles → entra na média
        { numero: 1, dtInicio: D("2022-01-01"), dtFim: D("2022-11-01"), producaoTotal: null, producao305: null, duracaoDias: null, motivoSecagem: null, producaoControles: 6000 },
        // valor do Ideagri tem precedência sobre a estimativa
        { numero: 2, dtInicio: D("2023-01-01"), dtFim: D("2023-11-01"), producaoTotal: 8000, producao305: 7000, duracaoDias: null, motivoSecagem: null, producaoControles: 9999 },
      ] as any,
      hoje,
    );
    expect(r.producaoMediaCiclo).toBe(7000); // (6000 estimada + 8000 medida) / 2
  });
});

describe("resumoLactacoes — Correção 305 agregada", () => {
  const R = (over: any) => ({ dtInicio: D("2020-01-01"), dtFim: D("2020-11-01"), producaoTotal: null, producaoControles: null, duracaoDias: null, motivoSecagem: null, ...over });

  it("média só sobre ciclos com 305 > 0; null é ignorado (não vira 0)", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: 7000 }), R({ numero: 2, producao305: null }), R({ numero: 3, producao305: 8000 })] as any, hoje);
    expect(r).toMatchObject({ media305: 7500, n305: 2, melhor305: 8000, melhor305Numero: 3 });
  });

  it("producao305 == 0 é sentinela (ausência), não valor", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: 0 }), R({ numero: 2, producao305: 6000 })] as any, hoje);
    expect(r).toMatchObject({ media305: 6000, n305: 1, melhor305: 6000, melhor305Numero: 2 });
  });

  it("todos os ciclos com 305 == 0 → agregados null, sem 'melhor 305 = 0 L'", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: 0 }), R({ numero: 2, producao305: 0 })] as any, hoje);
    expect(r).toMatchObject({ media305: null, n305: 0, melhor305: null, melhor305Numero: null });
  });

  it("nenhum ciclo com 305 (todos null) → tudo null, sem NaN", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: null }), R({ numero: 2, producao305: null })] as any, hoje);
    expect(r).toMatchObject({ media305: null, n305: 0, melhor305: null, melhor305Numero: null });
  });

  it("melhor305 pega o máximo e o número do ciclo", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: 7000 }), R({ numero: 2, producao305: 9000 }), R({ numero: 3, producao305: 5000 })] as any, hoje);
    expect(r).toMatchObject({ melhor305: 9000, melhor305Numero: 2 });
  });

  it("empate no máximo desempata pelo MENOR numero, independente da ordem do array", () => {
    const r = resumoLactacoes([R({ numero: 2, producao305: 8000 }), R({ numero: 1, producao305: 8000 })] as any, hoje);
    expect(r).toMatchObject({ melhor305: 8000, melhor305Numero: 1 });
  });

  it("arredondamento Math.round na média", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: 7000 }), R({ numero: 2, producao305: 7001 })] as any, hoje);
    expect(r).toMatchObject({ media305: 7001, n305: 2 });
  });

  it("Decimal/string coercível via Number (não concatena)", () => {
    const r = resumoLactacoes([R({ numero: 1, producao305: "7000" }), R({ numero: 2, producao305: "8000" })] as any, hoje);
    expect(r).toMatchObject({ media305: 7500, melhor305: 8000 });
  });

  it("ortogonalidade: 305 não altera producaoMediaCiclo nem os campos antigos", () => {
    const r = resumoLactacoes(
      [
        R({ numero: 1, producao305: null, producaoControles: 6000 }),
        R({ numero: 2, producao305: 7000, producaoTotal: 8000 }),
        R({ numero: 3, dtFim: null, producao305: null }),
      ] as any,
      hoje,
    );
    expect(r.media305).toBe(7000);
    expect(r.n305).toBe(1);
    // métrica antiga intacta: média de (6000 estimada, 8000 medida) = 7000
    expect(r.producaoMediaCiclo).toBe(7000);
    expect(r.emCurso).toBe(true);
  });
});

describe("producaoCiclo (Test Interval Method)", () => {
  it("sem controle na janela → null", () => {
    expect(producaoCiclo([ctrl("2020-01-01", 25)], D("2023-01-01"), D("2023-11-01"))).toEqual({ litros: null, nControles: 0 });
  });

  it("intervalo invertido → null, nunca produção negativa", () => {
    expect(producaoCiclo([ctrl("2023-05-01", 25)], D("2023-11-01"), D("2023-01-01"))).toEqual({ litros: null, nControles: 0 });
  });

  it("inclui controle exatamente nas duas fronteiras da janela", () => {
    expect(producaoCiclo([ctrl("2023-01-01", 30), ctrl("2023-01-11", 20)], D("2023-01-01"), D("2023-01-11"))).toEqual({ litros: 250, nControles: 2 });
  });

  it("um só controle colapsa em média × duração", () => {
    // janela 2023-01-01→2023-11-01 = 304 dias; controle único de 25 L → 304 × 25 = 7600
    expect(producaoCiclo([ctrl("2023-05-01", 25)], D("2023-01-01"), D("2023-11-01"))).toEqual({ litros: 7600, nControles: 1 });
  });

  it("vários controles: bordas flat + trapézios no interior", () => {
    // 31×30 (parto→1º) + 89×25 + 92×15 (interior) + 92×10 (último→fim) = 930+2225+1380+920 = 5455
    const r = producaoCiclo([ctrl("2023-02-01", 30), ctrl("2023-05-01", 20), ctrl("2023-08-01", 10)], D("2023-01-01"), D("2023-11-01"));
    expect(r).toEqual({ litros: 5455, nControles: 3 });
  });

  it("lactação em curso: borda final flat até hoje", () => {
    // 9×40 (parto→1º) + 10×35 (interior) + 8×30 (último→hoje) = 360+350+240 = 950
    const r = producaoCiclo([ctrl("2026-05-10", 40), ctrl("2026-05-20", 30)], D("2026-05-01"), hoje);
    expect(r).toEqual({ litros: 950, nControles: 2 });
  });

  it("ignora controles fora da janela e ordena", () => {
    const r = producaoCiclo(
      [ctrl("2023-08-01", 10), ctrl("2022-06-01", 99), ctrl("2023-02-01", 30), ctrl("2024-01-01", 99), ctrl("2023-05-01", 20)],
      D("2023-01-01"),
      D("2023-11-01"),
    );
    expect(r).toEqual({ litros: 5455, nControles: 3 });
  });
});

describe("curvaCicloCorrente", () => {
  const lact = (numero: number, dtInicio: string, dtFim: string | null) =>
    ({ numero, dtInicio: D(dtInicio), dtFim: dtFim ? D(dtFim) : null }) as any;

  it("sem lactações → série vazia", () => {
    expect(curvaCicloCorrente([], [ctrl("2026-05-01", 30)], hoje)).toEqual({ numero: null, dtInicio: null, pontos: [] });
  });

  it("usa a lactação aberta como ciclo corrente e só os controles dentro da janela", () => {
    const lacts = [lact(1, "2024-01-01", "2024-11-01"), lact(2, "2026-05-01", null)];
    const controles = [
      ctrl("2024-06-01", 40), // ciclo anterior — fora
      ctrl("2026-05-10", 28),
      ctrl("2026-05-20", 32),
      ctrl("2026-06-01", 25), // depois de hoje (2026-05-28) — fora
    ];
    const r = curvaCicloCorrente(lacts, controles, hoje);
    expect(r.numero).toBe(2);
    expect(r.dtInicio).toBe("2026-05-01");
    expect(r.pontos).toEqual([
      { data: "2026-05-10", del: 9, pesoTotal: 28 },
      { data: "2026-05-20", del: 19, pesoTotal: 32 },
    ]);
  });

  it("sem lactação aberta → usa a mais recente por dtInicio", () => {
    const lacts = [lact(1, "2022-01-01", "2022-11-01"), lact(2, "2023-01-01", "2023-11-01")];
    const controles = [ctrl("2023-03-01", 35), ctrl("2022-03-01", 20)];
    const r = curvaCicloCorrente(lacts, controles, hoje);
    expect(r.numero).toBe(2);
    expect(r.dtInicio).toBe("2023-01-01");
    // só o controle da 2ª lactação (janela 2023-01-01→2023-11-01)
    expect(r.pontos.map((p) => p.pesoTotal)).toEqual([35]);
  });

  it("ordena pontos por data ainda que os controles venham fora de ordem", () => {
    const lacts = [lact(1, "2026-05-01", null)];
    const controles = [ctrl("2026-05-20", 32), ctrl("2026-05-05", 30), ctrl("2026-05-12", 31)];
    const r = curvaCicloCorrente(lacts, controles, hoje);
    expect(r.pontos.map((p) => p.data)).toEqual(["2026-05-05", "2026-05-12", "2026-05-20"]);
    expect(r.pontos.map((p) => p.del)).toEqual([4, 11, 19]);
  });

  it("ciclo corrente sem nenhum controle na janela → pontos vazios mas identifica o ciclo", () => {
    const r = curvaCicloCorrente([lact(3, "2026-05-01", null)], [ctrl("2020-01-01", 25)], hoje);
    expect(r).toEqual({ numero: 3, dtInicio: "2026-05-01", pontos: [] });
  });

  it("inclui controle exatamente no início do ciclo (borda inclusiva)", () => {
    const r = curvaCicloCorrente([lact(1, "2026-05-01", null)], [ctrl("2026-05-01", 27)], hoje);
    expect(r.pontos).toEqual([{ data: "2026-05-01", del: 0, pesoTotal: 27 }]);
  });
});
