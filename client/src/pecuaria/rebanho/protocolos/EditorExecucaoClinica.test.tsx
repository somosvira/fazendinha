// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { executarComGuardaNavegacao } from "../../../navegacaoGuardada";
import { EditorExecucaoClinica } from "./EditorExecucaoClinica";
import { reqProtocolo } from "./api";
import { obterOpcoesClinicas, type EntradaClinica } from "./clinica-api";
import type { TarefaOperacional } from "./api";
import { mudarCampo } from "@/lib/controles.fixture";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
vi.mock("./clinica-api", async original => ({ ...await original<typeof import("./clinica-api")>(), obterOpcoesClinicas: vi.fn() }));
vi.mock("../../../financeiro/PainelCadastro", () => ({ classeInput: "input", PainelCadastro: ({ titulo, children, rodape }: { titulo: string; children: ReactNode; rodape: ReactNode }) => <section><h2>{titulo}</h2>{children}{rodape}</section> }));
const formato = { id: "exame", nome: "CCS", tipoResultado: "NUMERO" as const, unidade: "células", formatoExameHash: "b".repeat(64), versaoFormato: 1 };
function tarefa(n: number): TarefaOperacional {
  const animal = { id: `a${n}`, brinco: `Brinco ${n}`, nome: null };
  return { id: `t${n}`, tarefaId: `t${n}`, etapaId: "etapa", participacaoId: `p${n}`, animal, propriedadeId: 7, situacao: "SEM_REGISTRO", previstaPara: "2026-10-21", previsaoOriginal: null, previsaoIndividual: false, precisaoTemporal: "DIA", realizadaEm: null, precisaoRealizacao: null, previsaoPendente: false, ultimoEvento: null, vinculoAtual: null, acoes: { atender: true, justificar: true, adiar: true, retificar: false, regularizar: false }, tarefaOrigem: { id: `t${n}`, etapaId: "etapa", execucaoId: `p${n}`, tipo: "EXAME", previstaEm: "2026-10-21", previstaPara: "2026-10-21", status: "PENDENTE", situacao: "PENDENTE", parametros: { tipo: "EXAME", tipoExameId: "exame" }, execucao: { animalId: animal.id, propriedadeId: 7, animal, protocolo: { nome: "Exames", versao: 1 } } } };
}
const tarefas = Array.from({ length: 11 }, (_, n) => tarefa(n + 1));
function previa(entrada: EntradaClinica, pagina = 1) {
  return { fingerprint: "a".repeat(64), temDesvios: false, tarefas: { itens: entrada.itens.slice((pagina - 1) * 10, pagina * 10).map(i => ({ ...i, referencia: "SNAPSHOT_PLANEJADO", aferido: true, planejado: {}, realizado: {}, diferencas: [], motivo: null, motivoObrigatorio: false, carencia: null, inicioLegado: { exigeCiencia: false, total: 0 } })), total: entrada.itens.length, pagina, porPagina: 10 }, consumos: { itens: [], total: 0, pagina: 1, porPagina: 10 } };
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(obterOpcoesClinicas).mockResolvedValue({ itens: [formato], total: 1, pagina: 1, porPagina: 10 }); vi.mocked(reqProtocolo).mockImplementation(async (_path, _site, body) => previa(body as EntradaClinica)); });
afterEach(cleanup);
it("registra somente coleta com DIA sem inventar resultado nem horário", async () => {
  render(<EditorExecucaoClinica tarefas={[tarefas[0]]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  mudarCampo(screen.getByLabelText("Data da coleta"), { target: { value: "2026-10-21" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  const entrada = vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica;
  expect(entrada.itens[0]).toMatchObject({ tipo: "EXAME", data: "2026-10-21", realizadaEm: "2026-10-21", tipoExameId: "exame", formatoExameHash: formato.formatoExameHash });
  expect(entrada.itens[0]).not.toHaveProperty("resultadoNumero");
});
it("preserva resultado e observação da primeira página ao editar o11ºanimal", async () => {
  render(<EditorExecucaoClinica tarefas={tarefas} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  mudarCampo(screen.getByLabelText("Data da coleta"), { target: { value: "2026-10-21" } });
  expect(screen.getAllByRole("button", { name: /Registro individual · Brinco/ })).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Registro individual · Brinco 1" }));
  fireEvent.click(screen.getByLabelText("Informar resultado · Brinco 1"));
  mudarCampo(screen.getByLabelText("Resultado · células"), { target: { value: "123" } });
  mudarCampo(screen.getByLabelText("Observações · Brinco 1"), { target: { value: "Amostra identificada" } });
  fireEvent.click(screen.getByRole("button", { name: "Concluir edição individual" }));
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  fireEvent.click(screen.getByRole("button", { name: "Registro individual · Brinco 11" }));
  expect(screen.getAllByLabelText(/Informar resultado/)).toHaveLength(1);
  mudarCampo(screen.getByLabelText("Observações · Brinco 11"), { target: { value: "Aguardando laudo" } });
  fireEvent.click(screen.getByRole("button", { name: "Concluir edição individual" }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  const entrada = vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica;
  expect(entrada.itens).toHaveLength(11); expect(entrada.itens[0]).toMatchObject({ resultadoNumero: 123, observacao: "Amostra identificada" });
  expect(entrada.itens[10]).toMatchObject({ observacao: "Aguardando laudo" }); expect(entrada.itens[10]).not.toHaveProperty("resultadoNumero");
});
it("retry após falha de rede conserva chave e confirmação é única para o conjunto", async () => {
  let confirmar = 0;
  vi.mocked(reqProtocolo).mockImplementation(async (path, _site, body) => {
    if (path === "/execucoes/previa") return previa(body as EntradaClinica);
    confirmar++; if (confirmar === 1) throw new Error("Resposta interrompida");
    return { versao: 1, chave: "recibo", itens: [{ tarefaId: "t1", animalId: "a1", tipo: "EXAME", id: "fato" }], total: 1, pagina: 1, porPagina: 10 };
  });
  render(<EditorExecucaoClinica tarefas={[tarefas[0]]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  mudarCampo(screen.getByLabelText("Data da coleta"), { target: { value: "2026-10-21" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar conjunto" }));
  await screen.findByText("Resposta interrompida");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar conjunto" }));
  await screen.findByRole("heading", { name: "Atendimentos registrados" });
  const chamadas = vi.mocked(reqProtocolo).mock.calls.filter(c => c[0] === "/execucoes/confirmar");
  expect(chamadas.map(c => (c[2] as { chave: string }).chave)[0]).toBe((chamadas[1][2] as { chave: string }).chave);
});
it("avaliação não preseleciona positivo e exige resultado de cada animal", async () => {
  const t = { ...tarefas[0], tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "AVALIACAO" } };
  vi.mocked(obterOpcoesClinicas).mockResolvedValue({ itens: [{ ...formato, tipoResultado: "MULTIPLO", campos: [] }], total: 1, pagina: 1, porPagina: 10 });
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  expect(screen.getByLabelText("Resultado da avaliação · Brinco 1")).toHaveProperty("value", "");
  mudarCampo(screen.getByLabelText("Data do atendimento"), { target: { value: "2026-10-21" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByText(/Informe o resultado da avaliação de Brinco 1/);
  expect(reqProtocolo).not.toHaveBeenCalled();
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "INCONCLUSIVO" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  expect((vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica).itens[0]).toMatchObject({ resultado: "INCONCLUSIVO", formatoExameHash: formato.formatoExameHash });
});
it("cobertura documentada usa reprodutor sem forçar material ou baixa de estoque", async () => {
  const t = { ...tarefas[0], tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "TENTATIVA" } };
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  mudarCampo(screen.getByLabelText("Data do atendimento"), { target: { value: "2026-10-21" } });
  mudarCampo(screen.getByLabelText("Tipo de tentativa"), { target: { value: "COBERTURA" } });
  expect(screen.getByLabelText("Origem do material ou reprodutor")).toHaveProperty("value", "DOCUMENTADA");
  mudarCampo(screen.getByLabelText("Justificativa da origem documentada"), { target: { value: "Cobertura comprovada no manejo" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  const item = (vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica).itens[0];
  expect(item).toMatchObject({ tipo: "TENTATIVA", tipoTentativa: "COBERTURA", origem: "DOCUMENTADA" });
  expect(item).not.toHaveProperty("materialId"); expect(item).not.toHaveProperty("partidaId"); expect(item).not.toHaveProperty("quantidade");
});
it("conjunto inválido não abre formulário nem consulta catálogo", () => {
  render(<EditorExecucaoClinica tarefas={[tarefas[0], { ...tarefas[1], propriedadeId: 99 }]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  expect(screen.getByText(/mesma ação e sítio/)).toBeTruthy();
  expect(obterOpcoesClinicas).not.toHaveBeenCalled(); expect(reqProtocolo).not.toHaveBeenCalled();
});
it("reavaliação exige vínculo explícito e conserva a demanda do exame anterior", async () => {
  const t = { ...tarefas[0], acompanhamento: { id: "demanda", estado: "PENDENTE", finalidade: "DIAGNOSTICO", versao: 1, previstaPara: null }, acoes: { ...tarefas[0].acoes, atender: false, reavaliar: true }, tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "AVALIACAO" } };
  vi.mocked(obterOpcoesClinicas).mockResolvedValue({ itens: [{ ...formato, tipoResultado: "MULTIPLO", campos: [] }], total: 1, pagina: 1, porPagina: 10, acompanhamento: { id: "demanda", estado: "PENDENTE", finalidade: "DIAGNOSTICO", versao: 1, tentativaId: "tentativa" } });
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  mudarCampo(screen.getByLabelText("Data do atendimento"), { target: { value: "2026-10-21" } });
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "INCONCLUSIVO" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByText(/Vincule cada reavaliação/);
  expect(reqProtocolo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Vincular esta reavaliação" }));
  await screen.findByText("Nova avaliação vinculada ao acompanhamento pendente.");
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  expect((vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica).itens[0]).toMatchObject({ tipo: "AVALIACAO", resultado: "INCONCLUSIVO", demandaAcompanhamentoId: "demanda", reavaliacao: true, tentativaId: "tentativa" });
});

it("hidratação do material planejado não cria exceções e todos herdam material e lote comuns", async () => {
  const grupo:TarefaOperacional[] = tarefas.slice(0, 2).map(t => ({...t,tarefaOrigem:{...t.tarefaOrigem,tipo:"TENTATIVA",planejadoSnapshot:{etapa:{nome:"Tentativa planejada",tipo:"TENTATIVA",intervalo:0,unidade:"DIAS",planoTentativa:{tipo:"IA",materialId:"planejado",quantidade:1}},previstaEm:"2026-10-21",previsaoOriginal:"2026-10-21",inicioReferencia:"2026-10-21"}}}));
  vi.mocked(obterOpcoesClinicas).mockImplementation(async (_t,_s,opcao,_pagina,_busca,selecionadoId) => ({itens:opcao === "MATERIAL" ? [{id:selecionadoId || "novo",nome:selecionadoId === "planejado" ? "Material planejado" : "Material novo"}] : [{id:"lote",nome:"Partida nova"}],total:1,pagina:1,porPagina:10}));
  render(<EditorExecucaoClinica tarefas={grupo} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(()=>expect(screen.getAllByText(/material genético.*Material planejado/)).toHaveLength(1));
  expect(screen.getAllByRole("button", { name: /Registro individual/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"Selecionar material genético"}));
  fireEvent.click(await screen.findByRole("button",{name:"Usar Material novo"}));
  fireEvent.click(screen.getByRole("button",{name:"Selecionar lote do material"}));
  fireEvent.click(await screen.findByRole("button",{name:"Usar Partida nova"}));
  mudarCampo(screen.getByLabelText("Data do atendimento"),{target:{value:"2026-10-21"}});
  fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
  await screen.findByRole("button",{name:"Confirmar conjunto"});
  const entrada = vi.mocked(reqProtocolo).mock.calls.find(([p])=>p==="/execucoes/previa")![2] as EntradaClinica;
  expect(entrada.itens.map(i=>({animalId:i.animalId,materialId:i.materialId,partidaId:i.partidaId}))).toEqual(grupo.map(t=>({animalId:t.animal.id,materialId:"novo",partidaId:"lote"})));
});

it("TETF novo propõe TE e mantém material e quantidade para preenchimento no atendimento", async () => {
  const t: TarefaOperacional = { ...tarefas[0], tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "TENTATIVA", planejadoSnapshot: { etapa: { nome: "Transferência", tipo: "TENTATIVA", tentativaTipo: "TE", intervalo: 17, unidade: "DIAS" }, previstaEm: "2026-10-21", previsaoOriginal: "2026-10-21", inicioReferencia: "2026-10-04" } } };
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  expect(screen.getByLabelText<HTMLSelectElement>("Tipo de tentativa").value).toBe("TE");
  fireEvent.click(screen.getByRole("button", {name:"Quantidade excepcional ou registro histórico"}));
  expect(screen.getByLabelText<HTMLInputElement>("Quantidade por animal").value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Selecionar material genético" }));
  await waitFor(() => expect(obterOpcoesClinicas).toHaveBeenCalledWith(t.id, 7, "MATERIAL", 1, "", undefined, "", "TE", true));
  expect(reqProtocolo).not.toHaveBeenCalled();
});

it("DG negativa registra decisão opcional e limpa indicação ao mudar resultado", async () => {
  const t = { ...tarefas[0], tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "AVALIACAO" } };
  vi.mocked(obterOpcoesClinicas).mockResolvedValue({ itens: [{ ...formato, tipoResultado: "MULTIPLO", campos: [] }], total: 1, pagina: 1, porPagina: 10 });
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText(/tipo de exame: CCS/);
  mudarCampo(screen.getByLabelText("Data do atendimento"), { target: { value: "2026-10-21" } });
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "NEGATIVO" } });
  expect(screen.getByLabelText("Indicação para nova IATF · Brinco 1")).toHaveProperty("value", "");
  mudarCampo(screen.getByLabelText("Indicação para nova IATF · Brinco 1"), { target: { value: "NAO_INDICAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  expect((vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica).itens[0]).toMatchObject({ resultado: "NEGATIVO", decisaoIatf: "NAO_INDICAR" });
  fireEvent.click(screen.getByRole("button", { name: "Editar atendimento" }));
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "POSITIVO" } });
  expect(screen.queryByLabelText("Indicação para nova IATF · Brinco 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  expect((vi.mocked(reqProtocolo).mock.calls.at(-1)![2] as EntradaClinica).itens[0]).not.toHaveProperty("decisaoIatf");
});

it("DG só abre preparação após confirmação e falha de navegação não repete gravação", async () => {
  const t = { ...tarefas[0], tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "AVALIACAO" } };
  const preparar = vi.fn().mockImplementationOnce(() => { throw new Error("Navegação indisponível"); });
  vi.mocked(reqProtocolo).mockImplementation(async (path, _site, body) => path === "/execucoes/previa" ? previa(body as EntradaClinica) : { versao: 1, chave: "dg", total: 1, pagina: 1, porPagina: 10, itens: [{ tarefaId: "t1", animalId: "a1", tipo: "AVALIACAO", id: "dg1" }] });
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} onPrepararIatf={preparar} />);
  await screen.findByText(/tipo de exame: CCS/);
  mudarCampo(screen.getByLabelText("Data do atendimento"), { target: { value: "2026-10-21" } });
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "NEGATIVO" } });
  mudarCampo(screen.getByLabelText("Indicação para nova IATF · Brinco 1"), { target: { value: "INDICAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByRole("button", { name: "Confirmar conjunto" });
  expect(screen.queryByRole("button", { name: /Preparar próxima/ })).toBeNull();
  expect(screen.getByText(/Finalidade: Diagnóstico.*Indicar para nova IATF/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar conjunto" }));
  fireEvent.click(await screen.findByRole("button", { name: /Preparar próxima IATF/ }));
  expect(preparar).toHaveBeenCalledWith(["a1"]);
  expect(screen.getByText(/Atendimentos já salvos/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Preparar próxima IATF/ }));
  expect(vi.mocked(reqProtocolo).mock.calls.filter(([path]) => path === "/execucoes/confirmar")).toHaveLength(1);
});

it("sexagem sincroniza finalidade e exige vínculo antes de conferir", async () => {
  const t = { ...tarefas[0], tarefaOrigem: { ...tarefas[0].tarefaOrigem, tipo: "AVALIACAO" } };
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText(/tipo de exame: CCS/);
  mudarCampo(screen.getByLabelText("Data do atendimento"), { target: { value: "2026-10-21" } });
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "SEXAGEM" } });
  expect(screen.getByLabelText("Finalidade do exame · Brinco 1")).toHaveProperty("value", "SEXAGEM");
  fireEvent.click(screen.getByRole("button", { name: "Conferir execução" }));
  await screen.findByText("Vincule a gestação conhecida de Brinco 1.");
  expect(reqProtocolo).not.toHaveBeenCalled();
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"), { target: { value: "NEGATIVO" } });
  expect(screen.getByLabelText("Finalidade do exame · Brinco 1")).toHaveProperty("value", "DIAGNOSTICO");
  expect(screen.queryByLabelText("Sexo fetal observado · Brinco 1")).toBeNull();
});

it("a avaliação protocolar abre em página, mantém detalhes individuais e deixa os não preenchidos pendentes", async () => {
  const grupo = tarefas.slice(0,2).map(t => ({...t,tarefaOrigem:{...t.tarefaOrigem,tipo:"AVALIACAO"}}));
  render(<EditorExecucaoClinica tarefas={grupo} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  expect(screen.getByRole("heading", {name:"Avaliação reprodutiva"})).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  mudarCampo(screen.getByLabelText("Data do atendimento"),{target:{value:"2026-10-21"}});
  fireEvent.click(screen.getByRole("button",{name:"Registro individual · Brinco 1"}));
  mudarCampo(screen.getByLabelText("Resultado da avaliação · Brinco 1"),{target:{value:"INCONCLUSIVO"}});
  fireEvent.click(screen.getByRole("button",{name:"Concluir edição individual"}));
  fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
  await screen.findByRole("button",{name:"Confirmar conjunto"});
  const entrada = vi.mocked(reqProtocolo).mock.calls[0][2] as EntradaClinica;
  expect(entrada.itens).toHaveLength(1);
  expect(entrada.itens[0]).toMatchObject({animalId:"a1",resultado:"INCONCLUSIVO"});
});

it("a página clínica protege mudanças de data ao cancelar ou navegar", async () => {
  const t = {...tarefas[0],tarefaOrigem:{...tarefas[0].tarefaOrigem,tipo:"AVALIACAO"}};
  const fechar = vi.fn();
  render(<EditorExecucaoClinica tarefas={[t]} reprodutivo={false} onFechar={fechar} onSalvo={vi.fn()}/>);
  await waitFor(() => expect(screen.getByText(/tipo de exame: CCS/)).toBeTruthy());
  mudarCampo(screen.getByLabelText("Data do atendimento"),{target:{value:"2026-10-21"}});
  const navegar = vi.fn();
  let saida: void | Promise<boolean> = undefined;
  act(()=>{saida=executarComGuardaNavegacao(navegar);});
  fireEvent.click(await screen.findByRole("button",{name:"Continuar editando"}));
  await act(async()=>{await saida;});
  expect(navegar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
  fireEvent.click(await screen.findByRole("button",{name:"Descartar alterações"}));
  expect(fechar).toHaveBeenCalledOnce();
});
