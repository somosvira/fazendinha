// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, createElement, Fragment, isValidElement, type ChangeEvent, type ReactNode } from "react";

const apiMocks = vi.hoisted(() => ({
  registrarEvento: vi.fn(),
  registrarSanitarioMutate: vi.fn(),
  editarSanitarioMutate: vi.fn(),
  listarReprodutores: vi.fn(),
  listarEstoqueSemen: vi.fn(),
  listarRacas: vi.fn(),
  listarAnimais: vi.fn(),
  produtosEstoque: [] as { id: number; nome: string; unidade: string; setor: string }[],
}));

vi.mock("../api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api")>(),
  ...apiMocks,
  useProdutos: () => ({ data: apiMocks.produtosEstoque }),
  useResultadosGinecologicos: () => ({ data: [], loading: true }),
  useRegistrarEventoSanitario: () => ({ mutate: apiMocks.registrarSanitarioMutate, pendentes: [] }),
  useEditarEventoSanitario: () => ({ mutate: apiMocks.editarSanitarioMutate, pendentes: [] }),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/components/rb/RebSelect", () => ({
  RebSelect: ({ value, onChange, children, ...props }: {
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    const selecionado = Children.toArray(children).find((child) =>
      isValidElement<{ value?: unknown }>(child) && String(child.props.value ?? "") === String(value ?? ""),
    );
    return createElement(Fragment, null,
      isValidElement<{ children?: ReactNode }>(selecionado)
        ? createElement("span", { style: { pointerEvents: "none" } }, selecionado.props.children)
        : null,
      createElement("select", {
        ...props,
        value: value == null ? "" : String(value),
        onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
      }, children),
    );
  },
}));

import { EventoForm } from "./EventoForm";

