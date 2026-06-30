import { describe, it, expect } from "vitest";
import {
  pctVacasEmLactacao, duracaoLactacaoMedia, persistenciaLactacao,
  producaoPorVacaOrdenhada, producaoPorLactacao, periodoSecoMedio,
  intervaloPartosMedio, periodoServicoMedio, pctPrenhez, pctPrenhezPrimeiroServico,
  taxaGestacao, idadePrimeiroPartoMedia, taxaNatalidade, taxaAbortosNatimortos,
  pdip, plva, taxaLotacao, calcularUA, produtividadeTerra, produtividadeMaoObra,
  relacaoLeiteConcentrado, taxaDescarte, mortalidadeAdultos, mortalidadeBezerros,
  ccsRebanho, semaforo, classificarMotivoBaixa, METAS_EMBRAPA,
  type AnimalIn, type LactacaoIn, type ControleIn, type PartoIn,
  type InseminacaoIn, type DiagnosticoIn, type AbortoIn,
} from "./indicadores-embrapa.js";

const vaca = (id: number, over: Partial<AnimalIn> = {}): AnimalIn => ({
  id, categoria: "VACA", dataNascimento: "2021-01-01", dataEntrada: "2023-01-01",
  status: "ATIVO", dataBaixa: null, motivoBaixa: null,
  resumo: { statusReprodutivo: "VAZIA", del: null }, ...over,
});

// 1 — %VL
describe("pctVacasEmLactacao", () => {
  it("calcula sobre vacas ativas (em lactação ÷ total vacas)", () => {
    const animais: AnimalIn[] = [
      vaca(1, { resumo: { statusReprodutivo: "PRENHE", del: 150 } }),
      vaca(2, { resumo: { statusReprodutivo: "PEV", del: 30 } }),
      vaca(3, { resumo: { statusReprodutivo: "VAZIA", del: null } }), // seca
    ];
    expect(pctVacasEmLactacao(animais)).toBe(66.7);
  });
  it("null se sem vacas", () => {
    expect(pctVacasEmLactacao([])).toBeNull();
  });
  it("ignora bezerros", () => {
    const animais: AnimalIn[] = [
      vaca(1, { resumo: { statusReprodutivo: "PEV", del: 30 } }),
      { ...vaca(2), categoria: "BEZERRA", resumo: null },
    ];
    expect(pctVacasEmLactacao(animais)).toBe(100);
  });
});

// 2 — Duração da Lactação
describe("duracaoLactacaoMedia", () => {
  it("média das lactações fechadas", () => {
    const ls: LactacaoIn[] = [
      { animalId: 1, numero: 1, dtInicio: "2024-01-01", dtFim: "2024-11-01" }, // 305d
      { animalId: 2, numero: 1, dtInicio: "2024-02-01", dtFim: "2024-10-29" }, // 271d
    ];
    expect(duracaoLactacaoMedia(ls)).toBe(288);
  });
  it("ignora abertas", () => {
    const ls: LactacaoIn[] = [
      { animalId: 1, numero: 1, dtInicio: "2024-01-01", dtFim: "2024-11-01" },
      { animalId: 2, numero: 2, dtInicio: "2026-01-01", dtFim: null },
    ];
    expect(duracaoLactacaoMedia(ls)).toBe(305);
  });
});

// 3 — Persistência
describe("persistenciaLactacao", () => {
  it("calcula média pós-pico / pico", () => {
    const cs: ControleIn[] = [
      { animalId: 1, data: "2026-02-20", pesoTotal: 25 }, // del=30
      { animalId: 1, data: "2026-03-10", pesoTotal: 32 }, // del=48 PICO
      { animalId: 1, data: "2026-04-01", pesoTotal: 30 }, // del=70 pos
      { animalId: 1, data: "2026-04-20", pesoTotal: 28 }, // del=89 pos
    ];
    expect(persistenciaLactacao(cs, "2026-01-21")).toBeCloseTo(90.6, 1);
  });
  it("null se poucos controles", () => {
    expect(persistenciaLactacao([], "2026-01-01")).toBeNull();
  });
});

// 4 — PVO
describe("producaoPorVacaOrdenhada", () => {
  it("média da produção das vacas em lactação", () => {
    const animais: AnimalIn[] = [
      vaca(1, { resumo: { statusReprodutivo: "PEV", del: 30 } }),
      vaca(2, { resumo: { statusReprodutivo: "PEV", del: 60 } }),
      vaca(3, { resumo: { statusReprodutivo: "VAZIA", del: null } }), // seca, ignora
    ];
    const map = new Map([[1, 25], [2, 30], [3, 0]]);
    expect(producaoPorVacaOrdenhada(animais, map)).toBe(27.5);
  });
});

