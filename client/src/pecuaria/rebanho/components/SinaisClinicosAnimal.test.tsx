import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SinaisClinicosAnimal } from "./SinaisClinicosAnimal";

describe("sinais clínicos no cabeçalho", () => {
  it.each(["GESTANTE", "VAZIA"])("mostra seca junto ao estado reprodutivo confirmado %s", situacao => {
    const html = renderToStaticMarkup(<SinaisClinicosAnimal situacao={situacao} situacaoProdutiva="SECA" carencia={null} />);
    expect(html).toContain("Seca");
    expect(html).toContain(situacao === "GESTANTE" ? "Gestante" : "Vazia");
  });
  it.each(["LACTANTE", "SEM_LACTACAO", "NAO_INFORMADA"] as const)("não infere seca de %s", situacaoProdutiva => {
    expect(renderToStaticMarkup(<SinaisClinicosAnimal situacao={null} situacaoProdutiva={situacaoProdutiva} carencia={null} />)).toBe("");
  });
  it("não infere saúde nem gestação quando não há dados", () => {
    expect(renderToStaticMarkup(<SinaisClinicosAnimal situacao={null} carencia={null} />)).toBe("");
  });
  it("mostra carência vigente sem detalhar destino nem pendências", () => {
    const html = renderToStaticMarkup(<SinaisClinicosAnimal situacao="GESTANTE" carencia={{ leite: { estado: "CONHECIDO", ate: "2999-01-01", precisaoAproximada: false }, carne: { estado: "NAO_INFORMADO" } }} />);
    expect(html).toContain("Gestante");
    expect(html).toContain("Em carência");
    expect(html).not.toContain("Carência a conferir");
  });
  it("não destaca carência encerrada ou prazo zero como vigente", () => {
    const html = renderToStaticMarkup(<SinaisClinicosAnimal situacao="DESCONHECIDA" carencia={{ leite: { estado: "CONHECIDO", ate: "2000-01-01", precisaoAproximada: false }, carne: { estado: "CONHECIDO", ate: "2999-01-01", precisaoAproximada: false, prazoZero: true } }} />);
    expect(html).not.toContain("Reprodução a conferir");
    expect(html).not.toContain("Em carência");
  });
});
