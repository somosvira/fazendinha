import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { listarOrigemFinanceira } from "./origem-financeira.js";
import { criarAplicacao } from "./aplicacoes.js";
import { registrarExame, corrigirExame } from "./exames.js";
import { confirmarProcedimentosServico, listarProcedimentosServico, procedimentosOperacaoServico } from "./servicos.js";
const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const ctx = { sitio: 0, outroSitio: 0, animal: "", tipo: "", protocolo: "", etapa: "" };
async function servico(valor = "100") { return prisma.operacao.create({ data: { propriedadeId: ctx.sitio, tipo: "SERVICO", status: "CONFIRMADA", data: new Date("2026-10-01"), valorTotal: valor, descricao: `Serviço ${run}` } }); }
async function exame(patch: { tarefaId?: string; operacaoServicoId?: string } = {}) { return registrarExame({ animalId: ctx.animal, propriedadeId: ctx.sitio, tipoExameId: ctx.tipo, data: "2026-10-01", ...patch }, null); }
const envio = (op: string, itens: Array<{ id: string; tipo: "APLICACAO" | "EXAME" | "PROTOCOLO" | "TENTATIVA"; valor?: string | null }>) => ({ servicoId: op, propriedadeId: ctx.sitio, chaveIdempotencia: crypto.randomUUID(), motivo: "Conferido atendimento realizado", itens });
comBanco("procedimentos de Serviço — integridade PostgreSQL", () => {
  beforeAll(async () => {
    const sitio = await prisma.propriedade.create({ data: { nome: `Serviços ${run}` } }); ctx.sitio = sitio.id;
    ctx.outroSitio = (await prisma.propriedade.create({ data: { nome: `Outro Serviço ${run}` } })).id;
    ctx.animal = (await cadastrar(cadastrarAnimalSchema.parse({ brinco: `SV${run}`, nome: "Bela", sexo: "F", origem: "COMPRADO", aptidao: "LEITE", propriedadeId: ctx.sitio, dataNascimento: "2020-01-01", dataEntrada: "2026-01-01" }), null)).id;
    ctx.tipo = (await prisma.tipoExame.create({ data: { nome: `Exame histórico ${run}`, tipoResultado: "TEXTO" } })).id;
    const protocolo = await prisma.protocolo.create({ data: { nome: `Protocolo ${run}`, publicadoEm: new Date(), etapas: { create: { ordem: 1, diaRelativo: 0, tipo: "EXAME", tipoExameId: ctx.tipo } } }, include: { etapas: true } }); ctx.protocolo = protocolo.id; ctx.etapa = protocolo.etapas[0].id;
  });
  afterAll(async () => {
    if (!ctx.sitio) return;
    await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId: ctx.animal }, { propriedadeId: { in: [ctx.sitio, ctx.outroSitio] } }] } });
    await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: [ctx.sitio, ctx.outroSitio] } } });
    await prisma.vinculoTarefaProtocolo.deleteMany({ where: { tentativa: { animalId: ctx.animal } } }); await prisma.tentativaReprodutiva.deleteMany({ where: { animalId: ctx.animal } });
    await prisma.vinculoTarefaProtocolo.deleteMany({ where: { aplicacao: { animalId: ctx.animal } } }); await prisma.aplicacaoProduto.deleteMany({ where: { animalId: ctx.animal } }); await prisma.vinculoTarefaProtocolo.deleteMany({ where: { exame: { animalId: ctx.animal } } }); await prisma.exameAnimal.deleteMany({ where: { animalId: ctx.animal } });
    await prisma.tarefaProtocolo.deleteMany({ where: { execucao: { animalId: ctx.animal } } }); await prisma.participacaoProtocolo.deleteMany({ where: { animalId: ctx.animal } });
    await prisma.etapaProtocolo.deleteMany({ where: { protocoloId: ctx.protocolo } }); await prisma.protocolo.delete({ where: { id: ctx.protocolo } });
    await prisma.tipoExame.delete({ where: { id: ctx.tipo } }); await prisma.operacao.deleteMany({ where: { propriedadeId: { in: [ctx.sitio, ctx.outroSitio] } } });
    await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId: ctx.animal } }); await prisma.finalidadeAnimal.deleteMany({ where: { animalId: ctx.animal } }); await prisma.localizacaoAnimal.deleteMany({ where: { animalId: ctx.animal } }); await prisma.animal.delete({ where: { id: ctx.animal } });
    await prisma.propriedade.deleteMany({ where: { id: { in: [ctx.sitio, ctx.outroSitio] } } });
  });
  it("inclui tentativas V4 no atendimento e impede atribuição V3 que ultrapasse o valor conjunto", async () => {
    const op = await servico("100");
    const t = await prisma.tentativaReprodutiva.create({ data: {
      animalId: ctx.animal, propriedadeId: ctx.sitio, data: new Date("2026-10-01"),
      tipo: "IA", origemMaterial: "SERVICO", ciclo: 0, ordem: 1, geneticaSnapshot: {},
      operacaoServicoId: op.id, valorServicoAtribuido: "80.10",
    } });
    const e = await exame();
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "20" }]), null)).rejects.toThrow(/ultrapassam/);
    expect((await prisma.exameAnimal.findUniqueOrThrow({ where: { id: e.id } })).operacaoServicoId).toBeNull();
    await confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "19.90" }]), null);
    const consulta = await listarProcedimentosServico(op.id, ctx.sitio, { tipo: "TENTATIVA", animalBusca: "Bela" });
    expect(consulta.total).toBe(1);
    expect((await listarOrigemFinanceira(op.id, ctx.sitio)).fatos).toContainEqual(expect.objectContaining({ id: t.id, tipo: "TENTATIVA", animalBrinco: `SV${run}` }));
    expect(consulta.servico).toMatchObject({ totalAtribuido: "100", disponivel: "0" });
    expect(consulta.itens[0]).toMatchObject({ id: t.id, tipo: "TENTATIVA", valor: "80.1", animal: { brinco: `SV${run}` } });
    await confirmarProcedimentosServico(envio(op.id, [{ id: t.id, tipo: "TENTATIVA", valor: "75" }]), null);
    expect((await listarProcedimentosServico(op.id, ctx.sitio)).servico.disponivel).toBe("5.1");
    const oculto = await listarProcedimentosServico(op.id, ctx.sitio, {}, false);
    expect(oculto.servico.totalAtribuido).toBeNull();
    expect(oculto.itens.every((i) => i.valor === null)).toBe(true);
  });
  it("vincula aplicação/exame sem reconciliar origem, dose, medicamento ou estoque", async () => {
    const op = await servico(); const e = await exame();
    const a = await criarAplicacao({ animalId: ctx.animal, propriedadeId: ctx.sitio, data: "2026-10-01", aplicadaEm: "2026-10-01T13:00:00Z", finalidade: "VACINA", nomeProdutoAplicado: "Nome histórico", dose: "2", unidadeDose: "ML", origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Comprovante ainda pendente", carenciaLeiteHoras: 0, carenciaCarneHoras: 0 }, null);
    await confirmarProcedimentosServico(envio(op.id, [{ id: a.id, tipo: "APLICACAO" }, { id: e.id, tipo: "EXAME", valor: "0" }]), null);
    const salva = await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: a.id } });
    expect(salva).toMatchObject({ operacaoServicoId: op.id, nomeProdutoAplicado: a.nomeProdutoAplicado, origemInsumo: a.origemInsumo, produtoId: a.produtoId, movimentoEstoqueId: null }); expect(salva.dose?.toString()).toBe(a.dose?.toString());
    expect(salva.valorServicoAtribuido).toBeNull(); expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: ctx.sitio } })).toBe(0);
    const d = await listarProcedimentosServico(op.id, ctx.sitio); expect(d.total).toBe(2); expect(d.itens[0].animal.brinco).toBe(`SV${run}`);
  });
  it("reenvio concorrente grava uma vez e chave com conteúdo diferente conflita", async () => {
    const op = await servico(); const e = await exame(); const input = envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "25.15" }]);
    const respostas = await Promise.all([confirmarProcedimentosServico(input, null), confirmarProcedimentosServico(input, null)]); expect(respostas.every((r) => r.salvo)).toBe(true);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidadeId: e.id, acao: "PROCEDIMENTO_SERVICO" } })).toBe(1);
    await expect(confirmarProcedimentosServico({ ...input, motivo: "Outra intenção de atendimento" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("omissão sem valores preserva atribuição; null retira somente atribuição", async () => {
    const op = await servico(); const e = await exame(); await confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "30" }]), null);
    await confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME" }]), null, false);
    expect((await prisma.exameAnimal.findUniqueOrThrow({ where: { id: e.id } })).valorServicoAtribuido?.toString()).toBe("30");
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: null }]), null, false)).rejects.toThrow("permissão");
    await confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: null }]), null);
    expect(await prisma.exameAnimal.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ operacaoServicoId: op.id, valorServicoAtribuido: null });
    expect(await listarProcedimentosServico(op.id, ctx.sitio, {}, false)).toMatchObject({ servico: { valorConfirmado: null, totalAtribuido: null, disponivel: null }, itens: [{ valor: null }] });
  });
  it("batch inválido é atômico e orçamento não excede sob concorrência", async () => {
    const op = await servico(); const [a, b] = await Promise.all([exame(), exame()]);
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: a.id, tipo: "EXAME", valor: "70" }, { id: b.id, tipo: "EXAME", valor: "50" }]), null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect((await prisma.exameAnimal.findUniqueOrThrow({ where: { id: a.id } })).operacaoServicoId).toBeNull();
    const resultados = await Promise.allSettled([a, b].map((e) => confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "70" }]), null)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1); expect((await listarProcedimentosServico(op.id, ctx.sitio)).servico.totalAtribuido).toBe("70");
  });
  it("anulados permanecem na consulta e não aceitam novos vínculos ou valores", async () => {
    const op = await servico(); const e = await exame(); await confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "20" }]), null);
    await corrigirExame(e.id, ctx.sitio, { motivo: "Coleta anulada para correção", anular: true }, null);
    expect((await procedimentosOperacaoServico(op.id, ctx.sitio))[0]).toMatchObject({ status: "ANULADO", valor: "20", podeEditar: false });
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME", valor: "10" }]), null)).rejects.toMatchObject({ code: "CONFLITO" });
    expect((await listarProcedimentosServico(op.id, ctx.sitio)).servico.totalAtribuido).toBe("0");
  });
  it("outro Serviço ou sítio não pode assumir o mesmo fato", async () => {
    const [op, outro] = await Promise.all([servico(), servico()]); const e = await exame({ operacaoServicoId: outro.id });
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME" }]), null)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(confirmarProcedimentosServico({ ...envio(op.id, [{ id: e.id, tipo: "EXAME" }]), propriedadeId: ctx.outroSitio }, null)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
  it("protocolo exige fato realizado e não combina valores em pai/filho nem outros Serviços", async () => {
    const [op, outro] = await Promise.all([servico(), servico()]);
    const p = await prisma.participacaoProtocolo.create({ data: { animalId: ctx.animal, propriedadeId: ctx.sitio, protocoloId: ctx.protocolo, inicio: new Date("2026-10-01"), tarefas: { create: { etapaId: ctx.etapa, previstaPara: new Date("2026-10-01"), parametros: { tipo: "EXAME", tipoExameId: ctx.tipo } } } }, include: { tarefas: true } });
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: p.id, tipo: "PROTOCOLO" }]), null)).rejects.toMatchObject({ code: "CONFLITO" });
    const e = await exame({ tarefaId: p.tarefas[0].id });
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: p.id, tipo: "PROTOCOLO", valor: "0" }, { id: e.id, tipo: "EXAME", valor: "0" }]), null)).rejects.toMatchObject({ code: "CONFLITO" });
    await confirmarProcedimentosServico(envio(outro.id, [{ id: e.id, tipo: "EXAME" }]), null);
    await expect(confirmarProcedimentosServico(envio(op.id, [{ id: p.id, tipo: "PROTOCOLO" }]), null)).rejects.toThrow("outro Serviço");
  });
  it("cancelamento concorrente não deixa vínculo num Serviço cancelado", async () => {
    const op = await servico(); const e = await exame();
    const resultado = await Promise.allSettled([confirmarProcedimentosServico(envio(op.id, [{ id: e.id, tipo: "EXAME" }]), null), prisma.$transaction(async (tx) => { await tx.$queryRaw`SELECT id FROM "Operacao" WHERE id = ${op.id} FOR UPDATE`; const vinculo = await tx.exameAnimal.findFirst({ where: { operacaoServicoId: op.id, status: "VALIDO" } }); if (vinculo) throw new Error("Serviço vinculado"); await tx.operacao.update({ where: { id: op.id }, data: { status: "CANCELADA" } }); })]);
    expect(resultado.filter((r) => r.status === "rejected")).toHaveLength(1);
    const atual = await prisma.operacao.findUniqueOrThrow({ where: { id: op.id } }); const fato = await prisma.exameAnimal.findUniqueOrThrow({ where: { id: e.id } });
    expect(atual.status === "CONFIRMADA" || fato.operacaoServicoId === null).toBe(true);
  });
});
