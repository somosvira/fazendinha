-- CreateEnum
CREATE TYPE "EstadoTalhao" AS ENUM ('ATIVO', 'RECEPADO', 'FORMACAO', 'BAIXADO');

-- CreateEnum
CREATE TYPE "FaseFenologica" AS ENUM ('REPOUSO', 'INDUCAO_FLORAL', 'FLORADA', 'CHUMBINHO', 'EXPANSAO', 'GRANACAO', 'MATURACAO_VERDE', 'MATURACAO_CEREJA', 'COLHEITA', 'POS_COLHEITA');

-- CreateEnum
CREATE TYPE "DominioCultural" AS ENUM ('FENOLOGIA', 'FITOSSANIDADE', 'NUTRICAO', 'COLHEITA');

-- CreateEnum
CREATE TYPE "TipoOperacao" AS ENUM ('ADUBACAO_SOLO', 'ADUBACAO_FOLIAR', 'CALAGEM', 'GESSAGEM', 'APLICACAO_FUNGICIDA', 'APLICACAO_INSETICIDA', 'APLICACAO_HERBICIDA', 'ROCAGEM_MECANICA', 'CAPINA_MANUAL', 'PODA_RECEPA', 'PODA_DECOTE', 'PODA_ESQUELETAMENTO', 'PODA_DESPONTE', 'DESBROTA', 'IRRIGACAO', 'REPLANTIO', 'AMOSTRAGEM_SOLO', 'AMOSTRAGEM_FOLIAR', 'MONITORAMENTO_MIP');

-- CreateEnum
CREATE TYPE "PragaDoenca" AS ENUM ('FERRUGEM', 'CERCOSPORIOSE', 'BICHO_MINEIRO', 'BROCA_DO_CAFE', 'ACARO_VERMELHO', 'NEMATOIDES', 'ANTRACNOSE', 'MANCHA_AUREOLADA', 'FUMAGINA', 'ROSELINIA', 'COCHONILHAS', 'OUTRA');

-- CreateEnum
CREATE TYPE "MetodoColheita" AS ENUM ('DERRICA_PANO', 'DERRICA_MECANIZADA', 'SELETIVA', 'VARRICAO');

-- CreateEnum
CREATE TYPE "Bienalidade" AS ENUM ('POSITIVA', 'NEGATIVA');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoApontamento" AS ENUM ('MAQUINA', 'HOMEM');

-- CreateEnum
CREATE TYPE "CategoriaLote" AS ENUM ('VACA_MATRIZ', 'TOURO', 'BEZERRO_MAMA', 'BEZERRA_MAMA', 'BEZERRO_DESMAMA', 'BEZERRA_DESMAMA', 'GAROTE', 'NOVILHA', 'NOVILHO', 'BOI_GORDO', 'VACA_DESCARTE');

-- CreateEnum
CREATE TYPE "FaseCiclo" AS ENUM ('CRIA', 'RECRIA', 'TERMINACAO', 'REPRODUCAO');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('ATIVO', 'VENDIDO', 'EXTINTO');

-- CreateEnum
CREATE TYPE "EstadoPiquete" AS ENUM ('DISPONIVEL', 'OCUPADO', 'DESCANSO', 'REFORMA');

-- CreateEnum
CREATE TYPE "TipoSanitario" AS ENUM ('VACINA_AFTOSA', 'VACINA_BRUCELOSE_B19', 'VACINA_CLOSTRIDIOSE', 'VACINA_RAIVA', 'VACINA_CARBUNCULO', 'VACINA_LEPTOSPIROSE', 'VACINA_IBR_BVD', 'VERMIFUGACAO_5811', 'VERMIFUGACAO_ESTRATEGICA', 'CONTROLE_CARRAPATO', 'CONTROLE_MOSCA', 'CONTROLE_BERNE', 'MARCACAO', 'DESCORNA', 'CASTRACAO', 'BRINCO_ELETRONICO');

-- CreateEnum
CREATE TYPE "TipoSuplemento" AS ENUM ('MINERAL', 'PROTEICO_SECA', 'ENERGETICO_AGUAS', 'RACAO_CONFINAMENTO', 'SAL_BRANCO');

-- CreateEnum
CREATE TYPE "TipoComercial" AS ENUM ('VENDA_ABATE', 'VENDA_REPRODUCAO', 'DESCARTE', 'COMPRA', 'TRANSFERENCIA_ATIVIDADE');

