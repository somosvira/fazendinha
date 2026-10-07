import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { criarProtocolo, publicarProtocolo, iniciarExecucao, cancelarExecucao } from "./protocolos.js";
import { criarAplicacao, anularAplicacao } from "./aplicacoes.js";
import { criarTipoExame } from "./exames.js";
import { preverExecucaoEtapas, confirmarExecucaoEtapas } from "./execucao-etapas.js";
import type { ExecucaoEtapasInput } from "./execucao-etapas.schemas.js";

const describeBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const sitios: number[] = []; const animais: string[] = []; const protocolos: string[] = []; const produtos: string[] = []; const execucoes: string[] = []; const tiposExame: string[] = [];
const diasAntes = (n: number) => new Date(Date.parse(hojeFazenda()) - n * 86_400_000).toISOString().slice(0, 10);

afterAll(async () => {
  if (!sitios.length) return;
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId: { in: sitios } }, { animalId: { in: animais } }, { entidadeId: { in: [...protocolos, ...tiposExame] } }] } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.exameAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.movimentoEstoque.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.tarefaSanitaria.deleteMany({ where: { execucaoId: { in: execucoes } } });
  await prisma.execucaoProtocoloSanitario.deleteMany({ where: { id: { in: execucoes } } });
  await prisma.rodadaProtocoloSanitario.deleteMany({ where: { propriedadeId: { in: sitios } } });
  await prisma.etapaProtocoloSanitario.deleteMany({ where: { protocoloId: { in: protocolos } } });
  await prisma.protocoloSanitario.deleteMany({ where: { id: { in: protocolos } } });
  await prisma.tipoExame.deleteMany({ where: { id: { in: tiposExame } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: sitios } } });
});

