// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisaoGeralReprodutiva } from "./VisaoGeralReprodutiva";
import {
  grupoVisaoGeral as g,
  execucaoVisaoGeral as p,
} from "./visao-geral.fixture";
const m = vi.hoisted(() => ({
  etapas: vi.fn(),
  agenda: vi.fn(),
  execucoes: vi.fn(),
  animais: vi.fn(),
  alertas: vi.fn(),
}));
vi.mock("./visao-geral-api", async (original) => ({
  ...(await original<typeof import("./visao-geral-api")>()),
  consultarAgendaVisaoGeral: m.agenda,
  consultarEtapasDoDia: m.etapas,
  consultarExecucoesVisaoGeral: m.execucoes,
  consultarAnimaisGrupoVisaoGeral: m.animais,
}));
vi.mock("../alertas/api", async (original) => ({
  ...(await original<typeof import("../alertas/api")>()),
  requisicaoAlertas: m.alertas,
}));
vi.mock("../../../lib/hoje", async (original) => ({
  ...(await original<typeof import("../../../lib/hoje")>()),
  getHojeISO: () => "2026-11-07",
}));
const vazio = {
  itens: [],
  total: 0,
  pagina: 1,
  tamanho: 10,
  totaisGerais: { cuidados: 0, necessidades: 0, animais: 0 },
  totaisFiltrados: { cuidados: 0, necessidades: 0, animais: 0 },
  tiposDisponiveis: [],
  cobertura: {
    estado: "ATUALIZADA",
    diaCoberto: "2026-11-07",
    ultimaConclusao: null,
    erro: null,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(
    null,
    "",
    "/pecuaria/reproducao?rotina=geral&sitio=7",
  );
  m.etapas.mockResolvedValue([
    {
      contextoId: "hoje",
      modo: "COLETIVO",
      nome: "Programação hoje",
      modelo: "Modelo",
      etapaId: "etapa-hoje",
      etapa: "Etapa hoje",
      tarefasIds: ["t1", "t2", "t3", "t4", "t5", "t6"],
      totalAnimais: 6,
      atendidos: 4,
      pendentes: 2,
      encerrados: 0,
    },
  ]);
  m.agenda.mockResolvedValue([
    g("hoje", "2026-11-07", {
      contexto: { programacaoId: "hoje", tarefasIds: ["t5", "t6"] },
      totalAnimais: 2,
    }),
    g("amanha", "2026-11-08"),
  ]);
  m.execucoes.mockResolvedValue([p("hoje"), p("amanha"), p("restante")]);
  m.alertas.mockResolvedValue(vazio);
});
afterEach(cleanup);
it("mostra quatro seções em tabelas e leva à etapa exata", async () => {
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  expect(
    await within(
      await screen.findByRole("table", { name: "Cuidados de hoje" }),
    ).findByText("Programação hoje"),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Hoje" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Próximos" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Em andamento" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Atenção" })).toBeTruthy();
  expect(
    await within(
      await screen.findByRole("table", { name: "Protocolos em andamento" }),
    ).findByText("Execução restante"),
  ).toBeTruthy();
  const etapas = within(
    screen.getByRole("table", { name: "Cuidados de hoje" }),
  ).getAllByRole("link", { name: "Abrir etapa" });
  expect(etapas[0].getAttribute("href")).toContain("/programacoes/hoje?");
  expect(etapas[0].getAttribute("href")).toContain("etapaId=etapa-hoje");
  expect(etapas[0].getAttribute("href")).toContain("sitio=7");
  expect(screen.queryByRole("link", { name: "Agenda completa" })).toBeNull();
  expect(screen.getByRole("table", { name: "Cuidados de hoje" })).toBeTruthy();
  expect(
    within(screen.getByRole("table", { name: "Cuidados de hoje" })).getByRole(
      "columnheader",
      { name: "Data prevista" },
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/horário não informado/)).toBeNull();
});
it("cobertura não avaliada é diferente de ausência de necessidades", async () => {
  m.alertas.mockResolvedValue({
    ...vazio,
    cobertura: { ...vazio.cobertura, estado: "NAO_AVALIADO" },
  });
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  expect(
    await screen.findByText(/cobertura ainda não permite afirmar ausência/),
  ).toBeTruthy();
  expect(
    screen.queryByText(
      "Nenhuma atenção identificada pelas regras reprodutivas avaliadas.",
    ),
  ).toBeNull();
  expect(m.alertas).toHaveBeenCalledWith(
    expect.stringContaining("produtor=reproducao"),
    undefined,
    expect.any(AbortSignal),
    7,
  );
});
it("erro da agenda preserva as outras consultas e não vira nenhum cuidado", async () => {
  m.agenda.mockRejectedValue(new Error("Agenda indisponível"));
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  expect(
    (await screen.findAllByText("Agenda indisponível")).length,
  ).toBeGreaterThan(0);
  expect(
    await screen.findByText(
      "Nenhuma atenção identificada pelas regras reprodutivas avaliadas.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Nenhum cuidado previsto para hoje.")).toBeNull();
});
it("grupo de DG abre somente os animais conferidos e preserva identidade do cuidado na ficha", async () => {
  const grupo = g("dg", "2026-11-07", {
    grupo: { origem: "RETORNO", identidade: "dg" },
    nome: "Diagnóstico pendente",
    turma: null,
    protocolo: null,
    etapa: null,
    contexto: { demandasPorAnimal: { animal: "demanda-exata" } },
    tipo: "AVALIACAO_REPRODUTIVA",
  });
  m.agenda.mockResolvedValue([grupo]);
  m.animais.mockResolvedValue({
    grupo,
    animais: [
      {
        animalId: "animal",
        tarefaId: null,
        brinco: "026",
        nome: "Estrela",
        motivos: ["DG com prazo congelado"],
        visitasAbertas: [],
      },
    ],
    total: 1,
    pagina: 1,
    tamanhoPagina: 10,
    fingerprint: "hash",
  });
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  fireEvent.click(
    await within(
      await screen.findByRole("table", { name: "Cuidados de hoje" }),
    ).findByRole("button", { name: "Ver cuidados" }),
  );
  const dialog = screen.getByRole("dialog");
  const link = await within(dialog).findByRole("link", {
    name: "Abrir cuidado",
  });
  expect(link.getAttribute("href")).toContain(
    "/pecuaria/rebanho/animais/animal?",
  );
  expect(link.getAttribute("href")).toContain("demandaId=demanda-exata");
  expect(link.getAttribute("href")).toContain("#reproducao");
  await waitFor(() =>
    expect(m.animais).toHaveBeenCalledWith(7, "2026-11-07", grupo, 1),
  );
});

