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
  agenda: vi.fn(),
  execucoes: vi.fn(),
  animais: vi.fn(),
  alertas: vi.fn(),
}));
vi.mock("./visao-geral-api", async (original) => ({
  ...(await original<typeof import("./visao-geral-api")>()),
  consultarAgendaVisaoGeral: m.agenda,
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
  m.agenda.mockResolvedValue([
    g("hoje", "2026-11-07"),
    g("amanha", "2026-11-08"),
  ]);
  m.execucoes.mockResolvedValue([p("hoje"), p("amanha"), p("restante")]);
  m.alertas.mockResolvedValue(vazio);
});
afterEach(cleanup);
it("mostra as quatro seções reais, leva à etapa exata e conserva acesso às filas completas", async () => {
  render(<VisaoGeralReprodutiva propriedadeId={7} />);
  expect(await screen.findByText("Programação hoje")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Hoje" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Próximos" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Em andamento" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Atenção" })).toBeTruthy();
  expect(await screen.findByText("Execução restante")).toBeTruthy();
  const etapas = screen.getAllByRole("link", { name: "Abrir etapa" });
  expect(etapas[0].getAttribute("href")).toContain("/programacoes/hoje?");
  expect(etapas[0].getAttribute("href")).toContain("etapaId=etapa-hoje");
  expect(etapas[0].getAttribute("href")).toContain("sitio=7");
  expect(
    screen
      .getByRole("link", { name: "Animais e acompanhamentos" })
      .getAttribute("href"),
  ).toContain("rotina=ciclos");
  expect(
    screen.getByRole("link", { name: "Agenda completa" }).getAttribute("href"),
  ).toContain("rotina=agenda");
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
  fireEvent.click(await screen.findByRole("button", { name: "Ver cuidados" }));
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