// 5 — Produção por Lactação
describe("producaoPorLactacao", () => {
  it("soma com regra do trapézio em lactação fechada", () => {
    const lact: LactacaoIn = { animalId: 1, numero: 1, dtInicio: "2024-01-01", dtFim: "2024-11-01" };
    const cs: ControleIn[] = [
      { animalId: 1, data: "2024-02-01", pesoTotal: 30 },
      { animalId: 1, data: "2024-04-01", pesoTotal: 28 },
      { animalId: 1, data: "2024-08-01", pesoTotal: 20 },
    ];
    const r = producaoPorLactacao(cs, lact);
    expect(r?.modo).toBe("real");
    expect(r?.kg).toBeGreaterThan(5000);
    expect(r?.kg).toBeLessThan(9000);
  });
  it("marca como projetada quando lactação aberta", () => {
    const lact: LactacaoIn = { animalId: 1, numero: 1, dtInicio: "2026-01-01", dtFim: null };
    const cs: ControleIn[] = [
      { animalId: 1, data: "2026-02-01", pesoTotal: 30 },
      { animalId: 1, data: "2026-04-01", pesoTotal: 28 },
    ];
    expect(producaoPorLactacao(cs, lact)?.modo).toBe("projetada");
  });
});

// 6 — Período Seco
describe("periodoSecoMedio", () => {
  it("calcula intervalo entre secagem e próximo parto", () => {
    const ls: LactacaoIn[] = [{ animalId: 1, numero: 1, dtInicio: "2024-01-01", dtFim: "2024-11-01" }];
    const ps: PartoIn[] = [{ animalId: 1, data: "2024-12-31", numCrias: 1 }];
    expect(periodoSecoMedio(ls, ps)).toBe(60);
  });
  it("ignora secagens sem próximo parto", () => {
    const ls: LactacaoIn[] = [{ animalId: 1, numero: 1, dtInicio: "2024-01-01", dtFim: "2024-11-01" }];
    expect(periodoSecoMedio(ls, [])).toBeNull();
  });
});

// 7 — IP real
describe("intervaloPartosMedio", () => {
  it("intervalo entre partos consecutivos por animal", () => {
    const ps: PartoIn[] = [
      { animalId: 1, data: "2024-01-01", numCrias: 1 },
      { animalId: 1, data: "2025-02-05", numCrias: 1 }, // 401d
      { animalId: 2, data: "2024-03-01", numCrias: 1 },
      { animalId: 2, data: "2025-03-31", numCrias: 1 }, // 395d
    ];
    expect(intervaloPartosMedio(ps)).toBe(398);
  });
  it("ignora vacas com 1 parto", () => {
    expect(intervaloPartosMedio([{ animalId: 1, data: "2024-01-01", numCrias: 1 }])).toBeNull();
  });
});

// 8 — PS
describe("periodoServicoMedio", () => {
  it("parto → 1ª IA que teve DG+ dentro de 90d", () => {
    const ps: PartoIn[] = [{ animalId: 1, data: "2026-01-01", numCrias: 1 }];
    const ias: InseminacaoIn[] = [
      { animalId: 1, data: "2026-03-01" }, // falhou (DG negativo)
      { animalId: 1, data: "2026-05-01" }, // concebeu
    ];
    const dgs: DiagnosticoIn[] = [
      { animalId: 1, data: "2026-03-25", resultado: "negativo" },
      { animalId: 1, data: "2026-05-30", resultado: "positivo" },
    ];
    expect(periodoServicoMedio(ps, ias, dgs)).toBe(120); // 2026-01-01 → 2026-05-01
  });
});

// 9 — % Prenhez
describe("pctPrenhez", () => {
  it("vacas e novilhas, contando PRENHE", () => {
    const animais: AnimalIn[] = [
      vaca(1, { resumo: { statusReprodutivo: "PRENHE", del: 100 } }),
      vaca(2, { resumo: { statusReprodutivo: "VAZIA", del: null } }),
      { ...vaca(3), categoria: "NOVILHA", resumo: { statusReprodutivo: "PRENHE", del: null } },
    ];
    expect(pctPrenhez(animais)).toBe(66.7);
  });
});

