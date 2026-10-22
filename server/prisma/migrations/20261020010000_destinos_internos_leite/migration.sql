-- CreateTable
CREATE TABLE "pecuaria"."DestinoInternoLeite" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "entradaId" TEXT NOT NULL,
    "movimentoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "natureza" TEXT NOT NULL,
    "declaracaoOrigem" TEXT NOT NULL,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "saldoOrigemAntes" DECIMAL(14,3) NOT NULL,
    "saldoOrigemDepois" DECIMAL(14,3) NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "movimentoEstornoId" TEXT,

    CONSTRAINT "DestinoInternoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParcelaDestinoLeite" (
    "id" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "fornecimentoColostroId" TEXT,
    "criadoNoDestino" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParcelaDestinoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DestinoInternoLeite_chave_key" ON "pecuaria"."DestinoInternoLeite"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "DestinoInternoLeite_movimentoId_key" ON "pecuaria"."DestinoInternoLeite"("movimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "DestinoInternoLeite_movimentoEstornoId_key" ON "pecuaria"."DestinoInternoLeite"("movimentoEstornoId");

-- CreateIndex
CREATE INDEX "DestinoInternoLeite_propriedadeId_data_idx" ON "pecuaria"."DestinoInternoLeite"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "DestinoInternoLeite_entradaId_idx" ON "pecuaria"."DestinoInternoLeite"("entradaId");

-- CreateIndex
CREATE INDEX "ParcelaDestinoLeite_animalId_idx" ON "pecuaria"."ParcelaDestinoLeite"("animalId");

-- CreateIndex
CREATE INDEX "ParcelaDestinoLeite_fornecimentoColostroId_idx" ON "pecuaria"."ParcelaDestinoLeite"("fornecimentoColostroId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaDestinoLeite_destinoId_animalId_key" ON "pecuaria"."ParcelaDestinoLeite"("destinoId", "animalId");

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoInternoLeite" ADD CONSTRAINT "DestinoInternoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoInternoLeite" ADD CONSTRAINT "DestinoInternoLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoInternoLeite" ADD CONSTRAINT "DestinoInternoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoInternoLeite" ADD CONSTRAINT "DestinoInternoLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParcelaDestinoLeite" ADD CONSTRAINT "ParcelaDestinoLeite_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "pecuaria"."DestinoInternoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParcelaDestinoLeite" ADD CONSTRAINT "ParcelaDestinoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParcelaDestinoLeite" ADD CONSTRAINT "ParcelaDestinoLeite_fornecimentoColostroId_fkey" FOREIGN KEY ("fornecimentoColostroId") REFERENCES "pecuaria"."FornecimentoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Um fornecimento clínico pode mudar de origem após estorno, nunca ter duas origens ativas.
CREATE UNIQUE INDEX "ParcelaDestinoLeite_fornecimento_ativo_key"
  ON "pecuaria"."ParcelaDestinoLeite"("fornecimentoColostroId")
  WHERE "ativo" AND "fornecimentoColostroId" IS NOT NULL;
ALTER TABLE "pecuaria"."DestinoInternoLeite" ADD CONSTRAINT "DestinoInternoLeite_campos_check" CHECK (
  "natureza" IN ('COLOSTRO', 'LEITE_COMUM', 'LEITE_NAO_COMERCIAL')
  AND length(btrim("declaracaoOrigem")) >= 10 AND "versao" > 0
  AND "quantidadeLitros" > 0 AND "saldoOrigemAntes" >= "quantidadeLitros"
  AND "saldoOrigemDepois" = "saldoOrigemAntes" - "quantidadeLitros"
  AND (("status" = 'CONFIRMADO' AND "estornadoEm" IS NULL AND "movimentoEstornoId" IS NULL AND "motivoEstorno" IS NULL)
    OR ("status" = 'ESTORNADO' AND "estornadoEm" IS NOT NULL AND "movimentoEstornoId" IS NOT NULL
      AND "motivoEstorno" IS NOT NULL AND length(btrim("motivoEstorno")) >= 5))
);
ALTER TABLE "pecuaria"."ParcelaDestinoLeite" ADD CONSTRAINT "ParcelaDestinoLeite_quantidade_check"
  CHECK ("quantidadeLitros" > 0 AND (NOT "criadoNoDestino" OR "fornecimentoColostroId" IS NOT NULL));

CREATE FUNCTION "pecuaria"."conferir_destino_interno_leite"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destino_id text; d record; m record; origem record; soma numeric; quantidade_parcelas bigint;
BEGIN
  IF TG_TABLE_NAME = 'DestinoInternoLeite' THEN destino_id := COALESCE(NEW.id, OLD.id);
  ELSE destino_id := COALESCE(NEW."destinoId", OLD."destinoId"); END IF;
  SELECT * INTO d FROM "pecuaria"."DestinoInternoLeite" WHERE id = destino_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO m FROM "public"."MovimentoEstoque" WHERE id = d."movimentoId";
  SELECT em.* INTO origem FROM "pecuaria"."EntradaProducaoLeite" e
    JOIN "public"."MovimentoEstoque" em ON em.id=e."movimentoId" WHERE e.id=d."entradaId";
  SELECT sum("quantidadeLitros"), count(*) INTO soma, quantidade_parcelas
    FROM "pecuaria"."ParcelaDestinoLeite" WHERE "destinoId"=destino_id;
  IF quantidade_parcelas = 0 OR soma <> d."quantidadeLitros"
    OR m.tipo <> 'SAIDA' OR m.origem <> 'NUTRICAO' OR m."operacaoId" IS NOT NULL
    OR m."quantidade" <> d."quantidadeLitros" OR m."propriedadeId" IS DISTINCT FROM d."propriedadeId"
    OR (d.status='CONFIRMADO' AND m.status <> 'CONFIRMADO')
    OR (d.status='ESTORNADO' AND (m.status <> 'REVERTIDO' OR NOT EXISTS (
      SELECT 1 FROM "public"."MovimentoEstoque" inverso WHERE inverso.id=d."movimentoEstornoId"
        AND inverso."reversaoDeId"=d."movimentoId" AND inverso.tipo='ENTRADA'
        AND inverso.quantidade=d."quantidadeLitros" AND inverso."produtoId"=m."produtoId"
        AND inverso."propriedadeId"=d."propriedadeId")))
    OR origem."propriedadeId" IS DISTINCT FROM d."propriedadeId" OR origem."produtoId" <> m."produtoId"
    OR d.data < origem.data OR m.data <> d.data
    OR (SELECT count(*) FROM "pecuaria"."AlocacaoLeiteEstoque" WHERE "movimentoId"=d."movimentoId") <> 1
    OR NOT EXISTS (SELECT 1 FROM "pecuaria"."AlocacaoLeiteEstoque" a WHERE a."movimentoId"=d."movimentoId"
      AND a."entradaId"=d."entradaId" AND a.quantidade=d."quantidadeLitros")
    OR EXISTS (SELECT 1 FROM "pecuaria"."ParcelaDestinoLeite" p
      LEFT JOIN "pecuaria"."FornecimentoColostro" f ON f.id=p."fornecimentoColostroId"
      LEFT JOIN "pecuaria"."CriaParto" c ON c.id=f."criaId"
      WHERE p."destinoId"=destino_id AND (
        p.ativo <> (d.status='CONFIRMADO')
        OR (d.natureza <> 'COLOSTRO' AND p."fornecimentoColostroId" IS NOT NULL)
        OR (d.natureza = 'COLOSTRO' AND (p."fornecimentoColostroId" IS NULL
          OR c."animalId" IS DISTINCT FROM p."animalId" OR f."propriedadeId" <> d."propriedadeId"
          OR f.data <> d.data OR f."quantidadeLitros" IS DISTINCT FROM p."quantidadeLitros"
          OR (d.status='CONFIRMADO' AND f.status <> 'VALIDO'))))) THEN
    RAISE EXCEPTION 'Destino interno de leite incompatível com parcelas, fornecimento ou saída única' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DestinoInternoLeite_integridade"
  AFTER INSERT OR UPDATE ON "pecuaria"."DestinoInternoLeite"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."conferir_destino_interno_leite"();
CREATE CONSTRAINT TRIGGER "ParcelaDestinoLeite_integridade"
  AFTER INSERT OR UPDATE OR DELETE ON "pecuaria"."ParcelaDestinoLeite"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."conferir_destino_interno_leite"();

-- Fatos confirmados são imutáveis: correção cria estorno e um novo destino.
-- O único update físico permitido é a transição terminal de estorno. A constraint
-- diferida acima confere o inverso e todas as parcelas no estado final do mesmo tx.
CREATE FUNCTION "pecuaria"."proteger_fatos_destino_leite"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Histórico de destino interno de leite não pode ser apagado; registre estorno'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'DestinoInternoLeite' THEN
      IF NEW.status <> 'CONFIRMADO' OR NEW.versao <> 1 OR NEW."estornadoPorId" IS NOT NULL THEN
        RAISE EXCEPTION 'Destino interno deve iniciar confirmado na versão 1' USING ERRCODE = '23514';
      END IF;
    ELSIF NOT NEW.ativo THEN
      RAISE EXCEPTION 'Parcela de destino deve iniciar ativa' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'DestinoInternoLeite' THEN
    -- Lista de exceções fechada: todos os outros campos, inclusive id, chave,
    -- sítio, origem, data, natureza, litros, snapshots e autoria, são imutáveis.
    IF (to_jsonb(NEW) - ARRAY['status', 'versao', 'estornadoEm', 'estornadoPorId', 'motivoEstorno', 'movimentoEstornoId'])
      IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'versao', 'estornadoEm', 'estornadoPorId', 'motivoEstorno', 'movimentoEstornoId']) THEN
      RAISE EXCEPTION 'Fatos do destino interno são imutáveis; estorne e registre novo destino' USING ERRCODE = '23514';
    END IF;
    IF to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NEW; END IF;
    IF OLD.status <> 'CONFIRMADO' OR NEW.status <> 'ESTORNADO'
      OR NEW.versao <> OLD.versao + 1 OR NEW."estornadoEm" IS NULL
      OR NEW."movimentoEstornoId" IS NULL OR NEW."motivoEstorno" IS NULL
      OR length(btrim(NEW."motivoEstorno")) < 5 THEN
      RAISE EXCEPTION 'Estorno exige destino confirmado, próxima versão, motivo e movimento inverso'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Nem animal/quantidade nem vínculo clínico podem ser trocados por UPDATE.
    IF (to_jsonb(NEW) - 'ativo') IS DISTINCT FROM (to_jsonb(OLD) - 'ativo') THEN
      RAISE EXCEPTION 'Destinatário, quantidade e vínculos da parcela são imutáveis; estorne o destino'
        USING ERRCODE = '23514';
    END IF;
    IF to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NEW; END IF;
    IF NOT OLD.ativo OR NEW.ativo THEN
      RAISE EXCEPTION 'Parcela admite somente desativação por estorno, sem reativar histórico'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DestinoInternoLeite_fatos_imutaveis"
  BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."DestinoInternoLeite"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."proteger_fatos_destino_leite"();
CREATE TRIGGER "ParcelaDestinoLeite_fatos_imutaveis"
  BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."ParcelaDestinoLeite"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."proteger_fatos_destino_leite"();
