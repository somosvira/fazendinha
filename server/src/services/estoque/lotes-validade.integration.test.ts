import crypto from "node:crypto";
import { Prisma, type TipoMovimento } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { ativarRastreio, conferirSaldoEstornoPartidasTx, identificarLegado, listarPartidas, prepararPartidasTx, renomearLote, saldoPartidaTx, type SelecaoPartida } from "./partidas.js";
import { estornarMovimentoTx, listarMovimentos } from "./estoque.js";
import { transacaoEstoque } from "./transacao.js";
import { detalheProduto, lotesProduto, origensProduto } from "./ficha-produto.js";
import { criarOperacao, estornarOperacao } from "../financeiro/operacoes.js";
import { transferirEstoque } from "./transferencias.js";
import { confirmarRascunho, salvarRascunho } from "../financeiro/rascunhos.js";
import { operacaoSchema } from "../financeiro/schemas.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID();
const produtos: string[] = [];
const sitios: number[] = [];
const parceiros: string[] = [];
const usuarios: number[] = [];

async function fixture(rastrearPartidas = true) {
  const sitio = await prisma.propriedade.create({ data: { nome: `Lotes validade ${run} ${sitios.length}` } }); sitios.push(sitio.id);
  const produto = await prisma.produto.create({ data: { nome: `Vacina validade ${run} ${produtos.length}`, unidade: "ML", rastrearPartidas } }); produtos.push(produto.id);
  return { sitio, produto };
}

async function movimento(produtoId: string, propriedadeId: number, tipo: TipoMovimento, quantidade: number, partidas: SelecaoPartida[], data = "2026-10-03", operacaoId?: string) {
  return transacaoEstoque(async (tx) => {
    const distribuicao = await prepararPartidasTx(tx, { produtoId, propriedadeId, rastrearPartidas: true, tipo, quantidade: new Prisma.Decimal(quantidade), partidas, data: new Date(`${data}T23:59:59Z`) });
    return tx.movimentoEstoque.create({ data: { produtoId, propriedadeId, operacaoId, tipo, origem: tipo === "ENTRADA" ? "COMPRA" : "SANIDADE", data: new Date(data), quantidade, custoUnitario: 2, valorTotal: quantidade * 2,
      alocacaoPartidaEstoques: { create: distribuicao.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) } } });
  });
}

