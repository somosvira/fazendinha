// Testes de banco da pecuária v1 (Rebanho): chamam os services reais contra o Postgres.
// Só rodam com PECUARIA_DB_INTEGRATION=1 (o CI liga; ver .github/workflows/staging.yml) e
// precisam das migrations aplicadas via `prisma migrate deploy` — os índices parciais de
// "uma linha aberta por animal" e as FKs ON DELETE SET NULL da baixa só existem no SQL delas.
// Cada teste cria os próprios sítios, lotes e animais (nomes/brincos únicos por execução) e o
// afterAll apaga tudo em ordem segura de FK.

import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import {
  buscarFicha, cadastrar, darBaixa, definirCategoriaManual, desfazerLocalizacao, desfazerMovimentacao,
  estornarBaixa, listar, movimentar, registrarPesagem,
} from "./animais.js";
import { carregarRegras, criarCategoria, manualDe, SELECT_MANUAL_ABERTA } from "./categorias.js";
import { avaliarCategoria, idadeEmMeses, idadeNaFaixa, nascimentoLimiteParaIdade } from "./categoria.calc.js";
import { criarLote, editarLote, buscarResumoLote } from "./lotes.js";
import { buscarMovimentacao } from "./movimentacoes.js";
import { diasEntre, gmdEntre } from "./peso.calc.js";
import { hojeFazenda, hojeFazendaDate, RebanhoError, travarAnimais } from "./regras.js";
import { cadastrarAnimalSchema, criarCategoriaSchema, listarFiltrosSchema, pesagemSchema } from "./schemas.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

const RUN = crypto.randomUUID().slice(0, 8);
const DIA_MS = 86_400_000;

const propriedadesCriadas: number[] = [];
const animaisCriados: string[] = [];
const categoriasCriadas: string[] = [];
const racasCriadas: string[] = [];
let seq = 0;

