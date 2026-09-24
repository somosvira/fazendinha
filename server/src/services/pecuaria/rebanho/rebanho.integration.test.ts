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
  cadastrar, darBaixa, definirCategoriaManual, desfazerLocalizacao, desfazerMovimentacao, estornarBaixa, listar, movimentar,
} from "./animais.js";
import { carregarRegras, criarCategoria, manualDe, SELECT_MANUAL_ABERTA } from "./categorias.js";
import { avaliarCategoria, nascimentoLimiteParaIdade } from "./categoria.calc.js";
import { criarLote, editarLote } from "./lotes.js";
import { buscarMovimentacao } from "./movimentacoes.js";
import { hojeFazenda, hojeFazendaDate, RebanhoError, travarAnimais } from "./regras.js";
import { cadastrarAnimalSchema, criarCategoriaSchema, listarFiltrosSchema } from "./schemas.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

const RUN = crypto.randomUUID().slice(0, 8);
const DIA_MS = 86_400_000;

const propriedadesCriadas: number[] = [];
const animaisCriados: string[] = [];
const categoriasCriadas: string[] = [];
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
  if (!propriedadesCriadas.length && !categoriasCriadas.length) return;
  const propriedadeId = { in: propriedadesCriadas };
  // animais que passaram por um sítio do teste (inclui algum cadastro que falhou no meio de um assert)
  const porSitio = await prisma.animal.findMany({ where: { localizacoes: { some: { propriedadeId } } }, select: { id: true } });
  const ids = [...new Set([...animaisCriados, ...porSitio.map((a) => a.id)])];
  const animalId = { in: ids };
  const movs = await prisma.movimentacao.findMany({ where: { OR: [{ propriedadeDestinoId: propriedadeId }, { animais: { some: { animalId } } }] }, select: { id: true } });
  const lotes = await prisma.lote.findMany({ where: { propriedadeId }, select: { id: true } });
  const entidades = [...movs.map((m) => m.id), ...lotes.map((l) => l.id), ...categoriasCriadas, ...ids];

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
});
