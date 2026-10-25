-- Base unificada do estado final dos domínios ativos (instalação vazia).
-- Fonte: 75 migrations até 20261024200000_parcelas_ordenha_colostro,
-- conferidas por checksum com o catálogo PostgreSQL local em 2026-10-24.
-- Inclui funções, triggers, views, índices parciais e constraints manuais.
-- Não converte bases anteriores. A substituição local exige backup e manutenção explícita.
-- Dados operacionais e acessos demonstrativos pertencem à seed, fora desta migration.

--
-- PostgreSQL database dump
--


BEGIN;

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
-- SCHEMA: -.pecuaria
--

CREATE SCHEMA IF NOT EXISTS pecuaria;


--
-- SCHEMA: -.public
--

CREATE SCHEMA IF NOT EXISTS public;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- COMMENT: -.SCHEMA public
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TYPE: pecuaria.AptidaoAnimal
--

CREATE TYPE pecuaria."AptidaoAnimal" AS ENUM (
    'LEITE',
    'CORTE',
    'REPRODUCAO'
);


--
-- TYPE: pecuaria.ClasseMotivoBaixa
--

CREATE TYPE pecuaria."ClasseMotivoBaixa" AS ENUM (
    'DESCARTE_VOLUNTARIO',
    'DESCARTE_INVOLUNTARIO',
    'MORTE'
);


--
-- TYPE: pecuaria.CriterioPartos
--

CREATE TYPE pecuaria."CriterioPartos" AS ENUM (
    'QUALQUER',
    'SEM',
    'COM'
);


--
-- TYPE: pecuaria.FinalidadeAplicacao
--

CREATE TYPE pecuaria."FinalidadeAplicacao" AS ENUM (
    'TRATAMENTO',
    'VACINA',
    'VERMIFUGO'
);


--
-- TYPE: pecuaria.FinalidadeProtocolo
--

CREATE TYPE pecuaria."FinalidadeProtocolo" AS ENUM (
    'SANITARIO',
    'PRE_SINCRONIZACAO',
    'IATF',
    'TETF'
);


--
-- TYPE: pecuaria.OrigemAnimal
--

CREATE TYPE pecuaria."OrigemAnimal" AS ENUM (
    'NASCIDO',
    'COMPRADO'
);


--
-- TYPE: pecuaria.OrigemCalendarioProtocolo
--

CREATE TYPE pecuaria."OrigemCalendarioProtocolo" AS ENUM (
    'REFERENCIA_PROGRAMADA',
    'INICIO_EFETIVO_LEGADO'
);


--
-- TYPE: pecuaria.OrigemComposicao
--

CREATE TYPE pecuaria."OrigemComposicao" AS ENUM (
    'INFORMADA',
    'CALCULADA'
);


--
-- TYPE: pecuaria.OrigemInsumoSanitario
--

CREATE TYPE pecuaria."OrigemInsumoSanitario" AS ENUM (
    'BAIXA_ESTOQUE',
    'COMPRA_CONSUMO_DIRETO',
    'INCLUSO_SERVICO',
    'SEM_ORIGEM_JUSTIFICADA',
    'HISTORICO_IMPORTADO'
);


--
-- TYPE: pecuaria.OrigemPesagem
--

CREATE TYPE pecuaria."OrigemPesagem" AS ENUM (
    'MANUAL',
    'BALANCA'
);


--
-- TYPE: pecuaria.PapelReprodutivo
--

CREATE TYPE pecuaria."PapelReprodutivo" AS ENUM (
    'NENHUM',
    'RECEPTORA',
    'DOADORA'
);


--
-- TYPE: pecuaria.PrecisaoCalendarioProtocolo
--

CREATE TYPE pecuaria."PrecisaoCalendarioProtocolo" AS ENUM (
    'DIA',
    'HORA'
);


--
-- TYPE: pecuaria.SexoBovino
--

CREATE TYPE pecuaria."SexoBovino" AS ENUM (
    'F',
    'M'
);


--
-- TYPE: pecuaria.StatusFatoPecuariaV3
--

CREATE TYPE pecuaria."StatusFatoPecuariaV3" AS ENUM (
    'VALIDO',
    'ANULADO'
);


--
-- TYPE: pecuaria.StatusFechamentoConsumo
--

CREATE TYPE pecuaria."StatusFechamentoConsumo" AS ENUM (
    'CONFIRMADO',
    'ESTORNADO'
);


--
-- TYPE: pecuaria.TipoBaixa
--

CREATE TYPE pecuaria."TipoBaixa" AS ENUM (
    'VENDA',
    'ABATE',
    'MORTE',
    'DOACAO',
    'EXTRAVIO',
    'CADASTRO_INDEVIDO'
);


--
-- TYPE: pecuaria.TipoEventoTarefaProtocolo
--

CREATE TYPE pecuaria."TipoEventoTarefaProtocolo" AS ENUM (
    'NAO_ATENDIDO',
    'ADIAMENTO',
    'RETIFICACAO_JUSTIFICATIVA'
);


--
-- TYPE: pecuaria.TipoMaterialGenetico
--

CREATE TYPE pecuaria."TipoMaterialGenetico" AS ENUM (
    'SEMEN',
    'EMBRIAO'
);


--
-- TYPE: pecuaria.TipoPesagem
--

CREATE TYPE pecuaria."TipoPesagem" AS ENUM (
    'NASCIMENTO',
    'ENTRADA',
    'DESMAMA',
    'ROTINA',
    'SAIDA'
);


--
-- TYPE: pecuaria.TipoProtocolo
--

CREATE TYPE pecuaria."TipoProtocolo" AS ENUM (
    'SANITARIO',
    'REPRODUTIVO'
);


--
-- TYPE: pecuaria.TipoSemen
--

CREATE TYPE pecuaria."TipoSemen" AS ENUM (
    'CONVENCIONAL',
    'SEXADO_FEMEA',
    'SEXADO_MACHO'
);


--
-- TYPE: public.ClassificacaoCategoria
--

CREATE TYPE public."ClassificacaoCategoria" AS ENUM (
    'CUSTEIO',
    'INVESTIMENTO'
);


--
-- TYPE: public.DirecaoMensagem
--

CREATE TYPE public."DirecaoMensagem" AS ENUM (
    'IN',
    'OUT'
);


--
-- TYPE: public.DirecaoMovimentoConta
--

CREATE TYPE public."DirecaoMovimentoConta" AS ENUM (
    'ENTRADA',
    'SAIDA'
);


--
-- TYPE: public.FormaPagamento
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
-- TYPE: public.OrigemMovimentoEstoque
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
-- TYPE: public.PapelParceiro
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
-- TYPE: public.StatusCompromisso
--

CREATE TYPE public."StatusCompromisso" AS ENUM (
    'PENDENTE',
    'PARCIAL',
    'LIQUIDADO',
    'CANCELADO'
);


--
-- TYPE: public.StatusMovimentoEstoque
--

CREATE TYPE public."StatusMovimentoEstoque" AS ENUM (
    'CONFIRMADO',
    'REVERTIDO'
);


--
-- TYPE: public.StatusOperacao
--

CREATE TYPE public."StatusOperacao" AS ENUM (
    'RASCUNHO',
    'CONFIRMADA',
    'CANCELADA'
);


--
-- TYPE: public.StatusPeriodoFinanceiro
--

CREATE TYPE public."StatusPeriodoFinanceiro" AS ENUM (
    'ABERTO',
    'FECHADO'
);


--
-- TYPE: public.StatusRelatorioFinanceiro
--

CREATE TYPE public."StatusRelatorioFinanceiro" AS ENUM (
    'PROCESSANDO',
    'CONCLUIDO',
    'FALHOU'
);


--
-- TYPE: public.StatusTransacaoFinanceira
--

CREATE TYPE public."StatusTransacaoFinanceira" AS ENUM (
    'CONFIRMADA',
    'REVERTIDA'
);


--
-- TYPE: public.StatusUsuario
--

CREATE TYPE public."StatusUsuario" AS ENUM (
    'PENDENTE',
    'ATIVO',
    'INATIVO'
);


--
-- TYPE: public.TipoBancario
--

CREATE TYPE public."TipoBancario" AS ENUM (
    'CORRENTE',
    'POUPANCA',
    'PAGAMENTO'
);


--
-- TYPE: public.TipoCompromisso
--

CREATE TYPE public."TipoCompromisso" AS ENUM (
    'PAGAR',
    'RECEBER'
);


--
-- TYPE: public.TipoContaFinanceira
--

CREATE TYPE public."TipoContaFinanceira" AS ENUM (
    'BANCO',
    'CAIXA',
    'APLICACAO'
);


--
-- TYPE: public.TipoDocumentoFinanceiro
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
-- TYPE: public.TipoMovimento
--

CREATE TYPE public."TipoMovimento" AS ENUM (
    'ENTRADA',
    'SAIDA',
    'AJUSTE'
);


--
-- TYPE: public.TipoOperacaoFinanceira
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
    'PRODUCAO'
);


--
-- TYPE: public.TipoParceiro
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
-- TYPE: public.TipoToken
--

CREATE TYPE public."TipoToken" AS ENUM (
    'CONVITE',
    'RESET'
);


--
-- TYPE: public.TipoTransacaoFinanceira
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
-- TYPE: public.UnidadeMedida
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
-- FUNCTION: pecuaria.anular_comercial_leite()
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
-- FUNCTION: pecuaria.atualizar_versao_parto_pesagem()
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
-- FUNCTION: pecuaria.compatibilizar_desfecho_parto()
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
-- FUNCTION: pecuaria.conferir_afericao_origem_geral()
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
-- FUNCTION: pecuaria.conferir_alteracao_fonte_custo()
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
-- FUNCTION: pecuaria.conferir_amostra_qualidade_leite()
--

CREATE FUNCTION pecuaria.conferir_amostra_qualidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE e RECORD; t RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Amostra de qualidade é histórica; anule com motivo' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.sujeito,NEW."propriedadeId",NEW.data,NEW."tipoExameId",NEW."exameAnimalId",NEW."entradaId",NEW."origemColetiva",NEW."formatoSnapshot") IS DISTINCT FROM (OLD.sujeito,OLD."propriedadeId",OLD.data,OLD."tipoExameId",OLD."exameAnimalId",OLD."entradaId",OLD."origemColetiva",OLD."formatoSnapshot") THEN
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
  RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.conferir_apuracao_leite()
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
-- FUNCTION: pecuaria.conferir_cadeia_venda_leite(text)
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
-- FUNCTION: pecuaria.conferir_capacidade_preparo(text, text)
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
-- FUNCTION: pecuaria.conferir_ciclo_elegibilidade()
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
-- FUNCTION: pecuaria.conferir_classificacao_inicial_leite()
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
-- FUNCTION: pecuaria.conferir_classificacao_manejo()
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
-- FUNCTION: pecuaria.conferir_colostro_trigger()
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
-- FUNCTION: pecuaria.conferir_conjunto_parcelas_leite()
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
-- FUNCTION: pecuaria.conferir_decisao_elegibilidade()
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
-- FUNCTION: pecuaria.conferir_demonstrativo_leite(text)
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
-- FUNCTION: pecuaria.conferir_descarte_leite()
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
-- FUNCTION: pecuaria.conferir_destino_interno_leite()
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
-- FUNCTION: pecuaria.conferir_elegibilidade_saida_leite()
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
-- FUNCTION: pecuaria.conferir_entrega_leite(text)
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
-- FUNCTION: pecuaria.conferir_evidencia_finalidade_leite()
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
-- FUNCTION: pecuaria.conferir_exame_pos_parto(text)
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
-- FUNCTION: pecuaria.conferir_exame_pos_parto_trigger()
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
-- FUNCTION: pecuaria.conferir_fornecimento_colostro(text)
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
-- FUNCTION: pecuaria.conferir_fornecimento_nutricional_leite()
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
-- FUNCTION: pecuaria.conferir_historico_origem_geral(text, date, date)
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
-- FUNCTION: pecuaria.conferir_limite_classificacao()
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
-- FUNCTION: pecuaria.conferir_manejo_protocolar()
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
 IF participacao.id IS NULL THEN RAISE EXCEPTION 'Manejo incompatível com animal e ação da tarefa'; END IF;
 IF NEW."precisaoTemporal"='HORA' AND (NEW."realizadaEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.data THEN RAISE EXCEPTION 'Dia e instante do manejo divergem'; END IF;
 IF NEW.tipo='RETIRADA_DISPOSITIVO' AND (NEW.status='VALIDO' OR NEW."realizacaoMantida") THEN
  SELECT a.*,e.configuracao INTO insercao FROM pecuaria."AplicacaoProduto" a LEFT JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" LEFT JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE a.id=NEW."insercaoAplicacaoId" AND a."animalId"=NEW."animalId" AND a.status='VALIDO' AND (e.tipo='APLICACAO' AND e.configuracao->>'subtipo'='INSERCAO_DISPOSITIVO' OR a."insercaoDispositivoSnapshot" IS NOT NULL) FOR UPDATE OF a;
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
-- FUNCTION: pecuaria.conferir_medicao_geral_leite()
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
-- FUNCTION: pecuaria.conferir_medicoes_entrada_leite(text)
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
-- FUNCTION: pecuaria.conferir_movimento_leite(text)
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
-- FUNCTION: pecuaria.conferir_natureza_destino_leite()
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
-- FUNCTION: pecuaria.conferir_operacao_comercial_leite(text)
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
-- FUNCTION: pecuaria.conferir_participacao_protocolo()
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
-- FUNCTION: pecuaria.conferir_pesagem_parto_trigger()
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
-- FUNCTION: pecuaria.conferir_referencia_gerencial_leite()
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
-- FUNCTION: pecuaria.conferir_resultado_qualidade_leite()
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
-- FUNCTION: pecuaria.conferir_rp_ocorrencia_trigger()
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
-- FUNCTION: pecuaria.conferir_rp_parto(text)
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
-- FUNCTION: pecuaria.conferir_rp_parto_trigger()
--

CREATE FUNCTION pecuaria.conferir_rp_parto_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pecuaria.conferir_rp_parto(NEW.id);
  RETURN NULL;
END $$;


--
-- FUNCTION: pecuaria.conferir_segmentos_consumo()
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
-- FUNCTION: pecuaria.conferir_tarefa_protocolo()
--

CREATE FUNCTION pecuaria.conferir_tarefa_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF (SELECT "protocoloId" FROM pecuaria."EtapaProtocolo" WHERE id=NEW."etapaId") IS DISTINCT FROM (SELECT "protocoloId" FROM pecuaria."ParticipacaoProtocolo" WHERE id=NEW."participacaoId") THEN RAISE EXCEPTION 'Etapa e participação precisam usar a mesma versão do protocolo'; END IF;
 RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.conferir_valor_entrada_leite(text)
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
-- FUNCTION: pecuaria.conferir_vinculo_leite()
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
-- FUNCTION: pecuaria.conferir_vinculo_operacao_comercial_leite()
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
-- FUNCTION: pecuaria.conferir_vinculo_pesagem_parto(text)
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
-- FUNCTION: pecuaria.conferir_vinculo_preparo()
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
-- FUNCTION: pecuaria.conferir_vinculo_tarefa()
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
-- FUNCTION: pecuaria.congelar_configuracao_dia_leite()
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
-- FUNCTION: pecuaria.exigir_explicacao_novo_aborto()
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
-- FUNCTION: pecuaria.exigir_finalidade_medicao_leite()
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
-- FUNCTION: pecuaria.exigir_identidade_versao_venda_leite()
--

CREATE FUNCTION pecuaria.exigir_identidade_versao_venda_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.chave IS NULL OR NEW.hash IS NULL THEN RAISE EXCEPTION 'nova versão comercial exige identidade de reenvio'; END IF;
  RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.finalidades_producao_na_data(text, date)
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
-- FUNCTION: pecuaria.guard_cadeia_venda_leite()
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
-- FUNCTION: pecuaria.guard_comercial_leite()
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
-- FUNCTION: pecuaria.guard_vinculo_medicao_entrada()
--

CREATE FUNCTION pecuaria.guard_vinculo_medicao_entrada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pecuaria.conferir_medicoes_entrada_leite(NEW."entradaId");
  RETURN NULL;
END $$;


--
-- FUNCTION: pecuaria.guardar_identidade_comercial_leite()
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
-- FUNCTION: pecuaria.impedir_edicao_politica_acompanhamento()
--

CREATE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 RAISE EXCEPTION 'política de acompanhamento é imutável; crie nova versão' USING ERRCODE='23514';
END $$;


--
-- FUNCTION: pecuaria.impedir_mutacao_versao_venda_leite()
--

CREATE FUNCTION pecuaria.impedir_mutacao_versao_venda_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'versão comercial de leite é imutável; registre substituição explícita'; END $$;


--
-- FUNCTION: pecuaria.imutavel_comercial_leite()
--

CREATE FUNCTION pecuaria.imutavel_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 RAISE EXCEPTION 'fato comercial leiteiro é imutável; registre conferência ou anulação explícita'; END $$;


--
-- FUNCTION: pecuaria.imutavel_operacao_comercial_leite()
--

CREATE FUNCTION pecuaria.imutavel_operacao_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'histórico comercial leiteiro não pode ser reescrito ou apagado' USING ERRCODE='23514'; END $$;


--
-- FUNCTION: pecuaria.observar_origem_fornecimento_nutricional_leite()
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
-- FUNCTION: pecuaria.preservar_fato_nutricional_leite()
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
-- FUNCTION: pecuaria.preservar_formato_qualidade_leite()
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
-- FUNCTION: pecuaria.preservar_referencia_protocolo_publicado()
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
-- FUNCTION: pecuaria.preservar_resultado_qualidade_leite()
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
-- FUNCTION: pecuaria.proteger_baixa_com_producao()
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
-- FUNCTION: pecuaria.proteger_conferencia_saldo_leite()
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
-- FUNCTION: pecuaria.proteger_configuracao_ordenha_usada()
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
-- FUNCTION: pecuaria.proteger_decisao_elegibilidade()
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
-- FUNCTION: pecuaria.proteger_descarte_leite()
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
-- FUNCTION: pecuaria.proteger_emissao_leite()
--

CREATE FUNCTION pecuaria.proteger_emissao_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Emissão de leite é histórica; gere outra emissão sem reescrever o corte' USING ERRCODE='23514'; END $$;


--
-- FUNCTION: pecuaria.proteger_entrada_leite()
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
-- FUNCTION: pecuaria.proteger_estrutura_protocolo()
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
-- FUNCTION: pecuaria.proteger_etapa_protocolo()
--

CREATE FUNCTION pecuaria.proteger_etapa_protocolo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF (SELECT publicado OR "publicadoEm" IS NOT NULL FROM pecuaria."Protocolo" WHERE id=OLD."protocoloId") OR EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" WHERE "etapaId"=OLD.id)
 THEN RAISE EXCEPTION 'Etapa publicada ou usada é imutável'; END IF;
 RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.proteger_fatos_destino_leite()
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
-- FUNCTION: pecuaria.proteger_finalidade_com_producao()
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
-- FUNCTION: pecuaria.proteger_finalidade_protocolo()
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
-- FUNCTION: pecuaria.proteger_historico_origem_geral()
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
-- FUNCTION: pecuaria.proteger_identidade_dia_leite()
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
-- FUNCTION: pecuaria.proteger_identidade_medicao_com_origem()
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
-- FUNCTION: pecuaria.proteger_insercao_retirada()
--

CREATE FUNCTION pecuaria.proteger_insercao_retirada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ManejoAnimal" m WHERE m."insercaoAplicacaoId"=NEW.id AND (m.status='VALIDO' OR m."realizacaoMantida") AND (NEW.status<>'VALIDO' OR NEW."animalId"<>m."animalId" OR NEW.data>m.data OR (NEW.data=m.data AND NEW."precisaoTemporal"='HORA' AND m."precisaoTemporal"='HORA' AND NEW."aplicadaEm">m."realizadaEm"))) THEN RAISE EXCEPTION 'Revise a retirada vinculada antes de alterar ou anular a inserção'; END IF;
 RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.proteger_medicao_leite_confirmada()
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
-- FUNCTION: pecuaria.proteger_momento_snapshot_tarefa()
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
-- FUNCTION: pecuaria.proteger_natureza_entrada_leite()
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
-- FUNCTION: pecuaria.proteger_partos_parcelas_leite()
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
-- FUNCTION: pecuaria.proteger_politica_e_ciclo()
--

CREATE FUNCTION pecuaria.proteger_politica_e_ciclo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Versões e vínculos de ciclo preservam o critério histórico; registre nova decisão'; END $$;


--
-- FUNCTION: pecuaria.proteger_populacao_leite_confirmada()
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
-- FUNCTION: pecuaria.proteger_posicao_ordenha_usada()
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
-- FUNCTION: pecuaria.proteger_reconhecimento_insercao()
--

CREATE FUNCTION pecuaria.proteger_reconhecimento_insercao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF OLD."insercaoDispositivoSnapshot" IS NOT NULL AND NEW."insercaoDispositivoSnapshot" IS DISTINCT FROM OLD."insercaoDispositivoSnapshot" THEN RAISE EXCEPTION 'Reconhecimento da inserção é histórico imutável; anule o fato se incorreto'; END IF;
 IF NEW."insercaoDispositivoSnapshot" IS DISTINCT FROM OLD."insercaoDispositivoSnapshot" AND NEW.status<>'VALIDO' THEN RAISE EXCEPTION 'Somente aplicação válida pode ser reconhecida como inserção'; END IF;
 RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.proteger_sessao_leite_confirmada()
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
-- FUNCTION: pecuaria.proteger_snapshot_relatorio_reprodutivo()
--

CREATE FUNCTION pecuaria.proteger_snapshot_relatorio_reprodutivo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Emissão é imutável; gere outro relatório preservando a versão antiga'; END $$;


--
-- FUNCTION: pecuaria.proteger_versao_protocolo()
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
-- FUNCTION: pecuaria.proteger_versao_selecao_visita()
--

CREATE FUNCTION pecuaria.proteger_versao_selecao_visita() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Versão de seleção é imutável; crie outra versão';
END $$;


--
-- FUNCTION: pecuaria.proteger_vinculo_medicao_entrada()
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
-- FUNCTION: pecuaria.proteger_vinculo_pesagem_parto()
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
-- FUNCTION: pecuaria.proteger_vinculo_preparo()
--

CREATE FUNCTION pecuaria.proteger_vinculo_preparo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
 IF (NEW."id",NEW."tentativaId",NEW."aplicacaoId",NEW."exameId",NEW."participacaoId",NEW."modo",NEW."valorMaterial",NEW."valorServico",NEW."criadoPorId",NEW."criadoEm",NEW."motivo") IS DISTINCT FROM (OLD."id",OLD."tentativaId",OLD."aplicacaoId",OLD."exameId",OLD."participacaoId",OLD."modo",OLD."valorMaterial",OLD."valorServico",OLD."criadoPorId",OLD."criadoEm",OLD."motivo") OR OLD."encerradoEm" IS NOT NULL THEN RAISE EXCEPTION 'vínculo confirmado imutável; encerre com motivo e crie outro' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.travar_afericao_origem_geral()
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
-- FUNCTION: pecuaria.travar_animais_origem_geral(text[])
--

CREATE FUNCTION pecuaria.travar_animais_origem_geral(ids text[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(h) FROM
 (SELECT DISTINCT hashtext('pec-animal:'||id) h FROM unnest(ids) id) chaves ORDER BY h;
END $$;


--
-- FUNCTION: pecuaria.travar_conferencia_entrega_leite()
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
-- FUNCTION: pecuaria.travar_entrada_origem_geral()
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
-- FUNCTION: pecuaria.travar_fechamento_comercial_leite()
--

CREATE FUNCTION pecuaria.travar_fechamento_comercial_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 PERFORM id FROM pecuaria."OperacaoComercialLeite" WHERE id=NEW."comercialId" FOR NO KEY UPDATE;
 RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.travar_historico_origem_geral()
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
-- FUNCTION: pecuaria.travar_retirada_comercial_leite()
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
-- FUNCTION: pecuaria.travar_versao_adotada()
--

CREATE FUNCTION pecuaria.travar_versao_adotada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM 1 FROM pecuaria."Protocolo" p WHERE p.id = NEW."protocoloId" FOR UPDATE;
  RETURN NEW;
END $$;


--
-- FUNCTION: pecuaria.validar_classificacao_custo()
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
-- FUNCTION: pecuaria.validar_demanda_acompanhamento()
--

CREATE FUNCTION pecuaria.validar_demanda_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE registro_origem RECORD; registro_politica RECORD; registro_exame RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."politicaId",NEW."dataReferencia",NEW."previstaPara",NEW."regraSnapshot",NEW."origemAdocao")
  IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."politicaId",OLD."dataReferencia",OLD."previstaPara",OLD."regraSnapshot",OLD."origemAdocao") THEN
  RAISE EXCEPTION 'origem e regra da demanda são congeladas' USING ERRCODE='23514';
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
    AND e.data=NEW."dataReferencia" AND NEW.finalidade=ANY(e.finalidades)
    AND e."tipoExameId"=NEW."regraSnapshot"->>'tipoExameId'
    AND e."formatoSnapshot"->>'versao'=NEW."regraSnapshot"->>'tipoExameVersao'
    AND i."tentativaId" IS NOT DISTINCT FROM NEW."tentativaId" AND i."gestacaoId" IS NOT DISTINCT FROM NEW."gestacaoId"
    AND (TG_OP='UPDATE' OR (e.status='VALIDO' AND e.realizacao='REALIZADO' AND EXISTS (
      SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"INCONCLUSIVO"'::jsonb)))
  ) THEN RAISE EXCEPTION 'demanda protocolar exige tarefa e exame inconclusivo compatíveis' USING ERRCODE='23514'; END IF;
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
-- FUNCTION: pecuaria.validar_descarte_leite(text)
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
-- FUNCTION: pecuaria.validar_desfecho_parto_explicito()
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
-- FUNCTION: pecuaria.validar_evento_tarefa_protocolo()
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
-- FUNCTION: pecuaria.validar_exame_demanda_acompanhamento()
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
-- FUNCTION: pecuaria.validar_fornecimento_nutricional_leite(text)
--

CREATE FUNCTION pecuaria.validar_fornecimento_nutricional_leite(identidade text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE f pecuaria."FornecimentoNutricionalLeite"; item pecuaria."ItemFechamentoConsumo"; c pecuaria."FechamentoConsumo";
BEGIN
 SELECT * INTO STRICT f FROM pecuaria."FornecimentoNutricionalLeite" WHERE "id"=identidade;
 SELECT * INTO STRICT item FROM pecuaria."ItemFechamentoConsumo" WHERE "id"=f."itemId";
 SELECT * INTO STRICT c FROM pecuaria."FechamentoConsumo" WHERE "id"=item."fechamentoId";
 IF NOT EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m."id"=e."movimentoId" WHERE m."produtoId"=item."produtoId" AND m."propriedadeId"=f."propriedadeId") THEN
  RAISE EXCEPTION 'Ingrediente leiteiro exige produção V5 histórica comprovada no sítio';
 END IF;
 IF c."status"::text<>f."status" OR c."propriedadeId"<>f."propriedadeId" OR c."fim"<>f."data" OR item."unidade"<>'L' OR item."quantidadeConfirmada"<>f."quantidadeLitros" OR item."movimentoEstoqueId" IS NOT NULL OR item."modoEstoque"<>'BAIXA_ESTOQUE' THEN
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
 IF (SELECT COUNT(*) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>(SELECT COUNT(*) FROM pecuaria."ParticipacaoConsumoAnimal" WHERE "fechamentoId"=c."id") THEN
  RAISE EXCEPTION 'Todos os participantes do fechamento devem ter parcela de leite';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."ParcelaFornecimentoNutricionalLeite" p WHERE p."fornecimentoId"=f."id" AND NOT EXISTS (
  SELECT 1 FROM pecuaria."ParticipacaoConsumoAnimal" a WHERE a."fechamentoId"=c."id" AND a."animalId"=p."animalId" AND a."dias"=p."dias")) THEN
  RAISE EXCEPTION 'Destinatário deve participar do fechamento da dieta';
 END IF;
 RETURN;
END $$;


--
-- FUNCTION: pecuaria.validar_resolucao_demanda_final()
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
-- FUNCTION: pecuaria.validar_vinculo_qualidade_fechamento()
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
-- FUNCTION: public.conferir_alocacao_partida_v3()
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
-- FUNCTION: public.conferir_base_valorizacao()
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
-- FUNCTION: public.conferir_grupo_validade_produto()
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
-- FUNCTION: public.conferir_valorizacao_estoque()
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
-- FUNCTION: public.impedir_edicao_alocacao_partida_v3()
--

CREATE FUNCTION public.impedir_edicao_alocacao_partida_v3() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'alocação de partida confirmada é imutável; use movimento inverso' USING ERRCODE = '23514';
END $$;


--
-- FUNCTION: public.impedir_edicao_valorizacao_estoque()
--

CREATE FUNCTION public.impedir_edicao_valorizacao_estoque() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'valorização confirmada é imutável; use inverso ou abertura documentada' USING ERRCODE='23514'; END $$;


--
-- FUNCTION: public.proteger_identidade_valorizada()
--

CREATE FUNCTION public.proteger_identidade_valorizada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN
  IF OLD."metodoValorizacao" <> 'LEGADO' AND (NEW."metodoValorizacao" IS DISTINCT FROM OLD."metodoValorizacao" OR NEW."produtoId" IS DISTINCT FROM OLD."produtoId" OR NEW."propriedadeId" IS DISTINCT FROM OLD."propriedadeId" OR NEW."quantidade" IS DISTINCT FROM OLD."quantidade" OR NEW."valorTotal" IS DISTINCT FROM OLD."valorTotal" OR NEW."data" IS DISTINCT FROM OLD."data" OR NEW."tipo" IS DISTINCT FROM OLD."tipo" OR NEW."custoUnitario" IS DISTINCT FROM OLD."custoUnitario" OR NEW."evidenciaValor" IS DISTINCT FROM OLD."evidenciaValor" OR NEW."origem" IS DISTINCT FROM OLD."origem" OR NEW."reversaoDeId" IS DISTINCT FROM OLD."reversaoDeId") THEN RAISE EXCEPTION 'identidade e valores congelados; use inverso' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- FUNCTION: public.proteger_localizacao_consumo_v3()
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TABLE: pecuaria.AlocacaoDemonstrativoLeite
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
-- TABLE: pecuaria.AlocacaoLeiteEstoque
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
-- TABLE: pecuaria.AmostraQualidadeLeite
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
    CONSTRAINT "AmostraQualidadeLeite_anulacao_check" CHECK ((((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NULL)) OR ((status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NOT NULL) AND (length(btrim("motivoAnulacao")) > 0)))),
    CONSTRAINT "AmostraQualidadeLeite_realizacao_check" CHECK ((realizacao = ANY (ARRAY['COLETA_REGISTRADA'::text, 'REALIZADO'::text]))),
    CONSTRAINT "AmostraQualidadeLeite_sujeito_check" CHECK ((((sujeito = 'ANIMAL'::text) AND ("exameAnimalId" IS NOT NULL) AND ("origemColetiva" IS NULL) AND ("entradaId" IS NULL) AND ("formatoSnapshot" IS NULL)) OR ((sujeito = 'COLETIVO'::text) AND ("exameAnimalId" IS NULL) AND ("origemColetiva" IS NOT NULL) AND (length(btrim("origemColetiva")) > 0) AND ("formatoSnapshot" IS NOT NULL) AND (jsonb_typeof("formatoSnapshot") = 'object'::text)))),
    CONSTRAINT "AmostraQualidadeLeite_versao_check" CHECK ((versao > 0))
);


--
-- TABLE: pecuaria.Animal
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
-- TABLE: pecuaria.AplicacaoProduto
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
-- TABLE: pecuaria.ApropriacaoValorLeite
--

CREATE TABLE pecuaria."ApropriacaoValorLeite" (
    id text NOT NULL,
    "apuracaoId" text NOT NULL,
    "alocacaoId" text NOT NULL,
    "valorTotal" numeric(14,2) NOT NULL,
    CONSTRAINT "ApropriacaoLeite_valor" CHECK (("valorTotal" >= (0)::numeric))
);


--
-- TABLE: pecuaria.ApuracaoValorLeite
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
-- TABLE: pecuaria.AtividadeVisita
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
-- TABLE: pecuaria.AuditoriaPecuaria
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
-- TABLE: pecuaria.ExameAnimal
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
    CONSTRAINT "ExameAnimal_finalidade_check" CHECK ((("finalidadePrincipal" IS NULL) OR ("finalidadePrincipal" = ANY (finalidades)))),
    CONSTRAINT "ExameAnimal_formato_multiplo_check" CHECK (((("formatoSnapshot" ->> 'tipoResultado'::text) <> 'MULTIPLO'::text) OR (("resultadoTexto" IS NULL) AND ("resultadoNumero" IS NULL) AND ("resultadoOpcao" IS NULL)))),
    CONSTRAINT "ExameAnimal_realizacao_check" CHECK ((realizacao = ANY (ARRAY['REALIZADO'::text, 'COLETA_REGISTRADA'::text, 'NAO_REALIZADO'::text]))),
    CONSTRAINT exame_rateio_nao_negativo CHECK ((("valorServicoAtribuido" IS NULL) OR (("valorServicoAtribuido" >= (0)::numeric) AND ("operacaoServicoId" IS NOT NULL))))
);


--
-- TABLE: pecuaria.InterpretacaoReprodutiva
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
    "exameId" text NOT NULL
);