// 10 — % Prenhez 1º serviço
describe("pctPrenhezPrimeiroServico", () => {
  it("1ª IA pós-parto com DG+", () => {
    const ps: PartoIn[] = [
      { animalId: 1, data: "2026-01-01", numCrias: 1 },
      { animalId: 2, data: "2026-01-01", numCrias: 1 },
    ];
    const ias: InseminacaoIn[] = [
      { animalId: 1, data: "2026-04-01" }, // concebeu
      { animalId: 2, data: "2026-04-01" }, // falhou
      { animalId: 2, data: "2026-05-15" }, // concebeu (não conta como 1ª)
    ];
    const dgs: DiagnosticoIn[] = [
      { animalId: 1, data: "2026-05-01", resultado: "positivo" },
      { animalId: 2, data: "2026-05-01", resultado: "negativo" },
      { animalId: 2, data: "2026-06-15", resultado: "positivo" },
    ];
    expect(pctPrenhezPrimeiroServico(ps, ias, dgs)).toBe(50);
  });
});

// 11 — Taxa de gestação
describe("taxaGestacao", () => {
  it("DG+ ÷ IAs com DG", () => {
    const ias: InseminacaoIn[] = [
      { animalId: 1, data: "2026-03-01" },
      { animalId: 1, data: "2026-04-15" },
      { animalId: 2, data: "2026-03-10" },
    ];
    const dgs: DiagnosticoIn[] = [
      { animalId: 1, data: "2026-03-30", resultado: "negativo" },
      { animalId: 1, data: "2026-05-15", resultado: "positivo" },
      { animalId: 2, data: "2026-04-10", resultado: "positivo" },
    ];
    expect(taxaGestacao(ias, dgs)).toBe(66.7);
  });
});

// 12 — IPP
describe("idadePrimeiroPartoMedia", () => {
  it("meses do nascimento ao 1º parto", () => {
    const animais = [
      { id: 1, dataNascimento: "2022-01-01", numPartosEntrada: 0 },
      { id: 2, dataNascimento: "2022-03-01", numPartosEntrada: 0 },
    ];
    const ps: PartoIn[] = [
      { animalId: 1, data: "2024-04-01", numCrias: 1 }, // ~27 meses
      { animalId: 2, data: "2024-02-01", numCrias: 1 }, // ~23 meses
    ];
    const ipp = idadePrimeiroPartoMedia(animais, ps);
    expect(ipp).toBeGreaterThan(24);
    expect(ipp).toBeLessThan(27);
  });
  it("ignora animais com numPartosEntrada > 0", () => {
    const animais = [{ id: 1, dataNascimento: "2020-01-01", numPartosEntrada: 2 }];
    const ps: PartoIn[] = [{ animalId: 1, data: "2026-01-01", numCrias: 1 }];
    expect(idadePrimeiroPartoMedia(animais, ps)).toBeNull();
  });
});

// 13 — Natalidade
describe("taxaNatalidade", () => {
  it("crias vivas ÷ média vacas × 100, anualizado", () => {
    const partos: PartoIn[] = [
      { animalId: 1, data: new Date(Date.now() - 100 * 86400000).toISOString().slice(0,10), numCrias: 1, criasVivas: 1 },
      { animalId: 2, data: new Date(Date.now() - 200 * 86400000).toISOString().slice(0,10), numCrias: 1, criasVivas: 1 },
    ];
    expect(taxaNatalidade(partos, 10, 365)).toBe(20);
  });
});

// 14 — Abortos
describe("taxaAbortosNatimortos", () => {
  it("calcula taxas separadas e combinada", () => {
    const ps: PartoIn[] = [
      { animalId: 1, data: "2026-01-01", numCrias: 2, criasVivas: 1, criasNatimortas: 1 },
      { animalId: 2, data: "2026-02-01", numCrias: 1, criasVivas: 1, criasNatimortas: 0 },
    ];
    const abs: AbortoIn[] = [{ animalId: 3, data: "2026-03-01" }];
    const r = taxaAbortosNatimortos(ps, abs);
    expect(r?.aborto).toBeCloseTo(33.3, 1);
    expect(r?.natimorto).toBeCloseTo(33.3, 1);
  });
  it("null sem gestações", () => {
    expect(taxaAbortosNatimortos([], [])).toBeNull();
  });
});

// 15 — PDIP
describe("pdip", () => {
  it("produção ÷ IP", () => {
    expect(pdip(5500, 395)).toBeCloseTo(13.9, 1);
  });
  it("null sem dados", () => {
    expect(pdip(null, 395)).toBeNull();
    expect(pdip(5500, null)).toBeNull();
  });
});

