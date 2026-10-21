import { beforeEach, describe, expect, it, vi } from "vitest";
const banco=vi.hoisted(()=>({tx:{
  tentativaReprodutiva:{findFirst:vi.fn()},interpretacaoReprodutiva:{findFirst:vi.fn()},exameAnimal:{findFirst:vi.fn()},aplicacaoProduto:{findFirst:vi.fn()},programacaoProtocolo:{findFirst:vi.fn()},participacaoProtocolo:{count:vi.fn(),findMany:vi.fn()},tarefaProtocolo:{findMany:vi.fn()},$queryRaw:vi.fn(),
}}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:(executar:(tx:typeof banco.tx)=>unknown)=>executar(banco.tx)}}));
import { listarTarefasOperacao, listarParticipantesOperacao, obterCabecalhoOperacao, listarVinculosColetivosOperacao, listarOrigensFatoOperacao } from "./operacao.js";
import { consultaOperacaoSchema, consultaVinculosColetivosOperacaoSchema, consultaOrigensFatoOperacaoSchema } from "./operacao.schemas.js";
const id="00000000-0000-4000-8000-000000000001";
const data=new Date("2026-10-01T00:00:00Z");
const protocolo={id,nome:"Modelo",versao:1,tipo:"SANITARIO"};
const tarefa={id,etapaId:id,execucaoId:id,previstaPara:data,previsaoOriginal:data,precisaoTemporal:"DIA",precisaoRealizacao:"DIA",previsaoPendente:false,realizadaEm:data,dispensadaEm:null,regularizacaoPendente:true,historicoRegularizacao:[],parametros:{tipo:"APLICACAO"},nomeSnapshot:null,
  execucao:{id,animalId:id,propriedadeId:1,canceladaEm:null,origemCalendario:"REFERENCIA_PROGRAMADA",inicioEfetivo:data,animal:{id,brinco:"10",nome:null},protocolo},
  etapa:{nome:"Aplicar",tipo:"APLICACAO",configuracao:{}},eventos:[],aplicacoes:[],exames:[],tentativas:[],
  vinculos:[{estado:"ATUAL",origem:"EXECUCAO",aplicacaoId:"fato-b",exameId:null,tentativaId:null,aplicacao:{id:"fato-b",status:"ANULADO",propriedadeId:2,data,aplicadaEm:data,dose:"1",unidadeDose:"ML",nomeProdutoAplicado:"Produto em B"},exame:null,tentativa:null}],
};
beforeEach(()=>{
  vi.resetAllMocks();
  banco.tx.tentativaReprodutiva.findFirst.mockResolvedValue(null);banco.tx.interpretacaoReprodutiva.findFirst.mockResolvedValue(null);banco.tx.exameAnimal.findFirst.mockResolvedValue(null);banco.tx.aplicacaoProduto.findFirst.mockResolvedValue(null);
  banco.tx.programacaoProtocolo.findFirst.mockResolvedValue({id,nome:"Grupo A",propriedadeId:1,inicioReferencia:data,precisaoTemporal:"DIA",status:"ABERTA",protocolo});
  banco.tx.$queryRaw.mockResolvedValueOnce([{total:1n}]).mockResolvedValueOnce([{id,situacao:"REGULARIZACAO_PENDENTE"}]).mockResolvedValueOnce([{situacao:"REGULARIZACAO_PENDENTE",total:1n,atrasadas:1n}]).mockResolvedValueOnce([{animaisPendentes:1n,acompanhamentosPendentes:0n}]);
  banco.tx.tarefaProtocolo.findMany.mockResolvedValueOnce([tarefa]).mockResolvedValueOnce([{id,execucao:{propriedadeId:1},vinculos:[{estado:"ATUAL",aplicacao:{propriedadeId:2,status:"ANULADO"},exame:null,tentativa:null}]}]);
});
describe("consulta operacional com fato realizado em outro sítio",()=>{
  it("conserva histórico da participação A sem revelar fato de B ao escopo A",async()=>{
    const r=await listarTarefasOperacao({programacaoId:id},1,consultaOperacaoSchema.parse({}),{dono:true,areas:[],flags:[]});
    expect(r.itens[0].propriedadeRegularizacaoId).toBeNull();expect(r.itens[0].tarefaOrigem.propriedadeRegularizacaoId).toBeNull();expect(r.itens[0].acoes.regularizar).toBe(false);expect(r.itens[0].vinculoAtual).toBeNull();expect(r.itens[0].tarefaOrigem.aplicacoes).toEqual([]);expect(r.itens[0].tarefaOrigem.aplicacaoId).toBeNull();
  });
  it("permite regularização no sítio B comprovado sem habilitar nova execução na origem A",async()=>{
    const r=await listarTarefasOperacao({programacaoId:id},2,consultaOperacaoSchema.parse({}),{dono:true,areas:[],flags:[]});
    expect(r.itens[0].propriedadeId).toBe(1);expect(r.itens[0].propriedadeRegularizacaoId).toBe(2);expect(r.itens[0].tarefaOrigem.propriedadeRegularizacaoId).toBe(2);expect(r.itens[0].acoes).toMatchObject({regularizar:true,atender:false,justificar:false,adiar:false,retificar:false});expect(r.itens[0].vinculoAtual?.id).toBe("fato-b");
  });
});