--
-- TABLE: pecuaria.ResultadoExame
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
-- VIEW: pecuaria.AvaliacaoReprodutiva
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
            WHEN (e.realizacao = 'NAO_REALIZADO'::text) THEN 'NAO_AVALIADO'::text
            WHEN ((e."finalidadePrincipal" = 'RECONFIRMACAO'::text) AND ((c.valor #>> '{}'::text[]) = 'POSITIVO'::text)) THEN 'RECONFIRMACAO'::text
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
     LEFT JOIN pecuaria."ResultadoExame" s ON (((s."exameId" = e.id) AND (s.campo = 'SEXO_FETAL'::text) AND s.vigente)));


--
-- TABLE: pecuaria.BaixaAnimal
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
    "cienciaCarenciaSnapshot" jsonb
);


--
-- TABLE: pecuaria.CategoriaAnimal
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
-- TABLE: pecuaria.CategoriaManualAnimal
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
-- TABLE: pecuaria.ClassificacaoCustoPecuaria
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
    CONSTRAINT "ClassificacaoCusto_cobertura" CHECK (("coberturaServico" = ANY (ARRAY['PROCEDIMENTO'::text, 'MATERIAL'::text, 'AMBOS'::text]))),
    CONSTRAINT "ClassificacaoCusto_documento" CHECK (((("valorMaterialDocumentado" IS NULL) AND ("documentoMaterial" IS NULL)) OR (("valorMaterialDocumentado" IS NOT NULL) AND ("valorMaterialDocumentado" >= (0)::numeric) AND ("documentoMaterial" IS NOT NULL) AND ("documentoMaterial" ?& ARRAY['referencia'::text, 'evidencia'::text])))),
    CONSTRAINT "ClassificacaoCusto_finalidade" CHECK ((finalidade = ANY (ARRAY['REPRODUCAO'::text, 'SANIDADE'::text, 'ROTINA'::text]))),
    CONSTRAINT "ClassificacaoCusto_um_fato" CHECK ((num_nonnulls("tentativaId", "aplicacaoId", "exameId", "participacaoId", "participacaoConsumoId", "manejoId") = 1)),
    CONSTRAINT "ClassificacaoCusto_versao" CHECK ((versao > 0))
);


--
-- TABLE: pecuaria.ClassificacaoEntradaLeite
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
-- TABLE: pecuaria.ComposicaoGenitorExterno
--

CREATE TABLE pecuaria."ComposicaoGenitorExterno" (
    id text NOT NULL,
    "genitorId" text NOT NULL,
    "racaId" text NOT NULL,
    fracao64 integer NOT NULL,
    CONSTRAINT "ComposicaoGenitorExterno_fracao_chk" CHECK (((fracao64 >= 1) AND (fracao64 <= 64)))
);


--
-- TABLE: pecuaria.ComposicaoRacial
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
-- TABLE: pecuaria.ComprovanteEntregaLeite
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
-- TABLE: pecuaria.ComprovanteRetiradaOperacaoLeite
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
-- TABLE: pecuaria.ConferenciaEntregaLeite
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
-- TABLE: pecuaria.ConferenciaSaldoLeite
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
-- TABLE: pecuaria.ConfiguracaoOrdenha
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
    CONSTRAINT "ConfiguracaoOrdenha_intervalo_individual" CHECK (((("intervaloIndividualQuantidade" >= 1) AND ("intervaloIndividualQuantidade" <= 365)) AND ("intervaloIndividualUnidade" = ANY (ARRAY['DIAS'::text, 'MESES'::text])) AND ("fonteProducao" = ANY (ARRAY['GERAL'::text, 'INDIVIDUAL'::text]))))
);


--
-- TABLE: pecuaria.CriaParto
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
-- TABLE: pecuaria.DecisaoElegibilidadeCiclo
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
    CONSTRAINT "DecisaoElegibilidade_anulacao" CHECK ((((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NULL) AND ("motivoAnulacao" IS NULL)) OR ((status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3") AND ("anuladoEm" IS NOT NULL) AND (length(btrim("motivoAnulacao")) >= 5) AND ("motivoAnulacao" IS NOT NULL)))),
    CONSTRAINT "DecisaoElegibilidade_aptaDesde" CHECK ((((tipo = 'LIBERAR'::text) AND ("aptaDesde" IS NOT NULL)) OR ((tipo <> 'LIBERAR'::text) AND ("aptaDesde" IS NULL)))),
    CONSTRAINT "DecisaoElegibilidade_data_liberacao" CHECK (((tipo <> 'LIBERAR'::text) OR ("aptaDesde" >= data))),
    CONSTRAINT "DecisaoElegibilidade_motivo" CHECK ((length(btrim(motivo)) >= 5)),
    CONSTRAINT "DecisaoElegibilidade_tipo" CHECK ((tipo = ANY (ARRAY['LIBERAR'::text, 'BLOQUEAR'::text, 'RETOMAR_POLITICA'::text])))
);


--
-- TABLE: pecuaria.DemandaAcompanhamentoReprodutivo
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
    CONSTRAINT "DemandaAcompanhamento_contexto_prazo" CHECK (((("origemAdocao" = 'PROTOCOLO'::text) AND ("politicaId" IS NULL) AND ("tarefaId" IS NOT NULL) AND ("exameOrigemId" IS NOT NULL)) OR (("origemAdocao" <> 'PROTOCOLO'::text) AND ("politicaId" IS NOT NULL) AND ("previstaPara" IS NOT NULL)))),
    CONSTRAINT "DemandaAcompanhamento_encerramento" CHECK (((estado <> 'ENCERRADA'::text) OR (("encerradaEm" IS NOT NULL) AND ("motivoEncerramento" IS NOT NULL) AND (length(TRIM(BOTH FROM "motivoEncerramento")) >= 5)))),
    CONSTRAINT "DemandaAcompanhamento_estado" CHECK ((estado = ANY (ARRAY['PENDENTE'::text, 'RESOLVIDA'::text, 'ENCERRADA'::text]))),
    CONSTRAINT "DemandaAcompanhamento_origem" CHECK (((("origemAdocao" = 'PROTOCOLO'::text) AND (finalidade = ANY (ARRAY['DIAGNOSTICO'::text, 'RECONFIRMACAO'::text, 'SEXAGEM'::text])) AND (ocorrencia > 0)) OR ((finalidade = 'DIAGNOSTICO'::text) AND ("tentativaId" IS NOT NULL) AND ("gestacaoId" IS NULL) AND (ocorrencia = 1)) OR ((finalidade = 'RECONFIRMACAO'::text) AND ("gestacaoId" IS NOT NULL) AND ("tentativaId" IS NULL) AND (ocorrencia > 0)))),
    CONSTRAINT "DemandaAcompanhamento_previsao" CHECK ((("previstaPara" >= "dataReferencia") AND (versao > 0))),
    CONSTRAINT "DemandaAcompanhamento_regra" CHECK (((jsonb_typeof("regraSnapshot") = 'object'::text) AND (NOT (("regraSnapshot" ->> 'efeito'::text) IS DISTINCT FROM 'ALERTA'::text)))),
    CONSTRAINT "DemandaAcompanhamento_resolucao" CHECK (((estado <> 'RESOLVIDA'::text) OR (("resolvidaEm" IS NOT NULL) AND ("exameResolucaoId" IS NOT NULL) AND ("resolucaoSnapshot" IS NOT NULL))))
);


--
-- TABLE: pecuaria.DemonstrativoLeite
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
-- TABLE: pecuaria.DescarteLeite
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
-- TABLE: pecuaria.FinalidadeAnimal
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
-- VIEW: pecuaria.DestinoAnimal
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
-- TABLE: pecuaria.DestinoInternoLeite
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
-- TABLE: pecuaria.DetalheFechamentoLeite
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
-- TABLE: pecuaria.DiaProducaoLeite
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
-- TABLE: pecuaria.Dieta
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
-- TABLE: pecuaria.Doenca
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
-- TABLE: pecuaria.EmissaoRelatorioLeite
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
-- TABLE: pecuaria.EntradaProducaoLeite
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
-- TABLE: pecuaria.EntregaLeite
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
-- TABLE: pecuaria.EtapaProtocolo
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
-- TABLE: pecuaria.EventoTarefaProtocolo
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
    CONSTRAINT "EventoTarefaProtocolo_formato_check" CHECK ((((tipo = 'ADIAMENTO'::pecuaria."TipoEventoTarefaProtocolo") AND ("previsaoAnterior" IS NOT NULL) AND ("previsaoNova" IS NOT NULL) AND ("precisaoAnterior" IS NOT NULL) AND ("precisaoNova" IS NOT NULL) AND ("eventoCorrigidoId" IS NULL)) OR ((tipo = 'NAO_ATENDIDO'::pecuaria."TipoEventoTarefaProtocolo") AND ("previsaoAnterior" IS NULL) AND ("previsaoNova" IS NULL) AND ("precisaoAnterior" IS NULL) AND ("precisaoNova" IS NULL) AND ("eventoCorrigidoId" IS NULL)) OR ((tipo = 'RETIFICACAO_JUSTIFICATIVA'::pecuaria."TipoEventoTarefaProtocolo") AND ("previsaoAnterior" IS NULL) AND ("previsaoNova" IS NULL) AND ("precisaoAnterior" IS NULL) AND ("precisaoNova" IS NULL) AND ("eventoCorrigidoId" IS NOT NULL)))),
    CONSTRAINT "EventoTarefaProtocolo_motivo_check" CHECK (((length(btrim(motivo)) >= 5) AND (length(btrim(motivo)) <= 1000)))
);


--
-- TABLE: pecuaria.ExposicaoTouro
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
-- TABLE: pecuaria.FechamentoConsumo
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
-- TABLE: pecuaria.FechamentoOperacaoLeite
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
-- TABLE: pecuaria.FormatoQualidadeLeite
--

CREATE TABLE pecuaria."FormatoQualidadeLeite" (
    chave text NOT NULL,
    "hashPayload" text NOT NULL,
    "tipoExameId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer
);


--
-- TABLE: pecuaria.FornecimentoColostro
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
-- TABLE: pecuaria.FornecimentoNutricionalLeite
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
-- TABLE: pecuaria.GenitorExterno
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
-- TABLE: pecuaria.GestacaoAnimal
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
-- TABLE: pecuaria.HistoricoPrevisaoParto
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
-- TABLE: pecuaria.ImpressaoVisita
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
-- TABLE: pecuaria.ItemDieta
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
-- TABLE: pecuaria.ItemFechamentoConsumo
--

CREATE TABLE pecuaria."ItemFechamentoConsumo" (
    id text NOT NULL,
    "fechamentoId" text NOT NULL,
    "produtoId" text NOT NULL,
    "quantidadePrevista" numeric(12,3) NOT NULL,
    "quantidadeConfirmada" numeric(12,3) NOT NULL,
    "baseQuantidade" text NOT NULL,
    "motivoAjuste" text,
    unidade text NOT NULL,
    "movimentoEstoqueId" text,
    "modoEstoque" text NOT NULL,
    "justificativaSemBaixa" text,
    "situacaoCusto" text NOT NULL
);


--
-- TABLE: pecuaria.LactacaoAnimal
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
-- TABLE: pecuaria.LaudoQualidadeLeite
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
-- TABLE: pecuaria.LocalizacaoAnimal
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
-- TABLE: pecuaria.Lote
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
-- TABLE: pecuaria.ManejoAnimal
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
    CONSTRAINT "ManejoAnimal_protocolo_check" CHECK ((((tipo = ANY (ARRAY['DESMAMA'::text, 'CASTRACAO'::text])) AND ("tarefaId" IS NULL) AND ("insercaoAplicacaoId" IS NULL)) OR ((tipo = ANY (ARRAY['PROTOCOLAR'::text, 'RETIRADA_DISPOSITIVO'::text])) AND ("tarefaId" IS NOT NULL) AND ("propriedadeId" IS NOT NULL) AND ((("precisaoTemporal" = 'DIA'::pecuaria."PrecisaoCalendarioProtocolo") AND ("realizadaEm" IS NULL)) OR (("precisaoTemporal" = 'HORA'::pecuaria."PrecisaoCalendarioProtocolo") AND ("realizadaEm" IS NOT NULL))) AND (((tipo = 'RETIRADA_DISPOSITIVO'::text) AND ("insercaoAplicacaoId" IS NOT NULL)) OR ((tipo = 'PROTOCOLAR'::text) AND ("insercaoAplicacaoId" IS NULL)))))),
    CONSTRAINT "ManejoAnimal_realizacao_mantida_check" CHECK (((NOT "realizacaoMantida") OR (status = 'ANULADO'::pecuaria."StatusFatoPecuariaV3"))),
    CONSTRAINT "ManejoAnimal_servico_valor_check" CHECK ((("valorServicoAtribuido" IS NULL) OR (("valorServicoAtribuido" >= (0)::numeric) AND ("operacaoServicoId" IS NOT NULL)))),
    CONSTRAINT "ManejoAnimal_tipo_check" CHECK ((tipo = ANY (ARRAY['DESMAMA'::text, 'CASTRACAO'::text, 'PROTOCOLAR'::text, 'RETIRADA_DISPOSITIVO'::text])))
);


--
-- TABLE: pecuaria.MaterialGenetico
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
-- TABLE: pecuaria.MedicaoGeralLeite
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
-- TABLE: pecuaria.MedicaoLeite
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
-- TABLE: pecuaria.MomentoProtocolo
--

CREATE TABLE pecuaria."MomentoProtocolo" (
    id text NOT NULL,
    "protocoloId" text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    "instrucoesGerais" text,
    "modoAtendimento" text,
    CONSTRAINT "MomentoProtocolo_instrucoesGerais_check" CHECK ((length("instrucoesGerais") <= 2000)),
    CONSTRAINT "MomentoProtocolo_modoAtendimento_check" CHECK (("modoAtendimento" = ANY (ARRAY['AUTOMATIZADA'::text, 'MANUAL'::text]))),
    CONSTRAINT "MomentoProtocolo_nome_check" CHECK (((length(TRIM(BOTH FROM nome)) >= 1) AND (length(TRIM(BOTH FROM nome)) <= 120))),
    CONSTRAINT "MomentoProtocolo_ordem_check" CHECK ((ordem > 0))
);


--
-- TABLE: pecuaria.MotivoBaixa
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
-- TABLE: pecuaria.Movimentacao
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
-- TABLE: pecuaria.MovimentacaoAnimal
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
-- TABLE: pecuaria.MovimentoFornecimentoNutricionalLeite
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
-- TABLE: pecuaria.OcorrenciaSanitaria
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
-- TABLE: pecuaria.OperacaoComercialLeite
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
-- TABLE: pecuaria.ParcelaDestinoLeite
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
-- TABLE: pecuaria.ParcelaFornecimentoNutricionalLeite
--

CREATE TABLE pecuaria."ParcelaFornecimentoNutricionalLeite" (
    id text NOT NULL,
    "fornecimentoId" text NOT NULL,
    "animalId" text NOT NULL,
    dias integer NOT NULL,
    "baseQuantidade" text DEFAULT 'ATRIBUIDA'::text NOT NULL,
    "quantidadeLitros" numeric(12,3) NOT NULL,
    CONSTRAINT "ParcelaFornecimentoNutricionalLeite_baseQuantidade_check" CHECK (("baseQuantidade" = 'ATRIBUIDA'::text)),
    CONSTRAINT "ParcelaFornecimentoNutricionalLeite_dias_check" CHECK ((dias > 0)),
    CONSTRAINT "ParcelaFornecimentoNutricionalLeite_quantidadeLitros_check" CHECK (("quantidadeLitros" >= (0)::numeric))
);


