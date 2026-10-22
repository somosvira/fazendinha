// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta } from "@/lib/controles.fixture";
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), reqSanidade: mocks.req, listarServicos: vi.fn().mockResolvedValue([]) }));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn().mockResolvedValue({ itens: ["A", "B"].map(id => ({ id, nome: `Protocolo ${id}`, versao: 1 })), total: 2, pagina: 1, porPagina: 10 }) }));
vi.mock("../api", () => ({ listarAnimais: vi.fn().mockResolvedValue({ itens: [] }), listarLotes: vi.fn().mockResolvedValue([]), buscarFichaAnimal: vi.fn() }));
vi.mock("./SanidadeAnimal", () => ({ SanidadeAnimal: ({ onMudou, filtrosUI, somenteCarencias }: { onMudou?: (id?: string) => void; filtrosUI?: import("react").ReactNode | ((acao: import("react").ReactNode) => import("react").ReactNode); somenteCarencias?: boolean }) => <div data-testid="consulta-sanitaria" data-somente-carencias={String(somenteCarencias)}>{typeof filtrosUI === "function" ? filtrosUI(null) : filtrosUI}<button onClick={() => onMudou?.("salva")}>Salvar aplicação de teste</button></div> }));
vi.mock("./RateioServico", () => ({ RateioServico: () => <p>Gerenciador aberto</p> }));
vi.mock("./DetalheSanitario", () => ({ DetalheSanitario: ({ tipo }: { tipo: string }) => <p>Detalhe {tipo}</p> }));
import { Sanidade } from "./Sanidade";
import { FormFatoSanitario } from "./FormFatoSanitario";
import { listarAnimais, buscarFichaAnimal } from "../api";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(listarAnimais).mockResolvedValue({ itens: [] } as unknown as Awaited<ReturnType<typeof listarAnimais>>); window.history.replaceState(null, "", "/"); });
describe("busca e atualização da Sanidade", () => {
  it("limpa o filtro de doença do gráfico pelo modal somente após aplicar", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null,"","/pecuaria/sanidade?aba=ocorrencias&doencaId=f42259e4-3872-4a27-9be0-740418d269db");
    render(<Sanidade podeLancar={false}/>);
    let painel=await abrirFiltrosConsulta();
    expect(within(painel).getByRole("combobox",{name:"Filtrar por doença"})).toBeTruthy();
    fireEvent.click(within(painel).getByRole("button",{name:"Limpar filtros"}));
    fireEvent.click(within(painel).getByRole("button",{name:"Cancelar"}));
    expect(new URLSearchParams(window.location.search).get("doencaId")).toBeTruthy();
    painel=await abrirFiltrosConsulta();fireEvent.click(within(painel).getByRole("button",{name:"Limpar filtros"}));await aplicarFiltrosConsulta();
    expect(new URLSearchParams(window.location.search).get("doencaId")).toBeNull();
  });
  it("abre o modal compartilhado sem apagar critérios da URL", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&visaoAgenda=tarefas&situacao=ATRASADA&loteId=lote");
    render(<Sanidade podeLancar={false} />);
    const botao = screen.getByRole("button", { name: /Filtros/ });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button",{name:/Remover filtro: Atrasada/})).toBeTruthy();
    expect(screen.getByRole("button", { name: /Remover filtro: Lote/ })).toBeTruthy();
    fireEvent.click(botao);
    const painel = await screen.findByRole("dialog", { name: "Filtros" });
    expect(within(painel).getByRole("combobox", { name: "Animal" })).toHaveProperty("value", "");
    expect(within(painel).getByRole("combobox", { name: "Filtrar por situação" }).getAttribute("value")).toBe("ATRASADA");
    fireEvent.click(within(painel).getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(new URLSearchParams(window.location.search).get("situacao")).toBe("ATRASADA");
    expect(new URLSearchParams(window.location.search).get("loteId")).toBe("lote");
  });

  it("mantém estados menos frequentes da agenda acessíveis sem duplicar opções", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&visaoAgenda=tarefas&situacao=DISPENSADA");
    render(<Sanidade podeLancar={false} />);
    await abrirFiltrosConsulta();
    const situacao = screen.getByRole("combobox",{name:"Filtrar por situação"});
    expect(situacao.getAttribute("value")).toBe("DISPENSADA");
    await alterarControle(situacao,{target:{value:"EXECUCAO_CANCELADA"}});
    expect(new URLSearchParams(window.location.search).get("situacao")).toBe("DISPENSADA");
    await aplicarFiltrosConsulta();
    expect(new URLSearchParams(window.location.search).get("situacao")).toBe("EXECUCAO_CANCELADA");
    fireEvent.click(screen.getByRole("button",{name:/Remover filtro: Execução cancelada/}));
    await waitFor(()=>expect(new URLSearchParams(window.location.search).has("situacao")).toBe(false));
  });

  it("consulta todos os animais por padrão e mantém o animal somente quando explícito", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [{ id: "primeiro", brinco: "DEV-001", nome: "Aurora" }] } as Awaited<ReturnType<typeof listarAnimais>>);
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=exames");
    render(<Sanidade podeLancar={false} />);
    await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringContaining("/exames?")));
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const painel = await screen.findByRole("dialog", { name: "Filtros" });
    expect(within(painel).getByRole("combobox", { name: "Animal" })).toHaveProperty("value", "");
    expect(new URLSearchParams(window.location.search).has("animalId")).toBe(false);
    expect(mocks.req.mock.calls.filter(([p]) => String(p).startsWith("/exames?")).every(([p]) => !new URLSearchParams(String(p).split("?")[1]).has("animalId"))).toBe(true);
    await alterarControle(within(painel).getByRole("combobox", { name: "Animal" }), { target: { value: "primeiro" } });
    expect(new URLSearchParams(window.location.search).has("animalId")).toBe(false);
    fireEvent.click(within(painel).getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("animalId")).toBe("primeiro"));
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const reaberto = screen.getByRole("dialog", { name: "Filtros" });
    fireEvent.click(within(reaberto).getByRole("button", { name: "Limpar filtros" }));
    expect(new URLSearchParams(window.location.search).get("animalId")).toBe("primeiro");
    expect(within(reaberto).getByRole("combobox", { name: "Animal" })).toHaveProperty("value", "");
    fireEvent.click(within(reaberto).getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(new URLSearchParams(window.location.search).has("animalId")).toBe(false));
  });

  it("reúne previsão e estado, mostra o ciclo entregue pela API e mantém ações", async () => {
    mocks.req.mockImplementation((caminho: string) => Promise.resolve(caminho.startsWith("/tarefas?") ? { total: 1, itens: [{
      id: "tarefa", execucaoId: "participacao", previstaPara: "2020-01-01", situacao: "PENDENTE", propriedadeAtualId: 2,
      parametros: { tipo: "APLICACAO", tipoAplicacaoNomeSnapshot: "Vacina" },
      execucao: { animalId: "animal", propriedadeId: 1, animal: { id: "animal", brinco: "DEV-001", nome: "Aurora" }, protocolo: { nome: "Vacinação", versao: 1 }, rodada: { id: "ciclo", nome: "Ciclo de vacinação" } },
    }] } : []));
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&visaoAgenda=tarefas");
    render(<Sanidade podeLancar />);
    const tabela = within(await screen.findByRole("table", { name: "Tarefas de protocolos" }));
    const estado = await tabela.findByText("Atrasada");
    expect(estado.closest("td")?.textContent).toContain("01/01/2020");
    expect(tabela.getByText("Ciclo de vacinação · Vacina")).toBeTruthy();
    expect(tabela.queryByRole("columnheader", { name: "Tipo" })).toBeNull();
    expect(tabela.getByRole("button", { name: "Executar tarefa" }).closest("td")?.getAttribute("data-fin-coluna")).toBe("acoes");
    expect(tabela.getByRole("button", { name: "Mais ações da tarefa de DEV-001 · Aurora" })).toBeTruthy();
  });

  it("prioriza pendências futuras antes do histórico e omite coluna de regularização vazia", async () => {
    const tarefa = (id: string, situacao: string, previstaPara: string) => ({ id, situacao, previstaPara, parametros: { tipo: "EXAME" }, execucao: { animalId: id, propriedadeId: 1, animal: { id, brinco: id, nome: null }, protocolo: { nome: "Rotina", versao: 1 } } });
    mocks.req.mockImplementation((caminho: string) => Promise.resolve(caminho.startsWith("/tarefas?") ? { total: 3, itens: [tarefa("histórico", "REALIZADA", "2020-01-01"), tarefa("futura", "PENDENTE", "2099-01-01"), tarefa("atrasada", "PENDENTE", "2020-01-01")] } : []));
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&visaoAgenda=tarefas");
    render(<Sanidade podeLancar={false} />);
    const tabela = await screen.findByRole("table", { name: "Tarefas de protocolos" });
    await within(tabela).findByText("futura");
    const linhas = within(tabela).getAllByRole("row").slice(1);
    expect(linhas.map(linha => linha.querySelector("td")?.textContent)).toEqual(["atrasada", "futura", "histórico"]);
    expect(within(tabela).queryByRole("columnheader", { name: "Regularização" })).toBeNull();
  });

  it("não oferece execução ou menu de escrita para uma consulta sem lançar", async () => {
    mocks.req.mockImplementation((caminho: string) => Promise.resolve(caminho.startsWith("/tarefas?") ? { total: 1, itens: [{
      id: "tarefa", previstaPara: "2020-01-01", situacao: "PENDENTE", parametros: { tipo: "EXAME" },
      execucao: { animalId: "animal", propriedadeId: 2, animal: { id: "animal", brinco: "DEV-001", nome: "Aurora" }, protocolo: { nome: "Exame", versao: 1 } },
    }] } : []));
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&visaoAgenda=tarefas");
    render(<Sanidade podeLancar={false} />);
    const tabela = within(await screen.findByRole("table", { name: "Tarefas de protocolos" }));
    await tabela.findByText("Atrasada");
    expect(tabela.queryByRole("button", { name: "Executar tarefa" })).toBeNull();
    expect(tabela.queryByRole("button", { name: /Mais ações/ })).toBeNull();
  });

  it("mantém carências desconhecidas e revisão de finalidade explícitas na tabela", async () => {
    mocks.req.mockImplementation((caminho: string) => Promise.resolve(caminho.startsWith("/carencias?") ? [
      { animal: { id: "um", brinco: "DEV-001", nome: "Aurora" }, leite: { estado: "NAO_INFORMADO" }, carne: { estado: "NAO_APLICAVEL" } },
      { animal: { id: "dois", brinco: "DEV-002", nome: "Brisa" }, leite: { estado: "CONHECIDO", ate: "2026-09-01T10:00:00Z", prazoZero: true }, carne: { estado: "NENHUMA" }, revisaoLeitePendente: true },
    ] : []));
    window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=carencias");
    render(<Sanidade podeLancar={false} />);
    const tabela = within(await screen.findByRole("table", { name: "Carências sanitárias" }));
    await waitFor(() => expect(tabela.getByText("Prazo desconhecido")).toBeTruthy());
    expect(tabela.getByText("Não se aplica")).toBeTruthy();
    expect(tabela.getByText("Aplicabilidade confirmada")).toBeTruthy();
    expect(tabela.getByText("Revisar aplicabilidade")).toBeTruthy();
    expect(tabela.queryByText("Prazo zero confirmado")).toBeNull();
    expect(tabela.getByText("Finalidade alterada · conferir no histórico")).toBeTruthy();
    expect(tabela.queryByRole("columnheader", { name: "Orientação" })).toBeNull();
    expect(tabela.queryByText("O tratamento e seus lançamentos permanecem no histórico.")).toBeNull();
    expect(screen.getAllByText("O tratamento e seus lançamentos permanecem no histórico.")).toHaveLength(1);
    expect(tabela.getByRole("link", { name: "DEV-001 · Aurora" }).getAttribute("href")).toBe("/pecuaria/sanidade?aba=carencias&animalId=um");
  });
  it("abre gerenciador sem filtro de animal e sem permissão de valores", async () => {
    localStorage.setItem("rionovo:usuario", JSON.stringify({ id: 1, nome: "Operador", dono: false, areas: ["pecuaria", "financeiro"], flags: ["lancar"] }));
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda");
    render(<Sanidade podeLancar />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar procedimentos" }));
    await screen.findByText("Gerenciador aberto");
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("combobox", { name: "Animal" })).toHaveProperty("value", "");
    localStorage.removeItem("rionovo:usuario");
  });
  it("exige nova ciência quando troca o protocolo após conflito confirmado", async () => {
    vi.mocked(buscarFichaAnimal).mockResolvedValue({ id: "animal", brinco: "GV3", nome: "Mimosa", historicoLocalizacoes: [{ desde: "2026-01-01", ate: null, propriedade: { id: 2, nome: "Sítio B" } }] } as Awaited<ReturnType<typeof buscarFichaAnimal>>);
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [{ id: "animal", brinco: "GV3", nome: "Mimosa", propriedade: { id: 2 } }] } as Awaited<ReturnType<typeof listarAnimais>>);
    mocks.req.mockImplementation((caminho: string) => {
      if (caminho === "/protocolos") return Promise.resolve(["A", "B"].map((id) => ({ id, nome: `Protocolo ${id}`, ativo: true, publicadoEm: "2026-10-01", versao: 1 })));
      if (caminho === "/execucoes/coletivas") return Promise.reject(new Error("Sobreposição: protocolo pendente"));
      return Promise.resolve([]);
    });
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda");
    render(<FormFatoSanitario tipo="protocolo" animalInicial="animal" fixo onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText(/Sítio na data: Sítio B/);
    await screen.findByRole("option", { name: "Protocolo A · v1" });
    fireEvent.change(screen.getByLabelText(/Protocolo publicado/), { target: { value: "A" } });
    fireEvent.submit(document.getElementById("novo-fato-sanitario")!);
    const ciencia = await screen.findByRole("switch", { name: /Confirmo iniciar outro protocolo/ });
    fireEvent.click(ciencia);
    await alterarControle(screen.getByLabelText(/Motivo da sobreposição/), { target: { value: "Sobreposição revisada com responsável" } });
    expect((ciencia as HTMLInputElement).checked).toBe(true);
    await alterarControle(screen.getByLabelText(/Protocolo publicado/), { target: { value: "B" } });
    expect(screen.queryByRole("switch", { name: /Confirmo iniciar outro protocolo/ })).toBeNull();
    fireEvent.submit(document.getElementById("novo-fato-sanitario")!);
    await screen.findByRole("switch", { name: /Confirmo iniciar outro protocolo/ });
    const requests = mocks.req.mock.calls.filter(([caminho]) => caminho === "/execucoes/coletivas");
    expect(requests).toHaveLength(2);
    expect(JSON.parse(requests[1][1].body).itens[0]).toMatchObject({ protocoloId: "B" });
    expect(JSON.parse(requests[1][1].body).itens[0]).not.toHaveProperty("confirmarSobreposicao");
    expect((screen.getByRole("switch", { name: /Confirmo iniciar outro protocolo/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Motivo da sobreposição/) as HTMLTextAreaElement).value).toBe("Sobreposição revisada com responsável");
  });
  it("restaura busca da URL e envia a todas as abas, reiniciando a página ao editar", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&buscaAnimal=Mimosa&pagina=3");
    render(<Sanidade podeLancar={false} />);
    const busca = screen.getByPlaceholderText("Brinco ou nome");
    expect((busca as HTMLInputElement).value).toBe("Mimosa");
    await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(/tarefas.*pagina=3.*buscaAnimal=Mimosa/)));
    expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(/tarefas.*ordenacaoTarefas=prioridade/));
    await alterarControle(busca, { target: { value: "GV3" } });
    await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(/tarefas.*pagina=1.*buscaAnimal=GV3/)));
    for (const [rotulo, recurso] of [["Ocorrências", "ocorrencias"], ["Aplicações", "aplicacoes"], ["Exames", "exames"], ["Carências", "carencias"]]) {
      fireEvent.click(screen.getByRole("tab", { name: rotulo }));
      await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(`${recurso}.*buscaAnimal=GV3`)));
    }
    expect(new URLSearchParams(window.location.search).get("buscaAnimal")).toBe("GV3");
    expect(new URLSearchParams(window.location.search).get("pagina")).toBeNull();
  });
  it("informa escrita salva mesmo quando a atualização da consulta falha", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=aplicacoes&buscaAnimal=GV3");
    render(<Sanidade podeLancar />);
    const salvar = await screen.findByRole("button", { name: "Salvar aplicação de teste" });
    mocks.req.mockImplementation((caminho: string) => caminho.startsWith("/aplicacoes?") ? Promise.reject(new Error("Consulta indisponível")) : Promise.resolve([]));
    fireEvent.click(salvar);
    expect(await screen.findByRole("button", { name: "Ver aplicação salva" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Aplicação salva\. Não conseguimos atualizar a consulta/)).toBeTruthy());
    expect(new URLSearchParams(window.location.search).get("buscaAnimal")).toBe("GV3");
    expect(new URLSearchParams(window.location.search).get("aplicacaoId")).toBeNull();
  });
});

