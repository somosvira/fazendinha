import { contemSql } from "../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
const classificacao = readFileSync(new URL("../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");

describe("contrato SQL do estoque leiteiro — verificação estrutural, sem banco", () => {
  it.each(["Apuracao", "Apropriacao"])("%s confirmada impede UPDATE e DELETE", nome => {
    expect(contemSql(sql, `CREATE TRIGGER "${nome}Leite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."${nome}ValorLeite"`)).toBe(true);
  });

  it("preserva os métodos anteriores e restringe null ao método leiteiro comprovado", () => {
    expect(contemSql(sql, `("metodoValorizacao" <> 'LEITE_FIFO_V1'::text) AND ("custoUnitario" IS NOT NULL) AND ("valorTotal" IS NOT NULL)`)).toBe(true);
    expect(contemSql(sql, `PERFORM pecuaria.conferir_movimento_leite(mid)`)).toBe(true);
    expect(contemSql(sql, `parcelas não conciliam quantidade/valor do movimento`)).toBe(true);
    expect(contemSql(sql, `consumidores superam produção ou impedem anulação do lastro`)).toBe(true);
  });

  it("protege medição, população e identidade da sessão confirmada também no banco", () => {
    expect(contemSql(sql, `"MedicaoLeite_proteger_estoque" BEFORE INSERT OR UPDATE OR DELETE`)).toBe(true);
    expect(contemSql(sql, `"ParticipanteLeite_proteger_estoque" BEFORE INSERT OR UPDATE OR DELETE`)).toBe(true);
    expect(contemSql(sql, `"SessaoLeite_proteger_estoque" BEFORE UPDATE OR DELETE`)).toBe(true);
    expect(contemSql(sql, `participante de ordenha confirmada não pode mudar de dia`)).toBe(true);
  });

  it("natureza comercial exige declaração explícita, snapshot da mesma entrada e finalidade de venda", () => {
    expect(contemSql(classificacao, `"ClassificacaoLeite_imutavel" BEFORE UPDATE OR DELETE`)).toBe(true);
    expect(contemSql(classificacao, `FOREIGN KEY ("classificacaoId", "entradaId")`)).toBe(true);
    expect(contemSql(classificacao, `anterior.natureza IN ('COLOSTRO','NAO_COMERCIAL')`)).toBe(true);
    expect(contemSql(classificacao, `NEW.versao<>1 OR NEW.natureza<>'NAO_INFORMADA'`)).toBe(true);
    expect(contemSql(classificacao, `c.natureza<>'COMERCIAL' OR (operacao_tipo IS DISTINCT FROM 'VENDA' AND NOT (`)).toBe(true);
    expect(contemSql(classificacao, `m.origem::text='RETIRADA_LEITE'`)).toBe(true);
    expect(contemSql(classificacao, `r.\"movimentoId\"=m.id AND o.\"propriedadeId\"=m.\"propriedadeId\"`)).toBe(true);
    expect(contemSql(classificacao, `saída exige snapshot da classificação vigente sob trava`)).toBe(true);
    expect(contemSql(classificacao, `destino.natureza='COLOSTRO' AND c.natureza<>'COLOSTRO'`)).toBe(true);
    expect(contemSql(classificacao, `destino.natureza='LEITE_NAO_COMERCIAL' AND c.natureza<>'NAO_COMERCIAL'`)).toBe(true);
    expect(contemSql(classificacao, `destino.natureza='LEITE_COMUM' AND c.natureza='COLOSTRO'`)).toBe(true);
    expect(contemSql(classificacao, `"DestinoLeite_natureza_origem" AFTER INSERT OR UPDATE`)).toBe(true);
  });
});

const correcao = readFileSync(new URL("../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
it("cadeia comercial imutável preserva retirada e bloqueia refund/estoque implícitos — contrato estrutural", () => {
  expect(contemSql(correcao, '"VersaoVendaLeite_imutavel" BEFORE UPDATE OR DELETE')).toBe(true);
  expect(correcao).not.toContain('vendas leiteiras anteriores exigem reconciliação manual'); // Conversão histórica retirada da instalação limpa.
  expect(contemSql(correcao, 'cadeia comercial deve ser contínua desde a versão um')).toBe(true);
  expect(contemSql(correcao, 'somente a última versão comercial permanece confirmada')).toBe(true);
  expect(contemSql(correcao, 'substituta comercial não cria outro movimento de estoque')).toBe(true);
  expect(contemSql(correcao, 'estorne explicitamente recebimentos antes da correção')).toBe(true);
  expect(contemSql(correcao, 'i.quantidade<>m.quantidade')).toBe(true);
  expect(contemSql(correcao, 'v.data<>m.data')).toBe(true);
  expect(contemSql(correcao, 'v."propriedadeId" IS DISTINCT FROM m."propriedadeId"')).toBe(true);
  expect(contemSql(correcao, 'correção de venda leiteira exige vínculo linear com a mesma retirada')).toBe(true);
  expect(contemSql(correcao, '"Transacao_cadeia_leite" AFTER INSERT OR UPDATE OR DELETE')).toBe(true);
  expect(contemSql(correcao, 'DEFERRABLE INITIALLY DEFERRED')).toBe(true);
});
