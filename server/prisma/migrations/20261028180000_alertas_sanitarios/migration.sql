-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "proprietario" TEXT NOT NULL,
    "produtor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chaveOcorrencia" TEXT NOT NULL,
    "revisao" INTEGER NOT NULL,
    "ciclo" TEXT NOT NULL DEFAULT 'ABERTO',
    "situacao" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "origemId" TEXT NOT NULL,
    "sujeitoTipo" TEXT NOT NULL,
    "sujeitoId" TEXT NOT NULL,
    "chaveAgrupamento" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "resumo" JSONB NOT NULL,
    "snapshotInicial" JSONB NOT NULL,
    "dataReferencia" DATE,
    "visivelDesde" DATE,
    "prazo" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAlerta" (
    "id" TEXT NOT NULL,
    "alertaId" TEXT NOT NULL,
    "revisao" INTEGER NOT NULL,
    "eventoId" TEXT NOT NULL,
    "comando" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "autorUsuarioId" INTEGER,
    "autorTecnico" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoAlertas" (
    "id" TEXT NOT NULL,
    "produtor" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'NAO_AVALIADO',
    "diaCoberto" DATE,
    "ultimaConclusao" TIMESTAMP(3),
    "erro" TEXT,
    "cursor" TEXT,
    "posse" TEXT,
    "posseAte" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoAlertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."RegraAlertaSanitario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "produtoId" TEXT,
    "protocoloId" TEXT,
    "gatilho" TEXT NOT NULL,
    "idadeMeses" INTEGER,
    "dataFixa" DATE,
    "propriedadeIds" INTEGER[],
    "sexo" TEXT,
    "antecedenciaDias" INTEGER NOT NULL DEFAULT 0,
    "prazoDias" INTEGER NOT NULL DEFAULT 0,
    "vigencia" DATE NOT NULL,
    "adocao" DATE,
    "orientacao" TEXT,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraAlertaSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."RevisaoRegraAlertaSanitario" (
    "id" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "revisao" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisaoRegraAlertaSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."NecessidadeSanitaria" (
    "id" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "alertaId" TEXT,
    "revisaoRegra" INTEGER NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "propriedadeId" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL,
    "dataTeorica" DATE,
    "dataAtencao" DATE,
    "adocao" DATE NOT NULL,
    "aplicacaoId" TEXT,
    "participacaoId" TEXT,
    "motivo" TEXT,
    "decisaoEm" TIMESTAMP(3),
    "decisaoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NecessidadeSanitaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ProgramacaoSanitaria" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "meses" INTEGER[],
    "ano" INTEGER,
    "vigenciaInicio" DATE,
    "vigenciaFim" DATE,
    "precisao" TEXT NOT NULL DEFAULT 'MES',
    "dia" INTEGER,
    "recorrencia" TEXT NOT NULL,
    "produtoId" TEXT,
    "procedimento" TEXT,
    "publico" JSONB NOT NULL,
    "publicoConferido" BOOLEAN NOT NULL DEFAULT false,
    "fonte" TEXT,
    "observacao" TEXT,
    "executor" TEXT,
    "tipoExameId" TEXT,
    "sujeitoTipo" TEXT NOT NULL DEFAULT 'ANIMAL',
    "antecedenciaDias" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "ativadoEm" DATE,
    "criadoPorId" INTEGER NOT NULL,
    "regraEquivalenteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramacaoSanitaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."NecessidadeProgramacaoSanitaria" (
    "id" TEXT NOT NULL,
    "programacaoId" TEXT NOT NULL,
    "sujeitoTipo" TEXT NOT NULL,
    "sujeitoId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "alertaId" TEXT,
    "situacao" TEXT NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "aplicacaoId" TEXT,
    "exameId" TEXT,
    "regraNecessidadeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NecessidadeProgramacaoSanitaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alerta_produtor_propriedadeId_ciclo_prazo_idx" ON "Alerta"("produtor", "propriedadeId", "ciclo", "prazo");

-- CreateIndex
CREATE INDEX "Alerta_sujeitoTipo_sujeitoId_idx" ON "Alerta"("sujeitoTipo", "sujeitoId");

-- CreateIndex
CREATE INDEX "Alerta_chaveAgrupamento_idx" ON "Alerta"("chaveAgrupamento");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_proprietario_produtor_tipo_chaveOcorrencia_key" ON "Alerta"("proprietario", "produtor", "tipo", "chaveOcorrencia");

-- CreateIndex
CREATE UNIQUE INDEX "EventoAlerta_alertaId_revisao_key" ON "EventoAlerta"("alertaId", "revisao");

-- CreateIndex
CREATE UNIQUE INDEX "EventoAlerta_alertaId_eventoId_key" ON "EventoAlerta"("alertaId", "eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisaoRegraAlertaSanitario_regraId_revisao_key" ON "pecuaria"."RevisaoRegraAlertaSanitario"("regraId", "revisao");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeSanitaria_alertaId_key" ON "pecuaria"."NecessidadeSanitaria"("alertaId");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeSanitaria_aplicacaoId_key" ON "pecuaria"."NecessidadeSanitaria"("aplicacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeSanitaria_participacaoId_key" ON "pecuaria"."NecessidadeSanitaria"("participacaoId");

-- CreateIndex
CREATE INDEX "NecessidadeSanitaria_animalId_idx" ON "pecuaria"."NecessidadeSanitaria"("animalId");

-- CreateIndex
CREATE INDEX "NecessidadeSanitaria_propriedadeId_situacao_idx" ON "pecuaria"."NecessidadeSanitaria"("propriedadeId", "situacao");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeSanitaria_regraId_animalId_key" ON "pecuaria"."NecessidadeSanitaria"("regraId", "animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramacaoSanitaria_regraEquivalenteId_key" ON "pecuaria"."ProgramacaoSanitaria"("regraEquivalenteId");

-- CreateIndex
CREATE INDEX "ProgramacaoSanitaria_propriedadeId_ativo_idx" ON "pecuaria"."ProgramacaoSanitaria"("propriedadeId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_alertaId_key" ON "pecuaria"."NecessidadeProgramacaoSanitaria"("alertaId");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_aplicacaoId_key" ON "pecuaria"."NecessidadeProgramacaoSanitaria"("aplicacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_exameId_key" ON "pecuaria"."NecessidadeProgramacaoSanitaria"("exameId");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_regraNecessidadeId_key" ON "pecuaria"."NecessidadeProgramacaoSanitaria"("regraNecessidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_programacaoId_periodo_sujei_key" ON "pecuaria"."NecessidadeProgramacaoSanitaria"("programacaoId", "periodo", "sujeitoTipo", "sujeitoId");

-- AddForeignKey
ALTER TABLE "EventoAlerta" ADD CONSTRAINT "EventoAlerta_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."RevisaoRegraAlertaSanitario" ADD CONSTRAINT "RevisaoRegraAlertaSanitario_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "pecuaria"."RegraAlertaSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."NecessidadeSanitaria" ADD CONSTRAINT "NecessidadeSanitaria_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "pecuaria"."RegraAlertaSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."NecessidadeSanitaria" ADD CONSTRAINT "NecessidadeSanitaria_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."NecessidadeProgramacaoSanitaria" ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "pecuaria"."ProgramacaoSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Relações concretas do produtor. Referências polimórficas do núcleo são validadas pelo registro.
ALTER TABLE "public"."Alerta" ADD CONSTRAINT "Alerta_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."EventoAlerta" ADD CONSTRAINT "EventoAlerta_autor_fk" FOREIGN KEY ("autorUsuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."Alerta" ADD CONSTRAINT "Alerta_revisao_check" CHECK ("revisao" > 0), ADD CONSTRAINT "Alerta_ciclo_check" CHECK ("ciclo" IN ('ABERTO','ENCERRADO','INVALIDADO'));
ALTER TABLE "public"."EventoAlerta" ADD CONSTRAINT "EventoAlerta_autoria_check" CHECK (("autorUsuarioId" IS NOT NULL)::int + ("autorTecnico" IS NOT NULL)::int = 1), ADD CONSTRAINT "EventoAlerta_revisao_check" CHECK ("revisao" > 0);
ALTER TABLE "pecuaria"."RegraAlertaSanitario"
 ADD CONSTRAINT "RegraAlertaSanitario_produto_fk" FOREIGN KEY ("produtoId") REFERENCES "public"."Produto"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "RegraAlertaSanitario_protocolo_fk" FOREIGN KEY ("protocoloId") REFERENCES "pecuaria"."Protocolo"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "RegraAlertaSanitario_autor_fk" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "RegraAlertaSanitario_destino_check" CHECK (("produtoId" IS NOT NULL)::int + ("protocoloId" IS NOT NULL)::int = 1),
 ADD CONSTRAINT "RegraAlertaSanitario_gatilho_check" CHECK (("gatilho" = 'IDADE' AND "idadeMeses" > 0 AND "dataFixa" IS NULL) OR ("gatilho" = 'DATA_FIXA' AND "dataFixa" IS NOT NULL AND "idadeMeses" IS NULL)),
 ADD CONSTRAINT "RegraAlertaSanitario_prazos_check" CHECK ("antecedenciaDias" >= 0 AND "prazoDias" >= 0 AND cardinality("propriedadeIds") > 0 AND "revisao" > 0),
 ADD CONSTRAINT "RegraAlertaSanitario_sexo_check" CHECK ("sexo" IS NULL OR "sexo" IN ('F','M'));
ALTER TABLE "pecuaria"."RevisaoRegraAlertaSanitario" ADD CONSTRAINT "RevisaoRegraAlertaSanitario_autor_fk" FOREIGN KEY ("autorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT;
ALTER TABLE "pecuaria"."NecessidadeSanitaria"
 ADD CONSTRAINT "NecessidadeSanitaria_animal_fk" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeSanitaria_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeSanitaria_aplicacao_fk" FOREIGN KEY ("aplicacaoId") REFERENCES "pecuaria"."AplicacaoProduto"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeSanitaria_participacao_fk" FOREIGN KEY ("participacaoId") REFERENCES "pecuaria"."ParticipacaoProtocolo"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeSanitaria_revisao_check" CHECK ("revisao" > 0 AND "revisaoRegra" > 0);
ALTER TABLE "pecuaria"."ProgramacaoSanitaria"
 ADD CONSTRAINT "ProgramacaoSanitaria_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "ProgramacaoSanitaria_produto_fk" FOREIGN KEY ("produtoId") REFERENCES "public"."Produto"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "ProgramacaoSanitaria_regra_fk" FOREIGN KEY ("regraEquivalenteId") REFERENCES "pecuaria"."RegraAlertaSanitario"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "ProgramacaoSanitaria_autor_fk" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "ProgramacaoSanitaria_tipo_exame_fk" FOREIGN KEY ("tipoExameId") REFERENCES "pecuaria"."TipoExame"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "ProgramacaoSanitaria_meses_check" CHECK (cardinality("meses") > 0 AND "meses" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]),
 ADD CONSTRAINT "ProgramacaoSanitaria_precisao_check" CHECK (("precisao" = 'MES' AND "dia" IS NULL) OR ("precisao" = 'DIA' AND "dia" BETWEEN 1 AND 31)),
 ADD CONSTRAINT "ProgramacaoSanitaria_recorrencia_check" CHECK ("recorrencia" IN ('JANELA_ELEGIBILIDADE','CAMPANHA_ANUAL','SEM_REPETICAO'));
ALTER TABLE "pecuaria"."NecessidadeProgramacaoSanitaria"
 ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_alerta_fk" FOREIGN KEY ("alertaId") REFERENCES "public"."Alerta"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_regra_fk" FOREIGN KEY ("regraNecessidadeId") REFERENCES "pecuaria"."NecessidadeSanitaria"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_aplicacao_fk" FOREIGN KEY ("aplicacaoId") REFERENCES "pecuaria"."AplicacaoProduto"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_exame_fk" FOREIGN KEY ("exameId") REFERENCES "pecuaria"."ExameAnimal"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT;

ALTER TABLE "pecuaria"."RegraAlertaSanitario" ADD COLUMN "tipoAplicacaoId" TEXT, ADD COLUMN "cuidado" TEXT;
ALTER TABLE "pecuaria"."RegraAlertaSanitario" ADD CONSTRAINT "RegraAlertaSanitario_tipo_aplicacao_fk" FOREIGN KEY ("tipoAplicacaoId") REFERENCES "pecuaria"."TipoAplicacaoSanitaria"("id") ON DELETE RESTRICT;

CREATE TABLE "pecuaria"."VinculoAtendimentoAlerta" (
 "id" TEXT NOT NULL, "aplicacaoId" TEXT, "exameId" TEXT,
 "necessidadeRegraId" TEXT, "necessidadeProgramaId" TEXT,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER NOT NULL,
 CONSTRAINT "VinculoAtendimentoAlerta_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "VinculoAtendimentoAlerta_fato_check" CHECK (("aplicacaoId" IS NOT NULL)::int + ("exameId" IS NOT NULL)::int=1),
 CONSTRAINT "VinculoAtendimentoAlerta_necessidade_check" CHECK (("necessidadeRegraId" IS NOT NULL)::int + ("necessidadeProgramaId" IS NOT NULL)::int=1),
 CONSTRAINT "VinculoAtendimentoAlerta_aplicacao_fk" FOREIGN KEY ("aplicacaoId") REFERENCES "pecuaria"."AplicacaoProduto"("id") ON DELETE RESTRICT,
 CONSTRAINT "VinculoAtendimentoAlerta_exame_fk" FOREIGN KEY ("exameId") REFERENCES "pecuaria"."ExameAnimal"("id") ON DELETE RESTRICT,
 CONSTRAINT "VinculoAtendimentoAlerta_regra_fk" FOREIGN KEY ("necessidadeRegraId") REFERENCES "pecuaria"."NecessidadeSanitaria"("id") ON DELETE RESTRICT,
 CONSTRAINT "VinculoAtendimentoAlerta_programa_fk" FOREIGN KEY ("necessidadeProgramaId") REFERENCES "pecuaria"."NecessidadeProgramacaoSanitaria"("id") ON DELETE RESTRICT,
 CONSTRAINT "VinculoAtendimentoAlerta_autor_fk" FOREIGN KEY ("criadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_aplicacaoId_key" ON "pecuaria"."VinculoAtendimentoAlerta"("aplicacaoId");
CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_exameId_key" ON "pecuaria"."VinculoAtendimentoAlerta"("exameId");
CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_necessidadeRegraId_key" ON "pecuaria"."VinculoAtendimentoAlerta"("necessidadeRegraId");
CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_necessidadeProgramaId_key" ON "pecuaria"."VinculoAtendimentoAlerta"("necessidadeProgramaId");

ALTER TABLE "pecuaria"."RegraAlertaSanitario" ADD COLUMN "baseAtivacao" TEXT;