const base = { animalId: "1", animal: { id: "1", numero: "1188", nome: "Jurema", categoria: "VACA" as const }, onFechar: vi.fn(), onSalvo: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.produtosEstoque = [];
  apiMocks.listarRacas.mockResolvedValue([]);
  apiMocks.listarAnimais.mockResolvedValue([]);
  apiMocks.listarReprodutores.mockResolvedValue({
    reprodutores: [{
      id: 7, nome: "Touro Atlas", codigo: "ATL-7", racaId: 1, racaNome: "Holandês",
      centralSemenId: 2, centralNome: "Central", ptaLeite: null, ptaGordura: null,
      ptaProteina: null, tpi: null, ativo: true,
    }, {
      id: 8, nome: "Touro Bento", codigo: "BEN-8", racaId: 2, racaNome: "Gir",
      centralSemenId: 2, centralNome: "Central", ptaLeite: null, ptaGordura: null,
      ptaProteina: null, tpi: null, ativo: true,
    }],
    resumo: { total: 2, mediaPtaLeite: null, mediaPtaGordura: null, mediaPtaProteina: null, mediaTpi: null, melhorLeiteId: null, melhorTpiId: null },
  });
  apiMocks.listarEstoqueSemen.mockResolvedValue([]);
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

  it("oferece o seletor de lote de sêmen ao iniciar em inseminação", () => {
    render(createElement(EventoForm, { ...base, dominioFixo: "reproducao", tipoInicial: { dominio: "reproducao", tipo: "INSEMINACAO" } }));
    expect(screen.getByLabelText("Lote de sêmen")).toBeTruthy();
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

  it.each(["APLICACAO", "VACINA"] as const)(
    "bloqueia salvar %s sem produto do estoque vinculado (servidor exige produtoId)",
    async (tipo) => {
      const onSalvo = vi.fn();
      render(createElement(EventoForm, {
        ...base, onSalvo, dominioFixo: "sanidade",
        tipoInicial: { dominio: "sanidade", tipo }, dataInicial: "2026-07-27",
      }));
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(await screen.findByText("Selecione o produto do estoque e a quantidade usada.")).toBeTruthy();
      expect(apiMocks.registrarSanitarioMutate).not.toHaveBeenCalled();
      expect(onSalvo).not.toHaveBeenCalled();
    },
  );

  it("registra aplicação vinculada ao estoque via useOfflineMutation, com produtoInfo pro item otimista", async () => {
    apiMocks.produtosEstoque = [{ id: 10, nome: "Ivomectina", unidade: "ml", setor: "GERAL" }];
    apiMocks.registrarSanitarioMutate.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({ id: "77", animalId: "1", data: "2026-07-27", dominio: "sanidade", titulo: "Aplicação — Ivomectina" });
    });
    const onSalvo = vi.fn();
    render(createElement(EventoForm, {
      ...base, onSalvo, dominioFixo: "sanidade",
      tipoInicial: { dominio: "sanidade", tipo: "APLICACAO" }, dataInicial: "2026-07-27",
    }));

    fireEvent.change(screen.getByLabelText("Produto*"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Qtd. usada*"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(apiMocks.registrarSanitarioMutate).toHaveBeenCalledTimes(1));
    expect(apiMocks.registrarSanitarioMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        animalId: "1", tipo: "APLICACAO", produtoId: 10, quantidadeUsada: 5,
        produtoInfo: { nome: "Ivomectina", unidade: "ml", setor: "GERAL" },
      }),
      expect.anything(),
    );
    expect(onSalvo).toHaveBeenCalledTimes(1);
  });

  it("edita evento sanitário existente via useOfflineMutation (useEditarEventoSanitario)", async () => {
    apiMocks.editarSanitarioMutate.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({ id: "50", animalId: "1", data: "2026-07-20", dominio: "sanidade", titulo: "Ocorrência — Mastite" });
    });
    const onSalvo = vi.fn();
    const eventoEdicao = {
      id: "50", animalId: "1", data: "2026-07-20", dominio: "sanidade" as const,
      titulo: "Ocorrência — Mastite", editavel: true,
      dadosEdicao: { tipo: "OCORRENCIA", data: "2026-07-20", observacao: "", doenca: "Mastite", diasTratamento: 3 },
    };
    render(createElement(EventoForm, { ...base, onSalvo, dominioFixo: "sanidade", eventoEdicao }));

    fireEvent.change(screen.getByLabelText("Dias de tratamento"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(apiMocks.editarSanitarioMutate).toHaveBeenCalledTimes(1));
    expect(apiMocks.editarSanitarioMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventoId: "50", animalId: "1",
        payload: expect.objectContaining({ tipo: "OCORRENCIA", doenca: "Mastite", diasTratamento: 5 }),
      }),
      expect.anything(),
    );
    expect(apiMocks.registrarSanitarioMutate).not.toHaveBeenCalled();
    expect(onSalvo).toHaveBeenCalledTimes(1);
  });

  it("mantém o modal aberto até confirmar o aviso retornado ao salvar", async () => {
    const onSalvo = vi.fn();
    apiMocks.listarEstoqueSemen.mockImplementation(async (reprodutorId: number) => reprodutorId === 7 ? [{
      id: 21, reprodutorId: 7, tipoSemenId: 3, tipoSemenNome: "Sexado",
      lote: "L-0", localizacao: "Botijão A", dosesDisponiveis: 0,
    }] : []);
    apiMocks.registrarEvento.mockResolvedValue({
      id: "99", animalId: "1", data: "2026-07-27", dominio: "reproducao",
      titulo: "Inseminação", aviso: "Estoque zerado: evento salvo sem baixa de dose.",
    });

    render(createElement(EventoForm, {
      ...base,
      onSalvo,
      dominioFixo: "reproducao",
      tipoInicial: { dominio: "reproducao", tipo: "INSEMINACAO" },
      dataInicial: "2026-07-27",
    }));

    const seletorReprodutor = await screen.findByLabelText("Reprodutor do catálogo (opcional)");
    expect(apiMocks.listarEstoqueSemen).not.toHaveBeenCalled();
    fireEvent.change(seletorReprodutor, { target: { value: "7" } });
    await waitFor(() => expect(apiMocks.listarEstoqueSemen).toHaveBeenCalledWith(7));
    const seletorLote = screen.getByLabelText("Lote de sêmen") as HTMLSelectElement;
    fireEvent.change(seletorLote, { target: { value: "21" } });
    expect(await screen.findByText("Estoque zerado: o evento será salvo sem baixa de dose.")).toBeTruthy();
    fireEvent.change(seletorReprodutor, { target: { value: "8" } });
    expect(seletorLote.value).toBe("");
    fireEvent.change(seletorReprodutor, { target: { value: "7" } });
    await waitFor(() => expect(apiMocks.listarEstoqueSemen).toHaveBeenLastCalledWith(7));
    fireEvent.change(seletorLote, { target: { value: "21" } });

    const salvar = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(salvar);
    fireEvent.click(salvar);

    expect(await screen.findByText("Estoque zerado: evento salvo sem baixa de dose.")).toBeTruthy();
    expect(apiMocks.registrarEvento).toHaveBeenCalledTimes(1);
    expect(apiMocks.registrarEvento).toHaveBeenCalledWith("1", expect.objectContaining({
      reprodutor: "Touro Atlas",
      estoqueSemenId: 21,
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

    fireEvent.change(await screen.findByLabelText("Reprodutor do catálogo (opcional)"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiMocks.registrarEvento).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]') as Element);
    expect(onFechar).not.toHaveBeenCalled();

    await act(async () => resolver({
      id: "100", animalId: "1", data: "2026-07-27", dominio: "reproducao",
      titulo: "Inseminação", aviso: "Estoque zerado: evento salvo sem baixa de dose.",
    }));
    expect(await screen.findByText("Estoque zerado: evento salvo sem baixa de dose.")).toBeTruthy();
    expect(onSalvo).not.toHaveBeenCalled();
  });

});
