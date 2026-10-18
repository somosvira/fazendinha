import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SinaisClinicosAnimal } from "./SinaisClinicosAnimal";

describe("sinais clínicos no cabeçalho", () => {
  it("não infere saúde nem gestação quando não há dados", () => {
    expect(renderToStaticMarkup(<SinaisClinicosAnimal situacao={null} carencia={null} />)).toBe("");
  });
  it("distingue gestação, carência vigente e dados pendentes", () => {
    const html = renderToStaticMarkup(<SinaisClinicosAnimal situacao="GESTANTE" carencia={{ leite: { estado: "CONHECIDO", ate: "2999-01-01", precisaoAproximada: false }, carne: { estado: "NAO_INFORMADO" } }} />);
    expect(html).toContain("Gestante");
    expect(html).toContain("Carência: leite");
    expect(html).toContain("Carência a conferir");
  });
  it("não destaca carência encerrada ou prazo zero como vigente", () => {
    const html = renderToStaticMarkup(<SinaisClinicosAnimal situacao="DESCONHECIDA" carencia={{ leite: { estado: "CONHECIDO", ate: "2000-01-01", precisaoAproximada: false }, carne: { estado: "CONHECIDO", ate: "2999-01-01", precisaoAproximada: false, prazoZero: true } }} />);
    expect(html).toContain("Reprodução a conferir");
    expect(html).not.toContain("Carência:");
  });
});
