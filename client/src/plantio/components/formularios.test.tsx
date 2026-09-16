// @vitest-environment jsdom
// Formulários do café: selects e datas estilizados e explicações simples.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const apiMocks = vi.hoisted(() => ({
  registrarOperacao: vi.fn(),
  criarTarefa: vi.fn(),
  editarTarefa: vi.fn(),
  criarApontamento: vi.fn(),
  criarTalhao: vi.fn(),
  editarTalhao: vi.fn(),
  darBaixa: vi.fn(),
  listarVariedades: vi.fn(),
}));

vi.mock("../api", () => ({
  ...apiMocks,
  useTalhoes: () => ({ data: [{ id: 5, codigo: "CAF-12", nome: "Cafundó alto" }] }),
  useLavouras: () => ({ data: [{ id: 2, nome: "Cafundó" }] }),
}));

import { OperacaoForm } from "./OperacaoForm";
import { TarefaForm } from "./TarefaForm";
import { ApontamentoForm } from "./ApontamentoForm";
import { TalhaoForm } from "./TalhaoForm";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const DIA_1 = `1 de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;
const ISO_1 = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
const props = { onFechar: vi.fn(), onSalvo: vi.fn() };
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Object.values(apiMocks).forEach((m) => m.mockReset().mockResolvedValue({}));
  apiMocks.listarVariedades.mockResolvedValue([{ id: 1, nome: "Catuaí 144" }]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const campo = (nome: string) => screen.getByRole("combobox", { name: nome });
async function abrirOpcao(rotulo: string, opcao: string) {
  fireEvent.click(campo(rotulo));
  return screen.findByRole("option", { name: opcao });
}
async function escolher(rotulo: string, opcao: string) {
  fireEvent.click(await abrirOpcao(rotulo, opcao));
  await tick();
}
async function escolherDia(rotulo: string) {
  fireEvent.click(screen.getByRole("button", { name: rotulo }));
  fireEvent.click(await screen.findByRole("button", { name: DIA_1 }));
  await tick();
}

describe("OperacaoForm", () => {
  it("explica o tipo de operação e envia tipo, praga e data", async () => {
    render(<OperacaoForm talhaoId="5" {...props} />);
    expect((await abrirOpcao("Tipo de operação", "Inspeção MIP")).textContent).toContain("pragas e doenças");
    fireEvent.click(screen.getByRole("option", { name: "Inspeção MIP" }));
    await tick();
    await escolher("Praga/doença alvo", "Bicho-mineiro");
    await escolherDia("Data");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await tick();
    expect(apiMocks.registrarOperacao).toHaveBeenCalledWith("5", expect.objectContaining({
      tipo: "MONITORAMENTO_MIP", pragaAlvo: "BICHO_MINEIRO", data: ISO_1,
    }));
  });

  it("explica calagem e o método de colheita", async () => {
    const { unmount } = render(<OperacaoForm talhaoId="5" dominioFixo="nutricao" {...props} />);
    expect((await abrirOpcao("Tipo de operação", "Calagem")).textContent).toContain("acidez");
    unmount();
    render(<OperacaoForm talhaoId="5" dominioFixo="colheita" {...props} />);
    expect((await abrirOpcao("Método", "Varrição")).textContent).toContain("chão");
  });
});

describe("TarefaForm", () => {
  it("explica a poda e escolhe talhão e lavoura", async () => {
    render(<TarefaForm modo="novo" safraId={1} {...props} />);
    expect((await abrirOpcao("Tipo de operação", "Poda — Recepa (baixa, 30-40 cm)")).textContent).toContain("renovar");
    fireEvent.click(screen.getByRole("option", { name: "Poda — Recepa (baixa, 30-40 cm)" }));
    await tick();
    await escolher("Talhão", "CAF-12 · Cafundó alto");
    await escolher("Lavoura", "Cafundó");
    await escolherDia("Data prevista");
    fireEvent.change(screen.getByPlaceholderText("Ex.: 1ª parcela de N — talhão CAF-12"), { target: { value: "Recepa" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await tick();
    expect(apiMocks.criarTarefa).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "PODA_RECEPA", talhaoId: 5, lavouraId: 2, dataPrevista: ISO_1,
    }));
  });

  it("muda o status ao realizar", async () => {
    render(<TarefaForm modo="realizar" safraId={1} tarefa={{ id: 4, descricao: "Adubar" } as never} {...props} />);
    await escolher("Status", "Em andamento");
    fireEvent.click(screen.getByRole("button", { name: "Salvar realizado" }));
    await tick();
    expect(apiMocks.editarTarefa).toHaveBeenCalledWith(4, expect.objectContaining({ status: "EM_ANDAMENTO" }));
  });
});

describe("ApontamentoForm", () => {
  it("escolhe talhão e data", async () => {
    render(<ApontamentoForm safraId={1} {...props} />);
    await escolher("Talhão", "CAF-12 · Cafundó alto");
    await escolherDia("Data");
    expect(campo("Talhão").textContent).toContain("CAF-12 · Cafundó alto");
    expect(screen.getByRole("button", { name: "Data" }).textContent).toBe(`01/${pad(hoje.getMonth() + 1)}/${hoje.getFullYear()}`);
  });
});

describe("TalhaoForm", () => {
  it("dá baixa com o motivo escolhido", async () => {
    render(<TalhaoForm modo="baixa" talhao={{ id: "5", codigo: "CAF-12" } as never} {...props} />);
    await escolher("Motivo", "Geada severa");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
    await tick();
    expect(apiMocks.darBaixa).toHaveBeenCalledWith("5", { motivo: "Geada severa" });
  });

  it("escolhe variedade, lavoura e exposição", async () => {
    render(<TalhaoForm modo="novo" {...props} />);
    await escolher("Variedade", "Catuaí 144");
    await escolher("Lavoura (agrupador)", "Cafundó");
    await escolher("Exposição", "norte");
    await escolherDia("Data de plantio");
    expect(campo("Variedade").textContent).toContain("Catuaí 144");
    expect(campo("Exposição").textContent).toBe("norte");
  });
});
