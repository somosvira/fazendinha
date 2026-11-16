-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "apresentacao" VARCHAR(200),
ADD COLUMN     "classificacaoTecnicaId" UUID,
ADD COLUMN     "codigoReferencia" VARCHAR(80),
ADD COLUMN     "composicaoVersaoAtualId" UUID,
ADD COLUMN     "conservacao" VARCHAR(1000),
ADD COLUMN     "fabricanteId" UUID,
ADD COLUMN     "observacao" VARCHAR(2000),
ADD COLUMN     "perfilNutricionalVersaoAtualId" UUID,
ADD COLUMN     "revisaoCadastro" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD COLUMN     "composicaoSnapshot" JSONB;

-- CreateTable
CREATE TABLE "FabricanteProduto" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "atualizadoPorId" INTEGER,

    CONSTRAINT "FabricanteProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificacaoTecnicaProduto" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "atualizadoPorId" INTEGER,

    CONSTRAINT "ClassificacaoTecnicaProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrincipioAtivo" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "atualizadoPorId" INTEGER,

    CONSTRAINT "PrincipioAtivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutrienteProdutoCatalogo" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "atualizadoPorId" INTEGER,
    "nomeCompleto" VARCHAR(300),
    "unidadeReferencia" VARCHAR(20) NOT NULL,

    CONSTRAINT "NutrienteProdutoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposicaoProdutoVersao" (
    "id" UUID NOT NULL,
    "produtoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "situacao" VARCHAR(20) NOT NULL,
    "referencia" VARCHAR(500),
    "motivoAlteracao" VARCHAR(500),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ComposicaoProdutoVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposicaoProdutoItem" (
    "id" UUID NOT NULL,
    "versaoId" UUID NOT NULL,
    "principioAtivoId" UUID NOT NULL,
    "nomePrincipioSnapshot" VARCHAR(100) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "concentracaoValor" DECIMAL(18,6),
    "concentracaoUnidade" VARCHAR(35),

    CONSTRAINT "ComposicaoProdutoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilNutricionalProdutoVersao" (
    "id" UUID NOT NULL,
    "produtoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "situacao" VARCHAR(20) NOT NULL,
    "referencia" VARCHAR(500),
    "motivoAlteracao" VARCHAR(500),
    "materiaSecaSnapshot" DECIMAL(5,2),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "PerfilNutricionalProdutoVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilNutricionalProdutoItem" (
    "id" UUID NOT NULL,
    "versaoId" UUID NOT NULL,
    "nutrienteId" UUID NOT NULL,
    "nomeNutrienteSnapshot" VARCHAR(100) NOT NULL,
    "unidadeSnapshot" VARCHAR(20) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "valor" DECIMAL(18,6),
    "base" VARCHAR(20) NOT NULL,

    CONSTRAINT "PerfilNutricionalProdutoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReenvioCadastroEstoque" (
    "id" UUID NOT NULL,
    "autor" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "chave" UUID NOT NULL,
    "hashPayload" CHAR(64) NOT NULL,
    "resultado" JSONB NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReenvioCadastroEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigemCadastroProduto" (
    "id" UUID NOT NULL,
    "sistema" TEXT NOT NULL,
    "catalogo" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "codigoOrigem" TEXT NOT NULL,
    "hashRegistro" CHAR(64) NOT NULL,
    "arquivoSha256" CHAR(64) NOT NULL,
    "revisaoDecisao" TEXT NOT NULL,
    "importadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importadoPorId" INTEGER,
    "produtoId" TEXT,
    "fabricanteId" UUID,
    "classificacaoTecnicaId" UUID,
    "nutrienteId" UUID,

    CONSTRAINT "OrigemCadastroProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigemPrincipioAtivo" (
    "id" UUID NOT NULL,
    "principioAtivoId" UUID NOT NULL,
    "sistema" TEXT NOT NULL,
    "catalogo" TEXT NOT NULL,
    "codigoOrigem" TEXT NOT NULL,
    "hashRegistro" CHAR(64) NOT NULL,
    "arquivoSha256" CHAR(64) NOT NULL,
    "importadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importadoPorId" INTEGER,

    CONSTRAINT "OrigemPrincipioAtivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigemComposicaoProdutoItem" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "sistema" TEXT NOT NULL,
    "catalogo" TEXT NOT NULL,
    "codigoProdutoOrigem" TEXT NOT NULL,
    "codigoVinculoOrigem" TEXT NOT NULL,
    "hashRegistro" CHAR(64) NOT NULL,
    "arquivoSha256" CHAR(64) NOT NULL,
    "revisaoImportacaoId" TEXT NOT NULL,

    CONSTRAINT "OrigemComposicaoProdutoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FabricanteProduto_nomeNormalizado_key" ON "FabricanteProduto"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificacaoTecnicaProduto_nomeNormalizado_key" ON "ClassificacaoTecnicaProduto"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "PrincipioAtivo_nomeNormalizado_key" ON "PrincipioAtivo"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "NutrienteProdutoCatalogo_nomeNormalizado_key" ON "NutrienteProdutoCatalogo"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoProdutoVersao_produtoId_numero_key" ON "ComposicaoProdutoVersao"("produtoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoProdutoVersao_produtoId_id_key" ON "ComposicaoProdutoVersao"("produtoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoProdutoItem_versaoId_principioAtivoId_key" ON "ComposicaoProdutoItem"("versaoId", "principioAtivoId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoProdutoItem_versaoId_ordem_key" ON "ComposicaoProdutoItem"("versaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilNutricionalProdutoVersao_produtoId_numero_key" ON "PerfilNutricionalProdutoVersao"("produtoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilNutricionalProdutoVersao_produtoId_id_key" ON "PerfilNutricionalProdutoVersao"("produtoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilNutricionalProdutoItem_versaoId_nutrienteId_key" ON "PerfilNutricionalProdutoItem"("versaoId", "nutrienteId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilNutricionalProdutoItem_versaoId_ordem_key" ON "PerfilNutricionalProdutoItem"("versaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "ReenvioCadastroEstoque_autor_operacao_chave_key" ON "ReenvioCadastroEstoque"("autor", "operacao", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemCadastroProduto_sistema_catalogo_entidade_codigoOrige_key" ON "OrigemCadastroProduto"("sistema", "catalogo", "entidade", "codigoOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemPrincipioAtivo_sistema_catalogo_codigoOrigem_key" ON "OrigemPrincipioAtivo"("sistema", "catalogo", "codigoOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemComposicaoProdutoItem_itemId_key" ON "OrigemComposicaoProdutoItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_composicaoVersaoAtualId_key" ON "Produto"("composicaoVersaoAtualId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_perfilNutricionalVersaoAtualId_key" ON "Produto"("perfilNutricionalVersaoAtualId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_id_composicaoVersaoAtualId_key" ON "Produto"("id", "composicaoVersaoAtualId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_id_perfilNutricionalVersaoAtualId_key" ON "Produto"("id", "perfilNutricionalVersaoAtualId");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_fabricanteId_fkey" FOREIGN KEY ("fabricanteId") REFERENCES "FabricanteProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_classificacaoTecnicaId_fkey" FOREIGN KEY ("classificacaoTecnicaId") REFERENCES "ClassificacaoTecnicaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_id_composicaoVersaoAtualId_fkey" FOREIGN KEY ("id", "composicaoVersaoAtualId") REFERENCES "ComposicaoProdutoVersao"("produtoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_id_perfilNutricionalVersaoAtualId_fkey" FOREIGN KEY ("id", "perfilNutricionalVersaoAtualId") REFERENCES "PerfilNutricionalProdutoVersao"("produtoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoProdutoVersao" ADD CONSTRAINT "ComposicaoProdutoVersao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoProdutoItem" ADD CONSTRAINT "ComposicaoProdutoItem_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "ComposicaoProdutoVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoProdutoItem" ADD CONSTRAINT "ComposicaoProdutoItem_principioAtivoId_fkey" FOREIGN KEY ("principioAtivoId") REFERENCES "PrincipioAtivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilNutricionalProdutoVersao" ADD CONSTRAINT "PerfilNutricionalProdutoVersao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilNutricionalProdutoItem" ADD CONSTRAINT "PerfilNutricionalProdutoItem_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "PerfilNutricionalProdutoVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilNutricionalProdutoItem" ADD CONSTRAINT "PerfilNutricionalProdutoItem_nutrienteId_fkey" FOREIGN KEY ("nutrienteId") REFERENCES "NutrienteProdutoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigemCadastroProduto" ADD CONSTRAINT "OrigemCadastroProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigemCadastroProduto" ADD CONSTRAINT "OrigemCadastroProduto_fabricanteId_fkey" FOREIGN KEY ("fabricanteId") REFERENCES "FabricanteProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigemCadastroProduto" ADD CONSTRAINT "OrigemCadastroProduto_classificacaoTecnicaId_fkey" FOREIGN KEY ("classificacaoTecnicaId") REFERENCES "ClassificacaoTecnicaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigemCadastroProduto" ADD CONSTRAINT "OrigemCadastroProduto_nutrienteId_fkey" FOREIGN KEY ("nutrienteId") REFERENCES "NutrienteProdutoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigemPrincipioAtivo" ADD CONSTRAINT "OrigemPrincipioAtivo_principioAtivoId_fkey" FOREIGN KEY ("principioAtivoId") REFERENCES "PrincipioAtivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigemComposicaoProdutoItem" ADD CONSTRAINT "OrigemComposicaoProdutoItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ComposicaoProdutoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Normalização versionada, determinística e sem dependência de unaccent.
CREATE FUNCTION public.normalizar_nome_produto_v1(valor text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT lower(translate(btrim(regexp_replace(valor, '\s+', ' ', 'g')),
 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ',
 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'))
$$;
ALTER TABLE public."Produto" ADD CONSTRAINT "Produto_revisaoCadastro_check" CHECK ("revisaoCadastro" > 0);
ALTER TABLE public."OrigemCadastroProduto" ADD CONSTRAINT "OrigemCadastroProduto_destino_check" CHECK (
 num_nonnulls("produtoId", "fabricanteId", "classificacaoTecnicaId", "nutrienteId") = 1
 AND (("entidade" = 'PRODUTO' AND "produtoId" IS NOT NULL)
 OR ("entidade" = 'FABRICANTE' AND "fabricanteId" IS NOT NULL)
 OR ("entidade" = 'CLASSIFICACAO_TECNICA' AND "classificacaoTecnicaId" IS NOT NULL)
 OR ("entidade" = 'NUTRIENTE' AND "nutrienteId" IS NOT NULL)));
ALTER TABLE public."NutrienteProdutoCatalogo" ADD CONSTRAINT "NutrienteProdutoCatalogo_unidade_check" CHECK ("unidadeReferencia" IN ('PERCENTUAL','MG_KG','MCAL_KG'));
ALTER TABLE public."ComposicaoProdutoItem" ADD CONSTRAINT "ComposicaoProdutoItem_concentracao_check" CHECK (
 ("concentracaoValor" IS NULL AND "concentracaoUnidade" IS NULL)
 OR ("concentracaoValor" IS NOT NULL AND "concentracaoUnidade" IS NOT NULL AND "concentracaoValor" > 0
 AND "concentracaoValor" <= 999999999999.999999
 AND "concentracaoUnidade" IN ('MG_ML','MG_G','G_L','UI_ML','UI_G','PERCENTUAL_MASSA_MASSA','PERCENTUAL_MASSA_VOLUME','PERCENTUAL_VOLUME_VOLUME')
 AND ("concentracaoUnidade" NOT LIKE 'PERCENTUAL%' OR "concentracaoValor" <= 100)));
ALTER TABLE public."PerfilNutricionalProdutoItem" ADD CONSTRAINT "PerfilNutricionalProdutoItem_valor_check" CHECK (
 "unidadeSnapshot" IN ('PERCENTUAL','MG_KG','MCAL_KG') AND (
 ("valor" IS NULL AND "base" = 'NAO_INFORMADA') OR ("valor" IS NOT NULL AND "valor" >= 0 AND "valor" <= 999999999999.999999
 AND "base" IN ('MATERIA_NATURAL','MATERIA_SECA') AND ("unidadeSnapshot" <> 'PERCENTUAL' OR "valor" <= 100))));
ALTER TABLE pecuaria."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_composicaoSnapshot_check" CHECK (
 "composicaoSnapshot" IS NULL OR (jsonb_typeof("composicaoSnapshot") = 'object'
 AND "composicaoSnapshot" ?& ARRAY['schemaVersion','contexto','situacao','itens','capturadoEm','referencia','versaoComposicaoId']
 AND "composicaoSnapshot" @> '{"schemaVersion":1}'::jsonb
 AND "composicaoSnapshot"->>'contexto' IN ('CADASTRO_NA_GRAVACAO','CONFIRMADA_NO_ATENDIMENTO')
 AND "composicaoSnapshot"->>'situacao' IN ('INFORMADA','NAO_INFORMADA')
 AND jsonb_typeof("composicaoSnapshot"->'itens') = 'array') IS TRUE);
ALTER TABLE public."FabricanteProduto" ADD CONSTRAINT "FabricanteProduto_nome_check" CHECK (char_length(btrim("nome")) BETWEEN 2 AND 160 AND "nomeNormalizado" = public.normalizar_nome_produto_v1("nome")), ADD CONSTRAINT "FabricanteProduto_revisao_check" CHECK ("revisao" > 0);
ALTER TABLE public."FabricanteProduto" ADD CONSTRAINT "FabricanteProduto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."FabricanteProduto" ADD CONSTRAINT "FabricanteProduto_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."ClassificacaoTecnicaProduto" ADD CONSTRAINT "ClassificacaoTecnicaProduto_nome_check" CHECK (char_length(btrim("nome")) BETWEEN 2 AND 160 AND "nomeNormalizado" = public.normalizar_nome_produto_v1("nome")), ADD CONSTRAINT "ClassificacaoTecnicaProduto_revisao_check" CHECK ("revisao" > 0);
ALTER TABLE public."ClassificacaoTecnicaProduto" ADD CONSTRAINT "ClassificacaoTecnicaProduto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."ClassificacaoTecnicaProduto" ADD CONSTRAINT "ClassificacaoTecnicaProduto_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."PrincipioAtivo" ADD CONSTRAINT "PrincipioAtivo_nome_check" CHECK (char_length(btrim("nome")) BETWEEN 2 AND 100 AND "nomeNormalizado" = public.normalizar_nome_produto_v1("nome")), ADD CONSTRAINT "PrincipioAtivo_revisao_check" CHECK ("revisao" > 0);
ALTER TABLE public."PrincipioAtivo" ADD CONSTRAINT "PrincipioAtivo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."PrincipioAtivo" ADD CONSTRAINT "PrincipioAtivo_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."NutrienteProdutoCatalogo" ADD CONSTRAINT "NutrienteProdutoCatalogo_nome_check" CHECK (char_length(btrim("nome")) BETWEEN 2 AND 100 AND "nomeNormalizado" = public.normalizar_nome_produto_v1("nome")), ADD CONSTRAINT "NutrienteProdutoCatalogo_revisao_check" CHECK ("revisao" > 0);
ALTER TABLE public."NutrienteProdutoCatalogo" ADD CONSTRAINT "NutrienteProdutoCatalogo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."NutrienteProdutoCatalogo" ADD CONSTRAINT "NutrienteProdutoCatalogo_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."ComposicaoProdutoVersao" ADD CONSTRAINT "ComposicaoProdutoVersao_estado_check" CHECK ("numero" > 0 AND "situacao" IN ('NAO_INFORMADA','INFORMADA'));
ALTER TABLE public."ComposicaoProdutoVersao" ADD CONSTRAINT "ComposicaoProdutoVersao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."PerfilNutricionalProdutoVersao" ADD CONSTRAINT "PerfilNutricionalProdutoVersao_estado_check" CHECK ("numero" > 0 AND "situacao" IN ('NAO_INFORMADA','INFORMADA'));
ALTER TABLE public."PerfilNutricionalProdutoVersao" ADD CONSTRAINT "PerfilNutricionalProdutoVersao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;

-- Uma versão nova é montada apenas na transação de criação. Após o commit,
-- nem mesmo INSERT de item adicional pode mudar seu conteúdo histórico.
CREATE FUNCTION public.proteger_versao_produto_v1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Versões e itens confirmados são imutáveis' USING ERRCODE = '23514';
END $$;
CREATE FUNCTION public.proteger_item_produto_v1() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE criada_nesta_transacao boolean;
BEGIN
 IF TG_OP <> 'INSERT' THEN
   RAISE EXCEPTION 'Itens de versões são imutáveis' USING ERRCODE = '23514';
 END IF;
 IF TG_TABLE_NAME = 'ComposicaoProdutoItem' THEN
  SELECT xmin::text::bigint = (txid_current() % 4294967296) INTO criada_nesta_transacao FROM public."ComposicaoProdutoVersao" WHERE id=NEW."versaoId";
 ELSE
  SELECT xmin::text::bigint = (txid_current() % 4294967296) INTO criada_nesta_transacao FROM public."PerfilNutricionalProdutoVersao" WHERE id=NEW."versaoId";
 END IF;
 IF criada_nesta_transacao IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Não é permitido acrescentar itens a uma versão confirmada' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ComposicaoProdutoVersao_imutavel" BEFORE UPDATE OR DELETE ON public."ComposicaoProdutoVersao" FOR EACH ROW EXECUTE FUNCTION public.proteger_versao_produto_v1();
CREATE TRIGGER "ComposicaoProdutoItem_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON public."ComposicaoProdutoItem" FOR EACH ROW EXECUTE FUNCTION public.proteger_item_produto_v1();
CREATE FUNCTION public."conferir_ComposicaoProdutoVersao_v1"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE versao_id uuid; estado text; referencia_versao text; quantidade bigint; com_valor bigint;
BEGIN
 IF TG_TABLE_NAME = 'ComposicaoProdutoVersao' THEN
  versao_id := NEW.id;
 ELSE
  versao_id := NEW."versaoId";
 END IF;
 SELECT "situacao", "referencia" INTO estado, referencia_versao FROM public."ComposicaoProdutoVersao" WHERE id=versao_id;
 SELECT count(*), count(*) FILTER (WHERE "concentracaoValor" IS NOT NULL) INTO quantidade, com_valor FROM public."ComposicaoProdutoItem" WHERE "versaoId"=versao_id;
 IF (estado='INFORMADA' AND quantidade=0) OR (estado='NAO_INFORMADA' AND quantidade<>0) THEN
  RAISE EXCEPTION 'Situação e itens da versão divergentes' USING ERRCODE='23514';
 END IF;
 IF com_valor > 0 AND coalesce(btrim(referencia_versao),'')='' THEN
  RAISE EXCEPTION 'Valores informados exigem referência' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ComposicaoProdutoVersao_itens_estado" AFTER INSERT ON public."ComposicaoProdutoVersao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public."conferir_ComposicaoProdutoVersao_v1"();
CREATE CONSTRAINT TRIGGER "ComposicaoProdutoItem_itens_estado" AFTER INSERT ON public."ComposicaoProdutoItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public."conferir_ComposicaoProdutoVersao_v1"();
CREATE TRIGGER "PerfilNutricionalProdutoVersao_imutavel" BEFORE UPDATE OR DELETE ON public."PerfilNutricionalProdutoVersao" FOR EACH ROW EXECUTE FUNCTION public.proteger_versao_produto_v1();
CREATE TRIGGER "PerfilNutricionalProdutoItem_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON public."PerfilNutricionalProdutoItem" FOR EACH ROW EXECUTE FUNCTION public.proteger_item_produto_v1();
CREATE FUNCTION public."conferir_PerfilNutricionalProdutoVersao_v1"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE versao_id uuid; estado text; referencia_versao text; quantidade bigint; com_valor bigint;
BEGIN
 IF TG_TABLE_NAME = 'PerfilNutricionalProdutoVersao' THEN
  versao_id := NEW.id;
 ELSE
  versao_id := NEW."versaoId";
 END IF;
 SELECT "situacao", "referencia" INTO estado, referencia_versao FROM public."PerfilNutricionalProdutoVersao" WHERE id=versao_id;
 SELECT count(*), count(*) FILTER (WHERE "valor" IS NOT NULL) INTO quantidade, com_valor FROM public."PerfilNutricionalProdutoItem" WHERE "versaoId"=versao_id;
 IF (estado='INFORMADA' AND quantidade=0) OR (estado='NAO_INFORMADA' AND quantidade<>0) THEN
  RAISE EXCEPTION 'Situação e itens da versão divergentes' USING ERRCODE='23514';
 END IF;
 IF com_valor > 0 AND coalesce(btrim(referencia_versao),'')='' THEN
  RAISE EXCEPTION 'Valores informados exigem referência' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "PerfilNutricionalProdutoVersao_itens_estado" AFTER INSERT ON public."PerfilNutricionalProdutoVersao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public."conferir_PerfilNutricionalProdutoVersao_v1"();
CREATE CONSTRAINT TRIGGER "PerfilNutricionalProdutoItem_itens_estado" AFTER INSERT ON public."PerfilNutricionalProdutoItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public."conferir_PerfilNutricionalProdutoVersao_v1"();

-- Ponteiro avança somente para a nova versão do próprio Produto; versões nunca
-- são reapontadas para trás. Serialização normal do serviço usa a trava Produto.
CREATE FUNCTION public.conferir_ponteiros_produto_v1() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE numero_novo integer; numero_anterior integer; mesma_transacao boolean;
BEGIN
 IF NEW."composicaoVersaoAtualId" IS DISTINCT FROM OLD."composicaoVersaoAtualId" THEN
  SELECT numero, xmin::text::bigint = (txid_current() % 4294967296) INTO numero_novo, mesma_transacao FROM public."ComposicaoProdutoVersao" WHERE id=NEW."composicaoVersaoAtualId" AND "produtoId"=NEW.id;
  SELECT numero INTO numero_anterior FROM public."ComposicaoProdutoVersao" WHERE id=OLD."composicaoVersaoAtualId";
  IF mesma_transacao IS DISTINCT FROM true OR numero_novo <> coalesce(numero_anterior,0)+1 THEN
   RAISE EXCEPTION 'O ponteiro da composição deve avançar para a nova versão' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW."perfilNutricionalVersaoAtualId" IS DISTINCT FROM OLD."perfilNutricionalVersaoAtualId" THEN
  SELECT numero, xmin::text::bigint = (txid_current() % 4294967296) INTO numero_novo, mesma_transacao FROM public."PerfilNutricionalProdutoVersao" WHERE id=NEW."perfilNutricionalVersaoAtualId" AND "produtoId"=NEW.id;
  SELECT numero INTO numero_anterior FROM public."PerfilNutricionalProdutoVersao" WHERE id=OLD."perfilNutricionalVersaoAtualId";
  IF mesma_transacao IS DISTINCT FROM true OR numero_novo <> coalesce(numero_anterior,0)+1 THEN
   RAISE EXCEPTION 'O ponteiro nutricional deve avançar para a nova versão' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Produto_ponteiros_versionados" BEFORE UPDATE OF "composicaoVersaoAtualId", "perfilNutricionalVersaoAtualId" ON public."Produto" FOR EACH ROW EXECUTE FUNCTION public.conferir_ponteiros_produto_v1();
CREATE FUNCTION public.proteger_composicao_snapshot_v1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."composicaoSnapshot" IS DISTINCT FROM OLD."composicaoSnapshot" THEN
  RAISE EXCEPTION 'Composição registrada no atendimento é imutável' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AplicacaoProduto_composicaoSnapshot_imutavel" BEFORE UPDATE OF "composicaoSnapshot" ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION public.proteger_composicao_snapshot_v1();

ALTER TABLE public."OrigemCadastroProduto" ADD CONSTRAINT "OrigemCadastroProduto_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE public."OrigemPrincipioAtivo" ADD CONSTRAINT "OrigemPrincipioAtivo_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES public."Usuario"("id") ON DELETE RESTRICT;