describe("participantes paginados da operação coletiva",()=>{
  it("cabeçalho conta animais independentemente da quantidade de tarefas",async()=>{
    banco.tx.participacaoProtocolo.count.mockResolvedValue(3);
    banco.tx.$queryRaw.mockReset().mockResolvedValue([{situacao:"ATENDIDO",total:12n,atrasadas:0n}]);
    const cabecalho=await obterCabecalhoOperacao({programacaoId:id},2);
    expect(cabecalho.participantesTotal).toBe(3);expect(cabecalho.contagens.total).toBe(12);
    expect(JSON.stringify(banco.tx.participacaoProtocolo.count.mock.calls[0][0].where)).toContain('"propriedadeId":2');
  });
  it("consulta somente dez linhas da segunda página e conserva contagem do conjunto com busca/escopo",async()=>{
    banco.tx.participacaoProtocolo.count.mockResolvedValue(21);
    banco.tx.participacaoProtocolo.findMany.mockResolvedValue(Array.from({length:10},(_,i)=>({id:`participacao-${i+10}`,animalId:`animal-${i+10}`,animal:{id:`animal-${i+10}`,brinco:`${i+10}`,nome:"Selecionado"},canceladaEm:i===0?data:null,motivoCancelamento:i===0?"Retirado com histórico":null,inicio:data,inicioEfetivo:null,precisaoTemporal:"DIA",precisaoInicioEfetivo:null})));
    const r=await listarParticipantesOperacao({programacaoId:id},2,consultaOperacaoSchema.parse({pagina:2,busca:"Selecionado"}));
    expect(r).toMatchObject({total:21,pagina:2,porPagina:10});expect(r.itens).toHaveLength(10);
    expect(r.itens[0]).toMatchObject({id:"participacao-10",encerradoEm:data.toISOString(),motivoEncerramento:"Retirado com histórico",inicioPrevisto:data.toISOString(),inicioEfetivo:null});
    expect(r.itens[0]).not.toHaveProperty("tarefas");
    const count=banco.tx.participacaoProtocolo.count.mock.calls[0][0];const consulta=banco.tx.participacaoProtocolo.findMany.mock.calls[0][0];
    expect(consulta.where).toEqual(count.where);expect(consulta).toMatchObject({skip:10,take:10,orderBy:[{inicio:"asc"},{id:"asc"}]});
    expect(count.where).toMatchObject({rodadaId:id,animal:{OR:[{brinco:{contains:"Selecionado",mode:"insensitive"}},{nome:{contains:"Selecionado",mode:"insensitive"}}]}});
    expect(JSON.stringify(count.where.AND)).toContain('"propriedadeId":2');
  });
  it("recupera última página válida após retirada e rejeita teto acima de dez",async()=>{
    banco.tx.participacaoProtocolo.count.mockResolvedValue(11);banco.tx.participacaoProtocolo.findMany.mockResolvedValue([]);
    expect(await listarParticipantesOperacao({programacaoId:id},1,consultaOperacaoSchema.parse({pagina:3}))).toMatchObject({total:11,pagina:2,porPagina:10});
    expect(banco.tx.participacaoProtocolo.findMany.mock.calls[0][0]).toMatchObject({skip:10,take:10});
    await expect(listarParticipantesOperacao({programacaoId:id},1,{pagina:1,porPagina:11})).rejects.toThrow();
  });
});


describe("resumo coletivo paginado na ficha do animal",()=>{
  it("exige animal/domínio e lê só a página sem carregar tarefas",async()=>{
    expect(consultaVinculosColetivosOperacaoSchema.safeParse({tipo:"REPRODUTIVO"}).success).toBe(false);
    expect(consultaVinculosColetivosOperacaoSchema.safeParse({animalId:id,tipo:"SANITARIO"}).success).toBe(false);
    banco.tx.participacaoProtocolo.count.mockResolvedValue(21);
    banco.tx.participacaoProtocolo.findMany.mockResolvedValue([{id:"participacao-21",animalId:id,animal:{id,brinco:"10",nome:null},protocolo:{...protocolo,tipo:"REPRODUTIVO"},rodada:{id,nome:"Grupo A"},inicio:data,inicioEfetivo:null,canceladaEm:data,motivoCancelamento:"Retirada documentada"}]);
    const r=await listarVinculosColetivosOperacao(2,consultaVinculosColetivosOperacaoSchema.parse({animalId:id,tipo:"REPRODUTIVO",pagina:3}));
    expect(r).toMatchObject({total:21,pagina:3,porPagina:10});expect(r.itens).toHaveLength(1);expect(r.itens[0]).toMatchObject({id:"participacao-21",programacao:{id,nome:"Grupo A"},encerradoEm:data.toISOString(),modo:"COLETIVO"});
    expect(r.itens[0]).not.toHaveProperty("tarefas");
    const consulta=banco.tx.participacaoProtocolo.findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({skip:20,take:10,where:{animalId:id,rodadaId:{not:null},protocolo:{tipo:"REPRODUTIVO"}},orderBy:[{inicio:"desc"},{id:"asc"}]});
    expect(consulta.where).toEqual(banco.tx.participacaoProtocolo.count.mock.calls[0][0].where);expect(consulta.select).not.toHaveProperty("tarefas");expect(JSON.stringify(consulta.where.AND)).toContain('"propriedadeId":2');
  });
});