it("o link individual de carências identifica o animal e abre somente prazos, sem filtros ou paginação da lista", async () => {
  vi.mocked(listarAnimais).mockResolvedValue({ itens: [{ id: "aurora", brinco: "DEV-001", nome: "Aurora", propriedade: { id: 1 } }] } as Awaited<ReturnType<typeof listarAnimais>>);
  mocks.req.mockResolvedValue([]);
  window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=carencias&animalId=aurora&de=2020-01-01&pagina=3");
  render(<Sanidade podeLancar={false} />);
  await screen.findByText("DEV-001 · Aurora");
  expect(screen.getByTestId("consulta-sanitaria").getAttribute("data-somente-carencias")).toBe("true");
  expect(screen.queryByRole("button", { name: /Filtros/ })).toBeNull();
  expect(screen.queryByLabelText("Lote")).toBeNull();
  expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();
  expect(screen.queryByRole("table", { name: "Carências sanitárias" })).toBeNull();
  expect(mocks.req.mock.calls.some(([url]) => String(url).startsWith("/carencias?"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Todos os animais" }));
  await screen.findByRole("table", { name: "Carências sanitárias" });
  await waitFor(() => expect(new URLSearchParams(window.location.search).has("animalId")).toBe(false));
  expect(new URLSearchParams(window.location.search).has("de")).toBe(false);
});
it.each([["aplicacao", "Aplicações"], ["exame", "Exames"], ["ocorrencia", "Ocorrências"], ["execucao", "Agenda"]])("infere a aba do link de detalhe %s sem exigir aba na URL", async (tipo, aba) => {
  mocks.req.mockResolvedValue([]);
  window.history.replaceState(null, "", `/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&detalheTipo=${tipo}&detalheId=fato&propriedadeId=1`);
  render(<Sanidade podeLancar={false} />);
  const dialogo = await screen.findByRole("dialog");
  fireEvent.keyDown(dialogo, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("tab", { name: aba }).getAttribute("aria-selected")).toBe("true");
  if (tipo === "execucao") expect(screen.getByRole("tab", { name: "Tarefas" }).getAttribute("aria-selected")).toBe("true");
});
it("conserva a aba de participantes do ciclo ao sincronizar a URL", async () => {
  mocks.req.mockRejectedValue(new Error("Consulta indisponível"));
  window.history.replaceState(null, "", "/pecuaria/sanidade?visualTarefas=tabela&visualOcorrencias=tabela&aba=agenda&rodadaId=ciclo&abaCiclo=participantes");
  render(<Sanidade podeLancar={false} />);
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("abaCiclo")).toBe("participantes"));
});
