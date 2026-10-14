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
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: sitio } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId: sitio }, { animalId: { in: animais } }, { entidadeId: { in: [...tipos, ...protocolos] } }] } });
  await prisma.participanteVisita.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.impressaoVisita.deleteMany({ where: { visitaId: { in: visitas } } });
  await prisma.atividadeVisita.deleteMany({ where: { visitaId: { in: visitas } } });
  await prisma.visitaVeterinaria.deleteMany({ where: { id: { in: visitas } } });
  await prisma.vinculoTarefaProtocolo.deleteMany({ where: { tarefa: { execucao: { animalId: { in: animais } } } } });
  await prisma.interpretacaoReprodutiva.deleteMany({ where: { exame: { animalId: { in: animais } } } });
  await prisma.exameAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.tarefaProtocolo.deleteMany({ where: { execucao: { animalId: { in: animais } } } });
  await prisma.participacaoProtocolo.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.programacaoProtocolo.deleteMany({ where: { propriedadeId: sitio } });
  await prisma.etapaProtocolo.deleteMany({ where: { protocoloId: { in: protocolos } } });
  await prisma.protocolo.deleteMany({ where: { id: { in: protocolos } } });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tipos } } });
  await prisma.materialGenetico.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.genitorExterno.deleteMany({ where: { id: { in: genitores } } });
  await prisma.alocacaoPartidaEstoque.deleteMany({ where: { movimentoEstoque: { propriedadeId: sitio } } });
  await prisma.movimentoEstoque.deleteMany({ where: { propriedadeId: sitio } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.propriedade.delete({ where: { id: sitio } });
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
async function atividade(animalId: string, tipo: "AVALIACAO_REPRODUTIVA" | "EXAME_SANITARIO", tarefaId?: string) {
  const v = await criarVisita({ nome: `Visita ${run}`, propriedadeId: sitio, data }, null); visitas.push(v.id);
  const a = await adicionarAtividade(v.id, atividadeSchema.parse({ nome: "Exames coletivos", tipo, propriedadeId: sitio, participantes: [{ animalId, ...(tarefaId ? { tarefaSanitariaId: tarefaId } : {}) }] }), null);
  return { visitaId: v.id, atividadeId: a.id, participanteId: a.participantes[0].id };
}
const regularizacao = (acao: "REABRIR" | "ENCERRAR_SEM_SUBSTITUICAO" | "VINCULAR_SUBSTITUTO", fatoId?: string) => ({ propriedadeId: sitio, chave: chave(), motivo: "Correção conferida com responsável", acao, cienciaNaoExecutado: true, ...(fatoId ? { fatoId } : {}) });
comBanco("tarefas, regularização e exames personalizados na base comum", () => {
  beforeAll(async () => { sitio = (await prisma.propriedade.create({ data: { nome: `Fluxos comuns ${run}` } })).id; });
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
    const m = await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitio, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date(data), quantidade: 10, custoUnitario: 1, valorTotal: 10 } });
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
});
