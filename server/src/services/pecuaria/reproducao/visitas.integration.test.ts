import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { criarVisita, adicionarAtividade, salvarRascunho, previaAtividade, confirmarAtividade, sugestoesVisita } from "./visitas.js";
import { executarTarefa, regularizarTarefa } from "./iatf.js";
import { anularFato, previaAnulacao } from "./correcoes.js";
const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
async function fixture() {
  const token=randomUUID();
  const sitio=await prisma.propriedade.create({data:{nome:`Correção visita ${token}`}});
  const animal=await prisma.animal.create({data:{brinco:`CV-${token}`,sexo:"F",origem:"COMPRADO",dataNascimento:new Date("2020-01-01"),dataEntrada:new Date("2024-01-01"),localizacoes:{create:{propriedadeId:sitio.id,desde:new Date("2024-01-01")}},destinos:{create:{desde:new Date("2024-01-01"),aptidao:"LEITE",papelReprodutivo:"RECEPTORA"}}}});
  const visita=await criarVisita({propriedadeId:sitio.id,data:"2026-10-10",nome:`Visita ${token}`},null);
  return {sitio,animal,visita};
}
suite("visitas V4 — correções e planejamento as-of",()=>{
  it("rejeita autosave obsoleto sem perder versão nova, e revisão detecta restrição/paridade",async()=>{
    const {sitio,animal,visita}=await fixture();
    const atividade=await adicionarAtividade(visita.id,{propriedadeId:sitio.id,tipo:"AVALIACAO_REPRODUTIVA",nome:"Avaliação",extra:false,contexto:{},participantes:[{animalId:animal.id}]},null);
    const p=atividade.participantes[0];
    const salvo=await salvarRascunho(visita.id,p.id,sitio.id,{anotacaoOriginal:"Primeira anotação"},null,0);
    expect(salvo.versaoRascunho).toBe(1);
    await expect(salvarRascunho(visita.id,p.id,sitio.id,{anotacaoOriginal:"Anotação antiga"},null,0)).rejects.toMatchObject({code:"CONFLITO",campo:"versaoRascunho"});
    expect((await prisma.participanteVisita.findUniqueOrThrow({where:{id:p.id}})).rascunho).toEqual({anotacaoOriginal:"Primeira anotação"});
    await prisma.restricaoReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date("2026-10-09"),tipo:"DESCARTE",motivo:"Decisão reprodutiva documentada",acoes:["IATF"]}});
    await prisma.partoAnimal.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date("2026-10-08"),tipo:"ABORTO"}});
    const previa=await previaAtividade(visita.id,atividade.id,sitio.id);
    expect(previa.participantes[0].alteracoes).toEqual(expect.arrayContaining(["restrições reprodutivas alteradas","último parto alterado","contagem de partos alterada"]));
    const confirmacao={propriedadeId:sitio.id,chave:randomUUID(),itens:[{participanteId:p.id,status:"CONFIRMADO" as const,dados:{resultado:"INCONCLUSIVO"}}]};
    await expect(confirmarAtividade(visita.id,atividade.id,confirmacao,null)).rejects.toMatchObject({code:"CONFLITO"});
    await confirmarAtividade(visita.id,atividade.id,{...confirmacao,cienciaAlteracoes:true,fingerprintPrevia:previa.fingerprint},null);
  });
  it("usa início sanitário transcrito e conserva contexto do papel e critérios na visita",async()=>{
    const {sitio,animal,visita}=await fixture();
    const protocolo=await prisma.protocoloSanitario.create({data:{nome:`Sanitário ${randomUUID()}`,versao:1,publicadoEm:new Date(),ativo:true}});
    const a=await adicionarAtividade(visita.id,{propriedadeId:sitio.id,tipo:"INICIAR_SANITARIO",nome:"Início sanitário",extra:false,contexto:{protocoloId:protocolo.id,criterios:{diasPartoMin:0}},participantes:[{animalId:animal.id}]},null);
    expect(a.participantes[0].snapshot).toMatchObject({papelReprodutivo:"RECEPTORA",criterios:{diasPartoMin:0}});
    await confirmarAtividade(visita.id,a.id,{propriedadeId:sitio.id,chave:randomUUID(),itens:[{participanteId:a.participantes[0].id,status:"CONFIRMADO",dados:{inicio:"2026-10-09"}}]},null);
    const execucao=await prisma.execucaoProtocoloSanitario.findFirstOrThrow({where:{animalId:animal.id,protocoloId:protocolo.id}});
    expect(execucao.inicio.toISOString().slice(0,10)).toBe("2026-10-09");
  });
  it("projeta transferência e situação na data; filtra intervalos sem inventar janela clínica e supera retorno antigo",async()=>{
    const {sitio,animal}=await fixture();
    const origem=await prisma.propriedade.create({data:{nome:`Origem ${randomUUID()}`}});
    await prisma.localizacaoAnimal.updateMany({where:{animalId:animal.id},data:{propriedadeId:origem.id,ate:new Date("2026-10-01")}});
    await prisma.localizacaoAnimal.create({data:{animalId:animal.id,propriedadeId:sitio.id,desde:new Date("2026-10-01")}});
    const tentativa=await prisma.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:origem.id,data:new Date("2026-09-10"),tipo:"COBERTURA",origemMaterial:"DOCUMENTADA",ciclo:0,ordem:1,geneticaSnapshot:{}}});
    await prisma.avaliacaoReprodutiva.create({data:{animalId:animal.id,propriedadeId:origem.id,data:new Date("2026-09-20"),resultado:"INCONCLUSIVO",retornoEm:new Date("2026-10-05")}});
    const atual=await prisma.avaliacaoReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date("2026-10-02"),resultado:"INCONCLUSIVO",retornoEm:new Date("2026-10-15")}});
    // Um diagnóstico futuro não altera a folha anterior.
    await prisma.gestacaoAnimal.create({data:{animalId:animal.id,propriedadeId:sitio.id,confirmadaEm:new Date("2026-10-12"),previsaoParto:new Date("2027-06-01")}});
    const r=await sugestoesVisita(sitio.id,"2026-10-10",{situacao:"AGUARDANDO_DIAGNOSTICO",diasTentativaMin:30,diasTentativaMax:30});
    expect(r.animais.map(a=>a.animalId)).toContain(animal.id);
    expect(r.retornos.filter(r=>r.origem === "AVALIACAO").map(r=>r.origemId)).toEqual([atual.id]);
    expect(r.retornos).toContainEqual(expect.objectContaining({origem:"TENTATIVA",origemId:null,origemConsultavel:false,status:"AGUARDANDO_DIAGNOSTICO",data:null}));
    expect((await sugestoesVisita(sitio.id,"2026-10-10",{diasTentativaMin:31})).animais).toHaveLength(0);
    expect((await sugestoesVisita(sitio.id,"2026-09-30")).animais).toHaveLength(0);
  });
  it("aplicação IATF revalida descarte antes de criar aplicação/consumo; anulação exige regularização explícita",async()=>{
    const {sitio,animal}=await fixture();
    const protocolo=await prisma.protocoloIatf.create({data:{nome:`IATF ${randomUUID()}`,versao:1,publicado:true,etapas:[]}});
    const programa=await prisma.programacaoIatf.create({data:{protocoloId:protocolo.id,propriedadeId:sitio.id,nome:"Programação",inicioPrevisto:new Date("2026-10-01T12:00:00Z")}});
    const p=await prisma.participanteIatf.create({data:{programacaoId:programa.id,animalId:animal.id,inicioPrevisto:new Date("2026-10-01T12:00:00Z"),inicioEfetivo:new Date("2026-10-01T12:00:00Z")}});
    const tarefa=await prisma.tarefaIatf.create({data:{participanteId:p.id,etapa:0,tipo:"APLICACAO",nome:"Aplicação",previstaEm:new Date("2026-10-10T12:00:00Z"),previsaoOriginal:new Date("2026-10-10T12:00:00Z")}});
    await prisma.restricaoReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date("2026-10-09"),tipo:"DESCARTE",motivo:"Não reproduzir após decisão",acoes:["IATF"]}});
    await expect(executarTarefa(tarefa.id,{chave:randomUUID(),propriedadeId:sitio.id,realizadaEm:"2026-10-10T12:00:00Z",dados:{}},null)).rejects.toMatchObject({code:"VALIDACAO",campo:"animalId"});
    expect(await prisma.aplicacaoProduto.count({where:{animalId:animal.id}})).toBe(0);
    const avaliacao=await prisma.avaliacaoReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date("2026-10-08"),resultado:"INCONCLUSIVO"}});
    const realizada=await prisma.tarefaIatf.create({data:{participanteId:p.id,etapa:1,tipo:"AVALIACAO",nome:"Avaliação",previstaEm:new Date("2026-10-08T12:00:00Z"),previsaoOriginal:new Date("2026-10-08T12:00:00Z"),realizadaEm:new Date("2026-10-08T12:00:00Z"),avaliacaoId:avaliacao.id,realizadoSnapshot:{avaliacaoId:avaliacao.id}}});
    const previa=await previaAnulacao("avaliacoes",avaliacao.id,sitio.id);
    await anularFato("avaliacoes",avaliacao.id,{chave:randomUUID(),propriedadeId:sitio.id,motivo:"Avaliação não realizada, lançamento indevido",fingerprint:previa.fingerprint},null);
    const pendente=await prisma.tarefaIatf.findUniqueOrThrow({where:{id:realizada.id}});
    expect(pendente.regularizacaoPendente).toBe(true);expect(pendente.realizadaEm).not.toBeNull();expect(pendente.avaliacaoId).toBe(avaliacao.id);
    const input={chave:randomUUID(),propriedadeId:sitio.id,motivo:"Liberar registro após comprovar erro",acao:"REABRIR" as const,cienciaNaoExecutado:true};
    const regularizada=await regularizarTarefa(realizada.id,input,null);
    expect(regularizada.realizadaEm).toBeNull();expect(regularizada.regularizacaoPendente).toBe(false);
    expect(regularizada.historicoRegularizacao).toEqual(expect.arrayContaining([expect.objectContaining({acao:"REABRIR",anterior:expect.objectContaining({avaliacaoId:avaliacao.id,realizadaEm:expect.any(String)})})]));
    expect((await regularizarTarefa(realizada.id,input,null)).id).toBe(regularizada.id);
  });
});
