// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transcricao } from "./TranscricaoVisita";
import {
  confirmarVisita,
  obterSugestoesVisita,
  salvarRascunhoVisita,
  type AtividadeVisita,
  type Visita,
} from "./visitas-api";
import { reqV4 } from "./api";
import { RebanhoApiError } from "../api";
import { FormReproducao } from "./FormReproducao";
import { FormFatoSanitario } from "../sanidade/FormFatoSanitario";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./FormReproducao", () => ({ FormReproducao: vi.fn(() => <p>Procedimento reprodutivo pronto</p>) }));
vi.mock("../sanidade/FormFatoSanitario", () => ({ FormFatoSanitario: vi.fn(() => <p>Procedimento sanitário pronto</p>) }));
vi.mock("./Iatf", () => ({
  Iatf: ({ animaisIndicadosInicialmente }: { animaisIndicadosInicialmente?: string[] }) =>
    <p>Programação existente: {animaisIndicadosInicialmente?.join(", ")}</p>,
}));
vi.mock("../sanidade/FormAplicacaoServico", () => ({
  FormAplicacaoServico: vi.fn(({onRegistrar}: {onRegistrar: (dados: object) => Promise<void>}) => <button onClick={() => void onRegistrar({produtoId: "novo"})}>Preparar aplicação teste</button>),
}));
vi.mock("./api", () => ({
  obterReproducao: vi
    .fn()
    .mockResolvedValue({
      animais: [],
      tentativas: [],
      avaliacoes: [],
      partos: [],
      restricoes: [],
    }),
  reqV4: vi.fn(),
}));
vi.mock("./visitas-api", async (original) => ({
  ...(await original<typeof import("./visitas-api")>()),
  confirmarVisita: vi.fn(),
  salvarRascunhoVisita: vi.fn(),
  obterSugestoesVisita: vi
    .fn()
    .mockResolvedValue({
      animais: [],
      tarefasSanitarias: [],
      tarefasIatf: [],
      protocolosSanitarios: [],
      protocolosIatf: [],
    }),
}));
const painelVazio = { animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] };
const atividade: AtividadeVisita = {
  id: "at",
  nome: "Diagnóstico",
  tipo: "AVALIACAO_REPRODUTIVA",
  extra: false,
  participantes: [
    {
      id: "p",
      animalId: "a",
      ordem: 1,
      status: "PENDENTE",
      rascunho: {
        resultado: "NAO_AVALIADO",
        anotacaoOriginal: "Não estava no curral",
      },
      snapshot: { brinco: "100" },
    },
  ],
};
const visita: Visita = {
  id: "v",
  nome: "Visita",
  data: "2026-10-13",
  propriedadeId: 1,
  status: "ABERTA",
  atividades: [atividade],
  impressoes: [],
};
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/pecuaria/visitas/v");
  vi.mocked(reqV4).mockImplementation(async url => url.includes("tipos-exame") || url.includes("alertas-sanitarios") ? [] : url.startsWith("/reproducao?") ? painelVazio : ({
    fingerprint: "a".repeat(64),
    participantes: [],
  }));
  vi.mocked(salvarRascunhoVisita).mockResolvedValue({...atividade.participantes[0], versaoRascunho: 1});
});
describe("confirmação da transcrição", () => {
  it("resposta perdida repete o mesmo envelope sem regravar rascunho já confirmado", async () => {
    vi.mocked(confirmarVisita)
      .mockRejectedValueOnce(new Error("Resposta perdida"))
      .mockResolvedValueOnce({});
    const mudou = vi.fn().mockResolvedValue(undefined);
    render(
      <Transcricao
        visita={visita}
        atividade={atividade}
        podeLancar
        onMudou={mudou}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await screen.findByText("Resposta perdida");
    fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await waitFor(() => expect(mudou).toHaveBeenCalled());
    expect(confirmarVisita).toHaveBeenCalledTimes(2);
    expect(vi.mocked(confirmarVisita).mock.calls[1][2]).toEqual(
      vi.mocked(confirmarVisita).mock.calls[0][2],
    );
    expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
    expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toEqual([
      {
        participanteId: "p",
        status: "CONFIRMADO",
        motivo: undefined,
        dados: {
          resultado: "NAO_AVALIADO",
          anotacaoOriginal: "Não estava no curral",
        },
      },
    ]);
  });
  it("mudança de contexto exige revisão explícita e leva fingerprint na confirmação", async () => {
    vi.mocked(reqV4).mockImplementation(async url => url.includes("tipos-exame") || url.includes("alertas-sanitarios") ? [] : url.startsWith("/reproducao?") ? painelVazio : ({
      fingerprint: "b".repeat(64),
      participantes: [
        { participanteId: "p", animalId: "a", alteracoes: ["Gestação mudou"] },
      ],
    }));
    vi.mocked(confirmarVisita).mockResolvedValue({});
    render(
      <Transcricao
        visita={visita}
        atividade={atividade}
        podeLancar
        onMudou={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await screen.findByText(/100: Gestação mudou/);
    expect(confirmarVisita).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("switch", { name: /Revisei as mudanças/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await waitFor(() => expect(confirmarVisita).toHaveBeenCalled());
    expect(vi.mocked(confirmarVisita).mock.calls[0][2]).toMatchObject({
      cienciaAlteracoes: true,
      fingerprintPrevia: "b".repeat(64),
    });
  });
});

it("serializa formulário e autosave com versão e conserva edições enquanto a resposta está pendente", async () => {
  let liberar!: (p: typeof atividade.participantes[number]) => void;
  vi.mocked(salvarRascunhoVisita).mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; })).mockResolvedValue({...atividade.participantes[0], versaoRascunho: 2});
  const a = {...atividade, tipo: "APLICACAO_SANITARIA" as const};
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()} />);
  const anotacao = screen.getByRole("textbox", {name: "Anotação original · 100"});
  fireEvent.change(anotacao, {target: {value: "Primeira edição"}});
  fireEvent.blur(anotacao);
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", {name: "Preencher procedimento"}));
  fireEvent.click(screen.getByRole("button", {name: "Preparar aplicação teste"}));
  fireEvent.change(anotacao, {target: {value: "Edição durante salvamento"}});
  fireEvent.blur(anotacao);
  expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
  liberar({...atividade.participantes[0], versaoRascunho: 1});
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalledTimes(3));
  expect(vi.mocked(salvarRascunhoVisita).mock.calls[1].slice(3)).toEqual([{...atividade.participantes[0].rascunho, anotacaoOriginal: "Edição durante salvamento", dados: {produtoId: "novo"}, status: "CONFIRMADO"}, 1]);
  expect(anotacao).toHaveProperty("value", "Edição durante salvamento");
});
it("visita encerrada permite regularizar vínculo sem permitir reabrir atendimento", async () => {
  const a = {...atividade, participantes: atividade.participantes.map(p => ({...p,status:"CONFIRMADO",fatoId:"av",regularizacaoPendente:true}))};
  render(<Transcricao visita={{...visita,status:"ENCERRADA"}} atividade={a} podeLancar={false} podeRegularizar onMudou={vi.fn()} />);
  fireEvent.click(screen.getByRole("button",{name:"Regularizar origem do fato anulado"}));
  expect(screen.getByRole("option",{name:"Reabrir pendência"})).toHaveProperty("disabled",true);
  expect(screen.getByRole("option",{name:"Vincular fato substituto comprovado"})).toHaveProperty("disabled",false);
});
it("seleciona exame personalizado por animal e preserva zero e falso no rascunho e na confirmação", async () => {
  vi.mocked(reqV4).mockImplementation(async url => url.includes("tipos-exame") ? [{ id: "tipo-custom", nome: "Ultrassom detalhado", ativo: true, versaoFormato: 2, formatoExameHash: "c".repeat(64), campos: [
    { codigo: "MEDIDA", rotulo: "Medida", tipo: "NUMERO", unidade: "mm", obrigatorio: true },
    { codigo: "ACHADO", rotulo: "Achado", tipo: "BOOLEANO", obrigatorio: false },
  ] }] : url.startsWith("/reproducao?") ? painelVazio : { fingerprint: "a".repeat(64), participantes: [] });
  const a = { ...atividade, participantes: [{ ...atividade.participantes[0], rascunho: { resultado: "NEGATIVO", finalidade: "DIAGNOSTICO" } }] };
  vi.mocked(confirmarVisita).mockResolvedValue({});
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  await screen.findByRole("option", { name: "Ultrassom detalhado · v2" });
  fireEvent.change(screen.getByLabelText("Tipo de exame · 100"), { target: { value: "tipo-custom" } });
  fireEvent.change(screen.getByLabelText(/Medida · mm/), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText(/Achado/), { target: { value: "false" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(1));
  const dados = { tipoExameId: "tipo-custom", formatoExameHash: "c".repeat(64), resultados: [{ campo: "MEDIDA", valor: "0" }, { campo: "ACHADO", valor: false }] };
  expect(vi.mocked(salvarRascunhoVisita).mock.calls.at(-1)?.[3]).toMatchObject(dados);
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens[0].dados).toMatchObject(dados);
});


it("linha intocada permanece pendente e resultado não assume atendimento ou vínculo", async () => {
  const a: AtividadeVisita = { ...atividade, participantes: [{ ...atividade.participantes[0], rascunho: null,
    snapshot: { brinco: "100", tentativa: { id: "tentativa-conhecida", data: "2026-09-10", tipo: "IA" } } }] };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: "Resultado · 100" })).toHaveProperty("value", "");
  expect(screen.queryByRole("combobox", { name: "Atendimento · 100" })).toBeNull();
  expect(salvarRascunhoVisita).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await screen.findByText("Revise as pendências individuais antes de confirmar.");
  expect(confirmarVisita).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Resultado · 100" }), { target: { value: "POSITIVO" } });
  expect(screen.getByRole("textbox", { name: "Motivo da tentativa não comprovada · 100" })).toBeTruthy();
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalled());
  const r = vi.mocked(salvarRascunhoVisita).mock.calls.at(-1)![3];
  expect(r).toMatchObject({ resultado: "POSITIVO", status: "CONFIRMADO", finalidade: "DIAGNOSTICO" });
  expect(r.tentativaId).toBeUndefined();
});

