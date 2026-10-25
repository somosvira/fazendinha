import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
 tx: { $executeRaw: vi.fn(), lote: { findFirst: vi.fn() }, centroCusto: { findFirst: vi.fn() }, vigenciaDietaLote: { findFirst: vi.fn() }, localizacaoAnimal: { findMany: vi.fn() },
 entradaProducaoLeite: { findFirst: vi.fn(), findMany: vi.fn() }, fechamentoConsumo: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
 itemFechamentoConsumo: { create: vi.fn() }, fornecimentoNutricionalLeite: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
 requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() } },
 valores: vi.fn(), saldo: vi.fn(), baixar: vi.fn(), estornar: vi.fn(), travar: vi.fn(), generico: vi.fn(), provisorio: vi.fn(), periodo: vi.fn(),
 requisicoes: new Map<string, unknown>(),
}));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (fn: (tx: typeof m.tx) => unknown) => fn(m.tx) }));
vi.mock("../../estoque/leite.js", () => ({ saldosOrigensLeiteTx: m.saldo, baixarLeiteTx: m.baixar, estornarBaixaLeiteTx: m.estornar, valoresMovimentosLeiteTx: m.valores }));
vi.mock("../../estoque/valorizacao.js", () => ({ travarValorizacaoTx: m.travar, planejarSaidaTx: m.generico, registrarSaidaValorizadaTx: vi.fn() }));
vi.mock("../../financeiro/regras.js", async original => ({ ...await original<typeof import("../../financeiro/regras.js")>(), exigirPeriodoAberto: m.periodo }));
vi.mock("./referencias.js", () => ({ aplicarReferenciaProvisoriaTx: m.provisorio }));
import { consultarFornecimentosNutricionaisTx } from "./nutricao.js";
import { confirmarConsumo, estornarFechamento } from "../nutricao/consumo.js";
const d = (v: string | number) => new Prisma.Decimal(v);
const produtos = ["leite-com", "leite-nc"];
const input = { chave: "chave", loteId: "lote", propriedadeId: 1, inicio: "2026-10-01", fim: "2026-10-01", itens: [{ produtoId: produtos[0], quantidadeConfirmada: 60, modoEstoque: "BAIXA_ESTOQUE" as const, origensLeite: ["com", "nc"] }] };
beforeEach(() => {
 vi.resetAllMocks(); m.requisicoes.clear();
 m.tx.requisicaoPecuaria.findUnique.mockImplementation(async ({where}) => m.requisicoes.get(where.chave) ?? null);
 m.tx.requisicaoPecuaria.create.mockImplementation(async ({data}) => { m.requisicoes.set(data.chave,data); return data; });
 m.tx.lote.findFirst.mockResolvedValue({ id: "lote", nome: "Bezerreiro", centroCustoId: "centro" });
 m.tx.centroCusto.findFirst.mockResolvedValue({ id: "centro" });
 m.tx.vigenciaDietaLote.findFirst.mockResolvedValue({ id: "vigencia", dieta: { nome: "Leite 10L", publicadaEm: new Date(), itens: [{ produtoId: produtos[0], quantidadeCabecaDia: d(10), unidade: "L", materiaSecaPercentualSnapshot: null, produto: { nome: "Leite", rastrearPartidas: false } }] } });
 m.tx.localizacaoAnimal.findMany.mockResolvedValue(Array.from({length:6}, (_,i) => ({ animalId: `animal${i}`, desde: new Date("2026-09-01"), ate: null })));
 m.tx.entradaProducaoLeite.findFirst.mockResolvedValue({ id: "com" });
 m.tx.entradaProducaoLeite.findMany.mockResolvedValue(produtos.map(produtoId => ({ movimento: { produtoId, produto: { nome: produtoId } } })));
 m.saldo.mockImplementation(async (_tx, produtoId) => [{ entradaId: produtoId===produtos[0]?"com":"nc", natureza: produtoId===produtos[0]?"COMERCIAL":"NAO_COMERCIAL", quantidade: d(produtoId===produtos[0]?80:40), valor: d(produtoId===produtos[0]?112:56), data: "2026-10-01", ordem: 1 }]);
 m.baixar.mockImplementation(async (_tx, i) => ({ id: `mov-${i.produtoId}`, quantidade: i.quantidade, valorTotal: i.quantidade.mul("1.4") }));
 m.tx.fechamentoConsumo.create.mockResolvedValue({ id: "fechamento" });
 m.tx.itemFechamentoConsumo.create.mockImplementation(async ({data}) => ({ id: "item", ...data }));
 m.tx.fornecimentoNutricionalLeite.create.mockImplementation(async ({data}) => ({ id: "fornecimento", ...data }));
});
describe("dieta confirmada com leite V5", () => {
 it("usa previsão/vigência existentes, baixa 40 NC + 20 comercial em produtos distintos, atribui 10 por animal e repete sem baixa nova", async () => {
  const resposta = await confirmarConsumo(input, 1);
  await confirmarConsumo(input, 1);
  expect(resposta.itens[0]).toMatchObject({ quantidadeConfirmada: d(60), quantidadePrevista: d(60), movimentoEstoqueId: null, situacaoCusto: "CONHECIDO" });
  expect(m.baixar).toHaveBeenCalledTimes(2);
  expect(m.baixar.mock.calls.map(c => [c[1].produtoId,c[1].quantidade.toString(),c[1].entradaIds])).toEqual([["leite-nc","40",["nc"]],["leite-com","20",["com"]]]);
  expect(m.generico).not.toHaveBeenCalled();
  const salvo = m.tx.fornecimentoNutricionalLeite.create.mock.calls[0][0].data;
  expect(salvo.parcelas.create.map((p: { quantidadeLitros: Prisma.Decimal }) => p.quantidadeLitros.toString())).toEqual(Array(6).fill("10"));
  expect(m.provisorio).toHaveBeenCalledOnce();
 });
 it("recusa origem de outro sítio ou saldo que mudou antes da confirmação", async () => {
  await expect(confirmarConsumo({ ...input, itens: [{ ...input.itens[0], origensLeite: ["outro-sitio"] }] },1)).rejects.toThrow("origens");
  expect(m.baixar).not.toHaveBeenCalled();
 });
 it("50 L disponíveis não viram 60, mas ajuste efetivo de 50 exige motivo e conserva previsão 60", async () => {
  m.saldo.mockImplementation(async (_tx, produtoId) => [{ entradaId: produtoId===produtos[0]?"com":"nc", natureza: produtoId===produtos[0]?"COMERCIAL":"NAO_COMERCIAL", quantidade: d(produtoId===produtos[0]?10:40), valor: null, data: "2026-10-01", ordem:1 }]);
  await expect(confirmarConsumo(input,1)).rejects.toThrow("Saldo elegível insuficiente");
  await expect(confirmarConsumo({ ...input,itens:[{...input.itens[0],quantidadeConfirmada:50}] },1)).rejects.toThrow("Explique a diferença");
  const f = await confirmarConsumo({ ...input,itens:[{...input.itens[0],quantidadeConfirmada:50,motivoAjuste:"Apenas 50 litros disponíveis e fornecidos"}] },1);
  expect(f.itens[0]).toMatchObject({quantidadePrevista:d(60),quantidadeConfirmada:d(50),situacaoCusto:"NAO_APURADO"});
 });
 it("chave reutilizada com payload/autor diferentes conflita", async () => {
  await confirmarConsumo(input,1);
  await expect(confirmarConsumo(input,2)).rejects.toThrow("Chave");
  expect(m.baixar).toHaveBeenCalledTimes(2);
 });
 it("estorno restaura cada movimento de origem uma vez e não toca colostragem V4", async () => {
  m.tx.fechamentoConsumo.findFirst.mockResolvedValue({id:"fechamento",propriedadeId:1,loteId:"lote",status:"CONFIRMADO",inicio:new Date("2026-10-01"),fim:new Date("2026-10-01"),itens:[{id:"item",movimentoEstoqueId:null}],participacoes:[{animalId:"animal0"}]});
  m.tx.fornecimentoNutricionalLeite.findFirst.mockResolvedValue({id:"fornecimento",status:"CONFIRMADO",movimentos:[{movimentoId:"mov-nc"},{movimentoId:"mov-com"}]});
  m.tx.fechamentoConsumo.update.mockResolvedValue({status:"ESTORNADO"});
  await estornarFechamento("fechamento",1,"Correção comprovada",1);
  expect(m.estornar.mock.calls.map(c=>c[1].movimentoId)).toEqual(["mov-nc","mov-com"]);
  expect(m.tx.fornecimentoNutricionalLeite.update).toHaveBeenCalledWith({where:{id:"fornecimento"},data:{status:"ESTORNADO"}});
 });
});