-- CreateEnum
CREATE TYPE "MetodoPesagem" AS ENUM ('BALANCA_INDIVIDUAL', 'BALANCA_LOTE', 'FITA_TORACICA', 'VISUAL_ESTIMADO');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StatusRascunho" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "VariedadeCafe" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "resistenteFerrugem" BOOLEAN NOT NULL DEFAULT false,
    "porte" TEXT,
    "cicloDias" INTEGER,
    "observacao" TEXT,

    CONSTRAINT "VariedadeCafe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lavoura" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "observacao" TEXT,
    "planoAdubacaoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lavoura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoAdubacao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nKgHa" DECIMAL(7,2),
    "p2o5KgHa" DECIMAL(7,2),
    "k2oKgHa" DECIMAL(7,2),
    "parcelas" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoAdubacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talhao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT,
    "variedadeId" INTEGER NOT NULL,
    "lavouraId" INTEGER,
    "espacamento" TEXT,
    "plantasHa" INTEGER NOT NULL,
    "areaHa" DECIMAL(7,2) NOT NULL,
    "anoPlantio" INTEGER NOT NULL,
    "altitude" INTEGER,
    "exposicao" TEXT,
    "declive" DECIMAL(4,1),
    "irrigado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoTalhao" NOT NULL DEFAULT 'ATIVO',
    "dataPlantio" DATE NOT NULL,
    "ultimaRecepa" DATE,
    "dataBaixa" DATE,
    "motivoBaixa" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoTalhao" (
    "talhaoId" INTEGER NOT NULL,
    "fase" "FaseFenologica" NOT NULL DEFAULT 'REPOUSO',
    "diasNaFase" INTEGER,
    "proximaOperacao" TEXT,
    "proximaOperacaoEm" DATE,
    "produtividadeEsperada" DECIMAL(6,2),
    "produtividadeUltima" DECIMAL(6,2),
    "bienalidade" "Bienalidade",
    "maturacaoCereja" DECIMAL(5,2),
    "maturacaoVerde" DECIMAL(5,2),
    "maturacaoBoia" DECIMAL(5,2),
    "ferrugem" DECIMAL(5,2),
    "bichoMineiro" DECIMAL(5,2),
    "broca" DECIMAL(5,2),
    "cercosporiose" DECIMAL(5,2),
    "tendFerrugem" TEXT,
    "ultimaInspecaoData" DATE,
    "ultimaAnaliseSolo" DATE,
    "pH" DECIMAL(3,1),
    "v" DECIMAL(4,1),
    "mo" DECIMAL(4,1),
    "fosforo" DECIMAL(6,2),
    "potassio" DECIMAL(6,2),
    "ultimaAnaliseFoliar" DATE,
    "nFoliar" DECIMAL(4,2),
    "kFoliar" DECIMAL(4,2),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumoTalhao_pkey" PRIMARY KEY ("talhaoId")
);

