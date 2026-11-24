-- Baseline estrutural da cadeia 4271f299, baseada no catálogo PostgreSQL local.
-- A equivalência à cadeia original deve ser verificada em CI antes de uso.
-- Instalação vazia somente; não reconcilia bancos existentes.
BEGIN;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Homebrew)
-- Dumped by pg_dump version 15.12 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pecuaria; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS pecuaria;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: AptidaoAnimal; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."AptidaoAnimal" AS ENUM (
    'LEITE',
    'CORTE',
    'REPRODUCAO'
);


--
-- Name: ClasseMotivoBaixa; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."ClasseMotivoBaixa" AS ENUM (
    'DESCARTE_VOLUNTARIO',
    'DESCARTE_INVOLUNTARIO',
    'MORTE'
);


--
-- Name: CriterioPartos; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."CriterioPartos" AS ENUM (
    'QUALQUER',
    'SEM',
    'COM'
);


--
-- Name: FinalidadeAplicacao; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."FinalidadeAplicacao" AS ENUM (
    'TRATAMENTO',
    'VACINA',
    'VERMIFUGO'
);


--
-- Name: FinalidadeProtocolo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."FinalidadeProtocolo" AS ENUM (
    'SANITARIO',
    'PRE_SINCRONIZACAO',
    'IATF',
    'TETF'
);


--
-- Name: OrigemAnimal; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."OrigemAnimal" AS ENUM (
    'NASCIDO',
    'COMPRADO'
);


--
-- Name: OrigemCalendarioProtocolo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."OrigemCalendarioProtocolo" AS ENUM (
    'REFERENCIA_PROGRAMADA',
    'INICIO_EFETIVO_LEGADO'
);


--
-- Name: OrigemComposicao; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."OrigemComposicao" AS ENUM (
    'INFORMADA',
    'CALCULADA'
);


--
-- Name: OrigemInsumoSanitario; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."OrigemInsumoSanitario" AS ENUM (
    'BAIXA_ESTOQUE',
    'COMPRA_CONSUMO_DIRETO',
    'INCLUSO_SERVICO',
    'SEM_ORIGEM_JUSTIFICADA',
    'HISTORICO_IMPORTADO'
);


--
-- Name: OrigemPesagem; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."OrigemPesagem" AS ENUM (
    'MANUAL',
    'BALANCA'
);


--
-- Name: PapelReprodutivo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."PapelReprodutivo" AS ENUM (
    'NENHUM',
    'RECEPTORA',
    'DOADORA'
);


--
-- Name: PrecisaoCalendarioProtocolo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."PrecisaoCalendarioProtocolo" AS ENUM (
    'DIA',
    'HORA'
);


--
-- Name: SexoBovino; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."SexoBovino" AS ENUM (
    'F',
    'M'
);


--
-- Name: StatusFatoPecuariaV3; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."StatusFatoPecuariaV3" AS ENUM (
    'VALIDO',
    'ANULADO'
);


--
-- Name: StatusFechamentoConsumo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."StatusFechamentoConsumo" AS ENUM (
    'CONFIRMADO',
    'ESTORNADO'
);


--
-- Name: TipoBaixa; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."TipoBaixa" AS ENUM (
    'VENDA',
    'ABATE',
    'MORTE',
    'DOACAO',
    'EXTRAVIO',
    'CADASTRO_INDEVIDO',
    'NAO_DETERMINADO',
    'COMPRA_ESTORNADA'
);


--
-- Name: TipoEventoTarefaProtocolo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."TipoEventoTarefaProtocolo" AS ENUM (
    'NAO_ATENDIDO',
    'ADIAMENTO',
    'RETIFICACAO_JUSTIFICATIVA',
    'DISPENSA'
);


--
-- Name: TipoMaterialGenetico; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."TipoMaterialGenetico" AS ENUM (
    'SEMEN',
    'EMBRIAO'
);


--
-- Name: TipoPesagem; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."TipoPesagem" AS ENUM (
    'NASCIMENTO',
    'ENTRADA',
    'DESMAMA',
    'ROTINA',
    'SAIDA',
    'PARTO',
    'SECAGEM'
);


--
-- Name: TipoProtocolo; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."TipoProtocolo" AS ENUM (
    'SANITARIO',
    'REPRODUTIVO'
);


--
-- Name: TipoSemen; Type: TYPE; Schema: pecuaria; Owner: -
--

CREATE TYPE pecuaria."TipoSemen" AS ENUM (
    'CONVENCIONAL',
    'SEXADO_FEMEA',
    'SEXADO_MACHO'
);


--
-- Name: DirecaoMensagem; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DirecaoMensagem" AS ENUM (
    'IN',
    'OUT'
);


--
-- Name: DirecaoMovimentoConta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DirecaoMovimentoConta" AS ENUM (
    'ENTRADA',
    'SAIDA'
);


--
-- Name: FormaPagamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FormaPagamento" AS ENUM (
    'PIX',
    'TRANSFERENCIA_BANCARIA',
    'BOLETO',
    'DINHEIRO',
    'CARTAO',
    'CHEQUE',
    'DEBITO_AUTOMATICO',
    'OUTRO'
);


--
-- Name: OrigemMovimentoEstoque; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrigemMovimentoEstoque" AS ENUM (
    'COMPRA',
    'CONSUMO_DIRETO',
    'TRANSFERENCIA',
    'PRODUCAO',
    'DEVOLUCAO',
    'BONIFICACAO',
    'INVENTARIO_INICIAL',
    'APLICACAO',
    'PERDA',
    'AJUSTE_INVENTARIO',
    'SANIDADE',
    'NUTRICAO',
    'IDENTIFICACAO_PARTIDA',
    'REPRODUCAO',
    'RETIRADA_LEITE'
);


--
-- Name: PapelParceiro; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PapelParceiro" AS ENUM (
    'CLIENTE',
    'FORNECEDOR',
    'PRESTADOR_SERVICO',
    'FUNCIONARIO',
    'PROPRIETARIO',
    'OUTRO'
);


--
-- Name: StatusCompromisso; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusCompromisso" AS ENUM (
    'PENDENTE',
    'PARCIAL',
    'LIQUIDADO',
    'CANCELADO'
);


--
-- Name: StatusMovimentoEstoque; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusMovimentoEstoque" AS ENUM (
    'CONFIRMADO',
    'REVERTIDO'
);


--
-- Name: StatusOperacao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusOperacao" AS ENUM (
    'RASCUNHO',
    'CONFIRMADA',
    'CANCELADA'
);


--
-- Name: StatusPeriodoFinanceiro; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusPeriodoFinanceiro" AS ENUM (
    'ABERTO',
    'FECHADO'
);


--
-- Name: StatusRelatorioFinanceiro; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusRelatorioFinanceiro" AS ENUM (
    'PROCESSANDO',
    'CONCLUIDO',
    'FALHOU'
);


--
-- Name: StatusTransacaoFinanceira; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusTransacaoFinanceira" AS ENUM (
    'CONFIRMADA',
    'REVERTIDA'
);


--
-- Name: StatusUsuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusUsuario" AS ENUM (
    'PENDENTE',
    'ATIVO',
    'INATIVO'
);


--
-- Name: TipoBancario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoBancario" AS ENUM (
    'CORRENTE',
    'POUPANCA',
    'PAGAMENTO'
);


--
-- Name: TipoCompromisso; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoCompromisso" AS ENUM (
    'PAGAR',
    'RECEBER'
);


--
-- Name: TipoContaFinanceira; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoContaFinanceira" AS ENUM (
    'BANCO',
    'CAIXA',
    'APLICACAO'
);


--
-- Name: TipoDocumentoFinanceiro; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoDocumentoFinanceiro" AS ENUM (
    'NOTA_FISCAL',
    'BOLETO',
    'CONTRATO',
    'RECIBO',
    'COMPROVANTE',
    'JUSTIFICATIVA',
    'OUTRO'
);


--
-- Name: TipoMovimento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoMovimento" AS ENUM (
    'ENTRADA',
    'SAIDA',
    'AJUSTE'
);


--
-- Name: TipoOperacaoFinanceira; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoOperacaoFinanceira" AS ENUM (
    'COMPRA_ESTOQUE',
    'COMPRA_CONSUMO_DIRETO',
    'SERVICO',
    'VENDA',
    'APORTE',
    'RETIRADA',
    'TRANSFERENCIA_FINANCEIRA',
    'AJUSTE_ESTOQUE',
    'TRANSFERENCIA_ESTOQUE',
    'INVENTARIO_INICIAL',
    'BONIFICACAO',
    'DEVOLUCAO',
    'PRODUCAO',
    'COMPRA_ANIMAIS'
);


--
-- Name: TipoParceiro; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoParceiro" AS ENUM (
    'CLIENTE',
    'FORNECEDOR',
    'AMBOS',
    'FUNCIONARIO',
    'PROPRIETARIO',
    'OUTRO'
);


--
-- Name: TipoToken; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoToken" AS ENUM (
    'CONVITE',
    'RESET'
);


--
-- Name: TipoTransacaoFinanceira; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoTransacaoFinanceira" AS ENUM (
    'PAGAMENTO',
    'RECEBIMENTO',
    'TRANSFERENCIA',
    'APORTE',
    'RETIRADA',
    'AJUSTE',
    'REVERSAO'
);


--
-- Name: UnidadeMedida; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UnidadeMedida" AS ENUM (
    'UN',
    'KG',
    'G',
    'T',
    'L',
    'ML',
    'SC',
    'DOSE',
    'CX',
    'M',
    'HA'
);


--
-- Name: anular_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.anular_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'histórico comercial não pode ser apagado'; END IF;
 IF TG_TABLE_NAME='DemonstrativoLeite' THEN
  IF OLD.status<>'VALIDO' OR NEW.status<>'ANULADO' OR NEW.versao<>OLD.versao+1
   OR (to_jsonb(OLD)-ARRAY['status','versao','motivoAnulacao','anuladoEm'])<>(to_jsonb(NEW)-ARRAY['status','versao','motivoAnulacao','anuladoEm'])
  THEN RAISE EXCEPTION 'demonstrativo permite somente anulação identificada'; END IF;
 ELSE
  IF NOT OLD.ativo OR NEW.ativo OR (to_jsonb(OLD)-'ativo')<>(to_jsonb(NEW)-'ativo')
  THEN RAISE EXCEPTION 'parcela comercial permite somente desativação pela anulação do demonstrativo'; END IF;
 END IF; RETURN NEW;
END $$;


--
-- Name: atualizar_versao_parto_pesagem(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.atualizar_versao_parto_pesagem() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF ROW(NEW.data, NEW."pesoKg", NEW.tipo, NEW.origem, NEW.observacao)
      IS DISTINCT FROM ROW(OLD.data, OLD."pesoKg", OLD.tipo, OLD.origem, OLD.observacao) THEN
    UPDATE pecuaria."PartoAnimal" p SET versao = p.versao + 1
      WHERE p.id IN (SELECT v."partoId" FROM pecuaria."VinculoPesagemParto" v
        WHERE v."pesagemId" = NEW.id AND v."revogadoEm" IS NULL);
  END IF;
  RETURN NEW;
END $$;


--
-- Name: compatibilizar_desfecho_parto(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.compatibilizar_desfecho_parto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.desfecho IS NOT NULL AND NEW.desfecho IS DISTINCT FROM
      (CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END) THEN
      RAISE EXCEPTION 'Tipo e desfecho do parto são contraditórios';
    END IF;
    IF NEW.tipo = 'DISTOCICO' AND NEW.dificuldade IS NULL THEN NEW.dificuldade := true; END IF;
  ELSIF NEW.tipo IS DISTINCT FROM OLD.tipo AND NEW.desfecho IS NOT DISTINCT FROM OLD.desfecho THEN
    NEW.desfecho := CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END;
  END IF;
  IF NEW.desfecho IS NULL THEN
    NEW.desfecho := CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: conferir_acompanhamento_colostragem(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_acompanhamento_colostragem() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE a record; e record; ident text;
BEGIN
 IF TG_TABLE_NAME='AcompanhamentoColostragem' THEN
  IF NEW."configuracaoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoBezerreiro" WHERE id=NEW."configuracaoId" AND "propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'Política do acompanhamento de outro sítio' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ExameImunidadeColostragem' THEN
  SELECT * INTO STRICT a FROM pecuaria."AcompanhamentoColostragem" WHERE id=NEW."acompanhamentoId";
  SELECT * INTO STRICT e FROM pecuaria."ExameAnimal" WHERE id=NEW."exameId";
  IF a."animalId"<>e."animalId" OR a."propriedadeId" IS DISTINCT FROM e."propriedadeId" THEN RAISE EXCEPTION 'Exame deve pertencer à cria acompanhada e ao sítio do acompanhamento' USING ERRCODE='23514'; END IF;
  IF NEW."ocorridoEm" IS NOT NULL AND (NEW."ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date<>e.data THEN RAISE EXCEPTION 'Data/hora incompatível com coleta do exame' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='VinculoFornecimentoColostragem' THEN
  SELECT * INTO STRICT a FROM pecuaria."AcompanhamentoColostragem" WHERE id=NEW."acompanhamentoId";
  IF NOT EXISTS(SELECT 1 FROM pecuaria."FornecimentoColostro" f JOIN pecuaria."CriaParto" c ON c.id=f."criaId" WHERE f.id=NEW."fornecimentoId" AND c."animalId"=a."animalId" AND f."propriedadeId"=a."propriedadeId") THEN RAISE EXCEPTION 'Fornecimento deve pertencer à cria acompanhada' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FornecimentoColostro' THEN
  IF EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=NEW.id AND ativo) AND
   ((SELECT COALESCE(sum("quantidadeLitros"),0) FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=NEW.id AND ativo) IS DISTINCT FROM NEW."quantidadeLitros" OR
    EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=NEW.id AND ativo AND NEW.status<>'VALIDO')) THEN RAISE EXCEPTION 'Fornecimento vinculado exige conservação e regularização das origens' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pecuaria."VinculoFornecimentoColostragem" v JOIN pecuaria."AcompanhamentoColostragem" acompanhamento ON acompanhamento.id=v."acompanhamentoId" JOIN pecuaria."CriaParto" c ON c.id=NEW."criaId" WHERE v."fornecimentoId"=NEW.id AND (c."animalId"<>acompanhamento."animalId" OR NEW."propriedadeId"<>acompanhamento."propriedadeId")) THEN RAISE EXCEPTION 'Alteração invalida vínculo com acompanhamento' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ExameAnimal' THEN
  IF EXISTS(SELECT 1 FROM pecuaria."ExameImunidadeColostragem" v JOIN pecuaria."AcompanhamentoColostragem" acompanhamento ON acompanhamento.id=v."acompanhamentoId" WHERE v."exameId"=NEW.id AND (acompanhamento."animalId"<>NEW."animalId" OR acompanhamento."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR (v."ocorridoEm" IS NOT NULL AND (v."ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date<>NEW.data))) THEN RAISE EXCEPTION 'Alteração invalida exame de imunidade vinculado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_afericao_origem_geral(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_afericao_origem_geral() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE g record; entrada record; dia date; ids text[]; animal_id text;
BEGIN
 IF TG_TABLE_NAME='EntradaProducaoLeite' THEN
  -- ANULADA preserva a versão anterior como evidência, sem exigir o cadastro atual.
  SELECT * INTO entrada FROM pecuaria."EntradaProducaoLeite" WHERE id=NEW.id;
  IF entrada."medicaoGeralId" IS NULL OR entrada.status<>'CONFIRMADA' THEN RETURN NEW; END IF;
  SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=entrada."medicaoGeralId";
  IF jsonb_typeof(entrada.snapshot->'animaisOrigem') IS DISTINCT FROM 'array' OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(g."animaisOrigem") id WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(entrada.snapshot->'animaisOrigem') a WHERE a->>'animalId'=id#>>'{}'))
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(entrada.snapshot->'animaisOrigem') a
    WHERE NOT (g."animaisOrigem" @> jsonb_build_array(a->>'animalId'))) THEN
   RAISE EXCEPTION 'Snapshot deve preservar exatamente os animais da aferição geral' USING ERRCODE='23514';
  END IF;
 ELSE
  -- A aferição pode ter recebido outra correção na mesma transação.
  SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=NEW.id;
 END IF;
 SELECT d."dataOperacional" INTO dia FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE s.id=g."sessaoId";
 SELECT array_agg(id) INTO ids FROM jsonb_array_elements_text(g."animaisOrigem") id;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 FOR animal_id IN SELECT DISTINCT unnest(ids) LOOP
  PERFORM pecuaria.conferir_historico_origem_geral(animal_id,dia,dia+1);
 END LOOP;
 RETURN NEW;
END $$;


--
-- Name: conferir_alteracao_fonte_custo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_alteracao_fonte_custo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF TG_TABLE_NAME='AplicacaoProduto' THEN
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."aplicacaoId"=NEW.id AND ((c."coberturaServico"<>'PROCEDIMENTO' AND (NEW."operacaoServicoId" IS NULL OR NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL)) OR (c."materialNaoAplicavel" AND NEW."valorProdutoAtribuido" IS NOT NULL) OR (c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."valorMaterialDocumentado" IS NOT NULL AND (NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL OR NEW."origemInsumo"<>'SEM_ORIGEM_JUSTIFICADA')))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo' USING ERRCODE='23514'; END IF;
  PERFORM pecuaria.conferir_capacidade_preparo('APLICACAO',NEW.id);
 ELSIF TG_TABLE_NAME='TentativaReprodutiva' THEN
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."tentativaId"=NEW.id AND ((c."coberturaServico"<>'PROCEDIMENTO' AND (NEW."operacaoServicoId" IS NULL OR NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL)) OR (c."materialNaoAplicavel" AND (NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL)) OR (c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."valorMaterialDocumentado" IS NOT NULL AND (NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL OR NEW."origemMaterial"<>'DOCUMENTADA')))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo da tentativa' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ExameAnimal' THEN
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."exameId"=NEW.id AND ((c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."coberturaServico"<>'PROCEDIMENTO' AND NEW."operacaoServicoId" IS NULL))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo' USING ERRCODE='23514'; END IF;
  PERFORM pecuaria.conferir_capacidade_preparo('EXAME',NEW.id);
 ELSE
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."participacaoId"=NEW.id AND ((c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."coberturaServico"<>'PROCEDIMENTO' AND NEW."operacaoServicoId" IS NULL))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo' USING ERRCODE='23514'; END IF;
  PERFORM pecuaria.conferir_capacidade_preparo('PARTICIPACAO',NEW.id);
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_amostra_qualidade_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_amostra_qualidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE e RECORD; t RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Amostra de qualidade é histórica; anule com motivo' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.sujeito,NEW."propriedadeId",NEW.data,NEW."tipoExameId",NEW."exameAnimalId",NEW."entradaId",NEW."origemColetiva",NEW."formatoSnapshot",NEW."origemColostroId") IS DISTINCT FROM (OLD.sujeito,OLD."propriedadeId",OLD.data,OLD."tipoExameId",OLD."exameAnimalId",OLD."entradaId",OLD."origemColetiva",OLD."formatoSnapshot",OLD."origemColostroId") THEN
    RAISE EXCEPTION 'Identidade e formato da amostra são históricos' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO t FROM pecuaria."TipoExame" WHERE id=NEW."tipoExameId" FOR UPDATE;
    IF t.id IS NULL OR t."tipoResultado"<>'MULTIPLO' THEN RAISE EXCEPTION 'Formato de qualidade inválido' USING ERRCODE='23514'; END IF;
    IF NEW.sujeito='ANIMAL' THEN
      SELECT * INTO e FROM pecuaria."ExameAnimal" WHERE id=NEW."exameAnimalId";
      IF e.id IS NULL OR e."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR e.data<>NEW.data OR e."tipoExameId"<>NEW."tipoExameId" THEN
        RAISE EXCEPTION 'Exame individual incompatível com amostra' USING ERRCODE='23514';
      END IF;
    ELSE
      IF NEW."formatoSnapshot"->>'tipoResultado' IS DISTINCT FROM 'MULTIPLO' OR NEW."formatoSnapshot"->'campos' IS DISTINCT FROM t.campos THEN
        RAISE EXCEPTION 'Snapshot coletivo incompatível com formato' USING ERRCODE='23514';
      END IF;
      IF NEW."entradaId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pecuaria."EntradaProducaoLeite" x JOIN pecuaria."SessaoOrdenha" s ON s.id=x."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
        WHERE x.id=NEW."entradaId" AND x.status='CONFIRMADA' AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"<=NEW.data
      ) THEN RAISE EXCEPTION 'Entrada incompatível com sítio/data da amostra' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  IF NEW."origemColostroId" IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM pecuaria."OrigemColostro" o LEFT JOIN pecuaria."LoteColostro" l ON l.id=o."loteColostroId"
   LEFT JOIN pecuaria."PreparoColostro" p ON p.id=o."preparoId"
   WHERE o.id=NEW."origemColostroId" AND o."propriedadeId"=NEW."propriedadeId" AND COALESCE(l.data,p.data)<=NEW.data
  ) THEN RAISE EXCEPTION 'Origem de colostro incompatível com sítio/data da amostra' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: conferir_apuracao_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_apuracao_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE eid TEXT;
BEGIN
  IF TG_TABLE_NAME='ApuracaoValorLeite' THEN eid:=NEW."entradaId";
  ELSE SELECT "entradaId" INTO eid FROM pecuaria."ApuracaoValorLeite" WHERE id=NEW."apuracaoId"; END IF;
  PERFORM pecuaria.conferir_valor_entrada_leite(eid);
  RETURN NULL;
END $$;


--
-- Name: conferir_cadeia_venda_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_cadeia_venda_leite(rid text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE m public."MovimentoEstoque"%ROWTYPE; v record; i public."ItemOperacao"%ROWTYPE;
  n integer; ultima integer; anterior text;
BEGIN
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=rid;
  IF NOT FOUND THEN RAISE EXCEPTION 'retirada da cadeia comercial não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
  IF m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m.tipo<>'SAIDA' OR m.origem<>'AJUSTE_INVENTARIO'
    OR m.status<>'CONFIRMADO' OR m."reversaoDeId" IS NOT NULL
    OR EXISTS (SELECT 1 FROM public."MovimentoEstoque" WHERE "reversaoDeId"=rid)
  THEN RAISE EXCEPTION 'correção comercial preserva a retirada física única, sem retorno'; END IF;
  SELECT count(*),max(versao) INTO n,ultima FROM pecuaria."VersaoComercialVendaLeite" WHERE "retiradaId"=rid;
  IF n=0 OR ultima<>n THEN RAISE EXCEPTION 'cadeia comercial deve ser contínua desde a versão um'; END IF;
  FOR v IN SELECT c.*,o.tipo,o.status,o.data,o."propriedadeId",o."corrigeOperacaoId"
      FROM pecuaria."VersaoComercialVendaLeite" c JOIN public."Operacao" o ON o.id=c."operacaoId"
      WHERE c."retiradaId"=rid ORDER BY c.versao LOOP
    IF v.tipo<>'VENDA' OR v.data<>m.data OR v."propriedadeId" IS DISTINCT FROM m."propriedadeId"
      OR (v.versao=1 AND (v."operacaoId"<>m."operacaoId" OR v."corrigeOperacaoId" IS NOT NULL))
      OR (v.versao>1 AND (v."corrigeOperacaoId" IS DISTINCT FROM anterior OR v.chave IS NULL))
    THEN RAISE EXCEPTION 'cadeia comercial diverge da retirada ou da versão anterior'; END IF;
    IF (v.versao=ultima AND v.status<>'CONFIRMADA') OR (v.versao<ultima AND v.status<>'CANCELADA')
    THEN RAISE EXCEPTION 'somente a última versão comercial permanece confirmada'; END IF;
    SELECT * INTO i FROM public."ItemOperacao" WHERE "operacaoId"=v."operacaoId" ORDER BY ordem LIMIT 1;
    IF NOT FOUND OR (SELECT count(*) FROM public."ItemOperacao" WHERE "operacaoId"=v."operacaoId")<>1
      OR i."produtoId" IS DISTINCT FROM m."produtoId" OR i.quantidade<>m.quantidade OR i.unidade<>'L' OR NOT i.estocavel
    THEN RAISE EXCEPTION 'correção comercial conserva produto, litros e unidade da retirada'; END IF;
    IF (SELECT count(*) FROM public."MovimentoEstoque" WHERE "operacaoId"=v."operacaoId")<>(CASE WHEN v.versao=1 THEN 1 ELSE 0 END)
    THEN RAISE EXCEPTION 'substituta comercial não cria outro movimento de estoque'; END IF;
    IF v.versao<ultima AND (
      EXISTS (SELECT 1 FROM public."TransacaoFinanceira" t WHERE t."operacaoId"=v."operacaoId" AND t.status='CONFIRMADA' AND t.tipo<>'REVERSAO')
      OR EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" c WHERE c."operacaoId"=v."operacaoId" AND c.status<>'CANCELADO')
      OR EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" c JOIN public."Liquidacao" l ON l."compromissoId"=c.id
        JOIN public."TransacaoFinanceira" t ON t.id=l."transacaoId" WHERE c."operacaoId"=v."operacaoId" AND t.status='CONFIRMADA')
    ) THEN RAISE EXCEPTION 'estorne explicitamente recebimentos antes da correção e cancele compromissos substituídos'; END IF;
    IF EXISTS (SELECT 1 FROM public."Operacao" o WHERE o."corrigeOperacaoId"=v."operacaoId"
      AND NOT EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" c WHERE c."operacaoId"=o.id AND c."retiradaId"=rid AND c.versao=v.versao+1))
    THEN RAISE EXCEPTION 'correção de venda leiteira exige vínculo linear com a mesma retirada'; END IF;
    anterior:=v."operacaoId";
  END LOOP;
END $$;


--
-- Name: conferir_capacidade_preparo(text, text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_capacidade_preparo(tipo text, fonte_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE material NUMERIC; servico NUMERIC; soma_material NUMERIC; soma_servico NUMERIC; qtd INTEGER; integrais INTEGER;
BEGIN
 IF tipo='APLICACAO' THEN
  SELECT COALESCE(a."valorProdutoAtribuido", c."valorMaterialDocumentado"),a."valorServicoAtribuido" INTO material,servico FROM pecuaria."AplicacaoProduto" a LEFT JOIN pecuaria."ClassificacaoCustoPecuaria" c ON c."aplicacaoId"=a.id WHERE a.id=fonte_id;
 ELSIF tipo='EXAME' THEN SELECT NULL::NUMERIC,e."valorServicoAtribuido" INTO material,servico FROM pecuaria."ExameAnimal" e WHERE e.id=fonte_id;
 ELSE SELECT NULL::NUMERIC,p."valorServicoAtribuido" INTO material,servico FROM pecuaria."ParticipacaoProtocolo" p WHERE p.id=fonte_id;
 END IF;
 SELECT count(*),count(*) FILTER(WHERE modo='INTEGRAL'),sum("valorMaterial"),sum("valorServico") INTO qtd,integrais,soma_material,soma_servico FROM pecuaria."VinculoPreparoTentativa" v
 WHERE v."encerradoEm" IS NULL AND ((tipo='APLICACAO' AND v."aplicacaoId"=fonte_id) OR (tipo='EXAME' AND v."exameId"=fonte_id) OR (tipo='PARTICIPACAO' AND v."participacaoId"=fonte_id));
 IF (integrais>0 AND qtd>1) OR (soma_material IS NOT NULL AND (material IS NULL OR soma_material>material)) OR (soma_servico IS NOT NULL AND (servico IS NULL OR soma_servico>servico)) THEN RAISE EXCEPTION 'correção excede capacidade dos preparatórios atribuídos' USING ERRCODE='23514'; END IF;
END $$;


--
-- Name: conferir_ciclo_elegibilidade(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_ciclo_elegibilidade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE inicial pecuaria."SituacaoInicialReprodutiva"%ROWTYPE; parto pecuaria."PartoAnimal"%ROWTYPE; politica pecuaria."PoliticaElegibilidadeReprodutiva"%ROWTYPE;
BEGIN
 IF NEW."partoId" IS NOT NULL THEN
  SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id=NEW."partoId" FOR UPDATE;
  IF parto."animalId"<>NEW."animalId" OR parto.data<>NEW."inicioCiclo" OR parto.status<>'VALIDO' THEN RAISE EXCEPTION 'Vínculo de ciclo incompatível com matriz ou data do parto'; END IF;
 END IF;
 IF NEW."situacaoInicialId" IS NOT NULL THEN
  SELECT * INTO STRICT inicial FROM pecuaria."SituacaoInicialReprodutiva" WHERE id=NEW."situacaoInicialId";
  IF inicial.status<>'VALIDO' OR inicial."animalId"<>NEW."animalId" OR inicial.data<>NEW."inicioCiclo" THEN
   RAISE EXCEPTION 'Fonte inicial incompatível com matriz ou data do ciclo';
  END IF;
 END IF;
 IF NEW."politicaId" IS NOT NULL THEN
  SELECT * INTO STRICT politica FROM pecuaria."PoliticaElegibilidadeReprodutiva" WHERE id=NEW."politicaId";
  IF politica."propriedadeId"<>NEW."propriedadeId" OR politica."vigenteDesde">NEW."inicioCiclo" THEN RAISE EXCEPTION 'Política incompatível com sítio ou data do ciclo'; END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_classificacao_inicial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_classificacao_inicial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pecuaria."ClassificacaoEntradaLeite" c WHERE c."entradaId"=NEW.id AND c.versao=1 AND c.natureza='NAO_INFORMADA') THEN
    RAISE EXCEPTION 'produção confirmada exige classificação inicial não informada' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_classificacao_manejo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_classificacao_manejo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE manejo RECORD;
BEGIN
 IF TG_OP='UPDATE' AND NEW."manejoId" IS DISTINCT FROM OLD."manejoId" THEN RAISE EXCEPTION 'Classificação conserva a fonte do manejo'; END IF;
 IF NEW."manejoId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO manejo FROM pecuaria."ManejoAnimal" WHERE id=NEW."manejoId";
 IF NEW."valorMaterialDocumentado" IS NOT NULL OR NOT NEW."materialNaoAplicavel" OR NEW."coberturaServico"<>'PROCEDIMENTO' OR (NEW."servicoNaoAplicavel" AND manejo."operacaoServicoId" IS NOT NULL) THEN RAISE EXCEPTION 'Manejo não admite material ou pacote duplicado'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_colostro_trigger(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_colostro_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE id_fornecimento text;
BEGIN
  IF TG_TABLE_NAME = 'FornecimentoColostro' THEN
    PERFORM pecuaria.conferir_fornecimento_colostro(NEW.id);
  ELSIF TG_TABLE_NAME = 'CriaParto' THEN
    FOR id_fornecimento IN SELECT f.id FROM pecuaria."FornecimentoColostro" f
      WHERE f."criaId" = NEW.id AND f.status = 'VALIDO' ORDER BY f.id
    LOOP PERFORM pecuaria.conferir_fornecimento_colostro(id_fornecimento); END LOOP;
  ELSE
    FOR id_fornecimento IN SELECT f.id FROM pecuaria."FornecimentoColostro" f
      JOIN pecuaria."CriaParto" c ON c.id = f."criaId"
      WHERE c."partoId" = NEW.id AND f.status = 'VALIDO' ORDER BY f.id
    LOOP PERFORM pecuaria.conferir_fornecimento_colostro(id_fornecimento); END LOOP;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_configuracao_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_configuracao_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE f record; ident text;
BEGIN
 IF TG_TABLE_NAME='PerfilBezerreiro' THEN
  IF NOT EXISTS(SELECT 1 FROM pecuaria."Lote" WHERE id=NEW."loteId" AND "propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'Perfil deve especializar lote do sítio' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FaseBezerreiroVersao' THEN
  ident:=NEW.id;
  IF NEW."coleiraId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ColeiraBezerreiro" WHERE id=NEW."coleiraId" AND "propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'Coleira de outro sítio' USING ERRCODE='23514'; END IF;
 ELSE ident:=CASE WHEN TG_OP='DELETE' THEN OLD."faseVersaoId" ELSE NEW."faseVersaoId" END;
 END IF;
 IF ident IS NOT NULL THEN
  SELECT * INTO f FROM pecuaria."FaseBezerreiroVersao" WHERE id=ident;
  IF f.publicada AND (SELECT COALESCE(sum(percentual),0) FROM pecuaria."OfertaProgramadaBezerreiro" WHERE "faseVersaoId"=ident)<>100 AND NOT (f."litrosDia"=0 AND NOT EXISTS(SELECT 1 FROM pecuaria."OfertaProgramadaBezerreiro" WHERE "faseVersaoId"=ident)) THEN RAISE EXCEPTION 'Programação publicada deve fechar 100 por cento' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_conjunto_parcelas_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_conjunto_parcelas_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE sid text; g record; contexto record; p jsonb; animal_id text;
BEGIN
 IF TG_TABLE_NAME='EntradaProducaoLeite' THEN
  IF NEW."medicaoGeralId" IS NULL OR NEW.status<>'CONFIRMADA' THEN RETURN NEW; END IF;
  SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=NEW."medicaoGeralId";
  IF g."criterioColostroSnapshot" IS NOT NULL AND (
   NEW.snapshot->'recipiente' IS DISTINCT FROM COALESCE(to_jsonb(g.recipiente),'null'::jsonb)
   OR NEW.snapshot->'tanqueId' IS DISTINCT FROM COALESCE(to_jsonb(g."tanqueId"),'null'::jsonb)
   OR NEW.snapshot->'natureza' IS DISTINCT FROM to_jsonb(g.natureza)
   OR NEW.snapshot->'declaracaoDireta' IS DISTINCT FROM COALESCE(g."declaracaoDireta",'null'::jsonb)
   OR NEW.snapshot->'criterioColostroSnapshot' IS DISTINCT FROM g."criterioColostroSnapshot"
   OR NEW.snapshot->'primeiraOrdenhaColostro' IS DISTINCT FROM COALESCE(to_jsonb(g."primeiraOrdenhaColostro"),'null'::jsonb))
  THEN RAISE EXCEPTION 'origem confirmada deve preservar recipiente, natureza e declaração da parcela' USING ERRCODE='23514'; END IF;
  sid:=g."sessaoId";
 ELSE
  sid:=NEW."sessaoId";
 END IF;
 PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=sid FOR NO KEY UPDATE;
 IF EXISTS (SELECT 1 FROM pecuaria."MedicaoGeralLeite" a JOIN pecuaria."MedicaoGeralLeite" b ON a."sessaoId"=b."sessaoId" AND a.id<>b.id
  WHERE a."sessaoId"=sid AND ((a."tanqueId" IS NOT NULL AND EXISTS (SELECT 1 FROM pecuaria."TanqueLeite" ta JOIN pecuaria."TanqueLeite" tb ON ta."propriedadeId"=tb."propriedadeId" AND ta."identidadeId"=tb."identidadeId" WHERE ta.id=a."tanqueId" AND tb.id=b."tanqueId")) OR
   (a."tanqueId" IS NULL AND b."tanqueId" IS NULL AND lower(trim(a.recipiente))=lower(trim(b.recipiente)))))
 THEN RAISE EXCEPTION 'cada parcela exige um recipiente físico distinto na ordenha' USING ERRCODE='23514'; END IF;
 FOR g IN SELECT * FROM pecuaria."MedicaoGeralLeite" WHERE "sessaoId"=sid AND "criterioColostroSnapshot" IS NOT NULL LOOP
  SELECT d."propriedadeId",d."dataOperacional",c."criterioColostro" INTO contexto FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId" WHERE s.id=sid;
  IF g.natureza='COLOSTRO' AND g."primeiraOrdenhaColostro" IS TRUE AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') atual
    JOIN pecuaria."MedicaoGeralLeite" outra ON outra.id<>g.id AND outra.natureza='COLOSTRO' AND outra."primeiraOrdenhaColostro" IS TRUE
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(outra."criterioColostroSnapshot"->'partos','[]'::jsonb)) anterior
   WHERE atual->>'id'=anterior->>'id' AND atual->>'animalId'=anterior->>'animalId')
  THEN RAISE EXCEPTION 'primeira ordenha do parto já declarada em outra parcela' USING ERRCODE='23514'; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') LOOP
   IF NOT EXISTS (SELECT 1 FROM pecuaria."PartoAnimal" pa JOIN pecuaria."LactacaoAnimal" l ON l."partoId"=pa.id AND l."animalId"=pa."animalId"
    WHERE pa.id=p->>'id' AND pa."animalId"=p->>'animalId' AND pa.versao=(p->>'versao')::integer AND pa.data=(p->>'data')::date
     AND pa.status='VALIDO' AND pa."propriedadeId"=contexto."propriedadeId" AND pa.data<=contexto."dataOperacional"
     AND l.inicio=pa.data AND l.inicio<=contexto."dataOperacional" AND (l."encerradaEm" IS NULL OR l."encerradaEm">contexto."dataOperacional")
     AND g."animaisOrigem" @> jsonb_build_array(pa."animalId"))
   THEN RAISE EXCEPTION 'contexto de colostro exige parto real e lactação histórica comprovada' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF g.natureza IN ('NAO_COMERCIAL','COLOSTRO') AND g."declaracaoDireta" IS NULL AND jsonb_array_length(g."animaisOrigem")=0 THEN RAISE EXCEPTION 'origens desconhecidas exigem declaração direta justificada' USING ERRCODE='23514'; END IF;
  IF g.natureza='COLOSTRO' AND g."declaracaoDireta" IS NULL THEN
   IF contexto."criterioColostro" IS NULL OR (contexto."criterioColostro"->>'tipo'='PRIMEIRA_ORDENHA' AND g."primeiraOrdenhaColostro" IS DISTINCT FROM true) THEN RAISE EXCEPTION 'colostro exige critério vigente e declaração explícita da primeira ordenha' USING ERRCODE='23514'; END IF;
   FOR animal_id IN SELECT jsonb_array_elements_text(g."animaisOrigem") LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') pa WHERE pa->>'animalId'=animal_id
     AND (pa->>'data')::date<=contexto."dataOperacional" AND (contexto."criterioColostro"->>'tipo'='PRIMEIRA_ORDENHA' OR contexto."dataOperacional"<(pa->>'data')::date+(contexto."criterioColostro"->>'dias')::integer))
    THEN RAISE EXCEPTION 'animal sem parto compatível exige declaração direta' USING ERRCODE='23514'; END IF;
   END LOOP;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;


--
-- Name: conferir_contexto_colostro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_contexto_colostro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE o record; p record; u record; f record; quantidade numeric; ident text; data_origem date;
BEGIN
 IF TG_TABLE_NAME='LoteColostro' THEN
  SELECT * INTO p FROM pecuaria."PartoAnimal" WHERE id=NEW."partoId";
  IF p.status<>'VALIDO' OR p."animalId"<>NEW."matrizId" OR p."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR p.data>NEW.data
   OR (p."ocorridoEm" IS NOT NULL AND NEW."ocorridoEm" IS NOT NULL AND NOT p."horarioEstimado" AND NOT NEW."horarioEstimado" AND p."ocorridoEm">NEW."ocorridoEm") THEN RAISE EXCEPTION 'Retirada incompatível com parto produtor, matriz ou data' USING ERRCODE='23514'; END IF;
  IF NEW."medicaoGeralId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE g.id=NEW."medicaoGeralId" AND g.natureza='COLOSTRO' AND g.litros=NEW."quantidadeLitros" AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"=NEW.data AND g."animaisOrigem" @> jsonb_build_array(NEW."matrizId") AND jsonb_array_length(g."animaisOrigem")=1) THEN RAISE EXCEPTION 'Retirada exige parcela geral compatível e inteira' USING ERRCODE='23514'; END IF;
  IF NEW."entradaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" JOIN pecuaria."ClassificacaoEntradaLeite" c ON c."entradaId"=e.id AND c.versao=(SELECT max(versao) FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=e.id) WHERE e.id=NEW."entradaId" AND e.status='CONFIRMADA' AND m."propriedadeId"=NEW."propriedadeId" AND m.data=NEW.data AND m.quantidade=NEW."quantidadeLitros" AND c.natureza='COLOSTRO' AND (NEW."medicaoGeralId" IS NULL OR e."medicaoGeralId"=NEW."medicaoGeralId")) THEN RAISE EXCEPTION 'Retirada exige entrada inteira confirmada da mesma origem' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='OrigemColostro' THEN
  IF NEW."loteColostroId" IS NOT NULL THEN
   SELECT * INTO STRICT p FROM pecuaria."LoteColostro" WHERE id=NEW."loteColostroId";
   IF p.status<>NEW.status OR p."propriedadeId"<>NEW."propriedadeId" OR p."quantidadeLitros"<>NEW."quantidadeLitros" THEN RAISE EXCEPTION 'Origem diverge da retirada confirmada' USING ERRCODE='23514'; END IF;
  ELSE
   SELECT * INTO STRICT p FROM pecuaria."PreparoColostro" WHERE id=NEW."preparoId";
   IF p.status<>NEW.status OR p."propriedadeId"<>NEW."propriedadeId" OR p."volumeFinalLitros"<>NEW."quantidadeLitros" THEN RAISE EXCEPTION 'Origem diverge do preparo' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='PreparoColostro' THEN
  IF NOT EXISTS(SELECT 1 FROM pecuaria."OrigemPreparoColostro" WHERE "preparoId"=NEW.id) OR NOT EXISTS(SELECT 1 FROM pecuaria."InsumoPreparoColostro" WHERE "preparoId"=NEW.id) THEN RAISE EXCEPTION 'Preparo exige origens e insumos explícitos' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pecuaria."OrigemColostro" WHERE "preparoId"=NEW.id AND "propriedadeId"=NEW."propriedadeId" AND "quantidadeLitros"=NEW."volumeFinalLitros" AND status=NEW.status) THEN RAISE EXCEPTION 'Preparo exige sua origem resultante' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='InsumoPreparoColostro' THEN
  SELECT * INTO STRICT p FROM pecuaria."PreparoColostro" WHERE id=NEW."preparoId";
  IF NOT EXISTS(SELECT 1 FROM public."MovimentoEstoque" m JOIN public."Produto" pr ON pr.id=m."produtoId" WHERE m.id=NEW."movimentoId" AND m."produtoId"=NEW."produtoId" AND m."propriedadeId"=p."propriedadeId" AND m.data=p.data AND m.tipo='SAIDA' AND m.status::text=CASE WHEN p.status='CONFIRMADO' THEN 'CONFIRMADO' ELSE 'REVERTIDO' END AND m.quantidade=NEW.quantidade AND pr.unidade::text=NEW.unidade) THEN RAISE EXCEPTION 'Insumo exige baixa própria compatível' USING ERRCODE='23514'; END IF;
  IF NEW."partidaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."PartidaProduto" WHERE id=NEW."partidaId" AND "produtoId"=NEW."produtoId") THEN RAISE EXCEPTION 'Partida de outro produto' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='UnidadeBancoColostro' THEN
  SELECT * INTO STRICT o FROM pecuaria."OrigemColostro" WHERE id=NEW."origemId";
  IF o."propriedadeId"<>NEW."propriedadeId" OR (o.status<>'CONFIRMADO' AND NEW.status<>'ESTORNADA') THEN RAISE EXCEPTION 'Unidade de outro sítio ou origem inativa' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(l.data,preparo_origem.data) INTO data_origem FROM pecuaria."OrigemColostro" x LEFT JOIN pecuaria."LoteColostro" l ON l.id=x."loteColostroId" LEFT JOIN pecuaria."PreparoColostro" preparo_origem ON preparo_origem.id=x."preparoId" WHERE x.id=o.id;
  IF NEW."dataCongelamento"<data_origem THEN RAISE EXCEPTION 'Congelamento anterior à origem' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO STRICT o FROM pecuaria."OrigemColostro" WHERE id=NEW."origemId";
  IF TG_TABLE_NAME='OrigemPreparoColostro' THEN
   SELECT * INTO STRICT p FROM pecuaria."PreparoColostro" WHERE id=NEW."preparoId";
   IF o."preparoId"=p.id OR EXISTS(WITH RECURSIVE ancestrais(id) AS (
     SELECT "origemId" FROM pecuaria."OrigemPreparoColostro" WHERE "preparoId"=o."preparoId"
     UNION SELECT a."origemId" FROM ancestrais n JOIN pecuaria."OrigemColostro" x ON x.id=n.id JOIN pecuaria."OrigemPreparoColostro" a ON a."preparoId"=x."preparoId")
     SELECT 1 FROM ancestrais n JOIN pecuaria."OrigemColostro" x ON x.id=n.id WHERE x."preparoId"=p.id) THEN RAISE EXCEPTION 'Ciclo de preparo de colostro' USING ERRCODE='23514'; END IF;
   IF NEW.ativo<>(p.status='CONFIRMADO') THEN RAISE EXCEPTION 'Alocação diverge do estado do preparo' USING ERRCODE='23514'; END IF;
  ELSE
   SELECT * INTO STRICT f FROM pecuaria."FornecimentoColostro" WHERE id=NEW."fornecimentoId";
   p:=f;
   IF NEW.ativo AND f.status<>'VALIDO' THEN RAISE EXCEPTION 'Alocação diverge do fornecimento' USING ERRCODE='23514'; END IF;
   SELECT sum("quantidadeLitros") INTO quantidade FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=f.id AND ativo;
   IF NEW.ativo AND quantidade IS DISTINCT FROM f."quantidadeLitros" THEN RAISE EXCEPTION 'Alocações devem conservar quantidade fornecida' USING ERRCODE='23514'; END IF;
   IF NEW."destinoInternoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."DestinoInternoLeite" di JOIN pecuaria."LoteColostro" l ON l."entradaId"=di."entradaId" WHERE di.id=NEW."destinoInternoId" AND l.id=o."loteColostroId" AND di."propriedadeId"=o."propriedadeId" AND di.data=f.data) THEN RAISE EXCEPTION 'Destino interno incompatível com a origem' USING ERRCODE='23514'; END IF;
  END IF;
  IF o."propriedadeId"<>p."propriedadeId" OR (NEW.ativo AND o.status<>'CONFIRMADO') THEN RAISE EXCEPTION 'Origem de outro sítio ou inativa' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pecuaria."LoteColostro" l WHERE l.id=o."loteColostroId" AND l.data>p.data) OR EXISTS(SELECT 1 FROM pecuaria."PreparoColostro" z WHERE z.id=o."preparoId" AND z.data>p.data) THEN RAISE EXCEPTION 'Consumo anterior à origem' USING ERRCODE='23514'; END IF;
  IF o."loteColostroId" IS NOT NULL AND NEW.ativo THEN
   IF NEW."movimentoId" IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM pecuaria."LoteColostro" l JOIN pecuaria."AlocacaoLeiteEstoque" a ON a."entradaId"=l."entradaId" JOIN public."MovimentoEstoque" m ON m.id=a."movimentoId" WHERE l.id=o."loteColostroId" AND a."movimentoId"=NEW."movimentoId" AND a.quantidade=NEW."quantidadeLitros" AND a.finalidade='CONSUMO' AND m.status='CONFIRMADO' AND m.data=p.data AND m."propriedadeId"=o."propriedadeId") THEN RAISE EXCEPTION 'Consumo bruto exige baixa única comprovada da origem' USING ERRCODE='23514'; END IF;
   ELSE
    IF TG_TABLE_NAME='OrigemPreparoColostro' THEN RAISE EXCEPTION 'Preparo bruto exige movimento de consumo' USING ERRCODE='23514';
    ELSE
     IF NEW."destinoInternoId" IS NULL OR NOT EXISTS(SELECT 1 FROM pecuaria."ParcelaDestinoLeite" x WHERE x."destinoId"=NEW."destinoInternoId" AND x."fornecimentoColostroId"=NEW."fornecimentoId" AND x.ativo AND x."quantidadeLitros"=NEW."quantidadeLitros") THEN RAISE EXCEPTION 'Fornecimento bruto exige baixa ou destino comprovado' USING ERRCODE='23514'; END IF;
    END IF;
   END IF;
  END IF;
  IF NEW."unidadeId" IS NOT NULL THEN
   SELECT * INTO STRICT u FROM pecuaria."UnidadeBancoColostro" WHERE id=NEW."unidadeId";
   IF u."origemId"<>o.id OR (NEW.ativo AND (u.status<>'RETIRADA' OR u."dataRetirada">p.data)) THEN RAISE EXCEPTION 'Unidade de outra origem, não retirada ou cronologia inválida' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_contexto_retirada_colostro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_contexto_retirada_colostro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE p record;
BEGIN
 IF NEW.status='ESTORNADO' THEN
  IF TG_OP<>'UPDATE' THEN
   RAISE EXCEPTION 'Retirada estornada exige histórico anterior' USING ERRCODE='23514';
  END IF;
  IF OLD.status NOT IN ('RASCUNHO','CONFIRMADO') OR NEW.versao<>OLD.versao+1
   OR NEW."estornadoEm" IS NULL OR COALESCE(length(btrim(NEW."motivoEstorno")),0)=0
   OR (to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno']) THEN
   RAISE EXCEPTION 'Estorno da retirada preserva integralmente identidade, volume e snapshot' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM pecuaria."OrigemColostro" o WHERE o."loteColostroId"=NEW.id AND o.status<>'ESTORNADO') THEN
   RAISE EXCEPTION 'Regularize a origem e seus consumidores antes de estornar a retirada' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
 END IF;
  SELECT * INTO p FROM pecuaria."PartoAnimal" WHERE id=NEW."partoId";
  IF p.status<>'VALIDO' OR p."animalId"<>NEW."matrizId" OR p."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR p.data>NEW.data
   OR (p."ocorridoEm" IS NOT NULL AND NEW."ocorridoEm" IS NOT NULL AND NOT p."horarioEstimado" AND NOT NEW."horarioEstimado" AND p."ocorridoEm">NEW."ocorridoEm") THEN RAISE EXCEPTION 'Retirada incompatível com parto produtor, matriz ou data' USING ERRCODE='23514'; END IF;
  IF NEW."medicaoGeralId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE g.id=NEW."medicaoGeralId" AND g.natureza='COLOSTRO' AND g.litros=NEW."quantidadeLitros" AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"=NEW.data AND g."animaisOrigem" @> jsonb_build_array(NEW."matrizId") AND jsonb_array_length(g."animaisOrigem")=1) THEN RAISE EXCEPTION 'Retirada exige parcela geral compatível e inteira' USING ERRCODE='23514'; END IF;
  IF NEW."entradaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" JOIN pecuaria."ClassificacaoEntradaLeite" c ON c."entradaId"=e.id AND c.versao=(SELECT max(versao) FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=e.id) WHERE e.id=NEW."entradaId" AND e.status='CONFIRMADA' AND m."propriedadeId"=NEW."propriedadeId" AND m.data=NEW.data AND m.quantidade=NEW."quantidadeLitros" AND c.natureza='COLOSTRO' AND (NEW."medicaoGeralId" IS NULL OR e."medicaoGeralId"=NEW."medicaoGeralId")) THEN RAISE EXCEPTION 'Retirada exige entrada inteira confirmada da mesma origem' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_decisao_elegibilidade(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_decisao_elegibilidade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE inicio DATE;
BEGIN
 SELECT "inicioCiclo" INTO STRICT inicio FROM pecuaria."VinculoPoliticaCiclo" WHERE id=NEW."vinculoCicloId";
 IF NEW.data<inicio OR NEW."aptaDesde"<inicio THEN RAISE EXCEPTION 'Decisão deve respeitar o início conhecido do ciclo'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_demonstrativo_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_demonstrativo_leite(did text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE d pecuaria."DemonstrativoLeite"%ROWTYPE; q numeric; v numeric; comp jsonb;
BEGIN
 SELECT * INTO d FROM pecuaria."DemonstrativoLeite" WHERE id=did; IF NOT FOUND THEN RETURN; END IF;
 SELECT COALESCE(sum(quantidade),0),COALESCE(sum(valor),0) INTO q,v FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "demonstrativoId"=did;
 IF q<>d."volumeReconhecido" OR v<>d."valorComercial" THEN RAISE EXCEPTION 'parcelas não conciliam totais declarados do demonstrativo'; END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "demonstrativoId"=did AND ativo<>(d.status='VALIDO')) THEN RAISE EXCEPTION 'anulação deve desativar todas as parcelas, sem apagar histórico'; END IF;
 FOR comp IN SELECT value FROM jsonb_array_elements(d.componentes) LOOP
  IF COALESCE(comp->>'natureza','') NOT IN ('BONUS','DESCONTO','RETENCAO','ADIANTAMENTO') OR COALESCE(length(trim(comp->>'referencia')),0)<5 OR jsonb_typeof(comp->'valor') IS DISTINCT FROM 'number' OR COALESCE((comp->>'valor')::numeric,0)<=0
  THEN RAISE EXCEPTION 'componente documental exige natureza, valor positivo e referência'; END IF;
 END LOOP;
END $$;


--
-- Name: conferir_descarte_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_descarte_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE did text;
BEGIN
  IF TG_TABLE_NAME='DescarteLeite' THEN
    PERFORM pecuaria.validar_descarte_leite(NEW.id);
  ELSIF TG_TABLE_NAME='AlocacaoLeiteEstoque' THEN
    FOR did IN SELECT id FROM pecuaria."DescarteLeite" WHERE "movimentoId"=NEW."movimentoId" LOOP PERFORM pecuaria.validar_descarte_leite(did); END LOOP;
  ELSE
    IF NEW."metodoValorizacao"='LEITE_FIFO_V1' AND NEW.origem='PERDA' AND NEW."reversaoDeId" IS NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."DescarteLeite" WHERE "movimentoId"=NEW.id)
    THEN RAISE EXCEPTION 'Perda leiteira exige fato de descarte rastreado' USING ERRCODE='23514'; END IF;
    FOR did IN SELECT id FROM pecuaria."DescarteLeite" WHERE "movimentoId"=NEW.id OR "movimentoEstornoId"=NEW.id LOOP PERFORM pecuaria.validar_descarte_leite(did); END LOOP;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_destinacao_colostro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_destinacao_colostro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE d record; ident text;
BEGIN
 IF TG_TABLE_NAME='DestinacaoColostro' THEN ident:=NEW.id; ELSE ident:=NEW."destinacaoId"; END IF;
 IF ident IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO STRICT d FROM pecuaria."DestinacaoColostro" WHERE id=ident;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."OrigemColostro" WHERE id=d."origemId" AND "propriedadeId"=d."propriedadeId") THEN RAISE EXCEPTION 'Destinação de outro sítio' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "destinacaoId"=ident) AND NOT EXISTS(SELECT 1 FROM pecuaria."UnidadeBancoColostro" WHERE "destinacaoId"=ident) THEN RAISE EXCEPTION 'Destinação exige fornecimento ou congelamento' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "destinacaoId"=ident AND ("origemId"<>d."origemId" OR ativo<>(d.status='CONFIRMADO'))) OR
    EXISTS(SELECT 1 FROM pecuaria."UnidadeBancoColostro" WHERE "destinacaoId"=ident AND ("origemId"<>d."origemId" OR (d.status='ESTORNADO' AND status<>'ESTORNADA'))) THEN RAISE EXCEPTION 'Destinação deve ser confirmada/estornada integralmente' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_destino_interno_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_destino_interno_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: conferir_elegibilidade_saida_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_elegibilidade_saida_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE m RECORD; c RECORD; atual TEXT; operacao_tipo TEXT;
BEGIN
 SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=NEW."movimentoId";
 SELECT * INTO c FROM pecuaria."ClassificacaoEntradaLeite" WHERE id=NEW."classificacaoId" AND "entradaId"=NEW."entradaId";
 IF NOT FOUND THEN RAISE EXCEPTION 'classificação da saída pertence a outra entrada' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
 SELECT id INTO atual FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=NEW."entradaId" ORDER BY versao DESC LIMIT 1;
 IF c.id<>atual THEN RAISE EXCEPTION 'saída exige snapshot da classificação vigente sob trava' USING ERRCODE='23514'; END IF;
 IF m."operacaoId" IS NOT NULL THEN SELECT tipo::text INTO operacao_tipo FROM public."Operacao" WHERE id=m."operacaoId"; END IF;
 IF NEW.finalidade='VENDA' THEN
   IF c.natureza<>'COMERCIAL' OR (operacao_tipo IS DISTINCT FROM 'VENDA' AND NOT (
     m."operacaoId" IS NULL AND m.origem::text='RETIRADA_LEITE' AND EXISTS (
       SELECT 1 FROM pecuaria."RetiradaOperacaoLeite" r JOIN pecuaria."OperacaoComercialLeite" o ON o.id=r."comercialId"
       WHERE r."movimentoId"=m.id AND o."propriedadeId"=m."propriedadeId" AND m.data BETWEEN o.inicio AND o.fim)))
   THEN RAISE EXCEPTION 'venda exige entrada comercial e operação financeira ou retirada pendente comprovada' USING ERRCODE='23514'; END IF;
 ELSE
   IF m."operacaoId" IS NOT NULL OR (NEW.finalidade='CONSUMO' AND m.origem<>'NUTRICAO') OR (NEW.finalidade='DESCARTE' AND m.origem<>'PERDA') THEN
     RAISE EXCEPTION 'finalidade interna não pode contornar venda ou sua restrição comercial' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_entrada_localizacao_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE perfil_id text; cobertura datemultirange; l record;
BEGIN
 IF TG_TABLE_NAME='PerfilBezerreiro' THEN
   IF NOT NEW.ativo THEN RETURN NULL; END IF;
   FOR l IN SELECT * FROM pecuaria."LocalizacaoAnimal" WHERE "loteId"=NEW."loteId" AND ate IS NULL LOOP
     SELECT range_agg(daterange(p.desde,p.ate,'[)')) INTO cobertura FROM pecuaria."ParticipacaoBezerreiro" p WHERE p."animalId"=l."animalId" AND p."perfilId"=NEW.id;
     IF cobertura IS NULL OR NOT (daterange(l.desde,l.ate,'[)') <@ cobertura) THEN
       RAISE EXCEPTION 'Lote ocupado exige regularização explícita de todas as participações atuais' USING ERRCODE='23514';
     END IF;
   END LOOP;
 ELSE
   -- A linha pode ter sido desfeita ou corrigida dentro desta mesma transação.
   SELECT * INTO l FROM pecuaria."LocalizacaoAnimal" WHERE id=NEW.id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   SELECT id INTO perfil_id FROM pecuaria."PerfilBezerreiro" WHERE "loteId"=l."loteId" AND "propriedadeId"=l."propriedadeId" AND ativo;
   IF perfil_id IS NULL THEN RETURN NULL; END IF;
   SELECT range_agg(daterange(p.desde,p.ate,'[)')) INTO cobertura FROM pecuaria."ParticipacaoBezerreiro" p WHERE p."animalId"=l."animalId" AND p."perfilId"=perfil_id;
   IF cobertura IS NULL OR NOT (daterange(l.desde,l.ate,'[)') <@ cobertura) THEN
     RAISE EXCEPTION 'Nova localização em Bezerreiro exige participação atômica pelo fluxo compartilhado' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_entrega_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_entrega_leite(eid text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE e pecuaria."EntregaLeite"%ROWTYPE; m public."MovimentoEstoque"%ROWTYPE;
 c pecuaria."ConferenciaEntregaLeite"%ROWTYPE; v record; q numeric; val numeric; maximo numeric;
BEGIN
 SELECT * INTO e FROM pecuaria."EntregaLeite" WHERE id=eid; IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=e."retiradaId";
 PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
 SELECT cv.*,o.status AS estado,o."valorTotal",o."parceiroId" FROM pecuaria."VersaoComercialVendaLeite" cv JOIN public."Operacao" o ON o.id=cv."operacaoId" WHERE cv."retiradaId"=m.id ORDER BY cv.versao DESC LIMIT 1 INTO v;
 IF NOT FOUND OR m.status<>'CONFIRMADO' OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m.tipo<>'SAIDA' OR m."reversaoDeId" IS NOT NULL OR m."propriedadeId" IS DISTINCT FROM e."propriedadeId" OR v.estado<>'CONFIRMADA'
 THEN RAISE EXCEPTION 'entrega exige retirada leiteira única comprovada e venda vigente no sítio'; END IF;
 SELECT * INTO c FROM pecuaria."ConferenciaEntregaLeite" WHERE "entregaId"=eid ORDER BY versao DESC LIMIT 1;
 IF NOT FOUND OR c.versao<>(SELECT count(*) FROM pecuaria."ConferenciaEntregaLeite" WHERE "entregaId"=eid)
 THEN RAISE EXCEPTION 'conferência deve ser contínua'; END IF;
 SELECT COALESCE(sum(quantidade),0),COALESCE(sum(valor),0) INTO q,val FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "entregaId"=eid AND ativo;
 maximo:=LEAST(m.quantidade,COALESCE(c."volumeAceito",m.quantidade));
 IF q>maximo OR val>v."valorTotal" OR (q=maximo)<>(val=v."valorTotal") AND q>0
 THEN RAISE EXCEPTION 'faturamento parcial supera saldo comercial ou encerra somente litros/valor'; END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoDemonstrativoLeite" a JOIN pecuaria."DemonstrativoLeite" d ON d.id=a."demonstrativoId"
  WHERE a."entregaId"=eid AND (a.ativo<>(d.status='VALIDO') OR (a.ativo AND (a."versaoVendaId"<>v.id OR d."propriedadeId"<>e."propriedadeId" OR d."parceiroId" IS DISTINCT FROM v."parceiroId" OR m.data<d.inicio OR m.data>d.fim OR (c."volumeAceito" IS NULL AND COALESCE(length(trim(a."motivoAceitePendente")),0)<5)))))
 THEN RAISE EXCEPTION 'parcela exige venda vigente, escopo/período/comprador e aceite conhecido ou pendência explícita'; END IF;
END $$;


--
-- Name: conferir_evidencia_finalidade_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_evidencia_finalidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE dia date; quantidade integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('pec-animal:'||NEW."animalId"));
 IF TG_OP='UPDATE' AND ROW(NEW.id,NEW."animalId",NEW."diaId") IS DISTINCT FROM ROW(OLD.id,OLD."animalId",OLD."diaId") THEN
   RAISE EXCEPTION 'Identidade do participante de ordenha é imutável' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND ROW(NEW."finalidadeId",NEW."finalidadeSnapshot") IS NOT DISTINCT FROM ROW(OLD."finalidadeId",OLD."finalidadeSnapshot")
  AND NOT (OLD."excluidoEm" IS NOT NULL AND NEW."excluidoEm" IS NULL) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND EXISTS (SELECT 1 FROM pecuaria."MedicaoLeite" m JOIN pecuaria."VinculoMedicaoEntradaLeite" v ON v."medicaoId"=m.id WHERE m."participanteId"=OLD.id AND v.ativo) THEN
   RAISE EXCEPTION 'Evidência da finalidade usada em medição é imutável; regularize o histórico' USING ERRCODE='23514';
 END IF;
 SELECT "dataOperacional" INTO dia FROM pecuaria."DiaProducaoLeite" WHERE id=NEW."diaId";
 SELECT count(*) INTO quantidade FROM pecuaria."finalidades_producao_na_data"(NEW."animalId",dia);
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(NEW."animalId",dia) WHERE id=NEW."finalidadeId" AND aptidao='LEITE')
 OR NEW."finalidadeSnapshot" IS NULL OR NEW."finalidadeSnapshot"->>'regra' IS DISTINCT FROM 'FINALIDADE_LEITE_V1'
 OR NEW."finalidadeSnapshot"->>'aptidao' IS DISTINCT FROM 'LEITE'
 OR NEW."finalidadeSnapshot"->>'finalidadeId' IS DISTINCT FROM NEW."finalidadeId"
 OR NEW."finalidadeSnapshot"->>'dataOperacional' IS DISTINCT FROM to_char(dia,'YYYY-MM-DD') THEN
   RAISE EXCEPTION 'Produção exige uma única finalidade Leite comprovada na data' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_exame_pos_parto(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_exame_pos_parto(id_exame text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE exame pecuaria."ExameAnimal"%ROWTYPE; parto pecuaria."PartoAnimal"%ROWTYPE;
BEGIN
 SELECT * INTO exame FROM pecuaria."ExameAnimal" WHERE id=id_exame;
 IF NOT FOUND OR exame.status <> 'VALIDO' OR exame."partoPosPartoId" IS NULL THEN RETURN; END IF;
 SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id=exame."partoPosPartoId" FOR UPDATE;
 IF parto.status <> 'VALIDO' OR exame."animalId" <> parto."animalId" OR exame.data < parto.data THEN
  RAISE EXCEPTION 'Exame pós-parto exige parto válido da matriz e data a partir do parto';
 END IF;
END $$;


--
-- Name: conferir_exame_pos_parto_trigger(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_exame_pos_parto_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE id_exame text;
BEGIN
 IF TG_TABLE_NAME='ExameAnimal' THEN
  PERFORM pecuaria.conferir_exame_pos_parto(NEW.id);
 ELSE
  FOR id_exame IN SELECT id FROM pecuaria."ExameAnimal" WHERE "partoPosPartoId"=NEW.id AND status='VALIDO' ORDER BY id
  LOOP PERFORM pecuaria.conferir_exame_pos_parto(id_exame); END LOOP;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_fornecimento_colostro(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_fornecimento_colostro(id_fornecimento text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE fornecimento pecuaria."FornecimentoColostro"%ROWTYPE;
  cria pecuaria."CriaParto"%ROWTYPE;
  parto pecuaria."PartoAnimal"%ROWTYPE;
  id_parto text;
BEGIN
  SELECT * INTO fornecimento FROM pecuaria."FornecimentoColostro" WHERE id = id_fornecimento;
  IF NOT FOUND OR fornecimento.status <> 'VALIDO' THEN RETURN; END IF;
  SELECT "partoId" INTO STRICT id_parto FROM pecuaria."CriaParto" WHERE id = fornecimento."criaId";
  SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id = id_parto FOR UPDATE;
  SELECT * INTO STRICT cria FROM pecuaria."CriaParto" WHERE id = fornecimento."criaId" FOR UPDATE;
  -- Cria pode ter mudado de parto durante a obtenção das travas. Não validar
  -- contra um parto antigo: rejeitar a disputa para repetir com contexto atual.
  IF cria."partoId" <> parto.id THEN
    RAISE EXCEPTION 'Contexto da cria mudou durante o fornecimento de colostro' USING ERRCODE = '40001';
  END IF;
  IF parto."ocorridoEm" IS NOT NULL AND NOT parto."horarioEstimado"
     AND fornecimento."ocorridoEm" IS NOT NULL AND NOT fornecimento."horarioEstimado"
     AND fornecimento."ocorridoEm" < parto."ocorridoEm" THEN
    RAISE EXCEPTION 'Fornecimento não pode anteceder o horário conhecido do nascimento';
  END IF;
  IF NOT cria.viva OR parto.status <> 'VALIDO' OR fornecimento.data < parto.data THEN
    RAISE EXCEPTION 'Colostro exige cria viva, parto válido e fornecimento a partir do parto';
  END IF;
END $$;


--
-- Name: conferir_fornecimento_nutricional_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='FornecimentoNutricionalLeite' THEN
  PERFORM pecuaria.validar_fornecimento_nutricional_leite(NEW."id");
 ELSE
  PERFORM pecuaria.validar_fornecimento_nutricional_leite(NEW."fornecimentoId");
 END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_historico_origem_geral(text, date, date); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_historico_origem_geral(animal_id text, inicio date DEFAULT NULL::date, fim date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE fato record; animal record; local_id text; finalidade_id text; n integer; evidencia jsonb;
BEGIN
 FOR fato IN SELECT g.id,d."propriedadeId",d."dataOperacional" dia
  FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId"
  JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
  WHERE g."animaisOrigem" @> jsonb_build_array(animal_id)
   AND (inicio IS NULL OR d."dataOperacional">=inicio) AND (fim IS NULL OR d."dataOperacional"<fim)
 LOOP
  SELECT * INTO animal FROM pecuaria."Animal" WHERE id=animal_id;
  IF NOT FOUND OR animal.sexo<>'F' OR animal."dataNascimento">fato.dia OR animal."dataEntrada">fato.dia
   OR EXISTS (SELECT 1 FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=animal_id AND b."estornadaEm" IS NULL AND b.data<fato.dia) THEN
   RAISE EXCEPTION 'Alteração invalida animal ou data de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  SELECT count(*),min(l.id) INTO n,local_id FROM pecuaria."LocalizacaoAnimal" l
   WHERE l."animalId"=animal_id AND l.desde<=fato.dia AND (l.ate IS NULL OR l.ate>fato.dia OR EXISTS (
    SELECT 1 FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=animal_id AND b."estornadaEm" IS NULL AND b.data=fato.dia AND b."localizacaoFechadaId"=l.id));
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."LocalizacaoAnimal" WHERE id=local_id AND "propriedadeId"=fato."propriedadeId") THEN
   RAISE EXCEPTION 'Alteração invalida sítio de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  SELECT count(*),min(f.id) INTO n,finalidade_id FROM pecuaria."finalidades_producao_na_data"(animal_id,fato.dia) f;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,fato.dia) f WHERE f.aptidao='LEITE') THEN
   RAISE EXCEPTION 'Alteração invalida finalidade Leite de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO n FROM pecuaria."LactacaoAnimal" l WHERE l."animalId"=animal_id AND l.inicio<=fato.dia AND (l."encerradaEm" IS NULL OR l."encerradaEm">fato.dia);
  IF n>1 OR n=0 AND EXISTS (SELECT 1 FROM pecuaria."LactacaoAnimal" l WHERE l."animalId"=animal_id AND l."encerradaEm"<=fato.dia) THEN
   RAISE EXCEPTION 'Alteração invalida lactação de origem geral; regularize a aferição e suas confirmações' USING ERRCODE='23514';
  END IF;
  -- Somente entradas ainda confirmadas exigem a identidade da evidência congelada.
  FOR evidencia IN SELECT a FROM pecuaria."EntradaProducaoLeite" e
   CROSS JOIN LATERAL jsonb_array_elements(e.snapshot->'animaisOrigem') a
   WHERE e."medicaoGeralId"=fato.id AND e.status='CONFIRMADA' AND a->>'animalId'=animal_id
  LOOP
   IF evidencia->>'finalidadeId' IS DISTINCT FROM finalidade_id OR evidencia->>'localizacaoId' IS DISTINCT FROM local_id
    OR evidencia->>'lactacaoId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."LactacaoAnimal" l
     WHERE l.id=evidencia->>'lactacaoId' AND l."animalId"=animal_id AND l.inicio<=fato.dia AND (l."encerradaEm" IS NULL OR l."encerradaEm">fato.dia)) THEN
    RAISE EXCEPTION 'Alteração retira evidência de origem geral confirmada; regularize a entrada antes' USING ERRCODE='23514';
   END IF;
  END LOOP;
 END LOOP;
END $$;


--
-- Name: conferir_ledger_nutricional(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_ledger_nutricional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE alvo TEXT; item RECORD; qtd NUMERIC; custo NUMERIC;
BEGIN
 IF TG_TABLE_NAME='ItemConsumoDiario' THEN alvo:=COALESCE(NEW.id,OLD.id); ELSE alvo:=COALESCE(NEW."itemId",OLD."itemId"); END IF;
 SELECT i.*,m."propriedadeId",m."revisadoEm" INTO item FROM pecuaria."ItemConsumoDiario" i JOIN pecuaria."ConsumoDiario" d ON d.id=i."diaId" JOIN pecuaria."MesNutricao" m ON m.id=d."mesId" WHERE i.id=alvo;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT COALESCE(SUM(v.quantidade),0),COALESCE(SUM(v.valor),0) INTO qtd,custo FROM pecuaria."MovimentoConsumoDiario" v WHERE v."itemId"=alvo;
 IF qtd<>item.confirmada OR custo<>item."custoLiquido" THEN RAISE EXCEPTION 'consumo diverge do ledger' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."MovimentoConsumoDiario" v JOIN public."MovimentoEstoque" e ON e.id=v."movimentoId" WHERE v."itemId"=alvo AND (e."produtoId"<>item."produtoId" OR e."propriedadeId" IS DISTINCT FROM item."propriedadeId" OR e.origem<>'NUTRICAO' OR e.status<>'CONFIRMADO' OR e.quantidade<>abs(v.quantidade) OR e."valorTotal"<>abs(v.valor) OR (v.quantidade>0 AND e.tipo<>'SAIDA') OR (v.quantidade<0 AND e.tipo<>'ENTRADA'))) THEN RAISE EXCEPTION 'vínculo nutricional incompatível com estoque' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_limite_classificacao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_limite_classificacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF NEW."aplicacaoId" IS NOT NULL THEN PERFORM pecuaria.conferir_capacidade_preparo('APLICACAO',NEW."aplicacaoId");
 ELSIF NEW."exameId" IS NOT NULL THEN PERFORM pecuaria.conferir_capacidade_preparo('EXAME',NEW."exameId");
 ELSIF NEW."participacaoId" IS NOT NULL THEN PERFORM pecuaria.conferir_capacidade_preparo('PARTICIPACAO',NEW."participacaoId");
 END IF; RETURN NULL;
END $$;


--
-- Name: conferir_manejo_protocolar(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_manejo_protocolar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE insercao RECORD; servico RECORD; atribuicao NUMERIC; participacao RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW.tipo,NEW."tarefaId",NEW."criadoPorId",NEW.data,NEW."realizadaEm",NEW."precisaoTemporal",NEW."insercaoAplicacaoId") IS DISTINCT FROM (OLD."animalId",OLD.tipo,OLD."tarefaId",OLD."criadoPorId",OLD.data,OLD."realizadaEm",OLD."precisaoTemporal",OLD."insercaoAplicacaoId") THEN
  RAISE EXCEPTION 'Retifique o manejo criando fato substituto; identidade e realização são imutáveis';
 END IF;
 IF NEW.tipo NOT IN ('PROTOCOLAR','RETIRADA_DISPOSITIVO') THEN RETURN NEW; END IF;
 SELECT p.* INTO participacao FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId"
 WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND e.tipo=CASE WHEN NEW.tipo='PROTOCOLAR' THEN 'MANEJO' ELSE 'RETIRADA' END;
 IF participacao.id IS NULL AND (NEW.tipo<>'RETIRADA_DISPOSITIVO' OR NEW."tarefaId" IS NOT NULL) THEN RAISE EXCEPTION 'Manejo incompatível com animal e ação da tarefa'; END IF;
 IF NEW."precisaoTemporal"='HORA' AND (NEW."realizadaEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.data THEN RAISE EXCEPTION 'Dia e instante do manejo divergem'; END IF;
 IF NEW.tipo='RETIRADA_DISPOSITIVO' AND (NEW.status='VALIDO' OR NEW."realizacaoMantida") THEN
  SELECT a.*,e.configuracao INTO insercao FROM pecuaria."AplicacaoProduto" a LEFT JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" LEFT JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE a.id=NEW."insercaoAplicacaoId" AND a."animalId"=NEW."animalId" AND (a.status='VALIDO' OR a."consumoMantido" AND a."administracaoMantida" IS DISTINCT FROM false) AND (e.tipo='APLICACAO' AND e.configuracao->>'subtipo'='INSERCAO_DISPOSITIVO' OR a."insercaoDispositivoSnapshot" IS NOT NULL) FOR UPDATE OF a;
  IF insercao.id IS NULL THEN RAISE EXCEPTION 'Retirada exige inserção válida e explicitamente configurada do mesmo animal'; END IF;
  IF NEW.data<insercao.data OR (NEW.data=insercao.data AND NEW."precisaoTemporal"='HORA' AND insercao."precisaoTemporal"='HORA' AND NEW."realizadaEm"<insercao."aplicadaEm") THEN RAISE EXCEPTION 'Retirada anterior à inserção'; END IF;
 END IF;
 IF NEW."operacaoServicoId" IS NOT NULL THEN
  SELECT * INTO servico FROM public."Operacao" o WHERE o.id=NEW."operacaoServicoId" FOR UPDATE;
  IF servico.tipo IS DISTINCT FROM 'SERVICO' OR servico.status IS DISTINCT FROM 'CONFIRMADA' OR servico."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR servico.data>NEW.data THEN RAISE EXCEPTION 'Serviço incompatível com manejo'; END IF;
  IF participacao."operacaoServicoId" IS NOT NULL AND participacao."operacaoServicoId"<>servico.id THEN RAISE EXCEPTION 'Serviço diverge da participação'; END IF;
  IF NEW."valorServicoAtribuido" IS NOT NULL AND participacao."valorServicoAtribuido" IS NOT NULL THEN RAISE EXCEPTION 'Valor já atribuído ao protocolo'; END IF;
  SELECT COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."AplicacaoProduto" WHERE "operacaoServicoId"=servico.id AND (status='VALIDO' OR "consumoMantido")),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ExameAnimal" WHERE "operacaoServicoId"=servico.id AND status='VALIDO' AND realizacao<>'NAO_REALIZADO'),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ParticipacaoProtocolo" WHERE "operacaoServicoId"=servico.id),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."TentativaReprodutiva" WHERE "operacaoServicoId"=servico.id AND (status='VALIDO' OR "consumoMantido")),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ManejoAnimal" WHERE "operacaoServicoId"=servico.id AND id<>NEW.id AND (status='VALIDO' OR "realizacaoMantida")),0)
   INTO atribuicao;
  IF atribuicao+(CASE WHEN NEW.status='VALIDO' OR NEW."realizacaoMantida" THEN COALESCE(NEW."valorServicoAtribuido",0) ELSE 0 END)>servico."valorTotal" THEN RAISE EXCEPTION 'Atribuição excede o Serviço confirmado'; END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_medicao_geral_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_medicao_geral_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE tanque record; sessao record;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'aferição é histórica; corrija com motivo e versão' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (ROW(NEW.id,NEW."sessaoId",NEW."tanqueId",NEW."criadoEm",NEW."criadoPorId") IS DISTINCT FROM ROW(OLD.id,OLD."sessaoId",OLD."tanqueId",OLD."criadoEm",OLD."criadoPorId") OR NEW.versao<>OLD.versao+1) THEN RAISE EXCEPTION 'identidade histórica ou versão da aferição inválida' USING ERRCODE='23514'; END IF;
 PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=NEW."sessaoId" FOR NO KEY UPDATE;
 IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" WHERE "medicaoGeralId"=NEW.id AND status='CONFIRMADA') THEN RAISE EXCEPTION 'regularize a entrada antes de corrigir a aferição' USING ERRCODE='23514'; END IF;
 SELECT d."propriedadeId",d."dataOperacional",c."fonteProducao",c.id AS "configuracaoId",c."criterioColostro" INTO sessao FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId" WHERE s.id=NEW."sessaoId";
 IF sessao."fonteProducao" IS DISTINCT FROM 'GERAL' OR sessao."dataOperacional">(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'aferição exige fonte geral e data até hoje' USING ERRCODE='23514'; END IF;
 IF NEW."tanqueId" IS NOT NULL THEN
  SELECT * INTO tanque FROM pecuaria."TanqueLeite" WHERE id=NEW."tanqueId";
  IF tanque."propriedadeId"<>sessao."propriedadeId" OR NOT tanque.ativo OR tanque."vigenteDesde">sessao."dataOperacional" OR NEW.litros>tanque."capacidadeLitros" OR EXISTS (SELECT 1 FROM pecuaria."TanqueLeite" t WHERE t."propriedadeId"=tanque."propriedadeId" AND t."identidadeId"=tanque."identidadeId" AND t.versao>tanque.versao AND t."vigenteDesde"<=sessao."dataOperacional") THEN RAISE EXCEPTION 'aferição incompatível com tanque, sítio ou data' USING ERRCODE='23514'; END IF;
 END IF;
 -- Novas medições são manuais; TABELA_TANQUE conserva apenas fatos históricos documentados.
 IF NEW."origemLitros"='TABELA_TANQUE' THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'novas parcelas usam litros manuais independentes da régua' USING ERRCODE='23514'; END IF;
  IF NEW."tanqueId" IS NULL OR NEW."reguaMm" IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tanque."tabelaConversao") p WHERE (p->>'mm')::numeric=NEW."reguaMm" AND (p->>'litros')::numeric=NEW.litros) THEN RAISE EXCEPTION 'conversão histórica deve corresponder ao ponto documentado do tanque' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW."criterioColostroSnapshot" IS NULL THEN RAISE EXCEPTION 'nova parcela exige snapshot explícito do contexto' USING ERRCODE='23514'; END IF;
 IF NEW."criterioColostroSnapshot" IS NOT NULL AND (
  NEW."criterioColostroSnapshot"->>'configuracaoId' IS DISTINCT FROM sessao."configuracaoId"
  OR NEW."criterioColostroSnapshot"->'criterio' IS DISTINCT FROM COALESCE(sessao."criterioColostro",'null'::jsonb)
  OR jsonb_typeof(NEW."criterioColostroSnapshot"->'partos') IS DISTINCT FROM 'array'
  OR NEW."criterioColostroSnapshot"->'primeiraOrdenhaColostro' IS DISTINCT FROM COALESCE(to_jsonb(NEW."primeiraOrdenhaColostro"),'null'::jsonb))
 THEN RAISE EXCEPTION 'snapshot deve corresponder à configuração e declaração da parcela' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_medicoes_entrada_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_medicoes_entrada_leite(eid text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE e record; quantidade_total numeric; n bigint;
BEGIN
  SELECT ep.*,m.quantidade INTO e FROM pecuaria."EntradaProducaoLeite" ep
    JOIN public."MovimentoEstoque" m ON m.id=ep."movimentoId" WHERE ep.id=eid;
  IF NOT FOUND THEN RETURN; END IF;
  IF e."medicaoGeralId" IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pecuaria."VinculoMedicaoEntradaLeite" WHERE "entradaId"=eid) OR NOT EXISTS (
      SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId"
      WHERE g.id=e."medicaoGeralId" AND g."sessaoId"=e."sessaoId" AND c."fonteProducao"='GERAL'
      AND e.snapshot->>'fonte'='GERAL' AND e.snapshot->>'medicaoGeralId'=g.id
      AND (e.snapshot->>'litros')::numeric=e.quantidade
      AND (e.status<>'CONFIRMADA' OR (g.litros=e.quantidade AND g.versao=(e.snapshot->>'versaoMedicaoGeral')::integer))
    ) THEN RAISE EXCEPTION 'entrada geral exige aferição inteira da mesma sessão e versão' USING ERRCODE='23514'; END IF;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId" WHERE s.id=e."sessaoId" AND c."fonteProducao"='GERAL') THEN RAISE EXCEPTION 'controle individual não confirma estoque em data de produção geral' USING ERRCODE='23514'; END IF;
  SELECT sum(quantidade),count(*) INTO quantidade_total,n FROM pecuaria."VinculoMedicaoEntradaLeite" WHERE "entradaId"=eid;
  IF n=0 OR quantidade_total IS DISTINCT FROM e.quantidade OR EXISTS (
    SELECT 1 FROM pecuaria."VinculoMedicaoEntradaLeite" v JOIN pecuaria."MedicaoLeite" md ON md.id=v."medicaoId"
    JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=md."participanteId"
    WHERE v."entradaId"=eid AND (
      md."sessaoId"<>e."sessaoId" OR v.ativo<>(e.status='CONFIRMADA')
      OR (v.ativo AND (md.estado<>'MEDIDO' OR md.litros IS DISTINCT FROM v.quantidade OR md.versao<>v."versaoMedicao" OR p."excluidoEm" IS NOT NULL))
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.snapshot->'medicoes') j
        WHERE j->>'id'=v."medicaoId" AND j->>'animalId'=p."animalId" AND j->>'estado'='MEDIDO'
          AND (j->>'litros')::numeric=v.quantidade AND (j->>'versao')::integer=v."versaoMedicao")
    )) THEN RAISE EXCEPTION 'origem exige medições inteiras, únicas, da mesma sessão, versão e snapshot conciliados' USING ERRCODE='23514'; END IF;
END $$;


--
-- Name: conferir_movimento_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_movimento_leite(mid text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE m RECORD; origem RECORD; entrada RECORD; q NUMERIC; v NUMERIC; n INTEGER;
BEGIN
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=mid;
  IF NOT FOUND OR m."metodoValorizacao"<>'LEITE_FIFO_V1' THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
  IF m."propriedadeId" IS NULL OR m.quantidade<=0 OR NOT EXISTS (
    SELECT 1 FROM public."Produto" p WHERE p.id=m."produtoId" AND p.unidade='L' AND NOT p."rastrearPartidas"
  ) THEN RAISE EXCEPTION 'movimento leiteiro exige sítio e produto em litros sem partida' USING ERRCODE='23514'; END IF;
  IF m."reversaoDeId" IS NOT NULL THEN
    SELECT * INTO origem FROM public."MovimentoEstoque" WHERE id=m."reversaoDeId";
    IF origem."metodoValorizacao"<>'LEITE_FIFO_V1' OR origem.status<>'REVERTIDO' OR origem."produtoId"<>m."produtoId"
      OR origem."propriedadeId"<>m."propriedadeId" OR origem.quantidade<>m.quantidade
      OR origem."valorTotal" IS DISTINCT FROM m."valorTotal" OR origem."custoUnitario" IS DISTINCT FROM m."custoUnitario"
      OR NOT ((origem.tipo='ENTRADA' AND m.tipo='SAIDA') OR (origem.tipo='SAIDA' AND m.tipo='ENTRADA'))
    THEN RAISE EXCEPTION 'inverso leiteiro incompatível com original' USING ERRCODE='23514'; END IF;
    RETURN;
  END IF;
  IF m.status='REVERTIDO' AND NOT EXISTS (SELECT 1 FROM public."MovimentoEstoque" inv WHERE inv."reversaoDeId"=m.id)
    THEN RAISE EXCEPTION 'movimento leiteiro revertido exige inverso preservado' USING ERRCODE='23514'; END IF;
  IF m.tipo='ENTRADA' THEN
    SELECT e.*,s.versao AS "versaoAtual",d."propriedadeId",d."dataOperacional" INTO entrada
      FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId"
      JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE e."movimentoId"=mid;
    IF NOT FOUND OR m.origem<>'PRODUCAO' OR entrada."propriedadeId"<>m."propriedadeId" OR entrada."dataOperacional"<>m.data
      OR m."valorTotal" IS NOT NULL OR m."custoUnitario" IS NOT NULL
      OR (m.status='CONFIRMADO' AND (entrada.status<>'CONFIRMADA' OR (entrada."medicaoGeralId" IS NULL AND entrada."versaoSessao"<>entrada."versaoAtual")))
      OR (m.status='REVERTIDO' AND entrada.status<>'ANULADA')
    THEN RAISE EXCEPTION 'entrada leiteira exige origem confirmada da ordenha' USING ERRCODE='23514'; END IF;
    PERFORM pecuaria.conferir_medicoes_entrada_leite(entrada.id);
  ELSIF m.tipo='SAIDA' THEN
    SELECT sum(a.quantidade),CASE WHEN bool_or(a."valorTotal" IS NULL) THEN NULL ELSE sum(a."valorTotal") END INTO q,v
      FROM pecuaria."AlocacaoLeiteEstoque" a WHERE a."movimentoId"=mid;
    IF q IS NULL OR q<>m.quantidade OR v IS DISTINCT FROM m."valorTotal" THEN
      RAISE EXCEPTION 'saída leiteira exige alocação exata de quantidade e custo conhecido ou pendente' USING ERRCODE='23514'; END IF;
    IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."EntradaProducaoLeite" e ON e.id=a."entradaId"
      JOIN public."MovimentoEstoque" em ON em.id=e."movimentoId" WHERE a."movimentoId"=mid AND
      (em."produtoId"<>m."produtoId" OR em."propriedadeId"<>m."propriedadeId" OR em.data>m.data OR (m.status='CONFIRMADO' AND (e.status<>'CONFIRMADA' OR em.status<>'CONFIRMADO'))))
      THEN RAISE EXCEPTION 'origem de leite incompatível com consumidor' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'leite não aceita ajuste sem regularização das origens' USING ERRCODE='23514';
  END IF;
  FOR entrada IN SELECT e.*,em.quantidade FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" em ON em.id=e."movimentoId"
    WHERE e."movimentoId"=mid OR e.id IN (SELECT a."entradaId" FROM pecuaria."AlocacaoLeiteEstoque" a WHERE a."movimentoId"=mid)
  LOOP
    SELECT COALESCE(sum(a.quantidade),0) INTO q FROM pecuaria."AlocacaoLeiteEstoque" a
      JOIN public."MovimentoEstoque" sm ON sm.id=a."movimentoId" WHERE a."entradaId"=entrada.id AND sm.status='CONFIRMADO' AND sm."reversaoDeId" IS NULL;
    IF q>entrada.quantidade OR (entrada.status='ANULADA' AND q<>0) THEN
      RAISE EXCEPTION 'consumidores superam produção ou impedem anulação do lastro' USING ERRCODE='23514'; END IF;
    PERFORM pecuaria.conferir_valor_entrada_leite(entrada.id);
  END LOOP;
END $$;


--
-- Name: conferir_movimento_retirada_interna_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_movimento_retirada_interna_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE rid text;
BEGIN
 FOR rid IN SELECT id FROM pecuaria."RetiradaInternaLeite" WHERE "movimentoId"=NEW.id OR "movimentoEstornoId"=NEW.id LOOP PERFORM pecuaria.validar_retirada_interna_leite(rid); END LOOP;
 RETURN NULL;
END $$;


--
-- Name: conferir_natureza_destino_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_natureza_destino_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE destino RECORD; mid TEXT;
BEGIN
  mid:=NEW."movimentoId";
  SELECT * INTO destino FROM pecuaria."DestinoInternoLeite" WHERE "movimentoId"=mid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a
    JOIN pecuaria."ClassificacaoEntradaLeite" c ON c.id=a."classificacaoId" AND c."entradaId"=a."entradaId"
    WHERE a."movimentoId"=mid AND (
      (destino.natureza='COLOSTRO' AND c.natureza<>'COLOSTRO') OR
      (destino.natureza='LEITE_NAO_COMERCIAL' AND c.natureza<>'NAO_COMERCIAL') OR
      (destino.natureza='LEITE_COMUM' AND c.natureza='COLOSTRO')
    )) THEN RAISE EXCEPTION 'natureza do destino contradiz a classificação preservada da entrada inteira' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_oferta_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_oferta_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE o record; g record; v_fornecimento record; ident text;
BEGIN
 IF TG_TABLE_NAME='OfertaBezerreiro' THEN ident:=NEW.id; ELSE ident:=NEW."ofertaId"; END IF;
 SELECT * INTO STRICT o FROM pecuaria."OfertaBezerreiro" WHERE id=ident;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."PerfilBezerreiro" WHERE id=o."perfilId" AND "propriedadeId"=o."propriedadeId") OR
 (o."configuracaoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoBezerreiro" WHERE id=o."configuracaoId" AND "propriedadeId"=o."propriedadeId")) THEN
  RAISE EXCEPTION 'Oferta incompatível com perfil/configuração do sítio' USING ERRCODE='23514';
 END IF;
 IF o."ofertaProgramadaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."OfertaProgramadaBezerreiro" p JOIN pecuaria."FaseBezerreiroVersao" v ON v.id=p."faseVersaoId" WHERE p.id=o."ofertaProgramadaId" AND v.publicada AND v."propriedadeId"=o."propriedadeId") THEN RAISE EXCEPTION 'Oferta programada incompatível' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."GrupoOfertaBezerreiro" WHERE "ofertaId"=ident) THEN RAISE EXCEPTION 'Oferta exige grupos conferidos' USING ERRCODE='23514'; END IF;
 FOR g IN SELECT * FROM pecuaria."GrupoOfertaBezerreiro" WHERE "ofertaId"=ident LOOP
  IF g."coleiraId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ColeiraBezerreiro" WHERE id=g."coleiraId" AND "propriedadeId"=o."propriedadeId") THEN RAISE EXCEPTION 'Grupo de outro sítio' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(g."participantesSnapshot") s WHERE NOT EXISTS(
    SELECT 1 FROM pecuaria."ParticipacaoBezerreiro" p WHERE p."animalId"=s->>'animalId' AND p."perfilId"=o."perfilId" AND p.desde<=o.data AND (p.ate IS NULL OR p.ate>o.data))) THEN
   RAISE EXCEPTION 'Grupo exige participantes comprovados na data' USING ERRCODE='23514';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(g."participantesSnapshot"))<>(SELECT count(DISTINCT s->>'animalId') FROM jsonb_array_elements(g."participantesSnapshot") s) THEN RAISE EXCEPTION 'Participante duplicado ou desconhecido' USING ERRCODE='23514'; END IF;
  IF g."quantidadeLitros">0 AND NOT EXISTS(SELECT 1 FROM pecuaria."ItemFechamentoConsumo" i JOIN pecuaria."FornecimentoNutricionalLeite" fornecimento ON fornecimento."itemId"=i.id WHERE i."grupoOfertaId"=g.id) THEN RAISE EXCEPTION 'Grupo positivo exige único item/fornecimento nutricional' USING ERRCODE='23514'; END IF;
  FOR v_fornecimento IN SELECT fornecimento.id FROM pecuaria."ItemFechamentoConsumo" i JOIN pecuaria."FornecimentoNutricionalLeite" fornecimento ON fornecimento."itemId"=i.id WHERE i."grupoOfertaId"=g.id LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(v_fornecimento.id);
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pecuaria."GrupoOfertaBezerreiro" a CROSS JOIN LATERAL jsonb_array_elements(a."participantesSnapshot") s
  WHERE a."ofertaId"=ident GROUP BY s->>'animalId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Animal não pode integrar dois grupos da mesma oferta' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_operacao_comercial_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_operacao_comercial_leite(cid text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE c record; f record; n bigint; nf bigint; q numeric; anterior text; ultima integer;
BEGIN
 SELECT * INTO c FROM pecuaria."OperacaoComercialLeite" WHERE id=cid;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*) INTO n FROM pecuaria."RetiradaOperacaoLeite" WHERE "comercialId"=cid;
 SELECT count(*),max(versao) INTO nf,ultima FROM pecuaria."FechamentoOperacaoLeite" WHERE "comercialId"=cid;
 IF c.versao<>1+n+nf OR (nf=0 AND c.status<>'ABERTA') OR (nf>0 AND (c.status<>'FECHADA' OR nf<>ultima))
 THEN RAISE EXCEPTION 'versão e estado comercial divergem dos fatos registrados' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."RetiradaOperacaoLeite" r JOIN public."MovimentoEstoque" m ON m.id=r."movimentoId" WHERE r."comercialId"=cid AND
   (m."propriedadeId" IS DISTINCT FROM c."propriedadeId" OR m.origem::text<>'RETIRADA_LEITE' OR m.tipo<>'SAIDA' OR m.status<>'CONFIRMADO' OR m."reversaoDeId" IS NOT NULL OR m."operacaoId" IS NOT NULL OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m.data<c.inicio OR m.data>c.fim OR m.data>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
     OR EXISTS (SELECT 1 FROM pecuaria."EntregaLeite" e WHERE e."retiradaId"=m.id) OR EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" v WHERE v."retiradaId"=m.id)))
 THEN RAISE EXCEPTION 'retirada exige lastro leiteiro único no sítio e período, sem vínculo financeiro anterior' USING ERRCODE='23514'; END IF;
 FOR f IN SELECT fl.*,o.status AS "statusFinanceiro",o.tipo,o."propriedadeId",o."parceiroId",o."valorTotal",o.data,o."corrigeOperacaoId",o."centroCustoId" FROM pecuaria."FechamentoOperacaoLeite" fl JOIN public."Operacao" o ON o.id=fl."operacaoId" WHERE fl."comercialId"=cid ORDER BY fl.versao LOOP
   SELECT sum(d."quantidadeReconhecida") INTO q FROM pecuaria."DetalheFechamentoLeite" d WHERE d."fechamentoId"=f.id;
   IF n=0 OR f.tipo<>'VENDA' OR f."propriedadeId"<>c."propriedadeId" OR f."parceiroId" IS DISTINCT FROM c."parceiroId" OR f.data<c.fim OR f.data>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date OR f."centroCustoId" IS NULL OR f."valorTotal"<>round(f."volumeReconhecido"*f."precoUnitario",2)+f.ajuste
     OR q IS DISTINCT FROM f."volumeReconhecido" OR (SELECT count(*) FROM pecuaria."DetalheFechamentoLeite" WHERE "fechamentoId"=f.id)<>n
     OR EXISTS (SELECT 1 FROM pecuaria."DetalheFechamentoLeite" d JOIN pecuaria."RetiradaOperacaoLeite" r ON r.id=d."retiradaId" JOIN public."MovimentoEstoque" m ON m.id=r."movimentoId"
       WHERE d."fechamentoId"=f.id AND (r."comercialId"<>cid OR (d."quantidadeReconhecida"<>m.quantidade AND COALESCE(length(trim(d."motivoDiferenca")),0)<5)))
     OR (f.versao=ultima AND f."statusFinanceiro"<>'CONFIRMADA') OR (f.versao<ultima AND f."statusFinanceiro"<>'CANCELADA') OR f."corrigeOperacaoId" IS DISTINCT FROM anterior
     OR EXISTS (SELECT 1 FROM public."MovimentoEstoque" WHERE "operacaoId"=f."operacaoId")
     OR (SELECT count(*) FROM public."ItemOperacao" WHERE "operacaoId"=f."operacaoId")<>1
     OR EXISTS (SELECT 1 FROM public."ItemOperacao" i WHERE i."operacaoId"=f."operacaoId" AND (i."produtoId" IS NOT NULL OR i.estocavel OR i.quantidade<>f."volumeReconhecido" OR i."valorTotal"<>f."valorTotal" OR i.unidade<>'L'))
     OR EXISTS (SELECT 1 FROM public."Operacao" cor WHERE cor."corrigeOperacaoId"=f."operacaoId" AND NOT EXISTS (SELECT 1 FROM pecuaria."FechamentoOperacaoLeite" proximo WHERE proximo."comercialId"=cid AND proximo.versao=f.versao+1 AND proximo."operacaoId"=cor.id))
   THEN RAISE EXCEPTION 'fechamento exige todas as retiradas, valores conciliados, versão e operação financeira única sem nova baixa' USING ERRCODE='23514'; END IF;
   IF f.versao<ultima AND (EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" co WHERE co."operacaoId"=f."operacaoId" AND co.status<>'CANCELADO') OR EXISTS (SELECT 1 FROM public."TransacaoFinanceira" t WHERE t."operacaoId"=f."operacaoId" AND t.status='CONFIRMADA' AND t.tipo<>'REVERSAO')
     OR EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" co JOIN public."Liquidacao" li ON li."compromissoId"=co.id JOIN public."TransacaoFinanceira" t ON t.id=li."transacaoId" WHERE co."operacaoId"=f."operacaoId" AND t.status='CONFIRMADA'))
   THEN RAISE EXCEPTION 'recebimentos ativos impedem substituição do fechamento' USING ERRCODE='23514'; END IF;
   anterior:=f."operacaoId";
 END LOOP;
END $$;


--
-- Name: conferir_participacao_bezerreiro(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_participacao_bezerreiro(animal_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE v_participacao record; cobertura datemultirange;
BEGIN
 FOR v_participacao IN SELECT participacao.*,b."loteId",b."propriedadeId",a."dataNascimento" FROM pecuaria."ParticipacaoBezerreiro" participacao
 JOIN pecuaria."PerfilBezerreiro" b ON b.id=participacao."perfilId" JOIN pecuaria."Animal" a ON a.id=participacao."animalId" WHERE participacao."animalId"=animal_id LOOP
  SELECT range_agg(daterange(l.desde,l.ate,'[)')) INTO cobertura FROM pecuaria."LocalizacaoAnimal" l
   WHERE l."animalId"=animal_id AND l."loteId"=v_participacao."loteId" AND l."propriedadeId"=v_participacao."propriedadeId";
  IF v_participacao.desde<v_participacao."dataNascimento" OR cobertura IS NULL OR NOT (daterange(v_participacao.desde,v_participacao.ate,'[)') <@ cobertura) THEN
   RAISE EXCEPTION 'Participação exige localização comprovada no lote/sítio durante todo o intervalo' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."PeriodoFaseBezerreiro" f JOIN pecuaria."FaseBezerreiroVersao" v ON v.id=f."faseVersaoId"
   WHERE f."participacaoId"=v_participacao.id AND (NOT v.publicada OR v."propriedadeId"<>v_participacao."propriedadeId" OR NOT daterange(f.desde,f.ate,'[)') <@ daterange(v_participacao.desde,v_participacao.ate,'[)'))) THEN
   RAISE EXCEPTION 'Fase deve ser publicada, do mesmo sítio e contida na participação' USING ERRCODE='23514';
  END IF;
 END LOOP;
END $$;


--
-- Name: conferir_participacao_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_participacao_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF NEW."programacaoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g.id=NEW."programacaoId" AND g."protocoloId"=NEW."protocoloId" AND (NEW."propriedadeId" IS NULL OR g."propriedadeId"=NEW."propriedadeId"))
 THEN RAISE EXCEPTION 'Programação incompatível com versão ou sítio da participação'; END IF;
 IF TG_OP='UPDATE' AND NEW."protocoloId"<>OLD."protocoloId" AND EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" WHERE "participacaoId"=OLD.id)
 THEN RAISE EXCEPTION 'Participação com tarefas não pode mudar de versão'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_pesagem_parto_trigger(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_pesagem_parto_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE id_vinculo text;
BEGIN
  IF TG_TABLE_NAME = 'VinculoPesagemParto' THEN
    PERFORM pecuaria.conferir_vinculo_pesagem_parto(NEW.id);
  ELSE
    FOR id_vinculo IN SELECT v.id FROM pecuaria."VinculoPesagemParto" v
      WHERE v."revogadoEm" IS NULL AND (
        (TG_TABLE_NAME = 'PartoAnimal' AND v."partoId" = NEW.id)
        OR (TG_TABLE_NAME = 'Pesagem' AND v."pesagemId" = NEW.id)
        OR (TG_TABLE_NAME = 'CriaParto' AND v."criaId" = NEW.id))
      ORDER BY v.id
    LOOP PERFORM pecuaria.conferir_vinculo_pesagem_parto(id_vinculo); END LOOP;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_referencia_gerencial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_referencia_gerencial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE f pecuaria."FornecimentoNutricionalLeite"; r RECORD; anterior INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Referências são snapshots imutáveis; registre nova versão'; END IF;
 SELECT * INTO STRICT f FROM pecuaria."FornecimentoNutricionalLeite" WHERE "id"=NEW."fornecimentoId" FOR UPDATE;
 SELECT x.*,c."propriedadeId",c."parceiroId",c."inicio",c."fim",o."status" INTO STRICT r FROM pecuaria."FechamentoOperacaoLeite" x JOIN pecuaria."OperacaoComercialLeite" c ON c."id"=x."comercialId" JOIN public."Operacao" o ON o."id"=x."operacaoId" WHERE x."id"=NEW."fechamentoId";
 SELECT COALESCE(MAX("versao"),0) INTO anterior FROM pecuaria."ReferenciaGerencialLeite" WHERE "fornecimentoId"=f."id";
 IF f."status"<>'CONFIRMADO' OR r."status"<>'CONFIRMADA' OR r."propriedadeId"<>f."propriedadeId" OR r."parceiroId"<>NEW."parceiroId" OR r."precoUnitario"<>NEW."precoUnitario" OR r."inicio"<>NEW."periodoInicio" OR r."fim"<>NEW."periodoFim" OR NEW."versao"<>anterior+1 OR ROUND(f."quantidadeLitros"*NEW."precoUnitario",2)<>NEW."valorTotal" OR
  date_trunc('month',r."inicio")<>date_trunc('month',r."fim") OR
  date_trunc('month',r."inicio")<>date_trunc('month',f."data")-(CASE WHEN NEW."provisoria" THEN interval '1 month' ELSE interval '0 month' END) OR
  EXISTS (SELECT 1 FROM pecuaria."FechamentoOperacaoLeite" x WHERE x."comercialId"=r."comercialId" AND x."versao">r."versao") THEN
  RAISE EXCEPTION 'Referência exige fechamento vigente comprovado do sítio e mês, valor e versão compatíveis';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_resultado_qualidade_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_resultado_qualidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE a RECORD; c JSONB;
BEGIN
  SELECT * INTO a FROM pecuaria."AmostraQualidadeLeite" WHERE id=NEW."amostraId";
  IF a.id IS NULL OR a.sujeito<>'COLETIVO' OR a.status<>'VALIDO' THEN RAISE EXCEPTION 'Resultado coletivo exige amostra coletiva válida' USING ERRCODE='23514'; END IF;
  SELECT x INTO c FROM jsonb_array_elements(a."formatoSnapshot"->'campos') x WHERE x->>'codigo'=NEW.campo;
  IF c IS NULL OR (c->>'unidade') IS DISTINCT FROM NEW.unidade THEN RAISE EXCEPTION 'Campo/unidade fora do formato preservado' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: conferir_retirada_interna_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_retirada_interna_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE rid text;
BEGIN
 IF TG_TABLE_NAME='RetiradaInternaLeite' THEN PERFORM pecuaria.validar_retirada_interna_leite(NEW.id);
 ELSE FOR rid IN SELECT id FROM pecuaria."RetiradaInternaLeite" WHERE "movimentoId"=NEW."movimentoId" LOOP PERFORM pecuaria.validar_retirada_interna_leite(rid); END LOOP; END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_rp_ocorrencia_trigger(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_rp_ocorrencia_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM pecuaria.conferir_rp_parto(o."partoRetencaoPlacentaId")
      FROM pecuaria."OcorrenciaSanitaria" o WHERE o.id = NEW.id AND o."partoRetencaoPlacentaId" IS NOT NULL;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_rp_parto(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_rp_parto(id_parto text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE parto pecuaria."PartoAnimal"%ROWTYPE;
BEGIN
  SELECT * INTO parto FROM pecuaria."PartoAnimal" WHERE id = id_parto FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM pecuaria."OcorrenciaSanitaria" o
    WHERE o."partoRetencaoPlacentaId" = id_parto AND o.status = 'VALIDO'
      AND (parto.status <> 'VALIDO' OR parto."retencaoPlacenta" IS DISTINCT FROM true
        OR o."animalId" <> parto."animalId" OR o.inicio < parto.data)
  ) THEN
    RAISE EXCEPTION 'Ocorrência de retenção de placenta incompatível com o parto %', id_parto;
  END IF;
END $$;


--
-- Name: conferir_rp_parto_trigger(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_rp_parto_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pecuaria.conferir_rp_parto(NEW.id);
  RETURN NULL;
END $$;


--
-- Name: conferir_saldo_colostro(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_saldo_colostro(origem_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE o record; usado numeric; u record; unidade_usada numeric; entrada_id text; fisico_usado numeric; reservado numeric;
BEGIN
 SELECT * INTO o FROM pecuaria."OrigemColostro" WHERE id=origem_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT
 COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."OrigemPreparoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NULL),0)+
 COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NULL),0)+
 COALESCE((SELECT sum("volumeLitros") FROM pecuaria."UnidadeBancoColostro" WHERE "origemId"=o.id AND status<>'ESTORNADA'),0) INTO usado;
 IF usado>o."quantidadeLitros" OR (o.status='ESTORNADO' AND usado<>0) THEN RAISE EXCEPTION 'Colostro sem saldo disponível ou origem estornada com consumidores' USING ERRCODE='23514'; END IF;
 IF o."loteColostroId" IS NOT NULL AND o.status='CONFIRMADO' THEN
  SELECT "entradaId" INTO entrada_id FROM pecuaria."LoteColostro" WHERE id=o."loteColostroId";
  IF NOT EXISTS(SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" WHERE e.id=entrada_id AND e.status='CONFIRMADA' AND m.status='CONFIRMADO') THEN RAISE EXCEPTION 'Origem bruta exige produção confirmada válida' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(sum(a.quantidade),0) INTO fisico_usado FROM pecuaria."AlocacaoLeiteEstoque" a JOIN public."MovimentoEstoque" m ON m.id=a."movimentoId" WHERE a."entradaId"=entrada_id AND m.status='CONFIRMADO';
  SELECT COALESCE((SELECT sum("volumeLitros") FROM pecuaria."UnidadeBancoColostro" WHERE "origemId"=o.id AND status<>'ESTORNADA'),0)
   -COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."OrigemPreparoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NOT NULL),0)
   -COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NOT NULL),0) INTO reservado;
  IF fisico_usado+reservado>o."quantidadeLitros" THEN RAISE EXCEPTION 'Saldo físico não comporta consumo e unidades reservadas de colostro' USING ERRCODE='23514'; END IF;
 END IF;
 FOR u IN SELECT * FROM pecuaria."UnidadeBancoColostro" WHERE "origemId"=o.id LOOP
  SELECT COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."OrigemPreparoColostro" WHERE "unidadeId"=u.id AND ativo),0)+
   COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "unidadeId"=u.id AND ativo),0) INTO unidade_usada;
  IF unidade_usada>u."volumeLitros" OR (unidade_usada>0 AND u.status<>'RETIRADA') THEN RAISE EXCEPTION 'Consumo exige unidade retirada e saldo da embalagem' USING ERRCODE='23514'; END IF;
 END LOOP;
END $$;


--
-- Name: conferir_segmentos_consumo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_segmentos_consumo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE pid TEXT; participacao RECORD; inicio DATE; fim DATE; dias INTEGER;
BEGIN
  IF TG_TABLE_NAME='ParticipacaoConsumoAnimal' THEN pid:=NEW.id;
  ELSIF TG_OP='DELETE' THEN pid:=OLD."participacaoId"; ELSE pid:=NEW."participacaoId"; END IF;
  SELECT * INTO participacao FROM pecuaria."ParticipacaoConsumoAnimal" WHERE id=pid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Participações legadas sem segmentos continuam válidas.
  IF NOT EXISTS (SELECT 1 FROM pecuaria."SegmentoConsumoAnimal" WHERE "participacaoId"=pid) THEN
    IF TG_TABLE_NAME='SegmentoConsumoAnimal' OR participacao."metodoPresenca" IS NOT NULL THEN RAISE EXCEPTION 'não remova a prova de participação' USING ERRCODE='23514'; END IF;
    RETURN NULL;
  END IF;
  SELECT f.inicio,f.fim INTO inicio,fim FROM pecuaria."FechamentoConsumo" f WHERE f.id=participacao."fechamentoId";
  SELECT sum(s.ate-s.desde) INTO dias FROM pecuaria."SegmentoConsumoAnimal" s WHERE s."participacaoId"=pid;
  IF dias<>participacao.dias OR EXISTS (SELECT 1 FROM pecuaria."SegmentoConsumoAnimal" s WHERE s."participacaoId"=pid AND (s.desde<inicio OR s.ate>fim+1))
    OR EXISTS (SELECT 1 FROM pecuaria."SegmentoConsumoAnimal" a JOIN pecuaria."SegmentoConsumoAnimal" b ON a."participacaoId"=b."participacaoId" AND a.id<b.id AND a.desde<b.ate AND b.desde<a.ate WHERE a."participacaoId"=pid)
  THEN RAISE EXCEPTION 'segmentos não conciliam presença congelada' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_tarefa_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_tarefa_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF (SELECT "protocoloId" FROM pecuaria."EtapaProtocolo" WHERE id=NEW."etapaId") IS DISTINCT FROM (SELECT "protocoloId" FROM pecuaria."ParticipacaoProtocolo" WHERE id=NEW."participacaoId") THEN RAISE EXCEPTION 'Etapa e participação precisam usar a mesma versão do protocolo'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_valor_entrada_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_valor_entrada_leite(eid text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE aid TEXT; ap RECORD; q NUMERIC; v NUMERIC; produzida NUMERIC; pendentes INTEGER;
BEGIN
  SELECT * INTO ap FROM pecuaria."ApuracaoValorLeite" WHERE "entradaId"=eid ORDER BY versao DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  aid:=ap.id;
  SELECT m.quantidade INTO produzida FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" WHERE e.id=ap."entradaId";
  IF EXISTS (SELECT 1 FROM pecuaria."ApropriacaoValorLeite" p JOIN pecuaria."AlocacaoLeiteEstoque" a ON a.id=p."alocacaoId" WHERE p."apuracaoId"=aid AND a."entradaId"<>ap."entradaId")
    THEN RAISE EXCEPTION 'apropriação pertence a outra produção' USING ERRCODE='23514'; END IF;
  SELECT sum(a.quantidade),sum(COALESCE(p."valorTotal",a."valorTotal")),count(*) FILTER (WHERE COALESCE(p."valorTotal",a."valorTotal") IS NULL) INTO q,v,pendentes
    FROM pecuaria."AlocacaoLeiteEstoque" a JOIN public."MovimentoEstoque" sm ON sm.id=a."movimentoId"
    LEFT JOIN pecuaria."ApropriacaoValorLeite" p ON p."alocacaoId"=a.id AND p."apuracaoId"=aid
    WHERE a."entradaId"=ap."entradaId" AND sm.status='CONFIRMADO' AND sm."reversaoDeId" IS NULL;
  IF pendentes>0 OR COALESCE(q,0)>produzida OR COALESCE(v,0)>ap."valorTotal" OR (q=produzida AND v<>ap."valorTotal")
    THEN RAISE EXCEPTION 'apuração não conserva valor dos consumidores e saldo' USING ERRCODE='23514'; END IF;
END $$;


--
-- Name: conferir_vinculo_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_vinculo_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE mid TEXT;
BEGIN
  IF TG_TABLE_NAME='EntradaProducaoLeite' OR TG_TABLE_NAME='AlocacaoLeiteEstoque' THEN
    IF TG_OP='DELETE' THEN mid:=OLD."movimentoId"; ELSE mid:=NEW."movimentoId"; END IF;
    PERFORM pecuaria.conferir_movimento_leite(mid);
  END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_vinculo_operacao_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE cid text; oid text;
BEGIN
 IF TG_TABLE_NAME='OperacaoComercialLeite' THEN cid:=NEW.id;
 ELSIF TG_TABLE_NAME IN ('RetiradaOperacaoLeite','FechamentoOperacaoLeite') THEN cid:=NEW."comercialId";
 ELSIF TG_TABLE_NAME='DetalheFechamentoLeite' THEN SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE id=NEW."fechamentoId";
 ELSIF TG_TABLE_NAME='Operacao' THEN SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=NEW.id OR "operacaoId"=NEW."corrigeOperacaoId" ORDER BY versao DESC LIMIT 1;
 ELSIF TG_TABLE_NAME IN ('ItemOperacao','TransacaoFinanceira','CompromissoFinanceiro') THEN
   SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=NEW."operacaoId";
 ELSIF TG_TABLE_NAME='Liquidacao' THEN
   SELECT "operacaoId" INTO oid FROM public."CompromissoFinanceiro" WHERE id=NEW."compromissoId";
   SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=oid;
 ELSIF TG_TABLE_NAME='MovimentoEstoque' THEN
   SELECT r."comercialId" INTO cid FROM pecuaria."RetiradaOperacaoLeite" r WHERE r."movimentoId"=NEW.id;
   IF cid IS NULL AND NEW."operacaoId" IS NOT NULL THEN SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=NEW."operacaoId"; END IF;
 END IF;
 IF cid IS NOT NULL THEN PERFORM pecuaria.conferir_operacao_comercial_leite(cid); END IF;
 RETURN NULL;
END $$;


--
-- Name: conferir_vinculo_pesagem_parto(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_vinculo_pesagem_parto(id_vinculo text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE vinculo pecuaria."VinculoPesagemParto"%ROWTYPE;
  parto pecuaria."PartoAnimal"%ROWTYPE;
  pesagem pecuaria."Pesagem"%ROWTYPE;
  cria pecuaria."CriaParto"%ROWTYPE;
BEGIN
  SELECT * INTO vinculo FROM pecuaria."VinculoPesagemParto" WHERE id = id_vinculo;
  IF NOT FOUND OR vinculo."revogadoEm" IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id = vinculo."partoId" FOR UPDATE;
  SELECT * INTO STRICT pesagem FROM pecuaria."Pesagem" WHERE id = vinculo."pesagemId" FOR UPDATE;
  IF parto.status <> 'VALIDO' OR pesagem.data < parto.data THEN
    RAISE EXCEPTION 'Pesagem vinculada exige parto válido e data a partir do parto';
  END IF;
  IF vinculo.sujeito = 'MATRIZ' THEN
    IF pesagem."animalId" <> parto."animalId" THEN RAISE EXCEPTION 'Pesagem não pertence à matriz do parto'; END IF;
  ELSE
    SELECT * INTO STRICT cria FROM pecuaria."CriaParto" WHERE id = vinculo."criaId" FOR UPDATE;
    IF cria."partoId" <> parto.id OR NOT cria.viva OR cria."animalId" IS DISTINCT FROM pesagem."animalId"
       OR pesagem.data <> parto.data OR pesagem.tipo <> 'NASCIMENTO' THEN
      RAISE EXCEPTION 'Peso de nascimento exige cria viva deste parto, mesma data e tipo NASCIMENTO';
    END IF;
  END IF;
END $$;


--
-- Name: conferir_vinculo_preparo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_vinculo_preparo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE fonte RECORD; alvo RECORD; material NUMERIC; servico NUMERIC; qtd INTEGER; integrais INTEGER; soma_material NUMERIC; soma_servico NUMERIC;
BEGIN
 IF NEW."encerradoEm" IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO alvo FROM pecuaria."TentativaReprodutiva" WHERE id=NEW."tentativaId";
 IF NEW."aplicacaoId" IS NOT NULL THEN
  SELECT a."animalId",a."propriedadeId",a.data,a."valorProdutoAtribuido",a."valorServicoAtribuido" INTO fonte FROM pecuaria."AplicacaoProduto" a WHERE a.id=NEW."aplicacaoId" FOR UPDATE;
 ELSIF NEW."exameId" IS NOT NULL THEN
  SELECT e."animalId",e."propriedadeId",e.data,NULL::NUMERIC AS "valorProdutoAtribuido",e."valorServicoAtribuido" INTO fonte FROM pecuaria."ExameAnimal" e WHERE e.id=NEW."exameId" FOR UPDATE;
 ELSE
  SELECT p."animalId",p."propriedadeId",p."inicioReferencia" AS data,NULL::NUMERIC AS "valorProdutoAtribuido",p."valorServicoAtribuido" INTO fonte FROM pecuaria."ParticipacaoProtocolo" p WHERE p.id=NEW."participacaoId" FOR UPDATE;
 END IF;
 IF fonte."propriedadeId" IS NULL OR alvo."propriedadeId" IS NULL OR fonte."animalId" IS DISTINCT FROM alvo."animalId" OR fonte."propriedadeId" IS DISTINCT FROM alvo."propriedadeId" OR fonte.data::date>alvo.data THEN RAISE EXCEPTION 'preparatório incompatível com animal/sítio/data da tentativa' USING ERRCODE='23514'; END IF;
 material:=fonte."valorProdutoAtribuido"; servico:=fonte."valorServicoAtribuido";
 IF material IS NULL THEN SELECT c."valorMaterialDocumentado" INTO material FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."aplicacaoId"=NEW."aplicacaoId"; END IF;
 SELECT count(*), count(*) FILTER (WHERE modo='INTEGRAL'), COALESCE(sum("valorMaterial"),0), COALESCE(sum("valorServico"),0)
 INTO qtd,integrais,soma_material,soma_servico FROM pecuaria."VinculoPreparoTentativa" v
 WHERE v.id<>NEW.id AND v."encerradoEm" IS NULL AND (v."aplicacaoId"=NEW."aplicacaoId" OR v."exameId"=NEW."exameId" OR v."participacaoId"=NEW."participacaoId");
 IF (NEW.modo='INTEGRAL' AND qtd>0) OR integrais>0 THEN RAISE EXCEPTION 'preparatório integral não pode ser replicado' USING ERRCODE='23514'; END IF;
 IF NEW.modo='PARCELA' AND ((NEW."valorMaterial" IS NOT NULL AND (material IS NULL OR soma_material+NEW."valorMaterial">material)) OR (NEW."valorServico" IS NOT NULL AND (servico IS NULL OR soma_servico+NEW."valorServico">servico))) THEN RAISE EXCEPTION 'parcelas ultrapassam o valor da origem' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_vinculo_tarefa(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_vinculo_tarefa() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE dono TEXT; tarefa_fato TEXT; tipo_fato TEXT; situacao TEXT;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."tarefaId",NEW.ordem,NEW."aplicacaoId",NEW."exameId",NEW."tentativaId",NEW."manejoId") IS DISTINCT FROM (OLD."tarefaId",OLD.ordem,OLD."aplicacaoId",OLD."exameId",OLD."tentativaId",OLD."manejoId")
 THEN RAISE EXCEPTION 'Vínculo conserva a execução original; registre outro vínculo'; END IF;
 IF NEW.estado<>'ATUAL' THEN RETURN NEW; END IF;
 IF NEW."aplicacaoId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."AplicacaoProduto" WHERE id=NEW."aplicacaoId"; tipo_fato:='APLICACAO';
 ELSIF NEW."exameId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."ExameAnimal" WHERE id=NEW."exameId"; tipo_fato:='EXAME';
 ELSIF NEW."manejoId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text,CASE WHEN tipo='RETIRADA_DISPOSITIVO' THEN 'RETIRADA' ELSE 'MANEJO' END INTO dono,tarefa_fato,situacao,tipo_fato FROM pecuaria."ManejoAnimal" WHERE id=NEW."manejoId";
 ELSE SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."TentativaReprodutiva" WHERE id=NEW."tentativaId"; tipo_fato:='TENTATIVA'; END IF;
 IF tarefa_fato IS DISTINCT FROM NEW."tarefaId" OR situacao<>'VALIDO' OR NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE t.id=NEW."tarefaId" AND p."animalId"=dono AND e.tipo=tipo_fato)
 THEN RAISE EXCEPTION 'Fato, animal e ação incompatíveis com a tarefa'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_vinculos_peso_secagem(text, text, text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.conferir_vinculos_peso_secagem(lactacao_alvo text, pesagem_alvo text, animal_alvo text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pecuaria"."VinculoPesagemSecagem" v
    JOIN "pecuaria"."LactacaoAnimal" l ON l.id = v."lactacaoId"
    JOIN "pecuaria"."Pesagem" p ON p.id = v."pesagemId"
    JOIN "pecuaria"."Animal" a ON a.id = p."animalId"
    WHERE v."revogadoEm" IS NULL
      AND (v."lactacaoId" = lactacao_alvo OR v."pesagemId" = pesagem_alvo OR p."animalId" = animal_alvo)
      AND (l."encerradaEm" IS NULL OR l."animalId" <> p."animalId" OR p.data IS DISTINCT FROM l."encerradaEm"
        OR (p."propriedadeId" IS NOT NULL AND p."propriedadeId" <> v."propriedadeId") OR p."contextoHistorico" = 'EXTERNO'
        OR a.sexo <> 'F' OR p.data < a."dataNascimento" OR p.data < a."dataEntrada"
        OR EXISTS (SELECT 1 FROM "pecuaria"."BaixaAnimal" b WHERE b."animalId" = p."animalId" AND b."estornadaEm" IS NULL AND p.data > b.data)
        OR (SELECT count(*) FROM "pecuaria"."LocalizacaoAnimal" loc WHERE loc."animalId" = p."animalId" AND loc.desde <= p.data
          AND (loc.ate IS NULL OR loc.ate > p.data OR EXISTS (SELECT 1 FROM "pecuaria"."BaixaAnimal" b WHERE b."animalId" = p."animalId" AND b."estornadaEm" IS NULL AND b.data = p.data AND b."localizacaoFechadaId" = loc.id))) <> 1
        OR NOT EXISTS (SELECT 1 FROM "pecuaria"."LocalizacaoAnimal" loc WHERE loc."animalId" = p."animalId" AND loc."propriedadeId" = v."propriedadeId" AND loc.desde <= p.data
          AND (loc.ate IS NULL OR loc.ate > p.data OR EXISTS (SELECT 1 FROM "pecuaria"."BaixaAnimal" b WHERE b."animalId" = p."animalId" AND b."estornadaEm" IS NULL AND b.data = p.data AND b."localizacaoFechadaId" = loc.id)))
      )
  ) THEN
    RAISE EXCEPTION 'Vínculo de secagem exige lactação encerrada, mesmo animal/data e sítio histórico comprovado' USING ERRCODE = '23514';
  END IF;
END $$;


--
-- Name: congelar_configuracao_dia_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.congelar_configuracao_dia_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM id FROM "pecuaria"."ConfiguracaoOrdenha"
    WHERE id=NEW."configuracaoId" AND "propriedadeId"=NEW."propriedadeId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuração da folha não pertence ao sítio' USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "pecuaria"."DiaProducaoLeite" WHERE "configuracaoId"=NEW."configuracaoId") THEN
    -- Primeiro uso invalida snapshots anteriores dos possíveis escritores.
    UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=NEW."configuracaoId";
  END IF;
  RETURN NEW;
END $$;


--
-- Name: exigir_explicacao_novo_aborto(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.exigir_explicacao_novo_aborto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.tipo='ABORTO' OR NEW.desfecho='ABORTO' THEN
  IF TG_OP='INSERT' THEN
   IF length(trim(COALESCE(NEW.observacao,'')))<5 THEN RAISE EXCEPTION 'explique a observação e contexto do aborto' USING ERRCODE='23514'; END IF;
  ELSIF (OLD.tipo IS DISTINCT FROM 'ABORTO' AND OLD.desfecho IS DISTINCT FROM 'ABORTO') OR NEW.observacao IS DISTINCT FROM OLD.observacao THEN
   IF length(trim(COALESCE(NEW.observacao,'')))<5 THEN RAISE EXCEPTION 'explique a observação e contexto do aborto' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: exigir_finalidade_medicao_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.exigir_finalidade_medicao_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE participante_id text; animal_id text; finalidade_id text; evidencia jsonb; dia date; quantidade integer;
BEGIN
 IF TG_TABLE_NAME='MedicaoLeite' THEN
   IF NEW.estado='PENDENTE' THEN RETURN NEW; END IF;
   participante_id:=NEW."participanteId";
 ELSE
   IF NOT NEW.ativo THEN RETURN NEW; END IF;
   SELECT "participanteId" INTO participante_id FROM pecuaria."MedicaoLeite" WHERE id=NEW."medicaoId";
 END IF;
 SELECT p."animalId",p."finalidadeId",p."finalidadeSnapshot",d."dataOperacional" INTO animal_id,finalidade_id,evidencia,dia
 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId" WHERE p.id=participante_id;
 PERFORM pg_advisory_xact_lock(hashtext('pec-animal:'||animal_id));
 SELECT count(*) INTO quantidade FROM pecuaria."finalidades_producao_na_data"(animal_id,dia);
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,dia) WHERE id=finalidade_id AND aptidao='LEITE')
 OR evidencia IS NULL OR evidencia->>'regra' IS DISTINCT FROM 'FINALIDADE_LEITE_V1' OR evidencia->>'aptidao' IS DISTINCT FROM 'LEITE'
 OR evidencia->>'dataOperacional' IS DISTINCT FROM to_char(dia,'YYYY-MM-DD') OR evidencia->>'finalidadeId' IS DISTINCT FROM finalidade_id THEN
   RAISE EXCEPTION 'Medição ou confirmação exige finalidade Leite histórica comprovada' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: exigir_identidade_versao_venda_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.exigir_identidade_versao_venda_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.chave IS NULL OR NEW.hash IS NULL THEN RAISE EXCEPTION 'nova versão comercial exige identidade de reenvio'; END IF;
  RETURN NEW;
END $$;


--
-- Name: finalidades_producao_na_data(text, date); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.finalidades_producao_na_data(animal_id text, dia date) RETURNS TABLE(id text, aptidao text, desde date, ate date, baixa_id text)
    LANGUAGE sql
    AS $$
 SELECT f.id, f.aptidao::text, f.desde, f.ate,
  CASE WHEN f.ate=dia THEN (SELECT min(b.id) FROM pecuaria."BaixaAnimal" b
   WHERE b."animalId"=animal_id AND b."destinoFechadoId"=f.id AND b.data=dia AND b."estornadaEm" IS NULL) END
 FROM pecuaria."FinalidadeAnimal" f WHERE f."animalId"=animal_id AND f.desde<=dia AND (
  f.ate IS NULL OR f.ate>dia OR f.ate=dia AND EXISTS (
   SELECT 1 FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=animal_id
    AND b."destinoFechadoId"=f.id AND b.data=dia AND b."estornadaEm" IS NULL))
$$;


--
-- Name: guard_cadeia_venda_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.guard_cadeia_venda_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE rid text; oid text; mid text;
BEGIN
  IF TG_TABLE_NAME='VersaoComercialVendaLeite' THEN
    PERFORM pecuaria.conferir_cadeia_venda_leite(NEW."retiradaId"); RETURN NULL;
  ELSIF TG_TABLE_NAME='Operacao' THEN
    oid:=NEW.id;
    FOR rid IN SELECT DISTINCT "retiradaId" FROM pecuaria."VersaoComercialVendaLeite"
      WHERE "operacaoId"=oid OR "operacaoId"=NEW."corrigeOperacaoId" LOOP
      PERFORM pecuaria.conferir_cadeia_venda_leite(rid);
    END LOOP; RETURN NULL;
  ELSIF TG_TABLE_NAME='MovimentoEstoque' THEN
    mid:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
    oid:=CASE WHEN TG_OP='DELETE' THEN OLD."operacaoId" ELSE NEW."operacaoId" END;
    FOR rid IN SELECT DISTINCT "retiradaId" FROM pecuaria."VersaoComercialVendaLeite" WHERE "retiradaId"=mid OR "operacaoId"=oid LOOP
      PERFORM pecuaria.conferir_cadeia_venda_leite(rid);
    END LOOP;
    -- Todo novo movimento leiteiro de venda exige a cadeia, inclusive fora dos serviços.
    IF TG_OP<>'DELETE' AND NEW."metodoValorizacao"='LEITE_FIFO_V1' AND NEW.tipo='SAIDA' AND NEW."operacaoId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" WHERE "retiradaId"=NEW.id)
    THEN RAISE EXCEPTION 'retirada de venda leiteira exige versão comercial'; END IF;
    RETURN NULL;
  ELSIF TG_TABLE_NAME='Liquidacao' THEN
    SELECT "operacaoId" INTO oid FROM public."CompromissoFinanceiro" WHERE id=NEW."compromissoId";
  ELSE
    oid:=CASE WHEN TG_OP='DELETE' THEN OLD."operacaoId" ELSE NEW."operacaoId" END;
  END IF;
  SELECT "retiradaId" INTO rid FROM pecuaria."VersaoComercialVendaLeite" WHERE "operacaoId"=oid;
  IF rid IS NOT NULL THEN PERFORM pecuaria.conferir_cadeia_venda_leite(rid); END IF;
  -- Reatribuir um fato financeiro/item também precisa validar a cadeia de origem.
  IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('ItemOperacao','CompromissoFinanceiro','TransacaoFinanceira') THEN
    SELECT "retiradaId" INTO rid FROM pecuaria."VersaoComercialVendaLeite" WHERE "operacaoId"=OLD."operacaoId";
    IF rid IS NOT NULL THEN PERFORM pecuaria.conferir_cadeia_venda_leite(rid); END IF;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: guard_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.guard_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE eid text; did text; rid text;
BEGIN
 IF TG_TABLE_NAME='Operacao' THEN
  FOR eid IN SELECT e.id FROM pecuaria."EntregaLeite" e JOIN pecuaria."VersaoComercialVendaLeite" v ON v."retiradaId"=e."retiradaId" WHERE v."operacaoId"=NEW.id OR v."operacaoId"=NEW."corrigeOperacaoId" LOOP PERFORM pecuaria.conferir_entrega_leite(eid); END LOOP; RETURN NULL;
 ELSIF TG_TABLE_NAME='EntregaLeite' THEN
  eid:=NEW.id;
  IF NOT EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" v JOIN public."Operacao" o ON o.id=v."operacaoId"
    WHERE v."retiradaId"=NEW."retiradaId" AND o.status='CONFIRMADA' AND o."parceiroId"=NEW."parceiroId" AND o."propriedadeId"=NEW."propriedadeId")
  THEN RAISE EXCEPTION 'comprador original da entrega deve conferir com a venda vigente no registro'; END IF;
 ELSIF TG_TABLE_NAME='ConferenciaEntregaLeite' THEN eid:=NEW."entregaId";
 ELSIF TG_TABLE_NAME='DemonstrativoLeite' THEN
  did:=NEW.id; FOR eid IN SELECT "entregaId" FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "demonstrativoId"=did LOOP PERFORM pecuaria.conferir_entrega_leite(eid); END LOOP;
 ELSE eid:=NEW."entregaId"; did:=NEW."demonstrativoId";
 END IF;
 IF eid IS NOT NULL THEN PERFORM pecuaria.conferir_entrega_leite(eid); END IF;
 IF did IS NOT NULL THEN PERFORM pecuaria.conferir_demonstrativo_leite(did); END IF; RETURN NULL;
END $$;


--
-- Name: guard_vinculo_medicao_entrada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.guard_vinculo_medicao_entrada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pecuaria.conferir_medicoes_entrada_leite(NEW."entradaId");
  RETURN NULL;
END $$;


--
-- Name: guardar_identidade_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.guardar_identidade_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'identidade comercial não pode ser apagada' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(OLD)-'status'-'versao') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'versao') OR NEW.versao<>OLD.versao+1 OR (OLD.status='FECHADA' AND NEW.status<>'FECHADA')
 THEN RAISE EXCEPTION 'identidade comercial imutável; altere somente versão e estado válidos' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: impedir_alteracao_revisao_prazo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.impedir_alteracao_revisao_prazo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'revisão de prazo é imutável' USING ERRCODE='23514'; END $$;


--
-- Name: impedir_consumo_legado_sobreposto(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.impedir_consumo_legado_sobreposto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('nutricao-config:'||NEW."propriedadeId"));
 IF NEW.status='CONFIRMADO' AND EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoNutricao" c WHERE c."propriedadeId"=NEW."propriedadeId" AND (c."loteId" IS NULL OR c."loteId"=NEW."loteId") AND c.desde<=NEW.fim) THEN RAISE EXCEPTION 'período utiliza nutrição mensal' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: impedir_edicao_politica_acompanhamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 RAISE EXCEPTION 'política de acompanhamento é imutável; crie nova versão' USING ERRCODE='23514';
END $$;


--
-- Name: impedir_mutacao_versao_venda_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.impedir_mutacao_versao_venda_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'versão comercial de leite é imutável; registre substituição explícita'; END $$;


--
-- Name: imutavel_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.imutavel_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 RAISE EXCEPTION 'fato comercial leiteiro é imutável; registre conferência ou anulação explícita'; END $$;


--
-- Name: imutavel_operacao_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.imutavel_operacao_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'histórico comercial leiteiro não pode ser reescrito ou apagado' USING ERRCODE='23514'; END $$;


--
-- Name: observar_fisico_colostro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.observar_fisico_colostro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_origem_id text;
BEGIN
 IF TG_TABLE_NAME='AlocacaoLeiteEstoque' THEN
  FOR v_origem_id IN SELECT origem.id FROM pecuaria."OrigemColostro" origem JOIN pecuaria."LoteColostro" l ON l.id=origem."loteColostroId" WHERE l."entradaId"=NEW."entradaId" LOOP PERFORM pecuaria.conferir_saldo_colostro(v_origem_id); END LOOP;
 ELSIF TG_TABLE_NAME='EntradaProducaoLeite' THEN
  FOR v_origem_id IN SELECT origem.id FROM pecuaria."OrigemColostro" origem JOIN pecuaria."LoteColostro" l ON l.id=origem."loteColostroId" WHERE l."entradaId"=NEW.id LOOP PERFORM pecuaria.conferir_saldo_colostro(v_origem_id); END LOOP;
 ELSE
  FOR v_origem_id IN SELECT DISTINCT origem.id FROM pecuaria."OrigemColostro" origem JOIN pecuaria."LoteColostro" l ON l.id=origem."loteColostroId" JOIN pecuaria."EntradaProducaoLeite" e ON e.id=l."entradaId" LEFT JOIN pecuaria."AlocacaoLeiteEstoque" a ON a."entradaId"=e.id WHERE e."movimentoId"=NEW.id OR a."movimentoId"=NEW.id LOOP PERFORM pecuaria.conferir_saldo_colostro(v_origem_id); END LOOP;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: observar_origem_fornecimento_nutricional_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE identidade TEXT;
BEGIN
 IF TG_TABLE_NAME='ItemFechamentoConsumo' THEN
  FOR identidade IN SELECT "id" FROM pecuaria."FornecimentoNutricionalLeite" WHERE "itemId"=NEW."id" LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
  END LOOP;
 ELSIF TG_TABLE_NAME='ParticipacaoConsumoAnimal' THEN
  IF TG_OP='DELETE' THEN
   FOR identidade IN SELECT f."id" FROM pecuaria."FornecimentoNutricionalLeite" f JOIN pecuaria."ItemFechamentoConsumo" i ON i."id"=f."itemId" WHERE i."fechamentoId"=OLD."fechamentoId" LOOP
    PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
   END LOOP;
  ELSE
   FOR identidade IN SELECT f."id" FROM pecuaria."FornecimentoNutricionalLeite" f JOIN pecuaria."ItemFechamentoConsumo" i ON i."id"=f."itemId" WHERE i."fechamentoId"=NEW."fechamentoId" LOOP
    PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
   END LOOP;
  END IF;
 ELSIF TG_TABLE_NAME='FechamentoConsumo' THEN
  FOR identidade IN SELECT f."id" FROM pecuaria."FornecimentoNutricionalLeite" f JOIN pecuaria."ItemFechamentoConsumo" i ON i."id"=f."itemId" WHERE i."fechamentoId"=NEW."id" LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
  END LOOP;
 ELSE
  FOR identidade IN SELECT "fornecimentoId" FROM pecuaria."MovimentoFornecimentoNutricionalLeite" WHERE "movimentoId"=NEW."id" OR "movimentoId"=NEW."reversaoDeId" LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: observar_participacao_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.observar_participacao_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE a text;
BEGIN
 IF TG_TABLE_NAME='PeriodoFaseBezerreiro' THEN
  SELECT "animalId" INTO a FROM pecuaria."ParticipacaoBezerreiro" WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD."participacaoId" ELSE NEW."participacaoId" END;
 ELSE a:=CASE WHEN TG_OP='DELETE' THEN OLD."animalId" ELSE NEW."animalId" END; END IF;
 PERFORM pecuaria.conferir_participacao_bezerreiro(a);
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'PeriodoFaseBezerreiro' THEN
  IF OLD."animalId" IS DISTINCT FROM NEW."animalId" THEN PERFORM pecuaria.conferir_participacao_bezerreiro(OLD."animalId"); END IF;
 END IF;
 RETURN NULL;
END $$;


--
-- Name: observar_saldo_colostro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.observar_saldo_colostro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='OrigemColostro' THEN PERFORM pecuaria.conferir_saldo_colostro(NEW.id);
 ELSE PERFORM pecuaria.conferir_saldo_colostro(NEW."origemId"); END IF;
 RETURN NULL;
END $$;


--
-- Name: preparar_fase_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preparar_fase_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE c record;
BEGIN
 IF NEW."coleiraId" IS NULL THEN NEW."coleiraSnapshot":=NULL;
 ELSE
  SELECT * INTO STRICT c FROM pecuaria."ColeiraBezerreiro" WHERE id=NEW."coleiraId";
  IF c."propriedadeId"<>NEW."propriedadeId" THEN RAISE EXCEPTION 'Coleira de outro sítio' USING ERRCODE='23514'; END IF;
  NEW."coleiraSnapshot":=jsonb_build_object('id',c.id,'nome',c.nome,'cor',c.cor);
 END IF;
 RETURN NEW;
END $$;


--
-- Name: preservar_fato_nutricional_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_fato_nutricional_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='FornecimentoNutricionalLeite' THEN
  IF TG_OP='UPDATE' THEN
   IF OLD."status"='CONFIRMADO' AND NEW."status"='ESTORNADO' AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
  END IF;
 END IF;
 RAISE EXCEPTION 'Fatos nutricionais leiteiros são imutáveis; use estorno do fechamento';
END $$;


--
-- Name: preservar_fatos_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_fatos_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE antes jsonb; depois jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fato histórico deve ser estornado, nunca excluído' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='GrupoOfertaBezerreiro' OR TG_TABLE_NAME='InsumoPreparoColostro' THEN RAISE EXCEPTION 'Fato confirmado é imutável' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='LoteColostro' THEN
  IF OLD.status='RASCUNHO' THEN
   IF (OLD."partoId",OLD."matrizId",OLD."propriedadeId",OLD.chave,OLD.hash) IS DISTINCT FROM (NEW."partoId",NEW."matrizId",NEW."propriedadeId",NEW.chave,NEW.hash) THEN RAISE EXCEPTION 'Identidade da retirada é histórica' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END IF;
 ELSIF TG_TABLE_NAME='DestinacaoColostro' THEN
  IF OLD.snapshot IS NULL AND NEW.snapshot IS NOT NULL AND (to_jsonb(NEW)-'snapshot')=(to_jsonb(OLD)-'snapshot') THEN RETURN NEW; END IF;
 END IF;
 antes:=to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'];
 depois:=to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'];
 IF OLD.status<>'CONFIRMADO' OR NEW.status<>'ESTORNADO' OR antes<>depois OR NEW.versao<>OLD.versao+1 OR NEW."estornadoEm" IS NULL OR COALESCE(length(btrim(NEW."motivoEstorno")),0)=0 THEN
  RAISE EXCEPTION 'Fato confirmado admite somente estorno motivado preservando identidade' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: preservar_formato_qualidade_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_formato_qualidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (NEW."tipoResultado",NEW.unidade,NEW.opcoes,NEW.campos) IS DISTINCT FROM (OLD."tipoResultado",OLD.unidade,OLD.opcoes,OLD.campos) AND EXISTS (SELECT 1 FROM pecuaria."AmostraQualidadeLeite" WHERE "tipoExameId"=OLD.id) THEN
    RAISE EXCEPTION 'Formato de qualidade utilizado exige nova versão' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: preservar_historico_peso_secagem(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_historico_peso_secagem() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Vínculo de secagem preserva histórico; use revogação' USING ERRCODE = '23514';
  END IF;
  IF OLD."revogadoEm" IS NOT NULL OR
    ROW(OLD."id", OLD."lactacaoId", OLD."pesagemId", OLD."propriedadeId", OLD."evidenciaSnapshot", OLD."criadoEm", OLD."criadoPorId")
    IS DISTINCT FROM ROW(NEW."id", NEW."lactacaoId", NEW."pesagemId", NEW."propriedadeId", NEW."evidenciaSnapshot", NEW."criadoEm", NEW."criadoPorId") THEN
    RAISE EXCEPTION 'Revise o vínculo de secagem por revogação e nova associação' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: preservar_origens_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_origens_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='PerfilBezerreiro' THEN
  IF (OLD."loteId",OLD."propriedadeId") IS DISTINCT FROM (NEW."loteId",NEW."propriedadeId") THEN RAISE EXCEPTION 'Perfil conserva lote e sítio de origem' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ColeiraBezerreiro' THEN
  IF OLD."propriedadeId"<>NEW."propriedadeId" THEN RAISE EXCEPTION 'Coleira conserva sítio de origem' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='PartoAnimal' THEN
  IF (OLD."animalId",OLD."propriedadeId",OLD.data,OLD."ocorridoEm",OLD.status) IS DISTINCT FROM (NEW."animalId",NEW."propriedadeId",NEW.data,NEW."ocorridoEm",NEW.status) AND EXISTS(SELECT 1 FROM pecuaria."LoteColostro" WHERE "partoId"=OLD.id AND status<>'ESTORNADO') THEN RAISE EXCEPTION 'Regularize retiradas de colostro antes de corrigir o parto produtor' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: preservar_programacao_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_programacao_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='ConfiguracaoBezerreiro' THEN
  RAISE EXCEPTION 'Configuração é histórica; crie nova versão' USING ERRCODE='23514';
 ELSIF TG_TABLE_NAME='FaseBezerreiroVersao' THEN
  IF OLD.publicada THEN RAISE EXCEPTION 'Fase publicada é histórica; crie nova versão' USING ERRCODE='23514'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM pecuaria."FaseBezerreiroVersao" WHERE id=OLD."faseVersaoId" AND publicada) THEN RAISE EXCEPTION 'Programação publicada é histórica; crie nova versão' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: preservar_referencia_protocolo_publicado(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_referencia_protocolo_publicado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF (OLD.publicado OR OLD."publicadoEm" IS NOT NULL) AND NEW."referenciaTecnica" IS DISTINCT FROM OLD."referenciaTecnica" THEN
  RAISE EXCEPTION 'a referência técnica da versão publicada é imutável; crie uma versão derivada' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: preservar_resultado_qualidade_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_resultado_qualidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Resultado de qualidade é histórico; substitua com revisão' USING ERRCODE='23514'; END IF;
  IF (NEW.id,NEW."amostraId",NEW.campo,NEW.valor,NEW.unidade,NEW."criadoEm",NEW."criadoPorId") IS DISTINCT FROM (OLD.id,OLD."amostraId",OLD.campo,OLD.valor,OLD.unidade,OLD."criadoEm",OLD."criadoPorId") OR NOT OLD.vigente OR NEW.vigente OR NEW."substituidoEm" IS NULL THEN
    RAISE EXCEPTION 'Só é permitido encerrar a vigência do resultado histórico' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: preservar_vinculo_tentativa(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.preservar_vinculo_tentativa() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'vínculo factual não pode ser apagado' USING ERRCODE='23514'; END $$;


--
-- Name: proteger_ativacao_perfil_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_ativacao_perfil_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 -- O lote é o ponto de serialização compartilhado com movimentações/cadastro.
 PERFORM 1 FROM pecuaria."Lote" WHERE id=NEW."loteId" FOR UPDATE;
 IF NOT NEW.ativo AND (EXISTS(SELECT 1 FROM pecuaria."LocalizacaoAnimal" WHERE "loteId"=NEW."loteId" AND ate IS NULL)
   OR EXISTS(SELECT 1 FROM pecuaria."ParticipacaoBezerreiro" WHERE "perfilId"=NEW.id AND ate IS NULL)) THEN
   RAISE EXCEPTION 'Movimente os animais e encerre as participações antes de desativar o perfil do Bezerreiro' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_baixa_com_producao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_baixa_com_producao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE animais text[]; datas date[]; animal_id text; dia date;
BEGIN
 IF TG_OP='INSERT' THEN animais:=ARRAY[NEW."animalId"]; datas:=ARRAY[NEW.data];
 ELSIF TG_OP='DELETE' THEN animais:=ARRAY[OLD."animalId"]; datas:=ARRAY[OLD.data];
 ELSE animais:=ARRAY[OLD."animalId",NEW."animalId"]; datas:=ARRAY[OLD.data,NEW.data]; END IF;
 PERFORM pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext('pec-animal:'||k) AS h FROM unnest(animais) AS k) chaves ORDER BY h;
 FOR animal_id IN SELECT DISTINCT unnest(animais) LOOP
  FOR dia IN SELECT DISTINCT unnest(datas) LOOP
   IF EXISTS (SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
    WHERE p."animalId"=animal_id AND p."excluidoEm" IS NULL AND d."dataOperacional"=dia AND (
     (SELECT count(*) FROM pecuaria."finalidades_producao_na_data"(animal_id,dia))<>1
     OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,dia) f WHERE f.aptidao='LEITE' AND (p."finalidadeId" IS NULL OR f.id=p."finalidadeId"))
    )) THEN RAISE EXCEPTION 'Alteração da baixa retira a finalidade comprovada da ordenha; regularize ou reabra a finalidade na mesma transação' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_catalogo_avaliacao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_catalogo_avaliacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'catálogo de avaliação publicado é imutável' USING ERRCODE='23514'; END $$;


--
-- Name: proteger_conferencia_saldo_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_conferencia_saldo_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE anterior integer;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Conferência física é histórica; registre nova versão com motivo' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('leite-conferencia:'||NEW."propriedadeId"||':'||NEW."produtoId"||':'||NEW.data));
  SELECT max(versao) INTO anterior FROM pecuaria."ConferenciaSaldoLeite" WHERE "propriedadeId"=NEW."propriedadeId" AND "produtoId"=NEW."produtoId" AND data=NEW.data;
  IF NEW.versao<>COALESCE(anterior,0)+1 THEN RAISE EXCEPTION 'Conferência física exige versão sequencial do mesmo produto/sítio/data' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public."Produto" WHERE id=NEW."produtoId" AND unidade='L' AND NOT "rastrearPartidas") THEN RAISE EXCEPTION 'Conferência leiteira exige produto em litros com origem por ordenha' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_configuracao_ordenha_usada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_configuracao_ordenha_usada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM id FROM "pecuaria"."ConfiguracaoOrdenha" WHERE id=OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "pecuaria"."DiaProducaoLeite" WHERE "configuracaoId"=OLD.id) THEN
    RAISE EXCEPTION 'Configuração utilizada por folha é imutável; publique nova vigência' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_convergencia_necessidade(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_convergencia_necessidade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD."convergidaParaId" IS NOT NULL THEN
  RAISE EXCEPTION 'identidade convergida preserva seu histórico' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND OLD."convergidaParaId" IS NOT NULL AND NOT (
  OLD."alertaId" IS NULL AND NEW."alertaId" IS NOT NULL
  AND (to_jsonb(NEW)-'alertaId'-'atualizadoEm')=(to_jsonb(OLD)-'alertaId'-'atualizadoEm')
 ) AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'convergência registrada é imutável' USING ERRCODE='23514';
 END IF;
 IF TG_OP<>'DELETE' AND NEW."convergidaParaId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM pecuaria."NecessidadeReprodutiva" n WHERE n.id=NEW."convergidaParaId"
   AND n."animalId"=NEW."animalId" AND n."convergidaParaId" IS NULL
 ) THEN RAISE EXCEPTION 'convergência exige identidade atual do mesmo animal' USING ERRCODE='23514'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: proteger_decisao_elegibilidade(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_decisao_elegibilidade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Anule a decisão de elegibilidade com motivo'; END IF;
 IF OLD.status<>'VALIDO' OR NEW.status<>'ANULADO'
 OR (to_jsonb(NEW)-ARRAY['status','anuladoEm','motivoAnulacao']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','anuladoEm','motivoAnulacao'])
 THEN RAISE EXCEPTION 'Decisões são imutáveis; registre outro evento ou anule explicitamente'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_descarte_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_descarte_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histórico de descarte não pode ser apagado' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'CONFIRMADO' OR NEW.versao<>1 OR NEW."movimentoEstornoId" IS NOT NULL OR NEW."estornadoEm" IS NOT NULL OR NEW."estornadoPorId" IS NOT NULL OR NEW."motivoEstorno" IS NOT NULL
    THEN RAISE EXCEPTION 'Descarte inicia confirmado na versão um, sem estorno' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId'])
      OR OLD.status<>'CONFIRMADO' OR NEW.status<>'ESTORNADO' OR NEW.versao<>OLD.versao+1 OR NEW."movimentoEstornoId" IS NULL OR NEW."estornadoEm" IS NULL OR NEW."motivoEstorno" IS NULL OR length(btrim(NEW."motivoEstorno"))<5
    THEN RAISE EXCEPTION 'Fatos do descarte são imutáveis; apenas estorno terminal com versão e motivo' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_emissao_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_emissao_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Emissão de leite é histórica; gere outra emissão sem reescrever o corte' USING ERRCODE='23514'; END $$;


--
-- Name: proteger_entrada_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_entrada_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."medicaoGeralId" IS DISTINCT FROM OLD."medicaoGeralId" OR NEW.id IS DISTINCT FROM OLD.id OR NEW."sessaoId" IS DISTINCT FROM OLD."sessaoId" OR NEW."versaoSessao" IS DISTINCT FROM OLD."versaoSessao"
    OR NEW."movimentoId" IS DISTINCT FROM OLD."movimentoId" OR NEW.chave IS DISTINCT FROM OLD.chave OR NEW.hash IS DISTINCT FROM OLD.hash
    OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" OR NEW."criadoPorId" IS DISTINCT FROM OLD."criadoPorId"
    OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='CONFIRMADA' AND NEW.status='ANULADA'))
    THEN RAISE EXCEPTION 'identidade da produção confirmada é imutável; regularize a origem' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_estrutura_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_estrutura_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE protocolo_alvo TEXT; bloqueada BOOLEAN;
BEGIN
  protocolo_alvo := CASE WHEN TG_OP = 'DELETE' THEN OLD."protocoloId" ELSE NEW."protocoloId" END;
  IF TG_OP = 'UPDATE' AND NEW."protocoloId" <> OLD."protocoloId" THEN
    RAISE EXCEPTION 'Uma ação ou momento não pode mudar de versão';
  END IF;
  PERFORM 1 FROM pecuaria."Protocolo" p WHERE p.id = protocolo_alvo FOR UPDATE;
  SELECT p.publicado OR p."publicadoEm" IS NOT NULL
    OR EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" a WHERE a."protocoloId" = p.id)
    OR EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = p.id)
    INTO bloqueada FROM pecuaria."Protocolo" p WHERE p.id = protocolo_alvo;
  IF bloqueada THEN RAISE EXCEPTION 'Estrutura publicada ou utilizada é imutável; crie outra versão'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: proteger_etapa_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_etapa_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF (SELECT publicado OR "publicadoEm" IS NOT NULL FROM pecuaria."Protocolo" WHERE id=OLD."protocoloId") OR EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" WHERE "etapaId"=OLD.id)
 THEN RAISE EXCEPTION 'Etapa publicada ou usada é imutável'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_fatos_destino_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_fatos_destino_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: proteger_finalidade_com_producao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_finalidade_com_producao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE animal_id text; inicio date; fim date;
BEGIN
 animal_id:=CASE WHEN TG_OP='DELETE' THEN OLD."animalId" ELSE NEW."animalId" END;
 IF TG_OP='UPDATE' AND OLD."animalId" IS DISTINCT FROM NEW."animalId" THEN
  -- A troca de proprietário não pode deslocar a evidência do animal original.
  PERFORM pg_advisory_xact_lock(h) FROM
   (SELECT DISTINCT hashtext('pec-animal:'||k) AS h FROM unnest(ARRAY[OLD."animalId",NEW."animalId"]) AS k) chaves ORDER BY h;
  IF EXISTS (SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" WHERE "finalidadeId"=OLD.id) OR EXISTS (
   SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
   WHERE p."animalId"=OLD."animalId" AND p."excluidoEm" IS NULL AND d."dataOperacional">=OLD.desde AND (OLD.ate IS NULL OR d."dataOperacional"<OLD.ate)
    AND ((SELECT count(*) FROM pecuaria."finalidades_producao_na_data"(OLD."animalId",d."dataOperacional") f)<>1
     OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(OLD."animalId",d."dataOperacional") f WHERE f.aptidao='LEITE' ))
  ) THEN RAISE EXCEPTION 'Troca de animal da finalidade invalida evidência de ordenha do animal original' USING ERRCODE='23514'; END IF;
 END IF;
 inicio:=CASE WHEN TG_OP='INSERT' THEN NEW.desde WHEN TG_OP='DELETE' THEN OLD.desde ELSE LEAST(OLD.desde,NEW.desde) END;
 fim:=CASE WHEN TG_OP='INSERT' THEN NEW.ate WHEN TG_OP='DELETE' THEN OLD.ate WHEN OLD.ate IS NULL OR NEW.ate IS NULL THEN NULL ELSE GREATEST(OLD.ate,NEW.ate) END;
 IF TG_OP='UPDATE' AND ROW(OLD."animalId",OLD.aptidao,OLD.desde) IS NOT DISTINCT FROM ROW(NEW."animalId",NEW.aptidao,NEW.desde) THEN
   inicio:=LEAST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
   fim:=GREATEST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('pec-animal:'||animal_id));
 IF EXISTS (
  SELECT 1 FROM pecuaria."ParticipanteProducaoLeite" p JOIN pecuaria."DiaProducaoLeite" d ON d.id=p."diaId"
  WHERE p."animalId"=animal_id AND p."excluidoEm" IS NULL AND d."dataOperacional">=inicio AND (fim IS NULL OR d."dataOperacional"<fim) AND (
   (SELECT count(*) FROM pecuaria."finalidades_producao_na_data"(animal_id,d."dataOperacional") f)<>1
   OR NOT EXISTS (SELECT 1 FROM pecuaria."finalidades_producao_na_data"(animal_id,d."dataOperacional") f WHERE f.aptidao='LEITE' )
  )
 ) THEN RAISE EXCEPTION 'Mudança de finalidade invalida ordenha; concilie explicitamente a folha antes de alterar' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_finalidade_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_finalidade_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.finalidade IS DISTINCT FROM OLD.finalidade AND (
    OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR
    EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId" = OLD.id) OR
    EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = OLD.id)
  ) THEN RAISE EXCEPTION 'Finalidade publicada ou utilizada é imutável; crie outra versão'; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_formato_catalogo_avaliacao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_formato_catalogo_avaliacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('pec-tipo-exame:' || OLD.id));
 IF (NEW."tipoResultado", NEW.campos, NEW.unidade, NEW.opcoes, NEW.contexto)
   IS DISTINCT FROM (OLD."tipoResultado", OLD.campos, OLD.unidade, OLD.opcoes, OLD.contexto)
   AND EXISTS (SELECT 1 FROM pecuaria."CatalogoAvaliacaoReprodutiva" c WHERE c."tipoExameId"=OLD.id)
 THEN RAISE EXCEPTION 'formato usado em catálogo exige nova versão' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_historico_nutricao_mensal(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_historico_nutricao_mensal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE m RECORD; antigo BOOLEAN; novo BOOLEAN; inicio_antigo DATE; inicio_novo DATE; fim_antigo DATE; fim_novo DATE; lote_antigo TEXT; lote_novo TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN inicio_antigo:=OLD.desde; fim_antigo:=OLD.ate; lote_antigo:=OLD."loteId"; END IF;
 IF TG_OP<>'DELETE' THEN inicio_novo:=NEW.desde; fim_novo:=NEW.ate; lote_novo:=NEW."loteId"; END IF;
 FOR m IN SELECT d.data,c."loteId",c.id FROM pecuaria."MesNutricao" c JOIN pecuaria."ConsumoDiario" d ON d."mesId"=c.id WHERE c."revisadoEm" IS NOT NULL AND c."loteId" IN (lote_antigo,lote_novo) LOOP
   antigo:=COALESCE(lote_antigo=m."loteId" AND inicio_antigo<=m.data AND (fim_antigo IS NULL OR fim_antigo>m.data),false);
   novo:=COALESCE(lote_novo=m."loteId" AND inicio_novo<=m.data AND (fim_novo IS NULL OR fim_novo>m.data),false);
   IF antigo IS DISTINCT FROM novo THEN RAISE EXCEPTION 'reabra o mês nutricional % antes de alterar a história',m.id USING ERRCODE='23514'; END IF;
   IF TG_TABLE_NAME='VigenciaDietaLote' AND antigo AND novo AND TG_OP='UPDATE' THEN
     IF NEW."dietaId"<>OLD."dietaId" THEN RAISE EXCEPTION 'dieta de mês revisado é imutável' USING ERRCODE='23514'; END IF;
   END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;


--
-- Name: proteger_historico_origem_geral(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_historico_origem_geral() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE ids text[]; animal_id text; inicio date; fim date; atual record;
BEGIN
 IF TG_TABLE_NAME='Animal' THEN
  IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.sexo,NEW."dataNascimento",NEW."dataEntrada") IS NOT DISTINCT FROM ROW(OLD.id,OLD.sexo,OLD."dataNascimento",OLD."dataEntrada") THEN RETURN NEW; END IF;
  IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
 ELSE
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW."animalId"];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD."animalId"]; ELSE ids:=ARRAY[OLD."animalId",NEW."animalId"]; END IF;
 END IF;
 IF TG_TABLE_NAME='FinalidadeAnimal' THEN
  inicio:=CASE WHEN TG_OP='INSERT' THEN NEW.desde WHEN TG_OP='DELETE' THEN OLD.desde ELSE LEAST(OLD.desde,NEW.desde) END;
  fim:=CASE WHEN TG_OP='INSERT' THEN NEW.ate WHEN TG_OP='DELETE' THEN OLD.ate WHEN OLD.ate IS NULL OR NEW.ate IS NULL THEN NULL ELSE GREATEST(OLD.ate,NEW.ate) END;
  IF TG_OP='UPDATE' AND ROW(OLD."animalId",OLD.aptidao,OLD.desde) IS NOT DISTINCT FROM ROW(NEW."animalId",NEW.aptidao,NEW.desde) THEN
   inicio:=LEAST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
   fim:=GREATEST(COALESCE(OLD.ate,'infinity'::date),COALESCE(NEW.ate,'infinity'::date));
  END IF;
 END IF;
 FOR animal_id IN SELECT DISTINCT unnest(ids) LOOP
  PERFORM pecuaria.conferir_historico_origem_geral(animal_id,inicio,fim);
 END LOOP;
 IF TG_TABLE_NAME='LactacaoAnimal' AND TG_OP<>'INSERT' THEN
  SELECT * INTO atual FROM pecuaria."LactacaoAnimal" WHERE id=OLD.id;
  -- Uma aferição antes coberta por esta lactação não pode perder sua origem,
  -- mesmo quando ainda não há entrada confirmada nem participante individual.
  IF EXISTS (SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId"
   JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
   WHERE g."animaisOrigem" @> jsonb_build_array(OLD."animalId") AND d."dataOperacional">=OLD.inicio
    AND (OLD."encerradaEm" IS NULL OR d."dataOperacional"<OLD."encerradaEm")
    AND (atual.id IS NULL OR atual."animalId"<>OLD."animalId" OR d."dataOperacional"<atual.inicio OR d."dataOperacional">=atual."encerradaEm")) THEN
   RAISE EXCEPTION 'Alteração retira lactação de origem geral guardada; regularize a aferição antes' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;


--
-- Name: proteger_identidade_dia_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_identidade_dia_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF ROW(NEW.id, NEW."propriedadeId", NEW."dataOperacional", NEW."configuracaoId", NEW."criadoEm", NEW."criadoPorId")
    IS DISTINCT FROM ROW(OLD.id, OLD."propriedadeId", OLD."dataOperacional", OLD."configuracaoId", OLD."criadoEm", OLD."criadoPorId") THEN
    RAISE EXCEPTION 'Identidade e autoria da folha são imutáveis' USING ERRCODE='23514';
  END IF;
  IF NEW.versao <> OLD.versao + 1 THEN
    RAISE EXCEPTION 'Atualização da folha exige próxima versão' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_identidade_medicao_com_origem(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_identidade_medicao_com_origem() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF ROW(NEW.id,NEW."sessaoId",NEW."diaId",NEW."participanteId") IS DISTINCT FROM ROW(OLD.id,OLD."sessaoId",OLD."diaId",OLD."participanteId")
    AND EXISTS (SELECT 1 FROM pecuaria."VinculoMedicaoEntradaLeite" WHERE "medicaoId"=OLD.id)
  THEN RAISE EXCEPTION 'identidade da medição com origem física preservada é imutável' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_insercao_retirada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_insercao_retirada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ManejoAnimal" m WHERE m."insercaoAplicacaoId"=NEW.id AND (m.status='VALIDO' OR m."realizacaoMantida") AND (NOT (NEW.status='VALIDO' OR NEW."consumoMantido" AND NEW."administracaoMantida" IS DISTINCT FROM false) OR NEW."animalId"<>m."animalId" OR NEW.data>m.data OR (NEW.data=m.data AND NEW."precisaoTemporal"='HORA' AND m."precisaoTemporal"='HORA' AND NEW."aplicadaEm">m."realizadaEm"))) THEN RAISE EXCEPTION 'Revise a retirada vinculada antes de alterar ou anular a inserção'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_item_mensal(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_item_mensal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ConsumoDiario" d JOIN pecuaria."MesNutricao" m ON m.id=d."mesId" WHERE d.id=NEW."diaId" AND m."revisadoEm" IS NOT NULL) THEN RAISE EXCEPTION 'reabra o mês antes de alterar seus consumos' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_medicao_leite_confirmada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_medicao_leite_confirmada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE sid TEXT; sessoes TEXT[];
BEGIN
  IF TG_OP='UPDATE' THEN sessoes:=ARRAY[OLD."sessaoId",NEW."sessaoId"];
  ELSIF TG_OP='DELETE' THEN sessoes:=ARRAY[OLD."sessaoId"];
  ELSE sessoes:=ARRAY[NEW."sessaoId"]; END IF;
  -- Mesma barreira da confirmação, antes de observar entradas concorrentes.
  PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=ANY(sessoes) ORDER BY id FOR NO KEY UPDATE;
  IF TG_OP='DELETE' THEN sid:=OLD."sessaoId"; ELSE sid:=NEW."sessaoId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=sid AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'ordenha confirmada exige regularização antes de editar medições' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."sessaoId" IS DISTINCT FROM NEW."sessaoId" AND EXISTS
    (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD."sessaoId" AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'medição de ordenha confirmada não pode mudar de sessão' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_modalidades_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_modalidades_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (NEW."modalidadeTentativa", NEW."modalidadeDiagnostico") IS DISTINCT FROM (OLD."modalidadeTentativa", OLD."modalidadeDiagnostico") AND (
    OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR
    EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId" = OLD.id) OR
    EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = OLD.id)
  ) THEN RAISE EXCEPTION 'Modalidades publicadas ou utilizadas são imutáveis; crie outra versão'; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_momento_snapshot_tarefa(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_momento_snapshot_tarefa() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."momentoSnapshot" IS DISTINCT FROM OLD."momentoSnapshot" THEN
    RAISE EXCEPTION 'O momento congelado da tarefa é imutável';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_movimento_nutricional(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_movimento_nutricional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."MovimentoConsumoDiario" v WHERE v."movimentoId"=OLD.id) AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'corrija o consumo pelo fechamento mensal' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;


--
-- Name: proteger_natureza_entrada_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_natureza_entrada_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE produto TEXT; anterior RECORD;
BEGIN
  SELECT m."produtoId" INTO produto FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId"
    WHERE e.id=NEW."entradaId" AND e.status='CONFIRMADA';
  IF NOT FOUND THEN RAISE EXCEPTION 'declaração exige origem leiteira confirmada' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||produto));
  SELECT * INTO anterior FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=NEW."entradaId" ORDER BY versao DESC LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.versao<>1 OR NEW.natureza<>'NAO_INFORMADA' THEN
      RAISE EXCEPTION 'natureza inicial é não informada; comercial exige declaração posterior explícita' USING ERRCODE='23514'; END IF;
  ELSE
    IF anterior.natureza IN ('COLOSTRO','NAO_COMERCIAL') OR NEW.natureza='NAO_INFORMADA' OR NEW.natureza=anterior.natureza OR NEW.versao<>anterior.versao+1 THEN
      RAISE EXCEPTION 'classificação restrita é terminal; preserve versões sem desbloquear ou duplicar' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_origem_participacao_prazo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_origem_participacao_prazo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."participacaoAcompanhamentoId" IS DISTINCT FROM OLD."participacaoAcompanhamentoId" THEN RAISE EXCEPTION 'participação de origem da demanda é imutável' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_partos_parcelas_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_partos_parcelas_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE animal_id text; ids text[]; g record; p jsonb;
BEGIN
 IF TG_OP='DELETE' THEN ids:=ARRAY[OLD."animalId"]; ELSE ids:=ARRAY[OLD."animalId",NEW."animalId"]; END IF;
 FOREACH animal_id IN ARRAY ids LOOP
 FOR g IN SELECT md.*,d."propriedadeId",d."dataOperacional" FROM pecuaria."MedicaoGeralLeite" md
  JOIN pecuaria."SessaoOrdenha" s ON s.id=md."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
  WHERE md."animaisOrigem" @> jsonb_build_array(animal_id) AND md."criterioColostroSnapshot" IS NOT NULL LOOP
  FOR p IN SELECT value FROM jsonb_array_elements(g."criterioColostroSnapshot"->'partos') WHERE value->>'animalId'=animal_id LOOP
   IF NOT EXISTS (SELECT 1 FROM pecuaria."PartoAnimal" pa JOIN pecuaria."LactacaoAnimal" l ON l."partoId"=pa.id AND l."animalId"=pa."animalId"
    WHERE pa.id=p->>'id' AND pa.versao=(p->>'versao')::integer AND pa."animalId"=animal_id AND pa.data=(p->>'data')::date
     AND pa.status='VALIDO' AND pa."propriedadeId"=g."propriedadeId" AND l.inicio=pa.data
     AND l.inicio<=g."dataOperacional" AND (l."encerradaEm" IS NULL OR l."encerradaEm">g."dataOperacional"))
   THEN RAISE EXCEPTION 'alteração retira evidência de colostro; regularize a parcela e sua confirmação' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
 END LOOP;
 RETURN NULL;
END $$;


--
-- Name: proteger_permanencia_ofertas_bezerreiro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_permanencia_ofertas_bezerreiro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE animal_id text;
BEGIN
 animal_id := CASE WHEN TG_OP='DELETE' THEN OLD."animalId" ELSE NEW."animalId" END;
 IF EXISTS (
   SELECT 1 FROM pecuaria."GrupoOfertaBezerreiro" g
   JOIN pecuaria."OfertaBezerreiro" o ON o.id=g."ofertaId"
   CROSS JOIN LATERAL jsonb_array_elements(g."participantesSnapshot") s
   WHERE o.status='CONFIRMADO' AND s->>'animalId'=animal_id
   AND NOT EXISTS (
     SELECT 1 FROM pecuaria."ParticipacaoBezerreiro" p
     WHERE p."animalId"=animal_id AND p."perfilId"=o."perfilId"
       AND p.desde<=o.data AND (p.ate IS NULL OR p.ate>o.data)
   )
 ) THEN RAISE EXCEPTION 'Regularize ou estorne as ofertas incompatíveis antes de corrigir a permanência no Bezerreiro' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;


--
-- Name: proteger_politica_e_ciclo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_politica_e_ciclo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Versões e vínculos de ciclo preservam o critério histórico; registre nova decisão'; END $$;


--
-- Name: proteger_populacao_leite_confirmada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_populacao_leite_confirmada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE did TEXT;
BEGIN
  IF TG_OP='DELETE' THEN did:=OLD."diaId"; ELSE did:=NEW."diaId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId" WHERE s."diaId"=did AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'população com ordenha confirmada exige regularização antes de alterar identidade ou exclusão' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."diaId" IS DISTINCT FROM NEW."diaId" AND EXISTS (
    SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId" WHERE s."diaId"=OLD."diaId" AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'participante de ordenha confirmada não pode mudar de dia' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_posicao_ordenha_usada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_posicao_ordenha_usada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE configuracoes text[]; configuracao_id text; tocar_parent boolean := true;
BEGIN
  IF TG_OP='INSERT' THEN configuracoes := ARRAY[NEW."configuracaoId"];
  ELSIF TG_OP='DELETE' THEN configuracoes := ARRAY[OLD."configuracaoId"];
  ELSE configuracoes := ARRAY[OLD."configuracaoId", NEW."configuracaoId"]; END IF;
  -- Ordem fixa também ao mover uma posição entre duas configurações ainda livres.
  FOR configuracao_id IN SELECT id FROM "pecuaria"."ConfiguracaoOrdenha"
    WHERE id=ANY(configuracoes) ORDER BY id FOR UPDATE LOOP
    NULL;
  END LOOP;
  IF EXISTS (SELECT 1 FROM "pecuaria"."DiaProducaoLeite" WHERE "configuracaoId"=ANY(configuracoes)) THEN
    RAISE EXCEPTION 'Posições de configuração utilizada por folha são imutáveis' USING ERRCODE='23514';
  END IF;
  -- Se a própria chave livre do pai acabou de mudar por FK CASCADE, ele já foi
  -- fisicamente atualizado. Evita atualizar de novo o mesmo tuple no cascade.
  IF TG_OP='UPDATE' THEN
    tocar_parent := EXISTS (SELECT 1 FROM "pecuaria"."ConfiguracaoOrdenha" WHERE id=OLD."configuracaoId");
  END IF;
  IF tocar_parent THEN
    -- Além do lock, produz versão de tuple para que snapshots RR/Serializable
    -- anteriores não possam congelar uma lista de posições já substituída.
    UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=ANY(configuracoes);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_prazo_visita(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_prazo_visita() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF (NEW."politicaId", NEW."previstaPara", NEW."regraSnapshot") IS DISTINCT FROM (OLD."politicaId", OLD."previstaPara", OLD."regraSnapshot") AND EXISTS (
  SELECT 1 FROM pecuaria."ParticipanteVisita" p
  JOIN pecuaria."AtividadeVisita" a ON a.id=p."atividadeId"
  JOIN pecuaria."VisitaVeterinaria" v ON v.id=a."visitaId"
  WHERE p."animalId"=OLD."animalId" AND p.status='PENDENTE' AND p.snapshot->'acompanhamento'->>'id'=OLD.id
    AND v."propriedadeId"=OLD."propriedadeOrigemId" AND v."encerradaEm" IS NULL
 ) THEN RAISE EXCEPTION 'prazo de demanda agendada em visita deve ser preservado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_prazos_modelo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_prazos_modelo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."configuracaoAcompanhamento" IS DISTINCT FROM OLD."configuracaoAcompanhamento" AND (OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId"=OLD.id) OR EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId"=OLD.id)) THEN RAISE EXCEPTION 'prazos do modelo publicado ou utilizado são imutáveis' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_reconhecimento_insercao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_reconhecimento_insercao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF OLD."insercaoDispositivoSnapshot" IS NOT NULL AND NEW."insercaoDispositivoSnapshot" IS DISTINCT FROM OLD."insercaoDispositivoSnapshot" THEN RAISE EXCEPTION 'Reconhecimento da inserção é histórico imutável; anule o fato se incorreto'; END IF;
 IF NEW."insercaoDispositivoSnapshot" IS DISTINCT FROM OLD."insercaoDispositivoSnapshot" AND NEW.status<>'VALIDO' THEN RAISE EXCEPTION 'Somente aplicação válida pode ser reconhecida como inserção'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_registro_contextual(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_registro_contextual() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='ExameAnimal' THEN
  IF OLD."avaliacaoContextualSnapshot" IS NOT NULL AND NEW."avaliacaoContextualSnapshot" IS DISTINCT FROM OLD."avaliacaoContextualSnapshot" THEN
   RAISE EXCEPTION 'itens de avaliação são evidência histórica' USING ERRCODE='23514';
  END IF;
 ELSE
  IF OLD."condutasContextuais" IS NOT NULL AND NEW."condutasContextuais" IS DISTINCT FROM OLD."condutasContextuais" THEN
   RAISE EXCEPTION 'condutas de avaliação são evidência histórica' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_regra_impacto_procedimento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_regra_impacto_procedimento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve a regra de procedimento; registre inativação auditada' USING ERRCODE='23514'; END IF;
 IF (NEW.id,NEW."propriedadeId",NEW."criadoPorId",NEW."criadoEm") IS DISTINCT FROM (OLD.id,OLD."propriedadeId",OLD."criadoPorId",OLD."criadoEm") OR NEW.versao<>OLD.versao+1 THEN
  RAISE EXCEPTION 'Revisão exige identidade/autoria original preservadas e versão seguinte' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_retirada_interna_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_retirada_interna_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histórico de retirada interna não pode ser apagado' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'CONFIRMADO' OR NEW.versao<>1 OR NEW."movimentoEstornoId" IS NOT NULL OR NEW."estornadoEm" IS NOT NULL OR NEW."estornadoPorId" IS NOT NULL OR NEW."motivoEstorno" IS NOT NULL
    THEN RAISE EXCEPTION 'Retirada interna inicia confirmado na versão um, sem estorno' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId'])
      OR OLD.status<>'CONFIRMADO' OR NEW.status<>'ESTORNADO' OR NEW.versao<>OLD.versao+1 OR NEW."movimentoEstornoId" IS NULL OR NEW."estornadoEm" IS NULL OR NEW."motivoEstorno" IS NULL OR length(btrim(NEW."motivoEstorno"))<5
    THEN RAISE EXCEPTION 'Fatos do retirada interna são imutáveis; apenas estorno terminal com versão e motivo' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_sessao_leite_confirmada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_sessao_leite_confirmada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD.id AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'sessão com estoque confirmado conserva identidade e versão' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."MedicaoGeralLeite" WHERE "sessaoId"=OLD.id) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'sessão com aferição geral deve ser preservada' USING ERRCODE='23514'; END IF;
    IF (to_jsonb(NEW)-'versao') IS DISTINCT FROM (to_jsonb(OLD)-'versao') THEN RAISE EXCEPTION 'identidade da ordenha aferida é imutável' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_snapshot_acompanhamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_snapshot_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."acompanhamentoSnapshot" IS DISTINCT FROM OLD."acompanhamentoSnapshot" THEN RAISE EXCEPTION 'parâmetros de acompanhamento adotados são imutáveis' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_snapshot_relatorio_reprodutivo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_snapshot_relatorio_reprodutivo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Emissão é imutável; gere outro relatório preservando a versão antiga'; END $$;


--
-- Name: proteger_versao_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_versao_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF TG_OP='UPDATE' AND (OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR EXISTS(SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId"=OLD.id)) AND
   (NEW.nome,NEW.versao,NEW.tipo,NEW.descricao,NEW."criadoEm",NEW."criadoPorId",NEW."publicadoEm",NEW.publicado) IS DISTINCT FROM
   (OLD.nome,OLD.versao,OLD.tipo,OLD.descricao,OLD."criadoEm",OLD."criadoPorId",OLD."publicadoEm",OLD.publicado)
 THEN RAISE EXCEPTION 'Versão publicada é imutável; crie outra versão'; END IF;
 IF NEW."publicadoEm" IS NOT NULL THEN NEW.publicado:=TRUE; END IF;
 IF TG_OP='UPDATE' AND NEW.tipo<>OLD.tipo AND EXISTS(SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId"=OLD.id)
 THEN RAISE EXCEPTION 'Tipo não pode mudar depois de associar participações'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_versao_selecao_visita(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_versao_selecao_visita() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Versão de seleção é imutável; crie outra versão';
END $$;


--
-- Name: proteger_vinculo_conclusao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_vinculo_conclusao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.vigente THEN RAISE EXCEPTION 'novo vínculo deve estar vigente' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'vínculo de conclusão é histórico' USING ERRCODE='23514'; END IF;
  IF (NEW.id, NEW."demandaId", NEW.fonte, NEW."valorSnapshot", NEW."resultadoId", NEW."interpretacaoId", NEW."criadoEm", NEW."criadoPorId")
       IS DISTINCT FROM (OLD.id, OLD."demandaId", OLD.fonte, OLD."valorSnapshot", OLD."resultadoId", OLD."interpretacaoId", OLD."criadoEm", OLD."criadoPorId")
     OR NOT OLD.vigente OR NEW.vigente THEN
    RAISE EXCEPTION 'vínculo de conclusão somente pode ser invalidado uma vez' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_vinculo_consumo_diario(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_vinculo_consumo_diario() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'vínculo de consumo é imutável; registre compensação' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: proteger_vinculo_medicao_entrada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_vinculo_medicao_entrada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE e record; md record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'vínculo de medição é histórico; anule a entrada' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'ativo') IS DISTINCT FROM (to_jsonb(OLD)-'ativo') THEN
    RAISE EXCEPTION 'identidade, quantidade e versão da medição confirmada são imutáveis' USING ERRCODE='23514'; END IF;
  SELECT * INTO e FROM pecuaria."EntradaProducaoLeite" WHERE id=NEW."entradaId";
  PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=e."sessaoId" FOR NO KEY UPDATE;
  IF TG_OP='INSERT' THEN
    SELECT md0.*,p."excluidoEm" INTO md FROM pecuaria."MedicaoLeite" md0
      JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=md0."participanteId" WHERE md0.id=NEW."medicaoId";
    IF NOT FOUND OR e.status<>'CONFIRMADA' OR NOT NEW.ativo OR md."sessaoId"<>e."sessaoId"
      OR md.estado<>'MEDIDO' OR md.litros IS DISTINCT FROM NEW.quantidade OR md.versao<>NEW."versaoMedicao" OR md."excluidoEm" IS NOT NULL
    THEN RAISE EXCEPTION 'confirmação exige medição inteira positiva e vigente da mesma sessão' USING ERRCODE='23514'; END IF;
  ELSIF NEW.ativo IS DISTINCT FROM OLD.ativo AND (NOT OLD.ativo OR NEW.ativo OR e.status<>'ANULADA') THEN
    RAISE EXCEPTION 'somente anulação da entrada libera sua medição, sem apagar vínculo' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_vinculo_pesagem_parto(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_vinculo_pesagem_parto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Vínculo de pesagem deve ser revogado, preservando seu histórico';
  END IF;
  IF OLD."revogadoEm" IS NOT NULL OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW."partoId" IS DISTINCT FROM OLD."partoId" OR NEW."pesagemId" IS DISTINCT FROM OLD."pesagemId"
     OR NEW."criaId" IS DISTINCT FROM OLD."criaId" OR NEW.sujeito IS DISTINCT FROM OLD.sujeito
     OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" OR NEW."criadoPorId" IS DISTINCT FROM OLD."criadoPorId"
     OR NEW."revogadoEm" IS NULL THEN
    RAISE EXCEPTION 'Vínculo de pesagem é imutável; revogue explicitamente antes de substituir';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_vinculo_preparo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.proteger_vinculo_preparo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF (NEW."id",NEW."tentativaId",NEW."aplicacaoId",NEW."exameId",NEW."participacaoId",NEW."modo",NEW."valorMaterial",NEW."valorServico",NEW."criadoPorId",NEW."criadoEm",NEW."motivo") IS DISTINCT FROM (OLD."id",OLD."tentativaId",OLD."aplicacaoId",OLD."exameId",OLD."participacaoId",OLD."modo",OLD."valorMaterial",OLD."valorServico",OLD."criadoPorId",OLD."criadoEm",OLD."motivo") OR OLD."encerradoEm" IS NOT NULL THEN RAISE EXCEPTION 'vínculo confirmado imutável; encerre com motivo e crie outro' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: revalidar_peso_secagem(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.revalidar_peso_secagem() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'VinculoPesagemSecagem' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NEW."lactacaoId", NEW."pesagemId", NULL);
  ELSIF TG_TABLE_NAME = 'LactacaoAnimal' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NEW.id, NULL, NULL);
  ELSIF TG_TABLE_NAME = 'Pesagem' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NEW.id, NULL);
  ELSIF TG_TABLE_NAME = 'Animal' THEN
    PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NULL, NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NULL, OLD."animalId"); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM "pecuaria"."conferir_vinculos_peso_secagem"(NULL, NULL, NEW."animalId"); END IF;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: travar_afericao_origem_geral(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_afericao_origem_geral() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE ids text[];
BEGIN
 SELECT array_agg(DISTINCT id) INTO ids FROM jsonb_array_elements_text(
  NEW."animaisOrigem" || CASE WHEN TG_OP='UPDATE' THEN OLD."animaisOrigem" ELSE '[]'::jsonb END) id;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 RETURN NEW;
END $$;


--
-- Name: travar_animais_origem_geral(text[]); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_animais_origem_geral(ids text[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(h) FROM
 (SELECT DISTINCT hashtext('pec-animal:'||id) h FROM unnest(ids) id) chaves ORDER BY h;
END $$;


--
-- Name: travar_conferencia_entrega_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_conferencia_entrega_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "entregaId"=NEW."entregaId" AND ativo)
 THEN RAISE EXCEPTION 'anule demonstrativos ativos antes de alterar a conferência da entrega'; END IF;
 RETURN NEW;
END $$;


--
-- Name: travar_entrada_origem_geral(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_entrada_origem_geral() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE g record; ids text[];
BEGIN
 IF NEW."medicaoGeralId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO g FROM pecuaria."MedicaoGeralLeite" WHERE id=NEW."medicaoGeralId";
 SELECT array_agg(id) INTO ids FROM jsonb_array_elements_text(g."animaisOrigem") id;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=g."sessaoId" FOR NO KEY UPDATE;
 RETURN NEW;
END $$;


--
-- Name: travar_fechamento_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_fechamento_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM id FROM pecuaria."OperacaoComercialLeite" WHERE id=NEW."comercialId" FOR NO KEY UPDATE;
 RETURN NEW;
END $$;


--
-- Name: travar_historico_origem_geral(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_historico_origem_geral() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE ids text[];
BEGIN
 IF TG_TABLE_NAME='Animal' THEN
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
 ELSE
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW."animalId"];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD."animalId"]; ELSE ids:=ARRAY[OLD."animalId",NEW."animalId"]; END IF;
 END IF;
 PERFORM pecuaria.travar_animais_origem_geral(ids);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;


--
-- Name: travar_retirada_comercial_leite(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_retirada_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE estado text;
BEGIN
 SELECT status INTO estado FROM pecuaria."OperacaoComercialLeite" WHERE id=NEW."comercialId" FOR NO KEY UPDATE;
 IF estado<>'ABERTA' THEN RAISE EXCEPTION 'operação fechada não admite nova retirada' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: travar_saldo_colostro(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_saldo_colostro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE ident text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fato de colostro é histórico; use estorno' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='OrigemColostro' THEN ident:=NEW.id; ELSE ident:=NEW."origemId"; END IF;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='OrigemColostro' THEN
   IF (NEW."propriedadeId",NEW."loteColostroId",NEW."preparoId",NEW."quantidadeLitros") IS DISTINCT FROM (OLD."propriedadeId",OLD."loteColostroId",OLD."preparoId",OLD."quantidadeLitros") THEN RAISE EXCEPTION 'Identidade/volume da origem é histórico' USING ERRCODE='23514'; END IF;
  ELSE
   IF NEW."origemId"<>OLD."origemId" THEN RAISE EXCEPTION 'Origem de alocação é histórica' USING ERRCODE='23514'; END IF;
   IF TG_TABLE_NAME='UnidadeBancoColostro' THEN
    IF OLD.status IN ('RETIRADA','ESTORNADA') AND NEW.status<>OLD.status AND NOT (OLD.status='RETIRADA' AND NEW.status='ESTORNADA') THEN RAISE EXCEPTION 'Unidade retirada não pode ser recongelada' USING ERRCODE='23514'; END IF;
    IF (NEW."volumeLitros",NEW."propriedadeId",NEW.codigo,NEW."dataCongelamento") IS DISTINCT FROM (OLD."volumeLitros",OLD."propriedadeId",OLD.codigo,OLD."dataCongelamento") THEN RAISE EXCEPTION 'Embalagem é histórica' USING ERRCODE='23514'; END IF;
   ELSE
    IF (to_jsonb(NEW)-'ativo')<>(to_jsonb(OLD)-'ativo') OR NOT OLD.ativo OR NEW.ativo THEN RAISE EXCEPTION 'Alocação é histórica; somente desativação por estorno' USING ERRCODE='23514'; END IF;
   END IF;
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('colostro:'||ident,0));
 PERFORM 1 FROM pecuaria."OrigemColostro" WHERE id=ident FOR UPDATE;
 RETURN NEW;
END $$;


--
-- Name: travar_versao_adotada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.travar_versao_adotada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM 1 FROM pecuaria."Protocolo" p WHERE p.id = NEW."protocoloId" FOR UPDATE;
  RETURN NEW;
END $$;


--
-- Name: validar_catalogo_avaliacao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_catalogo_avaliacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('pec-tipo-exame:' || NEW."tipoExameId"));
 IF NOT EXISTS (SELECT 1 FROM pecuaria."TipoExame" t WHERE t.id=NEW."tipoExameId" AND t.ativo AND t.contexto IN ('REPRODUTIVO','COMPARTILHADO') AND t."tipoResultado"='MULTIPLO')
 THEN RAISE EXCEPTION 'catálogo exige tipo reprodutivo ativo com formato estruturado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_classificacao_custo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_classificacao_custo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE origem TEXT; material NUMERIC; servico_id TEXT; movimento TEXT;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW."tentativaId",NEW."aplicacaoId",NEW."exameId",NEW."participacaoId",NEW."participacaoConsumoId") IS DISTINCT FROM (OLD."tentativaId",OLD."aplicacaoId",OLD."exameId",OLD."participacaoId",OLD."participacaoConsumoId") OR NEW.versao<>OLD.versao+1 THEN RAISE EXCEPTION 'correção exige mesma fonte e próxima versão' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."tentativaId" IS NOT NULL THEN SELECT t."origemMaterial",t."valorProdutoAtribuido",t."operacaoServicoId",t."movimentoEstoqueId" INTO origem,material,servico_id,movimento FROM pecuaria."TentativaReprodutiva" t WHERE t.id=NEW."tentativaId";
 ELSIF NEW."aplicacaoId" IS NOT NULL THEN SELECT CASE WHEN a."origemInsumo"='SEM_ORIGEM_JUSTIFICADA' THEN 'DOCUMENTADA' ELSE a."origemInsumo"::TEXT END,a."valorProdutoAtribuido",a."operacaoServicoId",a."movimentoEstoqueId" INTO origem,material,servico_id,movimento FROM pecuaria."AplicacaoProduto" a WHERE a.id=NEW."aplicacaoId";
 ELSIF NEW."exameId" IS NOT NULL THEN SELECT e."operacaoServicoId" INTO servico_id FROM pecuaria."ExameAnimal" e WHERE e.id=NEW."exameId";
 ELSIF NEW."participacaoId" IS NOT NULL THEN SELECT p."operacaoServicoId" INTO servico_id FROM pecuaria."ParticipacaoProtocolo" p WHERE p.id=NEW."participacaoId";
 END IF;
 IF NEW."participacaoConsumoId" IS NOT NULL AND (NEW."valorMaterialDocumentado" IS NOT NULL OR NEW."coberturaServico"<>'PROCEDIMENTO' OR NEW."materialNaoAplicavel" OR NEW."servicoNaoAplicavel") THEN RAISE EXCEPTION 'nutrição permite apenas classificação de finalidade' USING ERRCODE='23514'; END IF;
 IF NEW."valorMaterialDocumentado" IS NOT NULL AND (origem IS DISTINCT FROM 'DOCUMENTADA' OR material IS NOT NULL OR movimento IS NOT NULL) THEN RAISE EXCEPTION 'prova documental não substitui material congelado' USING ERRCODE='23514'; END IF;
 IF NEW."materialNaoAplicavel" AND (material IS NOT NULL OR movimento IS NOT NULL OR NEW."valorMaterialDocumentado" IS NOT NULL) THEN RAISE EXCEPTION 'material realizado não é não aplicável' USING ERRCODE='23514'; END IF;
 IF NEW."servicoNaoAplicavel" AND servico_id IS NOT NULL THEN RAISE EXCEPTION 'serviço atribuído não é não aplicável' USING ERRCODE='23514'; END IF;
 IF NEW."coberturaServico"<>'PROCEDIMENTO' AND (servico_id IS NULL OR material IS NOT NULL OR movimento IS NOT NULL OR NEW."valorMaterialDocumentado" IS NOT NULL) THEN RAISE EXCEPTION 'pacote sem fonte ou com material sobreposto' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_classificacao_diaria(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_classificacao_diaria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW."participacaoDiariaId" IS DISTINCT FROM OLD."participacaoDiariaId" THEN RAISE EXCEPTION 'fonte diária imutável' USING ERRCODE='23514'; END IF;
 IF NEW."participacaoDiariaId" IS NOT NULL AND (NEW."valorMaterialDocumentado" IS NOT NULL OR NEW."coberturaServico"<>'PROCEDIMENTO' OR NEW."materialNaoAplicavel" OR NEW."servicoNaoAplicavel") THEN RAISE EXCEPTION 'nutrição permite apenas classificação de finalidade' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_configuracao_nutricional(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_configuracao_nutricional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('nutricao-config:'||NEW."propriedadeId"));
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'configuração versionada é imutável' USING ERRCODE='23514'; END IF;
 IF NEW."loteId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."Lote" l WHERE l.id=NEW."loteId" AND l."propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'configuração fora do sítio' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."FechamentoConsumo" f WHERE f."propriedadeId"=NEW."propriedadeId" AND (NEW."loteId" IS NULL OR f."loteId"=NEW."loteId") AND f.status='CONFIRMADO' AND f.fim>=NEW.desde) THEN RAISE EXCEPTION 'ativação sobrepõe histórico confirmado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_decisao_operacional_acompanhamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_decisao_operacional_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_TABLE_NAME='DecisaoOperacionalAcompanhamento' THEN
  IF NOT EXISTS(SELECT 1 FROM pecuaria."NecessidadeReprodutiva" n JOIN pecuaria."DemandaAcompanhamentoReprodutivo" d ON d.id=n."demandaId"
   WHERE n.id=NEW."necessidadeId" AND d.id=NEW."demandaId" AND d.estado='PENDENTE' AND d.versao=NEW."versaoAnterior" AND n."convergidaParaId" IS NULL
   AND NOT EXISTS(SELECT 1 FROM pecuaria."DecisaoOperacionalAcompanhamento" anterior WHERE anterior.id=d."decisaoOperacionalId" AND anterior.tipo='DISPENSAR'))
  THEN RAISE EXCEPTION 'decisão exige cuidado atual e demanda factual pendente' USING ERRCODE='23514'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND OLD."decisaoOperacionalId" IS NOT NULL AND NEW."decisaoOperacionalId" IS NULL
   THEN RAISE EXCEPTION 'decisão operacional não pode desaparecer' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW."decisaoOperacionalId" IS DISTINCT FROM OLD."decisaoOperacionalId" AND NOT EXISTS (
   SELECT 1 FROM pecuaria."DecisaoOperacionalAcompanhamento" o WHERE o.id=NEW."decisaoOperacionalId" AND o."demandaId"=NEW.id AND o."versaoAnterior"=OLD.versao AND NEW.versao=OLD.versao+1
  ) THEN RAISE EXCEPTION 'troca de decisão exige nova versão operacional explícita' USING ERRCODE='23514'; END IF;
  IF NEW."decisaoOperacionalId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."DecisaoOperacionalAcompanhamento" o WHERE o.id=NEW."decisaoOperacionalId" AND o."demandaId"=NEW.id)
   THEN RAISE EXCEPTION 'decisão operacional pertence a outra demanda' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_demanda_acompanhamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_demanda_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE registro_origem RECORD; registro_politica RECORD; registro_exame RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."politicaId",NEW."dataReferencia",NEW."previstaPara",NEW."regraSnapshot",NEW."origemAdocao")
  IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."politicaId",OLD."dataReferencia",OLD."previstaPara",OLD."regraSnapshot",OLD."origemAdocao") THEN
  IF (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."dataReferencia") IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."dataReferencia") OR (NEW."origemAdocao" IS DISTINCT FROM OLD."origemAdocao" AND NOT ((OLD."origemAdocao"='MODELO' OR (OLD."origemAdocao"='SEM_REGRA' AND OLD."regraSnapshot"->>'motivo'='REGRA_NAO_CONFIGURADA')) AND NEW."origemAdocao"='ADOCAO_EXPLICITA')) OR OLD.estado <> 'PENDENTE' OR NEW.estado <> 'PENDENTE' OR OLD."tarefaId" IS DISTINCT FROM NEW."tarefaId" OR (OLD."tarefaId" IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM pecuaria."RevisaoPrazoAcompanhamento" revisao
   JOIN pecuaria."TarefaProtocolo" t ON t.id=OLD."tarefaId"
   JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
   LEFT JOIN pecuaria."ProgramacaoProtocolo" programacao ON programacao.id=p."programacaoId"
   WHERE revisao."demandaId"=OLD.id AND revisao."versaoAnterior"=OLD.versao AND revisao."tarefaId"=t.id
    AND revisao."tarefaPrevistaAnterior"=t."previstaEm" AND revisao."tarefaPrevistaNova"=NEW."previstaPara"::timestamp
    AND t."previstaEm"::date=OLD."previstaPara" AND t."precisaoTemporal"='DIA' AND NOT t."previsaoPendente"
    AND t."realizadaEm" IS NULL AND t."dispensadaEm" IS NULL AND NOT t."regularizacaoPendente" AND p."canceladaEm" IS NULL
    AND (programacao.id IS NULL OR programacao.status='ABERTA')
    AND t."previsaoOriginal" IS NOT NULL AND t."planejadoSnapshot"->>'previsaoOriginal'=to_char(t."previsaoOriginal",'YYYY-MM-DD')
    AND jsonb_typeof(t."historicoReprogramacao")='array'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t."historicoReprogramacao") h WHERE h->>'acao' IS DISTINCT FROM 'REVISAO_REGRA_ACOMPANHAMENTO')
    AND (CASE WHEN jsonb_array_length(t."historicoReprogramacao")=0 THEN t."previstaEm"=t."previsaoOriginal" ELSE t."historicoReprogramacao"->-1->>'previstaNova'=to_char(t."previstaEm",'YYYY-MM-DD') END)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."EventoTarefaProtocolo" e WHERE e."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v WHERE v."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."ExameAnimal" e WHERE e."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."AplicacaoProduto" a WHERE a."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."TentativaReprodutiva" tentativa WHERE tentativa."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."ManejoAnimal" m WHERE m."tarefaId"=t.id)
  )) OR NEW.versao <> OLD.versao + 1 OR NOT EXISTS (
    SELECT 1 FROM pecuaria."RevisaoPrazoAcompanhamento" r WHERE r."demandaId"=OLD.id AND r."versaoAnterior"=OLD.versao AND r."tarefaId" IS NOT DISTINCT FROM OLD."tarefaId" AND r."politicaAnteriorId" IS NOT DISTINCT FROM OLD."politicaId" AND r."politicaNovaId"=NEW."politicaId" AND r."previstaAnterior" IS NOT DISTINCT FROM OLD."previstaPara" AND r."previstaNova"=NEW."previstaPara" AND r."regraAnterior"=OLD."regraSnapshot" AND r."regraNova"=NEW."regraSnapshot"
  ) THEN RAISE EXCEPTION 'origem e regra da demanda são congeladas sem revisão explícita' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."origemAdocao"='PROTOCOLO' THEN
  IF TG_OP='UPDATE' AND (NEW."tarefaId",NEW."exameOrigemId") IS DISTINCT FROM (OLD."tarefaId",OLD."exameOrigemId") THEN
   RAISE EXCEPTION 'origem protocolar da demanda é congelada' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
   SELECT 1 FROM pecuaria."TarefaProtocolo" t
   JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
   JOIN pecuaria."EtapaProtocolo" a ON a.id=t."etapaId"
   JOIN pecuaria."ExameAnimal" e ON e.id=NEW."exameOrigemId"
   LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
   WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
    AND a.tipo='EXAME' AND a.configuracao->>'tipo'='AVALIACAO'
    AND NEW."regraSnapshot"->'acao' IS NOT DISTINCT FROM a.configuracao
    AND e."animalId"=NEW."animalId" AND e."tarefaId"=t.id AND e."propriedadeId"=NEW."propriedadeOrigemId"
    AND e.data=NEW."dataReferencia" AND (NEW.finalidade=ANY(e.finalidades) OR (
     NEW.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND a.configuracao->'planoAvaliacao'->>'tipo'=NEW.finalidade
     AND e."finalidadePrincipal"='AVALIACAO_REPRODUTIVA' AND e."avaliacaoContextualSnapshot" IS NOT NULL
    ))
    AND e."tipoExameId"=NEW."regraSnapshot"->>'tipoExameId'
    AND e."formatoSnapshot"->>'versao'=NEW."regraSnapshot"->>'tipoExameVersao'
    AND i."tentativaId" IS NOT DISTINCT FROM NEW."tentativaId" AND i."gestacaoId" IS NOT DISTINCT FROM NEW."gestacaoId"
    AND (TG_OP='UPDATE' OR (e.status='VALIDO' AND e.realizacao='REALIZADO' AND (
     EXISTS (SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"INCONCLUSIVO"'::jsonb)
     OR (NEW.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND a.configuracao->'planoAvaliacao'->>'tipo'=NEW.finalidade
      AND e."finalidadePrincipal"='AVALIACAO_REPRODUTIVA' AND e."avaliacaoContextualSnapshot" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL')))))
  ) THEN RAISE EXCEPTION 'demanda protocolar exige tarefa e exame parcial ou inconclusivo compatíveis' USING ERRCODE='23514'; END IF;
 ELSIF NEW."origemAdocao" IN ('MODELO','INDIVIDUAL','SEM_REGRA') THEN
  IF NOT (
   (NEW.finalidade='DIAGNOSTICO' AND NEW.ocorrencia=1 AND EXISTS (
    SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p
    JOIN pecuaria."TentativaReprodutiva" t ON t.id=NEW."tentativaId"
    LEFT JOIN pecuaria."TarefaProtocolo" tarefa ON tarefa.id=t."tarefaId" AND tarefa."participacaoId"=p.id
    WHERE p.id=NEW."participacaoAcompanhamentoId" AND (tarefa.id IS NOT NULL OR EXISTS (SELECT 1 FROM pecuaria."VinculoTentativaParticipacao" v WHERE v."participacaoId"=p.id AND v."tentativaId"=t.id AND (v."revogadoEm" IS NULL OR TG_OP='UPDATE'))) AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
     AND t."animalId"=p."animalId" AND t."propriedadeId"=p."propriedadeId" AND t.data=NEW."dataReferencia" AND (TG_OP='UPDATE' OR t.status='VALIDO')
     AND NEW."regraSnapshot"->>'origem'=NEW."origemAdocao" AND NEW."regraSnapshot"->>'participacaoId'=p.id AND NEW."regraSnapshot"->>'protocoloId'=p."protocoloId"
     AND ((NEW."origemAdocao"='INDIVIDUAL' AND NEW."previstaPara"=(p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm')::date AND NEW."regraSnapshot"->>'dataIndividual'=p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm' AND NEW."regraSnapshot"->>'referencia'=t.tipo)
      OR (NEW."origemAdocao"='SEM_REGRA' AND NEW."previstaPara" IS NULL AND NEW."regraSnapshot"->>'referencia'=t.tipo AND (
        (NEW."regraSnapshot"->>'motivo'='AGENDAMENTO_ANTERIOR_A_TENTATIVA' AND (p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm')::date < t.data)
        OR (NEW."regraSnapshot"->>'motivo'='REGRA_NAO_CONFIGURADA' AND p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm' IS NULL
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p."acompanhamentoSnapshot"->'modelo'->'regras','[]'::jsonb)) r WHERE r->>'finalidade'='DIAGNOSTICO' AND r->>'publico'=t.tipo)
          AND (p."acompanhamentoSnapshot"->'sitio' IS NULL OR p."acompanhamentoSnapshot"->'sitio'='null'::jsonb
            OR (p."acompanhamentoSnapshot"->'sitio'->'parametros'->>'versao'='1' AND p."acompanhamentoSnapshot"->'sitio'->'parametros'->'diagnostico'='null'::jsonb)
            OR (p."acompanhamentoSnapshot"->'sitio'->'parametros'->>'versao'='2' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p."acompanhamentoSnapshot"->'sitio'->'parametros'->'regras') r WHERE r->>'finalidade'='DIAGNOSTICO' AND r->>'publico'=t.tipo)))
        )))
      OR (NEW."origemAdocao"='MODELO' AND p."acompanhamentoSnapshot"->'modelo'->'regras' @> jsonb_build_array(NEW."regraSnapshot"->'regra')
       AND NEW."regraSnapshot"->'regra'->>'publico'=t.tipo AND NEW."regraSnapshot"->'regra'->>'finalidade'='DIAGNOSTICO'
       AND NEW."regraSnapshot"->>'referencia'=NEW."regraSnapshot"->'regra'->>'referencia'
       AND NEW."regraSnapshot"->>'tipoExameId' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameId'
       AND NEW."regraSnapshot"->>'tipoExameVersao' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameVersao'
       AND NEW."previstaPara"=t.data + (NEW."regraSnapshot"->'regra'->>'intervalo')::integer))
   )) OR (NEW.finalidade='RECONFIRMACAO' AND NEW."origemAdocao"='MODELO' AND EXISTS (
    SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p
    JOIN pecuaria."TentativaReprodutiva" t ON t."animalId"=p."animalId" AND t."propriedadeId"=p."propriedadeId"
    LEFT JOIN pecuaria."TarefaProtocolo" tarefa ON tarefa.id=t."tarefaId" AND tarefa."participacaoId"=p.id
    JOIN pecuaria."GestacaoAnimal" g ON g.id=NEW."gestacaoId" AND g."tentativaId"=t.id
    JOIN pecuaria."ExameAnimal" e ON e.id=NEW."exameOrigemId"
    JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id AND i."gestacaoId"=g.id
    WHERE p.id=NEW."participacaoAcompanhamentoId" AND (tarefa.id IS NOT NULL OR EXISTS (SELECT 1 FROM pecuaria."VinculoTentativaParticipacao" v WHERE v."participacaoId"=p.id AND v."tentativaId"=t.id AND (v."revogadoEm" IS NULL OR TG_OP='UPDATE')) OR EXISTS (
      SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" dg
      LEFT JOIN pecuaria."VinculoConclusaoAcompanhamento" conclusao ON conclusao.id=dg."vinculoConclusaoResolucaoId" AND conclusao.vigente
      LEFT JOIN pecuaria."ResultadoExame" resultado ON resultado.id=conclusao."resultadoId" AND resultado.vigente
      WHERE dg."participacaoAcompanhamentoId"=p.id AND dg."tentativaId"=t.id AND dg.finalidade='DIAGNOSTICO'
       AND t.status='VALIDO' AND dg.estado IN ('PENDENTE','RESOLVIDA')
       AND ((dg.estado='RESOLVIDA' AND dg."exameResolucaoId"=e.id)
        OR e."demandaAcompanhamentoId"=dg.id
        OR (dg.estado='RESOLVIDA' AND conclusao."demandaId"=dg.id AND conclusao.fonte='RESULTADO'
         AND resultado."exameId"=e.id AND resultado.campo='CONCLUSAO_GESTACIONAL' AND resultado.valor='"POSITIVO"'::jsonb))
     )) AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
     AND e."animalId"=p."animalId" AND e.data=NEW."dataReferencia"
     AND (TG_OP='UPDATE' OR (g.status='VALIDO' AND e.status='VALIDO' AND e.realizacao='REALIZADO' AND EXISTS (SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"POSITIVO"'::jsonb)))
     AND NEW."regraSnapshot"->>'origem'='MODELO' AND NEW."regraSnapshot"->>'participacaoId'=p.id AND NEW."regraSnapshot"->>'protocoloId'=p."protocoloId"
     AND p."acompanhamentoSnapshot"->'modelo'->'regras' @> jsonb_build_array(NEW."regraSnapshot"->'regra')
     AND NEW."regraSnapshot"->'regra'->>'publico'='GESTACAO' AND NEW."regraSnapshot"->'regra'->>'finalidade'='RECONFIRMACAO'
     AND NEW."regraSnapshot"->>'referencia'=NEW."regraSnapshot"->'regra'->>'referencia'
     AND NEW."regraSnapshot"->>'tipoExameId' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameId'
     AND NEW."regraSnapshot"->>'tipoExameVersao' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameVersao'
     AND (NEW."regraSnapshot"->'regra'->>'ocorrencia')::integer=NEW.ocorrencia
     AND NEW."previstaPara"=e.data + (NEW."regraSnapshot"->'regra'->>'intervalo')::integer
   ))
  ) THEN RAISE EXCEPTION 'demanda exige origem e prazo válidos da participação' USING ERRCODE='23514'; END IF;
 ELSE
 IF NEW."tentativaId" IS NOT NULL THEN SELECT t."animalId",t."propriedadeId" INTO registro_origem FROM pecuaria."TentativaReprodutiva" t WHERE t.id=NEW."tentativaId";
 ELSE SELECT g."animalId",g."propriedadeId" INTO registro_origem FROM pecuaria."GestacaoAnimal" g WHERE g.id=NEW."gestacaoId"; END IF;
 SELECT p."propriedadeId",p.versao INTO registro_politica FROM pecuaria."PoliticaAcompanhamentoReprodutivo" p WHERE p.id=NEW."politicaId";
 IF registro_origem."animalId" IS DISTINCT FROM NEW."animalId" OR registro_origem."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId"
  OR registro_politica."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId" THEN RAISE EXCEPTION 'demanda incompatível com animal/sítio da origem' USING ERRCODE='23514'; END IF;
 IF NEW."regraSnapshot"->>'politicaId' IS DISTINCT FROM NEW."politicaId" OR NEW."regraSnapshot"->>'politicaVersao' IS DISTINCT FROM registro_politica.versao::TEXT THEN RAISE EXCEPTION 'snapshot da demanda diverge da versão congelada' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId") THEN RAISE EXCEPTION 'tarefa de outro animal' USING ERRCODE='23514'; END IF;
 IF NEW."exameResolucaoId" IS NOT NULL THEN
  SELECT e.*, i."tentativaId" AS "tentativaOrigemId",i."gestacaoId" AS "gestacaoOrigemId" INTO registro_exame FROM pecuaria."ExameAnimal" e LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id WHERE e.id=NEW."exameResolucaoId";
  IF registro_exame."animalId" IS DISTINCT FROM NEW."animalId" OR registro_exame.status IS DISTINCT FROM 'VALIDO' OR registro_exame.realizacao IS DISTINCT FROM 'REALIZADO'
   OR NOT (NEW.finalidade=ANY(registro_exame.finalidades)) OR registro_exame.data<NEW."dataReferencia" OR (NEW.finalidade='RECONFIRMACAO' AND registro_exame.data<NEW."previstaPara")
   OR (NEW."tentativaId" IS NOT NULL AND registro_exame."tentativaOrigemId" IS DISTINCT FROM NEW."tentativaId")
   OR (NEW."gestacaoId" IS NOT NULL AND registro_exame."gestacaoOrigemId" IS DISTINCT FROM NEW."gestacaoId")
   OR (registro_exame."demandaAcompanhamentoId" IS NOT NULL AND registro_exame."demandaAcompanhamentoId"<>NEW.id)
   OR NOT EXISTS(SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=registro_exame.id AND r.vigente AND ((NEW.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb)) OR (NEW.finalidade<>'SEXAGEM' AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)))) THEN
   RAISE EXCEPTION 'resolução exige conclusão vigente compatível com a demanda' USING ERRCODE='23514';
  END IF;
  IF NEW."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (registro_exame."tipoExameId" IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameId' OR registro_exame."formatoSnapshot"->>'versao' IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'resolução difere do formato congelado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_descarte_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_descarte_leite(did text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE d record; m record; e record; inv record; n bigint; q numeric;
BEGIN
  SELECT * INTO d FROM pecuaria."DescarteLeite" WHERE id=did;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=d."movimentoId";
  SELECT ep.*,em."produtoId",em.data AS "dataProducao",em."propriedadeId" INTO e FROM pecuaria."EntradaProducaoLeite" ep JOIN public."MovimentoEstoque" em ON em.id=ep."movimentoId" WHERE ep.id=d."entradaId";
  SELECT count(*),sum(quantidade) INTO n,q FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id AND "entradaId"=e.id AND finalidade='DESCARTE';
  IF e."propriedadeId"<>d."propriedadeId" OR m."propriedadeId"<>d."propriedadeId" OR e."produtoId"<>m."produtoId" OR d.data<>m.data OR d.data<e."dataProducao"
    OR m.tipo<>'SAIDA' OR m.origem<>'PERDA' OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m."operacaoId" IS NOT NULL OR m."reversaoDeId" IS NOT NULL
    OR m.quantidade<>d."quantidadeLitros" OR n<>1 OR q<>d."quantidadeLitros" OR (SELECT count(*) FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id)<>1
    OR (d.status='CONFIRMADO' AND (m.status<>'CONFIRMADO' OR e.status<>'CONFIRMADA'))
    OR (d.status='ESTORNADO' AND m.status<>'REVERTIDO') OR d.status NOT IN ('CONFIRMADO','ESTORNADO')
  THEN RAISE EXCEPTION 'Descarte exige saída única com origem, sítio, data e litros conciliados, sem venda ou destinatário' USING ERRCODE='23514'; END IF;
  IF d.status='ESTORNADO' THEN
    SELECT * INTO inv FROM public."MovimentoEstoque" WHERE id=d."movimentoEstornoId";
    IF NOT FOUND OR inv."reversaoDeId"<>m.id OR inv.tipo<>'ENTRADA' OR inv.status<>'CONFIRMADO' OR inv.quantidade<>m.quantidade OR inv."propriedadeId"<>d."propriedadeId" OR inv."produtoId"<>m."produtoId" OR inv.origem<>'PERDA' OR inv.observacao IS DISTINCT FROM d."motivoEstorno"
    THEN RAISE EXCEPTION 'Estorno de descarte exige inverso preservado e motivo' USING ERRCODE='23514'; END IF;
  END IF;
END $$;


--
-- Name: validar_desfecho_parto_explicito(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_desfecho_parto_explicito() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.desfecho IS NOT NULL AND NEW.desfecho IS DISTINCT FROM
    (CASE WHEN NEW.tipo = 'ABORTO' THEN 'ABORTO' ELSE 'NASCIMENTO' END) THEN
    RAISE EXCEPTION 'Tipo e desfecho do parto são contraditórios';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: validar_dia_nutricional(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_dia_nutricional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pecuaria."MesNutricao" m WHERE m.id=NEW."mesId" AND NEW.data>=m.inicio AND NEW.data<(m.competencia+INTERVAL '1 month')::date AND m."revisadoEm" IS NULL) THEN RAISE EXCEPTION 'dia fora do mês aberto' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW."mesId",NEW.data) IS DISTINCT FROM (OLD."mesId",OLD.data) THEN RAISE EXCEPTION 'identidade do dia é imutável' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_evento_tarefa_protocolo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_evento_tarefa_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Evento operacional imutável; registre uma retificação' USING ERRCODE = '23514'; END IF;
  IF NEW."eventoCorrigidoId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pecuaria."EventoTarefaProtocolo" e WHERE e.id = NEW."eventoCorrigidoId" AND e."tarefaId" = NEW."tarefaId" AND e.tipo <> 'RETIFICACAO_JUSTIFICATIVA'
  ) THEN RAISE EXCEPTION 'Retificação exige evento operacional da mesma tarefa' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: validar_exame_demanda_acompanhamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_exame_demanda_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE registro_demanda RECORD; registro_interpretacao RECORD;
BEGIN
 IF NEW."demandaAcompanhamentoId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO registro_demanda FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaAcompanhamentoId";
 SELECT * INTO registro_interpretacao FROM pecuaria."InterpretacaoReprodutiva" i WHERE i."exameId"=NEW.id;
 IF registro_demanda."animalId" IS DISTINCT FROM NEW."animalId" OR NOT (registro_demanda.finalidade=ANY(NEW.finalidades))
  OR NEW.data<registro_demanda."dataReferencia" THEN RAISE EXCEPTION 'exame incompatível com demanda' USING ERRCODE='23514'; END IF;
 IF registro_demanda."tentativaId" IS NOT NULL THEN
  IF registro_interpretacao."tentativaId" IS DISTINCT FROM registro_demanda."tentativaId" THEN RAISE EXCEPTION 'tentativa da demanda diverge do exame' USING ERRCODE='23514'; END IF;
 ELSIF registro_demanda."gestacaoId" IS NOT NULL OR registro_demanda."origemAdocao"<>'PROTOCOLO' THEN
  IF registro_interpretacao."gestacaoId" IS DISTINCT FROM registro_demanda."gestacaoId" THEN RAISE EXCEPTION 'gestação da demanda diverge do exame' USING ERRCODE='23514'; END IF;
 END IF;
 IF registro_demanda."regraSnapshot"->>'tipoExameId' IS NOT NULL AND
  (NEW."tipoExameId" IS DISTINCT FROM registro_demanda."regraSnapshot"->>'tipoExameId' OR NEW."formatoSnapshot"->>'versao' IS DISTINCT FROM registro_demanda."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'formato difere da regra congelada' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_fornecimento_nutricional_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_fornecimento_nutricional_leite(identidade text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE f pecuaria."FornecimentoNutricionalLeite"; item pecuaria."ItemFechamentoConsumo"; c pecuaria."FechamentoConsumo"; grupo pecuaria."GrupoOfertaBezerreiro"; oferta pecuaria."OfertaBezerreiro";
BEGIN
 SELECT * INTO STRICT f FROM pecuaria."FornecimentoNutricionalLeite" WHERE "id"=identidade;
 SELECT * INTO STRICT item FROM pecuaria."ItemFechamentoConsumo" WHERE "id"=f."itemId";
 IF item."fechamentoId" IS NOT NULL THEN
  SELECT * INTO STRICT c FROM pecuaria."FechamentoConsumo" WHERE "id"=item."fechamentoId";
 ELSE
  SELECT * INTO STRICT grupo FROM pecuaria."GrupoOfertaBezerreiro" WHERE id=item."grupoOfertaId";
  SELECT * INTO STRICT oferta FROM pecuaria."OfertaBezerreiro" WHERE id=grupo."ofertaId";
  IF oferta.status<>f.status OR oferta."propriedadeId"<>f."propriedadeId" OR oferta.data<>f.data OR grupo."quantidadeLitros"<>f."quantidadeLitros" THEN
   RAISE EXCEPTION 'Fornecimento deve corresponder à oferta e grupo conferidos';
  END IF;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m."id"=e."movimentoId" WHERE m."produtoId"=item."produtoId" AND m."propriedadeId"=f."propriedadeId") THEN
  RAISE EXCEPTION 'Ingrediente leiteiro exige produção V5 histórica comprovada no sítio';
 END IF;
 IF (item."fechamentoId" IS NOT NULL AND (c."status"::text<>f."status" OR c."propriedadeId"<>f."propriedadeId" OR c."fim"<>f."data")) OR item."unidade"<>'L' OR item."quantidadeConfirmada"<>f."quantidadeLitros" OR item."movimentoEstoqueId" IS NOT NULL OR item."modoEstoque"<>'BAIXA_ESTOQUE' THEN
  RAISE EXCEPTION 'Fornecimento deve corresponder ao item/dieta, sítio e data sem segunda baixa genérica';
 END IF;
 IF (SELECT COALESCE(SUM("quantidadeLitros"),0) FROM pecuaria."MovimentoFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>f."quantidadeLitros" OR
    (SELECT COALESCE(SUM("quantidadeLitros"),0) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>f."quantidadeLitros" THEN
  RAISE EXCEPTION 'Origens e destinatários devem conservar os litros do fornecimento';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."MovimentoFornecimentoNutricionalLeite" o JOIN public."MovimentoEstoque" m ON m."id"=o."movimentoId"
  WHERE o."fornecimentoId"=f."id" AND (m."status"::text<>CASE WHEN f."status"='CONFIRMADO' THEN 'CONFIRMADO' ELSE 'REVERTIDO' END OR m."propriedadeId"<>f."propriedadeId" OR m."data"<>f."data" OR m."origem"<>'NUTRICAO' OR m."tipo"<>'SAIDA' OR m."quantidade"<>o."quantidadeLitros" OR
   NOT EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."ClassificacaoEntradaLeite" n ON n."id"=a."classificacaoId" WHERE a."movimentoId"=m."id" AND a."entradaId"=o."entradaId" AND a."quantidade"=o."quantidadeLitros" AND a."finalidade"='CONSUMO' AND n."natureza"=o."natureza"))) THEN
  RAISE EXCEPTION 'Origem nutricional divergente da baixa leiteira comprovada';
 END IF;
 IF item."fechamentoId" IS NOT NULL THEN
 IF (SELECT COUNT(*) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>(SELECT COUNT(*) FROM pecuaria."ParticipacaoConsumoAnimal" WHERE "fechamentoId"=c."id") THEN
  RAISE EXCEPTION 'Todos os participantes do fechamento devem ter parcela de leite';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."ParcelaFornecimentoNutricionalLeite" p WHERE p."fornecimentoId"=f."id" AND NOT EXISTS (
  SELECT 1 FROM pecuaria."ParticipacaoConsumoAnimal" a WHERE a."fechamentoId"=c."id" AND a."animalId"=p."animalId" AND a."dias"=p."dias")) THEN
  RAISE EXCEPTION 'Destinatário deve participar do fechamento da dieta';
 END IF;
 ELSE
  IF (SELECT count(*) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f.id) <> jsonb_array_length(grupo."participantesSnapshot") OR
    EXISTS(SELECT 1 FROM pecuaria."ParcelaFornecimentoNutricionalLeite" p WHERE p."fornecimentoId"=f.id AND
      (p."dias" IS NOT NULL OR p."criterioAtribuicao"<>'ATRIBUIDA_POR_OFERTA' OR p."programacaoSnapshot" IS NULL OR
       NOT EXISTS(SELECT 1 FROM jsonb_array_elements(grupo."participantesSnapshot") s WHERE s->>'animalId'=p."animalId"))) THEN
   RAISE EXCEPTION 'Parcela atribuída por oferta exige participantes e programação comprovados, sem dias fictícios';
  END IF;
 END IF;
 RETURN;
END $$;


--
-- Name: validar_mes_nutricional(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_mes_nutricional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoNutricao" c JOIN pecuaria."Lote" l ON l.id=NEW."loteId" WHERE c.id=NEW."configuracaoId" AND c."propriedadeId"=NEW."propriedadeId" AND l."propriedadeId"=NEW."propriedadeId" AND (c."loteId" IS NULL OR c."loteId"=l.id) AND c.desde<=NEW.inicio) THEN RAISE EXCEPTION 'mês fora do escopo da configuração' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW."loteId",NEW."propriedadeId",NEW.competencia,NEW.inicio,NEW."configuracaoId") IS DISTINCT FROM (OLD."loteId",OLD."propriedadeId",OLD.competencia,OLD.inicio,OLD."configuracaoId") THEN RAISE EXCEPTION 'identidade do mês é imutável' USING ERRCODE='23514'; END IF;
 IF NEW."revisadoEm" IS NOT NULL AND (EXISTS(SELECT 1 FROM pecuaria."ConsumoDiario" d WHERE d."mesId"=NEW.id AND (d.situacao<>'EFETIVADO' OR d.pendencia IS NOT NULL)) OR (SELECT COUNT(*) FROM pecuaria."ConsumoDiario" d WHERE d."mesId"=NEW.id)<>((NEW.competencia+INTERVAL '1 month')::date-NEW.inicio)) THEN RAISE EXCEPTION 'mês incompleto não pode ser revisado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_necessidade_reprodutiva(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_necessidade_reprodutiva() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND p.id=NEW."participacaoId") THEN RAISE EXCEPTION 'Tarefa incompatível com necessidade reprodutiva' USING ERRCODE='23514'; END IF;
 IF NEW."demandaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaId" AND d."animalId"=NEW."animalId") THEN RAISE EXCEPTION 'Demanda incompatível com animal' USING ERRCODE='23514'; END IF;
 IF NEW."alertaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."Alerta" a WHERE a.id=NEW."alertaId" AND a.produtor='reproducao' AND a."chaveOcorrencia"=NEW.chave AND a."sujeitoId"=NEW."animalId") THEN RAISE EXCEPTION 'Alerta incompatível com necessidade reprodutiva' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_resolucao_demanda_final(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_resolucao_demanda_final() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE identificador_exame TEXT;
BEGIN
 IF TG_TABLE_NAME='ExameAnimal' THEN
  IF TG_OP='DELETE' THEN identificador_exame:=OLD.id; ELSE identificador_exame:=NEW.id; END IF;
 ELSIF TG_TABLE_NAME='ResultadoExame' OR TG_TABLE_NAME='InterpretacaoReprodutiva' THEN
  IF TG_OP='DELETE' THEN identificador_exame:=OLD."exameId"; ELSE identificador_exame:=NEW."exameId"; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d JOIN pecuaria."ExameAnimal" e ON e.id=d."exameResolucaoId" LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
  WHERE d.estado='RESOLVIDA' AND d."exameResolucaoId"=identificador_exame AND
   (e.status<>'VALIDO' OR e.realizacao<>'REALIZADO' OR e."animalId"<>d."animalId"
    OR NOT (d.finalidade=ANY(e.finalidades)) OR e.data<d."dataReferencia" OR (d.finalidade='RECONFIRMACAO' AND e.data<d."previstaPara")
    OR (d."tentativaId" IS NOT NULL AND i."tentativaId" IS DISTINCT FROM d."tentativaId") OR (d."gestacaoId" IS NOT NULL AND i."gestacaoId" IS DISTINCT FROM d."gestacaoId")
    OR (e."demandaAcompanhamentoId" IS NOT NULL AND e."demandaAcompanhamentoId"<>d.id)
    OR (d."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (e."tipoExameId" IS DISTINCT FROM d."regraSnapshot"->>'tipoExameId' OR e."formatoSnapshot"->>'versao' IS DISTINCT FROM d."regraSnapshot"->>'tipoExameVersao'))
    OR NOT EXISTS(
    SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND ((d.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb)) OR (d.finalidade<>'SEXAGEM' AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)))))) THEN
  RAISE EXCEPTION 'demanda resolvida exige evidência conclusiva válida no estado final' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;


--
-- Name: validar_retirada_interna_leite(text); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_retirada_interna_leite(did text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE d record; m record; e record; inv record; n bigint; q numeric;
BEGIN
  SELECT * INTO d FROM pecuaria."RetiradaInternaLeite" WHERE id=did;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=d."movimentoId";
  SELECT ep.*,em."produtoId",em.data AS "dataProducao",em."propriedadeId" INTO e FROM pecuaria."EntradaProducaoLeite" ep JOIN public."MovimentoEstoque" em ON em.id=ep."movimentoId" WHERE ep.id=d."entradaId";
  SELECT count(*),sum(quantidade) INTO n,q FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id AND "entradaId"=e.id AND finalidade='CONSUMO';
  IF e."propriedadeId"<>d."propriedadeId" OR m."propriedadeId"<>d."propriedadeId" OR e."produtoId"<>m."produtoId" OR d.data<>m.data OR d.data<e."dataProducao"
    OR m.tipo<>'SAIDA' OR m.origem<>'NUTRICAO' OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m."operacaoId" IS NOT NULL OR m."reversaoDeId" IS NOT NULL
    OR m.quantidade<>d."quantidadeLitros" OR n<>1 OR q<>d."quantidadeLitros" OR (SELECT count(*) FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id)<>1
    OR NOT EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."ClassificacaoEntradaLeite" c ON c.id=a."classificacaoId" WHERE a."movimentoId"=m.id AND c.natureza='COMERCIAL')
    OR (d.status='CONFIRMADO' AND (m.status<>'CONFIRMADO' OR e.status<>'CONFIRMADA'))
    OR (d.status='ESTORNADO' AND m.status<>'REVERTIDO') OR d.status NOT IN ('CONFIRMADO','ESTORNADO')
  THEN RAISE EXCEPTION 'Retirada interna exige saída única com origem, sítio, data e litros conciliados, sem venda' USING ERRCODE='23514'; END IF;
  IF d.status='ESTORNADO' THEN
    SELECT * INTO inv FROM public."MovimentoEstoque" WHERE id=d."movimentoEstornoId";
    IF NOT FOUND OR inv."reversaoDeId"<>m.id OR inv.tipo<>'ENTRADA' OR inv.status<>'CONFIRMADO' OR inv.quantidade<>m.quantidade OR inv."propriedadeId"<>d."propriedadeId" OR inv."produtoId"<>m."produtoId" OR inv.origem<>'NUTRICAO' OR inv.observacao IS DISTINCT FROM d."motivoEstorno"
    THEN RAISE EXCEPTION 'Estorno da retirada exige inverso preservado e motivo' USING ERRCODE='23514'; END IF;
  END IF;
END $$;


--
-- Name: validar_revisao_prazo_aplicada(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_revisao_prazo_aplicada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaId" AND d.versao=NEW."versaoAnterior"+1 AND d."politicaId"=NEW."politicaNovaId" AND d."previstaPara"=NEW."previstaNova" AND d."regraSnapshot"=NEW."regraNova") THEN
  RAISE EXCEPTION 'revisão de prazo deve ser aplicada na mesma transação' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;


--
-- Name: validar_revisao_tarefa_prazo(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_revisao_tarefa_prazo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."TarefaProtocolo" t WHERE t.id=NEW."tarefaId" AND t."previstaEm"=NEW."tarefaPrevistaNova" AND t."historicoReprogramacao"->-1->>'revisaoId'=NEW.id) THEN
  RAISE EXCEPTION 'revisão da demanda e da tarefa deve ser atômica' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;


--
-- Name: validar_snapshot_acompanhamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_snapshot_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."acompanhamentoSnapshot" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM pecuaria."Protocolo" p WHERE p.id=NEW."protocoloId" AND p.tipo='REPRODUTIVO'
   AND NEW."acompanhamentoSnapshot"->>'versao'='1' AND NEW."acompanhamentoSnapshot"->>'protocoloId'=p.id
   AND NEW."acompanhamentoSnapshot"->>'protocoloVersao'=p.versao::text
   AND NEW."acompanhamentoSnapshot"->'modelo' IS NOT DISTINCT FROM COALESCE(p."configuracaoAcompanhamento",'null'::jsonb)
   AND (NEW."acompanhamentoSnapshot"->'sitio'='null'::jsonb OR EXISTS (
     SELECT 1 FROM pecuaria."PoliticaAcompanhamentoReprodutivo" politica WHERE politica.id=NEW."acompanhamentoSnapshot"->'sitio'->>'id'
      AND politica."propriedadeId"=NEW."propriedadeId" AND politica.versao::text=NEW."acompanhamentoSnapshot"->'sitio'->>'versao'
      AND politica.parametros=NEW."acompanhamentoSnapshot"->'sitio'->'parametros'
   ))
 ) THEN RAISE EXCEPTION 'snapshot de acompanhamento incompatível com modelo ou política' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validar_vinculo_conclusao_final(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_vinculo_conclusao_final() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE demanda_alvo text; exame_alvo text;
BEGIN
  IF TG_TABLE_NAME = 'DemandaAcompanhamentoReprodutivo' THEN
    demanda_alvo := COALESCE(NEW.id, OLD.id);
    exame_alvo := COALESCE(NEW."exameResolucaoId", OLD."exameResolucaoId");
  ELSIF TG_TABLE_NAME = 'VinculoConclusaoAcompanhamento' THEN demanda_alvo := COALESCE(NEW."demandaId", OLD."demandaId");
  ELSIF TG_TABLE_NAME = 'ExameAnimal' THEN exame_alvo := COALESCE(NEW.id, OLD.id);
  ELSE exame_alvo := COALESCE(NEW."exameId", OLD."exameId"); END IF;
  IF EXISTS (
    SELECT 1 FROM pecuaria."VinculoConclusaoAcompanhamento" v
    JOIN pecuaria."DemandaAcompanhamentoReprodutivo" d ON d.id=v."demandaId"
    LEFT JOIN pecuaria."ResultadoExame" r ON r.id=v."resultadoId"
    LEFT JOIN pecuaria."InterpretacaoReprodutiva" fonte_i ON fonte_i.id=v."interpretacaoId"
    JOIN pecuaria."ExameAnimal" e ON e.id=COALESCE(r."exameId",fonte_i."exameId")
    LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
    WHERE v.vigente AND (d.id=demanda_alvo OR e.id=exame_alvo) AND (
      d.estado <> 'RESOLVIDA' OR d."vinculoConclusaoResolucaoId" IS DISTINCT FROM v.id
      OR e.status <> 'VALIDO' OR e.realizacao <> 'REALIZADO'
      OR (v.fonte='RESULTADO' AND (NOT r.vigente OR r.valor IS DISTINCT FROM v."valorSnapshot"))
      OR (v.fonte='INTERPRETACAO' AND to_jsonb(fonte_i."resultadoAptidao") IS DISTINCT FROM v."valorSnapshot")
      OR e."animalId" IS DISTINCT FROM d."animalId" OR NOT (d.finalidade=ANY(e.finalidades))
      OR e.data < d."dataReferencia" OR (d.finalidade='RECONFIRMACAO' AND e.data < d."previstaPara")
      OR (d."tentativaId" IS NOT NULL AND i."tentativaId" IS DISTINCT FROM d."tentativaId")
      OR (d."gestacaoId" IS NOT NULL AND i."gestacaoId" IS DISTINCT FROM d."gestacaoId")
      OR (d."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (e."tipoExameId" IS DISTINCT FROM d."regraSnapshot"->>'tipoExameId' OR e."formatoSnapshot"->>'versao' IS DISTINCT FROM d."regraSnapshot"->>'tipoExameVersao'))
      OR NOT COALESCE(((v.fonte='RESULTADO' AND d.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb))
           OR (v.fonte='RESULTADO' AND d.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb))
           OR (v.fonte='INTERPRETACAO' AND d.finalidade='APTIDAO_REPRODUTIVA' AND fonte_i."resultadoAptidao" IN ('APTO','NAO_APTO'))), false)
      OR EXISTS (SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" legado
        WHERE legado.id<>d.id AND legado.estado='RESOLVIDA' AND legado."exameResolucaoId"=e.id
          AND ((legado.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL') OR (legado.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND r.campo='CONCLUSAO_GESTACIONAL')))
    )
  ) OR EXISTS (
    SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d
    LEFT JOIN pecuaria."VinculoConclusaoAcompanhamento" v ON v.id=d."vinculoConclusaoResolucaoId"
    WHERE d.id=demanda_alvo AND d."vinculoConclusaoResolucaoId" IS NOT NULL
      AND (v.id IS NULL OR NOT v.vigente OR v."demandaId" <> d.id)
  ) THEN RAISE EXCEPTION 'resolução exige conclusão vigente e exclusiva compatível com a demanda' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;


--
-- Name: validar_vinculo_qualidade_fechamento(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_vinculo_qualidade_fechamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Vínculo de qualidade preservado não pode ser alterado ou excluído'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pecuaria."FechamentoOperacaoLeite" f
    JOIN pecuaria."OperacaoComercialLeite" o ON o.id=f."comercialId"
    JOIN pecuaria."AmostraQualidadeLeite" a ON a.id=NEW."amostraId"
    LEFT JOIN pecuaria."ExameAnimal" e ON e.id=a."exameAnimalId"
    WHERE f.id=NEW."fechamentoId" AND a."propriedadeId"=o."propriedadeId"
      AND a.data BETWEEN o.inicio AND o.fim AND a.status='VALIDO'
      AND (e.id IS NULL OR e.status='VALIDO') AND a.versao=NEW."versaoAmostra"
      AND NEW.snapshot->>'id'=a.id
      AND (NEW.snapshot->>'versao')::integer=a.versao
      AND (NEW.snapshot->>'propriedadeId')::integer=o."propriedadeId"
  ) THEN RAISE EXCEPTION 'Amostra incompatível com sítio, período, estado ou versão do fechamento'; END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validar_vinculo_tentativa_participacao(); Type: FUNCTION; Schema: pecuaria; Owner: -
--

CREATE FUNCTION pecuaria.validar_vinculo_tentativa_participacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW."participacaoId",NEW."tentativaId",NEW."propriedadeId",NEW.motivo,NEW.snapshot,NEW."criadoPorId",NEW."criadoEm") IS DISTINCT FROM (OLD.id,OLD."participacaoId",OLD."tentativaId",OLD."propriedadeId",OLD.motivo,OLD.snapshot,OLD."criadoPorId",OLD."criadoEm") OR OLD."revogadoEm" IS NOT NULL OR NEW."revogadoEm" IS NULL THEN RAISE EXCEPTION 'vínculo factual é preservado; somente revogação explícita é admitida' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p JOIN pecuaria."Protocolo" m ON m.id=p."protocoloId"
  JOIN pecuaria."TentativaReprodutiva" t ON t.id=NEW."tentativaId"
  WHERE p.id=NEW."participacaoId" AND p."propriedadeId"=NEW."propriedadeId" AND t."propriedadeId"=p."propriedadeId" AND t."animalId"=p."animalId"
   AND m.tipo='REPRODUTIVO' AND m."modalidadeTentativa"='EXTERNA' AND t.status='VALIDO' AND t."tarefaId" IS NULL
   AND ((m.finalidade='IATF' AND t.tipo='IA') OR (m.finalidade='TETF' AND t.tipo='TE'))
   AND t.data >= (CASE WHEN p."precisaoTemporal"='HORA' THEN (p."inicioReferencia" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date ELSE p."inicioReferencia"::date END) AND p."inicioEfetivo" IS NOT NULL AND t.data >= (CASE WHEN COALESCE(p."precisaoInicioEfetivo",p."precisaoTemporal")='HORA' THEN (p."inicioEfetivo" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date ELSE p."inicioEfetivo"::date END)
   AND (p."canceladaEm" IS NULL OR t.data <= (p."canceladaEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date)
   AND NOT EXISTS (SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v WHERE v."tentativaId"=t.id AND v.estado='ATUAL')
   AND NEW.snapshot->>'tentativaId'=t.id AND NEW.snapshot->>'animalId'=t."animalId" AND NEW.snapshot->>'tipo'=t.tipo AND NEW.snapshot->>'data'=t.data::text
 ) THEN RAISE EXCEPTION 'tentativa externa incompatível com a participação' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: conferir_alocacao_partida_v3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conferir_alocacao_partida_v3() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  movimento_id text;
  movimento record;
  soma numeric;
BEGIN
  IF TG_TABLE_NAME = 'MovimentoEstoque' THEN
    movimento_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    movimento_id := OLD."movimentoEstoqueId";
  ELSE
    movimento_id := NEW."movimentoEstoqueId";
  END IF;
  SELECT m."id", m."produtoId", m."quantidade", p."rastrearPartidas"
    INTO movimento FROM "MovimentoEstoque" m JOIN "Produto" p ON p."id" = m."produtoId"
    WHERE m."id" = movimento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM "AlocacaoPartidaEstoque" a JOIN "PartidaProduto" pp ON pp."id" = a."partidaId"
    WHERE a."movimentoEstoqueId" = movimento_id AND pp."produtoId" <> movimento."produtoId"
  ) THEN RAISE EXCEPTION 'partida de outro produto no movimento %', movimento_id USING ERRCODE = '23514'; END IF;
  SELECT coalesce(sum(a."quantidade"), 0) INTO soma
    FROM "AlocacaoPartidaEstoque" a WHERE a."movimentoEstoqueId" = movimento_id;
  IF movimento."rastrearPartidas" AND soma <> movimento."quantidade" THEN
    RAISE EXCEPTION 'partidas do movimento % somam %, esperado %', movimento_id, soma, movimento."quantidade" USING ERRCODE = '23514';
  END IF;
  IF NOT movimento."rastrearPartidas" AND soma <> 0 THEN
    RAISE EXCEPTION 'produto sem rastreio não pode ter partida no movimento %', movimento_id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;


--
-- Name: conferir_base_valorizacao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conferir_base_valorizacao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
  IF (NEW."metodo" IN ('MEDIA_SALDO_V1','CAMADAS_AQUISICAO_V2')) IS DISTINCT FROM (SELECT p."rastrearPartidas" FROM public."Produto" p WHERE p."id"=NEW."produtoId") THEN RAISE EXCEPTION 'método incompatível com produto' USING ERRCODE='23514'; END IF;
  IF NEW."partidaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."PartidaProduto" pp WHERE pp."id"=NEW."partidaId" AND pp."produtoId"=NEW."produtoId" AND pp."lotePrincipalId" IS NULL) THEN RAISE EXCEPTION 'grupo raiz incompatível' USING ERRCODE='23514'; END IF;
  IF NEW."baseOrigemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."BaseValorizacaoEstoque" b WHERE b."id"=NEW."baseOrigemId" AND b."produtoId"=NEW."produtoId") THEN RAISE EXCEPTION 'base origem incompatível' USING ERRCODE='23514'; END IF;
  IF NEW."origemMovimentoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."MovimentoEstoque" m WHERE m."id"=NEW."origemMovimentoId" AND m."produtoId"=NEW."produtoId" AND m."propriedadeId" IS NOT DISTINCT FROM NEW."propriedadeId" AND (m."tipo"='ENTRADA' OR (m."tipo"='AJUSTE' AND m."quantidade">0))) THEN RAISE EXCEPTION 'origem incompatível' USING ERRCODE='23514'; END IF;
  IF NEW."aberturaDocumentada" IS NOT NULL AND (NEW."corteAbertura" IS NULL OR NEW."disponivelDesde">NEW."corteAbertura" OR NOT (NEW."aberturaDocumentada" ?& ARRAY['chave','corte','referencia','motivo','evidencia','usuarioId','revisao'])) THEN RAISE EXCEPTION 'abertura exige corte e evidência' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: conferir_grupo_validade_produto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conferir_grupo_validade_produto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."lotePrincipalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PartidaProduto" raiz WHERE raiz."id" = NEW."lotePrincipalId"
      AND raiz."id" <> NEW."id" AND raiz."lotePrincipalId" IS NULL
      AND raiz."produtoId" = NEW."produtoId"
      AND raiz."validade" IS NOT DISTINCT FROM NEW."validade"
  ) THEN
    RAISE EXCEPTION 'grupo de validade deve apontar para raiz do mesmo produto e validade' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "PartidaProduto" alias WHERE alias."lotePrincipalId" = NEW."id"
    AND (NEW."lotePrincipalId" IS NOT NULL OR alias."produtoId" <> NEW."produtoId"
      OR alias."validade" IS DISTINCT FROM NEW."validade")) THEN
    RAISE EXCEPTION 'raiz não pode invalidar referências históricas do grupo' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: conferir_valorizacao_estoque(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conferir_valorizacao_estoque() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE mid TEXT; m RECORD; base_registro RECORD; q NUMERIC; v NUMERIC; sinal INTEGER;
BEGIN
  -- Cada tabela tem um formato de registro próprio. Um CASE na mesma expressão
  -- resolve também os campos do ramo não escolhido e falha para MovimentoEstoque.
  IF TG_TABLE_NAME = 'MovimentoEstoque' THEN
    mid := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    mid := OLD."movimentoEstoqueId";
  ELSE
    mid := NEW."movimentoEstoqueId";
  END IF;
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE "id"=mid;
  IF NOT FOUND OR m."metodoValorizacao"='LEGADO' THEN RETURN NULL; END IF;
  IF m."metodoValorizacao"='LEITE_FIFO_V1' THEN PERFORM pecuaria.conferir_movimento_leite(mid); RETURN NULL; END IF;
  IF m."propriedadeId" IS NULL THEN RAISE EXCEPTION 'movimento valorizado exige sítio' USING ERRCODE='23514'; END IF;
  IF m."metodoValorizacao" NOT IN ('MEDIA_SALDO_V1','FIFO_AQUISICAO_V1') THEN RAISE EXCEPTION 'método de valorização inválido'; END IF;
  sinal := CASE WHEN m."tipo"='SAIDA' THEN -1 ELSE 1 END;
  SELECT COALESCE(sum("quantidade"),0),COALESCE(sum("valorTotal"),0) INTO q,v FROM public."ParcelaValorizacaoEstoque" WHERE "movimentoEstoqueId"=mid;
  IF q<>sinal*m."quantidade" OR v<>sinal*m."valorTotal" THEN RAISE EXCEPTION 'parcelas não conciliam quantidade/valor do movimento %', mid USING ERRCODE='23514'; END IF;
  FOR base_registro IN SELECT DISTINCT base.* FROM public."BaseValorizacaoEstoque" base JOIN public."ParcelaValorizacaoEstoque" p ON p."baseId"=base."id" WHERE p."movimentoEstoqueId"=mid LOOP
    IF base_registro."produtoId"<>m."produtoId" OR base_registro."propriedadeId" IS DISTINCT FROM m."propriedadeId" OR base_registro."metodo"<>m."metodoValorizacao" OR base_registro."disponivelDesde">m."data" OR base_registro."corteAbertura">m."data" THEN RAISE EXCEPTION 'base incompatível com movimento %',mid USING ERRCODE='23514'; END IF;
    SELECT base_registro."quantidadeAbertura"+COALESCE(sum("quantidade"),0),base_registro."valorAbertura"+COALESCE(sum("valorTotal"),0) INTO q,v FROM public."ParcelaValorizacaoEstoque" WHERE "baseId"=base_registro."id";
    IF q<0 OR v<0 OR (q=0 AND v<>0) THEN RAISE EXCEPTION 'saldo residual de quantidade/valor inválido' USING ERRCODE='23514'; END IF;
    IF base_registro."partidaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."PartidaProduto" pp WHERE pp."id"=base_registro."partidaId" AND pp."produtoId"=base_registro."produtoId" AND pp."lotePrincipalId" IS NULL) THEN RAISE EXCEPTION 'base exige grupo raiz do produto' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF m."metodoValorizacao"='MEDIA_SALDO_V1' AND EXISTS (
    SELECT 1 FROM public."ParcelaValorizacaoEstoque" p JOIN public."BaseValorizacaoEstoque" b ON b."id"=p."baseId"
    WHERE p."movimentoEstoqueId"=mid AND p."quantidade" <> sinal*COALESCE((SELECT sum(a."quantidade") FROM public."AlocacaoPartidaEstoque" a JOIN public."PartidaProduto" pp ON pp."id"=a."partidaId" WHERE a."movimentoEstoqueId"=mid AND COALESCE(pp."lotePrincipalId",pp."id")=b."partidaId"),0)
  ) THEN RAISE EXCEPTION 'parcelas monetárias divergem dos grupos físicos' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;


--
-- Name: impedir_edicao_alocacao_partida_v3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.impedir_edicao_alocacao_partida_v3() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'alocação de partida confirmada é imutável; use movimento inverso' USING ERRCODE = '23514';
END $$;


--
-- Name: impedir_edicao_valorizacao_estoque(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.impedir_edicao_valorizacao_estoque() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'valorização confirmada é imutável; use inverso ou abertura documentada' USING ERRCODE='23514'; END $$;


--
-- Name: normalizar_nome_produto_v1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalizar_nome_produto_v1(valor text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
 SELECT lower(translate(btrim(regexp_replace(valor, '\s+', ' ', 'g')),
 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ',
 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'))
$$;


--
-- Name: protegerEventoMetaAssistente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public."protegerEventoMetaAssistente"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'Histórico de metas é imutável'; END; $$;


--
-- Name: proteger_identidade_valorizada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_identidade_valorizada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
  IF OLD."metodoValorizacao" <> 'LEGADO' AND (NEW."metodoValorizacao" IS DISTINCT FROM OLD."metodoValorizacao" OR NEW."produtoId" IS DISTINCT FROM OLD."produtoId" OR NEW."propriedadeId" IS DISTINCT FROM OLD."propriedadeId" OR NEW."quantidade" IS DISTINCT FROM OLD."quantidade" OR NEW."valorTotal" IS DISTINCT FROM OLD."valorTotal" OR NEW."data" IS DISTINCT FROM OLD."data" OR NEW."tipo" IS DISTINCT FROM OLD."tipo" OR NEW."custoUnitario" IS DISTINCT FROM OLD."custoUnitario" OR NEW."evidenciaValor" IS DISTINCT FROM OLD."evidenciaValor" OR NEW."origem" IS DISTINCT FROM OLD."origem" OR NEW."reversaoDeId" IS DISTINCT FROM OLD."reversaoDeId") THEN RAISE EXCEPTION 'identidade e valores congelados; use inverso' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: proteger_localizacao_consumo_v3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_localizacao_consumo_v3() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  fechamento record;
  dias_antes integer;
  dias_depois integer;
  old_lote text;
  new_lote text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_lote := OLD."loteId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_lote := NEW."loteId"; END IF;
  FOR fechamento IN
    SELECT f."id", f."loteId", f."inicio", f."fim"
    FROM "pecuaria"."FechamentoConsumo" f
    WHERE f."status" = 'CONFIRMADO'
      AND (f."loteId" = old_lote OR f."loteId" = new_lote)
  LOOP
    dias_antes := 0;
    dias_depois := 0;
    IF TG_OP <> 'INSERT' AND old_lote = fechamento."loteId" THEN
      dias_antes := greatest(0, least(coalesce(OLD."ate", fechamento."fim" + 1), fechamento."fim" + 1)
        - greatest(OLD."desde", fechamento."inicio"));
    END IF;
    IF TG_OP <> 'DELETE' AND new_lote = fechamento."loteId" THEN
      dias_depois := greatest(0, least(coalesce(NEW."ate", fechamento."fim" + 1), fechamento."fim" + 1)
        - greatest(NEW."desde", fechamento."inicio"));
    END IF;
    IF dias_antes <> dias_depois THEN
      RAISE EXCEPTION 'localização altera animal-dias do fechamento %; estorne-o antes', fechamento."id" USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: validarSequenciaMetaAssistente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public."validarSequenciaMetaAssistente"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE anterior public."EventoMetaAssistente"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW."metaId"::text, 0));
 SELECT * INTO anterior FROM public."EventoMetaAssistente" WHERE "metaId"=NEW."metaId" ORDER BY "revisao" DESC LIMIT 1;
 IF FOUND THEN
  IF NEW."revisao" <> anterior."revisao"+1 OR NEW."propriedadeId" <> anterior."propriedadeId" OR NEW."dominio" <> anterior."dominio" THEN RAISE EXCEPTION 'Sequência ou escopo da meta inválido'; END IF;
 ELSE
  IF NEW."revisao" <> 1 OR NEW."tipo" <> 'definicao' THEN RAISE EXCEPTION 'Meta deve iniciar pela definição'; END IF;
 END IF;
 RETURN NEW;
END; $$;


--
-- Name: validar_item_operacao_animal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_item_operacao_animal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  tipo_operacao text;
  status_operacao text;
BEGIN
  IF NEW."animalId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT o."tipo"::text, o."status"::text INTO tipo_operacao, status_operacao FROM "public"."Operacao" o WHERE o."id" = NEW."operacaoId";
  IF tipo_operacao NOT IN ('COMPRA_ANIMAIS', 'DEVOLUCAO') THEN
    RAISE EXCEPTION 'Item com animal só é aceito em compra ou devolução de animais' USING ERRCODE = '23514';
  END IF;
  IF status_operacao = 'CANCELADA' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('item-operacao-animal:' || NEW."animalId"));
  IF EXISTS (
    SELECT 1 FROM "public"."ItemOperacao" i
    JOIN "public"."Operacao" o ON o."id" = i."operacaoId"
    WHERE i."animalId" = NEW."animalId" AND i."id" <> NEW."id"
      AND o."tipo"::text = tipo_operacao AND o."status"::text <> 'CANCELADA'
  ) THEN
    RAISE EXCEPTION 'O animal já está em outra % ativa', CASE WHEN tipo_operacao = 'DEVOLUCAO' THEN 'devolução' ELSE 'compra' END USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AcompanhamentoColostragem; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AcompanhamentoColostragem" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "configuracaoId" text,
    "politicaSnapshot" jsonb NOT NULL,
    "pesoReferenciaKg" numeric(10,3),
    "metaLitros" numeric(10,3),
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "AcompanhamentoColostragem_meta" CHECK (((("pesoReferenciaKg" IS NULL) OR ("pesoReferenciaKg" > (0)::numeric)) AND (("metaLitros" IS NULL) OR ("metaLitros" > (0)::numeric))))
);


--
-- Name: AlocacaoDemonstrativoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AlocacaoDemonstrativoLeite" (
    id text NOT NULL,
    "demonstrativoId" text NOT NULL,
    "entregaId" text NOT NULL,
    "versaoVendaId" text NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    valor numeric(14,2) NOT NULL,
    "motivoAceitePendente" text,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT "AlocacaoDemonstrativoLeite_positiva" CHECK (((quantidade > (0)::numeric) AND (valor > (0)::numeric)))
);


--
-- Name: AlocacaoFornecimentoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AlocacaoFornecimentoColostro" (
    "destinacaoId" text,
    id text NOT NULL,
    "fornecimentoId" text NOT NULL,
    "origemId" text NOT NULL,
    "unidadeId" text,
    "destinoInternoId" text,
    "movimentoId" text,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT "AlocacaoFornecimentoColostro_volume" CHECK (("quantidadeLitros" > (0)::numeric))
);


--
-- Name: AlocacaoLeiteEstoque; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AlocacaoLeiteEstoque" (
    id text NOT NULL,
    "entradaId" text NOT NULL,
    "movimentoId" text NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    "valorTotal" numeric(14,2),
    "classificacaoId" text NOT NULL,
    finalidade text NOT NULL,
    CONSTRAINT "AlocacaoLeite_finalidade" CHECK ((finalidade = ANY (ARRAY['VENDA'::text, 'CONSUMO'::text, 'DESCARTE'::text]))),
    CONSTRAINT "AlocacaoLeite_quantidade_valor" CHECK (((quantidade > (0)::numeric) AND (("valorTotal" IS NULL) OR ("valorTotal" >= (0)::numeric))))
);


--
-- Name: AmostraQualidadeLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AmostraQualidadeLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    data date NOT NULL,
    sujeito text NOT NULL,
    "tipoExameId" text NOT NULL,
    "exameAnimalId" text,
    "origemColetiva" text,
    "entradaId" text,
    "formatoSnapshot" jsonb,
    realizacao text DEFAULT 'COLETA_REGISTRADA'::text NOT NULL,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    responsavel text,
    "anotacaoOriginal" text,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "dataResultadoLaboratorial" date,
    "dataRecebimentoLaudo" date,
    "origemColostroId" text,
    CONSTRAINT "AmostraQualidadeLeite_anulacao_check" CHECK ((((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NULL)) OR ((status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NOT NULL) AND (length(btrim("motivoAnulacao")) > 0)))),
    CONSTRAINT "AmostraQualidadeLeite_realizacao_check" CHECK ((realizacao = ANY (ARRAY['COLETA_REGISTRADA'::text, 'REALIZADO'::text]))),
    CONSTRAINT "AmostraQualidadeLeite_sujeito_check" CHECK (((((sujeito = 'ANIMAL'::text) AND ("exameAnimalId" IS NOT NULL) AND ("origemColetiva" IS NULL) AND ("entradaId" IS NULL) AND ("formatoSnapshot" IS NULL) AND ("origemColostroId" IS NULL)) OR ((sujeito = 'COLETIVO'::text) AND ("exameAnimalId" IS NULL) AND (length(btrim("origemColetiva")) > 0) AND (jsonb_typeof("formatoSnapshot") = 'object'::text) AND ("origemColostroId" IS NULL)) OR ((sujeito = 'COLOSTRO'::text) AND ("origemColostroId" IS NOT NULL) AND ("exameAnimalId" IS NULL) AND ("entradaId" IS NULL) AND ("origemColetiva" IS NULL) AND (jsonb_typeof("formatoSnapshot") = 'object'::text))) IS TRUE)),
    CONSTRAINT "AmostraQualidadeLeite_versao_check" CHECK ((versao > 0))
);


--
-- Name: Animal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Animal" (
    id text NOT NULL,
    "ideagriId" integer,
    brinco text NOT NULL,
    nome text,
    "brincoEletronico" text,
    sisbov text,
    sexo pecuaria."SexoBovino" NOT NULL,
    "dataNascimento" date NOT NULL,
    "nascimentoEstimado" boolean DEFAULT false NOT NULL,
    origem pecuaria."OrigemAnimal" NOT NULL,
    "dataEntrada" date NOT NULL,
    "partosAntesDaEntrada" integer DEFAULT 0 NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "maeExternaId" text,
    "maeId" text,
    "paiExternoId" text,
    "paiId" text,
    "codigoProvisorio" character varying(39),
    "identificacaoProvisoria" boolean DEFAULT false NOT NULL,
    CONSTRAINT "Animal_mae_nao_si_chk" CHECK ((("maeId" IS NULL) OR ("maeId" <> id))),
    CONSTRAINT "Animal_mae_unica_chk" CHECK ((("maeId" IS NULL) OR ("maeExternaId" IS NULL))),
    CONSTRAINT "Animal_pai_nao_si_chk" CHECK ((("paiId" IS NULL) OR ("paiId" <> id))),
    CONSTRAINT "Animal_pai_unico_chk" CHECK ((("paiId" IS NULL) OR ("paiExternoId" IS NULL))),
    CONSTRAINT "Animal_provisorio" CHECK (((NOT "identificacaoProvisoria") OR ("codigoProvisorio" IS NOT NULL)))
);


--
-- Name: AplicacaoProduto; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AplicacaoProduto" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    "produtoId" text,
    "nomeProdutoAplicado" text NOT NULL,
    "ocorrenciaId" text,
    "tarefaId" text,
    data date NOT NULL,
    "aplicadaEm" timestamp(3) without time zone,
    "precisaoTemporal" text DEFAULT 'HORA'::text NOT NULL,
    finalidade pecuaria."FinalidadeAplicacao",
    dose numeric(12,3),
    "unidadeDose" text,
    via text,
    "carenciaLeiteHoras" integer,
    "carenciaCarneHoras" integer,
    "referenciaCarencia" text,
    "origemInsumo" pecuaria."OrigemInsumoSanitario" NOT NULL,
    "quantidadeUtilizada" numeric(12,3),
    "movimentoEstoqueId" text,
    "itemCompraDiretaId" text,
    "quantidadeCompraDireta" numeric(12,3),
    "operacaoServicoId" text,
    "valorProdutoAtribuido" numeric(14,2),
    "valorServicoAtribuido" numeric(14,2),
    "situacaoCusto" text DEFAULT 'NAO_APURADO'::text NOT NULL,
    "partidaCodigoSnapshot" text,
    "partidaValidadeSnapshot" date,
    "justificativaSemOrigem" text,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "tipoAplicacaoId" text,
    "tipoAplicacaoNomeSnapshot" text,
    responsavel text,
    "estadoCarenciaLeite" text DEFAULT 'NAO_INFORMADO'::text NOT NULL,
    "estadoCarenciaCarne" text DEFAULT 'NAO_INFORMADO'::text NOT NULL,
    "justificativaCarenciaLeite" text,
    "aptidaoCarenciaSnapshot" text,
    "justificativaCarenciaCarne" text,
    "desvioProtocoloSnapshot" jsonb,
    "consumoMantido" boolean DEFAULT false NOT NULL,
    "administracaoMantida" boolean,
    "insercaoDispositivoSnapshot" jsonb,
    CONSTRAINT "AplicacaoProduto_insercao_documentada" CHECK ((("insercaoDispositivoSnapshot" IS NULL) OR (("insercaoDispositivoSnapshot" ?& ARRAY['versao'::text, 'motivo'::text, 'evidencia'::text, 'usuarioId'::text, 'registradoEm'::text]) AND (jsonb_typeof("insercaoDispositivoSnapshot") = 'object'::text) AND (("insercaoDispositivoSnapshot" ->> 'versao'::text) = '1'::text) AND (jsonb_typeof(("insercaoDispositivoSnapshot" -> 'motivo'::text)) = 'string'::text) AND (jsonb_typeof(("insercaoDispositivoSnapshot" -> 'evidencia'::text)) = 'string'::text) AND (jsonb_typeof(("insercaoDispositivoSnapshot" -> 'registradoEm'::text)) = 'string'::text) AND (length(TRIM(BOTH FROM ("insercaoDispositivoSnapshot" ->> 'motivo'::text))) >= 5) AND (length(TRIM(BOTH FROM ("insercaoDispositivoSnapshot" ->> 'evidencia'::text))) >= 5)))),
    CONSTRAINT "AplicacaoProduto_origem_check" CHECK (((("origemInsumo" = 'BAIXA_ESTOQUE'::pecuaria."OrigemInsumoSanitario") AND ("produtoId" IS NOT NULL) AND ("movimentoEstoqueId" IS NOT NULL) AND ("itemCompraDiretaId" IS NULL)) OR (("origemInsumo" = 'COMPRA_CONSUMO_DIRETO'::pecuaria."OrigemInsumoSanitario") AND ("produtoId" IS NOT NULL) AND ("itemCompraDiretaId" IS NOT NULL) AND ("movimentoEstoqueId" IS NULL)) OR (("origemInsumo" = 'INCLUSO_SERVICO'::pecuaria."OrigemInsumoSanitario") AND ("operacaoServicoId" IS NOT NULL) AND ("itemCompraDiretaId" IS NULL) AND ("movimentoEstoqueId" IS NULL)) OR (("origemInsumo" = 'SEM_ORIGEM_JUSTIFICADA'::pecuaria."OrigemInsumoSanitario") AND (length(TRIM(BOTH FROM COALESCE("justificativaSemOrigem", ''::text))) > 0) AND ("itemCompraDiretaId" IS NULL) AND ("movimentoEstoqueId" IS NULL)) OR (("origemInsumo" = 'HISTORICO_IMPORTADO'::pecuaria."OrigemInsumoSanitario") AND ("itemCompraDiretaId" IS NULL) AND ("movimentoEstoqueId" IS NULL)))),
    CONSTRAINT "Aplicacao_consumo_mantido_anulado" CHECK ((((NOT "consumoMantido") OR (status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3")) AND (("administracaoMantida" IS NULL) OR ("consumoMantido" AND (status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3"))))),
    CONSTRAINT carencia_estados_v3 CHECK ((("estadoCarenciaLeite" = ANY (ARRAY['INFORMADO'::text, 'NAO_INFORMADO'::text, 'NAO_APLICAVEL'::text])) AND ("estadoCarenciaCarne" = ANY (ARRAY['INFORMADO'::text, 'NAO_INFORMADO'::text, 'NAO_APLICAVEL'::text])) AND ((("estadoCarenciaLeite" = 'INFORMADO'::text) AND ("carenciaLeiteHoras" IS NOT NULL) AND ("carenciaLeiteHoras" >= 0)) OR (("estadoCarenciaLeite" <> 'INFORMADO'::text) AND ("carenciaLeiteHoras" IS NULL))) AND ((("estadoCarenciaCarne" = 'INFORMADO'::text) AND ("carenciaCarneHoras" IS NOT NULL) AND ("carenciaCarneHoras" >= 0)) OR (("estadoCarenciaCarne" <> 'INFORMADO'::text) AND ("carenciaCarneHoras" IS NULL)))))
);


--
-- Name: ApropriacaoValorLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ApropriacaoValorLeite" (
    id text NOT NULL,
    "apuracaoId" text NOT NULL,
    "alocacaoId" text NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    CONSTRAINT "ApropriacaoLeite_valor" CHECK (("valorTotal" >= (0)::numeric))
);


--
-- Name: ApuracaoValorLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ApuracaoValorLeite" (
    id text NOT NULL,
    "entradaId" text NOT NULL,
    versao integer NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    referencia text NOT NULL,
    evidencia text NOT NULL,
    motivo text NOT NULL,
    chave text NOT NULL,
    hash text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ApuracaoLeite_documentada" CHECK (((versao > 0) AND ("valorTotal" >= (0)::numeric) AND (length(TRIM(BOTH FROM referencia)) >= 2) AND (length(TRIM(BOTH FROM evidencia)) >= 5) AND (length(TRIM(BOTH FROM motivo)) >= 5) AND (length(hash) = 64)))
);


--
-- Name: AtividadeVisita; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AtividadeVisita" (
    id text NOT NULL,
    "visitaId" text NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    extra boolean DEFAULT false NOT NULL,
    contexto jsonb DEFAULT '{}'::jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditoriaPecuaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AuditoriaPecuaria" (
    id text NOT NULL,
    entidade text NOT NULL,
    "entidadeId" text NOT NULL,
    "animalId" text,
    acao text NOT NULL,
    antes jsonb,
    depois jsonb,
    "usuarioId" integer,
    em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "propriedadeId" integer,
    "requisicaoId" text
);


--
-- Name: AutomacaoProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."AutomacaoProtocolo" (
    id text NOT NULL,
    "participacaoId" text NOT NULL,
    "momentoId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "usuarioId" integer NOT NULL,
    estado text DEFAULT 'AGENDADA'::text NOT NULL,
    "programadaPara" timestamp(3) without time zone NOT NULL,
    configuracao jsonb NOT NULL,
    resultado jsonb,
    erro text,
    tentativas integer DEFAULT 0 NOT NULL,
    "criadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadaEm" timestamp(3) without time zone NOT NULL,
    "executadaEm" timestamp(3) without time zone,
    revisao integer DEFAULT 1 NOT NULL,
    CONSTRAINT "AutomacaoProtocolo_estado_check" CHECK ((estado = ANY (ARRAY['AGENDADA'::text, 'EXECUTADA'::text, 'FALHOU'::text, 'CANCELADA'::text, 'REVERTIDA'::text]))),
    CONSTRAINT "AutomacaoProtocolo_revisao_check" CHECK ((revisao > 0)),
    CONSTRAINT "AutomacaoProtocolo_tentativas_check" CHECK ((tentativas >= 0))
);


--
-- Name: ExameAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ExameAnimal" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    "tipoExameId" text NOT NULL,
    "ocorrenciaId" text,
    "tarefaId" text,
    "operacaoServicoId" text,
    data date NOT NULL,
    "resultadoTexto" text,
    "resultadoNumero" numeric(14,4),
    "resultadoOpcao" text,
    "formatoSnapshot" jsonb NOT NULL,
    responsavel text,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "valorServicoAtribuido" numeric(14,2),
    "desvioProtocoloSnapshot" jsonb,
    finalidades text[] DEFAULT ARRAY[]::text[] NOT NULL,
    "finalidadePrincipal" text,
    realizacao text DEFAULT 'REALIZADO'::text NOT NULL,
    "anotacaoOriginal" text,
    observacao text,
    "criadoPorId" integer,
    "partoPosPartoId" text,
    "demandaAcompanhamentoId" text,
    "avaliacaoContextualSnapshot" jsonb,
    CONSTRAINT "ExameAnimal_finalidade_check" CHECK ((("finalidadePrincipal" IS NULL) OR ("finalidadePrincipal" = ANY (finalidades)))),
    CONSTRAINT "ExameAnimal_formato_multiplo_check" CHECK (((("formatoSnapshot" ->> 'tipoResultado'::text) <> 'MULTIPLO'::text) OR (("resultadoTexto" IS NULL) AND ("resultadoNumero" IS NULL) AND ("resultadoOpcao" IS NULL)))),
    CONSTRAINT "ExameAnimal_realizacao_check" CHECK ((realizacao = ANY (ARRAY['REALIZADO'::text, 'COLETA_REGISTRADA'::text, 'NAO_REALIZADO'::text]))),
    CONSTRAINT "Exame_avaliacao_contextual_objeto" CHECK ((("avaliacaoContextualSnapshot" IS NULL) OR (jsonb_typeof("avaliacaoContextualSnapshot") = 'object'::text))),
    CONSTRAINT exame_rateio_nao_negativo CHECK ((("valorServicoAtribuido" IS NULL) OR (("valorServicoAtribuido" >= (0)::numeric) AND ("operacaoServicoId" IS NOT NULL))))
);


--
-- Name: InterpretacaoReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."InterpretacaoReprodutiva" (
    id text NOT NULL,
    "referenciaExterna" text,
    "tentativaId" text,
    "gestacaoId" text,
    conduta text,
    motivo text,
    "retornoEm" date,
    "gestacaoCriada" boolean DEFAULT false NOT NULL,
    "restricaoId" text,
    "exameId" text NOT NULL,
    "decisaoIatf" text,
    "resultadoAptidao" text,
    "retornoAptidaoEm" date,
    "condutasContextuais" jsonb,
    CONSTRAINT "InterpretacaoReprodutiva_decisaoIatf_check" CHECK ((("decisaoIatf" IS NULL) OR ("decisaoIatf" = ANY (ARRAY['INDICAR'::text, 'NAO_INDICAR'::text])))),
    CONSTRAINT "InterpretacaoReprodutiva_resultadoAptidao_check" CHECK ((("resultadoAptidao" IS NULL) OR ("resultadoAptidao" = ANY (ARRAY['APTO'::text, 'NAO_APTO'::text, 'INCONCLUSIVO'::text])))),
    CONSTRAINT "InterpretacaoReprodutiva_retornoAptidao_check" CHECK ((("retornoAptidaoEm" IS NULL) OR ("resultadoAptidao" IS NOT NULL))),
    CONSTRAINT "Interpretacao_condutas_array" CHECK ((("condutasContextuais" IS NULL) OR (jsonb_typeof("condutasContextuais") = 'array'::text)))
);


--
-- Name: ResultadoExame; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ResultadoExame" (
    id text NOT NULL,
    "exameId" text NOT NULL,
    campo text NOT NULL,
    valor jsonb NOT NULL,
    unidade text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    "substituidoEm" timestamp(3) without time zone,
    "criadoPorId" integer,
    CONSTRAINT "ResultadoExame_campo_check" CHECK ((length(TRIM(BOTH FROM campo)) > 0))
);


--
-- Name: AvaliacaoReprodutiva; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."AvaliacaoReprodutiva" AS
 SELECT i.id,
    i."referenciaExterna",
    e."animalId",
    e."propriedadeId",
    e.data,
    e.origem,
    e.status,
    e."motivoAnulacao",
    e."anuladoEm",
    e."criadoEm",
    e."criadoPorId",
    i."gestacaoCriada",
    i."restricaoId",
        CASE
            WHEN ((e.realizacao = 'NAO_REALIZADO'::text) OR (e."finalidadePrincipal" = 'AVALIACAO_REPRODUTIVA'::text)) THEN 'NAO_AVALIADO'::text
            WHEN ((e."finalidadePrincipal" = 'RECONFIRMACAO'::text) AND ((c.valor #>> '{}'::text[]) = 'POSITIVO'::text)) THEN 'RECONFIRMACAO'::text
            WHEN ((e."finalidadePrincipal" = 'SEXAGEM'::text) AND (c.valor IS NULL) AND (e."avaliacaoContextualSnapshot" @> '{"itens": [{"tipo": "SEXAGEM", "estado": "INCONCLUSIVO"}]}'::jsonb)) THEN 'INCONCLUSIVO'::text
            WHEN ((e."finalidadePrincipal" = 'SEXAGEM'::text) AND (c.valor IS NULL)) THEN 'SEXAGEM'::text
            ELSE COALESCE((c.valor #>> '{}'::text[]), 'INCONCLUSIVO'::text)
        END AS resultado,
    i."tentativaId",
    i."gestacaoId",
    ((s.valor #>> '{}'::text[]))::pecuaria."SexoBovino" AS "sexoFetal",
    i.conduta,
    i.motivo,
    e."anotacaoOriginal",
    i."retornoEm",
    e.observacao
   FROM (((pecuaria."InterpretacaoReprodutiva" i
     JOIN pecuaria."ExameAnimal" e ON ((e.id = i."exameId")))
     LEFT JOIN pecuaria."ResultadoExame" c ON (((c."exameId" = e.id) AND (c.campo = 'CONCLUSAO_GESTACIONAL'::text) AND c.vigente)))
     LEFT JOIN pecuaria."ResultadoExame" s ON (((s."exameId" = e.id) AND (s.campo = 'SEXO_FETAL'::text) AND s.vigente)))
  WHERE (e."finalidadePrincipal" IS DISTINCT FROM 'APTIDAO_REPRODUTIVA'::text);


--
-- Name: BaixaAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."BaixaAnimal" (
    id text NOT NULL,
    "ideagriId" integer,
    "animalId" text NOT NULL,
    data date NOT NULL,
    tipo pecuaria."TipoBaixa" NOT NULL,
    "motivoId" text,
    observacao text,
    "estornadaEm" timestamp(3) without time zone,
    "estornoMotivo" text,
    "localizacaoFechadaId" text,
    "destinoFechadoId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "cienciaCarenciaSnapshot" jsonb,
    "referenciaHistorica" text,
    "regularizacaoHistoricaSnapshot" jsonb,
    CONSTRAINT "BaixaAnimal_regularizacao_historica_check" CHECK (((("referenciaHistorica" IS NULL) AND ("regularizacaoHistoricaSnapshot" IS NULL) AND ((tipo)::text <> 'NAO_DETERMINADO'::text)) OR (("referenciaHistorica" IS NOT NULL) AND (length(btrim("referenciaHistorica")) > 0) AND ("regularizacaoHistoricaSnapshot" IS NOT NULL) AND (jsonb_typeof("regularizacaoHistoricaSnapshot") = 'object'::text) AND ((tipo)::text <> 'CADASTRO_INDEVIDO'::text) AND (jsonb_typeof(("regularizacaoHistoricaSnapshot" -> 'bancoOrigem'::text)) = 'string'::text) AND (jsonb_typeof(("regularizacaoHistoricaSnapshot" -> 'chaveOrigem'::text)) = 'string'::text) AND (jsonb_typeof(("regularizacaoHistoricaSnapshot" -> 'evidencia'::text)) = 'string'::text) AND (jsonb_typeof(("regularizacaoHistoricaSnapshot" -> 'motivo'::text)) = 'string'::text) AND (jsonb_typeof(("regularizacaoHistoricaSnapshot" -> 'usuarioId'::text)) = 'number'::text) AND (COALESCE((("regularizacaoHistoricaSnapshot" ->> 'usuarioId'::text))::numeric, (0)::numeric) > (0)::numeric) AND (COALESCE(length(btrim(("regularizacaoHistoricaSnapshot" ->> 'bancoOrigem'::text))), 0) > 0) AND (COALESCE(length(btrim(("regularizacaoHistoricaSnapshot" ->> 'chaveOrigem'::text))), 0) > 0) AND (COALESCE(length(btrim(("regularizacaoHistoricaSnapshot" ->> 'evidencia'::text))), 0) >= 5) AND (COALESCE(length(btrim(("regularizacaoHistoricaSnapshot" ->> 'motivo'::text))), 0) >= 5)))),
    CONSTRAINT "BaixaAnimal_tipo_indeterminado_sem_motivo_check" CHECK ((((tipo)::text <> 'NAO_DETERMINADO'::text) OR ("motivoId" IS NULL)))
);


--
-- Name: CatalogoAvaliacaoReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."CatalogoAvaliacaoReprodutiva" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    versao integer NOT NULL,
    "tipoExameId" text NOT NULL,
    itens jsonb NOT NULL,
    condutas jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "CatalogoAvaliacaoReprodutiva_condutas_check" CHECK ((jsonb_typeof(condutas) = 'array'::text)),
    CONSTRAINT "CatalogoAvaliacaoReprodutiva_itens_check" CHECK (((jsonb_typeof(itens) = 'array'::text) AND (jsonb_array_length(itens) > 0))),
    CONSTRAINT "CatalogoAvaliacaoReprodutiva_versao_check" CHECK ((versao > 0))
);


--
-- Name: CategoriaAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."CategoriaAnimal" (
    id text NOT NULL,
    "ideagriId" integer,
    "chavePadrao" text,
    nome text NOT NULL,
    sexo pecuaria."SexoBovino" NOT NULL,
    automatica boolean DEFAULT true NOT NULL,
    "idadeMinMeses" integer,
    "idadeMaxMeses" integer,
    partos pecuaria."CriterioPartos" DEFAULT 'QUALQUER'::pecuaria."CriterioPartos" NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: CategoriaManualAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."CategoriaManualAnimal" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "categoriaId" text NOT NULL,
    desde date NOT NULL,
    ate date,
    motivo text NOT NULL,
    "motivoEncerramento" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: ClassificacaoCustoPecuaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ClassificacaoCustoPecuaria" (
    id text NOT NULL,
    "tentativaId" text,
    "aplicacaoId" text,
    "exameId" text,
    "participacaoId" text,
    "participacaoConsumoId" text,
    finalidade text,
    "materialNaoAplicavel" boolean DEFAULT false NOT NULL,
    "servicoNaoAplicavel" boolean DEFAULT false NOT NULL,
    "coberturaServico" text DEFAULT 'PROCEDIMENTO'::text NOT NULL,
    "valorMaterialDocumentado" numeric(14,2),
    "documentoMaterial" jsonb,
    versao integer DEFAULT 1 NOT NULL,
    "atualizadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "manejoId" text,
    "participacaoDiariaId" text,
    CONSTRAINT "ClassificacaoCusto_cobertura" CHECK (("coberturaServico" = ANY (ARRAY['PROCEDIMENTO'::text, 'MATERIAL'::text, 'AMBOS'::text]))),
    CONSTRAINT "ClassificacaoCusto_documento" CHECK (((("valorMaterialDocumentado" IS NULL) AND ("documentoMaterial" IS NULL)) OR (("valorMaterialDocumentado" IS NOT NULL) AND ("valorMaterialDocumentado" >= (0)::numeric) AND ("documentoMaterial" IS NOT NULL) AND ("documentoMaterial" ?& ARRAY['referencia'::text, 'evidencia'::text])))),
    CONSTRAINT "ClassificacaoCusto_finalidade" CHECK ((finalidade = ANY (ARRAY['REPRODUCAO'::text, 'SANIDADE'::text, 'ROTINA'::text]))),
    CONSTRAINT "ClassificacaoCusto_um_fato" CHECK ((num_nonnulls("tentativaId", "aplicacaoId", "exameId", "participacaoId", "participacaoConsumoId", "manejoId", "participacaoDiariaId") = 1)),
    CONSTRAINT "ClassificacaoCusto_versao" CHECK ((versao > 0))
);


--
-- Name: ClassificacaoEntradaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ClassificacaoEntradaLeite" (
    id text NOT NULL,
    "entradaId" text NOT NULL,
    versao integer NOT NULL,
    natureza text NOT NULL,
    motivo text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ClassificacaoLeite_natureza" CHECK (((versao > 0) AND (natureza = ANY (ARRAY['NAO_INFORMADA'::text, 'COMERCIAL'::text, 'COLOSTRO'::text, 'NAO_COMERCIAL'::text])) AND (length(TRIM(BOTH FROM motivo)) >= 5)))
);


--
-- Name: ColeiraBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ColeiraBezerreiro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    nome text NOT NULL,
    cor text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: ComposicaoGenitorExterno; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ComposicaoGenitorExterno" (
    id text NOT NULL,
    "genitorId" text NOT NULL,
    "racaId" text NOT NULL,
    fracao64 integer NOT NULL,
    CONSTRAINT "ComposicaoGenitorExterno_fracao_chk" CHECK (((fracao64 >= 1) AND (fracao64 <= 64)))
);


--
-- Name: ComposicaoRacial; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ComposicaoRacial" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "racaId" text NOT NULL,
    fracao64 integer NOT NULL,
    origem pecuaria."OrigemComposicao" NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "fracaoCalculada64" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "ComposicaoRacial_fracaoCalculada64_check" CHECK ((("fracaoCalculada64" >= 0) AND ("fracaoCalculada64" <= fracao64)))
);


--
-- Name: ComprovanteEntregaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ComprovanteEntregaLeite" (
    id text NOT NULL,
    "entregaId" text NOT NULL,
    nome text NOT NULL,
    "mimeType" text NOT NULL,
    "tamanhoBytes" integer NOT NULL,
    sha256 character varying(64) NOT NULL,
    "storageKey" text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ComprovanteRetiradaOperacaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ComprovanteRetiradaOperacaoLeite" (
    id text NOT NULL,
    "retiradaId" text NOT NULL,
    nome text NOT NULL,
    "mimeType" text NOT NULL,
    "tamanhoBytes" integer NOT NULL,
    sha256 text NOT NULL,
    "storageKey" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ComprovanteRetiradaOperacaoLeite_sha256_check" CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT "ComprovanteRetiradaOperacaoLeite_tamanhoBytes_check" CHECK ((("tamanhoBytes" > 0) AND ("tamanhoBytes" <= 10485760)))
);


--
-- Name: ConferenciaEntregaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ConferenciaEntregaLeite" (
    id text NOT NULL,
    "entregaId" text NOT NULL,
    versao integer NOT NULL,
    "volumeAceito" numeric(12,3),
    situacao text NOT NULL,
    "destinacaoInformada" text,
    motivo text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "ConferenciaEntrega_contrato" CHECK (((versao > 0) AND (("volumeAceito" IS NULL) OR ("volumeAceito" >= (0)::numeric)) AND (length(TRIM(BOTH FROM motivo)) >= 5) AND (situacao = ANY (ARRAY['PENDENTE'::text, 'ACEITE_INFORMADO'::text, 'DIVERGENCIA'::text, 'REJEITADA'::text, 'DESTINACAO_POSTERIOR'::text])) AND ((situacao <> 'PENDENTE'::text) OR ("volumeAceito" IS NULL)) AND ((situacao <> ALL (ARRAY['ACEITE_INFORMADO'::text, 'REJEITADA'::text])) OR ("volumeAceito" IS NOT NULL)) AND ((situacao <> 'REJEITADA'::text) OR ("volumeAceito" = (0)::numeric)) AND ((situacao <> 'DESTINACAO_POSTERIOR'::text) OR (COALESCE(length(TRIM(BOTH FROM "destinacaoInformada")), 0) >= 5))))
);


--
-- Name: ConferenciaSaldoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ConferenciaSaldoLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "produtoId" text NOT NULL,
    data date NOT NULL,
    "litrosObservados" numeric(14,3) NOT NULL,
    referencia text NOT NULL,
    responsavel text NOT NULL,
    versao integer NOT NULL,
    "motivoCorrecao" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ConferenciaSaldoLeite_dados" CHECK ((("litrosObservados" >= (0)::numeric) AND (versao > 0) AND (length(btrim(referencia)) >= 3) AND (length(btrim(responsavel)) >= 2) AND ((versao = 1) OR (("motivoCorrecao" IS NOT NULL) AND (length(btrim("motivoCorrecao")) >= 5)))))
);


--
-- Name: ConfiguracaoBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ConfiguracaoBezerreiro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    versao integer NOT NULL,
    "brixReferencia" numeric(5,2) DEFAULT 25 NOT NULL,
    "percentualPesoColostro" numeric(5,2) DEFAULT 10 NOT NULL,
    imunidade jsonb,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ConfiguracaoBezerreiro_referencias" CHECK (((versao > 0) AND ("brixReferencia" > (0)::numeric) AND ("brixReferencia" <= (100)::numeric) AND ("percentualPesoColostro" > (0)::numeric) AND ("percentualPesoColostro" <= (100)::numeric)))
);


--
-- Name: ConfiguracaoNutricao; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ConfiguracaoNutricao" (
    id text NOT NULL,
    escopo text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "loteId" text,
    desde date NOT NULL,
    modelo text NOT NULL,
    "diaConferencia" integer NOT NULL,
    "autorizaValidade" boolean DEFAULT false NOT NULL,
    "usuarioId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "ConfiguracaoNutricao_regras" CHECK (((modelo = ANY (ARRAY['AUTOMATICO'::text, 'MANUAL'::text, 'PROVISORIO'::text])) AND (("diaConferencia" >= 1) AND ("diaConferencia" <= 31)) AND (escopo =
CASE
    WHEN ("loteId" IS NULL) THEN ('sitio:'::text || ("propriedadeId")::text)
    ELSE ('lote:'::text || "loteId")
END)))
);


--
-- Name: ConfiguracaoOrdenha; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ConfiguracaoOrdenha" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "vigenteDesde" date NOT NULL,
    inicial boolean DEFAULT false NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "fonteProducao" text DEFAULT 'INDIVIDUAL'::text NOT NULL,
    "intervaloIndividualQuantidade" integer DEFAULT 1 NOT NULL,
    "intervaloIndividualUnidade" text DEFAULT 'MESES'::text NOT NULL,
    "criterioColostro" jsonb,
    CONSTRAINT "ConfiguracaoOrdenha_colostro" CHECK ((("criterioColostro" IS NULL) OR (((jsonb_typeof("criterioColostro") = 'object'::text) AND (("criterioColostro" = '{"tipo": "PRIMEIRA_ORDENHA"}'::jsonb) OR ((("criterioColostro" ->> 'tipo'::text) = 'JANELA_DIAS'::text) AND (jsonb_typeof(("criterioColostro" -> 'dias'::text)) = 'number'::text) AND (((("criterioColostro" ->> 'dias'::text))::numeric >= (1)::numeric) AND ((("criterioColostro" ->> 'dias'::text))::numeric <= (365)::numeric)) AND (trunc((("criterioColostro" ->> 'dias'::text))::numeric) = (("criterioColostro" ->> 'dias'::text))::numeric) AND (("criterioColostro" -> 'incluiD0'::text) = 'true'::jsonb) AND (("criterioColostro" - ARRAY['tipo'::text, 'dias'::text, 'incluiD0'::text]) = '{}'::jsonb)))) IS TRUE))),
    CONSTRAINT "ConfiguracaoOrdenha_intervalo_individual" CHECK ((("intervaloIndividualQuantidade" >= 1) AND ("intervaloIndividualQuantidade" <= 365) AND ("intervaloIndividualUnidade" = ANY (ARRAY['DIAS'::text, 'MESES'::text])) AND ("fonteProducao" = ANY (ARRAY['GERAL'::text, 'INDIVIDUAL'::text]))))
);


--
-- Name: ConsumoDiario; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ConsumoDiario" (
    id text NOT NULL,
    "mesId" text NOT NULL,
    data date NOT NULL,
    "dietaId" text,
    "dietaNome" text,
    "centroCustoId" text,
    "baseHash" text NOT NULL,
    situacao text DEFAULT 'PREVISTO'::text NOT NULL,
    pendencia text,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "ConsumoDiario_situacao" CHECK ((situacao = ANY (ARRAY['PREVISTO'::text, 'PENDENTE'::text, 'EFETIVADO'::text])))
);


--
-- Name: ControleHistoricoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ControleHistoricoLeite" (
    id text NOT NULL,
    "referenciaHistorica" text NOT NULL,
    tipo text NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    "contextoHistorico" text NOT NULL,
    "propriedadeId" integer,
    "animalId" text,
    "lactacaoId" text,
    "origemColetiva" text,
    total numeric(14,3),
    unidade text NOT NULL,
    "referenciaUnidade" text NOT NULL,
    parcelas jsonb NOT NULL,
    "provenienciaSnapshot" jsonb NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoPorId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "ControleHistoricoLeite_check" CHECK ((fim >= inicio)),
    CONSTRAINT "ControleHistoricoLeite_check1" CHECK (((("contextoHistorico" = 'INTERNO'::text) AND ("propriedadeId" IS NOT NULL)) OR (("contextoHistorico" = 'EXTERNO'::text) AND ("propriedadeId" IS NULL) AND ("lactacaoId" IS NULL)))),
    CONSTRAINT "ControleHistoricoLeite_check2" CHECK ((((tipo = 'CONTROLE_PERIODICO'::text) AND ("animalId" IS NOT NULL) AND (inicio = fim)) OR ((tipo = 'AGREGADO_MENSAL'::text) AND ("animalId" IS NULL) AND ("lactacaoId" IS NULL) AND ("origemColetiva" IS NOT NULL) AND (length(btrim("origemColetiva")) >= 3) AND (inicio = (date_trunc('month'::text, (inicio)::timestamp with time zone))::date) AND (fim = ((date_trunc('month'::text, (inicio)::timestamp with time zone) + '1 mon -1 days'::interval))::date)))),
    CONSTRAINT "ControleHistoricoLeite_contextoHistorico_check" CHECK (("contextoHistorico" = ANY (ARRAY['INTERNO'::text, 'EXTERNO'::text]))),
    CONSTRAINT "ControleHistoricoLeite_parcelas_check" CHECK ((jsonb_typeof(parcelas) = 'array'::text)),
    CONSTRAINT "ControleHistoricoLeite_provenienciaSnapshot_check" CHECK ((jsonb_typeof("provenienciaSnapshot") = 'object'::text)),
    CONSTRAINT "ControleHistoricoLeite_referenciaUnidade_check" CHECK ((length(btrim("referenciaUnidade")) >= 5)),
    CONSTRAINT "ControleHistoricoLeite_tipo_check" CHECK ((tipo = ANY (ARRAY['CONTROLE_PERIODICO'::text, 'AGREGADO_MENSAL'::text]))),
    CONSTRAINT "ControleHistoricoLeite_total_check" CHECK (((total IS NULL) OR (total >= (0)::numeric))),
    CONSTRAINT "ControleHistoricoLeite_unidade_check" CHECK ((unidade = ANY (ARRAY['L'::text, 'KG'::text]))),
    CONSTRAINT "ControleHistoricoLeite_versao_check" CHECK ((versao > 0))
);


--
-- Name: CriaParto; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."CriaParto" (
    id text NOT NULL,
    "partoId" text NOT NULL,
    "animalId" text,
    viva boolean NOT NULL,
    sexo pecuaria."SexoBovino" NOT NULL,
    aptidao pecuaria."AptidaoAnimal",
    ordem integer NOT NULL,
    "filiacaoSnapshot" jsonb NOT NULL,
    CONSTRAINT "CriaParto_viva_animal" CHECK (((NOT viva) OR ("animalId" IS NOT NULL)))
);


--
-- Name: DecisaoElegibilidadeCiclo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DecisaoElegibilidadeCiclo" (
    id text NOT NULL,
    "vinculoCicloId" text NOT NULL,
    data date NOT NULL,
    tipo text NOT NULL,
    "aptaDesde" date,
    motivo text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "anuladoEm" timestamp(3) without time zone,
    "motivoAnulacao" text,
    "exameAptidaoId" text,
    "exameAptidaoSnapshot" jsonb,
    CONSTRAINT "DecisaoElegibilidade_anulacao" CHECK ((((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NULL) AND ("motivoAnulacao" IS NULL)) OR ((status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NOT NULL) AND (length(btrim("motivoAnulacao")) >= 5) AND ("motivoAnulacao" IS NOT NULL)))),
    CONSTRAINT "DecisaoElegibilidade_aptaDesde" CHECK ((((tipo = 'LIBERAR'::text) AND ("aptaDesde" IS NOT NULL)) OR ((tipo <> 'LIBERAR'::text) AND ("aptaDesde" IS NULL)))),
    CONSTRAINT "DecisaoElegibilidade_data_liberacao" CHECK (((tipo <> 'LIBERAR'::text) OR ("aptaDesde" >= data))),
    CONSTRAINT "DecisaoElegibilidade_motivo" CHECK ((length(btrim(motivo)) >= 5)),
    CONSTRAINT "DecisaoElegibilidade_tipo" CHECK ((tipo = ANY (ARRAY['LIBERAR'::text, 'BLOQUEAR'::text, 'RETOMAR_POLITICA'::text])))
);


--
-- Name: DecisaoOperacionalAcompanhamento; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DecisaoOperacionalAcompanhamento" (
    id text NOT NULL,
    "versaoAnterior" integer NOT NULL,
    "demandaId" text NOT NULL,
    "necessidadeId" text NOT NULL,
    chave text NOT NULL,
    tipo text NOT NULL,
    data date,
    destino text,
    motivo text NOT NULL,
    "usuarioId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "DecisaoOperacionalAcompanhamento_check" CHECK ((((tipo = 'DISPENSAR'::text) AND (data IS NULL) AND (destino IS NULL)) OR ((tipo = ANY (ARRAY['REAGENDAR'::text, 'SUSPENDER'::text])) AND (data IS NOT NULL) AND (destino IS NOT NULL) AND ((length(btrim(destino)) >= 2) AND (length(btrim(destino)) <= 500))))),
    CONSTRAINT "DecisaoOperacionalAcompanhamento_motivo_check" CHECK (((length(btrim(motivo)) >= 5) AND (length(btrim(motivo)) <= 1000))),
    CONSTRAINT "DecisaoOperacionalAcompanhamento_tipo_check" CHECK ((tipo = ANY (ARRAY['REAGENDAR'::text, 'SUSPENDER'::text, 'DISPENSAR'::text]))),
    CONSTRAINT "DecisaoOperacionalAcompanhamento_versaoAnterior_check" CHECK (("versaoAnterior" > 0))
);


--
-- Name: DemandaAcompanhamentoReprodutivo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DemandaAcompanhamentoReprodutivo" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeOrigemId" integer NOT NULL,
    finalidade text NOT NULL,
    "tentativaId" text,
    "gestacaoId" text,
    ocorrencia integer DEFAULT 1 NOT NULL,
    "politicaId" text,
    "dataReferencia" date NOT NULL,
    "previstaPara" date,
    "regraSnapshot" jsonb NOT NULL,
    "origemAdocao" text DEFAULT 'FATO_NOVO'::text NOT NULL,
    estado text DEFAULT 'PENDENTE'::text NOT NULL,
    "tarefaId" text,
    "exameOrigemId" text,
    "exameResolucaoId" text,
    "resolucaoSnapshot" jsonb,
    "resolvidaEm" date,
    "encerradaEm" timestamp(3) without time zone,
    "motivoEncerramento" text,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "participacaoAcompanhamentoId" text,
    "vinculoConclusaoResolucaoId" text,
    "decisaoOperacionalId" text,
    CONSTRAINT "DemandaAcompanhamento_contexto_prazo" CHECK (((("origemAdocao" = 'PROTOCOLO'::text) AND ("politicaId" IS NULL) AND ("tarefaId" IS NOT NULL) AND ("exameOrigemId" IS NOT NULL) AND ("participacaoAcompanhamentoId" IS NULL)) OR (("origemAdocao" = ANY (ARRAY['MODELO'::text, 'INDIVIDUAL'::text])) AND ("politicaId" IS NULL) AND ("participacaoAcompanhamentoId" IS NOT NULL) AND ("previstaPara" IS NOT NULL)) OR (("origemAdocao" = 'SEM_REGRA'::text) AND ("politicaId" IS NULL) AND ("participacaoAcompanhamentoId" IS NOT NULL) AND ("previstaPara" IS NULL)) OR (("origemAdocao" <> ALL (ARRAY['PROTOCOLO'::text, 'MODELO'::text, 'INDIVIDUAL'::text, 'SEM_REGRA'::text])) AND ("politicaId" IS NOT NULL) AND ("previstaPara" IS NOT NULL) AND (("participacaoAcompanhamentoId" IS NULL) OR ("origemAdocao" = 'ADOCAO_EXPLICITA'::text))))),
    CONSTRAINT "DemandaAcompanhamento_encerramento" CHECK (((estado <> 'ENCERRADA'::text) OR (("encerradaEm" IS NOT NULL) AND ("motivoEncerramento" IS NOT NULL) AND (length(TRIM(BOTH FROM "motivoEncerramento")) >= 5)))),
    CONSTRAINT "DemandaAcompanhamento_estado" CHECK ((estado = ANY (ARRAY['PENDENTE'::text, 'RESOLVIDA'::text, 'ENCERRADA'::text]))),
    CONSTRAINT "DemandaAcompanhamento_origem" CHECK (((("origemAdocao" = 'PROTOCOLO'::text) AND (finalidade = ANY (ARRAY['DIAGNOSTICO'::text, 'RECONFIRMACAO'::text, 'SEXAGEM'::text])) AND (ocorrencia > 0)) OR ((finalidade = 'DIAGNOSTICO'::text) AND ("tentativaId" IS NOT NULL) AND ("gestacaoId" IS NULL) AND (ocorrencia = 1)) OR ((finalidade = 'RECONFIRMACAO'::text) AND ("gestacaoId" IS NOT NULL) AND ("tentativaId" IS NULL) AND (ocorrencia > 0)))),
    CONSTRAINT "DemandaAcompanhamento_previsao" CHECK ((("previstaPara" >= "dataReferencia") AND (versao > 0))),
    CONSTRAINT "DemandaAcompanhamento_regra" CHECK (((jsonb_typeof("regraSnapshot") = 'object'::text) AND (NOT (("regraSnapshot" ->> 'efeito'::text) IS DISTINCT FROM 'ALERTA'::text)))),
    CONSTRAINT "DemandaAcompanhamento_resolucao" CHECK ((((estado <> 'RESOLVIDA'::text) AND ("vinculoConclusaoResolucaoId" IS NULL)) OR ((estado = 'RESOLVIDA'::text) AND ("resolvidaEm" IS NOT NULL) AND ("resolucaoSnapshot" IS NOT NULL) AND (("exameResolucaoId" IS NOT NULL) <> ("vinculoConclusaoResolucaoId" IS NOT NULL)))))
);


--
-- Name: DemonstrativoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DemonstrativoLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "parceiroId" text NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    referencia text NOT NULL,
    "precoBase" numeric(14,4) NOT NULL,
    "volumeReconhecido" numeric(12,3) NOT NULL,
    "valorComercial" numeric(14,2) NOT NULL,
    "valorPagamentoInformado" numeric(14,2),
    componentes jsonb NOT NULL,
    status text DEFAULT 'VALIDO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "DemonstrativoLeite_contrato" CHECK (((inicio <= fim) AND ("precoBase" >= (0)::numeric) AND ("volumeReconhecido" > (0)::numeric) AND ("valorComercial" > (0)::numeric) AND (("valorPagamentoInformado" IS NULL) OR ("valorPagamentoInformado" >= (0)::numeric)) AND (status = ANY (ARRAY['VALIDO'::text, 'ANULADO'::text])) AND (jsonb_typeof(componentes) = 'array'::text) AND (((status = 'VALIDO'::text) AND (versao = 1) AND ("anuladoEm" IS NULL) AND ("motivoAnulacao" IS NULL)) OR ((status = 'ANULADO'::text) AND (versao = 2) AND ("anuladoEm" IS NOT NULL) AND (length(TRIM(BOTH FROM "motivoAnulacao")) >= 5)))))
);


--
-- Name: DescarteLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DescarteLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "entradaId" text NOT NULL,
    "movimentoId" text NOT NULL,
    data date NOT NULL,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    "saldoOrigemAntes" numeric(14,3) NOT NULL,
    "saldoOrigemDepois" numeric(14,3) NOT NULL,
    motivo text NOT NULL,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "motivoEstorno" text,
    "movimentoEstornoId" text,
    CONSTRAINT "DescarteLeite_quantidades" CHECK ((("quantidadeLitros" > (0)::numeric) AND ("saldoOrigemAntes" >= "quantidadeLitros") AND ("saldoOrigemDepois" = ("saldoOrigemAntes" - "quantidadeLitros")) AND (length(btrim(motivo)) >= 5)))
);


--
-- Name: DestinacaoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DestinacaoColostro" (
    id text NOT NULL,
    "origemId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    data date NOT NULL,
    "ocorridoEm" timestamp(3) with time zone,
    "horarioEstimado" boolean DEFAULT false NOT NULL,
    responsavel text,
    observacao text,
    snapshot jsonb,
    versao integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    chave text NOT NULL,
    hash text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "motivoEstorno" text,
    CONSTRAINT "DestinacaoColostro_estado" CHECK (((versao > 0) AND (status = ANY (ARRAY['CONFIRMADO'::text, 'ESTORNADO'::text])) AND ((NOT "horarioEstimado") OR ("ocorridoEm" IS NOT NULL)) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data))))
);


--
-- Name: FinalidadeAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FinalidadeAnimal" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    aptidao pecuaria."AptidaoAnimal" NOT NULL,
    desde date NOT NULL,
    ate date,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: DestinoAnimal; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."DestinoAnimal" AS
 SELECT "FinalidadeAnimal".id,
    "FinalidadeAnimal"."animalId",
    "FinalidadeAnimal".aptidao,
    "FinalidadeAnimal".desde,
    "FinalidadeAnimal".ate,
    "FinalidadeAnimal"."criadoEm",
    "FinalidadeAnimal"."criadoPorId",
    "FinalidadeAnimal"."atualizadoEm"
   FROM pecuaria."FinalidadeAnimal";


--
-- Name: DestinoInternoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DestinoInternoLeite" (
    id text NOT NULL,
    chave text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "entradaId" text NOT NULL,
    "movimentoId" text NOT NULL,
    data date NOT NULL,
    natureza text NOT NULL,
    "declaracaoOrigem" text NOT NULL,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    "saldoOrigemAntes" numeric(14,3) NOT NULL,
    "saldoOrigemDepois" numeric(14,3) NOT NULL,
    responsavel text,
    observacao text,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "motivoEstorno" text,
    "movimentoEstornoId" text,
    CONSTRAINT "DestinoInternoLeite_campos_check" CHECK (((natureza = ANY (ARRAY['COLOSTRO'::text, 'LEITE_COMUM'::text, 'LEITE_NAO_COMERCIAL'::text])) AND (length(btrim("declaracaoOrigem")) >= 10) AND (versao > 0) AND ("quantidadeLitros" > (0)::numeric) AND ("saldoOrigemAntes" >= "quantidadeLitros") AND ("saldoOrigemDepois" = ("saldoOrigemAntes" - "quantidadeLitros")) AND (((status = 'CONFIRMADO'::text) AND ("estornadoEm" IS NULL) AND ("movimentoEstornoId" IS NULL) AND ("motivoEstorno" IS NULL)) OR ((status = 'ESTORNADO'::text) AND ("estornadoEm" IS NOT NULL) AND ("movimentoEstornoId" IS NOT NULL) AND ("motivoEstorno" IS NOT NULL) AND (length(btrim("motivoEstorno")) >= 5)))))
);


--
-- Name: DetalheFechamentoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DetalheFechamentoLeite" (
    id text NOT NULL,
    "fechamentoId" text NOT NULL,
    "retiradaId" text NOT NULL,
    "quantidadeReconhecida" numeric(12,3) NOT NULL,
    "motivoDiferenca" text,
    CONSTRAINT "DetalheFechamentoLeite_quantidadeReconhecida_check" CHECK (("quantidadeReconhecida" >= (0)::numeric))
);


--
-- Name: DiaProducaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."DiaProducaoLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "dataOperacional" date NOT NULL,
    "configuracaoId" text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "DiaProducaoLeite_versao_check" CHECK ((versao > 0))
);


--
-- Name: Dieta; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Dieta" (
    id text NOT NULL,
    nome text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "publicadaEm" timestamp(3) without time zone,
    ativo boolean DEFAULT true NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: Doenca; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Doenca" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "motivoBaixaSugeridoId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmissaoRelatorioLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EmissaoRelatorioLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    "corteEm" timestamp(3) without time zone NOT NULL,
    "versaoCalculo" text NOT NULL,
    filtros jsonb NOT NULL,
    snapshot jsonb NOT NULL,
    "valoresIncluidos" boolean NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "EmissaoLeite_periodo" CHECK (((inicio <= fim) AND ((fim - inicio) < 366) AND (length("versaoCalculo") > 0) AND (jsonb_typeof(snapshot) = 'object'::text)))
);


--
-- Name: EntradaProducaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EntradaProducaoLeite" (
    id text NOT NULL,
    "sessaoId" text NOT NULL,
    "versaoSessao" integer NOT NULL,
    "movimentoId" text NOT NULL,
    status text DEFAULT 'CONFIRMADA'::text NOT NULL,
    chave text NOT NULL,
    hash text NOT NULL,
    snapshot jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "medicaoGeralId" text,
    CONSTRAINT "EntradaLeite_estado" CHECK (((status = ANY (ARRAY['CONFIRMADA'::text, 'ANULADA'::text])) AND ("versaoSessao" > 0) AND (length(hash) = 64)))
);


--
-- Name: EntregaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EntregaLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "parceiroId" text NOT NULL,
    "retiradaId" text NOT NULL,
    "pontoColeta" text,
    "horarioColeta" text,
    referencia text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "EntregaLeite_horario" CHECK ((("horarioColeta" IS NULL) OR ("horarioColeta" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)))
);


--
-- Name: EnvioAplicacoesTablet; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EnvioAplicacoesTablet" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "autorId" integer NOT NULL,
    "autorNome" text NOT NULL,
    data date NOT NULL,
    "aplicadaEm" timestamp(3) without time zone NOT NULL,
    "animalIds" text[] NOT NULL,
    itens jsonb NOT NULL,
    "enviadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revisadoEm" timestamp(3) without time zone,
    "revisorId" integer,
    "revisorNome" text,
    devolucao text,
    "aplicacaoIds" text[] DEFAULT ARRAY[]::text[] NOT NULL,
    "corrigeId" text,
    CONSTRAINT "EnvioAplicacoesTablet_animalIds_check" CHECK ((cardinality("animalIds") > 0)),
    CONSTRAINT "EnvioAplicacoesTablet_check" CHECK (((("revisadoEm" IS NULL) AND ("revisorId" IS NULL) AND ("revisorNome" IS NULL) AND (devolucao IS NULL) AND (cardinality("aplicacaoIds") = 0)) OR (("revisadoEm" IS NOT NULL) AND ("revisorId" IS NOT NULL) AND ("revisorNome" IS NOT NULL) AND ((devolucao IS NULL) = (cardinality("aplicacaoIds") > 0)))))
);


--
-- Name: EtapaProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EtapaProtocolo" (
    id text NOT NULL,
    "protocoloId" text NOT NULL,
    ordem integer NOT NULL,
    intervalo double precision NOT NULL,
    tipo text NOT NULL,
    "produtoId" text,
    "tipoExameId" text,
    finalidade pecuaria."FinalidadeAplicacao",
    dose numeric(12,3),
    unidade text,
    via text,
    "tipoAplicacaoId" text,
    "tipoAplicacaoNomeSnapshot" text,
    nome text DEFAULT 'Etapa'::text NOT NULL,
    "unidadeIntervalo" text DEFAULT 'DIAS'::text NOT NULL,
    configuracao jsonb DEFAULT '{}'::jsonb NOT NULL,
    "materialId" text,
    "momentoId" text,
    CONSTRAINT "EtapaProtocolo_intervalo_check" CHECK (((intervalo >= (0)::double precision) AND ("unidadeIntervalo" = ANY (ARRAY['DIAS'::text, 'HORAS'::text])))),
    CONSTRAINT "EtapaProtocolo_tipo_check" CHECK ((tipo = ANY (ARRAY['APLICACAO'::text, 'EXAME'::text, 'TENTATIVA'::text, 'MANEJO'::text, 'RETIRADA'::text])))
);


--
-- Name: EventoLeilaoExterno; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EventoLeilaoExterno" (
    fonte text NOT NULL,
    "idExterno" text NOT NULL,
    titulo text NOT NULL,
    url text NOT NULL,
    "vistoNaAgendaEm" timestamp with time zone NOT NULL,
    catalogo jsonb,
    "catalogoTentadoEm" timestamp with time zone,
    "catalogoConsultadoEm" timestamp with time zone
);


--
-- Name: EventoTarefaProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."EventoTarefaProtocolo" (
    id text NOT NULL,
    "tarefaId" text NOT NULL,
    tipo pecuaria."TipoEventoTarefaProtocolo" NOT NULL,
    "ocorridaEm" timestamp(3) without time zone NOT NULL,
    motivo text NOT NULL,
    "previsaoAnterior" timestamp(3) without time zone,
    "previsaoNova" timestamp(3) without time zone,
    "precisaoAnterior" pecuaria."PrecisaoCalendarioProtocolo",
    "precisaoNova" pecuaria."PrecisaoCalendarioProtocolo",
    "eventoCorrigidoId" text,
    "registradoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "registradoPorId" integer,
    CONSTRAINT "EventoTarefaProtocolo_formato_check" CHECK (((((tipo)::text = 'ADIAMENTO'::text) AND ("previsaoAnterior" IS NOT NULL) AND ("previsaoNova" IS NOT NULL) AND ("precisaoAnterior" IS NOT NULL) AND ("precisaoNova" IS NOT NULL) AND ("eventoCorrigidoId" IS NULL)) OR (((tipo)::text = ANY (ARRAY['NAO_ATENDIDO'::text, 'DISPENSA'::text])) AND ("previsaoAnterior" IS NULL) AND ("previsaoNova" IS NULL) AND ("precisaoAnterior" IS NULL) AND ("precisaoNova" IS NULL) AND ("eventoCorrigidoId" IS NULL)) OR (((tipo)::text = 'RETIFICACAO_JUSTIFICATIVA'::text) AND ("previsaoAnterior" IS NULL) AND ("previsaoNova" IS NULL) AND ("precisaoAnterior" IS NULL) AND ("precisaoNova" IS NULL) AND ("eventoCorrigidoId" IS NOT NULL)))),
    CONSTRAINT "EventoTarefaProtocolo_motivo_check" CHECK (((length(btrim(motivo)) >= 5) AND (length(btrim(motivo)) <= 1000)))
);


--
-- Name: ExameImunidadeColostragem; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ExameImunidadeColostragem" (
    id text NOT NULL,
    "acompanhamentoId" text NOT NULL,
    "exameId" text NOT NULL,
    "ocorridoEm" timestamp(3) with time zone,
    metodo text,
    material text,
    instrumento text,
    laboratorio text,
    "politicaSnapshot" jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: ExposicaoTouro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ExposicaoTouro" (
    id text NOT NULL,
    "referenciaExterna" text,
    "propriedadeId" integer NOT NULL,
    "loteId" text NOT NULL,
    "touroId" text,
    "touroExternoId" text,
    inicio date NOT NULL,
    fim date,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ExposicaoTouro_intervalo" CHECK (((fim IS NULL) OR (fim >= inicio))),
    CONSTRAINT "Exposicao_touro" CHECK ((("touroId" IS NULL) <> ("touroExternoId" IS NULL)))
);


--
-- Name: FaseBezerreiroVersao; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FaseBezerreiroVersao" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "identidadeId" text NOT NULL,
    versao integer NOT NULL,
    nome text NOT NULL,
    "coleiraSnapshot" jsonb,
    "coleiraId" text,
    "litrosDia" numeric(12,3) NOT NULL,
    publicada boolean DEFAULT false NOT NULL,
    "criteriosTransicao" jsonb,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "FaseBezerreiroVersao_dose" CHECK (((versao > 0) AND ("litrosDia" >= (0)::numeric)))
);


--
-- Name: FechamentoConsumo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FechamentoConsumo" (
    id text NOT NULL,
    "loteId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "vigenciaId" text NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    "centroCustoId" text NOT NULL,
    "animalDias" integer NOT NULL,
    "confirmadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status pecuaria."StatusFechamentoConsumo" DEFAULT 'CONFIRMADO'::pecuaria."StatusFechamentoConsumo" NOT NULL,
    "motivoEstorno" text,
    "estornadoEm" timestamp(3) without time zone,
    CONSTRAINT "FechamentoConsumo_periodo_check" CHECK (((fim >= inicio) AND ("animalDias" > 0)))
);


--
-- Name: FechamentoOperacaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FechamentoOperacaoLeite" (
    id text NOT NULL,
    "comercialId" text NOT NULL,
    "operacaoId" text NOT NULL,
    versao integer NOT NULL,
    "precoUnitario" numeric(14,4) NOT NULL,
    "volumeReconhecido" numeric(12,3) NOT NULL,
    ajuste numeric(14,2) DEFAULT 0 NOT NULL,
    "motivoAjuste" text,
    motivo text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "FechamentoOperacaoLeite_documentado" CHECK (((versao > 0) AND ("precoUnitario" > (0)::numeric) AND ("volumeReconhecido" > (0)::numeric) AND (length(TRIM(BOTH FROM motivo)) >= 5) AND ((ajuste = (0)::numeric) OR (COALESCE(length(TRIM(BOTH FROM "motivoAjuste")), 0) >= 5))))
);


--
-- Name: FormatoQualidadeLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FormatoQualidadeLeite" (
    chave text NOT NULL,
    "hashPayload" text NOT NULL,
    "tipoExameId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: FornecimentoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FornecimentoColostro" (
    id text NOT NULL,
    "criaId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    data date NOT NULL,
    "ocorridoEm" timestamp(3) with time zone,
    "horarioEstimado" boolean DEFAULT false NOT NULL,
    "quantidadeLitros" numeric(10,3),
    "unidadeInformada" text,
    "metodoQualidade" text,
    "qualidadeBrix" numeric(5,2),
    "qualidadeClassificacao" text,
    tipo text,
    forma text,
    responsavel text,
    observacao text,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "anuladoEm" timestamp(3) without time zone,
    "motivoAnulacao" text,
    CONSTRAINT "FornecimentoColostro_anulacao" CHECK ((((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NULL) AND ("motivoAnulacao" IS NULL)) OR ((status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NOT NULL) AND ("motivoAnulacao" IS NOT NULL) AND (length(btrim("motivoAnulacao")) > 0)))),
    CONSTRAINT "FornecimentoColostro_brix" CHECK ((("qualidadeBrix" IS NULL) OR (("qualidadeBrix" >= (0)::numeric) AND ("qualidadeBrix" <= (100)::numeric)))),
    CONSTRAINT "FornecimentoColostro_classificacao" CHECK ((("qualidadeClassificacao" IS NULL) OR ("qualidadeClassificacao" = ANY (ARRAY['ALTA'::text, 'MEDIA'::text, 'BAIXA'::text])))),
    CONSTRAINT "FornecimentoColostro_forma" CHECK (((forma IS NULL) OR (forma = ANY (ARRAY['BALDE'::text, 'BALDE_COM_BICO'::text, 'MAE'::text, 'MAMADEIRA'::text, 'SONDA'::text])))),
    CONSTRAINT "FornecimentoColostro_horario" CHECK ((((NOT "horarioEstimado") OR ("ocorridoEm" IS NOT NULL)) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data)))),
    CONSTRAINT "FornecimentoColostro_metodo" CHECK ((("metodoQualidade" IS NULL) OR ("metodoQualidade" = ANY (ARRAY['REFRATOMETRO_BRIX'::text, 'COLOSTROMETRO'::text])))),
    CONSTRAINT "FornecimentoColostro_qualidade_coerente" CHECK (((("qualidadeBrix" IS NULL) OR (NOT ("metodoQualidade" IS DISTINCT FROM 'REFRATOMETRO_BRIX'::text))) AND (("qualidadeClassificacao" IS NULL) OR (NOT ("metodoQualidade" IS DISTINCT FROM 'COLOSTROMETRO'::text))))),
    CONSTRAINT "FornecimentoColostro_quantidade" CHECK ((("quantidadeLitros" IS NULL) OR (("quantidadeLitros" > (0)::numeric) AND ("quantidadeLitros" <> 'NaN'::numeric)))),
    CONSTRAINT "FornecimentoColostro_tipo" CHECK (((tipo IS NULL) OR (tipo = ANY (ARRAY['FRESCO'::text, 'DESCONGELADO'::text, 'PO'::text])))),
    CONSTRAINT "FornecimentoColostro_unidade" CHECK ((("unidadeInformada" IS NULL) OR ("unidadeInformada" = ANY (ARRAY['L'::text, 'ML'::text])))),
    CONSTRAINT "FornecimentoColostro_versao" CHECK ((versao > 0))
);


--
-- Name: FornecimentoNutricionalLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."FornecimentoNutricionalLeite" (
    id text NOT NULL,
    "itemId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    data date NOT NULL,
    "quantidadeLitros" numeric(12,3) NOT NULL,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "FornecimentoNutricionalLeite_quantidadeLitros_check" CHECK (("quantidadeLitros" > (0)::numeric)),
    CONSTRAINT "FornecimentoNutricionalLeite_status_check" CHECK ((status = ANY (ARRAY['CONFIRMADO'::text, 'ESTORNADO'::text])))
);


--
-- Name: GenitorExterno; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."GenitorExterno" (
    id text NOT NULL,
    "ideagriId" integer,
    sexo pecuaria."SexoBovino" NOT NULL,
    nome text NOT NULL,
    codigo text,
    fornecedor text,
    ativo boolean DEFAULT true NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "fornecedorId" text
);


--
-- Name: GestacaoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."GestacaoAnimal" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    "tentativaId" text,
    inicio date,
    "confirmadaEm" date NOT NULL,
    "previsaoParto" date,
    "sexoFetal" pecuaria."SexoBovino",
    "encerradaEm" date,
    "motivoEncerramento" text,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "tipoEncerramento" text,
    "causaClinica" jsonb,
    CONSTRAINT "GestacaoAnimal_intervalo" CHECK ((("encerradaEm" IS NULL) OR ("encerradaEm" >= "confirmadaEm"))),
    CONSTRAINT "Gestacao_desfecho_tipado" CHECK (((("encerradaEm" IS NULL) AND ("tipoEncerramento" IS NULL)) OR (("encerradaEm" IS NOT NULL) AND ("tipoEncerramento" IS NOT NULL) AND ("tipoEncerramento" = ANY (ARRAY['PERDA'::text, 'PARTO'::text, 'NAO_IDENTIFICADO'::text])))))
);


--
-- Name: GrupoOfertaBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."GrupoOfertaBezerreiro" (
    id text NOT NULL,
    "ofertaId" text NOT NULL,
    "coleiraId" text,
    "quantidadePrevistaLitros" numeric(12,3) NOT NULL,
    "quantidadeLitros" numeric(12,3) NOT NULL,
    "programacaoSnapshot" jsonb NOT NULL,
    "participantesSnapshot" jsonb NOT NULL,
    justificativa text,
    CONSTRAINT "GrupoOfertaBezerreiro_volumes" CHECK ((("quantidadePrevistaLitros" >= (0)::numeric) AND ("quantidadeLitros" >= (0)::numeric) AND (jsonb_typeof("participantesSnapshot") = 'array'::text) AND (jsonb_typeof("programacaoSnapshot") = ANY (ARRAY['array'::text, 'object'::text]))))
);


--
-- Name: HistoricoPrevisaoParto; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."HistoricoPrevisaoParto" (
    id text NOT NULL,
    "gestacaoId" text NOT NULL,
    "previsaoAnterior" date,
    "previsaoNova" date,
    motivo text NOT NULL,
    origem text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: ImpressaoVisita; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ImpressaoVisita" (
    id text NOT NULL,
    "visitaId" text NOT NULL,
    versao integer NOT NULL,
    snapshot jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: InsumoPreparoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."InsumoPreparoColostro" (
    id text NOT NULL,
    "preparoId" text NOT NULL,
    "produtoId" text NOT NULL,
    "partidaId" text,
    "movimentoId" text NOT NULL,
    quantidade numeric(14,6) NOT NULL,
    unidade text NOT NULL,
    CONSTRAINT "InsumoPreparoColostro_quantidade" CHECK (((quantidade > (0)::numeric) AND (length(btrim(unidade)) > 0)))
);


--
-- Name: ItemConsumoDiario; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ItemConsumoDiario" (
    id text NOT NULL,
    "diaId" text NOT NULL,
    "produtoId" text NOT NULL,
    nome text NOT NULL,
    unidade text NOT NULL,
    prevista numeric(12,3) NOT NULL,
    confirmada numeric(12,3) DEFAULT 0 NOT NULL,
    "custoLiquido" numeric(14,2) DEFAULT 0 NOT NULL,
    "origemQuantidade" text DEFAULT 'CALCULADA'::text NOT NULL,
    CONSTRAINT "ItemConsumoDiario_quantidades" CHECK (((prevista >= (0)::numeric) AND (confirmada >= (0)::numeric) AND ("custoLiquido" >= (0)::numeric)))
);


--
-- Name: ItemDieta; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ItemDieta" (
    id text NOT NULL,
    "dietaId" text NOT NULL,
    "produtoId" text NOT NULL,
    "quantidadeCabecaDia" numeric(12,3) NOT NULL,
    unidade text NOT NULL,
    "materiaSecaPercentualSnapshot" numeric(5,2),
    CONSTRAINT "ItemDieta_quantidade_check" CHECK (("quantidadeCabecaDia" > (0)::numeric))
);


--
-- Name: ItemFechamentoConsumo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ItemFechamentoConsumo" (
    id text NOT NULL,
    "fechamentoId" text,
    "produtoId" text NOT NULL,
    "quantidadePrevista" numeric(12,3) NOT NULL,
    "quantidadeConfirmada" numeric(12,3) NOT NULL,
    "baseQuantidade" text NOT NULL,
    "motivoAjuste" text,
    unidade text NOT NULL,
    "movimentoEstoqueId" text,
    "modoEstoque" text NOT NULL,
    "justificativaSemBaixa" text,
    "situacaoCusto" text NOT NULL,
    "grupoOfertaId" text,
    CONSTRAINT "ItemFechamentoConsumo_origem_xor" CHECK ((((("fechamentoId" IS NOT NULL))::integer + (("grupoOfertaId" IS NOT NULL))::integer) = 1))
);


--
-- Name: LactacaoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."LactacaoAnimal" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    "partoId" text,
    inicio date NOT NULL,
    "encerradaEm" date,
    "motivoEncerramento" text,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    versao integer DEFAULT 1 NOT NULL,
    CONSTRAINT "LactacaoAnimal_intervalo" CHECK ((("encerradaEm" IS NULL) OR ("encerradaEm" >= inicio))),
    CONSTRAINT "LactacaoAnimal_versao" CHECK ((versao > 0))
);


--
-- Name: LaudoQualidadeLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."LaudoQualidadeLeite" (
    id text NOT NULL,
    "amostraId" text NOT NULL,
    nome text NOT NULL,
    "mimeType" text NOT NULL,
    "tamanhoBytes" integer NOT NULL,
    sha256 character varying(64) NOT NULL,
    "storageDriver" text DEFAULT 'r2'::text NOT NULL,
    bucket text NOT NULL,
    "storageKey" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "LaudoQualidadeLeite_storage_check" CHECK ((("storageDriver" = 'r2'::text) AND ("tamanhoBytes" > 0) AND ("tamanhoBytes" <= 10485760) AND ((sha256)::text ~ '^[a-f0-9]{64}$'::text)))
);


--
-- Name: LocalizacaoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."LocalizacaoAnimal" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "loteId" text,
    desde date NOT NULL,
    ate date,
    "movimentacaoId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: Lote; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Lote" (
    id text NOT NULL,
    "ideagriId" integer,
    nome text NOT NULL,
    "propriedadeId" integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "centroCustoId" text
);


--
-- Name: LoteColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."LoteColostro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "partoId" text NOT NULL,
    "matrizId" text NOT NULL,
    "medicaoGeralId" text,
    "entradaId" text,
    data date NOT NULL,
    "ocorridoEm" timestamp(3) with time zone,
    "horarioEstimado" boolean DEFAULT false NOT NULL,
    "primeiraRetirada" boolean NOT NULL,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    "origemFisicaSnapshot" jsonb NOT NULL,
    status text DEFAULT 'RASCUNHO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    chave text NOT NULL,
    hash text NOT NULL,
    responsavel text,
    observacao text,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "motivoEstorno" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "LoteColostro_estado" CHECK (((versao > 0) AND ("quantidadeLitros" > (0)::numeric) AND (status = ANY (ARRAY['RASCUNHO'::text, 'CONFIRMADO'::text, 'ESTORNADO'::text])) AND ((status <> 'CONFIRMADO'::text) OR ("entradaId" IS NOT NULL)) AND ((NOT "horarioEstimado") OR ("ocorridoEm" IS NOT NULL)) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data))))
);


--
-- Name: ManejoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ManejoAnimal" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    tipo text NOT NULL,
    data date NOT NULL,
    "pesagemId" text,
    responsavel text,
    observacao text,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tarefaId" text,
    "realizadaEm" timestamp(3) without time zone,
    "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" DEFAULT 'DIA'::pecuaria."PrecisaoCalendarioProtocolo" NOT NULL,
    "criadoPorId" integer,
    "insercaoAplicacaoId" text,
    "operacaoServicoId" text,
    "valorServicoAtribuido" numeric(14,2),
    "realizacaoMantida" boolean DEFAULT false NOT NULL,
    CONSTRAINT "ManejoAnimal_protocolo_check" CHECK ((((tipo = ANY (ARRAY['DESMAMA'::text, 'CASTRACAO'::text])) AND ("tarefaId" IS NULL) AND ("insercaoAplicacaoId" IS NULL)) OR ((tipo = ANY (ARRAY['PROTOCOLAR'::text, 'RETIRADA_DISPOSITIVO'::text])) AND ("propriedadeId" IS NOT NULL) AND ((("precisaoTemporal" = 'DIA'::pecuaria."PrecisaoCalendarioProtocolo") AND ("realizadaEm" IS NULL)) OR (("precisaoTemporal" = 'HORA'::pecuaria."PrecisaoCalendarioProtocolo") AND ("realizadaEm" IS NOT NULL))) AND (((tipo = 'RETIRADA_DISPOSITIVO'::text) AND ("insercaoAplicacaoId" IS NOT NULL) AND (("tarefaId" IS NOT NULL) OR ("criadoPorId" IS NOT NULL))) OR ((tipo = 'PROTOCOLAR'::text) AND ("tarefaId" IS NOT NULL) AND ("insercaoAplicacaoId" IS NULL)))))),
    CONSTRAINT "ManejoAnimal_realizacao_mantida_check" CHECK (((NOT "realizacaoMantida") OR (status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3"))),
    CONSTRAINT "ManejoAnimal_servico_valor_check" CHECK ((("valorServicoAtribuido" IS NULL) OR (("valorServicoAtribuido" >= (0)::numeric) AND ("operacaoServicoId" IS NOT NULL)))),
    CONSTRAINT "ManejoAnimal_tipo_check" CHECK ((tipo = ANY (ARRAY['DESMAMA'::text, 'CASTRACAO'::text, 'PROTOCOLAR'::text, 'RETIRADA_DISPOSITIVO'::text])))
);


--
-- Name: MaterialGenetico; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MaterialGenetico" (
    id text NOT NULL,
    tipo pecuaria."TipoMaterialGenetico" NOT NULL,
    "tipoSemen" pecuaria."TipoSemen",
    "touroId" text,
    "touroExternoId" text,
    "doadoraId" text,
    "doadoraExternaId" text,
    "produtoId" text NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "MaterialGenetico_doadora_chk" CHECK ((((tipo = 'EMBRIAO'::pecuaria."TipoMaterialGenetico") AND (NOT (("doadoraId" IS NOT NULL) AND ("doadoraExternaId" IS NOT NULL)))) OR ((tipo = 'SEMEN'::pecuaria."TipoMaterialGenetico") AND ("doadoraId" IS NULL) AND ("doadoraExternaId" IS NULL)))),
    CONSTRAINT "MaterialGenetico_tipo_semen_chk" CHECK (((tipo = 'SEMEN'::pecuaria."TipoMaterialGenetico") OR ("tipoSemen" IS NULL))),
    CONSTRAINT "MaterialGenetico_um_touro_chk" CHECK ((("touroId" IS NULL) <> ("touroExternoId" IS NULL)))
);


--
-- Name: MedicaoGeralLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MedicaoGeralLeite" (
    id text NOT NULL,
    "sessaoId" text NOT NULL,
    "tanqueId" text,
    litros numeric(14,3) NOT NULL,
    "reguaMm" numeric(10,3),
    "origemLitros" text NOT NULL,
    natureza text NOT NULL,
    "animaisOrigem" jsonb NOT NULL,
    responsavel text NOT NULL,
    observacao text,
    versao integer DEFAULT 1 NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    recipiente text,
    "declaracaoDireta" jsonb,
    "primeiraOrdenhaColostro" boolean,
    "criterioColostroSnapshot" jsonb,
    CONSTRAINT "MedicaoGeralLeite_recipiente_declaracao" CHECK (((((("tanqueId" IS NOT NULL) AND (recipiente IS NULL)) OR (("tanqueId" IS NULL) AND ((length(TRIM(BOTH FROM recipiente)) >= 1) AND (length(TRIM(BOTH FROM recipiente)) <= 160)))) IS TRUE) AND (("declaracaoDireta" IS NULL) OR (((natureza = ANY (ARRAY['NAO_COMERCIAL'::text, 'COLOSTRO'::text])) AND (jsonb_typeof("declaracaoDireta") = 'object'::text) AND (jsonb_typeof(("declaracaoDireta" -> 'justificativa'::text)) = 'string'::text) AND ((length(TRIM(BOTH FROM ("declaracaoDireta" ->> 'justificativa'::text))) >= 5) AND (length(TRIM(BOTH FROM ("declaracaoDireta" ->> 'justificativa'::text))) <= 500)) AND (("declaracaoDireta" - 'justificativa'::text) = '{}'::jsonb)) IS TRUE)) AND (("primeiraOrdenhaColostro" IS NULL) OR (natureza = 'COLOSTRO'::text)) AND (("criterioColostroSnapshot" IS NULL) OR (jsonb_typeof("criterioColostroSnapshot") = 'object'::text)))),
    CONSTRAINT "MedicaoGeralLeite_valores" CHECK (((litros >= (0)::numeric) AND (("reguaMm" IS NULL) OR ("reguaMm" >= (0)::numeric)) AND (versao > 0) AND (natureza = ANY (ARRAY['COMERCIAL'::text, 'NAO_COMERCIAL'::text, 'COLOSTRO'::text])) AND ("origemLitros" = ANY (ARRAY['LITROS_INFORMADOS'::text, 'TABELA_TANQUE'::text])) AND (length(TRIM(BOTH FROM responsavel)) > 0) AND (jsonb_typeof("animaisOrigem") = 'array'::text)))
);


--
-- Name: MedicaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MedicaoLeite" (
    id text NOT NULL,
    "diaId" text NOT NULL,
    "sessaoId" text NOT NULL,
    "participanteId" text NOT NULL,
    estado text DEFAULT 'PENDENTE'::text NOT NULL,
    litros numeric(14,3),
    motivo text,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "atualizadoPorId" integer,
    CONSTRAINT "MedicaoLeite_estado_volume_check" CHECK (((versao > 0) AND (((estado = 'MEDIDO'::text) AND (litros IS NOT NULL) AND (litros >= (0)::numeric) AND (litros <= 9999999.999)) OR ((estado = 'PENDENTE'::text) AND (litros IS NULL)) OR ((estado = 'NAO_ORDENHADO'::text) AND (litros IS NULL) AND (motivo IS NOT NULL) AND (length(btrim(motivo)) >= 5)))))
);


--
-- Name: MesNutricao; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MesNutricao" (
    id text NOT NULL,
    "loteId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    competencia date NOT NULL,
    inicio date NOT NULL,
    "configuracaoId" text NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    "revisadoEm" timestamp(3) without time zone,
    "revisadoPorId" integer,
    CONSTRAINT "MesNutricao_mes" CHECK (((EXTRACT(day FROM competencia) = (1)::numeric) AND (inicio >= competencia) AND (inicio < (competencia + '1 mon'::interval))))
);


--
-- Name: MomentoProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MomentoProtocolo" (
    id text NOT NULL,
    "protocoloId" text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    "instrucoesGerais" text,
    "modoAtendimento" text,
    "politicaExecucao" text DEFAULT 'CONFIRMACAO_OBRIGATORIA'::text NOT NULL,
    "horarioPadrao" text,
    "fusoHorario" text,
    CONSTRAINT "MomentoProtocolo_automacao_horario_check" CHECK ((("politicaExecucao" <> 'AUTOMATICA_EXCECAO'::text) OR (("horarioPadrao" IS NOT NULL) AND ("fusoHorario" IS NOT NULL)))),
    CONSTRAINT "MomentoProtocolo_fuso_automacao_check" CHECK ((("politicaExecucao" <> 'AUTOMATICA_EXCECAO'::text) OR ("fusoHorario" = 'America/Sao_Paulo'::text))),
    CONSTRAINT "MomentoProtocolo_horarioPadrao_check" CHECK ((("horarioPadrao" IS NULL) OR ("horarioPadrao" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT "MomentoProtocolo_instrucoesGerais_check" CHECK ((length("instrucoesGerais") <= 2000)),
    CONSTRAINT "MomentoProtocolo_modoAtendimento_check" CHECK (("modoAtendimento" = ANY (ARRAY['AUTOMATIZADA'::text, 'MANUAL'::text]))),
    CONSTRAINT "MomentoProtocolo_nome_check" CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 120))),
    CONSTRAINT "MomentoProtocolo_ordem_check" CHECK ((ordem > 0)),
    CONSTRAINT "MomentoProtocolo_politicaExecucao_check" CHECK (("politicaExecucao" = ANY (ARRAY['CONFIRMACAO_OBRIGATORIA'::text, 'AUTOMATICA_EXCECAO'::text])))
);


--
-- Name: MotivoBaixa; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MotivoBaixa" (
    id text NOT NULL,
    "ideagriId" integer,
    nome text NOT NULL,
    classe pecuaria."ClasseMotivoBaixa" NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: Movimentacao; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Movimentacao" (
    id text NOT NULL,
    data date NOT NULL,
    "propriedadeDestinoId" integer NOT NULL,
    "loteDestinoId" text,
    motivo text,
    quantidade integer NOT NULL,
    "desfeitaEm" timestamp(3) without time zone,
    "desfeitaMotivo" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: MovimentacaoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MovimentacaoAnimal" (
    id text NOT NULL,
    "movimentacaoId" text NOT NULL,
    "animalId" text NOT NULL,
    "origemPropriedadeId" integer,
    "origemLoteId" text,
    "localizacaoId" text,
    "desfeitoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MovimentoConsumoDiario; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MovimentoConsumoDiario" (
    id text NOT NULL,
    "itemId" text NOT NULL,
    "movimentoId" text NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    valor numeric(14,2) NOT NULL,
    motivo text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MovimentoConsumoDiario_sinais" CHECK (((quantidade <> (0)::numeric) AND (((quantidade > (0)::numeric) AND (valor >= (0)::numeric)) OR ((quantidade < (0)::numeric) AND (valor <= (0)::numeric)))))
);


--
-- Name: MovimentoFornecimentoNutricionalLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."MovimentoFornecimentoNutricionalLeite" (
    id text NOT NULL,
    "fornecimentoId" text NOT NULL,
    "movimentoId" text NOT NULL,
    "entradaId" text NOT NULL,
    natureza text NOT NULL,
    "quantidadeLitros" numeric(12,3) NOT NULL,
    CONSTRAINT "MovimentoFornecimentoNutricionalLeite_natureza_check" CHECK ((natureza = ANY (ARRAY['COMERCIAL'::text, 'NAO_COMERCIAL'::text]))),
    CONSTRAINT "MovimentoFornecimentoNutricionalLeite_quantidadeLitros_check" CHECK (("quantidadeLitros" > (0)::numeric))
);


--
-- Name: NecessidadeProgramacaoSanitaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."NecessidadeProgramacaoSanitaria" (
    id text NOT NULL,
    "programacaoId" text NOT NULL,
    "sujeitoTipo" text NOT NULL,
    "sujeitoId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    periodo text NOT NULL,
    "alertaId" text,
    situacao text NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    "aplicacaoId" text,
    "exameId" text,
    "regraNecessidadeId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: NecessidadeReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."NecessidadeReprodutiva" (
    id text NOT NULL,
    chave text NOT NULL,
    tipo text NOT NULL,
    "origemId" text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "tarefaId" text,
    "demandaId" text,
    "participacaoId" text,
    "alertaId" text,
    "dataReferencia" date NOT NULL,
    "previstaPara" date,
    "regraSnapshot" jsonb NOT NULL,
    situacao text NOT NULL,
    motivo text NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    decisao text,
    "decisaoMotivo" text,
    "decisaoDestino" text,
    "revisaoEm" date,
    "decisaoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "convergidaParaId" text,
    "convergenciaSnapshot" jsonb,
    CONSTRAINT "NecessidadeReprodutiva_check" CHECK ((((decisao IS NULL) AND ("decisaoMotivo" IS NULL) AND ("decisaoPorId" IS NULL)) OR ((decisao IS NOT NULL) AND ("decisaoMotivo" IS NOT NULL) AND ((length(btrim("decisaoMotivo")) >= 5) AND (length(btrim("decisaoMotivo")) <= 1000)) AND ("decisaoPorId" IS NOT NULL) AND ("decisaoPorId" > 0)))),
    CONSTRAINT "NecessidadeReprodutiva_check1" CHECK (((decisao IS NULL) OR (decisao <> ALL (ARRAY['REAGENDAR'::text, 'SUSPENDER'::text])) OR (("revisaoEm" IS NOT NULL) AND ("decisaoDestino" IS NOT NULL) AND ((length(btrim("decisaoDestino")) >= 2) AND (length(btrim("decisaoDestino")) <= 500))))),
    CONSTRAINT "NecessidadeReprodutiva_convergencia_formato" CHECK (((("convergidaParaId" IS NULL) AND ("convergenciaSnapshot" IS NULL)) OR (("convergidaParaId" IS NOT NULL) AND ("convergidaParaId" <> id) AND (situacao = 'ENCERRADO'::text) AND ("tarefaId" IS NULL) AND ("demandaId" IS NULL) AND ("convergenciaSnapshot" IS NOT NULL) AND (jsonb_typeof("convergenciaSnapshot") = 'object'::text) AND COALESCE((("convergenciaSnapshot" ->> 'versao'::text) = '1'::text), false) AND COALESCE(((("convergenciaSnapshot" -> 'origem'::text) ->> 'id'::text) = id), false) AND COALESCE(((("convergenciaSnapshot" -> 'destino'::text) ->> 'id'::text) = "convergidaParaId"), false)))),
    CONSTRAINT "NecessidadeReprodutiva_decisao_check" CHECK ((decisao = ANY (ARRAY['REAGENDAR'::text, 'DISPENSAR'::text, 'RETIRAR'::text, 'SUSPENDER'::text]))),
    CONSTRAINT "NecessidadeReprodutiva_revisao_check" CHECK ((revisao > 0)),
    CONSTRAINT "NecessidadeReprodutiva_situacao_check" CHECK ((situacao = ANY (ARRAY['PROXIMO'::text, 'PENDENTE'::text, 'ATRASADO'::text, 'PLANEJAMENTO_PENDENTE'::text, 'ADIADO'::text, 'SUSPENSO'::text, 'RESOLVIDO'::text, 'ENCERRADO'::text, 'DISPENSADO'::text]))),
    CONSTRAINT "NecessidadeReprodutiva_tipo_check" CHECK ((tipo = ANY (ARRAY['DISPOSITIVO_SEM_RETIRADA'::text, 'ETAPA_VENCIDA'::text, 'TENTATIVA_APOS_PREPARO'::text, 'AGENDAMENTO_INCOMPLETO'::text, 'DG_VENCIDO'::text, 'RECONFIRMACAO_VENCIDA'::text, 'RETORNO_VENCIDO'::text, 'APTA_SEM_ENCAMINHAMENTO'::text, 'AVALIACAO_NECESSARIA'::text, 'AVALIACAO_DESATUALIZADA'::text])))
);


--
-- Name: NecessidadeSanitaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."NecessidadeSanitaria" (
    id text NOT NULL,
    "regraId" text NOT NULL,
    "animalId" text NOT NULL,
    "alertaId" text,
    "revisaoRegra" integer NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    "propriedadeId" integer NOT NULL,
    situacao text NOT NULL,
    "dataTeorica" date,
    "dataAtencao" date,
    adocao date NOT NULL,
    "aplicacaoId" text,
    "participacaoId" text,
    motivo text,
    "decisaoEm" timestamp(3) without time zone,
    "decisaoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "NecessidadeSanitaria_revisao_check" CHECK (((revisao > 0) AND ("revisaoRegra" > 0)))
);


--
-- Name: OcorrenciaSanitaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."OcorrenciaSanitaria" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    "doencaId" text NOT NULL,
    inicio date NOT NULL,
    fim date,
    desfecho text,
    observacao text,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "doencaNomeSnapshot" text,
    "partoRetencaoPlacentaId" text
);


--
-- Name: OfertaBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."OfertaBezerreiro" (
    id text NOT NULL,
    "perfilId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "configuracaoId" text,
    "configuracaoSnapshot" jsonb,
    data date NOT NULL,
    "ocorridoEm" timestamp(3) with time zone,
    "horarioEstimado" boolean DEFAULT false NOT NULL,
    "ofertaProgramadaId" text,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    chave text NOT NULL,
    hash text NOT NULL,
    responsavel text,
    observacao text,
    "motivoEstorno" text,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "OfertaBezerreiro_estado" CHECK (((versao > 0) AND (status = ANY (ARRAY['CONFIRMADO'::text, 'ESTORNADO'::text])) AND ((NOT "horarioEstimado") OR ("ocorridoEm" IS NOT NULL)) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data)) AND (((status = 'CONFIRMADO'::text) AND ("estornadoEm" IS NULL)) OR ((status = 'ESTORNADO'::text) AND ("estornadoEm" IS NOT NULL) AND (length(btrim("motivoEstorno")) > 0)))))
);


--
-- Name: OfertaProgramadaBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."OfertaProgramadaBezerreiro" (
    id text NOT NULL,
    "faseVersaoId" text NOT NULL,
    "identidadeId" text NOT NULL,
    ordem integer NOT NULL,
    percentual numeric(7,4) NOT NULL,
    "horarioPrevisto" text,
    CONSTRAINT "OfertaProgramadaBezerreiro_parametros" CHECK (((ordem >= 0) AND (percentual > (0)::numeric) AND (percentual <= (100)::numeric) AND (("horarioPrevisto" IS NULL) OR ("horarioPrevisto" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))))
);


--
-- Name: OperacaoComercialLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."OperacaoComercialLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "parceiroId" text NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    referencia text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'ABERTA'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "OperacaoComercialLeite_estado" CHECK (((inicio <= fim) AND (versao > 0) AND (status = ANY (ARRAY['ABERTA'::text, 'FECHADA'::text])) AND (length(TRIM(BOTH FROM referencia)) >= 5)))
);


--
-- Name: OrigemColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."OrigemColostro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "loteColostroId" text,
    "preparoId" text,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    "valorTotal" numeric(14,2),
    snapshot jsonb,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "OrigemColostro_origem_xor" CHECK (((((("loteColostroId" IS NOT NULL))::integer + (("preparoId" IS NOT NULL))::integer) = 1) AND ("quantidadeLitros" > (0)::numeric) AND (status = ANY (ARRAY['CONFIRMADO'::text, 'ESTORNADO'::text])) AND (versao > 0) AND (("valorTotal" IS NULL) OR ("valorTotal" >= (0)::numeric))))
);


--
-- Name: OrigemPreparoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."OrigemPreparoColostro" (
    id text NOT NULL,
    "preparoId" text NOT NULL,
    "origemId" text NOT NULL,
    "unidadeId" text,
    "movimentoId" text,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT "OrigemPreparoColostro_volume" CHECK (("quantidadeLitros" > (0)::numeric))
);


--
-- Name: ParcelaDestinoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParcelaDestinoLeite" (
    id text NOT NULL,
    "destinoId" text NOT NULL,
    "animalId" text NOT NULL,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    "fornecimentoColostroId" text,
    "criadoNoDestino" boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT "ParcelaDestinoLeite_quantidade_check" CHECK ((("quantidadeLitros" > (0)::numeric) AND ((NOT "criadoNoDestino") OR ("fornecimentoColostroId" IS NOT NULL))))
);


--
-- Name: ParcelaFornecimentoNutricionalLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParcelaFornecimentoNutricionalLeite" (
    id text NOT NULL,
    "fornecimentoId" text NOT NULL,
    "animalId" text NOT NULL,
    dias integer,
    "baseQuantidade" text DEFAULT 'ATRIBUIDA'::text NOT NULL,
    "quantidadeLitros" numeric(12,3) NOT NULL,
    "criterioAtribuicao" text DEFAULT 'ANIMAL_DIAS'::text NOT NULL,
    "programacaoSnapshot" jsonb,
    CONSTRAINT "ParcelaFornecimentoNutricionalLeite_baseQuantidade_check" CHECK (("baseQuantidade" = 'ATRIBUIDA'::text)),
    CONSTRAINT "ParcelaFornecimentoNutricionalLeite_base_presenca" CHECK (((("criterioAtribuicao" = 'ANIMAL_DIAS'::text) AND (dias IS NOT NULL) AND (dias > 0)) OR (("criterioAtribuicao" = 'ATRIBUIDA_POR_OFERTA'::text) AND (dias IS NULL) AND ("programacaoSnapshot" IS NOT NULL) AND ("baseQuantidade" = 'ATRIBUIDA'::text)))),
    CONSTRAINT "ParcelaFornecimentoNutricionalLeite_quantidadeLitros_check" CHECK (("quantidadeLitros" >= (0)::numeric))
);


--
-- Name: ParticipacaoBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipacaoBezerreiro" (
    id text NOT NULL,
    "perfilId" text NOT NULL,
    "animalId" text NOT NULL,
    desde date NOT NULL,
    ate date,
    "motivoEntrada" text,
    "motivoSaida" text,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ParticipacaoBezerreiro_intervalo" CHECK (((ate IS NULL) OR (ate > desde)))
);


--
-- Name: ParticipacaoConsumoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipacaoConsumoAnimal" (
    id text NOT NULL,
    "fechamentoId" text NOT NULL,
    "animalId" text NOT NULL,
    dias integer NOT NULL,
    "metodoPresenca" text,
    CONSTRAINT "ParticipacaoConsumoAnimal_dias_check" CHECK ((dias > 0)),
    CONSTRAINT "ParticipacaoConsumo_metodo" CHECK ((("metodoPresenca" IS NULL) OR ("metodoPresenca" = 'PRESENCA_PARIDADE_V1'::text)))
);


--
-- Name: ParticipacaoConsumoDiario; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipacaoConsumoDiario" (
    id text NOT NULL,
    "diaId" text NOT NULL,
    "animalId" text NOT NULL
);


--
-- Name: ParticipacaoExposicao; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipacaoExposicao" (
    id text NOT NULL,
    "exposicaoId" text NOT NULL,
    "animalId" text NOT NULL,
    inicio date NOT NULL,
    fim date,
    CONSTRAINT "ParticipacaoExposicao_intervalo" CHECK (((fim IS NULL) OR (fim >= inicio)))
);


--
-- Name: ParticipacaoProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipacaoProtocolo" (
    id text NOT NULL,
    "protocoloId" text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    "inicioReferencia" timestamp(3) without time zone NOT NULL,
    "ocorrenciaId" text,
    "operacaoServicoId" text,
    "canceladaEm" timestamp(3) without time zone,
    "motivoCancelamento" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "valorServicoAtribuido" numeric(14,2),
    "programacaoId" text,
    "legadoIatfId" text,
    "referenciaExterna" text,
    "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" DEFAULT 'DIA'::pecuaria."PrecisaoCalendarioProtocolo" NOT NULL,
    "inicioEfetivo" timestamp(3) without time zone,
    "criadoPorId" integer,
    "precisaoInicioEfetivo" pecuaria."PrecisaoCalendarioProtocolo",
    "origemCalendario" pecuaria."OrigemCalendarioProtocolo" DEFAULT 'REFERENCIA_PROGRAMADA'::pecuaria."OrigemCalendarioProtocolo" NOT NULL,
    "acompanhamentoSnapshot" jsonb,
    "bloqueadaEm" timestamp(3) without time zone,
    "motivoBloqueio" text,
    "impactoSnapshot" jsonb,
    CONSTRAINT "ParticipacaoProtocolo_bloqueio_operacional" CHECK (((("bloqueadaEm" IS NULL) AND ("motivoBloqueio" IS NULL)) OR (("bloqueadaEm" IS NOT NULL) AND ("motivoBloqueio" IS NOT NULL) AND ((length(btrim("motivoBloqueio")) >= 5) AND (length(btrim("motivoBloqueio")) <= 1000)) AND ("impactoSnapshot" IS NOT NULL)))),
    CONSTRAINT "ParticipacaoProtocolo_inicio_efetivo_precisao_check" CHECK ((("precisaoInicioEfetivo" IS DISTINCT FROM 'DIA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("inicioEfetivo" = date_trunc('day'::text, "inicioEfetivo")))),
    CONSTRAINT "ParticipacaoProtocolo_precisao_check" CHECK ((("precisaoTemporal" = 'HORA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("inicioReferencia" = date_trunc('day'::text, "inicioReferencia")))),
    CONSTRAINT "Participacao_acompanhamento_snapshot_check" CHECK ((("acompanhamentoSnapshot" IS NULL) OR (jsonb_typeof("acompanhamentoSnapshot") = 'object'::text))),
    CONSTRAINT execucao_rateio_nao_negativo CHECK ((("valorServicoAtribuido" IS NULL) OR (("valorServicoAtribuido" >= (0)::numeric) AND ("operacaoServicoId" IS NOT NULL))))
);


--
-- Name: Protocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Protocolo" (
    id text NOT NULL,
    nome text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    descricao text,
    "publicadoEm" timestamp(3) without time zone,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    tipo pecuaria."TipoProtocolo" DEFAULT 'SANITARIO'::pecuaria."TipoProtocolo" NOT NULL,
    publicado boolean DEFAULT false NOT NULL,
    "legadoIatfId" text,
    "criadoPorId" integer,
    "referenciaTecnica" jsonb,
    finalidade pecuaria."FinalidadeProtocolo",
    "modalidadeTentativa" text,
    "modalidadeDiagnostico" text,
    "configuracaoAcompanhamento" jsonb,
    CONSTRAINT "Protocolo_configuracao_acompanhamento_check" CHECK ((("configuracaoAcompanhamento" IS NULL) OR ((tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo") AND (jsonb_typeof("configuracaoAcompanhamento") = 'object'::text)))),
    CONSTRAINT "Protocolo_finalidade_dominio_check" CHECK (((finalidade IS NULL) OR ((tipo = 'SANITARIO'::pecuaria."TipoProtocolo") AND (finalidade = 'SANITARIO'::pecuaria."FinalidadeProtocolo")) OR ((tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo") AND (finalidade = ANY (ARRAY['PRE_SINCRONIZACAO'::pecuaria."FinalidadeProtocolo", 'IATF'::pecuaria."FinalidadeProtocolo", 'TETF'::pecuaria."FinalidadeProtocolo"]))))),
    CONSTRAINT "Protocolo_modalidades_reprodutivas_check" CHECK (((("modalidadeTentativa" IS NULL) AND ("modalidadeDiagnostico" IS NULL)) OR (("modalidadeTentativa" IS NOT NULL) AND ("modalidadeDiagnostico" IS NOT NULL) AND (finalidade IS NOT NULL) AND (tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo") AND (finalidade = ANY (ARRAY['IATF'::pecuaria."FinalidadeProtocolo", 'TETF'::pecuaria."FinalidadeProtocolo"])) AND ("modalidadeTentativa" = ANY (ARRAY['ETAPA'::text, 'EXTERNA'::text])) AND ("modalidadeDiagnostico" = ANY (ARRAY['PROTOCOLO'::text, 'EXTERNO'::text])))))
);


--
-- Name: ParticipanteIatf; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."ParticipanteIatf" AS
 SELECT p.id,
    p."referenciaExterna",
    p."programacaoId",
    p."animalId",
    p."inicioReferencia" AS "inicioPrevisto",
    p."inicioEfetivo",
    p."canceladaEm" AS "encerradoEm",
    p."motivoCancelamento" AS "motivoEncerramento",
    p."criadoEm",
    p."criadoPorId",
    p."precisaoTemporal",
    p."precisaoInicioEfetivo"
   FROM (pecuaria."ParticipacaoProtocolo" p
     JOIN pecuaria."Protocolo" v ON ((v.id = p."protocoloId")))
  WHERE (v.tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo");


--
-- Name: ParticipanteProducaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipanteProducaoLeite" (
    id text NOT NULL,
    "diaId" text NOT NULL,
    "animalId" text NOT NULL,
    "localizacaoId" text NOT NULL,
    "lactacaoId" text,
    brinco text NOT NULL,
    nome text,
    pendencias jsonb NOT NULL,
    "excluidoEm" timestamp(3) without time zone,
    "motivoExclusao" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "finalidadeId" text,
    "finalidadeSnapshot" jsonb,
    CONSTRAINT "ParticipanteProducaoLeite_exclusao_check" CHECK (((("excluidoEm" IS NULL) AND ("motivoExclusao" IS NULL)) OR (("excluidoEm" IS NOT NULL) AND ("motivoExclusao" IS NOT NULL) AND (length(btrim("motivoExclusao")) >= 5)))),
    CONSTRAINT "ParticipanteProducaoLeite_finalidade_par_check" CHECK (((("finalidadeId" IS NULL) AND ("finalidadeSnapshot" IS NULL)) OR (("finalidadeId" IS NOT NULL) AND ("finalidadeSnapshot" IS NOT NULL))))
);


--
-- Name: ParticipanteVisita; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ParticipanteVisita" (
    id text NOT NULL,
    "atividadeId" text NOT NULL,
    "animalId" text NOT NULL,
    ordem integer NOT NULL,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    rascunho jsonb DEFAULT '{}'::jsonb NOT NULL,
    "fatoTipo" text,
    "fatoId" text,
    motivo text,
    snapshot jsonb NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "versaoRascunho" integer DEFAULT 0 NOT NULL,
    "regularizacaoPendente" boolean DEFAULT false NOT NULL,
    "historicoRegularizacao" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tarefaId" text,
    CONSTRAINT "ParticipanteVisita_versaoRascunho_nao_negativa" CHECK (("versaoRascunho" >= 0))
);


--
-- Name: PartoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PartoAnimal" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    data date NOT NULL,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "gestacaoId" text,
    tipo text NOT NULL,
    responsavel text,
    observacao text,
    "incluidoSaldoAnterior" boolean DEFAULT false NOT NULL,
    desfecho text,
    induzido boolean,
    dificuldade boolean,
    "assistenciaDescricao" text,
    "ocorridoEm" timestamp(3) with time zone,
    "horarioEstimado" boolean DEFAULT false NOT NULL,
    "retencaoPlacenta" boolean,
    versao integer DEFAULT 1 NOT NULL,
    "grauRetencaoPlacenta" integer,
    CONSTRAINT "PartoAnimal_grauRetencaoPlacenta_check" CHECK ((("grauRetencaoPlacenta" IS NULL) OR (("retencaoPlacenta" IS TRUE) AND ("grauRetencaoPlacenta" = ANY (ARRAY[1, 2, 3]))))),
    CONSTRAINT "Parto_desfecho" CHECK (((desfecho IS NULL) OR (desfecho = ANY (ARRAY['NASCIMENTO'::text, 'ABORTO'::text])))),
    CONSTRAINT "Parto_horario" CHECK ((((NOT "horarioEstimado") OR ("ocorridoEm" IS NOT NULL)) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data)))),
    CONSTRAINT "Parto_tipo" CHECK ((tipo = ANY (ARRAY['NORMAL'::text, 'DISTOCICO'::text, 'ABORTO'::text, 'NATIMORTO'::text, 'NASCIMENTO'::text]))),
    CONSTRAINT "Parto_tipo_desfecho" CHECK (((desfecho IS NOT NULL) AND (((tipo = 'ABORTO'::text) AND (desfecho = 'ABORTO'::text)) OR ((tipo <> 'ABORTO'::text) AND (desfecho = 'NASCIMENTO'::text))))),
    CONSTRAINT "Parto_versao" CHECK ((versao > 0))
);


--
-- Name: PerfilBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PerfilBezerreiro" (
    id text NOT NULL,
    "loteId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: PerfilNutricionalProduto; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PerfilNutricionalProduto" (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    "materiaSecaPercentual" numeric(5,2),
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "PerfilNutricionalProduto_ms_check" CHECK ((("materiaSecaPercentual" IS NULL) OR (("materiaSecaPercentual" >= (0)::numeric) AND ("materiaSecaPercentual" <= (100)::numeric))))
);


--
-- Name: PerfilSanitarioProduto; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PerfilSanitarioProduto" (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    "carenciaLeiteHoras" integer,
    "carenciaCarneHoras" integer,
    "viaPadrao" text,
    "referenciaTecnica" text,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "orientacaoUso" text,
    "tipoAplicacaoId" text,
    CONSTRAINT "PerfilSanitarioProduto_carencias_check" CHECK (((("carenciaLeiteHoras" IS NULL) OR ("carenciaLeiteHoras" >= 0)) AND (("carenciaCarneHoras" IS NULL) OR ("carenciaCarneHoras" >= 0)))),
    CONSTRAINT "PerfilSanitarioProduto_orientacaoUso_check" CHECK ((length("orientacaoUso") <= 2000))
);


--
-- Name: PeriodoFaseBezerreiro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PeriodoFaseBezerreiro" (
    id text NOT NULL,
    "participacaoId" text NOT NULL,
    "faseVersaoId" text NOT NULL,
    "solicitadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    desde date NOT NULL,
    ate date,
    motivo text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "PeriodoFaseBezerreiro_intervalo" CHECK (((ate IS NULL) OR (ate > desde)))
);


--
-- Name: PeriodoReprodutivoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PeriodoReprodutivoAnimal" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    tipo text NOT NULL,
    inicio date NOT NULL,
    fim date,
    origem text DEFAULT 'IDEAGRI'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "destinoOrigemId" text,
    "encerradoPorDestinoId" text,
    "fimAntesDaMudanca" date,
    proveniencia jsonb,
    "revogadoEm" timestamp(3) without time zone,
    "motivoRevogacao" text,
    CONSTRAINT "PeriodoReprodutivoAnimal_check" CHECK (((fim IS NULL) OR (fim >= inicio))),
    CONSTRAINT "PeriodoReprodutivoAnimal_tipo_check" CHECK ((tipo = ANY (ARRAY['NENHUM'::text, 'DOADORA'::text, 'RECEPTORA'::text])))
);


--
-- Name: Pesagem; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Pesagem" (
    id text NOT NULL,
    "ideagriId" integer,
    "animalId" text NOT NULL,
    data date NOT NULL,
    "pesoKg" numeric(7,2) NOT NULL,
    tipo pecuaria."TipoPesagem" NOT NULL,
    origem pecuaria."OrigemPesagem" DEFAULT 'MANUAL'::pecuaria."OrigemPesagem" NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "requisicaoId" text,
    precisao text DEFAULT 'NAO_INFORMADO'::text NOT NULL,
    "contextoHistorico" text DEFAULT 'NAO_INFORMADO'::text NOT NULL,
    "propriedadeId" integer,
    "referenciaHistorica" text,
    "provenienciaHistoricaSnapshot" jsonb,
    CONSTRAINT "Pesagem_balanca_precisao_check" CHECK ((((origem)::text <> 'BALANCA'::text) OR (precisao = ANY (ARRAY['MEDIDO'::text, 'NAO_INFORMADO'::text])))),
    CONSTRAINT "Pesagem_contexto_historico_check" CHECK (("contextoHistorico" = ANY (ARRAY['INTERNO'::text, 'EXTERNO'::text, 'NAO_INFORMADO'::text]))),
    CONSTRAINT "Pesagem_contexto_sitio_check" CHECK (((("contextoHistorico" <> 'EXTERNO'::text) OR ("propriedadeId" IS NULL)) AND (("contextoHistorico" <> 'INTERNO'::text) OR ("propriedadeId" IS NOT NULL)))),
    CONSTRAINT "Pesagem_precisao_check" CHECK ((precisao = ANY (ARRAY['MEDIDO'::text, 'ESTIMADO'::text, 'INFORMADO'::text, 'NAO_INFORMADO'::text]))),
    CONSTRAINT "Pesagem_proveniencia_check" CHECK (((("referenciaHistorica" IS NULL) AND ("provenienciaHistoricaSnapshot" IS NULL) AND ("contextoHistorico" <> 'EXTERNO'::text)) OR (("referenciaHistorica" IS NOT NULL) AND (length(btrim("referenciaHistorica")) > 0) AND ("provenienciaHistoricaSnapshot" IS NOT NULL) AND (jsonb_typeof("provenienciaHistoricaSnapshot") = 'object'::text))))
);


--
-- Name: PoliticaAcompanhamentoReprodutivo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PoliticaAcompanhamentoReprodutivo" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    versao integer NOT NULL,
    "vigenteDesde" date NOT NULL,
    parametros jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "PoliticaAcompanhamento_alerta" CHECK (((jsonb_typeof(parametros) = 'object'::text) AND (NOT ((parametros ->> 'efeito'::text) IS DISTINCT FROM 'ALERTA'::text)) AND
CASE (parametros ->> 'versao'::text)
    WHEN '1'::text THEN true
    WHEN '2'::text THEN
    CASE
        WHEN (jsonb_typeof((parametros -> 'regras'::text)) = 'array'::text) THEN ((jsonb_array_length((parametros -> 'regras'::text)) >= 1) AND (jsonb_array_length((parametros -> 'regras'::text)) <= 100))
        ELSE false
    END
    ELSE false
END)),
    CONSTRAINT "PoliticaAcompanhamento_versao" CHECK ((versao > 0))
);


--
-- Name: PoliticaAtencaoReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PoliticaAtencaoReprodutiva" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    versao integer NOT NULL,
    "vigenteDesde" date NOT NULL,
    parametros jsonb NOT NULL,
    "criadoPorId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "PoliticaAtencaoReprodutiva_versao_check" CHECK ((versao > 0))
);


--
-- Name: PoliticaElegibilidadeReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PoliticaElegibilidadeReprodutiva" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    versao integer NOT NULL,
    "vigenteDesde" date NOT NULL,
    parametros jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "PoliticaElegibilidade_parametros" CHECK ((jsonb_typeof(parametros) = 'object'::text)),
    CONSTRAINT "PoliticaElegibilidade_versao" CHECK ((versao > 0))
);


--
-- Name: PosicaoOrdenha; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PosicaoOrdenha" (
    id text NOT NULL,
    "configuracaoId" text NOT NULL,
    "posicaoId" text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    horario text,
    CONSTRAINT "PosicaoOrdenha_campos_check" CHECK (((ordem >= 1) AND (ordem <= 12) AND ((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 60)) AND ((horario IS NULL) OR (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))))
);


--
-- Name: PreparoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."PreparoColostro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    data date NOT NULL,
    "ocorridoEm" timestamp(3) with time zone,
    "volumeFinalLitros" numeric(14,3) NOT NULL,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    chave text NOT NULL,
    hash text NOT NULL,
    responsavel text NOT NULL,
    observacao text,
    snapshot jsonb,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "motivoEstorno" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "PreparoColostro_estado" CHECK (((versao > 0) AND ("volumeFinalLitros" > (0)::numeric) AND (status = ANY (ARRAY['CONFIRMADO'::text, 'ESTORNADO'::text])) AND (length(btrim(responsavel)) > 0) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data))))
);


--
-- Name: ProgramacaoProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ProgramacaoProtocolo" (
    id text NOT NULL,
    nome text NOT NULL,
    "protocoloId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "inicioReferencia" timestamp(3) without time zone NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "legadoIatfId" text,
    "referenciaExterna" text,
    "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" DEFAULT 'DIA'::pecuaria."PrecisaoCalendarioProtocolo" NOT NULL,
    status text DEFAULT 'ABERTA'::text NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ProgramacaoProtocolo_precisao_check" CHECK ((("precisaoTemporal" = 'HORA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("inicioReferencia" = date_trunc('day'::text, "inicioReferencia"))))
);


--
-- Name: ProgramacaoIatf; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."ProgramacaoIatf" AS
 SELECT p.id,
    p."referenciaExterna",
    p."propriedadeId",
    p."protocoloId",
    p.nome,
    p."inicioReferencia" AS "inicioPrevisto",
    p.status,
    p."criadoEm",
    p."criadoPorId",
    p."precisaoTemporal"
   FROM (pecuaria."ProgramacaoProtocolo" p
     JOIN pecuaria."Protocolo" v ON ((v.id = p."protocoloId")))
  WHERE (v.tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo");


--
-- Name: ProgramacaoRetiradaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ProgramacaoRetiradaLeite" (
    id uuid NOT NULL,
    "propriedadeId" integer NOT NULL,
    "vigenteDesde" date NOT NULL,
    tipo text NOT NULL,
    "diaSemana" integer,
    "diasSemana" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
    "produtoId" text,
    "metaLitros" numeric(12,3),
    versao integer NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "ProgramacaoRetiradaLeite_dias_unicos" CHECK ((cardinality("diasSemana") = ((((((
CASE
    WHEN (0 = ANY ("diasSemana")) THEN 1
    ELSE 0
END +
CASE
    WHEN (1 = ANY ("diasSemana")) THEN 1
    ELSE 0
END) +
CASE
    WHEN (2 = ANY ("diasSemana")) THEN 1
    ELSE 0
END) +
CASE
    WHEN (3 = ANY ("diasSemana")) THEN 1
    ELSE 0
END) +
CASE
    WHEN (4 = ANY ("diasSemana")) THEN 1
    ELSE 0
END) +
CASE
    WHEN (5 = ANY ("diasSemana")) THEN 1
    ELSE 0
END) +
CASE
    WHEN (6 = ANY ("diasSemana")) THEN 1
    ELSE 0
END))),
    CONSTRAINT "ProgramacaoRetiradaLeite_regra_exclusiva" CHECK ((((tipo = 'DIARIA'::text) AND ("diaSemana" IS NULL) AND (cardinality("diasSemana") = 0) AND ("metaLitros" IS NULL) AND ("produtoId" IS NULL)) OR ((tipo = 'SEMANAL'::text) AND (("diaSemana" >= 0) AND ("diaSemana" <= 6)) AND ("diaSemana" IS NOT NULL) AND (cardinality("diasSemana") = 0) AND ("metaLitros" IS NULL) AND ("produtoId" IS NULL)) OR ((tipo = 'DIAS_ESCOLHIDOS'::text) AND ("diaSemana" IS NULL) AND ((cardinality("diasSemana") >= 1) AND (cardinality("diasSemana") <= 7)) AND ("diasSemana" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]) AND (array_position("diasSemana", NULL::integer) IS NULL) AND ("metaLitros" IS NULL) AND ("produtoId" IS NULL)) OR ((tipo = 'META_LITROS'::text) AND ("diaSemana" IS NULL) AND (cardinality("diasSemana") = 0) AND ("metaLitros" IS NOT NULL) AND ("metaLitros" > (0)::numeric) AND ("produtoId" IS NOT NULL)))),
    CONSTRAINT "ProgramacaoRetiradaLeite_versao_positiva" CHECK ((versao > 0))
);


--
-- Name: ProgramacaoSanitaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ProgramacaoSanitaria" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    nome text NOT NULL,
    tipo text NOT NULL,
    meses integer[],
    ano integer,
    "vigenciaInicio" date,
    "vigenciaFim" date,
    precisao text DEFAULT 'MES'::text NOT NULL,
    dia integer,
    recorrencia text NOT NULL,
    "produtoId" text,
    procedimento text,
    publico jsonb NOT NULL,
    "publicoConferido" boolean DEFAULT false NOT NULL,
    fonte text,
    observacao text,
    executor text,
    "tipoExameId" text,
    "sujeitoTipo" text DEFAULT 'ANIMAL'::text NOT NULL,
    "antecedenciaDias" integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    "ativadoEm" date,
    "criadoPorId" integer NOT NULL,
    "regraEquivalenteId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "ProgramacaoSanitaria_meses_check" CHECK (((cardinality(meses) > 0) AND (meses <@ ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))),
    CONSTRAINT "ProgramacaoSanitaria_precisao_check" CHECK ((((precisao = 'MES'::text) AND (dia IS NULL)) OR ((precisao = 'DIA'::text) AND ((dia >= 1) AND (dia <= 31))))),
    CONSTRAINT "ProgramacaoSanitaria_recorrencia_check" CHECK ((recorrencia = ANY (ARRAY['JANELA_ELEGIBILIDADE'::text, 'CAMPANHA_ANUAL'::text, 'SEM_REPETICAO'::text])))
);


--
-- Name: ProtocoloIatf; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."ProtocoloIatf" AS
 SELECT p.id,
    p.nome,
    p.versao,
    p.publicado,
    COALESCE(( SELECT jsonb_agg(e.configuracao ORDER BY e.ordem) AS jsonb_agg
           FROM pecuaria."EtapaProtocolo" e
          WHERE (e."protocoloId" = p.id)), '[]'::jsonb) AS etapas,
    p."criadoEm",
    p."criadoPorId"
   FROM pecuaria."Protocolo" p
  WHERE (p.tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo")
 OFFSET 0;


--
-- Name: Raca; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."Raca" (
    id text NOT NULL,
    "ideagriId" integer,
    nome text NOT NULL,
    sigla text NOT NULL,
    base boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: ReferenciaGerencialLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ReferenciaGerencialLeite" (
    id text NOT NULL,
    "fornecimentoId" text NOT NULL,
    "fechamentoId" text NOT NULL,
    versao integer NOT NULL,
    "periodoInicio" date NOT NULL,
    "periodoFim" date NOT NULL,
    "parceiroId" text NOT NULL,
    "precoUnitario" numeric(14,4) NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    provisoria boolean NOT NULL,
    motivo text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "ReferenciaGerencialLeite_check" CHECK (("periodoFim" >= "periodoInicio")),
    CONSTRAINT "ReferenciaGerencialLeite_motivo_check" CHECK ((length(TRIM(BOTH FROM motivo)) >= 5)),
    CONSTRAINT "ReferenciaGerencialLeite_precoUnitario_check" CHECK (("precoUnitario" >= (0)::numeric)),
    CONSTRAINT "ReferenciaGerencialLeite_valorTotal_check" CHECK (("valorTotal" >= (0)::numeric)),
    CONSTRAINT "ReferenciaGerencialLeite_versao_check" CHECK ((versao > 0))
);


--
-- Name: RegistroGenealogicoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RegistroGenealogicoAnimal" (
    registro text NOT NULL,
    "animalId" text NOT NULL,
    evidencia text NOT NULL,
    "criadoEm" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "RegistroGenealogicoAnimal_evidencia_check" CHECK ((length(TRIM(BOTH FROM evidencia)) > 0)),
    CONSTRAINT "RegistroGenealogicoAnimal_registro_check" CHECK ((registro ~ '^ABCZ:(RGD|RGN):[A-Z]{2,10}:[1-9][0-9]{0,9}$'::text))
);


--
-- Name: RegraAlertaSanitario; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RegraAlertaSanitario" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    revisao integer DEFAULT 1 NOT NULL,
    "produtoId" text,
    "protocoloId" text,
    gatilho text NOT NULL,
    "idadeMeses" integer,
    "dataFixa" date,
    "propriedadeIds" integer[],
    sexo text,
    "antecedenciaDias" integer DEFAULT 0 NOT NULL,
    "prazoDias" integer DEFAULT 0 NOT NULL,
    vigencia date NOT NULL,
    adocao date,
    orientacao text,
    "criadoPorId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "tipoAplicacaoId" text,
    cuidado text,
    "baseAtivacao" text,
    "idadeMaximaMeses" integer,
    "idadeMinimaMeses" integer,
    CONSTRAINT "RegraAlertaSanitario_destino_check" CHECK ((((("produtoId" IS NOT NULL))::integer + (("protocoloId" IS NOT NULL))::integer) = 1)),
    CONSTRAINT "RegraAlertaSanitario_gatilho_check" CHECK ((((gatilho = 'IDADE'::text) AND ("idadeMeses" > 0) AND ("dataFixa" IS NULL)) OR ((gatilho = 'DATA_FIXA'::text) AND ("dataFixa" IS NOT NULL) AND ("idadeMeses" IS NULL)))),
    CONSTRAINT "RegraAlertaSanitario_prazos_check" CHECK ((("antecedenciaDias" >= 0) AND ("prazoDias" >= 0) AND (cardinality("propriedadeIds") > 0) AND (revisao > 0))),
    CONSTRAINT "RegraAlertaSanitario_publico_etario_check" CHECK (((("idadeMinimaMeses" IS NULL) OR ("idadeMinimaMeses" >= 0)) AND (("idadeMaximaMeses" IS NULL) OR ("idadeMaximaMeses" >= 0)) AND (("idadeMinimaMeses" IS NULL) OR ("idadeMaximaMeses" IS NULL) OR ("idadeMinimaMeses" <= "idadeMaximaMeses")))),
    CONSTRAINT "RegraAlertaSanitario_sexo_check" CHECK (((sexo IS NULL) OR (sexo = ANY (ARRAY['F'::text, 'M'::text]))))
);


--
-- Name: RegraImpactoProcedimentoReprodutivo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RegraImpactoProcedimentoReprodutivo" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "tipoAplicacaoId" text NOT NULL,
    finalidade text NOT NULL,
    efeito text NOT NULL,
    motivo text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoPorId" integer NOT NULL,
    "atualizadoPorId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "RegraImpactoProcedimentoReprodutivo_efeito_check" CHECK ((efeito = ANY (ARRAY['AVISAR'::text, 'BLOQUEAR'::text, 'RETIRAR'::text]))),
    CONSTRAINT "RegraImpactoProcedimentoReprodutivo_finalidade_check" CHECK ((finalidade = ANY (ARRAY['PROTOCOLO'::text, 'IATF'::text, 'TETF'::text, 'PRE_SINCRONIZACAO'::text]))),
    CONSTRAINT "RegraImpactoProcedimentoReprodutivo_motivo_check" CHECK (((length(btrim(motivo)) >= 5) AND (length(btrim(motivo)) <= 1000))),
    CONSTRAINT "RegraImpactoProcedimentoReprodutivo_versao_check" CHECK ((versao > 0))
);


--
-- Name: RegraSanitariaReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RegraSanitariaReprodutiva" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "doencaId" text NOT NULL,
    acao text NOT NULL,
    efeito text NOT NULL,
    motivo text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "impactoProtocolar" jsonb,
    CONSTRAINT "RegraSanitariaReprodutiva_impacto_versionado" CHECK ((("impactoProtocolar" IS NULL) OR (((jsonb_typeof("impactoProtocolar") = 'object'::text) AND (("impactoProtocolar" ->> 'versao'::text) = '1'::text) AND (("impactoProtocolar" ->> 'gatilho'::text) = 'OCORRENCIA'::text) AND (("impactoProtocolar" ->> 'efeito'::text) = ANY (ARRAY['AVISAR'::text, 'BLOQUEAR'::text, 'RETIRAR'::text])) AND ((("impactoProtocolar" ->> 'gatilho'::text) = 'OCORRENCIA'::text) AND (NOT ("impactoProtocolar" ? 'tipoAplicacaoId'::text)))) IS TRUE))),
    CONSTRAINT "Regra_efeito" CHECK (((efeito = ANY (ARRAY['BLOQUEAR'::text, 'ALERTAR'::text])) AND (acao = ANY (ARRAY['IA'::text, 'TE'::text, 'COBERTURA'::text, 'IATF'::text]))))
);


--
-- Name: RequisicaoPecuaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RequisicaoPecuaria" (
    chave text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "usuarioId" integer,
    operacao text NOT NULL,
    "hashPayload" text NOT NULL,
    "resultadoIds" jsonb NOT NULL,
    "criadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RestricaoReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RestricaoReprodutiva" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    data date NOT NULL,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    tipo text NOT NULL,
    motivo text NOT NULL,
    acoes text[],
    ate date,
    "motivoEncerramento" text,
    CONSTRAINT "RestricaoReprodutiva_intervalo" CHECK (((ate IS NULL) OR (ate >= data)))
);


--
-- Name: ResultadoQualidadeLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."ResultadoQualidadeLeite" (
    id text NOT NULL,
    "amostraId" text NOT NULL,
    campo text NOT NULL,
    valor jsonb NOT NULL,
    unidade text,
    vigente boolean DEFAULT true NOT NULL,
    "substituidoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "ResultadoQualidadeLeite_vigencia_check" CHECK ((vigente = ("substituidoEm" IS NULL)))
);


--
-- Name: RetiradaInternaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RetiradaInternaLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "entradaId" text NOT NULL,
    "movimentoId" text NOT NULL,
    destino text NOT NULL,
    responsavel text NOT NULL,
    data date NOT NULL,
    "quantidadeLitros" numeric(14,3) NOT NULL,
    "saldoOrigemAntes" numeric(14,3) NOT NULL,
    "saldoOrigemDepois" numeric(14,3) NOT NULL,
    motivo text NOT NULL,
    status text DEFAULT 'CONFIRMADO'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "estornadoEm" timestamp(3) without time zone,
    "estornadoPorId" integer,
    "motivoEstorno" text,
    "movimentoEstornoId" text,
    CONSTRAINT "RetiradaInternaLeite_check" CHECK ((("saldoOrigemAntes" - "quantidadeLitros") = "saldoOrigemDepois")),
    CONSTRAINT "RetiradaInternaLeite_destino_check" CHECK ((destino = ANY (ARRAY['CASA'::text, 'FUNCIONARIOS'::text]))),
    CONSTRAINT "RetiradaInternaLeite_motivo_check" CHECK (((length(btrim(motivo)) >= 5) AND (length(btrim(motivo)) <= 1000))),
    CONSTRAINT "RetiradaInternaLeite_quantidadeLitros_check" CHECK (("quantidadeLitros" > (0)::numeric)),
    CONSTRAINT "RetiradaInternaLeite_responsavel_check" CHECK (((length(btrim(responsavel)) >= 2) AND (length(btrim(responsavel)) <= 200))),
    CONSTRAINT "RetiradaInternaLeite_saldoOrigemAntes_check" CHECK (("saldoOrigemAntes" >= (0)::numeric)),
    CONSTRAINT "RetiradaInternaLeite_saldoOrigemDepois_check" CHECK (("saldoOrigemDepois" >= (0)::numeric)),
    CONSTRAINT "RetiradaInternaLeite_status_check" CHECK ((status = ANY (ARRAY['CONFIRMADO'::text, 'ESTORNADO'::text]))),
    CONSTRAINT "RetiradaInternaLeite_versao_check" CHECK ((versao > 0))
);


--
-- Name: RetiradaOperacaoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RetiradaOperacaoLeite" (
    id text NOT NULL,
    "comercialId" text NOT NULL,
    "movimentoId" text NOT NULL,
    referencia text NOT NULL,
    "pontoColeta" text,
    "horarioColeta" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "RetiradaOperacaoLeite_documentada" CHECK (((length(TRIM(BOTH FROM referencia)) >= 5) AND (("horarioColeta" IS NULL) OR ("horarioColeta" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))))
);


--
-- Name: RevisaoPrazoAcompanhamento; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RevisaoPrazoAcompanhamento" (
    id text NOT NULL,
    "demandaId" text NOT NULL,
    "versaoAnterior" integer NOT NULL,
    "politicaAnteriorId" text,
    "politicaNovaId" text NOT NULL,
    "previstaAnterior" date,
    "previstaNova" date NOT NULL,
    "regraAnterior" jsonb NOT NULL,
    "regraNova" jsonb NOT NULL,
    motivo text NOT NULL,
    "usuarioId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tarefaId" text,
    "tarefaPrevistaAnterior" timestamp(3) without time zone,
    "tarefaPrevistaNova" timestamp(3) without time zone,
    CONSTRAINT "RevisaoPrazoAcompanhamento_motivo_check" CHECK ((length(TRIM(BOTH FROM motivo)) >= 5)),
    CONSTRAINT "RevisaoPrazoAcompanhamento_versaoAnterior_check" CHECK (("versaoAnterior" > 0)),
    CONSTRAINT "RevisaoPrazo_tarefa_completa" CHECK (((("tarefaId" IS NULL) AND ("tarefaPrevistaAnterior" IS NULL) AND ("tarefaPrevistaNova" IS NULL)) OR (("tarefaId" IS NOT NULL) AND ("tarefaPrevistaAnterior" IS NOT NULL) AND ("tarefaPrevistaNova" IS NOT NULL))))
);


--
-- Name: RevisaoRegraAlertaSanitario; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."RevisaoRegraAlertaSanitario" (
    id text NOT NULL,
    "regraId" text NOT NULL,
    revisao integer NOT NULL,
    dados jsonb NOT NULL,
    motivo text NOT NULL,
    "autorId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SegmentoConsumoAnimal; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."SegmentoConsumoAnimal" (
    id text NOT NULL,
    "participacaoId" text NOT NULL,
    desde date NOT NULL,
    ate date NOT NULL,
    vaca boolean,
    metodo text NOT NULL,
    prova jsonb NOT NULL,
    CONSTRAINT "SegmentoConsumo_intervalo" CHECK (((ate > desde) AND (metodo = 'PRESENCA_PARIDADE_V1'::text)))
);


--
-- Name: SelecaoVisita; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."SelecaoVisita" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "SelecaoVisita_nome" CHECK ((length(btrim(nome)) > 0))
);


--
-- Name: SessaoOrdenha; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."SessaoOrdenha" (
    id text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "diaId" text NOT NULL,
    "posicaoId" text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    horario text,
    CONSTRAINT "SessaoOrdenha_campos_check" CHECK (((versao > 0) AND ((ordem >= 1) AND (ordem <= 12)) AND ((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 60)) AND ((horario IS NULL) OR (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))))
);


--
-- Name: SituacaoInicialReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."SituacaoInicialReprodutiva" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    data date NOT NULL,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    situacao text NOT NULL,
    "aptaDesde" date,
    observacao text,
    "classeReprodutiva" text,
    CONSTRAINT "SituacaoInicialReprodutiva_classeReprodutiva_check" CHECK ((("classeReprodutiva" IS NULL) OR (("classeReprodutiva" = ANY (ARRAY['NOVILHA'::text, 'VACA'::text])) AND (observacao IS NOT NULL) AND (length(btrim(observacao)) >= 5))))
);


--
-- Name: SnapshotRelatorioReprodutivo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."SnapshotRelatorioReprodutivo" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    tipo text NOT NULL,
    filtros jsonb NOT NULL,
    snapshot jsonb NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "SnapshotRelatorioReprodutivo_json" CHECK (((jsonb_typeof(filtros) = 'object'::text) AND (jsonb_typeof(snapshot) = 'object'::text))),
    CONSTRAINT "SnapshotRelatorioReprodutivo_tipo" CHECK ((tipo = ANY (ARRAY['PARTOS'::text, 'INDICADORES'::text]))),
    CONSTRAINT "SnapshotRelatorioReprodutivo_versao" CHECK ((versao > 0))
);


--
-- Name: TanqueLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."TanqueLeite" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "identidadeId" text NOT NULL,
    versao integer NOT NULL,
    nome text NOT NULL,
    fabricante text,
    modelo text,
    "numeroSerie" text,
    "capacidadeLitros" numeric(14,3) NOT NULL,
    "vigenteDesde" date NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "tabelaConversao" jsonb NOT NULL,
    "referenciaTabela" text,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "TanqueLeite_especificacoes" CHECK (((versao > 0) AND ("capacidadeLitros" > (0)::numeric) AND (length(TRIM(BOTH FROM nome)) > 0) AND (jsonb_typeof("tabelaConversao") = 'array'::text)))
);


--
-- Name: TarefaProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."TarefaProtocolo" (
    id text NOT NULL,
    "participacaoId" text NOT NULL,
    "etapaId" text NOT NULL,
    "previstaEm" timestamp(3) without time zone NOT NULL,
    "planejadoSnapshot" jsonb,
    "dispensadaEm" timestamp(3) without time zone,
    motivo text,
    "nomeSnapshot" text,
    "legadoIatfId" text,
    "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" DEFAULT 'DIA'::pecuaria."PrecisaoCalendarioProtocolo" NOT NULL,
    "previsaoOriginal" timestamp(3) without time zone,
    "realizadaEm" timestamp(3) without time zone,
    "historicoReprogramacao" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "realizadoSnapshot" jsonb,
    "desviosSnapshot" jsonb,
    "regularizacaoPendente" boolean DEFAULT false NOT NULL,
    "historicoRegularizacao" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "precisaoRealizacao" pecuaria."PrecisaoCalendarioProtocolo",
    "previsaoPendente" boolean DEFAULT false NOT NULL,
    "momentoSnapshot" jsonb,
    CONSTRAINT "TarefaProtocolo_precisao_check" CHECK ((("precisaoTemporal" = 'HORA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("previstaEm" = date_trunc('day'::text, "previstaEm")))),
    CONSTRAINT "TarefaProtocolo_previsao_pendente_check" CHECK (((NOT "previsaoPendente") OR ("precisaoTemporal" = 'DIA'::pecuaria."PrecisaoCalendarioProtocolo"))),
    CONSTRAINT "TarefaProtocolo_realizacao_precisao_check" CHECK ((("precisaoRealizacao" IS DISTINCT FROM 'DIA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("realizadaEm" = date_trunc('day'::text, "realizadaEm"))))
);


--
-- Name: VinculoTarefaProtocolo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoTarefaProtocolo" (
    id text NOT NULL,
    "tarefaId" text NOT NULL,
    ordem integer NOT NULL,
    "aplicacaoId" text,
    "exameId" text,
    "tentativaId" text,
    estado text DEFAULT 'ATUAL'::text NOT NULL,
    origem text DEFAULT 'EXECUCAO'::text NOT NULL,
    "registradoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "registradoPorId" integer,
    "encerradoEm" timestamp(3) without time zone,
    motivo text,
    "manejoId" text,
    CONSTRAINT "VinculoTarefaProtocolo_check" CHECK ((num_nonnulls("aplicacaoId", "exameId", "tentativaId", "manejoId") = 1)),
    CONSTRAINT "VinculoTarefaProtocolo_estado_check" CHECK ((estado = ANY (ARRAY['ATUAL'::text, 'HISTORICO'::text, 'SUBSTITUIDO'::text, 'ENCERRADO'::text, 'REABERTO'::text])))
);


--
-- Name: TarefaIatf; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."TarefaIatf" AS
 SELECT t.id,
    t."participacaoId" AS "participanteId",
    (e.ordem - 1) AS etapa,
        CASE
            WHEN ((e.tipo = 'EXAME'::text) AND ((e.configuracao ->> 'tipo'::text) = 'AVALIACAO'::text)) THEN 'AVALIACAO'::text
            ELSE e.tipo
        END AS tipo,
    COALESCE(t."nomeSnapshot", e.nome) AS nome,
    t."previstaEm",
    COALESCE(t."previsaoOriginal", t."previstaEm") AS "previsaoOriginal",
    t."realizadaEm",
    t."dispensadaEm",
    t.motivo,
        CASE
            WHEN ((t."realizadaEm" IS NOT NULL) OR t."regularizacaoPendente") THEN v."aplicacaoId"
            ELSE NULL::text
        END AS "aplicacaoId",
        CASE
            WHEN ((t."realizadaEm" IS NOT NULL) OR t."regularizacaoPendente") THEN v."tentativaId"
            ELSE NULL::text
        END AS "tentativaId",
        CASE
            WHEN ((t."realizadaEm" IS NOT NULL) OR t."regularizacaoPendente") THEN i.id
            ELSE NULL::text
        END AS "avaliacaoId",
        CASE
            WHEN (((t."realizadaEm" IS NOT NULL) OR t."regularizacaoPendente") AND (i.id IS NULL)) THEN v."exameId"
            ELSE NULL::text
        END AS "exameId",
    t."historicoReprogramacao",
    t."planejadoSnapshot",
    t."realizadoSnapshot",
    t."desviosSnapshot",
    t."regularizacaoPendente",
    t."historicoRegularizacao",
    t."precisaoTemporal",
    t."precisaoRealizacao",
    t."previsaoPendente"
   FROM (((((pecuaria."TarefaProtocolo" t
     JOIN pecuaria."ParticipacaoProtocolo" a ON ((a.id = t."participacaoId")))
     JOIN pecuaria."Protocolo" p ON ((p.id = a."protocoloId")))
     JOIN pecuaria."EtapaProtocolo" e ON ((e.id = t."etapaId")))
     LEFT JOIN LATERAL ( SELECT l.id,
            l."tarefaId",
            l.ordem,
            l."aplicacaoId",
            l."exameId",
            l."tentativaId",
            l.estado,
            l.origem,
            l."registradoEm",
            l."registradoPorId",
            l."encerradoEm",
            l.motivo
           FROM pecuaria."VinculoTarefaProtocolo" l
          WHERE (l."tarefaId" = t.id)
          ORDER BY (l.estado = 'ATUAL'::text) DESC, l.ordem DESC
         LIMIT 1) v ON (true))
     LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON ((i."exameId" = v."exameId")))
  WHERE (p.tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo");


--
-- Name: TemplateAplicacoesTablet; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."TemplateAplicacoesTablet" (
    "propriedadeId" integer NOT NULL,
    "doencaId" text NOT NULL,
    "produtoIds" text[] NOT NULL,
    "autorId" integer NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    quantidades jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "TemplateAplicacoesTablet_quantidades_objeto" CHECK ((jsonb_typeof(quantidades) = 'object'::text))
);


--
-- Name: TentativaReprodutiva; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."TentativaReprodutiva" (
    id text NOT NULL,
    "referenciaExterna" text,
    "animalId" text NOT NULL,
    "propriedadeId" integer,
    data date NOT NULL,
    origem text DEFAULT 'MANUAL'::text NOT NULL,
    status pecuaria."StatusFatoPecuariaV3" DEFAULT 'VALIDO'::pecuaria."StatusFatoPecuariaV3" NOT NULL,
    "motivoAnulacao" text,
    "anuladoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    tipo text NOT NULL,
    ciclo integer NOT NULL,
    ordem integer NOT NULL,
    "materialId" text,
    "touroId" text,
    "touroExternoId" text,
    "origemMaterial" text NOT NULL,
    quantidade numeric(14,3),
    "partidaId" text,
    "operacaoServicoId" text,
    "movimentoEstoqueId" text,
    "valorProdutoAtribuido" numeric(14,2),
    "valorServicoAtribuido" numeric(14,2),
    "geneticaSnapshot" jsonb NOT NULL,
    responsavel text,
    observacao text,
    "consumoMantido" boolean DEFAULT false NOT NULL,
    "tarefaId" text,
    CONSTRAINT "Tentativa_consumo_mantido" CHECK (((NOT "consumoMantido") OR ((("movimentoEstoqueId" IS NOT NULL) OR ("operacaoServicoId" IS NOT NULL)) AND (status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3")))),
    CONSTRAINT "Tentativa_tipo_origem" CHECK (((tipo = ANY (ARRAY['IA'::text, 'TE'::text, 'COBERTURA'::text])) AND ("origemMaterial" = ANY (ARRAY['ESTOQUE'::text, 'SERVICO'::text, 'DOCUMENTADA'::text, 'HISTORICO'::text])) AND (ciclo >= 0) AND (ordem > 0) AND ((quantidade IS NULL) OR (quantidade > (0)::numeric)) AND (("origemMaterial" <> 'HISTORICO'::text) OR ("movimentoEstoqueId" IS NULL))))
);


--
-- Name: TipoAplicacaoSanitaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."TipoAplicacaoSanitaria" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TipoExame; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."TipoExame" (
    id text NOT NULL,
    nome text NOT NULL,
    "tipoResultado" text NOT NULL,
    unidade text,
    opcoes jsonb,
    ativo boolean DEFAULT true NOT NULL,
    contexto text DEFAULT 'SANITARIO'::text NOT NULL,
    "versaoFormato" integer DEFAULT 1 NOT NULL,
    campos jsonb,
    "versaoAnteriorId" text,
    CONSTRAINT "TipoExame_contexto_check" CHECK ((contexto = ANY (ARRAY['SANITARIO'::text, 'REPRODUTIVO'::text, 'COMPARTILHADO'::text]))),
    CONSTRAINT "TipoExame_versaoFormato_check" CHECK (("versaoFormato" > 0)),
    CONSTRAINT "TipoExame_versao_check" CHECK ((("versaoFormato" > 0) AND ("versaoAnteriorId" IS DISTINCT FROM id)))
);


--
-- Name: UnidadeBancoColostro; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."UnidadeBancoColostro" (
    "destinacaoId" text,
    id text NOT NULL,
    "origemId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    codigo text NOT NULL,
    "volumeLitros" numeric(14,3) DEFAULT 2 NOT NULL,
    "dataCongelamento" date NOT NULL,
    "dataRetirada" date,
    "retiradoEm" timestamp(3) with time zone,
    status text DEFAULT 'CONGELADA'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    chave text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "UnidadeBancoColostro_estado" CHECK ((("volumeLitros" = (2)::numeric) AND (versao > 0) AND (status = ANY (ARRAY['CONGELADA'::text, 'RETIRADA'::text, 'ESTORNADA'::text])) AND (length(btrim(codigo)) > 0) AND (("dataRetirada" IS NULL) OR ("dataRetirada" >= "dataCongelamento")) AND (("retiradoEm" IS NULL) OR ((("retiradoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = "dataRetirada")) AND (((status = 'CONGELADA'::text) AND ("dataRetirada" IS NULL) AND ("retiradoEm" IS NULL)) OR ((status = 'RETIRADA'::text) AND ("dataRetirada" IS NOT NULL)) OR (status = 'ESTORNADA'::text))))
);


--
-- Name: VersaoComercialVendaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VersaoComercialVendaLeite" (
    id text NOT NULL,
    "operacaoId" text NOT NULL,
    "retiradaId" text NOT NULL,
    versao integer NOT NULL,
    chave text,
    hash text,
    motivo text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "VersaoVendaLeite_chave_hash" CHECK (((chave IS NULL) = (hash IS NULL))),
    CONSTRAINT "VersaoVendaLeite_motivo" CHECK ((length(TRIM(BOTH FROM motivo)) >= 5)),
    CONSTRAINT "VersaoVendaLeite_versao_positiva" CHECK ((versao > 0))
);


--
-- Name: VersaoSelecaoVisita; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VersaoSelecaoVisita" (
    id text NOT NULL,
    "selecaoId" text NOT NULL,
    numero integer NOT NULL,
    criterios jsonb NOT NULL,
    "versaoContrato" integer DEFAULT 1 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "VersaoSelecaoVisita_criterios" CHECK ((jsonb_typeof(criterios) = 'object'::text)),
    CONSTRAINT "VersaoSelecaoVisita_numero" CHECK (((numero > 0) AND ("versaoContrato" > 0)))
);


--
-- Name: VigenciaDietaLote; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VigenciaDietaLote" (
    id text NOT NULL,
    "loteId" text NOT NULL,
    "dietaId" text NOT NULL,
    desde date NOT NULL,
    ate date,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "VigenciaDietaLote_periodo_check" CHECK (((ate IS NULL) OR (ate > desde)))
);


--
-- Name: VinculoAtendimentoAlerta; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoAtendimentoAlerta" (
    id text NOT NULL,
    "aplicacaoId" text,
    "exameId" text,
    "necessidadeRegraId" text,
    "necessidadeProgramaId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer NOT NULL,
    CONSTRAINT "VinculoAtendimentoAlerta_fato_check" CHECK ((((("aplicacaoId" IS NOT NULL))::integer + (("exameId" IS NOT NULL))::integer) = 1)),
    CONSTRAINT "VinculoAtendimentoAlerta_necessidade_check" CHECK ((((("necessidadeRegraId" IS NOT NULL))::integer + (("necessidadeProgramaId" IS NOT NULL))::integer) = 1))
);


--
-- Name: VinculoConclusaoAcompanhamento; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoConclusaoAcompanhamento" (
    id text NOT NULL,
    "demandaId" text NOT NULL,
    fonte text NOT NULL,
    "valorSnapshot" jsonb NOT NULL,
    "resultadoId" text,
    "interpretacaoId" text,
    vigente boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "invalidadoEm" timestamp(3) without time zone,
    "invalidadoPorId" integer,
    "motivoInvalidacao" text,
    CONSTRAINT "VinculoConclusao_estado" CHECK (((vigente AND ("invalidadoEm" IS NULL) AND ("invalidadoPorId" IS NULL) AND ("motivoInvalidacao" IS NULL)) OR ((NOT vigente) AND ("invalidadoEm" IS NOT NULL) AND (length(btrim("motivoInvalidacao")) >= 5)))),
    CONSTRAINT "VinculoConclusao_fonte" CHECK ((((fonte = 'RESULTADO'::text) AND ("resultadoId" IS NOT NULL) AND ("interpretacaoId" IS NULL)) OR ((fonte = 'INTERPRETACAO'::text) AND ("resultadoId" IS NULL) AND ("interpretacaoId" IS NOT NULL))))
);


--
-- Name: VinculoFornecimentoColostragem; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoFornecimentoColostragem" (
    "acompanhamentoId" text NOT NULL,
    "fornecimentoId" text NOT NULL,
    "politicaSnapshot" jsonb,
    "motivoExcecao" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: VinculoImportacaoPecuaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoImportacaoPecuaria" (
    id text NOT NULL,
    "bancoOrigem" text NOT NULL,
    "tabelaOrigem" text NOT NULL,
    "chaveOrigem" text NOT NULL,
    "entidadeDestino" text NOT NULL,
    "destinoId" text NOT NULL,
    "hashOrigem" text NOT NULL,
    "importadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: VinculoLoteLeilaoAnimal; Type: VIEW; Schema: pecuaria; Owner: -
--

CREATE VIEW pecuaria."VinculoLoteLeilaoAnimal" AS
 SELECT evento.fonte,
    evento."idExterno",
    (lotes.lote ->> 'numero'::text) AS "numeroLote",
    registro.registro,
    registro."animalId"
   FROM ((pecuaria."EventoLeilaoExterno" evento
     CROSS JOIN LATERAL jsonb_array_elements((evento.catalogo -> 'lotes'::text)) lotes(lote))
     JOIN pecuaria."RegistroGenealogicoAnimal" registro ON ((registro.registro = (lotes.lote ->> 'registro'::text))));


--
-- Name: VinculoMedicaoEntradaLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoMedicaoEntradaLeite" (
    id text NOT NULL,
    "entradaId" text NOT NULL,
    "medicaoId" text NOT NULL,
    quantidade numeric(14,3) NOT NULL,
    "versaoMedicao" integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "VinculoMedicaoEntrada_quantidade_versao" CHECK (((quantidade > (0)::numeric) AND ("versaoMedicao" > 0)))
);


--
-- Name: VinculoPesagemParto; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoPesagemParto" (
    id text NOT NULL,
    "partoId" text NOT NULL,
    "pesagemId" text NOT NULL,
    "criaId" text,
    sujeito text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    "revogadoEm" timestamp(3) without time zone,
    "revogadoPorId" integer,
    "motivoRevogacao" text,
    CONSTRAINT "VinculoPesagemParto_revogacao" CHECK (((("revogadoEm" IS NULL) AND ("revogadoPorId" IS NULL) AND ("motivoRevogacao" IS NULL)) OR (("revogadoEm" IS NOT NULL) AND ("revogadoEm" >= "criadoEm") AND (length(btrim("motivoRevogacao")) > 0) AND ("motivoRevogacao" IS NOT NULL)))),
    CONSTRAINT "VinculoPesagemParto_sujeito" CHECK ((((sujeito = 'MATRIZ'::text) AND ("criaId" IS NULL)) OR ((sujeito = 'CRIA'::text) AND ("criaId" IS NOT NULL))))
);


--
-- Name: VinculoPesagemSecagem; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoPesagemSecagem" (
    id text NOT NULL,
    "lactacaoId" text NOT NULL,
    "pesagemId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "evidenciaSnapshot" jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer NOT NULL,
    "revogadoEm" timestamp(3) without time zone,
    "revogadoPorId" integer,
    "motivoRevogacao" text,
    CONSTRAINT "VinculoPesagemSecagem_revogacao_check" CHECK (((("revogadoEm" IS NULL) AND ("revogadoPorId" IS NULL) AND ("motivoRevogacao" IS NULL)) OR (("revogadoEm" IS NOT NULL) AND ("revogadoEm" >= "criadoEm") AND ("revogadoPorId" IS NOT NULL) AND ("motivoRevogacao" IS NOT NULL) AND (length(btrim("motivoRevogacao")) >= 5))))
);


--
-- Name: VinculoPoliticaCiclo; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoPoliticaCiclo" (
    id text NOT NULL,
    "animalId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "chaveCiclo" text NOT NULL,
    "partoId" text,
    "situacaoInicialId" text,
    "inicioCiclo" date NOT NULL,
    "politicaId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "VinculoPoliticaCiclo_chave" CHECK (((("partoId" IS NULL) AND ("situacaoInicialId" IS NOT NULL) AND ("chaveCiclo" = 'INICIAL'::text)) OR (("partoId" IS NOT NULL) AND ("situacaoInicialId" IS NULL) AND ("chaveCiclo" = ('PARTO:'::text || "partoId")))))
);


--
-- Name: VinculoPreparoTentativa; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoPreparoTentativa" (
    id text NOT NULL,
    "tentativaId" text NOT NULL,
    "aplicacaoId" text,
    "exameId" text,
    "participacaoId" text,
    modo text NOT NULL,
    "valorMaterial" numeric(14,2),
    "valorServico" numeric(14,2),
    motivo text NOT NULL,
    "criadoPorId" integer,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "encerradoEm" timestamp(3) without time zone,
    "motivoEncerramento" text,
    CONSTRAINT "Preparo_modo" CHECK ((((modo = 'INTEGRAL'::text) AND ("valorMaterial" IS NULL) AND ("valorServico" IS NULL)) OR ((modo = 'PARCELA'::text) AND (num_nonnulls("valorMaterial", "valorServico") > 0)))),
    CONSTRAINT "Preparo_motivos" CHECK (((length(TRIM(BOTH FROM motivo)) >= 5) AND (("encerradoEm" IS NULL) OR (("motivoEncerramento" IS NOT NULL) AND (length(TRIM(BOTH FROM "motivoEncerramento")) >= 5))))),
    CONSTRAINT "Preparo_um_fato" CHECK ((num_nonnulls("aplicacaoId", "exameId", "participacaoId") = 1)),
    CONSTRAINT "Preparo_valores" CHECK (((("valorMaterial" IS NULL) OR ("valorMaterial" >= (0)::numeric)) AND (("valorServico" IS NULL) OR ("valorServico" >= (0)::numeric))))
);


--
-- Name: VinculoQualidadeFechamentoLeite; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoQualidadeFechamentoLeite" (
    "fechamentoId" text NOT NULL,
    "amostraId" text NOT NULL,
    "versaoAmostra" integer NOT NULL,
    snapshot jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "VinculoQualidadeFechamentoLeite_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text)),
    CONSTRAINT "VinculoQualidadeFechamentoLeite_versaoAmostra_check" CHECK (("versaoAmostra" > 0))
);


--
-- Name: VinculoTentativaParticipacao; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VinculoTentativaParticipacao" (
    id text NOT NULL,
    "participacaoId" text NOT NULL,
    "tentativaId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    motivo text NOT NULL,
    snapshot jsonb NOT NULL,
    "criadoPorId" integer NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revogadoEm" timestamp(3) without time zone,
    "revogadoPorId" integer,
    "motivoRevogacao" text,
    CONSTRAINT "VinculoTentativaParticipacao_motivo_check" CHECK (((length(TRIM(BOTH FROM motivo)) >= 5) AND (length(TRIM(BOTH FROM motivo)) <= 1000))),
    CONSTRAINT "VinculoTentativaParticipacao_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text)),
    CONSTRAINT "VinculoTentativa_revogacao_completa" CHECK (((("revogadoEm" IS NULL) AND ("revogadoPorId" IS NULL) AND ("motivoRevogacao" IS NULL)) OR (("revogadoEm" IS NOT NULL) AND ("revogadoPorId" IS NOT NULL) AND ((length(TRIM(BOTH FROM "motivoRevogacao")) >= 5) AND (length(TRIM(BOTH FROM "motivoRevogacao")) <= 1000)))))
);


--
-- Name: VisitaVeterinaria; Type: TABLE; Schema: pecuaria; Owner: -
--

CREATE TABLE pecuaria."VisitaVeterinaria" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    data date NOT NULL,
    nome text NOT NULL,
    responsavel text,
    status text DEFAULT 'ABERTA'::text NOT NULL,
    "encerradaEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- Name: Alerta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Alerta" (
    id text NOT NULL,
    proprietario text NOT NULL,
    produtor text NOT NULL,
    tipo text NOT NULL,
    "chaveOcorrencia" text NOT NULL,
    revisao integer NOT NULL,
    ciclo text DEFAULT 'ABERTO'::text NOT NULL,
    situacao text NOT NULL,
    "propriedadeId" integer,
    "origemId" text NOT NULL,
    "sujeitoTipo" text NOT NULL,
    "sujeitoId" text NOT NULL,
    "chaveAgrupamento" text NOT NULL,
    titulo text NOT NULL,
    motivo text NOT NULL,
    resumo jsonb NOT NULL,
    "snapshotInicial" jsonb NOT NULL,
    "dataReferencia" date,
    "visivelDesde" date,
    prazo date,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Alerta_ciclo_check" CHECK ((ciclo = ANY (ARRAY['ABERTO'::text, 'ENCERRADO'::text, 'INVALIDADO'::text]))),
    CONSTRAINT "Alerta_revisao_check" CHECK ((revisao > 0))
);


--
-- Name: AlocacaoPartidaEstoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AlocacaoPartidaEstoque" (
    id text NOT NULL,
    "movimentoEstoqueId" text NOT NULL,
    "partidaId" text NOT NULL,
    quantidade numeric(12,3) NOT NULL
);


--
-- Name: AssinaturaRadarAssistente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssinaturaRadarAssistente" (
    chave text NOT NULL,
    "usuarioId" integer NOT NULL,
    "propriedadeId" integer,
    permissoes text NOT NULL,
    "ultimoUso" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: AuditoriaFinanceira; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditoriaFinanceira" (
    id text NOT NULL,
    entidade text NOT NULL,
    "entidadeId" text NOT NULL,
    acao text NOT NULL,
    motivo text,
    "estadoAnterior" jsonb,
    "estadoPosterior" jsonb,
    "usuarioId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AvaliacaoAlertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AvaliacaoAlertas" (
    id text NOT NULL,
    produtor text NOT NULL,
    estado text DEFAULT 'NAO_AVALIADO'::text NOT NULL,
    "diaCoberto" date,
    "ultimaConclusao" timestamp(3) without time zone,
    erro text,
    cursor text,
    posse text,
    "posseAte" timestamp(3) without time zone,
    versao integer DEFAULT 0 NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: BaseValorizacaoEstoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BaseValorizacaoEstoque" (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "partidaId" text,
    "baseOrigemId" text,
    "origemMovimentoId" text,
    metodo text NOT NULL,
    "disponivelDesde" date NOT NULL,
    "corteAbertura" date,
    ordem integer NOT NULL,
    "quantidadeAbertura" numeric(12,3) DEFAULT 0 NOT NULL,
    "valorAbertura" numeric(14,2) DEFAULT 0 NOT NULL,
    "aberturaDocumentada" jsonb,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "BaseValorizacao_abertura" CHECK ((("quantidadeAbertura" >= (0)::numeric) AND ("valorAbertura" >= (0)::numeric) AND (("quantidadeAbertura" > (0)::numeric) OR ("valorAbertura" = (0)::numeric)) AND ((("quantidadeAbertura" = (0)::numeric) AND ("valorAbertura" = (0)::numeric)) OR ("aberturaDocumentada" IS NOT NULL)))),
    CONSTRAINT "BaseValorizacao_metodo" CHECK ((((metodo = ANY (ARRAY['MEDIA_SALDO_V1'::text, 'CAMADAS_AQUISICAO_V2'::text])) AND ("partidaId" IS NOT NULL)) OR ((metodo = 'FIFO_AQUISICAO_V1'::text) AND ("partidaId" IS NULL))))
);


--
-- Name: BaseValorizacaoEstoque_ordem_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BaseValorizacaoEstoque_ordem_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BaseValorizacaoEstoque_ordem_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BaseValorizacaoEstoque_ordem_seq" OWNED BY public."BaseValorizacaoEstoque".ordem;


--
-- Name: Categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Categoria" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    "usoGenetico" boolean DEFAULT false NOT NULL,
    "usoNutricional" boolean DEFAULT false NOT NULL,
    "usoSanitario" boolean DEFAULT false NOT NULL,
    "grupoId" text
);


--
-- Name: CentroCusto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CentroCusto" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


--
-- Name: ClassificacaoTecnicaProduto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClassificacaoTecnicaProduto" (
    id uuid NOT NULL,
    nome character varying(160) NOT NULL,
    "nomeNormalizado" text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "codigoOrigem" text NOT NULL,
    CONSTRAINT "ClassificacaoTecnicaProduto_nome_check" CHECK ((((char_length(btrim((nome)::text)) >= 2) AND (char_length(btrim((nome)::text)) <= 160)) AND ("nomeNormalizado" = public.normalizar_nome_produto_v1((nome)::text))))
);


--
-- Name: CompromissoFinanceiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompromissoFinanceiro" (
    id text NOT NULL,
    "operacaoId" text NOT NULL,
    tipo public."TipoCompromisso" NOT NULL,
    status public."StatusCompromisso" DEFAULT 'PENDENTE'::public."StatusCompromisso" NOT NULL,
    "valorOriginal" numeric(14,2) NOT NULL,
    "dataVencimento" date NOT NULL,
    "numeroParcela" integer,
    "totalParcelas" integer,
    "parceiroId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    seq integer NOT NULL
);


--
-- Name: CompromissoFinanceiro_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CompromissoFinanceiro_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CompromissoFinanceiro_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CompromissoFinanceiro_seq_seq" OWNED BY public."CompromissoFinanceiro".seq;


--
-- Name: ContaFinanceira; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContaFinanceira" (
    id text NOT NULL,
    nome text NOT NULL,
    tipo public."TipoContaFinanceira" NOT NULL,
    instituicao text,
    identificacao text,
    "tipoBancario" public."TipoBancario",
    agencia text,
    "numeroConta" text,
    digito text,
    titular text,
    local text,
    responsavel text,
    observacoes text,
    ordem integer DEFAULT 0 NOT NULL,
    "saldoAbertura" numeric(14,2) DEFAULT 0 NOT NULL,
    "dataSaldoAbertura" date NOT NULL,
    "incluirNoSaldoGeral" boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "propriedadeId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ConversaAssistente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConversaAssistente" (
    id uuid NOT NULL,
    "usuarioId" integer NOT NULL,
    "propriedadeId" integer,
    permissoes text NOT NULL,
    revisao bigint DEFAULT 0 NOT NULL,
    titulo text NOT NULL,
    mensagens jsonb NOT NULL,
    "atualizadoEm" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "ConversaAssistente_mensagens_check" CHECK ((jsonb_typeof(mensagens) = 'array'::text))
);


--
-- Name: ConversaWhatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConversaWhatsapp" (
    id integer NOT NULL,
    "usuarioId" integer,
    telefone text NOT NULL,
    "ultimaAtividade" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ConversaWhatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ConversaWhatsapp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ConversaWhatsapp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ConversaWhatsapp_id_seq" OWNED BY public."ConversaWhatsapp".id;


--
-- Name: DocumentoFinanceiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentoFinanceiro" (
    id text NOT NULL,
    tipo public."TipoDocumentoFinanceiro" NOT NULL,
    nome text NOT NULL,
    numero text,
    "storageDriver" text,
    bucket text,
    "storageKey" text,
    "mimeType" text,
    "tamanhoBytes" integer,
    sha256 text,
    "operacaoId" text,
    "transacaoId" text,
    "compromissoId" text,
    "rascunhoId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EventoAlerta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EventoAlerta" (
    id text NOT NULL,
    "alertaId" text NOT NULL,
    revisao integer NOT NULL,
    "eventoId" text NOT NULL,
    comando text NOT NULL,
    hash text NOT NULL,
    payload jsonb NOT NULL,
    "autorUsuarioId" integer,
    "autorTecnico" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "EventoAlerta_autoria_check" CHECK ((((("autorUsuarioId" IS NOT NULL))::integer + (("autorTecnico" IS NOT NULL))::integer) = 1)),
    CONSTRAINT "EventoAlerta_revisao_check" CHECK ((revisao > 0))
);


--
-- Name: EventoMetaAssistente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EventoMetaAssistente" (
    "metaId" uuid NOT NULL,
    revisao integer NOT NULL,
    "operacaoId" uuid NOT NULL,
    "hashPedido" text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "usuarioId" integer NOT NULL,
    dominio text NOT NULL,
    tipo text NOT NULL,
    conteudo jsonb NOT NULL,
    "criadoEm" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "EventoMetaAssistente_conteudo_check" CHECK ((jsonb_typeof(conteudo) = 'object'::text)),
    CONSTRAINT "EventoMetaAssistente_dominio_check" CHECK ((dominio = ANY (ARRAY['pecuaria'::text, 'financeiro'::text]))),
    CONSTRAINT "EventoMetaAssistente_revisao_check" CHECK ((revisao > 0)),
    CONSTRAINT "EventoMetaAssistente_tipo_check" CHECK ((tipo = ANY (ARRAY['definicao'::text, 'medicao'::text])))
);


--
-- Name: FabricanteProduto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FabricanteProduto" (
    id uuid NOT NULL,
    nome character varying(160) NOT NULL,
    "nomeNormalizado" text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "codigoOrigem" text NOT NULL,
    CONSTRAINT "FabricanteProduto_nome_check" CHECK ((((char_length(btrim((nome)::text)) >= 2) AND (char_length(btrim((nome)::text)) <= 160)) AND ("nomeNormalizado" = public.normalizar_nome_produto_v1((nome)::text))))
);


--
-- Name: GrupoCategoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GrupoCategoria" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


--
-- Name: ItemOperacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ItemOperacao" (
    "categoriaId" text,
    "categoriaNome" text,
    "centroCustoId" text,
    "centroCustoNome" text,
    id text NOT NULL,
    "operacaoId" text NOT NULL,
    "produtoId" text,
    descricao text NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    unidade text NOT NULL,
    "valorUnitario" numeric(14,4) NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    estocavel boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ordem integer NOT NULL,
    "partidasSnapshot" jsonb,
    "animalId" text,
    "embalagemSnapshot" jsonb,
    CONSTRAINT "ItemOperacao_animal_sem_estoque" CHECK ((("animalId" IS NULL) OR (("produtoId" IS NULL) AND (estocavel = false))))
);


--
-- Name: Liquidacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Liquidacao" (
    id text NOT NULL,
    "compromissoId" text NOT NULL,
    "transacaoId" text NOT NULL,
    valor numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MensagemWhatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MensagemWhatsapp" (
    id integer NOT NULL,
    "conversaId" integer NOT NULL,
    "waMessageId" text,
    direcao public."DirecaoMensagem" NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    texto text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MensagemWhatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MensagemWhatsapp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MensagemWhatsapp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MensagemWhatsapp_id_seq" OWNED BY public."MensagemWhatsapp".id;


--
-- Name: MovimentoConta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MovimentoConta" (
    id text NOT NULL,
    "transacaoId" text NOT NULL,
    "contaId" text NOT NULL,
    direcao public."DirecaoMovimentoConta" NOT NULL,
    valor numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq integer NOT NULL
);


--
-- Name: MovimentoConta_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MovimentoConta_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MovimentoConta_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MovimentoConta_seq_seq" OWNED BY public."MovimentoConta".seq;


--
-- Name: MovimentoEstoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MovimentoEstoque" (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    tipo public."TipoMovimento" NOT NULL,
    origem public."OrigemMovimentoEstoque" NOT NULL,
    status public."StatusMovimentoEstoque" DEFAULT 'CONFIRMADO'::public."StatusMovimentoEstoque" NOT NULL,
    data date NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    "custoUnitario" numeric(14,4),
    "valorTotal" numeric(14,2),
    "operacaoId" text,
    "itemOperacaoId" text,
    "propriedadeId" integer,
    "criadoPorId" integer,
    "centroCustoId" text,
    "reversaoDeId" text,
    observacao text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    seq integer NOT NULL,
    "metodoValorizacao" text DEFAULT 'LEGADO'::text NOT NULL,
    "evidenciaValor" jsonb,
    CONSTRAINT "MovimentoEstoque_valor_pendente_leite" CHECK (((("metodoValorizacao" = 'LEITE_FIFO_V1'::text) AND ((("custoUnitario" IS NULL) AND ("valorTotal" IS NULL)) OR (("custoUnitario" IS NOT NULL) AND ("valorTotal" IS NOT NULL)))) OR (("metodoValorizacao" <> 'LEITE_FIFO_V1'::text) AND ("custoUnitario" IS NOT NULL) AND ("valorTotal" IS NOT NULL))))
);


--
-- Name: MovimentoEstoque_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MovimentoEstoque_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MovimentoEstoque_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MovimentoEstoque_seq_seq" OWNED BY public."MovimentoEstoque".seq;


--
-- Name: Operacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Operacao" (
    "categoriaNome" text,
    id text NOT NULL,
    tipo public."TipoOperacaoFinanceira" NOT NULL,
    status public."StatusOperacao" DEFAULT 'RASCUNHO'::public."StatusOperacao" NOT NULL,
    data date NOT NULL,
    descricao text,
    "valorTotal" numeric(14,2) NOT NULL,
    "propriedadeId" integer NOT NULL,
    "parceiroId" text,
    "categoriaId" text,
    "centroCustoId" text,
    "corrigeOperacaoId" text,
    "criadoPorId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    numero integer NOT NULL,
    "composicaoComercial" jsonb
);


--
-- Name: Operacao_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Operacao_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Operacao_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Operacao_numero_seq" OWNED BY public."Operacao".numero;


--
-- Name: Parceiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Parceiro" (
    id text NOT NULL,
    nome text NOT NULL,
    documento text,
    tipo public."TipoParceiro" DEFAULT 'FORNECEDOR'::public."TipoParceiro" NOT NULL,
    telefone text,
    email text,
    "nomeFantasia" text,
    "pessoaContato" text,
    "telefoneWhatsapp" boolean DEFAULT false NOT NULL,
    cep text,
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    cidade text,
    uf text,
    referencia text,
    observacoes text,
    "formaPagamentoPreferida" public."FormaPagamento",
    "condicaoPagamentoPreferida" text,
    "prazosPagamento" integer[] DEFAULT ARRAY[]::integer[],
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "intervaloPagamentoDias" integer,
    CONSTRAINT "Parceiro_intervaloPagamentoDias_check" CHECK ((("intervaloPagamentoDias" IS NULL) OR (("intervaloPagamentoDias" >= 1) AND ("intervaloPagamentoDias" <= 3650))))
);


--
-- Name: ParceiroPapel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ParceiroPapel" (
    "parceiroId" text NOT NULL,
    papel public."PapelParceiro" NOT NULL
);


--
-- Name: ParcelaValorizacaoEstoque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ParcelaValorizacaoEstoque" (
    id text NOT NULL,
    "movimentoEstoqueId" text NOT NULL,
    "baseId" text NOT NULL,
    ordem integer NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    CONSTRAINT "ParcelaValorizacao_sinal" CHECK (((quantidade <> (0)::numeric) AND (((quantidade > (0)::numeric) AND ("valorTotal" >= (0)::numeric)) OR ((quantidade < (0)::numeric) AND ("valorTotal" <= (0)::numeric)))))
);


--
-- Name: PartidaProduto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartidaProduto" (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    codigo text NOT NULL,
    validade date,
    fabricante text,
    "origemRastreio" text DEFAULT 'INFORMADA'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    nome text,
    "lotePrincipalId" text
);


--
-- Name: PeriodoFinanceiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PeriodoFinanceiro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    ano integer NOT NULL,
    mes integer NOT NULL,
    status public."StatusPeriodoFinanceiro" DEFAULT 'ABERTO'::public."StatusPeriodoFinanceiro" NOT NULL,
    "fechadoEm" timestamp(3) without time zone,
    "fechadoPorId" integer,
    observacao text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PrincipioAtivo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PrincipioAtivo" (
    id uuid NOT NULL,
    nome character varying(100) NOT NULL,
    "nomeNormalizado" text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "codigoOrigem" text NOT NULL,
    CONSTRAINT "PrincipioAtivo_nome_check" CHECK ((((char_length(btrim((nome)::text)) >= 2) AND (char_length(btrim((nome)::text)) <= 100)) AND ("nomeNormalizado" = public.normalizar_nome_produto_v1((nome)::text))))
);


--
-- Name: Produto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Produto" (
    id text NOT NULL,
    nome text NOT NULL,
    unidade public."UnidadeMedida" DEFAULT 'UN'::public."UnidadeMedida" NOT NULL,
    "minimoEstoque" numeric(12,2),
    ativo boolean DEFAULT true NOT NULL,
    "categoriaId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "rastrearPartidas" boolean DEFAULT false NOT NULL,
    "usoGenetico" boolean DEFAULT false NOT NULL,
    "usoSanitario" boolean DEFAULT false NOT NULL,
    "usoNutricional" boolean DEFAULT false NOT NULL,
    apresentacao character varying(200),
    "classificacaoTecnicaId" uuid,
    "codigoReferencia" character varying(80),
    conservacao character varying(1000),
    "fabricanteId" uuid,
    observacao character varying(2000),
    "nomeAlterado" boolean DEFAULT false NOT NULL,
    "produtoCatalogoId" uuid
);


--
-- Name: ProdutoCatalogo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProdutoCatalogo" (
    id uuid NOT NULL,
    fonte character varying(40) NOT NULL,
    "codigoOrigem" text NOT NULL,
    nome character varying(200) NOT NULL,
    "nomeNormalizado" text NOT NULL,
    apresentacao character varying(200),
    "fabricanteId" uuid,
    "classificacaoTecnicaId" uuid,
    "unidadeSugerida" public."UnidadeMedida" DEFAULT 'UN'::public."UnidadeMedida" NOT NULL,
    "usoSanitario" boolean DEFAULT false NOT NULL,
    "usoNutricional" boolean DEFAULT false NOT NULL,
    "usoGenetico" boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "versaoCatalogo" integer NOT NULL,
    "atualizadoEm" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "conteudoEmbalagem" numeric(12,3),
    "rotuloEmbalagem" text,
    "orientacaoBula" jsonb,
    "conferenciaBula" jsonb,
    CONSTRAINT "ProdutoCatalogo_conferencia_bula_objeto" CHECK ((("conferenciaBula" IS NULL) OR (jsonb_typeof("conferenciaBula") = 'object'::text))),
    CONSTRAINT "ProdutoCatalogo_conteudo_positivo" CHECK ((("conteudoEmbalagem" IS NULL) OR ("conteudoEmbalagem" > (0)::numeric))),
    CONSTRAINT "ProdutoCatalogo_nome_check" CHECK ((((char_length(btrim((nome)::text)) >= 2) AND (char_length(btrim((nome)::text)) <= 200)) AND ("nomeNormalizado" = public.normalizar_nome_produto_v1((nome)::text)) AND ("versaoCatalogo" > 0)))
);


--
-- Name: ProdutoCatalogoPrincipioAtivo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProdutoCatalogoPrincipioAtivo" (
    "produtoCatalogoId" uuid NOT NULL,
    "principioAtivoId" uuid NOT NULL,
    ordem integer NOT NULL,
    CONSTRAINT "ProdutoCatalogoPrincipioAtivo_ordem_check" CHECK ((ordem > 0))
);


--
-- Name: ProdutoCentroCusto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProdutoCentroCusto" (
    "produtoId" text NOT NULL,
    "centroCustoId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProdutoFornecedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProdutoFornecedor" (
    "produtoId" text NOT NULL,
    "fornecedorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Propriedade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Propriedade" (
    id integer NOT NULL,
    nome text NOT NULL,
    apelido text,
    cidade text,
    uf text,
    principal boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Propriedade_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Propriedade_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Propriedade_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Propriedade_id_seq" OWNED BY public."Propriedade".id;


--
-- Name: RascunhoOperacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RascunhoOperacao" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "criadoPorId" integer NOT NULL,
    dados jsonb NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RascunhoRelatorioFinanceiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RascunhoRelatorioFinanceiro" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    "criadoPorId" integer NOT NULL,
    configuracao jsonb NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RelatorioFinanceiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RelatorioFinanceiro" (
    id text NOT NULL,
    nome text NOT NULL,
    status public."StatusRelatorioFinanceiro" DEFAULT 'PROCESSANDO'::public."StatusRelatorioFinanceiro" NOT NULL,
    parametros jsonb NOT NULL,
    snapshot jsonb,
    "storageKey" text,
    erro text,
    "propriedadeId" integer NOT NULL,
    "autorId" integer,
    "autorNome" text NOT NULL,
    "geradoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "concluidoEm" timestamp(3) without time zone
);


--
-- Name: Sessao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Sessao" (
    id text NOT NULL,
    "usuarioId" integer NOT NULL,
    "tokenHash" text NOT NULL,
    "expiraEm" timestamp(3) without time zone NOT NULL,
    "ultimoUso" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userAgent" text,
    "criadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SnapshotRadarAssistente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SnapshotRadarAssistente" (
    chave text NOT NULL,
    dia date NOT NULL,
    "usuarioId" integer NOT NULL,
    "criadoEm" timestamp with time zone DEFAULT now() NOT NULL,
    conteudo jsonb,
    "iaReservada" boolean DEFAULT false NOT NULL
);


--
-- Name: TokenAcesso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TokenAcesso" (
    id text NOT NULL,
    "usuarioId" integer NOT NULL,
    tipo public."TipoToken" NOT NULL,
    "tokenHash" text NOT NULL,
    "expiraEm" timestamp(3) without time zone NOT NULL,
    "usadoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TransacaoFinanceira; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TransacaoFinanceira" (
    id text NOT NULL,
    tipo public."TipoTransacaoFinanceira" NOT NULL,
    status public."StatusTransacaoFinanceira" DEFAULT 'CONFIRMADA'::public."StatusTransacaoFinanceira" NOT NULL,
    data date NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    "formaPagamento" public."FormaPagamento",
    descricao text,
    "operacaoId" text,
    "parceiroId" text,
    "propriedadeId" integer NOT NULL,
    "criadoPorId" integer,
    "reversaoDeId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    seq integer NOT NULL
);


--
-- Name: TransacaoFinanceira_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TransacaoFinanceira_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TransacaoFinanceira_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TransacaoFinanceira_seq_seq" OWNED BY public."TransacaoFinanceira".seq;


--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Usuario" (
    id integer NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    "senhaHash" text,
    papel text NOT NULL,
    abas text[],
    areas text[] DEFAULT ARRAY['financeiro'::text, 'pecuaria'::text],
    flags text[],
    status public."StatusUsuario" DEFAULT 'PENDENTE'::public."StatusUsuario" NOT NULL,
    dono boolean DEFAULT false NOT NULL,
    "ultimoAcesso" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UsuarioWhatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsuarioWhatsapp" (
    id integer NOT NULL,
    telefone text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UsuarioWhatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UsuarioWhatsapp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UsuarioWhatsapp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UsuarioWhatsapp_id_seq" OWNED BY public."UsuarioWhatsapp".id;


--
-- Name: Usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Usuario_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Usuario_id_seq" OWNED BY public."Usuario".id;


--
-- Name: BaseValorizacaoEstoque ordem; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque" ALTER COLUMN ordem SET DEFAULT nextval('public."BaseValorizacaoEstoque_ordem_seq"'::regclass);


--
-- Name: CompromissoFinanceiro seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompromissoFinanceiro" ALTER COLUMN seq SET DEFAULT nextval('public."CompromissoFinanceiro_seq_seq"'::regclass);


--
-- Name: ConversaWhatsapp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversaWhatsapp" ALTER COLUMN id SET DEFAULT nextval('public."ConversaWhatsapp_id_seq"'::regclass);


--
-- Name: MensagemWhatsapp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MensagemWhatsapp" ALTER COLUMN id SET DEFAULT nextval('public."MensagemWhatsapp_id_seq"'::regclass);


--
-- Name: MovimentoConta seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoConta" ALTER COLUMN seq SET DEFAULT nextval('public."MovimentoConta_seq_seq"'::regclass);


--
-- Name: MovimentoEstoque seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque" ALTER COLUMN seq SET DEFAULT nextval('public."MovimentoEstoque_seq_seq"'::regclass);


--
-- Name: Operacao numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao" ALTER COLUMN numero SET DEFAULT nextval('public."Operacao_numero_seq"'::regclass);


--
-- Name: Propriedade id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Propriedade" ALTER COLUMN id SET DEFAULT nextval('public."Propriedade_id_seq"'::regclass);


--
-- Name: TransacaoFinanceira seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira" ALTER COLUMN seq SET DEFAULT nextval('public."TransacaoFinanceira_seq_seq"'::regclass);


--
-- Name: Usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Usuario" ALTER COLUMN id SET DEFAULT nextval('public."Usuario_id_seq"'::regclass);


--
-- Name: UsuarioWhatsapp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsuarioWhatsapp" ALTER COLUMN id SET DEFAULT nextval('public."UsuarioWhatsapp_id_seq"'::regclass);


--
-- Name: AcompanhamentoColostragem AcompanhamentoColostragem_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AcompanhamentoColostragem"
    ADD CONSTRAINT "AcompanhamentoColostragem_pkey" PRIMARY KEY (id);


--
-- Name: AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_pkey" PRIMARY KEY (id);


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_pkey" PRIMARY KEY (id);


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeiteEstoque_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_pkey" PRIMARY KEY (id);


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_exameAnimalId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_exameAnimalId_key" UNIQUE ("exameAnimalId");


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_pkey" PRIMARY KEY (id);


--
-- Name: Animal Animal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_pkey" PRIMARY KEY (id);


--
-- Name: AplicacaoProduto AplicacaoProduto_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_pkey" PRIMARY KEY (id);


--
-- Name: ApropriacaoValorLeite ApropriacaoValorLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ApropriacaoValorLeite"
    ADD CONSTRAINT "ApropriacaoValorLeite_pkey" PRIMARY KEY (id);


--
-- Name: ApuracaoValorLeite ApuracaoValorLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ApuracaoValorLeite"
    ADD CONSTRAINT "ApuracaoValorLeite_pkey" PRIMARY KEY (id);


--
-- Name: AtividadeVisita AtividadeVisita_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AtividadeVisita"
    ADD CONSTRAINT "AtividadeVisita_pkey" PRIMARY KEY (id);


--
-- Name: AuditoriaPecuaria AuditoriaPecuaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_pkey" PRIMARY KEY (id);


--
-- Name: AutomacaoProtocolo AutomacaoProtocolo_participacaoId_momentoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AutomacaoProtocolo"
    ADD CONSTRAINT "AutomacaoProtocolo_participacaoId_momentoId_key" UNIQUE ("participacaoId", "momentoId");


--
-- Name: AutomacaoProtocolo AutomacaoProtocolo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AutomacaoProtocolo"
    ADD CONSTRAINT "AutomacaoProtocolo_pkey" PRIMARY KEY (id);


--
-- Name: InterpretacaoReprodutiva AvaliacaoReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: BaixaAnimal BaixaAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_pkey" PRIMARY KEY (id);


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacaoReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CatalogoAvaliacaoReprodutiva"
    ADD CONSTRAINT "CatalogoAvaliacaoReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacaoReprodutiva_propriedadeId_versao_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CatalogoAvaliacaoReprodutiva"
    ADD CONSTRAINT "CatalogoAvaliacaoReprodutiva_propriedadeId_versao_key" UNIQUE ("propriedadeId", versao);


--
-- Name: CategoriaAnimal CategoriaAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CategoriaAnimal"
    ADD CONSTRAINT "CategoriaAnimal_pkey" PRIMARY KEY (id);


--
-- Name: CategoriaManualAnimal CategoriaManualAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_pkey" PRIMARY KEY (id);


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_aplicacaoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_aplicacaoId_key" UNIQUE ("aplicacaoId");


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_exameId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_exameId_key" UNIQUE ("exameId");


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_manejoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_manejoId_key" UNIQUE ("manejoId");


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoConsumoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoConsumoId_key" UNIQUE ("participacaoConsumoId");


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoDiariaId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoDiariaId_key" UNIQUE ("participacaoDiariaId");


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoId_key" UNIQUE ("participacaoId");


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_pkey" PRIMARY KEY (id);


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_tentativaId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_tentativaId_key" UNIQUE ("tentativaId");


--
-- Name: ClassificacaoEntradaLeite ClassificacaoEntradaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoEntradaLeite"
    ADD CONSTRAINT "ClassificacaoEntradaLeite_pkey" PRIMARY KEY (id);


--
-- Name: ColeiraBezerreiro ColeiraBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ColeiraBezerreiro"
    ADD CONSTRAINT "ColeiraBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: ComposicaoGenitorExterno ComposicaoGenitorExterno_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoGenitorExterno"
    ADD CONSTRAINT "ComposicaoGenitorExterno_pkey" PRIMARY KEY (id);


--
-- Name: ComposicaoRacial ComposicaoRacial_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_pkey" PRIMARY KEY (id);


--
-- Name: ComprovanteEntregaLeite ComprovanteEntregaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComprovanteEntregaLeite"
    ADD CONSTRAINT "ComprovanteEntregaLeite_pkey" PRIMARY KEY (id);


--
-- Name: ComprovanteRetiradaOperacaoLeite ComprovanteRetiradaOperacaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComprovanteRetiradaOperacaoLeite"
    ADD CONSTRAINT "ComprovanteRetiradaOperacaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: ConferenciaEntregaLeite ConferenciaEntregaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConferenciaEntregaLeite"
    ADD CONSTRAINT "ConferenciaEntregaLeite_pkey" PRIMARY KEY (id);


--
-- Name: ConferenciaSaldoLeite ConferenciaSaldoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConferenciaSaldoLeite"
    ADD CONSTRAINT "ConferenciaSaldoLeite_pkey" PRIMARY KEY (id);


--
-- Name: ConfiguracaoBezerreiro ConfiguracaoBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoBezerreiro"
    ADD CONSTRAINT "ConfiguracaoBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: ConfiguracaoNutricao ConfiguracaoNutricao_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoNutricao"
    ADD CONSTRAINT "ConfiguracaoNutricao_pkey" PRIMARY KEY (id);


--
-- Name: ConfiguracaoOrdenha ConfiguracaoOrdenha_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoOrdenha"
    ADD CONSTRAINT "ConfiguracaoOrdenha_pkey" PRIMARY KEY (id);


--
-- Name: ConsumoDiario ConsumoDiario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConsumoDiario"
    ADD CONSTRAINT "ConsumoDiario_pkey" PRIMARY KEY (id);


--
-- Name: ControleHistoricoLeite ControleHistoricoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ControleHistoricoLeite"
    ADD CONSTRAINT "ControleHistoricoLeite_pkey" PRIMARY KEY (id);


--
-- Name: CriaParto CriaParto_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CriaParto"
    ADD CONSTRAINT "CriaParto_pkey" PRIMARY KEY (id);


--
-- Name: DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_pkey" PRIMARY KEY (id);


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_demandaId_chave_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoOperacionalAcompanhamento"
    ADD CONSTRAINT "DecisaoOperacionalAcompanhamento_demandaId_chave_key" UNIQUE ("demandaId", chave);


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoOperacionalAcompanhamento"
    ADD CONSTRAINT "DecisaoOperacionalAcompanhamento_pkey" PRIMARY KEY (id);


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutiv_vinculoConclusaoResolucaoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutiv_vinculoConclusaoResolucaoId_key" UNIQUE ("vinculoConclusaoResolucaoId");


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_decisaoOperacionalId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_decisaoOperacionalId_key" UNIQUE ("decisaoOperacionalId");


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_exameResolucaoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_exameResolucaoId_key" UNIQUE ("exameResolucaoId");


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_pkey" PRIMARY KEY (id);


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_tarefaId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_tarefaId_key" UNIQUE ("tarefaId");


--
-- Name: DemonstrativoLeite DemonstrativoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemonstrativoLeite"
    ADD CONSTRAINT "DemonstrativoLeite_pkey" PRIMARY KEY (id);


--
-- Name: DescarteLeite DescarteLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_pkey" PRIMARY KEY (id);


--
-- Name: DestinacaoColostro DestinacaoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinacaoColostro"
    ADD CONSTRAINT "DestinacaoColostro_pkey" PRIMARY KEY (id);


--
-- Name: DestinoInternoLeite DestinoInternoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_pkey" PRIMARY KEY (id);


--
-- Name: DetalheFechamentoLeite DetalheFechamentoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DetalheFechamentoLeite"
    ADD CONSTRAINT "DetalheFechamentoLeite_pkey" PRIMARY KEY (id);


--
-- Name: DiaProducaoLeite DiaProducaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DiaProducaoLeite"
    ADD CONSTRAINT "DiaProducaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: Dieta Dieta_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Dieta"
    ADD CONSTRAINT "Dieta_pkey" PRIMARY KEY (id);


--
-- Name: Doenca Doenca_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Doenca"
    ADD CONSTRAINT "Doenca_pkey" PRIMARY KEY (id);


--
-- Name: EmissaoRelatorioLeite EmissaoRelatorioLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EmissaoRelatorioLeite"
    ADD CONSTRAINT "EmissaoRelatorioLeite_pkey" PRIMARY KEY (id);


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: EntregaLeite EntregaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_pkey" PRIMARY KEY (id);


--
-- Name: EnvioAplicacoesTablet EnvioAplicacoesTablet_corrigeId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EnvioAplicacoesTablet"
    ADD CONSTRAINT "EnvioAplicacoesTablet_corrigeId_key" UNIQUE ("corrigeId");


--
-- Name: EnvioAplicacoesTablet EnvioAplicacoesTablet_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EnvioAplicacoesTablet"
    ADD CONSTRAINT "EnvioAplicacoesTablet_pkey" PRIMARY KEY (id);


--
-- Name: EtapaProtocolo EtapaProtocoloSanitario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- Name: EventoLeilaoExterno EventoLeilaoExterno_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EventoLeilaoExterno"
    ADD CONSTRAINT "EventoLeilaoExterno_pkey" PRIMARY KEY (fonte, "idExterno");


--
-- Name: EventoTarefaProtocolo EventoTarefaProtocolo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_pkey" PRIMARY KEY (id);


--
-- Name: ExameAnimal ExameAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_pkey" PRIMARY KEY (id);


--
-- Name: ExameImunidadeColostragem ExameImunidadeColostragem_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameImunidadeColostragem"
    ADD CONSTRAINT "ExameImunidadeColostragem_pkey" PRIMARY KEY (id);


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- Name: ExposicaoTouro ExposicaoTouro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_pkey" PRIMARY KEY (id);


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FaseBezerreiroVersao"
    ADD CONSTRAINT "FaseBezerreiroVersao_pkey" PRIMARY KEY (id);


--
-- Name: FechamentoConsumo FechamentoConsumo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_pkey" PRIMARY KEY (id);


--
-- Name: FechamentoConsumo FechamentoConsumo_sem_sobreposicao; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_sem_sobreposicao" EXCLUDE USING gist ("loteId" WITH =, daterange(inicio, (fim + 1), '[)'::text) WITH &&) WHERE ((status = 'CONFIRMADO'::pecuaria."StatusFechamentoConsumo"));


--
-- Name: FechamentoOperacaoLeite FechamentoOperacaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoOperacaoLeite"
    ADD CONSTRAINT "FechamentoOperacaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: FinalidadeAnimal FinalidadeAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FinalidadeAnimal"
    ADD CONSTRAINT "FinalidadeAnimal_pkey" PRIMARY KEY (id);


--
-- Name: FormatoQualidadeLeite FormatoQualidadeLeite_chave_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FormatoQualidadeLeite"
    ADD CONSTRAINT "FormatoQualidadeLeite_chave_key" UNIQUE (chave);


--
-- Name: FormatoQualidadeLeite FormatoQualidadeLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FormatoQualidadeLeite"
    ADD CONSTRAINT "FormatoQualidadeLeite_pkey" PRIMARY KEY ("tipoExameId");


--
-- Name: FornecimentoColostro FornecimentoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_pkey" PRIMARY KEY (id);


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_itemId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_itemId_key" UNIQUE ("itemId");


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_pkey" PRIMARY KEY (id);


--
-- Name: GenitorExterno GenitorExterno_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GenitorExterno"
    ADD CONSTRAINT "GenitorExterno_pkey" PRIMARY KEY (id);


--
-- Name: GestacaoAnimal GestacaoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: GestacaoAnimal Gestacao_perda_explicada; Type: CHECK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "Gestacao_perda_explicada" CHECK ((("tipoEncerramento" IS DISTINCT FROM 'PERDA'::text) OR (("motivoEncerramento" IS NOT NULL) AND (length(TRIM(BOTH FROM "motivoEncerramento")) >= 5)))) NOT VALID;


--
-- Name: GrupoOfertaBezerreiro GrupoOfertaBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GrupoOfertaBezerreiro"
    ADD CONSTRAINT "GrupoOfertaBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: HistoricoPrevisaoParto HistoricoPrevisaoParto_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."HistoricoPrevisaoParto"
    ADD CONSTRAINT "HistoricoPrevisaoParto_pkey" PRIMARY KEY (id);


--
-- Name: ImpressaoVisita ImpressaoVisita_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ImpressaoVisita"
    ADD CONSTRAINT "ImpressaoVisita_pkey" PRIMARY KEY (id);


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InsumoPreparoColostro"
    ADD CONSTRAINT "InsumoPreparoColostro_pkey" PRIMARY KEY (id);


--
-- Name: ItemConsumoDiario ItemConsumoDiario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemConsumoDiario"
    ADD CONSTRAINT "ItemConsumoDiario_pkey" PRIMARY KEY (id);


--
-- Name: ItemDieta ItemDieta_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemDieta"
    ADD CONSTRAINT "ItemDieta_pkey" PRIMARY KEY (id);


--
-- Name: ItemFechamentoConsumo ItemFechamentoConsumo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_pkey" PRIMARY KEY (id);


--
-- Name: LactacaoAnimal LactacaoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: LactacaoAnimal LactacaoAnimal_sem_sobreposicao; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_sem_sobreposicao" EXCLUDE USING gist ("animalId" WITH =, daterange(inicio,
CASE
    WHEN ("encerradaEm" = inicio) THEN (inicio + 1)
    ELSE "encerradaEm"
END, '[)'::text) WITH &&);


--
-- Name: LaudoQualidadeLeite LaudoQualidadeLeite_amostraId_sha256_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_amostraId_sha256_key" UNIQUE ("amostraId", sha256);


--
-- Name: LaudoQualidadeLeite LaudoQualidadeLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_pkey" PRIMARY KEY (id);


--
-- Name: LaudoQualidadeLeite LaudoQualidadeLeite_storageKey_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_storageKey_key" UNIQUE ("storageKey");


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: LoteColostro LoteColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_pkey" PRIMARY KEY (id);


--
-- Name: Lote Lote_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_pkey" PRIMARY KEY (id);


--
-- Name: ManejoAnimal ManejoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: MaterialGenetico MaterialGenetico_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_pkey" PRIMARY KEY (id);


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MedicaoGeralLeite"
    ADD CONSTRAINT "MedicaoGeralLeite_pkey" PRIMARY KEY (id);


--
-- Name: MedicaoLeite MedicaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MedicaoLeite"
    ADD CONSTRAINT "MedicaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: MesNutricao MesNutricao_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MesNutricao"
    ADD CONSTRAINT "MesNutricao_pkey" PRIMARY KEY (id);


--
-- Name: MomentoProtocolo MomentoProtocolo_id_protocoloId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_id_protocoloId_key" UNIQUE (id, "protocoloId");


--
-- Name: MomentoProtocolo MomentoProtocolo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_pkey" PRIMARY KEY (id);


--
-- Name: MomentoProtocolo MomentoProtocolo_protocoloId_ordem_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_protocoloId_ordem_key" UNIQUE ("protocoloId", ordem);


--
-- Name: MotivoBaixa MotivoBaixa_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MotivoBaixa"
    ADD CONSTRAINT "MotivoBaixa_pkey" PRIMARY KEY (id);


--
-- Name: MovimentacaoAnimal MovimentacaoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: Movimentacao Movimentacao_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_pkey" PRIMARY KEY (id);


--
-- Name: MovimentoConsumoDiario MovimentoConsumoDiario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoConsumoDiario"
    ADD CONSTRAINT "MovimentoConsumoDiario_pkey" PRIMARY KEY (id);


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_movimentoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_movimentoId_key" UNIQUE ("movimentoId");


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_pkey" PRIMARY KEY (id);


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_pkey" PRIMARY KEY (id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_alertaId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_alertaId_key" UNIQUE ("alertaId");


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_chave_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_chave_key" UNIQUE (chave);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_demandaId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_demandaId_key" UNIQUE ("demandaId");


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_tarefaId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_tarefaId_key" UNIQUE ("tarefaId");


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_pkey" PRIMARY KEY (id);


--
-- Name: OcorrenciaSanitaria OcorrenciaSanitaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_pkey" PRIMARY KEY (id);


--
-- Name: OfertaBezerreiro OfertaBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: OfertaProgramadaBezerreiro OfertaProgramadaBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaProgramadaBezerreiro"
    ADD CONSTRAINT "OfertaProgramadaBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: OperacaoComercialLeite OperacaoComercialLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OperacaoComercialLeite"
    ADD CONSTRAINT "OperacaoComercialLeite_pkey" PRIMARY KEY (id);


--
-- Name: OrigemColostro OrigemColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemColostro"
    ADD CONSTRAINT "OrigemColostro_pkey" PRIMARY KEY (id);


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemPreparoColostro"
    ADD CONSTRAINT "OrigemPreparoColostro_pkey" PRIMARY KEY (id);


--
-- Name: ParcelaDestinoLeite ParcelaDestinoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_pkey" PRIMARY KEY (id);


--
-- Name: ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_fornecimentoId_animalId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_fornecimentoId_animalId_key" UNIQUE ("fornecimentoId", "animalId");


--
-- Name: ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_pkey" PRIMARY KEY (id);


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoBezerreiro"
    ADD CONSTRAINT "ParticipacaoBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_sem_sobreposicao; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoBezerreiro"
    ADD CONSTRAINT "ParticipacaoBezerreiro_sem_sobreposicao" EXCLUDE USING gist ("animalId" WITH =, daterange(desde, ate, '[)'::text) WITH &&);


--
-- Name: ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoAnimal"
    ADD CONSTRAINT "ParticipacaoConsumoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: ParticipacaoConsumoDiario ParticipacaoConsumoDiario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoDiario"
    ADD CONSTRAINT "ParticipacaoConsumoDiario_pkey" PRIMARY KEY (id);


--
-- Name: ParticipacaoExposicao ParticipacaoExposicao_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoExposicao"
    ADD CONSTRAINT "ParticipacaoExposicao_pkey" PRIMARY KEY (id);


--
-- Name: ParticipacaoProtocolo ParticipacaoProtocolo_legadoIatfId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ParticipacaoProtocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- Name: ParticipacaoProtocolo ParticipacaoProtocolo_referenciaExterna_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ParticipacaoProtocolo_referenciaExterna_key" UNIQUE ("referenciaExterna");


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: ParticipanteVisita ParticipanteVisita_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_pkey" PRIMARY KEY (id);


--
-- Name: PartoAnimal PartoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: PerfilBezerreiro PerfilBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilBezerreiro"
    ADD CONSTRAINT "PerfilBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: PerfilNutricionalProduto PerfilNutricionalProduto_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilNutricionalProduto"
    ADD CONSTRAINT "PerfilNutricionalProduto_pkey" PRIMARY KEY (id);


--
-- Name: PerfilSanitarioProduto PerfilSanitarioProduto_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilSanitarioProduto"
    ADD CONSTRAINT "PerfilSanitarioProduto_pkey" PRIMARY KEY (id);


--
-- Name: PeriodoFaseBezerreiro PeriodoFaseBezerreiro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoFaseBezerreiro"
    ADD CONSTRAINT "PeriodoFaseBezerreiro_pkey" PRIMARY KEY (id);


--
-- Name: PeriodoFaseBezerreiro PeriodoFaseBezerreiro_sem_sobreposicao; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoFaseBezerreiro"
    ADD CONSTRAINT "PeriodoFaseBezerreiro_sem_sobreposicao" EXCLUDE USING gist ("participacaoId" WITH =, daterange(desde, ate, '[)'::text) WITH &&);


--
-- Name: PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_referenciaExterna_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_referenciaExterna_key" UNIQUE ("referenciaExterna");


--
-- Name: Pesagem Pesagem_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_pkey" PRIMARY KEY (id);


--
-- Name: PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutiv_propriedadeId_vigenteDesde_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutiv_propriedadeId_vigenteDesde_key" UNIQUE ("propriedadeId", "vigenteDesde");


--
-- Name: PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutivo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutivo_pkey" PRIMARY KEY (id);


--
-- Name: PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutivo_propriedadeId_versao_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutivo_propriedadeId_versao_key" UNIQUE ("propriedadeId", versao);


--
-- Name: PoliticaAtencaoReprodutiva PoliticaAtencaoReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAtencaoReprodutiva"
    ADD CONSTRAINT "PoliticaAtencaoReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: PoliticaAtencaoReprodutiva PoliticaAtencaoReprodutiva_propriedadeId_versao_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAtencaoReprodutiva"
    ADD CONSTRAINT "PoliticaAtencaoReprodutiva_propriedadeId_versao_key" UNIQUE ("propriedadeId", versao);


--
-- Name: PoliticaAtencaoReprodutiva PoliticaAtencaoReprodutiva_propriedadeId_vigenteDesde_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAtencaoReprodutiva"
    ADD CONSTRAINT "PoliticaAtencaoReprodutiva_propriedadeId_vigenteDesde_key" UNIQUE ("propriedadeId", "vigenteDesde");


--
-- Name: PoliticaElegibilidadeReprodutiva PoliticaElegibilidadeReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaElegibilidadeReprodutiva"
    ADD CONSTRAINT "PoliticaElegibilidadeReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: PosicaoOrdenha PosicaoOrdenha_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PosicaoOrdenha"
    ADD CONSTRAINT "PosicaoOrdenha_pkey" PRIMARY KEY (id);


--
-- Name: PreparoColostro PreparoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PreparoColostro"
    ADD CONSTRAINT "PreparoColostro_pkey" PRIMARY KEY (id);


--
-- Name: ProgramacaoProtocolo ProgramacaoProtocolo_legadoIatfId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "ProgramacaoProtocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- Name: ProgramacaoProtocolo ProgramacaoProtocolo_referenciaExterna_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "ProgramacaoProtocolo_referenciaExterna_key" UNIQUE ("referenciaExterna");


--
-- Name: ProgramacaoRetiradaLeite ProgramacaoRetiradaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoRetiradaLeite"
    ADD CONSTRAINT "ProgramacaoRetiradaLeite_pkey" PRIMARY KEY (id);


--
-- Name: ProgramacaoSanitaria ProgramacaoSanitaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoSanitaria"
    ADD CONSTRAINT "ProgramacaoSanitaria_pkey" PRIMARY KEY (id);


--
-- Name: Protocolo ProtocoloSanitario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Protocolo"
    ADD CONSTRAINT "ProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- Name: Protocolo Protocolo_legadoIatfId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Protocolo"
    ADD CONSTRAINT "Protocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- Name: Raca Raca_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Raca"
    ADD CONSTRAINT "Raca_pkey" PRIMARY KEY (id);


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_fornecimentoId_fechamentoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fornecimentoId_fechamentoId_key" UNIQUE ("fornecimentoId", "fechamentoId");


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_fornecimentoId_versao_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fornecimentoId_versao_key" UNIQUE ("fornecimentoId", versao);


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_pkey" PRIMARY KEY (id);


--
-- Name: RegistroGenealogicoAnimal RegistroGenealogicoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegistroGenealogicoAnimal"
    ADD CONSTRAINT "RegistroGenealogicoAnimal_pkey" PRIMARY KEY (registro);


--
-- Name: RegraAlertaSanitario RegraAlertaSanitario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraAlertaSanitario"
    ADD CONSTRAINT "RegraAlertaSanitario_pkey" PRIMARY KEY (id);


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimentoReprodutivo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraImpactoProcedimentoReprodutivo"
    ADD CONSTRAINT "RegraImpactoProcedimentoReprodutivo_pkey" PRIMARY KEY (id);


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimento_publico_unico; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraImpactoProcedimentoReprodutivo"
    ADD CONSTRAINT "RegraImpactoProcedimento_publico_unico" UNIQUE ("propriedadeId", "tipoAplicacaoId", finalidade);


--
-- Name: RegraSanitariaReprodutiva RegraSanitariaReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: RequisicaoPecuaria RequisicaoPecuaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RequisicaoPecuaria"
    ADD CONSTRAINT "RequisicaoPecuaria_pkey" PRIMARY KEY (chave);


--
-- Name: RestricaoReprodutiva RestricaoReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: ResultadoExame ResultadoExame_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ResultadoExame"
    ADD CONSTRAINT "ResultadoExame_pkey" PRIMARY KEY (id);


--
-- Name: ResultadoQualidadeLeite ResultadoQualidadeLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ResultadoQualidadeLeite"
    ADD CONSTRAINT "ResultadoQualidadeLeite_pkey" PRIMARY KEY (id);


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_movimentoEstornoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_movimentoEstornoId_key" UNIQUE ("movimentoEstornoId");


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_movimentoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_movimentoId_key" UNIQUE ("movimentoId");


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_pkey" PRIMARY KEY (id);


--
-- Name: RetiradaOperacaoLeite RetiradaOperacaoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaOperacaoLeite"
    ADD CONSTRAINT "RetiradaOperacaoLeite_pkey" PRIMARY KEY (id);


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_demandaId_versaoAnterior_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_demandaId_versaoAnterior_key" UNIQUE ("demandaId", "versaoAnterior");


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_pkey" PRIMARY KEY (id);


--
-- Name: RevisaoRegraAlertaSanitario RevisaoRegraAlertaSanitario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoRegraAlertaSanitario"
    ADD CONSTRAINT "RevisaoRegraAlertaSanitario_pkey" PRIMARY KEY (id);


--
-- Name: ProgramacaoProtocolo RodadaProtocoloSanitario_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "RodadaProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- Name: SegmentoConsumoAnimal SegmentoConsumoAnimal_participacaoId_desde_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SegmentoConsumoAnimal"
    ADD CONSTRAINT "SegmentoConsumoAnimal_participacaoId_desde_key" UNIQUE ("participacaoId", desde);


--
-- Name: SegmentoConsumoAnimal SegmentoConsumoAnimal_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SegmentoConsumoAnimal"
    ADD CONSTRAINT "SegmentoConsumoAnimal_pkey" PRIMARY KEY (id);


--
-- Name: SelecaoVisita SelecaoVisita_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SelecaoVisita"
    ADD CONSTRAINT "SelecaoVisita_pkey" PRIMARY KEY (id);


--
-- Name: SessaoOrdenha SessaoOrdenha_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SessaoOrdenha"
    ADD CONSTRAINT "SessaoOrdenha_pkey" PRIMARY KEY (id);


--
-- Name: SituacaoInicialReprodutiva SituacaoInicialReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SnapshotRelatorioReprodutivo"
    ADD CONSTRAINT "SnapshotRelatorioReprodutivo_pkey" PRIMARY KEY (id);


--
-- Name: TanqueLeite TanqueLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TanqueLeite"
    ADD CONSTRAINT "TanqueLeite_pkey" PRIMARY KEY (id);


--
-- Name: TarefaProtocolo TarefaProtocolo_legadoIatfId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaProtocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- Name: TarefaProtocolo TarefaSanitaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaSanitaria_pkey" PRIMARY KEY (id);


--
-- Name: TemplateAplicacoesTablet TemplateAplicacoesTablet_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TemplateAplicacoesTablet"
    ADD CONSTRAINT "TemplateAplicacoesTablet_pkey" PRIMARY KEY ("propriedadeId", "doencaId");


--
-- Name: TentativaReprodutiva TentativaReprodutiva_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_pkey" PRIMARY KEY (id);


--
-- Name: TipoAplicacaoSanitaria TipoAplicacaoSanitaria_nome_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TipoAplicacaoSanitaria"
    ADD CONSTRAINT "TipoAplicacaoSanitaria_nome_key" UNIQUE (nome);


--
-- Name: TipoAplicacaoSanitaria TipoAplicacaoSanitaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TipoAplicacaoSanitaria"
    ADD CONSTRAINT "TipoAplicacaoSanitaria_pkey" PRIMARY KEY (id);


--
-- Name: TipoExame TipoExame_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TipoExame"
    ADD CONSTRAINT "TipoExame_pkey" PRIMARY KEY (id);


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."UnidadeBancoColostro"
    ADD CONSTRAINT "UnidadeBancoColostro_pkey" PRIMARY KEY (id);


--
-- Name: VersaoComercialVendaLeite VersaoComercialVendaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VersaoComercialVendaLeite"
    ADD CONSTRAINT "VersaoComercialVendaLeite_pkey" PRIMARY KEY (id);


--
-- Name: VersaoSelecaoVisita VersaoSelecaoVisita_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VersaoSelecaoVisita"
    ADD CONSTRAINT "VersaoSelecaoVisita_pkey" PRIMARY KEY (id);


--
-- Name: VigenciaDietaLote VigenciaDietaLote_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_pkey" PRIMARY KEY (id);


--
-- Name: VigenciaDietaLote VigenciaDietaLote_sem_sobreposicao; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_sem_sobreposicao" EXCLUDE USING gist ("loteId" WITH =, daterange(desde, ate, '[)'::text) WITH &&);


--
-- Name: VinculoAtendimentoAlerta VinculoAtendimentoAlerta_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoAtendimentoAlerta"
    ADD CONSTRAINT "VinculoAtendimentoAlerta_pkey" PRIMARY KEY (id);


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusaoAcompanhamento_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoConclusaoAcompanhamento"
    ADD CONSTRAINT "VinculoConclusaoAcompanhamento_pkey" PRIMARY KEY (id);


--
-- Name: VinculoFornecimentoColostragem VinculoFornecimentoColostragem_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoFornecimentoColostragem"
    ADD CONSTRAINT "VinculoFornecimentoColostragem_pkey" PRIMARY KEY ("acompanhamentoId", "fornecimentoId");


--
-- Name: VinculoImportacaoPecuaria VinculoImportacaoPecuaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoImportacaoPecuaria"
    ADD CONSTRAINT "VinculoImportacaoPecuaria_pkey" PRIMARY KEY (id);


--
-- Name: VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoMedicaoEntradaLeite"
    ADD CONSTRAINT "VinculoMedicaoEntradaLeite_pkey" PRIMARY KEY (id);


--
-- Name: VinculoPesagemParto VinculoPesagemParto_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_pkey" PRIMARY KEY (id);


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemSecagem"
    ADD CONSTRAINT "VinculoPesagemSecagem_pkey" PRIMARY KEY (id);


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_pkey" PRIMARY KEY (id);


--
-- Name: VinculoPreparoTentativa VinculoPreparoTentativa_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_pkey" PRIMARY KEY (id);


--
-- Name: VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoQualidadeFechamentoLeite"
    ADD CONSTRAINT "VinculoQualidadeFechamentoLeite_pkey" PRIMARY KEY ("fechamentoId", "amostraId");


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_manejoId_key; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_manejoId_key" UNIQUE ("manejoId");


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_pkey" PRIMARY KEY (id);


--
-- Name: VinculoTentativaParticipacao VinculoTentativaParticipacao_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTentativaParticipacao"
    ADD CONSTRAINT "VinculoTentativaParticipacao_pkey" PRIMARY KEY (id);


--
-- Name: VisitaVeterinaria VisitaVeterinaria_pkey; Type: CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VisitaVeterinaria"
    ADD CONSTRAINT "VisitaVeterinaria_pkey" PRIMARY KEY (id);


--
-- Name: Alerta Alerta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "Alerta_pkey" PRIMARY KEY (id);


--
-- Name: AlocacaoPartidaEstoque AlocacaoPartidaEstoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AlocacaoPartidaEstoque"
    ADD CONSTRAINT "AlocacaoPartidaEstoque_pkey" PRIMARY KEY (id);


--
-- Name: AssinaturaRadarAssistente AssinaturaRadarAssistente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssinaturaRadarAssistente"
    ADD CONSTRAINT "AssinaturaRadarAssistente_pkey" PRIMARY KEY (chave);


--
-- Name: AuditoriaFinanceira AuditoriaFinanceira_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditoriaFinanceira"
    ADD CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY (id);


--
-- Name: AvaliacaoAlertas AvaliacaoAlertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AvaliacaoAlertas"
    ADD CONSTRAINT "AvaliacaoAlertas_pkey" PRIMARY KEY (id);


--
-- Name: BaseValorizacaoEstoque BaseValorizacaoEstoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_pkey" PRIMARY KEY (id);


--
-- Name: Categoria Categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_pkey" PRIMARY KEY (id);


--
-- Name: CentroCusto CentroCusto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentroCusto"
    ADD CONSTRAINT "CentroCusto_pkey" PRIMARY KEY (id);


--
-- Name: ClassificacaoTecnicaProduto ClassificacaoTecnicaProduto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClassificacaoTecnicaProduto"
    ADD CONSTRAINT "ClassificacaoTecnicaProduto_pkey" PRIMARY KEY (id);


--
-- Name: CompromissoFinanceiro CompromissoFinanceiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompromissoFinanceiro"
    ADD CONSTRAINT "CompromissoFinanceiro_pkey" PRIMARY KEY (id);


--
-- Name: ContaFinanceira ContaFinanceira_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContaFinanceira"
    ADD CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY (id);


--
-- Name: ConversaAssistente ConversaAssistente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversaAssistente"
    ADD CONSTRAINT "ConversaAssistente_pkey" PRIMARY KEY (id);


--
-- Name: ConversaWhatsapp ConversaWhatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversaWhatsapp"
    ADD CONSTRAINT "ConversaWhatsapp_pkey" PRIMARY KEY (id);


--
-- Name: DocumentoFinanceiro DocumentoFinanceiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_pkey" PRIMARY KEY (id);


--
-- Name: EventoAlerta EventoAlerta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoAlerta"
    ADD CONSTRAINT "EventoAlerta_pkey" PRIMARY KEY (id);


--
-- Name: EventoMetaAssistente EventoMetaAssistente_operacaoId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoMetaAssistente"
    ADD CONSTRAINT "EventoMetaAssistente_operacaoId_key" UNIQUE ("operacaoId");


--
-- Name: EventoMetaAssistente EventoMetaAssistente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoMetaAssistente"
    ADD CONSTRAINT "EventoMetaAssistente_pkey" PRIMARY KEY ("metaId", revisao);


--
-- Name: FabricanteProduto FabricanteProduto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FabricanteProduto"
    ADD CONSTRAINT "FabricanteProduto_pkey" PRIMARY KEY (id);


--
-- Name: GrupoCategoria GrupoCategoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GrupoCategoria"
    ADD CONSTRAINT "GrupoCategoria_pkey" PRIMARY KEY (id);


--
-- Name: ItemOperacao ItemOperacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_pkey" PRIMARY KEY (id);


--
-- Name: Liquidacao Liquidacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Liquidacao"
    ADD CONSTRAINT "Liquidacao_pkey" PRIMARY KEY (id);


--
-- Name: MensagemWhatsapp MensagemWhatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MensagemWhatsapp"
    ADD CONSTRAINT "MensagemWhatsapp_pkey" PRIMARY KEY (id);


--
-- Name: MovimentoConta MovimentoConta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoConta"
    ADD CONSTRAINT "MovimentoConta_pkey" PRIMARY KEY (id);


--
-- Name: MovimentoEstoque MovimentoEstoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY (id);


--
-- Name: Operacao Operacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_pkey" PRIMARY KEY (id);


--
-- Name: ParceiroPapel ParceiroPapel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ParceiroPapel"
    ADD CONSTRAINT "ParceiroPapel_pkey" PRIMARY KEY ("parceiroId", papel);


--
-- Name: Parceiro Parceiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Parceiro"
    ADD CONSTRAINT "Parceiro_pkey" PRIMARY KEY (id);


--
-- Name: ParcelaValorizacaoEstoque ParcelaValorizacaoEstoque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ParcelaValorizacaoEstoque"
    ADD CONSTRAINT "ParcelaValorizacaoEstoque_pkey" PRIMARY KEY (id);


--
-- Name: PartidaProduto PartidaProduto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartidaProduto"
    ADD CONSTRAINT "PartidaProduto_pkey" PRIMARY KEY (id);


--
-- Name: PeriodoFinanceiro PeriodoFinanceiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PeriodoFinanceiro"
    ADD CONSTRAINT "PeriodoFinanceiro_pkey" PRIMARY KEY (id);


--
-- Name: PrincipioAtivo PrincipioAtivo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PrincipioAtivo"
    ADD CONSTRAINT "PrincipioAtivo_pkey" PRIMARY KEY (id);


--
-- Name: ProdutoCatalogoPrincipioAtivo ProdutoCatalogoPrincipioAtivo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCatalogoPrincipioAtivo"
    ADD CONSTRAINT "ProdutoCatalogoPrincipioAtivo_pkey" PRIMARY KEY ("produtoCatalogoId", "principioAtivoId");


--
-- Name: ProdutoCatalogo ProdutoCatalogo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCatalogo"
    ADD CONSTRAINT "ProdutoCatalogo_pkey" PRIMARY KEY (id);


--
-- Name: ProdutoCentroCusto ProdutoCentroCusto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCentroCusto"
    ADD CONSTRAINT "ProdutoCentroCusto_pkey" PRIMARY KEY ("produtoId", "centroCustoId");


--
-- Name: ProdutoFornecedor ProdutoFornecedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoFornecedor"
    ADD CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("produtoId", "fornecedorId");


--
-- Name: Produto Produto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_pkey" PRIMARY KEY (id);


--
-- Name: Propriedade Propriedade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Propriedade"
    ADD CONSTRAINT "Propriedade_pkey" PRIMARY KEY (id);


--
-- Name: RascunhoOperacao RascunhoOperacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RascunhoOperacao"
    ADD CONSTRAINT "RascunhoOperacao_pkey" PRIMARY KEY (id);


--
-- Name: RascunhoRelatorioFinanceiro RascunhoRelatorioFinanceiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RascunhoRelatorioFinanceiro"
    ADD CONSTRAINT "RascunhoRelatorioFinanceiro_pkey" PRIMARY KEY (id);


--
-- Name: RelatorioFinanceiro RelatorioFinanceiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RelatorioFinanceiro"
    ADD CONSTRAINT "RelatorioFinanceiro_pkey" PRIMARY KEY (id);


--
-- Name: Sessao Sessao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sessao"
    ADD CONSTRAINT "Sessao_pkey" PRIMARY KEY (id);


--
-- Name: SnapshotRadarAssistente SnapshotRadarAssistente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SnapshotRadarAssistente"
    ADD CONSTRAINT "SnapshotRadarAssistente_pkey" PRIMARY KEY (chave, dia);


--
-- Name: TokenAcesso TokenAcesso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TokenAcesso"
    ADD CONSTRAINT "TokenAcesso_pkey" PRIMARY KEY (id);


--
-- Name: TransacaoFinanceira TransacaoFinanceira_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_pkey" PRIMARY KEY (id);


--
-- Name: UsuarioWhatsapp UsuarioWhatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsuarioWhatsapp"
    ADD CONSTRAINT "UsuarioWhatsapp_pkey" PRIMARY KEY (id);


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: AcompanhamentoColostragem_animalId_propriedadeId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AcompanhamentoColostragem_animalId_propriedadeId_key" ON pecuaria."AcompanhamentoColostragem" USING btree ("animalId", "propriedadeId");


--
-- Name: AlocacaoDemonstrativoLeite_demonstrativoId_entregaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AlocacaoDemonstrativoLeite_demonstrativoId_entregaId_key" ON pecuaria."AlocacaoDemonstrativoLeite" USING btree ("demonstrativoId", "entregaId");


--
-- Name: AlocacaoDemonstrativoLeite_entregaId_ativo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AlocacaoDemonstrativoLeite_entregaId_ativo_idx" ON pecuaria."AlocacaoDemonstrativoLeite" USING btree ("entregaId", ativo);


--
-- Name: AlocacaoFornecimentoColostro_fornecimentoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AlocacaoFornecimentoColostro_fornecimentoId_idx" ON pecuaria."AlocacaoFornecimentoColostro" USING btree ("fornecimentoId");


--
-- Name: AlocacaoFornecimentoColostro_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AlocacaoFornecimentoColostro_movimentoId_key" ON pecuaria."AlocacaoFornecimentoColostro" USING btree ("movimentoId");


--
-- Name: AlocacaoFornecimentoColostro_origemId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AlocacaoFornecimentoColostro_origemId_idx" ON pecuaria."AlocacaoFornecimentoColostro" USING btree ("origemId");


--
-- Name: AlocacaoLeiteEstoque_entradaId_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AlocacaoLeiteEstoque_entradaId_movimentoId_key" ON pecuaria."AlocacaoLeiteEstoque" USING btree ("entradaId", "movimentoId");


--
-- Name: AlocacaoLeiteEstoque_movimentoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AlocacaoLeiteEstoque_movimentoId_idx" ON pecuaria."AlocacaoLeiteEstoque" USING btree ("movimentoId");


--
-- Name: AmostraQualidadeLeite_entradaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AmostraQualidadeLeite_entradaId_idx" ON pecuaria."AmostraQualidadeLeite" USING btree ("entradaId");


--
-- Name: AmostraQualidadeLeite_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AmostraQualidadeLeite_propriedadeId_data_idx" ON pecuaria."AmostraQualidadeLeite" USING btree ("propriedadeId", data);


--
-- Name: AmostraQualidadeLeite_tipoExameId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AmostraQualidadeLeite_tipoExameId_idx" ON pecuaria."AmostraQualidadeLeite" USING btree ("tipoExameId");


--
-- Name: Animal_brincoEletronico_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Animal_brincoEletronico_key" ON pecuaria."Animal" USING btree ("brincoEletronico");


--
-- Name: Animal_brinco_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Animal_brinco_idx" ON pecuaria."Animal" USING btree (brinco);


--
-- Name: Animal_codigoProvisorio_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Animal_codigoProvisorio_key" ON pecuaria."Animal" USING btree ("codigoProvisorio");


--
-- Name: Animal_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Animal_ideagriId_key" ON pecuaria."Animal" USING btree ("ideagriId");


--
-- Name: Animal_maeExternaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Animal_maeExternaId_idx" ON pecuaria."Animal" USING btree ("maeExternaId");


--
-- Name: Animal_maeId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Animal_maeId_idx" ON pecuaria."Animal" USING btree ("maeId");


--
-- Name: Animal_paiExternoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Animal_paiExternoId_idx" ON pecuaria."Animal" USING btree ("paiExternoId");


--
-- Name: Animal_paiId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Animal_paiId_idx" ON pecuaria."Animal" USING btree ("paiId");


--
-- Name: Animal_sisbov_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Animal_sisbov_key" ON pecuaria."Animal" USING btree (sisbov);


--
-- Name: AplicacaoProduto_animalId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AplicacaoProduto_animalId_data_idx" ON pecuaria."AplicacaoProduto" USING btree ("animalId", data);


--
-- Name: AplicacaoProduto_itemCompraDiretaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AplicacaoProduto_itemCompraDiretaId_idx" ON pecuaria."AplicacaoProduto" USING btree ("itemCompraDiretaId");


--
-- Name: AplicacaoProduto_movimentoEstoqueId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AplicacaoProduto_movimentoEstoqueId_key" ON pecuaria."AplicacaoProduto" USING btree ("movimentoEstoqueId");


--
-- Name: AplicacaoProduto_operacaoServicoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AplicacaoProduto_operacaoServicoId_idx" ON pecuaria."AplicacaoProduto" USING btree ("operacaoServicoId");


--
-- Name: AplicacaoProduto_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AplicacaoProduto_propriedadeId_data_idx" ON pecuaria."AplicacaoProduto" USING btree ("propriedadeId", data);


--
-- Name: AplicacaoProduto_tarefaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AplicacaoProduto_tarefaId_idx" ON pecuaria."AplicacaoProduto" USING btree ("tarefaId");


--
-- Name: AplicacaoProduto_tarefaId_valida_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AplicacaoProduto_tarefaId_valida_key" ON pecuaria."AplicacaoProduto" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("tarefaId" IS NOT NULL));


--
-- Name: ApropriacaoValorLeite_alocacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ApropriacaoValorLeite_alocacaoId_idx" ON pecuaria."ApropriacaoValorLeite" USING btree ("alocacaoId");


--
-- Name: ApropriacaoValorLeite_apuracaoId_alocacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ApropriacaoValorLeite_apuracaoId_alocacaoId_key" ON pecuaria."ApropriacaoValorLeite" USING btree ("apuracaoId", "alocacaoId");


--
-- Name: ApuracaoValorLeite_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ApuracaoValorLeite_chave_key" ON pecuaria."ApuracaoValorLeite" USING btree (chave);


--
-- Name: ApuracaoValorLeite_entradaId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ApuracaoValorLeite_entradaId_versao_key" ON pecuaria."ApuracaoValorLeite" USING btree ("entradaId", versao);


--
-- Name: AtividadeVisita_visitaId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AtividadeVisita_visitaId_ordem_key" ON pecuaria."AtividadeVisita" USING btree ("visitaId", ordem);


--
-- Name: AuditoriaPecuaria_animalId_em_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AuditoriaPecuaria_animalId_em_idx" ON pecuaria."AuditoriaPecuaria" USING btree ("animalId", em);


--
-- Name: AuditoriaPecuaria_em_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AuditoriaPecuaria_em_idx" ON pecuaria."AuditoriaPecuaria" USING btree (em);


--
-- Name: AuditoriaPecuaria_entidade_entidadeId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AuditoriaPecuaria_entidade_entidadeId_idx" ON pecuaria."AuditoriaPecuaria" USING btree (entidade, "entidadeId");


--
-- Name: AutomacaoProtocolo_estado_programadaPara_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "AutomacaoProtocolo_estado_programadaPara_idx" ON pecuaria."AutomacaoProtocolo" USING btree (estado, "programadaPara");


--
-- Name: AvaliacaoReprodutiva_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AvaliacaoReprodutiva_referenciaExterna_key" ON pecuaria."InterpretacaoReprodutiva" USING btree ("referenciaExterna");


--
-- Name: AvaliacaoReprodutiva_restricaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "AvaliacaoReprodutiva_restricaoId_key" ON pecuaria."InterpretacaoReprodutiva" USING btree ("restricaoId");


--
-- Name: BaixaAnimal_animalId_ativa_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "BaixaAnimal_animalId_ativa_key" ON pecuaria."BaixaAnimal" USING btree ("animalId") WHERE ("estornadaEm" IS NULL);


--
-- Name: BaixaAnimal_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "BaixaAnimal_animalId_idx" ON pecuaria."BaixaAnimal" USING btree ("animalId");


--
-- Name: BaixaAnimal_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "BaixaAnimal_data_idx" ON pecuaria."BaixaAnimal" USING btree (data);


--
-- Name: BaixaAnimal_destinoFechadoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "BaixaAnimal_destinoFechadoId_idx" ON pecuaria."BaixaAnimal" USING btree ("destinoFechadoId");


--
-- Name: BaixaAnimal_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "BaixaAnimal_ideagriId_key" ON pecuaria."BaixaAnimal" USING btree ("ideagriId");


--
-- Name: BaixaAnimal_localizacaoFechadaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "BaixaAnimal_localizacaoFechadaId_idx" ON pecuaria."BaixaAnimal" USING btree ("localizacaoFechadaId");


--
-- Name: BaixaAnimal_referenciaHistorica_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "BaixaAnimal_referenciaHistorica_key" ON pecuaria."BaixaAnimal" USING btree ("referenciaHistorica");


--
-- Name: CategoriaAnimal_chavePadrao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "CategoriaAnimal_chavePadrao_key" ON pecuaria."CategoriaAnimal" USING btree ("chavePadrao");


--
-- Name: CategoriaAnimal_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "CategoriaAnimal_ideagriId_key" ON pecuaria."CategoriaAnimal" USING btree ("ideagriId");


--
-- Name: CategoriaAnimal_sexo_nome_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "CategoriaAnimal_sexo_nome_key" ON pecuaria."CategoriaAnimal" USING btree (sexo, nome);


--
-- Name: CategoriaManualAnimal_animalId_aberta_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "CategoriaManualAnimal_animalId_aberta_key" ON pecuaria."CategoriaManualAnimal" USING btree ("animalId") WHERE (ate IS NULL);


--
-- Name: CategoriaManualAnimal_animalId_ate_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "CategoriaManualAnimal_animalId_ate_idx" ON pecuaria."CategoriaManualAnimal" USING btree ("animalId", ate);


--
-- Name: CategoriaManualAnimal_categoriaId_ate_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "CategoriaManualAnimal_categoriaId_ate_idx" ON pecuaria."CategoriaManualAnimal" USING btree ("categoriaId", ate);


--
-- Name: ClassificacaoEntradaLeite_entradaId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ClassificacaoEntradaLeite_entradaId_versao_key" ON pecuaria."ClassificacaoEntradaLeite" USING btree ("entradaId", versao);


--
-- Name: ClassificacaoEntradaLeite_id_entradaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ClassificacaoEntradaLeite_id_entradaId_key" ON pecuaria."ClassificacaoEntradaLeite" USING btree (id, "entradaId");


--
-- Name: ColeiraBezerreiro_propriedadeId_nome_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ColeiraBezerreiro_propriedadeId_nome_key" ON pecuaria."ColeiraBezerreiro" USING btree ("propriedadeId", nome);


--
-- Name: ComposicaoGenitorExterno_genitorId_racaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ComposicaoGenitorExterno_genitorId_racaId_key" ON pecuaria."ComposicaoGenitorExterno" USING btree ("genitorId", "racaId");


--
-- Name: ComposicaoGenitorExterno_racaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ComposicaoGenitorExterno_racaId_idx" ON pecuaria."ComposicaoGenitorExterno" USING btree ("racaId");


--
-- Name: ComposicaoRacial_animalId_racaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ComposicaoRacial_animalId_racaId_key" ON pecuaria."ComposicaoRacial" USING btree ("animalId", "racaId");


--
-- Name: ComposicaoRacial_racaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ComposicaoRacial_racaId_idx" ON pecuaria."ComposicaoRacial" USING btree ("racaId");


--
-- Name: ComprovanteEntregaLeite_entregaId_sha256_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ComprovanteEntregaLeite_entregaId_sha256_key" ON pecuaria."ComprovanteEntregaLeite" USING btree ("entregaId", sha256);


--
-- Name: ComprovanteEntregaLeite_storageKey_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ComprovanteEntregaLeite_storageKey_key" ON pecuaria."ComprovanteEntregaLeite" USING btree ("storageKey");


--
-- Name: ComprovanteRetiradaOperacaoLeite_retiradaId_sha256_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ComprovanteRetiradaOperacaoLeite_retiradaId_sha256_key" ON pecuaria."ComprovanteRetiradaOperacaoLeite" USING btree ("retiradaId", sha256);


--
-- Name: ConferenciaEntregaLeite_entregaId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConferenciaEntregaLeite_entregaId_versao_key" ON pecuaria."ConferenciaEntregaLeite" USING btree ("entregaId", versao);


--
-- Name: ConferenciaSaldoLeite_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ConferenciaSaldoLeite_propriedadeId_data_idx" ON pecuaria."ConferenciaSaldoLeite" USING btree ("propriedadeId", data);


--
-- Name: ConferenciaSaldoLeite_propriedadeId_produtoId_data_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConferenciaSaldoLeite_propriedadeId_produtoId_data_versao_key" ON pecuaria."ConferenciaSaldoLeite" USING btree ("propriedadeId", "produtoId", data, versao);


--
-- Name: ConfiguracaoBezerreiro_propriedadeId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConfiguracaoBezerreiro_propriedadeId_versao_key" ON pecuaria."ConfiguracaoBezerreiro" USING btree ("propriedadeId", versao);


--
-- Name: ConfiguracaoNutricao_escopo_desde_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConfiguracaoNutricao_escopo_desde_key" ON pecuaria."ConfiguracaoNutricao" USING btree (escopo, desde);


--
-- Name: ConfiguracaoNutricao_propriedadeId_desde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ConfiguracaoNutricao_propriedadeId_desde_idx" ON pecuaria."ConfiguracaoNutricao" USING btree ("propriedadeId", desde);


--
-- Name: ConfiguracaoOrdenha_id_propriedadeId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConfiguracaoOrdenha_id_propriedadeId_key" ON pecuaria."ConfiguracaoOrdenha" USING btree (id, "propriedadeId");


--
-- Name: ConfiguracaoOrdenha_propriedadeId_vigenteDesde_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConfiguracaoOrdenha_propriedadeId_vigenteDesde_key" ON pecuaria."ConfiguracaoOrdenha" USING btree ("propriedadeId", "vigenteDesde");


--
-- Name: ConsumoDiario_mesId_data_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ConsumoDiario_mesId_data_key" ON pecuaria."ConsumoDiario" USING btree ("mesId", data);


--
-- Name: ControleHistoricoLeite_animalId_inicio_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ControleHistoricoLeite_animalId_inicio_idx" ON pecuaria."ControleHistoricoLeite" USING btree ("animalId", inicio);


--
-- Name: ControleHistoricoLeite_propriedadeId_inicio_fim_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ControleHistoricoLeite_propriedadeId_inicio_fim_idx" ON pecuaria."ControleHistoricoLeite" USING btree ("propriedadeId", inicio, fim);


--
-- Name: ControleHistoricoLeite_referenciaHistorica_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ControleHistoricoLeite_referenciaHistorica_key" ON pecuaria."ControleHistoricoLeite" USING btree ("referenciaHistorica");


--
-- Name: CriaParto_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "CriaParto_animalId_key" ON pecuaria."CriaParto" USING btree ("animalId");


--
-- Name: CriaParto_partoId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "CriaParto_partoId_ordem_key" ON pecuaria."CriaParto" USING btree ("partoId", ordem);


--
-- Name: DecisaoElegibilidadeCiclo_exameAptidaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DecisaoElegibilidadeCiclo_exameAptidaoId_idx" ON pecuaria."DecisaoElegibilidadeCiclo" USING btree ("exameAptidaoId");


--
-- Name: DecisaoElegibilidadeCiclo_vinculoCicloId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DecisaoElegibilidadeCiclo_vinculoCicloId_data_idx" ON pecuaria."DecisaoElegibilidadeCiclo" USING btree ("vinculoCicloId", data);


--
-- Name: DemandaAcompanhamento_animal_estado_data; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DemandaAcompanhamento_animal_estado_data" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("animalId", estado, "previstaPara");


--
-- Name: DemandaAcompanhamento_diagnostico; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DemandaAcompanhamento_diagnostico" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("tentativaId", finalidade, ocorrencia) WHERE ("tentativaId" IS NOT NULL);


--
-- Name: DemandaAcompanhamento_gestacao; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DemandaAcompanhamento_gestacao" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("gestacaoId");


--
-- Name: DemandaAcompanhamento_origem_estado; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DemandaAcompanhamento_origem_estado" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("propriedadeOrigemId", estado);


--
-- Name: DemandaAcompanhamento_participacao; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DemandaAcompanhamento_participacao" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("participacaoAcompanhamentoId");


--
-- Name: DemandaAcompanhamento_reconfirmacao; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DemandaAcompanhamento_reconfirmacao" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("gestacaoId", finalidade, ocorrencia) WHERE ("gestacaoId" IS NOT NULL);


--
-- Name: DemandaAcompanhamento_tentativa; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DemandaAcompanhamento_tentativa" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("tentativaId");


--
-- Name: DemonstrativoLeite_propriedadeId_inicio_fim_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DemonstrativoLeite_propriedadeId_inicio_fim_idx" ON pecuaria."DemonstrativoLeite" USING btree ("propriedadeId", inicio, fim);


--
-- Name: DescarteLeite_movimentoEstornoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DescarteLeite_movimentoEstornoId_key" ON pecuaria."DescarteLeite" USING btree ("movimentoEstornoId");


--
-- Name: DescarteLeite_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DescarteLeite_movimentoId_key" ON pecuaria."DescarteLeite" USING btree ("movimentoId");


--
-- Name: DescarteLeite_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DescarteLeite_propriedadeId_data_idx" ON pecuaria."DescarteLeite" USING btree ("propriedadeId", data);


--
-- Name: DestinacaoColostro_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DestinacaoColostro_chave_key" ON pecuaria."DestinacaoColostro" USING btree (chave);


--
-- Name: DestinacaoColostro_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DestinacaoColostro_propriedadeId_data_idx" ON pecuaria."DestinacaoColostro" USING btree ("propriedadeId", data);


--
-- Name: DestinoInternoLeite_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DestinoInternoLeite_chave_key" ON pecuaria."DestinoInternoLeite" USING btree (chave);


--
-- Name: DestinoInternoLeite_entradaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DestinoInternoLeite_entradaId_idx" ON pecuaria."DestinoInternoLeite" USING btree ("entradaId");


--
-- Name: DestinoInternoLeite_movimentoEstornoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DestinoInternoLeite_movimentoEstornoId_key" ON pecuaria."DestinoInternoLeite" USING btree ("movimentoEstornoId");


--
-- Name: DestinoInternoLeite_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DestinoInternoLeite_movimentoId_key" ON pecuaria."DestinoInternoLeite" USING btree ("movimentoId");


--
-- Name: DestinoInternoLeite_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "DestinoInternoLeite_propriedadeId_data_idx" ON pecuaria."DestinoInternoLeite" USING btree ("propriedadeId", data);


--
-- Name: DetalheFechamentoLeite_fechamentoId_retiradaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DetalheFechamentoLeite_fechamentoId_retiradaId_key" ON pecuaria."DetalheFechamentoLeite" USING btree ("fechamentoId", "retiradaId");


--
-- Name: DiaProducaoLeite_propriedadeId_dataOperacional_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "DiaProducaoLeite_propriedadeId_dataOperacional_key" ON pecuaria."DiaProducaoLeite" USING btree ("propriedadeId", "dataOperacional");


--
-- Name: Dieta_nome_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Dieta_nome_versao_key" ON pecuaria."Dieta" USING btree (nome, versao);


--
-- Name: Doenca_nome_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Doenca_nome_key" ON pecuaria."Doenca" USING btree (nome);


--
-- Name: EmissaoRelatorioLeite_propriedadeId_criadoEm_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EmissaoRelatorioLeite_propriedadeId_criadoEm_idx" ON pecuaria."EmissaoRelatorioLeite" USING btree ("propriedadeId", "criadoEm");


--
-- Name: EntradaLeite_medicao_geral_confirmada; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "EntradaLeite_medicao_geral_confirmada" ON pecuaria."EntradaProducaoLeite" USING btree ("medicaoGeralId") WHERE ((status = 'CONFIRMADA'::text) AND ("medicaoGeralId" IS NOT NULL));


--
-- Name: EntradaProducaoLeite_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "EntradaProducaoLeite_chave_key" ON pecuaria."EntradaProducaoLeite" USING btree (chave);


--
-- Name: EntradaProducaoLeite_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "EntradaProducaoLeite_movimentoId_key" ON pecuaria."EntradaProducaoLeite" USING btree ("movimentoId");


--
-- Name: EntradaProducaoLeite_sessaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EntradaProducaoLeite_sessaoId_idx" ON pecuaria."EntradaProducaoLeite" USING btree ("sessaoId");


--
-- Name: EntregaLeite_propriedadeId_criadoEm_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EntregaLeite_propriedadeId_criadoEm_idx" ON pecuaria."EntregaLeite" USING btree ("propriedadeId", "criadoEm");


--
-- Name: EntregaLeite_retiradaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "EntregaLeite_retiradaId_key" ON pecuaria."EntregaLeite" USING btree ("retiradaId");


--
-- Name: EnvioAplicacoesTablet_animais_pendentes; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EnvioAplicacoesTablet_animais_pendentes" ON pecuaria."EnvioAplicacoesTablet" USING gin ("animalIds") WHERE ((devolucao IS NOT NULL) OR ("revisadoEm" IS NULL));


--
-- Name: EnvioAplicacoesTablet_propriedadeId_enviadoEm_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EnvioAplicacoesTablet_propriedadeId_enviadoEm_idx" ON pecuaria."EnvioAplicacoesTablet" USING btree ("propriedadeId", "enviadoEm");


--
-- Name: EtapaProtocoloSanitario_protocoloId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "EtapaProtocoloSanitario_protocoloId_ordem_key" ON pecuaria."EtapaProtocolo" USING btree ("protocoloId", ordem);


--
-- Name: EventoTarefaProtocolo_dispensa_unica; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "EventoTarefaProtocolo_dispensa_unica" ON pecuaria."EventoTarefaProtocolo" USING btree ("tarefaId") WHERE (tipo = 'DISPENSA'::pecuaria."TipoEventoTarefaProtocolo");


--
-- Name: EventoTarefaProtocolo_eventoCorrigidoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EventoTarefaProtocolo_eventoCorrigidoId_idx" ON pecuaria."EventoTarefaProtocolo" USING btree ("eventoCorrigidoId");


--
-- Name: EventoTarefaProtocolo_registradoPorId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EventoTarefaProtocolo_registradoPorId_idx" ON pecuaria."EventoTarefaProtocolo" USING btree ("registradoPorId");


--
-- Name: EventoTarefaProtocolo_tarefaId_registradoEm_id_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "EventoTarefaProtocolo_tarefaId_registradoEm_id_idx" ON pecuaria."EventoTarefaProtocolo" USING btree ("tarefaId", "registradoEm", id);


--
-- Name: ExameAnimal_animalId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExameAnimal_animalId_data_idx" ON pecuaria."ExameAnimal" USING btree ("animalId", data);


--
-- Name: ExameAnimal_operacaoServicoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExameAnimal_operacaoServicoId_idx" ON pecuaria."ExameAnimal" USING btree ("operacaoServicoId");


--
-- Name: ExameAnimal_partoPosPartoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExameAnimal_partoPosPartoId_idx" ON pecuaria."ExameAnimal" USING btree ("partoPosPartoId");


--
-- Name: ExameAnimal_tarefaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExameAnimal_tarefaId_idx" ON pecuaria."ExameAnimal" USING btree ("tarefaId");


--
-- Name: ExameAnimal_tarefaId_valido_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ExameAnimal_tarefaId_valido_key" ON pecuaria."ExameAnimal" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("tarefaId" IS NOT NULL));


--
-- Name: ExameImunidadeColostragem_exameId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ExameImunidadeColostragem_exameId_key" ON pecuaria."ExameImunidadeColostragem" USING btree ("exameId");


--
-- Name: ExecucaoProtocoloSanitario_animalId_inicio_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExecucaoProtocoloSanitario_animalId_inicio_idx" ON pecuaria."ParticipacaoProtocolo" USING btree ("animalId", "inicioReferencia");


--
-- Name: ExecucaoProtocoloSanitario_operacaoServicoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExecucaoProtocoloSanitario_operacaoServicoId_idx" ON pecuaria."ParticipacaoProtocolo" USING btree ("operacaoServicoId");


--
-- Name: ExecucaoProtocoloSanitario_rodadaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ExecucaoProtocoloSanitario_rodadaId_idx" ON pecuaria."ParticipacaoProtocolo" USING btree ("programacaoId");


--
-- Name: ExecucaoProtocoloSanitario_rodada_animal_ativa; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ExecucaoProtocoloSanitario_rodada_animal_ativa" ON pecuaria."ParticipacaoProtocolo" USING btree ("programacaoId", "animalId") WHERE (("programacaoId" IS NOT NULL) AND ("canceladaEm" IS NULL));


--
-- Name: ExposicaoTouro_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ExposicaoTouro_referenciaExterna_key" ON pecuaria."ExposicaoTouro" USING btree ("referenciaExterna");


--
-- Name: FaseBezerreiroVersao_propriedadeId_identidadeId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "FaseBezerreiroVersao_propriedadeId_identidadeId_versao_key" ON pecuaria."FaseBezerreiroVersao" USING btree ("propriedadeId", "identidadeId", versao);


--
-- Name: FechamentoConsumo_loteId_inicio_fim_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "FechamentoConsumo_loteId_inicio_fim_idx" ON pecuaria."FechamentoConsumo" USING btree ("loteId", inicio, fim);


--
-- Name: FechamentoOperacaoLeite_comercialId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "FechamentoOperacaoLeite_comercialId_versao_key" ON pecuaria."FechamentoOperacaoLeite" USING btree ("comercialId", versao);


--
-- Name: FechamentoOperacaoLeite_operacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "FechamentoOperacaoLeite_operacaoId_key" ON pecuaria."FechamentoOperacaoLeite" USING btree ("operacaoId");


--
-- Name: FinalidadeAnimal_animalId_aberto_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "FinalidadeAnimal_animalId_aberto_key" ON pecuaria."FinalidadeAnimal" USING btree ("animalId") WHERE (ate IS NULL);


--
-- Name: FinalidadeAnimal_animalId_ate_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "FinalidadeAnimal_animalId_ate_idx" ON pecuaria."FinalidadeAnimal" USING btree ("animalId", ate);


--
-- Name: FornecimentoColostro_criaId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "FornecimentoColostro_criaId_data_idx" ON pecuaria."FornecimentoColostro" USING btree ("criaId", data);


--
-- Name: FornecimentoColostro_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "FornecimentoColostro_propriedadeId_data_idx" ON pecuaria."FornecimentoColostro" USING btree ("propriedadeId", data);


--
-- Name: FornecimentoNutricionalLeite_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "FornecimentoNutricionalLeite_propriedadeId_data_idx" ON pecuaria."FornecimentoNutricionalLeite" USING btree ("propriedadeId", data);


--
-- Name: GenitorExterno_fornecedorId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "GenitorExterno_fornecedorId_idx" ON pecuaria."GenitorExterno" USING btree ("fornecedorId");


--
-- Name: GenitorExterno_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "GenitorExterno_ideagriId_key" ON pecuaria."GenitorExterno" USING btree ("ideagriId");


--
-- Name: GenitorExterno_sexo_nome_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "GenitorExterno_sexo_nome_idx" ON pecuaria."GenitorExterno" USING btree (sexo, nome);


--
-- Name: GestacaoAnimal_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "GestacaoAnimal_animalId_idx" ON pecuaria."GestacaoAnimal" USING btree ("animalId");


--
-- Name: GestacaoAnimal_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "GestacaoAnimal_referenciaExterna_key" ON pecuaria."GestacaoAnimal" USING btree ("referenciaExterna");


--
-- Name: GestacaoAnimal_tentativaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "GestacaoAnimal_tentativaId_key" ON pecuaria."GestacaoAnimal" USING btree ("tentativaId");


--
-- Name: GestacaoAnimal_uma_aberta; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "GestacaoAnimal_uma_aberta" ON pecuaria."GestacaoAnimal" USING btree ("animalId") WHERE (("encerradaEm" IS NULL) AND (status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3"));


--
-- Name: GrupoOfertaBezerreiro_coleira_unica; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "GrupoOfertaBezerreiro_coleira_unica" ON pecuaria."GrupoOfertaBezerreiro" USING btree ("ofertaId", COALESCE("coleiraId", ''::text));


--
-- Name: GrupoOfertaBezerreiro_ofertaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "GrupoOfertaBezerreiro_ofertaId_idx" ON pecuaria."GrupoOfertaBezerreiro" USING btree ("ofertaId");


--
-- Name: HistoricoPrevisaoParto_gestacaoId_criadoEm_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "HistoricoPrevisaoParto_gestacaoId_criadoEm_idx" ON pecuaria."HistoricoPrevisaoParto" USING btree ("gestacaoId", "criadoEm");


--
-- Name: ImpressaoVisita_visitaId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ImpressaoVisita_visitaId_versao_key" ON pecuaria."ImpressaoVisita" USING btree ("visitaId", versao);


--
-- Name: InsumoPreparoColostro_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "InsumoPreparoColostro_movimentoId_key" ON pecuaria."InsumoPreparoColostro" USING btree ("movimentoId");


--
-- Name: InsumoPreparoColostro_preparoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "InsumoPreparoColostro_preparoId_idx" ON pecuaria."InsumoPreparoColostro" USING btree ("preparoId");


--
-- Name: InterpretacaoReprodutiva_exameId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "InterpretacaoReprodutiva_exameId_key" ON pecuaria."InterpretacaoReprodutiva" USING btree ("exameId");


--
-- Name: ItemConsumoDiario_diaId_produtoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ItemConsumoDiario_diaId_produtoId_key" ON pecuaria."ItemConsumoDiario" USING btree ("diaId", "produtoId");


--
-- Name: ItemDieta_dietaId_produtoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ItemDieta_dietaId_produtoId_key" ON pecuaria."ItemDieta" USING btree ("dietaId", "produtoId");


--
-- Name: ItemFechamentoConsumo_fechamentoId_produtoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ItemFechamentoConsumo_fechamentoId_produtoId_key" ON pecuaria."ItemFechamentoConsumo" USING btree ("fechamentoId", "produtoId");


--
-- Name: ItemFechamentoConsumo_grupoOfertaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ItemFechamentoConsumo_grupoOfertaId_key" ON pecuaria."ItemFechamentoConsumo" USING btree ("grupoOfertaId");


--
-- Name: ItemFechamentoConsumo_movimentoEstoqueId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ItemFechamentoConsumo_movimentoEstoqueId_key" ON pecuaria."ItemFechamentoConsumo" USING btree ("movimentoEstoqueId");


--
-- Name: LactacaoAnimal_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LactacaoAnimal_animalId_idx" ON pecuaria."LactacaoAnimal" USING btree ("animalId");


--
-- Name: LactacaoAnimal_animalId_inicio_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LactacaoAnimal_animalId_inicio_idx" ON pecuaria."LactacaoAnimal" USING btree ("animalId", inicio);


--
-- Name: LactacaoAnimal_partoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LactacaoAnimal_partoId_key" ON pecuaria."LactacaoAnimal" USING btree ("partoId");


--
-- Name: LactacaoAnimal_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LactacaoAnimal_referenciaExterna_key" ON pecuaria."LactacaoAnimal" USING btree ("referenciaExterna");


--
-- Name: LactacaoAnimal_uma_aberta; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LactacaoAnimal_uma_aberta" ON pecuaria."LactacaoAnimal" USING btree ("animalId") WHERE ("encerradaEm" IS NULL);


--
-- Name: LocalizacaoAnimal_animalId_aberta_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LocalizacaoAnimal_animalId_aberta_key" ON pecuaria."LocalizacaoAnimal" USING btree ("animalId") WHERE (ate IS NULL);


--
-- Name: LocalizacaoAnimal_animalId_ate_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LocalizacaoAnimal_animalId_ate_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("animalId", ate);


--
-- Name: LocalizacaoAnimal_loteId_ate_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LocalizacaoAnimal_loteId_ate_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("loteId", ate);


--
-- Name: LocalizacaoAnimal_movimentacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LocalizacaoAnimal_movimentacaoId_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("movimentacaoId");


--
-- Name: LocalizacaoAnimal_propriedadeId_ate_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LocalizacaoAnimal_propriedadeId_ate_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("propriedadeId", ate);


--
-- Name: LoteColostro_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LoteColostro_chave_key" ON pecuaria."LoteColostro" USING btree (chave);


--
-- Name: LoteColostro_entradaId_ativo_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LoteColostro_entradaId_ativo_key" ON pecuaria."LoteColostro" USING btree ("entradaId") WHERE ((status <> 'ESTORNADO'::text) AND ("entradaId" IS NOT NULL));


--
-- Name: LoteColostro_entradaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LoteColostro_entradaId_idx" ON pecuaria."LoteColostro" USING btree ("entradaId");


--
-- Name: LoteColostro_medicaoGeralId_ativo_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LoteColostro_medicaoGeralId_ativo_key" ON pecuaria."LoteColostro" USING btree ("medicaoGeralId") WHERE ((status <> 'ESTORNADO'::text) AND ("medicaoGeralId" IS NOT NULL));


--
-- Name: LoteColostro_medicaoGeralId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LoteColostro_medicaoGeralId_idx" ON pecuaria."LoteColostro" USING btree ("medicaoGeralId");


--
-- Name: LoteColostro_partoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LoteColostro_partoId_idx" ON pecuaria."LoteColostro" USING btree ("partoId");


--
-- Name: LoteColostro_primeira_retirada; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "LoteColostro_primeira_retirada" ON pecuaria."LoteColostro" USING btree ("partoId") WHERE ("primeiraRetirada" AND (status <> 'ESTORNADO'::text));


--
-- Name: LoteColostro_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "LoteColostro_propriedadeId_data_idx" ON pecuaria."LoteColostro" USING btree ("propriedadeId", data);


--
-- Name: Lote_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Lote_ideagriId_key" ON pecuaria."Lote" USING btree ("ideagriId");


--
-- Name: Lote_propriedadeId_nome_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Lote_propriedadeId_nome_key" ON pecuaria."Lote" USING btree ("propriedadeId", nome);


--
-- Name: ManejoAnimal_animalId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ManejoAnimal_animalId_data_idx" ON pecuaria."ManejoAnimal" USING btree ("animalId", data);


--
-- Name: ManejoAnimal_pesagemId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ManejoAnimal_pesagemId_key" ON pecuaria."ManejoAnimal" USING btree ("pesagemId");


--
-- Name: ManejoAnimal_retirada_unica; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ManejoAnimal_retirada_unica" ON pecuaria."ManejoAnimal" USING btree ("insercaoAplicacaoId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") OR "realizacaoMantida");


--
-- Name: ManejoAnimal_tarefa_valida; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ManejoAnimal_tarefa_valida" ON pecuaria."ManejoAnimal" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") OR "realizacaoMantida");


--
-- Name: ManejoAnimal_unico_valido; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ManejoAnimal_unico_valido" ON pecuaria."ManejoAnimal" USING btree ("animalId", tipo) WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND (tipo = ANY (ARRAY['DESMAMA'::text, 'CASTRACAO'::text])));


--
-- Name: MaterialGenetico_doadoraExternaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MaterialGenetico_doadoraExternaId_idx" ON pecuaria."MaterialGenetico" USING btree ("doadoraExternaId");


--
-- Name: MaterialGenetico_doadoraId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MaterialGenetico_doadoraId_idx" ON pecuaria."MaterialGenetico" USING btree ("doadoraId");


--
-- Name: MaterialGenetico_produtoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MaterialGenetico_produtoId_key" ON pecuaria."MaterialGenetico" USING btree ("produtoId");


--
-- Name: MaterialGenetico_touroExternoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MaterialGenetico_touroExternoId_idx" ON pecuaria."MaterialGenetico" USING btree ("touroExternoId");


--
-- Name: MaterialGenetico_touroId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MaterialGenetico_touroId_idx" ON pecuaria."MaterialGenetico" USING btree ("touroId");


--
-- Name: MedicaoGeralLeite_animaisOrigem_gin; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MedicaoGeralLeite_animaisOrigem_gin" ON pecuaria."MedicaoGeralLeite" USING gin ("animaisOrigem" jsonb_path_ops);


--
-- Name: MedicaoGeralLeite_recipiente_unico; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MedicaoGeralLeite_recipiente_unico" ON pecuaria."MedicaoGeralLeite" USING btree ("sessaoId", lower(TRIM(BOTH FROM recipiente))) WHERE ("tanqueId" IS NULL);


--
-- Name: MedicaoGeralLeite_sessaoId_tanqueId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MedicaoGeralLeite_sessaoId_tanqueId_key" ON pecuaria."MedicaoGeralLeite" USING btree ("sessaoId", "tanqueId");


--
-- Name: MedicaoLeite_participanteId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MedicaoLeite_participanteId_idx" ON pecuaria."MedicaoLeite" USING btree ("participanteId");


--
-- Name: MedicaoLeite_sessaoId_participanteId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MedicaoLeite_sessaoId_participanteId_key" ON pecuaria."MedicaoLeite" USING btree ("sessaoId", "participanteId");


--
-- Name: MesNutricao_loteId_competencia_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MesNutricao_loteId_competencia_key" ON pecuaria."MesNutricao" USING btree ("loteId", competencia);


--
-- Name: MesNutricao_propriedadeId_competencia_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MesNutricao_propriedadeId_competencia_idx" ON pecuaria."MesNutricao" USING btree ("propriedadeId", competencia);


--
-- Name: MotivoBaixa_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MotivoBaixa_ideagriId_key" ON pecuaria."MotivoBaixa" USING btree ("ideagriId");


--
-- Name: MovimentacaoAnimal_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MovimentacaoAnimal_animalId_idx" ON pecuaria."MovimentacaoAnimal" USING btree ("animalId");


--
-- Name: MovimentacaoAnimal_localizacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MovimentacaoAnimal_localizacaoId_key" ON pecuaria."MovimentacaoAnimal" USING btree ("localizacaoId");


--
-- Name: MovimentacaoAnimal_movimentacaoId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MovimentacaoAnimal_movimentacaoId_animalId_key" ON pecuaria."MovimentacaoAnimal" USING btree ("movimentacaoId", "animalId");


--
-- Name: MovimentacaoAnimal_origemLoteId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MovimentacaoAnimal_origemLoteId_idx" ON pecuaria."MovimentacaoAnimal" USING btree ("origemLoteId");


--
-- Name: MovimentacaoAnimal_origemPropriedadeId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MovimentacaoAnimal_origemPropriedadeId_idx" ON pecuaria."MovimentacaoAnimal" USING btree ("origemPropriedadeId");


--
-- Name: Movimentacao_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Movimentacao_data_idx" ON pecuaria."Movimentacao" USING btree (data);


--
-- Name: Movimentacao_loteDestinoId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Movimentacao_loteDestinoId_data_idx" ON pecuaria."Movimentacao" USING btree ("loteDestinoId", data);


--
-- Name: Movimentacao_propriedadeDestinoId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Movimentacao_propriedadeDestinoId_data_idx" ON pecuaria."Movimentacao" USING btree ("propriedadeDestinoId", data);


--
-- Name: MovimentoConsumoDiario_itemId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "MovimentoConsumoDiario_itemId_idx" ON pecuaria."MovimentoConsumoDiario" USING btree ("itemId");


--
-- Name: MovimentoConsumoDiario_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "MovimentoConsumoDiario_movimentoId_key" ON pecuaria."MovimentoConsumoDiario" USING btree ("movimentoId");


--
-- Name: NecessidadeProgramacaoSanitaria_alertaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_alertaId_key" ON pecuaria."NecessidadeProgramacaoSanitaria" USING btree ("alertaId");


--
-- Name: NecessidadeProgramacaoSanitaria_aplicacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_aplicacaoId_key" ON pecuaria."NecessidadeProgramacaoSanitaria" USING btree ("aplicacaoId");


--
-- Name: NecessidadeProgramacaoSanitaria_exameId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_exameId_key" ON pecuaria."NecessidadeProgramacaoSanitaria" USING btree ("exameId");


--
-- Name: NecessidadeProgramacaoSanitaria_programacaoId_periodo_sujei_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_programacaoId_periodo_sujei_key" ON pecuaria."NecessidadeProgramacaoSanitaria" USING btree ("programacaoId", periodo, "sujeitoTipo", "sujeitoId");


--
-- Name: NecessidadeProgramacaoSanitaria_regraNecessidadeId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeProgramacaoSanitaria_regraNecessidadeId_key" ON pecuaria."NecessidadeProgramacaoSanitaria" USING btree ("regraNecessidadeId");


--
-- Name: NecessidadeReprodutiva_animalId_situacao_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "NecessidadeReprodutiva_animalId_situacao_idx" ON pecuaria."NecessidadeReprodutiva" USING btree ("animalId", situacao);


--
-- Name: NecessidadeReprodutiva_convergidaParaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "NecessidadeReprodutiva_convergidaParaId_idx" ON pecuaria."NecessidadeReprodutiva" USING btree ("convergidaParaId");


--
-- Name: NecessidadeReprodutiva_propriedadeId_situacao_previstaPara_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "NecessidadeReprodutiva_propriedadeId_situacao_previstaPara_idx" ON pecuaria."NecessidadeReprodutiva" USING btree ("propriedadeId", situacao, "previstaPara");


--
-- Name: NecessidadeSanitaria_alertaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeSanitaria_alertaId_key" ON pecuaria."NecessidadeSanitaria" USING btree ("alertaId");


--
-- Name: NecessidadeSanitaria_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "NecessidadeSanitaria_animalId_idx" ON pecuaria."NecessidadeSanitaria" USING btree ("animalId");


--
-- Name: NecessidadeSanitaria_aplicacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeSanitaria_aplicacaoId_key" ON pecuaria."NecessidadeSanitaria" USING btree ("aplicacaoId");


--
-- Name: NecessidadeSanitaria_participacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeSanitaria_participacaoId_key" ON pecuaria."NecessidadeSanitaria" USING btree ("participacaoId");


--
-- Name: NecessidadeSanitaria_propriedadeId_situacao_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "NecessidadeSanitaria_propriedadeId_situacao_idx" ON pecuaria."NecessidadeSanitaria" USING btree ("propriedadeId", situacao);


--
-- Name: NecessidadeSanitaria_regraId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "NecessidadeSanitaria_regraId_animalId_key" ON pecuaria."NecessidadeSanitaria" USING btree ("regraId", "animalId");


--
-- Name: OcorrenciaSanitaria_animalId_inicio_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OcorrenciaSanitaria_animalId_inicio_idx" ON pecuaria."OcorrenciaSanitaria" USING btree ("animalId", inicio);


--
-- Name: OcorrenciaSanitaria_partoRetencaoPlacentaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OcorrenciaSanitaria_partoRetencaoPlacentaId_idx" ON pecuaria."OcorrenciaSanitaria" USING btree ("partoRetencaoPlacentaId");


--
-- Name: OcorrenciaSanitaria_propriedadeId_inicio_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OcorrenciaSanitaria_propriedadeId_inicio_idx" ON pecuaria."OcorrenciaSanitaria" USING btree ("propriedadeId", inicio);


--
-- Name: OfertaBezerreiro_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OfertaBezerreiro_chave_key" ON pecuaria."OfertaBezerreiro" USING btree (chave);


--
-- Name: OfertaBezerreiro_perfilId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OfertaBezerreiro_perfilId_data_idx" ON pecuaria."OfertaBezerreiro" USING btree ("perfilId", data);


--
-- Name: OfertaBezerreiro_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OfertaBezerreiro_propriedadeId_data_idx" ON pecuaria."OfertaBezerreiro" USING btree ("propriedadeId", data);


--
-- Name: OfertaProgramadaBezerreiro_faseVersaoId_identidadeId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OfertaProgramadaBezerreiro_faseVersaoId_identidadeId_key" ON pecuaria."OfertaProgramadaBezerreiro" USING btree ("faseVersaoId", "identidadeId");


--
-- Name: OfertaProgramadaBezerreiro_faseVersaoId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OfertaProgramadaBezerreiro_faseVersaoId_ordem_key" ON pecuaria."OfertaProgramadaBezerreiro" USING btree ("faseVersaoId", ordem);


--
-- Name: OperacaoComercialLeite_propriedadeId_inicio_fim_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OperacaoComercialLeite_propriedadeId_inicio_fim_idx" ON pecuaria."OperacaoComercialLeite" USING btree ("propriedadeId", inicio, fim);


--
-- Name: OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key" ON pecuaria."OperacaoComercialLeite" USING btree ("propriedadeId", "parceiroId", inicio, fim);


--
-- Name: OrigemColostro_loteColostroId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OrigemColostro_loteColostroId_key" ON pecuaria."OrigemColostro" USING btree ("loteColostroId");


--
-- Name: OrigemColostro_preparoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OrigemColostro_preparoId_key" ON pecuaria."OrigemColostro" USING btree ("preparoId");


--
-- Name: OrigemColostro_propriedadeId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OrigemColostro_propriedadeId_idx" ON pecuaria."OrigemColostro" USING btree ("propriedadeId");


--
-- Name: OrigemPreparoColostro_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "OrigemPreparoColostro_movimentoId_key" ON pecuaria."OrigemPreparoColostro" USING btree ("movimentoId");


--
-- Name: OrigemPreparoColostro_origemId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "OrigemPreparoColostro_origemId_idx" ON pecuaria."OrigemPreparoColostro" USING btree ("origemId");


--
-- Name: ParcelaDestinoLeite_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParcelaDestinoLeite_animalId_idx" ON pecuaria."ParcelaDestinoLeite" USING btree ("animalId");


--
-- Name: ParcelaDestinoLeite_destinoId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParcelaDestinoLeite_destinoId_animalId_key" ON pecuaria."ParcelaDestinoLeite" USING btree ("destinoId", "animalId");


--
-- Name: ParcelaDestinoLeite_fornecimentoColostroId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParcelaDestinoLeite_fornecimentoColostroId_idx" ON pecuaria."ParcelaDestinoLeite" USING btree ("fornecimentoColostroId");


--
-- Name: ParcelaDestinoLeite_fornecimento_ativo_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParcelaDestinoLeite_fornecimento_ativo_key" ON pecuaria."ParcelaDestinoLeite" USING btree ("fornecimentoColostroId") WHERE (ativo AND ("fornecimentoColostroId" IS NOT NULL));


--
-- Name: ParticipacaoBezerreiro_animalId_desde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipacaoBezerreiro_animalId_desde_idx" ON pecuaria."ParticipacaoBezerreiro" USING btree ("animalId", desde);


--
-- Name: ParticipacaoBezerreiro_perfilId_desde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipacaoBezerreiro_perfilId_desde_idx" ON pecuaria."ParticipacaoBezerreiro" USING btree ("perfilId", desde);


--
-- Name: ParticipacaoConsumoAnimal_fechamentoId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipacaoConsumoAnimal_fechamentoId_animalId_key" ON pecuaria."ParticipacaoConsumoAnimal" USING btree ("fechamentoId", "animalId");


--
-- Name: ParticipacaoConsumoDiario_diaId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipacaoConsumoDiario_diaId_animalId_key" ON pecuaria."ParticipacaoConsumoDiario" USING btree ("diaId", "animalId");


--
-- Name: ParticipacaoExposicao_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipacaoExposicao_animalId_idx" ON pecuaria."ParticipacaoExposicao" USING btree ("animalId");


--
-- Name: ParticipacaoExposicao_exposicaoId_animalId_inicio_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipacaoExposicao_exposicaoId_animalId_inicio_key" ON pecuaria."ParticipacaoExposicao" USING btree ("exposicaoId", "animalId", inicio);


--
-- Name: ParticipanteProducaoLeite_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipanteProducaoLeite_animalId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("animalId");


--
-- Name: ParticipanteProducaoLeite_diaId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipanteProducaoLeite_diaId_animalId_key" ON pecuaria."ParticipanteProducaoLeite" USING btree ("diaId", "animalId");


--
-- Name: ParticipanteProducaoLeite_finalidadeId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipanteProducaoLeite_finalidadeId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("finalidadeId");


--
-- Name: ParticipanteProducaoLeite_id_diaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipanteProducaoLeite_id_diaId_key" ON pecuaria."ParticipanteProducaoLeite" USING btree (id, "diaId");


--
-- Name: ParticipanteProducaoLeite_lactacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipanteProducaoLeite_lactacaoId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("lactacaoId");


--
-- Name: ParticipanteProducaoLeite_localizacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipanteProducaoLeite_localizacaoId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("localizacaoId");


--
-- Name: ParticipanteVisita_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipanteVisita_animalId_idx" ON pecuaria."ParticipanteVisita" USING btree ("animalId");


--
-- Name: ParticipanteVisita_atividadeId_animalId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipanteVisita_atividadeId_animalId_key" ON pecuaria."ParticipanteVisita" USING btree ("atividadeId", "animalId");


--
-- Name: ParticipanteVisita_atividadeId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ParticipanteVisita_atividadeId_ordem_key" ON pecuaria."ParticipanteVisita" USING btree ("atividadeId", ordem);


--
-- Name: ParticipanteVisita_tarefaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ParticipanteVisita_tarefaId_idx" ON pecuaria."ParticipanteVisita" USING btree ("tarefaId");


--
-- Name: PartoAnimal_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "PartoAnimal_animalId_idx" ON pecuaria."PartoAnimal" USING btree ("animalId");


--
-- Name: PartoAnimal_gestacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PartoAnimal_gestacaoId_key" ON pecuaria."PartoAnimal" USING btree ("gestacaoId");


--
-- Name: PartoAnimal_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PartoAnimal_referenciaExterna_key" ON pecuaria."PartoAnimal" USING btree ("referenciaExterna");


--
-- Name: PerfilBezerreiro_loteId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PerfilBezerreiro_loteId_key" ON pecuaria."PerfilBezerreiro" USING btree ("loteId");


--
-- Name: PerfilBezerreiro_propriedadeId_ativo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "PerfilBezerreiro_propriedadeId_ativo_idx" ON pecuaria."PerfilBezerreiro" USING btree ("propriedadeId", ativo);


--
-- Name: PerfilNutricionalProduto_produtoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PerfilNutricionalProduto_produtoId_key" ON pecuaria."PerfilNutricionalProduto" USING btree ("produtoId");


--
-- Name: PerfilSanitarioProduto_produtoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PerfilSanitarioProduto_produtoId_key" ON pecuaria."PerfilSanitarioProduto" USING btree ("produtoId");


--
-- Name: PeriodoFaseBezerreiro_participacaoId_desde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "PeriodoFaseBezerreiro_participacaoId_desde_idx" ON pecuaria."PeriodoFaseBezerreiro" USING btree ("participacaoId", desde);


--
-- Name: PeriodoReprodutivoAnimal_animalId_inicio_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "PeriodoReprodutivoAnimal_animalId_inicio_idx" ON pecuaria."PeriodoReprodutivoAnimal" USING btree ("animalId", inicio);


--
-- Name: PeriodoReprodutivoAnimal_destinoOrigemId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PeriodoReprodutivoAnimal_destinoOrigemId_key" ON pecuaria."PeriodoReprodutivoAnimal" USING btree ("destinoOrigemId");


--
-- Name: Pesagem_animalId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "Pesagem_animalId_data_idx" ON pecuaria."Pesagem" USING btree ("animalId", data);


--
-- Name: Pesagem_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Pesagem_ideagriId_key" ON pecuaria."Pesagem" USING btree ("ideagriId");


--
-- Name: Pesagem_referenciaHistorica_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Pesagem_referenciaHistorica_key" ON pecuaria."Pesagem" USING btree ("referenciaHistorica");


--
-- Name: PoliticaElegibilidadeReprodutiva_propriedadeId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PoliticaElegibilidadeReprodutiva_propriedadeId_versao_key" ON pecuaria."PoliticaElegibilidadeReprodutiva" USING btree ("propriedadeId", versao);


--
-- Name: PoliticaElegibilidadeReprodutiva_propriedadeId_vigenteDesde_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PoliticaElegibilidadeReprodutiva_propriedadeId_vigenteDesde_key" ON pecuaria."PoliticaElegibilidadeReprodutiva" USING btree ("propriedadeId", "vigenteDesde");


--
-- Name: PosicaoOrdenha_configuracaoId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PosicaoOrdenha_configuracaoId_ordem_key" ON pecuaria."PosicaoOrdenha" USING btree ("configuracaoId", ordem);


--
-- Name: PosicaoOrdenha_configuracaoId_posicaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PosicaoOrdenha_configuracaoId_posicaoId_key" ON pecuaria."PosicaoOrdenha" USING btree ("configuracaoId", "posicaoId");


--
-- Name: PreparoColostro_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "PreparoColostro_chave_key" ON pecuaria."PreparoColostro" USING btree (chave);


--
-- Name: PreparoColostro_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "PreparoColostro_propriedadeId_data_idx" ON pecuaria."PreparoColostro" USING btree ("propriedadeId", data);


--
-- Name: Preparo_aplicacao_atual; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Preparo_aplicacao_atual" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId", "aplicacaoId") WHERE ("encerradoEm" IS NULL);


--
-- Name: Preparo_exame_atual; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Preparo_exame_atual" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId", "exameId") WHERE ("encerradoEm" IS NULL);


--
-- Name: Preparo_participacao_atual; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Preparo_participacao_atual" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId", "participacaoId") WHERE ("encerradoEm" IS NULL);


--
-- Name: ProgramacaoRetiradaLeite_propriedadeId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ProgramacaoRetiradaLeite_propriedadeId_versao_key" ON pecuaria."ProgramacaoRetiradaLeite" USING btree ("propriedadeId", versao);


--
-- Name: ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_idx" ON pecuaria."ProgramacaoRetiradaLeite" USING btree ("propriedadeId", "vigenteDesde");


--
-- Name: ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_key" ON pecuaria."ProgramacaoRetiradaLeite" USING btree ("propriedadeId", "vigenteDesde");


--
-- Name: ProgramacaoSanitaria_propriedadeId_ativo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ProgramacaoSanitaria_propriedadeId_ativo_idx" ON pecuaria."ProgramacaoSanitaria" USING btree ("propriedadeId", ativo);


--
-- Name: ProgramacaoSanitaria_regraEquivalenteId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ProgramacaoSanitaria_regraEquivalenteId_key" ON pecuaria."ProgramacaoSanitaria" USING btree ("regraEquivalenteId");


--
-- Name: Protocolo_tipo_nome_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Protocolo_tipo_nome_versao_key" ON pecuaria."Protocolo" USING btree (tipo, nome, versao);


--
-- Name: Raca_ideagriId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "Raca_ideagriId_key" ON pecuaria."Raca" USING btree ("ideagriId");


--
-- Name: RegraImpactoProcedimentoReprodutivo_propriedadeId_ativo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "RegraImpactoProcedimentoReprodutivo_propriedadeId_ativo_idx" ON pecuaria."RegraImpactoProcedimentoReprodutivo" USING btree ("propriedadeId", ativo);


--
-- Name: RegraSanitariaReprodutiva_propriedadeId_doencaId_acao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "RegraSanitariaReprodutiva_propriedadeId_doencaId_acao_key" ON pecuaria."RegraSanitariaReprodutiva" USING btree ("propriedadeId", "doencaId", acao);


--
-- Name: RestricaoReprodutiva_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "RestricaoReprodutiva_animalId_idx" ON pecuaria."RestricaoReprodutiva" USING btree ("animalId");


--
-- Name: RestricaoReprodutiva_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "RestricaoReprodutiva_referenciaExterna_key" ON pecuaria."RestricaoReprodutiva" USING btree ("referenciaExterna");


--
-- Name: ResultadoExame_exameId_campo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ResultadoExame_exameId_campo_idx" ON pecuaria."ResultadoExame" USING btree ("exameId", campo);


--
-- Name: ResultadoExame_um_vigente; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ResultadoExame_um_vigente" ON pecuaria."ResultadoExame" USING btree ("exameId", campo) WHERE vigente;


--
-- Name: ResultadoQualidadeLeite_amostraId_campo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "ResultadoQualidadeLeite_amostraId_campo_idx" ON pecuaria."ResultadoQualidadeLeite" USING btree ("amostraId", campo);


--
-- Name: ResultadoQualidadeLeite_campo_vigente_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "ResultadoQualidadeLeite_campo_vigente_key" ON pecuaria."ResultadoQualidadeLeite" USING btree ("amostraId", campo) WHERE vigente;


--
-- Name: RetiradaInternaLeite_propriedadeId_data_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "RetiradaInternaLeite_propriedadeId_data_idx" ON pecuaria."RetiradaInternaLeite" USING btree ("propriedadeId", data);


--
-- Name: RetiradaOperacaoLeite_comercialId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "RetiradaOperacaoLeite_comercialId_idx" ON pecuaria."RetiradaOperacaoLeite" USING btree ("comercialId");


--
-- Name: RetiradaOperacaoLeite_movimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "RetiradaOperacaoLeite_movimentoId_key" ON pecuaria."RetiradaOperacaoLeite" USING btree ("movimentoId");


--
-- Name: RevisaoRegraAlertaSanitario_regraId_revisao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "RevisaoRegraAlertaSanitario_regraId_revisao_key" ON pecuaria."RevisaoRegraAlertaSanitario" USING btree ("regraId", revisao);


--
-- Name: RodadaProtocoloSanitario_propriedadeId_inicioReferencia_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "RodadaProtocoloSanitario_propriedadeId_inicioReferencia_idx" ON pecuaria."ProgramacaoProtocolo" USING btree ("propriedadeId", "inicioReferencia");


--
-- Name: RodadaProtocoloSanitario_protocoloId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "RodadaProtocoloSanitario_protocoloId_idx" ON pecuaria."ProgramacaoProtocolo" USING btree ("protocoloId");


--
-- Name: SelecaoVisita_propriedadeId_ativo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "SelecaoVisita_propriedadeId_ativo_idx" ON pecuaria."SelecaoVisita" USING btree ("propriedadeId", ativo);


--
-- Name: SessaoOrdenha_diaId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "SessaoOrdenha_diaId_ordem_key" ON pecuaria."SessaoOrdenha" USING btree ("diaId", ordem);


--
-- Name: SessaoOrdenha_diaId_posicaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "SessaoOrdenha_diaId_posicaoId_key" ON pecuaria."SessaoOrdenha" USING btree ("diaId", "posicaoId");


--
-- Name: SessaoOrdenha_id_diaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "SessaoOrdenha_id_diaId_key" ON pecuaria."SessaoOrdenha" USING btree (id, "diaId");


--
-- Name: SituacaoInicialReprodutiva_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "SituacaoInicialReprodutiva_animalId_idx" ON pecuaria."SituacaoInicialReprodutiva" USING btree ("animalId");


--
-- Name: SituacaoInicialReprodutiva_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "SituacaoInicialReprodutiva_referenciaExterna_key" ON pecuaria."SituacaoInicialReprodutiva" USING btree ("referenciaExterna");


--
-- Name: SnapshotRelatorioReprodutivo_propriedadeId_tipo_criadoEm_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "SnapshotRelatorioReprodutivo_propriedadeId_tipo_criadoEm_idx" ON pecuaria."SnapshotRelatorioReprodutivo" USING btree ("propriedadeId", tipo, "criadoEm");


--
-- Name: TanqueLeite_propriedadeId_identidadeId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TanqueLeite_propriedadeId_identidadeId_versao_key" ON pecuaria."TanqueLeite" USING btree ("propriedadeId", "identidadeId", versao);


--
-- Name: TanqueLeite_propriedadeId_identidadeId_vigenteDesde_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TanqueLeite_propriedadeId_identidadeId_vigenteDesde_key" ON pecuaria."TanqueLeite" USING btree ("propriedadeId", "identidadeId", "vigenteDesde");


--
-- Name: TanqueLeite_propriedadeId_vigenteDesde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "TanqueLeite_propriedadeId_vigenteDesde_idx" ON pecuaria."TanqueLeite" USING btree ("propriedadeId", "vigenteDesde");


--
-- Name: TarefaSanitaria_execucaoId_etapaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TarefaSanitaria_execucaoId_etapaId_key" ON pecuaria."TarefaProtocolo" USING btree ("participacaoId", "etapaId");


--
-- Name: TarefaSanitaria_previstaPara_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "TarefaSanitaria_previstaPara_idx" ON pecuaria."TarefaProtocolo" USING btree ("previstaEm");


--
-- Name: TentativaReprodutiva_animalId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "TentativaReprodutiva_animalId_idx" ON pecuaria."TentativaReprodutiva" USING btree ("animalId");


--
-- Name: TentativaReprodutiva_movimentoEstoqueId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TentativaReprodutiva_movimentoEstoqueId_key" ON pecuaria."TentativaReprodutiva" USING btree ("movimentoEstoqueId");


--
-- Name: TentativaReprodutiva_ordem_ciclo; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TentativaReprodutiva_ordem_ciclo" ON pecuaria."TentativaReprodutiva" USING btree ("animalId", ciclo, ordem);


--
-- Name: TentativaReprodutiva_referenciaExterna_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TentativaReprodutiva_referenciaExterna_key" ON pecuaria."TentativaReprodutiva" USING btree ("referenciaExterna");


--
-- Name: TentativaReprodutiva_tarefa_valida; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TentativaReprodutiva_tarefa_valida" ON pecuaria."TentativaReprodutiva" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("tarefaId" IS NOT NULL));


--
-- Name: TipoExame_nome_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "TipoExame_nome_key" ON pecuaria."TipoExame" USING btree (nome);


--
-- Name: UnidadeBancoColostro_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "UnidadeBancoColostro_chave_key" ON pecuaria."UnidadeBancoColostro" USING btree (chave);


--
-- Name: UnidadeBancoColostro_origemId_status_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "UnidadeBancoColostro_origemId_status_idx" ON pecuaria."UnidadeBancoColostro" USING btree ("origemId", status);


--
-- Name: UnidadeBancoColostro_propriedadeId_codigo_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "UnidadeBancoColostro_propriedadeId_codigo_key" ON pecuaria."UnidadeBancoColostro" USING btree ("propriedadeId", codigo);


--
-- Name: VersaoComercialVendaLeite_chave_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VersaoComercialVendaLeite_chave_key" ON pecuaria."VersaoComercialVendaLeite" USING btree (chave);


--
-- Name: VersaoComercialVendaLeite_operacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VersaoComercialVendaLeite_operacaoId_key" ON pecuaria."VersaoComercialVendaLeite" USING btree ("operacaoId");


--
-- Name: VersaoComercialVendaLeite_retiradaId_versao_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VersaoComercialVendaLeite_retiradaId_versao_key" ON pecuaria."VersaoComercialVendaLeite" USING btree ("retiradaId", versao);


--
-- Name: VersaoSelecaoVisita_selecaoId_numero_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VersaoSelecaoVisita_selecaoId_numero_key" ON pecuaria."VersaoSelecaoVisita" USING btree ("selecaoId", numero);


--
-- Name: VigenciaDietaLote_loteId_desde_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VigenciaDietaLote_loteId_desde_idx" ON pecuaria."VigenciaDietaLote" USING btree ("loteId", desde);


--
-- Name: VinculoAtendimentoAlerta_aplicacaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_aplicacaoId_key" ON pecuaria."VinculoAtendimentoAlerta" USING btree ("aplicacaoId");


--
-- Name: VinculoAtendimentoAlerta_exameId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_exameId_key" ON pecuaria."VinculoAtendimentoAlerta" USING btree ("exameId");


--
-- Name: VinculoAtendimentoAlerta_necessidadeProgramaId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_necessidadeProgramaId_key" ON pecuaria."VinculoAtendimentoAlerta" USING btree ("necessidadeProgramaId");


--
-- Name: VinculoAtendimentoAlerta_necessidadeRegraId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoAtendimentoAlerta_necessidadeRegraId_key" ON pecuaria."VinculoAtendimentoAlerta" USING btree ("necessidadeRegraId");


--
-- Name: VinculoConclusao_demanda_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoConclusao_demanda_idx" ON pecuaria."VinculoConclusaoAcompanhamento" USING btree ("demandaId");


--
-- Name: VinculoConclusao_demanda_vigente_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoConclusao_demanda_vigente_key" ON pecuaria."VinculoConclusaoAcompanhamento" USING btree ("demandaId") WHERE vigente;


--
-- Name: VinculoConclusao_interpretacao_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoConclusao_interpretacao_idx" ON pecuaria."VinculoConclusaoAcompanhamento" USING btree ("interpretacaoId");


--
-- Name: VinculoConclusao_interpretacao_vigente_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoConclusao_interpretacao_vigente_key" ON pecuaria."VinculoConclusaoAcompanhamento" USING btree ("interpretacaoId") WHERE (vigente AND (fonte = 'INTERPRETACAO'::text));


--
-- Name: VinculoConclusao_resultado_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoConclusao_resultado_idx" ON pecuaria."VinculoConclusaoAcompanhamento" USING btree ("resultadoId");


--
-- Name: VinculoConclusao_resultado_vigente_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoConclusao_resultado_vigente_key" ON pecuaria."VinculoConclusaoAcompanhamento" USING btree ("resultadoId") WHERE vigente;


--
-- Name: VinculoFornecimentoColostragem_fornecimentoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoFornecimentoColostragem_fornecimentoId_key" ON pecuaria."VinculoFornecimentoColostragem" USING btree ("fornecimentoId");


--
-- Name: VinculoImportacaoPecuaria_bancoOrigem_tabelaOrigem_chaveOri_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoImportacaoPecuaria_bancoOrigem_tabelaOrigem_chaveOri_key" ON pecuaria."VinculoImportacaoPecuaria" USING btree ("bancoOrigem", "tabelaOrigem", "chaveOrigem");


--
-- Name: VinculoMedicaoEntradaLeite_entradaId_medicaoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoMedicaoEntradaLeite_entradaId_medicaoId_key" ON pecuaria."VinculoMedicaoEntradaLeite" USING btree ("entradaId", "medicaoId");


--
-- Name: VinculoMedicaoEntradaLeite_medicaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoMedicaoEntradaLeite_medicaoId_idx" ON pecuaria."VinculoMedicaoEntradaLeite" USING btree ("medicaoId");


--
-- Name: VinculoMedicaoEntrada_medicao_ativa; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoMedicaoEntrada_medicao_ativa" ON pecuaria."VinculoMedicaoEntradaLeite" USING btree ("medicaoId") WHERE ativo;


--
-- Name: VinculoPesagemParto_criaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPesagemParto_criaId_idx" ON pecuaria."VinculoPesagemParto" USING btree ("criaId");


--
-- Name: VinculoPesagemParto_partoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPesagemParto_partoId_idx" ON pecuaria."VinculoPesagemParto" USING btree ("partoId");


--
-- Name: VinculoPesagemParto_pesagemId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPesagemParto_pesagemId_idx" ON pecuaria."VinculoPesagemParto" USING btree ("pesagemId");


--
-- Name: VinculoPesagemParto_pesagem_ativa; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoPesagemParto_pesagem_ativa" ON pecuaria."VinculoPesagemParto" USING btree ("pesagemId") WHERE ("revogadoEm" IS NULL);


--
-- Name: VinculoPesagemSecagem_lactacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPesagemSecagem_lactacaoId_idx" ON pecuaria."VinculoPesagemSecagem" USING btree ("lactacaoId");


--
-- Name: VinculoPesagemSecagem_lactacao_ativa_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoPesagemSecagem_lactacao_ativa_key" ON pecuaria."VinculoPesagemSecagem" USING btree ("lactacaoId") WHERE ("revogadoEm" IS NULL);


--
-- Name: VinculoPesagemSecagem_pesagemId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPesagemSecagem_pesagemId_idx" ON pecuaria."VinculoPesagemSecagem" USING btree ("pesagemId");


--
-- Name: VinculoPesagemSecagem_pesagem_ativa_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoPesagemSecagem_pesagem_ativa_key" ON pecuaria."VinculoPesagemSecagem" USING btree ("pesagemId") WHERE ("revogadoEm" IS NULL);


--
-- Name: VinculoPoliticaCiclo_animalId_chaveCiclo_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoPoliticaCiclo_animalId_chaveCiclo_key" ON pecuaria."VinculoPoliticaCiclo" USING btree ("animalId", "chaveCiclo");


--
-- Name: VinculoPoliticaCiclo_partoId_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoPoliticaCiclo_partoId_key" ON pecuaria."VinculoPoliticaCiclo" USING btree ("partoId");


--
-- Name: VinculoPoliticaCiclo_propriedadeId_inicioCiclo_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPoliticaCiclo_propriedadeId_inicioCiclo_idx" ON pecuaria."VinculoPoliticaCiclo" USING btree ("propriedadeId", "inicioCiclo");


--
-- Name: VinculoPreparoTentativa_aplicacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPreparoTentativa_aplicacaoId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("aplicacaoId");


--
-- Name: VinculoPreparoTentativa_exameId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPreparoTentativa_exameId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("exameId");


--
-- Name: VinculoPreparoTentativa_participacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPreparoTentativa_participacaoId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("participacaoId");


--
-- Name: VinculoPreparoTentativa_tentativaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoPreparoTentativa_tentativaId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId");


--
-- Name: VinculoQualidadeFechamentoLeite_amostraId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoQualidadeFechamentoLeite_amostraId_idx" ON pecuaria."VinculoQualidadeFechamentoLeite" USING btree ("amostraId");


--
-- Name: VinculoTarefaProtocolo_aplicacaoId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoTarefaProtocolo_aplicacaoId_idx" ON pecuaria."VinculoTarefaProtocolo" USING btree ("aplicacaoId");


--
-- Name: VinculoTarefaProtocolo_exameId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoTarefaProtocolo_exameId_idx" ON pecuaria."VinculoTarefaProtocolo" USING btree ("exameId");


--
-- Name: VinculoTarefaProtocolo_tarefaId_ordem_key; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoTarefaProtocolo_tarefaId_ordem_key" ON pecuaria."VinculoTarefaProtocolo" USING btree ("tarefaId", ordem);


--
-- Name: VinculoTarefaProtocolo_tentativaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoTarefaProtocolo_tentativaId_idx" ON pecuaria."VinculoTarefaProtocolo" USING btree ("tentativaId");


--
-- Name: VinculoTarefaProtocolo_um_atual; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoTarefaProtocolo_um_atual" ON pecuaria."VinculoTarefaProtocolo" USING btree ("tarefaId") WHERE (estado = 'ATUAL'::text);


--
-- Name: VinculoTentativaParticipacao_participacaoId_criadoEm_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoTentativaParticipacao_participacaoId_criadoEm_idx" ON pecuaria."VinculoTentativaParticipacao" USING btree ("participacaoId", "criadoEm");


--
-- Name: VinculoTentativaParticipacao_tentativaId_idx; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE INDEX "VinculoTentativaParticipacao_tentativaId_idx" ON pecuaria."VinculoTentativaParticipacao" USING btree ("tentativaId");


--
-- Name: VinculoTentativa_fato_vigente; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoTentativa_fato_vigente" ON pecuaria."VinculoTentativaParticipacao" USING btree ("tentativaId") WHERE ("revogadoEm" IS NULL);


--
-- Name: VinculoTentativa_participacao_vigente; Type: INDEX; Schema: pecuaria; Owner: -
--

CREATE UNIQUE INDEX "VinculoTentativa_participacao_vigente" ON pecuaria."VinculoTentativaParticipacao" USING btree ("participacaoId") WHERE ("revogadoEm" IS NULL);


--
-- Name: Alerta_chaveAgrupamento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Alerta_chaveAgrupamento_idx" ON public."Alerta" USING btree ("chaveAgrupamento");


--
-- Name: Alerta_produtor_propriedadeId_ciclo_prazo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Alerta_produtor_propriedadeId_ciclo_prazo_idx" ON public."Alerta" USING btree (produtor, "propriedadeId", ciclo, prazo);


--
-- Name: Alerta_proprietario_produtor_tipo_chaveOcorrencia_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Alerta_proprietario_produtor_tipo_chaveOcorrencia_key" ON public."Alerta" USING btree (proprietario, produtor, tipo, "chaveOcorrencia");


--
-- Name: Alerta_sujeitoTipo_sujeitoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Alerta_sujeitoTipo_sujeitoId_idx" ON public."Alerta" USING btree ("sujeitoTipo", "sujeitoId");


--
-- Name: AlocacaoPartidaEstoque_movimentoEstoqueId_partidaId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AlocacaoPartidaEstoque_movimentoEstoqueId_partidaId_key" ON public."AlocacaoPartidaEstoque" USING btree ("movimentoEstoqueId", "partidaId");


--
-- Name: AlocacaoPartidaEstoque_partidaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AlocacaoPartidaEstoque_partidaId_idx" ON public."AlocacaoPartidaEstoque" USING btree ("partidaId");


--
-- Name: AssinaturaRadarAssistente_ultimoUso_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssinaturaRadarAssistente_ultimoUso_idx" ON public."AssinaturaRadarAssistente" USING btree ("ultimoUso");


--
-- Name: AuditoriaFinanceira_entidade_entidadeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditoriaFinanceira_entidade_entidadeId_idx" ON public."AuditoriaFinanceira" USING btree (entidade, "entidadeId");


--
-- Name: AuditoriaFinanceira_usuarioId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditoriaFinanceira_usuarioId_createdAt_idx" ON public."AuditoriaFinanceira" USING btree ("usuarioId", "createdAt");


--
-- Name: BaseValorizacaoEstoque_origemMovimentoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BaseValorizacaoEstoque_origemMovimentoId_idx" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId");


--
-- Name: BaseValorizacaoEstoque_produtoId_propriedadeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BaseValorizacaoEstoque_produtoId_propriedadeId_idx" ON public."BaseValorizacaoEstoque" USING btree ("produtoId", "propriedadeId");


--
-- Name: BaseValorizacao_camada_derivada; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BaseValorizacao_camada_derivada" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId", "baseOrigemId", "partidaId") WHERE ((metodo = 'CAMADAS_AQUISICAO_V2'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NOT NULL));


--
-- Name: BaseValorizacao_camada_recebida; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BaseValorizacao_camada_recebida" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId", "partidaId") WHERE ((metodo = 'CAMADAS_AQUISICAO_V2'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NULL));


--
-- Name: BaseValorizacao_fifo_derivada; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BaseValorizacao_fifo_derivada" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId", "baseOrigemId") WHERE ((metodo = 'FIFO_AQUISICAO_V1'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NOT NULL));


--
-- Name: BaseValorizacao_fifo_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BaseValorizacao_fifo_origem" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId") WHERE ((metodo = 'FIFO_AQUISICAO_V1'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NULL));


--
-- Name: BaseValorizacao_grupo_sitio; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BaseValorizacao_grupo_sitio" ON public."BaseValorizacaoEstoque" USING btree ("produtoId", "propriedadeId", "partidaId") WHERE (metodo = 'MEDIA_SALDO_V1'::text);


--
-- Name: Categoria_grupoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Categoria_grupoId_idx" ON public."Categoria" USING btree ("grupoId");


--
-- Name: Categoria_nome_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Categoria_nome_key" ON public."Categoria" USING btree (nome);


--
-- Name: CentroCusto_nome_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CentroCusto_nome_key" ON public."CentroCusto" USING btree (nome);


--
-- Name: ClassificacaoTecnicaProduto_codigoOrigem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ClassificacaoTecnicaProduto_codigoOrigem_key" ON public."ClassificacaoTecnicaProduto" USING btree ("codigoOrigem");


--
-- Name: ClassificacaoTecnicaProduto_nomeNormalizado_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ClassificacaoTecnicaProduto_nomeNormalizado_key" ON public."ClassificacaoTecnicaProduto" USING btree ("nomeNormalizado");


--
-- Name: CompromissoFinanceiro_operacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompromissoFinanceiro_operacaoId_idx" ON public."CompromissoFinanceiro" USING btree ("operacaoId");


--
-- Name: CompromissoFinanceiro_seq_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CompromissoFinanceiro_seq_key" ON public."CompromissoFinanceiro" USING btree (seq);


--
-- Name: CompromissoFinanceiro_tipo_status_dataVencimento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompromissoFinanceiro_tipo_status_dataVencimento_idx" ON public."CompromissoFinanceiro" USING btree (tipo, status, "dataVencimento");


--
-- Name: ContaFinanceira_propriedadeId_ativo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContaFinanceira_propriedadeId_ativo_idx" ON public."ContaFinanceira" USING btree ("propriedadeId", ativo);


--
-- Name: ContaFinanceira_propriedadeId_nome_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContaFinanceira_propriedadeId_nome_key" ON public."ContaFinanceira" USING btree ("propriedadeId", nome);


--
-- Name: ConversaAssistente_usuarioId_propriedadeId_atualizadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConversaAssistente_usuarioId_propriedadeId_atualizadoEm_idx" ON public."ConversaAssistente" USING btree ("usuarioId", "propriedadeId", "atualizadoEm" DESC);


--
-- Name: ConversaWhatsapp_telefone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ConversaWhatsapp_telefone_key" ON public."ConversaWhatsapp" USING btree (telefone);


--
-- Name: DocumentoFinanceiro_compromissoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentoFinanceiro_compromissoId_idx" ON public."DocumentoFinanceiro" USING btree ("compromissoId");


--
-- Name: DocumentoFinanceiro_operacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentoFinanceiro_operacaoId_idx" ON public."DocumentoFinanceiro" USING btree ("operacaoId");


--
-- Name: DocumentoFinanceiro_rascunhoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentoFinanceiro_rascunhoId_idx" ON public."DocumentoFinanceiro" USING btree ("rascunhoId");


--
-- Name: DocumentoFinanceiro_sha256_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DocumentoFinanceiro_sha256_key" ON public."DocumentoFinanceiro" USING btree (sha256);


--
-- Name: DocumentoFinanceiro_storageKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DocumentoFinanceiro_storageKey_key" ON public."DocumentoFinanceiro" USING btree ("storageKey");


--
-- Name: DocumentoFinanceiro_transacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentoFinanceiro_transacaoId_idx" ON public."DocumentoFinanceiro" USING btree ("transacaoId");


--
-- Name: EventoAlerta_alertaId_eventoId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EventoAlerta_alertaId_eventoId_key" ON public."EventoAlerta" USING btree ("alertaId", "eventoId");


--
-- Name: EventoAlerta_alertaId_revisao_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EventoAlerta_alertaId_revisao_key" ON public."EventoAlerta" USING btree ("alertaId", revisao);


--
-- Name: EventoMetaAssistente_escopo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EventoMetaAssistente_escopo_idx" ON public."EventoMetaAssistente" USING btree ("propriedadeId", dominio, "metaId", revisao DESC);


--
-- Name: FabricanteProduto_codigoOrigem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FabricanteProduto_codigoOrigem_key" ON public."FabricanteProduto" USING btree ("codigoOrigem");


--
-- Name: FabricanteProduto_nomeNormalizado_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FabricanteProduto_nomeNormalizado_key" ON public."FabricanteProduto" USING btree ("nomeNormalizado");


--
-- Name: GrupoCategoria_nome_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GrupoCategoria_nome_key" ON public."GrupoCategoria" USING btree (nome);


--
-- Name: ItemOperacao_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemOperacao_animalId_idx" ON public."ItemOperacao" USING btree ("animalId");


--
-- Name: ItemOperacao_centroCustoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemOperacao_centroCustoId_idx" ON public."ItemOperacao" USING btree ("centroCustoId");


--
-- Name: ItemOperacao_operacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemOperacao_operacaoId_idx" ON public."ItemOperacao" USING btree ("operacaoId");


--
-- Name: ItemOperacao_operacaoId_ordem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ItemOperacao_operacaoId_ordem_key" ON public."ItemOperacao" USING btree ("operacaoId", ordem);


--
-- Name: ItemOperacao_produtoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemOperacao_produtoId_idx" ON public."ItemOperacao" USING btree ("produtoId");


--
-- Name: Liquidacao_compromissoId_transacaoId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Liquidacao_compromissoId_transacaoId_key" ON public."Liquidacao" USING btree ("compromissoId", "transacaoId");


--
-- Name: Liquidacao_transacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Liquidacao_transacaoId_idx" ON public."Liquidacao" USING btree ("transacaoId");


--
-- Name: MensagemWhatsapp_conversaId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MensagemWhatsapp_conversaId_createdAt_idx" ON public."MensagemWhatsapp" USING btree ("conversaId", "createdAt");


--
-- Name: MensagemWhatsapp_waMessageId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MensagemWhatsapp_waMessageId_key" ON public."MensagemWhatsapp" USING btree ("waMessageId");


--
-- Name: MovimentoConta_contaId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoConta_contaId_createdAt_idx" ON public."MovimentoConta" USING btree ("contaId", "createdAt");


--
-- Name: MovimentoConta_seq_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MovimentoConta_seq_key" ON public."MovimentoConta" USING btree (seq);


--
-- Name: MovimentoConta_transacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoConta_transacaoId_idx" ON public."MovimentoConta" USING btree ("transacaoId");


--
-- Name: MovimentoEstoque_centroCustoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoEstoque_centroCustoId_idx" ON public."MovimentoEstoque" USING btree ("centroCustoId");


--
-- Name: MovimentoEstoque_itemOperacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoEstoque_itemOperacaoId_idx" ON public."MovimentoEstoque" USING btree ("itemOperacaoId");


--
-- Name: MovimentoEstoque_operacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoEstoque_operacaoId_idx" ON public."MovimentoEstoque" USING btree ("operacaoId");


--
-- Name: MovimentoEstoque_produtoId_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoEstoque_produtoId_data_idx" ON public."MovimentoEstoque" USING btree ("produtoId", data);


--
-- Name: MovimentoEstoque_propriedadeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoEstoque_propriedadeId_idx" ON public."MovimentoEstoque" USING btree ("propriedadeId");


--
-- Name: MovimentoEstoque_reversaoDeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MovimentoEstoque_reversaoDeId_key" ON public."MovimentoEstoque" USING btree ("reversaoDeId");


--
-- Name: MovimentoEstoque_seq_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MovimentoEstoque_seq_key" ON public."MovimentoEstoque" USING btree (seq);


--
-- Name: MovimentoEstoque_tipo_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimentoEstoque_tipo_data_idx" ON public."MovimentoEstoque" USING btree (tipo, data);


--
-- Name: Operacao_corrigeOperacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Operacao_corrigeOperacaoId_idx" ON public."Operacao" USING btree ("corrigeOperacaoId");


--
-- Name: Operacao_numero_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Operacao_numero_key" ON public."Operacao" USING btree (numero);


--
-- Name: Operacao_parceiroId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Operacao_parceiroId_idx" ON public."Operacao" USING btree ("parceiroId");


--
-- Name: Operacao_propriedadeId_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Operacao_propriedadeId_data_idx" ON public."Operacao" USING btree ("propriedadeId", data);


--
-- Name: Operacao_tipo_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Operacao_tipo_status_idx" ON public."Operacao" USING btree (tipo, status);


--
-- Name: Parceiro_documento_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Parceiro_documento_key" ON public."Parceiro" USING btree (documento);


--
-- Name: Parceiro_nome_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Parceiro_nome_idx" ON public."Parceiro" USING btree (nome);


--
-- Name: Parceiro_tipo_ativo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Parceiro_tipo_ativo_idx" ON public."Parceiro" USING btree (tipo, ativo);


--
-- Name: ParcelaValorizacaoEstoque_baseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ParcelaValorizacaoEstoque_baseId_idx" ON public."ParcelaValorizacaoEstoque" USING btree ("baseId");


--
-- Name: ParcelaValorizacaoEstoque_movimentoEstoqueId_baseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ParcelaValorizacaoEstoque_movimentoEstoqueId_baseId_key" ON public."ParcelaValorizacaoEstoque" USING btree ("movimentoEstoqueId", "baseId");


--
-- Name: ParcelaValorizacaoEstoque_movimentoEstoqueId_ordem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ParcelaValorizacaoEstoque_movimentoEstoqueId_ordem_key" ON public."ParcelaValorizacaoEstoque" USING btree ("movimentoEstoqueId", ordem);


--
-- Name: PartidaProduto_lotePrincipalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartidaProduto_lotePrincipalId_idx" ON public."PartidaProduto" USING btree ("lotePrincipalId");


--
-- Name: PartidaProduto_produtoId_codigo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartidaProduto_produtoId_codigo_key" ON public."PartidaProduto" USING btree ("produtoId", codigo);


--
-- Name: PartidaProduto_raiz_produto_sem_validade_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartidaProduto_raiz_produto_sem_validade_key" ON public."PartidaProduto" USING btree ("produtoId") WHERE (("lotePrincipalId" IS NULL) AND (validade IS NULL));


--
-- Name: PartidaProduto_raiz_produto_validade_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartidaProduto_raiz_produto_validade_key" ON public."PartidaProduto" USING btree ("produtoId", validade) WHERE (("lotePrincipalId" IS NULL) AND (validade IS NOT NULL));


--
-- Name: PeriodoFinanceiro_propriedadeId_ano_mes_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PeriodoFinanceiro_propriedadeId_ano_mes_key" ON public."PeriodoFinanceiro" USING btree ("propriedadeId", ano, mes);


--
-- Name: PrincipioAtivo_codigoOrigem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PrincipioAtivo_codigoOrigem_key" ON public."PrincipioAtivo" USING btree ("codigoOrigem");


--
-- Name: PrincipioAtivo_nomeNormalizado_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PrincipioAtivo_nomeNormalizado_key" ON public."PrincipioAtivo" USING btree ("nomeNormalizado");


--
-- Name: ProdutoCatalogoPrincipioAtivo_produtoCatalogoId_ordem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProdutoCatalogoPrincipioAtivo_produtoCatalogoId_ordem_key" ON public."ProdutoCatalogoPrincipioAtivo" USING btree ("produtoCatalogoId", ordem);


--
-- Name: ProdutoCatalogo_fonte_codigoOrigem_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProdutoCatalogo_fonte_codigoOrigem_key" ON public."ProdutoCatalogo" USING btree (fonte, "codigoOrigem");


--
-- Name: ProdutoCatalogo_nomeNormalizado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProdutoCatalogo_nomeNormalizado_idx" ON public."ProdutoCatalogo" USING btree ("nomeNormalizado");


--
-- Name: ProdutoCentroCusto_centroCustoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProdutoCentroCusto_centroCustoId_idx" ON public."ProdutoCentroCusto" USING btree ("centroCustoId");


--
-- Name: ProdutoFornecedor_fornecedorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProdutoFornecedor_fornecedorId_idx" ON public."ProdutoFornecedor" USING btree ("fornecedorId");


--
-- Name: Produto_nome_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Produto_nome_key" ON public."Produto" USING btree (nome);


--
-- Name: Produto_produtoCatalogoId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Produto_produtoCatalogoId_key" ON public."Produto" USING btree ("produtoCatalogoId");


--
-- Name: Propriedade_nome_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Propriedade_nome_key" ON public."Propriedade" USING btree (nome);


--
-- Name: RascunhoOperacao_criadoPorId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RascunhoOperacao_criadoPorId_updatedAt_idx" ON public."RascunhoOperacao" USING btree ("criadoPorId", "updatedAt");


--
-- Name: RascunhoOperacao_propriedadeId_criadoPorId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RascunhoOperacao_propriedadeId_criadoPorId_key" ON public."RascunhoOperacao" USING btree ("propriedadeId", "criadoPorId");


--
-- Name: RascunhoRelatorioFinanceiro_propriedadeId_criadoPorId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RascunhoRelatorioFinanceiro_propriedadeId_criadoPorId_key" ON public."RascunhoRelatorioFinanceiro" USING btree ("propriedadeId", "criadoPorId");


--
-- Name: RelatorioFinanceiro_propriedadeId_geradoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RelatorioFinanceiro_propriedadeId_geradoEm_idx" ON public."RelatorioFinanceiro" USING btree ("propriedadeId", "geradoEm");


--
-- Name: RelatorioFinanceiro_storageKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RelatorioFinanceiro_storageKey_key" ON public."RelatorioFinanceiro" USING btree ("storageKey");


--
-- Name: Sessao_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON public."Sessao" USING btree ("tokenHash");


--
-- Name: Sessao_usuarioId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sessao_usuarioId_idx" ON public."Sessao" USING btree ("usuarioId");


--
-- Name: SnapshotRadarAssistente_dia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SnapshotRadarAssistente_dia_idx" ON public."SnapshotRadarAssistente" USING btree (dia);


--
-- Name: TokenAcesso_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TokenAcesso_tokenHash_key" ON public."TokenAcesso" USING btree ("tokenHash");


--
-- Name: TokenAcesso_usuarioId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TokenAcesso_usuarioId_idx" ON public."TokenAcesso" USING btree ("usuarioId");


--
-- Name: TransacaoFinanceira_operacaoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TransacaoFinanceira_operacaoId_idx" ON public."TransacaoFinanceira" USING btree ("operacaoId");


--
-- Name: TransacaoFinanceira_propriedadeId_data_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TransacaoFinanceira_propriedadeId_data_idx" ON public."TransacaoFinanceira" USING btree ("propriedadeId", data);


--
-- Name: TransacaoFinanceira_reversaoDeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TransacaoFinanceira_reversaoDeId_key" ON public."TransacaoFinanceira" USING btree ("reversaoDeId");


--
-- Name: TransacaoFinanceira_seq_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TransacaoFinanceira_seq_key" ON public."TransacaoFinanceira" USING btree (seq);


--
-- Name: TransacaoFinanceira_tipo_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TransacaoFinanceira_tipo_status_idx" ON public."TransacaoFinanceira" USING btree (tipo, status);


--
-- Name: UsuarioWhatsapp_telefone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UsuarioWhatsapp_telefone_key" ON public."UsuarioWhatsapp" USING btree (telefone);


--
-- Name: Usuario_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- Name: AcompanhamentoColostragem AcompanhamentoColostragem_acompanhamento_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AcompanhamentoColostragem_acompanhamento_contexto" AFTER INSERT OR UPDATE ON pecuaria."AcompanhamentoColostragem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_acompanhamento_colostragem();


--
-- Name: AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_anular; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "AlocacaoDemonstrativoLeite_anular" BEFORE DELETE OR UPDATE ON pecuaria."AlocacaoDemonstrativoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.anular_comercial_leite();


--
-- Name: AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_guard; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoDemonstrativoLeite_guard" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoDemonstrativoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_atomicidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoFornecimentoColostro_atomicidade" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoFornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destinacao_colostro();


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_conferir_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoFornecimentoColostro_conferir_saldo" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoFornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_saldo_colostro();


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoFornecimentoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoFornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro();


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_travar_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "AlocacaoFornecimentoColostro_travar_saldo" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."AlocacaoFornecimentoColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_saldo_colostro();


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeiteEstoque_colostro_reservado; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeiteEstoque_colostro_reservado" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_fisico_colostro();


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeite_conferir" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_leite();


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeite_elegibilidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeite_elegibilidade" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_elegibilidade_saida_leite();


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "AlocacaoLeite_imutavel" BEFORE UPDATE ON pecuaria."AlocacaoLeiteEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeite_natureza_destino; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeite_natureza_destino" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_natureza_destino_leite();


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "AmostraQualidadeLeite_conferir" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."AmostraQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_amostra_qualidade_leite();


--
-- Name: Animal Animal_peso_secagem_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Animal_peso_secagem_integridade" AFTER UPDATE ON pecuaria."Animal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.revalidar_peso_secagem();


--
-- Name: Animal Animal_proteger_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Animal_proteger_origem_geral" AFTER DELETE OR UPDATE ON pecuaria."Animal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- Name: Animal Animal_travar_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Animal_travar_origem_geral" BEFORE DELETE OR UPDATE ON pecuaria."Animal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- Name: AplicacaoProduto AplicacaoProduto_insercao_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "AplicacaoProduto_insercao_historico" BEFORE UPDATE ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_reconhecimento_insercao();


--
-- Name: AplicacaoProduto AplicacaoProduto_retirada_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "AplicacaoProduto_retirada_validar" BEFORE UPDATE ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_insercao_retirada();


--
-- Name: ApropriacaoValorLeite ApropriacaoLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ApropriacaoLeite_conferir" AFTER INSERT ON pecuaria."ApropriacaoValorLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_apuracao_leite();


--
-- Name: ApropriacaoValorLeite ApropriacaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ApropriacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ApropriacaoValorLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: ApuracaoValorLeite ApuracaoLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ApuracaoLeite_conferir" AFTER INSERT ON pecuaria."ApuracaoValorLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_apuracao_leite();


--
-- Name: ApuracaoValorLeite ApuracaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ApuracaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ApuracaoValorLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: BaixaAnimal BaixaAnimal_peso_secagem_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "BaixaAnimal_peso_secagem_integridade" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.revalidar_peso_secagem();


--
-- Name: BaixaAnimal BaixaAnimal_proteger_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- Name: BaixaAnimal BaixaAnimal_proteger_producao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_producao" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_baixa_com_producao();


--
-- Name: BaixaAnimal BaixaAnimal_travar_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "BaixaAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacao_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "CatalogoAvaliacao_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."CatalogoAvaliacaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_catalogo_avaliacao();


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacao_tipo_valido; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "CatalogoAvaliacao_tipo_valido" BEFORE INSERT ON pecuaria."CatalogoAvaliacaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_catalogo_avaliacao();


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCusto_limite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ClassificacaoCusto_limite" AFTER INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_limite_classificacao();


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCusto_manejo_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ClassificacaoCusto_manejo_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_classificacao_manejo();


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCusto_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ClassificacaoCusto_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_classificacao_custo();


--
-- Name: ClassificacaoEntradaLeite ClassificacaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ClassificacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ClassificacaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: ClassificacaoEntradaLeite ClassificacaoLeite_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ClassificacaoLeite_validar" BEFORE INSERT ON pecuaria."ClassificacaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_natureza_entrada_leite();


--
-- Name: ClassificacaoCustoPecuaria Classificacao_diaria_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Classificacao_diaria_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_classificacao_diaria();


--
-- Name: ColeiraBezerreiro ColeiraBezerreiro_identidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ColeiraBezerreiro_identidade" BEFORE UPDATE ON pecuaria."ColeiraBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_origens_bezerreiro();


--
-- Name: ComprovanteEntregaLeite ComprovanteEntregaLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ComprovanteEntregaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ComprovanteEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();


--
-- Name: ComprovanteRetiradaOperacaoLeite ComprovanteRetiradaOperacaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ComprovanteRetiradaOperacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ComprovanteRetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- Name: DemandaAcompanhamentoReprodutivo Conclusao_validar_demanda; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Conclusao_validar_demanda" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."DemandaAcompanhamentoReprodutivo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();


--
-- Name: ExameAnimal Conclusao_validar_exame; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Conclusao_validar_exame" AFTER DELETE OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();


--
-- Name: InterpretacaoReprodutiva Conclusao_validar_interpretacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Conclusao_validar_interpretacao" AFTER DELETE OR UPDATE ON pecuaria."InterpretacaoReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();


--
-- Name: ResultadoExame Conclusao_validar_resultado; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Conclusao_validar_resultado" AFTER DELETE OR UPDATE ON pecuaria."ResultadoExame" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();


--
-- Name: VinculoConclusaoAcompanhamento Conclusao_validar_vinculo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Conclusao_validar_vinculo" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."VinculoConclusaoAcompanhamento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_conclusao_final();


--
-- Name: ConferenciaEntregaLeite ConferenciaEntregaLeite_documentos; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConferenciaEntregaLeite_documentos" BEFORE INSERT ON pecuaria."ConferenciaEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_conferencia_entrega_leite();


--
-- Name: ConferenciaEntregaLeite ConferenciaEntregaLeite_guard; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ConferenciaEntregaLeite_guard" AFTER INSERT ON pecuaria."ConferenciaEntregaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- Name: ConferenciaEntregaLeite ConferenciaEntregaLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConferenciaEntregaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ConferenciaEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();


--
-- Name: ConferenciaSaldoLeite ConferenciaSaldoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConferenciaSaldoLeite_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ConferenciaSaldoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_conferencia_saldo_leite();


--
-- Name: ConfiguracaoBezerreiro ConfiguracaoBezerreiro_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConfiguracaoBezerreiro_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ConfiguracaoBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_programacao_bezerreiro();


--
-- Name: ConfiguracaoNutricao ConfiguracaoNutricao_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConfiguracaoNutricao_validar" BEFORE INSERT OR UPDATE ON pecuaria."ConfiguracaoNutricao" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_configuracao_nutricional();


--
-- Name: ConfiguracaoOrdenha ConfiguracaoOrdenha_snapshot_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConfiguracaoOrdenha_snapshot_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ConfiguracaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_configuracao_ordenha_usada();


--
-- Name: ConsumoDiario ConsumoDiario_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ConsumoDiario_validar" BEFORE INSERT OR UPDATE ON pecuaria."ConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_dia_nutricional();


--
-- Name: CriaParto CriaParto_colostro; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "CriaParto_colostro" AFTER UPDATE ON pecuaria."CriaParto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();


--
-- Name: CriaParto CriaParto_pesagens; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "CriaParto_pesagens" AFTER UPDATE ON pecuaria."CriaParto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- Name: TentativaReprodutiva Custo_limite_tentativa; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Custo_limite_tentativa" AFTER UPDATE ON pecuaria."TentativaReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- Name: DecisaoElegibilidadeCiclo DecisaoElegibilidade_cronologia; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DecisaoElegibilidade_cronologia" BEFORE INSERT ON pecuaria."DecisaoElegibilidadeCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_decisao_elegibilidade();


--
-- Name: DecisaoElegibilidadeCiclo DecisaoElegibilidade_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DecisaoElegibilidade_historico" BEFORE DELETE OR UPDATE ON pecuaria."DecisaoElegibilidadeCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_decisao_elegibilidade();


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DecisaoOperacionalAcompanhamento_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."DecisaoOperacionalAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DecisaoOperacionalAcompanhamento_validar" BEFORE INSERT ON pecuaria."DecisaoOperacionalAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_decisao_operacional_acompanhamento();


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamento_decisao_operacional; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DemandaAcompanhamento_decisao_operacional" BEFORE INSERT OR UPDATE ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_decisao_operacional_acompanhamento();


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamento_participacao_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DemandaAcompanhamento_participacao_imutavel" BEFORE UPDATE OF "participacaoAcompanhamentoId" ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_origem_participacao_prazo();


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamento_preservar_visita; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DemandaAcompanhamento_preservar_visita" BEFORE UPDATE OF "politicaId", "previstaPara", "regraSnapshot" ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_prazo_visita();


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamento_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DemandaAcompanhamento_validar" BEFORE INSERT OR UPDATE ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_demanda_acompanhamento();


--
-- Name: DemonstrativoLeite DemonstrativoLeite_anular; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DemonstrativoLeite_anular" BEFORE DELETE OR UPDATE ON pecuaria."DemonstrativoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.anular_comercial_leite();


--
-- Name: DemonstrativoLeite DemonstrativoLeite_guard; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DemonstrativoLeite_guard" AFTER INSERT OR UPDATE ON pecuaria."DemonstrativoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- Name: AlocacaoLeiteEstoque DescarteLeite_alocacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DescarteLeite_alocacao" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();


--
-- Name: DescarteLeite DescarteLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DescarteLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."DescarteLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();


--
-- Name: DescarteLeite DescarteLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DescarteLeite_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."DescarteLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_descarte_leite();


--
-- Name: DestinacaoColostro DestinacaoColostro_atomicidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DestinacaoColostro_atomicidade" AFTER INSERT OR UPDATE ON pecuaria."DestinacaoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destinacao_colostro();


--
-- Name: DestinacaoColostro DestinacaoColostro_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DestinacaoColostro_historico" BEFORE DELETE OR UPDATE ON pecuaria."DestinacaoColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro();


--
-- Name: DestinoInternoLeite DestinoInternoLeite_fatos_imutaveis; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DestinoInternoLeite_fatos_imutaveis" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."DestinoInternoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_fatos_destino_leite();


--
-- Name: DestinoInternoLeite DestinoInternoLeite_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DestinoInternoLeite_integridade" AFTER INSERT OR UPDATE ON pecuaria."DestinoInternoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destino_interno_leite();


--
-- Name: DestinoInternoLeite DestinoLeite_natureza_origem; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DestinoLeite_natureza_origem" AFTER INSERT OR UPDATE ON pecuaria."DestinoInternoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_natureza_destino_leite();


--
-- Name: DetalheFechamentoLeite DetalheFechamentoLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "DetalheFechamentoLeite_conferir" AFTER INSERT ON pecuaria."DetalheFechamentoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: DetalheFechamentoLeite DetalheFechamentoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DetalheFechamentoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."DetalheFechamentoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- Name: DiaProducaoLeite DiaProducaoLeite_congelar_configuracao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DiaProducaoLeite_congelar_configuracao" BEFORE INSERT ON pecuaria."DiaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.congelar_configuracao_dia_leite();


--
-- Name: DiaProducaoLeite DiaProducaoLeite_identidade_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "DiaProducaoLeite_identidade_imutavel" BEFORE UPDATE ON pecuaria."DiaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_identidade_dia_leite();


--
-- Name: EmissaoRelatorioLeite EmissaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EmissaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."EmissaoRelatorioLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_emissao_leite();


--
-- Name: EntradaProducaoLeite EntradaLeite_classificacao_inicial; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "EntradaLeite_classificacao_inicial" AFTER INSERT ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_classificacao_inicial_leite();


--
-- Name: EntradaProducaoLeite EntradaLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "EntradaLeite_conferir" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_leite();


--
-- Name: EntradaProducaoLeite EntradaLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EntradaLeite_imutavel" BEFORE UPDATE ON pecuaria."EntradaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_entrada_leite();


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_00_travar_origens; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EntradaProducaoLeite_00_travar_origens" BEFORE INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_entrada_origem_geral();


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_colostro_reservado; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_colostro_reservado" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_fisico_colostro();


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_conjunto_parcelas; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_conjunto_parcelas" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_conjunto_parcelas_leite();


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_origens_gerais_historicas; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_origens_gerais_historicas" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_afericao_origem_geral();


--
-- Name: EntregaLeite EntregaLeite_guard; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "EntregaLeite_guard" AFTER INSERT ON pecuaria."EntregaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- Name: EntregaLeite EntregaLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EntregaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."EntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();


--
-- Name: EtapaProtocolo EtapaProtocolo_estrutura_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EtapaProtocolo_estrutura_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."EtapaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_estrutura_protocolo();


--
-- Name: EtapaProtocolo EtapaProtocolo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EtapaProtocolo_imutavel" BEFORE UPDATE ON pecuaria."EtapaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_etapa_protocolo();


--
-- Name: EventoTarefaProtocolo EventoTarefaProtocolo_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "EventoTarefaProtocolo_validar" BEFORE INSERT OR UPDATE ON pecuaria."EventoTarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_evento_tarefa_protocolo();


--
-- Name: ExameAnimal ExameAnimal_acompanhamento_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ExameAnimal_acompanhamento_contexto" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_acompanhamento_colostragem();


--
-- Name: ExameAnimal ExameAnimal_pos_parto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ExameAnimal_pos_parto" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_exame_pos_parto_trigger();


--
-- Name: ExameImunidadeColostragem ExameImunidadeColostragem_acompanhamento_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ExameImunidadeColostragem_acompanhamento_contexto" AFTER INSERT OR UPDATE ON pecuaria."ExameImunidadeColostragem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_acompanhamento_colostragem();


--
-- Name: ExameAnimal Exame_avaliacao_contextual_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Exame_avaliacao_contextual_imutavel" BEFORE UPDATE ON pecuaria."ExameAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_registro_contextual();


--
-- Name: ExameAnimal Exame_demanda_compativel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Exame_demanda_compativel" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_exame_demanda_acompanhamento();


--
-- Name: ExameAnimal Exame_resolucao_demanda_final; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Exame_resolucao_demanda_final" AFTER DELETE OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FaseBezerreiroVersao_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."FaseBezerreiroVersao" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_programacao_bezerreiro();


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_programacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FaseBezerreiroVersao_programacao" AFTER INSERT OR UPDATE ON pecuaria."FaseBezerreiroVersao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_configuracao_bezerreiro();


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_snapshot_coleira; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FaseBezerreiroVersao_snapshot_coleira" BEFORE INSERT ON pecuaria."FaseBezerreiroVersao" FOR EACH ROW EXECUTE FUNCTION pecuaria.preparar_fase_bezerreiro();


--
-- Name: FechamentoConsumo FechamentoConsumo_fornecimento_leite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FechamentoConsumo_fornecimento_leite" AFTER UPDATE ON pecuaria."FechamentoConsumo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- Name: FechamentoConsumo FechamentoConsumo_modelo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FechamentoConsumo_modelo" BEFORE INSERT OR UPDATE ON pecuaria."FechamentoConsumo" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_consumo_legado_sobreposto();


--
-- Name: FechamentoOperacaoLeite FechamentoOperacaoLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FechamentoOperacaoLeite_conferir" AFTER INSERT ON pecuaria."FechamentoOperacaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: FechamentoOperacaoLeite FechamentoOperacaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FechamentoOperacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."FechamentoOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- Name: FechamentoOperacaoLeite FechamentoOperacaoLeite_travar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FechamentoOperacaoLeite_travar" BEFORE INSERT ON pecuaria."FechamentoOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_fechamento_comercial_leite();


--
-- Name: FinalidadeAnimal FinalidadeAnimal_proteger_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FinalidadeAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."FinalidadeAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- Name: FinalidadeAnimal FinalidadeAnimal_proteger_producao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FinalidadeAnimal_proteger_producao" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."FinalidadeAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_finalidade_com_producao();


--
-- Name: FinalidadeAnimal FinalidadeAnimal_travar_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FinalidadeAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."FinalidadeAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- Name: FornecimentoColostro FornecimentoColostro_acompanhamento_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FornecimentoColostro_acompanhamento_contexto" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_acompanhamento_colostragem();


--
-- Name: FornecimentoColostro FornecimentoColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FornecimentoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_conservacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "FornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "FornecimentoNutricionalLeite_historico" BEFORE DELETE OR UPDATE ON pecuaria."FornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();


--
-- Name: GrupoOfertaBezerreiro GrupoOfertaBezerreiro_conservacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "GrupoOfertaBezerreiro_conservacao" AFTER INSERT OR UPDATE ON pecuaria."GrupoOfertaBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_oferta_bezerreiro();


--
-- Name: GrupoOfertaBezerreiro GrupoOfertaBezerreiro_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "GrupoOfertaBezerreiro_historico" BEFORE DELETE OR UPDATE ON pecuaria."GrupoOfertaBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro();


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "InsumoPreparoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."InsumoPreparoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro();


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "InsumoPreparoColostro_historico" BEFORE DELETE OR UPDATE ON pecuaria."InsumoPreparoColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro();


--
-- Name: InterpretacaoReprodutiva Interpretacao_condutas_contextuais_imutaveis; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Interpretacao_condutas_contextuais_imutaveis" BEFORE UPDATE ON pecuaria."InterpretacaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_registro_contextual();


--
-- Name: InterpretacaoReprodutiva Interpretacao_resolucao_demanda_final; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Interpretacao_resolucao_demanda_final" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."InterpretacaoReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();


--
-- Name: ItemConsumoDiario ItemConsumoDiario_ledger; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ItemConsumoDiario_ledger" AFTER INSERT OR UPDATE ON pecuaria."ItemConsumoDiario" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ledger_nutricional();


--
-- Name: ItemConsumoDiario ItemConsumoDiario_mes_aberto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ItemConsumoDiario_mes_aberto" BEFORE INSERT OR UPDATE ON pecuaria."ItemConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_item_mensal();


--
-- Name: ItemFechamentoConsumo ItemFechamentoConsumo_fornecimento_leite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ItemFechamentoConsumo_fornecimento_leite" AFTER UPDATE ON pecuaria."ItemFechamentoConsumo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- Name: LactacaoAnimal LactacaoAnimal_peso_secagem_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LactacaoAnimal_peso_secagem_integridade" AFTER UPDATE ON pecuaria."LactacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.revalidar_peso_secagem();


--
-- Name: LactacaoAnimal LactacaoAnimal_proteger_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LactacaoAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."LactacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- Name: LactacaoAnimal LactacaoAnimal_proteger_partos_parcelas_leite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LactacaoAnimal_proteger_partos_parcelas_leite" AFTER DELETE OR UPDATE ON pecuaria."LactacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_partos_parcelas_leite();


--
-- Name: LactacaoAnimal LactacaoAnimal_travar_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "LactacaoAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LactacaoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_bezerreiro; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_bezerreiro" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_participacao_bezerreiro();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_consumo_v3; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "LocalizacaoAnimal_consumo_v3" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" FOR EACH ROW EXECUTE FUNCTION public.proteger_localizacao_consumo_v3();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_entrada_bezerreiro; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_entrada_bezerreiro" AFTER INSERT ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_nutricao_mensal; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "LocalizacaoAnimal_nutricao_mensal" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_nutricao_mensal();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_peso_secagem_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_peso_secagem_integridade" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.revalidar_peso_secagem();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_proteger_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_reabertura_bezerreiro; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_reabertura_bezerreiro" AFTER UPDATE ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((new."animalId" IS DISTINCT FROM old."animalId") OR (new."loteId" IS DISTINCT FROM old."loteId") OR (new."propriedadeId" IS DISTINCT FROM old."propriedadeId") OR (new.desde < old.desde) OR ((old.ate IS NOT NULL) AND ((new.ate IS NULL) OR (new.ate > old.ate))))) EXECUTE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro();


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_travar_origem_geral; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "LocalizacaoAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- Name: LoteColostro LoteColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "LoteColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."LoteColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_retirada_colostro();


--
-- Name: LoteColostro LoteColostro_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "LoteColostro_historico" BEFORE DELETE OR UPDATE ON pecuaria."LoteColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro();


--
-- Name: ManejoAnimal ManejoAnimal_protocolo_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ManejoAnimal_protocolo_validar" BEFORE INSERT OR UPDATE ON pecuaria."ManejoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_manejo_protocolar();


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_00_travar_origens; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MedicaoGeralLeite_00_travar_origens" BEFORE INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_afericao_origem_geral();


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MedicaoGeralLeite_conferir" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."MedicaoGeralLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_medicao_geral_leite();


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_conjunto_parcelas; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "MedicaoGeralLeite_conjunto_parcelas" AFTER INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_conjunto_parcelas_leite();


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_origens_historicas; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "MedicaoGeralLeite_origens_historicas" AFTER INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_afericao_origem_geral();


--
-- Name: MedicaoLeite MedicaoLeite_finalidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MedicaoLeite_finalidade" BEFORE INSERT OR UPDATE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_finalidade_medicao_leite();


--
-- Name: MedicaoLeite MedicaoLeite_identidade_origem; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MedicaoLeite_identidade_origem" BEFORE UPDATE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_identidade_medicao_com_origem();


--
-- Name: MedicaoLeite MedicaoLeite_proteger_estoque; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MedicaoLeite_proteger_estoque" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_medicao_leite_confirmada();


--
-- Name: MesNutricao MesNutricao_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MesNutricao_validar" BEFORE INSERT OR UPDATE ON pecuaria."MesNutricao" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_mes_nutricional();


--
-- Name: MomentoProtocolo MomentoProtocolo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MomentoProtocolo_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."MomentoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_estrutura_protocolo();


--
-- Name: MovimentoConsumoDiario MovimentoConsumoDiario_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MovimentoConsumoDiario_imutavel" BEFORE UPDATE ON pecuaria."MovimentoConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_consumo_diario();


--
-- Name: MovimentoConsumoDiario MovimentoConsumoDiario_ledger; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "MovimentoConsumoDiario_ledger" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."MovimentoConsumoDiario" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ledger_nutricional();


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_conservacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "MovimentoFornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."MovimentoFornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "MovimentoFornecimentoNutricionalLeite_historico" BEFORE DELETE OR UPDATE ON pecuaria."MovimentoFornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_convergencia_protegida; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "NecessidadeReprodutiva_convergencia_protegida" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."NecessidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_convergencia_necessidade();


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_validar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "NecessidadeReprodutiva_validar" BEFORE INSERT OR UPDATE ON pecuaria."NecessidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_necessidade_reprodutiva();


--
-- Name: OcorrenciaSanitaria OcorrenciaSanitaria_rp_parto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OcorrenciaSanitaria_rp_parto" AFTER INSERT OR UPDATE ON pecuaria."OcorrenciaSanitaria" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_rp_ocorrencia_trigger();


--
-- Name: OfertaBezerreiro OfertaBezerreiro_conservacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OfertaBezerreiro_conservacao" AFTER INSERT OR UPDATE ON pecuaria."OfertaBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_oferta_bezerreiro();


--
-- Name: OfertaBezerreiro OfertaBezerreiro_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "OfertaBezerreiro_historico" BEFORE DELETE OR UPDATE ON pecuaria."OfertaBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro();


--
-- Name: OfertaProgramadaBezerreiro OfertaProgramadaBezerreiro_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "OfertaProgramadaBezerreiro_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."OfertaProgramadaBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_programacao_bezerreiro();


--
-- Name: OfertaProgramadaBezerreiro OfertaProgramadaBezerreiro_total; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OfertaProgramadaBezerreiro_total" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."OfertaProgramadaBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_configuracao_bezerreiro();


--
-- Name: OperacaoComercialLeite OperacaoComercialLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OperacaoComercialLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."OperacaoComercialLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: OperacaoComercialLeite OperacaoComercialLeite_identidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "OperacaoComercialLeite_identidade" BEFORE DELETE OR UPDATE ON pecuaria."OperacaoComercialLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.guardar_identidade_comercial_leite();


--
-- Name: OrigemColostro OrigemColostro_conferir_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OrigemColostro_conferir_saldo" AFTER INSERT OR UPDATE ON pecuaria."OrigemColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_saldo_colostro();


--
-- Name: OrigemColostro OrigemColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OrigemColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."OrigemColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro();


--
-- Name: OrigemColostro OrigemColostro_travar_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "OrigemColostro_travar_saldo" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."OrigemColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_saldo_colostro();


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_conferir_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OrigemPreparoColostro_conferir_saldo" AFTER INSERT OR UPDATE ON pecuaria."OrigemPreparoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_saldo_colostro();


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "OrigemPreparoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."OrigemPreparoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro();


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_travar_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "OrigemPreparoColostro_travar_saldo" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."OrigemPreparoColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_saldo_colostro();


--
-- Name: ParcelaDestinoLeite ParcelaDestinoLeite_fatos_imutaveis; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParcelaDestinoLeite_fatos_imutaveis" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ParcelaDestinoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_fatos_destino_leite();


--
-- Name: ParcelaDestinoLeite ParcelaDestinoLeite_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParcelaDestinoLeite_integridade" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ParcelaDestinoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destino_interno_leite();


--
-- Name: ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_conservacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParcelaFornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."ParcelaFornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();


--
-- Name: ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParcelaFornecimentoNutricionalLeite_historico" BEFORE DELETE OR UPDATE ON pecuaria."ParcelaFornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParticipacaoBezerreiro_contexto" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ParticipacaoBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_participacao_bezerreiro();


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_ofertas_localizacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParticipacaoBezerreiro_ofertas_localizacao" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ParticipacaoBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_permanencia_ofertas_bezerreiro();


--
-- Name: ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_fornecimento_leite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParticipacaoConsumoAnimal_fornecimento_leite" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ParticipacaoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- Name: ParticipacaoConsumoDiario ParticipacaoConsumoDiario_mes_aberto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParticipacaoConsumoDiario_mes_aberto" BEFORE INSERT OR UPDATE ON pecuaria."ParticipacaoConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_item_mensal();


--
-- Name: ParticipacaoConsumoAnimal ParticipacaoConsumo_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParticipacaoConsumo_conferir" AFTER INSERT OR UPDATE ON pecuaria."ParticipacaoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_segmentos_consumo();


--
-- Name: ParticipacaoProtocolo ParticipacaoProtocolo_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParticipacaoProtocolo_contexto" BEFORE INSERT OR UPDATE OF "programacaoId", "protocoloId", "propriedadeId" ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_participacao_protocolo();


--
-- Name: ParticipacaoProtocolo ParticipacaoProtocolo_trava_versao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParticipacaoProtocolo_trava_versao" BEFORE INSERT OR UPDATE OF "protocoloId" ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_versao_adotada();


--
-- Name: ParticipacaoProtocolo Participacao_acompanhamento_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Participacao_acompanhamento_imutavel" BEFORE UPDATE OF "acompanhamentoSnapshot" ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_snapshot_acompanhamento();


--
-- Name: ParticipacaoProtocolo Participacao_acompanhamento_valido; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Participacao_acompanhamento_valido" BEFORE INSERT ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_snapshot_acompanhamento();


--
-- Name: ParticipanteProducaoLeite ParticipanteLeite_proteger_estoque; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParticipanteLeite_proteger_estoque" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ParticipanteProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_populacao_leite_confirmada();


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_finalidade_evidencia; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ParticipanteProducaoLeite_finalidade_evidencia" BEFORE INSERT OR UPDATE ON pecuaria."ParticipanteProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_evidencia_finalidade_leite();


--
-- Name: PartoAnimal PartoAnimal_00_desfecho_explicito; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PartoAnimal_00_desfecho_explicito" BEFORE UPDATE OF desfecho ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_desfecho_parto_explicito();


--
-- Name: PartoAnimal PartoAnimal_10_compatibilidade_desfecho; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PartoAnimal_10_compatibilidade_desfecho" BEFORE INSERT OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.compatibilizar_desfecho_parto();


--
-- Name: PartoAnimal PartoAnimal_colostro; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_colostro" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();


--
-- Name: PartoAnimal PartoAnimal_colostro_produtor; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PartoAnimal_colostro_produtor" BEFORE UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_origens_bezerreiro();


--
-- Name: PartoAnimal PartoAnimal_exames_pos_parto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_exames_pos_parto" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_exame_pos_parto_trigger();


--
-- Name: PartoAnimal PartoAnimal_pesagens; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_pesagens" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- Name: PartoAnimal PartoAnimal_proteger_parcelas_leite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_proteger_parcelas_leite" AFTER DELETE OR UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_partos_parcelas_leite();


--
-- Name: PartoAnimal PartoAnimal_rp_ocorrencias; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_rp_ocorrencias" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_rp_parto_trigger();


--
-- Name: PartoAnimal PartoAnimal_travar_parcelas_leite; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PartoAnimal_travar_parcelas_leite" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- Name: PartoAnimal Parto_aborto_explicado; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Parto_aborto_explicado" BEFORE INSERT OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_explicacao_novo_aborto();


--
-- Name: PerfilBezerreiro PerfilBezerreiro_ativacao_localizacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PerfilBezerreiro_ativacao_localizacao" BEFORE INSERT OR UPDATE ON pecuaria."PerfilBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_ativacao_perfil_bezerreiro();


--
-- Name: PerfilBezerreiro PerfilBezerreiro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PerfilBezerreiro_contexto" AFTER INSERT OR UPDATE ON pecuaria."PerfilBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_configuracao_bezerreiro();


--
-- Name: PerfilBezerreiro PerfilBezerreiro_identidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PerfilBezerreiro_identidade" BEFORE UPDATE ON pecuaria."PerfilBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_origens_bezerreiro();


--
-- Name: PerfilBezerreiro PerfilBezerreiro_ocupacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PerfilBezerreiro_ocupacao" AFTER INSERT OR UPDATE ON pecuaria."PerfilBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro();


--
-- Name: PeriodoFaseBezerreiro PeriodoFaseBezerreiro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PeriodoFaseBezerreiro_contexto" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."PeriodoFaseBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_participacao_bezerreiro();


--
-- Name: Pesagem Pesagem_partos; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Pesagem_partos" AFTER UPDATE ON pecuaria."Pesagem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- Name: Pesagem Pesagem_secagem_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Pesagem_secagem_integridade" AFTER UPDATE ON pecuaria."Pesagem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.revalidar_peso_secagem();


--
-- Name: Pesagem Pesagem_versao_parto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Pesagem_versao_parto" AFTER UPDATE ON pecuaria."Pesagem" FOR EACH ROW EXECUTE FUNCTION pecuaria.atualizar_versao_parto_pesagem();


--
-- Name: PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamento_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PoliticaAcompanhamento_imutavel" BEFORE UPDATE ON pecuaria."PoliticaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();


--
-- Name: PoliticaAtencaoReprodutiva PoliticaAtencaoReprodutiva_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PoliticaAtencaoReprodutiva_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."PoliticaAtencaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();


--
-- Name: PoliticaElegibilidadeReprodutiva PoliticaElegibilidade_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PoliticaElegibilidade_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."PoliticaElegibilidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_politica_e_ciclo();


--
-- Name: PosicaoOrdenha PosicaoOrdenha_snapshot_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PosicaoOrdenha_snapshot_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."PosicaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_posicao_ordenha_usada();


--
-- Name: PreparoColostro PreparoColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "PreparoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."PreparoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro();


--
-- Name: PreparoColostro PreparoColostro_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "PreparoColostro_historico" BEFORE DELETE OR UPDATE ON pecuaria."PreparoColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro();


--
-- Name: VinculoPreparoTentativa Preparo_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Preparo_conferir" BEFORE INSERT OR UPDATE ON pecuaria."VinculoPreparoTentativa" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_preparo();


--
-- Name: VinculoPreparoTentativa Preparo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Preparo_imutavel" BEFORE UPDATE ON pecuaria."VinculoPreparoTentativa" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_preparo();


--
-- Name: AplicacaoProduto Preparo_limite_aplicacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Preparo_limite_aplicacao" AFTER UPDATE ON pecuaria."AplicacaoProduto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- Name: ExameAnimal Preparo_limite_exame; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Preparo_limite_exame" AFTER UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- Name: ParticipacaoProtocolo Preparo_limite_participacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Preparo_limite_participacao" AFTER UPDATE ON pecuaria."ParticipacaoProtocolo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- Name: ProgramacaoProtocolo ProgramacaoProtocolo_trava_versao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ProgramacaoProtocolo_trava_versao" BEFORE INSERT OR UPDATE OF "protocoloId" ON pecuaria."ProgramacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_versao_adotada();


--
-- Name: Protocolo Protocolo_finalidade_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Protocolo_finalidade_imutavel" BEFORE UPDATE OF finalidade ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_finalidade_protocolo();


--
-- Name: Protocolo Protocolo_modalidades_imutaveis; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Protocolo_modalidades_imutaveis" BEFORE UPDATE OF "modalidadeTentativa", "modalidadeDiagnostico" ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_modalidades_protocolo();


--
-- Name: Protocolo Protocolo_prazos_imutaveis; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Protocolo_prazos_imutaveis" BEFORE UPDATE OF "configuracaoAcompanhamento" ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_prazos_modelo();


--
-- Name: Protocolo Protocolo_referencia_publicada; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Protocolo_referencia_publicada" BEFORE UPDATE ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_referencia_protocolo_publicado();


--
-- Name: Protocolo Protocolo_versao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "Protocolo_versao" BEFORE INSERT OR UPDATE ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_versao_protocolo();


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_comprovacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ReferenciaGerencialLeite_comprovacao" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ReferenciaGerencialLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_referencia_gerencial_leite();


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimento_revisao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "RegraImpactoProcedimento_revisao" BEFORE DELETE OR UPDATE ON pecuaria."RegraImpactoProcedimentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_regra_impacto_procedimento();


--
-- Name: ResultadoQualidadeLeite ResultadoQualidadeLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ResultadoQualidadeLeite_conferir" BEFORE INSERT ON pecuaria."ResultadoQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_resultado_qualidade_leite();


--
-- Name: ResultadoQualidadeLeite ResultadoQualidadeLeite_preservar; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "ResultadoQualidadeLeite_preservar" BEFORE DELETE OR UPDATE ON pecuaria."ResultadoQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_resultado_qualidade_leite();


--
-- Name: ResultadoExame Resultado_resolucao_demanda_final; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "Resultado_resolucao_demanda_final" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ResultadoExame" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();


--
-- Name: AlocacaoLeiteEstoque RetiradaInternaLeite_alocacao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "RetiradaInternaLeite_alocacao" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_retirada_interna_leite();


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "RetiradaInternaLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."RetiradaInternaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_retirada_interna_leite();


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "RetiradaInternaLeite_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."RetiradaInternaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_retirada_interna_leite();


--
-- Name: RetiradaOperacaoLeite RetiradaOperacaoLeite_aberta; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "RetiradaOperacaoLeite_aberta" BEFORE INSERT ON pecuaria."RetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_retirada_comercial_leite();


--
-- Name: RetiradaOperacaoLeite RetiradaOperacaoLeite_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "RetiradaOperacaoLeite_conferir" AFTER INSERT ON pecuaria."RetiradaOperacaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: RetiradaOperacaoLeite RetiradaOperacaoLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "RetiradaOperacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."RetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazo_aplicada; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "RevisaoPrazo_aplicada" AFTER INSERT ON pecuaria."RevisaoPrazoAcompanhamento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_revisao_prazo_aplicada();


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "RevisaoPrazo_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."RevisaoPrazoAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_alteracao_revisao_prazo();


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazo_tarefa_aplicada; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "RevisaoPrazo_tarefa_aplicada" AFTER INSERT ON pecuaria."RevisaoPrazoAcompanhamento" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_revisao_tarefa_prazo();


--
-- Name: SegmentoConsumoAnimal SegmentoConsumo_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "SegmentoConsumo_conferir" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."SegmentoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_segmentos_consumo();


--
-- Name: SegmentoConsumoAnimal SegmentoConsumo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "SegmentoConsumo_imutavel" BEFORE UPDATE ON pecuaria."SegmentoConsumoAnimal" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: SessaoOrdenha SessaoLeite_proteger_estoque; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "SessaoLeite_proteger_estoque" BEFORE DELETE OR UPDATE ON pecuaria."SessaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_sessao_leite_confirmada();


--
-- Name: SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "SnapshotRelatorioReprodutivo_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."SnapshotRelatorioReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_snapshot_relatorio_reprodutivo();


--
-- Name: TanqueLeite TanqueLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "TanqueLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."TanqueLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: TarefaProtocolo TarefaProtocolo_momento_snapshot; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "TarefaProtocolo_momento_snapshot" BEFORE UPDATE OF "momentoSnapshot" ON pecuaria."TarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_momento_snapshot_tarefa();


--
-- Name: TarefaProtocolo TarefaProtocolo_versao; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "TarefaProtocolo_versao" BEFORE INSERT OR UPDATE OF "etapaId", "participacaoId" ON pecuaria."TarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_tarefa_protocolo();


--
-- Name: TipoExame TipoExame_catalogo_formato; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "TipoExame_catalogo_formato" BEFORE UPDATE ON pecuaria."TipoExame" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_formato_catalogo_avaliacao();


--
-- Name: TipoExame TipoExame_preservar_qualidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "TipoExame_preservar_qualidade" BEFORE UPDATE ON pecuaria."TipoExame" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_formato_qualidade_leite();


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_atomicidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "UnidadeBancoColostro_atomicidade" AFTER INSERT OR UPDATE ON pecuaria."UnidadeBancoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destinacao_colostro();


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_conferir_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "UnidadeBancoColostro_conferir_saldo" AFTER INSERT OR UPDATE ON pecuaria."UnidadeBancoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_saldo_colostro();


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "UnidadeBancoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."UnidadeBancoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro();


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_travar_saldo; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "UnidadeBancoColostro_travar_saldo" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."UnidadeBancoColostro" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_saldo_colostro();


--
-- Name: VersaoSelecaoVisita VersaoSelecaoVisita_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VersaoSelecaoVisita_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."VersaoSelecaoVisita" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_versao_selecao_visita();


--
-- Name: VersaoComercialVendaLeite VersaoVendaLeite_cadeia; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "VersaoVendaLeite_cadeia" AFTER INSERT ON pecuaria."VersaoComercialVendaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: VersaoComercialVendaLeite VersaoVendaLeite_identidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VersaoVendaLeite_identidade" BEFORE INSERT ON pecuaria."VersaoComercialVendaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_identidade_versao_venda_leite();


--
-- Name: VersaoComercialVendaLeite VersaoVendaLeite_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VersaoVendaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."VersaoComercialVendaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_mutacao_versao_venda_leite();


--
-- Name: VigenciaDietaLote VigenciaDietaLote_nutricao_mensal; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VigenciaDietaLote_nutricao_mensal" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."VigenciaDietaLote" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_nutricao_mensal();


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusao_proteger; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoConclusao_proteger" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."VinculoConclusaoAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_conclusao();


--
-- Name: VinculoFornecimentoColostragem VinculoFornecimentoColostragem_acompanhamento_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "VinculoFornecimentoColostragem_acompanhamento_contexto" AFTER INSERT OR UPDATE ON pecuaria."VinculoFornecimentoColostragem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_acompanhamento_colostragem();


--
-- Name: VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_finalidade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoMedicaoEntradaLeite_finalidade" BEFORE INSERT OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_finalidade_medicao_leite();


--
-- Name: VinculoMedicaoEntradaLeite VinculoMedicaoEntrada_conferir; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "VinculoMedicaoEntrada_conferir" AFTER INSERT OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_vinculo_medicao_entrada();


--
-- Name: VinculoMedicaoEntradaLeite VinculoMedicaoEntrada_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoMedicaoEntrada_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_medicao_entrada();


--
-- Name: VinculoPesagemParto VinculoPesagemParto_contexto; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "VinculoPesagemParto_contexto" AFTER INSERT OR UPDATE ON pecuaria."VinculoPesagemParto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- Name: VinculoPesagemParto VinculoPesagemParto_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoPesagemParto_historico" BEFORE DELETE OR UPDATE ON pecuaria."VinculoPesagemParto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_pesagem_parto();


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE CONSTRAINT TRIGGER "VinculoPesagemSecagem_integridade" AFTER INSERT OR UPDATE ON pecuaria."VinculoPesagemSecagem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.revalidar_peso_secagem();


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_preservar_historico; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoPesagemSecagem_preservar_historico" BEFORE DELETE OR UPDATE ON pecuaria."VinculoPesagemSecagem" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_historico_peso_secagem();


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_consistencia; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoPoliticaCiclo_consistencia" BEFORE INSERT ON pecuaria."VinculoPoliticaCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ciclo_elegibilidade();


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_imutavel; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoPoliticaCiclo_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."VinculoPoliticaCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_politica_e_ciclo();


--
-- Name: VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_integridade; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoQualidadeFechamentoLeite_integridade" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."VinculoQualidadeFechamentoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_qualidade_fechamento();


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_fato; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoTarefaProtocolo_fato" BEFORE INSERT OR UPDATE ON pecuaria."VinculoTarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_tarefa();


--
-- Name: VinculoTentativaParticipacao VinculoTentativa_factual_valido; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoTentativa_factual_valido" BEFORE INSERT OR UPDATE ON pecuaria."VinculoTentativaParticipacao" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_tentativa_participacao();


--
-- Name: VinculoTentativaParticipacao VinculoTentativa_preservado; Type: TRIGGER; Schema: pecuaria; Owner: -
--

CREATE TRIGGER "VinculoTentativa_preservado" BEFORE DELETE ON pecuaria."VinculoTentativaParticipacao" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_vinculo_tentativa();


--
-- Name: AlocacaoPartidaEstoque AlocacaoPartidaEstoque_imutavel_v3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "AlocacaoPartidaEstoque_imutavel_v3" BEFORE UPDATE ON public."AlocacaoPartidaEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_alocacao_partida_v3();


--
-- Name: AlocacaoPartidaEstoque AlocacaoPartidaEstoque_partidas_v3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "AlocacaoPartidaEstoque_partidas_v3" AFTER INSERT OR DELETE OR UPDATE ON public."AlocacaoPartidaEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_alocacao_partida_v3();


--
-- Name: BaseValorizacaoEstoque BaseValorizacao_imutavel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "BaseValorizacao_imutavel" BEFORE UPDATE ON public."BaseValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: BaseValorizacaoEstoque BaseValorizacao_validar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "BaseValorizacao_validar" BEFORE INSERT ON public."BaseValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.conferir_base_valorizacao();


--
-- Name: CompromissoFinanceiro Compromisso_cadeia_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Compromisso_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."CompromissoFinanceiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: CompromissoFinanceiro Compromisso_fechamentoLeite_conferir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Compromisso_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."CompromissoFinanceiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: MovimentoEstoque DescarteLeite_movimento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "DescarteLeite_movimento" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();


--
-- Name: EventoMetaAssistente EventoMetaAssistente_imutavel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "EventoMetaAssistente_imutavel" BEFORE DELETE OR UPDATE ON public."EventoMetaAssistente" FOR EACH ROW EXECUTE FUNCTION public."protegerEventoMetaAssistente"();


--
-- Name: EventoMetaAssistente EventoMetaAssistente_sequencia; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "EventoMetaAssistente_sequencia" BEFORE INSERT ON public."EventoMetaAssistente" FOR EACH ROW EXECUTE FUNCTION public."validarSequenciaMetaAssistente"();


--
-- Name: ItemOperacao ItemOperacao_animal_validar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "ItemOperacao_animal_validar" BEFORE INSERT OR UPDATE OF "animalId", "operacaoId" ON public."ItemOperacao" FOR EACH ROW EXECUTE FUNCTION public.validar_item_operacao_animal();


--
-- Name: ItemOperacao ItemOperacao_fechamentoLeite_conferir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "ItemOperacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."ItemOperacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: ItemOperacao Item_cadeia_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Item_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."ItemOperacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: Liquidacao Liquidacao_cadeia_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Liquidacao_cadeia_leite" AFTER INSERT OR UPDATE ON public."Liquidacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: Liquidacao Liquidacao_fechamentoLeite_conferir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Liquidacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."Liquidacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: MovimentoEstoque MovimentoEstoque_colostro_reservado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_colostro_reservado" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_fisico_colostro();


--
-- Name: MovimentoEstoque MovimentoEstoque_conciliar_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_conciliar_valor" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_valorizacao_estoque();


--
-- Name: MovimentoEstoque MovimentoEstoque_fornecimento_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_fornecimento_leite" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- Name: MovimentoEstoque MovimentoEstoque_nutricao_diaria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "MovimentoEstoque_nutricao_diaria" BEFORE DELETE OR UPDATE ON public."MovimentoEstoque" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_movimento_nutricional();


--
-- Name: MovimentoEstoque MovimentoEstoque_partidas_v3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_partidas_v3" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_alocacao_partida_v3();


--
-- Name: MovimentoEstoque MovimentoEstoque_valor_imutavel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "MovimentoEstoque_valor_imutavel" BEFORE UPDATE ON public."MovimentoEstoque" FOR EACH ROW EXECUTE FUNCTION public.proteger_identidade_valorizada();


--
-- Name: MovimentoEstoque Movimento_cadeia_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Movimento_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: MovimentoEstoque Movimento_retiradaComercialLeite_conferir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Movimento_retiradaComercialLeite_conferir" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: Operacao Operacao_cadeia_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Operacao_cadeia_leite" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: Operacao Operacao_demonstrativo_leite_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Operacao_demonstrativo_leite_guard" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- Name: Operacao Operacao_fechamentoLeite_conferir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Operacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: ParcelaValorizacaoEstoque ParcelaValorizacao_conciliar_valor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "ParcelaValorizacao_conciliar_valor" AFTER INSERT OR DELETE OR UPDATE ON public."ParcelaValorizacaoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_valorizacao_estoque();


--
-- Name: ParcelaValorizacaoEstoque ParcelaValorizacao_imutavel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "ParcelaValorizacao_imutavel" BEFORE UPDATE ON public."ParcelaValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- Name: PartidaProduto PartidaProduto_grupo_validade; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "PartidaProduto_grupo_validade" BEFORE INSERT OR UPDATE ON public."PartidaProduto" FOR EACH ROW EXECUTE FUNCTION public.conferir_grupo_validade_produto();


--
-- Name: MovimentoEstoque RetiradaInternaLeite_movimento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "RetiradaInternaLeite_movimento" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_movimento_retirada_interna_leite();


--
-- Name: TransacaoFinanceira Transacao_cadeia_leite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Transacao_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."TransacaoFinanceira" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- Name: TransacaoFinanceira Transacao_fechamentoLeite_conferir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "Transacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."TransacaoFinanceira" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- Name: AcompanhamentoColostragem AcompanhamentoColostragem_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AcompanhamentoColostragem"
    ADD CONSTRAINT "AcompanhamentoColostragem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AcompanhamentoColostragem AcompanhamentoColostragem_configuracaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AcompanhamentoColostragem"
    ADD CONSTRAINT "AcompanhamentoColostragem_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES pecuaria."ConfiguracaoBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AcompanhamentoColostragem AcompanhamentoColostragem_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AcompanhamentoColostragem"
    ADD CONSTRAINT "AcompanhamentoColostragem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: AcompanhamentoColostragem AcompanhamentoColostragem_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AcompanhamentoColostragem"
    ADD CONSTRAINT "AcompanhamentoColostragem_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_demonstrativoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_demonstrativoId_fkey" FOREIGN KEY ("demonstrativoId") REFERENCES pecuaria."DemonstrativoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_entregaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES pecuaria."EntregaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_versaoVendaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_versaoVendaId_fkey" FOREIGN KEY ("versaoVendaId") REFERENCES pecuaria."VersaoComercialVendaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_destinacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_destinacaoId_fkey" FOREIGN KEY ("destinacaoId") REFERENCES pecuaria."DestinacaoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_destinoInternoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_destinoInternoId_fkey" FOREIGN KEY ("destinoInternoId") REFERENCES pecuaria."DestinoInternoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_fornecimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_origemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES pecuaria."OrigemColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoFornecimentoColostro AlocacaoFornecimentoColostro_unidadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoFornecimentoColostro"
    ADD CONSTRAINT "AlocacaoFornecimentoColostro_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES pecuaria."UnidadeBancoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeiteEstoque_classificacaoId_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_classificacaoId_entradaId_fkey" FOREIGN KEY ("classificacaoId", "entradaId") REFERENCES pecuaria."ClassificacaoEntradaLeite"(id, "entradaId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeiteEstoque_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoLeiteEstoque AlocacaoLeiteEstoque_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_exameAnimalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_exameAnimalId_fkey" FOREIGN KEY ("exameAnimalId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_origemColostroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_origemColostroId_fkey" FOREIGN KEY ("origemColostroId") REFERENCES pecuaria."OrigemColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AmostraQualidadeLeite AmostraQualidadeLeite_tipoExameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."FormatoQualidadeLeite"("tipoExameId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Animal Animal_maeExternaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_maeExternaId_fkey" FOREIGN KEY ("maeExternaId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_maeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_maeId_fkey" FOREIGN KEY ("maeId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_paiExternoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_paiExternoId_fkey" FOREIGN KEY ("paiExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_paiId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_itemCompraDiretaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_itemCompraDiretaId_fkey" FOREIGN KEY ("itemCompraDiretaId") REFERENCES public."ItemOperacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_movimentoEstoqueId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_ocorrenciaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES pecuaria."OcorrenciaSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_operacaoServicoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AplicacaoProduto AplicacaoProduto_tipoAplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT;


--
-- Name: ApropriacaoValorLeite ApropriacaoValorLeite_alocacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ApropriacaoValorLeite"
    ADD CONSTRAINT "ApropriacaoValorLeite_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES pecuaria."AlocacaoLeiteEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ApropriacaoValorLeite ApropriacaoValorLeite_apuracaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ApropriacaoValorLeite"
    ADD CONSTRAINT "ApropriacaoValorLeite_apuracaoId_fkey" FOREIGN KEY ("apuracaoId") REFERENCES pecuaria."ApuracaoValorLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ApuracaoValorLeite ApuracaoValorLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ApuracaoValorLeite"
    ADD CONSTRAINT "ApuracaoValorLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AtividadeVisita AtividadeVisita_visitaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AtividadeVisita"
    ADD CONSTRAINT "AtividadeVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES pecuaria."VisitaVeterinaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditoriaPecuaria AuditoriaPecuaria_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditoriaPecuaria AuditoriaPecuaria_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditoriaPecuaria AuditoriaPecuaria_requisicaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES pecuaria."RequisicaoPecuaria"(chave) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditoriaPecuaria AuditoriaPecuaria_usuarioId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AutomacaoProtocolo AutomacaoProtocolo_momentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AutomacaoProtocolo"
    ADD CONSTRAINT "AutomacaoProtocolo_momentoId_fkey" FOREIGN KEY ("momentoId") REFERENCES pecuaria."MomentoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: AutomacaoProtocolo AutomacaoProtocolo_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AutomacaoProtocolo"
    ADD CONSTRAINT "AutomacaoProtocolo_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: AutomacaoProtocolo AutomacaoProtocolo_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AutomacaoProtocolo"
    ADD CONSTRAINT "AutomacaoProtocolo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: AutomacaoProtocolo AutomacaoProtocolo_usuarioId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."AutomacaoProtocolo"
    ADD CONSTRAINT "AutomacaoProtocolo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: InterpretacaoReprodutiva AvaliacaoReprodutiva_gestacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InterpretacaoReprodutiva AvaliacaoReprodutiva_restricaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_restricaoId_fkey" FOREIGN KEY ("restricaoId") REFERENCES pecuaria."RestricaoReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InterpretacaoReprodutiva AvaliacaoReprodutiva_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BaixaAnimal BaixaAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BaixaAnimal BaixaAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BaixaAnimal BaixaAnimal_destinoFechadoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_destinoFechadoId_fkey" FOREIGN KEY ("destinoFechadoId") REFERENCES pecuaria."FinalidadeAnimal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BaixaAnimal BaixaAnimal_localizacaoFechadaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_localizacaoFechadaId_fkey" FOREIGN KEY ("localizacaoFechadaId") REFERENCES pecuaria."LocalizacaoAnimal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BaixaAnimal BaixaAnimal_motivoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES pecuaria."MotivoBaixa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacaoReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CatalogoAvaliacaoReprodutiva"
    ADD CONSTRAINT "CatalogoAvaliacaoReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacaoReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CatalogoAvaliacaoReprodutiva"
    ADD CONSTRAINT "CatalogoAvaliacaoReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: CatalogoAvaliacaoReprodutiva CatalogoAvaliacaoReprodutiva_tipoExameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CatalogoAvaliacaoReprodutiva"
    ADD CONSTRAINT "CatalogoAvaliacaoReprodutiva_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON DELETE RESTRICT;


--
-- Name: CategoriaAnimal CategoriaAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CategoriaAnimal"
    ADD CONSTRAINT "CategoriaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CategoriaManualAnimal CategoriaManualAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CategoriaManualAnimal CategoriaManualAnimal_categoriaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES pecuaria."CategoriaAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CategoriaManualAnimal CategoriaManualAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_aplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_exameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_manejoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_manejoId_fkey" FOREIGN KEY ("manejoId") REFERENCES pecuaria."ManejoAnimal"(id) ON DELETE RESTRICT;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoConsumoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoConsumoId_fkey" FOREIGN KEY ("participacaoConsumoId") REFERENCES pecuaria."ParticipacaoConsumoAnimal"(id) ON DELETE RESTRICT;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoDiariaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoDiariaId_fkey" FOREIGN KEY ("participacaoDiariaId") REFERENCES pecuaria."ParticipacaoConsumoDiario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: ClassificacaoEntradaLeite ClassificacaoEntradaLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ClassificacaoEntradaLeite"
    ADD CONSTRAINT "ClassificacaoEntradaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ColeiraBezerreiro ColeiraBezerreiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ColeiraBezerreiro"
    ADD CONSTRAINT "ColeiraBezerreiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ColeiraBezerreiro ColeiraBezerreiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ColeiraBezerreiro"
    ADD CONSTRAINT "ColeiraBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ComposicaoGenitorExterno ComposicaoGenitorExterno_genitorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoGenitorExterno"
    ADD CONSTRAINT "ComposicaoGenitorExterno_genitorId_fkey" FOREIGN KEY ("genitorId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComposicaoGenitorExterno ComposicaoGenitorExterno_racaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoGenitorExterno"
    ADD CONSTRAINT "ComposicaoGenitorExterno_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES pecuaria."Raca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ComposicaoRacial ComposicaoRacial_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ComposicaoRacial ComposicaoRacial_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ComposicaoRacial ComposicaoRacial_racaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES pecuaria."Raca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ComprovanteEntregaLeite ComprovanteEntregaLeite_entregaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComprovanteEntregaLeite"
    ADD CONSTRAINT "ComprovanteEntregaLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES pecuaria."EntregaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ComprovanteRetiradaOperacaoLeite ComprovanteRetiradaOperacaoLeite_retiradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ComprovanteRetiradaOperacaoLeite"
    ADD CONSTRAINT "ComprovanteRetiradaOperacaoLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES pecuaria."RetiradaOperacaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConferenciaEntregaLeite ConferenciaEntregaLeite_entregaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConferenciaEntregaLeite"
    ADD CONSTRAINT "ConferenciaEntregaLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES pecuaria."EntregaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConferenciaSaldoLeite ConferenciaSaldoLeite_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConferenciaSaldoLeite"
    ADD CONSTRAINT "ConferenciaSaldoLeite_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConferenciaSaldoLeite ConferenciaSaldoLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConferenciaSaldoLeite"
    ADD CONSTRAINT "ConferenciaSaldoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConfiguracaoBezerreiro ConfiguracaoBezerreiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoBezerreiro"
    ADD CONSTRAINT "ConfiguracaoBezerreiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ConfiguracaoBezerreiro ConfiguracaoBezerreiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoBezerreiro"
    ADD CONSTRAINT "ConfiguracaoBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConfiguracaoNutricao ConfiguracaoNutricao_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoNutricao"
    ADD CONSTRAINT "ConfiguracaoNutricao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConfiguracaoNutricao ConfiguracaoNutricao_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoNutricao"
    ADD CONSTRAINT "ConfiguracaoNutricao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConfiguracaoOrdenha ConfiguracaoOrdenha_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConfiguracaoOrdenha"
    ADD CONSTRAINT "ConfiguracaoOrdenha_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConsumoDiario ConsumoDiario_mesId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ConsumoDiario"
    ADD CONSTRAINT "ConsumoDiario_mesId_fkey" FOREIGN KEY ("mesId") REFERENCES pecuaria."MesNutricao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ControleHistoricoLeite ControleHistoricoLeite_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ControleHistoricoLeite"
    ADD CONSTRAINT "ControleHistoricoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ControleHistoricoLeite ControleHistoricoLeite_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ControleHistoricoLeite"
    ADD CONSTRAINT "ControleHistoricoLeite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ControleHistoricoLeite ControleHistoricoLeite_lactacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ControleHistoricoLeite"
    ADD CONSTRAINT "ControleHistoricoLeite_lactacaoId_fkey" FOREIGN KEY ("lactacaoId") REFERENCES pecuaria."LactacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ControleHistoricoLeite ControleHistoricoLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ControleHistoricoLeite"
    ADD CONSTRAINT "ControleHistoricoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CriaParto CriaParto_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CriaParto"
    ADD CONSTRAINT "CriaParto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CriaParto CriaParto_partoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."CriaParto"
    ADD CONSTRAINT "CriaParto_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_exameAptidaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_exameAptidaoId_fkey" FOREIGN KEY ("exameAptidaoId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_vinculoCicloId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_vinculoCicloId_fkey" FOREIGN KEY ("vinculoCicloId") REFERENCES pecuaria."VinculoPoliticaCiclo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_demandaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoOperacionalAcompanhamento"
    ADD CONSTRAINT "DecisaoOperacionalAcompanhamento_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_necessidadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoOperacionalAcompanhamento"
    ADD CONSTRAINT "DecisaoOperacionalAcompanhamento_necessidadeId_fkey" FOREIGN KEY ("necessidadeId") REFERENCES pecuaria."NecessidadeReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: DecisaoOperacionalAcompanhamento DecisaoOperacionalAcompanhamento_usuarioId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DecisaoOperacionalAcompanhamento"
    ADD CONSTRAINT "DecisaoOperacionalAcompanhamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id);


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodut_participacaoAcompanhamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodut_participacaoAcompanhamentoId_fkey" FOREIGN KEY ("participacaoAcompanhamentoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReproduti_vinculoConclusaoResolucaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReproduti_vinculoConclusaoResolucaoId_fkey" FOREIGN KEY ("vinculoConclusaoResolucaoId") REFERENCES pecuaria."VinculoConclusaoAcompanhamento"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_decisaoOperacionalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_decisaoOperacionalId_fkey" FOREIGN KEY ("decisaoOperacionalId") REFERENCES pecuaria."DecisaoOperacionalAcompanhamento"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_exameOrigemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_exameOrigemId_fkey" FOREIGN KEY ("exameOrigemId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_exameResolucaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_exameResolucaoId_fkey" FOREIGN KEY ("exameResolucaoId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_gestacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_politicaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_propriedadeOrigemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_propriedadeOrigemId_fkey" FOREIGN KEY ("propriedadeOrigemId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: DemonstrativoLeite DemonstrativoLeite_parceiroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemonstrativoLeite"
    ADD CONSTRAINT "DemonstrativoLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DemonstrativoLeite DemonstrativoLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DemonstrativoLeite"
    ADD CONSTRAINT "DemonstrativoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DescarteLeite DescarteLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DescarteLeite DescarteLeite_movimentoEstornoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DescarteLeite DescarteLeite_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DescarteLeite DescarteLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DestinacaoColostro DestinacaoColostro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinacaoColostro"
    ADD CONSTRAINT "DestinacaoColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: DestinacaoColostro DestinacaoColostro_estornadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinacaoColostro"
    ADD CONSTRAINT "DestinacaoColostro_estornadoPorId_fkey" FOREIGN KEY ("estornadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: DestinacaoColostro DestinacaoColostro_origemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinacaoColostro"
    ADD CONSTRAINT "DestinacaoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES pecuaria."OrigemColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DestinacaoColostro DestinacaoColostro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinacaoColostro"
    ADD CONSTRAINT "DestinacaoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DestinoInternoLeite DestinoInternoLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DestinoInternoLeite DestinoInternoLeite_movimentoEstornoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DestinoInternoLeite DestinoInternoLeite_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DestinoInternoLeite DestinoInternoLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DetalheFechamentoLeite DetalheFechamentoLeite_fechamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DetalheFechamentoLeite"
    ADD CONSTRAINT "DetalheFechamentoLeite_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DetalheFechamentoLeite DetalheFechamentoLeite_retiradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DetalheFechamentoLeite"
    ADD CONSTRAINT "DetalheFechamentoLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES pecuaria."RetiradaOperacaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiaProducaoLeite DiaProducaoLeite_configuracaoId_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DiaProducaoLeite"
    ADD CONSTRAINT "DiaProducaoLeite_configuracaoId_propriedadeId_fkey" FOREIGN KEY ("configuracaoId", "propriedadeId") REFERENCES pecuaria."ConfiguracaoOrdenha"(id, "propriedadeId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiaProducaoLeite DiaProducaoLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."DiaProducaoLeite"
    ADD CONSTRAINT "DiaProducaoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Doenca Doenca_motivoBaixaSugeridoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Doenca"
    ADD CONSTRAINT "Doenca_motivoBaixaSugeridoId_fkey" FOREIGN KEY ("motivoBaixaSugeridoId") REFERENCES pecuaria."MotivoBaixa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmissaoRelatorioLeite EmissaoRelatorioLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EmissaoRelatorioLeite"
    ADD CONSTRAINT "EmissaoRelatorioLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_medicaoGeralId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_medicaoGeralId_fkey" FOREIGN KEY ("medicaoGeralId") REFERENCES pecuaria."MedicaoGeralLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EntradaProducaoLeite EntradaProducaoLeite_sessaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES pecuaria."SessaoOrdenha"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EntregaLeite EntregaLeite_parceiroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EntregaLeite EntregaLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EntregaLeite EntregaLeite_retiradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EnvioAplicacoesTablet EnvioAplicacoesTablet_autorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EnvioAplicacoesTablet"
    ADD CONSTRAINT "EnvioAplicacoesTablet_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES public."Usuario"(id);


--
-- Name: EnvioAplicacoesTablet EnvioAplicacoesTablet_corrigeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EnvioAplicacoesTablet"
    ADD CONSTRAINT "EnvioAplicacoesTablet_corrigeId_fkey" FOREIGN KEY ("corrigeId") REFERENCES pecuaria."EnvioAplicacoesTablet"(id);


--
-- Name: EnvioAplicacoesTablet EnvioAplicacoesTablet_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EnvioAplicacoesTablet"
    ADD CONSTRAINT "EnvioAplicacoesTablet_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id);


--
-- Name: EnvioAplicacoesTablet EnvioAplicacoesTablet_revisorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EnvioAplicacoesTablet"
    ADD CONSTRAINT "EnvioAplicacoesTablet_revisorId_fkey" FOREIGN KEY ("revisorId") REFERENCES public."Usuario"(id);


--
-- Name: EtapaProtocolo EtapaProtocoloSanitario_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EtapaProtocolo EtapaProtocoloSanitario_tipoAplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT;


--
-- Name: EtapaProtocolo EtapaProtocoloSanitario_tipoExameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EtapaProtocolo EtapaProtocolo_materialId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocolo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES pecuaria."MaterialGenetico"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EtapaProtocolo EtapaProtocolo_momento_versao_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocolo_momento_versao_fkey" FOREIGN KEY ("momentoId", "protocoloId") REFERENCES pecuaria."MomentoProtocolo"(id, "protocoloId") ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: EtapaProtocolo EtapaProtocolo_protocoloId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EventoTarefaProtocolo EventoTarefaProtocolo_eventoCorrigidoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_eventoCorrigidoId_fkey" FOREIGN KEY ("eventoCorrigidoId") REFERENCES pecuaria."EventoTarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: EventoTarefaProtocolo EventoTarefaProtocolo_registradoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: EventoTarefaProtocolo EventoTarefaProtocolo_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_demandaAcompanhamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_demandaAcompanhamentoId_fkey" FOREIGN KEY ("demandaAcompanhamentoId") REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_ocorrenciaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES pecuaria."OcorrenciaSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_operacaoServicoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_partoPosPartoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_partoPosPartoId_fkey" FOREIGN KEY ("partoPosPartoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameAnimal ExameAnimal_tipoExameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameImunidadeColostragem ExameImunidadeColostragem_acompanhamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameImunidadeColostragem"
    ADD CONSTRAINT "ExameImunidadeColostragem_acompanhamentoId_fkey" FOREIGN KEY ("acompanhamentoId") REFERENCES pecuaria."AcompanhamentoColostragem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExameImunidadeColostragem ExameImunidadeColostragem_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameImunidadeColostragem"
    ADD CONSTRAINT "ExameImunidadeColostragem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ExameImunidadeColostragem ExameImunidadeColostragem_exameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExameImunidadeColostragem"
    ADD CONSTRAINT "ExameImunidadeColostragem_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_ocorrenciaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES pecuaria."OcorrenciaSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_operacaoServicoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_protocoloId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ExecucaoProtocoloSanitario_rodadaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_rodadaId_fkey" FOREIGN KEY ("programacaoId") REFERENCES pecuaria."ProgramacaoProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExposicaoTouro ExposicaoTouro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExposicaoTouro ExposicaoTouro_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExposicaoTouro ExposicaoTouro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExposicaoTouro ExposicaoTouro_touroExternoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExposicaoTouro ExposicaoTouro_touroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_coleiraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FaseBezerreiroVersao"
    ADD CONSTRAINT "FaseBezerreiroVersao_coleiraId_fkey" FOREIGN KEY ("coleiraId") REFERENCES pecuaria."ColeiraBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FaseBezerreiroVersao"
    ADD CONSTRAINT "FaseBezerreiroVersao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: FaseBezerreiroVersao FaseBezerreiroVersao_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FaseBezerreiroVersao"
    ADD CONSTRAINT "FaseBezerreiroVersao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FechamentoConsumo FechamentoConsumo_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FechamentoConsumo FechamentoConsumo_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FechamentoConsumo FechamentoConsumo_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FechamentoConsumo FechamentoConsumo_vigenciaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_vigenciaId_fkey" FOREIGN KEY ("vigenciaId") REFERENCES pecuaria."VigenciaDietaLote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FechamentoOperacaoLeite FechamentoOperacaoLeite_comercialId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoOperacaoLeite"
    ADD CONSTRAINT "FechamentoOperacaoLeite_comercialId_fkey" FOREIGN KEY ("comercialId") REFERENCES pecuaria."OperacaoComercialLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FechamentoOperacaoLeite FechamentoOperacaoLeite_operacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FechamentoOperacaoLeite"
    ADD CONSTRAINT "FechamentoOperacaoLeite_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinalidadeAnimal FinalidadeAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FinalidadeAnimal"
    ADD CONSTRAINT "FinalidadeAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FinalidadeAnimal FinalidadeAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FinalidadeAnimal"
    ADD CONSTRAINT "FinalidadeAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FormatoQualidadeLeite FormatoQualidadeLeite_tipoExameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FormatoQualidadeLeite"
    ADD CONSTRAINT "FormatoQualidadeLeite_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FornecimentoColostro FornecimentoColostro_criaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES pecuaria."CriaParto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FornecimentoColostro FornecimentoColostro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FornecimentoColostro FornecimentoColostro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_itemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES pecuaria."ItemFechamentoConsumo"(id) ON DELETE RESTRICT;


--
-- Name: FornecimentoNutricionalLeite FornecimentoNutricionalLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: GenitorExterno GenitorExterno_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GenitorExterno"
    ADD CONSTRAINT "GenitorExterno_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GenitorExterno GenitorExterno_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GenitorExterno"
    ADD CONSTRAINT "GenitorExterno_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GestacaoAnimal GestacaoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GestacaoAnimal GestacaoAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GestacaoAnimal GestacaoAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GestacaoAnimal GestacaoAnimal_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GrupoOfertaBezerreiro GrupoOfertaBezerreiro_coleiraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GrupoOfertaBezerreiro"
    ADD CONSTRAINT "GrupoOfertaBezerreiro_coleiraId_fkey" FOREIGN KEY ("coleiraId") REFERENCES pecuaria."ColeiraBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GrupoOfertaBezerreiro GrupoOfertaBezerreiro_ofertaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."GrupoOfertaBezerreiro"
    ADD CONSTRAINT "GrupoOfertaBezerreiro_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES pecuaria."OfertaBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HistoricoPrevisaoParto HistoricoPrevisaoParto_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."HistoricoPrevisaoParto"
    ADD CONSTRAINT "HistoricoPrevisaoParto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HistoricoPrevisaoParto HistoricoPrevisaoParto_gestacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."HistoricoPrevisaoParto"
    ADD CONSTRAINT "HistoricoPrevisaoParto_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ImpressaoVisita ImpressaoVisita_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ImpressaoVisita"
    ADD CONSTRAINT "ImpressaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ImpressaoVisita ImpressaoVisita_visitaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ImpressaoVisita"
    ADD CONSTRAINT "ImpressaoVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES pecuaria."VisitaVeterinaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InsumoPreparoColostro"
    ADD CONSTRAINT "InsumoPreparoColostro_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_partidaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InsumoPreparoColostro"
    ADD CONSTRAINT "InsumoPreparoColostro_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_preparoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InsumoPreparoColostro"
    ADD CONSTRAINT "InsumoPreparoColostro_preparoId_fkey" FOREIGN KEY ("preparoId") REFERENCES pecuaria."PreparoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InsumoPreparoColostro InsumoPreparoColostro_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InsumoPreparoColostro"
    ADD CONSTRAINT "InsumoPreparoColostro_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InterpretacaoReprodutiva InterpretacaoReprodutiva_exameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "InterpretacaoReprodutiva_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemConsumoDiario ItemConsumoDiario_diaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemConsumoDiario"
    ADD CONSTRAINT "ItemConsumoDiario_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES pecuaria."ConsumoDiario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemConsumoDiario ItemConsumoDiario_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemConsumoDiario"
    ADD CONSTRAINT "ItemConsumoDiario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemDieta ItemDieta_dietaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemDieta"
    ADD CONSTRAINT "ItemDieta_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES pecuaria."Dieta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemDieta ItemDieta_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemDieta"
    ADD CONSTRAINT "ItemDieta_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemFechamentoConsumo ItemFechamentoConsumo_fechamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoConsumo"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ItemFechamentoConsumo ItemFechamentoConsumo_grupoOfertaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_grupoOfertaId_fkey" FOREIGN KEY ("grupoOfertaId") REFERENCES pecuaria."GrupoOfertaBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemFechamentoConsumo ItemFechamentoConsumo_movimentoEstoqueId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemFechamentoConsumo ItemFechamentoConsumo_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LactacaoAnimal LactacaoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LactacaoAnimal LactacaoAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LactacaoAnimal LactacaoAnimal_partoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LactacaoAnimal LactacaoAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LaudoQualidadeLeite LaudoQualidadeLeite_amostraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_amostraId_fkey" FOREIGN KEY ("amostraId") REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_movimentacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES pecuaria."Movimentacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LocalizacaoAnimal LocalizacaoAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_estornadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_estornadoPorId_fkey" FOREIGN KEY ("estornadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_matrizId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_matrizId_fkey" FOREIGN KEY ("matrizId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_medicaoGeralId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_medicaoGeralId_fkey" FOREIGN KEY ("medicaoGeralId") REFERENCES pecuaria."MedicaoGeralLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_partoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoteColostro LoteColostro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."LoteColostro"
    ADD CONSTRAINT "LoteColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lote Lote_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lote Lote_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lote Lote_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_insercaoAplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_insercaoAplicacaoId_fkey" FOREIGN KEY ("insercaoAplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_operacaoServicoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_pesagemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES pecuaria."Pesagem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ManejoAnimal ManejoAnimal_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: MaterialGenetico MaterialGenetico_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MaterialGenetico MaterialGenetico_doadoraExternaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_doadoraExternaId_fkey" FOREIGN KEY ("doadoraExternaId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MaterialGenetico MaterialGenetico_doadoraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MaterialGenetico MaterialGenetico_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MaterialGenetico MaterialGenetico_touroExternoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MaterialGenetico MaterialGenetico_touroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_sessaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MedicaoGeralLeite"
    ADD CONSTRAINT "MedicaoGeralLeite_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES pecuaria."SessaoOrdenha"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MedicaoGeralLeite MedicaoGeralLeite_tanqueId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MedicaoGeralLeite"
    ADD CONSTRAINT "MedicaoGeralLeite_tanqueId_fkey" FOREIGN KEY ("tanqueId") REFERENCES pecuaria."TanqueLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MedicaoLeite MedicaoLeite_participanteId_diaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MedicaoLeite"
    ADD CONSTRAINT "MedicaoLeite_participanteId_diaId_fkey" FOREIGN KEY ("participanteId", "diaId") REFERENCES pecuaria."ParticipanteProducaoLeite"(id, "diaId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MedicaoLeite MedicaoLeite_sessaoId_diaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MedicaoLeite"
    ADD CONSTRAINT "MedicaoLeite_sessaoId_diaId_fkey" FOREIGN KEY ("sessaoId", "diaId") REFERENCES pecuaria."SessaoOrdenha"(id, "diaId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MesNutricao MesNutricao_configuracaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MesNutricao"
    ADD CONSTRAINT "MesNutricao_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES pecuaria."ConfiguracaoNutricao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MesNutricao MesNutricao_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MesNutricao"
    ADD CONSTRAINT "MesNutricao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MesNutricao MesNutricao_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MesNutricao"
    ADD CONSTRAINT "MesNutricao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MomentoProtocolo MomentoProtocolo_protocoloId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON DELETE CASCADE;


--
-- Name: MotivoBaixa MotivoBaixa_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MotivoBaixa"
    ADD CONSTRAINT "MotivoBaixa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentacaoAnimal MovimentacaoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentacaoAnimal MovimentacaoAnimal_localizacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES pecuaria."LocalizacaoAnimal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentacaoAnimal MovimentacaoAnimal_movimentacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES pecuaria."Movimentacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentacaoAnimal MovimentacaoAnimal_origemLoteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_origemLoteId_fkey" FOREIGN KEY ("origemLoteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentacaoAnimal MovimentacaoAnimal_origemPropriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_origemPropriedadeId_fkey" FOREIGN KEY ("origemPropriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Movimentacao Movimentacao_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimentacao Movimentacao_loteDestinoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_loteDestinoId_fkey" FOREIGN KEY ("loteDestinoId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Movimentacao Movimentacao_propriedadeDestinoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_propriedadeDestinoId_fkey" FOREIGN KEY ("propriedadeDestinoId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentoConsumoDiario MovimentoConsumoDiario_itemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoConsumoDiario"
    ADD CONSTRAINT "MovimentoConsumoDiario_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES pecuaria."ItemConsumoDiario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentoConsumoDiario MovimentoConsumoDiario_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoConsumoDiario"
    ADD CONSTRAINT "MovimentoConsumoDiario_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON DELETE RESTRICT;


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_fornecimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoNutricionalLeite"(id) ON DELETE RESTRICT;


--
-- Name: MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_alerta_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_alerta_fk" FOREIGN KEY ("alertaId") REFERENCES public."Alerta"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_aplicacao_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_aplicacao_fk" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_exame_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_exame_fk" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_programacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_programacaoId_fkey" FOREIGN KEY ("programacaoId") REFERENCES pecuaria."ProgramacaoSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_propriedade_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeProgramacaoSanitaria NecessidadeProgramacaoSanitaria_regra_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeProgramacaoSanitaria"
    ADD CONSTRAINT "NecessidadeProgramacaoSanitaria_regra_fk" FOREIGN KEY ("regraNecessidadeId") REFERENCES pecuaria."NecessidadeSanitaria"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_alertaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES public."Alerta"(id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_convergidaParaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_convergidaParaId_fkey" FOREIGN KEY ("convergidaParaId") REFERENCES pecuaria."NecessidadeReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_decisaoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_decisaoPorId_fkey" FOREIGN KEY ("decisaoPorId") REFERENCES public."Usuario"(id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_demandaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id);


--
-- Name: NecessidadeReprodutiva NecessidadeReprodutiva_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeReprodutiva"
    ADD CONSTRAINT "NecessidadeReprodutiva_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id);


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_alertaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES public."Alerta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_animal_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_animal_fk" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_aplicacao_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_aplicacao_fk" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_participacao_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_participacao_fk" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_propriedade_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: NecessidadeSanitaria NecessidadeSanitaria_regraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."NecessidadeSanitaria"
    ADD CONSTRAINT "NecessidadeSanitaria_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES pecuaria."RegraAlertaSanitario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcorrenciaSanitaria OcorrenciaSanitaria_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcorrenciaSanitaria OcorrenciaSanitaria_doencaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES pecuaria."Doenca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcorrenciaSanitaria OcorrenciaSanitaria_partoRetencaoPlacentaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_partoRetencaoPlacentaId_fkey" FOREIGN KEY ("partoRetencaoPlacentaId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcorrenciaSanitaria OcorrenciaSanitaria_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OfertaBezerreiro OfertaBezerreiro_configuracaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES pecuaria."ConfiguracaoBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OfertaBezerreiro OfertaBezerreiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: OfertaBezerreiro OfertaBezerreiro_estornadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_estornadoPorId_fkey" FOREIGN KEY ("estornadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: OfertaBezerreiro OfertaBezerreiro_ofertaProgramadaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_ofertaProgramadaId_fkey" FOREIGN KEY ("ofertaProgramadaId") REFERENCES pecuaria."OfertaProgramadaBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OfertaBezerreiro OfertaBezerreiro_perfilId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES pecuaria."PerfilBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OfertaBezerreiro OfertaBezerreiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaBezerreiro"
    ADD CONSTRAINT "OfertaBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OfertaProgramadaBezerreiro OfertaProgramadaBezerreiro_faseVersaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OfertaProgramadaBezerreiro"
    ADD CONSTRAINT "OfertaProgramadaBezerreiro_faseVersaoId_fkey" FOREIGN KEY ("faseVersaoId") REFERENCES pecuaria."FaseBezerreiroVersao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OperacaoComercialLeite OperacaoComercialLeite_parceiroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OperacaoComercialLeite"
    ADD CONSTRAINT "OperacaoComercialLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OperacaoComercialLeite OperacaoComercialLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OperacaoComercialLeite"
    ADD CONSTRAINT "OperacaoComercialLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemColostro OrigemColostro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemColostro"
    ADD CONSTRAINT "OrigemColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: OrigemColostro OrigemColostro_loteColostroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemColostro"
    ADD CONSTRAINT "OrigemColostro_loteColostroId_fkey" FOREIGN KEY ("loteColostroId") REFERENCES pecuaria."LoteColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemColostro OrigemColostro_preparoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemColostro"
    ADD CONSTRAINT "OrigemColostro_preparoId_fkey" FOREIGN KEY ("preparoId") REFERENCES pecuaria."PreparoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemColostro OrigemColostro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemColostro"
    ADD CONSTRAINT "OrigemColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemPreparoColostro"
    ADD CONSTRAINT "OrigemPreparoColostro_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_origemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemPreparoColostro"
    ADD CONSTRAINT "OrigemPreparoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES pecuaria."OrigemColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_preparoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemPreparoColostro"
    ADD CONSTRAINT "OrigemPreparoColostro_preparoId_fkey" FOREIGN KEY ("preparoId") REFERENCES pecuaria."PreparoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrigemPreparoColostro OrigemPreparoColostro_unidadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."OrigemPreparoColostro"
    ADD CONSTRAINT "OrigemPreparoColostro_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES pecuaria."UnidadeBancoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParcelaDestinoLeite ParcelaDestinoLeite_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParcelaDestinoLeite ParcelaDestinoLeite_destinoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES pecuaria."DestinoInternoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParcelaDestinoLeite ParcelaDestinoLeite_fornecimentoColostroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_fornecimentoColostroId_fkey" FOREIGN KEY ("fornecimentoColostroId") REFERENCES pecuaria."FornecimentoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT;


--
-- Name: ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_fornecimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoNutricionalLeite"(id) ON DELETE RESTRICT;


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoBezerreiro"
    ADD CONSTRAINT "ParticipacaoBezerreiro_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoBezerreiro"
    ADD CONSTRAINT "ParticipacaoBezerreiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ParticipacaoBezerreiro ParticipacaoBezerreiro_perfilId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoBezerreiro"
    ADD CONSTRAINT "ParticipacaoBezerreiro_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES pecuaria."PerfilBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoAnimal"
    ADD CONSTRAINT "ParticipacaoConsumoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_fechamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoAnimal"
    ADD CONSTRAINT "ParticipacaoConsumoAnimal_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoConsumo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoConsumoDiario ParticipacaoConsumoDiario_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoDiario"
    ADD CONSTRAINT "ParticipacaoConsumoDiario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoConsumoDiario ParticipacaoConsumoDiario_diaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoDiario"
    ADD CONSTRAINT "ParticipacaoConsumoDiario_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES pecuaria."ConsumoDiario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoExposicao ParticipacaoExposicao_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoExposicao"
    ADD CONSTRAINT "ParticipacaoExposicao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoExposicao ParticipacaoExposicao_exposicaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoExposicao"
    ADD CONSTRAINT "ParticipacaoExposicao_exposicaoId_fkey" FOREIGN KEY ("exposicaoId") REFERENCES pecuaria."ExposicaoTouro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipacaoProtocolo ParticipacaoProtocolo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ParticipacaoProtocolo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_diaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES pecuaria."DiaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_finalidadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_finalidadeId_fkey" FOREIGN KEY ("finalidadeId") REFERENCES pecuaria."FinalidadeAnimal"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_lactacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_lactacaoId_fkey" FOREIGN KEY ("lactacaoId") REFERENCES pecuaria."LactacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteProducaoLeite ParticipanteProducaoLeite_localizacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES pecuaria."LocalizacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteVisita ParticipanteVisita_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteVisita ParticipanteVisita_atividadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES pecuaria."AtividadeVisita"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParticipanteVisita ParticipanteVisita_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartoAnimal PartoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartoAnimal PartoAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartoAnimal PartoAnimal_gestacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartoAnimal PartoAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PerfilBezerreiro PerfilBezerreiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilBezerreiro"
    ADD CONSTRAINT "PerfilBezerreiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: PerfilBezerreiro PerfilBezerreiro_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilBezerreiro"
    ADD CONSTRAINT "PerfilBezerreiro_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PerfilBezerreiro PerfilBezerreiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilBezerreiro"
    ADD CONSTRAINT "PerfilBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PerfilNutricionalProduto PerfilNutricionalProduto_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilNutricionalProduto"
    ADD CONSTRAINT "PerfilNutricionalProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PerfilSanitarioProduto PerfilSanitarioProduto_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilSanitarioProduto"
    ADD CONSTRAINT "PerfilSanitarioProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PerfilSanitarioProduto PerfilSanitarioProduto_tipoAplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PerfilSanitarioProduto"
    ADD CONSTRAINT "PerfilSanitarioProduto_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PeriodoFaseBezerreiro PeriodoFaseBezerreiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoFaseBezerreiro"
    ADD CONSTRAINT "PeriodoFaseBezerreiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: PeriodoFaseBezerreiro PeriodoFaseBezerreiro_faseVersaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoFaseBezerreiro"
    ADD CONSTRAINT "PeriodoFaseBezerreiro_faseVersaoId_fkey" FOREIGN KEY ("faseVersaoId") REFERENCES pecuaria."FaseBezerreiroVersao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PeriodoFaseBezerreiro PeriodoFaseBezerreiro_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoFaseBezerreiro"
    ADD CONSTRAINT "PeriodoFaseBezerreiro_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoBezerreiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Pesagem Pesagem_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Pesagem Pesagem_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Pesagem Pesagem_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Pesagem Pesagem_requisicaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES pecuaria."RequisicaoPecuaria"(chave) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutivo_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutivo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: PoliticaAtencaoReprodutiva PoliticaAtencaoReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAtencaoReprodutiva"
    ADD CONSTRAINT "PoliticaAtencaoReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id);


--
-- Name: PoliticaAtencaoReprodutiva PoliticaAtencaoReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaAtencaoReprodutiva"
    ADD CONSTRAINT "PoliticaAtencaoReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id);


--
-- Name: PoliticaElegibilidadeReprodutiva PoliticaElegibilidadeReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaElegibilidadeReprodutiva"
    ADD CONSTRAINT "PoliticaElegibilidadeReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PoliticaElegibilidadeReprodutiva PoliticaElegibilidadeReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PoliticaElegibilidadeReprodutiva"
    ADD CONSTRAINT "PoliticaElegibilidadeReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PosicaoOrdenha PosicaoOrdenha_configuracaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PosicaoOrdenha"
    ADD CONSTRAINT "PosicaoOrdenha_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES pecuaria."ConfiguracaoOrdenha"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PreparoColostro PreparoColostro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PreparoColostro"
    ADD CONSTRAINT "PreparoColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: PreparoColostro PreparoColostro_estornadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PreparoColostro"
    ADD CONSTRAINT "PreparoColostro_estornadoPorId_fkey" FOREIGN KEY ("estornadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: PreparoColostro PreparoColostro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."PreparoColostro"
    ADD CONSTRAINT "PreparoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramacaoProtocolo ProgramacaoProtocolo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "ProgramacaoProtocolo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramacaoRetiradaLeite ProgramacaoRetiradaLeite_produtoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoRetiradaLeite"
    ADD CONSTRAINT "ProgramacaoRetiradaLeite_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramacaoRetiradaLeite ProgramacaoRetiradaLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoRetiradaLeite"
    ADD CONSTRAINT "ProgramacaoRetiradaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramacaoSanitaria ProgramacaoSanitaria_autor_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoSanitaria"
    ADD CONSTRAINT "ProgramacaoSanitaria_autor_fk" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ProgramacaoSanitaria ProgramacaoSanitaria_produto_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoSanitaria"
    ADD CONSTRAINT "ProgramacaoSanitaria_produto_fk" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON DELETE RESTRICT;


--
-- Name: ProgramacaoSanitaria ProgramacaoSanitaria_propriedade_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoSanitaria"
    ADD CONSTRAINT "ProgramacaoSanitaria_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: ProgramacaoSanitaria ProgramacaoSanitaria_regra_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoSanitaria"
    ADD CONSTRAINT "ProgramacaoSanitaria_regra_fk" FOREIGN KEY ("regraEquivalenteId") REFERENCES pecuaria."RegraAlertaSanitario"(id) ON DELETE RESTRICT;


--
-- Name: ProgramacaoSanitaria ProgramacaoSanitaria_tipo_exame_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoSanitaria"
    ADD CONSTRAINT "ProgramacaoSanitaria_tipo_exame_fk" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON DELETE RESTRICT;


--
-- Name: Protocolo Protocolo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Protocolo"
    ADD CONSTRAINT "Protocolo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Raca Raca_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."Raca"
    ADD CONSTRAINT "Raca_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_fechamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON DELETE RESTRICT;


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_fornecimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoNutricionalLeite"(id) ON DELETE RESTRICT;


--
-- Name: ReferenciaGerencialLeite ReferenciaGerencialLeite_parceiroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON DELETE RESTRICT;


--
-- Name: RegistroGenealogicoAnimal RegistroGenealogicoAnimal_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegistroGenealogicoAnimal"
    ADD CONSTRAINT "RegistroGenealogicoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT;


--
-- Name: RegraAlertaSanitario RegraAlertaSanitario_autor_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraAlertaSanitario"
    ADD CONSTRAINT "RegraAlertaSanitario_autor_fk" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: RegraAlertaSanitario RegraAlertaSanitario_produto_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraAlertaSanitario"
    ADD CONSTRAINT "RegraAlertaSanitario_produto_fk" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON DELETE RESTRICT;


--
-- Name: RegraAlertaSanitario RegraAlertaSanitario_protocolo_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraAlertaSanitario"
    ADD CONSTRAINT "RegraAlertaSanitario_protocolo_fk" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON DELETE RESTRICT;


--
-- Name: RegraAlertaSanitario RegraAlertaSanitario_tipo_aplicacao_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraAlertaSanitario"
    ADD CONSTRAINT "RegraAlertaSanitario_tipo_aplicacao_fk" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT;


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimentoReprodutivo_atualizadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraImpactoProcedimentoReprodutivo"
    ADD CONSTRAINT "RegraImpactoProcedimentoReprodutivo_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES public."Usuario"(id);


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimentoReprodutivo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraImpactoProcedimentoReprodutivo"
    ADD CONSTRAINT "RegraImpactoProcedimentoReprodutivo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id);


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimentoReprodutivo_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraImpactoProcedimentoReprodutivo"
    ADD CONSTRAINT "RegraImpactoProcedimentoReprodutivo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id);


--
-- Name: RegraImpactoProcedimentoReprodutivo RegraImpactoProcedimentoReprodutivo_tipoAplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraImpactoProcedimentoReprodutivo"
    ADD CONSTRAINT "RegraImpactoProcedimentoReprodutivo_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id);


--
-- Name: RegraSanitariaReprodutiva RegraSanitariaReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegraSanitariaReprodutiva RegraSanitariaReprodutiva_doencaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES pecuaria."Doenca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegraSanitariaReprodutiva RegraSanitariaReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RequisicaoPecuaria RequisicaoPecuaria_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RequisicaoPecuaria"
    ADD CONSTRAINT "RequisicaoPecuaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RequisicaoPecuaria RequisicaoPecuaria_usuarioId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RequisicaoPecuaria"
    ADD CONSTRAINT "RequisicaoPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RestricaoReprodutiva RestricaoReprodutiva_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RestricaoReprodutiva RestricaoReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RestricaoReprodutiva RestricaoReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ResultadoExame ResultadoExame_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ResultadoExame"
    ADD CONSTRAINT "ResultadoExame_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ResultadoExame ResultadoExame_exameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ResultadoExame"
    ADD CONSTRAINT "ResultadoExame_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ResultadoQualidadeLeite ResultadoQualidadeLeite_amostraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ResultadoQualidadeLeite"
    ADD CONSTRAINT "ResultadoQualidadeLeite_amostraId_fkey" FOREIGN KEY ("amostraId") REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_movimentoEstornoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetiradaInternaLeite RetiradaInternaLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaInternaLeite"
    ADD CONSTRAINT "RetiradaInternaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetiradaOperacaoLeite RetiradaOperacaoLeite_comercialId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaOperacaoLeite"
    ADD CONSTRAINT "RetiradaOperacaoLeite_comercialId_fkey" FOREIGN KEY ("comercialId") REFERENCES pecuaria."OperacaoComercialLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RetiradaOperacaoLeite RetiradaOperacaoLeite_movimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RetiradaOperacaoLeite"
    ADD CONSTRAINT "RetiradaOperacaoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_demandaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_politicaAnteriorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_politicaAnteriorId_fkey" FOREIGN KEY ("politicaAnteriorId") REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_politicaNovaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_politicaNovaId_fkey" FOREIGN KEY ("politicaNovaId") REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: RevisaoPrazoAcompanhamento RevisaoPrazoAcompanhamento_usuarioId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoPrazoAcompanhamento"
    ADD CONSTRAINT "RevisaoPrazoAcompanhamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: RevisaoRegraAlertaSanitario RevisaoRegraAlertaSanitario_autor_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoRegraAlertaSanitario"
    ADD CONSTRAINT "RevisaoRegraAlertaSanitario_autor_fk" FOREIGN KEY ("autorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: RevisaoRegraAlertaSanitario RevisaoRegraAlertaSanitario_regraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."RevisaoRegraAlertaSanitario"
    ADD CONSTRAINT "RevisaoRegraAlertaSanitario_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES pecuaria."RegraAlertaSanitario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramacaoProtocolo RodadaProtocoloSanitario_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "RodadaProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProgramacaoProtocolo RodadaProtocoloSanitario_protocoloId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "RodadaProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SegmentoConsumoAnimal SegmentoConsumoAnimal_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SegmentoConsumoAnimal"
    ADD CONSTRAINT "SegmentoConsumoAnimal_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoConsumoAnimal"(id) ON DELETE RESTRICT;


--
-- Name: SelecaoVisita SelecaoVisita_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SelecaoVisita"
    ADD CONSTRAINT "SelecaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SelecaoVisita SelecaoVisita_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SelecaoVisita"
    ADD CONSTRAINT "SelecaoVisita_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SessaoOrdenha SessaoOrdenha_diaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SessaoOrdenha"
    ADD CONSTRAINT "SessaoOrdenha_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES pecuaria."DiaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SituacaoInicialReprodutiva SituacaoInicialReprodutiva_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SituacaoInicialReprodutiva SituacaoInicialReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SituacaoInicialReprodutiva SituacaoInicialReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SnapshotRelatorioReprodutivo"
    ADD CONSTRAINT "SnapshotRelatorioReprodutivo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."SnapshotRelatorioReprodutivo"
    ADD CONSTRAINT "SnapshotRelatorioReprodutivo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TanqueLeite TanqueLeite_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TanqueLeite"
    ADD CONSTRAINT "TanqueLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TarefaProtocolo TarefaSanitaria_etapaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaSanitaria_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES pecuaria."EtapaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TarefaProtocolo TarefaSanitaria_execucaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaSanitaria_execucaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TemplateAplicacoesTablet TemplateAplicacoesTablet_autorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TemplateAplicacoesTablet"
    ADD CONSTRAINT "TemplateAplicacoesTablet_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES public."Usuario"(id);


--
-- Name: TemplateAplicacoesTablet TemplateAplicacoesTablet_doencaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TemplateAplicacoesTablet"
    ADD CONSTRAINT "TemplateAplicacoesTablet_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES pecuaria."Doenca"(id);


--
-- Name: TemplateAplicacoesTablet TemplateAplicacoesTablet_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TemplateAplicacoesTablet"
    ADD CONSTRAINT "TemplateAplicacoesTablet_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id);


--
-- Name: TentativaReprodutiva TentativaReprodutiva_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_materialId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES pecuaria."MaterialGenetico"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_movimentoEstoqueId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_operacaoServicoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_partidaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_touroExternoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TentativaReprodutiva TentativaReprodutiva_touroId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TipoExame TipoExame_versaoAnteriorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."TipoExame"
    ADD CONSTRAINT "TipoExame_versaoAnteriorId_fkey" FOREIGN KEY ("versaoAnteriorId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."UnidadeBancoColostro"
    ADD CONSTRAINT "UnidadeBancoColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_destinacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."UnidadeBancoColostro"
    ADD CONSTRAINT "UnidadeBancoColostro_destinacaoId_fkey" FOREIGN KEY ("destinacaoId") REFERENCES pecuaria."DestinacaoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_origemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."UnidadeBancoColostro"
    ADD CONSTRAINT "UnidadeBancoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES pecuaria."OrigemColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UnidadeBancoColostro UnidadeBancoColostro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."UnidadeBancoColostro"
    ADD CONSTRAINT "UnidadeBancoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VersaoComercialVendaLeite VersaoComercialVendaLeite_operacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VersaoComercialVendaLeite"
    ADD CONSTRAINT "VersaoComercialVendaLeite_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VersaoComercialVendaLeite VersaoComercialVendaLeite_retiradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VersaoComercialVendaLeite"
    ADD CONSTRAINT "VersaoComercialVendaLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VersaoSelecaoVisita VersaoSelecaoVisita_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VersaoSelecaoVisita"
    ADD CONSTRAINT "VersaoSelecaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VersaoSelecaoVisita VersaoSelecaoVisita_selecaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VersaoSelecaoVisita"
    ADD CONSTRAINT "VersaoSelecaoVisita_selecaoId_fkey" FOREIGN KEY ("selecaoId") REFERENCES pecuaria."SelecaoVisita"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VigenciaDietaLote VigenciaDietaLote_dietaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES pecuaria."Dieta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VigenciaDietaLote VigenciaDietaLote_loteId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoAtendimentoAlerta VinculoAtendimentoAlerta_aplicacao_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoAtendimentoAlerta"
    ADD CONSTRAINT "VinculoAtendimentoAlerta_aplicacao_fk" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- Name: VinculoAtendimentoAlerta VinculoAtendimentoAlerta_autor_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoAtendimentoAlerta"
    ADD CONSTRAINT "VinculoAtendimentoAlerta_autor_fk" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoAtendimentoAlerta VinculoAtendimentoAlerta_exame_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoAtendimentoAlerta"
    ADD CONSTRAINT "VinculoAtendimentoAlerta_exame_fk" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- Name: VinculoAtendimentoAlerta VinculoAtendimentoAlerta_programa_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoAtendimentoAlerta"
    ADD CONSTRAINT "VinculoAtendimentoAlerta_programa_fk" FOREIGN KEY ("necessidadeProgramaId") REFERENCES pecuaria."NecessidadeProgramacaoSanitaria"(id) ON DELETE RESTRICT;


--
-- Name: VinculoAtendimentoAlerta VinculoAtendimentoAlerta_regra_fk; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoAtendimentoAlerta"
    ADD CONSTRAINT "VinculoAtendimentoAlerta_regra_fk" FOREIGN KEY ("necessidadeRegraId") REFERENCES pecuaria."NecessidadeSanitaria"(id) ON DELETE RESTRICT;


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusaoAcompanhamento_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoConclusaoAcompanhamento"
    ADD CONSTRAINT "VinculoConclusaoAcompanhamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusaoAcompanhamento_demandaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoConclusaoAcompanhamento"
    ADD CONSTRAINT "VinculoConclusaoAcompanhamento_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusaoAcompanhamento_interpretacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoConclusaoAcompanhamento"
    ADD CONSTRAINT "VinculoConclusaoAcompanhamento_interpretacaoId_fkey" FOREIGN KEY ("interpretacaoId") REFERENCES pecuaria."InterpretacaoReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusaoAcompanhamento_invalidadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoConclusaoAcompanhamento"
    ADD CONSTRAINT "VinculoConclusaoAcompanhamento_invalidadoPorId_fkey" FOREIGN KEY ("invalidadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoConclusaoAcompanhamento VinculoConclusaoAcompanhamento_resultadoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoConclusaoAcompanhamento"
    ADD CONSTRAINT "VinculoConclusaoAcompanhamento_resultadoId_fkey" FOREIGN KEY ("resultadoId") REFERENCES pecuaria."ResultadoExame"(id) ON DELETE RESTRICT;


--
-- Name: VinculoFornecimentoColostragem VinculoFornecimentoColostragem_acompanhamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoFornecimentoColostragem"
    ADD CONSTRAINT "VinculoFornecimentoColostragem_acompanhamentoId_fkey" FOREIGN KEY ("acompanhamentoId") REFERENCES pecuaria."AcompanhamentoColostragem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoFornecimentoColostragem VinculoFornecimentoColostragem_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoFornecimentoColostragem"
    ADD CONSTRAINT "VinculoFornecimentoColostragem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoFornecimentoColostragem VinculoFornecimentoColostragem_fornecimentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoFornecimentoColostragem"
    ADD CONSTRAINT "VinculoFornecimentoColostragem_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_entradaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoMedicaoEntradaLeite"
    ADD CONSTRAINT "VinculoMedicaoEntradaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_medicaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoMedicaoEntradaLeite"
    ADD CONSTRAINT "VinculoMedicaoEntradaLeite_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES pecuaria."MedicaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPesagemParto VinculoPesagemParto_criaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES pecuaria."CriaParto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPesagemParto VinculoPesagemParto_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPesagemParto VinculoPesagemParto_partoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPesagemParto VinculoPesagemParto_pesagemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES pecuaria."Pesagem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPesagemParto VinculoPesagemParto_revogadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemSecagem"
    ADD CONSTRAINT "VinculoPesagemSecagem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_lactacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemSecagem"
    ADD CONSTRAINT "VinculoPesagemSecagem_lactacaoId_fkey" FOREIGN KEY ("lactacaoId") REFERENCES pecuaria."LactacaoAnimal"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_pesagemId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemSecagem"
    ADD CONSTRAINT "VinculoPesagemSecagem_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES pecuaria."Pesagem"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemSecagem"
    ADD CONSTRAINT "VinculoPesagemSecagem_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPesagemSecagem VinculoPesagemSecagem_revogadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPesagemSecagem"
    ADD CONSTRAINT "VinculoPesagemSecagem_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_animalId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_partoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_politicaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES pecuaria."PoliticaElegibilidadeReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPoliticaCiclo VinculoPoliticaCiclo_situacaoInicialId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_situacaoInicialId_fkey" FOREIGN KEY ("situacaoInicialId") REFERENCES pecuaria."SituacaoInicialReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoPreparoTentativa VinculoPreparoTentativa_aplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPreparoTentativa VinculoPreparoTentativa_exameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPreparoTentativa VinculoPreparoTentativa_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: VinculoPreparoTentativa VinculoPreparoTentativa_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_amostraId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoQualidadeFechamentoLeite"
    ADD CONSTRAINT "VinculoQualidadeFechamentoLeite_amostraId_fkey" FOREIGN KEY ("amostraId") REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON DELETE RESTRICT;


--
-- Name: VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_fechamentoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoQualidadeFechamentoLeite"
    ADD CONSTRAINT "VinculoQualidadeFechamentoLeite_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON DELETE RESTRICT;


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_aplicacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_exameId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_manejoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_manejoId_fkey" FOREIGN KEY ("manejoId") REFERENCES pecuaria."ManejoAnimal"(id) ON DELETE RESTRICT;


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_registradoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_tarefaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoTarefaProtocolo VinculoTarefaProtocolo_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VinculoTentativaParticipacao VinculoTentativaParticipacao_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTentativaParticipacao"
    ADD CONSTRAINT "VinculoTentativaParticipacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoTentativaParticipacao VinculoTentativaParticipacao_participacaoId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTentativaParticipacao"
    ADD CONSTRAINT "VinculoTentativaParticipacao_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- Name: VinculoTentativaParticipacao VinculoTentativaParticipacao_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTentativaParticipacao"
    ADD CONSTRAINT "VinculoTentativaParticipacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: VinculoTentativaParticipacao VinculoTentativaParticipacao_revogadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTentativaParticipacao"
    ADD CONSTRAINT "VinculoTentativaParticipacao_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: VinculoTentativaParticipacao VinculoTentativaParticipacao_tentativaId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VinculoTentativaParticipacao"
    ADD CONSTRAINT "VinculoTentativaParticipacao_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- Name: VisitaVeterinaria VisitaVeterinaria_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VisitaVeterinaria"
    ADD CONSTRAINT "VisitaVeterinaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VisitaVeterinaria VisitaVeterinaria_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: pecuaria; Owner: -
--

ALTER TABLE ONLY pecuaria."VisitaVeterinaria"
    ADD CONSTRAINT "VisitaVeterinaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Alerta Alerta_propriedade_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "Alerta_propriedade_fk" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: AlocacaoPartidaEstoque AlocacaoPartidaEstoque_movimentoEstoqueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AlocacaoPartidaEstoque"
    ADD CONSTRAINT "AlocacaoPartidaEstoque_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AlocacaoPartidaEstoque AlocacaoPartidaEstoque_partidaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AlocacaoPartidaEstoque"
    ADD CONSTRAINT "AlocacaoPartidaEstoque_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AssinaturaRadarAssistente AssinaturaRadarAssistente_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssinaturaRadarAssistente"
    ADD CONSTRAINT "AssinaturaRadarAssistente_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE CASCADE;


--
-- Name: AssinaturaRadarAssistente AssinaturaRadarAssistente_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssinaturaRadarAssistente"
    ADD CONSTRAINT "AssinaturaRadarAssistente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON DELETE CASCADE;


--
-- Name: AuditoriaFinanceira AuditoriaFinanceira_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditoriaFinanceira"
    ADD CONSTRAINT "AuditoriaFinanceira_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BaseValorizacaoEstoque BaseValorizacaoEstoque_baseOrigemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_baseOrigemId_fkey" FOREIGN KEY ("baseOrigemId") REFERENCES public."BaseValorizacaoEstoque"(id) ON DELETE RESTRICT;


--
-- Name: BaseValorizacaoEstoque BaseValorizacaoEstoque_origemMovimentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_origemMovimentoId_fkey" FOREIGN KEY ("origemMovimentoId") REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT;


--
-- Name: BaseValorizacaoEstoque BaseValorizacaoEstoque_partidaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON DELETE RESTRICT;


--
-- Name: BaseValorizacaoEstoque BaseValorizacaoEstoque_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON DELETE RESTRICT;


--
-- Name: BaseValorizacaoEstoque BaseValorizacaoEstoque_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: Categoria Categoria_grupoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES public."GrupoCategoria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CompromissoFinanceiro CompromissoFinanceiro_operacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompromissoFinanceiro"
    ADD CONSTRAINT "CompromissoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CompromissoFinanceiro CompromissoFinanceiro_parceiroId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompromissoFinanceiro"
    ADD CONSTRAINT "CompromissoFinanceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContaFinanceira ContaFinanceira_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContaFinanceira"
    ADD CONSTRAINT "ContaFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConversaAssistente ConversaAssistente_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversaAssistente"
    ADD CONSTRAINT "ConversaAssistente_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: ConversaAssistente ConversaAssistente_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversaAssistente"
    ADD CONSTRAINT "ConversaAssistente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON DELETE CASCADE;


--
-- Name: ConversaWhatsapp ConversaWhatsapp_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversaWhatsapp"
    ADD CONSTRAINT "ConversaWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."UsuarioWhatsapp"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DocumentoFinanceiro DocumentoFinanceiro_compromissoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES public."CompromissoFinanceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DocumentoFinanceiro DocumentoFinanceiro_operacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DocumentoFinanceiro DocumentoFinanceiro_rascunhoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES public."RascunhoOperacao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentoFinanceiro DocumentoFinanceiro_transacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EventoAlerta EventoAlerta_alertaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoAlerta"
    ADD CONSTRAINT "EventoAlerta_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES public."Alerta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventoAlerta EventoAlerta_autor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoAlerta"
    ADD CONSTRAINT "EventoAlerta_autor_fk" FOREIGN KEY ("autorUsuarioId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: EventoMetaAssistente EventoMetaAssistente_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoMetaAssistente"
    ADD CONSTRAINT "EventoMetaAssistente_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- Name: EventoMetaAssistente EventoMetaAssistente_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventoMetaAssistente"
    ADD CONSTRAINT "EventoMetaAssistente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- Name: ItemOperacao ItemOperacao_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemOperacao ItemOperacao_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ItemOperacao ItemOperacao_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ItemOperacao ItemOperacao_operacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ItemOperacao ItemOperacao_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Liquidacao Liquidacao_compromissoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Liquidacao"
    ADD CONSTRAINT "Liquidacao_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES public."CompromissoFinanceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Liquidacao Liquidacao_transacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Liquidacao"
    ADD CONSTRAINT "Liquidacao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MensagemWhatsapp MensagemWhatsapp_conversaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MensagemWhatsapp"
    ADD CONSTRAINT "MensagemWhatsapp_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES public."ConversaWhatsapp"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MovimentoConta MovimentoConta_contaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoConta"
    ADD CONSTRAINT "MovimentoConta_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES public."ContaFinanceira"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentoConta MovimentoConta_transacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoConta"
    ADD CONSTRAINT "MovimentoConta_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MovimentoEstoque MovimentoEstoque_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentoEstoque MovimentoEstoque_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentoEstoque MovimentoEstoque_itemOperacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey" FOREIGN KEY ("itemOperacaoId") REFERENCES public."ItemOperacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentoEstoque MovimentoEstoque_operacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentoEstoque MovimentoEstoque_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimentoEstoque MovimentoEstoque_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimentoEstoque MovimentoEstoque_reversaoDeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Operacao Operacao_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Operacao Operacao_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Operacao Operacao_corrigeOperacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_corrigeOperacaoId_fkey" FOREIGN KEY ("corrigeOperacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Operacao Operacao_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Operacao Operacao_parceiroId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Operacao Operacao_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParceiroPapel ParceiroPapel_parceiroId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ParceiroPapel"
    ADD CONSTRAINT "ParceiroPapel_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ParcelaValorizacaoEstoque ParcelaValorizacaoEstoque_baseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ParcelaValorizacaoEstoque"
    ADD CONSTRAINT "ParcelaValorizacaoEstoque_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES public."BaseValorizacaoEstoque"(id) ON DELETE RESTRICT;


--
-- Name: ParcelaValorizacaoEstoque ParcelaValorizacaoEstoque_movimentoEstoqueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ParcelaValorizacaoEstoque"
    ADD CONSTRAINT "ParcelaValorizacaoEstoque_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT;


--
-- Name: PartidaProduto PartidaProduto_lotePrincipalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartidaProduto"
    ADD CONSTRAINT "PartidaProduto_lotePrincipalId_fkey" FOREIGN KEY ("lotePrincipalId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartidaProduto PartidaProduto_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartidaProduto"
    ADD CONSTRAINT "PartidaProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PeriodoFinanceiro PeriodoFinanceiro_fechadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PeriodoFinanceiro"
    ADD CONSTRAINT "PeriodoFinanceiro_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PeriodoFinanceiro PeriodoFinanceiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PeriodoFinanceiro"
    ADD CONSTRAINT "PeriodoFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProdutoCatalogoPrincipioAtivo ProdutoCatalogoPrincipioAtivo_principioAtivoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCatalogoPrincipioAtivo"
    ADD CONSTRAINT "ProdutoCatalogoPrincipioAtivo_principioAtivoId_fkey" FOREIGN KEY ("principioAtivoId") REFERENCES public."PrincipioAtivo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProdutoCatalogoPrincipioAtivo ProdutoCatalogoPrincipioAtivo_produtoCatalogoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCatalogoPrincipioAtivo"
    ADD CONSTRAINT "ProdutoCatalogoPrincipioAtivo_produtoCatalogoId_fkey" FOREIGN KEY ("produtoCatalogoId") REFERENCES public."ProdutoCatalogo"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProdutoCatalogo ProdutoCatalogo_classificacaoTecnicaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCatalogo"
    ADD CONSTRAINT "ProdutoCatalogo_classificacaoTecnicaId_fkey" FOREIGN KEY ("classificacaoTecnicaId") REFERENCES public."ClassificacaoTecnicaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProdutoCatalogo ProdutoCatalogo_fabricanteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCatalogo"
    ADD CONSTRAINT "ProdutoCatalogo_fabricanteId_fkey" FOREIGN KEY ("fabricanteId") REFERENCES public."FabricanteProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProdutoCentroCusto ProdutoCentroCusto_centroCustoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCentroCusto"
    ADD CONSTRAINT "ProdutoCentroCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProdutoCentroCusto ProdutoCentroCusto_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoCentroCusto"
    ADD CONSTRAINT "ProdutoCentroCusto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProdutoFornecedor ProdutoFornecedor_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoFornecedor"
    ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProdutoFornecedor ProdutoFornecedor_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProdutoFornecedor"
    ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Produto Produto_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Produto Produto_classificacaoTecnicaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_classificacaoTecnicaId_fkey" FOREIGN KEY ("classificacaoTecnicaId") REFERENCES public."ClassificacaoTecnicaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Produto Produto_fabricanteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_fabricanteId_fkey" FOREIGN KEY ("fabricanteId") REFERENCES public."FabricanteProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Produto Produto_produtoCatalogoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_produtoCatalogoId_fkey" FOREIGN KEY ("produtoCatalogoId") REFERENCES public."ProdutoCatalogo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RascunhoOperacao RascunhoOperacao_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RascunhoOperacao"
    ADD CONSTRAINT "RascunhoOperacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RascunhoOperacao RascunhoOperacao_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RascunhoOperacao"
    ADD CONSTRAINT "RascunhoOperacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RascunhoRelatorioFinanceiro RascunhoRelatorioFinanceiro_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RascunhoRelatorioFinanceiro"
    ADD CONSTRAINT "RascunhoRelatorioFinanceiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RascunhoRelatorioFinanceiro RascunhoRelatorioFinanceiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RascunhoRelatorioFinanceiro"
    ADD CONSTRAINT "RascunhoRelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RelatorioFinanceiro RelatorioFinanceiro_autorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RelatorioFinanceiro"
    ADD CONSTRAINT "RelatorioFinanceiro_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RelatorioFinanceiro RelatorioFinanceiro_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RelatorioFinanceiro"
    ADD CONSTRAINT "RelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Sessao Sessao_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sessao"
    ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SnapshotRadarAssistente SnapshotRadarAssistente_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SnapshotRadarAssistente"
    ADD CONSTRAINT "SnapshotRadarAssistente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON DELETE CASCADE;


--
-- Name: TokenAcesso TokenAcesso_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TokenAcesso"
    ADD CONSTRAINT "TokenAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TransacaoFinanceira TransacaoFinanceira_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TransacaoFinanceira TransacaoFinanceira_operacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TransacaoFinanceira TransacaoFinanceira_parceiroId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TransacaoFinanceira TransacaoFinanceira_propriedadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TransacaoFinanceira TransacaoFinanceira_reversaoDeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


SET search_path TO public;
COMMIT;
