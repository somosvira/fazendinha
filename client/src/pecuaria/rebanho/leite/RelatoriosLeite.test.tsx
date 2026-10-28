// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RelatoriosLeite } from "./RelatoriosLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
vi.mock("../../relatorios/ResumoRelatorioLeite",()=>({ResumoRelatorioLeite:({inicio,fim}:{inicio:string;fim:string})=><span>Consulta viva: {inicio} a {fim}</span>}));
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../propriedadeScope", () => ({
  getPropriedadeAtiva: () => null,
  comPropriedade: () => ({}),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const lista = {
  propriedadeId: 2,
  itens: [
    {
      id: "emissao",
      inicio: "2026-10-01",
      fim: "2026-10-01",
      corteEm: "2026-10-19T18:00:00Z",
      versaoCalculo: "V1",
      valoresIncluidos: false,
    },
  ],
  total: 1,
  pagina: 1,
  tamanho: 20,
};
const emissao = {
  id: "emissao",
  criadoEm: "2026-10-19T18:00:00Z",
  snapshot: {
    corteEm: "2026-10-19T18:00:00Z",
    versaoCalculo: "LEITE_GERENCIAL_V1",
    propriedade: { id: 2, nome: "Fazenda A" },
    filtros: { inicio: "2026-10-01", fim: "2026-10-01" },
    valoresIncluidos: false,
    valores: null,
    cobertura: {
      producao: {
        diasInformados: 1,
        diasSemFolha: [],
        diasParciais: ["2026-10-01"],
        completa: false,
      },
      producaoNaoConfirmadaLitros: "54",
    },
    dados: {
      producao: { ritmo: [], consolidado: { litros: 54 }, animais: [] },
      qualidade: [],
      destinos: [],
      descartes: [],
      balanco: [],
    },
    limitacoes: ["Sem medição física de campo"],
  },
};
it("abre os números preservados sem chamar produção viva nem emitir novamente", async () => {
  vi.mocked(consultarLeite).mockImplementation(async (p) =>
    p.endsWith("/emissao") ? emissao : lista,
  );
  render(<RelatoriosLeite podeExportar={false} podeFinanceiro={false} />);
  fireEvent.click(screen.getByRole("button", {name:"Emissões anteriores"}));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Abrir relatório de 01/10/2026",
    }),
  );
  await screen.findByText("54 L");
  expect(
    screen.getByText(
      "Valores financeiros não incluídos ou ocultos pela permissão atual.",
    ),
  ).toBeTruthy();
  expect(registrarLeite).not.toHaveBeenCalled();
  expect(
    vi
      .mocked(consultarLeite)
      .mock.calls.every(([p]) => p.startsWith("/relatorios/emissoes")),
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Exportar esta emissão em CSV" }),
  ).toBeNull();
});
it("usa o sítio resolvido na emissão e não solicita valores sem permissão financeira", async () => {
  vi.mocked(consultarLeite).mockResolvedValue(lista);
  vi.mocked(registrarLeite).mockResolvedValue(emissao);
  render(<RelatoriosLeite podeExportar podeFinanceiro={false} />);
  fireEvent.click(screen.getByRole("button", {name:"Período e emissão"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Emitir relatório preservado"})).not.toHaveProperty("disabled",true));
  fireEvent.click(
    screen.getByRole("button", { name: "Emitir relatório preservado" }),
  );
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/relatorios/emissoes",
      2,
      expect.objectContaining({ incluirValores: false }),
    ),
  );
  expect(screen.queryByLabelText("Incluir valores financeiros")).toBeNull();
});
it("separa expedição, aceite e faturamento documentado na emissão", async () => {
  const cf = {
    ...emissao,
    snapshot: {
      ...emissao.snapshot,
      dados: {
        ...emissao.snapshot.dados,
        comercialDocumental: {
          entregas: [
            {
              id: "entrega",
              referencia: "Retirada conferida",
              produtoNome: "Leite",
              data: "2026-10-01",
              numeroOperacao: 417,
              parceiroNome: "Comprador",
              expedidoLitros: "100",
              volumeAceito: "90",
              quantidadeFaturadaLitros: "20",
              motivo: "Conferido no documento",
            },
          ],
          demonstrativos: [],
        },
      },
      valores: {
        custos: {
          consolidado: {
            custoPorLitro: null,
            custos: { totalConhecido: null },
          },
        },
        comercial: [],
        documental: {
          demonstrativos: [],
          faturamento: {
            quantidadeLitros: "20",
            valorFaturado: "60",
            precoFaturadoPorLitro: "3",
          },
        },
      },
    },
  };
  vi.mocked(consultarLeite).mockImplementation(async (p) =>
    p.endsWith("/emissao") ? cf : lista,
  );
  render(<RelatoriosLeite podeExportar={false} podeFinanceiro />);
  fireEvent.click(screen.getByRole("button", {name:"Emissões anteriores"}));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Abrir relatório de 01/10/2026",
    }),
  );
  await screen.findByText("100 L");
  expect(screen.getByText("90 L")).toBeTruthy();
  expect(screen.getAllByText("20 L").length).toBe(2);
  expect(screen.getByText(/R\$\s*3,00/)).toBeTruthy();
  expect(screen.queryByText(/R\$\s*0,60/)).toBeNull();
});

