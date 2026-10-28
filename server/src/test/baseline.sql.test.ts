import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baselineSql as sql, contemSql, funcaoSql } from "./sql-baseline.js";

describe("instalação do estado final na baseline unificada", () => {
  it("aceita os schemas que o Prisma prepara antes de aplicar a baseline", () => {
    for (const schema of ["public", "pecuaria"]) {
      expect(sql).toContain(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
      expect(sql).not.toMatch(new RegExp(`CREATE SCHEMA ${schema};`));
    }
  });

  it("mantém baseline inicial única seguida de migrations aditivas, sem transportar histórico ou dados operacionais", () => {
    const migrations = readdirSync(new URL("../../prisma/migrations/", import.meta.url)).filter(n => /^\d+_/.test(n)).sort();
    expect(migrations[0]).toBe("20261025000000_base_unificada");
    expect(migrations.filter(n => n.endsWith("_base_unificada"))).toEqual(["20261025000000_base_unificada"]);
    expect(sql).not.toMatch(/_prisma_migrations|OWNER TO|GRANT |REVOKE |^COPY |^UPDATE |^DELETE FROM|^TRUNCATE /m);
    const catalogos = [...sql.matchAll(/^INSERT INTO (.+?) \(/gm)].map(m => m[1]);
    expect(catalogos).toEqual(['"pecuaria"."CategoriaAnimal"', 'pecuaria."TipoAplicacaoSanitaria"', '"public"."Categoria"', 'pecuaria."TipoExame"', 'pecuaria."TipoExame"']);
    expect(sql).not.toMatch(/CREATE TABLE public\."(?:Animal|GestacaoAnimal|Agricultura|Cultivo|RegistroChuva|Funcionario)"/);
  });

  it("instala btree_gist antes das exclusões de nutrição e lactação", () => {
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;");
    for (const nome of ["FechamentoConsumo_sem_sobreposicao", "LactacaoAnimal_sem_sobreposicao", "VigenciaDietaLote_sem_sobreposicao"]) {
      expect(sql).toMatch(new RegExp(`CONSTRAINT "${nome}" EXCLUDE USING gist`));
      expect(sql.indexOf("CREATE EXTENSION")).toBeLessThan(sql.indexOf(`CONSTRAINT "${nome}"`));
    }
  });

  it("conserva as views de compatibilidade e somente a definição final de cada função", () => {
    for (const view of ["DestinoAnimal", "AvaliacaoReprodutiva", "ProtocoloIatf", "ProgramacaoIatf", "ParticipanteIatf", "TarefaIatf"])
      expect(sql).toContain(`CREATE VIEW pecuaria."${view}" AS`);
    const funcoes = [...sql.matchAll(/^CREATE FUNCTION ([^(]+)\(([^\n]*)/gm)].map(m => `${m[1]}(${m[2]}`);
    expect(new Set(funcoes).size).toBe(funcoes.length);
    expect(contemSql(funcaoSql("validar_fornecimento_nutricional_leite"), 'c.\"status\"::text<>f.\"status\"')).toBe(true);
    expect(contemSql(funcaoSql("conferir_medicao_geral_leite"), "IF TG_OP='INSERT' THEN RAISE EXCEPTION 'novas parcelas usam litros manuais")).toBe(true);
  });

  it("mantém unicidade parcial, carência e imutabilidade dos fatos e das alocações", () => {
    for (const indice of ["FinalidadeAnimal_animalId_aberto_key", "BaixaAnimal_animalId_ativa_key", "VinculoMedicaoEntrada_medicao_ativa", "PartidaProduto_raiz_produto_validade_key", "PartidaProduto_raiz_produto_sem_validade_key"])
      expect(sql).toMatch(new RegExp(`CREATE UNIQUE INDEX "${indice}"[^;]+WHERE`));
    expect(sql).toContain('CONSTRAINT carencia_estados_v3 CHECK');
    expect(sql).toContain('CREATE TRIGGER "AlocacaoPartidaEstoque_imutavel_v3"');
    expect(sql).toContain('CREATE TRIGGER "LocalizacaoAnimal_consumo_v3"');
    expect(sql).toContain('CREATE TRIGGER "VinculoPesagemParto_historico"');
    expect(sql).toContain('CREATE CONSTRAINT TRIGGER "MovimentoEstoque_conciliar_valor"');
  });
});
