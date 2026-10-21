import { criarEntradaValorizadaFixture, limparMovimentosValorizadosFixture } from "../../../test/estoque-valorizado.fixture.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import * as iatf from "./iatf.js";
import { criarVisita, adicionarAtividade, confirmarAtividade, sugestoesVisita, imprimirVisita } from "./visitas.js";
import { atividadeSchema, confirmacaoVisitaSchema, programacaoSchema } from "./schemas.js";
import { carenciaAnimal, criarAplicacao, reconciliarOrigem } from "../sanidade/aplicacoes.js";
const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const token = randomUUID().slice(0,8), animais:string[]=[], protocolos:string[]=[], visitas:string[]=[], produtos:string[]=[];
let sitio:number, materialId:string, tipoId:string, genitorId:string, programaId:string, participanteId:string;
const data="2026-09-15", chave=()=>randomUUID();
// Toda preparação e remoção está limitada aos IDs exclusivos desta suíte.
comBanco("IATF data/hora independentes no banco de desenvolvimento", () => {
  beforeAll(async()=>{
    sitio=(await prisma.propriedade.create({data:{nome:`Hora opcional ${token}`}})).id;
    tipoId=(await prisma.tipoAplicacaoSanitaria.create({data:{nome:`Hora opcional ${token}`}})).id;
    genitorId=(await prisma.genitorExterno.create({data:{nome:`Genitor ${token}`,sexo:"M"}})).id;
    for(const uso of ["sanitario","genetico"]) {
      const p=await prisma.produto.create({data:{nome:`Hora ${uso} ${token}`,unidade:uso==="sanitario"?"ML":"DOSE",usoSanitario:uso==="sanitario",usoGenetico:uso==="genetico"}});produtos.push(p.id);
      await criarEntradaValorizadaFixture({data:{produtoId:p.id,propriedadeId:sitio,data:new Date("2026-09-01"),tipo:"ENTRADA",origem:"INVENTARIO_INICIAL",quantidade:100,custoUnitario:1,valorTotal:100}});
    }
    materialId=(await prisma.materialGenetico.create({data:{tipo:"SEMEN",produtoId:produtos[1],touroExternoId:genitorId}})).id;
  });
  async function criarAnimal(){const a=await prisma.animal.create({data:{brinco:`HO${animais.length}${token}`,sexo:"F",origem:"COMPRADO",dataNascimento:new Date("2024-01-01"),dataEntrada:new Date("2026-08-01"),localizacoes:{create:{propriedadeId:sitio,desde:new Date("2026-08-01")}},destinos:{create:{aptidao:"LEITE",desde:new Date("2026-08-01")}}}});animais.push(a.id);return a.id;}
  async function criar(inicio=data,horas=false){
    const animalId=await criarAnimal();
    const p=await iatf.criarProtocolo({nome:`Horário ${protocolos.length} ${token}`,versao:1,publicado:true,etapas:[
      {nome:"Manejo",tipo:"MANEJO",intervalo:horas?36:0,unidade:horas?"HORAS":"DIAS"},
      {nome:"Aplicação",tipo:"APLICACAO",intervalo:0,unidade:"DIAS",planoAplicacao:{produtoId:produtos[0],dose:"2",unidadeDose:"ML"}},
      {nome:"IA",tipo:"TENTATIVA",intervalo:10,unidade:"DIAS",planoTentativa:{tipo:"IA",materialId,quantidade:1}},
      {nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS"},
    ]},null);protocolos.push(p.id);
    const programa=await iatf.criarProgramacao(programacaoSchema.parse({chave:chave(),propriedadeId:sitio,protocoloId:p.id,nome:`Rodada ${token}`,inicioPrevisto:inicio,animais:[{animalId}]}),null);
    const participante=await prisma.participanteIatf.findFirstOrThrow({where:{programacaoId:programa.id,animalId}});
    return {animalId,programa,participante};
  }
  it("planeja, inicia, aplica e insemina sem horário, mantendo estoque e carência conservadora",async()=>{
    const c=await criar();programaId=c.programa.id;participanteId=c.participante.id;
    expect(c.programa.precisaoTemporal).toBe("DIA");
    expect(await iatf.iniciarParticipante(participanteId,sitio,data,null)).toMatchObject({precisaoInicioEfetivo:"DIA",inicioEfetivo:new Date(data)});
    const tarefas=await prisma.tarefaIatf.findMany({where:{participanteId},orderBy:{etapa:"asc"}});
    expect(tarefas[2]).toMatchObject({precisaoTemporal:"DIA",previstaEm:new Date("2026-09-25")});
    const input={chave:chave(),propriedadeId:sitio,realizadaEm:data,dados:{tipoAplicacaoId:tipoId,produtoId:produtos[0],origemInsumo:"BAIXA_ESTOQUE",nomeProdutoAplicado:"Produto",dose:"2",unidadeDose:"ML",estadoCarenciaLeite:"INFORMADO",estadoCarenciaCarne:"INFORMADO",carenciaLeiteHoras:24,carenciaCarneHoras:48}};
    const exec=await iatf.executarTarefa(tarefas[1].id,input,null);
    expect(exec).toMatchObject({precisaoRealizacao:"DIA",realizadaEm:new Date(data)});
    expect(JSON.parse(JSON.stringify(exec))).toEqual(await iatf.executarTarefa(tarefas[1].id,input,null));
    const aplicacao=await prisma.aplicacaoProduto.findUniqueOrThrow({where:{id:exec.aplicacaoId!}});
    expect(aplicacao).toMatchObject({data:new Date(data),aplicadaEm:null,precisaoTemporal:"DIA"});
    expect(await prisma.movimentoEstoque.count({where:{propriedadeId:sitio,produtoId:produtos[0],tipo:"SAIDA"}})).toBe(1);
    expect(await carenciaAnimal(c.animalId,sitio)).toMatchObject({leite:{precisaoAproximada:true}});
    const ia=await iatf.executarTarefa(tarefas[2].id,{chave:chave(),propriedadeId:sitio,realizadaEm:"2026-09-25",dados:{tipo:"IA",materialId,origem:"ESTOQUE",quantidade:1}},null);
    expect(ia.precisaoRealizacao).toBe("DIA");
    expect(await prisma.tentativaReprodutiva.findUniqueOrThrow({where:{id:ia.tentativaId!}})).toMatchObject({data:new Date("2026-09-25"),materialId});
  });
  it("reconcilia origem sem exigir uma hora que a fazenda não conhece", async()=>{
    const animalId=await criarAnimal();
    const a=await criarAplicacao({animalId,propriedadeId:sitio,data,tipoAplicacaoId:tipoId,origemInsumo:"SEM_ORIGEM_JUSTIFICADA",nomeProdutoAplicado:`Hora sanitario ${token}`,dose:"1",unidadeDose:"ML",justificativaSemOrigem:"Origem em conferência com a equipe"},null);
    const r=await reconciliarOrigem(a.id,sitio,{origemInsumo:"BAIXA_ESTOQUE",produtoId:produtos[0],motivo:"Origem conferida no estoque",confirmarEquivalencia:true},null);
    expect(r).toMatchObject({aplicadaEm:null,precisaoTemporal:"DIA",data:new Date(data),origemInsumo:"BAIXA_ESTOQUE"});
    expect(r.movimentoEstoqueId).not.toBeNull();
  });
  it("registra horário conhecido após início sem hora e reagenda data mantendo previsão original",async()=>{
    const t=await prisma.tarefaIatf.findMany({where:{participanteId},orderBy:{etapa:"asc"}});
    const r=await iatf.executarTarefa(t[0].id,{chave:chave(),propriedadeId:sitio,realizadaEm:`${data}T14:00:00Z`,dados:{}},null);
    expect(r.precisaoRealizacao).toBe("HORA");expect(r.desviosSnapshot).toMatchObject({horarioAferido:false,diferencas:[]});
    const reagendada=await iatf.reprogramarTarefa(t[3].id,sitio,"2026-09-23","Revisado pela equipe",null);
    expect(reagendada).toMatchObject({precisaoTemporal:"DIA",previstaEm:new Date("2026-09-23"),previsaoOriginal:new Date("2026-09-22")});
  });
  it("aceita execução sem hora no dia do início conhecido, mas rejeita datas anteriores e hora conhecida anterior",async()=>{
    const c=await criar(`${data}T15:00:00Z`);await iatf.iniciarParticipante(c.participante.id,sitio,`${data}T15:00:00Z`,null);
    const t=await prisma.tarefaIatf.findFirstOrThrow({where:{participanteId:c.participante.id,etapa:0}});
    for(const realizadaEm of ["2026-09-14",`${data}T14:00:00Z`]) await expect(iatf.executarTarefa(t.id,{chave:chave(),propriedadeId:sitio,realizadaEm,dados:{}},null)).rejects.toMatchObject({code:"VALIDACAO"});
    const r=await iatf.executarTarefa(t.id,{chave:chave(),propriedadeId:sitio,realizadaEm:data,dados:{}},null);
    expect(r).toMatchObject({precisaoTemporal:"HORA",precisaoRealizacao:"DIA"});expect(r.desviosSnapshot).toMatchObject({horarioAferido:false,diferencas:[]});
  });
  it("etapa em horas sem referência fica pendente até previsão explícita e permite confirmação pela visita",async()=>{
    const c=await criar(data,true);
    await iatf.iniciarParticipante(c.participante.id,sitio,data,null);
    const t=await prisma.tarefaIatf.findFirstOrThrow({where:{participanteId:c.participante.id,etapa:0}});
    expect(t).toMatchObject({previsaoPendente:true,precisaoTemporal:"DIA"});
    expect((await sugestoesVisita(sitio,"2026-09-20")).retornos.find(p=>p.origemId===t.id)).toMatchObject({status:"PREVISAO_PENDENTE"});
    await iatf.reprogramarTarefa(t.id,sitio,"2026-09-17","Previsão definida pela equipe",null);
    const v=await criarVisita({propriedadeId:sitio,nome:`Visita ${token}`,data:"2026-09-17"},null);visitas.push(v.id);
    const a=await adicionarAtividade(v.id,atividadeSchema.parse({propriedadeId:sitio,tipo:"TAREFA_IATF",nome:"Atendimento",participantes:[{animalId:c.animalId,tarefaIatfId:t.id}]}),null);
    const imp=await imprimirVisita(v.id,sitio,null);
    const input=confirmacaoVisitaSchema.parse({propriedadeId:sitio,chave:chave(),itens:[{participanteId:a.participantes[0].id,dados:{realizadaEm:"2026-09-17",dados:{}}}]});
    await confirmarAtividade(v.id,a.id,input,null);
    expect(await prisma.tarefaIatf.findUniqueOrThrow({where:{id:t.id}})).toMatchObject({previsaoPendente:false,precisaoRealizacao:"DIA",realizadaEm:new Date("2026-09-17")});
    expect((await prisma.impressaoVisita.findUniqueOrThrow({where:{id:imp.id}})).snapshot).toEqual(imp.snapshot);
  });
  afterAll(async()=>{
    if(!sitio)return;
    await prisma.requisicaoPecuaria.deleteMany({where:{propriedadeId:sitio}});
    await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{propriedadeId:sitio},{animalId:{in:animais}},{entidadeId:{in:protocolos}}]}});
    await prisma.participanteVisita.deleteMany({where:{animalId:{in:animais}}});
    await prisma.impressaoVisita.deleteMany({where:{visitaId:{in:visitas}}});
    await prisma.atividadeVisita.deleteMany({where:{visitaId:{in:visitas}}});
    await prisma.visitaVeterinaria.deleteMany({where:{id:{in:visitas}}});
    await prisma.vinculoTarefaProtocolo.deleteMany({where:{tarefa:{execucao:{animalId:{in:animais}}}}});
    await prisma.aplicacaoProduto.deleteMany({where:{animalId:{in:animais}}});
    await prisma.tentativaReprodutiva.deleteMany({where:{animalId:{in:animais}}});
    await prisma.tarefaProtocolo.deleteMany({where:{execucao:{animalId:{in:animais}}}});
    await prisma.participacaoProtocolo.deleteMany({where:{animalId:{in:animais}}});
    await prisma.programacaoProtocolo.deleteMany({where:{propriedadeId:sitio}});
    await prisma.etapaProtocolo.deleteMany({where:{protocoloId:{in:protocolos}}});
    await prisma.protocolo.deleteMany({where:{id:{in:protocolos}}});
    await prisma.materialGenetico.deleteMany({where:{produtoId:{in:produtos}}});
    if(genitorId)await prisma.genitorExterno.delete({where:{id:genitorId}});
    await limparMovimentosValorizadosFixture(produtos);
    await prisma.produto.deleteMany({where:{id:{in:produtos}}});
    if(tipoId)await prisma.tipoAplicacaoSanitaria.delete({where:{id:tipoId}});
    await prisma.finalidadeAnimal.deleteMany({where:{animalId:{in:animais}}});
    await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
    await prisma.animal.deleteMany({where:{id:{in:animais}}});
    await prisma.propriedade.delete({where:{id:sitio}});
  });
});
