import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QualidadeLeite } from "./QualidadeLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
const tela = { ...screen,
  getByRole: (...args: Parameters<typeof screen.getByRole>) => screen.getAllByRole(...args)[0],
  findByRole: async (...args: Parameters<typeof screen.findByRole>) => (await screen.findAllByRole(...args))[0],
  getByText: (...args: Parameters<typeof screen.getByText>) => screen.getAllByText(...args)[0],
  findByText: async (...args: Parameters<typeof screen.findByText>) => (await screen.findAllByText(...args))[0],
  getByLabelText: (...args: Parameters<typeof screen.getByLabelText>) => screen.getAllByLabelText(...args)[0],
  findByLabelText: async (...args: Parameters<typeof screen.findByLabelText>) => (await screen.findAllByLabelText(...args))[0],
};
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
  alterarLeite: vi.fn(),
}));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => null }));
afterEach(cleanup);
const formato = {
  id: "formato",
  nome: "Laudo informado",
  ativo: true,
  versaoFormato: 1,
  versaoAnteriorId: null,
  formatoExameHash: "a".repeat(64),
  formatoBloqueado: true,
  campos: [
    {
      codigo: "GORDURA",
      rotulo: "Gordura",
      tipo: "NUMERO",
      unidade: "%",
      obrigatorio: true,
    },
    { codigo: "TESTE", rotulo: "Teste do laudo", tipo: "BOOLEANO" },
  ],
};
const amostra = {
  id: "amostra",
  propriedadeId: 2,
  data: "2026-10-19",
  versao: 2,
  sujeito: { tipo: "COLETIVO", origem: "Tanque A" },
  animal: null,
  tipoExameId: formato.id,
  formatoSnapshot: { nome: formato.nome, versao: 1, campos: formato.campos },
  resultados: [
    { campo: "GORDURA", valor: 0 },
    { campo: "TESTE", valor: false },
  ],
  realizacao: "REALIZADO",
  status: "VALIDO",
  responsavel: null,
  anotacaoOriginal: null,
  laudos: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(registrarLeite).mockReset();
  vi.mocked(consultarLeite).mockImplementation(async (caminho) => {
    if (caminho.includes("/formatos")) return [formato];
    if (caminho.includes("/historico"))
      return { itens: [], total: 0, pagina: 1, tamanho: 20 };
    if (caminho.includes("/qualidade/origens"))
      return { itens: [], total: 0, pagina: 1, tamanho: 20 };
    if (caminho.includes("/destinos/candidatos"))
      return {
        itens: [{ animalId: "animal", brinco: "123", nome: "Aurora" }],
        total: 1,
        pagina: 1,
        porPagina: 10,
      };
    return { propriedadeId: 2, itens: [amostra], total: 1, pagina: 1, tamanho: 20 };
  });
});
it("mostra zero e falso do laudo sem converter em ausência", async () => {
  render(<QualidadeLeite podeLancar={false} />);
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: /Abrir (amostra|laudo e histórico)/ }));
  expect(await tela.findByText("0 %")).toBeTruthy();
  expect(tela.getByText("Não")).toBeTruthy();
  expect(
    tela.queryByRole("button", { name: "Registrar amostra" }),
  ).toBeNull();
  expect(tela.queryByText("Resultado ainda não informado.")).toBeNull();
});
it("coleta coletiva pendente envia origem explícita e hash do formato sem inventar resultados", async () => {
  vi.mocked(registrarLeite).mockImplementationOnce(() => new Promise(() => {}));
  render(<QualidadeLeite podeLancar />);
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: "Registrar amostra" }));
  await selecionarCampoLeite("Formato do laudo", "formato");
  await selecionarCampoLeite("Origem da amostra", "COLETIVO");
  fireEvent.change(tela.getByLabelText("Identificação da origem coletiva"), {
    target: { value: "Tanque B — laudo 23" },
  });
  const form = screen
    .getByRole("group", { name: "Registrar amostra de leite" })
    .closest("form")!;
  fireEvent.submit(form);
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/qualidade/amostras",
      2,
      expect.objectContaining({
        sujeito: { tipo: "COLETIVO", origem: "Tanque B — laudo 23" },
        resultados: [],
        formatoExameHash: "a".repeat(64),
      }),
    ),
  );
  expect((tela.getByRole("combobox", { name: "Formato do laudo" }) as HTMLButtonElement).disabled).toBe(true);
  expect((tela.getByRole("combobox", { name: "Origem da amostra" }) as HTMLButtonElement).disabled).toBe(true);
});
it("falha na correção conserva valores e motivo para reenvio, sem confirmar sucesso", async () => {
  vi.mocked(registrarLeite).mockRejectedValue(
    new Error("Conflito: atualize a amostra"),
  );
  render(<QualidadeLeite podeLancar />);
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: /Abrir (amostra|laudo e histórico)/ }));
  fireEvent.click(tela.getByRole("tab", { name: "Informar ou corrigir" }));
  const detalhe = tela.getByRole("region", { name: "Detalhe da amostra" });
  fireEvent.change(within(detalhe).getByLabelText("Motivo da atualização"), {
    target: { value: "Conferido com laboratório" },
  });
  fireEvent.click(
    within(detalhe).getByRole("button", { name: "Confirmar atualização" }),
  );
  await tela.findByText("Conflito: atualize a amostra");
  expect(
    (tela.getByLabelText("Motivo da atualização") as HTMLTextAreaElement)
      .value,
  ).toBe("Conferido com laboratório");
  expect(registrarLeite).toHaveBeenCalledWith(
    "/qualidade/amostras/amostra/correcoes",
    2,
    expect.objectContaining({
      versaoEsperada: 2,
      resultados: amostra.resultados,
    }),
  );
  expect(
    tela.queryByText("Amostra atualizada com histórico preservado."),
  ).toBeNull();
});


