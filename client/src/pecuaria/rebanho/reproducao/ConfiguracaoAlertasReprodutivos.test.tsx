// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConfiguracaoAlertasReprodutivos } from "./ConfiguracaoAlertasReprodutivos";
import { mudarCampo } from "@/lib/controles.fixture";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("../alertas/api", () => ({ requisicaoAlertas: mocks.req }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.req.mockImplementation(async (_path, init) =>
    init ? { id: "p", versao: 1, ...JSON.parse(init.body) } : [],
  );
});
afterEach(cleanup);
it("não adota prazo clínico e envia público referência e resolução configurados", async () => {
  render(<ConfiguracaoAlertasReprodutivos propriedadeId={7} podeLancar />);
  await screen.findByText(/Nenhuma regra operacional/);
  fireEvent.click(
    screen.getByRole("button", { name: "Nova versão de alertas" }),
  );
  mudarCampo(screen.getByLabelText("Vigente desde"), {
    target: { value: "2026-11-10" },
  });
  fireEvent.click(screen.getByLabelText("Tentativa após preparo"));
  expect(screen.getByLabelText("Intervalo (dias)")).toHaveProperty("value", "");
  fireEvent.submit(
    (
      screen.getByRole("button", {
        name: "Registrar versão de alertas",
      }) as HTMLButtonElement
    ).form!,
  );
  await screen.findByText(/Informe todos os prazos/);
  for (const [label, value] of [
    ["Intervalo (dias)", "5"],
    ["Antecedência (dias)", "0"],
    ["Tolerância (dias)", "1"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.submit(
    (
      screen.getByRole("button", {
        name: "Registrar versão de alertas",
      }) as HTMLButtonElement
    ).form!,
  );
  await screen.findByText(/Nova versão registrada/);
  const call = mocks.req.mock.calls.find(([, init]) => init);
  expect(JSON.parse(call![1].body)).toEqual({
    propriedadeId: 7,
    vigenteDesde: "2026-11-10",
    chave: expect.any(String),
    parametros: {
      versao: 1,
      regras: [
        {
          tipo: "TENTATIVA_APOS_PREPARO",
          publico: "FEMEAS",
          referencia: "PREPARO_CONCLUIDO",
          resolucao: "TENTATIVA_REALIZADA",
          unidade: "DIAS",
          intervalo: 5,
          antecedencia: 0,
          tolerancia: 1,
        },
      ],
    },
  });
  expect(call![0]).toBe("/reproducao/politicas");
});
it("falha preserva parâmetros e chave para repetir publicação", async () => {
  let n = 0;
  mocks.req.mockImplementation(async (_p, init) => {
    if (!init) return [];
    if (n++ === 0) throw Error("Falha temporária");
    return { id: "p", versao: 1, ...JSON.parse(init.body) };
  });
  render(<ConfiguracaoAlertasReprodutivos propriedadeId={7} podeLancar />);
  await screen.findByText(/Nenhuma regra operacional/);
  fireEvent.click(
    screen.getByRole("button", { name: "Nova versão de alertas" }),
  );
  mudarCampo(screen.getByLabelText("Vigente desde"), {
    target: { value: "2026-11-10" },
  });
  const submit = () =>
    fireEvent.submit(
      (
        screen.getByRole("button", {
          name: "Registrar versão de alertas",
        }) as HTMLButtonElement
      ).form!,
    );
  submit();
  await screen.findByText("Falha temporária");
  submit();
  await screen.findByText(/Nova versão registrada/);
  const escritas = mocks.req.mock.calls.filter(([, init]) => init);
  expect(escritas[0]).toEqual(escritas[1]);
});
