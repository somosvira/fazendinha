// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OperacaoProtocolo } from "./OperacaoProtocolo";
const api = vi.hoisted(() => ({ cabecalho: vi.fn(), etapas: vi.fn(), momentos: vi.fn(), tarefas: vi.fn(), evento: vi.fn() }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), obterCabecalhoProtocolo: api.cabecalho, obterEtapasProtocolo: api.etapas, obterMomentosProtocolo: api.momentos, obterTarefasProtocolo: api.tarefas, registrarEventoProtocolo: api.evento, reqProtocolo: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock("../../../estoque/navegacao", () => ({ podeAcessarArea: () => true }));
vi.mock("./ProcedimentosProtocolo", () => ({ ProcedimentosProtocolo: () => <section>Procedimentos e custos</section> }));
const contagens = { total: 21, atendidos: 0, pendentes: 21 };
const tarefa = (n: number) => ({ id: `t${n}`, tarefaId: `t${n}`, participacaoId: `p${n}`, etapaId: "e1", animal: { id: `a${n}`, brinco: `Animal ${n}`, nome: null }, propriedadeId: 1, situacao: "SEM_REGISTRO", previstaPara: "2026-10-19", precisaoTemporal: "DIA", realizadaEm: null, previsaoIndividual: false, ultimoEvento: null, vinculoAtual: null, acoes: { atender: true, justificar: true, adiar: true, retificar: false, regularizar: false }, tarefaOrigem: {} });
beforeEach(() => { vi.clearAllMocks(); api.momentos.mockResolvedValue({itens:[],total:0,pagina:1,porPagina:10}); window.history.replaceState(null, "", "/pecuaria/sanidade?rodadaId=g1"); api.cabecalho.mockResolvedValue({ id: "g1", modo: "COLETIVO", tipo: "SANITARIO", nome: "Turma", protocolo: { id: "p", nome: "Vacinação", versao: 1 }, propriedadeId: 1, inicioReferencia: "2026-10-19", precisaoTemporal: "DIA", contagens }); api.etapas.mockResolvedValue({ itens: [{ id: "e1", nome: "Aplicação", ordem: 1, diaRelativo: 0, previstaPara: "2026-10-19", precisaoTemporal: "DIA", contagens }], pagina: 1, porPagina: 10, total: 1 }); api.tarefas.mockImplementation((_contexto, filtros) => Promise.resolve({ itens: Array.from({ length: filtros.pagina === 3 ? 1 : 10 }, (_, i) => tarefa((filtros.pagina - 1) * 10 + i + 1)), pagina: filtros.pagina, porPagina: 10, total: 21 })); });
afterEach(cleanup);
describe("operação real de protocolos", () => {
  it("preserva seleção entre três páginas e entrega todos os ids ao executor existente", async () => {
    const executar = vi.fn(); render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar aoExecutar={executar} />);
    const linkAnimal = await screen.findByRole("link", { name: "Animal 1" });
    const destino = new URL(linkAnimal.getAttribute("href")!, window.location.origin);
    expect(destino.hash).toBe("#sanidade");
    expect(destino.searchParams.get("participacaoId")).toBe("p1");
    expect(destino.searchParams.get("programacaoId")).toBe("g1");
    expect(destino.searchParams.get("sitio")).toBe("1");
    expect(destino.searchParams.get("retorno")).toContain("/pecuaria/sanidade?");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar Animal 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar Animal 11" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar Animal 21" }));
    fireEvent.click(screen.getByRole("button", { name: "Atender selecionadas (3)" }));
    expect(executar.mock.calls[0][0].map((t: { id: string }) => t.id)).toEqual(["t1", "t11", "t21"]);
    expect(api.tarefas.mock.calls.map(c => c[1].pagina)).toEqual([1, 2, 3]);
  });
  it("registra não atendimento por evento com motivo, sem chamar executor", async () => {
    api.evento.mockResolvedValue({ id: "ev" }); const executar = vi.fn(); render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar aoExecutar={executar} />);
    const linha = (await screen.findByRole("link", { name: "Animal 1" })).closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: "Justificar" }));
    fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Animal indisponível neste manejo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.evento).toHaveBeenCalledOnce());
    expect(api.evento.mock.calls[0][0]).toBe("t1"); expect(api.evento.mock.calls[0][1]).toMatchObject({ propriedadeId: 1, tipo: "NAO_ATENDIDO", motivo: "Animal indisponível neste manejo" }); expect(executar).not.toHaveBeenCalled();
  });
  it("sem permissão remove ações de escrita e conserva consulta", async () => {
    render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar={false} aoExecutar={vi.fn()} />);
    await screen.findByRole("link", { name: "Animal 1" });
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(screen.queryByRole("button", { name: "Justificar" })).toBeNull(); expect(screen.queryByRole("button", { name: "Adiar" })).toBeNull();
  });
  it("troca de contexto descarta etapa antiga e página, preservando etapa do mesmo contexto fora da página de etapas", async () => {
    window.history.replaceState(null, "", "/pecuaria/sanidade?protocoloContexto=outro&etapaId=etapa-antiga&paginaTarefas=3&paginaEtapas=2");
    const tela = render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar={false} />);
    await screen.findByRole("link", { name: "Animal 1" });
    expect(api.tarefas.mock.calls[0][1]).toMatchObject({ etapaId: "e1", pagina: 1 });
    expect(api.etapas.mock.calls[0][1]).toBe(1);
    tela.unmount(); api.tarefas.mockClear();
    window.history.replaceState(null, "", "/pecuaria/sanidade?protocoloContexto=g1&etapaId=etapa20");
    render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar={false} />);
    await screen.findByRole("link", { name: "Animal 1" });
    expect(api.tarefas.mock.calls[0][1].etapaId).toBe("etapa20");
  });
  it("detalhe do atendimento conserva link para o fato real com sítio e retorno", async () => {
    api.tarefas.mockResolvedValue({ itens: [{ ...tarefa(1), vinculoAtual: { tipo: "APLICACAO", id: "aplicacao1", origem: "FICHA" } }], total: 1, pagina: 1, porPagina: 10 });
    render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver atendimento" }));
    const link = await screen.findByRole("link", { name: "Abrir fato de origem" });
    expect(link.getAttribute("href")).toContain("detalheTipo=aplicacao&detalheId=aplicacao1&propriedadeId=1&retorno=");
  });

  it("conserva seletor e paginação quando a última página contém somente ações sem momento",async()=>{
    api.momentos.mockImplementation((_contexto,pagina)=>Promise.resolve({itens:pagina===1?Array.from({length:10},(_,i)=>({id:`m${i}`,nome:`Momento ${i}`,ordem:i+1})):[{id:"SEM_MOMENTO",nome:"Ações sem momento explícito",ordem:null}],total:11,pagina,porPagina:10}));
    render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar/>);
    const momentos=await screen.findByRole("region",{name:"Momentos do protocolo"});
    fireEvent.click(within(momentos).getByRole("button",{name:"Próxima"}));
    await within(momentos).findByRole("button",{name:"Ações sem momento explícito"});
    expect(within(momentos).getByRole("button",{name:"Anterior"})).toHaveProperty("disabled",false);
    fireEvent.click(within(momentos).getByRole("button",{name:"Ações sem momento explícito"}));
    await waitFor(()=>expect(api.etapas).toHaveBeenLastCalledWith(expect.any(Object),1,1,"SEM_MOMENTO"));
  });

});
it("mantém atendimento e acompanhamento separados na mesma tabela e filtro de servidor", async () => {
  api.tarefas.mockResolvedValue({ itens: [{ ...tarefa(1), situacao: "ATENDIDO", realizadaEm: "2026-10-21", acoes: { atender: false, justificar: false, adiar: false, retificar: false, regularizar: false, reavaliar: true }, tarefaOrigem: { tipo: "AVALIACAO" }, acompanhamentoPendente: true, resultadoProcedimento: { realizacao: "REALIZADO", resultados: [{ campo: "CONCLUSAO_GESTACIONAL", valor: "INCONCLUSIVO" }] } }], total: 1, pagina: 1, porPagina: 10 });
  render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar />);
  const linha = (await screen.findByRole("link", { name: "Animal 1" })).closest("tr")!;
  expect(within(linha).getByText("Atendido")).toBeTruthy();
  expect(within(linha).getByText("Exame inconclusivo")).toBeTruthy();
  expect(within(linha).getByText("Acompanhamento pendente")).toBeTruthy();
  expect(within(linha).getByRole("button", { name: "Reavaliar acompanhamento" })).toBeTruthy();
  expect(within(linha).queryByRole("button", { name: "Atender" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Acompanhamentos" }));
  await waitFor(() => expect(api.tarefas).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({ situacao: "ACOMPANHAMENTO_PENDENTE", pagina: 1 }), 1));
  expect(new URLSearchParams(window.location.search).get("protocoloSituacao")).toBe("ACOMPANHAMENTO_PENDENTE");
});
it("coleta aguardando resultado não oferece outra coleta", async () => {
  api.tarefas.mockResolvedValue({ itens: [{ ...tarefa(1), situacao: "ATENDIDO", realizadaEm: "2026-10-21", acoes: { atender: false, justificar: false, adiar: false, retificar: false, regularizar: false }, tarefaOrigem: { tipo: "EXAME" }, acompanhamentoPendente: true, resultadoProcedimento: { realizacao: "COLETA_REGISTRADA", resultados: [] }, vinculoAtual: { tipo: "EXAME", id: "exame1", origem: "PROTOCOLO" } }], total: 1, pagina: 1, porPagina: 10 });
  render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar />);
  const linha = (await screen.findByRole("link", { name: "Animal 1" })).closest("tr")!;
  expect(within(linha).getByText("Coleta registrada")).toBeTruthy(); expect(within(linha).getByText("Aguardando resultado")).toBeTruthy();
  expect(within(linha).queryByRole("checkbox")).toBeNull(); expect(within(linha).queryByRole("button", { name: "Atender" })).toBeNull();
});
it("conserva registro legado sem inventar fato individual e mostra snapshot histórico", async () => {
  api.tarefas.mockResolvedValue({ itens: [{ ...tarefa(1), situacao: "ATENDIDO", realizadaEm: "2026-10-21", acoes: { atender: false, justificar: false, adiar: false, retificar: false, regularizar: false }, tarefaOrigem: { tipo: "MANEJO", realizadoSnapshot: { tipo: "MANEJO", realizadaEm: "2026-10-21", dados: { responsavel: "Registro antigo", observacao: "Manejo histórico" } } } }], total: 1, pagina: 1, porPagina: 10 });
  render(<OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar={false} />);
  expect(await screen.findByText("Registro legado sem fato individual vinculado")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver atendimento" }));
  expect(screen.getByText("Responsável registrado: Registro antigo")).toBeTruthy();
  expect(screen.getByText("Observação registrada: Manejo histórico")).toBeTruthy();
});

it.each(["NAO_ATENDIDO", "ADIAMENTO", "RETIFICACAO_JUSTIFICATIVA"] as const)("invalida o resumo externo após %s e preserva-o se a gravação falhar", async tipo => {
  api.evento.mockRejectedValueOnce(new Error("Gravação indisponível")).mockResolvedValue({ id: "evento" });
  api.tarefas.mockResolvedValue({ itens: [{ ...tarefa(1), ultimoEvento: tipo === "RETIFICACAO_JUSTIFICATIVA" ? { id: "anterior", tipo: "NAO_ATENDIDO", motivo: "Motivo anterior", ocorridaEm: "2026-10-19" } : null, acoes: { atender: false, justificar: true, adiar: true, retificar: true, regularizar: false } }], total: 1, pagina: 1, porPagina: 10 });
  function Tela() {
    const [salvos, setSalvos] = useState(0);
    return <><p>Resumo atualizado {salvos} vezes</p><OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar aoSalvar={() => setSalvos(v => v + 1)}/></>;
  }
  render(<Tela/>);
  await screen.findByRole("link", { name: "Animal 1" });
  if (tipo === "RETIFICACAO_JUSTIFICATIVA") {
    fireEvent.click(screen.getByRole("button", { name: "Ver motivo" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar justificativa" }));
  } else fireEvent.click(screen.getByRole("button", { name: tipo === "ADIAMENTO" ? "Adiar" : "Justificar" }));
  if (tipo === "ADIAMENTO") fireEvent.change(screen.getByLabelText("Nova previsão"), { target: { value: "21/10/2026" } });
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Animal indisponível para manejo" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await screen.findByText("Gravação indisponível");
  expect(screen.getByText("Resumo atualizado 0 vezes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByText("Resumo atualizado 1 vezes")).toBeTruthy();
});
it("invalida o contexto externo também após execução delegada e regularização", async () => {
  api.tarefas.mockResolvedValue({ itens: [{ ...tarefa(1), acoes: { atender: true, justificar: false, adiar: false, retificar: false, regularizar: true } }], total: 1, pagina: 1, porPagina: 10 });
  function Tela() {
    const [salvos, setSalvos] = useState(0);
    return <><p>Resumo atualizado {salvos} vezes</p><OperacaoProtocolo programacaoId="g1" propriedadeId={1} podeLancar aoSalvar={() => setSalvos(v => v + 1)} aoExecutar={(_tarefas, aoSalvar) => aoSalvar()} regularizacao={(_tarefa, aoSalvar) => <button onClick={aoSalvar}>Concluir regularização</button>}/></>;
  }
  render(<Tela/>);
  fireEvent.click(await screen.findByRole("button", { name: "Atender" }));
  expect(await screen.findByText("Resumo atualizado 1 vezes")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Concluir regularização" }));
  expect(await screen.findByText("Resumo atualizado 2 vezes")).toBeTruthy();
});