it("registra datas conhecidas independentemente dos resultados da coleta", async () => {
  render(<QualidadeLeite podeLancar />);
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: "Registrar amostra" }));
  await selecionarCampoLeite("Formato do laudo", "formato");
  await selecionarCampoLeite("Origem da amostra", "COLETIVO");
  fireEvent.change(tela.getByLabelText("Identificação da origem coletiva"), { target: { value: "Tanque B" } });
  fireEvent.change(tela.getByLabelText("Data da coleta"), { target: { value: "2026-10-10" } });
  fireEvent.change(tela.getByLabelText("Data do resultado laboratorial (opcional)"), { target: { value: "2026-10-15" } });
  fireEvent.change(tela.getByLabelText("Data de recebimento do laudo (opcional)"), { target: { value: "2026-10-16" } });
  fireEvent.submit(tela.getByRole("group", { name: "Registrar amostra de leite" }).closest("form")!);
  await waitFor(() => expect(registrarLeite).toHaveBeenCalledWith("/qualidade/amostras", 2, expect.objectContaining({ data: "2026-10-10", dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", resultados: [] })));
});
it("correção só de datas de coleta pendente omite resultados e mantém motivo após falha", async () => {
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.includes("/formatos") ? [formato] : caminho.includes("/historico") ? { itens: [], total: 0, pagina: 1, tamanho: 20 } : { propriedadeId: 2, itens: [{ ...amostra, resultados: [], realizacao: "COLETA_REGISTRADA" }], total: 1, pagina: 1, tamanho: 20 });
  vi.mocked(registrarLeite).mockRejectedValue(new Error("Falha ao salvar datas"));
  render(<QualidadeLeite podeLancar />);
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: /Abrir (amostra|laudo e histórico)/ }));
  const detalhe = within(tela.getByRole("region", { name: "Detalhe da amostra" }));
  fireEvent.change(detalhe.getByLabelText("Data de recebimento do laudo (opcional)"), { target: { value: "2026-10-16" } });
  fireEvent.change(detalhe.getByLabelText("Motivo da atualização"), { target: { value: "Conferido no laudo" } });
  expect((detalhe.getByRole("button", { name: "Confirmar atualização" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(detalhe.getByRole("button", { name: "Confirmar atualização" }));
  await tela.findByText("Falha ao salvar datas");
  const payload = vi.mocked(registrarLeite).mock.calls[0][2];
  expect(payload).toMatchObject({ versaoEsperada: 2, motivo: "Conferido no laudo", dataRecebimentoLaudo: "2026-10-16" });
  expect(payload).not.toHaveProperty("resultados");
  expect(payload).not.toHaveProperty("dataResultadoLaboratorial");
  expect((detalhe.getByLabelText("Data de recebimento do laudo (opcional)") as HTMLInputElement).value).toBe("2026-10-16");
});
it("limpa explicitamente uma data, preserva a outra e mostra datas do histórico", async () => {
  const item = { ...amostra, dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", criadoEm: "2026-10-23T12:00:00Z" };
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.includes("/formatos") ? [formato] : caminho.includes("/historico") ? { itens: [{ id: "h", acao: "DATAS_CORRIGIDAS", em: "2026-10-23T12:00:00Z", antes: { dataResultadoLaboratorial: null }, depois: { dataResultadoLaboratorial: "2026-10-15" }, motivo: "Conferido" }], total: 1, pagina: 1, tamanho: 20 } : { propriedadeId: 2, itens: [item], total: 1, pagina: 1, tamanho: 20 });
  render(<QualidadeLeite podeLancar />);
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: /Abrir (amostra|laudo e histórico)/ }));
  expect(await tela.findByText("Resultado laboratorial: 15/10/2026")).toBeTruthy();
  expect(tela.getByText("16/10/2026")).toBeTruthy();
  expect(tela.getByText(/23\/10\/2026, 09:00/)).toBeTruthy();
  fireEvent.click(tela.getByRole("tab", {name:"Histórico"}));
  const detalhe = within(tela.getByRole("region", { name: "Detalhe da amostra" }));
  await detalhe.findByText(/Datas corrigidas/);
  expect(detalhe.getByText("Resultado laboratorial: Não informado")).toBeTruthy();
  fireEvent.click(tela.getByRole("tab", {name:"Informar ou corrigir"}));
  fireEvent.change(detalhe.getByLabelText("Data do resultado laboratorial (opcional)"), { target: { value: "" } });
  fireEvent.change(detalhe.getByLabelText("Motivo da atualização"), { target: { value: "Data removida após conferência" } });
  fireEvent.click(detalhe.getByRole("button", { name: "Confirmar atualização" }));
  await waitFor(() => expect(registrarLeite).toHaveBeenCalled());
  const payload = vi.mocked(registrarLeite).mock.calls[0][2];
  expect(payload).toMatchObject({ dataResultadoLaboratorial: null });
  expect(payload).not.toHaveProperty("dataRecebimentoLaudo");
  expect(payload).not.toHaveProperty("resultados");
});

