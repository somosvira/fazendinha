// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Iatf, type ProgramacaoIatf, type ProtocoloIatf } from "./Iatf";
import { reqV4 } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { obterCabecalhoProtocolo, reqProtocolo, type CabecalhoProtocolo } from "../protocolos/api";
vi.mock("./api", () => ({ reqV4: vi.fn() }));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn(), obterCabecalhoProtocolo: vi.fn(), obterEtapasProtocolo: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock("../protocolos/ProcedimentosProtocolo", () => ({ ProcedimentosProtocolo: () => null }));
vi.mock("./BibliotecaReprodutiva", () => ({
  BibliotecaReprodutiva: () => null,
}));
vi.mock("../../../estoque/api", () => ({
  listarProdutos: vi.fn().mockResolvedValue([]),
}));
vi.mock("../api", () => ({
  listarMaterialGenetico: vi.fn().mockResolvedValue([]),
}));
vi.mock("../custos/CustosDiretos", () => ({ CustosDiretos: () => null }));
function pendente<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: Error) => void;
  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}
const protocolo: ProtocoloIatf = {
  id: "protocolo",
  nome: "Protocolo confirmado",
  versao: 1,
  publicado: true,
  etapas: [],
};
const programacao: ProgramacaoIatf = {
  id: "programacao",
  nome: "Programação confirmada",
  protocoloId: "protocolo",
  inicioPrevisto: "2026-10-17T00:00:00Z",
  status: "ABERTA",
  participantes: [],
};
const cabecalho = (p: ProgramacaoIatf): CabecalhoProtocolo => ({ id: p.id, nome: p.nome, status: p.status, tipo: "REPRODUTIVO", modo: "COLETIVO", protocolo: { id: p.protocoloId, nome: "Protocolo", versao: 1 }, inicioReferencia: p.inicioPrevisto, precisaoTemporal: "DIA", participantesTotal: p.participantes.length, propriedadeId: null, animal: null, contagens: { total: 0, atendidos: 0, pendentes: 0, atrasadas: 0, naoAtendidos: 0, adiados: 0, semRegistro: 0, previstos: 0, regularizacoes: 0, encerradas: 0 } });
const paginaProgramacoes = (itens: ProgramacaoIatf[]) => ({ itens: itens.map(cabecalho), total: itens.length, pagina: 1, porPagina: 10 });
beforeEach(() => {
  vi.clearAllMocks();
  setPropriedadeAtiva(null);
  window.history.replaceState(null, "", "/pecuaria/reproducao");
  vi.mocked(reqV4).mockResolvedValue([]);
  vi.mocked(reqProtocolo).mockResolvedValue(paginaProgramacoes([]));
  vi.mocked(obterCabecalhoProtocolo).mockResolvedValue(cabecalho(programacao));
});
afterEach(() => {
  cleanup();
  setPropriedadeAtiva(null);
});
it("não declara protocolos ausentes enquanto aguarda a primeira consulta", async () => {
  const leitura = pendente<ProtocoloIatf[]>();
  vi.mocked(reqV4).mockReturnValue(leitura.promessa);
  render(<Iatf modo="cadastros" propriedadeId={1} podeLancar={false} />);
  expect(screen.getByRole("status").textContent).toBe("Carregando protocolos…");
  expect(
    screen.queryByText("Nenhum protocolo reprodutivo cadastrado."),
  ).toBeNull();
  await act(async () => leitura.resolver([protocolo]));
  expect(
    screen.getByRole("heading", { name: /Protocolo confirmado/ }),
  ).toBeTruthy();
  expect(screen.queryByText("Carregando protocolos…")).toBeNull();
  expect(
    screen.queryByText("Nenhum protocolo reprodutivo cadastrado."),
  ).toBeNull();
});
it("distingue erro de catálogo vazio e retry recupera os protocolos", async () => {
  const leitura = pendente<ProtocoloIatf[]>();
  vi.mocked(reqV4)
    .mockReturnValueOnce(leitura.promessa)
    .mockResolvedValueOnce([protocolo]);
  render(<Iatf modo="cadastros" propriedadeId={1} podeLancar={false} />);
  await act(async () =>
    leitura.rejeitar(new Error("Falha ao consultar protocolos")),
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Falha ao consultar protocolos",
  );
  expect(
    screen.queryByText("Nenhum protocolo reprodutivo cadastrado."),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByRole("heading", { name: /Protocolo confirmado/ });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(reqV4).toHaveBeenNthCalledWith(
    2,
    "/reproducao/protocolos?propriedadeId=1",
    undefined,
    "POST",
    1,
  );
});
it("sucesso vazio orienta cadastro somente ao perfil autorizado", async () => {
  const { rerender } = render(
    <Iatf modo="cadastros" propriedadeId={1} podeLancar={false} />,
  );
  await screen.findByText("Nenhum protocolo reprodutivo cadastrado.");
  expect(
    screen.queryByRole("button", { name: "Novo protocolo reprodutivo" }),
  ).toBeNull();
  expect(
    screen.getByText(/cadastro e a publicação exigem permissão/),
  ).toBeTruthy();
  rerender(<Iatf modo="cadastros" propriedadeId={1} podeLancar />);
  expect(
    screen.getByRole("button", { name: "Novo protocolo reprodutivo" }),
  ).toBeTruthy();
  expect(
    screen.getByText(/copie uma referência da biblioteca como rascunho/),
  ).toBeTruthy();
});
it("atualização conserva protocolos confirmados durante carregamento e falha", async () => {
  const atualizacao = pendente<ProtocoloIatf[]>();
  vi.mocked(reqV4)
    .mockResolvedValueOnce([protocolo])
    .mockReturnValueOnce(atualizacao.promessa)
    .mockResolvedValueOnce([]);
  render(<Iatf modo="cadastros" propriedadeId={1} podeLancar={false} />);
  await screen.findByRole("heading", { name: /Protocolo confirmado/ });
  fireEvent.click(screen.getByRole("button", { name: "Atualizar protocolos" }));
  expect(
    screen.getByRole("heading", { name: /Protocolo confirmado/ }),
  ).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain(
    "Atualizando protocolos",
  );
  await act(async () =>
    atualizacao.rejeitar(new Error("Falha na atualização")),
  );
  expect(
    screen.getByRole("heading", { name: /Protocolo confirmado/ }),
  ).toBeTruthy();
  expect(
    screen.queryByText("Nenhum protocolo reprodutivo cadastrado."),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum protocolo reprodutivo cadastrado.");
  expect(
    screen.queryByRole("heading", { name: /Protocolo confirmado/ }),
  ).toBeNull();
});
it.each(["resolver", "rejeitar"] as const)(
  "troca de sítio ignora lista anterior ao %s fora de ordem",
  async (desfecho) => {
    const antiga = pendente<ProgramacaoIatf[]>();
    vi.mocked(reqProtocolo).mockImplementation(async (_path, sitio) => paginaProgramacoes(sitio === 1 ? await antiga.promessa : [{ ...programacao, id: "nova", nome: "Programação do sítio atual" }]));
    const { rerender } = render(<Iatf propriedadeId={1} podeLancar={false} />);
    expect(screen.queryByText(/Nenhuma programação/)).toBeNull();
    rerender(<Iatf propriedadeId={2} podeLancar={false} />);
    (await screen.findAllByRole("button", { name: /Programação do sítio atual/ }))[0];
    await act(async () =>
      desfecho === "resolver"
        ? antiga.resolver([{ ...programacao, nome: "Resposta antiga" }])
        : antiga.rejeitar(new Error("Erro antigo")),
    );
    expect(screen.queryByText(/Resposta antiga|Erro antigo/)).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Programação do sítio atual/ })[0],
    ).toBeTruthy();
  },
);
it("programações vazias distinguem sítio e permissão, sem oferecer criação ao leitor", async () => {
  const { rerender } = render(<Iatf propriedadeId={1} podeLancar={false} />);
  await screen.findByText("Nenhuma programação neste sítio.");
  expect(screen.queryByRole("button", { name: "Nova programação" })).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Gerenciar protocolos reprodutivos" }),
  ).toBeNull();
  rerender(<Iatf podeLancar />);
  await screen.findByText("Selecione um sítio para criar uma programação.");
  expect(
    screen.getByRole("button", { name: "Nova programação" }),
  ).toHaveProperty("disabled", true);
});
it("abertura que falha repete o mesmo detalhe e ignora erro de outro sítio", async () => {
  const antiga = pendente<ProgramacaoIatf>();
  vi.mocked(reqProtocolo).mockResolvedValue(paginaProgramacoes([programacao]));
  vi.mocked(obterCabecalhoProtocolo).mockImplementation(async (_contexto, sitio) => sitio === 1 ? cabecalho(await antiga.promessa) : cabecalho(programacao));
  const { rerender } = render(<Iatf propriedadeId={1} podeLancar={false} />);
  fireEvent.click(
    (await screen.findAllByRole("button", { name: /Programação confirmada/ }))[0],
  );
  expect(screen.getByRole("status").textContent).toBe(
    "Carregando programação…",
  );
  rerender(<Iatf propriedadeId={2} podeLancar={false} />);
  await act(async () => antiga.rejeitar(new Error("Falha do sítio anterior")));
  expect(screen.queryByText("Falha do sítio anterior")).toBeNull();
  vi.mocked(obterCabecalhoProtocolo)
    .mockRejectedValueOnce(new Error("Falha no detalhe"))
    .mockResolvedValueOnce(cabecalho(programacao));
  fireEvent.click(
    (await screen.findAllByRole("button", { name: /Programação confirmada/ }))[0],
  );
  await screen.findByRole("alert");
  fireEvent.click(
    screen.getByRole("button", { name: "Tentar abrir novamente" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Fechar detalhes" }),
    ).toBeTruthy(),
  );
  expect(obterCabecalhoProtocolo).toHaveBeenLastCalledWith({ programacaoId: "programacao" }, 2);
});