// 16 — PLVA
describe("plva", () => {
  it("anualiza produção da lactação", () => {
    expect(plva(5500, 395)).toBe(5082);
  });
});

// 17 — Lotação
describe("calcularUA / taxaLotacao", () => {
  it("converte categorias em UA", () => {
    const animais: AnimalIn[] = [
      vaca(1), vaca(2),
      { ...vaca(3), categoria: "NOVILHA" },
    ];
    expect(calcularUA(animais)).toBeCloseTo(2.84, 2); // 2×(500/450)+(280/450)
  });
  it("UA ÷ ha", () => {
    expect(taxaLotacao(60, 30)).toBe(2);
    expect(taxaLotacao(10, 0)).toBeNull();
  });
});

// 18 — Produtividade terra
describe("produtividadeTerra", () => {
  it("L ÷ ha", () => {
    expect(produtividadeTerra(50000, 25)).toBe(2000);
  });
});

// 19 — Produtividade mão de obra
describe("produtividadeMaoObra", () => {
  it("L ÷ funcionários", () => {
    expect(produtividadeMaoObra(800, 4)).toBe(200);
    expect(produtividadeMaoObra(800, 0)).toBeNull();
  });
});

// 20 — Leite / Concentrado
describe("relacaoLeiteConcentrado", () => {
  it("L ÷ kg ração", () => {
    expect(relacaoLeiteConcentrado(1000, 400)).toBe(2.5);
  });
});

// 21/22/23 — Descarte e mortalidade
describe("classificarMotivoBaixa", () => {
  it("identifica descarte/morte/outro por palavras-chave", () => {
    expect(classificarMotivoBaixa("vendida para abate")).toBe("DESCARTE");
    expect(classificarMotivoBaixa("morte por mastite")).toBe("MORTE");
    expect(classificarMotivoBaixa("transferida")).toBe("OUTRO");
    expect(classificarMotivoBaixa(null)).toBe("OUTRO");
  });
});

describe("taxaDescarte", () => {
  it("conta vacas descartadas no período", () => {
    const recente = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
    const animais: AnimalIn[] = [
      vaca(1, { status: "BAIXADO", dataBaixa: recente, motivoBaixa: "vendida descarte" }),
      vaca(2),
      vaca(3),
      vaca(4),
      vaca(5),
    ];
    expect(taxaDescarte(animais, 365)).toBe(20);
  });
});

describe("mortalidadeAdultos / mortalidadeBezerros", () => {
  it("separa adultos de bezerros", () => {
    const recente = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
    const animais: AnimalIn[] = [
      vaca(1, { status: "BAIXADO", dataBaixa: recente, motivoBaixa: "morte" }),
      vaca(2), vaca(3), vaca(4),
      { ...vaca(5), categoria: "BEZERRA", status: "BAIXADO", dataBaixa: recente, motivoBaixa: "óbito" },
      { ...vaca(6), categoria: "BEZERRA" },
      { ...vaca(7), categoria: "BEZERRA" },
    ];
    expect(mortalidadeAdultos(animais, 365)).toBe(25);
    expect(mortalidadeBezerros(animais, 365)).toBeCloseTo(33.3, 1);
  });
});

// 24 — CCS
describe("ccsRebanho", () => {
  it("média, % alto e % crítico", () => {
    const r = ccsRebanho([150, 250, 500, 800, null]);
    expect(r.media).toBe(425);
    expect(r.pctAlto).toBe(50);
    expect(r.pctCritico).toBe(25);
  });
  it("tudo null se sem dados", () => {
    expect(ccsRebanho([])).toEqual({ media: null, pctAlto: null, pctCritico: null });
  });
});

// Semáforo
describe("semaforo", () => {
  it("maior_melhor: verde se ≥ ideal", () => {
    expect(semaforo(90, METAS_EMBRAPA.persistencia)).toBe("verde");
    expect(semaforo(85, METAS_EMBRAPA.persistencia)).toBe("amarelo");
    expect(semaforo(70, METAS_EMBRAPA.persistencia)).toBe("vermelho");
  });
  it("menor_melhor: verde se ≤ ideal", () => {
    expect(semaforo(380, METAS_EMBRAPA.ip)).toBe("verde");
    expect(semaforo(410, METAS_EMBRAPA.ip)).toBe("amarelo");
    expect(semaforo(450, METAS_EMBRAPA.ip)).toBe("vermelho");
  });
  it("null se valor é null", () => {
    expect(semaforo(null, METAS_EMBRAPA.ip)).toBeNull();
  });
});
