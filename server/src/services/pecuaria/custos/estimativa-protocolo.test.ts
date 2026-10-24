import { Prisma, type TarefaProtocolo, type ParticipacaoProtocolo, type Produto } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../db.js";
import { estimarPlanosProtocolos, estimarProtocoloTx } from "./estimativa-protocolo.js";
import { referenciasCustoSchema, validarReferenciasCusto } from "./referencias-planejadas.js";
import { saldosBasesTx } from "../../estoque/valorizacao.js";
import { paginaCustos } from "./custos.js";
vi.mock("../../estoque/valorizacao.js", () => ({ saldosBasesTx: vi.fn() }));
afterEach(()=>vi.restoreAllMocks());
const instante = new Date("2026-10-20T00:00:00Z");
const baseValorizada = {
  id: "base", produtoId: "produto", propriedadeId: 1, partidaId: null, baseOrigemId: null, origemMovimentoId: null,
  metodo: "FIFO_AQUISICAO_V1", disponivelDesde: instante, corteAbertura: instante, ordem: 1,
  quantidadeAbertura: new Prisma.Decimal(2), valorAbertura: new Prisma.Decimal(8), aberturaDocumentada: { referencia: "Inventário da fixture" },
  criadoEm: instante, parcelas: [], quantidade: new Prisma.Decimal(2), valor: new Prisma.Decimal(8),
} satisfies Awaited<ReturnType<typeof saldosBasesTx>>[number];
beforeEach(()=>vi.mocked(saldosBasesTx).mockResolvedValue([baseValorizada]));
const ref=(valorUnitario="0.00")=>({valorUnitario,origem:"Cotação veterinária 20",data:"2026-10-20"});
function preparar(parametros: Prisma.JsonValue, tipo:"APLICACAO"|"TENTATIVA"|"MANEJO"="APLICACAO") {
  const tarefaBase = {
    id: "t", execucaoId: "p", etapaId: "e", parametros, nomeSnapshot: "Ação planejada", momentoSnapshot: null,
    legadoIatfId: null, precisaoTemporal: "DIA", precisaoRealizacao: null, previsaoPendente: false,
    previstaPara: instante, previsaoOriginal: null, realizadaEm: null, dispensadaEm: null, motivoDispensa: null,
    historicoReprogramacao: [], realizadoSnapshot: null, desviosSnapshot: null, regularizacaoPendente: false, historicoRegularizacao: [],
  } satisfies TarefaProtocolo;
  const tarefa = {...tarefaBase, etapa: {tipo,nome:"Ação planejada",produtoId:"produto",dose:new Prisma.Decimal(10),unidade:"ML",material:null},execucao:{animal:{id:"a",brinco:"A1",nome:null}}};
  const participacao = {
    id: "p", protocoloId: "protocolo", animalId: "a", propriedadeId: 1, inicio: instante, inicioEfetivo: null,
    origemCalendario: "REFERENCIA_PROGRAMADA", precisaoTemporal: "DIA", precisaoInicioEfetivo: null,
    legadoIatfId: null, referenciaExterna: null, rodadaId: null, ocorrenciaId: null, operacaoServicoId: null,
    canceladaEm: null, motivoCancelamento: null, valorServicoAtribuido: null, criadoEm: instante, criadoPorId: null,
  } satisfies ParticipacaoProtocolo;
  const produto = {
    id: "produto", nome: "Produto da fixture", unidade: "ML", ativo: true, categoriaId: null,
    usoGenetico: false, usoSanitario: true, usoNutricional: false, rastrearPartidas: false, minimoEstoque: null,
    createdAt: instante, updatedAt: instante,
  } satisfies Produto;
  vi.spyOn(prisma.tarefaProtocolo,"findMany").mockResolvedValue([tarefa]);
  vi.spyOn(prisma.participacaoProtocolo,"findMany").mockResolvedValue([participacao]);
  vi.spyOn(prisma.produto,"findUnique").mockResolvedValue(produto);
}
describe("estimativa rastreável de protocolos",()=>{
 it("distingue zero documentado e preço ausente",()=>{
  expect(estimarPlanosProtocolos([{quantidade:2,custoUnitario:"0"}])).toMatchObject({situacao:"COMPLETO",total:"0.00"});
  expect(estimarPlanosProtocolos([{quantidade:2,custoUnitario:null}])).toMatchObject({situacao:"NAO_APURADO",total:null,totalConhecido:null});
 });
 it("exige origem e data inclusive zero e recusa unidade incompatível",()=>{
  expect(referenciasCustoSchema.safeParse({material:{valorUnitario:"0",unidade:"ML"}}).success).toBe(false);
  expect(()=>validarReferenciasCusto({material:{...ref(),unidade:"KG"}},"ML",true)).toThrow(/compatível/);
  expect(()=>validarReferenciasCusto({material:{...ref(),unidade:"ML"}},null,false)).toThrow(/material/);
  expect(referenciasCustoSchema.safeParse({servico:{...ref(),unidade:"POR_ATENDIMENTO"}}).success).toBe(true);
 });
 it("prioriza referência congelada e converte quantidade para sua unidade",async()=>{
  preparar({configuracao:{referenciasCusto:{material:{...ref("12.00"),unidade:"L"},servico:{...ref("5.00"),unidade:"POR_ATENDIMENTO"}}},produtoId:"produto",dose:500,unidade:"ML"});
  const r=await estimarProtocoloTx(prisma,1,{});
  expect(r).toMatchObject({situacao:"COMPLETO",total:"11.00",escopo:{participacoes:1,animais:1,acoes:1}});
  expect(r.referencias.itens[0]).toMatchObject({origem:"Cotação veterinária 20",data:"2026-10-20",quantidade:"0.5",valorUnitario:"12",valor:"6.00"});
  expect(prisma.produto.findUnique).not.toHaveBeenCalled();
 });
 it("mantém referência explícita zero sem transformar serviço ausente em zero",async()=>{
  preparar({etapa:{planoAplicacao:{produtoId:"produto",dose:"1",unidadeDose:"ML"},referenciasCusto:{material:{...ref(),unidade:"ML"}}}});
  const r=await estimarProtocoloTx(prisma,1,{});
  expect(r).toMatchObject({situacao:"PARCIAL",total:null,totalConhecido:"0.00",componentesPendentes:1});
  expect(r.referencias.itens[1]).toMatchObject({valor:null,data:null});
 });
 it("identifica saldo consultado e dose sanitária numérica sem referência explícita",async()=>{
  preparar({produtoId:"produto",dose:10,unidade:"ML"});
  const r=await estimarProtocoloTx(prisma,1,{});
  expect(r).toMatchObject({totalConhecido:"40.00",situacao:"PARCIAL"});
  expect(r.referencias.itens[0]).toMatchObject({origem:"Saldo valorizado atual do sítio",quantidade:"10",valor:"40.00"});
  expect(r.referencias.itens[0].data).toMatch(/^\d{4}-\d{2}-\d{2}T/);
 });
 it("cobertura e manejo não criam componente de material desconhecido",async()=>{
  preparar({etapa:{planoTentativa:{tipo:"COBERTURA"},referenciasCusto:{servico:{...ref("10"),unidade:"POR_ATENDIMENTO"}}}},"TENTATIVA");
  const r=await estimarProtocoloTx(prisma,1,{});expect(r).toMatchObject({total:"10.00",situacao:"COMPLETO"});expect(r.referencias.total).toBe(1);
 });
 it.each([0,1,10,11,21,101])("pagina %i itens e recupera última página",n=>{
  const r=paginaCustos(Array.from({length:n},(_,i)=>i),999,10);
  expect(r.total).toBe(n);expect(r.itens.length).toBeLessThanOrEqual(10);expect(r.pagina).toBe(Math.max(1,Math.ceil(n/10)));
 });
});
