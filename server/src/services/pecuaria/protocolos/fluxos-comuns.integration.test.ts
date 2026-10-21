import { paginaSubstitutosTarefa } from "./substitutos.js";
import { criarRodada } from "../sanidade/rodadas.js";
import { obterCabecalhoOperacao, listarEtapasOperacao, listarTarefasOperacao, listarEventosTarefaOperacao, listarParticipacoesOperacao, listarVersoesOperacao, listarParticipantesOperacao, listarOrigensFatoOperacao } from "./operacao.js";
import { consultaOperacaoSchema, listaOperacaoSchema, consultaVersoesOperacaoSchema, consultaOrigensFatoOperacaoSchema } from "./operacao.schemas.js";
import { registrarEventoTarefa } from "./eventos.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { criarEntradaValorizadaFixture, limparMovimentosValorizadosFixture } from "../../../test/estoque-valorizado.fixture.js";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { criarTipoExame, editarTipoExame, listarTiposExame, registrarExame, corrigirExame } from "../sanidade/exames.js";
import { criarProtocolo, publicarProtocolo, iniciarExecucao, listarTarefas } from "../sanidade/protocolos.js";
import { criarAplicacao, anularAplicacao } from "../sanidade/aplicacoes.js";
import { consultaSanitariaSchema } from "../sanidade/consulta.js";
import { criarVisita, adicionarAtividade, confirmarAtividade, salvarRascunho, regularizarParticipanteVisita, encerrarVisita, imprimirVisita, sugestoesVisita } from "../reproducao/visitas.js";
import { atividadeSchema, confirmacaoVisitaSchema, protocoloSchema } from "../reproducao/schemas.js";
import { anularFato, previaAnulacao } from "../reproducao/correcoes.js";
import * as iatf from "../reproducao/iatf.js";
import { regularizarTarefaSanitaria, substitutosTarefaComum } from "./regularizacao.js";
import type { CampoExame } from "../exames/formatos.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const animais: string[] = [], tipos: string[] = [], protocolos: string[] = [], visitas: string[] = [], produtos: string[] = [], genitores: string[] = [];
let sitio: number;
const sitiosExtras: number[] = [];
const data = "2026-09-15";
const instante = `${data}T12:00:00Z`;
const chave = () => crypto.randomUUID();
const campos: CampoExame[] = [
  { codigo: "CONCLUSAO_GESTACIONAL", tipo: "OPCAO", obrigatorio: false, opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"] },
  { codigo: "SEXO_FETAL", tipo: "OPCAO", obrigatorio: false, opcoes: ["M", "F"] },
  { codigo: "MEDIDA", rotulo: "Medida", tipo: "NUMERO", unidade: "mm", obrigatorio: true },
  { codigo: "ACHADO", rotulo: "Achado", tipo: "BOOLEANO", obrigatorio: false },
];
// Fixtures exclusivas; nenhuma alteração no catálogo global, seed ou banco auxiliar.
afterAll(async () => {
  if (!sitio) return;
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: [sitio, ...sitiosExtras] } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId: sitio }, { animalId: { in: animais } }, { entidadeId: { in: [...tipos, ...protocolos] } }] } });
  await prisma.participanteVisita.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.impressaoVisita.deleteMany({ where: { visitaId: { in: visitas } } });
  await prisma.atividadeVisita.deleteMany({ where: { visitaId: { in: visitas } } });
  await prisma.visitaVeterinaria.deleteMany({ where: { id: { in: visitas } } });
  await prisma.eventoTarefaProtocolo.deleteMany({ where: { tarefa: { execucao: { animalId: { in: animais } } }, tipo: "RETIFICACAO_JUSTIFICATIVA" } });
  await prisma.eventoTarefaProtocolo.deleteMany({ where: { tarefa: { execucao: { animalId: { in: animais } } } } });
  await prisma.vinculoTarefaProtocolo.deleteMany({ where: { tarefa: { execucao: { animalId: { in: animais } } } } });
  await prisma.interpretacaoReprodutiva.deleteMany({ where: { exame: { animalId: { in: animais } } } });
  await prisma.exameAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.tarefaProtocolo.deleteMany({ where: { execucao: { animalId: { in: animais } } } });
  await prisma.participacaoProtocolo.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.programacaoProtocolo.deleteMany({ where: { propriedadeId: sitio } });
  await prisma.protocolo.deleteMany({ where: { id: { in: protocolos } } });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tipos } } });
  await prisma.materialGenetico.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.genitorExterno.deleteMany({ where: { id: { in: genitores } } });
  await limparMovimentosValorizadosFixture(produtos);
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.finalidadeAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: [sitio, ...sitiosExtras] } } });
});
async function animal() {
  const a = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `FC${animais.length}${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: sitio }), null);
  animais.push(a.id); return a.id;
}
async function tipo(reprodutivo = false) {
  const t = await criarTipoExame({ nome: `Fluxo ${tipos.length} ${run}`, tipoResultado: reprodutivo ? "MULTIPLO" : "NUMERO", ...(reprodutivo ? { campos } : { unidade: "mg" }) }, null, reprodutivo ? "REPRODUTIVO" : "SANITARIO");
  tipos.push(t.id); return t;
}
async function tarefa() {
  const animalId = await animal(), t = await tipo();
  const p = await criarProtocolo({ nome: `Protocolo ${protocolos.length} ${run}`, etapas: [{ diaRelativo: 0, tipo: "EXAME", tipoExameId: t.id }] }, null);
  protocolos.push(p.id); await publicarProtocolo(p.id, null);
  const e = await iniciarExecucao({ protocoloId: p.id, animalId, propriedadeId: sitio, inicio: data }, null);
  return { animalId, tipoExameId: t.id, tarefaId: e.tarefas[0].id, propriedadeId: sitio, data };
}
async function protocoloManejos(nome: string) {
  const produto = await prisma.produto.create({ data: { nome: `Material ${nome} ${run}`, usoGenetico: true } }); produtos.push(produto.id);
  const touro = await prisma.genitorExterno.create({ data: { nome: `Touro ${nome} ${run}`, sexo: "M" } }); genitores.push(touro.id);
  const material = await prisma.materialGenetico.create({ data: { tipo: "SEMEN", produtoId: produto.id, touroExternoId: touro.id } });
  const p = await iatf.criarProtocolo(protocoloSchema.parse({ nome: `${nome} ${run}`, versao: 1, publicado: true, etapas: [
    { nome: "Manejo inicial", tipo: "MANEJO", intervalo: 0, unidade: "DIAS" },
    { nome: "Manejo seguinte", tipo: "MANEJO", intervalo: 2, unidade: "DIAS" },
    { nome: "IA planejada", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS", planoTentativa: { tipo: "IA", materialId: material.id, quantidade: 1 } },
  ] }), null); protocolos.push(p.id);
  return p;
}
async function atividade(animalId: string, tipo: "AVALIACAO_REPRODUTIVA" | "EXAME_SANITARIO", tarefaId?: string) {
  const v = await criarVisita({ nome: `Visita ${run}`, propriedadeId: sitio, data }, null); visitas.push(v.id);
  const a = await adicionarAtividade(v.id, atividadeSchema.parse({ nome: "Exames coletivos", tipo, propriedadeId: sitio, participantes: [{ animalId, ...(tarefaId ? { tarefaSanitariaId: tarefaId } : {}) }] }), null);
  return { visitaId: v.id, atividadeId: a.id, participanteId: a.participantes[0].id };
}
const regularizacao = (acao: "REABRIR" | "ENCERRAR_SEM_SUBSTITUICAO" | "VINCULAR_SUBSTITUTO", fatoId?: string) => ({ propriedadeId: sitio, chave: chave(), motivo: "Correção conferida com responsável", acao, cienciaNaoExecutado: true, ...(fatoId ? { fatoId } : {}) });
comBanco("tarefas, regularização e exames personalizados na base comum", () => {
  beforeAll(async () => { exigirBancoIntegracaoPecuaria(); sitio = (await prisma.propriedade.create({ data: { nome: `Fluxos comuns ${run}` } })).id; });
  it("anulação exige regularizar; substituto anterior por data de criação vira a referência atual", async () => {
    const t = await tarefa();
    const substituto = await registrarExame({ ...t, tarefaId: undefined, resultadoNumero: 0 }, null);
    const original = await registrarExame({ ...t, resultadoNumero: 1 }, null);
    await corrigirExame(original.id, sitio, { anular: true, motivo: "Registro duplicado comprovado" }, null);
    expect((await sugestoesVisita(sitio, data)).tarefasSanitarias.some(v => v.id === t.tarefaId)).toBe(false);
    await expect(atividade(t.animalId, "EXAME_SANITARIO", t.tarefaId)).rejects.toMatchObject({ code: "VALIDACAO" });
    const filtro = consultaSanitariaSchema.parse({ situacao: "REGULARIZACAO_PENDENTE" });
    expect((await listarTarefas(sitio, t.animalId, filtro))[0]).toMatchObject({ id: t.tarefaId, situacao: "REGULARIZACAO_PENDENTE", propriedadeRegularizacaoId: sitio });
    await expect(registrarExame({ ...t, resultadoNumero: 2 }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await substitutosTarefaComum(t.tarefaId, sitio, "SANITARIO")).toEqual(expect.arrayContaining([expect.objectContaining({ id: substituto.id })]));
    await expect(substitutosTarefaComum(t.tarefaId, sitio + 10000, "SANITARIO")).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    await expect(regularizarTarefaSanitaria(t.tarefaId, { ...regularizacao("REABRIR"), propriedadeId: sitio + 10000 }, null)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    const r = regularizacao("VINCULAR_SUBSTITUTO", substituto.id);
    expect(JSON.parse(JSON.stringify(await regularizarTarefaSanitaria(t.tarefaId, r, null)))).toEqual(await regularizarTarefaSanitaria(t.tarefaId, r, null));
    expect((await listarTarefas(sitio, t.animalId))[0].situacao).toBe("REALIZADA");
    await corrigirExame(substituto.id, sitio, { anular: true, motivo: "Amostra inválida após revisão" }, null);
    await regularizarTarefaSanitaria(t.tarefaId, regularizacao("ENCERRAR_SEM_SUBSTITUICAO"), null);
    expect((await listarTarefas(sitio, t.animalId, consultaSanitariaSchema.parse({ situacao: "ENCERRADA_SEM_SUBSTITUICAO" })))[0].situacao).toBe("ENCERRADA_SEM_SUBSTITUICAO");
    expect(await prisma.vinculoTarefaProtocolo.findMany({ where: { tarefaId: t.tarefaId }, orderBy: { ordem: "asc" } })).toMatchObject([{ exameId: original.id, estado: "SUBSTITUIDO" }, { exameId: substituto.id, estado: "ENCERRADO" }]);
  });
  it("substitutos paginados excluem ocupados antes de contar e alcançam o décimo primeiro", async () => {
    const t=await tarefa();
    for(let n=0;n<11;n++)await registrarExame({...t,tarefaId:undefined,resultadoNumero:n},null);
    const outro=await criarProtocolo({nome:`Origem ocupada ${run}`,etapas:[{diaRelativo:0,tipo:"EXAME",tipoExameId:t.tipoExameId}]},null);
    protocolos.push(outro.id);await publicarProtocolo(outro.id,null);
    const outra=await iniciarExecucao({protocoloId:outro.id,animalId:t.animalId,propriedadeId:sitio,inicio:data},null);
    const ocupado=await registrarExame({...t,tarefaId:outra.tarefas[0].id,resultadoNumero:99},null);
    const original=await registrarExame({...t,resultadoNumero:100},null);
    await corrigirExame(original.id,sitio,{anular:true,motivo:"Revisão para escolher a evidência correta"},null);
    const primeira=await paginaSubstitutosTarefa(t.tarefaId,sitio,{},"SANITARIO");
    const segunda=await paginaSubstitutosTarefa(t.tarefaId,sitio,{pagina:2},"SANITARIO");
    expect(primeira).toMatchObject({total:11,pagina:1,porPagina:10});expect(primeira.itens).toHaveLength(10);
    expect(segunda.itens).toHaveLength(1);expect(new Set([...primeira.itens,...segunda.itens].map(i=>i.id)).size).toBe(11);
    expect([...primeira.itens,...segunda.itens].some(i=>i.id===ocupado.id)).toBe(false);
    expect(await paginaSubstitutosTarefa(t.tarefaId,sitio,{pagina:99},"SANITARIO")).toMatchObject({total:11,pagina:2});
    expect(await paginaSubstitutosTarefa(t.tarefaId,sitio,{busca:"Inexistente"},"SANITARIO")).toMatchObject({total:0,pagina:1});
    await expect(paginaSubstitutosTarefa(t.tarefaId,sitio+10000,{},"SANITARIO")).rejects.toMatchObject({code:"NAO_ENCONTRADO"});
  });
  it("reabertura pela visita preserva impressão, incrementa rascunho e permite somente nova execução", async () => {
    const t = await tarefa(), a = await atividade(t.animalId, "EXAME_SANITARIO", t.tarefaId);
    const impressao = await imprimirVisita(a.visitaId, sitio, null);
    const input = confirmacaoVisitaSchema.parse({ propriedadeId: sitio, chave: chave(), itens: [{ participanteId: a.participanteId, dados: { tipoExameId: t.tipoExameId, resultadoNumero: 0 } }] });
    await confirmarAtividade(a.visitaId, a.atividadeId, input, null);
    const exame = await prisma.exameAnimal.findFirstOrThrow({ where: { tarefaId: t.tarefaId, status: "VALIDO" } });
    await corrigirExame(exame.id, sitio, { anular: true, motivo: "Exame não executado no animal" }, null);
    expect(await prisma.participanteVisita.findUniqueOrThrow({ where: { id: a.participanteId } })).toMatchObject({ regularizacaoPendente: true });
    await regularizarParticipanteVisita(a.visitaId, a.participanteId, regularizacao("REABRIR"), null);
    expect(await prisma.participanteVisita.findUniqueOrThrow({ where: { id: a.participanteId } })).toMatchObject({ status: "PENDENTE", regularizacaoPendente: false, versaoRascunho: 2, fatoId: null });
    expect((await listarTarefas(sitio, t.animalId))[0].situacao).toBe("PENDENTE");
    await confirmarAtividade(a.visitaId, a.atividadeId, { ...input, chave: chave() }, null);
    expect(await prisma.exameAnimal.count({ where: { tarefaId: t.tarefaId } })).toBe(2);
    expect((await prisma.impressaoVisita.findUniqueOrThrow({ where: { id: impressao.id } })).snapshot).toEqual(impressao.snapshot);
  });
  it("visita encerrada bloqueia reabertura; encerramento sem substituição preserva o histórico", async () => {
    const t = await tarefa(), a = await atividade(t.animalId, "EXAME_SANITARIO", t.tarefaId);
    await confirmarAtividade(a.visitaId, a.atividadeId, confirmacaoVisitaSchema.parse({ propriedadeId: sitio, chave: chave(), itens: [{ participanteId: a.participanteId, dados: { tipoExameId: t.tipoExameId, resultadoNumero: 2 } }] }), null);
    await encerrarVisita(a.visitaId, sitio, null);
    const e = await prisma.exameAnimal.findFirstOrThrow({ where: { tarefaId: t.tarefaId } });
    await corrigirExame(e.id, sitio, { anular: true, motivo: "Correção após fechamento da visita" }, null);
    await expect(regularizarTarefaSanitaria(t.tarefaId, regularizacao("REABRIR"), null)).rejects.toMatchObject({ code: "CONFLITO" });
    await regularizarTarefaSanitaria(t.tarefaId, regularizacao("ENCERRAR_SEM_SUBSTITUICAO"), null);
    expect(await prisma.participanteVisita.findUniqueOrThrow({ where: { id: a.participanteId } })).toMatchObject({ status: "CONFIRMADO", regularizacaoPendente: false, fatoId: e.id });
  });
  it("consumo mantido bloqueia reexecução e regularização não movimenta estoque", async () => {
    const animalId = await animal();
    const produto = await prisma.produto.create({ data: { nome: `Produto fluxo ${run}`, unidade: "ML", usoSanitario: true } }); produtos.push(produto.id);
    const p = await criarProtocolo({ nome: `Aplicação ${run}`, etapas: [{ tipo: "APLICACAO", diaRelativo: 0, produtoId: produto.id, finalidade: "TRATAMENTO", dose: 1, unidade: "ML" }] }, null); protocolos.push(p.id); await publicarProtocolo(p.id, null);
    const ex = await iniciarExecucao({ protocoloId: p.id, animalId, propriedadeId: sitio, inicio: data }, null);
    const m = await criarEntradaValorizadaFixture({ data: { produtoId: produto.id, propriedadeId: sitio, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date(data), quantidade: 10, custoUnitario: 1, valorTotal: 10 } });
    const ap = await criarAplicacao({ animalId, propriedadeId: sitio, data, aplicadaEm: instante, produtoId: produto.id, nomeProdutoAplicado: produto.nome, origemInsumo: "BAIXA_ESTOQUE", dose: "1", unidadeDose: "ML", finalidade: "TRATAMENTO", tarefaId: ex.tarefas[0].id, cienciaValidadeDesconhecida: true, estadoCarenciaLeite: "NAO_INFORMADO", estadoCarenciaCarne: "NAO_INFORMADO" }, null);
    await expect(anularAplicacao(ap.id, sitio, "Material utilizado no campo", null)).rejects.toMatchObject({ code: "VALIDACAO" });
    await anularAplicacao(ap.id, sitio, "Material utilizado no campo", null, "MANTER_CONSUMO", true);
    await expect(regularizarTarefaSanitaria(ex.tarefas[0].id, regularizacao("REABRIR"), null)).rejects.toMatchObject({ code: "VALIDACAO" });
    await regularizarTarefaSanitaria(ex.tarefas[0].id, regularizacao("ENCERRAR_SEM_SUBSTITUICAO"), null);
    expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: sitio, produtoId: produto.id } })).toBe(2);
    expect((await prisma.movimentoEstoque.findUniqueOrThrow({ where: { id: m.id } })).quantidade.toString()).toBe("10");
  });
  it("visita coletiva salva campos personalizados, impede sobrescrita e reenvio não duplica exame", async () => {
    const animalId = await animal(), t = await tipo(true), a = await atividade(animalId, "AVALIACAO_REPRODUTIVA");
    const hash = (await listarTiposExame(false, "REPRODUTIVO")).find(v => v.id === t.id)!.formatoExameHash;
    const dados = { status: "CONFIRMADO", tipoExameId: t.id, formatoExameHash: hash, finalidade: "DIAGNOSTICO", resultado: "NEGATIVO", resultados: [{ campo: "MEDIDA", valor: "0" }, { campo: "ACHADO", valor: false }] };
    const r = await salvarRascunho(a.visitaId, a.participanteId, sitio, dados, null, 0);
    await expect(salvarRascunho(a.visitaId, a.participanteId, sitio, dados, null, 0)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(r.rascunho).toMatchObject(dados);
    const input = confirmacaoVisitaSchema.parse({ propriedadeId: sitio, chave: chave(), itens: [{ participanteId: a.participanteId }] });
    expect(JSON.parse(JSON.stringify(await confirmarAtividade(a.visitaId, a.atividadeId, input, null)))).toEqual(await confirmarAtividade(a.visitaId, a.atividadeId, input, null));
    const e = await prisma.exameAnimal.findFirstOrThrow({ where: { animalId, tipoExameId: t.id }, include: { resultados: true, interpretacao: true } });
    expect(e.resultados).toEqual(expect.arrayContaining([expect.objectContaining({ campo: "MEDIDA", valor: "0" }), expect.objectContaining({ campo: "ACHADO", valor: false }), expect.objectContaining({ campo: "CONCLUSAO_GESTACIONAL", valor: "NEGATIVO" })]));
    expect(e.interpretacao).not.toBeNull(); expect(await prisma.exameAnimal.count({ where: { animalId } })).toBe(1);
  });
  it("formato alterado depois do rascunho exige revisão, sem confirmar parcialmente", async () => {
    const animalId = await animal(), t = await tipo(true), a = await atividade(animalId, "AVALIACAO_REPRODUTIVA");
    await salvarRascunho(a.visitaId, a.participanteId, sitio, { tipoExameId: t.id, resultado: "NEGATIVO", resultados: [{ campo: "MEDIDA", valor: "1" }] }, null, 0);
    await editarTipoExame(t.id, { campos: [...campos, { codigo: "OUTRO", tipo: "TEXTO", obrigatorio: false }] }, null);
    await expect(confirmarAtividade(a.visitaId, a.atividadeId, confirmacaoVisitaSchema.parse({ propriedadeId: sitio, chave: chave(), itens: [{ participanteId: a.participanteId }] }), null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await prisma.exameAnimal.count({ where: { animalId } })).toBe(0);
    expect((await prisma.participanteVisita.findUniqueOrThrow({ where: { id: a.participanteId } })).status).toBe("PENDENTE");
  });
  it("protocolo publica o tipo reprodutivo escolhido e a tarefa executa sua versão congelada", async () => {
    const animalId = await animal(), t = await tipo(true), exameSanitario = await tipo();
    const produto = await prisma.produto.create({ data: { nome: `Sêmen plano ${run}`, usoGenetico: true } }); produtos.push(produto.id);
    const touro = await prisma.genitorExterno.create({ data: { nome: `Touro ${run}`, sexo: "M" } }); genitores.push(touro.id);
    const material = await prisma.materialGenetico.create({ data: { tipo: "SEMEN", produtoId: produto.id, touroExternoId: touro.id } });
    const p = await iatf.criarProtocolo(protocoloSchema.parse({ nome: `Reprodução ${run}`, versao: 1, publicado: true, etapas: [
      { nome: "Diagnóstico personalizado", tipo: "AVALIACAO", intervalo: 0, unidade: "DIAS", planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: t.id } },
      { nome: "Exame sanitário", tipo: "EXAME", intervalo: 0, unidade: "DIAS", planoExame: { tipoExameId: exameSanitario.id } },
      { nome: "IA planejada", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS", planoTentativa: { tipo: "IA", materialId: material.id, quantidade: 1 } },
    ] }), null); protocolos.push(p.id);
    expect(await prisma.etapaProtocolo.findFirstOrThrow({ where: { protocoloId: p.id, ordem: 1 } })).toMatchObject({ tipoExameId: t.id, configuracao: { planoAvaliacao: { tipoExameId: t.id }, referencias: { exame: { nome: t.nome, versao: 1 } } } });
    await expect(editarTipoExame(t.id, { campos: [...campos, { codigo: "OUTRO", tipo: "TEXTO", obrigatorio: false }] }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    const prog = await iatf.criarProgramacao({ chave: chave(), propriedadeId: sitio, protocoloId: p.id, nome: "Ciclo de teste", inicioPrevisto: instante, animais: [{ animalId }] }, null);
    const part = await prisma.participanteIatf.findFirstOrThrow({ where: { programacaoId: prog.id } });
    await iatf.iniciarParticipante(part.id, sitio, instante, null);
    const tarefa = await prisma.tarefaIatf.findFirstOrThrow({ where: { participanteId: part.id, tipo: "AVALIACAO" } });
    await iatf.executarTarefa(tarefa.id, { propriedadeId: sitio, chave: chave(), realizadaEm: instante, dados: { resultado: "NEGATIVO", finalidade: "DIAGNOSTICO", resultados: [{ campo: "MEDIDA", valor: 0 }] } }, null);
    expect(await prisma.exameAnimal.findFirstOrThrow({ where: { animalId } })).toMatchObject({ tipoExameId: t.id, formatoSnapshot: { nome: t.nome, versao: 1 } });
    expect((await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: tarefa.id } })).desviosSnapshot).toMatchObject({ diferencas: [] });
    const exame = await prisma.exameAnimal.findFirstOrThrow({ where: { animalId } });
    const previa = await previaAnulacao("avaliacoes", exame.id, sitio);
    await anularFato("avaliacoes", exame.id, { propriedadeId: sitio, chave: chave(), motivo: "Procedimento registrado no animal errado", fingerprint: previa.fingerprint }, null);
    expect((await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: tarefa.id } })).regularizacaoPendente).toBe(true);
    const reaberta = await iatf.regularizarTarefa(tarefa.id, regularizacao("REABRIR"), null);
    expect(reaberta).toMatchObject({ realizadaEm: null, avaliacaoId: null, regularizacaoPendente: false });
    await iatf.executarTarefa(tarefa.id, { propriedadeId: sitio, chave: chave(), realizadaEm: instante, dados: { resultado: "NEGATIVO", finalidade: "DIAGNOSTICO", resultados: [{ campo: "MEDIDA", valor: 1 }] } }, null);
    expect(await prisma.exameAnimal.count({ where: { animalId } })).toBe(2);
    expect((await sugestoesVisita(sitio, data)).tarefasSanitarias.some(v => v.animalId === animalId)).toBe(false);
    const tarefaSanitaria = await prisma.tarefaIatf.findFirstOrThrow({ where: { participanteId: part.id, tipo: "EXAME" } });
    const realizada = await iatf.executarTarefa(tarefaSanitaria.id, { propriedadeId: sitio, chave: chave(), realizadaEm: instante, dados: { tipoExameId: exameSanitario.id, resultadoNumero: 0 } }, null);
    expect(await prisma.exameAnimal.findUniqueOrThrow({ where: { id: realizada.exameId! } })).toMatchObject({ tipoExameId: exameSanitario.id, realizacao: "REALIZADO" });
    expect((await prisma.exameAnimal.findUniqueOrThrow({ where: { id: realizada.exameId! } })).resultadoNumero?.toString()).toBe("0");
  });
  it("não atendimento, reenvio concorrente, retificação e adiamento preservam execução e estoque", async () => {
    const t = await tarefa(), outro = await tarefa();
    const movimentosAntes = await prisma.movimentoEstoque.count({ where: { propriedadeId: sitio } });
    const input = { chave: chave(), propriedadeId: sitio, tipo: "NAO_ATENDIDO" as const,
      ocorridaEm: instante, motivo: "Animal não encontrado para coleta" };
    const [a, b] = await Promise.all([registrarEventoTarefa(t.tarefaId, input, null), registrarEventoTarefa(t.tarefaId, input, null)]);
    expect(a.id).toBe(b.id);
    expect(await prisma.eventoTarefaProtocolo.count({ where: { tarefaId: t.tarefaId } })).toBe(1);
    await expect(registrarEventoTarefa(t.tarefaId, { ...input, motivo: "Outro motivo usando mesma chave" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    const retificacao = { ...input, chave: chave(), tipo: "RETIFICACAO_JUSTIFICATIVA" as const, eventoCorrigidoId: a.id,
      motivo: "Animal localizado, mas contenção indisponível" };
    await expect(registrarEventoTarefa(outro.tarefaId, retificacao, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    await registrarEventoTarefa(t.tarefaId, retificacao, null);
    expect((await prisma.eventoTarefaProtocolo.findUniqueOrThrow({ where: { id: a.id } })).motivo).toBe(input.motivo);
    const original = await prisma.tarefaProtocolo.findUniqueOrThrow({ where: { id: t.tarefaId } });
    const outraTarefa = await prisma.tarefaProtocolo.findUniqueOrThrow({ where: { id: outro.tarefaId } });
    await expect(prisma.tarefaProtocolo.create({ data: { execucaoId: original.execucaoId,
      etapaId: outraTarefa.etapaId, previstaPara: original.previstaPara } })).rejects.toThrow();
    await expect(prisma.eventoTarefaProtocolo.update({ where: { id: a.id }, data: { motivo: "Tentativa indevida de apagar justificativa" } })).rejects.toThrow();
    await registrarEventoTarefa(t.tarefaId, { ...input, chave: chave(), tipo: "ADIAMENTO", previstaPara: "2026-09-16" }, null);
    const adiada = await prisma.tarefaProtocolo.findUniqueOrThrow({ where: { id: t.tarefaId } });
    expect(adiada).toMatchObject({ previstaPara: new Date("2026-09-16"), previsaoOriginal: original.previstaPara, realizadaEm: null, precisaoTemporal: "DIA" });
    expect(adiada.parametros).toEqual(original.parametros);
    expect(await prisma.exameAnimal.count({ where: { animalId: t.animalId } })).toBe(0);
    expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: sitio } })).toBe(movimentosAntes);
    await registrarExame({ ...t, data: "2026-09-16", resultadoNumero: 0 }, null);
    await expect(registrarEventoTarefa(t.tarefaId, { ...input, chave: chave() }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await prisma.eventoTarefaProtocolo.count({ where: { tarefaId: t.tarefaId } })).toBe(3);
    expect((await prisma.participacaoProtocolo.findFirstOrThrow({ where: { animalId: t.animalId } })).inicioEfetivo).toEqual(new Date("2026-09-16"));
  });
  it("adesão individual reprodutiva cria tarefas sem início fictício e primeira execução não desloca as seguintes", async () => {
    const animalId = await animal();
    const p = await protocoloManejos("Individual");
    const input = { chave: chave(), propriedadeId: sitio, protocoloId: p.id, animalId, inicioReferencia: data };
    const part = await iatf.criarParticipacaoIndividualReprodutiva(input, null);
    expect((await iatf.criarParticipacaoIndividualReprodutiva(input, null)).id).toBe(part.id);
    expect(part).toMatchObject({ rodadaId: null, origemCalendario: "REFERENCIA_PROGRAMADA", inicioEfetivo: null });
    const tarefas = await prisma.tarefaIatf.findMany({ where: { participanteId: part.id }, orderBy: { etapa: "asc" } });
    expect(tarefas).toHaveLength(3);
    const executar = { chave: chave(), propriedadeId: sitio, realizadaEm: "2026-09-16", motivo: "Atendimento adiado para outro dia", dados: {} };
    const [a,b] = await Promise.all([iatf.executarTarefa(tarefas[0].id, executar, null), iatf.executarTarefa(tarefas[0].id, executar, null)]);
    expect(a.id).toBe(b.id);
    const atual = await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: part.id } });
    expect(atual).toMatchObject({ inicioEfetivo: new Date("2026-09-16"), precisaoInicioEfetivo: "DIA" });
    expect((await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: tarefas[1].id } })).previstaEm).toEqual(tarefas[1].previstaEm);
    await expect(iatf.executarTarefa(tarefas[0].id, { ...executar, chave: chave() }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.auditoriaPecuaria.count({ where: { entidadeId: tarefas[0].id, acao: "EXECUCAO" } })).toBe(1);
    await iatf.retirarParticipante(part.id, sitio, "Retirada do protocolo individual", null);
    expect((await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: part.id } })).canceladaEm).not.toBeNull();
  });
  it("participação legada sem início reancora no fato verdadeiro sem converter origem ou reescrever previsão original", async () => {
    const animalId = await animal();
    const p = await protocoloManejos("Legado");
    const part = await iatf.criarParticipacaoIndividualReprodutiva({ chave: chave(), propriedadeId: sitio, protocoloId: p.id, animalId, inicioReferencia: data }, null);
    // Fixture representa a origem atribuída exclusivamente pelo backfill de participações antigas.
    await prisma.participacaoProtocolo.update({ where: { id: part.id }, data: { origemCalendario: "INICIO_EFETIVO_LEGADO" } });
    const tarefas = await prisma.tarefaIatf.findMany({ where: { participanteId: part.id }, orderBy: { etapa: "asc" } });
    const antes = await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: part.id }, include: { tarefas: { orderBy: { id: "asc" } } } });
    const auditoriasAntes = await prisma.auditoriaPecuaria.count({ where: { animalId } });
    const previa = await iatf.preverInicioExecucaoTarefa(tarefas[0].id, { propriedadeId: sitio, realizadaEm: "2026-09-16", porPagina: 1 });
    expect(previa).toMatchObject({ exigeCiencia: true, modoLegado: true, total: 3, pagina: 1, porPagina: 1 });
    expect(previa.itens).toHaveLength(1);
    expect((await iatf.preverInicioExecucaoTarefa(tarefas[0].id, { propriedadeId: sitio, realizadaEm: "2026-09-16", pagina: 2, porPagina: 1 })).itens[0]).toMatchObject({ id: tarefas[1].id, previstaAnterior: "2026-09-17", previstaNova: "2026-09-18" });
    await expect(iatf.executarTarefa(tarefas[0].id, { chave: chave(), propriedadeId: sitio, realizadaEm: "2026-09-16", dados: {} }, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "cienciaRecalendarioLegado" });
    expect(await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: part.id }, include: { tarefas: { orderBy: { id: "asc" } } } })).toEqual(antes);
    expect(await prisma.auditoriaPecuaria.count({ where: { animalId } })).toBe(auditoriasAntes);
    await iatf.executarTarefa(tarefas[0].id, { chave: chave(), propriedadeId: sitio, realizadaEm: "2026-09-16", dados: {}, cienciaRecalendarioLegado: true }, null);
    const seguinte = await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: tarefas[1].id } });
    expect(seguinte.previstaEm).toEqual(new Date("2026-09-18"));
    expect(seguinte.previsaoOriginal).toEqual(tarefas[1].previsaoOriginal);
    expect((await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: part.id } })).origemCalendario).toBe("INICIO_EFETIVO_LEGADO");
  });


  it("consultas SQL paginam 21 tarefas e resolvem a pendência pelo fato da ficha", async () => {
    const t = await tipo();
    const p = await criarProtocolo({ nome: `Consulta operacional ${run}`, etapas: [{ diaRelativo: 0, tipo: "EXAME", tipoExameId: t.id }] }, null);
    protocolos.push(p.id); await publicarProtocolo(p.id, null);
    const ids: string[] = []; for (let i = 0; i < 21; i++) ids.push(await animal());
    const r = await criarRodada({ chave: chave(), propriedadeId: sitio, protocoloId: p.id, nome: `Grupo consulta ${run}`, inicioReferencia: data, itens: ids.map(animalId => ({ animalId })) }, null);
    const c = { programacaoId: r.id }, u = { dono: false, areas: ["pecuaria"], flags: ["lancar"] };
    const etapas = await listarEtapasOperacao(c, sitio, consultaOperacaoSchema.parse({}));
    const etapaId = etapas.itens[0].id;
    const paginas = []; for (const pagina of [1, 2, 3]) paginas.push(await listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({ etapaId, pagina }), u));
    expect(paginas.map(v => v.itens.length)).toEqual([10, 10, 1]);
    expect(new Set(paginas.flatMap(v => v.itens.map(t => t.id))).size).toBe(21);
    for (const pagina of paginas) { expect(pagina.total).toBe(21); expect(pagina.resumo?.total).toBe(21); }
    const participantesPaginados = await Promise.all([1, 2, 3].map(pagina => listarParticipantesOperacao(c, sitio, consultaOperacaoSchema.parse({ pagina }))));
    expect(participantesPaginados.map(p => p.itens.length)).toEqual([10, 10, 1]);
    expect(new Set(participantesPaginados.flatMap(p => p.itens.map(v => v.id))).size).toBe(21);
    for (const pagina of participantesPaginados) { expect(pagina.total).toBe(21); for (const item of pagina.itens) expect(item).not.toHaveProperty("tarefas"); }
    expect((await obterCabecalhoOperacao(c, sitio, u)).participantesTotal).toBe(21);
    const alvo = paginas[0].itens[0];
    await registrarEventoTarefa(alvo.id, { chave: chave(), propriedadeId: sitio, tipo: "NAO_ATENDIDO", ocorridaEm: `${data}T14:00:00Z`, motivo: "Animal ausente no manejo" }, null);
    const nao = await listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({ etapaId, situacao: "NAO_ATENDIDO" }), u);
    expect(nao.total).toBe(1); expect(nao.itens[0].id).toBe(alvo.id); expect(nao.resumo?.total).toBe(21);
    const exameSalvo = await registrarExame({ chave: chave(), animalId: alvo.animal.id, propriedadeId: sitio, tarefaId: alvo.id, tipoExameId: t.id, data, resultadoNumero: 0 }, null);
    const origens = await listarOrigensFatoOperacao(sitio, consultaOrigensFatoOperacaoSchema.parse({ animalId: alvo.animal.id, fatoId: exameSalvo.id }));
    expect(origens.total).toBe(1); expect(origens.itens[0]).toMatchObject({ participacaoId: alvo.participacaoId, programacao: { id: r.id }, protocolo: { id: p.id } });
    await expect(listarOrigensFatoOperacao(sitio + 10000, consultaOrigensFatoOperacaoSchema.parse({ animalId: alvo.animal.id, fatoId: exameSalvo.id }))).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    const atendidos = await listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({ etapaId, situacao: "ATENDIDO" }), u);
    expect(atendidos.total).toBe(1); expect(atendidos.itens[0].vinculoAtual?.tipo).toBe("EXAME");
    expect((await listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({ etapaId, situacao: "NAO_ATENDIDO" }), u)).total).toBe(0);
    expect((await listarEventosTarefaOperacao(alvo.id, sitio, consultaOperacaoSchema.parse({ pagina: 99 }))).itens).toHaveLength(1);
    const adiado = paginas[1].itens[0];
    await registrarEventoTarefa(adiado.id, { chave: chave(), propriedadeId: sitio, tipo: "ADIAMENTO", ocorridaEm: `${data}T14:00:00Z`, motivo: "Reagendado com responsável", previstaPara: "2026-10-28" }, null);
    expect((await obterCabecalhoOperacao(c, sitio, u)).contagens).toMatchObject({ total: 21, atendidos: 1, pendentes: 20, adiados: 1 });
    expect((await listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({ pagina: 99 }), u)).pagina).toBe(3);
    await expect(listarTarefasOperacao(c, sitio + 10000, consultaOperacaoSchema.parse({}), u)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    await expect(listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({ etapaId: chave() }), u)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    const individual = await iniciarExecucao({ chave: chave(), protocoloId: p.id, animalId: await animal(), propriedadeId: sitio, inicio: data }, null);
    expect((await obterCabecalhoOperacao({ participacaoId: individual.id }, sitio, u)).modo).toBe("INDIVIDUAL");
    const participacoes = await listarParticipacoesOperacao(sitio, listaOperacaoSchema.parse({ tipo: "SANITARIO", animalId: individual.animalId }));
    expect(participacoes.itens.map(v => v.id)).toEqual([individual.id]);
    expect((await listarVersoesOperacao(consultaVersoesOperacaoSchema.parse({ tipo: "SANITARIO", busca: `Consulta operacional ${run}` }))).itens.map(v => v.id)).toEqual([p.id]);
  }, 120000);

  it("regularização usa o sítio do fato sem revelar os demais animais ao destino", async () => {
    const t = await tarefa();
    const ref = await prisma.tarefaProtocolo.findUniqueOrThrow({ where: { id: t.tarefaId }, select: { execucao: { select: { protocoloId: true } } } });
    const a = await animal(), b = await animal();
    const g = await criarRodada({ chave: chave(), propriedadeId: sitio, protocoloId: ref.execucao.protocoloId, nome: `Grupo transferência ${run}`, inicioReferencia: data, itens: [{ animalId: a }, { animalId: b }] }, null);
    const destino = await prisma.propriedade.create({ data: { nome: `Destino teste ${run}` } }); sitiosExtras.push(destino.id);
    await prisma.$transaction(async tx => {
      await tx.localizacaoAnimal.updateMany({ where: { animalId: a, ate: null }, data: { ate: new Date("2026-09-16") } });
      await tx.localizacaoAnimal.create({ data: { animalId: a, propriedadeId: destino.id, desde: new Date("2026-09-16") } });
    });
    const task = await prisma.tarefaProtocolo.findFirstOrThrow({ where: { execucao: { rodadaId: g.id, animalId: a } } });
    const exame = await registrarExame({ chave: chave(), animalId: a, propriedadeId: destino.id, tarefaId: task.id, tipoExameId: t.tipoExameId, data: "2026-09-17", resultadoNumero: 0, desvio: { motivo: "Atendimento após transferência comprovada" } }, null);
    await corrigirExame(exame.id, destino.id, { anular: true, motivo: "Amostra inválida após conferência" }, null);
    const c = { programacaoId: g.id }, u = { dono: false, areas: ["pecuaria"], flags: ["lancar"] };
    const origemHistoricaB = await listarOrigensFatoOperacao(destino.id, consultaOrigensFatoOperacaoSchema.parse({ animalId: a, fatoId: exame.id }));
    expect(origemHistoricaB.total).toBe(1); expect(origemHistoricaB.itens[0].programacao?.id).toBe(g.id);
    const emB = await listarTarefasOperacao(c, destino.id, consultaOperacaoSchema.parse({}), u);
    expect(emB.total).toBe(1); expect(emB.itens[0].animal.id).toBe(a);
    expect(emB.itens[0].tarefaOrigem.propriedadeRegularizacaoId).toBe(destino.id); expect(emB.itens[0].acoes.regularizar).toBe(true);
    const participantesB = await listarParticipantesOperacao(c, destino.id, consultaOperacaoSchema.parse({}));
    expect(participantesB.total).toBe(1); expect(participantesB.itens[0].animalId).toBe(a);
    expect((await obterCabecalhoOperacao(c, destino.id, u)).participantesTotal).toBe(1);
    const emA = await listarTarefasOperacao(c, sitio, consultaOperacaoSchema.parse({}), u);
    expect(emA.total).toBe(2); const origem = emA.itens.find(v => v.id === task.id)!;
    expect(origem.acoes.regularizar).toBe(false); expect(origem.vinculoAtual).toBeNull();
    await regularizarTarefaSanitaria(task.id, { ...regularizacao("ENCERRAR_SEM_SUBSTITUICAO"), propriedadeId: destino.id }, null);
    expect((await listarTarefasOperacao(c, destino.id, consultaOperacaoSchema.parse({}), u)).itens[0].situacao).toBe("ENCERRADO");
  }, 60000);

});