it("as abas mantêm o rascunho da correção e não executam escrita ao alternar",async()=>{
 render(<QualidadeLeite podeLancar/>);await tela.findByText("Tanque A");fireEvent.click(tela.getByRole("button",{name:/Abrir (amostra|laudo e histórico)/}));
 fireEvent.click(tela.getByRole("tab",{name:"Informar ou corrigir"}));fireEvent.change(tela.getByLabelText("Motivo da atualização"),{target:{value:"Conferência ainda em edição"}});
 fireEvent.click(tela.getByRole("tab",{name:"Arquivos"}));expect(tela.getByRole("region",{name:"Arquivos do laudo"})).toBeTruthy();
 fireEvent.click(tela.getByRole("tab",{name:"Informar ou corrigir"}));expect((tela.getByLabelText("Motivo da atualização") as HTMLTextAreaElement).value).toBe("Conferência ainda em edição");expect(registrarLeite).not.toHaveBeenCalled();
});

it('não repete a anotação original quando o mesmo conteúdo já está nos resultados',async()=>{
 const texto='Observação preservada do laboratório';
 vi.mocked(consultarLeite).mockImplementation(async caminho=>caminho.includes('/formatos')?[formato]:caminho.includes('/historico')?{itens:[],total:0,pagina:1,tamanho:20}:{propriedadeId:2,itens:[{...amostra,anotacaoOriginal:texto,resultados:[...amostra.resultados,{campo:'NOTA',valor:texto}]}],total:1,pagina:1,tamanho:20});
 render(<QualidadeLeite podeLancar={false}/>);await tela.findByText('Tanque A');fireEvent.click(tela.getByRole('button',{name:/Abrir (amostra|laudo e histórico)/}));const dialog=await screen.findByRole('dialog');expect(within(dialog).getAllByText(texto).filter(el=>!el.closest('[hidden]'))).toHaveLength(1);expect(within(dialog).queryByRole('heading',{name:'Observação'})).toBeNull();
});
