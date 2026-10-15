import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { criarSelecaoTx, atualizarSelecaoTx, listarSelecoes } from "./selecoes.js";
import { consultarPlannerTx, incluirGrupoPlannerTx, previaGrupoPlannerTx } from "./planner.js";
import { consultaPlannerSchema, incluirGrupoPlannerSchema, previaGrupoPlannerSchema } from "./planner.schemas.js";
import { criarVisitaTx } from "./visitas.js";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const data = "2026-10-14";
/** Toda a fixture e a validação acontecem na mesma transação, sempre revertida. */
async function comRollback(executar: (tx: Prisma.TransactionClient) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  const rollback = new Error("ROLLBACK_FIXTURES_PLANNER");
  try {
    await prisma.$transaction(async tx => {
      await executar(tx);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw rollback;
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (erro) { if (erro !== rollback) throw erro; }
}
async function fixture(tx: Prisma.TransactionClient, quantidade = 2) {
  const sitio = await tx.propriedade.create({ data: { nome: `Planner rollback ${randomUUID()}` } });
  const animais = [];
  for (let i = 0; i < quantidade; i++) animais.push(await tx.animal.create({ data: { brinco: `PL-${i}-${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"),
    localizacoes: { create: { propriedadeId: sitio.id, desde: new Date("2024-01-01") } } } }));
  const visita = await tx.visitaVeterinaria.create({ data: { propriedadeId: sitio.id, data: new Date(data), nome: "Visita preparada" } });
  return { sitio, animais, visita };
}
const criterios = criteriosSelecaoSchema.parse({ versao: 1, todas: [{ tipo: "FAIXA", campo: "DEL", min: 40, max: 60 }], qualquer: [], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" });

suite("seleções e planner — fixtures próprias em rollback", () => {
  it("reavalia seleção por data, congela critérios/contexto e recusa CAS/prévia de versão superada", async () => comRollback(async tx => {
    const { sitio, animais, visita } = await fixture(tx);
    await tx.lactacaoAnimal.createMany({ data: animais.map((a, i) => ({ animalId: a.id, propriedadeId: sitio.id, inicio: new Date(i ? "2026-10-01" : "2026-08-25"), origem: "HISTORICO_INFORMADO" })) });
    const selecao = await criarSelecaoTx(tx, { propriedadeId: sitio.id, nome: "Matrizes de 40 a 60 DEL", criterios }, null);
    const grupo = { origem: "SELECAO" as const, selecaoVersaoId: selecao.versaoAtual.id };
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data, grupo }));
    expect(previa.animais.map(a => a.animalId)).toEqual([animais[0].id]);
    const futura = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data: "2026-11-15", grupo }));
    expect(futura.animais.map(a => a.animalId)).toEqual([animais[1].id]);
    const input = incluirGrupoPlannerSchema.parse({ propriedadeId: sitio.id, chave: randomUUID(), grupo, fingerprint: previa.fingerprint });
    const incluida = await incluirGrupoPlannerTx(tx, visita.id, input, null);
    expect(incluida.totalAnimais).toBe(1);
    const snapshot = incluida.atividades[0].participantes[0].snapshot;
    expect(snapshot).toMatchObject({ del: 50, convencaoDel: "D0", filtros: { selecaoCriterios: criterios, grupoPlanner: grupo } });
    const atualizada = await atualizarSelecaoTx(tx, selecao.id, { propriedadeId: sitio.id, nome: selecao.nome, versaoAtualId: selecao.versaoAtual.id, criterios: { ...criterios, todas: [] } }, null);
    expect(atualizada.versaoAtual.numero).toBe(2);
    await expect(atualizarSelecaoTx(tx, selecao.id, { propriedadeId: sitio.id, nome: selecao.nome, versaoAtualId: selecao.versaoAtual.id, criterios }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data, grupo }))).rejects.toMatchObject({ code: "CONFLITO" });
    expect((await tx.participanteVisita.findUniqueOrThrow({ where: { id: incluida.atividades[0].participantes[0].id } })).snapshot).toEqual(snapshot);
    expect(await tx.versaoSelecaoVisita.count({ where: { selecaoId: selecao.id } })).toBe(2);
    expect((await incluirGrupoPlannerTx(tx, visita.id, input, null)).totalAnimais).toBe(1);
    const outro = await tx.propriedade.create({ data: { nome: `Sem acesso ${randomUUID()}` } });
    expect((await listarSelecoes(outro.id, false, tx)).selecoes).toEqual([]);
    await expect(atualizarSelecaoTx(tx, selecao.id, { propriedadeId: outro.id, nome: selecao.nome, versaoAtualId: atualizada.versaoAtual.id, criterios }, null)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  }));

  it("usa núcleo comum, separa turmas/janelas e ignora realizada, dispensada, regularização e transferência", async () => comRollback(async tx => {
    const { sitio, animais, visita } = await fixture(tx);
    const protocolo = await tx.protocolo.create({ data: { tipo: "REPRODUTIVO", nome: `Planner protocolo ${randomUUID()}`, versao: 1,
      etapas: { create: { nome: "Avaliação", ordem: 1, tipo: "EXAME", diaRelativo: 0, configuracao: { tipo: "AVALIACAO", nome: "Avaliação", intervalo: 0, unidade: "DIAS" } } } }, include: { etapas: true } });
    const turma = await tx.programacaoProtocolo.create({ data: { protocoloId: protocolo.id, propriedadeId: sitio.id, nome: "Turma A", inicioReferencia: new Date("2026-10-01") } });
    const turmaB = await tx.programacaoProtocolo.create({ data: { protocoloId: protocolo.id, propriedadeId: sitio.id, nome: "Turma B", inicioReferencia: new Date("2026-10-01") } });
    async function tarefa(prevista: string, modificacoes: Partial<Prisma.TarefaProtocoloUncheckedCreateInput> = {}, rodadaId = turma.id, animalId = animais[0].id) {
      const execucao = await tx.participacaoProtocolo.findFirst({ where: { rodadaId, animalId } })
        ?? await tx.participacaoProtocolo.create({ data: { protocoloId: protocolo.id, propriedadeId: sitio.id, animalId, rodadaId, inicio: new Date("2026-10-01") } });
      let etapaId = protocolo.etapas[0].id;
      if (await tx.tarefaProtocolo.count({ where: { execucaoId: execucao.id, etapaId } })) {
        const ordem = (await tx.etapaProtocolo.count({ where: { protocoloId: protocolo.id } })) + 1;
        etapaId = (await tx.etapaProtocolo.create({ data: { protocoloId: protocolo.id, ordem, nome: `Etapa ${ordem}`, tipo: "EXAME", diaRelativo: 0, configuracao: { tipo: "AVALIACAO", nome: "Avaliação", intervalo: 0, unidade: "DIAS" } } })).id;
      }
      return tx.tarefaProtocolo.create({ data: { execucaoId: execucao.id, etapaId, previstaPara: new Date(prevista), ...modificacoes } });
    }
    const doDia = await tarefa(data);
    await tarefa("2026-10-13"); await tarefa("2026-10-15"); await tarefa("2026-10-01", { previsaoPendente: true }); await tarefa(data, {}, turmaB.id);
    await tarefa(data, { realizadaEm: new Date(data), precisaoRealizacao: "DIA" });
    await tarefa(data, { dispensadaEm: new Date(data), motivoDispensa: "Dispensa conferida na fixture" });
    await tarefa(data, { regularizacaoPendente: true });
    const transferida = await tarefa(data, {}, turma.id, animais[1].id);
    const destino = await tx.propriedade.create({ data: { nome: `Destino ${randomUUID()}` } });
    await tx.localizacaoAnimal.updateMany({ where: { animalId: animais[1].id }, data: { ate: new Date("2026-10-10") } });
    await tx.localizacaoAnimal.create({ data: { animalId: animais[1].id, propriedadeId: destino.id, desde: new Date("2026-10-10") } });
    const planner = await consultarPlannerTx(tx, consultaPlannerSchema.parse({ propriedadeId: sitio.id, data }));
    expect(planner).toMatchObject({ totalGrupos: 5, totais: { animaisUnicos: 1, procedimentos: 5 } });
    expect(planner.grupos.map(g => g.janela)).toEqual(expect.arrayContaining(["DIA", "ANTERIOR", "FUTURA", "SEM_PREVISAO"]));
    expect(planner.grupos.every(g => g.secao === "REPRODUCAO")).toBe(true);
    const grupo = planner.grupos.find(g => g.turma?.id === turma.id && g.janela === "DIA")!.grupo;
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data, grupo }));
    expect(previa.animais.map(a => a.tarefaId)).toEqual([doDia.id]);
    expect(previa.animais.map(a => a.tarefaId)).not.toContain(transferida.id);
    const input = incluirGrupoPlannerSchema.parse({ propriedadeId: sitio.id, chave: randomUUID(), grupo, fingerprint: previa.fingerprint });
    const incluidos = await incluirGrupoPlannerTx(tx, visita.id, input, null);
    expect(incluidos.totalProcedimentos).toBe(1);
    const avisos = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data, grupo }));
    expect(avisos.animais[0].visitasAbertas).toContainEqual({ id: visita.id, nome: visita.nome });
    await tx.$executeRaw`SAVEPOINT inclusao_duplicada`;
    await expect(incluirGrupoPlannerTx(tx, visita.id, { ...input, chave: randomUUID() }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT inclusao_duplicada`;
    expect(await tx.atividadeVisita.count({ where: { visitaId: visita.id } })).toBe(1);
    await tx.tarefaProtocolo.update({ where: { id: doDia.id }, data: { realizadaEm: new Date(data), precisaoRealizacao: "DIA" } });
    await expect(incluirGrupoPlannerTx(tx, visita.id, { ...input, chave: randomUUID() }, null)).rejects.toMatchObject({ code: "CONFLITO" });
  }));

  it("a versão persistida recusa UPDATE/DELETE, e a seleção pode ser inativada com nova versão", async () => comRollback(async tx => {
    const { sitio } = await fixture(tx, 0);
    const selecao = await criarSelecaoTx(tx, { propriedadeId: sitio.id, nome: "Seleção imutável", criterios }, null);
    await tx.$executeRaw`SAVEPOINT conferir_imutabilidade`;
    await expect(tx.versaoSelecaoVisita.update({ where: { id: selecao.versaoAtual.id }, data: { criterios: {} } })).rejects.toThrow();
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT conferir_imutabilidade`;
    await expect(tx.versaoSelecaoVisita.delete({ where: { id: selecao.versaoAtual.id } })).rejects.toThrow();
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT conferir_imutabilidade`;
    await atualizarSelecaoTx(tx, selecao.id, { propriedadeId: sitio.id, nome: selecao.nome, criterios, versaoAtualId: selecao.versaoAtual.id, ativo: false }, null);
    expect((await listarSelecoes(sitio.id, false, tx)).selecoes).toHaveLength(0);
    expect((await listarSelecoes(sitio.id, true, tx)).selecoes).toHaveLength(1);
  }));

  it("prepara as 1001 tarefas do grupo sem corte de 500 ou 1000 e confirma só a preparação", async () => comRollback(async tx => {
    const { sitio, visita } = await fixture(tx, 0);
    const ids = Array.from({ length: 1001 }, () => randomUUID());
    await tx.animal.createMany({ data: ids.map((id, i) => ({ id, brinco: `PL-G-${i}-${id}`, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01") })) });
    await tx.localizacaoAnimal.createMany({ data: ids.map(animalId => ({ animalId, propriedadeId: sitio.id, desde: new Date("2024-01-01") })) });
    const protocolo = await tx.protocolo.create({ data: { tipo: "REPRODUTIVO", nome: `Grupo grande ${randomUUID()}`, versao: 1,
      etapas: { create: { nome: "Avaliação", ordem: 1, tipo: "EXAME", diaRelativo: 0, configuracao: { tipo: "AVALIACAO", nome: "Avaliação", intervalo: 0, unidade: "DIAS" } } } }, include: { etapas: true } });
    const turma = await tx.programacaoProtocolo.create({ data: { protocoloId: protocolo.id, propriedadeId: sitio.id, nome: "Turma completa", inicioReferencia: new Date(data) } });
    const participacoes = ids.map(animalId => ({ id: randomUUID(), animalId }));
    await tx.participacaoProtocolo.createMany({ data: participacoes.map(p => ({ ...p, rodadaId: turma.id, protocoloId: protocolo.id, propriedadeId: sitio.id, inicio: new Date(data) })) });
    await tx.tarefaProtocolo.createMany({ data: participacoes.map(p => ({ execucaoId: p.id, etapaId: protocolo.etapas[0].id, previstaPara: new Date(data) })) });
    const planner = await consultarPlannerTx(tx, consultaPlannerSchema.parse({ propriedadeId: sitio.id, data }));
    expect(planner.totais).toEqual({ animaisUnicos: 1001, procedimentos: 1001 });
    const grupo = planner.grupos[0].grupo;
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data, grupo, pagina: 6, tamanhoPagina: 200 }));
    expect(previa).toMatchObject({ total: 1001, animais: [expect.objectContaining({ animalId: expect.any(String) })] });
    const input = incluirGrupoPlannerSchema.parse({ propriedadeId: sitio.id, chave: randomUUID(), grupo, fingerprint: previa.fingerprint });
    const resultado = await incluirGrupoPlannerTx(tx, visita.id, input, null);
    expect(resultado).toMatchObject({ totalAnimais: 1001, totalProcedimentos: 1001 });
    expect(resultado.atividades.map(a => a.participantes.length)).toEqual([1000, 1]);
    expect(await tx.participanteVisita.count({ where: { atividadeId: { in: resultado.atividades.map(a => a.id) } } })).toBe(1001);
    expect(await tx.tarefaProtocolo.count({ where: { execucaoId: { in: participacoes.map(p => p.id) }, realizadaEm: { not: null } } })).toBe(0);
    expect((await incluirGrupoPlannerTx(tx, visita.id, input, null)).totalProcedimentos).toBe(1001);
  }), 60000);

  it("seleção livre usa peso até a data, preserva exceção/snapshot e rejeita prévia desatualizada", async()=>comRollback(async tx=>{
    const {sitio,animais,visita}=await fixture(tx);
    const peso=await tx.pesagem.create({data:{animalId:animais[0].id,data:new Date("2026-10-01"),pesoKg:"440.25",tipo:"ROTINA"}});
    await tx.pesagem.create({data:{animalId:animais[0].id,data:new Date("2026-11-01"),pesoKg:"999.99",tipo:"ROTINA"}});
    const criterios=criteriosSelecaoSchema.parse({versao:2,todas:[{tipo:"FAIXA",campo:"PESO_KG",min:400,max:450.5}],qualquer:[],ordenacao:[{campo:"BRINCO",direcao:"ASC"}],politicaDesconhecidos:"EXCLUIR"});
    const grupo={origem:"LIVRE",nome:"Peso para manejo",tipo:"APLICACAO_SANITARIA",criterios,incluidosManualmente:[animais[1].id]};
    const p=await previaGrupoPlannerTx(tx,previaGrupoPlannerSchema.parse({propriedadeId:sitio.id,data,grupo}));
    expect(p.total).toBe(2);expect(p.animais.find(a=>a.animalId===animais[0].id)).toMatchObject({pesoKg:440.25,pesagemData:"2026-10-01",diasPesagem:13});
    expect(p.animais.find(a=>a.animalId===animais[1].id)?.motivos).toContain("Inclusão manual fora dos filtros");
    const input=incluirGrupoPlannerSchema.parse({chave:randomUUID(),propriedadeId:sitio.id,grupo,fingerprint:p.fingerprint,excluidos:[animais[1].id]});
    const r=await incluirGrupoPlannerTx(tx,visita.id,input,null);
    expect(r.totalAnimais).toBe(1);expect(r.atividades[0].contexto).toMatchObject({percursoVisita:{origem:"LIVRE"},excluidos:[animais[1].id],grupoPlanner:{incluidosManualmente:[animais[1].id]}});
    expect(r.atividades[0].participantes[0].snapshot).toMatchObject({selecaoNaData:{pesoKg:440.25}});
    expect((await incluirGrupoPlannerTx(tx,visita.id,input,null)).atividades[0].id).toBe(r.atividades[0].id);
    expect(await tx.aplicacaoProduto.count({where:{animalId:{in:animais.map(a=>a.id)}}})).toBe(0);
    const outroGrupo={...grupo,nome:"Outro manejo"};
    const antes=await previaGrupoPlannerTx(tx,previaGrupoPlannerSchema.parse({propriedadeId:sitio.id,data,grupo:outroGrupo}));
    await tx.pesagem.update({where:{id:peso.id},data:{pesoKg:"441.25"}});
    await expect(incluirGrupoPlannerTx(tx,visita.id,incluirGrupoPlannerSchema.parse({...input,chave:randomUUID(),grupo:outroGrupo,fingerprint:antes.fingerprint}),null)).rejects.toMatchObject({code:"CONFLITO"});
  }));
  it("diferencia participação futura, ativa e concluída na data",async()=>comRollback(async tx=>{
    const {sitio,animais}=await fixture(tx,3);
    const protocolo=await tx.protocolo.create({data:{nome:`Ativos seleção ${randomUUID()}`,tipo:"SANITARIO",versao:1,etapas:{create:{nome:"Manejo",tipo:"MANEJO",ordem:1,diaRelativo:0}}},include:{etapas:true}});
    for(const [i,a] of animais.entries()) await tx.participacaoProtocolo.create({data:{propriedadeId:sitio.id,animalId:a.id,protocoloId:protocolo.id,inicio:new Date(i===0?"2026-10-20":"2026-10-01"),tarefas:{create:{etapaId:protocolo.etapas[0].id,previstaPara:new Date(data),...(i===2?{realizadaEm:new Date("2026-10-13"),precisaoRealizacao:"DIA"}:{})}}}});
    const criterios=criteriosSelecaoSchema.parse({versao:2,todas:[{tipo:"VALORES",campo:"PROTOCOLO_ATIVO",valores:["SANITARIO"]}],qualquer:[],ordenacao:[{campo:"BRINCO",direcao:"ASC"}],politicaDesconhecidos:"EXCLUIR"});
    const p=await previaGrupoPlannerTx(tx,previaGrupoPlannerSchema.parse({propriedadeId:sitio.id,data,grupo:{origem:"LIVRE",nome:"Ativos",tipo:"APLICACAO_SANITARIA",criterios}}));
    expect(p.animais.map(a=>a.animalId)).toEqual([animais[1].id]);
  }));

 it("criação de visita com chave é idempotente e conflita com payload diferente",async()=>comRollback(async tx=>{
   const {sitio}=await fixture(tx);const input={chave:randomUUID(),propriedadeId:sitio.id,data,nome:"Criação com reenvio"};
   const a=await criarVisitaTx(tx,input,null),b=await criarVisitaTx(tx,input,null);expect(a.id).toBe(b.id);
   expect(await tx.visitaVeterinaria.count({where:{propriedadeId:sitio.id,nome:input.nome}})).toBe(1);
   await expect(criarVisitaTx(tx,{...input,nome:"Outro conteúdo"},null)).rejects.toMatchObject({code:"CONFLITO"});
 }));

});