/** 'YYYY-MM-DD' `dias` antes de hoje (fuso da fazenda). */
function diasAntes(dias: number, base = hojeFazenda()): string {
  return new Date(Date.parse(base) - dias * DIA_MS).toISOString().slice(0, 10);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function brincoUnico(prefixo = "B"): string {
  seq += 1;
  return `${prefixo}${RUN}-${seq}`;
}

async function sitio(rotulo: string): Promise<number> {
  const p = await prisma.propriedade.create({ data: { nome: `Pec ${rotulo} ${RUN}-${crypto.randomUUID().slice(0, 8)}` } });
  propriedadesCriadas.push(p.id);
  return p.id;
}

async function novoAnimal(propriedadeId: number, extra: Record<string, unknown> = {}) {
  const input = cadastrarAnimalSchema.parse({
    brinco: brincoUnico(),
    sexo: "F",
    origem: "COMPRADO",
    dataNascimento: diasAntes(800),
    dataEntrada: diasAntes(30),
    propriedadeId,
    aptidao: "LEITE",
    ...extra,
  });
  const animal = await cadastrar(input, null);
  animaisCriados.push(animal.id);
  return animal;
}

/** Tudo o que uma escrita no histórico pode tocar, para comparar antes × depois ("nada mudou"). */
async function fotografia(animalIds: string[]) {
  const where = { animalId: { in: animalIds } };
  const [localizacoes, itens, destinos, baixas] = await Promise.all([
    prisma.localizacaoAnimal.findMany({ where, orderBy: { id: "asc" } }),
    prisma.movimentacaoAnimal.findMany({ where, orderBy: { id: "asc" } }),
    prisma.destinoAnimal.findMany({ where, orderBy: { id: "asc" } }),
    prisma.baixaAnimal.findMany({ where, orderBy: { id: "asc" } }),
  ]);
  return { localizacoes, itens, destinos, baixas };
}

async function abertas(animalId: string) {
  return prisma.localizacaoAnimal.findMany({ where: { animalId, ate: null } });
}

/** Quantas transações esperam a trava `pec-animal:<id>` (advisory lock de chave bigint: objid = 32 bits baixos). */
async function naFilaDaTrava(animalId: string): Promise<number> {
  const chave = `pec-animal:${animalId}`;
  const [{ n }] = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM pg_locks
    WHERE locktype = 'advisory' AND NOT granted AND objid::bigint = (hashtext(${chave})::bigint & 4294967295)`;
  return n;
}

async function esperarFila(animalId: string, quantos: number) {
  for (let t = 0; t < 500; t += 1) {
    if ((await naFilaDaTrava(animalId)) >= quantos) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`timeout: ${quantos} transações não chegaram à fila da trava do animal`);
}

/**
 * Segura a trava do animal, dispara `primeira` e espera ela entrar na fila, dispara `segunda` e
 * espera as duas na fila, e só então solta: as duas estão de fato concorrendo, e o Postgres
 * concede a trava na ordem da fila.
 */
async function emFilaNaTrava<A, B>(animalId: string, primeira: () => Promise<A>, segunda: () => Promise<B>) {
  let soltar!: () => void;
  const portao = new Promise<void>((r) => { soltar = r; });
  let travou!: () => void;
  const travado = new Promise<void>((r) => { travou = r; });
  const segurando = prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    travou();
    await portao;
  }, { timeout: 20_000 });
  await travado;
  try {
    const r1 = Promise.allSettled([primeira()]);
    await esperarFila(animalId, 1);
    const r2 = Promise.allSettled([segunda()]);
    await esperarFila(animalId, 2);
    soltar();
    await segurando;
    const [[a], [b]] = await Promise.all([r1, r2]);
    return [a, b] as const;
  } finally {
    soltar();
    await segurando.catch(() => undefined);
  }
}

afterAll(async () => {
  if (!propriedadesCriadas.length && !categoriasCriadas.length && !racasCriadas.length) return;
  const propriedadeId = { in: propriedadesCriadas };
  // animais que passaram por um sítio do teste (inclui algum cadastro que falhou no meio de um assert)
  const porSitio = await prisma.animal.findMany({ where: { localizacoes: { some: { propriedadeId } } }, select: { id: true } });
  const ids = [...new Set([...animaisCriados, ...porSitio.map((a) => a.id)])];
  const animalId = { in: ids };
  const movs = await prisma.movimentacao.findMany({ where: { OR: [{ propriedadeDestinoId: propriedadeId }, { animais: { some: { animalId } } }] }, select: { id: true } });
  const lotes = await prisma.lote.findMany({ where: { propriedadeId }, select: { id: true } });
  const entidades = [...movs.map((m) => m.id), ...lotes.map((l) => l.id), ...categoriasCriadas, ...racasCriadas, ...ids];

  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId }, { entidadeId: { in: entidades } }] } });
  await prisma.baixaAnimal.deleteMany({ where: { animalId } });
  await prisma.movimentacaoAnimal.deleteMany({ where: { OR: [{ animalId }, { movimentacaoId: { in: movs.map((m) => m.id) } }] } });
  await prisma.localizacaoAnimal.deleteMany({ where: { OR: [{ animalId }, { propriedadeId }] } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: movs.map((m) => m.id) } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId } });
  await prisma.pesagem.deleteMany({ where: { animalId } });
  await prisma.composicaoRacial.deleteMany({ where: { animalId } });
  await prisma.categoriaManualAnimal.deleteMany({ where: { OR: [{ animalId }, { categoriaId: { in: categoriasCriadas } }] } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.lote.deleteMany({ where: { propriedadeId } });
  await prisma.categoriaAnimal.deleteMany({ where: { id: { in: categoriasCriadas } } });
  await prisma.raca.deleteMany({ where: { id: { in: racasCriadas } } });
  await prisma.propriedade.deleteMany({ where: { id: propriedadeId } });
});

describeComBanco("pecuária v1 (rebanho) com PostgreSQL", () => {
  const HOJE = hojeFazenda();

  it("movimentar é tudo ou nada: um brinco em conflito no destino não grava nada para nenhum animal", async () => {
    const origem = await sitio("origem");
    const destino = await sitio("destino");
    const ocupante = await novoAnimal(destino);
    const animais = await Promise.all([novoAnimal(origem), novoAnimal(origem), novoAnimal(origem, { brinco: ` ${ocupante.brinco.toLowerCase()} ` })]);
    // o terceiro repete (normalizado) o brinco de um animal ativo no destino
    const ids = animais.map((a) => a.id);
    const antes = await fotografia([...ids, ocupante.id]);
    const movsAntes = await prisma.movimentacao.count({ where: { propriedadeDestinoId: destino } });

    const erro = await movimentar({ animalIds: ids, propriedadeId: destino, data: HOJE }, null, null).catch((e) => e);
    expect(erro).toBeInstanceOf(RebanhoError);
    expect(erro).toMatchObject({ code: "BRINCO_DUPLICADO" });
    expect(erro.message).toMatch(/Nenhum animal foi movido/);

    expect(await fotografia([...ids, ocupante.id])).toEqual(antes);
    expect(await prisma.movimentacao.count({ where: { propriedadeDestinoId: destino } })).toBe(movsAntes);
    for (const id of ids) expect((await abertas(id)).map((l) => l.propriedadeId)).toEqual([origem]);
  });

  it("desfazerMovimentacao é tudo ou nada: um animal já movido de novo bloqueia todos", async () => {
    const a = await sitio("A");
    const b = await sitio("B");
    const c = await sitio("C");
    const animais = await Promise.all([novoAnimal(a), novoAnimal(a), novoAnimal(a)]);
    const ids = animais.map((x) => x.id);
    const { movimentacaoId } = await movimentar({ animalIds: ids, propriedadeId: b, data: diasAntes(5) }, null, null);
    await movimentar({ animalIds: [ids[1]], propriedadeId: c, data: diasAntes(2) }, null, null);

    const antes = await fotografia(ids);
    const erro = await desfazerMovimentacao(movimentacaoId, "Teste tudo ou nada", null, null).catch((e) => e);
    expect(erro).toBeInstanceOf(RebanhoError);
    expect(erro).toMatchObject({ code: "CONFLITO" });
    expect(erro.message).toMatch(/Nada foi desfeito/);

    expect(await fotografia(ids)).toEqual(antes);
    const mov = await prisma.movimentacao.findUniqueOrThrow({ where: { id: movimentacaoId } });
    expect(mov.desfeitaEm).toBeNull();
    expect(await prisma.auditoriaPecuaria.count({ where: { entidade: "Movimentacao", entidadeId: movimentacaoId, acao: "DESFAZER" } })).toBe(0);
    expect((await abertas(ids[0]))[0].propriedadeId).toBe(b);
    expect((await abertas(ids[1]))[0].propriedadeId).toBe(c);
  });

  it("estorno de uma baixa no mesmo dia de uma movimentação reabre exatamente a linha que a baixa fechou", async () => {
    const a = await sitio("A");
    const b = await sitio("B");
    const animal = await novoAnimal(a);
    const [inicial] = await abertas(animal.id);
    await movimentar({ animalIds: [animal.id], propriedadeId: b, data: HOJE }, null, null);
    const [movida] = await abertas(animal.id);
    expect(movida.propriedadeId).toBe(b);

    await darBaixa({ animalId: animal.id, data: HOJE, tipo: "MORTE" }, null, null);
    // as duas linhas terminam no mesmo dia: só o id gravado na baixa diz qual reabrir
    const fechadasHoje = await prisma.localizacaoAnimal.findMany({ where: { animalId: animal.id, ate: new Date(HOJE) } });
    expect(fechadasHoje.map((l) => l.id).sort()).toEqual([inicial.id, movida.id].sort());
    const baixa = await prisma.baixaAnimal.findFirstOrThrow({ where: { animalId: animal.id, estornadaEm: null } });
    expect(baixa.localizacaoFechadaId).toBe(movida.id);

    const ficha = await estornarBaixa(animal.id, { motivo: "Lançada por engano" }, null, null);
    expect(ficha.situacao).toBe("ATIVO");
    expect(ficha.propriedade?.id).toBe(b);
    const depois = await abertas(animal.id);
    expect(depois.map((l) => l.id)).toEqual([movida.id]);
    const linhaInicial = await prisma.localizacaoAnimal.findUniqueOrThrow({ where: { id: inicial.id } });
    expect(iso(linhaInicial.ate!)).toBe(HOJE);
    expect(await prisma.destinoAnimal.count({ where: { animalId: animal.id, ate: null } })).toBe(1);
  });

  it("baixa e movimentação simultâneas no mesmo animal serializam: histórico íntegro e estorno funciona", async () => {
    const a = await sitio("A");
    const b = await sitio("B");
    // "livre": as duas disparam juntas e a ordem fica por conta do banco (na prática a
    // movimentação costuma chegar antes). "baixa"/"mov": as duas ficam na fila da trava do
    // animal ao mesmo tempo, nessa ordem, e só então a trava é solta — cobre as duas ordens.
    const rodadas = ["livre", "baixa", "mov", "livre", "baixa", "mov", "livre", "livre"] as const;
    for (const [i, ordem] of rodadas.entries()) {
      const animal = await novoAnimal(a);
      const baixar = () => darBaixa({ animalId: animal.id, data: HOJE, tipo: "MORTE" }, null, null);
      const mover = () => movimentar({ animalIds: [animal.id], propriedadeId: b, data: HOJE }, null, null);
      const [rBaixa, rMov] = ordem === "livre"
        ? await Promise.allSettled([baixar(), mover()])
        : ordem === "baixa"
          ? await emFilaNaTrava(animal.id, baixar, mover)
          : await emFilaNaTrava(animal.id, mover, baixar).then(([m, x]) => [x, m] as const);

      // a baixa sempre cabe (antes ou depois da movimentação); a movimentação só perde se chegar depois dela
      expect(rBaixa.status).toBe("fulfilled");
      if (ordem === "baixa") expect(rMov.status).toBe("rejected");
      if (ordem === "mov") expect(rMov.status).toBe("fulfilled");
      if (rMov.status === "rejected") {
        expect(rMov.reason).toBeInstanceOf(RebanhoError);
        expect(rMov.reason.message).toMatch(/inativo/);
      }

      const baixa = await prisma.baixaAnimal.findFirstOrThrow({ where: { animalId: animal.id, estornadaEm: null } });
      expect(await abertas(animal.id)).toHaveLength(0);
      const fechada = await prisma.localizacaoAnimal.findUniqueOrThrow({ where: { id: baixa.localizacaoFechadaId! } });
      expect(iso(fechada.ate!)).toBe(HOJE);
      // a linha fechada pela baixa é a mais recente do histórico (a do destino, se a movimentação venceu)
      expect(fechada.propriedadeId).toBe(rMov.status === "fulfilled" ? b : a);
      expect(await prisma.localizacaoAnimal.count({ where: { animalId: animal.id } })).toBe(rMov.status === "fulfilled" ? 2 : 1);

      await estornarBaixa(animal.id, { motivo: `Estorno ${i}` }, null, null);
      const depois = await abertas(animal.id);
      expect(depois.map((l) => l.id)).toEqual([fechada.id]);
    }
  });

  it("dois cadastros simultâneos com o mesmo brinco no mesmo sítio: exatamente um entra", async () => {
    const a = await sitio("A");
    for (let i = 0; i < 4; i += 1) {
      const brinco = brincoUnico("D");
      const tentativa = (b: string) => cadastrar(cadastrarAnimalSchema.parse({
        brinco: b, sexo: "M", origem: "COMPRADO", dataNascimento: diasAntes(400), dataEntrada: diasAntes(10), propriedadeId: a, aptidao: "CORTE",
      }), null).then((animal) => { animaisCriados.push(animal.id); return animal; });
      // grafias diferentes do mesmo brinco normalizado
      const resultados = await Promise.allSettled([tentativa(brinco), tentativa(` ${brinco.toLowerCase()}`)]);

      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejeitado = resultados.find((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rejeitado?.reason).toBeInstanceOf(RebanhoError);
      expect(rejeitado?.reason).toMatchObject({ code: "BRINCO_DUPLICADO", campo: "brinco" });
      expect(await prisma.animal.count({
        where: { brinco: { equals: brinco, mode: "insensitive" }, localizacoes: { some: { propriedadeId: a, ate: null } } },
      })).toBe(1);
    }
  });

  it("filtro de categoria no banco (whereCategoria) dá o mesmo resultado que avaliarCategoria em memória", async () => {
    const p = await sitio("paridade");
    const hoje = hojeFazendaDate();
    const regrasAntes = await carregarRegras();
    const menorOrdem = Math.min(0, ...regrasAntes.map((r) => r.ordem));
    // regra temporária na frente de todas: faixa 13–23 meses, cria bordas novas e exclusões para as seguintes
    const faixa = await criarCategoria(criarCategoriaSchema.parse({
      nome: `Faixa teste ${RUN}`, sexo: "F", automatica: true, idadeMinMeses: 13, idadeMaxMeses: 24, partos: "QUALQUER", ordem: menorOrdem - 10,
    }), null);
    const soManual = await criarCategoria(criarCategoriaSchema.parse({ nome: `Manual teste ${RUN}`, sexo: "M", automatica: false }), null);
    categoriasCriadas.push(faixa.id, soManual.id);

    // nascimentos exatamente na borda de k meses (idade = k) e um dia depois (idade = k - 1)
    const borda = (k: number, maisDias = 0) => iso(new Date(nascimentoLimiteParaIdade(hoje, k).getTime() + maisDias * DIA_MS));
    const casos: Array<{ sexo: "F" | "M"; nasc: string; partos?: number; manual?: string }> = [
      ...[5, 11, 12, 13, 23, 24, 30].flatMap((k) => [{ sexo: "F" as const, nasc: borda(k) }, { sexo: "F" as const, nasc: borda(k, 1) }]),
      { sexo: "F", nasc: borda(12), partos: 1 },
      { sexo: "F", nasc: borda(13, 1), partos: 1 },
      { sexo: "F", nasc: borda(18), partos: 2 },
      { sexo: "F", nasc: borda(40), partos: 3 },
      { sexo: "M", nasc: borda(5) },
      { sexo: "M", nasc: borda(12) },
      { sexo: "M", nasc: borda(30) },
      // trocas manuais: a manual vale sobre o cálculo (inclusive apontando para uma automática)
      { sexo: "F", nasc: borda(5), manual: faixa.id },
      { sexo: "M", nasc: borda(30), manual: soManual.id },
    ];
    const ids: string[] = [];
    for (const c of casos) {
      const animal = await novoAnimal(p, {
        sexo: c.sexo, origem: "NASCIDO", dataNascimento: c.nasc, dataEntrada: c.nasc, partosAntesDaEntrada: c.partos ?? 0,
      });
      if (c.manual) await definirCategoriaManual(animal.id, { categoriaId: c.manual, data: HOJE, motivo: "Teste de paridade" }, null, null);
      ids.push(animal.id);
    }

    const regras = await carregarRegras();
    const animais = await prisma.animal.findMany({
      where: { id: { in: ids } },
      select: { id: true, sexo: true, dataNascimento: true, partosAntesDaEntrada: true, categoriasManuais: SELECT_MANUAL_ABERTA },
    });
    const emMemoria = new Map(animais.map((a) => [a.id, avaliarCategoria(
      { sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada }, regras, manualDe(a.categoriasManuais), hoje,
    ).categoria?.id ?? null]));

    const categoriasComAnimal = new Set<string>();
    const vistos = new Set<string>();
    for (const regra of regras) {
      const { itens, total } = await listar(listarFiltrosSchema.parse({ categoriaId: regra.id, pageSize: 200 }), p);
      const doBanco = itens.map((i) => i.id).sort();
      const esperado = ids.filter((id) => emMemoria.get(id) === regra.id).sort();
      expect({ categoria: regra.nome, ids: doBanco }).toEqual({ categoria: regra.nome, ids: esperado });
      expect(total).toBe(esperado.length);
      // o resumo de cada item também diz a categoria filtrada
      for (const i of itens) expect(i.categoria?.id).toBe(regra.id);
      if (doBanco.length) categoriasComAnimal.add(regra.id);
      for (const id of doBanco) {
        expect(vistos.has(id)).toBe(false); // um animal cai em uma categoria só
        vistos.add(id);
      }
    }
    // quem não apareceu em nenhuma categoria está "sem categoria" também em memória
    for (const id of ids.filter((x) => !vistos.has(x))) expect(emMemoria.get(id)).toBeNull();
    // o conjunto de animais precisa exercitar várias regras, senão a paridade seria vazia
    expect(categoriasComAnimal.has(faixa.id)).toBe(true);
    expect(categoriasComAnimal.has(soManual.id)).toBe(true);
    expect(categoriasComAnimal.size).toBeGreaterThanOrEqual(4);
  });

  it("baixa estornada não impede desfazer a movimentação nem a localização (FK ON DELETE SET NULL)", async () => {
    const a = await sitio("A");
    const b = await sitio("B");
    const [x, y] = await Promise.all([novoAnimal(a), novoAnimal(a)]);

    // movimentação inteira
    const [inicialX] = await abertas(x.id);
    const { movimentacaoId } = await movimentar({ animalIds: [x.id], propriedadeId: b, data: HOJE }, null, null);
    await darBaixa({ animalId: x.id, data: HOJE, tipo: "VENDA" }, null, null);
    expect((await buscarMovimentacao(movimentacaoId, null)).podeDesfazer).toBe(false);
    await estornarBaixa(x.id, { motivo: "Engano" }, null, null);
    expect((await buscarMovimentacao(movimentacaoId, null)).podeDesfazer).toBe(true);

    await expect(desfazerMovimentacao(movimentacaoId, "Desfazer após estorno", null, null)).resolves.toEqual({ desfeitos: 1 });
    expect((await abertas(x.id)).map((l) => l.id)).toEqual([inicialX.id]);
    const baixaX = await prisma.baixaAnimal.findFirstOrThrow({ where: { animalId: x.id } });
    expect(baixaX.estornadaEm).not.toBeNull();
    expect(baixaX.localizacaoFechadaId).toBeNull(); // a linha apagada soltou o vínculo da baixa estornada
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id: movimentacaoId } })).desfeitaEm).not.toBeNull();

    // animal a animal
    const [inicialY] = await abertas(y.id);
    await movimentar({ animalIds: [y.id], propriedadeId: b, data: HOJE }, null, null);
    await darBaixa({ animalId: y.id, data: HOJE, tipo: "MORTE" }, null, null);
    // com a baixa ativa, desfazer segue recusado
    await expect(desfazerLocalizacao(y.id, null, null)).rejects.toMatchObject({ code: "ANIMAL_INATIVO" });
    await estornarBaixa(y.id, { motivo: "Engano" }, null, null);
    const ficha = await desfazerLocalizacao(y.id, null, null);
    expect(ficha.propriedade?.id).toBe(a);
    expect((await abertas(y.id)).map((l) => l.id)).toEqual([inicialY.id]);
    expect((await prisma.baixaAnimal.findFirstOrThrow({ where: { animalId: y.id } })).localizacaoFechadaId).toBeNull();
  });

  it("não desativa lote com animal ativo; depois que o animal sai, desativa", async () => {
    const a = await sitio("A");
    const lote = await criarLote({ nome: `Lote ${RUN}`, propriedadeId: a }, null);
    const animal = await novoAnimal(a, { loteId: lote.id });
    expect(animal.lote?.id).toBe(lote.id);

    await expect(editarLote(lote.id, { ativo: false }, null, a)).rejects.toMatchObject({ code: "CONFLITO", campo: "ativo" });
    expect((await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })).ativo).toBe(true);

    await movimentar({ animalIds: [animal.id], propriedadeId: a, loteId: null, data: HOJE }, null, null);
    await expect(editarLote(lote.id, { ativo: false }, null, a)).resolves.toMatchObject({ ativo: false, animaisAtivos: 0 });
    // lote inativo não recebe animal (trava FOR SHARE dentro da transação)
    await expect(movimentar({ animalIds: [animal.id], propriedadeId: a, loteId: lote.id, data: HOJE }, null, null))
      .rejects.toMatchObject({ code: "NAO_ENCONTRADO", campo: "loteId" });
  });

  it("peso e GMD na ficha (buscarFicha) batem com as pesagens registradas, e com o resumo (gmdRecente)", async () => {
    const s = await sitio("peso");
    const animal = await novoAnimal(s);
    const p1 = diasAntes(60);
    const p2 = diasAntes(10);
    await registrarPesagem({ ...pesagemSchema.parse({ data: p1, pesoKg: 200, tipo: "ROTINA" }), animalId: animal.id }, null, null);
    await registrarPesagem({ ...pesagemSchema.parse({ data: p2, pesoKg: 230, tipo: "ROTINA" }), animalId: animal.id }, null, null);

    const ficha = await buscarFicha(animal.id, null, 90);
    expect(ficha.peso.ultimo).toEqual({ kg: 230, data: p2 });
    const gmdEsperado = gmdEntre({ data: p1, pesoKg: 200 }, { data: p2, pesoKg: 230 });
    expect(ficha.peso.gmdRecente).toBe(gmdEsperado);
    // só 2 pesagens no histórico inteiro: "recente" e "desde a entrada" são o mesmo cálculo
    expect(ficha.peso.gmdDesdeEntrada).toBe(gmdEsperado);
    expect(ficha.peso.gmdPeriodo).toEqual({ dias: diasEntre(p1, p2), valor: gmdEsperado, pesagens: 2 });
    // o resumo (topo da ficha, mesmo campo que aparece na lista) usa o mesmo cálculo
    expect(ficha.gmdRecente).toBe(gmdEsperado);
  });

  it("baixado: peso/GMD da ficha usam só as pesagens até a data da baixa", async () => {
    const s = await sitio("peso-baixado");
    const animal = await novoAnimal(s);
    const p1 = diasAntes(40);
    const dataBaixa = diasAntes(20);
    await registrarPesagem({ ...pesagemSchema.parse({ data: p1, pesoKg: 200, tipo: "ROTINA" }), animalId: animal.id }, null, null);
    await darBaixa({ animalId: animal.id, data: dataBaixa, tipo: "MORTE" }, null, null);

    const ficha = await buscarFicha(animal.id, null, 90);
    expect(ficha.situacao).toBe("BAIXADO");
    expect(ficha.peso.ultimo).toEqual({ kg: 200, data: p1 });
    // só 1 pesagem: sem GMD nenhum
    expect(ficha.peso.gmdRecente).toBeNull();
    expect(ficha.peso.gmdPeriodo).toEqual({ dias: null, valor: null, pesagens: 1 });
  });

  it("resumo do lote (buscarResumoLote) agrega peso/GMD só dos animais ativos que estão nele hoje", async () => {
    const s = await sitio("resumo-lote");
    const lote = await criarLote({ nome: `Resumo ${RUN}`, propriedadeId: s }, null);
    const comDuasPesagens = await novoAnimal(s, { loteId: lote.id, sexo: "F" });
    const comUmaPesagem = await novoAnimal(s, { loteId: lote.id, sexo: "M" });
    const semPesagem = await novoAnimal(s, { loteId: lote.id, sexo: "F" });
    const foraDoLote = await novoAnimal(s, { loteId: lote.id, sexo: "F" });
    // sai do lote antes do resumo: não deve entrar em "ativos" nem nas médias
    await movimentar({ animalIds: [foraDoLote.id], propriedadeId: s, loteId: null, data: HOJE }, null, null);

    await registrarPesagem({ ...pesagemSchema.parse({ data: diasAntes(90), pesoKg: 200, tipo: "ROTINA" }), animalId: comDuasPesagens.id }, null, null);
    await registrarPesagem({ ...pesagemSchema.parse({ data: diasAntes(10), pesoKg: 230, tipo: "ROTINA" }), animalId: comDuasPesagens.id }, null, null);
    await registrarPesagem({ ...pesagemSchema.parse({ data: diasAntes(20), pesoKg: 300, tipo: "ROTINA" }), animalId: comUmaPesagem.id }, null, null);

    const resumo = await buscarResumoLote(lote.id, 90, s);
    expect(resumo.ativos).toBe(3);
    expect(resumo.porSexo).toEqual({ F: 2, M: 1 });
    expect(resumo.idadeMediaMeses).not.toBeNull();
    // peso: último de cada um com peso (230, 300); semPesagem fica de fora da média
    expect(resumo.peso.minKg).toBe(230);
    expect(resumo.peso.maxKg).toBe(300);
    expect(resumo.peso.medioKg).toBe(265);
    expect(resumo.peso.semPeso).toBe(1);
    // GMD do período: só quem tem 2 pesagens (comDuasPesagens)
    expect(resumo.gmd.comGmd).toBe(1);
    expect(resumo.gmd.periodoDias).toBe(90);
    expect(resumo.gmd.medio).toBe(gmdEntre({ data: diasAntes(90), pesoKg: 200 }, { data: diasAntes(10), pesoKg: 230 }));
    expect(semPesagem).toBeTruthy(); // usado só para criar o animal sem pesagem
  });

  it("resumo do lote em sítio errado (fora do escopo) é NAO_ENCONTRADO", async () => {
    const a = await sitio("resumo-a");
    const b = await sitio("resumo-b");
    const lote = await criarLote({ nome: `Escopo ${RUN}`, propriedadeId: a }, null);
    await expect(buscarResumoLote(lote.id, 90, b)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
  it("filtros novos de Animais no banco (sem categoria, idade, forçada, sexo/origem/raça, baixa, ordem) batem com o cálculo em memória", async () => {
    const p = await sitio("filtros");
    const hoje = hojeFazendaDate();
    const borda = (ref: Date, k: number, maisDias = 0) => iso(new Date(nascimentoLimiteParaIdade(ref, k).getTime() + maisDias * DIA_MS));
    const sigla = () => Array.from({ length: 3 }, () => String.fromCharCode(65 + crypto.randomInt(26))).join("");
    const [racaA, racaB] = await Promise.all([1, 2].map((n) => prisma.raca.create({ data: { nome: `Raça filtro ${n} ${RUN}`, sigla: sigla() } })));
    racasCriadas.push(racaA.id, racaB.id);

    // "sem categoria" precisa de lacunas nas regras: desliga temporariamente Novilha (F sem parto ≥ 12)
    // e o Em crescimento do macho (sem critério), e cria uma regra estreita de macho (12–23 meses)
    const desligar = await prisma.categoriaAnimal.findMany({ where: { chavePadrao: { in: ["F_NOVILHA", "M_EM_CRESCIMENTO"] }, ativo: true }, select: { id: true } });
    const reprodutor = await prisma.categoriaAnimal.findUniqueOrThrow({ where: { chavePadrao: "M_REPRODUTOR" } });
    const garrote = await criarCategoria(criarCategoriaSchema.parse({ nome: `Garrote teste ${RUN}`, sexo: "M", automatica: true, idadeMinMeses: 12, idadeMaxMeses: 24 }), null);
    categoriasCriadas.push(garrote.id);
    await prisma.categoriaAnimal.updateMany({ where: { id: { in: desligar.map((d) => d.id) } }, data: { ativo: false } });
    try {
      // ---- ativos nas bordas de idade (idade = k no dia da borda; k - 1 um dia depois) ----
      type Caso = { sexo: "F" | "M"; nasc: string; partos?: number; comprado?: boolean; racas?: string[]; manual?: string };
      const casos: Caso[] = [
        ...[1, 5, 11, 12, 13, 23, 24, 25].flatMap((k) => [{ sexo: "F" as const, nasc: borda(hoje, k) }, { sexo: "F" as const, nasc: borda(hoje, k, 1) }]),
        ...[5, 11, 12, 13, 24, 30].flatMap((k) => [{ sexo: "M" as const, nasc: borda(hoje, k) }, { sexo: "M" as const, nasc: borda(hoje, k, 1) }]),
        { sexo: "F", nasc: borda(hoje, 30), partos: 2, comprado: true, racas: [racaA.id] },
        { sexo: "F", nasc: borda(hoje, 14), comprado: true, racas: [racaA.id, racaB.id] },
        { sexo: "M", nasc: borda(hoje, 8), comprado: true, racas: [racaB.id] },
        // manuais: uma que cairia em "sem categoria" e outra sobre uma automática
        { sexo: "M", nasc: borda(hoje, 40), manual: reprodutor.id, racas: [racaA.id] },
        { sexo: "M", nasc: borda(hoje, 5), manual: garrote.id },
      ];
      const ativos: string[] = [];
      for (const c of casos) {
        const entrada = c.comprado ? diasAntes(10) : c.nasc;
        const animal = await novoAnimal(p, {
          brinco: brincoUnico(c.sexo), sexo: c.sexo, origem: c.comprado ? "COMPRADO" : "NASCIDO", dataNascimento: c.nasc, dataEntrada: entrada,
          partosAntesDaEntrada: c.partos ?? 0,
          composicao: (c.racas ?? []).map((racaId, _i, todas) => ({ racaId, fracao64: 64 / todas.length })),
        });
        if (c.manual) await definirCategoriaManual(animal.id, { categoriaId: c.manual, data: HOJE, motivo: "Teste de filtro" }, null, null);
        ativos.push(animal.id);
      }
      // manual de fêmea sobre uma automática (Vaca)
      const vaca = await prisma.categoriaAnimal.findUniqueOrThrow({ where: { chavePadrao: "F_VACA" } });
      await definirCategoriaManual(ativos[0], { categoriaId: vaca.id, data: HOJE, motivo: "Teste de filtro" }, null, null);

      // ---- baixados: idade na data da baixa (K5) ≠ idade de hoje ----
      const dataBaixa = new Date(diasAntes(400));
      const baixas: Array<{ k: number; mais: number; tipo: "MORTE" | "VENDA"; data: Date; estornar?: boolean }> = [
        { k: 2, mais: 0, tipo: "MORTE", data: dataBaixa },
        { k: 3, mais: 0, tipo: "MORTE", data: dataBaixa },
        { k: 3, mais: 1, tipo: "VENDA", data: dataBaixa },
        { k: 12, mais: 0, tipo: "VENDA", data: new Date(diasAntes(100)) },
        { k: 12, mais: 1, tipo: "MORTE", data: new Date(diasAntes(100)) },
        { k: 2, mais: 0, tipo: "MORTE", data: dataBaixa, estornar: true }, // estornada: continua ativo
      ];
      const baixados: string[] = [];
      for (const b of baixas) {
        const nasc = borda(b.data, b.k, b.mais);
        const animal = await novoAnimal(p, { brinco: brincoUnico("X"), sexo: "F", origem: "NASCIDO", dataNascimento: nasc, dataEntrada: nasc });
        await darBaixa({ animalId: animal.id, data: iso(b.data), tipo: b.tipo }, null, null);
        if (b.estornar) {
          await estornarBaixa(animal.id, { motivo: "Teste de filtro" }, null, null);
          ativos.push(animal.id);
        } else baixados.push(animal.id);
      }

      // ---- o que o cálculo em memória diz de cada animal ----
      const regras = await carregarRegras();
      const linhas = await prisma.animal.findMany({
        where: { id: { in: [...ativos, ...baixados] } },
        select: {
          id: true, sexo: true, origem: true, dataNascimento: true, partosAntesDaEntrada: true, categoriasManuais: SELECT_MANUAL_ABERTA,
          composicao: { select: { racaId: true } }, baixas: { where: { estornadaEm: null }, select: { data: true, tipo: true } },
        },
      });
      const porId = new Map(linhas.map((a) => [a.id, a]));
      const idadeRef = (id: string) => {
        const a = porId.get(id)!;
        return idadeEmMeses(a.dataNascimento, a.baixas[0]?.data ?? hoje);
      };
      const origemCategoria = (id: string) => {
        const a = porId.get(id)!;
        return avaliarCategoria({ sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada }, regras, manualDe(a.categoriasManuais), hoje).origem;
      };

      const buscar = async (q: Record<string, unknown>) => {
        const { itens, total, painel } = await listar(listarFiltrosSchema.parse({ pageSize: 200, ...q }), p);
        expect(total).toBe(itens.length);
        // o painel é calculado com o mesmo `where` da lista
        expect(painel.totalAtivos).toBe(itens.filter((i) => i.situacao === "ATIVO").length);
        return itens.map((i) => i.id).sort();
      };
      const ordenados = (ids: string[]) => [...ids].sort();
      const confere = async (q: Record<string, unknown>, esperado: string[], minimo = 1) => {
        expect({ q, ids: await buscar(q) }).toEqual({ q, ids: ordenados(esperado) });
        expect(esperado.length).toBeGreaterThanOrEqual(minimo); // o caso precisa exercitar algo
      };

      // sem categoria: ativos (em "hoje"), e não pode ser todo mundo
      const semCategoria = ativos.filter((id) => origemCategoria(id) === "SEM_CATEGORIA");
      await confere({ semCategoria: "true" }, semCategoria, 5);
      expect(semCategoria.length).toBeLessThan(ativos.length - 5);
      await confere({ semCategoria: "true", sexo: "M" }, semCategoria.filter((id) => porId.get(id)!.sexo === "M"), 2);

      // forçada (manual aberta)
      await confere({ categoriaOrigem: "MANUAL" }, ativos.filter((id) => origemCategoria(id) === "MANUAL"), 2);

      // idade: ativos pela idade de hoje, bordas 11/12/13 no mesmo dia e um dia fora
      const faixas: Array<[number | undefined, number | undefined]> = [[11, 13], [12, 12], [0, 0], [0, 5], [24, undefined], [undefined, 11], [13, 24]];
      for (const [min, max] of faixas) {
        const q = { ...(min != null ? { idadeMinMeses: String(min) } : {}), ...(max != null ? { idadeMaxMeses: String(max) } : {}) };
        await confere(q, ativos.filter((id) => idadeNaFaixa(idadeRef(id), min, max)));
        // baixados: idade na data da baixa
        await confere({ ...q, situacao: "BAIXADO" }, baixados.filter((id) => idadeNaFaixa(idadeRef(id), min, max)), 0);
        await confere({ ...q, situacao: "TODOS" }, [...ativos, ...baixados].filter((id) => idadeNaFaixa(idadeRef(id), min, max)), 0);
      }
      // a idade do baixado é a da baixa, não a de hoje: de 2 a 3 meses acha as 3 bezerras (hoje com mais de 13)
      await confere({ situacao: "BAIXADO", idadeMinMeses: "2", idadeMaxMeses: "3" }, baixados.filter((id) => idadeRef(id) >= 2 && idadeRef(id) <= 3), 3);
      await confere({ situacao: "BAIXADO", idadeMinMeses: "11", idadeMaxMeses: "11" }, baixados.filter((id) => idadeRef(id) === 11), 1);

      // sexo, origem, raça na composição
      await confere({ sexo: "M" }, ativos.filter((id) => porId.get(id)!.sexo === "M"));
      await confere({ origem: "COMPRADO" }, ativos.filter((id) => porId.get(id)!.origem === "COMPRADO"), 3);
      await confere({ racaId: racaA.id }, ativos.filter((id) => porId.get(id)!.composicao.some((c) => c.racaId === racaA.id)), 3);
      await confere({ racaId: racaB.id, sexo: "F" }, ativos.filter((id) => porId.get(id)!.sexo === "F" && porId.get(id)!.composicao.some((c) => c.racaId === racaB.id)), 1);

      // baixa em vigor: tipo e período; com situacao=ATIVO os filtros de baixa são ignorados
      const baixa = (id: string) => porId.get(id)!.baixas[0];
      await confere({ situacao: "BAIXADO", tipoBaixa: "MORTE" }, baixados.filter((id) => baixa(id).tipo === "MORTE"), 3);
      await confere({ situacao: "TODOS", tipoBaixa: "VENDA" }, baixados.filter((id) => baixa(id).tipo === "VENDA"), 2);
      await confere({ situacao: "BAIXADO", baixaDe: diasAntes(100), baixaAte: diasAntes(100) }, baixados.filter((id) => iso(baixa(id).data) === diasAntes(100)), 2);
      await confere({ situacao: "BAIXADO", baixaAte: diasAntes(101), tipoBaixa: "MORTE" }, baixados.filter((id) => baixa(id).tipo === "MORTE" && iso(baixa(id).data) <= diasAntes(101)), 2);
      expect(await buscar({ tipoBaixa: "MORTE", baixaDe: diasAntes(500) })).toEqual(await buscar({}));

      // ordem: páginas pequenas emendadas = a lista inteira, sem repetir, no sentido pedido
      for (const [ordenar, direcao, campo] of [["nascimento", "desc", "dataNascimento"], ["entrada", "asc", "dataEntrada"], ["brinco", "desc", null]] as const) {
        const tudo = await listar(listarFiltrosSchema.parse({ situacao: "TODOS", ordenar, direcao, pageSize: 200 }), p);
        const emendado: string[] = [];
        for (let page = 1; emendado.length < tudo.total; page += 1) {
          const { itens } = await listar(listarFiltrosSchema.parse({ situacao: "TODOS", ordenar, direcao, pageSize: 7, page }), p);
          expect(itens.length).toBeGreaterThan(0);
          emendado.push(...itens.map((i) => i.id));
        }
        expect(emendado).toEqual(tudo.itens.map((i) => i.id));
        expect(new Set(emendado).size).toBe(emendado.length);
        expect(emendado.length).toBe(ativos.length + baixados.length);
        const valores = tudo.itens.map((i) => (campo ? i[campo] : i.brinco));
        const sentido = direcao === "asc" ? 1 : -1;
        if (campo) for (let i = 1; i < valores.length; i += 1) expect(sentido * valores[i].localeCompare(valores[i - 1])).toBeGreaterThanOrEqual(0);
      }
    } finally {
      await prisma.categoriaAnimal.updateMany({ where: { id: { in: desligar.map((d) => d.id) } }, data: { ativo: true } });
    }
  });
});