it("DTO mantém custo84 permitido e mascara todos os preços e justificativa comercial sem gate financeiro",async()=>{
 const referencia = {id:"r",versao:1,fechamentoId:"preco",periodoInicio:new Date("2026-09-01"),periodoFim:new Date("2026-09-30"),parceiroId:"comprador",precoUnitario:d("2.50"),valorTotal:d("150"),provisoria:true,motivo:"Negociado R$2,50",criadoPorId:1,criadoEm:new Date()};
 m.tx.fornecimentoNutricionalLeite.findMany.mockResolvedValue([{id:"f",itemId:"item",status:"CONFIRMADO",quantidadeLitros:d(60),movimentos:[{movimentoId:"m",entradaId:"e",natureza:"COMERCIAL",quantidadeLitros:d(60)}],parcelas:[{animalId:"a",dias:1,baseQuantidade:"ATRIBUIDA",quantidadeLitros:d(60)}],referencias:[referencia]}]);
 m.valores.mockResolvedValue(new Map([["m",{valorTotal:d(84)}]]));
 const dto = await consultarFornecimentosNutricionaisTx(m.tx as unknown as Prisma.TransactionClient,["item"],true,false);
 expect(dto.get("item")).toMatchObject({quantidadeLitros:"60.000",custoProducao:"84.00",referencia:{precoUnitario:null,valorTotal:null,motivo:null},parcelas:[{valorGerencial:null}]});
 expect(JSON.stringify(dto.get("item"))).not.toContain("2.50");expect(JSON.stringify(dto.get("item"))).not.toContain("150");
});