it.each([true, false])("operações integrais e datas de qualidade preservam o recorte; valores autorizados=%s", async autorizado => {
  const fechado = { id: "comercial", parceiroNome: "Laticínio período", referencia: "Acordo integral", inicio: "2026-09-25", fim: "2026-10-24", parcialForaFiltro: true, situacao: "FECHADA",
    fechamento: { id: "fechamento", versao: 2, operacaoId: "financeira", numeroOperacao: 402, data: "2026-10-25", statusFinanceiro: "CONFIRMADA", volumeReconhecidoLitros: "10",
      amostras: [{ amostraId: "amostra", versaoAmostra: 2, data: "2026-10-10", dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", criadoEm: "2026-10-23T12:00:00Z" }] } };
  const cf = { ...emissao, snapshot: { ...emissao.snapshot, versaoCalculo: "LEITE_GERENCIAL_V5", dados: { ...emissao.snapshot.dados,
    operacoesComerciais: [fechado, { ...fechado, id: "aberta", referencia: "Acordo pendente", situacao: "PRECO_PENDENTE", fechamento: null }, { ...fechado, id: "inativa", referencia: "Acordo cancelado", situacao: "INATIVA", fechamento: { ...fechado.fechamento, id: "cancelado", statusFinanceiro: "CANCELADA", amostras: [] } }],
    qualidade: [{ id: "analise", data: "2026-10-10", dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", criadoEm: "2026-10-23T12:00:00Z", sujeito: { tipo: "COLETIVO", origem: "Tanque geral" }, formatoSnapshot: { nome: "Laudo preservado", versao: 1, campos: [] }, resultados: [] }] },
    valores: autorizado ? { custos: { consolidado: { custoPorLitro: null, custos: { totalConhecido: null } } }, comercial: [], operacoesComerciais: [{ comercialId: "comercial", fechamentoId: "fechamento", precoUnitario: "2.0000", ajuste: "0.00", valorTotal: "20.00" }] } : null } };
  vi.mocked(consultarLeite).mockImplementation(async p => p.endsWith("/emissao") ? cf : lista);
  const { rerender } = render(<RelatoriosLeite podeExportar={false} podeFinanceiro={autorizado} />);
  fireEvent.click(screen.getByRole("button", {name:"Emissões anteriores"}));
  fireEvent.click(await screen.findByRole("button", { name: "Abrir relatório de 01/10/2026" }));
  await screen.findByRole("heading", { name: "Operações comerciais por período integral" });
  expect(screen.getAllByText("Abrange datas fora do filtro").length).toBe(3);
  expect(screen.getByText("Preço pendente")).toBeTruthy(); expect(screen.getByText("Inativa")).toBeTruthy();
  expect(screen.getAllByText(/Resultado laboratorial: 15\/10\/2026/).length).toBe(2);
  expect(screen.getAllByText(/Recebimento do laudo: 16\/10\/2026/).length).toBe(2);
  const ajudaPeriodo = screen.getByRole("button", { name: "Sobre o período comercial integral" });
  fireEvent.focus(ajudaPeriodo);
  expect(screen.getByText(/sem rateio diário/)).toBeTruthy();
  fireEvent.blur(ajudaPeriodo);
  expect(screen.queryByText(/R\$\s*20,00/)!==null).toBe(autorizado);
  expect(screen.queryByText(/R\$\s*2,0000/)!==null).toBe(autorizado);
  expect(screen.queryByRole("columnheader", { name: "Valor integral da venda (BRL)" })!==null).toBe(autorizado);
  if (autorizado) {
    rerender(<RelatoriosLeite podeExportar={false} podeFinanceiro={false} />);
    expect(screen.queryByText(/R\$\s*20,00/)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Valor integral da venda (BRL)" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Operações comerciais por período integral" })).toBeTruthy();
  }
});
it('leitor pode editar o período da consulta atual sem permissão de exportar',async()=>{vi.mocked(consultarLeite).mockResolvedValue(lista);render(<RelatoriosLeite propriedadeId={2} podeExportar={false} podeFinanceiro={false}/>);fireEvent.click(screen.getByRole('button',{name:'Período e emissão'}));expect(await screen.findByLabelText('Início do relatório')).toBeTruthy();expect(screen.getByLabelText('Fim do relatório')).toBeTruthy();expect(screen.queryByRole('button',{name:'Emitir relatório preservado'})).toBeNull()});

it('editar e fechar filtros não altera o período aplicado da consulta',async()=>{vi.mocked(consultarLeite).mockResolvedValue(lista);render(<RelatoriosLeite propriedadeId={2} podeExportar={false} podeFinanceiro={false}/>);const anterior=screen.getByText(/Consulta viva:/).textContent;fireEvent.click(screen.getByRole('button',{name:'Período e emissão'}));fireEvent.change(screen.getByLabelText('Início do relatório'),{target:{value:'2026-09-01'}});fireEvent.click(screen.getByRole('button',{name:'Fechar'}));expect(screen.getByText(/Consulta viva:/).textContent).toBe(anterior);fireEvent.click(screen.getByRole('button',{name:'Período e emissão'}));fireEvent.click(screen.getByRole('button',{name:'Consultar produção atual'}));expect(screen.getByText(/Consulta viva:/).textContent).toContain('2026-09-01')});