afterAll(async () => {
  if (!produtos.length) return;
  const partidas = await prisma.partidaProduto.findMany({ where: { produtoId: { in: produtos } }, select: { id: true } });
  const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId: { in: produtos } }, select: { id: true } });
  const operacoes = await prisma.operacao.findMany({ where: { propriedadeId: { in: sitios } }, select: { id: true } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: [...produtos, ...partidas.map((p) => p.id), ...movimentos.map((m) => m.id), ...operacoes.map((o) => o.id)] } } });
  await prisma.produto.updateMany({ where: { id: { in: produtos } }, data: { rastrearPartidas: false } });
  await prisma.alocacaoPartidaEstoque.deleteMany({ where: { partida: { produtoId: { in: produtos } } } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.itemOperacao.deleteMany({ where: { operacao: { propriedadeId: { in: sitios } } } });
  await prisma.operacao.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.partidaProduto.deleteMany({ where: { produtoId: { in: produtos }, lotePrincipalId: { not: null } } });
  await prisma.partidaProduto.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.parceiro.deleteMany({ where: { id: { in: parceiros } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: sitios } } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
});

comBanco("lotes por Produto e validade — serviços PostgreSQL", () => {
  it("soma linhas e fornecedores diferentes sem renomear o grupo existente", async () => {
    const { sitio, produto } = await fixture();
    for (const nome of ["Fornecedor A", "Fornecedor B"]) {
      const parceiro = await prisma.parceiro.create({ data: { nome: `${nome} ${run}`, tipo: "FORNECEDOR" } }); parceiros.push(parceiro.id);
      const operacao = await prisma.operacao.create({ data: { tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", propriedadeId: sitio.id, parceiroId: parceiro.id, data: new Date("2026-10-03"), valorTotal: 50 } });
      await movimento(produto.id, sitio.id, "ENTRADA", 25, [{ validade: "2026-12-31", nome, quantidade: 10 }, { validade: "2026-12-31", quantidade: 15 }], "2026-10-03", operacao.id);
    }
    const lotes = await listarPartidas(produto.id, sitio.id);
    expect(lotes).toHaveLength(1); expect(lotes[0]).toMatchObject({ nome: "Fornecedor A", saldo: "50" });
    expect((await origensProduto(produto.id, sitio.id, { pagina: 1, porPagina: 10 }, true, true)).itens.map((o) => o.fornecedor)).toEqual(expect.arrayContaining([`Fornecedor A ${run}`, `Fornecedor B ${run}`]));
  });

  it("criação concorrente gera uma única raiz por data e por validade desconhecida", async () => {
    const { sitio, produto } = await fixture();
    for (const validade of ["2026-12-31", null]) await Promise.all([1, 2].map(() => movimento(produto.id, sitio.id, "ENTRADA", 5, [{ validade, quantidade: 5 }])));
    expect(await prisma.partidaProduto.count({ where: { produtoId: produto.id, lotePrincipalId: null } })).toBe(2);
    expect((await listarPartidas(produto.id, sitio.id)).map((p) => p.saldo)).toEqual(["10", "10"]);
  });

  it("desconhecido exige ciência, vencimento válido durante o dia e esgotado permanece consultável", async () => {
    const { sitio, produto } = await fixture();
    await movimento(produto.id, sitio.id, "ENTRADA", 50, [{ validade: null, quantidade: 50 }]);
    const [lote] = await listarPartidas(produto.id, sitio.id);
    await expect(movimento(produto.id, sitio.id, "SAIDA", 10, [{ partidaId: lote.id, quantidade: 10 }])).rejects.toThrow(/ciência/);
    const saida = await movimento(produto.id, sitio.id, "SAIDA", 10, [{ partidaId: lote.id, quantidade: 10, cienciaValidadeDesconhecida: true }]);
    expect((await listarPartidas(produto.id, sitio.id))[0].saldo).toBe("40");
    await transacaoEstoque((tx) => estornarMovimentoTx(tx, saida.id));
    expect((await listarPartidas(produto.id, sitio.id))[0].saldo).toBe("50");
    await movimento(produto.id, sitio.id, "ENTRADA", 5, [{ validade: "2026-10-03", quantidade: 5 }]);
    const venceHoje = (await listarPartidas(produto.id, sitio.id)).find((p) => !!p.validade)!;
    await movimento(produto.id, sitio.id, "SAIDA", 5, [{ partidaId: venceHoje.id, quantidade: 5 }]);
    expect((await listarPartidas(produto.id, sitio.id)).find((p) => p.id === venceHoje.id)?.saldo).toBe("0");
    await expect(movimento(produto.id, sitio.id, "SAIDA", 1, [{ partidaId: venceHoje.id, quantidade: 1 }], "2026-10-04")).rejects.toThrow(/vencido/);
  });

  it("dois consumos concorrentes não podem gastar o mesmo saldo", async () => {
    const { sitio, produto } = await fixture();
    await movimento(produto.id, sitio.id, "ENTRADA", 10, [{ validade: "2026-12-31", quantidade: 10 }]);
    const [lote] = await listarPartidas(produto.id, sitio.id);
    const resultados = await Promise.allSettled([1, 2].map(() => movimento(produto.id, sitio.id, "SAIDA", 7, [{ partidaId: lote.id, quantidade: 7 }])));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await listarPartidas(produto.id, sitio.id))[0].saldo).toBe("3");
  });

  it("mesmo grupo guarda saldo por sítio e consolidado; paginação não repete", async () => {
    const { sitio, produto } = await fixture();
    const destino = await prisma.propriedade.create({ data: { nome: `Segundo sítio ${run}` } }); sitios.push(destino.id);
    await movimento(produto.id, sitio.id, "ENTRADA", 10, [{ validade: "2026-12-31", quantidade: 10 }]);
    await movimento(produto.id, destino.id, "ENTRADA", 20, [{ validade: "2026-12-31", quantidade: 20 }]);
    await movimento(produto.id, sitio.id, "ENTRADA", 3, [{ validade: null, quantidade: 3 }]);
    expect((await listarPartidas(produto.id, sitio.id)).find((p) => p.validade)?.saldo).toBe("10");
    expect((await listarPartidas(produto.id, destino.id))[0].saldo).toBe("20");
    expect((await listarPartidas(produto.id, null)).find((p) => p.validade)?.saldo).toBe("30");
    const primeira = await lotesProduto(produto.id, null, 1, 1);
    const segunda = await lotesProduto(produto.id, null, 2, 1);
    expect(primeira.total).toBe(2); expect(primeira.itens[0].id).not.toBe(segunda.itens[0].id);
    expect((await origensProduto(produto.id, null, { pagina: 2, porPagina: 2 }, true, true)).itens).toHaveLength(1);
  });

  it("transferência sem uso operacional aceita desconhecido/alias e o estorno recompõe ambos os sítios", async () => {
    const { sitio, produto } = await fixture();
    const destino = await prisma.propriedade.create({ data: { nome: `Transferência desconhecida ${run}` } }); sitios.push(destino.id);
    await movimento(produto.id, sitio.id, "ENTRADA", 50, [{ validade: null, quantidade: 50 }]);
    const [raiz] = await listarPartidas(produto.id, sitio.id);
    const alias = await prisma.partidaProduto.create({ data: { produtoId: produto.id, codigo: "ALIAS-TRANSFERENCIA", validade: null, lotePrincipalId: raiz.id } });
    const input = { chave: crypto.randomUUID(), produtoId: produto.id, origemId: sitio.id, destinoId: destino.id, quantidade: "10", data: "2026-10-03", motivo: "Transferência física de medicamento", partidas: [{ partidaId: alias.id, quantidade: 10 }] };
    const transferida = await transferirEstoque(input, null);
    expect(await transferirEstoque(input, null)).toEqual(transferida);
    expect((await listarPartidas(produto.id, sitio.id))[0].saldo).toBe("40");
    expect((await listarPartidas(produto.id, destino.id))[0].saldo).toBe("10");
    expect((await listarPartidas(produto.id, null))[0].saldo).toBe("50");
    const alocacoes = await prisma.alocacaoPartidaEstoque.findMany({ where: { movimentoEstoque: { operacaoId: transferida.operacaoId } } });
    expect(alocacoes.every((a) => a.partidaId === raiz.id)).toBe(true);
    await estornarOperacao(transferida.operacaoId, "Correção da transferência física", { propriedadeId: sitio.id });
    expect((await listarPartidas(produto.id, sitio.id))[0].saldo).toBe("50");
    expect((await listarPartidas(produto.id, destino.id))[0].saldo).toBe("0");
  });

  it("alias usa saldo agregado, nova saída raiz e estorno conserva IDs originais", async () => {
    const { sitio, produto } = await fixture();
    const raiz = await prisma.partidaProduto.create({ data: { produtoId: produto.id, codigo: "ANTIGO-A", validade: new Date("2026-12-31"), nome: "Grupo preservado" } });
    const alias = await prisma.partidaProduto.create({ data: { produtoId: produto.id, codigo: "ANTIGO-B", validade: raiz.validade, lotePrincipalId: raiz.id } });
    const entrada = await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitio.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date("2026-10-03"), quantidade: 50, custoUnitario: 2, valorTotal: 100, alocacaoPartidaEstoques: { create: { partidaId: alias.id, quantidade: 50 } } } });
    const saida = await movimento(produto.id, sitio.id, "SAIDA", 10, [{ partidaId: alias.id, quantidade: 10 }]);
    expect((await prisma.alocacaoPartidaEstoque.findFirstOrThrow({ where: { movimentoEstoqueId: saida.id } })).partidaId).toBe(raiz.id);
    expect(await prisma.$transaction((tx) => saldoPartidaTx(tx, alias.id, sitio.id))).toEqual(new Prisma.Decimal(40));
    expect((await listarMovimentos({ produtoId: produto.id, partidaId: alias.id, propriedadeId: sitio.id })).total).toBe(2);
    await expect(transacaoEstoque((tx) => estornarMovimentoTx(tx, entrada.id))).rejects.toThrow(/consumido/);
    await transacaoEstoque((tx) => estornarMovimentoTx(tx, saida.id));
    const reversao = await transacaoEstoque((tx) => estornarMovimentoTx(tx, entrada.id));
    expect((await prisma.alocacaoPartidaEstoque.findFirstOrThrow({ where: { movimentoEstoqueId: reversao.inverso.id } })).partidaId).toBe(alias.id);
    expect((await listarPartidas(produto.id, sitio.id))[0].saldo).toBe("0");
  });

  it("estorno de movimento com dois aliases confere soma do grupo", async () => {
    const { sitio, produto } = await fixture();
    const raiz = await prisma.partidaProduto.create({ data: { produtoId: produto.id, codigo: "A", validade: new Date("2026-12-31") } });
    const alias = await prisma.partidaProduto.create({ data: { produtoId: produto.id, codigo: "B", validade: raiz.validade, lotePrincipalId: raiz.id } });
    await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitio.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date("2026-10-03"), quantidade: 50, custoUnitario: 2, valorTotal: 100, alocacaoPartidaEstoques: { create: [{ partidaId: raiz.id, quantidade: 25 }, { partidaId: alias.id, quantidade: 25 }] } } });
    await movimento(produto.id, sitio.id, "SAIDA", 20, [{ partidaId: raiz.id, quantidade: 20 }]);
    await expect(prisma.$transaction((tx) => conferirSaldoEstornoPartidasTx(tx, [{ partidaId: raiz.id, quantidade: new Prisma.Decimal(25) }, { partidaId: alias.id, quantidade: new Prisma.Decimal(25) }], sitio.id))).rejects.toThrow(/consumido/);
  });

  it("ativação sem movimento não cria grupo; renomear audita e valores são ocultados", async () => {
    const { sitio, produto } = await fixture(false);
    await ativarRastreio(produto.id, null);
    expect(await prisma.partidaProduto.count({ where: { produtoId: produto.id } })).toBe(0);
    await movimento(produto.id, sitio.id, "ENTRADA", 50, [{ validade: "2026-12-31", quantidade: 50 }]);
    const [lote] = await listarPartidas(produto.id, sitio.id);
    await renomearLote(lote.id, "Frasco novo", null);
    expect(await prisma.auditoriaFinanceira.count({ where: { entidadeId: lote.id, acao: "RENOMEAR_LOTE" } })).toBe(1);
    expect(await detalheProduto(produto.id, sitio.id, false, false)).toMatchObject({ saldo: "50", custoMedio: null, valor: null });
    expect((await origensProduto(produto.id, sitio.id, { pagina: 1, porPagina: 1 }, false, false)).itens[0]).toMatchObject({ custoUnitario: null, valorTotal: null, operacaoId: null, fornecedorId: null });
  });

  it("identificação divide o grupo desconhecido sem alterar quantidade ou valor", async () => {
    const { sitio, produto } = await fixture();
    await movimento(produto.id, sitio.id, "ENTRADA", 50, [{ validade: null, quantidade: 50 }]);
    await identificarLegado({ chave: crypto.randomUUID(), produtoId: produto.id, propriedadeId: sitio.id, nome: "Validade conferida", validade: "2026-12-31", quantidade: "10", motivo: "Conferência física da validade", data: "2026-10-03" }, null);
    const lotes = await listarPartidas(produto.id, sitio.id);
    expect(lotes.find((p) => !p.validade)?.saldo).toBe("40"); expect(lotes.find((p) => p.validade)?.saldo).toBe("10");
    const ajustes = await prisma.movimentoEstoque.findMany({ where: { produtoId: produto.id, origem: "IDENTIFICACAO_PARTIDA" } });
    expect(ajustes.reduce((s, m) => s.plus(m.quantidade), new Prisma.Decimal(0)).toString()).toBe("0");
    expect(ajustes.reduce((s, m) => s.plus(m.valorTotal), new Prisma.Decimal(0)).toString()).toBe("0");
  });

  it("compra real distribui 50/30, filtra origem e reenvia a mesma confirmação uma única vez", async () => {
    const { sitio, produto } = await fixture();
    const parceiro = await prisma.parceiro.create({ data: { nome: `Compra confirmada ${run}`, tipo: "FORNECEDOR" } }); parceiros.push(parceiro.id);
    const input = { ...operacaoSchema.parse({ chave: crypto.randomUUID(), tipo: "COMPRA_ESTOQUE", data: "2026-10-03", descricao: "Compra rastreada em duas validades", parceiroId: parceiro.id,
      itens: [{ produtoId: produto.id, descricao: produto.nome, quantidade: 80, unidade: "mL", valorUnitario: 2, partidas: [{ validade: "2026-12-31", quantidade: 50 }, { validade: null, quantidade: 30 }] }],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } }), propriedadeId: sitio.id };
    const [primeira, reenvioConcorrente] = await Promise.all([criarOperacao(input), criarOperacao(input)]);
    expect(reenvioConcorrente.id).toBe(primeira.id);
    expect((await criarOperacao(input)).id).toBe(primeira.id);
    await expect(criarOperacao({ ...input, descricao: "Compra com conteúdo alterado" })).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: produto.id } })).toBe(1);
    const raiz = (await listarPartidas(produto.id, sitio.id)).find((p) => !!p.validade)!;
    const alias = await prisma.partidaProduto.create({ data: { produtoId: produto.id, codigo: "HISTORICO-COMPRA", validade: raiz.validade, lotePrincipalId: raiz.id } });
    const origem = (await origensProduto(produto.id, sitio.id, { partidaId: alias.id, pagina: 1, porPagina: 10 }, true, true)).itens[0];
    expect(origem).toMatchObject({ quantidade: "50", quantidadeMovimento: "80", custoUnitario: "2", valorTotal: "100", valorTotalMovimento: "160" });
    const origemSemValores = (await origensProduto(produto.id, sitio.id, { partidaId: alias.id, pagina: 1, porPagina: 10 }, false, false)).itens[0];
    expect(origemSemValores).toMatchObject({ quantidade: "50", custoUnitario: null, valorTotal: null, valorTotalMovimento: null, operacaoId: null, fornecedorId: null });
    expect(origem.partidas).toHaveLength(1);
    const movimentoFiltrado = (await listarMovimentos({ produtoId: produto.id, partidaId: alias.id, propriedadeId: sitio.id })).itens[0];
    expect(movimentoFiltrado).toMatchObject({ quantidade: 50, quantidadeMovimento: 80, custoUnitario: 2, valorTotal: 100, valorTotalMovimento: 160 });
    expect((await prisma.itemOperacao.findFirstOrThrow({ where: { operacaoId: primeira.id } })).partidasSnapshot).toEqual(expect.arrayContaining([expect.objectContaining({ partidaId: raiz.id, quantidade: "50" })]));
  });

  it("rascunho não cria lote e replay após timeout retorna a compra já confirmada", async () => {
    const { sitio, produto } = await fixture();
    const usuario = await prisma.usuario.create({ data: { email: `lotes-${crypto.randomUUID()}@teste.local`, nome: "Teste de rascunho", papel: "proprietario" } }); usuarios.push(usuario.id);
    const chave = crypto.randomUUID();
    const operacao = { chave, tipo: "INVENTARIO_INICIAL", data: "2026-10-03", descricao: "Inventário confirmado do rascunho", itens: [{ produtoId: produto.id, descricao: produto.nome, quantidade: 50, unidade: "mL", valorUnitario: 2, partidas: [{ validade: null, quantidade: 50 }] }], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } };
    const rascunho = await salvarRascunho({ propriedadeId: sitio.id, usuarioId: usuario.id, dados: { operacao } });
    expect(await prisma.partidaProduto.count({ where: { produtoId: produto.id } })).toBe(0);
    const confirmada = await confirmarRascunho(sitio.id, usuario.id, rascunho.versao, chave);
    expect((await confirmarRascunho(sitio.id, usuario.id, rascunho.versao, chave)).id).toBe(confirmada.id);
    await expect(confirmarRascunho(sitio.id, usuario.id, rascunho.versao + 1, chave)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: produto.id } })).toBe(1);
  });
});