async function preparar(saldo = "10") {
  const run = crypto.randomUUID().slice(0, 8);
  const sitio = await prisma.propriedade.create({ data: { nome: `Etapa conjunta ${run}` } }); sitios.push(sitio.id);
  const produto = await prisma.produto.create({ data: { nome: `Vacina coletiva ${run}`, unidade: "ML", usoSanitario: true } }); produtos.push(produto.id);
  const protocolo = await criarProtocolo({ nome: `Etapas conjuntas ${run}`, etapas: [{ tipo: "APLICACAO", diaRelativo: 0, produtoId: produto.id, finalidade: "VACINA", dose: 2, unidade: "ML", via: "Subcutânea" }, { tipo: "APLICACAO", diaRelativo: 5, produtoId: produto.id, finalidade: "VACINA", dose: 2, unidade: "ML", via: "Subcutânea" }] }, null); protocolos.push(protocolo.id);
  await publicarProtocolo(protocolo.id, null);
  const rodada = await prisma.rodadaProtocoloSanitario.create({ data: { nome: `Rodada ${run}`, protocoloId: protocolo.id, propriedadeId: sitio.id, inicioReferencia: new Date(diasAntes(2)) } });
  const itens: ExecucaoEtapasInput["itens"] = [];
  for (let n = 0; n < 2; n++) {
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `EC${run}${n}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: sitio.id }), null); animais.push(animal.id);
    const execucao = await iniciarExecucao({ protocoloId: protocolo.id, animalId: animal.id, propriedadeId: sitio.id, inicio: diasAntes(2) }, null); execucoes.push(execucao.id);
    await prisma.execucaoProtocoloSanitario.update({ where: { id: execucao.id }, data: { rodadaId: rodada.id } });
    itens.push({ tipo: "APLICACAO", animalId: animal.id, propriedadeId: sitio.id, tarefaId: execucao.tarefas[0].id, data: diasAntes(1), aplicadaEm: `${diasAntes(1)}T14:00:00-03:00`,
      produtoId: produto.id, nomeProdutoAplicado: produto.nome, finalidade: "VACINA", dose: "2", unidadeDose: "ML", via: "Subcutânea", origemInsumo: "BAIXA_ESTOQUE", carenciaLeiteHoras: 0, carenciaCarneHoras: 0, desvio: { motivo: "Execução realizada no dia seguinte" } });
  }
  await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: sitio.id, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", quantidade: saldo, data: new Date(diasAntes(3)), custoUnitario: 1, valorTotal: saldo } });
  return { input: { propriedadeId: sitio.id, itens }, produtoId: produto.id, execucaoId: execucoes[execucoes.length - 2] };
}

describeBanco("execução da etapa no PostgreSQL", () => {
  it("grupos disjuntos com tipos desviados em ordem oposta concluem sem deadlock", async () => {
    const run = crypto.randomUUID().slice(0, 8);
    const sitio = await prisma.propriedade.create({ data: { nome: `Exames concorrentes ${run}` } }); sitios.push(sitio.id);
    const tipos = await Promise.all(["A", "B"].map((nome) => criarTipoExame({ nome: `Exame ${nome} ${run}`, tipoResultado: "TEXTO" }, null)));
    tiposExame.push(...tipos.map((t) => t.id));
    const protocolo = await criarProtocolo({ nome: `Exames concorrentes ${run}`, etapas: [{ tipo: "EXAME", diaRelativo: 0, tipoExameId: tipos[0].id }] }, null); protocolos.push(protocolo.id);
    await publicarProtocolo(protocolo.id, null);
    const rodada = await prisma.rodadaProtocoloSanitario.create({ data: { nome: `Exames ${run}`, protocoloId: protocolo.id, propriedadeId: sitio.id, inicioReferencia: new Date(diasAntes(1)) } });
    const itens: ExecucaoEtapasInput["itens"] = [];
    for (let n = 0; n < 4; n++) {
      const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `EX${run}${n}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: sitio.id }), null); animais.push(animal.id);
      const execucao = await iniciarExecucao({ protocoloId: protocolo.id, animalId: animal.id, propriedadeId: sitio.id, inicio: diasAntes(1) }, null); execucoes.push(execucao.id);
      await prisma.execucaoProtocoloSanitario.update({ where: { id: execucao.id }, data: { rodadaId: rodada.id } });
      itens.push({ tipo: "EXAME", animalId: animal.id, propriedadeId: sitio.id, tarefaId: execucao.tarefas[0].id, data: diasAntes(1), tipoExameId: tipos[[0, 1, 1, 0][n]].id, desvio: { motivo: "Tipo de coleta revisto pelo veterinário" } });
    }
    const grupos = [itens.slice(0, 2), itens.slice(2)].map((grupo) => ({ propriedadeId: sitio.id, itens: grupo }));
    const previas = await Promise.all(grupos.map(preverExecucaoEtapas));
    const confirmacoes = grupos.map((grupo, n) => ({ ...grupo, chave: crypto.randomUUID(), fingerprint: previas[n].fingerprint }));
    const resultados = await Promise.all(confirmacoes.map((input) => confirmarExecucaoEtapas(input, null)));
    expect(resultados.map((r) => (r.resultados as unknown[]).length)).toEqual([2, 2]);
    expect(await prisma.exameAnimal.count({ where: { propriedadeId: sitio.id, status: "VALIDO" } })).toBe(4);
    expect(await prisma.requisicaoPecuaria.count({ where: { propriedadeId: sitio.id } })).toBe(2);
    expect(await prisma.aplicacaoProduto.count({ where: { propriedadeId: sitio.id } })).toBe(0);
  });
  it("prévia não grava e valida estoque do conjunto antes da confirmação atômica idempotente", async () => {
    const { input, produtoId } = await preparar("3");
    const movimentos = await prisma.movimentoEstoque.count({ where: { produtoId } });
    await expect(preverExecucaoEtapas(input)).rejects.toMatchObject({ campo: "dose" });
    expect(await prisma.aplicacaoProduto.count({ where: { propriedadeId: input.propriedadeId } })).toBe(0);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId } })).toBe(movimentos);
    await prisma.movimentoEstoque.create({ data: { produtoId, propriedadeId: input.propriedadeId, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", quantidade: 1, data: new Date(diasAntes(3)), custoUnitario: 1, valorTotal: 1 } });
    const previa = await preverExecucaoEtapas(input);
    expect(await prisma.requisicaoPecuaria.count({ where: { propriedadeId: input.propriedadeId } })).toBe(0);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId } })).toBe(movimentos + 1);
    const confirmar = { ...input, chave: crypto.randomUUID(), fingerprint: previa.fingerprint };
    expect(await confirmarExecucaoEtapas(confirmar, null)).toEqual(await confirmarExecucaoEtapas(confirmar, null));
    expect(await prisma.aplicacaoProduto.count({ where: { propriedadeId: input.propriedadeId } })).toBe(2);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId, tipo: "SAIDA", status: "CONFIRMADO" } })).toBe(2);
  });
  it("saldo alterado após prévia não deixa fato parcial nem consome mais estoque", async () => {
    const { input, produtoId } = await preparar("5"); const previa = await preverExecucaoEtapas(input);
    await prisma.movimentoEstoque.create({ data: { produtoId, propriedadeId: input.propriedadeId, tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", quantidade: 2, data: new Date(diasAntes(1)), custoUnitario: 1, valorTotal: 2 } });
    await expect(confirmarExecucaoEtapas({ ...input, chave: crypto.randomUUID(), fingerprint: previa.fingerprint }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.aplicacaoProduto.count({ where: { propriedadeId: input.propriedadeId } })).toBe(0);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId, tipo: "SAIDA" } })).toBe(1);
    expect(await prisma.requisicaoPecuaria.count({ where: { propriedadeId: input.propriedadeId } })).toBe(0);
  });
  it("anulação permite outra tentativa, conserva desvio e não altera etapas seguintes", async () => {
    const { input } = await preparar(); const primeiroInput = input.itens[0]; if (primeiroInput.tipo !== "APLICACAO") throw new Error("fixture");
    const seguinte = await prisma.tarefaSanitaria.findFirstOrThrow({ where: { execucao: { animalId: primeiroInput.animalId }, id: { not: primeiroInput.tarefaId } } });
    await expect(criarAplicacao({ ...primeiroInput, desvio: undefined }, null)).rejects.toMatchObject({ campo: "desvio.motivo" });
    const primeiro = await criarAplicacao({ ...primeiroInput, dose: "3", via: "Intramuscular" }, null);
    expect(primeiro.desvioProtocoloSnapshot).toMatchObject({ diferencas: [{ campo: "data" }, { campo: "dose" }, { campo: "via" }], motivo: primeiroInput.desvio?.motivo });
    await anularAplicacao(primeiro.id, input.propriedadeId, "Dose anotada para o animal errado", null);
    const nova = await criarAplicacao(primeiroInput, null);
    expect(nova.id).not.toBe(primeiro.id);
    expect((await prisma.tarefaSanitaria.findUniqueOrThrow({ where: { id: seguinte.id } })).previstaPara).toEqual(seguinte.previstaPara);
    expect(await prisma.aplicacaoProduto.count({ where: { tarefaId: primeiroInput.tarefaId, status: "VALIDO" } })).toBe(1);
    expect(await prisma.aplicacaoProduto.count({ where: { tarefaId: primeiroInput.tarefaId, status: "ANULADO" } })).toBe(1);
  });
  it("cancelamento concorrente respeita a trava e nunca confirma só parte do conjunto", async () => {
    const { input, execucaoId } = await preparar(); const previa = await preverExecucaoEtapas(input);
    const resultados = await Promise.allSettled([cancelarExecucao(execucaoId, input.propriedadeId, "Participação encerrada pelo responsável", null), confirmarExecucaoEtapas({ ...input, chave: crypto.randomUUID(), fingerprint: previa.fingerprint }, null)]);
    expect(resultados[0].status).toBe("fulfilled");
    const fatos = await prisma.aplicacaoProduto.count({ where: { propriedadeId: input.propriedadeId, status: "VALIDO" } });
    expect([0, 2]).toContain(fatos);
    expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: input.propriedadeId, tipo: "SAIDA", status: "CONFIRMADO" } })).toBe(fatos);
  });
});
