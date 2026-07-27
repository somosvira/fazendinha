import { describe, it, expect } from "vitest";
import {
  reconstruirLactacoes,
  recomputarResumoReproducao,
  planejarSincronizacaoLactacoes,
  ConflitoLactacaoError,
  categoriaAposParto,
  type LactacaoEstrutural,
} from "./reproducao.recompute.js";

const HOJE = "2026-06-16";
const ev = (tipo: any, data: string, extra: any = {}) => ({ tipo, data, ...extra });
const lact = (over: Partial<LactacaoEstrutural> = {}): LactacaoEstrutural => ({
  id: 10,
  numero: 2,
  dtInicio: "2025-01-10",
  dtFim: null,
  motivoSecagem: null,
  ...over,
});
const evento = (id: number, tipo: any, data: string, extra: any = {}) => ({ id, tipo, data, ...extra });

describe("categoriaAposParto", () => {
  it.each([
    ["NOVILHA", "VACA"],
    ["CABRITA", "CABRA"],
    ["VACA", "VACA"],
    ["TOURO", "TOURO"],
  ])("promove %s para %s quando aplicável", (atual, esperada) => {
    expect(categoriaAposParto(atual)).toBe(esperada);
  });
});

describe("reconstruirLactacoes", () => {
  it("parto abre, secagem fecha, numero parte de numPartosEntrada", () => {
    const ls = reconstruirLactacoes([ev("PARTO", "2026-01-22"), ev("SECAGEM", "2025-12-18")], 2);
    // só o parto de 2026-01-22 abre lactação; a secagem é anterior e não fecha nada (lact da 2ª não está nos eventos)
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ numero: 3, dtInicio: "2026-01-22", dtFim: null });
  });
  it("parto seguido de secagem fecha a lactação", () => {
    const ls = reconstruirLactacoes([ev("PARTO", "2024-01-10"), ev("SECAGEM", "2024-11-10"), ev("PARTO", "2025-02-01")], 0);
    expect(ls.map((l) => [l.numero, l.dtFim])).toEqual([[1, "2024-11-10"], [2, null]]);
  });
});

describe("planejarSincronizacaoLactacoes", () => {
  it("evento alheio à lactação não produz operação", () => {
    expect(planejarSincronizacaoLactacoes([lact()], { tipo: "CRIACAO", evento: evento(1, "DIAGNOSTICO", "2026-06-01") })).toEqual([]);
  });

  it("PARTO com início já persistido é idempotente e preserva o ciclo", () => {
    expect(planejarSincronizacaoLactacoes([lact()], { tipo: "CRIACAO", evento: evento(2, "PARTO", "2025-01-10") })).toEqual([]);
  });

  it("PARTO novo encerra o ciclo aberto antes de criar o próximo", () => {
    expect(planejarSincronizacaoLactacoes([lact({ id: 8, numero: 4 })], { tipo: "CRIACAO", evento: evento(3, "PARTO", "2026-02-01") }, 2)).toEqual([
      { tipo: "ENCERRAR", lactacaoId: 8, dtFim: "2026-02-01", motivoSecagem: "Novo parto" },
      { tipo: "CRIAR", numero: 5, dtInicio: "2026-02-01" },
    ]);
  });

  it("SECAGEM encerra a lactação aberta mais recente e carrega o motivo", () => {
    const rows = [lact({ id: 1, numero: 1, dtInicio: "2024-01-01" }), lact({ id: 2, numero: 2, dtInicio: "2025-01-01" })];
    expect(planejarSincronizacaoLactacoes(rows, { tipo: "CRIACAO", evento: evento(4, "SECAGEM", "2025-11-01", { motivoSecagem: "Rotina" }) })).toEqual([
      { tipo: "ENCERRAR", lactacaoId: 2, dtFim: "2025-11-01", motivoSecagem: "Rotina" },
    ]);
  });

  it("SECAGEM sem ciclo aberto gera conflito explícito", () => {
    expect(() => planejarSincronizacaoLactacoes([lact({ dtFim: "2025-10-01" })], { tipo: "CRIACAO", evento: evento(5, "SECAGEM", "2025-11-01") }))
      .toThrowError(expect.objectContaining({ code: "SEM_LACTACAO_ABERTA" }));
  });

  it("excluir SECAGEM reabre o ciclo fechado por aquela data", () => {
    const rows = [lact({ id: 7, dtFim: "2025-11-01", motivoSecagem: "Rotina" })];
    expect(planejarSincronizacaoLactacoes(rows, { tipo: "EXCLUSAO", evento: evento(6, "SECAGEM", "2025-11-01") })).toEqual([
      { tipo: "REABRIR", lactacaoId: 7 },
    ]);
  });

  it("excluir PARTO remove seu ciclo e reabre o anterior encerrado automaticamente", () => {
    const rows = [
      lact({ id: 9, numero: 1, dtInicio: "2024-01-10", dtFim: "2025-01-10", motivoSecagem: "Novo parto" }),
      lact({ id: 10, numero: 2, dtInicio: "2025-01-10" }),
    ];
    expect(planejarSincronizacaoLactacoes(rows, { tipo: "EXCLUSAO", evento: evento(7, "PARTO", "2025-01-10") })).toEqual([
      { tipo: "REMOVER", lactacaoId: 10 },
      { tipo: "REABRIR", lactacaoId: 9 },
    ]);
  });

  it("recusa excluir parto quando o ciclo associado possui histórico enriquecido", () => {
    const enriquecida = lact({ id: 10, enriquecida: true });
    expect(() => planejarSincronizacaoLactacoes([enriquecida], { tipo: "EXCLUSAO", evento: evento(8, "PARTO", "2025-01-10") }))
      .toThrowError(expect.objectContaining({ code: "CICLO_ENRIQUECIDO" }));
  });

  it("recusa duas lactações com o mesmo início", () => {
    const rows = [lact({ id: 1 }), lact({ id: 2 })];
    expect(() => planejarSincronizacaoLactacoes(rows, { tipo: "CRIACAO", evento: evento(9, "CIO", "2026-01-01") }))
      .toThrowError(expect.objectContaining({ code: "AMBIGUIDADE" }));
  });
});

