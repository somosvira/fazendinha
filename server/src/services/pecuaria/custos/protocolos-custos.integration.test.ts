import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { criarProtocolo, publicarProtocolo, iniciarExecucao } from "../sanidade/protocolos.js";
import { criarProtocolo as criarReprodutivo, criarProgramacao, criarParticipacaoIndividualReprodutiva } from "../reproducao/iatf.js";
import { protocoloSchema, programacaoSchema } from "../reproducao/schemas.js";
import { listarProcedimentosOperacao } from "../protocolos/operacao.js";
import { consultaOperacaoSchema, type ContextoOperacao } from "../protocolos/operacao.schemas.js";
import { preverExecucaoProtocolo, confirmarExecucaoProtocolo } from "../protocolos/execucao.js";
import { criarAplicacao } from "../sanidade/aplicacoes.js";
import { confirmarProcedimentosServico } from "../sanidade/servicos.js";
import { classificarCusto } from "./custos.js";
import type { ReferenciasCusto } from "./referencias-planejadas.js";

const banco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const sitios: number[] = [], animais: string[] = [], protocolos: string[] = [], produtos: string[] = [], materiais: string[] = [], genitores: string[] = [];
const uuid = () => crypto.randomUUID(), data = "2026-10-01", usuario = { dono: true, areas: [], flags: [] };
const referencias = (valorMaterial = "0.00", valorServico = "5.00"): ReferenciasCusto => ({
  material: { valorUnitario: valorMaterial, unidade: "UN", origem: "Cotação material teste T10", data: "2026-09-30" },
  servico: { valorUnitario: valorServico, unidade: "POR_ATENDIMENTO", origem: "Cotação veterinária teste T10", data: "2026-09-29" },
});
// Apenas IDs próprios. Esta suíte não redefine estrutura, cria banco ou usa seed.
afterAll(async () => {
  if (!sitios.length) return;
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId: { in: sitios } }, { animalId: { in: animais } }, { entidadeId: { in: protocolos } }] } });
  await prisma.classificacaoCustoPecuaria.deleteMany({ where: { OR: [{ aplicacao: { animalId: { in: animais } } }, { manejo: { animalId: { in: animais } } }] } });
  await prisma.vinculoTarefaProtocolo.deleteMany({ where: { tarefa: { execucao: { animalId: { in: animais } } } } });
  await prisma.manejoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.tarefaProtocolo.deleteMany({ where: { execucao: { animalId: { in: animais } } } });
  await prisma.participacaoProtocolo.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.programacaoProtocolo.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.protocolo.deleteMany({ where: { id: { in: protocolos } } });
  await prisma.operacao.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.materialGenetico.deleteMany({ where: { id: { in: materiais } } });
  await prisma.genitorExterno.deleteMany({ where: { id: { in: genitores } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.finalidadeAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: sitios } } });
});
async function base() {
  const run = uuid().slice(0, 8);
  const sitio = await prisma.propriedade.create({ data: { nome: `Custos protocolo T10 ${run}` } }); sitios.push(sitio.id);
  const produto = await prisma.produto.create({ data: { nome: `Material T10 ${run}`, unidade: "UN", usoSanitario: true, usoGenetico: true } }); produtos.push(produto.id);
  return { run, sitio, produto };
}
async function animal(f: Awaited<ReturnType<typeof base>>, ordem = 0) {
  const a = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `C10${f.run}${ordem}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: f.sitio.id }), null);
  animais.push(a.id); return a;
}
async function consultar(contexto: ContextoOperacao, sitio: number, filtro: Record<string, unknown> = {}) {
  return listarProcedimentosOperacao(contexto, sitio, consultaOperacaoSchema.parse(filtro), usuario);
}
async function sanitarias(f: Awaited<ReturnType<typeof base>>, protocoloId: string) {
  const individual = await animal(f), coletivo = await animal(f, 1);
  const a = await iniciarExecucao({ animalId: individual.id, propriedadeId: f.sitio.id, protocoloId, inicio: data }, null);
  const b = await iniciarExecucao({ animalId: coletivo.id, propriedadeId: f.sitio.id, protocoloId, inicio: data }, null);
  const grupo = await prisma.programacaoProtocolo.create({ data: { protocoloId, propriedadeId: f.sitio.id, nome: `Grupo T10 ${f.run}`, inicioReferencia: new Date(data) } });
  await prisma.participacaoProtocolo.update({ where: { id: b.id }, data: { rodadaId: grupo.id } });
  return { individual: a, coletivo: b, grupo };
}
banco("custos planejados e procedimentos protocolados — PostgreSQL local preservado", () => {
  it("sanitário individual/coletivo preserva referência zero no snapshot após nova versão de preço", async () => {
    const f = await base(), refs = referencias();
    const etapa = { tipo: "APLICACAO" as const, diaRelativo: 0, produtoId: f.produto.id, finalidade: "TRATAMENTO" as const, dose: 2, unidade: "UN", referenciasCusto: refs };
    const p = await criarProtocolo({ nome: `Sanitário T10 ${f.run}`, etapas: [etapa] }, null); protocolos.push(p.id); await publicarProtocolo(p.id, null);
    const inscritos = await sanitarias(f, p.id);
    const ids = [inscritos.individual.tarefas[0].id, inscritos.coletivo.tarefas[0].id];
    const antes = await prisma.tarefaProtocolo.findMany({ where: { id: { in: ids } }, select: { id: true, parametros: true }, orderBy: { id: "asc" } });
    for (const t of antes) expect(t.parametros).toMatchObject({ configuracao: { referenciasCusto: refs } });
    const nova = await criarProtocolo({ nome: p.nome, etapas: [{ ...etapa, referenciasCusto: referencias("99.00", "88.00") }] }, null); protocolos.push(nova.id); await publicarProtocolo(nova.id, null);
    expect(await prisma.tarefaProtocolo.findMany({ where: { id: { in: ids } }, select: { id: true, parametros: true }, orderBy: { id: "asc" } })).toEqual(antes);
    for (const contexto of [{ participacaoId: inscritos.individual.id }, { programacaoId: inscritos.grupo.id }]) {
      const r = await consultar(contexto, f.sitio.id);
      expect(r.estimativa).toMatchObject({ situacao: "COMPLETO", total: "5.00", escopo: { participacoes: 1, animais: 1, acoes: 1 } });
      expect("referencias" in r.estimativa && r.estimativa.referencias.itens).toContainEqual(expect.objectContaining({ valorUnitario: "0", origem: refs.material!.origem, data: refs.material!.data }));
    }
    expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
  }, 45000);
  it("reprodutivo individual/coletivo congela os mesmos preços e nova versão conserva a estimativa anterior", async () => {
    const f = await base(), refs = referencias();
    const touro = await prisma.genitorExterno.create({ data: { nome: `Touro T10 ${f.run}`, sexo: "M" } }); genitores.push(touro.id);
    const material = await prisma.materialGenetico.create({ data: { tipo: "SEMEN", produtoId: f.produto.id, touroExternoId: touro.id } }); materiais.push(material.id);
    const etapa = { nome: "IA planejada", tipo: "TENTATIVA", intervalo: 0, unidade: "DIAS", planoTentativa: { tipo: "IA", materialId: material.id, quantidade: 1 }, referenciasCusto: refs };
    const p = await criarReprodutivo(protocoloSchema.parse({ nome: `Reprodutivo T10 ${f.run}`, versao: 1, publicado: true, etapas: [etapa] }), null); protocolos.push(p.id);
    const a = await animal(f), b = await animal(f, 1);
    const individual = await criarParticipacaoIndividualReprodutiva({ chave: uuid(), protocoloId: p.id, animalId: a.id, propriedadeId: f.sitio.id, inicioReferencia: data }, null);
    const grupo = await criarProgramacao(programacaoSchema.parse({ chave: uuid(), protocoloId: p.id, propriedadeId: f.sitio.id, nome: `Grupo reprodução T10 ${f.run}`, inicioPrevisto: data, animais: [{ animalId: b.id }] }), null);
    const tarefas = await prisma.tarefaProtocolo.findMany({ where: { execucao: { protocoloId: p.id } }, select: { id: true, parametros: true }, orderBy: { id: "asc" } });
    expect(tarefas).toHaveLength(2); for (const t of tarefas) expect(t.parametros).toMatchObject({ etapa: { referenciasCusto: refs } });
    const nova = await criarReprodutivo(protocoloSchema.parse({ origemVersaoId: p.id, nome: p.nome, versao: 2, publicado: true, etapas: [{ ...etapa, referenciasCusto: referencias("50.00", "40.00") }] }), null); protocolos.push(nova.id);
    expect(await prisma.tarefaProtocolo.findMany({ where: { execucao: { protocoloId: p.id } }, select: { id: true, parametros: true }, orderBy: { id: "asc" } })).toEqual(tarefas);
    for (const contexto of [{ participacaoId: individual.id }, { programacaoId: grupo.id }]) expect((await consultar(contexto, f.sitio.id)).estimativa).toMatchObject({ total: "5.00", situacao: "COMPLETO" });
    expect(await prisma.tentativaReprodutiva.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
  }, 45000);
  it("onze referências paginam dez; aplicação com material e Serviço conta um fato e manejo3 soma uma vez", async () => {
    const f = await base();
    const p = await criarProtocolo({ nome: `Composição T10 ${f.run}`, etapas: [
      ...Array.from({ length: 5 }, (_, n) => ({ tipo: "APLICACAO" as const, diaRelativo: n, produtoId: f.produto.id, finalidade: "TRATAMENTO" as const, dose: 1, unidade: "UN", referenciasCusto: referencias() })),
      { tipo: "MANEJO", diaRelativo: 0, referenciasCusto: { servico: referencias().servico } },
    ] }, null); protocolos.push(p.id); await publicarProtocolo(p.id, null);
    const inscritos = await sanitarias(f, p.id), participacao = inscritos.coletivo;
    const tarefas = await prisma.tarefaProtocolo.findMany({ where: { execucaoId: participacao.id }, include: { etapa: true }, orderBy: { etapa: { ordem: "asc" } } });
    const manejo = tarefas.find(t => t.etapa.tipo === "MANEJO")!, aplicacao = tarefas.find(t => t.etapa.tipo === "APLICACAO")!;
    const servico = await prisma.operacao.create({ data: { propriedadeId: f.sitio.id, tipo: "SERVICO", status: "CONFIRMADA", data: new Date(data), valorTotal: "100" } });
    const execucao = { versao: 1 as const, propriedadeId: f.sitio.id, itens: [{ tipo: "MANEJO" as const, tarefaId: manejo.id, animalId: participacao.animalId, propriedadeId: f.sitio.id, data, operacaoServicoId: servico.id, valorServicoAtribuido: "3" }] };
    const previa = await preverExecucaoProtocolo(execucao); await confirmarExecucaoProtocolo({ execucao, chave: uuid(), fingerprint: previa.fingerprint }, null);
    const a = await criarAplicacao({ tarefaId: aplicacao.id, animalId: participacao.animalId, propriedadeId: f.sitio.id, data, produtoId: f.produto.id, nomeProdutoAplicado: f.produto.nome, finalidade: "TRATAMENTO", dose: "1", unidadeDose: "UN", origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Material documentado sem nova saída", estadoCarenciaLeite: "NAO_INFORMADO", estadoCarenciaCarne: "NAO_INFORMADO" }, null);
    await confirmarProcedimentosServico({ servicoId: servico.id, propriedadeId: f.sitio.id, chaveIdempotencia: uuid(), motivo: "Atribuir Serviço ao fato sem repetir material", itens: [{ id: a.id, tipo: "APLICACAO", valor: "2" }] }, null);
    const classificacao = await prisma.classificacaoCustoPecuaria.findUnique({ where: { aplicacaoId: a.id } });
    await classificarCusto({ chave: uuid(), propriedadeId: f.sitio.id, tipo: "APLICACAO", fonteId: a.id, versao: classificacao?.versao ?? 0, motivo: "Comprovar material adquirido fora do estoque", finalidade: "SANIDADE", materialNaoAplicavel: false, servicoNaoAplicavel: false, coberturaServico: "PROCEDIMENTO", materialDocumentado: { valor: "4.00", referencia: "Comprovante T10", evidencia: "Documento próprio da fixture comprova quatro reais" } }, null);
    const contexto = { programacaoId: inscritos.grupo.id };
    const primeira = await consultar(contexto, f.sitio.id, { pagina: 1, porPagina: 1 }), segunda = await consultar(contexto, f.sitio.id, { pagina: 2, porPagina: 1, referenciasPagina: 2 });
    for (const r of [primeira, segunda]) { expect(r.total).toBe(2); expect(r.itens).toHaveLength(1); expect(r.resumo.totalConhecido).toBe("9.00"); }
    const fatos = [...primeira.itens, ...segunda.itens]; expect(new Set(fatos.map(i => i.fonteId)).size).toBe(2);
    expect(fatos.find(i => i.tipoFonte === "APLICACAO")?.componentes).toHaveLength(2); expect(fatos.find(i => i.tipoFonte === "MANEJO")?.valor).toBe("3.00");
    expect("referencias" in primeira.estimativa && primeira.estimativa.referencias).toMatchObject({ total: 11, pagina: 1, porPagina: 10 });
    expect("referencias" in primeira.estimativa && primeira.estimativa.referencias.itens).toHaveLength(10);
    expect("referencias" in segunda.estimativa && segunda.estimativa.referencias.itens).toHaveLength(1);
    expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
  }, 60000);
});
