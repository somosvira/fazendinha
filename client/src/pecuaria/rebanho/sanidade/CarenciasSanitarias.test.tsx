// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { CarenciasSanitarias, resumoCarencia } from "./CarenciasSanitarias";
import { dataHoraSanitaria, nomeAnimalSanitario } from "./rotulos";

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("carências sanitárias", () => {
  it("separa desconhecida, não aplicável e ausência de aplicação válida", () => {
    expect(resumoCarencia({ estado: "NENHUMA" })).toBe("Sem aplicações válidas");
    expect(resumoCarencia({ estado: "NAO_INFORMADO" })).toContain("desconhecida");
    expect(resumoCarencia({ estado: "NAO_APLICAVEL" })).toContain("confirmado");
  });
  it("distingue zero de encerramento e preserva aproximação", () => {
    const prazo = { estado: "CONHECIDO" as const, ate: "2026-10-05T13:00:00Z", precisaoAproximada: true };
    expect(resumoCarencia(prazo, Date.parse("2026-10-05T14:00:00Z"))).toBe("Sem carência · encerrada em ≈ 05/10/2026 às 10:00");
    expect(resumoCarencia(prazo, Date.now(), true)).toBe("Sem carência · prazo zero confirmado");
    expect(resumoCarencia({ ...prazo, prazoZero: true })).toBe("Sem carência · prazo zero confirmado");
  });
  it("atualiza o vencimento com a tela aberta e indica revisão do leite", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T12:59:59Z"));
    render(<CarenciasSanitarias carencia={{ leite: { estado: "CONHECIDO", ate: "2026-10-05T13:00:00Z", precisaoAproximada: false }, carne: { estado: "NAO_INFORMADO" }, revisaoLeitePendente: false }} />);
    expect(screen.getByText(/Vigente até/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText(/encerrada em/)).toBeTruthy();

  });
  it("formata horários e animais sem nome", () => {
    expect(dataHoraSanitaria("2026-10-05T13:04:00Z")).toBe("05/10/2026 às 10:04");
    expect(nomeAnimalSanitario({ brinco: "GV3-01", nome: null })).toBe("GV3-01");
  });
});
it("não apresenta liberação enquanto a aplicabilidade do leite exige revisão", () => {
  render(<CarenciasSanitarias carencia={{ leite: { estado: "CONHECIDO", ate: "2026-01-01T00:00:00Z", precisaoAproximada: false, prazoZero: true }, carne: { estado: "NAO_INFORMADO" }, revisaoLeitePendente: true }} />);
  expect(screen.queryByText(/Sem carência/)).toBeNull();
  expect(screen.getByText(/Aplicabilidade pendente/)).toBeTruthy();
});
