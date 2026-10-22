import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({tx:{} as Prisma.TransactionClient,vender:vi.fn(),periodo:vi.fn(),auditar:vi.fn(),transaction:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{}}));
vi.mock("../../estoque/transacao.js",()=>({transacaoEstoque:f.transaction}));
vi.mock("./estoque.js",async original=>({...await original<typeof import("./estoque.js")>(),venderLeiteTx:f.vender}));
vi.mock("../../estoque/valorizacao.js",()=>({travarValorizacaoTx:vi.fn()}));
vi.mock("../../financeiro/regras.js",async original=>({...await original<typeof import("../../financeiro/regras.js")>(),exigirPeriodoAberto:f.periodo}));
vi.mock("../rebanho/regras.js",async original=>({...await original<typeof import("../rebanho/regras.js")>(),auditar:f.auditar}));
vi.mock("../reproducao/operacoes.js",()=>({operacaoIdempotenteTx:(_tx:unknown,_i:unknown,_u:unknown,_o:unknown,fn:()=>unknown)=>fn()}));
import { registrarEntregaLeite, registrarDemonstrativoLeiteTx, conferirEntregaLeite, anularDemonstrativoLeite, entregaLeiteDTO } from "./comercial.js";
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const ctx={propriedadeId:7,usuarioId:9};const D=(n:number)=>new Prisma.Decimal(n);
function banco(){
 const retirada={id:id(1),produtoId:id(2),propriedadeId:7,status:"CONFIRMADO",data:new Date("2026-10-19"),quantidade:D(100)};
 const operacao={id:id(3),parceiroId:id(4),parceiro:{nome:"Laticínio"},status:"CONFIRMADA",valorTotal:D(225),numero:42};
 const v={id:id(5),operacaoId:operacao.id,retiradaId:retirada.id,retirada,operacao};
 const entrega={id:id(6),propriedadeId:7,parceiroId:id(4),parceiro:{nome:"Laticínio"},retiradaId:retirada.id,pontoColeta:null,horarioColeta:null,referencia:"Coleta123",retirada:{...retirada,versoesComerciaisLeite:[v]},conferencias:[{versao:1,volumeAceito:D(100) as Prisma.Decimal|null,situacao:"ACEITE_INFORMADO",motivo:"Aceite informado",destinacaoInformada:null,criadoEm:new Date(),criadoPorId:9}],alocacoes:[] as {quantidade:Prisma.Decimal;valor:Prisma.Decimal}[],comprovantes:[]};
 return{v,entrega,tx:{
  $executeRaw:vi.fn(),$queryRaw:vi.fn(async()=>[{id:id(3)}]),
  versaoComercialVendaLeite:{findFirst:vi.fn(async()=>v)},
  entregaLeite:{findUnique:vi.fn(async()=>null),findFirst:vi.fn(async()=>entrega),findMany:vi.fn(async()=>[{retirada:{produtoId:id(2)}}]),create:vi.fn(async(_args:unknown)=>({id:entrega.id}))},
  conferenciaEntregaLeite:{create:vi.fn(async()=>({versao:2}))},
  demonstrativoLeite:{create:vi.fn(async(_args:unknown)=>({id:id(7),versao:1})),findFirst:vi.fn(async()=>({alocacoes:[{entrega:{retirada}}]})),findUniqueOrThrow:vi.fn(async()=>({id:id(7),versao:1,status:"VALIDO",inicio:new Date("2026-10-01"),fim:new Date("2026-10-19")})),update:vi.fn()},
  alocacaoDemonstrativoLeite:{updateMany:vi.fn()},movimentoEstoque:{create:vi.fn()},transacaoFinanceira:{create:vi.fn()},compromissoFinanceiro:{create:vi.fn()},operacao:{create:vi.fn()},
 }};
}
const conferencia={volumeAceito:null,situacao:"PENDENTE" as const,motivo:"Aceite ainda não informado"};
const entregaInput={chave:id(10),vinculo:{tipo:"VENDA_EXISTENTE" as const,operacaoId:id(3)},referencia:"Comprovante123",...conferencia};
const doc=()=>({chave:id(11),parceiroId:id(4),inicio:"2026-10-01",fim:"2026-10-19",referencia:"Demonstrativo123",precoBase:2.25,volumeReconhecido:40,valorComercial:90,valorPagamentoInformado:80,componentes:[{natureza:"RETENCAO" as const,valor:10,referencia:"Retenção documentada"}],alocacoes:[{entregaId:id(6),versaoEsperadaEntrega:1,versaoVendaId:id(5),quantidadeLitros:40,valor:90}]});
let b:ReturnType<typeof banco>;
beforeEach(()=>{vi.clearAllMocks();b=banco();f.tx=b.tx as unknown as Prisma.TransactionClient;f.transaction.mockImplementation((fn:(tx:Prisma.TransactionClient)=>unknown)=>fn(f.tx));f.vender.mockResolvedValue({id:id(3)});});
describe("entrega e demonstrativo leiteiros",()=>{
 it("nova venda e entrega usam a mesma transação; não fazem segunda baixa",async()=>{
  const input={...entregaInput,vinculo:{tipo:"NOVA_VENDA" as const,venda:{produtoId:id(2),quantidadeLitros:100,data:"2026-10-19",descricao:"Coleta definitiva",parceiroId:id(4),valorTotal:225,financeiro:{condicao:"A_PRAZO" as const,parcelas:[{valor:225,dataVencimento:new Date("2026-10-30")}]}}}};
  await registrarEntregaLeite(input,ctx);expect(f.transaction).toHaveBeenCalledTimes(1);expect(f.vender).toHaveBeenCalledWith(f.tx,{...input.vinculo.venda,chave:input.chave},ctx);expect(b.tx.entregaLeite.create.mock.calls[0][0]).toMatchObject({data:{retiradaId:id(1),conferencias:{create:{volumeAceito:null}}}});expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();
 });
 it("falha de vínculo recusa legado V1 e propaga falha da criação para a transação inteira",async()=>{
  b.tx.versaoComercialVendaLeite.findFirst.mockResolvedValueOnce(null as never);await expect(registrarEntregaLeite(entregaInput,ctx)).rejects.toThrow(/histórico V1/);expect(b.tx.entregaLeite.create).not.toHaveBeenCalled();
  b.tx.entregaLeite.create.mockRejectedValueOnce(new Error("constraint"));await expect(registrarEntregaLeite(entregaInput,ctx)).rejects.toThrow("constraint");expect(f.vender).not.toHaveBeenCalled();
 });
 it("registra parcela documental e retenção sem mexer em estoque/obrigação/caixa",async()=>{
  await registrarDemonstrativoLeiteTx(f.tx,doc(),ctx);expect(b.tx.demonstrativoLeite.create.mock.calls[0][0]).toMatchObject({data:{valorComercial:D(90),valorPagamentoInformado:D(80),componentes:[{natureza:"RETENCAO",valor:10,referencia:"Retenção documentada"}],alocacoes:{create:[{quantidade:D(40),valor:D(90)}]}}});
  expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();expect(b.tx.operacao.create).not.toHaveBeenCalled();expect(b.tx.compromissoFinanceiro.create).not.toHaveBeenCalled();expect(b.tx.transacaoFinanceira.create).not.toHaveBeenCalled();
 });
 it("quantidade já faturada impede dupla alocação antes de criar documento",async()=>{
  b.entrega.alocacoes.push({quantidade:D(80),valor:D(180)});await expect(registrarDemonstrativoLeiteTx(f.tx,doc(),ctx)).rejects.toThrow(/saldo comercial/);expect(b.tx.demonstrativoLeite.create).not.toHaveBeenCalled();
 });
 it("aceite desconhecido precisa de pendência explícita na parcela; não infere100L",async()=>{
  b.entrega.conferencias[0].volumeAceito=null;await expect(registrarDemonstrativoLeiteTx(f.tx,doc(),ctx)).rejects.toThrow(/pendência explícita/);
  const d=doc();await registrarDemonstrativoLeiteTx(f.tx,{...d,alocacoes:d.alocacoes.map(a=>({...a,motivoAceitePendente:"Reconhecidos neste documento, aceite integral da coleta ainda pendente"}))},ctx);expect(b.entrega.conferencias[0].volumeAceito).toBeNull();
 });
 it("comprador, sítio, período e versões precisam conferir",async()=>{
  await expect(registrarDemonstrativoLeiteTx(f.tx,{...doc(),parceiroId:id(30)},ctx)).rejects.toThrow(/Comprador/);
  b.entrega.conferencias[0].versao=2;await expect(registrarDemonstrativoLeiteTx(f.tx,doc(),ctx)).rejects.toThrow(/mudou/);
  expect(b.tx.demonstrativoLeite.create).not.toHaveBeenCalled();
 });
 it("conferência é append-only e bloqueia documentos ativos",async()=>{
  await conferirEntregaLeite(id(6),{...conferencia,chave:id(12),versaoEsperada:1},ctx);expect(b.tx.conferenciaEntregaLeite.create).toHaveBeenCalledTimes(1);expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  b.entrega.alocacoes.push({quantidade:D(20),valor:D(45)});await expect(conferirEntregaLeite(id(6),{...conferencia,chave:id(13),versaoEsperada:1},ctx)).rejects.toThrow(/Anule os demonstrativos/);
 });
 it("anulação libera parcelas conservando documento e sem desfazer retirada/caixa",async()=>{
  await anularDemonstrativoLeite(id(7),{chave:id(14),versaoEsperada:1,motivo:"Documento substituído pelo comprador"},ctx);expect(b.tx.alocacaoDemonstrativoLeite.updateMany).toHaveBeenCalledWith({where:{demonstrativoId:id(7),ativo:true},data:{ativo:false}});expect(b.tx.demonstrativoLeite.update).toHaveBeenCalled();expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();expect(b.tx.transacaoFinanceira.create).not.toHaveBeenCalled();
 });
 it("DTO operacional mascara dinheiro mesmo com fontes comerciais carregadas",()=>{
  const dto=entregaLeiteDTO(b.entrega as never,false);expect(dto.valorDisponivel).toBeNull();expect(dto.valorFaturado).toBeNull();expect(dto.quantidadeDisponivel).toBe("100");expect(dto).not.toHaveProperty("componentes");
 });
});
