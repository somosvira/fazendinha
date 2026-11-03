// @vitest-environment jsdom
import { alterarControle } from "@/lib/controles.fixture";
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
  listarParticipantesVisita, obterParticipanteVisita,
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
  listarParticipantesVisita: vi.fn(), obterParticipanteVisita: vi.fn(),
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
    fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await screen.findByText("Resposta perdida");
    fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await waitFor(() => expect(mudou).toHaveBeenCalled());
    expect(confirmarVisita).toHaveBeenCalledTimes(2);
    expect(vi.mocked(confirmarVisita).mock.calls[1][2]).toEqual(
      vi.mocked(confirmarVisita).mock.calls[0][2],
    );
    expect(salvarRascunhoVisita).toHaveBeenCalledTimes(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
    await screen.findByText(/100: Gestação mudou/);
    expect(confirmarVisita).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("switch", { name: /Revisei as mudanças/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
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
  fireEvent.click(screen.getByRole("button", {name: "Detalhes · 100"}));
  const anotacao = screen.getByRole("textbox", {name: "Anotação original · 100"});
  await alterarControle(anotacao, {target: {value: "Primeira edição"}});
  fireEvent.blur(anotacao);
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", {name: "Preencher procedimento"}));
  fireEvent.click(screen.getByRole("button", {name: "Preparar aplicação teste"}));
  await alterarControle(anotacao, {target: {value: "Edição durante salvamento"}});
  fireEvent.blur(anotacao);
  expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
  liberar({...atividade.participantes[0], versaoRascunho: 1});
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalledTimes(2));
  expect(vi.mocked(salvarRascunhoVisita).mock.calls[1].slice(3)).toEqual([{...atividade.participantes[0].rascunho, anotacaoOriginal: "Edição durante salvamento", dados: {produtoId: "novo"}, status: "CONFIRMADO"}, 1]);
  expect(anotacao).toHaveProperty("value", "Edição durante salvamento");
});
it("a guarda de saída salva alterações ainda focadas e recusa conflito CAS", async () => {
  const registrar = vi.fn();
  const a = { ...atividade, tipo: "APLICACAO_SANITARIA" as const };
  render(<Transcricao visita={visita} atividade={a} podeLancar registrarGuardaSaida={registrar} onMudou={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  await alterarControle(screen.getByRole("textbox", { name: "Anotação original · 100" }), { target: { value: "Rascunho ainda focado" } });
  await waitFor(() => expect(registrar).toHaveBeenCalledWith(expect.any(Function)));
  const guarda = registrar.mock.calls.at(-1)![0] as () => Promise<boolean>;
  await expect(guarda()).resolves.toBe(true);
  expect(salvarRascunhoVisita).toHaveBeenCalledWith("v", "p", 1, expect.objectContaining({ anotacaoOriginal: "Rascunho ainda focado" }), 0);

  vi.mocked(salvarRascunhoVisita).mockRejectedValueOnce(new RebanhoApiError("Outra sessão alterou o rascunho", 409, "CONFLITO"));
  await alterarControle(screen.getByRole("textbox", { name: "Anotação original · 100" }), { target: { value: "Nova edição concorrente" } });
  await expect(guarda()).resolves.toBe(false);
});
it("preserva rascunho em conflito quando confirmação de outro participante atualiza a visita", async () => {
  const registrar = vi.fn();
  let rerender!: ReturnType<typeof render>["rerender"];
  const a = { ...atividade, tipo: "APLICACAO_SANITARIA" as const, participantes: [
    atividade.participantes[0],
    { ...atividade.participantes[0], id: "p2", animalId: "a2", ordem: 2, snapshot: { brinco: "101" } },
  ] };
  const onMudou = vi.fn(async () => rerender(<Transcricao visita={visita} atividade={a} podeLancar registrarGuardaSaida={registrar} onMudou={onMudou} />));
  vi.mocked(salvarRascunhoVisita).mockRejectedValueOnce(new RebanhoApiError("Outra sessão alterou o rascunho", 409, "CONFLITO"));
  vi.mocked(confirmarVisita).mockResolvedValue({});
  const tela = render(<Transcricao visita={visita} atividade={a} podeLancar registrarGuardaSaida={registrar} onMudou={onMudou} />);
  rerender = tela.rerender;
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  const anotacao = screen.getByRole("textbox", { name: "Anotação original · 100" });
  await alterarControle(anotacao, { target: { value: "Rascunho local em conflito" } });
  fireEvent.blur(anotacao);
  await screen.findByText("Outra sessão alterou o rascunho");

  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar 101" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar selecionados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(onMudou).toHaveBeenCalled());
  expect(screen.getByRole("textbox", { name: "Anotação original · 100" })).toHaveProperty("value", "Rascunho local em conflito");
  const guarda = registrar.mock.calls.at(-1)![0] as () => Promise<boolean>;
  await expect(guarda()).resolves.toBe(false);
  expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
});
it("salva o procedimento inline de um participante limpo antes de permitir a navegação", async () => {
  const registrar = vi.fn();
  const a = { ...atividade, tipo: "APLICACAO_SANITARIA" as const };
  render(<Transcricao visita={visita} atividade={a} podeLancar registrarGuardaSaida={registrar} onMudou={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  fireEvent.click(screen.getByRole("button", { name: "Preencher procedimento" }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar aplicação teste" }));
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1));
  expect(vi.mocked(salvarRascunhoVisita).mock.calls[0][3]).toMatchObject({ status: "CONFIRMADO", dados: { produtoId: "novo" } });
  const guarda = registrar.mock.calls.at(-1)![0] as () => Promise<boolean>;
  await expect(guarda()).resolves.toBe(true);
  expect(salvarRascunhoVisita).toHaveBeenCalledTimes(1);
});
it("a guarda concilia resposta perdida de ausência sem exigir fato clínico", async () => {
  let remoteStatus = "PENDENTE";
  const registrar = vi.fn();
  const a = { ...atividade, tipo: "APLICACAO_SANITARIA" as const };
  vi.mocked(reqV4).mockImplementation(async url => url.startsWith("/visitas/v?")
    ? { ...visita, atividades: [{ ...a, participantes: [{ ...a.participantes[0], status: remoteStatus, motivo: remoteStatus === "NAO_ATENDIDO" ? "Animal não estava no curral" : null, rascunho: { ...a.participantes[0].rascunho, status: "NAO_ATENDIDO" } }] }] }
    : url.includes("tipos-exame") || url.includes("alertas-sanitarios") ? [] : url.startsWith("/reproducao?") ? painelVazio : { fingerprint: "a".repeat(64), participantes: [] });
  vi.mocked(confirmarVisita).mockRejectedValueOnce(new Error("Resposta perdida"));
  render(<Transcricao visita={visita} atividade={a} podeLancar registrarGuardaSaida={registrar} onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  await alterarControle(screen.getByRole("combobox", { name: "Atendimento · 100" }), { target: { value: "NAO_ATENDIDO" } });
  await alterarControle(screen.getByRole("textbox", { name: "Motivo de perda, correção, descarte ou pendência · 100" }), { target: { value: "Animal não estava no curral" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir animal" }));
  expect(confirmarVisita).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await screen.findByText("Resposta perdida");
  const guarda = registrar.mock.calls.at(-1)![0] as () => Promise<boolean>;
  await expect(guarda()).resolves.toBe(false);
  expect(screen.getByText(/confirmação sem resposta/)).toBeTruthy();
  remoteStatus = "NAO_ATENDIDO";
  await expect(guarda()).resolves.toBe(true);
  expect(confirmarVisita).toHaveBeenCalledTimes(1);
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
  await esperarOpcao("Ultrassom detalhado · v2");
  await alterarControle(screen.getByLabelText("Tipo de exame · 100"), { target: { value: "tipo-custom" } });
  await alterarControle(screen.getByLabelText(/Medida · mm/), { target: { value: "0" } });
  await alterarControle(screen.getByLabelText(/Achado/), { target: { value: "false" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
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
  expect(screen.getByRole("button", { name: "Conferir resultados (0)" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar 100" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar selecionados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await screen.findByText("Revise as pendências individuais antes de confirmar.");
  expect(confirmarVisita).not.toHaveBeenCalled();
  await alterarControle(screen.getByRole("combobox", { name: "Resultado · 100" }), { target: { value: "POSITIVO" } });
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
  await alterarControle(screen.getByRole("textbox", { name: "Motivo do atendimento pendente · 100" }), { target: { value: "Animal não estava no curral" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalled());
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toEqual([
    { participanteId: "p", status: "NAO_ATENDIDO", motivo: "Animal não estava no curral", dados: {} },
  ]);
});

it("não oferece conferência de uma tarefa com envelope vazio e sem resultado", () => {
  const a: AtividadeVisita = { ...atividade, tipo: "TAREFA_IATF", participantes: [{
    ...atividade.participantes[0], rascunho: { status: "PENDENTE", dados: {} },
    snapshot: { brinco: "100", tarefaPlanejada: { origem: "REPRODUTIVA", tarefa: { id: "t", animalId: "a", tipo: "AVALIACAO" } } },
  }] };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()} />);
  expect(within(screen.getAllByRole("row")[1]).getAllByRole("combobox")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Conferir resultados (0)" })).toHaveProperty("disabled", true);
  expect(salvarRascunhoVisita).not.toHaveBeenCalled();
  expect(confirmarVisita).not.toHaveBeenCalled();
});

it.each(["ADIADO", "NAO_ATENDIDO"] as const)("avaliação de tarefa aceita %s sem resultado ou exame", async status => {
  vi.mocked(confirmarVisita).mockResolvedValue({});
  const a: AtividadeVisita = { ...atividade, tipo: "TAREFA_IATF", participantes: [{
    ...atividade.participantes[0], rascunho: { status: "PENDENTE" },
    snapshot: { brinco: "100", tarefaPlanejada: { origem: "REPRODUTIVA", tarefa: { id: "t", animalId: "a", tipo: "AVALIACAO" } } },
  }] };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()} />);
  expect(within(screen.getAllByRole("row")[1]).getAllByRole("combobox")).toHaveLength(1);
  await alterarControle(screen.getByRole("combobox", { name: "Resultado · 100" }), { target: { value: status } });
  expect(confirmarVisita).not.toHaveBeenCalled();
  const detalhes = screen.getByRole("button", { name: "Detalhes · 100" });
  expect(detalhes.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(detalhes);
  expect(screen.queryByRole("textbox", { name: "Motivo do atendimento pendente · 100" })).toBeNull();
  fireEvent.click(detalhes);
  await alterarControle(screen.getByRole("textbox", { name: "Motivo do atendimento pendente · 100" }), { target: { value: "Animal indisponível" } });
  if (status === "ADIADO") await alterarControle(screen.getByLabelText("Nova previsão · 100"), { target: { value: "2026-10-20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar 100" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar selecionados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalled());
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toEqual([{ participanteId: "p", status, motivo: "Animal indisponível", dados: status === "ADIADO" ? { previstaPara: "2026-10-20" } : {} }]);
});

it("não divide automaticamente uma confirmação de 120 animais e preserva a seleção", async () => {
  const a: AtividadeVisita = { ...atividade, tipo: "TAREFA_IATF", participantes: Array.from({ length: 120 }, (_, i) => ({
    ...atividade.participantes[0], id: `p${i}`, animalId: `a${i}`, ordem: i + 1, rascunho: { status: "CONFIRMADO", realizadaEm: "2026-10-13", dados: { resultado: "NEGATIVO" } },
    snapshot: { brinco: String(100 + i), tarefaPlanejada: { origem: "REPRODUTIVA" as const, tarefa: { id: `t${i}`, animalId: `a${i}`, tipo: "AVALIACAO" } } },
  })) };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos os participantes filtrados" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar selecionados (120)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 120 atendimento(s)" }));
  await screen.findByText("Selecione até 100 participantes para uma confirmação única. Os demais rascunhos permanecem preservados.");
  expect(confirmarVisita).not.toHaveBeenCalled();
  expect(salvarRascunhoVisita).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox", { name: "Selecionar todos os participantes filtrados" })).toHaveProperty("checked", true);
}, 20_000);

it("conflito do autosave impede sobrescrita e confirmação", async () => {
  vi.mocked(salvarRascunhoVisita).mockRejectedValueOnce(new RebanhoApiError("Outra sessão alterou o rascunho", 409, "CONFLITO"));
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn()} />);
  await alterarControle(screen.getByRole("combobox", { name: "Resultado · 100" }), { target: { value: "NEGATIVO" } });
  await screen.findByText("Outra sessão alterou o rascunho");
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
    fireEvent.click(screen.getByRole("button", { name: "Preencher procedimento" }));
    await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/visitas/v/participantes/p/tarefa", undefined, "GET", 7));
    await waitFor(() => expect(obterSugestoesVisita).toHaveBeenCalledWith("2026-10-13", {}, 7));
    if (tipo === "AVALIACAO" || tipo === "TENTATIVA") {
      await screen.findByText("Procedimento reprodutivo pronto");
      expect(vi.mocked(FormReproducao).mock.calls.at(-1)?.[0]).toMatchObject({
        propriedadeId: 7, animalInicial: "a", tipoExameInicial: "exame-avaliacao", finalidadeInicial: "SEXAGEM", inline: true,
        tentativaInicial: planejado.etapa.planoTentativa,
      });
    } else if (tipo === "EXAME") {
      await screen.findByText("Procedimento sanitário pronto");
      expect(vi.mocked(FormFatoSanitario).mock.calls.at(-1)?.[0]).toMatchObject({ propriedadeId: 7, cadastroInicial: "exame-sanitario", inline: true });
    } else {
      await screen.findByRole("button", { name: "Preparar aplicação teste" });
      expect(vi.mocked(FormAplicacaoServico).mock.calls.at(-1)?.[0]).toMatchObject({ propriedadeId: 7,
        parametrosIniciais: { produtoId: "produto", dose: "2.5", unidade: "ML", via: "IM" }, inline: true,
      });
      expect(vi.mocked(FormAplicacaoServico).mock.calls.at(-1)?.[0].tarefa).toBeUndefined();
    }
  },
);

it("início IATF mostra versão escolhida e confirma animal novo sem cadastro prévio", async () => {
  const inicio: AtividadeVisita = { ...atividade, tipo: "INICIAR_IATF", nome: "Início da turma",
    contexto: { protocoloId: "protocolo-x", inicioIatf: { versao: 1, protocoloId: "protocolo-x", nomeProtocolo: "Protocolo X", versaoProtocolo: 3 } },
    participantes: [{ ...atividade.participantes[0], versaoRascunho: 4, rascunho: { status: "CONFIRMADO", inicioEfetivo: "2026-10-13" } }] };
  vi.mocked(obterSugestoesVisita).mockResolvedValueOnce({ animais: [], tarefasIatf: [], tarefasSanitarias: [], protocolosSanitarios: [], protocolosIatf: [], participantesIatf: [] });
  vi.mocked(confirmarVisita).mockResolvedValue({});
  render(<Transcricao visita={visita} atividade={inicio} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  expect(await screen.findByText("Protocolo X · versão 3")).toBeTruthy();
  expect(screen.getByText("A participação e as tarefas serão criadas ao confirmar este início.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Participação IATF · 100" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(1));
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens[0]).toMatchObject({ participanteId: "p", versaoRascunho: 4, dados: { inicioEfetivo: "2026-10-13" } });
});

it("início IATF filtra protocolo e identifica pendência única; ambiguidade permite escolha", async () => {
  const inicio: AtividadeVisita = { ...atividade, tipo: "INICIAR_IATF", contexto: { protocoloId: "x" } };
  vi.mocked(obterSugestoesVisita).mockResolvedValueOnce({ animais: [], tarefasIatf: [], tarefasSanitarias: [], protocolosSanitarios: [], protocolosIatf: [], participantesIatf: [
    { id: "p-x1", animalId: "a", programacaoId: "g-x1", inicioPrevisto: "2026-10-13", inicioEfetivo: null, protocoloId: "x", protocoloNome: "Protocolo X", protocoloVersao: 1, programacaoNome: "Turma manhã" },
    { id: "p-x2", animalId: "a", programacaoId: "g-x2", inicioPrevisto: "2026-10-13", inicioEfetivo: null, protocoloId: "x", protocoloNome: "Protocolo X", protocoloVersao: 1, programacaoNome: "Turma tarde" },
    { id: "p-y", animalId: "a", programacaoId: "g-y", inicioPrevisto: "2026-10-13", inicioEfetivo: null, protocoloId: "y", protocoloNome: "Protocolo Y" },
  ] });
  render(<Transcricao visita={visita} atividade={inicio} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  const escolha = await screen.findByRole("combobox", { name: "Participação IATF · 100" });
  await waitFor(() => expect(within(escolha).getAllByRole("option")).toHaveLength(3));
  expect(within(escolha).queryByText(/Protocolo Y/)).toBeNull();
  expect(within(escolha).getByText(/Turma manhã/)).toBeTruthy();
  expect(within(escolha).getByText(/Turma tarde/)).toBeTruthy();
});

it.each([
  { descricao: "criar nova participação quando não há opção atual", protocoloId: "x", participantes: [], destino: "" },
  { descricao: "trocar pela única participação atual compatível", protocoloId: "x", participantes: [{ id: "nova", animalId: "a", programacaoId: "g-nova", inicioPrevisto: "2026-10-13", inicioEfetivo: null, protocoloId: "x", protocoloNome: "Protocolo X", protocoloVersao: 1, programacaoNome: "Turma atual" }], destino: "nova" },
  { descricao: "selecionar participação em atividade antiga sem protocolo", protocoloId: undefined, participantes: [{ id: "nova", animalId: "a", programacaoId: "g-nova", inicioPrevisto: "2026-10-13", inicioEfetivo: null, protocoloId: "x", protocoloNome: "Protocolo X", protocoloVersao: 1, programacaoNome: "Turma atual" }], destino: "nova" },
])("início IATF torna explícito o vínculo salvo indisponível: $descricao", async ({ protocoloId, participantes, destino }) => {
  const inicio: AtividadeVisita = { ...atividade, tipo: "INICIAR_IATF", contexto: protocoloId ? { protocoloId } : {}, participantes: [
    { ...atividade.participantes[0], status: "PENDENTE", rascunho: { participanteIatfId: "cancelada" } },
  ] };
  vi.mocked(obterSugestoesVisita).mockResolvedValueOnce({ animais: [], tarefasIatf: [], tarefasSanitarias: [], protocolosSanitarios: [], protocolosIatf: [], participantesIatf: participantes });
  render(<Transcricao visita={visita} atividade={inicio} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Detalhes · 100" }));
  expect((await screen.findByRole("alert")).textContent).toContain("deixou de estar disponível");
  const escolha = await screen.findByRole("combobox", { name: "Participação IATF · 100" });
  expect((escolha as HTMLSelectElement).value).toBe("cancelada");
  expect((within(escolha).getByRole("option", { name: /Participação anterior indisponível/ }) as HTMLOptionElement).disabled).toBe(true);
  await alterarControle(escolha, { target: { value: destino } });
  fireEvent.blur(escolha);
  await waitFor(() => expect(salvarRascunhoVisita).toHaveBeenCalled());
  expect(vi.mocked(salvarRascunhoVisita).mock.calls.at(-1)?.[3]).toMatchObject({ participanteIatfId: destino });
});

it("oferece conduta na avaliação coletiva, salva descarte e limpa IATF ao mudar conclusão", async () => {
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Resultado · 100"), {target:{value:"NEGATIVO"}});
  fireEvent.click(screen.getByRole("button", {name:"Detalhes · 100"}));
  await alterarControle(screen.getByLabelText("Conduta · 100"), {target:{value:"DESCARTE"}});
  const motivo = screen.getByLabelText("Motivo do descarte · 100");
  await alterarControle(motivo, {target:{value:"Restrição reprodutiva documentada"}}); fireEvent.blur(motivo);
  await waitFor(()=>expect(salvarRascunhoVisita).toHaveBeenLastCalledWith("v","p",1,expect.objectContaining({conduta:"DESCARTE",motivo:"Restrição reprodutiva documentada"}),expect.anything()));
  await alterarControle(screen.getByLabelText("Conduta · 100"), {target:{value:"IATF"}});
  await alterarControle(screen.getByLabelText("Resultado · 100"), {target:{value:"INCONCLUSIVO"}});
  await waitFor(()=>expect(salvarRascunhoVisita).toHaveBeenLastCalledWith("v","p",1,expect.objectContaining({conduta:"",resultado:"INCONCLUSIVO"}),expect.anything()));
  expect(confirmarVisita).not.toHaveBeenCalled();
});

it("conserva motivo do desvio sanitário ao preparar e salvar o procedimento da visita", async () => {
  vi.mocked(reqV4).mockImplementation(async url => url.includes("/tarefa") ? {origem:"SANITARIA",tarefa:{id:"t",tipo:"APLICACAO",produtoId:"produto",dose:"1",unidade:"ML"}} : url.startsWith("/reproducao?") ? painelVazio : []);
  const a:AtividadeVisita={...atividade,tipo:"APLICACAO_SANITARIA",participantes:[{...atividade.participantes[0],tarefaSanitariaId:"t",rascunho:null}]};
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:"Detalhes · 100"}));
  const campo=screen.getByLabelText("Motivo do desvio · 100");
  await alterarControle(campo,{target:{value:"Visita realizada no dia seguinte"}});fireEvent.blur(campo);
  fireEvent.click(screen.getByRole("button",{name:"Preencher procedimento"}));
  fireEvent.click(await screen.findByRole("button",{name:"Preparar aplicação teste"}));
  await waitFor(()=>expect(salvarRascunhoVisita).toHaveBeenLastCalledWith("v","p",1,expect.objectContaining({dados:{produtoId:"novo",desvio:{motivo:"Visita realizada no dia seguinte"}},status:"CONFIRMADO"}),expect.anything()));
  expect(confirmarVisita).not.toHaveBeenCalled();
});

it("indicação aninhada na tarefa abre programação somente por ação explícita", async () => {
  const a:AtividadeVisita={...atividade,tipo:"TAREFA_IATF",participantes:[{...atividade.participantes[0],status:"CONFIRMADO",snapshot:{brinco:"100",tarefaPlanejada:{tarefa:{tipo:"AVALIACAO"}} as never},rascunho:{dados:{resultado:"NEGATIVO",conduta:"IATF"}}}]};
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn()}/>);
  const programar=await screen.findByRole("button",{name:"Programar IATF para indicados (1)"});
  await waitFor(()=>expect(programar).toHaveProperty("disabled",false));
  expect(screen.queryByText(/Programação existente:/)).toBeNull();
  fireEvent.click(programar);
  expect(screen.getByText("Programação existente: a")).toBeTruthy();
  expect(confirmarVisita).not.toHaveBeenCalled();
});

it("mostra mudança fora da primeira página e confirma onze animais em uma operação", async () => {
  vi.mocked(confirmarVisita).mockResolvedValue({});
  vi.mocked(reqV4).mockImplementation(async url => {
    if (url.includes("tipos-exame") || url.includes("alertas-sanitarios")) return [];
    if (url.startsWith("/reproducao?")) return painelVazio;
    const query = new URL(url, "https://local").searchParams;
    const pagina = Number(query.get("pagina") || 1);
    return { fingerprint: "p".repeat(64), total: 11, pagina, porPagina: 10, totalComAlteracoes: 1, participantes: Array.from({ length: pagina === 1 ? 10 : 1 }, (_, i) => { const n = (pagina - 1) * 10 + i; return { participanteId: `p${n}`, animalId: `a${n}`, alteracoes: n === 10 ? ["Localização mudou"] : [] }; }) };
  });
  const a: AtividadeVisita = { ...atividade, participantes: Array.from({ length: 11 }, (_, i) => ({ ...atividade.participantes[0], id: `p${i}`, animalId: `a${i}`, ordem: i + 1, snapshot: { brinco: String(i + 1) } })) };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (11)" }));
  expect(within(screen.getByRole("region", { name: "Revisão do subconjunto" })).getAllByRole("listitem")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 11 atendimento(s)" }));
  await screen.findByText("Revise as mudanças desde a preparação e confirme ciência antes de registrar.");
  expect(confirmarVisita).not.toHaveBeenCalled();
  const primeira = vi.mocked(reqV4).mock.calls.find(([url]) => url.includes("/previa?"))!;
  expect(new URL(primeira[0], "https://local").searchParams.getAll("participanteId")).toHaveLength(11);
  fireEvent.click(screen.getByRole("button", { name: "Próximo contexto" }));
  await screen.findByText("11: Localização mudou");
  fireEvent.click(screen.getByRole("switch", { name: /Revisei as mudanças/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 11 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(1));
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens).toHaveLength(11);
});

it("tarefa adiada sem nova previsão permanece em rascunho e não executa fato", async () => {
  const a: AtividadeVisita = { ...atividade, tipo: "TAREFA_IATF", participantes: [{ ...atividade.participantes[0], rascunho: { status: "ADIADO", motivo: "Animal indisponível" }, snapshot: { brinco: "100", tarefaPlanejada: { origem: "REPRODUTIVA", tarefa: { id: "t", animalId: "a", tipo: "MANEJO" } } } }] };
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await screen.findByText("Revise as pendências individuais antes de confirmar.");
  expect(confirmarVisita).not.toHaveBeenCalled();
});

it("prévia clínica mostra consumo global, pagina materiais e só confirma após conferência do servidor", async () => {
  vi.mocked(confirmarVisita).mockResolvedValue({});
  vi.mocked(reqV4).mockImplementation(async url => {
    if (url.includes("tipos-exame") || url.includes("alertas-sanitarios")) return [];
    if (url.startsWith("/reproducao?")) return painelVazio;
    const pagina = Number(new URL(url, "https://local").searchParams.get("paginaConsumos") || 1);
    return { fingerprint: "c".repeat(64), total: 1, pagina: 1, porPagina: 10, totalComAlteracoes: 0, participantes: [{ participanteId: "p", animalId: "a", alteracoes: [] }], execucaoProtocolos: { estado: "CONFERIDA", totalConsumos: 11, paginaConsumos: pagina, porPaginaConsumos: 10, consumos: Array.from({ length: pagina === 1 ? 10 : 1 }, (_, i) => ({ produtoNome: `Material ${(pagina - 1) * 10 + i + 1}`, quantidade: "1", unidade: "UN" })) } };
  });
  render(<Transcricao visita={visita} atividade={atividade} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Conferir resultados (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await screen.findByText("Confira os procedimentos e os materiais previstos antes de confirmar o conjunto.");
  expect(confirmarVisita).not.toHaveBeenCalled();
  expect(screen.queryByText("Material 11: 1 UN")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Próximos materiais" }));
  await screen.findByText("Material 11: 1 UN");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 atendimento(s)" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(1));
});

it("consulta participantes por página no servidor e conserva seleção e rascunho entre onze registros", async () => {
  const participantes = Array.from({ length: 11 }, (_, i) => ({ ...atividade.participantes[0], id:`p${i}`,animalId:`a${i}`,ordem:i+1,versaoRascunho:0,snapshot:{brinco:String(100+i)},rascunho:{resultado:"NEGATIVO"} }));
  vi.mocked(listarParticipantesVisita).mockImplementation(async (_v,_a,_s,f) => ({itens:participantes.slice(((f?.pagina??1)-1)*10,(f?.pagina??1)*10),total:11,pagina:f?.pagina??1,porPagina:10}));
  vi.mocked(salvarRascunhoVisita).mockImplementation(async (_v,id,_s,r) => {const p=participantes.find(p=>p.id===id)!;p.rascunho=r as typeof p.rascunho;p.versaoRascunho++;return p;});
  vi.mocked(confirmarVisita).mockResolvedValue({});
  const a:AtividadeVisita={...atividade,participantes:[],totais:{totalParticipantes:11,confirmados:0,pendentes:11,naoAtendidos:0,adiados:0}};
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)}/>);
  await screen.findByRole("checkbox",{name:"Selecionar 100"});
  expect(listarParticipantesVisita).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("checkbox",{name:"Selecionar 110"})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar 100"}));
  await alterarControle(screen.getByRole("combobox",{name:"Resultado · 100"}),{target:{value:"INCONCLUSIVO"}});
  fireEvent.blur(screen.getByRole("combobox",{name:"Resultado · 100"}));
  await waitFor(()=>expect(salvarRascunhoVisita).toHaveBeenCalled());
  const navegacao=screen.getByRole("navigation",{name:"Paginação dos participantes"});
  fireEvent.click(within(navegacao).getByRole("button",{name:"Próxima"}));
  fireEvent.click(await screen.findByRole("checkbox",{name:"Selecionar 110"}));
  fireEvent.click(within(navegacao).getByRole("button",{name:"Anterior"}));
  expect(await screen.findByRole("combobox",{name:"Resultado · 100"})).toHaveProperty("value","INCONCLUSIVO");
  expect(screen.getByRole("checkbox",{name:"Selecionar 100"})).toHaveProperty("checked",true);
  fireEvent.click(screen.getByRole("button",{name:"Revisar selecionados (2)"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirmar 2 atendimento(s)"}));
  await waitFor(()=>expect(confirmarVisita).toHaveBeenCalledTimes(1));
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens.map(p=>p.participanteId)).toEqual(["p0","p10"]);
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens[0].dados).toMatchObject({resultado:"INCONCLUSIVO"});
});

it("pagina o recibo de onze confirmações sem repetir a operação",async()=>{
 const participantes=Array.from({length:11},(_,i)=>({...atividade.participantes[0],id:`p${i}`,animalId:`a${i}`,ordem:i+1,status:"CONFIRMADO",snapshot:{brinco:String(i+1)}}));
 vi.mocked(confirmarVisita).mockResolvedValue({itens:participantes.slice(0,10),total:11,pagina:1,porPagina:10});
 vi.mocked(reqV4).mockImplementation(async url=>url.includes("/confirmacoes/")?{itens:participantes.slice(10),total:11,pagina:2,porPagina:10}:url.includes("tipos-exame")||url.includes("alertas-sanitarios")?[]:url.startsWith("/reproducao?")?painelVazio:{fingerprint:"r".repeat(64),participantes:[]});
 render(<Transcricao visita={visita} atividade={{...atividade,participantes:participantes.map(p=>({...p,status:"PENDENTE"}))}} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)}/>);
 fireEvent.click(screen.getByRole("button",{name:"Conferir resultados (11)"}));fireEvent.click(screen.getByRole("button",{name:"Confirmar 11 atendimento(s)"}));
 const recibo=await screen.findByRole("region",{name:"Recibo da confirmação"});expect(within(recibo).getAllByRole("listitem")).toHaveLength(10);
 fireEvent.click(within(recibo).getByRole("button",{name:"Próximo recibo"}));await waitFor(()=>expect(within(recibo).getAllByRole("listitem")).toHaveLength(1));expect(confirmarVisita).toHaveBeenCalledTimes(1);
});

async function esperarOpcao(nome: string | RegExp) {
    await waitFor(() => expect(Array.from(document.querySelectorAll("option")).some(o => typeof nome === "string" ? o.textContent === nome : nome.test(o.textContent ?? ""))).toBe(true));
}