describe("recomputarResumoReproducao", () => {
  it("prenhe: status, DEL, ordem, gestação, prev. secagem, IEP", () => {
    const eventos = [ev("PARTO", "2026-01-22"), ev("INSEMINACAO", "2026-04-28", { reprodutor: "Lance 884" }), ev("DIAGNOSTICO", "2026-05-28", { resultado: "positivo", dtPartoPrevista: "2027-02-22" })];
    const lacts = reconstruirLactacoes(eventos, 2);
    const r = recomputarResumoReproducao(eventos, lacts, 2, HOJE);
    expect(r.statusReprodutivo).toBe("PRENHE");
    expect(r.ordemLactacao).toBe(3);
    expect(r.del).toBe(145);                          // 2026-01-22 → 2026-06-16
    expect(r.ultimoDgResultado).toBe("positivo");
    expect(r.diasGestacao).toBe(49);                  // IA 2026-04-28 → hoje
    expect(r.previsaoSecagem).toBe("2026-12-24");     // 2027-02-22 − 60d
    expect(r.iepProjetado).toBe(396);                 // 2026-01-22 → 2027-02-22
  });
  it("vazia pós-PEV: DG negativo deixa VAZIA", () => {
    const eventos = [ev("PARTO", "2026-02-01"), ev("INSEMINACAO", "2026-04-20"), ev("DIAGNOSTICO", "2026-05-14", { resultado: "negativo" })];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 2), 2, HOJE);
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBe(135);
    expect(r.diasGestacao).toBeNull();
  });
  it("recém-parida dentro do PEV", () => {
    const eventos = [ev("PARTO", "2026-05-20")];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE);
    expect(r.statusReprodutivo).toBe("PEV");          // DEL 27 < 60
  });
  it("inseminada aguardando DG expõe a cobertura IA e seu protocolo", () => {
    const eventos = [ev("PARTO", "2026-01-10"), ev("INSEMINACAO", "2026-06-01", { protocolo: "IATF 11 dias" })];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE);
    expect(r.statusReprodutivo).toBe("INSEMINADA");
    expect(r.ultimaInseminacao).toBe("2026-06-01");
    expect(r.protocoloAtual).toBe("IATF 11 dias");
  });
  it("usa TE como última cobertura mesmo quando há IA anterior", () => {
    const eventos = [
      ev("INSEMINACAO", "2026-05-01", { protocolo: "IATF 9 dias" }),
      ev("TRANSFERENCIA_EMBRIAO", "2026-06-05", { protocolo: "Sincronização de receptoras" }),
    ];
    const r = recomputarResumoReproducao(eventos, [], 0, HOJE);
    expect(r.statusReprodutivo).toBe("INSEMINADA");
    expect(r.ultimaInseminacao).toBe("2026-06-05");
    expect(r.protocoloAtual).toBe("Sincronização de receptoras");
  });
  it("monta natural (COBERTURA) conta como cobertura pendente de DG", () => {
    const r = recomputarResumoReproducao([ev("COBERTURA", "2026-06-01")], [], 0, HOJE);
    expect(r.statusReprodutivo).toBe("INSEMINADA");
    expect(r.ultimaInseminacao).toBe("2026-06-01");
  });
  it("novilha sem eventos: VAZIA, DEL null", () => {
    const r = recomputarResumoReproducao([], [], 0, HOJE);
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBeNull();
    expect(r.ordemLactacao).toBeNull();
  });

  it("preserva DEL e ordem de lactação importada sem evento PARTO correspondente", () => {
    const r = recomputarResumoReproducao(
      [ev("CIO", "2026-06-01")],
      [{ numero: 3, dtInicio: "2026-01-10", dtFim: null }],
      2,
      HOJE,
    );
    expect(r.del).toBe(157);
    expect(r.ordemLactacao).toBe(3);
  });
  it("override de pevDias: DEL=27 vira VAZIA se PEV for 25", () => {
    const eventos = [ev("PARTO", "2026-05-20")];
    const r = recomputarResumoReproducao(eventos, reconstruirLactacoes(eventos, 1), 1, HOJE, { pevDias: 25 });
    expect(r.statusReprodutivo).toBe("VAZIA");
    expect(r.del).toBe(27);
  });
});