-- CreateTable
CREATE TABLE "SafraTalhao" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "sacasTotal" DECIMAL(9,2),
    "sacasPorHa" DECIMAL(6,2),
    "pctCereja" DECIMAL(5,2),
    "pctBoia" DECIMAL(5,2),
    "bienalidade" "Bienalidade",
    "fechada" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,

    CONSTRAINT "SafraTalhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacaoAgricola" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "dominio" "DominioCultural" NOT NULL,
    "tipo" "TipoOperacao" NOT NULL,
    "data" DATE NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,
    "produto" TEXT,
    "doseValor" DECIMAL(10,3),
    "doseUnidade" TEXT,
    "volumeCaldaLha" DECIMAL(7,2),
    "nKgHa" DECIMAL(7,2),
    "p2o5KgHa" DECIMAL(7,2),
    "k2oKgHa" DECIMAL(7,2),
    "pragaAlvo" "PragaDoenca",
    "carenciaDias" INTEGER,
    "lancamentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperacaoAgricola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspecaoMIP" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "responsavel" TEXT,
    "ferrugem" DECIMAL(5,2),
    "bichoMineiro" DECIMAL(5,2),
    "broca" DECIMAL(5,2),
    "cercosporiose" DECIMAL(5,2),
    "acaroVermelho" DECIMAL(5,2),
    "antracnose" DECIMAL(5,2),
    "nFolhasAvaliadas" INTEGER,
    "nFrutosAvaliados" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspecaoMIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmostraSolo" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "laboratorio" TEXT,
    "profundidade" TEXT,
    "pH" DECIMAL(3,1),
    "v" DECIMAL(4,1),
    "mo" DECIMAL(4,1),
    "fosforo" DECIMAL(6,2),
    "potassio" DECIMAL(6,2),
    "calcio" DECIMAL(5,2),
    "magnesio" DECIMAL(5,2),
    "aluminio" DECIMAL(5,2),
    "ctc" DECIMAL(5,2),
    "zinco" DECIMAL(5,2),
    "boro" DECIMAL(5,2),
    "observacao" TEXT,
    "arquivoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmostraSolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmostraFoliar" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "laboratorio" TEXT,
    "nFoliar" DECIMAL(4,2),
    "pFoliar" DECIMAL(4,2),
    "kFoliar" DECIMAL(4,2),
    "caFoliar" DECIMAL(4,2),
    "mgFoliar" DECIMAL(4,2),
    "sFoliar" DECIMAL(4,2),
    "bFoliar" DECIMAL(5,1),
    "znFoliar" DECIMAL(5,1),
    "feFoliar" DECIMAL(5,1),
    "mnFoliar" DECIMAL(5,1),
    "cuFoliar" DECIMAL(5,1),
    "observacao" TEXT,
    "arquivoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmostraFoliar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassadaColheita" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "safraId" INTEGER,
    "numero" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "metodo" "MetodoColheita" NOT NULL,
    "litrosCereja" DECIMAL(10,2) NOT NULL,
    "rendimentoLPorSc" DECIMAL(6,2) NOT NULL,
    "sacasBeneficiadas" DECIMAL(8,2) NOT NULL,
    "perdaPiso" DECIMAL(7,2),
    "pctCereja" DECIMAL(5,2),
    "pctVerde" DECIMAL(5,2),
    "pctBoiaPassa" DECIMAL(5,2),
    "responsavel" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassadaColheita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Safra" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "fechada" BOOLEAN NOT NULL DEFAULT false,
    "centroCustoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Safra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarefaAgricola" (
    "id" SERIAL NOT NULL,
    "safraId" INTEGER NOT NULL,
    "talhaoId" INTEGER,
    "lavouraId" INTEGER,
    "tipo" "TipoOperacao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" TEXT,
    "produto" TEXT,
    "unidade" TEXT,
    "qtdHaPrev" DECIMAL(12,3),
    "qtdTotalPrev" DECIMAL(14,2),
    "dataPrevista" DATE,
    "custoPrev" DECIMAL(14,2),
    "qtdHaReal" DECIMAL(12,3),
    "qtdTotalReal" DECIMAL(14,2),
    "dataRealizada" DATE,
    "custoReal" DECIMAL(14,2),
    "status" "StatusTarefa" NOT NULL DEFAULT 'PLANEJADA',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarefaAgricola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApontamentoMaquina" (
    "id" SERIAL NOT NULL,
    "safraId" INTEGER,
    "talhaoId" INTEGER,
    "data" DATE NOT NULL,
    "tipo" "TipoApontamento" NOT NULL,
    "recurso" TEXT NOT NULL,
    "operador" TEXT,
    "implemento" TEXT,
    "horas" DECIMAL(8,2) NOT NULL,
    "valorHora" DECIMAL(10,2),
    "valorTotal" DECIMAL(14,2),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApontamentoMaquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteCorte" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaLote" NOT NULL,
    "fase" "FaseCiclo" NOT NULL,
    "raca" TEXT NOT NULL,
    "numCabecas" INTEGER NOT NULL,
    "numCabecasEntrada" INTEGER NOT NULL,
    "dataFormacao" DATE NOT NULL,
    "origem" TEXT,
    "piqueteId" INTEGER,
    "estado" "EstadoLote" NOT NULL DEFAULT 'ATIVO',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoteCorte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoLote" (
    "loteId" INTEGER NOT NULL,
    "pesoMedio" DECIMAL(7,2),
    "pesoMedioEntrada" DECIMAL(7,2),
    "gmd" DECIMAL(5,3),
    "gmdAcumulado" DECIMAL(5,3),
    "ultimaPesagem" DATE,
    "diasSemPesar" INTEGER,
    "ua" DECIMAL(8,2),
    "proximaVacina" TEXT,
    "proximoVermifugo" TEXT,
    "ultimoManejo" TEXT,
    "pesoAlvoVenda" DECIMAL(7,2),
    "diasParaAlvo" INTEGER,
    "arrobasEstimadas" DECIMAL(7,2),
    "mortalidadeAcumulada" DECIMAL(5,2),
    "proximaAcao" TEXT,
    "proximaAcaoEm" DATE,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumoLote_pkey" PRIMARY KEY ("loteId")
);

