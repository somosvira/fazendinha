// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { periodoDoAno, periodoDoAnoAtual, periodoInicial } from "./periodo";

const padrao = { inicio: "2026-01-01", fim: "2026-12-31" };
afterEach(() => { window.history.replaceState(null, "", "/financeiro/contas"); });

describe("periodoInicial", () => {
  it("usa o padrão quando a URL não tem inicio nem fim", () => {
    expect(periodoInicial(padrao)).toEqual(padrao);
  });
  it("lê um intervalo válido e inclusivo da URL", () => {
    window.history.replaceState(null, "", "/financeiro/contas?inicio=2026-03-01&fim=2026-03-31");
    expect(periodoInicial(padrao)).toEqual({ inicio: "2026-03-01", fim: "2026-03-31" });
  });
  it("cai no padrão quando o início vem depois do fim", () => {
    window.history.replaceState(null, "", "/financeiro/contas?inicio=2026-03-31&fim=2026-03-01");
    expect(periodoInicial(padrao)).toEqual(padrao);
  });
  it("cai no padrão para datas malformadas ou inexistentes", () => {
    window.history.replaceState(null, "", "/financeiro/contas?inicio=2026-13-40&fim=2026-03-31");
    expect(periodoInicial(padrao)).toEqual(padrao);
  });
  it("cai no padrão quando só um dos dois parâmetros está presente", () => {
    window.history.replaceState(null, "", "/financeiro/contas?inicio=2026-03-01");
    expect(periodoInicial(padrao)).toEqual(padrao);
  });
  it("sem permitirVazio, inicio=&fim= explícitos também caem no padrão (não-vazio)", () => {
    window.history.replaceState(null, "", "/financeiro/contas?inicio=&fim=");
    expect(periodoInicial(padrao)).toEqual(padrao);
  });
  it("com permitirVazio, inicio=&fim= explícitos viram \"todo o período\" em vez do padrão", () => {
    // Reproduz o link gerado por ContasFinanceiras quando o período
    // compartilhado está em "Todo o período" (issue #284 / review #287, P-D).
    window.history.replaceState(null, "", "/financeiro/contas/5?inicio=&fim=");
    expect(periodoInicial(padrao, { permitirVazio: true })).toEqual({ inicio: "", fim: "" });
  });
  it("com permitirVazio, um intervalo válido continua sendo lido normalmente", () => {
    window.history.replaceState(null, "", "/financeiro/contas?inicio=2026-03-01&fim=2026-03-31");
    expect(periodoInicial(padrao, { permitirVazio: true })).toEqual({ inicio: "2026-03-01", fim: "2026-03-31" });
  });
});

describe("periodoDoAno / periodoDoAnoAtual", () => {
  it("cobre o ano inteiro, de 1º de janeiro a 31 de dezembro", () => {
    expect(periodoDoAno(2025)).toEqual({ inicio: "2025-01-01", fim: "2025-12-31" });
  });
  it("periodoDoAnoAtual usa o ano corrente (hoje.ts)", () => {
    expect(periodoDoAnoAtual()).toEqual(periodoDoAno(new Date().getFullYear()));
  });
});
