import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { EventoForm } from "./EventoForm";

const base = { animalId: "1", animal: { id: "1", numero: "1188", nome: "Jurema", categoria: "VACA" as const }, onFechar: vi.fn(), onSalvo: vi.fn() };

describe("EventoForm tipoInicial", () => {
  it.each([
    ["DIAGNOSTICO", "Diagnóstico"],
    ["SECAGEM", "Secagem"],
    ["PARTO", "Parto"],
    ["INSEMINACAO", "Inseminação"],
  ] as const)("inicia reprodução em %s", (tipo, label) => {
    const html = renderToString(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo } }));
    expect(html).toContain(`<span style="pointer-events:none">${label}</span>`);
  });

  it("oferece cadastro ou vínculo da cria ao iniciar em parto", () => {
    const html = renderToString(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo: "PARTO" } }));
    expect(html).toContain("Cadastrar a cria");
    expect(html).toContain("Vincular cria existente");
  });

  it("oferece resultado oficial ao iniciar em exame ginecológico", () => {
    const html = renderToString(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo: "EXAME_GINECOLOGICO" } }));
    expect(html).toContain("Resultado oficial");
    expect(html).toContain("Carregando catálogo");
  });

  it("inicia sanidade em exame", () => {
    const html = renderToString(createElement(EventoForm, { ...base, dominioFixo: "sanidade", tipoInicial: { dominio: "sanidade", tipo: "EXAME" } }));
    expect(html).toContain('<span style="pointer-events:none">Exame</span>');
  });
});
