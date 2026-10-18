// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consulta: vi.fn() }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), consultarResumo: mocks.consulta }));
import { PainelGerencial } from "./PainelGerencial";
import type { ResumoGerencial } from "./api";
import { resumoGerencial, resumoRestrito } from "./PainelGerencial.fixtures";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/gerencial?inicio=2026-10-01&fim=2026-10-17");
});

describe("painel gerencial", () => {
  it("explica blocos restritos e preserva informações clínicas autorizadas", async () => {
    mocks.consulta.mockResolvedValue(resumoRestrito());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByText(/2 acompanhamentos/);
    expect(screen.getAllByText("Sem permissão monetária").length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("R$ 0,00")).toBeNull();
    expect(screen.queryByText(/trans-1/)).toBeNull();
    expect(screen.queryByText(/Sal mineral/)).toBeNull();
  });

  it("falha de rede não aparece como total zero e permite tentar novamente", async () => {
    mocks.consulta.mockRejectedValueOnce(new Error("Conexão interrompida")).mockResolvedValue(resumoRestrito());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByText("Conexão interrompida");
    fireEvent.click(screen.getByText("Tentar novamente"));
    await screen.findByText(/2 acompanhamentos/);
    expect(mocks.consulta).toHaveBeenCalledTimes(2);
  });

  it("troca de sítio invalida a resposta antiga mesmo quando o transporte ignora o abort", async () => {
    let antiga!: (v: ResumoGerencial) => void;
    mocks.consulta.mockImplementationOnce(() => new Promise<ResumoGerencial>(resolve => { antiga = resolve; }))
      .mockResolvedValue({ ...resumoRestrito(), escopo: { propriedadeId: 2, sitios: [{ id: 2, nome: "Sítio B" }] } });
    const tela = render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    tela.rerender(<PainelGerencial propriedadeId={2} onPeriodo={() => {}} />);
    await screen.findByText(/Sítio B/);
    await act(async () => { antiga({ ...resumoRestrito(), escopo: { propriedadeId: 1, sitios: [{ id: 1, nome: "Resposta antiga" }] } }); });
    expect(screen.getByText(/Sítio B/)).toBeTruthy();
    expect(screen.queryByText(/Resposta antiga/)).toBeNull();
  });

  it("aplica o período da URL e publica alteração para a navegação", async () => {
    mocks.consulta.mockResolvedValue(resumoRestrito());
    const onPeriodo = vi.fn();
    render(<PainelGerencial propriedadeId={1} onPeriodo={onPeriodo} />);
    await waitFor(() => expect(mocks.consulta).toHaveBeenCalledWith("2026-10-01", "2026-10-17", expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-10-05" } });
    fireEvent.click(screen.getByText("Aplicar período"));
    expect(onPeriodo).toHaveBeenCalledWith({ inicio: "2026-10-05", fim: "2026-10-17" });
  });

  it("mostra centros em tabela aberta e apresenta cobertura de alimentação calculada sobre animal-dias", async () => {
    mocks.consulta.mockResolvedValue(resumoGerencial());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    const tabela = await screen.findByRole("table", { name: "Caixa por centro de custo" });
    expect(within(tabela).getByText("Centro aberto A")).toBeTruthy();
    expect(within(tabela).getByText("Centro aberto B")).toBeTruthy();
    expect(tabela.closest("details")).toBeNull();
    expect(screen.getByText(/166\s*\/\s*3[.]?489 animal-dias com alimentação registrada/)).toBeTruthy();
    expect(screen.getAllByText(/4,8%/).length).toBeGreaterThanOrEqual(1);
  });

  it("distingue null de zero, evita percentual inválido e mantém parcial quando há lacunas com cobertura de 100%", async () => {
    const dados = resumoGerencial();
    if (dados.nutricao.estado !== "DISPONIVEL" || dados.custos.estado !== "DISPONIVEL") throw new Error("Fixture inválida");
    dados.nutricao.dados.rebanho = { animalDias: 0, populacaoMedia: "0", custoConhecido: null, porDia: null, porPeriodo: null, parcial: true };
    dados.nutricao.dados.cobertura = { ...dados.nutricao.dados.cobertura, animalDias: 0, diasAlimentados: 0 };
    dados.nutricao.dados.lacunas = [{ fechamentoId: "fech-2", motivo: "Intervalos não conciliam" }];
    dados.custos.dados.finalidades = [
      { finalidade: "SANIDADE", totalConhecido: null, componentesPendentes: 1 },
      { finalidade: "ROTINA", totalConhecido: "0.00", componentesPendentes: 0 },
    ];
    mocks.consulta.mockResolvedValue(dados);
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByRole("heading", { name: "Nutrição registrada" });
    const detalhesNutricao = screen.getByText(/Detalhes da nutrição/);
    fireEvent.click(detalhesNutricao);
    expect(detalhesNutricao.closest("details")?.open).toBe(true);
    const divergencias = screen.getByText(/Divergências históricas/);
    fireEvent.click(divergencias);
    expect(divergencias.closest("details")?.open).toBe(true);
    await screen.findByText(/Intervalos não conciliam/);
    expect(screen.getAllByText("Não apurado").length).toBeGreaterThan(0);
    const custos = screen.getByRole("region", { name: "Custos diretos registrados" });
    expect(within(custos).getByText("Sanidade", { selector: "dt" }).parentElement?.textContent).toContain("Não apurado");
    expect(within(custos).getByText("Rotina", { selector: "dt" }).parentElement?.textContent).toMatch(/R\$\s?0,00/);
    expect(screen.getByText("Cobertura de alimentação não apurada.")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "Cobertura de alimentação registrada" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b\d+[,.]\d+%/);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);

    const coberturaCompleta = resumoGerencial();
    if (coberturaCompleta.nutricao.estado !== "DISPONIVEL" || coberturaCompleta.custos.estado !== "DISPONIVEL") throw new Error("Fixture inválida");
    coberturaCompleta.nutricao.dados.cobertura = { ...coberturaCompleta.nutricao.dados.cobertura, diasAlimentados: 3489 };
    coberturaCompleta.nutricao.dados.rebanho.parcial = true;
    coberturaCompleta.nutricao.dados.lacunas = [{ fechamentoId: "fech-3", motivo: "Lacuna apesar da cobertura integral" }];
    mocks.consulta.mockResolvedValueOnce(coberturaCompleta);
    fireEvent.click(screen.getByText("Atualizar"));
    await screen.findByText(/Lacuna apesar da cobertura integral/);
    expect(screen.getAllByText(/100(?:,0)?%/)).toHaveLength(2);
    expect(screen.getByText(/total é parcial/i)).toBeTruthy();
  });

  it("conta transações e produtos distintos apesar de fontes e grupos repetidos, e preserva todas as finalidades", async () => {
    mocks.consulta.mockResolvedValue(resumoGerencial());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByRole("table", { name: "Caixa por centro de custo" });
    expect(screen.getByText(/2 transações/)).toBeTruthy();
    expect(screen.getByText(/2 produtos/)).toBeTruthy();
    expect(screen.getByText("Reprodução")).toBeTruthy();
    expect(screen.getByText("Sanidade")).toBeTruthy();
    expect(screen.getByText("Rotina")).toBeTruthy();
    expect(screen.getByText("Sem classificação")).toBeTruthy();
  });

  it("mantém detalhes de vacas, caixa mensal, lacunas e links de origem", async () => {
    mocks.consulta.mockResolvedValue(resumoGerencial());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByRole("heading", { name: "Caixa no período" });
    fireEvent.click(screen.getByText("Evolução mensal do caixa"));
    fireEvent.click(screen.getByText(/Transações de origem/));
    fireEvent.click(screen.getByText(/Detalhes da nutrição/));
    fireEvent.click(screen.getByText("Vacas · secas e lactantes"));
    fireEvent.click(screen.getByText(/Divergências históricas/));
    fireEvent.click(screen.getByText(/Origens e atribuições da nutrição/));
    fireEvent.click(screen.getByText(/Detalhes dos custos diretos/));
    fireEvent.click(screen.getByText(/Componentes únicos dos custos/));
    fireEvent.click(screen.getByText(/Produtos e composição do valor/));
    expect(screen.getByRole("row", { name: /2026-10/ })).toBeTruthy();
    expect(screen.getByText(/vaca-dias/)).toBeTruthy();
    expect(screen.getByText(/Lacuna histórica de classificação/)).toBeTruthy();
    const recebimentos = screen.getAllByRole("link", { name: /trans-1/ });
    expect(recebimentos).toHaveLength(2);
    expect(recebimentos.map(link => link.getAttribute("href")).sort()).toEqual(expect.arrayContaining([expect.stringContaining("#movimento-mov-1"), expect.stringContaining("#movimento-mov-2")]));
    expect(screen.getByRole("link", { name: /Fechamento de consumo/ }).getAttribute("href")).toContain("fechamentoId=fech-1");
    expect(screen.getByRole("link", { name: "Exame reprodutivo" }).getAttribute("href")).toContain("detalheId=exame-1");
    expect(screen.getAllByRole("link", { name: "Sal mineral" })[0].getAttribute("href")).toBe("/estoque/produtos/produto-1?inicio=2026-10-01&fim=2026-10-17&propriedadeId=1");
  });
});