describe("origens dos fatos na ficha",()=>{
  it("não consulta origens quando fato não pertence ao animal/sítio solicitado",async()=>{
    await expect(listarOrigensFatoOperacao(2,consultaOrigensFatoOperacaoSchema.parse({animalId:id,fatoId:id}))).rejects.toMatchObject({code:"NAO_ENCONTRADO"});
    expect(banco.tx.participacaoProtocolo.count).not.toHaveBeenCalled();expect(banco.tx.participacaoProtocolo.findMany).not.toHaveBeenCalled();
    expect(banco.tx.tentativaReprodutiva.findFirst.mock.calls[0][0]).toMatchObject({where:{id,animalId:id,propriedadeId:2}});
    expect(banco.tx.interpretacaoReprodutiva.findFirst.mock.calls[0][0]).toMatchObject({where:{id,exame:{animalId:id,propriedadeId:2}}});
  });
  it("resolve interpretação para exame e preserva origens históricas com paginação antes do DTO",async()=>{
    banco.tx.interpretacaoReprodutiva.findFirst.mockResolvedValue({exameId:id,exame:{tarefaId:null}});
    banco.tx.participacaoProtocolo.count.mockResolvedValue(11);banco.tx.participacaoProtocolo.findMany.mockResolvedValue([{id,protocolo:{id,nome:"Modelo",versao:1},rodada:{id,nome:"Grupo antigo"}}]);
    const r=await listarOrigensFatoOperacao(2,consultaOrigensFatoOperacaoSchema.parse({animalId:id,fatoId:id,exameId:id,pagina:2}));
    expect(r).toEqual({itens:[{participacaoId:id,protocolo:{id,nome:"Modelo",versao:1},programacao:{id,nome:"Grupo antigo"}}],total:11,pagina:2,porPagina:10});
    const consulta=banco.tx.participacaoProtocolo.findMany.mock.calls[0][0];expect(consulta).toMatchObject({take:10,skip:10,where:{animalId:id},orderBy:[{inicio:"desc"},{id:"asc"}]});
    expect(consulta.where).toEqual(banco.tx.participacaoProtocolo.count.mock.calls[0][0].where);expect(JSON.stringify(consulta.where)).toContain(`"exameId":"${id}"`);expect(JSON.stringify(consulta.where)).not.toContain('"estado"');expect(consulta.select).not.toHaveProperty("tarefas");
  });
  it("conserva fallback da ligação direta legada e distingue origem individual",async()=>{
    banco.tx.tentativaReprodutiva.findFirst.mockResolvedValue({id,tarefaId:id});banco.tx.participacaoProtocolo.count.mockResolvedValue(1);banco.tx.participacaoProtocolo.findMany.mockResolvedValue([{id,protocolo:{id,nome:"Individual",versao:2},rodada:null}]);
    const r=await listarOrigensFatoOperacao(2,consultaOrigensFatoOperacaoSchema.parse({animalId:id,fatoId:id}));
    expect(r.itens[0]).toEqual({participacaoId:id,protocolo:{id,nome:"Individual",versao:2},programacao:null});
    const where=banco.tx.participacaoProtocolo.count.mock.calls[0][0].where;expect(where.AND[1].tarefas.some.OR).toContainEqual({id});
  });
  it("recusa usar exame extra de outro fato como origem",async()=>{
    banco.tx.interpretacaoReprodutiva.findFirst.mockResolvedValue({exameId:id,exame:{tarefaId:null}});
    await expect(listarOrigensFatoOperacao(2,consultaOrigensFatoOperacaoSchema.parse({animalId:id,fatoId:id,exameId:"00000000-0000-4000-8000-000000000002"}))).rejects.toMatchObject({code:"VALIDACAO"});expect(banco.tx.participacaoProtocolo.count).not.toHaveBeenCalled();
  });
  it("participação fixada continua limitada ao animal/domínio/sítio",async()=>{
    banco.tx.participacaoProtocolo.count.mockResolvedValue(0);banco.tx.participacaoProtocolo.findMany.mockResolvedValue([]);
    await listarVinculosColetivosOperacao(2,consultaVinculosColetivosOperacaoSchema.parse({animalId:id,participacaoId:id,tipo:"REPRODUTIVO"}));
    expect(banco.tx.participacaoProtocolo.count.mock.calls[0][0].where).toMatchObject({id,animalId:id,protocolo:{tipo:"REPRODUTIVO"},rodadaId:{not:null}});
    expect(JSON.stringify(banco.tx.participacaoProtocolo.count.mock.calls[0][0].where.AND)).toContain('"propriedadeId":2');
  });
});
