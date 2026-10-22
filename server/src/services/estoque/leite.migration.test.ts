import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../../prisma/migrations/20261020000000_estoque_leite_valor_pendente/migration.sql", import.meta.url), "utf8");
const classificacao = readFileSync(new URL("../../../prisma/migrations/20261020030000_classificacao_entrada_leite/migration.sql", import.meta.url), "utf8");

describe("contrato SQL do estoque leiteiro — verificação estrutural, sem banco", () => {
  it.each(["Apuracao", "Apropriacao"])("%s confirmada impede UPDATE e DELETE", nome => {
    expect(sql).toContain(`CREATE TRIGGER "${nome}Leite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."${nome}ValorLeite"`);
  });

  it("preserva os métodos anteriores e restringe null ao método leiteiro comprovado", () => {
    expect(sql).toContain(`"metodoValorizacao"<>'LEITE_FIFO_V1' AND "custoUnitario" IS NOT NULL AND "valorTotal" IS NOT NULL`);
    expect(sql).toContain(`PERFORM pecuaria.conferir_movimento_leite(mid)`);
    expect(sql).toContain(`parcelas não conciliam quantidade/valor do movimento`);
    expect(sql).toContain(`consumidores superam produção ou impedem anulação do lastro`);
  });

  it("protege medição, população e identidade da sessão confirmada também no banco", () => {
    expect(sql).toContain(`"MedicaoLeite_proteger_estoque" BEFORE INSERT OR UPDATE OR DELETE`);
    expect(sql).toContain(`"ParticipanteLeite_proteger_estoque" BEFORE INSERT OR UPDATE OR DELETE`);
    expect(sql).toContain(`"SessaoLeite_proteger_estoque" BEFORE UPDATE OR DELETE`);
    expect(sql).toContain(`participante de ordenha confirmada não pode mudar de dia`);
  });

  it("natureza comercial exige declaração explícita, snapshot da mesma entrada e finalidade de venda", () => {
    expect(classificacao).toContain(`"ClassificacaoLeite_imutavel" BEFORE UPDATE OR DELETE`);
    expect(classificacao).toContain(`FOREIGN KEY ("classificacaoId", "entradaId")`);
    expect(classificacao).toContain(`anterior.natureza IN ('COLOSTRO','NAO_COMERCIAL')`);
    expect(classificacao).toContain(`NEW.versao<>1 OR NEW.natureza<>'NAO_INFORMADA'`);
    expect(classificacao).toContain(`operacao_tipo IS DISTINCT FROM 'VENDA' OR c.natureza<>'COMERCIAL'`);
    expect(classificacao).toContain(`saída exige snapshot da classificação vigente sob trava`);
    expect(classificacao).toContain(`destino.natureza='COLOSTRO' AND c.natureza<>'COLOSTRO'`);
    expect(classificacao).toContain(`destino.natureza='LEITE_NAO_COMERCIAL' AND c.natureza<>'NAO_COMERCIAL'`);
    expect(classificacao).toContain(`destino.natureza='LEITE_COMUM' AND c.natureza='COLOSTRO'`);
    expect(classificacao).toContain(`"DestinoLeite_natureza_origem" AFTER INSERT OR UPDATE`);
  });
});

const correcao = readFileSync(new URL("../../../prisma/migrations/20261020040000_correcao_comercial_venda_leite/migration.sql", import.meta.url), "utf8");
it("cadeia comercial imutável preserva retirada e bloqueia refund/estoque implícitos — contrato estrutural", () => {
  expect(correcao).toContain('"VersaoVendaLeite_imutavel" BEFORE UPDATE OR DELETE');
  expect(correcao).toContain('vendas leiteiras anteriores exigem reconciliação manual');
  expect(correcao).toContain('cadeia comercial deve ser contínua desde a versão um');
  expect(correcao).toContain('somente a última versão comercial permanece confirmada');
  expect(correcao).toContain('substituta comercial não cria outro movimento de estoque');
  expect(correcao).toContain('estorne explicitamente recebimentos antes da correção');
  expect(correcao).toContain('i.quantidade<>m.quantidade');
  expect(correcao).toContain('v.data<>m.data');
  expect(correcao).toContain('v."propriedadeId" IS DISTINCT FROM m."propriedadeId"');
  expect(correcao).toContain('correção de venda leiteira exige vínculo linear com a mesma retirada');
  expect(correcao).toContain('"Transacao_cadeia_leite" AFTER INSERT OR UPDATE OR DELETE');
  expect(correcao).toContain('DEFERRABLE INITIALLY DEFERRED');
});
