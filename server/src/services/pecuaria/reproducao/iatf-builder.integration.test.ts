import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { normalizarNomeCatalogo } from "../../estoque/catalogos.js";
import { criarProtocolo, editarProtocolo, publicarProtocolo } from "./iatf.js";
import { protocoloSchema } from "./schemas.js";
import { estimarModeloTx, estimativaModeloSchema } from "../custos/estimativa-modelo.js";
const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
comBanco("Builder reprodutivo: adoção e versões no PostgreSQL", () => {
  const run = randomUUID(), nome = `QA builder ${run}`, itens: string[] = [];
  let categoria = "", origem = "";
  async function item(sufixo: string) {
    const titulo = `${nome} ${sufixo}`;
    const p = await prisma.produtoCatalogo.create({ data: { id: randomUUID(), fonte: "QA_BUILDER", codigoOrigem: `${run}-${sufixo}`, nome: titulo, nomeNormalizado: normalizarNomeCatalogo(titulo), unidadeSugerida: "ML", usoSanitario: true, versaoCatalogo: 1 } });
    itens.push(p.id); return p.id;
  }
  const entrada = (produtoCatalogoId: string, versao: number) => protocoloSchema.parse({ nome, versao, origemVersaoId: origem, finalidade: "PRE_SINCRONIZACAO", etapas: [{ nome: "Aplicação", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", planoAplicacao: { produtoCatalogoId, categoriaId: categoria, dose: "2", unidadeDose: "ML" } }] });
  beforeAll(async () => {
    exigirBancoIntegracaoPecuaria();
    categoria = (await prisma.categoria.create({ data: { nome, usoSanitario: true } })).id;
    origem = (await prisma.protocolo.create({ data: { nome, versao: 1, tipo: "REPRODUTIVO" } })).id;
  });
  afterAll(async () => {
    const protocolos = await prisma.protocolo.findMany({ where: { nome, tipo: "REPRODUTIVO" }, select: { id: true } });
    const protocoloIds = protocolos.map(p => p.id);
    const produtos = await prisma.produto.findMany({ where: { produtoCatalogoId: { in: itens } }, select: { id: true } });
    const produtoIds = produtos.map(p => p.id);
    await prisma.auditoriaPecuaria.deleteMany({ where: { entidade: "ProtocoloIatf", entidadeId: { in: protocoloIds } } });
    await prisma.protocolo.deleteMany({ where: { id: { in: protocoloIds } } });
    await prisma.auditoriaFinanceira.deleteMany({ where: { entidade: "Produto", entidadeId: { in: produtoIds } } });
    await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
    await prisma.produtoCatalogo.deleteMany({ where: { id: { in: itens } } });
    if (categoria) await prisma.categoria.deleteMany({ where: { id: categoria } });
  });
  it("conflito de versão após adoção reverte produto e auditoria", async () => {
    const catalogo = await item("rollback");
    await expect(criarProtocolo(entrada(catalogo, 1), null)).rejects.toMatchObject({ code: "CONFLITO", campo: "versao" });
    expect(await prisma.produto.count({ where: { produtoCatalogoId: catalogo } })).toBe(0);
    expect(await prisma.protocolo.count({ where: { nome, tipo: "REPRODUTIVO" } })).toBe(1);
  }, 30000);
  it("a unidade do catálogo prevalece sobre uma dose incompatível e a adoção reverte", async () => {
    const catalogo = await item("unidade");
    const dados = entrada(catalogo, 2);
    dados.etapas[0].planoAplicacao!.unidadeDose = "KG";
    await expect(criarProtocolo(dados, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "etapas.0.planoAplicacao.unidadeDose" });
    expect(await prisma.produto.count({ where: { produtoCatalogoId: catalogo } })).toBe(0);
  }, 30000);
  it("média ponderada entre sítios e saldo sem lastro no mesmo corte", async () => {
    const rollback = new Error("Rollback apenas das fixtures deste cenário");
    await expect(prisma.$transaction(async tx => {
      const sitios = await Promise.all(["A", "B"].map(s => tx.propriedade.create({ data: { nome: `${nome} ${s}` } })));
      const produto = await tx.produto.create({ data: { nome: `${nome} saldo`, unidade: "L", categoriaId: categoria, usoSanitario: true } });
      const data = new Date("2020-01-01T00:00:00Z");
      for (const [i, sitio] of sitios.entries()) {
        const quantidade = i ? 8 : 2, valor = i ? 160 : 20;
        await tx.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitio.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data, quantidade, custoUnitario: valor / quantidade, valorTotal: valor } });
        await tx.baseValorizacaoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitio.id, metodo: "FIFO_AQUISICAO_V1", disponivelDesde: data, corteAbertura: data, quantidadeAbertura: quantidade, valorAbertura: valor, aberturaDocumentada: { chave: randomUUID(), corte: "2020-01-01", referencia: "Teste isolado", motivo: "Contagem de teste", evidencia: "Fixture própria", usuarioId: null, revisao: "a".repeat(64) } } });
      }
      const entrada = estimativaModeloSchema.parse({ etapas: [{ nome: "Dose", tipo: "APLICACAO", produtoId: produto.id, quantidade: "50", unidade: "ML" }] });
      expect(await estimarModeloTx(tx, entrada, null)).toMatchObject({ situacao: "COMPLETO", total: "0.90" });
      await tx.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitios[1].id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data, quantidade: 1, custoUnitario: 1, valorTotal: 1 } });
      expect((await estimarModeloTx(tx, entrada, null)).referencias.itens[0]).toMatchObject({ situacao: "COBERTURA_INSUFICIENTE", valor: null });
      throw rollback;
    }, { timeout: 30000 })).rejects.toBe(rollback);
  }, 40000);
  it("derivações concorrentes com mesmo número produzem uma versão e uma adoção", async () => {
    const catalogo = await item("concorrencia");
    const resultados = await Promise.allSettled([criarProtocolo(entrada(catalogo, 2), null), criarProtocolo(entrada(catalogo, 2), null)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
    const versao = await prisma.protocolo.findUniqueOrThrow({ where: { tipo_nome_versao: { nome, tipo: "REPRODUTIVO", versao: 2 } }, include: { etapas: true } });
    expect(versao.referenciaTecnica).toMatchObject({ protocoloOrigemId: origem });
    expect(await prisma.produto.count({ where: { produtoCatalogoId: catalogo } })).toBe(1);
    expect(versao.etapas).toHaveLength(1);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: versao.etapas[0].produtoId! } })).toBe(0);
  }, 30000);
  it("conserva modalidades omitidas e permite limpá-las ao mudar um rascunho para preparo", async () => {
    const retirada = { nome: "Retirada", tipo: "RETIRADA", intervalo: 7, unidade: "DIAS" } as const;
    const tentativa = { nome: "Inseminação", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS" } as const;
    const comum = { nome, versao: 3, etapas: [retirada, tentativa] };
    const rascunho = await criarProtocolo(protocoloSchema.parse({ ...comum, finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO" }), null);
    expect(await editarProtocolo(rascunho.id, protocoloSchema.parse({ ...comum, descricao: "Conserva modalidades" }), null)).toMatchObject({ finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO" });
    const preparo = await editarProtocolo(rascunho.id, protocoloSchema.parse({
      ...comum, finalidade: "PRE_SINCRONIZACAO", modalidadeTentativa: null, modalidadeDiagnostico: null,
      etapas: [retirada], publicado: true,
    }), null);
    expect(preparo).toMatchObject({ versao: 3, publicado: true, finalidade: "PRE_SINCRONIZACAO", modalidadeTentativa: null, modalidadeDiagnostico: null });
    expect(await prisma.protocolo.findUnique({ where: { id: rascunho.id }, include: { etapas: true } })).toMatchObject({
      versao: 3, finalidade: "PRE_SINCRONIZACAO", modalidadeTentativa: null, modalidadeDiagnostico: null, etapas: [{ tipo: "RETIRADA" }],
    });
  }, 30000);
  it("bloqueia o encerramento inválido na gravação e na publicação posterior de uma nova derivação", async () => {
    const dados = protocoloSchema.parse({
      nome, versao: 4, origemVersaoId: origem, finalidade: "IATF",
      modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO",
      etapas: [
        { nome: "Inseminação", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS" },
        { nome: "Retirada", tipo: "RETIRADA", intervalo: 12, unidade: "DIAS" },
      ],
    });

    await expect(criarProtocolo({ ...dados, publicado: true }, null)).rejects.toThrow(/última ação/);
    const rascunho = await criarProtocolo(dados, null);
    await expect(publicarProtocolo(rascunho.id, null)).rejects.toThrow(/última ação/);
    const versao = await prisma.protocolo.findUniqueOrThrow({ where: { id: rascunho.id } });
    expect(versao).toMatchObject({ publicado: false, publicadoEm: null, referenciaTecnica: { protocoloOrigemId: origem } });
  }, 30000);
  it("mantém validação guiada quando um rascunho preexistente é editado e publicado depois", async () => {
    const dados = protocoloSchema.parse({
      nome, versao: 5, finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO",
      etapas: [
        { nome: "Inseminação", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS" },
        { nome: "Retirada", tipo: "RETIRADA", intervalo: 12, unidade: "DIAS" },
      ],
    });
    const rascunho = await criarProtocolo(dados, null);
    await prisma.protocolo.update({ where: { id: rascunho.id }, data: { referenciaTecnica: { protocoloOrigemId: origem } } });
    await editarProtocolo(rascunho.id, { ...dados, encerramentoGuiado: true }, null);
    await expect(publicarProtocolo(rascunho.id, null)).rejects.toThrow(/última ação/);
    await expect(editarProtocolo(rascunho.id, { ...dados, publicado: true }, null)).rejects.toThrow(/última ação/);
    const salvo = await prisma.protocolo.findUniqueOrThrow({ where: { id: rascunho.id } });
    expect(salvo).toMatchObject({ publicado: false, publicadoEm: null, referenciaTecnica: { protocoloOrigemId: origem, encerramentoGuiado: true } });
  }, 30000);
});
