import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabecalhoContextoVisita, CelulasContextoVisita, contarColunasContextoVisita } from "./ContextoTabelaVisita";

describe("contexto tabular da visita", () => {
  it("mantém nove cabeçalhos e células, com zero distinto de dado ausente", () => {
    const cabecalho = renderToStaticMarkup(createElement(CabecalhoContextoVisita));
    const celulas = renderToStaticMarkup(createElement(CelulasContextoVisita, { contexto: { brinco: "001", del: 0, tentativasCiclo: 0, partos: 0, ultimoParto: null } }));
    expect(contarColunasContextoVisita()).toBe(9);
    expect((cabecalho.match(/<th\b/g) ?? []).length).toBe(9);
    expect((celulas.match(/<td\b/g) ?? []).length).toBe(9);
    expect(celulas).toContain(">0</td>");
    expect(celulas).toContain("Sem parto");
    expect(celulas).toContain("Não informada");
  });

  it("apresenta a categoria pelo nome, seca explicitamente e RP trivalente", () => {
    const html = renderToStaticMarkup(createElement(CelulasContextoVisita, { contexto: {
      categoria: { nome: "Vaca" }, situacaoProdutiva: "SECA", del: 0,
      tentativasCiclo: 2, diasTentativa: 14, partos: 3, retencaoPlacenta: false,
    } }));
    expect(html).toContain("Vaca");
    expect(html).toContain(">Seca</td>");
    expect(html).toContain(">2</td>");
    expect(html).toContain(">14</td>");
    expect(html).toContain(">Não</td>");
    expect(html).toContain(">Seca</td>");
  });

  it("identifica o tipo do último procedimento sem chamar tipo ausente de cobertura", () => {
    const comTipo = renderToStaticMarkup(createElement(CelulasContextoVisita, { contexto: {
      diasTentativa: 8, tentativa: { tipo: "INSEMINACAO" },
    } }));
    const semTipo = renderToStaticMarkup(createElement(CelulasContextoVisita, { contexto: {
      diasTentativa: 8,
    } }));
    expect(comTipo).toContain("Dias desde IA");
    expect(comTipo).toContain("Intervalo preservado");
    expect(semTipo).toContain("Dias desde tentativa");
    expect(semTipo).not.toContain("Cobertura:");
  });

  it("não interpreta saldo histórico de partos como ausência de parto", () => {
    for (const contexto of [
      { partos: 2, ultimoParto: null, retencaoPlacenta: null },
      { ultimoParto: null },
    ]) {
      const html = renderToStaticMarkup(createElement(CelulasContextoVisita, { contexto }));
      expect(html).toContain("Não informado");
      expect(html).not.toContain("Sem parto");
    }
  });
});
