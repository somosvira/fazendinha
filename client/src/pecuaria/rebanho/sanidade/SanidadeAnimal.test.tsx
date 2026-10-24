// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SanidadeAnimal } from "./SanidadeAnimal";
import { reqSanidade, type AplicacaoSanitaria } from "./api";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), consultarCarencia: vi.fn().mockResolvedValue({ leite: { estado: "NENHUMA" }, carne: { estado: "NENHUMA" } }), listarAplicacoes: vi.fn().mockResolvedValue([]), reqSanidade: vi.fn().mockResolvedValue({ nomeProdutoAplicado: "Medicamento", aplicadaEm: "2026-10-05T13:04:00Z", tipoAplicacaoNomeSnapshot: "Tipo preservado" }) }));
vi.mock("./HistoricoSanitario", () => ({ HistoricoSanitario: ({ abrir }: { abrir: (tipo: string, id: string, propriedadeId?: number) => void }) => <button onClick={() => abrir("exame", "exame-historico", 1)}>Abrir exame histórico</button> }));
vi.mock("./FormAplicacaoServico", () => ({ FormAplicacaoServico: () => null }));
vi.mock("./ReconciliarOrigem", () => ({ ReconciliarOrigem: () => null }));
const aplicacao = { id: "a1", animalId: "animal1", animal: { id: "animal1", brinco: "GV3-1", nome: null }, propriedadeId: 1, data: "2026-10-05", aplicadaEm: "2026-10-05T13:04:00Z", tipoAplicacaoNomeSnapshot: "Tipo preservado", nomeProdutoAplicado: "Medicamento", dose: "2", unidadeDose: "mL", status: "VALIDO", origemInsumo: "SEM_ORIGEM_JUSTIFICADA", estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", carenciaLeiteHoras: 0, carenciaCarneHoras: 48 } as AplicacaoSanitaria;
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
it("mostra tabela geral compacta mesmo com filtro individual", async () => {
  render(<SanidadeAnimal geral animalId="animal1" propriedadeId={2} podeLancar recarregarToken={0} lista={[aplicacao]} />);
  await screen.findByRole("table");
  for (const nome of ["Animal", "Registro", "Aplicação", "Situação", "Ações"]) expect(screen.getByRole("columnheader", { name: nome })).toBeTruthy();
  expect(screen.getAllByText(/Medicamento · 2 mL/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Origem não localizada · Sem produto vinculado/).length).toBeGreaterThan(0);
  expect(screen.getAllByText("05/10/2026 às 10:04").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /Reconciliar origem de/ }).length).toBeGreaterThan(0);
  expect(screen.queryByText(/null/)).toBeNull();
});
it.each([["CONFIRMADA", true], ["DESCARTADA", false], ["DESCONHECIDA", null]] as const)("anula pelo sítio histórico com administração %s explícita", async (situacao, administracaoMantida) => {
  const abrirDetalhe = vi.fn();
  const { rerender } = render(<SanidadeAnimal geral animalId="" propriedadeId={null} podeLancar recarregarToken={0} lista={[aplicacao]} abrirDetalhe={abrirDetalhe} />);
  await screen.findByRole("table");
  fireEvent.click(screen.getAllByRole("button", { name: /Anular aplicação de/ })[0]);
  expect(abrirDetalhe).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Motivo da correção / anulação"), { target: { value: "Lançamento incorreto" } });
  fireEvent.submit(document.getElementById("correcao-sanitaria")!);
  expect(reqSanidade).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Destino do material"), {target: {value: "MANTER_CONSUMO"}});
  expect(screen.getByLabelText("Situação da administração")).toHaveProperty("value", "");
  fireEvent.submit(document.getElementById("correcao-sanitaria")!);
  expect(reqSanidade).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Situação da administração"), {target: {value: situacao}});
  fireEvent.submit(document.getElementById("correcao-sanitaria")!);
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/aplicacoes/a1/anulacao", expect.objectContaining({ body: JSON.stringify({ propriedadeId: 1, motivo: "Lançamento incorreto", destinoConsumo: "MANTER_CONSUMO", administracaoMantida }) })));
  rerender(<SanidadeAnimal geral animalId="" propriedadeId={null} podeLancar={false} recarregarToken={0} lista={[aplicacao]} />);
  expect(screen.queryByRole("button", { name: /Anular aplicação de/ })).toBeNull();
});
it("abre detalhe compartilhado na ficha e fecha por Escape restaurando foco", async () => {
  render(<SanidadeAnimal animalId="animal1" propriedadeId={2} podeLancar={false} recarregarToken={0} lista={[aplicacao]} />);
  const linha = (await screen.findAllByRole("row", { name: /Medicamento/ }))[0];
  linha.focus(); fireEvent.click(linha);
  await screen.findByRole("dialog");
  await waitFor(() => expect(screen.getByRole("dialog").textContent).toContain("05/10/2026 às 10:04"));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(linha));
});
it("oferece ações sanitárias diretas na ficha e mantém permissões", async () => {
  const { rerender } = render(<SanidadeAnimal animalId="animal1" propriedadeId={2} podeLancar recarregarToken={0} lista={[]} />);
  for (const nome of ["Registrar aplicação", "Nova ocorrência", "Registrar exame", "Iniciar protocolo"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ações sanitárias" })).toBeNull();
  rerender(<SanidadeAnimal animalId="animal1" propriedadeId={2} podeLancar={false} recarregarToken={0} lista={[]} />);
  for (const nome of ["Registrar aplicação", "Nova ocorrência", "Registrar exame", "Iniciar protocolo"]) expect(screen.queryByRole("button", { name: nome })).toBeNull();
});

it("consulta individual de carências mostra prazos e correção sem reproduzir toda a ficha", async () => {
  render(<SanidadeAnimal somenteCarencias animalId="animal1" propriedadeId={2} podeLancar recarregarToken={0} lista={[aplicacao]} />);
  const tabela = await screen.findByRole("table", { name: "Aplicações sanitárias" });
  expect(screen.getByRole("heading", { name: "Prazos por aplicação" })).toBeTruthy();
  expect(within(tabela).getByRole("cell", { name: "0 h" })).toBeTruthy();
  expect(within(tabela).getByRole("cell", { name: "48 h" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Carências sanitárias" })).toBeNull();
  expect(screen.queryByText("Protocolos sanitários do animal")).toBeNull();
  expect(screen.queryByRole("button", { name: "Abrir exame histórico" })).toBeNull();
  for (const nome of ["Registrar aplicação", "Nova ocorrência", "Registrar exame", "Iniciar protocolo"]) expect(screen.queryByRole("button", { name: nome })).toBeNull();
  expect(screen.queryByRole("button", { name: /Anular aplicação/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Reconciliar origem/ })).toBeNull();
  fireEvent.click(within(tabela).getByRole("button", { name: /Corrigir carência/ }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(tabela.textContent).toContain("Medicamento");
});
it("preserva o sítio do exame histórico ao abrir pelo acompanhamento de animal transferido", async () => {
  vi.mocked(reqSanidade).mockImplementation(async (url) => {
    if (url.startsWith("/exames/exame-historico")) throw new Error("Consulta histórica efetuada");
    return [] as never;
  });
  render(<SanidadeAnimal animalId="animal1" propriedadeId={2} podeLancar={false} recarregarToken={0} lista={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir exame histórico" }));
  await screen.findByText("Consulta histórica efetuada");
  expect(reqSanidade).toHaveBeenCalledWith("/exames/exame-historico?propriedadeId=1", undefined, 1);
});

it("link da participação abre seu detalhe sanitário na ficha, usando sítio e id da URL", async () => {
  window.history.replaceState(null, "", "/pecuaria/rebanho/animais/animal1?participacaoId=participacao1&programacaoId=grupo1&sitio=7&retorno=%2Fpecuaria%2Fsanidade%3FrodadaId%3Dgrupo1#sanidade");
  vi.mocked(reqSanidade).mockImplementation(async path => path.startsWith("/execucoes/") ? { id: "participacao1", animalId: "animal1", animal: { id: "animal1", brinco: "GV3-1" }, protocolo: { nome: "Protocolo escolhido", versao: 2 }, tarefas: [], inicio: "2026-10-19", status: "ATIVA" } : []);
  render(<SanidadeAnimal animalId="animal1" propriedadeId={2} podeLancar={false} recarregarToken={0} lista={[]} />);
  await screen.findByRole("dialog");
  await screen.findByText(/Protocolo escolhido/);
  expect(reqSanidade).toHaveBeenCalledWith("/execucoes/participacao1?propriedadeId=7", undefined, 7);
});
