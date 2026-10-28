import crypto from "node:crypto";
import {afterAll,describe,expect,it} from "vitest";
import {prisma} from "../../../../db.js";
import {exigirBancoIntegracaoPecuaria} from "../../../../lib/banco-pecuaria-integration.fixture.js";
import {movimentar,desfazerMovimentacao,darBaixa,estornarBaixa} from "../../rebanho/animais.js";
import {criarAplicacao,anularAplicacao} from "../aplicacoes.js";
import {decidirNecessidade} from "./decisoes.js";
import {publicarNecessidadeTx} from "./produtor.js";
import {transacaoPecuaria} from "../../transacao.js";
import {hojeFazendaDate} from "../../rebanho/regras.js";
const habilitado=process.env.PECUARIA_DB_INTEGRATION==='1';
const suite=habilitado?describe:describe.skip;
const run=crypto.randomUUID();
const animais:string[]=[],regras:string[]=[],alertas:string[]=[],necessidades:string[]=[];
const movimentos:string[]=[];let sitioDestino:number|undefined;
let sitio:number|undefined,usuario:number|undefined,produto:string|undefined,tipo:string|undefined;
afterAll(async()=>{
 if(!sitio)return;
 // Hooks de entrada/transferência podem criar outras necessidades das próprias regras.
 const criadasPelasRegras = await prisma.necessidadeSanitaria.findMany({where:{regraId:{in:regras}},select:{id:true,alertaId:true}});
 for(const n of criadasPelasRegras){if(!necessidades.includes(n.id))necessidades.push(n.id);if(n.alertaId&&!alertas.includes(n.alertaId))alertas.push(n.alertaId)}
 await prisma.vinculoAtendimentoAlerta.deleteMany({where:{necessidadeRegraId:{in:necessidades}}});
 await prisma.eventoAlerta.deleteMany({where:{alertaId:{in:alertas}}});
 await prisma.necessidadeSanitaria.deleteMany({where:{id:{in:necessidades}}});
 await prisma.alerta.deleteMany({where:{id:{in:alertas}}});
 await prisma.revisaoRegraAlertaSanitario.deleteMany({where:{regraId:{in:regras}}});
 await prisma.regraAlertaSanitario.deleteMany({where:{id:{in:regras}}});
 await prisma.requisicaoPecuaria.deleteMany({where:{propriedadeId:sitio}});
 await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{animalId:{in:animais}},{entidadeId:{in:necessidades}}]}});
 await prisma.aplicacaoProduto.deleteMany({where:{animalId:{in:animais}}});
 await prisma.baixaAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.movimentacaoAnimal.deleteMany({where:{movimentacaoId:{in:movimentos}}});
 await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.auditoriaPecuaria.deleteMany({where:{entidadeId:{in:movimentos}}});
 await prisma.movimentacao.deleteMany({where:{id:{in:movimentos}}});
 await prisma.animal.deleteMany({where:{id:{in:animais}}});
 if(produto)await prisma.produto.delete({where:{id:produto}});
 if(tipo)await prisma.tipoAplicacaoSanitaria.delete({where:{id:tipo}});
 if(sitioDestino)await prisma.propriedade.delete({where:{id:sitioDestino}});
 await prisma.propriedade.delete({where:{id:sitio}});
 if(usuario)await prisma.usuario.delete({where:{id:usuario}});
});
async function regra(animalId:string){
 const hoje=hojeFazendaDate();
 const r=await prisma.regraAlertaSanitario.create({data:{nome:`Regra fictícia ${run} ${regras.length}`,gatilho:'DATA_FIXA',dataFixa:hoje,vigencia:hoje,adocao:hoje,ativo:true,produtoId:produto,tipoAplicacaoId:tipo,cuidado:'Primeira aplicação fictícia',propriedadeIds:[sitio!],criadoPorId:usuario!}});regras.push(r.id);
 const n=await prisma.necessidadeSanitaria.create({data:{regraId:r.id,animalId,propriedadeId:sitio!,revisaoRegra:1,situacao:'PENDENTE',dataTeorica:hoje,dataAtencao:hoje,adocao:hoje}});necessidades.push(n.id);
 const publicado=await transacaoPecuaria(tx=>publicarNecessidadeTx(tx,n.id,{usuarioId:usuario!}));alertas.push(publicado.alertaId);
 return {...n,alertaId:publicado.alertaId};
}
suite('aplicação e decisão vinculadas com fixtures próprias',()=>{
 it('reenvio não duplica; anulação mantém vínculo e reabre para revisão; o fato anulado não atende outra regra',async()=>{
  // Só o CI externo admite sua base efêmera; CI genérico não libera outra base local.
  const bancoEsperado=exigirBancoIntegracaoPecuaria();
  for(const valor of [process.env.DATABASE_URL,process.env.DIRECT_URL].filter((v):v is string=>!!v)){
    const url=new URL(valor);
    if(url.pathname!==`/${bancoEsperado}`||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error(`Integração exige PostgreSQL ${bancoEsperado} neste ambiente`);
  }
  const atual=await prisma.$queryRaw<Array<{banco:string}>>`SELECT current_database()::text AS banco`;
  if(atual[0]?.banco!==bancoEsperado)throw new Error('Conexão efetiva fora da base autorizada');
  sitio=(await prisma.propriedade.create({data:{nome:`Alerta teste ${run}`}})).id;
  usuario=(await prisma.usuario.create({data:{nome:`Operador ${run}`,email:`alerta-${run}@example.test`,papel:'DONO',abas:[],flags:[],dono:true,status:'ATIVO'}})).id;
  tipo=(await prisma.tipoAplicacaoSanitaria.create({data:{nome:`Tipo fictício ${run}`}})).id;
  produto=(await prisma.produto.create({data:{nome:`Produto fictício ${run}`,usoSanitario:true,unidade:'ML'}})).id;
  const a=await prisma.animal.create({data:{brinco:`AT-${run}`,sexo:'F',origem:'COMPRADO',dataNascimento:new Date('2024-01-01'),dataEntrada:new Date('2025-01-01')}});animais.push(a.id);
  await prisma.localizacaoAnimal.create({data:{animalId:a.id,propriedadeId:sitio,desde:new Date('2025-01-01')}});
  const primeira=await regra(a.id),segunda=await regra(a.id);
  const input={chave:crypto.randomUUID(),animalId:a.id,propriedadeId:sitio,data:hojeFazendaDate().toISOString().slice(0,10),produtoId:produto,nomeProdutoAplicado:`Produto fictício ${run}`,tipoAplicacaoId:tipo,dose:'1',unidadeDose:'ML' as const,origemInsumo:'SEM_ORIGEM_JUSTIFICADA' as const,justificativaSemOrigem:'Documentação sanitária de fixture isolada',alertaId:primeira.alertaId,alertaRevisao:1,confirmarCuidadoAlerta:true};
  await expect(criarAplicacao({...input,chave:crypto.randomUUID(),alertaRevisao:99},usuario)).rejects.toMatchObject({code:'CONFLITO'});
  expect(await prisma.aplicacaoProduto.count({where:{animalId:a.id}})).toBe(0);
  expect(await prisma.vinculoAtendimentoAlerta.count({where:{necessidadeRegraId:primeira.id}})).toBe(0);
  const fato=await criarAplicacao(input,usuario);
  expect((await criarAplicacao(input,usuario)).id).toBe(fato.id);
  expect(await prisma.aplicacaoProduto.count({where:{animalId:a.id}})).toBe(1);
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:primeira.id}})).toMatchObject({situacao:'REALIZADO',aplicacaoId:fato.id});
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:segunda.id}})).toMatchObject({situacao:'PENDENTE'});
  await expect(decidirNecessidade({chave:crypto.randomUUID(),animalId:a.id,propriedadeId:sitio,alertaId:segunda.alertaId,revisao:1,acao:'VINCULAR_APLICACAO',aplicacaoId:fato.id,propriedadeAplicacaoId:sitio,confirmarCompatibilidade:true,motivo:'Mesmo fato não deve atender outra regra'},usuario)).rejects.toBeDefined();
  await anularAplicacao(fato.id,sitio,'Registro de fixture anulado',usuario,'DEVOLVER_ESTOQUE');
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:primeira.id}})).toMatchObject({situacao:'NECESSITA_REVISAO',aplicacaoId:fato.id});
  expect(await prisma.alerta.findUnique({where:{id:primeira.alertaId}})).toMatchObject({ciclo:'ABERTO',situacao:'NECESSITA_REVISAO'});
  await expect(decidirNecessidade({chave:crypto.randomUUID(),animalId:a.id,propriedadeId:sitio,alertaId:segunda.alertaId,revisao:1,acao:'VINCULAR_APLICACAO',aplicacaoId:fato.id,propriedadeAplicacaoId:sitio,confirmarCompatibilidade:true,motivo:'Aplicação anulada não é evidência válida'},usuario)).rejects.toMatchObject({code:'CONFLITO'});
  const terceira=await regra(a.id);
  const anterior=await criarAplicacao({...input,chave:crypto.randomUUID(),alertaId:undefined,alertaRevisao:undefined,confirmarCuidadoAlerta:undefined},usuario);
  const corrida=await Promise.allSettled([
    decidirNecessidade({chave:crypto.randomUUID(),animalId:a.id,propriedadeId:sitio,alertaId:terceira.alertaId,revisao:1,acao:'VINCULAR_APLICACAO',aplicacaoId:anterior.id,propriedadeAplicacaoId:sitio,confirmarCompatibilidade:true,motivo:'Cuidado e aplicação anterior conferidos'},usuario),
    anularAplicacao(anterior.id,sitio,'Anulação concorrente da evidência',usuario,'DEVOLVER_ESTOQUE'),
  ]);
  expect(corrida[1].status).toBe('fulfilled');
  const aposCorrida=await prisma.necessidadeSanitaria.findUniqueOrThrow({where:{id:terceira.id}});
  expect(aposCorrida.situacao).not.toBe('REALIZADO');
  expect((await prisma.aplicacaoProduto.findUniqueOrThrow({where:{id:anterior.id}})).status).toBe('ANULADO');
  sitioDestino=(await prisma.propriedade.create({data:{nome:`Destino alerta teste ${run}`}})).id;
  const movel=await prisma.animal.create({data:{brinco:`AM-${run}`,sexo:'F',origem:'COMPRADO',dataNascimento:new Date('2024-01-01'),dataEntrada:new Date('2025-01-01')}});animais.push(movel.id);
  await prisma.localizacaoAnimal.create({data:{animalId:movel.id,propriedadeId:sitio,desde:new Date('2025-01-01')}});
  const continua=await regra(movel.id);
  await prisma.regraAlertaSanitario.update({where:{id:continua.regraId},data:{propriedadeIds:[sitio,sitioDestino]}});
  const movimento=await movimentar({animalIds:[movel.id],propriedadeId:sitioDestino,data:input.data,motivo:'Transferência entre sítios da fixture'},usuario,sitio);
  movimentos.push(movimento.movimentacaoId);
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:continua.id}})).toMatchObject({id:continua.id,propriedadeId:sitioDestino});
  await desfazerMovimentacao(movimento.movimentacaoId,'Desfazer movimento de fixture',usuario,sitioDestino);
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:continua.id}})).toMatchObject({id:continua.id,propriedadeId:sitio});
  await darBaixa({animalId:movel.id,data:input.data,tipo:'EXTRAVIO'},usuario,sitio);
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:continua.id}})).toMatchObject({id:continua.id,situacao:'ENCERRADO'});
  await estornarBaixa(movel.id,{motivo:'Estorno de baixa de fixture'},usuario,sitio);
  expect(await prisma.necessidadeSanitaria.findUnique({where:{id:continua.id}})).toMatchObject({id:continua.id,situacao:'NECESSITA_REVISAO'});
 },30_000);
});
