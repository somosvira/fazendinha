import { describe, expect, it } from "vitest";
import { anteriorContiguo, auditoriaConstituiFato, dataRelativaFato, identidadeHistorico, resumoTransicao } from "./historicoAnimal";

describe("projeção do histórico", () => {
  it("conta dias civis locais, incluindo virada de ano, passado e futuro", () => {
    const agora = new Date(2026, 0, 1, 0, 1);
    expect(dataRelativaFato("2025-12-31T23:59:59Z", agora)).toBe("Há 1 dia");
    expect(dataRelativaFato("2026-01-01", agora)).toBe("Hoje");
    expect(dataRelativaFato("2026-01-02", agora)).toBe("Em 1 dia");
    expect(dataRelativaFato("2026-01-05", agora)).toBe("Em 4 dias");
    expect(dataRelativaFato("2025-12-29", agora)).toBe("Há 3 dias");
    expect(dataRelativaFato("", agora)).toBe("Data não informada");
  });
  it("não usa duração em horas para contar ontem", () => {
    expect(dataRelativaFato("2026-10-29", new Date(2026, 9, 30, 0, 0))).toBe("Há 1 dia");
  });
  it("une aliases pela identidade, preservando diferentes fatos no mesmo dia", () => {
    expect(identidadeHistorico("DestinoAnimal", "a")).toBe(identidadeHistorico("FinalidadeAnimal", "a"));
    expect(identidadeHistorico("Pesagem", "a")).not.toBe(identidadeHistorico("Pesagem", "b"));
  });
  it("correções/desfazimentos/exclusões são entradas próprias", () => {
    for (const acao of ["CORRECAO", "DESFAZER", "EXCLUSAO", "ANULACAO", "EDICAO"]) expect(auditoriaConstituiFato({ acao })).toBe(false);
  });
  it("usa contiguidade explícita e não inventa antecessor na lacuna", () => {
    const itens = [{ id: "a", ate: "2026-01-03" }, { id: "b", ate: null }];
    expect(anteriorContiguo(itens, { id: "b", desde: "2026-01-03" })?.id).toBe("a");
    expect(anteriorContiguo(itens, { id: "b", desde: "2026-01-04" })).toBeUndefined();
    expect(resumoTransicao(null, "Leite", true)).toBe("Leite");
    expect(resumoTransicao(null, "Leite", false)).toBe("Anterior não informado → Leite");
    expect(resumoTransicao("Corte", "Leite", false)).toBe("Corte → Leite");
  });
});
