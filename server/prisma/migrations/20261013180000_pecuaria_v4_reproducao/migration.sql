-- AlterEnum
ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'REPRODUCAO';

-- AlterTable
ALTER TABLE "pecuaria"."Animal" ADD COLUMN     "codigoProvisorio" VARCHAR(39),
ADD COLUMN     "identificacaoProvisoria" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pecuaria"."SituacaoInicialReprodutiva" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "data" DATE NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "situacao" TEXT NOT NULL,
    "aptaDesde" DATE,
    "observacao" TEXT,

    CONSTRAINT "SituacaoInicialReprodutiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."RestricaoReprodutiva" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "data" DATE NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "acoes" TEXT[],
    "ate" DATE,
    "motivoEncerramento" TEXT,

    CONSTRAINT "RestricaoReprodutiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."RegraSanitariaReprodutiva" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "doencaId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "efeito" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraSanitariaReprodutiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."TentativaReprodutiva" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "data" DATE NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "tipo" TEXT NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "materialId" TEXT,
    "touroId" TEXT,
    "touroExternoId" TEXT,
    "origemMaterial" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3),
    "partidaId" TEXT,
    "operacaoServicoId" TEXT,
    "movimentoEstoqueId" TEXT,
    "valorProdutoAtribuido" DECIMAL(14,2),
    "valorServicoAtribuido" DECIMAL(14,2),
    "geneticaSnapshot" JSONB NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,

    CONSTRAINT "TentativaReprodutiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."GestacaoAnimal" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "tentativaId" TEXT,
    "inicio" DATE,
    "confirmadaEm" DATE NOT NULL,
    "previsaoParto" DATE,
    "sexoFetal" "pecuaria"."SexoBovino",
    "encerradaEm" DATE,
    "motivoEncerramento" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "GestacaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AvaliacaoReprodutiva" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "data" DATE NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "resultado" TEXT NOT NULL,
    "tentativaId" TEXT,
    "gestacaoId" TEXT,
    "sexoFetal" "pecuaria"."SexoBovino",
    "conduta" TEXT,
    "motivo" TEXT,
    "anotacaoOriginal" TEXT,
    "retornoEm" DATE,
    "observacao" TEXT,

    CONSTRAINT "AvaliacaoReprodutiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."PartoAnimal" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "data" DATE NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "gestacaoId" TEXT,
    "tipo" TEXT NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,

    CONSTRAINT "PartoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."CriaParto" (
    "id" TEXT NOT NULL,
    "partoId" TEXT NOT NULL,
    "animalId" TEXT,
    "viva" BOOLEAN NOT NULL,
    "sexo" "pecuaria"."SexoBovino" NOT NULL,
    "aptidao" "pecuaria"."AptidaoAnimal",
    "ordem" INTEGER NOT NULL,
    "filiacaoSnapshot" JSONB NOT NULL,

    CONSTRAINT "CriaParto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."LactacaoAnimal" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "partoId" TEXT,
    "inicio" DATE NOT NULL,
    "encerradaEm" DATE,
    "motivoEncerramento" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "LactacaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ExposicaoTouro" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "propriedadeId" INTEGER NOT NULL,
    "loteId" TEXT NOT NULL,
    "touroId" TEXT,
    "touroExternoId" TEXT,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ExposicaoTouro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipacaoExposicao" (
    "id" TEXT NOT NULL,
    "exposicaoId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,

    CONSTRAINT "ParticipacaoExposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ProtocoloIatf" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "etapas" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ProtocoloIatf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ProgramacaoIatf" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "propriedadeId" INTEGER NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "inicioPrevisto" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ProgramacaoIatf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipanteIatf" (
    "id" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "programacaoId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "inicioPrevisto" TIMESTAMP(3) NOT NULL,
    "inicioEfetivo" TIMESTAMP(3),
    "encerradoEm" TIMESTAMP(3),
    "motivoEncerramento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ParticipanteIatf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."TarefaIatf" (
    "id" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "etapa" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "previstaEm" TIMESTAMP(3) NOT NULL,
    "previsaoOriginal" TIMESTAMP(3) NOT NULL,
    "realizadaEm" TIMESTAMP(3),
    "dispensadaEm" TIMESTAMP(3),
    "motivo" TEXT,
    "aplicacaoId" TEXT,
    "tentativaId" TEXT,
    "avaliacaoId" TEXT,
    "historicoReprogramacao" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "TarefaIatf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."VisitaVeterinaria" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "responsavel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "encerradaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "VisitaVeterinaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AtividadeVisita" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "extra" BOOLEAN NOT NULL DEFAULT false,
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtividadeVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipanteVisita" (
    "id" TEXT NOT NULL,
    "atividadeId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tarefaSanitariaId" TEXT,
    "tarefaIatfId" TEXT,
    "rascunho" JSONB NOT NULL DEFAULT '{}',
    "fatoTipo" TEXT,
    "fatoId" TEXT,
    "motivo" TEXT,
    "snapshot" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipanteVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ImpressaoVisita" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ImpressaoVisita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SituacaoInicialReprodutiva_referenciaExterna_key" ON "pecuaria"."SituacaoInicialReprodutiva"("referenciaExterna");

-- CreateIndex
CREATE INDEX "SituacaoInicialReprodutiva_animalId_idx" ON "pecuaria"."SituacaoInicialReprodutiva"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "RestricaoReprodutiva_referenciaExterna_key" ON "pecuaria"."RestricaoReprodutiva"("referenciaExterna");

-- CreateIndex
CREATE INDEX "RestricaoReprodutiva_animalId_idx" ON "pecuaria"."RestricaoReprodutiva"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "RegraSanitariaReprodutiva_propriedadeId_doencaId_acao_key" ON "pecuaria"."RegraSanitariaReprodutiva"("propriedadeId", "doencaId", "acao");

-- CreateIndex
CREATE UNIQUE INDEX "TentativaReprodutiva_referenciaExterna_key" ON "pecuaria"."TentativaReprodutiva"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "TentativaReprodutiva_movimentoEstoqueId_key" ON "pecuaria"."TentativaReprodutiva"("movimentoEstoqueId");

-- CreateIndex
CREATE INDEX "TentativaReprodutiva_animalId_idx" ON "pecuaria"."TentativaReprodutiva"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "GestacaoAnimal_referenciaExterna_key" ON "pecuaria"."GestacaoAnimal"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "GestacaoAnimal_tentativaId_key" ON "pecuaria"."GestacaoAnimal"("tentativaId");

-- CreateIndex
CREATE INDEX "GestacaoAnimal_animalId_idx" ON "pecuaria"."GestacaoAnimal"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoReprodutiva_referenciaExterna_key" ON "pecuaria"."AvaliacaoReprodutiva"("referenciaExterna");

-- CreateIndex
CREATE INDEX "AvaliacaoReprodutiva_animalId_idx" ON "pecuaria"."AvaliacaoReprodutiva"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "PartoAnimal_referenciaExterna_key" ON "pecuaria"."PartoAnimal"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "PartoAnimal_gestacaoId_key" ON "pecuaria"."PartoAnimal"("gestacaoId");

-- CreateIndex
CREATE INDEX "PartoAnimal_animalId_idx" ON "pecuaria"."PartoAnimal"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "CriaParto_animalId_key" ON "pecuaria"."CriaParto"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "CriaParto_partoId_ordem_key" ON "pecuaria"."CriaParto"("partoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "LactacaoAnimal_referenciaExterna_key" ON "pecuaria"."LactacaoAnimal"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "LactacaoAnimal_partoId_key" ON "pecuaria"."LactacaoAnimal"("partoId");

-- CreateIndex
CREATE INDEX "LactacaoAnimal_animalId_idx" ON "pecuaria"."LactacaoAnimal"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExposicaoTouro_referenciaExterna_key" ON "pecuaria"."ExposicaoTouro"("referenciaExterna");

-- CreateIndex
CREATE INDEX "ParticipacaoExposicao_animalId_idx" ON "pecuaria"."ParticipacaoExposicao"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipacaoExposicao_exposicaoId_animalId_inicio_key" ON "pecuaria"."ParticipacaoExposicao"("exposicaoId", "animalId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocoloIatf_nome_versao_key" ON "pecuaria"."ProtocoloIatf"("nome", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramacaoIatf_referenciaExterna_key" ON "pecuaria"."ProgramacaoIatf"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteIatf_referenciaExterna_key" ON "pecuaria"."ParticipanteIatf"("referenciaExterna");

-- CreateIndex
CREATE INDEX "ParticipanteIatf_animalId_idx" ON "pecuaria"."ParticipanteIatf"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "TarefaIatf_aplicacaoId_key" ON "pecuaria"."TarefaIatf"("aplicacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "TarefaIatf_tentativaId_key" ON "pecuaria"."TarefaIatf"("tentativaId");

-- CreateIndex
CREATE UNIQUE INDEX "TarefaIatf_avaliacaoId_key" ON "pecuaria"."TarefaIatf"("avaliacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "TarefaIatf_participanteId_etapa_key" ON "pecuaria"."TarefaIatf"("participanteId", "etapa");

-- CreateIndex
CREATE UNIQUE INDEX "AtividadeVisita_visitaId_ordem_key" ON "pecuaria"."AtividadeVisita"("visitaId", "ordem");

-- CreateIndex
CREATE INDEX "ParticipanteVisita_animalId_idx" ON "pecuaria"."ParticipanteVisita"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteVisita_atividadeId_animalId_key" ON "pecuaria"."ParticipanteVisita"("atividadeId", "animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteVisita_atividadeId_ordem_key" ON "pecuaria"."ParticipanteVisita"("atividadeId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "ImpressaoVisita_visitaId_versao_key" ON "pecuaria"."ImpressaoVisita"("visitaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_codigoProvisorio_key" ON "pecuaria"."Animal"("codigoProvisorio");


-- Integridade dos fatos V4: histórico preservado e nenhuma exclusão em cascata.
ALTER TABLE "pecuaria"."SituacaoInicialReprodutiva" ADD CONSTRAINT "SituacaoInicialReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."SituacaoInicialReprodutiva" ADD CONSTRAINT "SituacaoInicialReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."SituacaoInicialReprodutiva" ADD CONSTRAINT "SituacaoInicialReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."RestricaoReprodutiva" ADD CONSTRAINT "RestricaoReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."RestricaoReprodutiva" ADD CONSTRAINT "RestricaoReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."RestricaoReprodutiva" ADD CONSTRAINT "RestricaoReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."RegraSanitariaReprodutiva" ADD CONSTRAINT "RegraSanitariaReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."RegraSanitariaReprodutiva" ADD CONSTRAINT "RegraSanitariaReprodutiva_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES "pecuaria"."Doenca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."RegraSanitariaReprodutiva" ADD CONSTRAINT "RegraSanitariaReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "pecuaria"."MaterialGenetico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "public"."PartidaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES "public"."Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "TentativaReprodutiva_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "public"."MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."GestacaoAnimal" ADD CONSTRAINT "GestacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."GestacaoAnimal" ADD CONSTRAINT "GestacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."GestacaoAnimal" ADD CONSTRAINT "GestacaoAnimal_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "pecuaria"."TentativaReprodutiva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."GestacaoAnimal" ADD CONSTRAINT "GestacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD CONSTRAINT "AvaliacaoReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD CONSTRAINT "AvaliacaoReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD CONSTRAINT "AvaliacaoReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD CONSTRAINT "AvaliacaoReprodutiva_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "pecuaria"."TentativaReprodutiva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."AvaliacaoReprodutiva" ADD CONSTRAINT "AvaliacaoReprodutiva_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES "pecuaria"."GestacaoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."PartoAnimal" ADD CONSTRAINT "PartoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."PartoAnimal" ADD CONSTRAINT "PartoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."PartoAnimal" ADD CONSTRAINT "PartoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."PartoAnimal" ADD CONSTRAINT "PartoAnimal_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES "pecuaria"."GestacaoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."CriaParto" ADD CONSTRAINT "CriaParto_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES "pecuaria"."PartoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."CriaParto" ADD CONSTRAINT "CriaParto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES "pecuaria"."PartoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "ExposicaoTouro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "ExposicaoTouro_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "ExposicaoTouro_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "ExposicaoTouro_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "ExposicaoTouro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipacaoExposicao" ADD CONSTRAINT "ParticipacaoExposicao_exposicaoId_fkey" FOREIGN KEY ("exposicaoId") REFERENCES "pecuaria"."ExposicaoTouro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipacaoExposicao" ADD CONSTRAINT "ParticipacaoExposicao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ProtocoloIatf" ADD CONSTRAINT "ProtocoloIatf_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ProgramacaoIatf" ADD CONSTRAINT "ProgramacaoIatf_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ProgramacaoIatf" ADD CONSTRAINT "ProgramacaoIatf_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "pecuaria"."ProtocoloIatf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ProgramacaoIatf" ADD CONSTRAINT "ProgramacaoIatf_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteIatf" ADD CONSTRAINT "ParticipanteIatf_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "pecuaria"."ProgramacaoIatf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteIatf" ADD CONSTRAINT "ParticipanteIatf_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteIatf" ADD CONSTRAINT "ParticipanteIatf_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TarefaIatf" ADD CONSTRAINT "TarefaIatf_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "pecuaria"."ParticipanteIatf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TarefaIatf" ADD CONSTRAINT "TarefaIatf_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "pecuaria"."AplicacaoProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TarefaIatf" ADD CONSTRAINT "TarefaIatf_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "pecuaria"."TentativaReprodutiva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."TarefaIatf" ADD CONSTRAINT "TarefaIatf_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "pecuaria"."AvaliacaoReprodutiva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."VisitaVeterinaria" ADD CONSTRAINT "VisitaVeterinaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."VisitaVeterinaria" ADD CONSTRAINT "VisitaVeterinaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."AtividadeVisita" ADD CONSTRAINT "AtividadeVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "pecuaria"."VisitaVeterinaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteVisita" ADD CONSTRAINT "ParticipanteVisita_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "pecuaria"."AtividadeVisita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteVisita" ADD CONSTRAINT "ParticipanteVisita_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteVisita" ADD CONSTRAINT "ParticipanteVisita_tarefaSanitariaId_fkey" FOREIGN KEY ("tarefaSanitariaId") REFERENCES "pecuaria"."TarefaSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ParticipanteVisita" ADD CONSTRAINT "ParticipanteVisita_tarefaIatfId_fkey" FOREIGN KEY ("tarefaIatfId") REFERENCES "pecuaria"."TarefaIatf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ImpressaoVisita" ADD CONSTRAINT "ImpressaoVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "pecuaria"."VisitaVeterinaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pecuaria"."ImpressaoVisita" ADD CONSTRAINT "ImpressaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GestacaoAnimal_uma_aberta" ON "pecuaria"."GestacaoAnimal" ("animalId") WHERE "encerradaEm" IS NULL AND "status" = 'VALIDO';
CREATE UNIQUE INDEX "LactacaoAnimal_uma_aberta" ON "pecuaria"."LactacaoAnimal" ("animalId") WHERE "encerradaEm" IS NULL;
CREATE UNIQUE INDEX "ParticipanteIatf_uma_aberta" ON "pecuaria"."ParticipanteIatf" ("programacaoId", "animalId") WHERE "encerradoEm" IS NULL;
CREATE UNIQUE INDEX "TentativaReprodutiva_ordem_ciclo" ON "pecuaria"."TentativaReprodutiva" ("animalId", "ciclo", "ordem");
ALTER TABLE "pecuaria"."CriaParto" ADD CONSTRAINT "CriaParto_viva_animal" CHECK (NOT "viva" OR "animalId" IS NOT NULL);
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_provisorio" CHECK (NOT "identificacaoProvisoria" OR "codigoProvisorio" IS NOT NULL);
ALTER TABLE "pecuaria"."TentativaReprodutiva" ADD CONSTRAINT "Tentativa_tipo_origem" CHECK ("tipo" IN ('IA','TE','COBERTURA') AND "origemMaterial" IN ('ESTOQUE','SERVICO','DOCUMENTADA','HISTORICO') AND "ciclo">=0 AND "ordem">0 AND ("quantidade" IS NULL OR "quantidade">0) AND ("origemMaterial"<>'HISTORICO' OR "movimentoEstoqueId" IS NULL));
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "Exposicao_touro" CHECK (("touroId" IS NULL) <> ("touroExternoId" IS NULL));
ALTER TABLE "pecuaria"."PartoAnimal" ADD CONSTRAINT "Parto_tipo" CHECK ("tipo" IN ('NORMAL','DISTOCICO','ABORTO','NATIMORTO'));
ALTER TABLE "pecuaria"."RegraSanitariaReprodutiva" ADD CONSTRAINT "Regra_efeito" CHECK ("efeito" IN ('BLOQUEAR','ALERTAR') AND "acao" IN ('IA','TE','COBERTURA','IATF'));
ALTER TABLE "pecuaria"."LactacaoAnimal" ADD CONSTRAINT "LactacaoAnimal_intervalo" CHECK ("encerradaEm" IS NULL OR "encerradaEm">="inicio");
ALTER TABLE "pecuaria"."GestacaoAnimal" ADD CONSTRAINT "GestacaoAnimal_intervalo" CHECK ("encerradaEm" IS NULL OR "encerradaEm">="confirmadaEm");
ALTER TABLE "pecuaria"."ExposicaoTouro" ADD CONSTRAINT "ExposicaoTouro_intervalo" CHECK ("fim" IS NULL OR "fim">="inicio");
ALTER TABLE "pecuaria"."ParticipacaoExposicao" ADD CONSTRAINT "ParticipacaoExposicao_intervalo" CHECK ("fim" IS NULL OR "fim">="inicio");
ALTER TABLE "pecuaria"."RestricaoReprodutiva" ADD CONSTRAINT "RestricaoReprodutiva_intervalo" CHECK ("ate" IS NULL OR "ate">="data");

ALTER TABLE "pecuaria"."PartoAnimal" ADD COLUMN "incluidoSaldoAnterior" BOOLEAN NOT NULL DEFAULT false;
