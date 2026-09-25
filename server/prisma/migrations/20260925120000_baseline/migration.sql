-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoContaFinanceira" AS ENUM ('BANCO', 'CAIXA', 'APLICACAO');

-- CreateEnum
CREATE TYPE "TipoParceiro" AS ENUM ('CLIENTE', 'FORNECEDOR', 'AMBOS', 'FUNCIONARIO', 'PROPRIETARIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "PapelParceiro" AS ENUM ('CLIENTE', 'FORNECEDOR', 'PRESTADOR_SERVICO', 'FUNCIONARIO', 'PROPRIETARIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoBancario" AS ENUM ('CORRENTE', 'POUPANCA', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "TipoOperacaoFinanceira" AS ENUM ('COMPRA_ESTOQUE', 'COMPRA_CONSUMO_DIRETO', 'SERVICO', 'VENDA', 'APORTE', 'RETIRADA', 'TRANSFERENCIA_FINANCEIRA', 'AJUSTE_ESTOQUE', 'TRANSFERENCIA_ESTOQUE', 'INVENTARIO_INICIAL', 'BONIFICACAO', 'DEVOLUCAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "StatusOperacao" AS ENUM ('RASCUNHO', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoCompromisso" AS ENUM ('PAGAR', 'RECEBER');

-- CreateEnum
CREATE TYPE "StatusCompromisso" AS ENUM ('PENDENTE', 'PARCIAL', 'LIQUIDADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoTransacaoFinanceira" AS ENUM ('PAGAMENTO', 'RECEBIMENTO', 'TRANSFERENCIA', 'APORTE', 'RETIRADA', 'AJUSTE', 'REVERSAO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'TRANSFERENCIA_BANCARIA', 'BOLETO', 'DINHEIRO', 'CARTAO', 'CHEQUE', 'DEBITO_AUTOMATICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusTransacaoFinanceira" AS ENUM ('CONFIRMADA', 'REVERTIDA');

-- CreateEnum
CREATE TYPE "DirecaoMovimentoConta" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "TipoDocumentoFinanceiro" AS ENUM ('NOTA_FISCAL', 'BOLETO', 'CONTRATO', 'RECIBO', 'COMPROVANTE', 'JUSTIFICATIVA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusPeriodoFinanceiro" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "ClassificacaoCategoria" AS ENUM ('CUSTEIO', 'INVESTIMENTO');

-- CreateEnum
CREATE TYPE "StatusRelatorioFinanceiro" AS ENUM ('PROCESSANDO', 'CONCLUIDO', 'FALHOU');

-- CreateEnum
CREATE TYPE "ModoProducao" AS ENUM ('ORDENHA', 'TOTAL_DIARIO', 'TANQUE_LOTE');

-- CreateEnum
CREATE TYPE "SexoAnimal" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "CategoriaAnimal" AS ENUM ('BEZERRA', 'NOVILHA', 'VACA', 'BEZERRO', 'TOURO', 'CABRITA', 'CABRA', 'CABRITO', 'BODE');

-- CreateEnum
CREATE TYPE "FinalidadeAnimal" AS ENUM ('LEITE', 'CORTE', 'DUPLA_APTIDAO', 'NAO_INFORMADA');

-- CreateEnum
CREATE TYPE "StatusAnimal" AS ENUM ('ATIVO', 'BAIXADO');

-- CreateEnum
CREATE TYPE "StatusReprodutivo" AS ENUM ('PEV', 'VAZIA', 'INSEMINADA', 'PRENHE');

-- CreateEnum
CREATE TYPE "EspecieAnimal" AS ENUM ('BOVINO', 'CAPRINO');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoAnimal" AS ENUM ('GRUPO', 'SETOR');

-- CreateEnum
CREATE TYPE "StatusFolhaCampo" AS ENUM ('RASCUNHO', 'EM_CAMPO', 'AGUARDANDO_LANCAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusLinhaFolha" AS ENUM ('PENDENTE', 'PREENCHIDA', 'NAO_REALIZADO', 'REGISTRADA');

-- CreateEnum
CREATE TYPE "QuartoMamario" AS ENUM ('AE', 'AD', 'PE', 'PD');

-- CreateEnum
CREATE TYPE "ScoreCmt" AS ENUM ('NEGATIVO', 'TRACOS', 'UMA_CRUZ', 'DUAS_CRUZES', 'TRES_CRUZES');

-- CreateEnum
CREATE TYPE "OrigemAptidao" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateEnum
CREATE TYPE "TipoEventoReprodutivo" AS ENUM ('CIO', 'INSEMINACAO', 'COBERTURA', 'DIAGNOSTICO', 'PARTO', 'SECAGEM', 'TRANSFERENCIA_EMBRIAO', 'EXAME_GINECOLOGICO', 'DESMAME');

-- CreateEnum
CREATE TYPE "TipoEventoSanitario" AS ENUM ('OCORRENCIA', 'APLICACAO', 'EXAME', 'MASTITE', 'VACINA');

-- CreateEnum
CREATE TYPE "FinalidadeIATF" AS ENUM ('IATF', 'TETF');

-- CreateEnum
CREATE TYPE "StatusExecucaoEtapaIATF" AS ENUM ('PENDENTE', 'CONCLUIDA', 'PULADA');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "OrigemMovimentoEstoque" AS ENUM ('COMPRA', 'CONSUMO_DIRETO', 'TRANSFERENCIA', 'PRODUCAO', 'DEVOLUCAO', 'BONIFICACAO', 'INVENTARIO_INICIAL', 'NUTRICAO', 'SANIDADE', 'APLICACAO', 'PERDA', 'AJUSTE_INVENTARIO');

-- CreateEnum
CREATE TYPE "StatusMovimentoEstoque" AS ENUM ('CONFIRMADO', 'REVERTIDO');

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
CREATE TYPE "TipoDiaPonto" AS ENUM ('UTIL', 'DOMINGO', 'FERIADO', 'FOLGA', 'FALTA');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "Cultura" AS ENUM ('MILHO');

-- CreateEnum
CREATE TYPE "TipoCustoCultivo" AS ENUM ('ADUBACAO', 'PREPARO_SOLO', 'PLANTIO', 'TRATOS', 'COLHEITA', 'TRANSPORTE', 'MAO_DE_OBRA', 'MAQUINA', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoProducao" AS ENUM ('GRAO', 'SILAGEM');

-- CreateEnum
CREATE TYPE "UnidadeProducao" AS ENUM ('SC', 'TON');

-- CreateEnum
CREATE TYPE "DestinoProducao" AS ENUM ('VENDA', 'SILO');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('UN', 'KG', 'G', 'T', 'L', 'ML', 'SC', 'DOSE', 'CX', 'M', 'HA');

-- CreateEnum
CREATE TYPE "TipoSilo" AS ENUM ('GRAO', 'SILAGEM');

-- CreateEnum
CREATE TYPE "TipoMovimentoSilo" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "OrigemMovimentoSilo" AS ENUM ('COLHEITA', 'NUTRICAO', 'VENDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('PENDENTE', 'ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "TipoToken" AS ENUM ('CONVITE', 'RESET');

-- CreateTable
CREATE TABLE "CentroCusto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "classificacao" "ClassificacaoCategoria",
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "usoSanitario" BOOLEAN NOT NULL DEFAULT false,
    "usoNutricional" BOOLEAN NOT NULL DEFAULT false,
    "usoAgricola" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaFinanceira" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaFinanceira" NOT NULL,
    "instituicao" TEXT,
    "identificacao" TEXT,
    "tipoBancario" "TipoBancario",
    "agencia" TEXT,
    "numeroConta" TEXT,
    "digito" TEXT,
    "titular" TEXT,
    "local" TEXT,
    "responsavel" TEXT,
    "observacoes" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "saldoAbertura" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataSaldoAbertura" DATE NOT NULL,
    "incluirNoSaldoGeral" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL DEFAULT 'UN',
    "minimoEstoque" DECIMAL(12,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "categoriaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroChuva" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "mm" DECIMAL(6,1) NOT NULL,
    "observacao" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroChuva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parceiro" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "tipo" "TipoParceiro" NOT NULL DEFAULT 'FORNECEDOR',
    "telefone" TEXT,
    "email" TEXT,
    "nomeFantasia" TEXT,
    "pessoaContato" TEXT,
    "telefoneWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "referencia" TEXT,
    "observacoes" TEXT,
    "formaPagamentoPreferida" "FormaPagamento",
    "condicaoPagamentoPreferida" TEXT,
    "prazosPagamento" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoFornecedor" (
    "produtoId" INTEGER NOT NULL,
    "fornecedorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("produtoId","fornecedorId")
);

-- CreateTable
CREATE TABLE "ProdutoCentroCusto" (
    "produtoId" INTEGER NOT NULL,
    "centroCustoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoCentroCusto_pkey" PRIMARY KEY ("produtoId","centroCustoId")
);

-- CreateTable
CREATE TABLE "ParceiroPapel" (
    "parceiroId" INTEGER NOT NULL,
    "papel" "PapelParceiro" NOT NULL,

    CONSTRAINT "ParceiroPapel_pkey" PRIMARY KEY ("parceiroId","papel")
);

-- CreateTable
CREATE TABLE "PeriodoFinanceiro" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" "StatusPeriodoFinanceiro" NOT NULL DEFAULT 'ABERTO',
    "fechadoEm" TIMESTAMP(3),
    "fechadoPorId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodoFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operacao" (
    "categoriaNome" TEXT,
    "classificacao" "ClassificacaoCategoria",
    "id" SERIAL NOT NULL,
    "tipo" "TipoOperacaoFinanceira" NOT NULL,
    "status" "StatusOperacao" NOT NULL DEFAULT 'RASCUNHO',
    "data" DATE NOT NULL,
    "descricao" TEXT,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "parceiroId" INTEGER,
    "categoriaId" INTEGER,
    "centroCustoId" INTEGER,
    "corrigeOperacaoId" INTEGER,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RascunhoOperacao" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RascunhoOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RascunhoRelatorioFinanceiro" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "configuracao" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RascunhoRelatorioFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioFinanceiro" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusRelatorioFinanceiro" NOT NULL DEFAULT 'PROCESSANDO',
    "parametros" JSONB NOT NULL,
    "snapshot" JSONB,
    "storageKey" TEXT,
    "erro" TEXT,
    "propriedadeId" INTEGER NOT NULL,
    "autorId" INTEGER,
    "autorNome" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "RelatorioFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOperacao" (
    "categoriaId" INTEGER,
    "categoriaNome" TEXT,
    "classificacao" "ClassificacaoCategoria",
    "centroCustoId" INTEGER,
    "centroCustoNome" TEXT,
    "id" SERIAL NOT NULL,
    "operacaoId" INTEGER NOT NULL,
    "produtoId" INTEGER,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "unidade" TEXT NOT NULL,
    "valorUnitario" DECIMAL(14,4) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "estocavel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompromissoFinanceiro" (
    "id" SERIAL NOT NULL,
    "operacaoId" INTEGER NOT NULL,
    "tipo" "TipoCompromisso" NOT NULL,
    "status" "StatusCompromisso" NOT NULL DEFAULT 'PENDENTE',
    "valorOriginal" DECIMAL(14,2) NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "numeroParcela" INTEGER,
    "totalParcelas" INTEGER,
    "parceiroId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompromissoFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransacaoFinanceira" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoTransacaoFinanceira" NOT NULL,
    "status" "StatusTransacaoFinanceira" NOT NULL DEFAULT 'CONFIRMADA',
    "data" DATE NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "formaPagamento" "FormaPagamento",
    "descricao" TEXT,
    "operacaoId" INTEGER,
    "parceiroId" INTEGER,
    "propriedadeId" INTEGER NOT NULL,
    "criadoPorId" INTEGER,
    "reversaoDeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransacaoFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoConta" (
    "id" SERIAL NOT NULL,
    "transacaoId" INTEGER NOT NULL,
    "contaId" INTEGER NOT NULL,
    "direcao" "DirecaoMovimentoConta" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoConta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacao" (
    "id" SERIAL NOT NULL,
    "compromissoId" INTEGER NOT NULL,
    "transacaoId" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoFinanceiro" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoDocumentoFinanceiro" NOT NULL,
    "nome" TEXT NOT NULL,
    "numero" TEXT,
    "storageDriver" TEXT,
    "bucket" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "sha256" TEXT,
    "operacaoId" INTEGER,
    "transacaoId" INTEGER,
    "compromissoId" INTEGER,
    "rascunhoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaFinanceira" (
    "id" SERIAL NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "motivo" TEXT,
    "estadoAnterior" JSONB,
    "estadoPosterior" JSONB,
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "producaoModo" "ModoProducao" NOT NULL DEFAULT 'ORDENHA',
    "precoLeite" DECIMAL(10,4),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroManejo" (
    "chave" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT,
    "valorNumero" DECIMAL(14,4),
    "valorNumeroAceitavel" DECIMAL(14,4),
    "valorTexto" TEXT,
    "modo" TEXT,
    "direcao" TEXT,
    "referenciaNumero" DECIMAL(14,4),
    "referenciaNumeroAceitavel" DECIMAL(14,4),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametroManejo_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "ControleLeiteiro" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "peso1" DECIMAL(6,2),
    "peso2" DECIMAL(6,2),
    "peso3" DECIMAL(6,2),
    "pesoTotal" DECIMAL(6,2) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControleLeiteiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducaoLote" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER,
    "propriedadeId" INTEGER,
    "data" DATE NOT NULL,
    "litros" DECIMAL(10,2) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducaoLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tanque" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "capacidadeLitros" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tanque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnaliseTanque" (
    "id" SERIAL NOT NULL,
    "tanqueId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "ccs" INTEGER,
    "cbt" INTEGER,
    "gordura" DECIMAL(4,2),
    "proteina" DECIMAL(4,2),
    "temperatura" DECIMAL(4,1),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnaliseTanque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raca" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "especie" "EspecieAnimal" NOT NULL DEFAULT 'BOVINO',

    CONSTRAINT "Raca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentralSemen" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentralSemen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reprodutor" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "racaId" INTEGER,
    "centralSemenId" INTEGER,
    "ptaLeite" DECIMAL(8,2),
    "ptaGordura" DECIMAL(6,2),
    "ptaProteina" DECIMAL(6,2),
    "tpi" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reprodutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicadorGenetico" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT,
    "direcao" TEXT NOT NULL DEFAULT 'maior_melhor',
    "colunaLegada" TEXT,
    "ranking" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicadorGenetico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorIndicadorReprodutor" (
    "id" SERIAL NOT NULL,
    "reprodutorId" INTEGER NOT NULL,
    "indicadorId" INTEGER NOT NULL,
    "valor" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "ValorIndicadorReprodutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarcadorGenetico" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "MarcadorGenetico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorMarcadorReprodutor" (
    "id" SERIAL NOT NULL,
    "reprodutorId" INTEGER NOT NULL,
    "marcadorId" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,

    CONSTRAINT "ValorMarcadorReprodutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caseina" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Caseina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorCaseinaReprodutor" (
    "id" SERIAL NOT NULL,
    "reprodutorId" INTEGER NOT NULL,
    "caseinaId" INTEGER NOT NULL,
    "genotipo" TEXT NOT NULL,

    CONSTRAINT "ValorCaseinaReprodutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedigreeReprodutor" (
    "id" SERIAL NOT NULL,
    "reprodutorId" INTEGER NOT NULL,
    "ideagriId" INTEGER,
    "paiNome" TEXT,
    "paiCodigo" TEXT,
    "maeNome" TEXT,
    "maeCodigo" TEXT,
    "avoMaternoNome" TEXT,
    "avoMaternoCodigo" TEXT,
    "avoPaternoNome" TEXT,
    "avoPaternoCodigo" TEXT,

    CONSTRAINT "PedigreeReprodutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoSemen" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "TipoSemen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstoqueSemen" (
    "id" SERIAL NOT NULL,
    "reprodutorId" INTEGER NOT NULL,
    "tipoSemenId" INTEGER,
    "lote" TEXT,
    "localizacao" TEXT,
    "dosesDisponiveis" INTEGER NOT NULL DEFAULT 0,
    "ideagriId" INTEGER,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueSemen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedidaAcasalamento" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "consanguinidadeMax" DECIMAL(5,4),
    "exigePedigree" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedidaAcasalamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemMedidaAcasalamento" (
    "id" SERIAL NOT NULL,
    "medidaId" INTEGER NOT NULL,
    "indicadorId" INTEGER NOT NULL,
    "peso" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "minimo" DECIMAL(12,3),
    "maximo" DECIMAL(12,3),

    CONSTRAINT "ItemMedidaAcasalamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombinacaoMedidaAcasalamento" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CombinacaoMedidaAcasalamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCombinacaoMedida" (
    "id" SERIAL NOT NULL,
    "combinacaoId" INTEGER NOT NULL,
    "medidaId" INTEGER NOT NULL,
    "peso" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemCombinacaoMedida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoAcasalamento" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "combinacaoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoAcasalamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersaoPlanoAcasalamento" (
    "id" SERIAL NOT NULL,
    "planoId" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoPlanoAcasalamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinhaPlanoAcasalamento" (
    "id" SERIAL NOT NULL,
    "versaoId" INTEGER NOT NULL,
    "femeaId" INTEGER NOT NULL,
    "rankingSnapshot" JSONB NOT NULL,
    "reprodutorEscolhidoId" INTEGER,
    "confirmadoNaoVerificavel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LinhaPlanoAcasalamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbriaoClassificacao" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmbriaoClassificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coleta" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "doadoraId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "tecnico" TEXT,
    "metodo" TEXT NOT NULL,
    "laboratorio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "observacao" TEXT,
    "aplicacaoPoolId" INTEGER,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coleta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OocitoColeta" (
    "id" SERIAL NOT NULL,
    "coletaId" INTEGER NOT NULL,
    "qualidade" TEXT NOT NULL,
    "viavel" BOOLEAN NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "OocitoColeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FertilizacaoColeta" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "coletaId" INTEGER NOT NULL,
    "reprodutorId" INTEGER NOT NULL,
    "estoqueSemenId" INTEGER,
    "doseBaixada" BOOLEAN NOT NULL DEFAULT false,
    "data" DATE,
    "tecnica" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,

    CONSTRAINT "FertilizacaoColeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbriaoColeta" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "fertilizacaoId" INTEGER NOT NULL,
    "classificacaoId" INTEGER,
    "codigoInterno" TEXT,
    "estagio" TEXT,
    "viavel" BOOLEAN NOT NULL DEFAULT true,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbriaoColeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoPoolDoadora" (
    "id" SERIAL NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoPoolDoadora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGrupoPoolDoadora" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "doadoraId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemGrupoPoolDoadora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoPoolDoadora" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "tecnico" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AplicacaoPoolDoadora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "centroCustoId" INTEGER,
    "dietaId" INTEGER,
    "propriedadeId" INTEGER,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "apelido" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dieta" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "pb" DECIMAL(4,1),
    "edMcal" DECIMAL(4,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dieta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaItem" (
    "id" SERIAL NOT NULL,
    "dietaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "qtdPorCabecaDia" DECIMAL(12,4) NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT,
    "sexo" "SexoAnimal" NOT NULL,
    "categoria" "CategoriaAnimal" NOT NULL,
    "finalidade" "FinalidadeAnimal" NOT NULL DEFAULT 'NAO_INFORMADA',
    "racaId" INTEGER,
    "grauSangue" TEXT,
    "dataNascimento" DATE,
    "dataEntrada" DATE NOT NULL,
    "brincoEletronico" TEXT,
    "sisbov" TEXT,
    "maeId" INTEGER,
    "paiId" INTEGER,
    "paiNome" TEXT,
    "grupoId" INTEGER,
    "propriedadeId" INTEGER,
    "setor" TEXT,
    "status" "StatusAnimal" NOT NULL DEFAULT 'ATIVO',
    "dataBaixa" DATE,
    "motivoBaixa" TEXT,
    "ehReceptora" BOOLEAN NOT NULL DEFAULT false,
    "numPartosEntrada" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoAnimal" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tipo" "TipoMovimentacaoAnimal" NOT NULL,
    "data" DATE NOT NULL,
    "origem" TEXT,
    "destino" TEXT NOT NULL,
    "grupoOrigemId" INTEGER,
    "grupoDestinoId" INTEGER,
    "motivo" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiltroAnimal" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "grupoId" INTEGER,
    "setor" TEXT,
    "categoria" TEXT,
    "finalidade" TEXT,
    "busca" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiltroAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloFormularioCampo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloFormularioCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolhaCampo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "StatusFolhaCampo" NOT NULL DEFAULT 'EM_CAMPO',
    "filtrosSnapshot" JSONB NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "modeloId" INTEGER,
    "totalLinhas" INTEGER NOT NULL,
    "linhasProntas" INTEGER NOT NULL DEFAULT 0,
    "propriedadeId" INTEGER,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "FolhaCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinhaFolhaCampo" (
    "id" SERIAL NOT NULL,
    "folhaId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "eventoOrigemId" INTEGER,
    "snapshot" JSONB NOT NULL,
    "status" "StatusLinhaFolha" NOT NULL DEFAULT 'PENDENTE',
    "respostas" JSONB,
    "motivoNaoRealizado" TEXT,
    "eventoGeradoId" INTEGER,
    "resultadoTipo" TEXT,
    "resultadoId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinhaFolhaCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoAnimal" (
    "animalId" INTEGER NOT NULL,
    "statusReprodutivo" "StatusReprodutivo" NOT NULL DEFAULT 'VAZIA',
    "del" INTEGER,
    "ordemLactacao" INTEGER,
    "producaoMediaDia" DECIMAL(6,2),
    "producao305" INTEGER,
    "producaoTendencia" TEXT,
    "ccs" INTEGER,
    "ccsTendencia" TEXT,
    "quartosCronicos" INTEGER NOT NULL DEFAULT 0,
    "quartosPerdidos" INTEGER NOT NULL DEFAULT 0,
    "ultimoDgData" DATE,
    "ultimoDgResultado" TEXT,
    "iepProjetado" INTEGER,
    "diasGestacao" INTEGER,
    "previsaoSecagem" DATE,
    "ultimaInseminacao" DATE,
    "protocoloAtual" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumoAnimal_pkey" PRIMARY KEY ("animalId")
);

-- CreateTable
CREATE TABLE "ExameQuarto" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "quarto" "QuartoMamario" NOT NULL,
    "scoreCmt" "ScoreCmt",
    "ccs" INTEGER,
    "clinica" BOOLEAN NOT NULL DEFAULT false,
    "severidade" TEXT,
    "resultadoCultivo" TEXT,
    "perdido" BOOLEAN NOT NULL DEFAULT false,
    "escoreTeto" INTEGER,
    "observacao" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExameQuarto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AptidaoAnimal" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "apta" BOOLEAN NOT NULL,
    "motivo" TEXT,
    "origem" "OrigemAptidao" NOT NULL DEFAULT 'MANUAL',
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AptidaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadoExameGinecologico" (
    "id" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nomeResumido" TEXT NOT NULL,
    "nomeCompleto" TEXT,
    "tipo" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResultadoExameGinecologico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoReprodutivo" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tipo" "TipoEventoReprodutivo" NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "reprodutor" TEXT,
    "protocolo" TEXT,
    "resultado" TEXT,
    "dtPartoPrevista" DATE,
    "tipoParto" TEXT,
    "auxilioParto" TEXT,
    "numCrias" INTEGER,
    "criasVivas" INTEGER,
    "criasNatimortas" INTEGER,
    "sexoCria" TEXT,
    "motivoSecagem" TEXT,
    "ideagriId" INTEGER,
    "origemExecucaoId" INTEGER,
    "estoqueSemenId" INTEGER,
    "estoqueSemenDoseBaixada" BOOLEAN NOT NULL DEFAULT false,
    "resultadoGinecologicoId" INTEGER,
    "criaId" INTEGER,
    "embriaoColetaId" INTEGER,
    "ideagriEmbriaoId" INTEGER,
    "doadoraNumero" TEXT,
    "doadoraNome" TEXT,
    "doadoraId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoReprodutivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lactacao" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "dtInicio" DATE NOT NULL,
    "dtFim" DATE,
    "motivoSecagem" TEXT,
    "tipoAleitamento" TEXT,
    "induzida" BOOLEAN NOT NULL DEFAULT false,
    "producaoTotal" DECIMAL(10,2),
    "producao305" DECIMAL(10,2),
    "duracaoDias" INTEGER,

    CONSTRAINT "Lactacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pesagem" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "peso" DECIMAL(7,2) NOT NULL,
    "gmd" DECIMAL(6,3),

    CONSTRAINT "Pesagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoSanitario" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tipo" "TipoEventoSanitario" NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "doenca" TEXT,
    "dtFim" DATE,
    "diasTratamento" INTEGER,
    "produto" TEXT,
    "dose" TEXT,
    "carencia" INTEGER,
    "loteProduto" TEXT,
    "ccs" INTEGER,
    "gordura" DECIMAL(4,2),
    "proteina" DECIMAL(4,2),
    "quarto" TEXT,
    "severidade" TEXT,
    "resultadoCultivo" TEXT,
    "produtoId" INTEGER,
    "quantidadeUsada" DECIMAL(12,3),
    "movimentoEstoqueId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacinaAgendada" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "propriedadeId" INTEGER,
    "vacina" TEXT NOT NULL,
    "dataPrevista" DATE NOT NULL,
    "aplicadaEm" DATE,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacinaAgendada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "hormonioBase" TEXT,
    "finalidade" "FinalidadeIATF" NOT NULL DEFAULT 'IATF',
    "ideagriId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "hormonio" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EtapaProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrincipioProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL DEFAULT 0,
    "principio" TEXT,
    "produto" TEXT,
    "dose" TEXT,
    "uso" TEXT,

    CONSTRAINT "PrincipioProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "observacao" TEXT,
    "usoCidr" BOOLEAN NOT NULL DEFAULT false,
    "estimulo" TEXT,
    "perdaImplante" BOOLEAN NOT NULL DEFAULT false,
    "ideagriId" INTEGER,
    "programacaoId" INTEGER,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AplicacaoProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecucaoEtapaIATF" (
    "id" SERIAL NOT NULL,
    "aplicacaoId" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "hormonio" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "dataPlanejada" DATE NOT NULL,
    "status" "StatusExecucaoEtapaIATF" NOT NULL DEFAULT 'PENDENTE',
    "dataExecucao" DATE,
    "produto" TEXT,
    "dose" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecucaoEtapaIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocoloSanitario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocoloSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaProtocoloSanitario" (
    "id" SERIAL NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "produto" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EtapaProtocoloSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoProtocoloSanitario" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "observacao" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AplicacaoProtocoloSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramacaoIATFLote" (
    "id" SERIAL NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "grupoId" INTEGER,
    "nome" TEXT,
    "ideagriId" INTEGER,
    "dataInicio" DATE NOT NULL,
    "observacao" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramacaoIATFLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "origem" "OrigemMovimentoEstoque" NOT NULL,
    "status" "StatusMovimentoEstoque" NOT NULL DEFAULT 'CONFIRMADO',
    "data" DATE NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "custoUnitario" DECIMAL(14,4) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "grupoId" INTEGER,
    "operacaoId" INTEGER,
    "itemOperacaoId" INTEGER,
    "propriedadeId" INTEGER,
    "criadoPorId" INTEGER,
    "centroCustoId" INTEGER,
    "reversaoDeId" INTEGER,
    "consumoPeriodoId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoPeriodo" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "dietaId" INTEGER,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "numCabecas" INTEGER NOT NULL,
    "diasBase" INTEGER NOT NULL,
    "custoTotal" DECIMAL(14,2) NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumoPeriodo_pkey" PRIMARY KEY ("id")
);

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
    "propriedadeId" INTEGER,
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
    "propriedadeId" INTEGER,
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
    "produtoId" INTEGER,
    "quantidadeTotal" DECIMAL(12,3),
    "movimentoEstoqueId" INTEGER,
    "doseValor" DECIMAL(10,3),
    "doseUnidade" TEXT,
    "volumeCaldaLha" DECIMAL(7,2),
    "nKgHa" DECIMAL(7,2),
    "p2o5KgHa" DECIMAL(7,2),
    "k2oKgHa" DECIMAL(7,2),
    "pragaAlvo" "PragaDoenca",
    "carenciaDias" INTEGER,
    "operacaoFinanceiraId" INTEGER,
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
    "propriedadeId" INTEGER,
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
    "propriedadeId" INTEGER,
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
    "operacaoFinanceiraId" INTEGER,
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
    "operacaoFinanceiraId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperacaoComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "setor" TEXT,
    "salarioMensal" DECIMAL(12,2) NOT NULL,
    "cargaMensalHoras" DECIMAL(6,2) NOT NULL DEFAULT 220,
    "jornadaDiariaHoras" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "horaEntradaPadrao" TEXT,
    "horaSaidaPadrao" TEXT,
    "intervaloPadraoMin" INTEGER,
    "dataAdmissao" DATE,
    "cpf" TEXT,
    "chavePix" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPonto" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "entrada" TEXT,
    "saida" TEXT,
    "intervaloMin" INTEGER NOT NULL DEFAULT 60,
    "tipoDia" "TipoDiaPonto" NOT NULL DEFAULT 'UTIL',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroPonto_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "SafraCultivo" (
    "id" SERIAL NOT NULL,
    "cultura" "Cultura" NOT NULL,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "areaHaTotal" DECIMAL(10,2),
    "fechada" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafraCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaCultivo" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT,
    "areaHa" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoCusto" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "areaCultivoId" INTEGER,
    "tipo" "TipoCustoCultivo" NOT NULL,
    "classe" "ClassificacaoCategoria" NOT NULL DEFAULT 'CUSTEIO',
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "qtd" DECIMAL(12,3),
    "unidade" TEXT,
    "horasMaquina" DECIMAL(8,2),
    "numMaquinas" INTEGER,
    "numCaminhoes" INTEGER,
    "operacaoFinanceiraId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducaoCultivo" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "areaCultivoId" INTEGER,
    "data" DATE NOT NULL,
    "tipo" "TipoProducao" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "unidade" "UnidadeProducao" NOT NULL,
    "destino" "DestinoProducao",
    "siloId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducaoCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Silo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoSilo" NOT NULL,
    "capacidade" DECIMAL(12,3),
    "unidade" TEXT NOT NULL,
    "saldoAtual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Silo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoSilo" (
    "id" SERIAL NOT NULL,
    "siloId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoMovimentoSilo" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "origem" "OrigemMovimentoSilo" NOT NULL,
    "producaoCultivoId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoSilo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoSafraCultivo" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "custeioTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "investimentoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "areaHa" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "producaoGraoSc" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "producaoSilagemTon" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "custoHa" DECIMAL(14,2),
    "custoSaca" DECIMAL(14,2),
    "custoTonelada" DECIMAL(14,2),
    "horasMaquinaTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumoSafraCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "papel" TEXT NOT NULL,
    "abas" TEXT[],
    "areas" TEXT[] DEFAULT ARRAY['financeiro', 'rebanho', 'agricultura', 'gado_corte', 'equipe']::TEXT[],
    "flags" TEXT[],
    "status" "StatusUsuario" NOT NULL DEFAULT 'PENDENTE',
    "dono" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "ultimoUso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenAcesso" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoToken" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCusto_nome_key" ON "CentroCusto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE INDEX "ContaFinanceira_propriedadeId_ativo_idx" ON "ContaFinanceira"("propriedadeId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "ContaFinanceira_propriedadeId_nome_key" ON "ContaFinanceira"("propriedadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_nome_key" ON "Produto"("nome");

-- CreateIndex
CREATE INDEX "RegistroChuva_data_idx" ON "RegistroChuva"("data");

-- CreateIndex
CREATE INDEX "RegistroChuva_propriedadeId_idx" ON "RegistroChuva"("propriedadeId");

-- CreateIndex
CREATE INDEX "Parceiro_nome_idx" ON "Parceiro"("nome");

-- CreateIndex
CREATE INDEX "Parceiro_tipo_ativo_idx" ON "Parceiro"("tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Parceiro_documento_key" ON "Parceiro"("documento");

-- CreateIndex
CREATE INDEX "ProdutoFornecedor_fornecedorId_idx" ON "ProdutoFornecedor"("fornecedorId");

-- CreateIndex
CREATE INDEX "ProdutoCentroCusto_centroCustoId_idx" ON "ProdutoCentroCusto"("centroCustoId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoFinanceiro_propriedadeId_ano_mes_key" ON "PeriodoFinanceiro"("propriedadeId", "ano", "mes");

-- CreateIndex
CREATE INDEX "Operacao_propriedadeId_data_idx" ON "Operacao"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "Operacao_tipo_status_idx" ON "Operacao"("tipo", "status");

-- CreateIndex
CREATE INDEX "Operacao_parceiroId_idx" ON "Operacao"("parceiroId");

-- CreateIndex
CREATE INDEX "Operacao_corrigeOperacaoId_idx" ON "Operacao"("corrigeOperacaoId");

-- CreateIndex
CREATE INDEX "RascunhoOperacao_criadoPorId_updatedAt_idx" ON "RascunhoOperacao"("criadoPorId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoOperacao_propriedadeId_criadoPorId_key" ON "RascunhoOperacao"("propriedadeId", "criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "RascunhoRelatorioFinanceiro_propriedadeId_criadoPorId_key" ON "RascunhoRelatorioFinanceiro"("propriedadeId", "criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioFinanceiro_storageKey_key" ON "RelatorioFinanceiro"("storageKey");

-- CreateIndex
CREATE INDEX "RelatorioFinanceiro_propriedadeId_geradoEm_idx" ON "RelatorioFinanceiro"("propriedadeId", "geradoEm");

-- CreateIndex
CREATE INDEX "ItemOperacao_operacaoId_idx" ON "ItemOperacao"("operacaoId");

-- CreateIndex
CREATE INDEX "ItemOperacao_produtoId_idx" ON "ItemOperacao"("produtoId");

-- CreateIndex
CREATE INDEX "ItemOperacao_centroCustoId_idx" ON "ItemOperacao"("centroCustoId");

-- CreateIndex
CREATE INDEX "CompromissoFinanceiro_tipo_status_dataVencimento_idx" ON "CompromissoFinanceiro"("tipo", "status", "dataVencimento");

-- CreateIndex
CREATE INDEX "CompromissoFinanceiro_operacaoId_idx" ON "CompromissoFinanceiro"("operacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "TransacaoFinanceira_reversaoDeId_key" ON "TransacaoFinanceira"("reversaoDeId");

-- CreateIndex
CREATE INDEX "TransacaoFinanceira_propriedadeId_data_idx" ON "TransacaoFinanceira"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "TransacaoFinanceira_tipo_status_idx" ON "TransacaoFinanceira"("tipo", "status");

-- CreateIndex
CREATE INDEX "TransacaoFinanceira_operacaoId_idx" ON "TransacaoFinanceira"("operacaoId");

-- CreateIndex
CREATE INDEX "MovimentoConta_contaId_createdAt_idx" ON "MovimentoConta"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimentoConta_transacaoId_idx" ON "MovimentoConta"("transacaoId");

-- CreateIndex
CREATE INDEX "Liquidacao_transacaoId_idx" ON "Liquidacao"("transacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacao_compromissoId_transacaoId_key" ON "Liquidacao"("compromissoId", "transacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoFinanceiro_storageKey_key" ON "DocumentoFinanceiro"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoFinanceiro_sha256_key" ON "DocumentoFinanceiro"("sha256");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_operacaoId_idx" ON "DocumentoFinanceiro"("operacaoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_transacaoId_idx" ON "DocumentoFinanceiro"("transacaoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_compromissoId_idx" ON "DocumentoFinanceiro"("compromissoId");

-- CreateIndex
CREATE INDEX "DocumentoFinanceiro_rascunhoId_idx" ON "DocumentoFinanceiro"("rascunhoId");

-- CreateIndex
CREATE INDEX "AuditoriaFinanceira_entidade_entidadeId_idx" ON "AuditoriaFinanceira"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditoriaFinanceira_usuarioId_createdAt_idx" ON "AuditoriaFinanceira"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "ParametroManejo_categoria_ordem_idx" ON "ParametroManejo"("categoria", "ordem");

-- CreateIndex
CREATE INDEX "ControleLeiteiro_animalId_data_idx" ON "ControleLeiteiro"("animalId", "data");

-- CreateIndex
CREATE INDEX "ProducaoLote_grupoId_data_idx" ON "ProducaoLote"("grupoId", "data");

-- CreateIndex
CREATE INDEX "ProducaoLote_propriedadeId_data_idx" ON "ProducaoLote"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "ProducaoLote_data_idx" ON "ProducaoLote"("data");

-- CreateIndex
CREATE INDEX "Tanque_propriedadeId_idx" ON "Tanque"("propriedadeId");

-- CreateIndex
CREATE INDEX "AnaliseTanque_tanqueId_data_idx" ON "AnaliseTanque"("tanqueId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Raca_nome_key" ON "Raca"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Raca_codigo_key" ON "Raca"("codigo");

-- CreateIndex
CREATE INDEX "CentralSemen_propriedadeId_idx" ON "CentralSemen"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Reprodutor_ideagriId_key" ON "Reprodutor"("ideagriId");

-- CreateIndex
CREATE INDEX "Reprodutor_propriedadeId_idx" ON "Reprodutor"("propriedadeId");

-- CreateIndex
CREATE INDEX "Reprodutor_racaId_idx" ON "Reprodutor"("racaId");

-- CreateIndex
CREATE INDEX "Reprodutor_centralSemenId_idx" ON "Reprodutor"("centralSemenId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorGenetico_ideagriId_key" ON "IndicadorGenetico"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorGenetico_sigla_key" ON "IndicadorGenetico"("sigla");

-- CreateIndex
CREATE INDEX "ValorIndicadorReprodutor_indicadorId_idx" ON "ValorIndicadorReprodutor"("indicadorId");

-- CreateIndex
CREATE UNIQUE INDEX "ValorIndicadorReprodutor_reprodutorId_indicadorId_key" ON "ValorIndicadorReprodutor"("reprodutorId", "indicadorId");

-- CreateIndex
CREATE UNIQUE INDEX "MarcadorGenetico_ideagriId_key" ON "MarcadorGenetico"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "MarcadorGenetico_sigla_key" ON "MarcadorGenetico"("sigla");

-- CreateIndex
CREATE INDEX "ValorMarcadorReprodutor_marcadorId_idx" ON "ValorMarcadorReprodutor"("marcadorId");

-- CreateIndex
CREATE UNIQUE INDEX "ValorMarcadorReprodutor_reprodutorId_marcadorId_key" ON "ValorMarcadorReprodutor"("reprodutorId", "marcadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Caseina_ideagriId_key" ON "Caseina"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "Caseina_sigla_key" ON "Caseina"("sigla");

-- CreateIndex
CREATE INDEX "ValorCaseinaReprodutor_caseinaId_idx" ON "ValorCaseinaReprodutor"("caseinaId");

-- CreateIndex
CREATE UNIQUE INDEX "ValorCaseinaReprodutor_reprodutorId_caseinaId_key" ON "ValorCaseinaReprodutor"("reprodutorId", "caseinaId");

-- CreateIndex
CREATE UNIQUE INDEX "PedigreeReprodutor_reprodutorId_key" ON "PedigreeReprodutor"("reprodutorId");

-- CreateIndex
CREATE UNIQUE INDEX "PedigreeReprodutor_ideagriId_key" ON "PedigreeReprodutor"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "TipoSemen_ideagriId_key" ON "TipoSemen"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "TipoSemen_sigla_key" ON "TipoSemen"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueSemen_ideagriId_key" ON "EstoqueSemen"("ideagriId");

-- CreateIndex
CREATE INDEX "EstoqueSemen_reprodutorId_idx" ON "EstoqueSemen"("reprodutorId");

-- CreateIndex
CREATE INDEX "EstoqueSemen_tipoSemenId_idx" ON "EstoqueSemen"("tipoSemenId");

-- CreateIndex
CREATE INDEX "EstoqueSemen_propriedadeId_idx" ON "EstoqueSemen"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "MedidaAcasalamento_ideagriId_key" ON "MedidaAcasalamento"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "MedidaAcasalamento_nome_key" ON "MedidaAcasalamento"("nome");

-- CreateIndex
CREATE INDEX "ItemMedidaAcasalamento_indicadorId_idx" ON "ItemMedidaAcasalamento"("indicadorId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemMedidaAcasalamento_medidaId_indicadorId_key" ON "ItemMedidaAcasalamento"("medidaId", "indicadorId");

-- CreateIndex
CREATE UNIQUE INDEX "CombinacaoMedidaAcasalamento_ideagriId_key" ON "CombinacaoMedidaAcasalamento"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "CombinacaoMedidaAcasalamento_nome_key" ON "CombinacaoMedidaAcasalamento"("nome");

-- CreateIndex
CREATE INDEX "ItemCombinacaoMedida_medidaId_idx" ON "ItemCombinacaoMedida"("medidaId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCombinacaoMedida_combinacaoId_medidaId_key" ON "ItemCombinacaoMedida"("combinacaoId", "medidaId");

-- CreateIndex
CREATE INDEX "PlanoAcasalamento_grupoId_idx" ON "PlanoAcasalamento"("grupoId");

-- CreateIndex
CREATE INDEX "PlanoAcasalamento_combinacaoId_idx" ON "PlanoAcasalamento"("combinacaoId");

-- CreateIndex
CREATE INDEX "PlanoAcasalamento_propriedadeId_idx" ON "PlanoAcasalamento"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoPlanoAcasalamento_planoId_versao_key" ON "VersaoPlanoAcasalamento"("planoId", "versao");

-- CreateIndex
CREATE INDEX "LinhaPlanoAcasalamento_femeaId_idx" ON "LinhaPlanoAcasalamento"("femeaId");

-- CreateIndex
CREATE INDEX "LinhaPlanoAcasalamento_reprodutorEscolhidoId_idx" ON "LinhaPlanoAcasalamento"("reprodutorEscolhidoId");

-- CreateIndex
CREATE UNIQUE INDEX "LinhaPlanoAcasalamento_versaoId_femeaId_key" ON "LinhaPlanoAcasalamento"("versaoId", "femeaId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbriaoClassificacao_ideagriId_key" ON "EmbriaoClassificacao"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbriaoClassificacao_sigla_key" ON "EmbriaoClassificacao"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Coleta_ideagriId_key" ON "Coleta"("ideagriId");

-- CreateIndex
CREATE INDEX "Coleta_doadoraId_idx" ON "Coleta"("doadoraId");

-- CreateIndex
CREATE INDEX "Coleta_propriedadeId_idx" ON "Coleta"("propriedadeId");

-- CreateIndex
CREATE INDEX "Coleta_aplicacaoPoolId_idx" ON "Coleta"("aplicacaoPoolId");

-- CreateIndex
CREATE UNIQUE INDEX "OocitoColeta_coletaId_qualidade_viavel_key" ON "OocitoColeta"("coletaId", "qualidade", "viavel");

-- CreateIndex
CREATE UNIQUE INDEX "FertilizacaoColeta_ideagriId_key" ON "FertilizacaoColeta"("ideagriId");

-- CreateIndex
CREATE INDEX "FertilizacaoColeta_coletaId_idx" ON "FertilizacaoColeta"("coletaId");

-- CreateIndex
CREATE INDEX "FertilizacaoColeta_reprodutorId_idx" ON "FertilizacaoColeta"("reprodutorId");

-- CreateIndex
CREATE INDEX "FertilizacaoColeta_estoqueSemenId_idx" ON "FertilizacaoColeta"("estoqueSemenId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbriaoColeta_ideagriId_key" ON "EmbriaoColeta"("ideagriId");

-- CreateIndex
CREATE INDEX "EmbriaoColeta_fertilizacaoId_idx" ON "EmbriaoColeta"("fertilizacaoId");

-- CreateIndex
CREATE INDEX "EmbriaoColeta_classificacaoId_idx" ON "EmbriaoColeta"("classificacaoId");

-- CreateIndex
CREATE INDEX "EmbriaoColeta_estado_idx" ON "EmbriaoColeta"("estado");

-- CreateIndex
CREATE INDEX "EmbriaoColeta_propriedadeId_idx" ON "EmbriaoColeta"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoPoolDoadora_ideagriId_key" ON "GrupoPoolDoadora"("ideagriId");

-- CreateIndex
CREATE INDEX "GrupoPoolDoadora_propriedadeId_idx" ON "GrupoPoolDoadora"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemGrupoPoolDoadora_grupoId_doadoraId_key" ON "ItemGrupoPoolDoadora"("grupoId", "doadoraId");

-- CreateIndex
CREATE INDEX "AplicacaoPoolDoadora_grupoId_idx" ON "AplicacaoPoolDoadora"("grupoId");

-- CreateIndex
CREATE INDEX "AplicacaoPoolDoadora_propriedadeId_idx" ON "AplicacaoPoolDoadora"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoPoolDoadora_grupoId_data_key" ON "AplicacaoPoolDoadora"("grupoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_nome_key" ON "Grupo"("nome");

-- CreateIndex
CREATE INDEX "Grupo_propriedadeId_idx" ON "Grupo"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Propriedade_nome_key" ON "Propriedade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Dieta_nome_key" ON "Dieta"("nome");

-- CreateIndex
CREATE INDEX "DietaItem_dietaId_idx" ON "DietaItem"("dietaId");

-- CreateIndex
CREATE UNIQUE INDEX "DietaItem_dietaId_produtoId_key" ON "DietaItem"("dietaId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_numero_key" ON "Animal"("numero");

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "Animal"("status");

-- CreateIndex
CREATE INDEX "Animal_finalidade_idx" ON "Animal"("finalidade");

-- CreateIndex
CREATE INDEX "Animal_grupoId_idx" ON "Animal"("grupoId");

-- CreateIndex
CREATE INDEX "Animal_propriedadeId_idx" ON "Animal"("propriedadeId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_animalId_idx" ON "MovimentacaoAnimal"("animalId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_tipo_idx" ON "MovimentacaoAnimal"("tipo");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_data_idx" ON "MovimentacaoAnimal"("data");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_propriedadeId_idx" ON "MovimentacaoAnimal"("propriedadeId");

-- CreateIndex
CREATE INDEX "FiltroAnimal_propriedadeId_idx" ON "FiltroAnimal"("propriedadeId");

-- CreateIndex
CREATE INDEX "ModeloFormularioCampo_propriedadeId_templateId_idx" ON "ModeloFormularioCampo"("propriedadeId", "templateId");

-- CreateIndex
CREATE INDEX "FolhaCampo_propriedadeId_status_idx" ON "FolhaCampo"("propriedadeId", "status");

-- CreateIndex
CREATE INDEX "FolhaCampo_templateId_idx" ON "FolhaCampo"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "LinhaFolhaCampo_eventoGeradoId_key" ON "LinhaFolhaCampo"("eventoGeradoId");

-- CreateIndex
CREATE INDEX "LinhaFolhaCampo_folhaId_status_idx" ON "LinhaFolhaCampo"("folhaId", "status");

-- CreateIndex
CREATE INDEX "LinhaFolhaCampo_animalId_idx" ON "LinhaFolhaCampo"("animalId");

-- CreateIndex
CREATE INDEX "LinhaFolhaCampo_eventoOrigemId_idx" ON "LinhaFolhaCampo"("eventoOrigemId");

-- CreateIndex
CREATE INDEX "LinhaFolhaCampo_resultadoTipo_resultadoId_idx" ON "LinhaFolhaCampo"("resultadoTipo", "resultadoId");

-- CreateIndex
CREATE UNIQUE INDEX "LinhaFolhaCampo_folhaId_ordem_key" ON "LinhaFolhaCampo"("folhaId", "ordem");

-- CreateIndex
CREATE INDEX "ExameQuarto_animalId_quarto_data_idx" ON "ExameQuarto"("animalId", "quarto", "data");

-- CreateIndex
CREATE INDEX "ExameQuarto_propriedadeId_idx" ON "ExameQuarto"("propriedadeId");

-- CreateIndex
CREATE INDEX "AptidaoAnimal_animalId_idx" ON "AptidaoAnimal"("animalId");

-- CreateIndex
CREATE INDEX "AptidaoAnimal_propriedadeId_idx" ON "AptidaoAnimal"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "AptidaoAnimal_animalId_data_origem_key" ON "AptidaoAnimal"("animalId", "data", "origem");

-- CreateIndex
CREATE UNIQUE INDEX "ResultadoExameGinecologico_codigo_key" ON "ResultadoExameGinecologico"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "EventoReprodutivo_ideagriId_key" ON "EventoReprodutivo"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoReprodutivo_origemExecucaoId_key" ON "EventoReprodutivo"("origemExecucaoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoReprodutivo_criaId_key" ON "EventoReprodutivo"("criaId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoReprodutivo_embriaoColetaId_key" ON "EventoReprodutivo"("embriaoColetaId");

-- CreateIndex
CREATE INDEX "EventoReprodutivo_animalId_data_idx" ON "EventoReprodutivo"("animalId", "data");

-- CreateIndex
CREATE INDEX "EventoReprodutivo_ideagriEmbriaoId_idx" ON "EventoReprodutivo"("ideagriEmbriaoId");

-- CreateIndex
CREATE INDEX "EventoReprodutivo_estoqueSemenId_idx" ON "EventoReprodutivo"("estoqueSemenId");

-- CreateIndex
CREATE INDEX "Lactacao_animalId_numero_idx" ON "Lactacao"("animalId", "numero");

-- CreateIndex
CREATE INDEX "Pesagem_animalId_data_idx" ON "Pesagem"("animalId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "EventoSanitario_movimentoEstoqueId_key" ON "EventoSanitario"("movimentoEstoqueId");

-- CreateIndex
CREATE INDEX "EventoSanitario_animalId_data_idx" ON "EventoSanitario"("animalId", "data");

-- CreateIndex
CREATE INDEX "EventoSanitario_produtoId_idx" ON "EventoSanitario"("produtoId");

-- CreateIndex
CREATE INDEX "VacinaAgendada_animalId_idx" ON "VacinaAgendada"("animalId");

-- CreateIndex
CREATE INDEX "VacinaAgendada_propriedadeId_idx" ON "VacinaAgendada"("propriedadeId");

-- CreateIndex
CREATE INDEX "VacinaAgendada_dataPrevista_idx" ON "VacinaAgendada"("dataPrevista");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocoloIATF_ideagriId_key" ON "ProtocoloIATF"("ideagriId");

-- CreateIndex
CREATE INDEX "ProtocoloIATF_propriedadeId_idx" ON "ProtocoloIATF"("propriedadeId");

-- CreateIndex
CREATE INDEX "ProtocoloIATF_ativo_idx" ON "ProtocoloIATF"("ativo");

-- CreateIndex
CREATE INDEX "EtapaProtocoloIATF_protocoloId_idx" ON "EtapaProtocoloIATF"("protocoloId");

-- CreateIndex
CREATE INDEX "PrincipioProtocoloIATF_protocoloId_idx" ON "PrincipioProtocoloIATF"("protocoloId");

-- CreateIndex
CREATE UNIQUE INDEX "PrincipioProtocoloIATF_protocoloId_dia_principio_produto_us_key" ON "PrincipioProtocoloIATF"("protocoloId", "dia", "principio", "produto", "uso");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoProtocoloIATF_ideagriId_key" ON "AplicacaoProtocoloIATF"("ideagriId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_animalId_idx" ON "AplicacaoProtocoloIATF"("animalId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_protocoloId_idx" ON "AplicacaoProtocoloIATF"("protocoloId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_programacaoId_idx" ON "AplicacaoProtocoloIATF"("programacaoId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_propriedadeId_idx" ON "AplicacaoProtocoloIATF"("propriedadeId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_dataInicio_idx" ON "AplicacaoProtocoloIATF"("dataInicio");

-- CreateIndex
CREATE INDEX "ExecucaoEtapaIATF_aplicacaoId_status_idx" ON "ExecucaoEtapaIATF"("aplicacaoId", "status");

-- CreateIndex
CREATE INDEX "ExecucaoEtapaIATF_dataPlanejada_idx" ON "ExecucaoEtapaIATF"("dataPlanejada");

-- CreateIndex
CREATE UNIQUE INDEX "ExecucaoEtapaIATF_aplicacaoId_dia_ordem_key" ON "ExecucaoEtapaIATF"("aplicacaoId", "dia", "ordem");

-- CreateIndex
CREATE INDEX "ProtocoloSanitario_propriedadeId_idx" ON "ProtocoloSanitario"("propriedadeId");

-- CreateIndex
CREATE INDEX "ProtocoloSanitario_ativo_idx" ON "ProtocoloSanitario"("ativo");

-- CreateIndex
CREATE INDEX "EtapaProtocoloSanitario_protocoloId_idx" ON "EtapaProtocoloSanitario"("protocoloId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloSanitario_animalId_idx" ON "AplicacaoProtocoloSanitario"("animalId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloSanitario_protocoloId_idx" ON "AplicacaoProtocoloSanitario"("protocoloId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloSanitario_propriedadeId_idx" ON "AplicacaoProtocoloSanitario"("propriedadeId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloSanitario_dataInicio_idx" ON "AplicacaoProtocoloSanitario"("dataInicio");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramacaoIATFLote_ideagriId_key" ON "ProgramacaoIATFLote"("ideagriId");

-- CreateIndex
CREATE INDEX "ProgramacaoIATFLote_propriedadeId_idx" ON "ProgramacaoIATFLote"("propriedadeId");

-- CreateIndex
CREATE INDEX "ProgramacaoIATFLote_grupoId_idx" ON "ProgramacaoIATFLote"("grupoId");

-- CreateIndex
CREATE INDEX "ProgramacaoIATFLote_dataInicio_idx" ON "ProgramacaoIATFLote"("dataInicio");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoEstoque_reversaoDeId_key" ON "MovimentoEstoque"("reversaoDeId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_produtoId_data_idx" ON "MovimentoEstoque"("produtoId", "data");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_tipo_data_idx" ON "MovimentoEstoque"("tipo", "data");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_operacaoId_idx" ON "MovimentoEstoque"("operacaoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_itemOperacaoId_idx" ON "MovimentoEstoque"("itemOperacaoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_consumoPeriodoId_idx" ON "MovimentoEstoque"("consumoPeriodoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_propriedadeId_idx" ON "MovimentoEstoque"("propriedadeId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_centroCustoId_idx" ON "MovimentoEstoque"("centroCustoId");

-- CreateIndex
CREATE INDEX "ConsumoPeriodo_grupoId_idx" ON "ConsumoPeriodo"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumoPeriodo_grupoId_dataInicio_dataFim_key" ON "ConsumoPeriodo"("grupoId", "dataInicio", "dataFim");

-- CreateIndex
CREATE UNIQUE INDEX "VariedadeCafe_nome_key" ON "VariedadeCafe"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Lavoura_nome_key" ON "Lavoura"("nome");

-- CreateIndex
CREATE INDEX "Lavoura_propriedadeId_idx" ON "Lavoura"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoAdubacao_nome_key" ON "PlanoAdubacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Talhao_codigo_key" ON "Talhao"("codigo");

-- CreateIndex
CREATE INDEX "Talhao_estado_idx" ON "Talhao"("estado");

-- CreateIndex
CREATE INDEX "Talhao_lavouraId_idx" ON "Talhao"("lavouraId");

-- CreateIndex
CREATE INDEX "Talhao_propriedadeId_idx" ON "Talhao"("propriedadeId");

-- CreateIndex
CREATE INDEX "SafraTalhao_ano_idx" ON "SafraTalhao"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "SafraTalhao_talhaoId_ano_key" ON "SafraTalhao"("talhaoId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAgricola_movimentoEstoqueId_key" ON "OperacaoAgricola"("movimentoEstoqueId");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAgricola_operacaoFinanceiraId_key" ON "OperacaoAgricola"("operacaoFinanceiraId");

-- CreateIndex
CREATE INDEX "OperacaoAgricola_talhaoId_data_idx" ON "OperacaoAgricola"("talhaoId", "data");

-- CreateIndex
CREATE INDEX "OperacaoAgricola_dominio_data_idx" ON "OperacaoAgricola"("dominio", "data");

-- CreateIndex
CREATE INDEX "OperacaoAgricola_produtoId_idx" ON "OperacaoAgricola"("produtoId");

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
CREATE INDEX "LoteCorte_propriedadeId_idx" ON "LoteCorte"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Piquete_codigo_key" ON "Piquete"("codigo");

-- CreateIndex
CREATE INDEX "Piquete_propriedadeId_idx" ON "Piquete"("propriedadeId");

-- CreateIndex
CREATE INDEX "PesagemLote_loteId_data_idx" ON "PesagemLote"("loteId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ManejoSanitario_operacaoFinanceiraId_key" ON "ManejoSanitario"("operacaoFinanceiraId");

-- CreateIndex
CREATE INDEX "ManejoSanitario_loteId_data_idx" ON "ManejoSanitario"("loteId", "data");

-- CreateIndex
CREATE INDEX "ManejoSanitario_tipo_data_idx" ON "ManejoSanitario"("tipo", "data");

-- CreateIndex
CREATE INDEX "Suplementacao_loteId_dataInicio_idx" ON "Suplementacao"("loteId", "dataInicio");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoComercial_operacaoFinanceiraId_key" ON "OperacaoComercial"("operacaoFinanceiraId");

-- CreateIndex
CREATE INDEX "OperacaoComercial_loteId_data_idx" ON "OperacaoComercial"("loteId", "data");

-- CreateIndex
CREATE INDEX "OperacaoComercial_tipo_data_idx" ON "OperacaoComercial"("tipo", "data");

-- CreateIndex
CREATE INDEX "Funcionario_ativo_idx" ON "Funcionario"("ativo");

-- CreateIndex
CREATE INDEX "Funcionario_propriedadeId_idx" ON "Funcionario"("propriedadeId");

-- CreateIndex
CREATE INDEX "RegistroPonto_funcionarioId_data_idx" ON "RegistroPonto"("funcionarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPonto_funcionarioId_data_key" ON "RegistroPonto"("funcionarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioWhatsapp_telefone_key" ON "UsuarioWhatsapp"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "ConversaWhatsapp_telefone_key" ON "ConversaWhatsapp"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsapp_waMessageId_key" ON "MensagemWhatsapp"("waMessageId");

-- CreateIndex
CREATE INDEX "MensagemWhatsapp_conversaId_createdAt_idx" ON "MensagemWhatsapp"("conversaId", "createdAt");

-- CreateIndex
CREATE INDEX "SafraCultivo_cultura_ano_idx" ON "SafraCultivo"("cultura", "ano");

-- CreateIndex
CREATE INDEX "SafraCultivo_propriedadeId_idx" ON "SafraCultivo"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaCultivo_safraCultivoId_codigo_key" ON "AreaCultivo"("safraCultivoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "LancamentoCusto_operacaoFinanceiraId_key" ON "LancamentoCusto"("operacaoFinanceiraId");

-- CreateIndex
CREATE INDEX "LancamentoCusto_safraCultivoId_data_idx" ON "LancamentoCusto"("safraCultivoId", "data");

-- CreateIndex
CREATE INDEX "LancamentoCusto_classe_idx" ON "LancamentoCusto"("classe");

-- CreateIndex
CREATE INDEX "ProducaoCultivo_safraCultivoId_data_idx" ON "ProducaoCultivo"("safraCultivoId", "data");

-- CreateIndex
CREATE INDEX "Silo_propriedadeId_idx" ON "Silo"("propriedadeId");

-- CreateIndex
CREATE INDEX "MovimentoSilo_siloId_data_idx" ON "MovimentoSilo"("siloId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ResumoSafraCultivo_safraCultivoId_key" ON "ResumoSafraCultivo"("safraCultivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenAcesso_tokenHash_key" ON "TokenAcesso"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenAcesso_usuarioId_idx" ON "TokenAcesso"("usuarioId");

-- AddForeignKey
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroChuva" ADD CONSTRAINT "RegistroChuva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCentroCusto" ADD CONSTRAINT "ProdutoCentroCusto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCentroCusto" ADD CONSTRAINT "ProdutoCentroCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParceiroPapel" ADD CONSTRAINT "ParceiroPapel_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoFinanceiro" ADD CONSTRAINT "PeriodoFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoFinanceiro" ADD CONSTRAINT "PeriodoFinanceiro_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_corrigeOperacaoId_fkey" FOREIGN KEY ("corrigeOperacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao" ADD CONSTRAINT "Operacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RascunhoOperacao" ADD CONSTRAINT "RascunhoOperacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RascunhoOperacao" ADD CONSTRAINT "RascunhoOperacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RascunhoRelatorioFinanceiro" ADD CONSTRAINT "RascunhoRelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RascunhoRelatorioFinanceiro" ADD CONSTRAINT "RascunhoRelatorioFinanceiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioFinanceiro" ADD CONSTRAINT "RelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioFinanceiro" ADD CONSTRAINT "RelatorioFinanceiro_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromissoFinanceiro" ADD CONSTRAINT "CompromissoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromissoFinanceiro" ADD CONSTRAINT "CompromissoFinanceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoFinanceira" ADD CONSTRAINT "TransacaoFinanceira_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES "TransacaoFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoConta" ADD CONSTRAINT "MovimentoConta_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoFinanceira"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoConta" ADD CONSTRAINT "MovimentoConta_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacao" ADD CONSTRAINT "Liquidacao_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "CompromissoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacao" ADD CONSTRAINT "Liquidacao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "CompromissoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFinanceiro" ADD CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES "RascunhoOperacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaFinanceira" ADD CONSTRAINT "AuditoriaFinanceira_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControleLeiteiro" ADD CONSTRAINT "ControleLeiteiro_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoLote" ADD CONSTRAINT "ProducaoLote_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoLote" ADD CONSTRAINT "ProducaoLote_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tanque" ADD CONSTRAINT "Tanque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseTanque" ADD CONSTRAINT "AnaliseTanque_tanqueId_fkey" FOREIGN KEY ("tanqueId") REFERENCES "Tanque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentralSemen" ADD CONSTRAINT "CentralSemen_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reprodutor" ADD CONSTRAINT "Reprodutor_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "Raca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reprodutor" ADD CONSTRAINT "Reprodutor_centralSemenId_fkey" FOREIGN KEY ("centralSemenId") REFERENCES "CentralSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reprodutor" ADD CONSTRAINT "Reprodutor_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorIndicadorReprodutor" ADD CONSTRAINT "ValorIndicadorReprodutor_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorIndicadorReprodutor" ADD CONSTRAINT "ValorIndicadorReprodutor_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "IndicadorGenetico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorMarcadorReprodutor" ADD CONSTRAINT "ValorMarcadorReprodutor_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorMarcadorReprodutor" ADD CONSTRAINT "ValorMarcadorReprodutor_marcadorId_fkey" FOREIGN KEY ("marcadorId") REFERENCES "MarcadorGenetico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCaseinaReprodutor" ADD CONSTRAINT "ValorCaseinaReprodutor_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCaseinaReprodutor" ADD CONSTRAINT "ValorCaseinaReprodutor_caseinaId_fkey" FOREIGN KEY ("caseinaId") REFERENCES "Caseina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedigreeReprodutor" ADD CONSTRAINT "PedigreeReprodutor_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueSemen" ADD CONSTRAINT "EstoqueSemen_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueSemen" ADD CONSTRAINT "EstoqueSemen_tipoSemenId_fkey" FOREIGN KEY ("tipoSemenId") REFERENCES "TipoSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueSemen" ADD CONSTRAINT "EstoqueSemen_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMedidaAcasalamento" ADD CONSTRAINT "ItemMedidaAcasalamento_medidaId_fkey" FOREIGN KEY ("medidaId") REFERENCES "MedidaAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMedidaAcasalamento" ADD CONSTRAINT "ItemMedidaAcasalamento_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "IndicadorGenetico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCombinacaoMedida" ADD CONSTRAINT "ItemCombinacaoMedida_combinacaoId_fkey" FOREIGN KEY ("combinacaoId") REFERENCES "CombinacaoMedidaAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCombinacaoMedida" ADD CONSTRAINT "ItemCombinacaoMedida_medidaId_fkey" FOREIGN KEY ("medidaId") REFERENCES "MedidaAcasalamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoAcasalamento" ADD CONSTRAINT "PlanoAcasalamento_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoAcasalamento" ADD CONSTRAINT "PlanoAcasalamento_combinacaoId_fkey" FOREIGN KEY ("combinacaoId") REFERENCES "CombinacaoMedidaAcasalamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoAcasalamento" ADD CONSTRAINT "PlanoAcasalamento_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersaoPlanoAcasalamento" ADD CONSTRAINT "VersaoPlanoAcasalamento_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaPlanoAcasalamento" ADD CONSTRAINT "LinhaPlanoAcasalamento_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoPlanoAcasalamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaPlanoAcasalamento" ADD CONSTRAINT "LinhaPlanoAcasalamento_femeaId_fkey" FOREIGN KEY ("femeaId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaPlanoAcasalamento" ADD CONSTRAINT "LinhaPlanoAcasalamento_reprodutorEscolhidoId_fkey" FOREIGN KEY ("reprodutorEscolhidoId") REFERENCES "Reprodutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coleta" ADD CONSTRAINT "Coleta_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coleta" ADD CONSTRAINT "Coleta_aplicacaoPoolId_fkey" FOREIGN KEY ("aplicacaoPoolId") REFERENCES "AplicacaoPoolDoadora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coleta" ADD CONSTRAINT "Coleta_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OocitoColeta" ADD CONSTRAINT "OocitoColeta_coletaId_fkey" FOREIGN KEY ("coletaId") REFERENCES "Coleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertilizacaoColeta" ADD CONSTRAINT "FertilizacaoColeta_coletaId_fkey" FOREIGN KEY ("coletaId") REFERENCES "Coleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertilizacaoColeta" ADD CONSTRAINT "FertilizacaoColeta_reprodutorId_fkey" FOREIGN KEY ("reprodutorId") REFERENCES "Reprodutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertilizacaoColeta" ADD CONSTRAINT "FertilizacaoColeta_estoqueSemenId_fkey" FOREIGN KEY ("estoqueSemenId") REFERENCES "EstoqueSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbriaoColeta" ADD CONSTRAINT "EmbriaoColeta_fertilizacaoId_fkey" FOREIGN KEY ("fertilizacaoId") REFERENCES "FertilizacaoColeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbriaoColeta" ADD CONSTRAINT "EmbriaoColeta_classificacaoId_fkey" FOREIGN KEY ("classificacaoId") REFERENCES "EmbriaoClassificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbriaoColeta" ADD CONSTRAINT "EmbriaoColeta_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoPoolDoadora" ADD CONSTRAINT "GrupoPoolDoadora_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGrupoPoolDoadora" ADD CONSTRAINT "ItemGrupoPoolDoadora_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoPoolDoadora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGrupoPoolDoadora" ADD CONSTRAINT "ItemGrupoPoolDoadora_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoPoolDoadora" ADD CONSTRAINT "AplicacaoPoolDoadora_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoPoolDoadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoPoolDoadora" ADD CONSTRAINT "AplicacaoPoolDoadora_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "Dieta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietaItem" ADD CONSTRAINT "DietaItem_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "Dieta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietaItem" ADD CONSTRAINT "DietaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "Raca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_maeId_fkey" FOREIGN KEY ("maeId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiltroAnimal" ADD CONSTRAINT "FiltroAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloFormularioCampo" ADD CONSTRAINT "ModeloFormularioCampo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaCampo" ADD CONSTRAINT "FolhaCampo_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloFormularioCampo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaCampo" ADD CONSTRAINT "FolhaCampo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_folhaId_fkey" FOREIGN KEY ("folhaId") REFERENCES "FolhaCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_eventoOrigemId_fkey" FOREIGN KEY ("eventoOrigemId") REFERENCES "EventoReprodutivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaFolhaCampo" ADD CONSTRAINT "LinhaFolhaCampo_eventoGeradoId_fkey" FOREIGN KEY ("eventoGeradoId") REFERENCES "EventoReprodutivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoAnimal" ADD CONSTRAINT "ResumoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExameQuarto" ADD CONSTRAINT "ExameQuarto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExameQuarto" ADD CONSTRAINT "ExameQuarto_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AptidaoAnimal" ADD CONSTRAINT "AptidaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AptidaoAnimal" ADD CONSTRAINT "AptidaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_estoqueSemenId_fkey" FOREIGN KEY ("estoqueSemenId") REFERENCES "EstoqueSemen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_resultadoGinecologicoId_fkey" FOREIGN KEY ("resultadoGinecologicoId") REFERENCES "ResultadoExameGinecologico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_embriaoColetaId_fkey" FOREIGN KEY ("embriaoColetaId") REFERENCES "EmbriaoColeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lactacao" ADD CONSTRAINT "Lactacao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesagem" ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacinaAgendada" ADD CONSTRAINT "VacinaAgendada_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacinaAgendada" ADD CONSTRAINT "VacinaAgendada_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocoloIATF" ADD CONSTRAINT "ProtocoloIATF_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaProtocoloIATF" ADD CONSTRAINT "EtapaProtocoloIATF_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrincipioProtocoloIATF" ADD CONSTRAINT "PrincipioProtocoloIATF_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES "ProgramacaoIATFLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoEtapaIATF" ADD CONSTRAINT "ExecucaoEtapaIATF_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES "AplicacaoProtocoloIATF"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocoloSanitario" ADD CONSTRAINT "ProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaProtocoloSanitario" ADD CONSTRAINT "EtapaProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloSanitario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloSanitario" ADD CONSTRAINT "AplicacaoProtocoloSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloSanitario" ADD CONSTRAINT "AplicacaoProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloSanitario" ADD CONSTRAINT "AplicacaoProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacaoIATFLote" ADD CONSTRAINT "ProgramacaoIATFLote_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacaoIATFLote" ADD CONSTRAINT "ProgramacaoIATFLote_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramacaoIATFLote" ADD CONSTRAINT "ProgramacaoIATFLote_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey" FOREIGN KEY ("itemOperacaoId") REFERENCES "ItemOperacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey" FOREIGN KEY ("consumoPeriodoId") REFERENCES "ConsumoPeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoPeriodo" ADD CONSTRAINT "ConsumoPeriodo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoPeriodo" ADD CONSTRAINT "ConsumoPeriodo_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "Dieta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lavoura" ADD CONSTRAINT "Lavoura_planoAdubacaoId_fkey" FOREIGN KEY ("planoAdubacaoId") REFERENCES "PlanoAdubacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lavoura" ADD CONSTRAINT "Lavoura_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_variedadeId_fkey" FOREIGN KEY ("variedadeId") REFERENCES "VariedadeCafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_lavouraId_fkey" FOREIGN KEY ("lavouraId") REFERENCES "Lavoura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoTalhao" ADD CONSTRAINT "ResumoTalhao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafraTalhao" ADD CONSTRAINT "SafraTalhao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAgricola" ADD CONSTRAINT "OperacaoAgricola_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "LoteCorte" ADD CONSTRAINT "LoteCorte_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoLote" ADD CONSTRAINT "ResumoLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piquete" ADD CONSTRAINT "Piquete_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesagemLote" ADD CONSTRAINT "PesagemLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManejoSanitario" ADD CONSTRAINT "ManejoSanitario_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManejoSanitario" ADD CONSTRAINT "ManejoSanitario_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suplementacao" ADD CONSTRAINT "Suplementacao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoComercial" ADD CONSTRAINT "OperacaoComercial_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteCorte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoComercial" ADD CONSTRAINT "OperacaoComercial_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPonto" ADD CONSTRAINT "RegistroPonto_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaWhatsapp" ADD CONSTRAINT "ConversaWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioWhatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemWhatsapp" ADD CONSTRAINT "MensagemWhatsapp_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaWhatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafraCultivo" ADD CONSTRAINT "SafraCultivo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaCultivo" ADD CONSTRAINT "AreaCultivo_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_areaCultivoId_fkey" FOREIGN KEY ("areaCultivoId") REFERENCES "AreaCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_operacaoFinanceiraId_fkey" FOREIGN KEY ("operacaoFinanceiraId") REFERENCES "Operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoCultivo" ADD CONSTRAINT "ProducaoCultivo_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoCultivo" ADD CONSTRAINT "ProducaoCultivo_areaCultivoId_fkey" FOREIGN KEY ("areaCultivoId") REFERENCES "AreaCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoCultivo" ADD CONSTRAINT "ProducaoCultivo_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "Silo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Silo" ADD CONSTRAINT "Silo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoSilo" ADD CONSTRAINT "MovimentoSilo_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "Silo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoSilo" ADD CONSTRAINT "MovimentoSilo_producaoCultivoId_fkey" FOREIGN KEY ("producaoCultivoId") REFERENCES "ProducaoCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoSafraCultivo" ADD CONSTRAINT "ResumoSafraCultivo_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenAcesso" ADD CONSTRAINT "TokenAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