-- CreateTable
CREATE TABLE "Piquete" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "capim" TEXT NOT NULL,
    "areaHa" DECIMAL(7,2) NOT NULL,
    "lotacaoMaxUA" DECIMAL(6,2) NOT NULL,
    "cercaTipo" TEXT,
    "ultimaReforma" DATE,
    "estado" "EstadoPiquete" NOT NULL DEFAULT 'DISPONIVEL',
    "diasDescanso" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Piquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesagemLote" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "pesoMedio" DECIMAL(7,2) NOT NULL,
    "numCabecas" INTEGER NOT NULL,
    "pesoTotal" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPesagem" NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,
    "gmdDesdeUltima" DECIMAL(5,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesagemLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManejoSanitario" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoSanitario" NOT NULL,
    "produto" TEXT,
    "doseMl" DECIMAL(7,2),
    "numCabecas" INTEGER NOT NULL,
    "responsavel" TEXT,
    "carenciaDias" INTEGER,
    "proximaDose" DATE,
    "observacao" TEXT,
    "lancamentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManejoSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suplementacao" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "tipo" "TipoSuplemento" NOT NULL,
    "produto" TEXT NOT NULL,
    "consumoCabecaDiaG" DECIMAL(8,2) NOT NULL,
    "custoKg" DECIMAL(7,2),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suplementacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacaoComercial" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER,
    "data" DATE NOT NULL,
    "tipo" "TipoComercial" NOT NULL,
    "numCabecas" INTEGER NOT NULL,
    "pesoMedio" DECIMAL(7,2) NOT NULL,
    "pesoTotal" DECIMAL(10,2) NOT NULL,
    "arrobas" DECIMAL(8,2),
    "precoArroba" DECIMAL(8,2),
    "receitaTotal" DECIMAL(14,2),
    "comprador" TEXT,
    "observacao" TEXT,
    "lancamentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperacaoComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioWhatsapp" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaWhatsapp" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "telefone" TEXT NOT NULL,
    "ultimaAtividade" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversaWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemWhatsapp" (
    "id" SERIAL NOT NULL,
    "conversaId" INTEGER NOT NULL,
    "waMessageId" TEXT,
    "direcao" "DirecaoMensagem" NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'text',
    "texto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoRascunho" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "status" "StatusRascunho" NOT NULL DEFAULT 'PENDENTE',
    "natureza" "Natureza",
    "valor" DECIMAL(14,2),
    "dataCompetencia" DATE,
    "dataVencimento" DATE,
    "dataLiquidacao" DATE,
    "situacao" "Situacao",
    "numeroDocumento" TEXT,
    "descricao" TEXT,
    "categoriaId" INTEGER,
    "centroCustoId" INTEGER,
    "contaBancariaId" INTEGER,
    "clienteFornecedorId" INTEGER,
    "rawOcr" JSONB,
    "lancamentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoRascunho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VariedadeCafe_nome_key" ON "VariedadeCafe"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Lavoura_nome_key" ON "Lavoura"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoAdubacao_nome_key" ON "PlanoAdubacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Talhao_codigo_key" ON "Talhao"("codigo");

-- CreateIndex
CREATE INDEX "Talhao_estado_idx" ON "Talhao"("estado");

-- CreateIndex
CREATE INDEX "Talhao_lavouraId_idx" ON "Talhao"("lavouraId");

-- CreateIndex
CREATE INDEX "SafraTalhao_ano_idx" ON "SafraTalhao"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "SafraTalhao_talhaoId_ano_key" ON "SafraTalhao"("talhaoId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAgricola_lancamentoId_key" ON "OperacaoAgricola"("lancamentoId");

-- CreateIndex
CREATE INDEX "OperacaoAgricola_talhaoId_data_idx" ON "OperacaoAgricola"("talhaoId", "data");

-- CreateIndex
CREATE INDEX "OperacaoAgricola_dominio_data_idx" ON "OperacaoAgricola"("dominio", "data");

-- CreateIndex
CREATE INDEX "InspecaoMIP_talhaoId_data_idx" ON "InspecaoMIP"("talhaoId", "data");

-- CreateIndex
CREATE INDEX "AmostraSolo_talhaoId_data_idx" ON "AmostraSolo"("talhaoId", "data");

-- CreateIndex
CREATE INDEX "AmostraFoliar_talhaoId_data_idx" ON "AmostraFoliar"("talhaoId", "data");

-- CreateIndex
CREATE INDEX "PassadaColheita_talhaoId_data_idx" ON "PassadaColheita"("talhaoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Safra_nome_key" ON "Safra"("nome");

-- CreateIndex
CREATE INDEX "TarefaAgricola_safraId_idx" ON "TarefaAgricola"("safraId");

-- CreateIndex
CREATE INDEX "TarefaAgricola_status_idx" ON "TarefaAgricola"("status");

-- CreateIndex
CREATE INDEX "TarefaAgricola_talhaoId_idx" ON "TarefaAgricola"("talhaoId");

-- CreateIndex
CREATE INDEX "ApontamentoMaquina_safraId_idx" ON "ApontamentoMaquina"("safraId");

-- CreateIndex
CREATE INDEX "ApontamentoMaquina_talhaoId_data_idx" ON "ApontamentoMaquina"("talhaoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "LoteCorte_codigo_key" ON "LoteCorte"("codigo");

-- CreateIndex
CREATE INDEX "LoteCorte_estado_idx" ON "LoteCorte"("estado");

-- CreateIndex
CREATE INDEX "LoteCorte_categoria_fase_idx" ON "LoteCorte"("categoria", "fase");

-- CreateIndex
CREATE UNIQUE INDEX "Piquete_codigo_key" ON "Piquete"("codigo");

-- CreateIndex
CREATE INDEX "PesagemLote_loteId_data_idx" ON "PesagemLote"("loteId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ManejoSanitario_lancamentoId_key" ON "ManejoSanitario"("lancamentoId");

-- CreateIndex
CREATE INDEX "ManejoSanitario_loteId_data_idx" ON "ManejoSanitario"("loteId", "data");

-- CreateIndex
CREATE INDEX "ManejoSanitario_tipo_data_idx" ON "ManejoSanitario"("tipo", "data");

-- CreateIndex
CREATE INDEX "Suplementacao_loteId_dataInicio_idx" ON "Suplementacao"("loteId", "dataInicio");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoComercial_lancamentoId_key" ON "OperacaoComercial"("lancamentoId");

-- CreateIndex
CREATE INDEX "OperacaoComercial_loteId_data_idx" ON "OperacaoComercial"("loteId", "data");

-- CreateIndex
CREATE INDEX "OperacaoComercial_tipo_data_idx" ON "OperacaoComercial"("tipo", "data");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioWhatsapp_telefone_key" ON "UsuarioWhatsapp"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "ConversaWhatsapp_telefone_key" ON "ConversaWhatsapp"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsapp_waMessageId_key" ON "MensagemWhatsapp"("waMessageId");

-- CreateIndex
CREATE INDEX "MensagemWhatsapp_conversaId_createdAt_idx" ON "MensagemWhatsapp"("conversaId", "createdAt");

-- CreateIndex
CREATE INDEX "LancamentoRascunho_telefone_status_idx" ON "LancamentoRascunho"("telefone", "status");

-- AddForeignKey
ALTER TABLE "Lavoura" ADD CONSTRAINT "Lavoura_planoAdubacaoId_fkey" FOREIGN KEY ("planoAdubacaoId") REFERENCES "PlanoAdubacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_variedadeId_fkey" FOREIGN KEY ("variedadeId") REFERENCES "VariedadeCafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_lavouraId_fkey" FOREIGN KEY ("lavouraId") REFERENCES "Lavoura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoTalhao" ADD CONSTRAINT "ResumoTalhao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafraTalhao" ADD CONSTRAINT "SafraTalhao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspecaoMIP" ADD CONSTRAINT "InspecaoMIP_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmostraSolo" ADD CONSTRAINT "AmostraSolo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmostraFoliar" ADD CONSTRAINT "AmostraFoliar_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassadaColheita" ADD CONSTRAINT "PassadaColheita_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassadaColheita" ADD CONSTRAINT "PassadaColheita_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "SafraTalhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safra" ADD CONSTRAINT "Safra_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaAgricola" ADD CONSTRAINT "TarefaAgricola_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaAgricola" ADD CONSTRAINT "TarefaAgricola_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarefaAgricola" ADD CONSTRAINT "TarefaAgricola_lavouraId_fkey" FOREIGN KEY ("lavouraId") REFERENCES "Lavoura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApontamentoMaquina" ADD CONSTRAINT "ApontamentoMaquina_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApontamentoMaquina" ADD CONSTRAINT "ApontamentoMaquina_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteCorte" ADD CONSTRAINT "LoteCorte_piqueteId_fkey" FOREIGN KEY ("piqueteId") REFERENCES "Piquete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoLote" ADD CONSTRAINT "ResumoLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesagemLote" ADD CONSTRAINT "PesagemLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManejoSanitario" ADD CONSTRAINT "ManejoSanitario_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suplementacao" ADD CONSTRAINT "Suplementacao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoComercial" ADD CONSTRAINT "OperacaoComercial_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaWhatsapp" ADD CONSTRAINT "ConversaWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioWhatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsapp" ADD CONSTRAINT "MensagemWhatsapp_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaWhatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

