import { randomInt, randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../../env.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
type Criterio = { tipo: "PRIMEIRA_ORDENHA" } | { tipo: "JANELA_DIAS"; dias: number; incluiD0: true } | null;

// Contrato SQL real, sem chamar os serviços: todas as fixtures são privadas e
// desfeitas, inclusive quando alguma asserção falha. Não aplica migrations/seed.
async function comFixture(teste: (f: Awaited<ReturnType<typeof preparar>>) => Promise<void>, criterio: Criterio = null) {
  const url = new URL(env.DATABASE_URL);
  if (process.env.CI !== "true") {
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
    expect(url.pathname).toBe("/fazendinha_seedatev3");
  }
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  let sitio: number | undefined;
  try {
    await db.query("BEGIN");
    const f = await preparar(db, criterio);
    sitio = f.sitio;
    await teste(f);
  } finally {
    await db.query("ROLLBACK");
    try {
      if (sitio !== undefined) {
        expect((await db.query('SELECT count(*)::int n FROM public."Propriedade" WHERE id=$1', [sitio])).rows).toEqual([{ n: 0 }]);
      }
    } finally {
      await db.end();
    }
  }
}

async function preparar(db: Client, criterio: Criterio) {
  const sitio = -randomInt(1, 2_000_000_000);
  const config = randomUUID(), dia = randomUUID(), sessao = randomUUID(), posicao = randomUUID();
  await db.query('INSERT INTO public."Propriedade" (id,nome,"updatedAt") VALUES ($1,$2,now())', [sitio, `SQL parcelas ${config}`]);
  await db.query(`INSERT INTO pecuaria."ConfiguracaoOrdenha" (id,"propriedadeId","vigenteDesde","fonteProducao","criterioColostro") VALUES ($1,$2,'2026-01-01','GERAL',$3::jsonb)`, [config, sitio, criterio === null ? null : JSON.stringify(criterio)]);
  await db.query(`INSERT INTO pecuaria."PosicaoOrdenha" (id,"configuracaoId","posicaoId",nome,ordem) VALUES ($1,$2,$3,'Manhã',1)`, [randomUUID(), config, posicao]);
  await db.query(`INSERT INTO pecuaria."DiaProducaoLeite" (id,"propriedadeId","dataOperacional","configuracaoId","atualizadoEm") VALUES ($1,$2,'2026-10-20',$3,now())`, [dia, sitio, config]);
  await db.query(`INSERT INTO pecuaria."SessaoOrdenha" (id,"diaId","posicaoId",nome,ordem) VALUES ($1,$2,$3,'Manhã',1)`, [sessao, dia, posicao]);
  const snapshot = (partos: unknown[] = [], primeiraOrdenhaColostro: boolean | null = null) => ({ configuracaoId: config, criterio, partos, primeiraOrdenhaColostro });
  const inserir = async (dados: Record<string, unknown> = {}) => {
    const valores = {
      id: randomUUID(), sessaoId: sessao, tanqueId: null, recipiente: `Balde ${randomUUID()}`,
      litros: 20, reguaMm: null, origemLitros: "LITROS_INFORMADOS", natureza: "COMERCIAL",
      animaisOrigem: [], declaracaoDireta: null, primeiraOrdenhaColostro: null,
      criterioColostroSnapshot: snapshot(), ...dados,
    };
    await db.query(`INSERT INTO pecuaria."MedicaoGeralLeite" (id,"sessaoId","tanqueId",recipiente,litros,"reguaMm","origemLitros",natureza,"animaisOrigem","declaracaoDireta","primeiraOrdenhaColostro","criterioColostroSnapshot",responsavel,"atualizadoEm")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,'Fixture SQL privada',now())`,
    [valores.id, valores.sessaoId, valores.tanqueId, valores.recipiente, valores.litros, valores.reguaMm, valores.origemLitros, valores.natureza,
      JSON.stringify(valores.animaisOrigem), valores.declaracaoDireta === null ? null : JSON.stringify(valores.declaracaoDireta), valores.primeiraOrdenhaColostro,
      valores.criterioColostroSnapshot === null ? null : JSON.stringify(valores.criterioColostroSnapshot)]);
    return valores.id;
  };
  const conferir = async () => {
    await db.query("SET CONSTRAINTS ALL IMMEDIATE");
    await db.query("SET CONSTRAINTS ALL DEFERRED");
  };
  const rejeitar = async (acao: () => Promise<unknown>, code = "23514", mensagem?: string) => {
    await db.query("SAVEPOINT tentativa");
    try {
      await expect((async () => { await acao(); await conferir(); })()).rejects.toMatchObject({ code, ...(mensagem ? { message: expect.stringContaining(mensagem) } : {}) });
    } finally {
      await db.query("ROLLBACK TO SAVEPOINT tentativa");
      await db.query("RELEASE SAVEPOINT tentativa");
    }
  };
  const tanque = async (identidade = randomUUID(), versao = 1, desde = "2026-01-01") => {
    const id = randomUUID();
    await db.query(`INSERT INTO pecuaria."TanqueLeite" (id,"propriedadeId","identidadeId",versao,nome,"capacidadeLitros","vigenteDesde","tabelaConversao") VALUES ($1,$2,$3,$4,'Tanque privado',1000,$5,'[{"mm":10,"litros":100}]')`, [id, sitio, identidade, versao, desde]);
    return id;
  };
  return { db, sitio, config, sessao, snapshot, inserir, conferir, rejeitar, tanque };
}

suite("SQL real das parcelas gerais de ordenha", () => {
  it("preserva litros manuais independentes da régua e rejeita nova conversão automática", async () => comFixture(async (f) => {
    const tanqueId = await f.tanque();
    const id = await f.inserir({ tanqueId, recipiente: null, litros: 23.5, reguaMm: 10 });
    await f.conferir();
    expect((await f.db.query('SELECT litros::text,"reguaMm"::text,"origemLitros" FROM pecuaria."MedicaoGeralLeite" WHERE id=$1', [id])).rows).toEqual([{ litros: "23.500", reguaMm: "10.000", origemLitros: "LITROS_INFORMADOS" }]);
    await f.rejeitar(() => f.inserir({ tanqueId, recipiente: null, litros: 100, reguaMm: 10, origemLitros: "TABELA_TANQUE" }), "23514", "novas parcelas usam litros manuais");
  }));

  it("aceita recipientes livres distintos com declaração direta e rejeita identidade duplicada", async () => comFixture(async (f) => {
    await f.inserir({ recipiente: "Balde A", natureza: "NAO_COMERCIAL", declaracaoDireta: { justificativa: "Segregação documentada pelo responsável" } });
    await f.inserir({ recipiente: "Balde B", natureza: "COLOSTRO", declaracaoDireta: { justificativa: "Origem não identificada, declaração direta" } });
    await f.conferir();
    await f.rejeitar(() => f.inserir({ recipiente: " balde a " }), "23505");
    await f.rejeitar(() => f.inserir({ natureza: "NAO_COMERCIAL" }), "23514", "origens desconhecidas exigem");
    await f.rejeitar(() => f.inserir({ natureza: "NAO_COMERCIAL", declaracaoDireta: { justificativa: "abc" } }));
    await f.rejeitar(() => f.inserir({ recipiente: " " }));
    await f.rejeitar(() => f.inserir({ criterioColostroSnapshot: null }), "23514", "snapshot explícito");
    expect((await f.db.query('SELECT count(*)::int n FROM pecuaria."MedicaoGeralLeite" WHERE "sessaoId"=$1', [f.sessao])).rows).toEqual([{ n: 2 }]);
  }));

  it("rejeita duas versões do mesmo tanque físico na mesma ordenha", async () => comFixture(async (f) => {
    const identidade = randomUUID();
    const antigo = await f.tanque(identidade);
    await f.inserir({ tanqueId: antigo, recipiente: null });
    await f.conferir();
    await f.rejeitar(async () => {
      const atual = await f.tanque(identidade, 2, "2026-10-20");
      await f.inserir({ tanqueId: atual, recipiente: null });
    }, "23514", "recipiente físico distinto");
  }));

  it("valida critério e snapshot sem aceitar contexto de parto fictício", async () => comFixture(async (f) => {
    await f.rejeitar(() => f.db.query('INSERT INTO pecuaria."ConfiguracaoOrdenha" (id,"propriedadeId","vigenteDesde","criterioColostro") VALUES ($1,$2,\'2027-01-01\',$3::jsonb)', [randomUUID(), f.sitio, JSON.stringify({ tipo: "JANELA_DIAS", dias: 0, incluiD0: true })]));
    await f.rejeitar(() => f.inserir({ criterioColostroSnapshot: { ...f.snapshot(), configuracaoId: randomUUID() } }), "23514", "snapshot deve corresponder");
    await f.rejeitar(() => f.inserir({ criterioColostroSnapshot: f.snapshot([{ id: randomUUID(), animalId: randomUUID(), versao: 1, data: "2026-10-20" }]) }), "23514", "parto real");
    await f.conferir();
  }));

  it("exige parto real, lactação compatível e primeira ordenha única, preservando a evidência", async () => comFixture(async (f) => {
    const animal = randomUUID(), parto = randomUUID(), lactacao = randomUUID();
    await f.db.query(`INSERT INTO pecuaria."Animal" (id,brinco,sexo,"dataNascimento",origem,"dataEntrada","atualizadoEm") VALUES ($1,$1,'F','2020-01-01','COMPRADO','2026-01-01',now())`, [animal]);
    await f.db.query(`INSERT INTO pecuaria."LocalizacaoAnimal" (id,"animalId","propriedadeId",desde,"atualizadoEm") VALUES ($1,$2,$3,'2026-01-01',now())`, [randomUUID(), animal, f.sitio]);
    await f.db.query(`INSERT INTO pecuaria."FinalidadeAnimal" (id,"animalId",aptidao,desde,"atualizadoEm") VALUES ($1,$2,'LEITE','2026-01-01',now())`, [randomUUID(), animal]);
    await f.db.query(`INSERT INTO pecuaria."PartoAnimal" (id,"animalId","propriedadeId",data,tipo) VALUES ($1,$2,$3,'2026-10-20','NASCIMENTO')`, [parto, animal, f.sitio]);
    await f.db.query(`INSERT INTO pecuaria."LactacaoAnimal" (id,"animalId","propriedadeId","partoId",inicio) VALUES ($1,$2,$3,$4,'2026-10-20')`, [lactacao, animal, f.sitio, parto]);
    const partos = [{ id: parto, animalId: animal, versao: 1, data: "2026-10-20" }];
    const dados = { natureza: "COLOSTRO", animaisOrigem: [animal], primeiraOrdenhaColostro: true, criterioColostroSnapshot: f.snapshot(partos, true) };
    await f.rejeitar(() => f.inserir({ ...dados, primeiraOrdenhaColostro: false, criterioColostroSnapshot: f.snapshot(partos, false) }), "23514", "declaração explícita da primeira ordenha");
    await f.rejeitar(() => f.inserir({ ...dados, criterioColostroSnapshot: f.snapshot([{ ...partos[0], versao: 2 }], true) }), "23514", "parto real");
    await f.inserir(dados);
    await f.conferir();
    await f.rejeitar(() => f.inserir(dados), "23514", "primeira ordenha do parto já declarada");
    await f.rejeitar(() => f.db.query('UPDATE pecuaria."PartoAnimal" SET versao=versao+1 WHERE id=$1', [parto]), "23514", "retira evidência de colostro");
    await f.rejeitar(() => f.db.query('UPDATE pecuaria."LactacaoAnimal" SET "partoId"=NULL,versao=versao+1 WHERE id=$1', [lactacao]), "23514", "retira evidência de colostro");
  }, { tipo: "PRIMEIRA_ORDENHA" }));

  it("confirma somente snapshot que preserva a parcela e impede sua edição enquanto confirmada", async () => comFixture(async (f) => {
    const medicao = await f.inserir({ recipiente: "Balde confirmado", natureza: "NAO_COMERCIAL", declaracaoDireta: { justificativa: "Segregação diretamente documentada" } });
    await f.conferir();
    const produto = randomUUID();
    await f.db.query('INSERT INTO public."Produto" (id,nome,unidade,"updatedAt") VALUES ($1,$2,\'L\',now())', [produto, `Leite privado ${produto}`]);
    const snapshot = {
      fonte: "GERAL", medicaoGeralId: medicao, litros: 20, versaoMedicaoGeral: 1,
      animaisOrigem: [], recipiente: "Balde confirmado", tanqueId: null, natureza: "NAO_COMERCIAL",
      declaracaoDireta: { justificativa: "Segregação diretamente documentada" },
      primeiraOrdenhaColostro: null, criterioColostroSnapshot: f.snapshot(),
    };
    const confirmar = async (declaracao: Record<string, unknown>) => {
      const movimento = randomUUID(), entrada = randomUUID();
      // seq explícita negativa evita até o consumo da sequence não transacional.
      await f.db.query(`INSERT INTO public."MovimentoEstoque" (id,seq,"produtoId",tipo,origem,data,quantidade,"propriedadeId","metodoValorizacao","updatedAt") VALUES ($1,$2,$3,'ENTRADA','PRODUCAO','2026-10-20',20,$4,'LEITE_FIFO_V1',now())`, [movimento, -randomInt(1, 2_000_000_000), produto, f.sitio]);
      await f.db.query(`INSERT INTO pecuaria."EntradaProducaoLeite" (id,"sessaoId","versaoSessao","movimentoId",chave,hash,snapshot,"medicaoGeralId") VALUES ($1,$2,1,$3,$1,$6,$4::jsonb,$5)`, [entrada, f.sessao, movimento, JSON.stringify(declaracao), medicao, "a".repeat(64)]);
      await f.db.query(`INSERT INTO pecuaria."ClassificacaoEntradaLeite" (id,"entradaId",versao,natureza,motivo) VALUES ($1,$2,1,'NAO_INFORMADA','Classificação inicial privada')`, [randomUUID(), entrada]);
    };
    await f.rejeitar(() => confirmar({ ...snapshot, recipiente: "Outro recipiente" }), "23514", "origem confirmada deve preservar");
    await confirmar(snapshot);
    await f.conferir();
    expect((await f.db.query('SELECT status,snapshot->>\'recipiente\' recipiente FROM pecuaria."EntradaProducaoLeite" WHERE "medicaoGeralId"=$1', [medicao])).rows).toEqual([{ status: "CONFIRMADA", recipiente: "Balde confirmado" }]);
    await f.rejeitar(() => f.db.query('UPDATE pecuaria."MedicaoGeralLeite" SET litros=21,versao=versao+1 WHERE id=$1', [medicao]), "23514", "regularize a entrada");
  }));
});
