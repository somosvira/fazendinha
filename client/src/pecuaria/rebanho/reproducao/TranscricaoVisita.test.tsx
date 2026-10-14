// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transcricao } from "./TranscricaoVisita";
import {
  confirmarVisita,
  salvarRascunhoVisita,
  type AtividadeVisita,
  type Visita,
} from "./visitas-api";
import { reqV4 } from "./api";
vi.mock("../sanidade/FormAplicacaoServico", () => ({
  FormAplicacaoServico: ({onRegistrar}: {onRegistrar: (dados: object) => Promise<void>}) => <button onClick={() => void onRegistrar({produtoId: "novo"})}>Preparar aplicação teste</button>,
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
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/pecuaria/visitas/v");
  vi.mocked(reqV4).mockImplementation(async url => url.includes("tipos-exame") ? [] : ({
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
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
    await screen.findByText("Resposta perdida");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
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
    vi.mocked(reqV4).mockImplementation(async url => url.includes("tipos-exame") ? [] : ({
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
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
    await screen.findByText(/100: Gestação mudou/);
    expect(confirmarVisita).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("switch", { name: /Revisei as mudanças/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
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
  ] }] : { fingerprint: "a".repeat(64), participantes: [] });
  const a = { ...atividade, participantes: [{ ...atividade.participantes[0], rascunho: { resultado: "NEGATIVO", finalidade: "DIAGNOSTICO" } }] };
  vi.mocked(confirmarVisita).mockResolvedValue({});
  render(<Transcricao visita={visita} atividade={a} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  await screen.findByRole("option", { name: "Ultrassom detalhado · v2" });
  fireEvent.change(screen.getByLabelText("Tipo de exame · 100"), { target: { value: "tipo-custom" } });
  fireEvent.change(screen.getByLabelText(/Medida · mm/), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText(/Achado/), { target: { value: "false" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar animal" }));
  await waitFor(() => expect(confirmarVisita).toHaveBeenCalledTimes(1));
  const dados = { tipoExameId: "tipo-custom", formatoExameHash: "c".repeat(64), resultados: [{ campo: "MEDIDA", valor: "0" }, { campo: "ACHADO", valor: false }] };
  expect(vi.mocked(salvarRascunhoVisita).mock.calls.at(-1)?.[3]).toMatchObject(dados);
  expect(vi.mocked(confirmarVisita).mock.calls[0][2].itens[0].dados).toMatchObject(dados);
});
