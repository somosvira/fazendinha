// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RegrasSanitarias } from "./RegrasSanitarias";
import { mudarCampo } from "@/lib/controles.fixture";
const mocks = vi.hoisted(() => ({
  req: vi.fn(),
  alertas: vi.fn(),
  painel: vi.fn(),
  sanidade: vi.fn(),
  tipos: vi.fn(),
}));
vi.mock("./api", () => ({ reqV4: mocks.req, obterReproducao: mocks.painel }));
vi.mock("../alertas/api", () => ({ requisicaoAlertas: mocks.alertas }));
vi.mock("../sanidade/api", () => ({
  reqSanidade: mocks.sanidade,
  listarTiposAplicacao: mocks.tipos,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.sanidade.mockResolvedValue([
    { id: "d", nome: "Doença configurada", ativo: true },
  ]);
  mocks.tipos.mockResolvedValue([
    { id: "t", nome: "Procedimento configurado", ativo: true },
  ]);
  mocks.painel.mockResolvedValue({ regrasSanitarias: [] });
  mocks.alertas.mockImplementation(async (_p, init) =>
    init ? { id: "r", versao: 1, ...JSON.parse(init.body) } : [],
  );
});
afterEach(cleanup);
it("configura procedimento pela rota própria sem inventar doença ou efeito clínico", async () => {
  render(<RegrasSanitarias propriedadeId={7} podeEditar />);
  await screen.findByText("Nenhuma regra configurada.");
  fireEvent.click(screen.getByRole("button", { name: "Configurar regra" }));
  mudarCampo(screen.getByLabelText("Gatilho da regra"), {
    target: { value: "PROCEDIMENTO" },
  });
  expect(screen.queryByLabelText("Doença")).toBeNull();
  expect(screen.queryByLabelText("Efeito clínico")).toBeNull();
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), {
    target: { value: "t" },
  });
  mudarCampo(screen.getByLabelText("Finalidade do protocolo"), {
    target: { value: "TETF" },
  });
  mudarCampo(screen.getByLabelText("Efeito em protocolos"), {
    target: { value: "BLOQUEAR" },
  });
  fireEvent.change(screen.getByLabelText("Motivo definido pela fazenda"), {
    target: { value: "Revisão definida pela fazenda" },
  });
  fireEvent.submit(
    (screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement)
      .form!,
  );
  await screen.findByText(/Regra configurada/);
  const call = mocks.alertas.mock.calls.find(([, init]) => init);
  expect(call![0]).toBe("/reproducao/impactos-procedimentos");
  expect(JSON.parse(call![1].body)).toEqual({
    propriedadeId: 7,
    tipoAplicacaoId: "t",
    finalidade: "TETF",
    efeito: "BLOQUEAR",
    motivo: "Revisão definida pela fazenda",
    ativo: true,
    chave: expect.any(String),
  });
  expect(mocks.req).not.toHaveBeenCalled();
});
it("ocorrência mantém efeito clínico independente do efeito protocolar", async () => {
  render(<RegrasSanitarias propriedadeId={7} podeEditar />);
  await screen.findByText("Nenhuma regra configurada.");
  fireEvent.click(screen.getByRole("button", { name: "Configurar regra" }));
  for (const [label, value] of [
    ["Doença", "d"],
    ["Ação reprodutiva", "IA"],
    ["Efeito clínico", "ALERTAR"],
    ["Efeito em protocolos", "RETIRAR"],
  ])
    mudarCampo(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText("Motivo definido pela fazenda"), {
    target: { value: "Regra explícita da fazenda" },
  });
  fireEvent.submit(
    (screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement)
      .form!,
  );
  await screen.findByText(/Regra configurada/);
  expect(mocks.req).toHaveBeenCalledWith(
    "/reproducao/regras-sanitarias",
    {
      propriedadeId: 7,
      doencaId: "d",
      acao: "IA",
      efeito: "ALERTAR",
      motivo: "Regra explícita da fazenda",
      ativo: true,
      impactoProtocolar: {
        versao: 1,
        gatilho: "OCORRENCIA",
        efeito: "RETIRAR",
      },
    },
    "POST",
    7,
  );
});

it("revisa ou inativa procedimento com versão esperada e motivo explícito", async () => {
  const regra = {
    id: "r",
    versao: 3,
    tipoAplicacaoId: "t",
    finalidade: "TETF",
    efeito: "AVISAR",
    motivo: "Motivo anterior",
    ativo: true,
  };
  mocks.alertas.mockImplementation(async (_p, init) =>
    init ? { ...regra, ...JSON.parse(init.body), versao: 4 } : [regra],
  );
  render(<RegrasSanitarias propriedadeId={7} podeEditar />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar regra" }));
  expect(screen.getByLabelText("Motivo definido pela fazenda")).toHaveProperty(
    "value",
    "",
  );
  fireEvent.click(screen.getByLabelText("Regra ativa para novos fatos"));
  fireEvent.change(screen.getByLabelText("Motivo definido pela fazenda"), {
    target: { value: "Inativar regra após revisão" },
  });
  fireEvent.submit(
    (screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement)
      .form!,
  );
  await screen.findByText(/Regra configurada/);
  const call = mocks.alertas.mock.calls.find(([, init]) => init);
  expect(call![0]).toBe("/reproducao/impactos-procedimentos/r/revisao");
  expect(JSON.parse(call![1].body)).toMatchObject({
    versaoEsperada: 3,
    ativo: false,
    motivo: "Inativar regra após revisão",
  });
});

it("leitura das regras por doença não chama gestão de procedimento", async () => {
  mocks.painel.mockResolvedValue({
    regrasSanitarias: [
      {
        id: "r",
        doencaId: "d",
        acao: "IA",
        efeito: "ALERTAR",
        motivo: "Regra da fazenda",
        ativo: true,
      },
    ],
  });
  render(<RegrasSanitarias propriedadeId={7} podeEditar={false} />);
  await screen.findByText("Regra da fazenda");
  expect(mocks.alertas).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Configurar regra" })).toBeNull();
});

it("permite inativar regra por doença pelo cadastro existente sem mudar sua identidade", async () => {
  mocks.painel.mockResolvedValue({
    regrasSanitarias: [
      {
        id: "r",
        doencaId: "d",
        acao: "IA",
        efeito: "ALERTAR",
        motivo: "Regra da fazenda",
        ativo: true,
      },
    ],
  });
  render(<RegrasSanitarias propriedadeId={7} podeEditar />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar regra" }));
  fireEvent.click(screen.getByLabelText("Regra ativa para novos fatos"));
  fireEvent.change(screen.getByLabelText("Motivo definido pela fazenda"), {
    target: { value: "Inativar após revisão da fazenda" },
  });
  fireEvent.submit(
    (screen.getByRole("button", { name: "Salvar regra" }) as HTMLButtonElement)
      .form!,
  );
  await screen.findByText(/Regra configurada/);
  expect(mocks.req).toHaveBeenCalledWith(
    "/reproducao/regras-sanitarias",
    {
      propriedadeId: 7,
      doencaId: "d",
      acao: "IA",
      efeito: "ALERTAR",
      motivo: "Inativar após revisão da fazenda",
      ativo: false,
    },
    "POST",
    7,
  );
});
