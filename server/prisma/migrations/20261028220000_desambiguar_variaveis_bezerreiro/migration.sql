-- Variáveis PL/pgSQL e aliases SQL pertencem a espaços de resolução sobrepostos.
-- Substitui somente os nomes ambíguos: predicates, locks, erros e triggers se mantêm.
-- Também cobre movimentos comuns, nos quais a consulta deve simplesmente retornar zero origens.
BEGIN;

CREATE OR REPLACE FUNCTION pecuaria.conferir_participacao_bezerreiro(animal_id text) RETURNS void LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION pecuaria.conferir_oferta_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION pecuaria.conferir_contexto_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION pecuaria.conferir_acompanhamento_colostragem() RETURNS trigger LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION pecuaria.observar_fisico_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
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

COMMIT;
