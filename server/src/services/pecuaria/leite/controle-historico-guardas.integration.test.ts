import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { darBaixa, editar, movimentar } from "../rebanho/animais.js";
import { travarAnimais } from "../rebanho/regras.js";
import { corrigirLactacao, encerrarLactacao } from "../reproducao/registros.js";
import { transacaoPecuaria } from "../transacao.js";
import { registrarControleHistoricoLeiteTx, type FonteControleHistorico } from "./controle-historico.js";

const suite = describe.runIf(process.env.PECUARIA_DB_INTEGRATION === "1");
const dia = (s: string) => new Date(s);

/** Espera a disputa real da advisory lock, sem presumir ordem pelo tempo de chamada. */
async function esperarFila(animalId: string, quantidade: number) {
  for (let i = 0; i < 500; i++) {
    const [{ n }] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_locks
      WHERE locktype='advisory' AND NOT granted
      AND objid::bigint=(hashtext(${`pec-animal:${animalId}`})::bigint & 4294967295)`;
    if (n >= quantidade) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Operações não chegaram à fila da trava do animal");
}

async function disputarEmOrdem(animalId: string, primeira: () => Promise<unknown>, segunda: () => Promise<unknown>) {
  let soltar!: () => void, sinalizar!: () => void;
  const portao = new Promise<void>(r => { soltar = r; });
  const travado = new Promise<void>(r => { sinalizar = r; });
  const bloqueio = prisma.$transaction(async tx => {
    await travarAnimais(tx, [animalId]);
    sinalizar();
    await portao;
  }, { timeout: 20000 });
  await travado;
  const primeiraPendente = Promise.allSettled([primeira()]);
  let segundaPendente: ReturnType<typeof Promise.allSettled> | undefined;
  try {
    await esperarFila(animalId, 1);
    segundaPendente = Promise.allSettled([segunda()]);
    await esperarFila(animalId, 2);
  } finally {
    soltar();
    await bloqueio;
  }
  const [a] = await primeiraPendente;
  const [b] = await segundaPendente!;
  return [a, b];
}

// Cada caso cria sujeito, sítio e autor próprios; a limpeza usa somente esses IDs.
suite("leite documental — guardas inversas e concorrência real", () => {
  let sitio: number, autor: number, animalId: string, fonte: FonteControleHistorico;
  const sitiosDestino: number[] = [];
  beforeEach(async () => {
    exigirBancoIntegracaoPecuaria();
    const token = randomUUID();
    sitio = (await prisma.propriedade.create({ data: { nome: `Guarda documental ${token}` } })).id;
    autor = (await prisma.usuario.create({ data: { nome: `Guarda ${token}`, email: `guarda-${token}@example.test`, papel: "DONO", status: "ATIVO" } })).id;
    animalId = (await prisma.animal.create({ data: {
      brinco: `DOC-${token}`, sexo: "F", origem: "COMPRADO", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2024-01-01"),
      localizacoes: { create: { propriedadeId: sitio, desde: dia("2024-01-01") } },
      destinos: { create: { aptidao: "LEITE", desde: dia("2024-01-01") } },
    } })).id;
    fonte = { bancoOrigem: `TESTE-${token}`, chaveOrigem: "CONTROLE:1", registro: {
      tipo: "CONTROLE_PERIODICO", inicio: "2024-10-20", fim: "2024-10-20", animalId, propriedadeId: sitio,
      contexto: "INTERNO", lactacaoId: null, total: 20, unidade: "L", referenciaUnidade: "Documento em litros",
      parcelas: [], evidencia: "Controle original da matriz conferido", snapshotOrigem: { token },
    } };
  });
  afterEach(async () => {
    if (animalId) {
      await prisma.auditoriaPecuaria.deleteMany({ where: { animalId } });
      await prisma.controleHistoricoLeite.deleteMany({ where: { animalId } });
      await prisma.lactacaoAnimal.deleteMany({ where: { animalId } });
      await prisma.baixaAnimal.deleteMany({ where: { animalId } });
      await prisma.finalidadeAnimal.deleteMany({ where: { animalId } });
      await prisma.localizacaoAnimal.deleteMany({ where: { animalId } });
      await prisma.animal.delete({ where: { id: animalId } });
    }
    if (autor) await prisma.usuario.delete({ where: { id: autor } });
    if (sitio) await prisma.propriedade.delete({ where: { id: sitio } });
    for (const id of sitiosDestino.splice(0)) await prisma.propriedade.delete({ where: { id } });
  });
  const importar = () => transacaoPecuaria(tx => registrarControleHistoricoLeiteTx(tx, fonte, autor));

  it("documento sem lactação bloqueia baixa anterior e revisões cadastrais atomicamente", async () => {
    const controle = await importar();
    const antes = await prisma.animal.findUniqueOrThrow({ where: { id: animalId } });
    const local = await prisma.localizacaoAnimal.findFirstOrThrow({ where: { animalId } });
    const auditorias = await prisma.auditoriaPecuaria.count({ where: { animalId } });
    await expect(darBaixa({ animalId, data: "2024-10-19", tipo: "MORTE" }, autor, sitio)).rejects.toMatchObject({ code: "CONFLITO" });
    const destino = await prisma.propriedade.create({ data: { nome: `Destino documental ${randomUUID()}` } });
    sitiosDestino.push(destino.id);
    await expect(movimentar({ animalIds: [animalId], propriedadeId: destino.id, data: "2024-10-19" }, autor, sitio)).rejects.toMatchObject({ code: "CONFLITO" });
    for (const revisao of [{ sexo: "M" as const }, { dataNascimento: "2024-10-21", dataEntrada: "2024-10-21" }, { dataEntrada: "2024-10-21" }])
      await expect(editar(animalId, revisao, autor, sitio)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await prisma.animal.findUniqueOrThrow({ where: { id: animalId } })).toEqual(antes);
    expect(await prisma.localizacaoAnimal.findUniqueOrThrow({ where: { id: local.id } })).toEqual(local);
    expect(await prisma.baixaAnimal.count({ where: { animalId } })).toBe(0);
    expect(await prisma.auditoriaPecuaria.count({ where: { animalId } })).toBe(auditorias);
    expect(await prisma.movimentacao.count({ where: { propriedadeDestinoId: destino.id } })).toBe(0);
    expect((await prisma.controleHistoricoLeite.findUniqueOrThrow({ where: { id: controle.id } })).inicio).toEqual(dia("2024-10-20"));
    await editar(animalId, { dataEntrada: "2024-01-02" }, autor, sitio);
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animalId } })).dataEntrada).toEqual(dia("2024-01-02"));
    expect((await prisma.controleHistoricoLeite.findUniqueOrThrow({ where: { id: controle.id } })).inicio).toEqual(dia("2024-10-20"));
  });

  it("secagem e correção conservam documento vinculado e a lactação original", async () => {
    const lactacao = await prisma.lactacaoAnimal.create({ data: { animalId, propriedadeId: sitio, inicio: dia("2024-01-01") } });
    fonte.registro.lactacaoId = lactacao.id;
    await importar();
    await expect(encerrarLactacao(lactacao.id, sitio, "2024-10-20", "Secagem retroativa", autor)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(corrigirLactacao(lactacao.id, { propriedadeId: sitio, inicio: "2024-10-21", motivo: "Início retificado", versaoEsperada: 1 }, autor)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await prisma.lactacaoAnimal.findUniqueOrThrow({ where: { id: lactacao.id } })).toEqual(lactacao);
  });

  it("ordem inversa: baixa já confirmada impede importar controle posterior", async () => {
    await darBaixa({ animalId, data: "2024-10-19", tipo: "MORTE" }, autor, sitio);
    await expect(importar()).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.controleHistoricoLeite.count({ where: { animalId } })).toBe(0);
    expect(await prisma.auditoriaPecuaria.count({ where: { animalId, entidade: "ControleHistoricoLeite" } })).toBe(0);
  });

  it.each([true, false])("importação e edição de sexo disputam a mesma trava, importação primeiro=%s", async importacaoPrimeiro => {
    const alterar = () => editar(animalId, { sexo: "M" }, autor, sitio);
    const [primeira, segunda] = await disputarEmOrdem(animalId, importacaoPrimeiro ? importar : alterar, importacaoPrimeiro ? alterar : importar);
    expect(primeira.status).toBe("fulfilled");
    expect(segunda.status).toBe("rejected");
    if (segunda.status === "rejected") expect(segunda.reason).toMatchObject({ code: importacaoPrimeiro ? "CONFLITO" : "VALIDACAO" });
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animalId } })).sexo).toBe(importacaoPrimeiro ? "F" : "M");
    expect(await prisma.controleHistoricoLeite.count({ where: { animalId } })).toBe(importacaoPrimeiro ? 1 : 0);
  }, 30000);
});
