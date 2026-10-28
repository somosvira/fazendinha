// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConferenciaPeriodos } from "./ConferenciaPeriodos";
import { navegarPara } from "../../../router";
import { previaPeriodos, confirmarPeriodos, type Previa } from "./api";
vi.mock("../../../router", () => ({ navegarPara: vi.fn() }));
vi.mock("./api", () => ({ previaPeriodos: vi.fn(), confirmarPeriodos: vi.fn() }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
vi.mock("../../../estoque/SelecaoPartidas", () => ({ SelecaoPartidas: () => <p>Distribuição por partida</p> }));
const previa: Previa = { loteId: "lote", vigenciaId: "vigencia", inicio: "2026-09-01", fim: "2026-09-10", centroCustoId: "centro", dieta: { nome: "Dieta V3", versao: 1 }, animalDias: 110, participantes: [{ animalId: "animal", brinco: "RN01", dias: 10 }], materiaSecaConhecidaKg: "297", coberturaMateriaSecaCompleta: false, itens: [{ produtoId: "produto", nome: "Ração V3", unidade: "KG", quantidadePrevista: "330", saldo: "400", materiaSecaKg: "297", custoPrevisto: null, rastrearPartidas: false }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [previa], lacunas: [] }); vi.mocked(confirmarPeriodos).mockResolvedValue({}); });
afterEach(cleanup);
describe("conferência nutricional dividida", () => {
  it("evita confirmação duplicada e reutiliza a chave após falha sem perder quantidades", async () => {
    let recusar!: (erro: Error) => void;
    vi.mocked(confirmarPeriodos).mockImplementationOnce(() => new Promise((_, reject) => { recusar = reject; }));
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));
    const confirmar = await screen.findByText("Confirmar conjunto conferido");
    act(() => { fireEvent.click(confirmar); fireEvent.click(confirmar); });
    expect(confirmarPeriodos).toHaveBeenCalledTimes(1);
    const chave = vi.mocked(confirmarPeriodos).mock.calls[0][0].chave;
    await act(async () => { recusar(new Error("Falha de rede")); });
    expect(screen.getByLabelText("Quantidade conferida (KG)")).toHaveProperty("value", "330");
    fireEvent.click(confirmar);
    await waitFor(() => expect(confirmarPeriodos).toHaveBeenCalledTimes(2));
    expect(vi.mocked(confirmarPeriodos).mock.calls[1][0].chave).toBe(chave);
  });
  it("verValores false não exibe custos mesmo com valores recebidos", async () => {
    vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [{ ...previa, verValores: false, itens: [{ ...previa.itens[0], custoPrevisto: "660" }] }], lacunas: [] });
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText("Ração V3: previsto 330 KG");
    expect(screen.queryByText(/Custo conferido|custo previsto/)).toBeNull();
    expect(screen.queryByText(/R\$/)).toBeNull();
  });
  it("atualiza MS e custo conferidos quando a quantidade e a origem mudam", async () => {
    vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [{ ...previa, itens: [{ ...previa.itens[0], custoPrevisto: "660" }] }], lacunas: [] });
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText("Ração V3: previsto 330 KG");
    await alterarControle(screen.getByLabelText("Quantidade conferida (KG)"), { target: { value: "320" } });
    expect(screen.getByText(/MS conferida conhecida ≈ 288.000 kg/)).toBeTruthy();
    expect(screen.getByText(/Custo conferido estimado: ≈ R\$\s640,00/)).toBeTruthy();
    expect(screen.getByText(/custo previsto R\$\s660/)).toBeTruthy();
    await alterarControle(screen.getByLabelText("Origem"), { target: { value: "SEM_BAIXA_JUSTIFICADA" } });
    expect(screen.getByText(/Custo conferido estimado: não apurado/)).toBeTruthy();
  });
  it("mostra previsão, participantes e cobertura incompleta; exige motivo até para consumo zero", async () => {
    const onSalvo = vi.fn().mockResolvedValue(undefined);
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={onSalvo} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText("Ração V3: previsto 330 KG");
    expect(screen.getByText(/110 animal-dias/)).toBeTruthy();
    expect(screen.getByText(/cobertura incompleta/)).toBeTruthy();
    await alterarControle(screen.getByLabelText("Quantidade conferida (KG)"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Confirmar conjunto conferido"));
    await screen.findByText(/justifique a diferença/);
    expect(confirmarPeriodos).not.toHaveBeenCalled();
    await alterarControle(screen.getByLabelText("Motivo da diferença"), { target: { value: "Consumo real conferido em zero" } });
    fireEvent.click(screen.getByText("Confirmar conjunto conferido"));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    expect(confirmarPeriodos).toHaveBeenCalledWith(expect.objectContaining({ chave: expect.any(String), revisao: "r".repeat(64), periodos: [expect.objectContaining({ inicio: "2026-09-01", fim: "2026-09-10", itens: [expect.objectContaining({ quantidadeConfirmada: 0, motivoAjuste: "Consumo real conferido em zero" })] })] }));
  });
  it("confirma a dieta com origens distintas e quantidade efetiva, sem segundo ingrediente leiteiro", async () => {
    vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), lacunas: [], periodos: [{...previa,animalDias:6,itens:[{...previa.itens[0],produtoId:"leite",nome:"Leite",unidade:"L",quantidadePrevista:"60",saldo:"100",leite:{quantidadePrevistaLitros:"60.000",quantidadeDisponivelLitros:"100.000",quantidadeAtendivelLitros:"60.000",custoPrevisto:null,composicaoPrevista:[],origens:[{entradaId:"nc",produtoId:"leite-nc",produtoNome:"Leite restrito",natureza:"NAO_COMERCIAL",data:"2026-09-01",quantidadeDisponivelLitros:"40.000"},{entradaId:"com",produtoId:"leite-com",produtoNome:"Leite comercial",natureza:"COMERCIAL",data:"2026-09-01",quantidadeDisponivelLitros:"60.000"}]}}]}] });
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));await screen.findByText("Leite: previsto 60 L");
    expect(screen.getByLabelText(/Leite restrito · Não comercial/)).toHaveProperty("checked",true);
    expect(screen.getByLabelText(/Leite comercial · Comercial/)).toHaveProperty("checked",true);
    fireEvent.click(screen.getByText("Confirmar conjunto conferido"));
    await waitFor(()=>expect(confirmarPeriodos).toHaveBeenCalledWith(expect.objectContaining({periodos:[expect.objectContaining({itens:[expect.objectContaining({produtoId:"leite",quantidadeConfirmada:60,origensLeite:["nc","com"]})]})]})));
  });
  function comLeiteRegistrado(): Previa {
    return {...previa,ofertasBezerreiro:[{ofertaId:'oferta',fornecimentoId:'fornecimento',data:'2026-09-03',quantidadeLitros:'4.000',animalIds:['animal/1']}],orientacaoLeiteBezerreiro:'Concilie as ofertas antes de confirmar o leite no fechamento.',itens:[previa.itens[0],{...previa.itens[0],produtoId:'leite',nome:'Leite',unidade:'L',quantidadePrevista:'60',saldo:'100',materiaSecaKg:null,leite:{quantidadePrevistaLitros:'60.000',quantidadeDisponivelLitros:'100.000',quantidadeAtendivelLitros:'60.000',custoPrevisto:null,composicaoPrevista:[],origens:[]}}]};
  }
  it("apresenta data e volume do fato existente e abre o Bezerreiro no mesmo contexto",async()=>{
    vi.mocked(previaPeriodos).mockResolvedValue({revisao:'r'.repeat(64),periodos:[comLeiteRegistrado()],lacunas:[]});
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()}/>);
    fireEvent.click(screen.getByText('Conferir período'));
    await screen.findByRole('region',{name:'Leite já registrado no Bezerreiro'});
    expect(screen.getByText(/03\/09\/2026 · 4 L já fornecidos/)).toBeTruthy();
    expect(screen.getByLabelText('Quantidade conferida (L)')).toHaveProperty('value','60');
    expect(screen.getByRole('button',{name:'Confirmar conjunto conferido'})).toHaveProperty('disabled',true);
    fireEvent.click(screen.getByRole('button',{name:'Abrir no Bezerreiro'}));
    expect(navegarPara).toHaveBeenCalledWith('/pecuaria/bezerreiro?aba=alimentacao&propriedadeId=1&data=2026-09-03&animalId=animal%2F1');
    expect(confirmarPeriodos).not.toHaveBeenCalled();
  });
  it("concilia apenas após ação explícita de zerar leite e conserva os demais ingredientes",async()=>{
    vi.mocked(previaPeriodos).mockResolvedValue({revisao:'r'.repeat(64),periodos:[comLeiteRegistrado()],lacunas:[]});
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()}/>);
    fireEvent.click(screen.getByText('Conferir período'));await screen.findByText('Leite: previsto 60 L');
    await alterarControle(screen.getByLabelText('Quantidade conferida (KG)'),{target:{value:'320'}});
    fireEvent.change(screen.getAllByLabelText('Motivo da diferença')[0],{target:{value:'Quantidade real da ração conferida'}});
    fireEvent.click(screen.getByRole('button',{name:'Confirmar conjunto conferido'}));
    expect(confirmarPeriodos).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Quantidade conferida (L)')).toHaveProperty('value','60');
    fireEvent.click(screen.getByRole('button',{name:'Usar ofertas já registradas · zerar leite'}));
    expect(screen.getByLabelText('Quantidade conferida (L)')).toHaveProperty('value','0');
    expect(screen.getByLabelText('Quantidade conferida (KG)')).toHaveProperty('value','320');
    expect(screen.getByRole('button',{name:'Confirmar conjunto conferido'})).toHaveProperty('disabled',false);
    fireEvent.click(screen.getByRole('button',{name:'Confirmar conjunto conferido'}));
    await waitFor(()=>expect(confirmarPeriodos).toHaveBeenCalledOnce());
    expect(vi.mocked(confirmarPeriodos).mock.calls[0][0].periodos[0].itens).toEqual([
      expect.objectContaining({produtoId:'produto',quantidadeConfirmada:320,motivoAjuste:'Quantidade real da ração conferida'}),
      expect.objectContaining({produtoId:'leite',quantidadeConfirmada:0,motivoAjuste:'Leite já registrado nas ofertas do Bezerreiro; sem novo fornecimento neste fechamento.'}),
    ]);
    expect(vi.mocked(confirmarPeriodos).mock.calls[0][0].periodos[0].itens[1].origensLeite).toBeUndefined();
  });
  it("voltar a informar leite positivo ou apagar o motivo bloqueia outra vez, inclusive sem baixa",async()=>{
    vi.mocked(previaPeriodos).mockResolvedValue({revisao:'r'.repeat(64),periodos:[comLeiteRegistrado()],lacunas:[]});
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()}/>);
    fireEvent.click(screen.getByText('Conferir período'));await screen.findByText('Leite: previsto 60 L');
    fireEvent.click(screen.getByRole('button',{name:'Usar ofertas já registradas · zerar leite'}));
    fireEvent.change(screen.getByLabelText('Motivo da diferença'),{target:{value:''}});
    expect(screen.getByRole('button',{name:'Confirmar conjunto conferido'})).toHaveProperty('disabled',true);
    fireEvent.click(screen.getByRole('button',{name:'Usar ofertas já registradas · zerar leite'}));
    await alterarControle(screen.getByLabelText('Quantidade conferida (L)'),{target:{value:'56'}});
    await alterarControle(screen.getAllByLabelText('Origem')[1],{target:{value:'SEM_BAIXA_JUSTIFICADA'}});
    expect(screen.getByRole('button',{name:'Confirmar conjunto conferido'})).toHaveProperty('disabled',true);
    fireEvent.click(screen.getByRole('button',{name:'Confirmar conjunto conferido'}));expect(confirmarPeriodos).not.toHaveBeenCalled();
  });
  it("ofertas históricas não impedem confirmar ingredientes sem leite",async()=>{
    const p=comLeiteRegistrado();p.itens=[previa.itens[0]];
    vi.mocked(previaPeriodos).mockResolvedValue({revisao:'r'.repeat(64),periodos:[p],lacunas:[]});
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()}/>);
    fireEvent.click(screen.getByText('Conferir período'));await screen.findByText('Ração V3: previsto 330 KG');
    expect(screen.getByRole('button',{name:'Confirmar conjunto conferido'})).toHaveProperty('disabled',false);
    expect(screen.queryByRole('button',{name:'Usar ofertas já registradas · zerar leite'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Confirmar conjunto conferido'}));await waitFor(()=>expect(confirmarPeriodos).toHaveBeenCalledOnce());
  });
  it("informa lacuna sem dieta e bloqueia a confirmação do conjunto", async () => {
    vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [previa], lacunas: [{ inicio: "2026-08-30", fim: "2026-08-31" }] });
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText(/Sem dieta de 30\/08\/2026/);
    expect(screen.getByText("Confirmar conjunto conferido").hasAttribute("disabled")).toBe(true);
    expect(confirmarPeriodos).not.toHaveBeenCalled();
  });
});