it("Hoje mostra quatro atendidos e dois pendentes e conserva a etapa após o último atendimento", async () => {
  const { unmount } = render(<VisaoGeralReprodutiva propriedadeId={7} />);
  const titulo = await within(
    await screen.findByRole("table", { name: "Cuidados de hoje" }),
  ).findByText("Programação hoje");
  const linha = titulo.closest("tr")!;
  expect(
    within(linha)
      .getAllByRole("cell")
      .map((c) => c.textContent),
  ).toEqual(expect.arrayContaining(["6", "4", "2"]));
  unmount();
  const [etapa] = await m.etapas.mock.results[0].value;
  m.etapas.mockResolvedValue([{ ...etapa, atendidos: 6, pendentes: 0 }]);
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  const completa = (
    await within(
      await screen.findByRole("table", { name: "Cuidados de hoje" }),
    ).findByText("Programação hoje")
  ).closest("tr")!;
  expect(
    within(completa)
      .getAllByRole("cell")
      .map((c) => c.textContent),
  ).toEqual(expect.arrayContaining(["6", "0"]));
  expect(
    within(completa).getByRole("link", { name: "Abrir etapa" }),
  ).toBeTruthy();
});

it("busca próximos cuidados sem alterar Hoje nem ocultar cobertura", async () => {
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  const proximos = await screen.findByRole("table", {
    name: "Próximos cuidados",
  });
  expect(within(proximos).getByText("Programação amanha")).toBeTruthy();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Buscar próximos cuidados" }),
    { target: { value: "sem correspondência" } },
  );
  expect(
    screen.getByText("Nenhum cuidado encontrado para esta busca no intervalo."),
  ).toBeTruthy();
  expect(screen.getByRole("table", { name: "Cuidados de hoje" })).toBeTruthy();
  expect(
    screen.getByText(
      "Nenhuma atenção identificada pelas regras reprodutivas avaliadas.",
    ),
  ).toBeTruthy();
});