it("ausência é uma ação explícita, exige motivo e não executa resultado clínico", async () => {
  vi.mocked(confirmarVisita).mockResolvedValue({});
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  fireEvent.click(screen.getByRole("button", { name: "Marcar ausente" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo do atendimento pendente · 100" }), { target: { value: "Animal não estava no curral" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalled());
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toEqual([
    { participanteId: "p", status: "NAO_ATENDIDO", motivo: "Animal não estava no curral", dados: {} },
  ]);
});

it("confirma 100 de 101 e mantém o último selecionado com seu rascunho", async () => {
  vi.mocked(confirmarVisita).mockResolvedValue({});
  const a: AtividadeVisita = { ...atividade, participantes: Array.from({ length: 101 }, (_, i) => ({
    ...atividade.participantes[0], id: `p${i}`, animalId: `a${i}`, ordem: i + 1,
    snapshot: { brinco: String(100 + i) },
  })) };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar animais visíveis" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar selecionados (101)" }));
  const revisao = screen.getByRole("region", { name: "Revisão do subconjunto" });
  expect(within(revisao).getAllByRole("listitem")).toHaveLength(100);
  expect(within(revisao).getByText(/1 selecionado.*próximo subconjunto/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 100 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(1));
  await screen.findByRole("button", { name: "Revisar selecionados (1)" });
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toHaveLength(100);
  expect(screen.getByRole("checkbox", { name: "Selecionar 200" })).toHaveProperty("checked", true);
  expect(screen.getByRole("combobox", { name: "Resultado · 200" })).toHaveProperty("value", "NAO_AVALIADO");
  fireEvent.click(screen.getByRole("button", { name: "Revisar selecionados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(2));
  expect(vi.mocked(confirmarVisita).mock.calls[1][2].itens.map(i => i.participanteId)).toEqual(["p100"]);
}, 15_000);

it("conflito do autosave impede sobrescrita e confirmação", async () => {
  vi.mocked(salvarRascunhoVisita).mockRejectedValueOnce(new RebanhoApiError("Outra sessão alterou o rascunho", 409, "CONFLITO"));
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Resultado · 100" }), { target: { value: "NEGATIVO" } });
  await screen.findByText("Outra sessão alterou o rascunho");
  fireEvent.click(screen.getByRole("button", { name: "Revisar animal" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await screen.findByText("Não foi possível salvar todos os rascunhos. Tente novamente.");
  expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
  expect(confirmarVisita).not.toHaveBeenCalled();
});

it("indicação confirmada leva à programação existente só por ação explícita", async () => {
  const a: AtividadeVisita = { ...atividade, participantes: [{ ...atividade.participantes[0], status: "CONFIRMADO",
    rascunho: { resultado: "NEGATIVO", conduta: "IATF" } }] };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()} />);
  const programar = await screen.findByRole("button", { name: "Programar IATF para indicados (1)" });
  await waitFor(() => expect(programar).toHaveProperty("disabled", false));
  expect(screen.queryByText(/Programação existente:/)).toBeNull();
  fireEvent.click(programar);
  expect(screen.getByText("Programação existente: a")).toBeTruthy();
  expect(confirmarVisita).not.toHaveBeenCalled();
  expect(reqV4).not.toHaveBeenCalledWith(expect.stringContaining("/inicio"), expect.anything());
});


it.each(["AVALIACAO", "TENTATIVA", "EXAME", "APLICACAO"] as const)(
  "carrega tarefa %s fora da janela de sugestões e abre os parâmetros no sítio da visita",
  async tipo => {
    setPropriedadeAtiva(99);
    const planejado = { etapa: {
      planoAvaliacao: { tipoExameId: "exame-avaliacao", tipo: "SEXAGEM" as const },
      planoTentativa: { tipo: "TE" as const, materialId: "embriao", quantidade: 1 },
      planoExame: { tipoExameId: "exame-sanitario" },
      planoAplicacao: { produtoId: "produto", dose: "2.5", unidadeDose: "ML", via: "IM" },
    } };
    vi.mocked(reqV4).mockImplementation(async (url) => url.includes("/participantes/p/tarefa")
      ? { origem: "REPRODUTIVA", tarefa: { id: "futura", animalId: "a", tipo, planejadoSnapshot: planejado } }
      : url.startsWith("/reproducao?") ? painelVazio : []);
    const a: AtividadeVisita = { ...atividade, tipo: "TAREFA_IATF", participantes: [{ ...atividade.participantes[0], tarefaIatfId: "futura", rascunho: null }] };
    render(<Transcricao visita={{ ...visita, propriedadeId: 7 }} atividade={a} podeLancar onMudou={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Preencher procedimento" }));
    await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/visitas/v/participantes/p/tarefa", undefined, "GET", 7));
    await waitFor(() => expect(obterSugestoesVisita).toHaveBeenCalledWith("2026-10-13", {}, 7));
    if (tipo === "AVALIACAO" || tipo === "TENTATIVA") {
      await screen.findByText("Procedimento reprodutivo pronto");
      expect(vi.mocked(FormReproducao).mock.calls.at(-1)?.[0]).toMatchObject({
        propriedadeId: 7, animalInicial: "a", tipoExameInicial: "exame-avaliacao", finalidadeInicial: "SEXAGEM",
        tentativaInicial: planejado.etapa.planoTentativa,
      });
    } else if (tipo === "EXAME") {
      await screen.findByText("Procedimento sanitário pronto");
      expect(vi.mocked(FormFatoSanitario).mock.calls.at(-1)?.[0]).toMatchObject({ propriedadeId: 7, cadastroInicial: "exame-sanitario" });
    } else {
      await screen.findByRole("button", { name: "Preparar aplicação teste" });
      expect(vi.mocked(FormAplicacaoServico).mock.calls.at(-1)?.[0]).toMatchObject({ propriedadeId: 7,
        parametrosIniciais: { produtoId: "produto", dose: "2.5", unidade: "ML", via: "IM" },
      });
      expect(vi.mocked(FormAplicacaoServico).mock.calls.at(-1)?.[0].tarefa).toBeUndefined();
    }
  },
);
