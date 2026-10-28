import { publicarNecessidadeTx } from "../alertas/produtor.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../../lib/banco-pecuaria-integration.fixture.js";
import { avaliarProgramacaoTx } from "./produtor.js";
import { consultarProgramacoes } from "./consulta.js";
import { consultaProgramacoesSchema } from "./schemas.js";
import { consultarAgendaUnificada, consultaAgendaUnificadaSchema } from "./agenda.js";
import { criarAplicacao, anularAplicacao } from "../aplicacoes.js";
import { hojeFazendaDate } from "../../rebanho/regras.js";
import { previaRevisaoProgramacao, revisarProgramacao } from "./gestao.js";
const executar = process.env.PECUARIA_DB_INTEGRATION === "1";
const marca = `programa-fixture-${randomUUID()}`;
let sitio: number | undefined, usuario: number | undefined, produto: string | undefined, tipo: string | undefined, programa: string | undefined;
let protocolo:string|undefined,participacao:string|undefined,regra:string|undefined,necessidadeRegra:string|undefined;
const animais: string[] = [], alertas: string[] = [], necessidades: string[] = [];
const hoje=hojeFazendaDate();
/** Só cria/remove IDs próprios. Sem reset, seed, migration ou consulta de dados pessoais. */
describe.skipIf(!executar)("programações — SQL com fixtures próprias", () => {
  beforeAll(async () => {
    const banco=exigirBancoIntegracaoPecuaria();
    if (process.env.DIRECT_URL) { const url=new URL(process.env.DIRECT_URL); if(url.pathname!==`/${banco}`||!["localhost","127.0.0.1","[::1]"].includes(url.hostname)) throw new Error("DIRECT_URL fora da base autorizada"); }
    const atual=await prisma.$queryRaw<{banco:string}[]>`SELECT current_database()::text banco`; if(atual[0]?.banco!==banco) throw new Error("Banco efetivo fora do autorizado");
    sitio=(await prisma.propriedade.create({data:{nome:marca}})).id;
    usuario=(await prisma.usuario.create({data:{nome:marca,email:`${marca}@example.test`,papel:"DONO",abas:["cadastros"],areas:["pecuaria"],flags:["lancar","exportar"],dono:true,status:"ATIVO"}})).id;
    produto=(await prisma.produto.create({data:{nome:marca,usoSanitario:true,unidade:"ML"}})).id;
    tipo=(await prisma.tipoAplicacaoSanitaria.create({data:{nome:marca}})).id;
    const inicio=new Date(Date.UTC(hoje.getUTCFullYear(),hoje.getUTCMonth(),1));
    programa=(await prisma.programacaoSanitaria.create({data:{propriedadeId:sitio,nome:marca,tipo:"VACINACAO",meses:[hoje.getUTCMonth()+1],precisao:"MES",recorrencia:"CAMPANHA_ANUAL",produtoId:produto,publico:{},publicoConferido:true,executor:"APLICACAO",sujeitoTipo:"ANIMAL",ativo:true,ativadoEm:inicio,vigenciaInicio:inicio,criadoPorId:usuario}})).id;
    for(let i=0;i<2;i++) { const a=await prisma.animal.create({data:{brinco:`${marca}-${i}`,sexo:"F",origem:"COMPRADO",dataNascimento:new Date("2024-01-01Z"),dataEntrada:new Date("2025-01-01Z")}});animais.push(a.id);await prisma.localizacaoAnimal.create({data:{animalId:a.id,propriedadeId:sitio,desde:new Date("2025-01-01Z")}}); }
  },30000);
  afterAll(async () => {
    if(!sitio)return;
    if(programa) { const ns=await prisma.necessidadeProgramacaoSanitaria.findMany({where:{programacaoId:programa},select:{id:true,alertaId:true}});necessidades.push(...ns.map(n=>n.id));alertas.push(...ns.flatMap(n=>n.alertaId?[n.alertaId]:[])); }
    await prisma.vinculoAtendimentoAlerta.deleteMany({where:{necessidadeProgramaId:{in:necessidades}}});
    await prisma.eventoAlerta.deleteMany({where:{alertaId:{in:alertas}}});
    if(necessidadeRegra)await prisma.necessidadeSanitaria.deleteMany({where:{id:necessidadeRegra}});
    if(participacao)await prisma.tarefaProtocolo.deleteMany({where:{execucaoId:participacao}});
    if(participacao)await prisma.participacaoProtocolo.delete({where:{id:participacao}});
    if(regra)await prisma.regraAlertaSanitario.delete({where:{id:regra}});
    if(protocolo)await prisma.protocolo.delete({where:{id:protocolo}});
    await prisma.necessidadeProgramacaoSanitaria.deleteMany({where:{id:{in:necessidades}}});
    await prisma.alerta.deleteMany({where:{id:{in:alertas}}});
    await prisma.requisicaoPecuaria.deleteMany({where:{propriedadeId:sitio}});
    await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{animalId:{in:animais}},{entidadeId:{in:[...necessidades,...(programa?[programa]:[])]}}]}});
    await prisma.aplicacaoProduto.deleteMany({where:{animalId:{in:animais}}});
    await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
    await prisma.animal.deleteMany({where:{id:{in:animais}}});
    if(programa)await prisma.programacaoSanitaria.delete({where:{id:programa}});
    if(produto)await prisma.produto.delete({where:{id:produto}});
    if(tipo)await prisma.tipoAplicacaoSanitaria.delete({where:{id:tipo}});
    await prisma.propriedade.delete({where:{id:sitio}});
    if(usuario)await prisma.usuario.delete({where:{id:usuario}});
  },30000);
  it("replay, precisão mensal, aplicação parcial, anulação e revisão conservam identidade", async () => {
    await prisma.$transaction(tx=>avaliarProgramacaoTx(tx,programa!,hoje,{usuarioId:usuario!}));
    await prisma.$transaction(tx=>avaliarProgramacaoTx(tx,programa!,hoje,{usuarioId:usuario!}));
    expect(await prisma.necessidadeProgramacaoSanitaria.count({where:{programacaoId:programa}})).toBe(2);
    const anual=await consultarProgramacoes(consultaProgramacoesSchema.parse({ano:hoje.getUTCFullYear(),tamanho:1}),sitio!);
    const mensal=await consultarProgramacoes(consultaProgramacoesSchema.parse({ano:hoje.getUTCFullYear(),mes:hoje.getUTCMonth()+1}),sitio!);
    expect(anual.meses).toHaveLength(12);expect(anual.itens[0].id).toBe(mensal.itens[0].id);expect(anual.itens[0]).toMatchObject({dia:null,previstos:2,atendidos:0,pendentes:2});
    const agenda=await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse({tamanho:1}),sitio!);expect(agenda.total).toBe(2);expect(agenda.itens).toHaveLength(1);expect(agenda.itens[0]).toMatchObject({origem:"ALERTA",precisao:"MES",dataReferencia:null});
    // Um alerta programado por protocolo cede sua linha à tarefa, mantendo a ligação.
    const pr=await prisma.protocolo.create({data:{nome:marca,tipo:"SANITARIO",publicado:false}});protocolo=pr.id;
    const etapa=await prisma.etapaProtocolo.create({data:{protocoloId:pr.id,ordem:1,diaRelativo:0,tipo:"MANEJO",nome:"Conferência fictícia"}});
    await prisma.protocolo.update({where:{id:pr.id},data:{publicado:true,publicadoEm:new Date()}});
    const pa=await prisma.participacaoProtocolo.create({data:{protocoloId:pr.id,animalId:animais[0],propriedadeId:sitio!,inicio:hoje}});participacao=pa.id;
    await prisma.tarefaProtocolo.create({data:{execucaoId:pa.id,etapaId:etapa.id,previstaPara:hoje}});
    const r=await prisma.regraAlertaSanitario.create({data:{nome:marca,protocoloId:pr.id,gatilho:"DATA_FIXA",dataFixa:hoje,vigencia:hoje,adocao:hoje,ativo:true,propriedadeIds:[sitio!],criadoPorId:usuario!}});regra=r.id;
    const nr=await prisma.necessidadeSanitaria.create({data:{regraId:r.id,animalId:animais[0],propriedadeId:sitio!,revisaoRegra:1,situacao:"PROGRAMADO",dataTeorica:hoje,dataAtencao:hoje,adocao:hoje,participacaoId:pa.id}});necessidadeRegra=nr.id;
    const ar=await prisma.$transaction(tx=>publicarNecessidadeTx(tx,nr.id,{usuarioId:usuario!}));alertas.push(ar.alertaId);
    const unificada=await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse({tamanho:100}),sitio!);
    expect(unificada.total).toBe(3);expect(unificada.itens.filter(i=>i.alertaId===ar.alertaId)).toHaveLength(1);expect(unificada.itens.find(i=>i.alertaId===ar.alertaId)?.origem).toBe("TAREFA");
    const n=await prisma.necessidadeProgramacaoSanitaria.findFirstOrThrow({where:{programacaoId:programa,sujeitoId:animais[0]}});
    const input={chave:randomUUID(),animalId:animais[0],propriedadeId:sitio!,data:hoje.toISOString().slice(0,10),produtoId:produto!,nomeProdutoAplicado:marca,tipoAplicacaoId:tipo!,dose:"1",unidadeDose:"ML" as const,origemInsumo:"SEM_ORIGEM_JUSTIFICADA" as const,justificativaSemOrigem:"Fixture isolada sem operação real",alertaId:n.alertaId!,alertaRevisao:1,confirmarCuidadoAlerta:true};
    const fato=await criarAplicacao(input,usuario!);expect((await criarAplicacao(input,usuario!)).id).toBe(fato.id);
    expect((await consultarProgramacoes(consultaProgramacoesSchema.parse({ano:hoje.getUTCFullYear()}),sitio!)).itens[0]).toMatchObject({atendidos:1,pendentes:1});
    await anularAplicacao(fato.id,sitio!,"Anulação de fixture conferida",usuario!,"DEVOLVER_ESTOQUE");
    expect(await prisma.necessidadeProgramacaoSanitaria.findUnique({where:{id:n.id}})).toMatchObject({aplicacaoId:fato.id,situacao:"NECESSITA_REVISAO"});
    const previa=await previaRevisaoProgramacao(programa!,sitio!);
    await revisarProgramacao(programa!,sitio!,{revisao:previa.revisao,chavePrevia:previa.chavePrevia,motivo:"Inativação isolada de fixture",destinoAbertas:"MANTER"},usuario!);
    await expect(revisarProgramacao(programa!,sitio!,{revisao:previa.revisao,chavePrevia:previa.chavePrevia,motivo:"Prévia antiga não reutilizável",destinoAbertas:"ENCERRAR"},usuario!)).rejects.toMatchObject({code:"CONFLITO"});
    const previaEncerramento=await previaRevisaoProgramacao(programa!,sitio!);
    await revisarProgramacao(programa!,sitio!,{revisao:previaEncerramento.revisao,chavePrevia:previaEncerramento.chavePrevia,motivo:"Encerramento isolado das necessidades da fixture",destinoAbertas:"ENCERRAR"},usuario!);
    expect((await consultarProgramacoes(consultaProgramacoesSchema.parse({ano:hoje.getUTCFullYear()}),sitio!)).itens[0]).toMatchObject({previstos:2,atendidos:0,pendentes:0});
  },30000);
});
