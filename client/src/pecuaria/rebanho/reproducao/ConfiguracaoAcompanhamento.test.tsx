// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfiguracaoAcompanhamento } from "./ConfiguracaoAcompanhamento";
import { mudarCampo } from "@/lib/controles.fixture";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req }));
const politica = {
  id: "p1",
  versao: 1,
  vigenteDesde: "2026-10-01",
  parametros: {
    versao: 1,
    efeito: "ALERTA",
    diagnostico: { diasAposTentativa: 0 },
    reconfirmacoes: [],
  },
};
const regra = {
  finalidade: "DIAGNOSTICO",
  ocorrencia: 1,
  publico: "TE",
  referencia: "TE",
  intervalo: 23,
  unidade: "DIAS",
  antecedencia: 2,
  tolerancia: 4,
  resolucao: "DIAGNOSTICO_CONCLUSIVO",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.req.mockImplementation(async (path, body) =>
    path.includes("tipos-exame")
      ? []
      : path.includes("?estado")
        ? { itens: [], total: 0 }
        : body
          ? { id: "p2" }
          : [politica],
  );
});
afterEach(cleanup);
const submit = () =>
  fireEvent.submit(
    (
      screen.getByRole("button", {
        name: "Salvar alterações de acompanhamento",
      }) as HTMLButtonElement
    ).form!,
  );
describe("política de acompanhamento V2", () => {
  it("lê V1 e cria migração intencional sem preencher antecedência ou tolerância", async () => {
    render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar />);
    await screen.findByText(/Formato histórico V1/);
    expect(
      screen.getByText("Diagnóstico: 0 dias após a tentativa"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar prazos a partir da versão 1",
      }),
    );
    expect(
      screen
        .getAllByLabelText("Intervalo (dias)")
        .map((e) => (e as HTMLInputElement).value),
    ).toEqual(["0", "0", "0"]);
    expect(
      screen
        .getAllByLabelText("Antecedência (dias)")
        .every((e) => (e as HTMLInputElement).value === ""),
    ).toBe(true);
    submit();
    expect(await screen.findByText(/Informe intervalo/)).toBeTruthy();
    expect(mocks.req.mock.calls.filter(([, b]) => b)).toHaveLength(0);
  });
  it("salva TE separadamente, conserva dados e chave no retry", async () => {
    let n = 0;
    mocks.req.mockImplementation(async (path, body) => {
      if (path.includes("tipos-exame")) return [];
      if (body) {
        if (n++ === 0) throw Error("Falha temporária");
        return { id: "p2" };
      }
      return [politica];
    });
    render(<ConfiguracaoAcompanhamento propriedadeId={7} podeLancar />);
    await screen.findByText(/Formato histórico V1/);
    fireEvent.click(
      screen.getByRole("button", { name: "Configurar novos prazos" }),
    );
    mudarCampo(screen.getByLabelText("Vigente desde"), {
      target: { value: "2026-11-09" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar diagnóstico" }),
    );
    mudarCampo(screen.getByLabelText("Público"), { target: { value: "TE" } });
    for (const [rotulo, v] of [
      ["Intervalo (dias)", "23"],
      ["Antecedência (dias)", "2"],
      ["Tolerância (dias)", "4"],
    ])
      fireEvent.change(screen.getByLabelText(rotulo), { target: { value: v } });
    submit();
    await screen.findByText("Falha temporária");
    const primeira = mocks.req.mock.calls.find(([, b]) => b);
    expect(primeira).toEqual([
      "/reproducao/acompanhamento/politicas",
      {
        propriedadeId: 7,
        vigenteDesde: "2026-11-09",
        chave: expect.any(String),
        parametros: { versao: 2, efeito: "ALERTA", regras: [regra] },
      },
      "POST",
      7,
    ]);
    submit();
    await screen.findByText(/Alterações salvas/);
    expect(mocks.req.mock.calls.filter(([, b]) => b)[1]).toEqual(primeira);
  });
  it("apresenta política V2 e não oferece escrita a leitura", async () => {
    mocks.req.mockImplementation(async (p) =>
      p.includes("tipos-exame")
        ? []
        : [
            {
              ...politica,
              parametros: { versao: 2, efeito: "ALERTA", regras: [regra] },
            },
          ],
    );
    render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar={false} />);
    await screen.findByText(/Diagnóstico após TE/);
    expect(
      screen.queryByRole("button", { name: "Configurar novos prazos" }),
    ).toBeNull();
  });
});