--
-- TABLE: pecuaria.ParticipacaoConsumoAnimal
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
-- TABLE: pecuaria.ParticipacaoExposicao
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
-- TABLE: pecuaria.ParticipacaoProtocolo
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
    CONSTRAINT "ParticipacaoProtocolo_inicio_efetivo_precisao_check" CHECK ((("precisaoInicioEfetivo" IS DISTINCT FROM 'DIA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("inicioEfetivo" = date_trunc('day'::text, "inicioEfetivo")))),
    CONSTRAINT "ParticipacaoProtocolo_precisao_check" CHECK ((("precisaoTemporal" = 'HORA'::pecuaria."PrecisaoCalendarioProtocolo") OR ("inicioReferencia" = date_trunc('day'::text, "inicioReferencia")))),
    CONSTRAINT execucao_rateio_nao_negativo CHECK ((("valorServicoAtribuido" IS NULL) OR (("valorServicoAtribuido" >= (0)::numeric) AND ("operacaoServicoId" IS NOT NULL))))
);


--
-- TABLE: pecuaria.Protocolo
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
    CONSTRAINT "Protocolo_finalidade_dominio_check" CHECK (((finalidade IS NULL) OR ((tipo = 'SANITARIO'::pecuaria."TipoProtocolo") AND (finalidade = 'SANITARIO'::pecuaria."FinalidadeProtocolo")) OR ((tipo = 'REPRODUTIVO'::pecuaria."TipoProtocolo") AND (finalidade = ANY (ARRAY['PRE_SINCRONIZACAO'::pecuaria."FinalidadeProtocolo", 'IATF'::pecuaria."FinalidadeProtocolo", 'TETF'::pecuaria."FinalidadeProtocolo"])))))
);


--
-- VIEW: pecuaria.ParticipanteIatf
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
-- TABLE: pecuaria.ParticipanteProducaoLeite
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
-- TABLE: pecuaria.ParticipanteVisita
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
-- TABLE: pecuaria.PartoAnimal
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
    CONSTRAINT "Parto_desfecho" CHECK (((desfecho IS NULL) OR (desfecho = ANY (ARRAY['NASCIMENTO'::text, 'ABORTO'::text])))),
    CONSTRAINT "Parto_horario" CHECK ((((NOT "horarioEstimado") OR ("ocorridoEm" IS NOT NULL)) AND (("ocorridoEm" IS NULL) OR ((("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo'::text))::date = data)))),
    CONSTRAINT "Parto_tipo" CHECK ((tipo = ANY (ARRAY['NORMAL'::text, 'DISTOCICO'::text, 'ABORTO'::text, 'NATIMORTO'::text, 'NASCIMENTO'::text]))),
    CONSTRAINT "Parto_tipo_desfecho" CHECK (((desfecho IS NOT NULL) AND (((tipo = 'ABORTO'::text) AND (desfecho = 'ABORTO'::text)) OR ((tipo <> 'ABORTO'::text) AND (desfecho = 'NASCIMENTO'::text))))),
    CONSTRAINT "Parto_versao" CHECK ((versao > 0))
);


--
-- TABLE: pecuaria.PerfilNutricionalProduto
--

CREATE TABLE pecuaria."PerfilNutricionalProduto" (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    "materiaSecaPercentual" numeric(5,2),
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "PerfilNutricionalProduto_ms_check" CHECK ((("materiaSecaPercentual" IS NULL) OR (("materiaSecaPercentual" >= (0)::numeric) AND ("materiaSecaPercentual" <= (100)::numeric))))
);


--
-- TABLE: pecuaria.PerfilSanitarioProduto
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
-- TABLE: pecuaria.PeriodoReprodutivoAnimal
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
-- TABLE: pecuaria.Pesagem
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
    "requisicaoId" text
);


--
-- TABLE: pecuaria.PoliticaAcompanhamentoReprodutivo
--

CREATE TABLE pecuaria."PoliticaAcompanhamentoReprodutivo" (
    id text NOT NULL,
    "propriedadeId" integer NOT NULL,
    versao integer NOT NULL,
    "vigenteDesde" date NOT NULL,
    parametros jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" integer,
    CONSTRAINT "PoliticaAcompanhamento_alerta" CHECK (((jsonb_typeof(parametros) = 'object'::text) AND (NOT ((parametros ->> 'efeito'::text) IS DISTINCT FROM 'ALERTA'::text)) AND (NOT ((parametros ->> 'versao'::text) IS DISTINCT FROM '1'::text)))),
    CONSTRAINT "PoliticaAcompanhamento_versao" CHECK ((versao > 0))
);


--
-- TABLE: pecuaria.PoliticaElegibilidadeReprodutiva
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
-- TABLE: pecuaria.PosicaoOrdenha
--

CREATE TABLE pecuaria."PosicaoOrdenha" (
    id text NOT NULL,
    "configuracaoId" text NOT NULL,
    "posicaoId" text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    horario text,
    CONSTRAINT "PosicaoOrdenha_campos_check" CHECK ((((ordem >= 1) AND (ordem <= 12)) AND ((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 60)) AND ((horario IS NULL) OR (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))))
);


--
-- TABLE: pecuaria.ProgramacaoProtocolo
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
-- VIEW: pecuaria.ProgramacaoIatf
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
-- TABLE: pecuaria.ProgramacaoRetiradaLeite
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
-- VIEW: pecuaria.ProtocoloIatf
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
-- TABLE: pecuaria.Raca
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
-- TABLE: pecuaria.ReferenciaGerencialLeite
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
-- TABLE: pecuaria.RegraSanitariaReprodutiva
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
    CONSTRAINT "Regra_efeito" CHECK (((efeito = ANY (ARRAY['BLOQUEAR'::text, 'ALERTAR'::text])) AND (acao = ANY (ARRAY['IA'::text, 'TE'::text, 'COBERTURA'::text, 'IATF'::text]))))
);


--
-- TABLE: pecuaria.RequisicaoPecuaria
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
-- TABLE: pecuaria.RestricaoReprodutiva
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
-- TABLE: pecuaria.ResultadoQualidadeLeite
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
-- TABLE: pecuaria.RetiradaOperacaoLeite
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
-- TABLE: pecuaria.SegmentoConsumoAnimal
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
-- TABLE: pecuaria.SelecaoVisita
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
-- TABLE: pecuaria.SessaoOrdenha
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
-- TABLE: pecuaria.SituacaoInicialReprodutiva
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
    observacao text
);


--
-- TABLE: pecuaria.SnapshotRelatorioReprodutivo
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
-- TABLE: pecuaria.TanqueLeite
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
-- TABLE: pecuaria.TarefaProtocolo
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
-- TABLE: pecuaria.VinculoTarefaProtocolo
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
-- VIEW: pecuaria.TarefaIatf
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
-- TABLE: pecuaria.TentativaReprodutiva
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
-- TABLE: pecuaria.TipoAplicacaoSanitaria
--

CREATE TABLE pecuaria."TipoAplicacaoSanitaria" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TABLE: pecuaria.TipoExame
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
-- TABLE: pecuaria.VersaoComercialVendaLeite
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
-- TABLE: pecuaria.VersaoSelecaoVisita
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
-- TABLE: pecuaria.VigenciaDietaLote
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
-- TABLE: pecuaria.VinculoImportacaoPecuaria
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
-- TABLE: pecuaria.VinculoMedicaoEntradaLeite
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
-- TABLE: pecuaria.VinculoPesagemParto
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
-- TABLE: pecuaria.VinculoPoliticaCiclo
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
-- TABLE: pecuaria.VinculoPreparoTentativa
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
-- TABLE: pecuaria.VinculoQualidadeFechamentoLeite
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
-- TABLE: pecuaria.VisitaVeterinaria
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
-- TABLE: public.AlocacaoPartidaEstoque
--

CREATE TABLE public."AlocacaoPartidaEstoque" (
    id text NOT NULL,
    "movimentoEstoqueId" text NOT NULL,
    "partidaId" text NOT NULL,
    quantidade numeric(12,3) NOT NULL
);


--
-- TABLE: public.AuditoriaFinanceira
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
-- TABLE: public.BaseValorizacaoEstoque
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
-- SEQUENCE: public.BaseValorizacaoEstoque_ordem_seq
--

CREATE SEQUENCE public."BaseValorizacaoEstoque_ordem_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.BaseValorizacaoEstoque_ordem_seq
--

ALTER SEQUENCE public."BaseValorizacaoEstoque_ordem_seq" OWNED BY public."BaseValorizacaoEstoque".ordem;


--
-- TABLE: public.Categoria
--

CREATE TABLE public."Categoria" (
    id text NOT NULL,
    nome text NOT NULL,
    classificacao public."ClassificacaoCategoria",
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    "usoGenetico" boolean DEFAULT false NOT NULL,
    "usoNutricional" boolean DEFAULT false NOT NULL,
    "usoSanitario" boolean DEFAULT false NOT NULL,
    "grupoId" text
);


--
-- TABLE: public.CentroCusto
--

CREATE TABLE public."CentroCusto" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


--
-- TABLE: public.CompromissoFinanceiro
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
-- SEQUENCE: public.CompromissoFinanceiro_seq_seq
--

CREATE SEQUENCE public."CompromissoFinanceiro_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.CompromissoFinanceiro_seq_seq
--

ALTER SEQUENCE public."CompromissoFinanceiro_seq_seq" OWNED BY public."CompromissoFinanceiro".seq;


--
-- TABLE: public.ContaFinanceira
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
-- TABLE: public.ConversaWhatsapp
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
-- SEQUENCE: public.ConversaWhatsapp_id_seq
--

CREATE SEQUENCE public."ConversaWhatsapp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.ConversaWhatsapp_id_seq
--

ALTER SEQUENCE public."ConversaWhatsapp_id_seq" OWNED BY public."ConversaWhatsapp".id;


--
-- TABLE: public.DocumentoFinanceiro
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
-- TABLE: public.GrupoCategoria
--

CREATE TABLE public."GrupoCategoria" (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL
);


--
-- TABLE: public.ItemOperacao
--

CREATE TABLE public."ItemOperacao" (
    "categoriaId" text,
    "categoriaNome" text,
    classificacao public."ClassificacaoCategoria",
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
    "partidasSnapshot" jsonb
);


--
-- TABLE: public.Liquidacao
--

CREATE TABLE public."Liquidacao" (
    id text NOT NULL,
    "compromissoId" text NOT NULL,
    "transacaoId" text NOT NULL,
    valor numeric(14,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TABLE: public.MensagemWhatsapp
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
-- SEQUENCE: public.MensagemWhatsapp_id_seq
--

CREATE SEQUENCE public."MensagemWhatsapp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.MensagemWhatsapp_id_seq
--

ALTER SEQUENCE public."MensagemWhatsapp_id_seq" OWNED BY public."MensagemWhatsapp".id;


--
-- TABLE: public.MovimentoConta
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
-- SEQUENCE: public.MovimentoConta_seq_seq
--

CREATE SEQUENCE public."MovimentoConta_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.MovimentoConta_seq_seq
--

ALTER SEQUENCE public."MovimentoConta_seq_seq" OWNED BY public."MovimentoConta".seq;


--
-- TABLE: public.MovimentoEstoque
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
-- SEQUENCE: public.MovimentoEstoque_seq_seq
--

CREATE SEQUENCE public."MovimentoEstoque_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.MovimentoEstoque_seq_seq
--

ALTER SEQUENCE public."MovimentoEstoque_seq_seq" OWNED BY public."MovimentoEstoque".seq;


--
-- TABLE: public.Operacao
--

CREATE TABLE public."Operacao" (
    "categoriaNome" text,
    classificacao public."ClassificacaoCategoria",
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
-- SEQUENCE: public.Operacao_numero_seq
--

CREATE SEQUENCE public."Operacao_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.Operacao_numero_seq
--

ALTER SEQUENCE public."Operacao_numero_seq" OWNED BY public."Operacao".numero;


--
-- TABLE: public.Parceiro
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
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TABLE: public.ParceiroPapel
--

CREATE TABLE public."ParceiroPapel" (
    "parceiroId" text NOT NULL,
    papel public."PapelParceiro" NOT NULL
);


--
-- TABLE: public.ParcelaValorizacaoEstoque
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
-- TABLE: public.PartidaProduto
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
-- TABLE: public.PeriodoFinanceiro
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
-- TABLE: public.Produto
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
    "usoNutricional" boolean DEFAULT false NOT NULL
);


--
-- TABLE: public.ProdutoCentroCusto
--

CREATE TABLE public."ProdutoCentroCusto" (
    "produtoId" text NOT NULL,
    "centroCustoId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TABLE: public.ProdutoFornecedor
--

CREATE TABLE public."ProdutoFornecedor" (
    "produtoId" text NOT NULL,
    "fornecedorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TABLE: public.Propriedade
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
-- SEQUENCE: public.Propriedade_id_seq
--

CREATE SEQUENCE public."Propriedade_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.Propriedade_id_seq
--

ALTER SEQUENCE public."Propriedade_id_seq" OWNED BY public."Propriedade".id;


--
-- TABLE: public.RascunhoOperacao
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
-- TABLE: public.RascunhoRelatorioFinanceiro
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
-- TABLE: public.RelatorioFinanceiro
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
-- TABLE: public.Sessao
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
-- TABLE: public.TokenAcesso
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
-- TABLE: public.TransacaoFinanceira
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
-- SEQUENCE: public.TransacaoFinanceira_seq_seq
--

CREATE SEQUENCE public."TransacaoFinanceira_seq_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.TransacaoFinanceira_seq_seq
--

ALTER SEQUENCE public."TransacaoFinanceira_seq_seq" OWNED BY public."TransacaoFinanceira".seq;


--
-- TABLE: public.Usuario
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
-- TABLE: public.UsuarioWhatsapp
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
-- SEQUENCE: public.UsuarioWhatsapp_id_seq
--

CREATE SEQUENCE public."UsuarioWhatsapp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.UsuarioWhatsapp_id_seq
--

ALTER SEQUENCE public."UsuarioWhatsapp_id_seq" OWNED BY public."UsuarioWhatsapp".id;


--
-- SEQUENCE: public.Usuario_id_seq
--

CREATE SEQUENCE public."Usuario_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- SEQUENCE OWNED BY: public.Usuario_id_seq
--

ALTER SEQUENCE public."Usuario_id_seq" OWNED BY public."Usuario".id;


--
-- DEFAULT: public.BaseValorizacaoEstoque ordem
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque" ALTER COLUMN ordem SET DEFAULT nextval('public."BaseValorizacaoEstoque_ordem_seq"'::regclass);


--
-- DEFAULT: public.CompromissoFinanceiro seq
--

ALTER TABLE ONLY public."CompromissoFinanceiro" ALTER COLUMN seq SET DEFAULT nextval('public."CompromissoFinanceiro_seq_seq"'::regclass);


--
-- DEFAULT: public.ConversaWhatsapp id
--

ALTER TABLE ONLY public."ConversaWhatsapp" ALTER COLUMN id SET DEFAULT nextval('public."ConversaWhatsapp_id_seq"'::regclass);


--
-- DEFAULT: public.MensagemWhatsapp id
--

ALTER TABLE ONLY public."MensagemWhatsapp" ALTER COLUMN id SET DEFAULT nextval('public."MensagemWhatsapp_id_seq"'::regclass);


--
-- DEFAULT: public.MovimentoConta seq
--

ALTER TABLE ONLY public."MovimentoConta" ALTER COLUMN seq SET DEFAULT nextval('public."MovimentoConta_seq_seq"'::regclass);


--
-- DEFAULT: public.MovimentoEstoque seq
--

ALTER TABLE ONLY public."MovimentoEstoque" ALTER COLUMN seq SET DEFAULT nextval('public."MovimentoEstoque_seq_seq"'::regclass);


--
-- DEFAULT: public.Operacao numero
--

ALTER TABLE ONLY public."Operacao" ALTER COLUMN numero SET DEFAULT nextval('public."Operacao_numero_seq"'::regclass);


--
-- DEFAULT: public.Propriedade id
--

ALTER TABLE ONLY public."Propriedade" ALTER COLUMN id SET DEFAULT nextval('public."Propriedade_id_seq"'::regclass);


--
-- DEFAULT: public.TransacaoFinanceira seq
--

ALTER TABLE ONLY public."TransacaoFinanceira" ALTER COLUMN seq SET DEFAULT nextval('public."TransacaoFinanceira_seq_seq"'::regclass);


--
-- DEFAULT: public.Usuario id
--

ALTER TABLE ONLY public."Usuario" ALTER COLUMN id SET DEFAULT nextval('public."Usuario_id_seq"'::regclass);


--
-- DEFAULT: public.UsuarioWhatsapp id
--

ALTER TABLE ONLY public."UsuarioWhatsapp" ALTER COLUMN id SET DEFAULT nextval('public."UsuarioWhatsapp_id_seq"'::regclass);


--
-- CONSTRAINT: pecuaria.AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_pkey
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.AlocacaoLeiteEstoque AlocacaoLeiteEstoque_pkey
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_exameAnimalId_key
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_exameAnimalId_key" UNIQUE ("exameAnimalId");


--
-- CONSTRAINT: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_pkey
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Animal Animal_pkey
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_pkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ApropriacaoValorLeite ApropriacaoValorLeite_pkey
--

ALTER TABLE ONLY pecuaria."ApropriacaoValorLeite"
    ADD CONSTRAINT "ApropriacaoValorLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ApuracaoValorLeite ApuracaoValorLeite_pkey
--

ALTER TABLE ONLY pecuaria."ApuracaoValorLeite"
    ADD CONSTRAINT "ApuracaoValorLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.AtividadeVisita AtividadeVisita_pkey
--

ALTER TABLE ONLY pecuaria."AtividadeVisita"
    ADD CONSTRAINT "AtividadeVisita_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.AuditoriaPecuaria AuditoriaPecuaria_pkey
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.InterpretacaoReprodutiva AvaliacaoReprodutiva_pkey
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.BaixaAnimal BaixaAnimal_pkey
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.CategoriaAnimal CategoriaAnimal_pkey
--

ALTER TABLE ONLY pecuaria."CategoriaAnimal"
    ADD CONSTRAINT "CategoriaAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.CategoriaManualAnimal CategoriaManualAnimal_pkey
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_aplicacaoId_key
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_aplicacaoId_key" UNIQUE ("aplicacaoId");


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_exameId_key
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_exameId_key" UNIQUE ("exameId");


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_manejoId_key
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_manejoId_key" UNIQUE ("manejoId");


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoConsumoId_key
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoConsumoId_key" UNIQUE ("participacaoConsumoId");


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoId_key
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoId_key" UNIQUE ("participacaoId");


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_pkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_tentativaId_key
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_tentativaId_key" UNIQUE ("tentativaId");


--
-- CONSTRAINT: pecuaria.ClassificacaoEntradaLeite ClassificacaoEntradaLeite_pkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoEntradaLeite"
    ADD CONSTRAINT "ClassificacaoEntradaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ComposicaoGenitorExterno ComposicaoGenitorExterno_pkey
--

ALTER TABLE ONLY pecuaria."ComposicaoGenitorExterno"
    ADD CONSTRAINT "ComposicaoGenitorExterno_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ComposicaoRacial ComposicaoRacial_pkey
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ComprovanteEntregaLeite ComprovanteEntregaLeite_pkey
--

ALTER TABLE ONLY pecuaria."ComprovanteEntregaLeite"
    ADD CONSTRAINT "ComprovanteEntregaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ComprovanteRetiradaOperacaoLeite ComprovanteRetiradaOperacaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."ComprovanteRetiradaOperacaoLeite"
    ADD CONSTRAINT "ComprovanteRetiradaOperacaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ConferenciaEntregaLeite ConferenciaEntregaLeite_pkey
--

ALTER TABLE ONLY pecuaria."ConferenciaEntregaLeite"
    ADD CONSTRAINT "ConferenciaEntregaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ConferenciaSaldoLeite ConferenciaSaldoLeite_pkey
--

ALTER TABLE ONLY pecuaria."ConferenciaSaldoLeite"
    ADD CONSTRAINT "ConferenciaSaldoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ConfiguracaoOrdenha ConfiguracaoOrdenha_pkey
--

ALTER TABLE ONLY pecuaria."ConfiguracaoOrdenha"
    ADD CONSTRAINT "ConfiguracaoOrdenha_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.CriaParto CriaParto_pkey
--

ALTER TABLE ONLY pecuaria."CriaParto"
    ADD CONSTRAINT "CriaParto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_pkey
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_exameResolucaoId_key
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_exameResolucaoId_key" UNIQUE ("exameResolucaoId");


--
-- CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_pkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_tarefaId_key
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_tarefaId_key" UNIQUE ("tarefaId");


--
-- CONSTRAINT: pecuaria.DemonstrativoLeite DemonstrativoLeite_pkey
--

ALTER TABLE ONLY pecuaria."DemonstrativoLeite"
    ADD CONSTRAINT "DemonstrativoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DescarteLeite DescarteLeite_pkey
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DestinoInternoLeite DestinoInternoLeite_pkey
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DetalheFechamentoLeite DetalheFechamentoLeite_pkey
--

ALTER TABLE ONLY pecuaria."DetalheFechamentoLeite"
    ADD CONSTRAINT "DetalheFechamentoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.DiaProducaoLeite DiaProducaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."DiaProducaoLeite"
    ADD CONSTRAINT "DiaProducaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Dieta Dieta_pkey
--

ALTER TABLE ONLY pecuaria."Dieta"
    ADD CONSTRAINT "Dieta_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Doenca Doenca_pkey
--

ALTER TABLE ONLY pecuaria."Doenca"
    ADD CONSTRAINT "Doenca_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.EmissaoRelatorioLeite EmissaoRelatorioLeite_pkey
--

ALTER TABLE ONLY pecuaria."EmissaoRelatorioLeite"
    ADD CONSTRAINT "EmissaoRelatorioLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.EntregaLeite EntregaLeite_pkey
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocoloSanitario_pkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.EventoTarefaProtocolo EventoTarefaProtocolo_pkey
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_pkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_pkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ExposicaoTouro ExposicaoTouro_pkey
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.FechamentoConsumo FechamentoConsumo_pkey
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.FechamentoConsumo FechamentoConsumo_sem_sobreposicao
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_sem_sobreposicao" EXCLUDE USING gist ("loteId" WITH =, daterange(inicio, (fim + 1), '[)'::text) WITH &&) WHERE ((status = 'CONFIRMADO'::pecuaria."StatusFechamentoConsumo"));


--
-- CONSTRAINT: pecuaria.FechamentoOperacaoLeite FechamentoOperacaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."FechamentoOperacaoLeite"
    ADD CONSTRAINT "FechamentoOperacaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.FinalidadeAnimal FinalidadeAnimal_pkey
--

ALTER TABLE ONLY pecuaria."FinalidadeAnimal"
    ADD CONSTRAINT "FinalidadeAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.FormatoQualidadeLeite FormatoQualidadeLeite_chave_key
--

ALTER TABLE ONLY pecuaria."FormatoQualidadeLeite"
    ADD CONSTRAINT "FormatoQualidadeLeite_chave_key" UNIQUE (chave);


--
-- CONSTRAINT: pecuaria.FormatoQualidadeLeite FormatoQualidadeLeite_pkey
--

ALTER TABLE ONLY pecuaria."FormatoQualidadeLeite"
    ADD CONSTRAINT "FormatoQualidadeLeite_pkey" PRIMARY KEY ("tipoExameId");


--
-- CONSTRAINT: pecuaria.FornecimentoColostro FornecimentoColostro_pkey
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_itemId_key
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_itemId_key" UNIQUE ("itemId");


--
-- CONSTRAINT: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_pkey
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.GenitorExterno GenitorExterno_pkey
--

ALTER TABLE ONLY pecuaria."GenitorExterno"
    ADD CONSTRAINT "GenitorExterno_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.GestacaoAnimal GestacaoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_pkey" PRIMARY KEY (id);


--
-- CHECK CONSTRAINT: pecuaria.GestacaoAnimal Gestacao_perda_explicada
--

ALTER TABLE pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "Gestacao_perda_explicada" CHECK ((("tipoEncerramento" IS DISTINCT FROM 'PERDA'::text) OR (("motivoEncerramento" IS NOT NULL) AND (length(TRIM(BOTH FROM "motivoEncerramento")) >= 5)))) NOT VALID;


--
-- CONSTRAINT: pecuaria.HistoricoPrevisaoParto HistoricoPrevisaoParto_pkey
--

ALTER TABLE ONLY pecuaria."HistoricoPrevisaoParto"
    ADD CONSTRAINT "HistoricoPrevisaoParto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ImpressaoVisita ImpressaoVisita_pkey
--

ALTER TABLE ONLY pecuaria."ImpressaoVisita"
    ADD CONSTRAINT "ImpressaoVisita_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ItemDieta ItemDieta_pkey
--

ALTER TABLE ONLY pecuaria."ItemDieta"
    ADD CONSTRAINT "ItemDieta_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ItemFechamentoConsumo ItemFechamentoConsumo_pkey
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.LactacaoAnimal LactacaoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.LactacaoAnimal LactacaoAnimal_sem_sobreposicao
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_sem_sobreposicao" EXCLUDE USING gist ("animalId" WITH =, daterange(inicio,
CASE
    WHEN ("encerradaEm" = inicio) THEN (inicio + 1)
    ELSE "encerradaEm"
END, '[)'::text) WITH &&);


--
-- CONSTRAINT: pecuaria.LaudoQualidadeLeite LaudoQualidadeLeite_amostraId_sha256_key
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_amostraId_sha256_key" UNIQUE ("amostraId", sha256);


--
-- CONSTRAINT: pecuaria.LaudoQualidadeLeite LaudoQualidadeLeite_pkey
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.LaudoQualidadeLeite LaudoQualidadeLeite_storageKey_key
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_storageKey_key" UNIQUE ("storageKey");


--
-- CONSTRAINT: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Lote Lote_pkey
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_pkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_pkey
--

ALTER TABLE ONLY pecuaria."MedicaoGeralLeite"
    ADD CONSTRAINT "MedicaoGeralLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MedicaoLeite MedicaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."MedicaoLeite"
    ADD CONSTRAINT "MedicaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MomentoProtocolo MomentoProtocolo_id_protocoloId_key
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_id_protocoloId_key" UNIQUE (id, "protocoloId");


--
-- CONSTRAINT: pecuaria.MomentoProtocolo MomentoProtocolo_pkey
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MomentoProtocolo MomentoProtocolo_protocoloId_ordem_key
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_protocoloId_ordem_key" UNIQUE ("protocoloId", ordem);


--
-- CONSTRAINT: pecuaria.MotivoBaixa MotivoBaixa_pkey
--

ALTER TABLE ONLY pecuaria."MotivoBaixa"
    ADD CONSTRAINT "MotivoBaixa_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MovimentacaoAnimal MovimentacaoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Movimentacao Movimentacao_pkey
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_movimentoId_key
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_movimentoId_key" UNIQUE ("movimentoId");


--
-- CONSTRAINT: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_pkey
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.OcorrenciaSanitaria OcorrenciaSanitaria_pkey
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.OperacaoComercialLeite OperacaoComercialLeite_pkey
--

ALTER TABLE ONLY pecuaria."OperacaoComercialLeite"
    ADD CONSTRAINT "OperacaoComercialLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParcelaDestinoLeite ParcelaDestinoLeite_pkey
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_fornecimentoId_animalId_key
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_fornecimentoId_animalId_key" UNIQUE ("fornecimentoId", "animalId");


--
-- CONSTRAINT: pecuaria.ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_pkey
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoAnimal"
    ADD CONSTRAINT "ParticipacaoConsumoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParticipacaoExposicao ParticipacaoExposicao_pkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoExposicao"
    ADD CONSTRAINT "ParticipacaoExposicao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParticipacaoProtocolo ParticipacaoProtocolo_legadoIatfId_key
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ParticipacaoProtocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- CONSTRAINT: pecuaria.ParticipacaoProtocolo ParticipacaoProtocolo_referenciaExterna_key
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ParticipacaoProtocolo_referenciaExterna_key" UNIQUE ("referenciaExterna");


--
-- CONSTRAINT: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ParticipanteVisita ParticipanteVisita_pkey
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PartoAnimal PartoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PerfilNutricionalProduto PerfilNutricionalProduto_pkey
--

ALTER TABLE ONLY pecuaria."PerfilNutricionalProduto"
    ADD CONSTRAINT "PerfilNutricionalProduto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PerfilSanitarioProduto PerfilSanitarioProduto_pkey
--

ALTER TABLE ONLY pecuaria."PerfilSanitarioProduto"
    ADD CONSTRAINT "PerfilSanitarioProduto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_referenciaExterna_key
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_referenciaExterna_key" UNIQUE ("referenciaExterna");


--
-- CONSTRAINT: pecuaria.Pesagem Pesagem_pkey
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutiv_propriedadeId_vigenteDesde_key
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutiv_propriedadeId_vigenteDesde_key" UNIQUE ("propriedadeId", "vigenteDesde");


--
-- CONSTRAINT: pecuaria.PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutivo_pkey
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutivo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutivo_propriedadeId_versao_key
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutivo_propriedadeId_versao_key" UNIQUE ("propriedadeId", versao);


--
-- CONSTRAINT: pecuaria.PoliticaElegibilidadeReprodutiva PoliticaElegibilidadeReprodutiva_pkey
--

ALTER TABLE ONLY pecuaria."PoliticaElegibilidadeReprodutiva"
    ADD CONSTRAINT "PoliticaElegibilidadeReprodutiva_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.PosicaoOrdenha PosicaoOrdenha_pkey
--

ALTER TABLE ONLY pecuaria."PosicaoOrdenha"
    ADD CONSTRAINT "PosicaoOrdenha_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ProgramacaoProtocolo ProgramacaoProtocolo_legadoIatfId_key
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "ProgramacaoProtocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- CONSTRAINT: pecuaria.ProgramacaoProtocolo ProgramacaoProtocolo_referenciaExterna_key
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "ProgramacaoProtocolo_referenciaExterna_key" UNIQUE ("referenciaExterna");


--
-- CONSTRAINT: pecuaria.ProgramacaoRetiradaLeite ProgramacaoRetiradaLeite_pkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoRetiradaLeite"
    ADD CONSTRAINT "ProgramacaoRetiradaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Protocolo ProtocoloSanitario_pkey
--

ALTER TABLE ONLY pecuaria."Protocolo"
    ADD CONSTRAINT "ProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.Protocolo Protocolo_legadoIatfId_key
--

ALTER TABLE ONLY pecuaria."Protocolo"
    ADD CONSTRAINT "Protocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- CONSTRAINT: pecuaria.Raca Raca_pkey
--

ALTER TABLE ONLY pecuaria."Raca"
    ADD CONSTRAINT "Raca_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_fornecimentoId_fechamentoId_key
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fornecimentoId_fechamentoId_key" UNIQUE ("fornecimentoId", "fechamentoId");


--
-- CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_fornecimentoId_versao_key
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fornecimentoId_versao_key" UNIQUE ("fornecimentoId", versao);


--
-- CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_pkey
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.RegraSanitariaReprodutiva RegraSanitariaReprodutiva_pkey
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.RequisicaoPecuaria RequisicaoPecuaria_pkey
--

ALTER TABLE ONLY pecuaria."RequisicaoPecuaria"
    ADD CONSTRAINT "RequisicaoPecuaria_pkey" PRIMARY KEY (chave);


--
-- CONSTRAINT: pecuaria.RestricaoReprodutiva RestricaoReprodutiva_pkey
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ResultadoExame ResultadoExame_pkey
--

ALTER TABLE ONLY pecuaria."ResultadoExame"
    ADD CONSTRAINT "ResultadoExame_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ResultadoQualidadeLeite ResultadoQualidadeLeite_pkey
--

ALTER TABLE ONLY pecuaria."ResultadoQualidadeLeite"
    ADD CONSTRAINT "ResultadoQualidadeLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.RetiradaOperacaoLeite RetiradaOperacaoLeite_pkey
--

ALTER TABLE ONLY pecuaria."RetiradaOperacaoLeite"
    ADD CONSTRAINT "RetiradaOperacaoLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.ProgramacaoProtocolo RodadaProtocoloSanitario_pkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "RodadaProtocoloSanitario_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.SegmentoConsumoAnimal SegmentoConsumoAnimal_participacaoId_desde_key
--

ALTER TABLE ONLY pecuaria."SegmentoConsumoAnimal"
    ADD CONSTRAINT "SegmentoConsumoAnimal_participacaoId_desde_key" UNIQUE ("participacaoId", desde);


--
-- CONSTRAINT: pecuaria.SegmentoConsumoAnimal SegmentoConsumoAnimal_pkey
--

ALTER TABLE ONLY pecuaria."SegmentoConsumoAnimal"
    ADD CONSTRAINT "SegmentoConsumoAnimal_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.SelecaoVisita SelecaoVisita_pkey
--

ALTER TABLE ONLY pecuaria."SelecaoVisita"
    ADD CONSTRAINT "SelecaoVisita_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.SessaoOrdenha SessaoOrdenha_pkey
--

ALTER TABLE ONLY pecuaria."SessaoOrdenha"
    ADD CONSTRAINT "SessaoOrdenha_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.SituacaoInicialReprodutiva SituacaoInicialReprodutiva_pkey
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_pkey
--

ALTER TABLE ONLY pecuaria."SnapshotRelatorioReprodutivo"
    ADD CONSTRAINT "SnapshotRelatorioReprodutivo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.TanqueLeite TanqueLeite_pkey
--

ALTER TABLE ONLY pecuaria."TanqueLeite"
    ADD CONSTRAINT "TanqueLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.TarefaProtocolo TarefaProtocolo_legadoIatfId_key
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaProtocolo_legadoIatfId_key" UNIQUE ("legadoIatfId");


--
-- CONSTRAINT: pecuaria.TarefaProtocolo TarefaSanitaria_pkey
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaSanitaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_pkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.TipoAplicacaoSanitaria TipoAplicacaoSanitaria_nome_key
--

ALTER TABLE ONLY pecuaria."TipoAplicacaoSanitaria"
    ADD CONSTRAINT "TipoAplicacaoSanitaria_nome_key" UNIQUE (nome);


--
-- CONSTRAINT: pecuaria.TipoAplicacaoSanitaria TipoAplicacaoSanitaria_pkey
--

ALTER TABLE ONLY pecuaria."TipoAplicacaoSanitaria"
    ADD CONSTRAINT "TipoAplicacaoSanitaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.TipoExame TipoExame_pkey
--

ALTER TABLE ONLY pecuaria."TipoExame"
    ADD CONSTRAINT "TipoExame_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VersaoComercialVendaLeite VersaoComercialVendaLeite_pkey
--

ALTER TABLE ONLY pecuaria."VersaoComercialVendaLeite"
    ADD CONSTRAINT "VersaoComercialVendaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VersaoSelecaoVisita VersaoSelecaoVisita_pkey
--

ALTER TABLE ONLY pecuaria."VersaoSelecaoVisita"
    ADD CONSTRAINT "VersaoSelecaoVisita_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VigenciaDietaLote VigenciaDietaLote_pkey
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VigenciaDietaLote VigenciaDietaLote_sem_sobreposicao
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_sem_sobreposicao" EXCLUDE USING gist ("loteId" WITH =, daterange(desde, ate, '[)'::text) WITH &&);


--
-- CONSTRAINT: pecuaria.VinculoImportacaoPecuaria VinculoImportacaoPecuaria_pkey
--

ALTER TABLE ONLY pecuaria."VinculoImportacaoPecuaria"
    ADD CONSTRAINT "VinculoImportacaoPecuaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_pkey
--

ALTER TABLE ONLY pecuaria."VinculoMedicaoEntradaLeite"
    ADD CONSTRAINT "VinculoMedicaoEntradaLeite_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VinculoPesagemParto VinculoPesagemParto_pkey
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_pkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VinculoPreparoTentativa VinculoPreparoTentativa_pkey
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_pkey
--

ALTER TABLE ONLY pecuaria."VinculoQualidadeFechamentoLeite"
    ADD CONSTRAINT "VinculoQualidadeFechamentoLeite_pkey" PRIMARY KEY ("fechamentoId", "amostraId");


--
-- CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_manejoId_key
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_manejoId_key" UNIQUE ("manejoId");


--
-- CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_pkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: pecuaria.VisitaVeterinaria VisitaVeterinaria_pkey
--

ALTER TABLE ONLY pecuaria."VisitaVeterinaria"
    ADD CONSTRAINT "VisitaVeterinaria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.AlocacaoPartidaEstoque AlocacaoPartidaEstoque_pkey
--

ALTER TABLE ONLY public."AlocacaoPartidaEstoque"
    ADD CONSTRAINT "AlocacaoPartidaEstoque_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.AuditoriaFinanceira AuditoriaFinanceira_pkey
--

ALTER TABLE ONLY public."AuditoriaFinanceira"
    ADD CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.BaseValorizacaoEstoque BaseValorizacaoEstoque_pkey
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.Categoria Categoria_pkey
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.CentroCusto CentroCusto_pkey
--

ALTER TABLE ONLY public."CentroCusto"
    ADD CONSTRAINT "CentroCusto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.CompromissoFinanceiro CompromissoFinanceiro_pkey
--

ALTER TABLE ONLY public."CompromissoFinanceiro"
    ADD CONSTRAINT "CompromissoFinanceiro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.ContaFinanceira ContaFinanceira_pkey
--

ALTER TABLE ONLY public."ContaFinanceira"
    ADD CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.ConversaWhatsapp ConversaWhatsapp_pkey
--

ALTER TABLE ONLY public."ConversaWhatsapp"
    ADD CONSTRAINT "ConversaWhatsapp_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.DocumentoFinanceiro DocumentoFinanceiro_pkey
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.GrupoCategoria GrupoCategoria_pkey
--

ALTER TABLE ONLY public."GrupoCategoria"
    ADD CONSTRAINT "GrupoCategoria_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.ItemOperacao ItemOperacao_pkey
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.Liquidacao Liquidacao_pkey
--

ALTER TABLE ONLY public."Liquidacao"
    ADD CONSTRAINT "Liquidacao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.MensagemWhatsapp MensagemWhatsapp_pkey
--

ALTER TABLE ONLY public."MensagemWhatsapp"
    ADD CONSTRAINT "MensagemWhatsapp_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.MovimentoConta MovimentoConta_pkey
--

ALTER TABLE ONLY public."MovimentoConta"
    ADD CONSTRAINT "MovimentoConta_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_pkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.Operacao Operacao_pkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.ParceiroPapel ParceiroPapel_pkey
--

ALTER TABLE ONLY public."ParceiroPapel"
    ADD CONSTRAINT "ParceiroPapel_pkey" PRIMARY KEY ("parceiroId", papel);


--
-- CONSTRAINT: public.Parceiro Parceiro_pkey
--

ALTER TABLE ONLY public."Parceiro"
    ADD CONSTRAINT "Parceiro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.ParcelaValorizacaoEstoque ParcelaValorizacaoEstoque_pkey
--

ALTER TABLE ONLY public."ParcelaValorizacaoEstoque"
    ADD CONSTRAINT "ParcelaValorizacaoEstoque_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.PartidaProduto PartidaProduto_pkey
--

ALTER TABLE ONLY public."PartidaProduto"
    ADD CONSTRAINT "PartidaProduto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.PeriodoFinanceiro PeriodoFinanceiro_pkey
--

ALTER TABLE ONLY public."PeriodoFinanceiro"
    ADD CONSTRAINT "PeriodoFinanceiro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.ProdutoCentroCusto ProdutoCentroCusto_pkey
--

ALTER TABLE ONLY public."ProdutoCentroCusto"
    ADD CONSTRAINT "ProdutoCentroCusto_pkey" PRIMARY KEY ("produtoId", "centroCustoId");


--
-- CONSTRAINT: public.ProdutoFornecedor ProdutoFornecedor_pkey
--

ALTER TABLE ONLY public."ProdutoFornecedor"
    ADD CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("produtoId", "fornecedorId");


--
-- CONSTRAINT: public.Produto Produto_pkey
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.Propriedade Propriedade_pkey
--

ALTER TABLE ONLY public."Propriedade"
    ADD CONSTRAINT "Propriedade_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.RascunhoOperacao RascunhoOperacao_pkey
--

ALTER TABLE ONLY public."RascunhoOperacao"
    ADD CONSTRAINT "RascunhoOperacao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.RascunhoRelatorioFinanceiro RascunhoRelatorioFinanceiro_pkey
--

ALTER TABLE ONLY public."RascunhoRelatorioFinanceiro"
    ADD CONSTRAINT "RascunhoRelatorioFinanceiro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.RelatorioFinanceiro RelatorioFinanceiro_pkey
--

ALTER TABLE ONLY public."RelatorioFinanceiro"
    ADD CONSTRAINT "RelatorioFinanceiro_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.Sessao Sessao_pkey
--

ALTER TABLE ONLY public."Sessao"
    ADD CONSTRAINT "Sessao_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.TokenAcesso TokenAcesso_pkey
--

ALTER TABLE ONLY public."TokenAcesso"
    ADD CONSTRAINT "TokenAcesso_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.TransacaoFinanceira TransacaoFinanceira_pkey
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.UsuarioWhatsapp UsuarioWhatsapp_pkey
--

ALTER TABLE ONLY public."UsuarioWhatsapp"
    ADD CONSTRAINT "UsuarioWhatsapp_pkey" PRIMARY KEY (id);


--
-- CONSTRAINT: public.Usuario Usuario_pkey
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- INDEX: pecuaria.AlocacaoDemonstrativoLeite_demonstrativoId_entregaId_key
--

CREATE UNIQUE INDEX "AlocacaoDemonstrativoLeite_demonstrativoId_entregaId_key" ON pecuaria."AlocacaoDemonstrativoLeite" USING btree ("demonstrativoId", "entregaId");


--
-- INDEX: pecuaria.AlocacaoDemonstrativoLeite_entregaId_ativo_idx
--

CREATE INDEX "AlocacaoDemonstrativoLeite_entregaId_ativo_idx" ON pecuaria."AlocacaoDemonstrativoLeite" USING btree ("entregaId", ativo);


--
-- INDEX: pecuaria.AlocacaoLeiteEstoque_entradaId_movimentoId_key
--

CREATE UNIQUE INDEX "AlocacaoLeiteEstoque_entradaId_movimentoId_key" ON pecuaria."AlocacaoLeiteEstoque" USING btree ("entradaId", "movimentoId");


--
-- INDEX: pecuaria.AlocacaoLeiteEstoque_movimentoId_idx
--

CREATE INDEX "AlocacaoLeiteEstoque_movimentoId_idx" ON pecuaria."AlocacaoLeiteEstoque" USING btree ("movimentoId");


--
-- INDEX: pecuaria.AmostraQualidadeLeite_entradaId_idx
--

CREATE INDEX "AmostraQualidadeLeite_entradaId_idx" ON pecuaria."AmostraQualidadeLeite" USING btree ("entradaId");


--
-- INDEX: pecuaria.AmostraQualidadeLeite_propriedadeId_data_idx
--

CREATE INDEX "AmostraQualidadeLeite_propriedadeId_data_idx" ON pecuaria."AmostraQualidadeLeite" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.AmostraQualidadeLeite_tipoExameId_idx
--

CREATE INDEX "AmostraQualidadeLeite_tipoExameId_idx" ON pecuaria."AmostraQualidadeLeite" USING btree ("tipoExameId");


--
-- INDEX: pecuaria.Animal_brincoEletronico_key
--

CREATE UNIQUE INDEX "Animal_brincoEletronico_key" ON pecuaria."Animal" USING btree ("brincoEletronico");


--
-- INDEX: pecuaria.Animal_brinco_idx
--

CREATE INDEX "Animal_brinco_idx" ON pecuaria."Animal" USING btree (brinco);


--
-- INDEX: pecuaria.Animal_codigoProvisorio_key
--

CREATE UNIQUE INDEX "Animal_codigoProvisorio_key" ON pecuaria."Animal" USING btree ("codigoProvisorio");


--
-- INDEX: pecuaria.Animal_ideagriId_key
--

CREATE UNIQUE INDEX "Animal_ideagriId_key" ON pecuaria."Animal" USING btree ("ideagriId");


--
-- INDEX: pecuaria.Animal_maeExternaId_idx
--

CREATE INDEX "Animal_maeExternaId_idx" ON pecuaria."Animal" USING btree ("maeExternaId");


--
-- INDEX: pecuaria.Animal_maeId_idx
--

CREATE INDEX "Animal_maeId_idx" ON pecuaria."Animal" USING btree ("maeId");


--
-- INDEX: pecuaria.Animal_paiExternoId_idx
--

CREATE INDEX "Animal_paiExternoId_idx" ON pecuaria."Animal" USING btree ("paiExternoId");


--
-- INDEX: pecuaria.Animal_paiId_idx
--

CREATE INDEX "Animal_paiId_idx" ON pecuaria."Animal" USING btree ("paiId");


--
-- INDEX: pecuaria.Animal_sisbov_key
--

CREATE UNIQUE INDEX "Animal_sisbov_key" ON pecuaria."Animal" USING btree (sisbov);


--
-- INDEX: pecuaria.AplicacaoProduto_animalId_data_idx
--

CREATE INDEX "AplicacaoProduto_animalId_data_idx" ON pecuaria."AplicacaoProduto" USING btree ("animalId", data);


--
-- INDEX: pecuaria.AplicacaoProduto_itemCompraDiretaId_idx
--

CREATE INDEX "AplicacaoProduto_itemCompraDiretaId_idx" ON pecuaria."AplicacaoProduto" USING btree ("itemCompraDiretaId");


--
-- INDEX: pecuaria.AplicacaoProduto_movimentoEstoqueId_key
--

CREATE UNIQUE INDEX "AplicacaoProduto_movimentoEstoqueId_key" ON pecuaria."AplicacaoProduto" USING btree ("movimentoEstoqueId");


--
-- INDEX: pecuaria.AplicacaoProduto_operacaoServicoId_idx
--

CREATE INDEX "AplicacaoProduto_operacaoServicoId_idx" ON pecuaria."AplicacaoProduto" USING btree ("operacaoServicoId");


--
-- INDEX: pecuaria.AplicacaoProduto_propriedadeId_data_idx
--

CREATE INDEX "AplicacaoProduto_propriedadeId_data_idx" ON pecuaria."AplicacaoProduto" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.AplicacaoProduto_tarefaId_idx
--

CREATE INDEX "AplicacaoProduto_tarefaId_idx" ON pecuaria."AplicacaoProduto" USING btree ("tarefaId");


--
-- INDEX: pecuaria.AplicacaoProduto_tarefaId_valida_key
--

CREATE UNIQUE INDEX "AplicacaoProduto_tarefaId_valida_key" ON pecuaria."AplicacaoProduto" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("tarefaId" IS NOT NULL));


--
-- INDEX: pecuaria.ApropriacaoValorLeite_alocacaoId_idx
--

CREATE INDEX "ApropriacaoValorLeite_alocacaoId_idx" ON pecuaria."ApropriacaoValorLeite" USING btree ("alocacaoId");


--
-- INDEX: pecuaria.ApropriacaoValorLeite_apuracaoId_alocacaoId_key
--

CREATE UNIQUE INDEX "ApropriacaoValorLeite_apuracaoId_alocacaoId_key" ON pecuaria."ApropriacaoValorLeite" USING btree ("apuracaoId", "alocacaoId");


--
-- INDEX: pecuaria.ApuracaoValorLeite_chave_key
--

CREATE UNIQUE INDEX "ApuracaoValorLeite_chave_key" ON pecuaria."ApuracaoValorLeite" USING btree (chave);


--
-- INDEX: pecuaria.ApuracaoValorLeite_entradaId_versao_key
--

CREATE UNIQUE INDEX "ApuracaoValorLeite_entradaId_versao_key" ON pecuaria."ApuracaoValorLeite" USING btree ("entradaId", versao);


--
-- INDEX: pecuaria.AtividadeVisita_visitaId_ordem_key
--

CREATE UNIQUE INDEX "AtividadeVisita_visitaId_ordem_key" ON pecuaria."AtividadeVisita" USING btree ("visitaId", ordem);


--
-- INDEX: pecuaria.AuditoriaPecuaria_animalId_em_idx
--

CREATE INDEX "AuditoriaPecuaria_animalId_em_idx" ON pecuaria."AuditoriaPecuaria" USING btree ("animalId", em);


--
-- INDEX: pecuaria.AuditoriaPecuaria_em_idx
--

CREATE INDEX "AuditoriaPecuaria_em_idx" ON pecuaria."AuditoriaPecuaria" USING btree (em);


--
-- INDEX: pecuaria.AuditoriaPecuaria_entidade_entidadeId_idx
--

CREATE INDEX "AuditoriaPecuaria_entidade_entidadeId_idx" ON pecuaria."AuditoriaPecuaria" USING btree (entidade, "entidadeId");


--
-- INDEX: pecuaria.AvaliacaoReprodutiva_referenciaExterna_key
--

CREATE UNIQUE INDEX "AvaliacaoReprodutiva_referenciaExterna_key" ON pecuaria."InterpretacaoReprodutiva" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.AvaliacaoReprodutiva_restricaoId_key
--

CREATE UNIQUE INDEX "AvaliacaoReprodutiva_restricaoId_key" ON pecuaria."InterpretacaoReprodutiva" USING btree ("restricaoId");


--
-- INDEX: pecuaria.BaixaAnimal_animalId_ativa_key
--

CREATE UNIQUE INDEX "BaixaAnimal_animalId_ativa_key" ON pecuaria."BaixaAnimal" USING btree ("animalId") WHERE ("estornadaEm" IS NULL);


--
-- INDEX: pecuaria.BaixaAnimal_animalId_idx
--

CREATE INDEX "BaixaAnimal_animalId_idx" ON pecuaria."BaixaAnimal" USING btree ("animalId");


--
-- INDEX: pecuaria.BaixaAnimal_data_idx
--

CREATE INDEX "BaixaAnimal_data_idx" ON pecuaria."BaixaAnimal" USING btree (data);


--
-- INDEX: pecuaria.BaixaAnimal_destinoFechadoId_idx
--

CREATE INDEX "BaixaAnimal_destinoFechadoId_idx" ON pecuaria."BaixaAnimal" USING btree ("destinoFechadoId");


--
-- INDEX: pecuaria.BaixaAnimal_ideagriId_key
--

CREATE UNIQUE INDEX "BaixaAnimal_ideagriId_key" ON pecuaria."BaixaAnimal" USING btree ("ideagriId");


--
-- INDEX: pecuaria.BaixaAnimal_localizacaoFechadaId_idx
--

CREATE INDEX "BaixaAnimal_localizacaoFechadaId_idx" ON pecuaria."BaixaAnimal" USING btree ("localizacaoFechadaId");


--
-- INDEX: pecuaria.CategoriaAnimal_chavePadrao_key
--

CREATE UNIQUE INDEX "CategoriaAnimal_chavePadrao_key" ON pecuaria."CategoriaAnimal" USING btree ("chavePadrao");


--
-- INDEX: pecuaria.CategoriaAnimal_ideagriId_key
--

CREATE UNIQUE INDEX "CategoriaAnimal_ideagriId_key" ON pecuaria."CategoriaAnimal" USING btree ("ideagriId");


--
-- INDEX: pecuaria.CategoriaAnimal_sexo_nome_key
--

CREATE UNIQUE INDEX "CategoriaAnimal_sexo_nome_key" ON pecuaria."CategoriaAnimal" USING btree (sexo, nome);


--
-- INDEX: pecuaria.CategoriaManualAnimal_animalId_aberta_key
--

CREATE UNIQUE INDEX "CategoriaManualAnimal_animalId_aberta_key" ON pecuaria."CategoriaManualAnimal" USING btree ("animalId") WHERE (ate IS NULL);


--
-- INDEX: pecuaria.CategoriaManualAnimal_animalId_ate_idx
--

CREATE INDEX "CategoriaManualAnimal_animalId_ate_idx" ON pecuaria."CategoriaManualAnimal" USING btree ("animalId", ate);


--
-- INDEX: pecuaria.CategoriaManualAnimal_categoriaId_ate_idx
--

CREATE INDEX "CategoriaManualAnimal_categoriaId_ate_idx" ON pecuaria."CategoriaManualAnimal" USING btree ("categoriaId", ate);


--
-- INDEX: pecuaria.ClassificacaoEntradaLeite_entradaId_versao_key
--

CREATE UNIQUE INDEX "ClassificacaoEntradaLeite_entradaId_versao_key" ON pecuaria."ClassificacaoEntradaLeite" USING btree ("entradaId", versao);


--
-- INDEX: pecuaria.ClassificacaoEntradaLeite_id_entradaId_key
--

CREATE UNIQUE INDEX "ClassificacaoEntradaLeite_id_entradaId_key" ON pecuaria."ClassificacaoEntradaLeite" USING btree (id, "entradaId");


--
-- INDEX: pecuaria.ComposicaoGenitorExterno_genitorId_racaId_key
--

CREATE UNIQUE INDEX "ComposicaoGenitorExterno_genitorId_racaId_key" ON pecuaria."ComposicaoGenitorExterno" USING btree ("genitorId", "racaId");


--
-- INDEX: pecuaria.ComposicaoGenitorExterno_racaId_idx
--

CREATE INDEX "ComposicaoGenitorExterno_racaId_idx" ON pecuaria."ComposicaoGenitorExterno" USING btree ("racaId");


--
-- INDEX: pecuaria.ComposicaoRacial_animalId_racaId_key
--

CREATE UNIQUE INDEX "ComposicaoRacial_animalId_racaId_key" ON pecuaria."ComposicaoRacial" USING btree ("animalId", "racaId");


--
-- INDEX: pecuaria.ComposicaoRacial_racaId_idx
--

CREATE INDEX "ComposicaoRacial_racaId_idx" ON pecuaria."ComposicaoRacial" USING btree ("racaId");


--
-- INDEX: pecuaria.ComprovanteEntregaLeite_entregaId_sha256_key
--

CREATE UNIQUE INDEX "ComprovanteEntregaLeite_entregaId_sha256_key" ON pecuaria."ComprovanteEntregaLeite" USING btree ("entregaId", sha256);


--
-- INDEX: pecuaria.ComprovanteEntregaLeite_storageKey_key
--

CREATE UNIQUE INDEX "ComprovanteEntregaLeite_storageKey_key" ON pecuaria."ComprovanteEntregaLeite" USING btree ("storageKey");


--
-- INDEX: pecuaria.ComprovanteRetiradaOperacaoLeite_retiradaId_sha256_key
--

CREATE UNIQUE INDEX "ComprovanteRetiradaOperacaoLeite_retiradaId_sha256_key" ON pecuaria."ComprovanteRetiradaOperacaoLeite" USING btree ("retiradaId", sha256);


--
-- INDEX: pecuaria.ConferenciaEntregaLeite_entregaId_versao_key
--

CREATE UNIQUE INDEX "ConferenciaEntregaLeite_entregaId_versao_key" ON pecuaria."ConferenciaEntregaLeite" USING btree ("entregaId", versao);


--
-- INDEX: pecuaria.ConferenciaSaldoLeite_propriedadeId_data_idx
--

CREATE INDEX "ConferenciaSaldoLeite_propriedadeId_data_idx" ON pecuaria."ConferenciaSaldoLeite" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.ConferenciaSaldoLeite_propriedadeId_produtoId_data_versao_key
--

CREATE UNIQUE INDEX "ConferenciaSaldoLeite_propriedadeId_produtoId_data_versao_key" ON pecuaria."ConferenciaSaldoLeite" USING btree ("propriedadeId", "produtoId", data, versao);


--
-- INDEX: pecuaria.ConfiguracaoOrdenha_id_propriedadeId_key
--

CREATE UNIQUE INDEX "ConfiguracaoOrdenha_id_propriedadeId_key" ON pecuaria."ConfiguracaoOrdenha" USING btree (id, "propriedadeId");


--
-- INDEX: pecuaria.ConfiguracaoOrdenha_propriedadeId_vigenteDesde_key
--

CREATE UNIQUE INDEX "ConfiguracaoOrdenha_propriedadeId_vigenteDesde_key" ON pecuaria."ConfiguracaoOrdenha" USING btree ("propriedadeId", "vigenteDesde");


--
-- INDEX: pecuaria.CriaParto_animalId_key
--

CREATE UNIQUE INDEX "CriaParto_animalId_key" ON pecuaria."CriaParto" USING btree ("animalId");


--
-- INDEX: pecuaria.CriaParto_partoId_ordem_key
--

CREATE UNIQUE INDEX "CriaParto_partoId_ordem_key" ON pecuaria."CriaParto" USING btree ("partoId", ordem);


--
-- INDEX: pecuaria.DecisaoElegibilidadeCiclo_vinculoCicloId_data_idx
--

CREATE INDEX "DecisaoElegibilidadeCiclo_vinculoCicloId_data_idx" ON pecuaria."DecisaoElegibilidadeCiclo" USING btree ("vinculoCicloId", data);


--
-- INDEX: pecuaria.DemandaAcompanhamento_animal_estado_data
--

CREATE INDEX "DemandaAcompanhamento_animal_estado_data" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("animalId", estado, "previstaPara");


--
-- INDEX: pecuaria.DemandaAcompanhamento_diagnostico
--

CREATE UNIQUE INDEX "DemandaAcompanhamento_diagnostico" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("tentativaId", finalidade, ocorrencia) WHERE ("tentativaId" IS NOT NULL);


--
-- INDEX: pecuaria.DemandaAcompanhamento_gestacao
--

CREATE INDEX "DemandaAcompanhamento_gestacao" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("gestacaoId");


--
-- INDEX: pecuaria.DemandaAcompanhamento_origem_estado
--

CREATE INDEX "DemandaAcompanhamento_origem_estado" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("propriedadeOrigemId", estado);


--
-- INDEX: pecuaria.DemandaAcompanhamento_reconfirmacao
--

CREATE UNIQUE INDEX "DemandaAcompanhamento_reconfirmacao" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("gestacaoId", finalidade, ocorrencia) WHERE ("gestacaoId" IS NOT NULL);


--
-- INDEX: pecuaria.DemandaAcompanhamento_tentativa
--

CREATE INDEX "DemandaAcompanhamento_tentativa" ON pecuaria."DemandaAcompanhamentoReprodutivo" USING btree ("tentativaId");


--
-- INDEX: pecuaria.DemonstrativoLeite_propriedadeId_inicio_fim_idx
--

CREATE INDEX "DemonstrativoLeite_propriedadeId_inicio_fim_idx" ON pecuaria."DemonstrativoLeite" USING btree ("propriedadeId", inicio, fim);


--
-- INDEX: pecuaria.DescarteLeite_movimentoEstornoId_key
--

CREATE UNIQUE INDEX "DescarteLeite_movimentoEstornoId_key" ON pecuaria."DescarteLeite" USING btree ("movimentoEstornoId");


--
-- INDEX: pecuaria.DescarteLeite_movimentoId_key
--

CREATE UNIQUE INDEX "DescarteLeite_movimentoId_key" ON pecuaria."DescarteLeite" USING btree ("movimentoId");


--
-- INDEX: pecuaria.DescarteLeite_propriedadeId_data_idx
--

CREATE INDEX "DescarteLeite_propriedadeId_data_idx" ON pecuaria."DescarteLeite" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.DestinoInternoLeite_chave_key
--

CREATE UNIQUE INDEX "DestinoInternoLeite_chave_key" ON pecuaria."DestinoInternoLeite" USING btree (chave);


--
-- INDEX: pecuaria.DestinoInternoLeite_entradaId_idx
--

CREATE INDEX "DestinoInternoLeite_entradaId_idx" ON pecuaria."DestinoInternoLeite" USING btree ("entradaId");


--
-- INDEX: pecuaria.DestinoInternoLeite_movimentoEstornoId_key
--

CREATE UNIQUE INDEX "DestinoInternoLeite_movimentoEstornoId_key" ON pecuaria."DestinoInternoLeite" USING btree ("movimentoEstornoId");


--
-- INDEX: pecuaria.DestinoInternoLeite_movimentoId_key
--

CREATE UNIQUE INDEX "DestinoInternoLeite_movimentoId_key" ON pecuaria."DestinoInternoLeite" USING btree ("movimentoId");


--
-- INDEX: pecuaria.DestinoInternoLeite_propriedadeId_data_idx
--

CREATE INDEX "DestinoInternoLeite_propriedadeId_data_idx" ON pecuaria."DestinoInternoLeite" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.DetalheFechamentoLeite_fechamentoId_retiradaId_key
--

CREATE UNIQUE INDEX "DetalheFechamentoLeite_fechamentoId_retiradaId_key" ON pecuaria."DetalheFechamentoLeite" USING btree ("fechamentoId", "retiradaId");


--
-- INDEX: pecuaria.DiaProducaoLeite_propriedadeId_dataOperacional_key
--

CREATE UNIQUE INDEX "DiaProducaoLeite_propriedadeId_dataOperacional_key" ON pecuaria."DiaProducaoLeite" USING btree ("propriedadeId", "dataOperacional");


--
-- INDEX: pecuaria.Dieta_nome_versao_key
--

CREATE UNIQUE INDEX "Dieta_nome_versao_key" ON pecuaria."Dieta" USING btree (nome, versao);


--
-- INDEX: pecuaria.Doenca_nome_key
--

CREATE UNIQUE INDEX "Doenca_nome_key" ON pecuaria."Doenca" USING btree (nome);


--
-- INDEX: pecuaria.EmissaoRelatorioLeite_propriedadeId_criadoEm_idx
--

CREATE INDEX "EmissaoRelatorioLeite_propriedadeId_criadoEm_idx" ON pecuaria."EmissaoRelatorioLeite" USING btree ("propriedadeId", "criadoEm");


--
-- INDEX: pecuaria.EntradaLeite_medicao_geral_confirmada
--

CREATE UNIQUE INDEX "EntradaLeite_medicao_geral_confirmada" ON pecuaria."EntradaProducaoLeite" USING btree ("medicaoGeralId") WHERE ((status = 'CONFIRMADA'::text) AND ("medicaoGeralId" IS NOT NULL));


--
-- INDEX: pecuaria.EntradaProducaoLeite_chave_key
--

CREATE UNIQUE INDEX "EntradaProducaoLeite_chave_key" ON pecuaria."EntradaProducaoLeite" USING btree (chave);


--
-- INDEX: pecuaria.EntradaProducaoLeite_movimentoId_key
--

CREATE UNIQUE INDEX "EntradaProducaoLeite_movimentoId_key" ON pecuaria."EntradaProducaoLeite" USING btree ("movimentoId");


--
-- INDEX: pecuaria.EntradaProducaoLeite_sessaoId_idx
--

CREATE INDEX "EntradaProducaoLeite_sessaoId_idx" ON pecuaria."EntradaProducaoLeite" USING btree ("sessaoId");


--
-- INDEX: pecuaria.EntregaLeite_propriedadeId_criadoEm_idx
--

CREATE INDEX "EntregaLeite_propriedadeId_criadoEm_idx" ON pecuaria."EntregaLeite" USING btree ("propriedadeId", "criadoEm");


--
-- INDEX: pecuaria.EntregaLeite_retiradaId_key
--

CREATE UNIQUE INDEX "EntregaLeite_retiradaId_key" ON pecuaria."EntregaLeite" USING btree ("retiradaId");


--
-- INDEX: pecuaria.EtapaProtocoloSanitario_protocoloId_ordem_key
--

CREATE UNIQUE INDEX "EtapaProtocoloSanitario_protocoloId_ordem_key" ON pecuaria."EtapaProtocolo" USING btree ("protocoloId", ordem);


--
-- INDEX: pecuaria.EventoTarefaProtocolo_eventoCorrigidoId_idx
--

CREATE INDEX "EventoTarefaProtocolo_eventoCorrigidoId_idx" ON pecuaria."EventoTarefaProtocolo" USING btree ("eventoCorrigidoId");


--
-- INDEX: pecuaria.EventoTarefaProtocolo_registradoPorId_idx
--

CREATE INDEX "EventoTarefaProtocolo_registradoPorId_idx" ON pecuaria."EventoTarefaProtocolo" USING btree ("registradoPorId");


--
-- INDEX: pecuaria.EventoTarefaProtocolo_tarefaId_registradoEm_id_idx
--

CREATE INDEX "EventoTarefaProtocolo_tarefaId_registradoEm_id_idx" ON pecuaria."EventoTarefaProtocolo" USING btree ("tarefaId", "registradoEm", id);


--
-- INDEX: pecuaria.ExameAnimal_animalId_data_idx
--

CREATE INDEX "ExameAnimal_animalId_data_idx" ON pecuaria."ExameAnimal" USING btree ("animalId", data);


--
-- INDEX: pecuaria.ExameAnimal_operacaoServicoId_idx
--

CREATE INDEX "ExameAnimal_operacaoServicoId_idx" ON pecuaria."ExameAnimal" USING btree ("operacaoServicoId");


--
-- INDEX: pecuaria.ExameAnimal_partoPosPartoId_idx
--

CREATE INDEX "ExameAnimal_partoPosPartoId_idx" ON pecuaria."ExameAnimal" USING btree ("partoPosPartoId");


--
-- INDEX: pecuaria.ExameAnimal_tarefaId_idx
--

CREATE INDEX "ExameAnimal_tarefaId_idx" ON pecuaria."ExameAnimal" USING btree ("tarefaId");


--
-- INDEX: pecuaria.ExameAnimal_tarefaId_valido_key
--

CREATE UNIQUE INDEX "ExameAnimal_tarefaId_valido_key" ON pecuaria."ExameAnimal" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("tarefaId" IS NOT NULL));


--
-- INDEX: pecuaria.ExecucaoProtocoloSanitario_animalId_inicio_idx
--

CREATE INDEX "ExecucaoProtocoloSanitario_animalId_inicio_idx" ON pecuaria."ParticipacaoProtocolo" USING btree ("animalId", "inicioReferencia");


--
-- INDEX: pecuaria.ExecucaoProtocoloSanitario_operacaoServicoId_idx
--

CREATE INDEX "ExecucaoProtocoloSanitario_operacaoServicoId_idx" ON pecuaria."ParticipacaoProtocolo" USING btree ("operacaoServicoId");


--
-- INDEX: pecuaria.ExecucaoProtocoloSanitario_rodadaId_idx
--

CREATE INDEX "ExecucaoProtocoloSanitario_rodadaId_idx" ON pecuaria."ParticipacaoProtocolo" USING btree ("programacaoId");


--
-- INDEX: pecuaria.ExecucaoProtocoloSanitario_rodada_animal_ativa
--

CREATE UNIQUE INDEX "ExecucaoProtocoloSanitario_rodada_animal_ativa" ON pecuaria."ParticipacaoProtocolo" USING btree ("programacaoId", "animalId") WHERE (("programacaoId" IS NOT NULL) AND ("canceladaEm" IS NULL));


--
-- INDEX: pecuaria.ExposicaoTouro_referenciaExterna_key
--

CREATE UNIQUE INDEX "ExposicaoTouro_referenciaExterna_key" ON pecuaria."ExposicaoTouro" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.FechamentoConsumo_loteId_inicio_fim_idx
--

CREATE INDEX "FechamentoConsumo_loteId_inicio_fim_idx" ON pecuaria."FechamentoConsumo" USING btree ("loteId", inicio, fim);


--
-- INDEX: pecuaria.FechamentoOperacaoLeite_comercialId_versao_key
--

CREATE UNIQUE INDEX "FechamentoOperacaoLeite_comercialId_versao_key" ON pecuaria."FechamentoOperacaoLeite" USING btree ("comercialId", versao);


--
-- INDEX: pecuaria.FechamentoOperacaoLeite_operacaoId_key
--

CREATE UNIQUE INDEX "FechamentoOperacaoLeite_operacaoId_key" ON pecuaria."FechamentoOperacaoLeite" USING btree ("operacaoId");


--
-- INDEX: pecuaria.FinalidadeAnimal_animalId_aberto_key
--

CREATE UNIQUE INDEX "FinalidadeAnimal_animalId_aberto_key" ON pecuaria."FinalidadeAnimal" USING btree ("animalId") WHERE (ate IS NULL);


--
-- INDEX: pecuaria.FinalidadeAnimal_animalId_ate_idx
--

CREATE INDEX "FinalidadeAnimal_animalId_ate_idx" ON pecuaria."FinalidadeAnimal" USING btree ("animalId", ate);


--
-- INDEX: pecuaria.FornecimentoColostro_criaId_data_idx
--

CREATE INDEX "FornecimentoColostro_criaId_data_idx" ON pecuaria."FornecimentoColostro" USING btree ("criaId", data);


--
-- INDEX: pecuaria.FornecimentoColostro_propriedadeId_data_idx
--

CREATE INDEX "FornecimentoColostro_propriedadeId_data_idx" ON pecuaria."FornecimentoColostro" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.FornecimentoNutricionalLeite_propriedadeId_data_idx
--

CREATE INDEX "FornecimentoNutricionalLeite_propriedadeId_data_idx" ON pecuaria."FornecimentoNutricionalLeite" USING btree ("propriedadeId", data);


--
-- INDEX: pecuaria.GenitorExterno_fornecedorId_idx
--

CREATE INDEX "GenitorExterno_fornecedorId_idx" ON pecuaria."GenitorExterno" USING btree ("fornecedorId");


--
-- INDEX: pecuaria.GenitorExterno_ideagriId_key
--

CREATE UNIQUE INDEX "GenitorExterno_ideagriId_key" ON pecuaria."GenitorExterno" USING btree ("ideagriId");


--
-- INDEX: pecuaria.GenitorExterno_sexo_nome_idx
--

CREATE INDEX "GenitorExterno_sexo_nome_idx" ON pecuaria."GenitorExterno" USING btree (sexo, nome);


--
-- INDEX: pecuaria.GestacaoAnimal_animalId_idx
--

CREATE INDEX "GestacaoAnimal_animalId_idx" ON pecuaria."GestacaoAnimal" USING btree ("animalId");


--
-- INDEX: pecuaria.GestacaoAnimal_referenciaExterna_key
--

CREATE UNIQUE INDEX "GestacaoAnimal_referenciaExterna_key" ON pecuaria."GestacaoAnimal" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.GestacaoAnimal_tentativaId_key
--

CREATE UNIQUE INDEX "GestacaoAnimal_tentativaId_key" ON pecuaria."GestacaoAnimal" USING btree ("tentativaId");


--
-- INDEX: pecuaria.GestacaoAnimal_uma_aberta
--

CREATE UNIQUE INDEX "GestacaoAnimal_uma_aberta" ON pecuaria."GestacaoAnimal" USING btree ("animalId") WHERE (("encerradaEm" IS NULL) AND (status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3"));


--
-- INDEX: pecuaria.HistoricoPrevisaoParto_gestacaoId_criadoEm_idx
--

CREATE INDEX "HistoricoPrevisaoParto_gestacaoId_criadoEm_idx" ON pecuaria."HistoricoPrevisaoParto" USING btree ("gestacaoId", "criadoEm");


--
-- INDEX: pecuaria.ImpressaoVisita_visitaId_versao_key
--

CREATE UNIQUE INDEX "ImpressaoVisita_visitaId_versao_key" ON pecuaria."ImpressaoVisita" USING btree ("visitaId", versao);


--
-- INDEX: pecuaria.InterpretacaoReprodutiva_exameId_key
--

CREATE UNIQUE INDEX "InterpretacaoReprodutiva_exameId_key" ON pecuaria."InterpretacaoReprodutiva" USING btree ("exameId");


--
-- INDEX: pecuaria.ItemDieta_dietaId_produtoId_key
--

CREATE UNIQUE INDEX "ItemDieta_dietaId_produtoId_key" ON pecuaria."ItemDieta" USING btree ("dietaId", "produtoId");


--
-- INDEX: pecuaria.ItemFechamentoConsumo_fechamentoId_produtoId_key
--

CREATE UNIQUE INDEX "ItemFechamentoConsumo_fechamentoId_produtoId_key" ON pecuaria."ItemFechamentoConsumo" USING btree ("fechamentoId", "produtoId");


--
-- INDEX: pecuaria.ItemFechamentoConsumo_movimentoEstoqueId_key
--

CREATE UNIQUE INDEX "ItemFechamentoConsumo_movimentoEstoqueId_key" ON pecuaria."ItemFechamentoConsumo" USING btree ("movimentoEstoqueId");


--
-- INDEX: pecuaria.LactacaoAnimal_animalId_idx
--

CREATE INDEX "LactacaoAnimal_animalId_idx" ON pecuaria."LactacaoAnimal" USING btree ("animalId");


--
-- INDEX: pecuaria.LactacaoAnimal_animalId_inicio_idx
--

CREATE INDEX "LactacaoAnimal_animalId_inicio_idx" ON pecuaria."LactacaoAnimal" USING btree ("animalId", inicio);


--
-- INDEX: pecuaria.LactacaoAnimal_partoId_key
--

CREATE UNIQUE INDEX "LactacaoAnimal_partoId_key" ON pecuaria."LactacaoAnimal" USING btree ("partoId");


--
-- INDEX: pecuaria.LactacaoAnimal_referenciaExterna_key
--

CREATE UNIQUE INDEX "LactacaoAnimal_referenciaExterna_key" ON pecuaria."LactacaoAnimal" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.LactacaoAnimal_uma_aberta
--

CREATE UNIQUE INDEX "LactacaoAnimal_uma_aberta" ON pecuaria."LactacaoAnimal" USING btree ("animalId") WHERE ("encerradaEm" IS NULL);


--
-- INDEX: pecuaria.LocalizacaoAnimal_animalId_aberta_key
--

CREATE UNIQUE INDEX "LocalizacaoAnimal_animalId_aberta_key" ON pecuaria."LocalizacaoAnimal" USING btree ("animalId") WHERE (ate IS NULL);


--
-- INDEX: pecuaria.LocalizacaoAnimal_animalId_ate_idx
--

CREATE INDEX "LocalizacaoAnimal_animalId_ate_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("animalId", ate);


--
-- INDEX: pecuaria.LocalizacaoAnimal_loteId_ate_idx
--

CREATE INDEX "LocalizacaoAnimal_loteId_ate_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("loteId", ate);


--
-- INDEX: pecuaria.LocalizacaoAnimal_movimentacaoId_idx
--

CREATE INDEX "LocalizacaoAnimal_movimentacaoId_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("movimentacaoId");


--
-- INDEX: pecuaria.LocalizacaoAnimal_propriedadeId_ate_idx
--

CREATE INDEX "LocalizacaoAnimal_propriedadeId_ate_idx" ON pecuaria."LocalizacaoAnimal" USING btree ("propriedadeId", ate);


--
-- INDEX: pecuaria.Lote_ideagriId_key
--

CREATE UNIQUE INDEX "Lote_ideagriId_key" ON pecuaria."Lote" USING btree ("ideagriId");


--
-- INDEX: pecuaria.Lote_propriedadeId_nome_key
--

CREATE UNIQUE INDEX "Lote_propriedadeId_nome_key" ON pecuaria."Lote" USING btree ("propriedadeId", nome);


--
-- INDEX: pecuaria.ManejoAnimal_animalId_data_idx
--

CREATE INDEX "ManejoAnimal_animalId_data_idx" ON pecuaria."ManejoAnimal" USING btree ("animalId", data);


--
-- INDEX: pecuaria.ManejoAnimal_pesagemId_key
--

CREATE UNIQUE INDEX "ManejoAnimal_pesagemId_key" ON pecuaria."ManejoAnimal" USING btree ("pesagemId");


--
-- INDEX: pecuaria.ManejoAnimal_retirada_unica
--

CREATE UNIQUE INDEX "ManejoAnimal_retirada_unica" ON pecuaria."ManejoAnimal" USING btree ("insercaoAplicacaoId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") OR "realizacaoMantida");


--
-- INDEX: pecuaria.ManejoAnimal_tarefa_valida
--

CREATE UNIQUE INDEX "ManejoAnimal_tarefa_valida" ON pecuaria."ManejoAnimal" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") OR "realizacaoMantida");


--
-- INDEX: pecuaria.ManejoAnimal_unico_valido
--

CREATE UNIQUE INDEX "ManejoAnimal_unico_valido" ON pecuaria."ManejoAnimal" USING btree ("animalId", tipo) WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND (tipo = ANY (ARRAY['DESMAMA'::text, 'CASTRACAO'::text])));


--
-- INDEX: pecuaria.MaterialGenetico_doadoraExternaId_idx
--

CREATE INDEX "MaterialGenetico_doadoraExternaId_idx" ON pecuaria."MaterialGenetico" USING btree ("doadoraExternaId");


--
-- INDEX: pecuaria.MaterialGenetico_doadoraId_idx
--

CREATE INDEX "MaterialGenetico_doadoraId_idx" ON pecuaria."MaterialGenetico" USING btree ("doadoraId");


--
-- INDEX: pecuaria.MaterialGenetico_produtoId_key
--

CREATE UNIQUE INDEX "MaterialGenetico_produtoId_key" ON pecuaria."MaterialGenetico" USING btree ("produtoId");


--
-- INDEX: pecuaria.MaterialGenetico_touroExternoId_idx
--

CREATE INDEX "MaterialGenetico_touroExternoId_idx" ON pecuaria."MaterialGenetico" USING btree ("touroExternoId");


--
-- INDEX: pecuaria.MaterialGenetico_touroId_idx
--

CREATE INDEX "MaterialGenetico_touroId_idx" ON pecuaria."MaterialGenetico" USING btree ("touroId");


--
-- INDEX: pecuaria.MedicaoGeralLeite_animaisOrigem_gin
--

CREATE INDEX "MedicaoGeralLeite_animaisOrigem_gin" ON pecuaria."MedicaoGeralLeite" USING gin ("animaisOrigem" jsonb_path_ops);


--
-- INDEX: pecuaria.MedicaoGeralLeite_recipiente_unico
--

CREATE UNIQUE INDEX "MedicaoGeralLeite_recipiente_unico" ON pecuaria."MedicaoGeralLeite" USING btree ("sessaoId", lower(TRIM(BOTH FROM recipiente))) WHERE ("tanqueId" IS NULL);


--
-- INDEX: pecuaria.MedicaoGeralLeite_sessaoId_tanqueId_key
--

CREATE UNIQUE INDEX "MedicaoGeralLeite_sessaoId_tanqueId_key" ON pecuaria."MedicaoGeralLeite" USING btree ("sessaoId", "tanqueId");


--
-- INDEX: pecuaria.MedicaoLeite_participanteId_idx
--

CREATE INDEX "MedicaoLeite_participanteId_idx" ON pecuaria."MedicaoLeite" USING btree ("participanteId");


--
-- INDEX: pecuaria.MedicaoLeite_sessaoId_participanteId_key
--

CREATE UNIQUE INDEX "MedicaoLeite_sessaoId_participanteId_key" ON pecuaria."MedicaoLeite" USING btree ("sessaoId", "participanteId");


--
-- INDEX: pecuaria.MotivoBaixa_ideagriId_key
--

CREATE UNIQUE INDEX "MotivoBaixa_ideagriId_key" ON pecuaria."MotivoBaixa" USING btree ("ideagriId");


--
-- INDEX: pecuaria.MovimentacaoAnimal_animalId_idx
--

CREATE INDEX "MovimentacaoAnimal_animalId_idx" ON pecuaria."MovimentacaoAnimal" USING btree ("animalId");


--
-- INDEX: pecuaria.MovimentacaoAnimal_localizacaoId_key
--

CREATE UNIQUE INDEX "MovimentacaoAnimal_localizacaoId_key" ON pecuaria."MovimentacaoAnimal" USING btree ("localizacaoId");


--
-- INDEX: pecuaria.MovimentacaoAnimal_movimentacaoId_animalId_key
--

CREATE UNIQUE INDEX "MovimentacaoAnimal_movimentacaoId_animalId_key" ON pecuaria."MovimentacaoAnimal" USING btree ("movimentacaoId", "animalId");


--
-- INDEX: pecuaria.MovimentacaoAnimal_origemLoteId_idx
--

CREATE INDEX "MovimentacaoAnimal_origemLoteId_idx" ON pecuaria."MovimentacaoAnimal" USING btree ("origemLoteId");


--
-- INDEX: pecuaria.MovimentacaoAnimal_origemPropriedadeId_idx
--

CREATE INDEX "MovimentacaoAnimal_origemPropriedadeId_idx" ON pecuaria."MovimentacaoAnimal" USING btree ("origemPropriedadeId");


--
-- INDEX: pecuaria.Movimentacao_data_idx
--

CREATE INDEX "Movimentacao_data_idx" ON pecuaria."Movimentacao" USING btree (data);


--
-- INDEX: pecuaria.Movimentacao_loteDestinoId_data_idx
--

CREATE INDEX "Movimentacao_loteDestinoId_data_idx" ON pecuaria."Movimentacao" USING btree ("loteDestinoId", data);


--
-- INDEX: pecuaria.Movimentacao_propriedadeDestinoId_data_idx
--

CREATE INDEX "Movimentacao_propriedadeDestinoId_data_idx" ON pecuaria."Movimentacao" USING btree ("propriedadeDestinoId", data);


--
-- INDEX: pecuaria.OcorrenciaSanitaria_animalId_inicio_idx
--

CREATE INDEX "OcorrenciaSanitaria_animalId_inicio_idx" ON pecuaria."OcorrenciaSanitaria" USING btree ("animalId", inicio);


--
-- INDEX: pecuaria.OcorrenciaSanitaria_partoRetencaoPlacentaId_idx
--

CREATE INDEX "OcorrenciaSanitaria_partoRetencaoPlacentaId_idx" ON pecuaria."OcorrenciaSanitaria" USING btree ("partoRetencaoPlacentaId");


--
-- INDEX: pecuaria.OcorrenciaSanitaria_propriedadeId_inicio_idx
--

CREATE INDEX "OcorrenciaSanitaria_propriedadeId_inicio_idx" ON pecuaria."OcorrenciaSanitaria" USING btree ("propriedadeId", inicio);


--
-- INDEX: pecuaria.OperacaoComercialLeite_propriedadeId_inicio_fim_idx
--

CREATE INDEX "OperacaoComercialLeite_propriedadeId_inicio_fim_idx" ON pecuaria."OperacaoComercialLeite" USING btree ("propriedadeId", inicio, fim);


--
-- INDEX: pecuaria.OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key
--

CREATE UNIQUE INDEX "OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key" ON pecuaria."OperacaoComercialLeite" USING btree ("propriedadeId", "parceiroId", inicio, fim);


--
-- INDEX: pecuaria.ParcelaDestinoLeite_animalId_idx
--

CREATE INDEX "ParcelaDestinoLeite_animalId_idx" ON pecuaria."ParcelaDestinoLeite" USING btree ("animalId");


--
-- INDEX: pecuaria.ParcelaDestinoLeite_destinoId_animalId_key
--

CREATE UNIQUE INDEX "ParcelaDestinoLeite_destinoId_animalId_key" ON pecuaria."ParcelaDestinoLeite" USING btree ("destinoId", "animalId");


--
-- INDEX: pecuaria.ParcelaDestinoLeite_fornecimentoColostroId_idx
--

CREATE INDEX "ParcelaDestinoLeite_fornecimentoColostroId_idx" ON pecuaria."ParcelaDestinoLeite" USING btree ("fornecimentoColostroId");


--
-- INDEX: pecuaria.ParcelaDestinoLeite_fornecimento_ativo_key
--

CREATE UNIQUE INDEX "ParcelaDestinoLeite_fornecimento_ativo_key" ON pecuaria."ParcelaDestinoLeite" USING btree ("fornecimentoColostroId") WHERE (ativo AND ("fornecimentoColostroId" IS NOT NULL));


--
-- INDEX: pecuaria.ParticipacaoConsumoAnimal_fechamentoId_animalId_key
--

CREATE UNIQUE INDEX "ParticipacaoConsumoAnimal_fechamentoId_animalId_key" ON pecuaria."ParticipacaoConsumoAnimal" USING btree ("fechamentoId", "animalId");


--
-- INDEX: pecuaria.ParticipacaoExposicao_animalId_idx
--

CREATE INDEX "ParticipacaoExposicao_animalId_idx" ON pecuaria."ParticipacaoExposicao" USING btree ("animalId");


--
-- INDEX: pecuaria.ParticipacaoExposicao_exposicaoId_animalId_inicio_key
--

CREATE UNIQUE INDEX "ParticipacaoExposicao_exposicaoId_animalId_inicio_key" ON pecuaria."ParticipacaoExposicao" USING btree ("exposicaoId", "animalId", inicio);


--
-- INDEX: pecuaria.ParticipanteProducaoLeite_animalId_idx
--

CREATE INDEX "ParticipanteProducaoLeite_animalId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("animalId");


--
-- INDEX: pecuaria.ParticipanteProducaoLeite_diaId_animalId_key
--

CREATE UNIQUE INDEX "ParticipanteProducaoLeite_diaId_animalId_key" ON pecuaria."ParticipanteProducaoLeite" USING btree ("diaId", "animalId");


--
-- INDEX: pecuaria.ParticipanteProducaoLeite_finalidadeId_idx
--

CREATE INDEX "ParticipanteProducaoLeite_finalidadeId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("finalidadeId");


--
-- INDEX: pecuaria.ParticipanteProducaoLeite_id_diaId_key
--

CREATE UNIQUE INDEX "ParticipanteProducaoLeite_id_diaId_key" ON pecuaria."ParticipanteProducaoLeite" USING btree (id, "diaId");


--
-- INDEX: pecuaria.ParticipanteProducaoLeite_lactacaoId_idx
--

CREATE INDEX "ParticipanteProducaoLeite_lactacaoId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("lactacaoId");


--
-- INDEX: pecuaria.ParticipanteProducaoLeite_localizacaoId_idx
--

CREATE INDEX "ParticipanteProducaoLeite_localizacaoId_idx" ON pecuaria."ParticipanteProducaoLeite" USING btree ("localizacaoId");


--
-- INDEX: pecuaria.ParticipanteVisita_animalId_idx
--

CREATE INDEX "ParticipanteVisita_animalId_idx" ON pecuaria."ParticipanteVisita" USING btree ("animalId");


--
-- INDEX: pecuaria.ParticipanteVisita_atividadeId_animalId_key
--

CREATE UNIQUE INDEX "ParticipanteVisita_atividadeId_animalId_key" ON pecuaria."ParticipanteVisita" USING btree ("atividadeId", "animalId");


--
-- INDEX: pecuaria.ParticipanteVisita_atividadeId_ordem_key
--

CREATE UNIQUE INDEX "ParticipanteVisita_atividadeId_ordem_key" ON pecuaria."ParticipanteVisita" USING btree ("atividadeId", ordem);


--
-- INDEX: pecuaria.ParticipanteVisita_tarefaId_idx
--

CREATE INDEX "ParticipanteVisita_tarefaId_idx" ON pecuaria."ParticipanteVisita" USING btree ("tarefaId");


--
-- INDEX: pecuaria.PartoAnimal_animalId_idx
--

CREATE INDEX "PartoAnimal_animalId_idx" ON pecuaria."PartoAnimal" USING btree ("animalId");


--
-- INDEX: pecuaria.PartoAnimal_gestacaoId_key
--

CREATE UNIQUE INDEX "PartoAnimal_gestacaoId_key" ON pecuaria."PartoAnimal" USING btree ("gestacaoId");


--
-- INDEX: pecuaria.PartoAnimal_referenciaExterna_key
--

CREATE UNIQUE INDEX "PartoAnimal_referenciaExterna_key" ON pecuaria."PartoAnimal" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.PerfilNutricionalProduto_produtoId_key
--

CREATE UNIQUE INDEX "PerfilNutricionalProduto_produtoId_key" ON pecuaria."PerfilNutricionalProduto" USING btree ("produtoId");


--
-- INDEX: pecuaria.PerfilSanitarioProduto_produtoId_key
--

CREATE UNIQUE INDEX "PerfilSanitarioProduto_produtoId_key" ON pecuaria."PerfilSanitarioProduto" USING btree ("produtoId");


--
-- INDEX: pecuaria.PeriodoReprodutivoAnimal_animalId_inicio_idx
--

CREATE INDEX "PeriodoReprodutivoAnimal_animalId_inicio_idx" ON pecuaria."PeriodoReprodutivoAnimal" USING btree ("animalId", inicio);


--
-- INDEX: pecuaria.PeriodoReprodutivoAnimal_destinoOrigemId_key
--

CREATE UNIQUE INDEX "PeriodoReprodutivoAnimal_destinoOrigemId_key" ON pecuaria."PeriodoReprodutivoAnimal" USING btree ("destinoOrigemId");


--
-- INDEX: pecuaria.Pesagem_animalId_data_idx
--

CREATE INDEX "Pesagem_animalId_data_idx" ON pecuaria."Pesagem" USING btree ("animalId", data);


--
-- INDEX: pecuaria.Pesagem_ideagriId_key
--

CREATE UNIQUE INDEX "Pesagem_ideagriId_key" ON pecuaria."Pesagem" USING btree ("ideagriId");


--
-- INDEX: pecuaria.PoliticaElegibilidadeReprodutiva_propriedadeId_versao_key
--

CREATE UNIQUE INDEX "PoliticaElegibilidadeReprodutiva_propriedadeId_versao_key" ON pecuaria."PoliticaElegibilidadeReprodutiva" USING btree ("propriedadeId", versao);


--
-- INDEX: pecuaria.PoliticaElegibilidadeReprodutiva_propriedadeId_vigenteDesde_key
--

CREATE UNIQUE INDEX "PoliticaElegibilidadeReprodutiva_propriedadeId_vigenteDesde_key" ON pecuaria."PoliticaElegibilidadeReprodutiva" USING btree ("propriedadeId", "vigenteDesde");


--
-- INDEX: pecuaria.PosicaoOrdenha_configuracaoId_ordem_key
--

CREATE UNIQUE INDEX "PosicaoOrdenha_configuracaoId_ordem_key" ON pecuaria."PosicaoOrdenha" USING btree ("configuracaoId", ordem);


--
-- INDEX: pecuaria.PosicaoOrdenha_configuracaoId_posicaoId_key
--

CREATE UNIQUE INDEX "PosicaoOrdenha_configuracaoId_posicaoId_key" ON pecuaria."PosicaoOrdenha" USING btree ("configuracaoId", "posicaoId");


--
-- INDEX: pecuaria.Preparo_aplicacao_atual
--

CREATE UNIQUE INDEX "Preparo_aplicacao_atual" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId", "aplicacaoId") WHERE ("encerradoEm" IS NULL);


--
-- INDEX: pecuaria.Preparo_exame_atual
--

CREATE UNIQUE INDEX "Preparo_exame_atual" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId", "exameId") WHERE ("encerradoEm" IS NULL);


--
-- INDEX: pecuaria.Preparo_participacao_atual
--

CREATE UNIQUE INDEX "Preparo_participacao_atual" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId", "participacaoId") WHERE ("encerradoEm" IS NULL);


--
-- INDEX: pecuaria.ProgramacaoRetiradaLeite_propriedadeId_versao_key
--

CREATE UNIQUE INDEX "ProgramacaoRetiradaLeite_propriedadeId_versao_key" ON pecuaria."ProgramacaoRetiradaLeite" USING btree ("propriedadeId", versao);


--
-- INDEX: pecuaria.ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_idx
--

CREATE INDEX "ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_idx" ON pecuaria."ProgramacaoRetiradaLeite" USING btree ("propriedadeId", "vigenteDesde");


--
-- INDEX: pecuaria.ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_key
--

CREATE UNIQUE INDEX "ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_key" ON pecuaria."ProgramacaoRetiradaLeite" USING btree ("propriedadeId", "vigenteDesde");


--
-- INDEX: pecuaria.Protocolo_tipo_nome_versao_key
--

CREATE UNIQUE INDEX "Protocolo_tipo_nome_versao_key" ON pecuaria."Protocolo" USING btree (tipo, nome, versao);


--
-- INDEX: pecuaria.Raca_ideagriId_key
--

CREATE UNIQUE INDEX "Raca_ideagriId_key" ON pecuaria."Raca" USING btree ("ideagriId");


--
-- INDEX: pecuaria.RegraSanitariaReprodutiva_propriedadeId_doencaId_acao_key
--

CREATE UNIQUE INDEX "RegraSanitariaReprodutiva_propriedadeId_doencaId_acao_key" ON pecuaria."RegraSanitariaReprodutiva" USING btree ("propriedadeId", "doencaId", acao);


--
-- INDEX: pecuaria.RestricaoReprodutiva_animalId_idx
--

CREATE INDEX "RestricaoReprodutiva_animalId_idx" ON pecuaria."RestricaoReprodutiva" USING btree ("animalId");


--
-- INDEX: pecuaria.RestricaoReprodutiva_referenciaExterna_key
--

CREATE UNIQUE INDEX "RestricaoReprodutiva_referenciaExterna_key" ON pecuaria."RestricaoReprodutiva" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.ResultadoExame_exameId_campo_idx
--

CREATE INDEX "ResultadoExame_exameId_campo_idx" ON pecuaria."ResultadoExame" USING btree ("exameId", campo);


--
-- INDEX: pecuaria.ResultadoExame_um_vigente
--

CREATE UNIQUE INDEX "ResultadoExame_um_vigente" ON pecuaria."ResultadoExame" USING btree ("exameId", campo) WHERE vigente;


--
-- INDEX: pecuaria.ResultadoQualidadeLeite_amostraId_campo_idx
--

CREATE INDEX "ResultadoQualidadeLeite_amostraId_campo_idx" ON pecuaria."ResultadoQualidadeLeite" USING btree ("amostraId", campo);


--
-- INDEX: pecuaria.ResultadoQualidadeLeite_campo_vigente_key
--

CREATE UNIQUE INDEX "ResultadoQualidadeLeite_campo_vigente_key" ON pecuaria."ResultadoQualidadeLeite" USING btree ("amostraId", campo) WHERE vigente;


--
-- INDEX: pecuaria.RetiradaOperacaoLeite_comercialId_idx
--

CREATE INDEX "RetiradaOperacaoLeite_comercialId_idx" ON pecuaria."RetiradaOperacaoLeite" USING btree ("comercialId");


--
-- INDEX: pecuaria.RetiradaOperacaoLeite_movimentoId_key
--

CREATE UNIQUE INDEX "RetiradaOperacaoLeite_movimentoId_key" ON pecuaria."RetiradaOperacaoLeite" USING btree ("movimentoId");


--
-- INDEX: pecuaria.RodadaProtocoloSanitario_propriedadeId_inicioReferencia_idx
--

CREATE INDEX "RodadaProtocoloSanitario_propriedadeId_inicioReferencia_idx" ON pecuaria."ProgramacaoProtocolo" USING btree ("propriedadeId", "inicioReferencia");


--
-- INDEX: pecuaria.RodadaProtocoloSanitario_protocoloId_idx
--

CREATE INDEX "RodadaProtocoloSanitario_protocoloId_idx" ON pecuaria."ProgramacaoProtocolo" USING btree ("protocoloId");


--
-- INDEX: pecuaria.SelecaoVisita_propriedadeId_ativo_idx
--

CREATE INDEX "SelecaoVisita_propriedadeId_ativo_idx" ON pecuaria."SelecaoVisita" USING btree ("propriedadeId", ativo);


--
-- INDEX: pecuaria.SessaoOrdenha_diaId_ordem_key
--

CREATE UNIQUE INDEX "SessaoOrdenha_diaId_ordem_key" ON pecuaria."SessaoOrdenha" USING btree ("diaId", ordem);


--
-- INDEX: pecuaria.SessaoOrdenha_diaId_posicaoId_key
--

CREATE UNIQUE INDEX "SessaoOrdenha_diaId_posicaoId_key" ON pecuaria."SessaoOrdenha" USING btree ("diaId", "posicaoId");


--
-- INDEX: pecuaria.SessaoOrdenha_id_diaId_key
--

CREATE UNIQUE INDEX "SessaoOrdenha_id_diaId_key" ON pecuaria."SessaoOrdenha" USING btree (id, "diaId");


--
-- INDEX: pecuaria.SituacaoInicialReprodutiva_animalId_idx
--

CREATE INDEX "SituacaoInicialReprodutiva_animalId_idx" ON pecuaria."SituacaoInicialReprodutiva" USING btree ("animalId");


--
-- INDEX: pecuaria.SituacaoInicialReprodutiva_referenciaExterna_key
--

CREATE UNIQUE INDEX "SituacaoInicialReprodutiva_referenciaExterna_key" ON pecuaria."SituacaoInicialReprodutiva" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.SnapshotRelatorioReprodutivo_propriedadeId_tipo_criadoEm_idx
--

CREATE INDEX "SnapshotRelatorioReprodutivo_propriedadeId_tipo_criadoEm_idx" ON pecuaria."SnapshotRelatorioReprodutivo" USING btree ("propriedadeId", tipo, "criadoEm");


--
-- INDEX: pecuaria.TanqueLeite_propriedadeId_identidadeId_versao_key
--

CREATE UNIQUE INDEX "TanqueLeite_propriedadeId_identidadeId_versao_key" ON pecuaria."TanqueLeite" USING btree ("propriedadeId", "identidadeId", versao);


--
-- INDEX: pecuaria.TanqueLeite_propriedadeId_identidadeId_vigenteDesde_key
--

CREATE UNIQUE INDEX "TanqueLeite_propriedadeId_identidadeId_vigenteDesde_key" ON pecuaria."TanqueLeite" USING btree ("propriedadeId", "identidadeId", "vigenteDesde");


--
-- INDEX: pecuaria.TanqueLeite_propriedadeId_vigenteDesde_idx
--

CREATE INDEX "TanqueLeite_propriedadeId_vigenteDesde_idx" ON pecuaria."TanqueLeite" USING btree ("propriedadeId", "vigenteDesde");


--
-- INDEX: pecuaria.TarefaSanitaria_execucaoId_etapaId_key
--

CREATE UNIQUE INDEX "TarefaSanitaria_execucaoId_etapaId_key" ON pecuaria."TarefaProtocolo" USING btree ("participacaoId", "etapaId");


--
-- INDEX: pecuaria.TarefaSanitaria_previstaPara_idx
--

CREATE INDEX "TarefaSanitaria_previstaPara_idx" ON pecuaria."TarefaProtocolo" USING btree ("previstaEm");


--
-- INDEX: pecuaria.TentativaReprodutiva_animalId_idx
--

CREATE INDEX "TentativaReprodutiva_animalId_idx" ON pecuaria."TentativaReprodutiva" USING btree ("animalId");


--
-- INDEX: pecuaria.TentativaReprodutiva_movimentoEstoqueId_key
--

CREATE UNIQUE INDEX "TentativaReprodutiva_movimentoEstoqueId_key" ON pecuaria."TentativaReprodutiva" USING btree ("movimentoEstoqueId");


--
-- INDEX: pecuaria.TentativaReprodutiva_ordem_ciclo
--

CREATE UNIQUE INDEX "TentativaReprodutiva_ordem_ciclo" ON pecuaria."TentativaReprodutiva" USING btree ("animalId", ciclo, ordem);


--
-- INDEX: pecuaria.TentativaReprodutiva_referenciaExterna_key
--

CREATE UNIQUE INDEX "TentativaReprodutiva_referenciaExterna_key" ON pecuaria."TentativaReprodutiva" USING btree ("referenciaExterna");


--
-- INDEX: pecuaria.TentativaReprodutiva_tarefa_valida
--

CREATE UNIQUE INDEX "TentativaReprodutiva_tarefa_valida" ON pecuaria."TentativaReprodutiva" USING btree ("tarefaId") WHERE ((status = 'VALIDO'::pecuaria."StatusFatoPecuariaV3") AND ("tarefaId" IS NOT NULL));


--
-- INDEX: pecuaria.TipoExame_nome_key
--

CREATE UNIQUE INDEX "TipoExame_nome_key" ON pecuaria."TipoExame" USING btree (nome);


--
-- INDEX: pecuaria.VersaoComercialVendaLeite_chave_key
--

CREATE UNIQUE INDEX "VersaoComercialVendaLeite_chave_key" ON pecuaria."VersaoComercialVendaLeite" USING btree (chave);


--
-- INDEX: pecuaria.VersaoComercialVendaLeite_operacaoId_key
--

CREATE UNIQUE INDEX "VersaoComercialVendaLeite_operacaoId_key" ON pecuaria."VersaoComercialVendaLeite" USING btree ("operacaoId");


--
-- INDEX: pecuaria.VersaoComercialVendaLeite_retiradaId_versao_key
--

CREATE UNIQUE INDEX "VersaoComercialVendaLeite_retiradaId_versao_key" ON pecuaria."VersaoComercialVendaLeite" USING btree ("retiradaId", versao);


--
-- INDEX: pecuaria.VersaoSelecaoVisita_selecaoId_numero_key
--

CREATE UNIQUE INDEX "VersaoSelecaoVisita_selecaoId_numero_key" ON pecuaria."VersaoSelecaoVisita" USING btree ("selecaoId", numero);


--
-- INDEX: pecuaria.VigenciaDietaLote_loteId_desde_idx
--

CREATE INDEX "VigenciaDietaLote_loteId_desde_idx" ON pecuaria."VigenciaDietaLote" USING btree ("loteId", desde);


--
-- INDEX: pecuaria.VinculoImportacaoPecuaria_bancoOrigem_tabelaOrigem_chaveOri_key
--

CREATE UNIQUE INDEX "VinculoImportacaoPecuaria_bancoOrigem_tabelaOrigem_chaveOri_key" ON pecuaria."VinculoImportacaoPecuaria" USING btree ("bancoOrigem", "tabelaOrigem", "chaveOrigem");


--
-- INDEX: pecuaria.VinculoMedicaoEntradaLeite_entradaId_medicaoId_key
--

CREATE UNIQUE INDEX "VinculoMedicaoEntradaLeite_entradaId_medicaoId_key" ON pecuaria."VinculoMedicaoEntradaLeite" USING btree ("entradaId", "medicaoId");


--
-- INDEX: pecuaria.VinculoMedicaoEntradaLeite_medicaoId_idx
--

CREATE INDEX "VinculoMedicaoEntradaLeite_medicaoId_idx" ON pecuaria."VinculoMedicaoEntradaLeite" USING btree ("medicaoId");


--
-- INDEX: pecuaria.VinculoMedicaoEntrada_medicao_ativa
--

CREATE UNIQUE INDEX "VinculoMedicaoEntrada_medicao_ativa" ON pecuaria."VinculoMedicaoEntradaLeite" USING btree ("medicaoId") WHERE ativo;


--
-- INDEX: pecuaria.VinculoPesagemParto_criaId_idx
--

CREATE INDEX "VinculoPesagemParto_criaId_idx" ON pecuaria."VinculoPesagemParto" USING btree ("criaId");


--
-- INDEX: pecuaria.VinculoPesagemParto_partoId_idx
--

CREATE INDEX "VinculoPesagemParto_partoId_idx" ON pecuaria."VinculoPesagemParto" USING btree ("partoId");


--
-- INDEX: pecuaria.VinculoPesagemParto_pesagemId_idx
--

CREATE INDEX "VinculoPesagemParto_pesagemId_idx" ON pecuaria."VinculoPesagemParto" USING btree ("pesagemId");


--
-- INDEX: pecuaria.VinculoPesagemParto_pesagem_ativa
--

CREATE UNIQUE INDEX "VinculoPesagemParto_pesagem_ativa" ON pecuaria."VinculoPesagemParto" USING btree ("pesagemId") WHERE ("revogadoEm" IS NULL);


--
-- INDEX: pecuaria.VinculoPoliticaCiclo_animalId_chaveCiclo_key
--

CREATE UNIQUE INDEX "VinculoPoliticaCiclo_animalId_chaveCiclo_key" ON pecuaria."VinculoPoliticaCiclo" USING btree ("animalId", "chaveCiclo");


--
-- INDEX: pecuaria.VinculoPoliticaCiclo_partoId_key
--

CREATE UNIQUE INDEX "VinculoPoliticaCiclo_partoId_key" ON pecuaria."VinculoPoliticaCiclo" USING btree ("partoId");


--
-- INDEX: pecuaria.VinculoPoliticaCiclo_propriedadeId_inicioCiclo_idx
--

CREATE INDEX "VinculoPoliticaCiclo_propriedadeId_inicioCiclo_idx" ON pecuaria."VinculoPoliticaCiclo" USING btree ("propriedadeId", "inicioCiclo");


--
-- INDEX: pecuaria.VinculoPreparoTentativa_aplicacaoId_idx
--

CREATE INDEX "VinculoPreparoTentativa_aplicacaoId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("aplicacaoId");


--
-- INDEX: pecuaria.VinculoPreparoTentativa_exameId_idx
--

CREATE INDEX "VinculoPreparoTentativa_exameId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("exameId");


--
-- INDEX: pecuaria.VinculoPreparoTentativa_participacaoId_idx
--

CREATE INDEX "VinculoPreparoTentativa_participacaoId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("participacaoId");


--
-- INDEX: pecuaria.VinculoPreparoTentativa_tentativaId_idx
--

CREATE INDEX "VinculoPreparoTentativa_tentativaId_idx" ON pecuaria."VinculoPreparoTentativa" USING btree ("tentativaId");


--
-- INDEX: pecuaria.VinculoQualidadeFechamentoLeite_amostraId_idx
--

CREATE INDEX "VinculoQualidadeFechamentoLeite_amostraId_idx" ON pecuaria."VinculoQualidadeFechamentoLeite" USING btree ("amostraId");


--
-- INDEX: pecuaria.VinculoTarefaProtocolo_aplicacaoId_idx
--

CREATE INDEX "VinculoTarefaProtocolo_aplicacaoId_idx" ON pecuaria."VinculoTarefaProtocolo" USING btree ("aplicacaoId");


--
-- INDEX: pecuaria.VinculoTarefaProtocolo_exameId_idx
--

CREATE INDEX "VinculoTarefaProtocolo_exameId_idx" ON pecuaria."VinculoTarefaProtocolo" USING btree ("exameId");


--
-- INDEX: pecuaria.VinculoTarefaProtocolo_tarefaId_ordem_key
--

CREATE UNIQUE INDEX "VinculoTarefaProtocolo_tarefaId_ordem_key" ON pecuaria."VinculoTarefaProtocolo" USING btree ("tarefaId", ordem);


--
-- INDEX: pecuaria.VinculoTarefaProtocolo_tentativaId_idx
--

CREATE INDEX "VinculoTarefaProtocolo_tentativaId_idx" ON pecuaria."VinculoTarefaProtocolo" USING btree ("tentativaId");


--
-- INDEX: pecuaria.VinculoTarefaProtocolo_um_atual
--

CREATE UNIQUE INDEX "VinculoTarefaProtocolo_um_atual" ON pecuaria."VinculoTarefaProtocolo" USING btree ("tarefaId") WHERE (estado = 'ATUAL'::text);


--
-- INDEX: public.AlocacaoPartidaEstoque_movimentoEstoqueId_partidaId_key
--

CREATE UNIQUE INDEX "AlocacaoPartidaEstoque_movimentoEstoqueId_partidaId_key" ON public."AlocacaoPartidaEstoque" USING btree ("movimentoEstoqueId", "partidaId");


--
-- INDEX: public.AlocacaoPartidaEstoque_partidaId_idx
--

CREATE INDEX "AlocacaoPartidaEstoque_partidaId_idx" ON public."AlocacaoPartidaEstoque" USING btree ("partidaId");


--
-- INDEX: public.AuditoriaFinanceira_entidade_entidadeId_idx
--

CREATE INDEX "AuditoriaFinanceira_entidade_entidadeId_idx" ON public."AuditoriaFinanceira" USING btree (entidade, "entidadeId");


--
-- INDEX: public.AuditoriaFinanceira_usuarioId_createdAt_idx
--

CREATE INDEX "AuditoriaFinanceira_usuarioId_createdAt_idx" ON public."AuditoriaFinanceira" USING btree ("usuarioId", "createdAt");


--
-- INDEX: public.BaseValorizacaoEstoque_origemMovimentoId_idx
--

CREATE INDEX "BaseValorizacaoEstoque_origemMovimentoId_idx" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId");


--
-- INDEX: public.BaseValorizacaoEstoque_produtoId_propriedadeId_idx
--

CREATE INDEX "BaseValorizacaoEstoque_produtoId_propriedadeId_idx" ON public."BaseValorizacaoEstoque" USING btree ("produtoId", "propriedadeId");


--
-- INDEX: public.BaseValorizacao_camada_derivada
--

CREATE UNIQUE INDEX "BaseValorizacao_camada_derivada" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId", "baseOrigemId", "partidaId") WHERE ((metodo = 'CAMADAS_AQUISICAO_V2'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NOT NULL));


--
-- INDEX: public.BaseValorizacao_camada_recebida
--

CREATE UNIQUE INDEX "BaseValorizacao_camada_recebida" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId", "partidaId") WHERE ((metodo = 'CAMADAS_AQUISICAO_V2'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NULL));


--
-- INDEX: public.BaseValorizacao_fifo_derivada
--

CREATE UNIQUE INDEX "BaseValorizacao_fifo_derivada" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId", "baseOrigemId") WHERE ((metodo = 'FIFO_AQUISICAO_V1'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NOT NULL));


--
-- INDEX: public.BaseValorizacao_fifo_origem
--

CREATE UNIQUE INDEX "BaseValorizacao_fifo_origem" ON public."BaseValorizacaoEstoque" USING btree ("origemMovimentoId") WHERE ((metodo = 'FIFO_AQUISICAO_V1'::text) AND ("origemMovimentoId" IS NOT NULL) AND ("baseOrigemId" IS NULL));


--
-- INDEX: public.BaseValorizacao_grupo_sitio
--

CREATE UNIQUE INDEX "BaseValorizacao_grupo_sitio" ON public."BaseValorizacaoEstoque" USING btree ("produtoId", "propriedadeId", "partidaId") WHERE (metodo = 'MEDIA_SALDO_V1'::text);


--
-- INDEX: public.Categoria_grupoId_idx
--

CREATE INDEX "Categoria_grupoId_idx" ON public."Categoria" USING btree ("grupoId");


--
-- INDEX: public.Categoria_nome_key
--

CREATE UNIQUE INDEX "Categoria_nome_key" ON public."Categoria" USING btree (nome);


--
-- INDEX: public.CentroCusto_nome_key
--

CREATE UNIQUE INDEX "CentroCusto_nome_key" ON public."CentroCusto" USING btree (nome);


--
-- INDEX: public.CompromissoFinanceiro_operacaoId_idx
--

CREATE INDEX "CompromissoFinanceiro_operacaoId_idx" ON public."CompromissoFinanceiro" USING btree ("operacaoId");


--
-- INDEX: public.CompromissoFinanceiro_seq_key
--

CREATE UNIQUE INDEX "CompromissoFinanceiro_seq_key" ON public."CompromissoFinanceiro" USING btree (seq);


--
-- INDEX: public.CompromissoFinanceiro_tipo_status_dataVencimento_idx
--

CREATE INDEX "CompromissoFinanceiro_tipo_status_dataVencimento_idx" ON public."CompromissoFinanceiro" USING btree (tipo, status, "dataVencimento");


--
-- INDEX: public.ContaFinanceira_propriedadeId_ativo_idx
--

CREATE INDEX "ContaFinanceira_propriedadeId_ativo_idx" ON public."ContaFinanceira" USING btree ("propriedadeId", ativo);


--
-- INDEX: public.ContaFinanceira_propriedadeId_nome_key
--

CREATE UNIQUE INDEX "ContaFinanceira_propriedadeId_nome_key" ON public."ContaFinanceira" USING btree ("propriedadeId", nome);


--
-- INDEX: public.ConversaWhatsapp_telefone_key
--

CREATE UNIQUE INDEX "ConversaWhatsapp_telefone_key" ON public."ConversaWhatsapp" USING btree (telefone);


--
-- INDEX: public.DocumentoFinanceiro_compromissoId_idx
--

CREATE INDEX "DocumentoFinanceiro_compromissoId_idx" ON public."DocumentoFinanceiro" USING btree ("compromissoId");


--
-- INDEX: public.DocumentoFinanceiro_operacaoId_idx
--

CREATE INDEX "DocumentoFinanceiro_operacaoId_idx" ON public."DocumentoFinanceiro" USING btree ("operacaoId");


--
-- INDEX: public.DocumentoFinanceiro_rascunhoId_idx
--

CREATE INDEX "DocumentoFinanceiro_rascunhoId_idx" ON public."DocumentoFinanceiro" USING btree ("rascunhoId");


--
-- INDEX: public.DocumentoFinanceiro_sha256_key
--

CREATE UNIQUE INDEX "DocumentoFinanceiro_sha256_key" ON public."DocumentoFinanceiro" USING btree (sha256);


--
-- INDEX: public.DocumentoFinanceiro_storageKey_key
--

CREATE UNIQUE INDEX "DocumentoFinanceiro_storageKey_key" ON public."DocumentoFinanceiro" USING btree ("storageKey");


--
-- INDEX: public.DocumentoFinanceiro_transacaoId_idx
--

CREATE INDEX "DocumentoFinanceiro_transacaoId_idx" ON public."DocumentoFinanceiro" USING btree ("transacaoId");


--
-- INDEX: public.GrupoCategoria_nome_key
--

CREATE UNIQUE INDEX "GrupoCategoria_nome_key" ON public."GrupoCategoria" USING btree (nome);


--
-- INDEX: public.ItemOperacao_centroCustoId_idx
--

CREATE INDEX "ItemOperacao_centroCustoId_idx" ON public."ItemOperacao" USING btree ("centroCustoId");


--
-- INDEX: public.ItemOperacao_operacaoId_idx
--

CREATE INDEX "ItemOperacao_operacaoId_idx" ON public."ItemOperacao" USING btree ("operacaoId");


--
-- INDEX: public.ItemOperacao_operacaoId_ordem_key
--

CREATE UNIQUE INDEX "ItemOperacao_operacaoId_ordem_key" ON public."ItemOperacao" USING btree ("operacaoId", ordem);


--
-- INDEX: public.ItemOperacao_produtoId_idx
--

CREATE INDEX "ItemOperacao_produtoId_idx" ON public."ItemOperacao" USING btree ("produtoId");


--
-- INDEX: public.Liquidacao_compromissoId_transacaoId_key
--

CREATE UNIQUE INDEX "Liquidacao_compromissoId_transacaoId_key" ON public."Liquidacao" USING btree ("compromissoId", "transacaoId");


--
-- INDEX: public.Liquidacao_transacaoId_idx
--

CREATE INDEX "Liquidacao_transacaoId_idx" ON public."Liquidacao" USING btree ("transacaoId");


--
-- INDEX: public.MensagemWhatsapp_conversaId_createdAt_idx
--

CREATE INDEX "MensagemWhatsapp_conversaId_createdAt_idx" ON public."MensagemWhatsapp" USING btree ("conversaId", "createdAt");


--
-- INDEX: public.MensagemWhatsapp_waMessageId_key
--

CREATE UNIQUE INDEX "MensagemWhatsapp_waMessageId_key" ON public."MensagemWhatsapp" USING btree ("waMessageId");


--
-- INDEX: public.MovimentoConta_contaId_createdAt_idx
--

CREATE INDEX "MovimentoConta_contaId_createdAt_idx" ON public."MovimentoConta" USING btree ("contaId", "createdAt");


--
-- INDEX: public.MovimentoConta_seq_key
--

CREATE UNIQUE INDEX "MovimentoConta_seq_key" ON public."MovimentoConta" USING btree (seq);


--
-- INDEX: public.MovimentoConta_transacaoId_idx
--

CREATE INDEX "MovimentoConta_transacaoId_idx" ON public."MovimentoConta" USING btree ("transacaoId");


--
-- INDEX: public.MovimentoEstoque_centroCustoId_idx
--

CREATE INDEX "MovimentoEstoque_centroCustoId_idx" ON public."MovimentoEstoque" USING btree ("centroCustoId");


--
-- INDEX: public.MovimentoEstoque_itemOperacaoId_idx
--

CREATE INDEX "MovimentoEstoque_itemOperacaoId_idx" ON public."MovimentoEstoque" USING btree ("itemOperacaoId");


--
-- INDEX: public.MovimentoEstoque_operacaoId_idx
--

CREATE INDEX "MovimentoEstoque_operacaoId_idx" ON public."MovimentoEstoque" USING btree ("operacaoId");


--
-- INDEX: public.MovimentoEstoque_produtoId_data_idx
--

CREATE INDEX "MovimentoEstoque_produtoId_data_idx" ON public."MovimentoEstoque" USING btree ("produtoId", data);


--
-- INDEX: public.MovimentoEstoque_propriedadeId_idx
--

CREATE INDEX "MovimentoEstoque_propriedadeId_idx" ON public."MovimentoEstoque" USING btree ("propriedadeId");


--
-- INDEX: public.MovimentoEstoque_reversaoDeId_key
--

CREATE UNIQUE INDEX "MovimentoEstoque_reversaoDeId_key" ON public."MovimentoEstoque" USING btree ("reversaoDeId");


--
-- INDEX: public.MovimentoEstoque_seq_key
--

CREATE UNIQUE INDEX "MovimentoEstoque_seq_key" ON public."MovimentoEstoque" USING btree (seq);


--
-- INDEX: public.MovimentoEstoque_tipo_data_idx
--

CREATE INDEX "MovimentoEstoque_tipo_data_idx" ON public."MovimentoEstoque" USING btree (tipo, data);


--
-- INDEX: public.Operacao_corrigeOperacaoId_idx
--

CREATE INDEX "Operacao_corrigeOperacaoId_idx" ON public."Operacao" USING btree ("corrigeOperacaoId");


--
-- INDEX: public.Operacao_numero_key
--

CREATE UNIQUE INDEX "Operacao_numero_key" ON public."Operacao" USING btree (numero);


--
-- INDEX: public.Operacao_parceiroId_idx
--

CREATE INDEX "Operacao_parceiroId_idx" ON public."Operacao" USING btree ("parceiroId");


--
-- INDEX: public.Operacao_propriedadeId_data_idx
--

CREATE INDEX "Operacao_propriedadeId_data_idx" ON public."Operacao" USING btree ("propriedadeId", data);


--
-- INDEX: public.Operacao_tipo_status_idx
--

CREATE INDEX "Operacao_tipo_status_idx" ON public."Operacao" USING btree (tipo, status);


--
-- INDEX: public.Parceiro_documento_key
--

CREATE UNIQUE INDEX "Parceiro_documento_key" ON public."Parceiro" USING btree (documento);


--
-- INDEX: public.Parceiro_nome_idx
--

CREATE INDEX "Parceiro_nome_idx" ON public."Parceiro" USING btree (nome);


--
-- INDEX: public.Parceiro_tipo_ativo_idx
--

CREATE INDEX "Parceiro_tipo_ativo_idx" ON public."Parceiro" USING btree (tipo, ativo);


--
-- INDEX: public.ParcelaValorizacaoEstoque_baseId_idx
--

CREATE INDEX "ParcelaValorizacaoEstoque_baseId_idx" ON public."ParcelaValorizacaoEstoque" USING btree ("baseId");


--
-- INDEX: public.ParcelaValorizacaoEstoque_movimentoEstoqueId_baseId_key
--

CREATE UNIQUE INDEX "ParcelaValorizacaoEstoque_movimentoEstoqueId_baseId_key" ON public."ParcelaValorizacaoEstoque" USING btree ("movimentoEstoqueId", "baseId");


--
-- INDEX: public.ParcelaValorizacaoEstoque_movimentoEstoqueId_ordem_key
--

CREATE UNIQUE INDEX "ParcelaValorizacaoEstoque_movimentoEstoqueId_ordem_key" ON public."ParcelaValorizacaoEstoque" USING btree ("movimentoEstoqueId", ordem);


--
-- INDEX: public.PartidaProduto_lotePrincipalId_idx
--

CREATE INDEX "PartidaProduto_lotePrincipalId_idx" ON public."PartidaProduto" USING btree ("lotePrincipalId");


--
-- INDEX: public.PartidaProduto_produtoId_codigo_key
--

CREATE UNIQUE INDEX "PartidaProduto_produtoId_codigo_key" ON public."PartidaProduto" USING btree ("produtoId", codigo);


--
-- INDEX: public.PartidaProduto_raiz_produto_sem_validade_key
--

CREATE UNIQUE INDEX "PartidaProduto_raiz_produto_sem_validade_key" ON public."PartidaProduto" USING btree ("produtoId") WHERE (("lotePrincipalId" IS NULL) AND (validade IS NULL));


--
-- INDEX: public.PartidaProduto_raiz_produto_validade_key
--

CREATE UNIQUE INDEX "PartidaProduto_raiz_produto_validade_key" ON public."PartidaProduto" USING btree ("produtoId", validade) WHERE (("lotePrincipalId" IS NULL) AND (validade IS NOT NULL));


--
-- INDEX: public.PeriodoFinanceiro_propriedadeId_ano_mes_key
--

CREATE UNIQUE INDEX "PeriodoFinanceiro_propriedadeId_ano_mes_key" ON public."PeriodoFinanceiro" USING btree ("propriedadeId", ano, mes);


--
-- INDEX: public.ProdutoCentroCusto_centroCustoId_idx
--

CREATE INDEX "ProdutoCentroCusto_centroCustoId_idx" ON public."ProdutoCentroCusto" USING btree ("centroCustoId");


--
-- INDEX: public.ProdutoFornecedor_fornecedorId_idx
--

CREATE INDEX "ProdutoFornecedor_fornecedorId_idx" ON public."ProdutoFornecedor" USING btree ("fornecedorId");


--
-- INDEX: public.Produto_nome_key
--

CREATE UNIQUE INDEX "Produto_nome_key" ON public."Produto" USING btree (nome);


--
-- INDEX: public.Propriedade_nome_key
--

CREATE UNIQUE INDEX "Propriedade_nome_key" ON public."Propriedade" USING btree (nome);


--
-- INDEX: public.RascunhoOperacao_criadoPorId_updatedAt_idx
--

CREATE INDEX "RascunhoOperacao_criadoPorId_updatedAt_idx" ON public."RascunhoOperacao" USING btree ("criadoPorId", "updatedAt");


--
-- INDEX: public.RascunhoOperacao_propriedadeId_criadoPorId_key
--

CREATE UNIQUE INDEX "RascunhoOperacao_propriedadeId_criadoPorId_key" ON public."RascunhoOperacao" USING btree ("propriedadeId", "criadoPorId");


--
-- INDEX: public.RascunhoRelatorioFinanceiro_propriedadeId_criadoPorId_key
--

CREATE UNIQUE INDEX "RascunhoRelatorioFinanceiro_propriedadeId_criadoPorId_key" ON public."RascunhoRelatorioFinanceiro" USING btree ("propriedadeId", "criadoPorId");


--
-- INDEX: public.RelatorioFinanceiro_propriedadeId_geradoEm_idx
--

CREATE INDEX "RelatorioFinanceiro_propriedadeId_geradoEm_idx" ON public."RelatorioFinanceiro" USING btree ("propriedadeId", "geradoEm");


--
-- INDEX: public.RelatorioFinanceiro_storageKey_key
--

CREATE UNIQUE INDEX "RelatorioFinanceiro_storageKey_key" ON public."RelatorioFinanceiro" USING btree ("storageKey");


--
-- INDEX: public.Sessao_tokenHash_key
--

CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON public."Sessao" USING btree ("tokenHash");


--
-- INDEX: public.Sessao_usuarioId_idx
--

CREATE INDEX "Sessao_usuarioId_idx" ON public."Sessao" USING btree ("usuarioId");


--
-- INDEX: public.TokenAcesso_tokenHash_key
--

CREATE UNIQUE INDEX "TokenAcesso_tokenHash_key" ON public."TokenAcesso" USING btree ("tokenHash");


--
-- INDEX: public.TokenAcesso_usuarioId_idx
--

CREATE INDEX "TokenAcesso_usuarioId_idx" ON public."TokenAcesso" USING btree ("usuarioId");


--
-- INDEX: public.TransacaoFinanceira_operacaoId_idx
--

CREATE INDEX "TransacaoFinanceira_operacaoId_idx" ON public."TransacaoFinanceira" USING btree ("operacaoId");


--
-- INDEX: public.TransacaoFinanceira_propriedadeId_data_idx
--

CREATE INDEX "TransacaoFinanceira_propriedadeId_data_idx" ON public."TransacaoFinanceira" USING btree ("propriedadeId", data);


--
-- INDEX: public.TransacaoFinanceira_reversaoDeId_key
--

CREATE UNIQUE INDEX "TransacaoFinanceira_reversaoDeId_key" ON public."TransacaoFinanceira" USING btree ("reversaoDeId");


--
-- INDEX: public.TransacaoFinanceira_seq_key
--

CREATE UNIQUE INDEX "TransacaoFinanceira_seq_key" ON public."TransacaoFinanceira" USING btree (seq);


--
-- INDEX: public.TransacaoFinanceira_tipo_status_idx
--

CREATE INDEX "TransacaoFinanceira_tipo_status_idx" ON public."TransacaoFinanceira" USING btree (tipo, status);


--
-- INDEX: public.UsuarioWhatsapp_telefone_key
--

CREATE UNIQUE INDEX "UsuarioWhatsapp_telefone_key" ON public."UsuarioWhatsapp" USING btree (telefone);


--
-- INDEX: public.Usuario_email_key
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- TRIGGER: pecuaria.AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_anular
--

CREATE TRIGGER "AlocacaoDemonstrativoLeite_anular" BEFORE DELETE OR UPDATE ON pecuaria."AlocacaoDemonstrativoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.anular_comercial_leite();


--
-- TRIGGER: pecuaria.AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_guard
--

CREATE CONSTRAINT TRIGGER "AlocacaoDemonstrativoLeite_guard" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoDemonstrativoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- TRIGGER: pecuaria.AlocacaoLeiteEstoque AlocacaoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeite_conferir" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_leite();


--
-- TRIGGER: pecuaria.AlocacaoLeiteEstoque AlocacaoLeite_elegibilidade
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeite_elegibilidade" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_elegibilidade_saida_leite();


--
-- TRIGGER: pecuaria.AlocacaoLeiteEstoque AlocacaoLeite_imutavel
--

CREATE TRIGGER "AlocacaoLeite_imutavel" BEFORE UPDATE ON pecuaria."AlocacaoLeiteEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: pecuaria.AlocacaoLeiteEstoque AlocacaoLeite_natureza_destino
--

CREATE CONSTRAINT TRIGGER "AlocacaoLeite_natureza_destino" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_natureza_destino_leite();


--
-- TRIGGER: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_conferir
--

CREATE TRIGGER "AmostraQualidadeLeite_conferir" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."AmostraQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_amostra_qualidade_leite();


--
-- TRIGGER: pecuaria.Animal Animal_proteger_origem_geral
--

CREATE CONSTRAINT TRIGGER "Animal_proteger_origem_geral" AFTER DELETE OR UPDATE ON pecuaria."Animal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- TRIGGER: pecuaria.Animal Animal_travar_origem_geral
--

CREATE TRIGGER "Animal_travar_origem_geral" BEFORE DELETE OR UPDATE ON pecuaria."Animal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- TRIGGER: pecuaria.AplicacaoProduto AplicacaoProduto_insercao_historico
--

CREATE TRIGGER "AplicacaoProduto_insercao_historico" BEFORE UPDATE ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_reconhecimento_insercao();


--
-- TRIGGER: pecuaria.AplicacaoProduto AplicacaoProduto_retirada_validar
--

CREATE TRIGGER "AplicacaoProduto_retirada_validar" BEFORE UPDATE ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_insercao_retirada();


--
-- TRIGGER: pecuaria.ApropriacaoValorLeite ApropriacaoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "ApropriacaoLeite_conferir" AFTER INSERT ON pecuaria."ApropriacaoValorLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_apuracao_leite();


--
-- TRIGGER: pecuaria.ApropriacaoValorLeite ApropriacaoLeite_imutavel
--

CREATE TRIGGER "ApropriacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ApropriacaoValorLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: pecuaria.ApuracaoValorLeite ApuracaoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "ApuracaoLeite_conferir" AFTER INSERT ON pecuaria."ApuracaoValorLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_apuracao_leite();


--
-- TRIGGER: pecuaria.ApuracaoValorLeite ApuracaoLeite_imutavel
--

CREATE TRIGGER "ApuracaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ApuracaoValorLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: pecuaria.BaixaAnimal BaixaAnimal_proteger_origem_geral
--

CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- TRIGGER: pecuaria.BaixaAnimal BaixaAnimal_proteger_producao
--

CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_producao" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_baixa_com_producao();


--
-- TRIGGER: pecuaria.BaixaAnimal BaixaAnimal_travar_origem_geral
--

CREATE TRIGGER "BaixaAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."BaixaAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- TRIGGER: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCusto_limite
--

CREATE CONSTRAINT TRIGGER "ClassificacaoCusto_limite" AFTER INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_limite_classificacao();


--
-- TRIGGER: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCusto_manejo_validar
--

CREATE TRIGGER "ClassificacaoCusto_manejo_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_classificacao_manejo();


--
-- TRIGGER: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCusto_validar
--

CREATE TRIGGER "ClassificacaoCusto_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_classificacao_custo();


--
-- TRIGGER: pecuaria.ClassificacaoEntradaLeite ClassificacaoLeite_imutavel
--

CREATE TRIGGER "ClassificacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ClassificacaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: pecuaria.ClassificacaoEntradaLeite ClassificacaoLeite_validar
--

CREATE TRIGGER "ClassificacaoLeite_validar" BEFORE INSERT ON pecuaria."ClassificacaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_natureza_entrada_leite();


--
-- TRIGGER: pecuaria.ComprovanteEntregaLeite ComprovanteEntregaLeite_imutavel
--

CREATE TRIGGER "ComprovanteEntregaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ComprovanteEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();


--
-- TRIGGER: pecuaria.ComprovanteRetiradaOperacaoLeite ComprovanteRetiradaOperacaoLeite_imutavel
--

CREATE TRIGGER "ComprovanteRetiradaOperacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ComprovanteRetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.ConferenciaEntregaLeite ConferenciaEntregaLeite_documentos
--

CREATE TRIGGER "ConferenciaEntregaLeite_documentos" BEFORE INSERT ON pecuaria."ConferenciaEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_conferencia_entrega_leite();


--
-- TRIGGER: pecuaria.ConferenciaEntregaLeite ConferenciaEntregaLeite_guard
--

CREATE CONSTRAINT TRIGGER "ConferenciaEntregaLeite_guard" AFTER INSERT ON pecuaria."ConferenciaEntregaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- TRIGGER: pecuaria.ConferenciaEntregaLeite ConferenciaEntregaLeite_imutavel
--

CREATE TRIGGER "ConferenciaEntregaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ConferenciaEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();


--
-- TRIGGER: pecuaria.ConferenciaSaldoLeite ConferenciaSaldoLeite_imutavel
--

CREATE TRIGGER "ConferenciaSaldoLeite_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ConferenciaSaldoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_conferencia_saldo_leite();


--
-- TRIGGER: pecuaria.ConfiguracaoOrdenha ConfiguracaoOrdenha_snapshot_imutavel
--

CREATE TRIGGER "ConfiguracaoOrdenha_snapshot_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."ConfiguracaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_configuracao_ordenha_usada();


--
-- TRIGGER: pecuaria.CriaParto CriaParto_colostro
--

CREATE CONSTRAINT TRIGGER "CriaParto_colostro" AFTER UPDATE ON pecuaria."CriaParto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();


--
-- TRIGGER: pecuaria.CriaParto CriaParto_pesagens
--

CREATE CONSTRAINT TRIGGER "CriaParto_pesagens" AFTER UPDATE ON pecuaria."CriaParto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- TRIGGER: pecuaria.TentativaReprodutiva Custo_limite_tentativa
--

CREATE CONSTRAINT TRIGGER "Custo_limite_tentativa" AFTER UPDATE ON pecuaria."TentativaReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- TRIGGER: pecuaria.DecisaoElegibilidadeCiclo DecisaoElegibilidade_cronologia
--

CREATE TRIGGER "DecisaoElegibilidade_cronologia" BEFORE INSERT ON pecuaria."DecisaoElegibilidadeCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_decisao_elegibilidade();


--
-- TRIGGER: pecuaria.DecisaoElegibilidadeCiclo DecisaoElegibilidade_historico
--

CREATE TRIGGER "DecisaoElegibilidade_historico" BEFORE DELETE OR UPDATE ON pecuaria."DecisaoElegibilidadeCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_decisao_elegibilidade();


--
-- TRIGGER: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamento_validar
--

CREATE TRIGGER "DemandaAcompanhamento_validar" BEFORE INSERT OR UPDATE ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_demanda_acompanhamento();


--
-- TRIGGER: pecuaria.DemonstrativoLeite DemonstrativoLeite_anular
--

CREATE TRIGGER "DemonstrativoLeite_anular" BEFORE DELETE OR UPDATE ON pecuaria."DemonstrativoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.anular_comercial_leite();


--
-- TRIGGER: pecuaria.DemonstrativoLeite DemonstrativoLeite_guard
--

CREATE CONSTRAINT TRIGGER "DemonstrativoLeite_guard" AFTER INSERT OR UPDATE ON pecuaria."DemonstrativoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- TRIGGER: pecuaria.AlocacaoLeiteEstoque DescarteLeite_alocacao
--

CREATE CONSTRAINT TRIGGER "DescarteLeite_alocacao" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();


--
-- TRIGGER: pecuaria.DescarteLeite DescarteLeite_conferir
--

CREATE CONSTRAINT TRIGGER "DescarteLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."DescarteLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();


--
-- TRIGGER: pecuaria.DescarteLeite DescarteLeite_imutavel
--

CREATE TRIGGER "DescarteLeite_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."DescarteLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_descarte_leite();


--
-- TRIGGER: pecuaria.DestinoInternoLeite DestinoInternoLeite_fatos_imutaveis
--

CREATE TRIGGER "DestinoInternoLeite_fatos_imutaveis" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."DestinoInternoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_fatos_destino_leite();


--
-- TRIGGER: pecuaria.DestinoInternoLeite DestinoInternoLeite_integridade
--

CREATE CONSTRAINT TRIGGER "DestinoInternoLeite_integridade" AFTER INSERT OR UPDATE ON pecuaria."DestinoInternoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destino_interno_leite();


--
-- TRIGGER: pecuaria.DestinoInternoLeite DestinoLeite_natureza_origem
--

CREATE CONSTRAINT TRIGGER "DestinoLeite_natureza_origem" AFTER INSERT OR UPDATE ON pecuaria."DestinoInternoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_natureza_destino_leite();


--
-- TRIGGER: pecuaria.DetalheFechamentoLeite DetalheFechamentoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "DetalheFechamentoLeite_conferir" AFTER INSERT ON pecuaria."DetalheFechamentoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.DetalheFechamentoLeite DetalheFechamentoLeite_imutavel
--

CREATE TRIGGER "DetalheFechamentoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."DetalheFechamentoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.DiaProducaoLeite DiaProducaoLeite_congelar_configuracao
--

CREATE TRIGGER "DiaProducaoLeite_congelar_configuracao" BEFORE INSERT ON pecuaria."DiaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.congelar_configuracao_dia_leite();


--
-- TRIGGER: pecuaria.DiaProducaoLeite DiaProducaoLeite_identidade_imutavel
--

CREATE TRIGGER "DiaProducaoLeite_identidade_imutavel" BEFORE UPDATE ON pecuaria."DiaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_identidade_dia_leite();


--
-- TRIGGER: pecuaria.EmissaoRelatorioLeite EmissaoLeite_imutavel
--

CREATE TRIGGER "EmissaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."EmissaoRelatorioLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_emissao_leite();


--
-- TRIGGER: pecuaria.EntradaProducaoLeite EntradaLeite_classificacao_inicial
--

CREATE CONSTRAINT TRIGGER "EntradaLeite_classificacao_inicial" AFTER INSERT ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_classificacao_inicial_leite();


--
-- TRIGGER: pecuaria.EntradaProducaoLeite EntradaLeite_conferir
--

CREATE CONSTRAINT TRIGGER "EntradaLeite_conferir" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_leite();


--
-- TRIGGER: pecuaria.EntradaProducaoLeite EntradaLeite_imutavel
--

CREATE TRIGGER "EntradaLeite_imutavel" BEFORE UPDATE ON pecuaria."EntradaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_entrada_leite();


--
-- TRIGGER: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_00_travar_origens
--

CREATE TRIGGER "EntradaProducaoLeite_00_travar_origens" BEFORE INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_entrada_origem_geral();


--
-- TRIGGER: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_conjunto_parcelas
--

CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_conjunto_parcelas" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_conjunto_parcelas_leite();


--
-- TRIGGER: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_origens_gerais_historicas
--

CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_origens_gerais_historicas" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_afericao_origem_geral();


--
-- TRIGGER: pecuaria.EntregaLeite EntregaLeite_guard
--

CREATE CONSTRAINT TRIGGER "EntregaLeite_guard" AFTER INSERT ON pecuaria."EntregaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- TRIGGER: pecuaria.EntregaLeite EntregaLeite_imutavel
--

CREATE TRIGGER "EntregaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."EntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();


--
-- TRIGGER: pecuaria.EtapaProtocolo EtapaProtocolo_estrutura_imutavel
--

CREATE TRIGGER "EtapaProtocolo_estrutura_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."EtapaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_estrutura_protocolo();


--
-- TRIGGER: pecuaria.EtapaProtocolo EtapaProtocolo_imutavel
--

CREATE TRIGGER "EtapaProtocolo_imutavel" BEFORE UPDATE ON pecuaria."EtapaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_etapa_protocolo();


--
-- TRIGGER: pecuaria.EventoTarefaProtocolo EventoTarefaProtocolo_validar
--

CREATE TRIGGER "EventoTarefaProtocolo_validar" BEFORE INSERT OR UPDATE ON pecuaria."EventoTarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_evento_tarefa_protocolo();


--
-- TRIGGER: pecuaria.ExameAnimal ExameAnimal_pos_parto
--

CREATE CONSTRAINT TRIGGER "ExameAnimal_pos_parto" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_exame_pos_parto_trigger();


--
-- TRIGGER: pecuaria.ExameAnimal Exame_demanda_compativel
--

CREATE CONSTRAINT TRIGGER "Exame_demanda_compativel" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_exame_demanda_acompanhamento();


--
-- TRIGGER: pecuaria.ExameAnimal Exame_resolucao_demanda_final
--

CREATE CONSTRAINT TRIGGER "Exame_resolucao_demanda_final" AFTER DELETE OR UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();


--
-- TRIGGER: pecuaria.FechamentoConsumo FechamentoConsumo_fornecimento_leite
--

CREATE CONSTRAINT TRIGGER "FechamentoConsumo_fornecimento_leite" AFTER UPDATE ON pecuaria."FechamentoConsumo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- TRIGGER: pecuaria.FechamentoOperacaoLeite FechamentoOperacaoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "FechamentoOperacaoLeite_conferir" AFTER INSERT ON pecuaria."FechamentoOperacaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.FechamentoOperacaoLeite FechamentoOperacaoLeite_imutavel
--

CREATE TRIGGER "FechamentoOperacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."FechamentoOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.FechamentoOperacaoLeite FechamentoOperacaoLeite_travar
--

CREATE TRIGGER "FechamentoOperacaoLeite_travar" BEFORE INSERT ON pecuaria."FechamentoOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_fechamento_comercial_leite();


--
-- TRIGGER: pecuaria.FinalidadeAnimal FinalidadeAnimal_proteger_origem_geral
--

CREATE CONSTRAINT TRIGGER "FinalidadeAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."FinalidadeAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- TRIGGER: pecuaria.FinalidadeAnimal FinalidadeAnimal_proteger_producao
--

CREATE CONSTRAINT TRIGGER "FinalidadeAnimal_proteger_producao" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."FinalidadeAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_finalidade_com_producao();


--
-- TRIGGER: pecuaria.FinalidadeAnimal FinalidadeAnimal_travar_origem_geral
--

CREATE TRIGGER "FinalidadeAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."FinalidadeAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- TRIGGER: pecuaria.FornecimentoColostro FornecimentoColostro_contexto
--

CREATE CONSTRAINT TRIGGER "FornecimentoColostro_contexto" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();


--
-- TRIGGER: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_conservacao
--

CREATE CONSTRAINT TRIGGER "FornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();


--
-- TRIGGER: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_historico
--

CREATE TRIGGER "FornecimentoNutricionalLeite_historico" BEFORE DELETE OR UPDATE ON pecuaria."FornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();


--
-- TRIGGER: pecuaria.InterpretacaoReprodutiva Interpretacao_resolucao_demanda_final
--

CREATE CONSTRAINT TRIGGER "Interpretacao_resolucao_demanda_final" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."InterpretacaoReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();


--
-- TRIGGER: pecuaria.ItemFechamentoConsumo ItemFechamentoConsumo_fornecimento_leite
--

CREATE CONSTRAINT TRIGGER "ItemFechamentoConsumo_fornecimento_leite" AFTER UPDATE ON pecuaria."ItemFechamentoConsumo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- TRIGGER: pecuaria.LactacaoAnimal LactacaoAnimal_proteger_origem_geral
--

CREATE CONSTRAINT TRIGGER "LactacaoAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."LactacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- TRIGGER: pecuaria.LactacaoAnimal LactacaoAnimal_proteger_partos_parcelas_leite
--

CREATE CONSTRAINT TRIGGER "LactacaoAnimal_proteger_partos_parcelas_leite" AFTER DELETE OR UPDATE ON pecuaria."LactacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_partos_parcelas_leite();


--
-- TRIGGER: pecuaria.LactacaoAnimal LactacaoAnimal_travar_origem_geral
--

CREATE TRIGGER "LactacaoAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LactacaoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- TRIGGER: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_consumo_v3
--

CREATE TRIGGER "LocalizacaoAnimal_consumo_v3" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" FOR EACH ROW EXECUTE FUNCTION public.proteger_localizacao_consumo_v3();


--
-- TRIGGER: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_proteger_origem_geral
--

CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_proteger_origem_geral" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_origem_geral();


--
-- TRIGGER: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_travar_origem_geral
--

CREATE TRIGGER "LocalizacaoAnimal_travar_origem_geral" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."LocalizacaoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- TRIGGER: pecuaria.ManejoAnimal ManejoAnimal_protocolo_validar
--

CREATE TRIGGER "ManejoAnimal_protocolo_validar" BEFORE INSERT OR UPDATE ON pecuaria."ManejoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_manejo_protocolar();


--
-- TRIGGER: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_00_travar_origens
--

CREATE TRIGGER "MedicaoGeralLeite_00_travar_origens" BEFORE INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_afericao_origem_geral();


--
-- TRIGGER: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_conferir
--

CREATE TRIGGER "MedicaoGeralLeite_conferir" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."MedicaoGeralLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_medicao_geral_leite();


--
-- TRIGGER: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_conjunto_parcelas
--

CREATE CONSTRAINT TRIGGER "MedicaoGeralLeite_conjunto_parcelas" AFTER INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_conjunto_parcelas_leite();


--
-- TRIGGER: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_origens_historicas
--

CREATE CONSTRAINT TRIGGER "MedicaoGeralLeite_origens_historicas" AFTER INSERT OR UPDATE ON pecuaria."MedicaoGeralLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_afericao_origem_geral();


--
-- TRIGGER: pecuaria.MedicaoLeite MedicaoLeite_finalidade
--

CREATE TRIGGER "MedicaoLeite_finalidade" BEFORE INSERT OR UPDATE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_finalidade_medicao_leite();


--
-- TRIGGER: pecuaria.MedicaoLeite MedicaoLeite_identidade_origem
--

CREATE TRIGGER "MedicaoLeite_identidade_origem" BEFORE UPDATE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_identidade_medicao_com_origem();


--
-- TRIGGER: pecuaria.MedicaoLeite MedicaoLeite_proteger_estoque
--

CREATE TRIGGER "MedicaoLeite_proteger_estoque" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_medicao_leite_confirmada();


--
-- TRIGGER: pecuaria.MomentoProtocolo MomentoProtocolo_imutavel
--

CREATE TRIGGER "MomentoProtocolo_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."MomentoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_estrutura_protocolo();


--
-- TRIGGER: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_conservacao
--

CREATE CONSTRAINT TRIGGER "MovimentoFornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."MovimentoFornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();


--
-- TRIGGER: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_historico
--

CREATE TRIGGER "MovimentoFornecimentoNutricionalLeite_historico" BEFORE DELETE OR UPDATE ON pecuaria."MovimentoFornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();


--
-- TRIGGER: pecuaria.OcorrenciaSanitaria OcorrenciaSanitaria_rp_parto
--

CREATE CONSTRAINT TRIGGER "OcorrenciaSanitaria_rp_parto" AFTER INSERT OR UPDATE ON pecuaria."OcorrenciaSanitaria" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_rp_ocorrencia_trigger();


--
-- TRIGGER: pecuaria.OperacaoComercialLeite OperacaoComercialLeite_conferir
--

CREATE CONSTRAINT TRIGGER "OperacaoComercialLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."OperacaoComercialLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.OperacaoComercialLeite OperacaoComercialLeite_identidade
--

CREATE TRIGGER "OperacaoComercialLeite_identidade" BEFORE DELETE OR UPDATE ON pecuaria."OperacaoComercialLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.guardar_identidade_comercial_leite();


--
-- TRIGGER: pecuaria.ParcelaDestinoLeite ParcelaDestinoLeite_fatos_imutaveis
--

CREATE TRIGGER "ParcelaDestinoLeite_fatos_imutaveis" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ParcelaDestinoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_fatos_destino_leite();


--
-- TRIGGER: pecuaria.ParcelaDestinoLeite ParcelaDestinoLeite_integridade
--

CREATE CONSTRAINT TRIGGER "ParcelaDestinoLeite_integridade" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ParcelaDestinoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destino_interno_leite();


--
-- TRIGGER: pecuaria.ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_conservacao
--

CREATE CONSTRAINT TRIGGER "ParcelaFornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."ParcelaFornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();


--
-- TRIGGER: pecuaria.ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_historico
--

CREATE TRIGGER "ParcelaFornecimentoNutricionalLeite_historico" BEFORE DELETE OR UPDATE ON pecuaria."ParcelaFornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();


--
-- TRIGGER: pecuaria.ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_fornecimento_leite
--

CREATE CONSTRAINT TRIGGER "ParticipacaoConsumoAnimal_fornecimento_leite" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ParticipacaoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- TRIGGER: pecuaria.ParticipacaoConsumoAnimal ParticipacaoConsumo_conferir
--

CREATE CONSTRAINT TRIGGER "ParticipacaoConsumo_conferir" AFTER INSERT OR UPDATE ON pecuaria."ParticipacaoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_segmentos_consumo();


--
-- TRIGGER: pecuaria.ParticipacaoProtocolo ParticipacaoProtocolo_contexto
--

CREATE TRIGGER "ParticipacaoProtocolo_contexto" BEFORE INSERT OR UPDATE OF "programacaoId", "protocoloId", "propriedadeId" ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_participacao_protocolo();


--
-- TRIGGER: pecuaria.ParticipacaoProtocolo ParticipacaoProtocolo_trava_versao
--

CREATE TRIGGER "ParticipacaoProtocolo_trava_versao" BEFORE INSERT OR UPDATE OF "protocoloId" ON pecuaria."ParticipacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_versao_adotada();


--
-- TRIGGER: pecuaria.ParticipanteProducaoLeite ParticipanteLeite_proteger_estoque
--

CREATE TRIGGER "ParticipanteLeite_proteger_estoque" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ParticipanteProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_populacao_leite_confirmada();


--
-- TRIGGER: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_finalidade_evidencia
--

CREATE TRIGGER "ParticipanteProducaoLeite_finalidade_evidencia" BEFORE INSERT OR UPDATE ON pecuaria."ParticipanteProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_evidencia_finalidade_leite();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_00_desfecho_explicito
--

CREATE TRIGGER "PartoAnimal_00_desfecho_explicito" BEFORE UPDATE OF desfecho ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_desfecho_parto_explicito();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_10_compatibilidade_desfecho
--

CREATE TRIGGER "PartoAnimal_10_compatibilidade_desfecho" BEFORE INSERT OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.compatibilizar_desfecho_parto();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_colostro
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_colostro" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_colostro_trigger();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_exames_pos_parto
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_exames_pos_parto" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_exame_pos_parto_trigger();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_pesagens
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_pesagens" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_proteger_parcelas_leite
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_proteger_parcelas_leite" AFTER DELETE OR UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_partos_parcelas_leite();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_rp_ocorrencias
--

CREATE CONSTRAINT TRIGGER "PartoAnimal_rp_ocorrencias" AFTER UPDATE ON pecuaria."PartoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_rp_parto_trigger();


--
-- TRIGGER: pecuaria.PartoAnimal PartoAnimal_travar_parcelas_leite
--

CREATE TRIGGER "PartoAnimal_travar_parcelas_leite" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_historico_origem_geral();


--
-- TRIGGER: pecuaria.PartoAnimal Parto_aborto_explicado
--

CREATE TRIGGER "Parto_aborto_explicado" BEFORE INSERT OR UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_explicacao_novo_aborto();


--
-- TRIGGER: pecuaria.Pesagem Pesagem_partos
--

CREATE CONSTRAINT TRIGGER "Pesagem_partos" AFTER UPDATE ON pecuaria."Pesagem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- TRIGGER: pecuaria.Pesagem Pesagem_versao_parto
--

CREATE TRIGGER "Pesagem_versao_parto" AFTER UPDATE ON pecuaria."Pesagem" FOR EACH ROW EXECUTE FUNCTION pecuaria.atualizar_versao_parto_pesagem();


--
-- TRIGGER: pecuaria.PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamento_imutavel
--

CREATE TRIGGER "PoliticaAcompanhamento_imutavel" BEFORE UPDATE ON pecuaria."PoliticaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();


--
-- TRIGGER: pecuaria.PoliticaElegibilidadeReprodutiva PoliticaElegibilidade_imutavel
--

CREATE TRIGGER "PoliticaElegibilidade_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."PoliticaElegibilidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_politica_e_ciclo();


--
-- TRIGGER: pecuaria.PosicaoOrdenha PosicaoOrdenha_snapshot_imutavel
--

CREATE TRIGGER "PosicaoOrdenha_snapshot_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."PosicaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_posicao_ordenha_usada();


--
-- TRIGGER: pecuaria.VinculoPreparoTentativa Preparo_conferir
--

CREATE TRIGGER "Preparo_conferir" BEFORE INSERT OR UPDATE ON pecuaria."VinculoPreparoTentativa" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_preparo();


--
-- TRIGGER: pecuaria.VinculoPreparoTentativa Preparo_imutavel
--

CREATE TRIGGER "Preparo_imutavel" BEFORE UPDATE ON pecuaria."VinculoPreparoTentativa" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_preparo();


--
-- TRIGGER: pecuaria.AplicacaoProduto Preparo_limite_aplicacao
--

CREATE CONSTRAINT TRIGGER "Preparo_limite_aplicacao" AFTER UPDATE ON pecuaria."AplicacaoProduto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- TRIGGER: pecuaria.ExameAnimal Preparo_limite_exame
--

CREATE CONSTRAINT TRIGGER "Preparo_limite_exame" AFTER UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- TRIGGER: pecuaria.ParticipacaoProtocolo Preparo_limite_participacao
--

CREATE CONSTRAINT TRIGGER "Preparo_limite_participacao" AFTER UPDATE ON pecuaria."ParticipacaoProtocolo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();


--
-- TRIGGER: pecuaria.ProgramacaoProtocolo ProgramacaoProtocolo_trava_versao
--

CREATE TRIGGER "ProgramacaoProtocolo_trava_versao" BEFORE INSERT OR UPDATE OF "protocoloId" ON pecuaria."ProgramacaoProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_versao_adotada();


--
-- TRIGGER: pecuaria.Protocolo Protocolo_finalidade_imutavel
--

CREATE TRIGGER "Protocolo_finalidade_imutavel" BEFORE UPDATE OF finalidade ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_finalidade_protocolo();


--
-- TRIGGER: pecuaria.Protocolo Protocolo_referencia_publicada
--

CREATE TRIGGER "Protocolo_referencia_publicada" BEFORE UPDATE ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_referencia_protocolo_publicado();


--
-- TRIGGER: pecuaria.Protocolo Protocolo_versao
--

CREATE TRIGGER "Protocolo_versao" BEFORE INSERT OR UPDATE ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_versao_protocolo();


--
-- TRIGGER: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_comprovacao
--

CREATE TRIGGER "ReferenciaGerencialLeite_comprovacao" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."ReferenciaGerencialLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_referencia_gerencial_leite();


--
-- TRIGGER: pecuaria.ResultadoQualidadeLeite ResultadoQualidadeLeite_conferir
--

CREATE TRIGGER "ResultadoQualidadeLeite_conferir" BEFORE INSERT ON pecuaria."ResultadoQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_resultado_qualidade_leite();


--
-- TRIGGER: pecuaria.ResultadoQualidadeLeite ResultadoQualidadeLeite_preservar
--

CREATE TRIGGER "ResultadoQualidadeLeite_preservar" BEFORE DELETE OR UPDATE ON pecuaria."ResultadoQualidadeLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_resultado_qualidade_leite();


--
-- TRIGGER: pecuaria.ResultadoExame Resultado_resolucao_demanda_final
--

CREATE CONSTRAINT TRIGGER "Resultado_resolucao_demanda_final" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."ResultadoExame" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_resolucao_demanda_final();


--
-- TRIGGER: pecuaria.RetiradaOperacaoLeite RetiradaOperacaoLeite_aberta
--

CREATE TRIGGER "RetiradaOperacaoLeite_aberta" BEFORE INSERT ON pecuaria."RetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_retirada_comercial_leite();


--
-- TRIGGER: pecuaria.RetiradaOperacaoLeite RetiradaOperacaoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "RetiradaOperacaoLeite_conferir" AFTER INSERT ON pecuaria."RetiradaOperacaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.RetiradaOperacaoLeite RetiradaOperacaoLeite_imutavel
--

CREATE TRIGGER "RetiradaOperacaoLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."RetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_operacao_comercial_leite();


--
-- TRIGGER: pecuaria.SegmentoConsumoAnimal SegmentoConsumo_conferir
--

CREATE CONSTRAINT TRIGGER "SegmentoConsumo_conferir" AFTER INSERT OR DELETE OR UPDATE ON pecuaria."SegmentoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_segmentos_consumo();


--
-- TRIGGER: pecuaria.SegmentoConsumoAnimal SegmentoConsumo_imutavel
--

CREATE TRIGGER "SegmentoConsumo_imutavel" BEFORE UPDATE ON pecuaria."SegmentoConsumoAnimal" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: pecuaria.SessaoOrdenha SessaoLeite_proteger_estoque
--

CREATE TRIGGER "SessaoLeite_proteger_estoque" BEFORE DELETE OR UPDATE ON pecuaria."SessaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_sessao_leite_confirmada();


--
-- TRIGGER: pecuaria.SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_imutavel
--

CREATE TRIGGER "SnapshotRelatorioReprodutivo_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."SnapshotRelatorioReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_snapshot_relatorio_reprodutivo();


--
-- TRIGGER: pecuaria.TanqueLeite TanqueLeite_imutavel
--

CREATE TRIGGER "TanqueLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."TanqueLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: pecuaria.TarefaProtocolo TarefaProtocolo_momento_snapshot
--

CREATE TRIGGER "TarefaProtocolo_momento_snapshot" BEFORE UPDATE OF "momentoSnapshot" ON pecuaria."TarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_momento_snapshot_tarefa();


--
-- TRIGGER: pecuaria.TarefaProtocolo TarefaProtocolo_versao
--

CREATE TRIGGER "TarefaProtocolo_versao" BEFORE INSERT OR UPDATE OF "etapaId", "participacaoId" ON pecuaria."TarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_tarefa_protocolo();


--
-- TRIGGER: pecuaria.TipoExame TipoExame_preservar_qualidade
--

CREATE TRIGGER "TipoExame_preservar_qualidade" BEFORE UPDATE ON pecuaria."TipoExame" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_formato_qualidade_leite();


--
-- TRIGGER: pecuaria.VersaoSelecaoVisita VersaoSelecaoVisita_imutavel
--

CREATE TRIGGER "VersaoSelecaoVisita_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."VersaoSelecaoVisita" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_versao_selecao_visita();


--
-- TRIGGER: pecuaria.VersaoComercialVendaLeite VersaoVendaLeite_cadeia
--

CREATE CONSTRAINT TRIGGER "VersaoVendaLeite_cadeia" AFTER INSERT ON pecuaria."VersaoComercialVendaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: pecuaria.VersaoComercialVendaLeite VersaoVendaLeite_identidade
--

CREATE TRIGGER "VersaoVendaLeite_identidade" BEFORE INSERT ON pecuaria."VersaoComercialVendaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_identidade_versao_venda_leite();


--
-- TRIGGER: pecuaria.VersaoComercialVendaLeite VersaoVendaLeite_imutavel
--

CREATE TRIGGER "VersaoVendaLeite_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."VersaoComercialVendaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_mutacao_versao_venda_leite();


--
-- TRIGGER: pecuaria.VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_finalidade
--

CREATE TRIGGER "VinculoMedicaoEntradaLeite_finalidade" BEFORE INSERT OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_finalidade_medicao_leite();


--
-- TRIGGER: pecuaria.VinculoMedicaoEntradaLeite VinculoMedicaoEntrada_conferir
--

CREATE CONSTRAINT TRIGGER "VinculoMedicaoEntrada_conferir" AFTER INSERT OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_vinculo_medicao_entrada();


--
-- TRIGGER: pecuaria.VinculoMedicaoEntradaLeite VinculoMedicaoEntrada_imutavel
--

CREATE TRIGGER "VinculoMedicaoEntrada_imutavel" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_medicao_entrada();


--
-- TRIGGER: pecuaria.VinculoPesagemParto VinculoPesagemParto_contexto
--

CREATE CONSTRAINT TRIGGER "VinculoPesagemParto_contexto" AFTER INSERT OR UPDATE ON pecuaria."VinculoPesagemParto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_pesagem_parto_trigger();


--
-- TRIGGER: pecuaria.VinculoPesagemParto VinculoPesagemParto_historico
--

CREATE TRIGGER "VinculoPesagemParto_historico" BEFORE DELETE OR UPDATE ON pecuaria."VinculoPesagemParto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_pesagem_parto();


--
-- TRIGGER: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_consistencia
--

CREATE TRIGGER "VinculoPoliticaCiclo_consistencia" BEFORE INSERT ON pecuaria."VinculoPoliticaCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ciclo_elegibilidade();


--
-- TRIGGER: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_imutavel
--

CREATE TRIGGER "VinculoPoliticaCiclo_imutavel" BEFORE DELETE OR UPDATE ON pecuaria."VinculoPoliticaCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_politica_e_ciclo();


--
-- TRIGGER: pecuaria.VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_integridade
--

CREATE TRIGGER "VinculoQualidadeFechamentoLeite_integridade" BEFORE INSERT OR DELETE OR UPDATE ON pecuaria."VinculoQualidadeFechamentoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_vinculo_qualidade_fechamento();


--
-- TRIGGER: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_fato
--

CREATE TRIGGER "VinculoTarefaProtocolo_fato" BEFORE INSERT OR UPDATE ON pecuaria."VinculoTarefaProtocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_tarefa();


--
-- TRIGGER: public.AlocacaoPartidaEstoque AlocacaoPartidaEstoque_imutavel_v3
--

CREATE TRIGGER "AlocacaoPartidaEstoque_imutavel_v3" BEFORE UPDATE ON public."AlocacaoPartidaEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_alocacao_partida_v3();


--
-- TRIGGER: public.AlocacaoPartidaEstoque AlocacaoPartidaEstoque_partidas_v3
--

CREATE CONSTRAINT TRIGGER "AlocacaoPartidaEstoque_partidas_v3" AFTER INSERT OR DELETE OR UPDATE ON public."AlocacaoPartidaEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_alocacao_partida_v3();


--
-- TRIGGER: public.BaseValorizacaoEstoque BaseValorizacao_imutavel
--

CREATE TRIGGER "BaseValorizacao_imutavel" BEFORE UPDATE ON public."BaseValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: public.BaseValorizacaoEstoque BaseValorizacao_validar
--

CREATE TRIGGER "BaseValorizacao_validar" BEFORE INSERT ON public."BaseValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.conferir_base_valorizacao();


--
-- TRIGGER: public.CompromissoFinanceiro Compromisso_cadeia_leite
--

CREATE CONSTRAINT TRIGGER "Compromisso_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."CompromissoFinanceiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: public.CompromissoFinanceiro Compromisso_fechamentoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "Compromisso_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."CompromissoFinanceiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: public.MovimentoEstoque DescarteLeite_movimento
--

CREATE CONSTRAINT TRIGGER "DescarteLeite_movimento" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();


--
-- TRIGGER: public.ItemOperacao ItemOperacao_fechamentoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "ItemOperacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."ItemOperacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: public.ItemOperacao Item_cadeia_leite
--

CREATE CONSTRAINT TRIGGER "Item_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."ItemOperacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: public.Liquidacao Liquidacao_cadeia_leite
--

CREATE CONSTRAINT TRIGGER "Liquidacao_cadeia_leite" AFTER INSERT OR UPDATE ON public."Liquidacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: public.Liquidacao Liquidacao_fechamentoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "Liquidacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."Liquidacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: public.MovimentoEstoque MovimentoEstoque_conciliar_valor
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_conciliar_valor" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_valorizacao_estoque();


--
-- TRIGGER: public.MovimentoEstoque MovimentoEstoque_fornecimento_leite
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_fornecimento_leite" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();


--
-- TRIGGER: public.MovimentoEstoque MovimentoEstoque_partidas_v3
--

CREATE CONSTRAINT TRIGGER "MovimentoEstoque_partidas_v3" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_alocacao_partida_v3();


--
-- TRIGGER: public.MovimentoEstoque MovimentoEstoque_valor_imutavel
--

CREATE TRIGGER "MovimentoEstoque_valor_imutavel" BEFORE UPDATE ON public."MovimentoEstoque" FOR EACH ROW EXECUTE FUNCTION public.proteger_identidade_valorizada();


--
-- TRIGGER: public.MovimentoEstoque Movimento_cadeia_leite
--

CREATE CONSTRAINT TRIGGER "Movimento_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: public.MovimentoEstoque Movimento_retiradaComercialLeite_conferir
--

CREATE CONSTRAINT TRIGGER "Movimento_retiradaComercialLeite_conferir" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: public.Operacao Operacao_cadeia_leite
--

CREATE CONSTRAINT TRIGGER "Operacao_cadeia_leite" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: public.Operacao Operacao_demonstrativo_leite_guard
--

CREATE CONSTRAINT TRIGGER "Operacao_demonstrativo_leite_guard" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();


--
-- TRIGGER: public.Operacao Operacao_fechamentoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "Operacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- TRIGGER: public.ParcelaValorizacaoEstoque ParcelaValorizacao_conciliar_valor
--

CREATE CONSTRAINT TRIGGER "ParcelaValorizacao_conciliar_valor" AFTER INSERT OR DELETE OR UPDATE ON public."ParcelaValorizacaoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_valorizacao_estoque();


--
-- TRIGGER: public.ParcelaValorizacaoEstoque ParcelaValorizacao_imutavel
--

CREATE TRIGGER "ParcelaValorizacao_imutavel" BEFORE UPDATE ON public."ParcelaValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();


--
-- TRIGGER: public.PartidaProduto PartidaProduto_grupo_validade
--

CREATE TRIGGER "PartidaProduto_grupo_validade" BEFORE INSERT OR UPDATE ON public."PartidaProduto" FOR EACH ROW EXECUTE FUNCTION public.conferir_grupo_validade_produto();


--
-- TRIGGER: public.TransacaoFinanceira Transacao_cadeia_leite
--

CREATE CONSTRAINT TRIGGER "Transacao_cadeia_leite" AFTER INSERT OR DELETE OR UPDATE ON public."TransacaoFinanceira" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();


--
-- TRIGGER: public.TransacaoFinanceira Transacao_fechamentoLeite_conferir
--

CREATE CONSTRAINT TRIGGER "Transacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."TransacaoFinanceira" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();


--
-- FK CONSTRAINT: pecuaria.AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_demonstrativoId_fkey
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_demonstrativoId_fkey" FOREIGN KEY ("demonstrativoId") REFERENCES pecuaria."DemonstrativoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_entregaId_fkey
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES pecuaria."EntregaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AlocacaoDemonstrativoLeite AlocacaoDemonstrativoLeite_versaoVendaId_fkey
--

ALTER TABLE ONLY pecuaria."AlocacaoDemonstrativoLeite"
    ADD CONSTRAINT "AlocacaoDemonstrativoLeite_versaoVendaId_fkey" FOREIGN KEY ("versaoVendaId") REFERENCES pecuaria."VersaoComercialVendaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AlocacaoLeiteEstoque AlocacaoLeiteEstoque_classificacaoId_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_classificacaoId_entradaId_fkey" FOREIGN KEY ("classificacaoId", "entradaId") REFERENCES pecuaria."ClassificacaoEntradaLeite"(id, "entradaId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AlocacaoLeiteEstoque AlocacaoLeiteEstoque_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AlocacaoLeiteEstoque AlocacaoLeiteEstoque_movimentoId_fkey
--

ALTER TABLE ONLY pecuaria."AlocacaoLeiteEstoque"
    ADD CONSTRAINT "AlocacaoLeiteEstoque_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_exameAnimalId_fkey
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_exameAnimalId_fkey" FOREIGN KEY ("exameAnimalId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AmostraQualidadeLeite AmostraQualidadeLeite_tipoExameId_fkey
--

ALTER TABLE ONLY pecuaria."AmostraQualidadeLeite"
    ADD CONSTRAINT "AmostraQualidadeLeite_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."FormatoQualidadeLeite"("tipoExameId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Animal Animal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.Animal Animal_maeExternaId_fkey
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_maeExternaId_fkey" FOREIGN KEY ("maeExternaId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Animal Animal_maeId_fkey
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_maeId_fkey" FOREIGN KEY ("maeId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Animal Animal_paiExternoId_fkey
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_paiExternoId_fkey" FOREIGN KEY ("paiExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Animal Animal_paiId_fkey
--

ALTER TABLE ONLY pecuaria."Animal"
    ADD CONSTRAINT "Animal_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_animalId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_itemCompraDiretaId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_itemCompraDiretaId_fkey" FOREIGN KEY ("itemCompraDiretaId") REFERENCES public."ItemOperacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_movimentoEstoqueId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_ocorrenciaId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES pecuaria."OcorrenciaSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_operacaoServicoId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AplicacaoProduto AplicacaoProduto_tipoAplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."AplicacaoProduto"
    ADD CONSTRAINT "AplicacaoProduto_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ApropriacaoValorLeite ApropriacaoValorLeite_alocacaoId_fkey
--

ALTER TABLE ONLY pecuaria."ApropriacaoValorLeite"
    ADD CONSTRAINT "ApropriacaoValorLeite_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES pecuaria."AlocacaoLeiteEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ApropriacaoValorLeite ApropriacaoValorLeite_apuracaoId_fkey
--

ALTER TABLE ONLY pecuaria."ApropriacaoValorLeite"
    ADD CONSTRAINT "ApropriacaoValorLeite_apuracaoId_fkey" FOREIGN KEY ("apuracaoId") REFERENCES pecuaria."ApuracaoValorLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ApuracaoValorLeite ApuracaoValorLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."ApuracaoValorLeite"
    ADD CONSTRAINT "ApuracaoValorLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AtividadeVisita AtividadeVisita_visitaId_fkey
--

ALTER TABLE ONLY pecuaria."AtividadeVisita"
    ADD CONSTRAINT "AtividadeVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES pecuaria."VisitaVeterinaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AuditoriaPecuaria AuditoriaPecuaria_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.AuditoriaPecuaria AuditoriaPecuaria_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AuditoriaPecuaria AuditoriaPecuaria_requisicaoId_fkey
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES pecuaria."RequisicaoPecuaria"(chave) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.AuditoriaPecuaria AuditoriaPecuaria_usuarioId_fkey
--

ALTER TABLE ONLY pecuaria."AuditoriaPecuaria"
    ADD CONSTRAINT "AuditoriaPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.InterpretacaoReprodutiva AvaliacaoReprodutiva_gestacaoId_fkey
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.InterpretacaoReprodutiva AvaliacaoReprodutiva_restricaoId_fkey
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_restricaoId_fkey" FOREIGN KEY ("restricaoId") REFERENCES pecuaria."RestricaoReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.InterpretacaoReprodutiva AvaliacaoReprodutiva_tentativaId_fkey
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "AvaliacaoReprodutiva_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.BaixaAnimal BaixaAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.BaixaAnimal BaixaAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.BaixaAnimal BaixaAnimal_destinoFechadoId_fkey
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_destinoFechadoId_fkey" FOREIGN KEY ("destinoFechadoId") REFERENCES pecuaria."FinalidadeAnimal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.BaixaAnimal BaixaAnimal_localizacaoFechadaId_fkey
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_localizacaoFechadaId_fkey" FOREIGN KEY ("localizacaoFechadaId") REFERENCES pecuaria."LocalizacaoAnimal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.BaixaAnimal BaixaAnimal_motivoId_fkey
--

ALTER TABLE ONLY pecuaria."BaixaAnimal"
    ADD CONSTRAINT "BaixaAnimal_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES pecuaria."MotivoBaixa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.CategoriaAnimal CategoriaAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."CategoriaAnimal"
    ADD CONSTRAINT "CategoriaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.CategoriaManualAnimal CategoriaManualAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.CategoriaManualAnimal CategoriaManualAnimal_categoriaId_fkey
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES pecuaria."CategoriaAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.CategoriaManualAnimal CategoriaManualAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."CategoriaManualAnimal"
    ADD CONSTRAINT "CategoriaManualAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_aplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_exameId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_manejoId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_manejoId_fkey" FOREIGN KEY ("manejoId") REFERENCES pecuaria."ManejoAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoConsumoId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoConsumoId_fkey" FOREIGN KEY ("participacaoConsumoId") REFERENCES pecuaria."ParticipacaoConsumoAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_participacaoId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoCustoPecuaria ClassificacaoCustoPecuaria_tentativaId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoCustoPecuaria"
    ADD CONSTRAINT "ClassificacaoCustoPecuaria_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ClassificacaoEntradaLeite ClassificacaoEntradaLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."ClassificacaoEntradaLeite"
    ADD CONSTRAINT "ClassificacaoEntradaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ComposicaoGenitorExterno ComposicaoGenitorExterno_genitorId_fkey
--

ALTER TABLE ONLY pecuaria."ComposicaoGenitorExterno"
    ADD CONSTRAINT "ComposicaoGenitorExterno_genitorId_fkey" FOREIGN KEY ("genitorId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: pecuaria.ComposicaoGenitorExterno ComposicaoGenitorExterno_racaId_fkey
--

ALTER TABLE ONLY pecuaria."ComposicaoGenitorExterno"
    ADD CONSTRAINT "ComposicaoGenitorExterno_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES pecuaria."Raca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ComposicaoRacial ComposicaoRacial_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ComposicaoRacial ComposicaoRacial_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.ComposicaoRacial ComposicaoRacial_racaId_fkey
--

ALTER TABLE ONLY pecuaria."ComposicaoRacial"
    ADD CONSTRAINT "ComposicaoRacial_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES pecuaria."Raca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ComprovanteEntregaLeite ComprovanteEntregaLeite_entregaId_fkey
--

ALTER TABLE ONLY pecuaria."ComprovanteEntregaLeite"
    ADD CONSTRAINT "ComprovanteEntregaLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES pecuaria."EntregaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ComprovanteRetiradaOperacaoLeite ComprovanteRetiradaOperacaoLeite_retiradaId_fkey
--

ALTER TABLE ONLY pecuaria."ComprovanteRetiradaOperacaoLeite"
    ADD CONSTRAINT "ComprovanteRetiradaOperacaoLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES pecuaria."RetiradaOperacaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ConferenciaEntregaLeite ConferenciaEntregaLeite_entregaId_fkey
--

ALTER TABLE ONLY pecuaria."ConferenciaEntregaLeite"
    ADD CONSTRAINT "ConferenciaEntregaLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES pecuaria."EntregaLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ConferenciaSaldoLeite ConferenciaSaldoLeite_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."ConferenciaSaldoLeite"
    ADD CONSTRAINT "ConferenciaSaldoLeite_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ConferenciaSaldoLeite ConferenciaSaldoLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ConferenciaSaldoLeite"
    ADD CONSTRAINT "ConferenciaSaldoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ConfiguracaoOrdenha ConfiguracaoOrdenha_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ConfiguracaoOrdenha"
    ADD CONSTRAINT "ConfiguracaoOrdenha_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.CriaParto CriaParto_animalId_fkey
--

ALTER TABLE ONLY pecuaria."CriaParto"
    ADD CONSTRAINT "CriaParto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.CriaParto CriaParto_partoId_fkey
--

ALTER TABLE ONLY pecuaria."CriaParto"
    ADD CONSTRAINT "CriaParto_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DecisaoElegibilidadeCiclo DecisaoElegibilidadeCiclo_vinculoCicloId_fkey
--

ALTER TABLE ONLY pecuaria."DecisaoElegibilidadeCiclo"
    ADD CONSTRAINT "DecisaoElegibilidadeCiclo_vinculoCicloId_fkey" FOREIGN KEY ("vinculoCicloId") REFERENCES pecuaria."VinculoPoliticaCiclo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_animalId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_exameOrigemId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_exameOrigemId_fkey" FOREIGN KEY ("exameOrigemId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_exameResolucaoId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_exameResolucaoId_fkey" FOREIGN KEY ("exameResolucaoId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_gestacaoId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_politicaId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES pecuaria."PoliticaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_propriedadeOrigemId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_propriedadeOrigemId_fkey" FOREIGN KEY ("propriedadeOrigemId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemandaAcompanhamentoReprodutivo DemandaAcompanhamentoReprodutivo_tentativaId_fkey
--

ALTER TABLE ONLY pecuaria."DemandaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "DemandaAcompanhamentoReprodutivo_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemonstrativoLeite DemonstrativoLeite_parceiroId_fkey
--

ALTER TABLE ONLY pecuaria."DemonstrativoLeite"
    ADD CONSTRAINT "DemonstrativoLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DemonstrativoLeite DemonstrativoLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."DemonstrativoLeite"
    ADD CONSTRAINT "DemonstrativoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DescarteLeite DescarteLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DescarteLeite DescarteLeite_movimentoEstornoId_fkey
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DescarteLeite DescarteLeite_movimentoId_fkey
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DescarteLeite DescarteLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."DescarteLeite"
    ADD CONSTRAINT "DescarteLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DestinoInternoLeite DestinoInternoLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DestinoInternoLeite DestinoInternoLeite_movimentoEstornoId_fkey
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DestinoInternoLeite DestinoInternoLeite_movimentoId_fkey
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DestinoInternoLeite DestinoInternoLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."DestinoInternoLeite"
    ADD CONSTRAINT "DestinoInternoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DetalheFechamentoLeite DetalheFechamentoLeite_fechamentoId_fkey
--

ALTER TABLE ONLY pecuaria."DetalheFechamentoLeite"
    ADD CONSTRAINT "DetalheFechamentoLeite_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DetalheFechamentoLeite DetalheFechamentoLeite_retiradaId_fkey
--

ALTER TABLE ONLY pecuaria."DetalheFechamentoLeite"
    ADD CONSTRAINT "DetalheFechamentoLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES pecuaria."RetiradaOperacaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DiaProducaoLeite DiaProducaoLeite_configuracaoId_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."DiaProducaoLeite"
    ADD CONSTRAINT "DiaProducaoLeite_configuracaoId_propriedadeId_fkey" FOREIGN KEY ("configuracaoId", "propriedadeId") REFERENCES pecuaria."ConfiguracaoOrdenha"(id, "propriedadeId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.DiaProducaoLeite DiaProducaoLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."DiaProducaoLeite"
    ADD CONSTRAINT "DiaProducaoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Doenca Doenca_motivoBaixaSugeridoId_fkey
--

ALTER TABLE ONLY pecuaria."Doenca"
    ADD CONSTRAINT "Doenca_motivoBaixaSugeridoId_fkey" FOREIGN KEY ("motivoBaixaSugeridoId") REFERENCES pecuaria."MotivoBaixa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EmissaoRelatorioLeite EmissaoRelatorioLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."EmissaoRelatorioLeite"
    ADD CONSTRAINT "EmissaoRelatorioLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_medicaoGeralId_fkey
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_medicaoGeralId_fkey" FOREIGN KEY ("medicaoGeralId") REFERENCES pecuaria."MedicaoGeralLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_movimentoId_fkey
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EntradaProducaoLeite EntradaProducaoLeite_sessaoId_fkey
--

ALTER TABLE ONLY pecuaria."EntradaProducaoLeite"
    ADD CONSTRAINT "EntradaProducaoLeite_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES pecuaria."SessaoOrdenha"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EntregaLeite EntregaLeite_parceiroId_fkey
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EntregaLeite EntregaLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EntregaLeite EntregaLeite_retiradaId_fkey
--

ALTER TABLE ONLY pecuaria."EntregaLeite"
    ADD CONSTRAINT "EntregaLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocoloSanitario_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocoloSanitario_tipoAplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocoloSanitario_tipoExameId_fkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocoloSanitario_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocolo_materialId_fkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocolo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES pecuaria."MaterialGenetico"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocolo_momento_versao_fkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocolo_momento_versao_fkey" FOREIGN KEY ("momentoId", "protocoloId") REFERENCES pecuaria."MomentoProtocolo"(id, "protocoloId") ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- FK CONSTRAINT: pecuaria.EtapaProtocolo EtapaProtocolo_protocoloId_fkey
--

ALTER TABLE ONLY pecuaria."EtapaProtocolo"
    ADD CONSTRAINT "EtapaProtocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: pecuaria.EventoTarefaProtocolo EventoTarefaProtocolo_eventoCorrigidoId_fkey
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_eventoCorrigidoId_fkey" FOREIGN KEY ("eventoCorrigidoId") REFERENCES pecuaria."EventoTarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EventoTarefaProtocolo EventoTarefaProtocolo_registradoPorId_fkey
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.EventoTarefaProtocolo EventoTarefaProtocolo_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."EventoTarefaProtocolo"
    ADD CONSTRAINT "EventoTarefaProtocolo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_demandaAcompanhamentoId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_demandaAcompanhamentoId_fkey" FOREIGN KEY ("demandaAcompanhamentoId") REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_ocorrenciaId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES pecuaria."OcorrenciaSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_operacaoServicoId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_partoPosPartoId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_partoPosPartoId_fkey" FOREIGN KEY ("partoPosPartoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExameAnimal ExameAnimal_tipoExameId_fkey
--

ALTER TABLE ONLY pecuaria."ExameAnimal"
    ADD CONSTRAINT "ExameAnimal_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_ocorrenciaId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES pecuaria."OcorrenciaSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_operacaoServicoId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_protocoloId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ExecucaoProtocoloSanitario_rodadaId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ExecucaoProtocoloSanitario_rodadaId_fkey" FOREIGN KEY ("programacaoId") REFERENCES pecuaria."ProgramacaoProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExposicaoTouro ExposicaoTouro_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExposicaoTouro ExposicaoTouro_loteId_fkey
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExposicaoTouro ExposicaoTouro_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExposicaoTouro ExposicaoTouro_touroExternoId_fkey
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ExposicaoTouro ExposicaoTouro_touroId_fkey
--

ALTER TABLE ONLY pecuaria."ExposicaoTouro"
    ADD CONSTRAINT "ExposicaoTouro_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FechamentoConsumo FechamentoConsumo_centroCustoId_fkey
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FechamentoConsumo FechamentoConsumo_loteId_fkey
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FechamentoConsumo FechamentoConsumo_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FechamentoConsumo FechamentoConsumo_vigenciaId_fkey
--

ALTER TABLE ONLY pecuaria."FechamentoConsumo"
    ADD CONSTRAINT "FechamentoConsumo_vigenciaId_fkey" FOREIGN KEY ("vigenciaId") REFERENCES pecuaria."VigenciaDietaLote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FechamentoOperacaoLeite FechamentoOperacaoLeite_comercialId_fkey
--

ALTER TABLE ONLY pecuaria."FechamentoOperacaoLeite"
    ADD CONSTRAINT "FechamentoOperacaoLeite_comercialId_fkey" FOREIGN KEY ("comercialId") REFERENCES pecuaria."OperacaoComercialLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FechamentoOperacaoLeite FechamentoOperacaoLeite_operacaoId_fkey
--

ALTER TABLE ONLY pecuaria."FechamentoOperacaoLeite"
    ADD CONSTRAINT "FechamentoOperacaoLeite_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FinalidadeAnimal FinalidadeAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."FinalidadeAnimal"
    ADD CONSTRAINT "FinalidadeAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FinalidadeAnimal FinalidadeAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."FinalidadeAnimal"
    ADD CONSTRAINT "FinalidadeAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.FormatoQualidadeLeite FormatoQualidadeLeite_tipoExameId_fkey
--

ALTER TABLE ONLY pecuaria."FormatoQualidadeLeite"
    ADD CONSTRAINT "FormatoQualidadeLeite_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FornecimentoColostro FornecimentoColostro_criaId_fkey
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES pecuaria."CriaParto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FornecimentoColostro FornecimentoColostro_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FornecimentoColostro FornecimentoColostro_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."FornecimentoColostro"
    ADD CONSTRAINT "FornecimentoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_itemId_fkey
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES pecuaria."ItemFechamentoConsumo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.FornecimentoNutricionalLeite FornecimentoNutricionalLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."FornecimentoNutricionalLeite"
    ADD CONSTRAINT "FornecimentoNutricionalLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.GenitorExterno GenitorExterno_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."GenitorExterno"
    ADD CONSTRAINT "GenitorExterno_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.GenitorExterno GenitorExterno_fornecedorId_fkey
--

ALTER TABLE ONLY pecuaria."GenitorExterno"
    ADD CONSTRAINT "GenitorExterno_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.GestacaoAnimal GestacaoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.GestacaoAnimal GestacaoAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.GestacaoAnimal GestacaoAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.GestacaoAnimal GestacaoAnimal_tentativaId_fkey
--

ALTER TABLE ONLY pecuaria."GestacaoAnimal"
    ADD CONSTRAINT "GestacaoAnimal_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.HistoricoPrevisaoParto HistoricoPrevisaoParto_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."HistoricoPrevisaoParto"
    ADD CONSTRAINT "HistoricoPrevisaoParto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.HistoricoPrevisaoParto HistoricoPrevisaoParto_gestacaoId_fkey
--

ALTER TABLE ONLY pecuaria."HistoricoPrevisaoParto"
    ADD CONSTRAINT "HistoricoPrevisaoParto_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ImpressaoVisita ImpressaoVisita_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ImpressaoVisita"
    ADD CONSTRAINT "ImpressaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ImpressaoVisita ImpressaoVisita_visitaId_fkey
--

ALTER TABLE ONLY pecuaria."ImpressaoVisita"
    ADD CONSTRAINT "ImpressaoVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES pecuaria."VisitaVeterinaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.InterpretacaoReprodutiva InterpretacaoReprodutiva_exameId_fkey
--

ALTER TABLE ONLY pecuaria."InterpretacaoReprodutiva"
    ADD CONSTRAINT "InterpretacaoReprodutiva_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ItemDieta ItemDieta_dietaId_fkey
--

ALTER TABLE ONLY pecuaria."ItemDieta"
    ADD CONSTRAINT "ItemDieta_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES pecuaria."Dieta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ItemDieta ItemDieta_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."ItemDieta"
    ADD CONSTRAINT "ItemDieta_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ItemFechamentoConsumo ItemFechamentoConsumo_fechamentoId_fkey
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoConsumo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ItemFechamentoConsumo ItemFechamentoConsumo_movimentoEstoqueId_fkey
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ItemFechamentoConsumo ItemFechamentoConsumo_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."ItemFechamentoConsumo"
    ADD CONSTRAINT "ItemFechamentoConsumo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LactacaoAnimal LactacaoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LactacaoAnimal LactacaoAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LactacaoAnimal LactacaoAnimal_partoId_fkey
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LactacaoAnimal LactacaoAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."LactacaoAnimal"
    ADD CONSTRAINT "LactacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LaudoQualidadeLeite LaudoQualidadeLeite_amostraId_fkey
--

ALTER TABLE ONLY pecuaria."LaudoQualidadeLeite"
    ADD CONSTRAINT "LaudoQualidadeLeite_amostraId_fkey" FOREIGN KEY ("amostraId") REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_loteId_fkey
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_movimentacaoId_fkey
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES pecuaria."Movimentacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.LocalizacaoAnimal LocalizacaoAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."LocalizacaoAnimal"
    ADD CONSTRAINT "LocalizacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Lote Lote_centroCustoId_fkey
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Lote Lote_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.Lote Lote_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."Lote"
    ADD CONSTRAINT "Lote_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_insercaoAplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_insercaoAplicacaoId_fkey" FOREIGN KEY ("insercaoAplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_operacaoServicoId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_pesagemId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES pecuaria."Pesagem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ManejoAnimal ManejoAnimal_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."ManejoAnimal"
    ADD CONSTRAINT "ManejoAnimal_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_doadoraExternaId_fkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_doadoraExternaId_fkey" FOREIGN KEY ("doadoraExternaId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_doadoraId_fkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_touroExternoId_fkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MaterialGenetico MaterialGenetico_touroId_fkey
--

ALTER TABLE ONLY pecuaria."MaterialGenetico"
    ADD CONSTRAINT "MaterialGenetico_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_sessaoId_fkey
--

ALTER TABLE ONLY pecuaria."MedicaoGeralLeite"
    ADD CONSTRAINT "MedicaoGeralLeite_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES pecuaria."SessaoOrdenha"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MedicaoGeralLeite MedicaoGeralLeite_tanqueId_fkey
--

ALTER TABLE ONLY pecuaria."MedicaoGeralLeite"
    ADD CONSTRAINT "MedicaoGeralLeite_tanqueId_fkey" FOREIGN KEY ("tanqueId") REFERENCES pecuaria."TanqueLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MedicaoLeite MedicaoLeite_participanteId_diaId_fkey
--

ALTER TABLE ONLY pecuaria."MedicaoLeite"
    ADD CONSTRAINT "MedicaoLeite_participanteId_diaId_fkey" FOREIGN KEY ("participanteId", "diaId") REFERENCES pecuaria."ParticipanteProducaoLeite"(id, "diaId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MedicaoLeite MedicaoLeite_sessaoId_diaId_fkey
--

ALTER TABLE ONLY pecuaria."MedicaoLeite"
    ADD CONSTRAINT "MedicaoLeite_sessaoId_diaId_fkey" FOREIGN KEY ("sessaoId", "diaId") REFERENCES pecuaria."SessaoOrdenha"(id, "diaId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MomentoProtocolo MomentoProtocolo_protocoloId_fkey
--

ALTER TABLE ONLY pecuaria."MomentoProtocolo"
    ADD CONSTRAINT "MomentoProtocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON DELETE CASCADE;


--
-- FK CONSTRAINT: pecuaria.MotivoBaixa MotivoBaixa_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."MotivoBaixa"
    ADD CONSTRAINT "MotivoBaixa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.MovimentacaoAnimal MovimentacaoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MovimentacaoAnimal MovimentacaoAnimal_localizacaoId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES pecuaria."LocalizacaoAnimal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.MovimentacaoAnimal MovimentacaoAnimal_movimentacaoId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES pecuaria."Movimentacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MovimentacaoAnimal MovimentacaoAnimal_origemLoteId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_origemLoteId_fkey" FOREIGN KEY ("origemLoteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MovimentacaoAnimal MovimentacaoAnimal_origemPropriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentacaoAnimal"
    ADD CONSTRAINT "MovimentacaoAnimal_origemPropriedadeId_fkey" FOREIGN KEY ("origemPropriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Movimentacao Movimentacao_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.Movimentacao Movimentacao_loteDestinoId_fkey
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_loteDestinoId_fkey" FOREIGN KEY ("loteDestinoId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Movimentacao Movimentacao_propriedadeDestinoId_fkey
--

ALTER TABLE ONLY pecuaria."Movimentacao"
    ADD CONSTRAINT "Movimentacao_propriedadeDestinoId_fkey" FOREIGN KEY ("propriedadeDestinoId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_fornecimentoId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoNutricionalLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.MovimentoFornecimentoNutricionalLeite MovimentoFornecimentoNutricionalLeite_movimentoId_fkey
--

ALTER TABLE ONLY pecuaria."MovimentoFornecimentoNutricionalLeite"
    ADD CONSTRAINT "MovimentoFornecimentoNutricionalLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.OcorrenciaSanitaria OcorrenciaSanitaria_animalId_fkey
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.OcorrenciaSanitaria OcorrenciaSanitaria_doencaId_fkey
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES pecuaria."Doenca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.OcorrenciaSanitaria OcorrenciaSanitaria_partoRetencaoPlacentaId_fkey
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_partoRetencaoPlacentaId_fkey" FOREIGN KEY ("partoRetencaoPlacentaId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.OcorrenciaSanitaria OcorrenciaSanitaria_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."OcorrenciaSanitaria"
    ADD CONSTRAINT "OcorrenciaSanitaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.OperacaoComercialLeite OperacaoComercialLeite_parceiroId_fkey
--

ALTER TABLE ONLY pecuaria."OperacaoComercialLeite"
    ADD CONSTRAINT "OperacaoComercialLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.OperacaoComercialLeite OperacaoComercialLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."OperacaoComercialLeite"
    ADD CONSTRAINT "OperacaoComercialLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParcelaDestinoLeite ParcelaDestinoLeite_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParcelaDestinoLeite ParcelaDestinoLeite_destinoId_fkey
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES pecuaria."DestinoInternoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParcelaDestinoLeite ParcelaDestinoLeite_fornecimentoColostroId_fkey
--

ALTER TABLE ONLY pecuaria."ParcelaDestinoLeite"
    ADD CONSTRAINT "ParcelaDestinoLeite_fornecimentoColostroId_fkey" FOREIGN KEY ("fornecimentoColostroId") REFERENCES pecuaria."FornecimentoColostro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParcelaFornecimentoNutricionalLeite ParcelaFornecimentoNutricionalLeite_fornecimentoId_fkey
--

ALTER TABLE ONLY pecuaria."ParcelaFornecimentoNutricionalLeite"
    ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoNutricionalLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoAnimal"
    ADD CONSTRAINT "ParticipacaoConsumoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoConsumoAnimal ParticipacaoConsumoAnimal_fechamentoId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoConsumoAnimal"
    ADD CONSTRAINT "ParticipacaoConsumoAnimal_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoConsumo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoExposicao ParticipacaoExposicao_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoExposicao"
    ADD CONSTRAINT "ParticipacaoExposicao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoExposicao ParticipacaoExposicao_exposicaoId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoExposicao"
    ADD CONSTRAINT "ParticipacaoExposicao_exposicaoId_fkey" FOREIGN KEY ("exposicaoId") REFERENCES pecuaria."ExposicaoTouro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipacaoProtocolo ParticipacaoProtocolo_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipacaoProtocolo"
    ADD CONSTRAINT "ParticipacaoProtocolo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_diaId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES pecuaria."DiaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_finalidadeId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_finalidadeId_fkey" FOREIGN KEY ("finalidadeId") REFERENCES pecuaria."FinalidadeAnimal"(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_lactacaoId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_lactacaoId_fkey" FOREIGN KEY ("lactacaoId") REFERENCES pecuaria."LactacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteProducaoLeite ParticipanteProducaoLeite_localizacaoId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteProducaoLeite"
    ADD CONSTRAINT "ParticipanteProducaoLeite_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES pecuaria."LocalizacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteVisita ParticipanteVisita_animalId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteVisita ParticipanteVisita_atividadeId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES pecuaria."AtividadeVisita"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ParticipanteVisita ParticipanteVisita_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."ParticipanteVisita"
    ADD CONSTRAINT "ParticipanteVisita_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PartoAnimal PartoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PartoAnimal PartoAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PartoAnimal PartoAnimal_gestacaoId_fkey
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_gestacaoId_fkey" FOREIGN KEY ("gestacaoId") REFERENCES pecuaria."GestacaoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PartoAnimal PartoAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."PartoAnimal"
    ADD CONSTRAINT "PartoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PerfilNutricionalProduto PerfilNutricionalProduto_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."PerfilNutricionalProduto"
    ADD CONSTRAINT "PerfilNutricionalProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PerfilSanitarioProduto PerfilSanitarioProduto_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."PerfilSanitarioProduto"
    ADD CONSTRAINT "PerfilSanitarioProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PerfilSanitarioProduto PerfilSanitarioProduto_tipoAplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."PerfilSanitarioProduto"
    ADD CONSTRAINT "PerfilSanitarioProduto_tipoAplicacaoId_fkey" FOREIGN KEY ("tipoAplicacaoId") REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_animalId_fkey
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PeriodoReprodutivoAnimal PeriodoReprodutivoAnimal_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."PeriodoReprodutivoAnimal"
    ADD CONSTRAINT "PeriodoReprodutivoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Pesagem Pesagem_animalId_fkey
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Pesagem Pesagem_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.Pesagem Pesagem_requisicaoId_fkey
--

ALTER TABLE ONLY pecuaria."Pesagem"
    ADD CONSTRAINT "Pesagem_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES pecuaria."RequisicaoPecuaria"(chave) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PoliticaAcompanhamentoReprodutivo PoliticaAcompanhamentoReprodutivo_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."PoliticaAcompanhamentoReprodutivo"
    ADD CONSTRAINT "PoliticaAcompanhamentoReprodutivo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PoliticaElegibilidadeReprodutiva PoliticaElegibilidadeReprodutiva_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."PoliticaElegibilidadeReprodutiva"
    ADD CONSTRAINT "PoliticaElegibilidadeReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PoliticaElegibilidadeReprodutiva PoliticaElegibilidadeReprodutiva_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."PoliticaElegibilidadeReprodutiva"
    ADD CONSTRAINT "PoliticaElegibilidadeReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.PosicaoOrdenha PosicaoOrdenha_configuracaoId_fkey
--

ALTER TABLE ONLY pecuaria."PosicaoOrdenha"
    ADD CONSTRAINT "PosicaoOrdenha_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES pecuaria."ConfiguracaoOrdenha"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ProgramacaoProtocolo ProgramacaoProtocolo_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "ProgramacaoProtocolo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ProgramacaoRetiradaLeite ProgramacaoRetiradaLeite_produtoId_fkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoRetiradaLeite"
    ADD CONSTRAINT "ProgramacaoRetiradaLeite_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ProgramacaoRetiradaLeite ProgramacaoRetiradaLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoRetiradaLeite"
    ADD CONSTRAINT "ProgramacaoRetiradaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Protocolo Protocolo_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."Protocolo"
    ADD CONSTRAINT "Protocolo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.Raca Raca_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."Raca"
    ADD CONSTRAINT "Raca_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_fechamentoId_fkey
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_fornecimentoId_fkey
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES pecuaria."FornecimentoNutricionalLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ReferenciaGerencialLeite ReferenciaGerencialLeite_parceiroId_fkey
--

ALTER TABLE ONLY pecuaria."ReferenciaGerencialLeite"
    ADD CONSTRAINT "ReferenciaGerencialLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RegraSanitariaReprodutiva RegraSanitariaReprodutiva_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RegraSanitariaReprodutiva RegraSanitariaReprodutiva_doencaId_fkey
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES pecuaria."Doenca"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RegraSanitariaReprodutiva RegraSanitariaReprodutiva_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."RegraSanitariaReprodutiva"
    ADD CONSTRAINT "RegraSanitariaReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RequisicaoPecuaria RequisicaoPecuaria_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."RequisicaoPecuaria"
    ADD CONSTRAINT "RequisicaoPecuaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RequisicaoPecuaria RequisicaoPecuaria_usuarioId_fkey
--

ALTER TABLE ONLY pecuaria."RequisicaoPecuaria"
    ADD CONSTRAINT "RequisicaoPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: pecuaria.RestricaoReprodutiva RestricaoReprodutiva_animalId_fkey
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RestricaoReprodutiva RestricaoReprodutiva_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RestricaoReprodutiva RestricaoReprodutiva_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."RestricaoReprodutiva"
    ADD CONSTRAINT "RestricaoReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ResultadoExame ResultadoExame_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."ResultadoExame"
    ADD CONSTRAINT "ResultadoExame_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ResultadoExame ResultadoExame_exameId_fkey
--

ALTER TABLE ONLY pecuaria."ResultadoExame"
    ADD CONSTRAINT "ResultadoExame_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: pecuaria.ResultadoQualidadeLeite ResultadoQualidadeLeite_amostraId_fkey
--

ALTER TABLE ONLY pecuaria."ResultadoQualidadeLeite"
    ADD CONSTRAINT "ResultadoQualidadeLeite_amostraId_fkey" FOREIGN KEY ("amostraId") REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RetiradaOperacaoLeite RetiradaOperacaoLeite_comercialId_fkey
--

ALTER TABLE ONLY pecuaria."RetiradaOperacaoLeite"
    ADD CONSTRAINT "RetiradaOperacaoLeite_comercialId_fkey" FOREIGN KEY ("comercialId") REFERENCES pecuaria."OperacaoComercialLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.RetiradaOperacaoLeite RetiradaOperacaoLeite_movimentoId_fkey
--

ALTER TABLE ONLY pecuaria."RetiradaOperacaoLeite"
    ADD CONSTRAINT "RetiradaOperacaoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ProgramacaoProtocolo RodadaProtocoloSanitario_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "RodadaProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.ProgramacaoProtocolo RodadaProtocoloSanitario_protocoloId_fkey
--

ALTER TABLE ONLY pecuaria."ProgramacaoProtocolo"
    ADD CONSTRAINT "RodadaProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SegmentoConsumoAnimal SegmentoConsumoAnimal_participacaoId_fkey
--

ALTER TABLE ONLY pecuaria."SegmentoConsumoAnimal"
    ADD CONSTRAINT "SegmentoConsumoAnimal_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoConsumoAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SelecaoVisita SelecaoVisita_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."SelecaoVisita"
    ADD CONSTRAINT "SelecaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SelecaoVisita SelecaoVisita_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."SelecaoVisita"
    ADD CONSTRAINT "SelecaoVisita_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SessaoOrdenha SessaoOrdenha_diaId_fkey
--

ALTER TABLE ONLY pecuaria."SessaoOrdenha"
    ADD CONSTRAINT "SessaoOrdenha_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES pecuaria."DiaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SituacaoInicialReprodutiva SituacaoInicialReprodutiva_animalId_fkey
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SituacaoInicialReprodutiva SituacaoInicialReprodutiva_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SituacaoInicialReprodutiva SituacaoInicialReprodutiva_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."SituacaoInicialReprodutiva"
    ADD CONSTRAINT "SituacaoInicialReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."SnapshotRelatorioReprodutivo"
    ADD CONSTRAINT "SnapshotRelatorioReprodutivo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.SnapshotRelatorioReprodutivo SnapshotRelatorioReprodutivo_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."SnapshotRelatorioReprodutivo"
    ADD CONSTRAINT "SnapshotRelatorioReprodutivo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TanqueLeite TanqueLeite_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."TanqueLeite"
    ADD CONSTRAINT "TanqueLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TarefaProtocolo TarefaSanitaria_etapaId_fkey
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaSanitaria_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES pecuaria."EtapaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TarefaProtocolo TarefaSanitaria_execucaoId_fkey
--

ALTER TABLE ONLY pecuaria."TarefaProtocolo"
    ADD CONSTRAINT "TarefaSanitaria_execucaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_animalId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_materialId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES pecuaria."MaterialGenetico"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_movimentoEstoqueId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_operacaoServicoId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_partidaId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_touroExternoId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES pecuaria."GenitorExterno"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TentativaReprodutiva TentativaReprodutiva_touroId_fkey
--

ALTER TABLE ONLY pecuaria."TentativaReprodutiva"
    ADD CONSTRAINT "TentativaReprodutiva_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.TipoExame TipoExame_versaoAnteriorId_fkey
--

ALTER TABLE ONLY pecuaria."TipoExame"
    ADD CONSTRAINT "TipoExame_versaoAnteriorId_fkey" FOREIGN KEY ("versaoAnteriorId") REFERENCES pecuaria."TipoExame"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VersaoComercialVendaLeite VersaoComercialVendaLeite_operacaoId_fkey
--

ALTER TABLE ONLY pecuaria."VersaoComercialVendaLeite"
    ADD CONSTRAINT "VersaoComercialVendaLeite_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VersaoComercialVendaLeite VersaoComercialVendaLeite_retiradaId_fkey
--

ALTER TABLE ONLY pecuaria."VersaoComercialVendaLeite"
    ADD CONSTRAINT "VersaoComercialVendaLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VersaoSelecaoVisita VersaoSelecaoVisita_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."VersaoSelecaoVisita"
    ADD CONSTRAINT "VersaoSelecaoVisita_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VersaoSelecaoVisita VersaoSelecaoVisita_selecaoId_fkey
--

ALTER TABLE ONLY pecuaria."VersaoSelecaoVisita"
    ADD CONSTRAINT "VersaoSelecaoVisita_selecaoId_fkey" FOREIGN KEY ("selecaoId") REFERENCES pecuaria."SelecaoVisita"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VigenciaDietaLote VigenciaDietaLote_dietaId_fkey
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES pecuaria."Dieta"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VigenciaDietaLote VigenciaDietaLote_loteId_fkey
--

ALTER TABLE ONLY pecuaria."VigenciaDietaLote"
    ADD CONSTRAINT "VigenciaDietaLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES pecuaria."Lote"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_entradaId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoMedicaoEntradaLeite"
    ADD CONSTRAINT "VinculoMedicaoEntradaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES pecuaria."EntradaProducaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoMedicaoEntradaLeite VinculoMedicaoEntradaLeite_medicaoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoMedicaoEntradaLeite"
    ADD CONSTRAINT "VinculoMedicaoEntradaLeite_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES pecuaria."MedicaoLeite"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPesagemParto VinculoPesagemParto_criaId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_criaId_fkey" FOREIGN KEY ("criaId") REFERENCES pecuaria."CriaParto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPesagemParto VinculoPesagemParto_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPesagemParto VinculoPesagemParto_partoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPesagemParto VinculoPesagemParto_pesagemId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES pecuaria."Pesagem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPesagemParto VinculoPesagemParto_revogadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPesagemParto"
    ADD CONSTRAINT "VinculoPesagemParto_revogadoPorId_fkey" FOREIGN KEY ("revogadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_animalId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_partoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_politicaId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_politicaId_fkey" FOREIGN KEY ("politicaId") REFERENCES pecuaria."PoliticaElegibilidadeReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPoliticaCiclo VinculoPoliticaCiclo_situacaoInicialId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPoliticaCiclo"
    ADD CONSTRAINT "VinculoPoliticaCiclo_situacaoInicialId_fkey" FOREIGN KEY ("situacaoInicialId") REFERENCES pecuaria."SituacaoInicialReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPreparoTentativa VinculoPreparoTentativa_aplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPreparoTentativa VinculoPreparoTentativa_exameId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPreparoTentativa VinculoPreparoTentativa_participacaoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES pecuaria."ParticipacaoProtocolo"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoPreparoTentativa VinculoPreparoTentativa_tentativaId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoPreparoTentativa"
    ADD CONSTRAINT "VinculoPreparoTentativa_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_amostraId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoQualidadeFechamentoLeite"
    ADD CONSTRAINT "VinculoQualidadeFechamentoLeite_amostraId_fkey" FOREIGN KEY ("amostraId") REFERENCES pecuaria."AmostraQualidadeLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoQualidadeFechamentoLeite VinculoQualidadeFechamentoLeite_fechamentoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoQualidadeFechamentoLeite"
    ADD CONSTRAINT "VinculoQualidadeFechamentoLeite_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_aplicacaoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_aplicacaoId_fkey" FOREIGN KEY ("aplicacaoId") REFERENCES pecuaria."AplicacaoProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_exameId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_manejoId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_manejoId_fkey" FOREIGN KEY ("manejoId") REFERENCES pecuaria."ManejoAnimal"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_registradoPorId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_tarefaId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES pecuaria."TarefaProtocolo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VinculoTarefaProtocolo VinculoTarefaProtocolo_tentativaId_fkey
--

ALTER TABLE ONLY pecuaria."VinculoTarefaProtocolo"
    ADD CONSTRAINT "VinculoTarefaProtocolo_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES pecuaria."TentativaReprodutiva"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VisitaVeterinaria VisitaVeterinaria_criadoPorId_fkey
--

ALTER TABLE ONLY pecuaria."VisitaVeterinaria"
    ADD CONSTRAINT "VisitaVeterinaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: pecuaria.VisitaVeterinaria VisitaVeterinaria_propriedadeId_fkey
--

ALTER TABLE ONLY pecuaria."VisitaVeterinaria"
    ADD CONSTRAINT "VisitaVeterinaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.AlocacaoPartidaEstoque AlocacaoPartidaEstoque_movimentoEstoqueId_fkey
--

ALTER TABLE ONLY public."AlocacaoPartidaEstoque"
    ADD CONSTRAINT "AlocacaoPartidaEstoque_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.AlocacaoPartidaEstoque AlocacaoPartidaEstoque_partidaId_fkey
--

ALTER TABLE ONLY public."AlocacaoPartidaEstoque"
    ADD CONSTRAINT "AlocacaoPartidaEstoque_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.AuditoriaFinanceira AuditoriaFinanceira_usuarioId_fkey
--

ALTER TABLE ONLY public."AuditoriaFinanceira"
    ADD CONSTRAINT "AuditoriaFinanceira_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.BaseValorizacaoEstoque BaseValorizacaoEstoque_baseOrigemId_fkey
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_baseOrigemId_fkey" FOREIGN KEY ("baseOrigemId") REFERENCES public."BaseValorizacaoEstoque"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.BaseValorizacaoEstoque BaseValorizacaoEstoque_origemMovimentoId_fkey
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_origemMovimentoId_fkey" FOREIGN KEY ("origemMovimentoId") REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.BaseValorizacaoEstoque BaseValorizacaoEstoque_partidaId_fkey
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.BaseValorizacaoEstoque BaseValorizacaoEstoque_produtoId_fkey
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.BaseValorizacaoEstoque BaseValorizacaoEstoque_propriedadeId_fkey
--

ALTER TABLE ONLY public."BaseValorizacaoEstoque"
    ADD CONSTRAINT "BaseValorizacaoEstoque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.Categoria Categoria_grupoId_fkey
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES public."GrupoCategoria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.CompromissoFinanceiro CompromissoFinanceiro_operacaoId_fkey
--

ALTER TABLE ONLY public."CompromissoFinanceiro"
    ADD CONSTRAINT "CompromissoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.CompromissoFinanceiro CompromissoFinanceiro_parceiroId_fkey
--

ALTER TABLE ONLY public."CompromissoFinanceiro"
    ADD CONSTRAINT "CompromissoFinanceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.ContaFinanceira ContaFinanceira_propriedadeId_fkey
--

ALTER TABLE ONLY public."ContaFinanceira"
    ADD CONSTRAINT "ContaFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.ConversaWhatsapp ConversaWhatsapp_usuarioId_fkey
--

ALTER TABLE ONLY public."ConversaWhatsapp"
    ADD CONSTRAINT "ConversaWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."UsuarioWhatsapp"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.DocumentoFinanceiro DocumentoFinanceiro_compromissoId_fkey
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES public."CompromissoFinanceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.DocumentoFinanceiro DocumentoFinanceiro_operacaoId_fkey
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.DocumentoFinanceiro DocumentoFinanceiro_rascunhoId_fkey
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_rascunhoId_fkey" FOREIGN KEY ("rascunhoId") REFERENCES public."RascunhoOperacao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.DocumentoFinanceiro DocumentoFinanceiro_transacaoId_fkey
--

ALTER TABLE ONLY public."DocumentoFinanceiro"
    ADD CONSTRAINT "DocumentoFinanceiro_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.ItemOperacao ItemOperacao_categoriaId_fkey
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.ItemOperacao ItemOperacao_centroCustoId_fkey
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.ItemOperacao ItemOperacao_operacaoId_fkey
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.ItemOperacao ItemOperacao_produtoId_fkey
--

ALTER TABLE ONLY public."ItemOperacao"
    ADD CONSTRAINT "ItemOperacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Liquidacao Liquidacao_compromissoId_fkey
--

ALTER TABLE ONLY public."Liquidacao"
    ADD CONSTRAINT "Liquidacao_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES public."CompromissoFinanceiro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.Liquidacao Liquidacao_transacaoId_fkey
--

ALTER TABLE ONLY public."Liquidacao"
    ADD CONSTRAINT "Liquidacao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.MensagemWhatsapp MensagemWhatsapp_conversaId_fkey
--

ALTER TABLE ONLY public."MensagemWhatsapp"
    ADD CONSTRAINT "MensagemWhatsapp_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES public."ConversaWhatsapp"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.MovimentoConta MovimentoConta_contaId_fkey
--

ALTER TABLE ONLY public."MovimentoConta"
    ADD CONSTRAINT "MovimentoConta_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES public."ContaFinanceira"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.MovimentoConta MovimentoConta_transacaoId_fkey
--

ALTER TABLE ONLY public."MovimentoConta"
    ADD CONSTRAINT "MovimentoConta_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_centroCustoId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_criadoPorId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_itemOperacaoId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_itemOperacaoId_fkey" FOREIGN KEY ("itemOperacaoId") REFERENCES public."ItemOperacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_operacaoId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_produtoId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_propriedadeId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.MovimentoEstoque MovimentoEstoque_reversaoDeId_fkey
--

ALTER TABLE ONLY public."MovimentoEstoque"
    ADD CONSTRAINT "MovimentoEstoque_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES public."MovimentoEstoque"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Operacao Operacao_categoriaId_fkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Operacao Operacao_centroCustoId_fkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Operacao Operacao_corrigeOperacaoId_fkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_corrigeOperacaoId_fkey" FOREIGN KEY ("corrigeOperacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Operacao Operacao_criadoPorId_fkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Operacao Operacao_parceiroId_fkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.Operacao Operacao_propriedadeId_fkey
--

ALTER TABLE ONLY public."Operacao"
    ADD CONSTRAINT "Operacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.ParceiroPapel ParceiroPapel_parceiroId_fkey
--

ALTER TABLE ONLY public."ParceiroPapel"
    ADD CONSTRAINT "ParceiroPapel_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.ParcelaValorizacaoEstoque ParcelaValorizacaoEstoque_baseId_fkey
--

ALTER TABLE ONLY public."ParcelaValorizacaoEstoque"
    ADD CONSTRAINT "ParcelaValorizacaoEstoque_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES public."BaseValorizacaoEstoque"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.ParcelaValorizacaoEstoque ParcelaValorizacaoEstoque_movimentoEstoqueId_fkey
--

ALTER TABLE ONLY public."ParcelaValorizacaoEstoque"
    ADD CONSTRAINT "ParcelaValorizacaoEstoque_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.PartidaProduto PartidaProduto_lotePrincipalId_fkey
--

ALTER TABLE ONLY public."PartidaProduto"
    ADD CONSTRAINT "PartidaProduto_lotePrincipalId_fkey" FOREIGN KEY ("lotePrincipalId") REFERENCES public."PartidaProduto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.PartidaProduto PartidaProduto_produtoId_fkey
--

ALTER TABLE ONLY public."PartidaProduto"
    ADD CONSTRAINT "PartidaProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.PeriodoFinanceiro PeriodoFinanceiro_fechadoPorId_fkey
--

ALTER TABLE ONLY public."PeriodoFinanceiro"
    ADD CONSTRAINT "PeriodoFinanceiro_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.PeriodoFinanceiro PeriodoFinanceiro_propriedadeId_fkey
--

ALTER TABLE ONLY public."PeriodoFinanceiro"
    ADD CONSTRAINT "PeriodoFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.ProdutoCentroCusto ProdutoCentroCusto_centroCustoId_fkey
--

ALTER TABLE ONLY public."ProdutoCentroCusto"
    ADD CONSTRAINT "ProdutoCentroCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES public."CentroCusto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.ProdutoCentroCusto ProdutoCentroCusto_produtoId_fkey
--

ALTER TABLE ONLY public."ProdutoCentroCusto"
    ADD CONSTRAINT "ProdutoCentroCusto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.ProdutoFornecedor ProdutoFornecedor_fornecedorId_fkey
--

ALTER TABLE ONLY public."ProdutoFornecedor"
    ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.ProdutoFornecedor ProdutoFornecedor_produtoId_fkey
--

ALTER TABLE ONLY public."ProdutoFornecedor"
    ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.Produto Produto_categoriaId_fkey
--

ALTER TABLE ONLY public."Produto"
    ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.RascunhoOperacao RascunhoOperacao_criadoPorId_fkey
--

ALTER TABLE ONLY public."RascunhoOperacao"
    ADD CONSTRAINT "RascunhoOperacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.RascunhoOperacao RascunhoOperacao_propriedadeId_fkey
--

ALTER TABLE ONLY public."RascunhoOperacao"
    ADD CONSTRAINT "RascunhoOperacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.RascunhoRelatorioFinanceiro RascunhoRelatorioFinanceiro_criadoPorId_fkey
--

ALTER TABLE ONLY public."RascunhoRelatorioFinanceiro"
    ADD CONSTRAINT "RascunhoRelatorioFinanceiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.RascunhoRelatorioFinanceiro RascunhoRelatorioFinanceiro_propriedadeId_fkey
--

ALTER TABLE ONLY public."RascunhoRelatorioFinanceiro"
    ADD CONSTRAINT "RascunhoRelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.RelatorioFinanceiro RelatorioFinanceiro_autorId_fkey
--

ALTER TABLE ONLY public."RelatorioFinanceiro"
    ADD CONSTRAINT "RelatorioFinanceiro_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.RelatorioFinanceiro RelatorioFinanceiro_propriedadeId_fkey
--

ALTER TABLE ONLY public."RelatorioFinanceiro"
    ADD CONSTRAINT "RelatorioFinanceiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.Sessao Sessao_usuarioId_fkey
--

ALTER TABLE ONLY public."Sessao"
    ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.TokenAcesso TokenAcesso_usuarioId_fkey
--

ALTER TABLE ONLY public."TokenAcesso"
    ADD CONSTRAINT "TokenAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- FK CONSTRAINT: public.TransacaoFinanceira TransacaoFinanceira_criadoPorId_fkey
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.TransacaoFinanceira TransacaoFinanceira_operacaoId_fkey
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES public."Operacao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.TransacaoFinanceira TransacaoFinanceira_parceiroId_fkey
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES public."Parceiro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- FK CONSTRAINT: public.TransacaoFinanceira TransacaoFinanceira_propriedadeId_fkey
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- FK CONSTRAINT: public.TransacaoFinanceira TransacaoFinanceira_reversaoDeId_fkey
--

ALTER TABLE ONLY public."TransacaoFinanceira"
    ADD CONSTRAINT "TransacaoFinanceira_reversaoDeId_fkey" FOREIGN KEY ("reversaoDeId") REFERENCES public."TransacaoFinanceira"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


-- Catálogos estruturais mínimos; nenhum dado é extraído das tabelas operacionais.
-- Catálogo estrutural: 20260925130000_pecuaria_v1_rebanho
INSERT INTO "pecuaria"."CategoriaAnimal" ("id", "ideagriId", "chavePadrao", "nome", "sexo", "automatica", "idadeMinMeses", "idadeMaxMeses", "partos", "ordem", "atualizadoEm") VALUES
  (gen_random_uuid()::text, 7, 'F_VACA',           'Vaca',           'F', true,  NULL, NULL, 'COM',      10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 5, 'F_EM_CRESCIMENTO', 'Em crescimento', 'F', true,  NULL, 12,   'SEM',      20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 6, 'F_NOVILHA',        'Novilha',        'F', true,  12,   NULL, 'SEM',      30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 1, 'M_EM_CRESCIMENTO', 'Em crescimento', 'M', true,  NULL, NULL, 'QUALQUER', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 2, 'M_REPRODUTOR',     'Reprodutor',     'M', false, NULL, NULL, 'QUALQUER', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3, 'M_BOI_CARREIRO',   'Boi carreiro',   'M', false, NULL, NULL, 'QUALQUER', 60, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 4, 'M_RUFIAO',         'Rufião',         'M', false, NULL, NULL, 'QUALQUER', 70, CURRENT_TIMESTAMP);

-- Catálogo estrutural: 20261001020000_interface_v3
INSERT INTO pecuaria."TipoAplicacaoSanitaria" (id, nome) VALUES
('a0300000-0000-4000-8000-000000000001', 'Tratamento'),
('a0300000-0000-4000-8000-000000000002', 'Vacina'),
('a0300000-0000-4000-8000-000000000003', 'Vermífugo');

-- Catálogo estrutural: 20261002190000_produto_usos_proprios
INSERT INTO "public"."Categoria" (id, nome, classificacao, ativo, ordem)
VALUES ('81939a31-d31b-4e1c-885e-681468621bc1', 'Sanidade', 'CUSTEIO', true, 0),
       ('81939a31-d31b-4e1c-885e-681468621bc2', 'Nutrição', 'CUSTEIO', true, 0)
ON CONFLICT (nome) DO NOTHING;

-- Catálogo estrutural: 20261014150000_exame_comum
INSERT INTO pecuaria."TipoExame" (id,nome,"tipoResultado",contexto,campos)
VALUES ('b0400000-0000-4000-8000-000000000001','Avaliação reprodutiva','MULTIPLO','REPRODUTIVO',
 '[{"codigo":"CONCLUSAO_GESTACIONAL","tipo":"OPCAO","opcoes":["POSITIVO","NEGATIVO","INCONCLUSIVO"]},{"codigo":"SEXO_FETAL","tipo":"OPCAO","opcoes":["M","F"]}]'::jsonb);

-- Catálogo estrutural: 20261015020000_exame_pos_parto
INSERT INTO pecuaria."TipoExame" (id,nome,"tipoResultado",contexto,"versaoFormato",campos)
VALUES ('b0841f3c-3f88-4c2d-9d0d-3ef33d49b841','Escore corporal · avaliação estruturada','MULTIPLO','COMPARTILHADO',1,
 '[{"codigo":"ESCORE","rotulo":"Escore corporal","tipo":"NUMERO","obrigatorio":true},{"codigo":"ESCALA_MIN","rotulo":"Mínimo da escala","tipo":"NUMERO","obrigatorio":true},{"codigo":"ESCALA_MAX","rotulo":"Máximo da escala","tipo":"NUMERO","obrigatorio":true},{"codigo":"ESCALA_DESCRICAO","rotulo":"Descrição da escala","tipo":"TEXTO","obrigatorio":false}]'::jsonb);

SET search_path TO public;

COMMIT;
