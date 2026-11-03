// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormOperacaoNutricional } from "./FormOperacaoNutricional";
import * as api from "./api";
import * as mensal from "./mensal-api";
vi.mock("./mensal-api", () => ({ statusMensal: vi.fn(), configuracoesMensais: vi.fn() }));
import * as lotesApi from "../api";
vi.mock("../api", () => ({ buscarLote: vi.fn(), listarLotes: vi.fn() }));
vi.mock("./api", () => ({ consultarResumoNutricional: vi.fn(), atribuirDieta: vi.fn(), corrigirVigencia: vi.fn(), listarDietas: vi.fn(), listarCentrosNutricionais: vi.fn(), obterVigencia: vi.fn() }));
vi.mock("./ConferenciaPeriodos", () => ({ ConferenciaPeriodos: ({ loteId, propriedadeId }: { loteId: string; propriedadeId: number }) => <p>Consumo {loteId} no sítio {propriedadeId}</p> }));
const lote = { id: "lote", nome: "Matrizes", propriedadeId: 2, propriedade: { id: 2, nome: "Destino" }, ativo: true, animaisAtivos: 5, observacao: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mensal.statusMensal).mockResolvedValue({ habilitada: false, automacao: false });
  vi.mocked(mensal.configuracoesMensais).mockResolvedValue([]);
  vi.mocked(api.consultarResumoNutricional).mockResolvedValue({ lote, vigente: null, programada: null, verValores: false, custos: { fechamentos: 0, animalDias: 0, custoConhecido: null, custoPorAnimalDia: null, coberturaCustoCompleta: true } });
  vi.mocked(lotesApi.buscarLote).mockResolvedValue(lote); vi.mocked(lotesApi.listarLotes).mockResolvedValue([lote]);
  vi.mocked(api.listarDietas).mockResolvedValue([{ id: "publicada", nome: "Dieta publicada", versao: 1, publicadaEm: "2026-10-01", itens: [] }, { id: "rascunho", nome: "Dieta em estudo", versao: 2, publicadaEm: null, itens: [] }]);
  vi.mocked(api.listarCentrosNutricionais).mockResolvedValue([]);
  vi.mocked(api.obterVigencia).mockResolvedValue({ id: "v", loteId: "lote", desde: "2026-09-01", ate: null, dieta: { id: "publicada", nome: "Dieta publicada", versao: 1 } });
});
afterEach(cleanup);
describe("formulários próprios de nutrição", () => {
  it("no consolidado requer lote explícito e atribui apenas uma versão publicada ao sítio desse lote", async () => {
    const onSalvo = vi.fn();
    render(<FormOperacaoNutricional acao="atribuir" onVoltar={vi.fn()} onSalvo={onSalvo} />);
    await screen.findByLabelText("Lote");
    expect(screen.queryByLabelText("Dieta publicada")).toBeNull();
    await alterarControle(screen.getByLabelText("Lote"), { target: { value: "lote" } });
    const versao = await screen.findByLabelText("Dieta publicada");
    expect(screen.queryByRole("option", { hidden: true,  name: /Dieta em estudo/ })).toBeNull();
    await alterarControle(versao, { target: { value: "publicada" } });
    await alterarControle(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "03/10/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar ao lote" }));
    await waitFor(() => expect(api.atribuirDieta).toHaveBeenCalledWith({ loteId: "lote", propriedadeId: 2, dietaId: "publicada", desde: "2026-10-03" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith("lote"));
  });
  it("correção restaura o início histórico e exige motivo sem alterar outra vigência", async () => {
    render(<FormOperacaoNutricional acao="corrigir" loteId="lote" vigenciaId="v" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByLabelText("Motivo da correção");
    await waitFor(() => expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveProperty("value", "01/09/2026"));
    expect(screen.getByRole("button", { name: "Confirmar correção" }).hasAttribute("disabled")).toBe(true);
    await alterarControle(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "02/09/2026" } });
    await alterarControle(screen.getByLabelText("Motivo da correção"), { target: { value: "Correção conferida" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar correção" }));
    await waitFor(() => expect(api.corrigirVigencia).toHaveBeenCalledWith("v", { propriedadeId: 2, desde: "2026-09-02", motivo: "Correção conferida" }));
  });
  it.each(["Cancelar", "Fechar", "Escape"])("protege alteração feita apenas pelo calendário ao sair por %s", async (saida) => {
    const onVoltar = vi.fn();
    render(<FormOperacaoNutricional acao="corrigir" loteId="lote" vigenciaId="v" onVoltar={onVoltar} onSalvo={vi.fn()} />);
    await screen.findByLabelText("Motivo da correção");
    await waitFor(() => expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveProperty("value", "01/09/2026"));
    fireEvent.click(screen.getByRole("button", { name: "Abrir calendário" }));
    fireEvent.click(await screen.findByRole("button", { name: "2 de setembro de 2026" }));
    expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveProperty("value", "02/09/2026");
    if (saida === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: saida }));
    expect(await screen.findByRole("dialog", { name: "Descartar alterações?" })).toBeTruthy();
    expect(onVoltar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveProperty("value", "02/09/2026");
    expect(screen.getByLabelText("Motivo da correção")).toHaveProperty("value", "");
    expect(api.corrigirVigencia).not.toHaveBeenCalled();
  });
  it("não permite corrigir uma vigência de outro lote", async () => {
    vi.mocked(api.obterVigencia).mockResolvedValue({ id: "v", loteId: "outro", desde: "2026-09-01", ate: null, dieta: { id: "d", nome: "Outra dieta", versao: 1 } });
    render(<FormOperacaoNutricional acao="corrigir" loteId="lote" vigenciaId="v" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("A vigência não pertence a este lote.");
    expect(screen.queryByRole("button", { name: "Confirmar correção" })).toBeNull();
  });
  it("reutiliza a conferência de períodos com lote e sítio fixos, sem incluir o histórico na tela", async () => {
    render(<FormOperacaoNutricional acao="consumo" loteId="lote" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Consumo lote no sítio 2");
    expect(screen.queryByText("Histórico de fechamentos")).toBeNull();
  });
  it("novo fechamento indica a forma mensal do lote e guarda o período anterior à adoção", async () => {
    vi.mocked(mensal.statusMensal).mockResolvedValue({ habilitada: true, automacao: true });
    vi.mocked(mensal.configuracoesMensais).mockResolvedValue([{ id: "c", propriedadeId: 2, loteId: null, modelo: "MANUAL", diaConferencia: 5, autorizaValidade: false, desde: "2026-01-01" }]);
    render(<FormOperacaoNutricional acao="consumo" loteId="lote" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Novo fechamento" })).toBeTruthy();
    await screen.findByText("Mensal · Confirmar antes de baixar");
    expect(screen.getByRole("link", { name: "Abrir fechamento mensal" }).getAttribute("href")).toContain("aba=fechamentos");
    expect(screen.getByText("Fechar períodos anteriores a 01/01/2026")).toBeTruthy();
  });
});

it("não confirma sem resumo nem interpreta falha como ausência de dieta", async () => {
  vi.mocked(api.consultarResumoNutricional).mockRejectedValue(new Error("Resumo indisponível"));
  render(<FormOperacaoNutricional acao="atribuir" loteId="lote" dietaInicialId="publicada" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText("Resumo indisponível");
  await alterarControle(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "03/11/2030" } });
  expect(screen.queryByText(/continuará sem dieta/)).toBeNull();
  const confirmar = screen.getByRole("button", { name: "Confirmar programação" });
  expect(confirmar.hasAttribute("disabled")).toBe(true);
  fireEvent.click(confirmar);
  expect(api.atribuirDieta).not.toHaveBeenCalled();
});
it("resolve o modelo pela data e prioriza exceção do lote sobre padrão mais recente", async () => {
  vi.mocked(mensal.statusMensal).mockResolvedValue({ habilitada: true, automacao: false });
  vi.mocked(mensal.configuracoesMensais).mockResolvedValue([
    { id: "padrao", propriedadeId: 2, loteId: null, modelo: "AUTOMATICO", diaConferencia: 5, autorizaValidade: false, desde: "2026-09-01" },
    { id: "lote", propriedadeId: 2, loteId: "lote", modelo: "MANUAL", diaConferencia: 9, autorizaValidade: false, desde: "2026-08-01" },
    { id: "futura", propriedadeId: 2, loteId: "lote", modelo: "PROVISORIO", diaConferencia: 12, autorizaValidade: false, desde: "2030-01-01" },
  ]);
  render(<FormOperacaoNutricional acao="atribuir" loteId="lote" dietaInicialId="publicada" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText(/Confirmar antes de baixar · Conferência dia 9/);
  expect(screen.getByText(/processamento automático diário está desativado/)).toBeTruthy();
  await alterarControle(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "03/01/2030" } });
  expect(screen.getByText(/Estimar e baixar no fechamento · Conferência dia 12/)).toBeTruthy();
  await alterarControle(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "03/07/2026" } });
  expect(screen.getByText(/Sem configuração mensal vigente/)).toBeTruthy();
});
it("não consulta configurações quando a funcionalidade mensal está desativada", async () => {
  render(<FormOperacaoNutricional acao="atribuir" loteId="lote" dietaInicialId="publicada" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText(/Nutrição mensal não habilitada/);
  expect(mensal.configuracoesMensais).not.toHaveBeenCalled();
});
