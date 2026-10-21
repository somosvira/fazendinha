import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../env.js";

// Este ensaio recria a estrutura anterior e só roda no CI externo. Nunca criar cópia do banco de desenvolvimento.
const suite = process.env.CI === "true" && process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("conversão dos dados anteriores à padronização", () => {
  it("migra evidências conflitantes e exames com colisão de ID sem reproduzir efeitos", async () => {
    const origem = new URL(env.DATABASE_URL);
    expect(["localhost", "127.0.0.1", "::1"]).toContain(origem.hostname);
    expect(origem.pathname).toMatch(/(?:test|qa)/);
    const banco = `fazendinha_qa_migracao_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new Client({ connectionString: origem.toString() });
    let destino: Client | undefined;
    let criado = false;
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${banco}"`);
      criado = true;
      const url = new URL(origem); url.pathname = `/${banco}`;
      destino = new Client({ connectionString: url.toString() });
      await destino.connect();
      const raiz = new URL("../../../prisma/migrations/", import.meta.url);
      const migracoes = (await readdir(raiz)).filter(n => /^\d+_/.test(n)).sort();
      const aplicar = async (nome: string) => destino!.query(await readFile(new URL(`${nome}/migration.sql`, raiz), "utf8"));
      for (const nome of migracoes.filter(n => n < "20261014140000")) await aplicar(nome);
      await destino.query(`
        INSERT INTO public."Propriedade" (id,nome,"updatedAt") VALUES (999,'Migração descartável',CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."Animal" (id,brinco,sexo,"dataNascimento",origem,"dataEntrada","atualizadoEm")
          VALUES ('animal-migracao','MIG-1','F','2020-01-01','COMPRADO','2026-01-01',CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."DestinoAnimal" (id,"animalId",aptidao,"papelReprodutivo",desde,ate,"atualizadoEm") VALUES
          ('destino-1','animal-migracao','LEITE','NENHUM','2026-01-01','2026-02-01',CURRENT_TIMESTAMP),
          ('destino-2','animal-migracao','LEITE','RECEPTORA','2026-02-01',NULL,CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."PeriodoReprodutivoAnimal" (id,"animalId",tipo,inicio,fim) VALUES
          ('periodo-importado','animal-migracao','DOADORA','2026-01-15','2026-03-01');
        INSERT INTO pecuaria."TipoExame" (id,nome,"tipoResultado") VALUES ('tipo-legado','Medida preservada','NUMERO');
        INSERT INTO pecuaria."ExameAnimal" (id,"animalId","tipoExameId",data,"resultadoNumero","formatoSnapshot","atualizadoEm")
          VALUES ('av-positivo','animal-migracao','tipo-legado','2026-01-01',0,'{"tipoResultado":"NUMERO","unidade":"mg"}',CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."AvaliacaoReprodutiva" (id,"animalId","propriedadeId",data,resultado,"sexoFetal","anotacaoOriginal",origem,status,"motivoAnulacao") VALUES
          ('av-positivo','animal-migracao',999,'2026-01-02','POSITIVO','F','P+ / F','IDEAGRI','VALIDO',NULL),
          ('av-negativo','animal-migracao',999,'2026-01-03','NEGATIVO',NULL,'IATFCL','IDEAGRI','VALIDO',NULL),
          ('av-reconfirmacao','animal-migracao',999,'2026-01-04','RECONFIRMACAO',NULL,'OK','IDEAGRI','VALIDO',NULL),
          ('av-sexagem','animal-migracao',999,'2026-01-05','SEXAGEM','M','M','IDEAGRI','VALIDO',NULL),
          ('av-inconclusivo','animal-migracao',NULL,'2026-01-06','INCONCLUSIVO',NULL,'Aguardar','IDEAGRI','ANULADO','Revisão histórica'),
          ('av-nao-avaliado','animal-migracao',NULL,'2026-01-07','NAO_AVALIADO',NULL,'Não atendido','IDEAGRI','VALIDO',NULL);
      `);
      await destino.query(`
        INSERT INTO pecuaria."ProtocoloSanitario" (id,nome,"publicadoEm","atualizadoEm") VALUES ('proto-colisao','Sanitário preservado','2026-01-01',CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."EtapaProtocoloSanitario" (id,"protocoloId",ordem,"diaRelativo",tipo,"tipoExameId") VALUES ('etapa-s','proto-colisao',1,10,'EXAME','tipo-legado');
        INSERT INTO pecuaria."RodadaProtocoloSanitario" (id,nome,"protocoloId","propriedadeId","inicioReferencia","atualizadoEm") VALUES ('programa-colisao','Grupo sanitário','proto-colisao',999,'2026-01-01',CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."ExecucaoProtocoloSanitario" (id,"protocoloId","animalId","propriedadeId",inicio,"rodadaId") VALUES ('participacao-colisao','proto-colisao','animal-migracao',999,'2026-01-01','programa-colisao'),('sanitaria-sem-grupo','proto-colisao','animal-migracao',999,'2025-12-01',NULL);
        INSERT INTO pecuaria."TarefaSanitaria" (id,"execucaoId","etapaId","previstaPara",parametros) VALUES ('tarefa-colisao','participacao-colisao','etapa-s','2026-01-11','{"versao":1,"tipo":"EXAME","tipoExameId":"tipo-legado"}');
        UPDATE pecuaria."ExameAnimal" SET "tarefaId"='tarefa-colisao' WHERE id='av-positivo';
        INSERT INTO pecuaria."ProtocoloIatf" (id,nome,versao,publicado,etapas) VALUES ('proto-colisao','IATF preservada',1,true,'[{"nome":"Reconfirmação","tipo":"AVALIACAO","intervalo":11,"unidade":"DIAS","planoAvaliacao":{"tipo":"RECONFIRMACAO"}}]'),('protocolo-incompleto','Arquivo incompleto',1,false,'[{"nome":"Manejo sem detalhes","tipo":"MANEJO","intervalo":0,"unidade":"DIAS"}]');
        INSERT INTO pecuaria."ProgramacaoIatf" (id,"propriedadeId","protocoloId",nome,"inicioPrevisto",status) VALUES ('programa-colisao',999,'proto-colisao','IATF arquivada','2026-01-01 13:24:30','ARQUIVADA');
        INSERT INTO pecuaria."ParticipanteIatf" (id,"programacaoId","animalId","inicioPrevisto","inicioEfetivo") VALUES ('participacao-colisao','programa-colisao','animal-migracao','2026-01-01 13:24:30','2026-01-02 14:10:00');
        INSERT INTO pecuaria."TarefaIatf" (id,"participanteId",etapa,tipo,nome,"previstaEm","previsaoOriginal","realizadaEm","avaliacaoId","planejadoSnapshot","realizadoSnapshot") VALUES ('tarefa-colisao','participacao-colisao',0,'AVALIACAO','Nome original preservado','2026-01-13 14:10:00','2026-01-12 13:24:30','2026-01-14 15:00:00','av-reconfirmacao','{"versao":1,"origem":"plano imutável"}','{"versao":1,"idAnterior":"tarefa-colisao"}');
        INSERT INTO pecuaria."VisitaVeterinaria" (id,"propriedadeId",data,nome) VALUES ('visita-legada',999,'2026-01-14','Visita histórica');
        INSERT INTO pecuaria."AtividadeVisita" (id,"visitaId",tipo,nome,ordem) VALUES ('atividade-legada','visita-legada','TAREFA_IATF','Exame em campo',1);
        INSERT INTO pecuaria."ParticipanteVisita" (id,"atividadeId","animalId",ordem,"tarefaIatfId",snapshot,"atualizadoEm") VALUES ('atendimento-legado','atividade-legada','animal-migracao',1,'tarefa-colisao','{"tarefaIatfId":"tarefa-colisao","anotacao":"OK"}',CURRENT_TIMESTAMP);
        INSERT INTO pecuaria."ImpressaoVisita" (id,"visitaId",versao,snapshot) VALUES ('impressao-legada','visita-legada',1,'{"tarefaIatfId":"tarefa-colisao","anotacao":"OK"}');
      `);
      const anteriores = (await destino.query('SELECT to_jsonb(a) AS registro FROM pecuaria."AvaliacaoReprodutiva" a ORDER BY id')).rows;
      const destinos = (await destino.query('SELECT to_jsonb(d) AS registro FROM pecuaria."DestinoAnimal" d ORDER BY id')).rows;
      await aplicar("20261014140000_papel_reprodutivo_canonico");
      const mapa = (await destino.query('SELECT "destinoOrigemId",tipo,proveniencia FROM pecuaria."PeriodoReprodutivoAnimal" WHERE "destinoOrigemId" IS NOT NULL ORDER BY "destinoOrigemId"')).rows;
      expect(mapa).toHaveLength(2);
      expect(mapa.map(p => p.proveniencia.registro)).toEqual(destinos.map(d => d.registro));
      expect((await destino.query('SELECT count(*)::int AS n FROM pecuaria."PeriodoReprodutivoAnimal"')).rows[0].n).toBe(3);
      await aplicar("20261014150000_exame_comum");
      expect((await destino.query('SELECT to_jsonb(a) AS registro FROM pecuaria."AvaliacaoReprodutiva" a ORDER BY id')).rows).toEqual(anteriores);
      expect((await destino.query('SELECT count(*)::int AS n FROM pecuaria."ExameAnimal"')).rows[0].n).toBe(7);
      expect((await destino.query('SELECT "exameId" FROM pecuaria."InterpretacaoReprodutiva" WHERE id=\'av-positivo\'')).rows[0].exameId).toBe("exame-reprodutivo:av-positivo");
      expect((await destino.query('SELECT "resultadoNumero"::text AS n FROM pecuaria."ExameAnimal" WHERE id=\'av-positivo\'')).rows[0].n).toBe("0.0000");
      const protocolosAntes = (await destino.query('SELECT to_jsonb(p) AS registro FROM pecuaria."ProtocoloIatf" p ORDER BY nome')).rows;
      await aplicar("20261014160000_protocolos_comuns");
      const mapaProtocolos = (await destino.query('SELECT id,"legadoIatfId" FROM pecuaria."Protocolo" WHERE tipo=\'REPRODUTIVO\'')).rows;
      const protocolo = mapaProtocolos.find(p => p.legadoIatfId === "proto-colisao");
      expect(protocolo.id).not.toBe("proto-colisao");
      expect((await destino.query('SELECT to_jsonb(p) AS registro FROM pecuaria."ProtocoloIatf" p ORDER BY nome')).rows.map(p => ({ ...p.registro, id: mapaProtocolos.find(m => m.id === p.registro.id).legadoIatfId }))).toEqual(protocolosAntes.map(p => p.registro));
      const participante = (await destino.query('SELECT * FROM pecuaria."ParticipacaoProtocolo" WHERE "legadoIatfId"=\'participacao-colisao\'')).rows[0];
      expect(participante.id).not.toBe("participacao-colisao");
      expect(participante.precisaoTemporal).toBe("HORA");
      const v3 = (await destino.query('SELECT * FROM pecuaria."ParticipacaoProtocolo" WHERE id=\'sanitaria-sem-grupo\'')).rows[0];
      expect(v3.programacaoId).toBeNull(); expect(v3.inicioEfetivo).toBeNull(); expect(v3.precisaoTemporal).toBe("DIA");
      const tarefa = (await destino.query('SELECT * FROM pecuaria."TarefaProtocolo" WHERE "legadoIatfId"=\'tarefa-colisao\'')).rows[0];
      expect(tarefa.id).not.toBe("tarefa-colisao"); expect(tarefa.planejadoSnapshot.origem).toBe("plano imutável"); expect(tarefa.realizadoSnapshot.idAnterior).toBe("tarefa-colisao");
      expect((await destino.query('SELECT count(*)::int AS n FROM pecuaria."VinculoTarefaProtocolo"')).rows[0].n).toBe(2);
      await aplicar("20261014170000_contratos_comuns");
      expect((await destino.query('SELECT "tarefaId" FROM pecuaria."ParticipanteVisita" WHERE id=\'atendimento-legado\'')).rows[0].tarefaId).toBe(tarefa.id);
      expect((await destino.query('SELECT snapshot FROM pecuaria."ImpressaoVisita"')).rows[0].snapshot.tarefaIatfId).toBe("tarefa-colisao");
      await expect(destino.query('UPDATE pecuaria."ProtocoloIatf" SET nome=\'Mudança inválida\'')).rejects.toThrow(/cannot update view/);
      for (const tabela of ["GestacaoAnimal", "PartoAnimal", "TentativaReprodutiva"]) expect((await destino.query(`SELECT count(*)::int AS n FROM pecuaria."${tabela}"`)).rows[0].n).toBe(0);
      expect((await destino.query('SELECT count(*)::int AS n FROM public."MovimentoEstoque"')).rows[0].n).toBe(0);
      await expect(destino.query('UPDATE pecuaria."AvaliacaoReprodutiva" SET resultado=\'NEGATIVO\' WHERE id=\'av-positivo\'')).rejects.toThrow(/cannot update view/);

      // Confere a renomeação sobre registros reais anteriores, somente neste ensaio de CI.
      for (const nome of migracoes.filter(n => n > "20261014170000_contratos_comuns" && n < "20261021173000")) await aplicar(nome);
      const finalidadeAntes = (await destino.query('SELECT to_jsonb(d) AS registro FROM pecuaria."DestinoAnimal" d ORDER BY id')).rows;
      const identidadeAntes = (await destino.query(`SELECT 'pecuaria."DestinoAnimal"'::regclass::oid AS tabela,
        'pecuaria."DestinoAnimal_animalId_aberto_key"'::regclass::oid AS indice`)).rows[0];
      for (const nome of migracoes.filter(n => n >= "20261021173000")) await aplicar(nome);
      expect((await destino.query('SELECT to_jsonb(d) AS registro FROM pecuaria."FinalidadeAnimal" d ORDER BY id')).rows).toEqual(finalidadeAntes);
      expect((await destino.query('SELECT to_jsonb(d) AS registro FROM pecuaria."DestinoAnimal" d ORDER BY id')).rows).toEqual(finalidadeAntes);
      expect((await destino.query(`SELECT 'pecuaria."FinalidadeAnimal"'::regclass::oid AS tabela,
        'pecuaria."FinalidadeAnimal_animalId_aberto_key"'::regclass::oid AS indice`)).rows[0]).toEqual(identidadeAntes);
      expect((await destino.query(`SELECT confrelid::oid AS tabela FROM pg_constraint
        WHERE conrelid='pecuaria."BaixaAnimal"'::regclass AND conname='BaixaAnimal_destinoFechadoId_fkey'`)).rows[0].tabela).toBe(identidadeAntes.tabela);
    } finally {
      if (destino) await destino.end();
      if (criado) await admin.query(`DROP DATABASE "${banco}"`);
      await admin.end();
    }
  }, 90_000);
});
