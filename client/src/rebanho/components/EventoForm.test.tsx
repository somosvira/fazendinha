// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ChangeEvent, type ReactNode } from "react";

const apiMocks = vi.hoisted(() => ({
  registrarEvento: vi.fn(),
  listarRacas: vi.fn(),
  listarAnimais: vi.fn(),
  listarParametros: vi.fn(),
  obterAnimal: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api")>(),
  ...apiMocks,
  useProdutos: () => ({ data: [] }),
  useResultadosGinecologicos: () => ({ data: [], loading: true }),
}));

vi.mock("@/components/rb/RebSelect", () => ({
  RebSelect: ({ value, onChange, children, ...props }: {
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    return createElement("select", {
      ...props,
      value: value == null ? "" : String(value),
      onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
    }, children);
  },
}));

import { EventoForm } from "./EventoForm";

const base = { animalId: "1", animal: { id: "1", numero: "1188", nome: "Jurema", categoria: "VACA" as const }, onFechar: vi.fn(), onSalvo: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listarRacas.mockResolvedValue([
    { id: 1, nome: "Holandês", codigo: "HO", especie: "BOVINO" },
    { id: 2, nome: "Gir", codigo: "GI", especie: "BOVINO" },
  ]);
  apiMocks.listarAnimais.mockResolvedValue([]);
  apiMocks.listarParametros.mockResolvedValue([{ chave: "GESTACAO_DIAS", valorNumero: 283 }]);
  apiMocks.obterAnimal.mockResolvedValue({ ...base.animal, resumo: null });
});

afterEach(cleanup);

describe("EventoForm tipoInicial", () => {
  it.each([
    ["DIAGNOSTICO", "Diagnóstico"],
    ["SECAGEM", "Secagem"],
    ["PARTO", "Parto"],
    ["INSEMINACAO", "Inseminação"],
  ] as const)("inicia reprodução em %s", (tipo, label) => {
    render(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo } }));
    expect(screen.getAllByRole<HTMLSelectElement>("combobox")[0].selectedOptions[0]?.textContent).toBe(label);
  });

  it("oferece cadastro ou vínculo da cria ao iniciar em parto", () => {
    render(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo: "PARTO" } }));
    expect(screen.getByRole("option", { name: "Cadastrar a cria" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Vincular cria existente" })).toBeTruthy();
  });

  it("usa somente raça e grau de sangue na inseminação", () => {
    render(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo: "INSEMINACAO" } }));
    expect(screen.getByLabelText("Raça do reprodutor*")).toBeTruthy();
    expect(screen.queryByLabelText("Reprodutor do catálogo (opcional)")).toBeNull();
    expect(screen.queryByLabelText("Lote de sêmen")).toBeNull();
  });

  it("calcula o parto previsto pela última cobertura e duração configurada", async () => {
    render(createElement(EventoForm, {
      ...base,
      animal: { ...base.animal, resumo: { animalId: "1", statusReprodutivo: "INSEMINADA", ultimaInseminacao: "2026-05-20" } },
      dominioFixo: "reproducao",
      tipoInicial: { dominio: "reproducao", tipo: "DIAGNOSTICO" },
    }));

    const previsao = await screen.findByLabelText(/^Parto previsto/) as HTMLInputElement;
    await waitFor(() => expect(previsao.value).toBe("2027-02-27"));
    expect(previsao.readOnly).toBe(true);
  });

  it("permite informar o sexo de cada uma de três crias", async () => {
    apiMocks.registrarEvento.mockResolvedValue({
      id: "101", animalId: "1", data: "2026-08-31", dominio: "reproducao", titulo: "Parto",
    });
    render(createElement(EventoForm, {
      ...base,
      dominioFixo: "reproducao",
      tipoInicial: { dominio: "reproducao", tipo: "PARTO" },
      dataInicial: "2026-08-31",
    }));

    fireEvent.change(screen.getByLabelText("Crias vivas"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Sexo da cria 1"), { target: { value: "F" } });
    fireEvent.change(screen.getByLabelText("Sexo da cria 2"), { target: { value: "M" } });
    fireEvent.change(screen.getByLabelText("Sexo da cria 3"), { target: { value: "F" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(apiMocks.registrarEvento).toHaveBeenCalledWith("1", expect.objectContaining({
      criasVivas: 3,
      sexoCria: "FMF",
    })));
  });

  it("oferece resultado oficial ao iniciar em exame ginecológico", () => {
    render(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo: "EXAME_GINECOLOGICO" } }));
    expect(screen.getByLabelText("Resultado oficial")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Carregando catálogo…" })).toBeTruthy();
  });

  it("inicia sanidade em exame", () => {
    render(createElement(EventoForm, { ...base, dominioFixo: "sanidade", tipoInicial: { dominio: "sanidade", tipo: "EXAME" } }));
    expect(screen.getAllByRole<HTMLSelectElement>("combobox")[0].selectedOptions[0]?.textContent).toBe("Exame");
  });

  it("mantém o modal aberto até confirmar um aviso retornado ao salvar", async () => {
    const onSalvo = vi.fn();
    apiMocks.registrarEvento.mockResolvedValue({
      id: "99", animalId: "1", data: "2026-07-27", dominio: "reproducao",
      titulo: "Inseminação", aviso: "Evento salvo com uma observação operacional.",
    });

    render(createElement(EventoForm, {
      ...base,
      onSalvo,
      dominioFixo: "reproducao",
      tipoInicial: { dominio: "reproducao", tipo: "INSEMINACAO" },
      dataInicial: "2026-07-27",
    }));

    fireEvent.change(await screen.findByLabelText("Raça do reprodutor*"), { target: { value: "1" } });

    const salvar = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(salvar);
    fireEvent.click(salvar);

    expect(await screen.findByText("Evento salvo com uma observação operacional.")).toBeTruthy();
    expect(apiMocks.registrarEvento).toHaveBeenCalledTimes(1);
    expect(apiMocks.registrarEvento).toHaveBeenCalledWith("1", expect.objectContaining({
      reprodutor: "Holandês",
    }));
    expect(onSalvo).not.toHaveBeenCalled();
    const entendi = screen.getByRole("button", { name: "Entendi" });
    await waitFor(() => expect(document.activeElement).toBe(entendi));
    fireEvent.click(entendi);
    await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
  });

  it("bloqueia fechamento enquanto o evento está sendo salvo", async () => {
    const onFechar = vi.fn();
    const onSalvo = vi.fn();
    let resolver!: (evento: {
      id: string; animalId: string; data: string; dominio: "reproducao";
      titulo: string; aviso: string;
    }) => void;
    apiMocks.registrarEvento.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));

    render(createElement(EventoForm, {
      ...base,
      onFechar,
      onSalvo,
      dominioFixo: "reproducao",
      tipoInicial: { dominio: "reproducao", tipo: "INSEMINACAO" },
      dataInicial: "2026-07-27",
    }));

    fireEvent.change(await screen.findByLabelText("Raça do reprodutor*"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiMocks.registrarEvento).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]') as Element);
    expect(onFechar).not.toHaveBeenCalled();

    await act(async () => resolver({
      id: "100", animalId: "1", data: "2026-07-27", dominio: "reproducao",
      titulo: "Inseminação", aviso: "Evento salvo com uma observação operacional.",
    }));
    expect(await screen.findByText("Evento salvo com uma observação operacional.")).toBeTruthy();
    expect(onSalvo).not.toHaveBeenCalled();
  });

});
