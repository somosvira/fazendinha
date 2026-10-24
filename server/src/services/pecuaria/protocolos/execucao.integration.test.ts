import * as iatf from "../reproducao/iatf.js";
import { protocoloSchema, programacaoSchema } from "../reproducao/schemas.js";
import { obterCabecalhoOperacao } from "./operacao.js";
import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { criarProtocolo, publicarProtocolo, iniciarExecucao } from "../sanidade/protocolos.js";
import { criarAplicacao, obterSaldo } from "../sanidade/aplicacoes.js";
import { criarEntradaValorizadaFixture, limparMovimentosValorizadosFixture } from "../../../test/estoque-valorizado.fixture.js";
import { preverExecucaoProtocolo, confirmarExecucaoProtocolo, obterReciboExecucaoProtocolo } from "./execucao.js";
import type { ExecucaoProtocoloInput } from "./execucao.schemas.js";

const banco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const sitios: number[] = [], animais: string[] = [], produtos: string[] = [], protocolos: string[] = [], materiais: string[] = [], genitores: string[] = [];
const antes = (dias: number) => new Date(Date.parse(hojeFazenda()) - dias * 86_400_000).toISOString().slice(0, 10);

// Todos os filtros pertencem a IDs criados abaixo. Não toca seed, manifesto,
// tabelas globais ou fixtures de outra suíte; o coordenador executa esta suíte.
afterAll(async () => {
  if (!sitios.length) return;
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId: { in: sitios } }, { animalId: { in: animais } }, { entidadeId: { in: protocolos } }] } });
  await prisma.vinculoTarefaProtocolo.deleteMany({ where: { tarefa: { execucao: { animalId: { in: animais } } } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animais } } });
  await limparMovimentosValorizadosFixture(produtos);
  await prisma.tarefaProtocolo.deleteMany({ where: { execucao: { animalId: { in: animais } } } });
  await prisma.participacaoProtocolo.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.programacaoProtocolo.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.protocolo.deleteMany({ where: { id: { in: protocolos } } });
  await prisma.materialGenetico.deleteMany({ where: { id: { in: materiais } } });
  await prisma.genitorExterno.deleteMany({ where: { id: { in: genitores } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.finalidadeAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: sitios } } });
});

async function fixture(quantidade: number, saldo: number) {
  const run = crypto.randomUUID().slice(0, 8);
  const sitio = await prisma.propriedade.create({ data: { nome: `Ações teste ${run}` } }); sitios.push(sitio.id);
  const produto = await prisma.produto.create({ data: { nome: `Produto ações ${run}`, unidade: "ML", usoSanitario: true } }); produtos.push(produto.id);
  const protocolo = await criarProtocolo({ nome: `Ações independentes ${run}`, etapas: [
    { momento: { nome: "D0", ordem: 1 }, subtipo: "INSERCAO_DISPOSITIVO", tipo: "APLICACAO", diaRelativo: 0, produtoId: produto.id, finalidade: "TRATAMENTO", dose: 2, unidade: "ML" },
    { momento: { nome: "D0", ordem: 1 }, tipo: "APLICACAO", diaRelativo: 0, produtoId: produto.id, finalidade: "TRATAMENTO", dose: 1, unidade: "ML" },
  ] }, null); protocolos.push(protocolo.id);
  await publicarProtocolo(protocolo.id, null);
  const programacao = await prisma.programacaoProtocolo.create({ data: { protocoloId: protocolo.id, propriedadeId: sitio.id, nome: `Grupo teste ${run}`, inicioReferencia: new Date(antes(2)) } });
  const itens: Array<Extract<ExecucaoProtocoloInput["itens"][number],{tipo:"APLICACAO"}>> = [];
  for (let n = 0; n < quantidade; n++) {
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `AC${run}${n}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: sitio.id }), null); animais.push(animal.id);
    const inicio = { chave: crypto.randomUUID(), animalId: animal.id, propriedadeId: sitio.id, protocoloId: protocolo.id, inicio: antes(2) };
    const participacao = await iniciarExecucao(inicio, null);
    expect(participacao.tarefas.map(t => t.etapaId)).toEqual(protocolo.etapas.map(e => e.id));
    if (n === 0) {
      const reenvio = await iniciarExecucao(inicio, null);
      expect(reenvio.tarefas.map(t => t.id)).toEqual(participacao.tarefas.map(t => t.id));
    }
    await prisma.participacaoProtocolo.update({ where: { id: participacao.id }, data: { rodadaId: programacao.id } });
    itens.push({ tipo: "APLICACAO", tarefaId: participacao.tarefas[0].id, animalId: animal.id, propriedadeId: sitio.id, data: antes(2), aplicadaEm: `${antes(2)}T14:00:00-03:00`, produtoId: produto.id, nomeProdutoAplicado: produto.nome, finalidade: "TRATAMENTO", dose: "2", unidadeDose: "ML", origemInsumo: "BAIXA_ESTOQUE", estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", carenciaLeiteHoras: 0, carenciaCarneHoras: 0 });
  }
  await criarEntradaValorizadaFixture({ data: { produtoId: produto.id, propriedadeId: sitio.id, data: new Date(antes(3)), tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", quantidade: saldo, custoUnitario: 1, valorTotal: saldo } });
  return { input: { versao: 1 as const, propriedadeId: sitio.id, itens }, produto, protocolo, programacao };
}

banco("execução comum de ações no PostgreSQL", () => {
  it("14 × 2 mL grava 14 fatos e 28 mL, preserva a outra ação de D0 e pagina/reenvia o recibo", async () => {
    const f = await fixture(14, 100);
    const antesPrevia = await prisma.auditoriaPecuaria.count({ where: { propriedadeId: f.input.propriedadeId } });
    const previa = await preverExecucaoProtocolo(f.input);
    expect(previa.tarefas.total).toBe(14); expect(previa.tarefas.itens).toHaveLength(10);
    expect(previa.consumos.itens[0].quantidade).toBe("28");
    expect(await prisma.auditoriaPecuaria.count({ where: { propriedadeId: f.input.propriedadeId } })).toBe(antesPrevia);
    expect(await prisma.aplicacaoProduto.count({ where: { propriedadeId: f.input.propriedadeId } })).toBe(0);
    const chave = crypto.randomUUID();
    const entrada = { execucao: f.input, chave, fingerprint: previa.fingerprint };
    const recibo = await confirmarExecucaoProtocolo(entrada, null);
    expect(recibo.total).toBe(14); expect(recibo.itens).toHaveLength(10);
    expect(await confirmarExecucaoProtocolo({ ...entrada, execucao: { ...f.input, itens: [...f.input.itens].reverse() } }, null)).toEqual(recibo);
    const segunda = await obterReciboExecucaoProtocolo(chave, f.input.propriedadeId, null, { pagina: 2 });
    expect(segunda.itens).toHaveLength(4);
    expect(new Set([...recibo.itens, ...segunda.itens].map(i => i.id)).size).toBe(14);
    expect(await prisma.aplicacaoProduto.count({ where: { propriedadeId: f.input.propriedadeId } })).toBe(14);
    expect((await obterSaldo(prisma, f.produto.id, f.input.propriedadeId)).toString()).toBe("72");
    const tarefas = await prisma.tarefaProtocolo.findMany({ where: { execucao: { rodadaId: f.programacao.id } }, include: { etapa: true } });
    expect(tarefas.filter(t => t.etapa.ordem === 2).every(t => !t.realizadaEm)).toBe(true);
    expect(tarefas.every(t => t.momentoSnapshot && typeof t.momentoSnapshot === "object" && !Array.isArray(t.momentoSnapshot) && t.momentoSnapshot.nome === "D0")).toBe(true);
    await expect(prisma.momentoProtocolo.create({ data: { protocoloId: f.protocolo.id, nome: "D8", ordem: 2 } })).rejects.toThrow();
    await expect(prisma.etapaProtocolo.delete({ where: { id: tarefas[0].etapaId } })).rejects.toThrow();
    await expect(prisma.momentoProtocolo.delete({ where: { id: f.protocolo.etapas[0].momentoId! } })).rejects.toThrow();
    await expect(prisma.protocolo.delete({ where: { id: f.protocolo.id } })).rejects.toThrow();
    const semUso = await criarProtocolo({ nome: `Sem adoção ${crypto.randomUUID()}`, etapas: [{ momento: { nome: "D0", ordem: 1 }, tipo: "APLICACAO", diaRelativo: 0, produtoId: f.produto.id, finalidade: "TRATAMENTO", dose: 1, unidade: "ML" }] }, null);
    protocolos.push(semUso.id);
    await publicarProtocolo(semUso.id, null);
    await prisma.protocolo.delete({ where: { id: semUso.id } });
    expect(await prisma.etapaProtocolo.count({ where: { protocoloId: semUso.id } })).toBe(0);
    expect(await prisma.momentoProtocolo.count({ where: { protocoloId: semUso.id } })).toBe(0);
    await expect(prisma.tarefaProtocolo.update({ where: { id: tarefas[0].id }, data: { momentoSnapshot: { nome: "Alterado" } } })).rejects.toThrow();
    await expect(obterReciboExecucaoProtocolo(chave, f.input.propriedadeId + 10000, null, {})).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  }, 60000);

  it("insuficiência após a prévia impede todas as ações selecionadas", async () => {
    const f = await fixture(2, 4);
    const previa = await preverExecucaoProtocolo(f.input);
    const { tarefaId: _tarefa, tipo: _tipo, ...avulsa } = f.input.itens[0];
    await criarAplicacao({ ...avulsa, dose: "1" }, null);
    await expect(confirmarExecucaoProtocolo({ execucao: f.input, chave: crypto.randomUUID(), fingerprint: previa.fingerprint }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.aplicacaoProduto.count({ where: { tarefaId: { in: f.input.itens.map(i => i.tarefaId) } } })).toBe(0);
    expect(await prisma.tarefaProtocolo.count({ where: { id: { in: f.input.itens.map(i => i.tarefaId) }, realizadaEm: { not: null } } })).toBe(0);
    expect((await obterSaldo(prisma, f.produto.id, f.input.propriedadeId)).toString()).toBe("3");
  }, 30000);

  it("confirmações concorrentes com chaves distintas preservam uma única realização", async () => {
    const f = await fixture(1, 10);
    const previa = await preverExecucaoProtocolo(f.input);
    const resultados = await Promise.allSettled([1, 2].map(() => confirmarExecucaoProtocolo({ execucao: f.input, chave: crypto.randomUUID(), fingerprint: previa.fingerprint }, null)));
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.aplicacaoProduto.count({ where: { tarefaId: f.input.itens[0].tarefaId } })).toBe(1);
    expect((await obterSaldo(prisma, f.produto.id, f.input.propriedadeId)).toString()).toBe("8");
  }, 30000);

  it("chave reapresentada com outra dose conflita e grupo não mistura participações individuais", async () => {
    const f = await fixture(2, 10);
    const previa = await preverExecucaoProtocolo(f.input);
    const chave = crypto.randomUUID();
    await confirmarExecucaoProtocolo({ execucao: f.input, chave, fingerprint: previa.fingerprint }, null);
    await expect(confirmarExecucaoProtocolo({ execucao: { ...f.input, itens: f.input.itens.map(i => ({ ...i, dose: "3" })) }, chave, fingerprint: previa.fingerprint }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    const novos=[];
    for(const item of f.input.itens){const p=await iniciarExecucao({animalId:item.animalId,propriedadeId:item.propriedadeId,protocoloId:f.protocolo.id,inicio:antes(2),confirmarSobreposicao:true,justificativaSobreposicao:"Nova inscrição explícita do teste"},null);novos.push({...item,tarefaId:p.tarefas[0].id});}
    await expect(preverExecucaoProtocolo({ ...f.input, itens: novos })).rejects.toMatchObject({ code: "VALIDACAO" });
  }, 30000);
  it("aplicação reprodutiva usa o mesmo contrato na ficha e na programação sem escrever durante a prévia", async () => {
    const f = await fixture(2, 10);
    const run=crypto.randomUUID().slice(0,8);
    const produtoGenetico=await prisma.produto.create({data:{nome:`Sêmen ações ${run}`,usoGenetico:true}});produtos.push(produtoGenetico.id);
    const touro=await prisma.genitorExterno.create({data:{nome:`Touro ações ${run}`,sexo:"M"}});genitores.push(touro.id);
    const material=await prisma.materialGenetico.create({data:{tipo:"SEMEN",produtoId:produtoGenetico.id,touroExternoId:touro.id}});materiais.push(material.id);
    const protocolo=await iatf.criarProtocolo(protocoloSchema.parse({nome:`Reprodutivo ações ${run}`,versao:1,publicado:true,etapas:[
      {nome:"Aplicação D0",tipo:"APLICACAO",momento:{nome:"D0",ordem:1},subtipo:"INSERCAO_DISPOSITIVO",intervalo:0,unidade:"DIAS",planoAplicacao:{produtoId:f.produto.id,dose:"2",unidadeDose:"ML"}},
      {nome:"Tentativa planejada",tipo:"TENTATIVA",momento:{nome:"D10",ordem:2},intervalo:10,unidade:"DIAS",planoTentativa:{tipo:"IA",materialId:material.id,quantidade:1}},
    ]}),null);protocolos.push(protocolo.id);
    const grupo=await iatf.criarProgramacao(programacaoSchema.parse({chave:crypto.randomUUID(),propriedadeId:f.input.propriedadeId,protocoloId:protocolo.id,nome:`Programação ações ${run}`,inicioPrevisto:antes(2),animais:f.input.itens.map(i=>({animalId:i.animalId}))}),null);
    const participacoes=await prisma.participacaoProtocolo.findMany({where:{rodadaId:grupo.id},include:{tarefas:{orderBy:{etapa:{ordem:"asc"}}}}});
    const input:ExecucaoProtocoloInput={...f.input,itens:participacoes.map(p=>({...f.input.itens.find(i=>i.animalId===p.animalId)!,tarefaId:p.tarefas[0].id}))};
    const calendarioAntes=await prisma.tarefaProtocolo.findMany({where:{execucao:{rodadaId:grupo.id}},orderBy:{id:"asc"}});
    const previa=await preverExecucaoProtocolo(input);
    expect(await prisma.tarefaProtocolo.findMany({where:{execucao:{rodadaId:grupo.id}},orderBy:{id:"asc"}})).toEqual(calendarioAntes);
    expect(await prisma.participacaoProtocolo.count({where:{rodadaId:grupo.id,inicioEfetivo:{not:null}}})).toBe(0);
    const recibo=await confirmarExecucaoProtocolo({execucao:input,chave:crypto.randomUUID(),fingerprint:previa.fingerprint},null);
    expect(recibo.total).toBe(2);
    expect(await prisma.aplicacaoProduto.count({where:{tarefaId:{in:input.itens.map(i=>i.tarefaId)}}})).toBe(2);
    expect((await obterSaldo(prisma,f.produto.id,input.propriedadeId)).toString()).toBe("6");
    expect(await obterCabecalhoOperacao({participacaoId:participacoes[0].id},input.propriedadeId)).toMatchObject({animal:{id:participacoes[0].animalId},contagens:{atendidos:1}});
    expect(await obterCabecalhoOperacao({programacaoId:grupo.id},input.propriedadeId)).toMatchObject({contagens:{atendidos:2}});
    expect(await prisma.gestacaoAnimal.count({where:{animalId:{in:input.itens.map(i=>i.animalId)}}})).toBe(0);
  },60000);

});
