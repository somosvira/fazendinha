/* Dump delimitado do rebanho real do Ideagri (Fazenda 777 — Sítio São Francisco).
 *
 * Roda via FBCVT/isql.exe contra uma CÓPIA do DADOS777.FDB (nunca o vivo).
 * Cada linha sai prefixada (@A@/@P@/@R@/@L@) para o transformador rotear.
 * Campos separados por '~|~'. Datas saem 'YYYY-MM-DD'. NÃO selecionar colunas
 * blob (OBSERVACAO etc.) — quebram o isql (SU$APPENDBLOBTOFILE).
 *
 * Filtro do rebanho (espelha a listagem do Ideagri, todos os status):
 *   TIPOANIMAL='A'  (Animal — exclui Embrião 'E' e Sêmen 'S')
 *   ANIMALREBANHO=1 (pertence à fazenda)
 * Ativo ⇔ DTBAIXA IS NULL. (522 ativos + 109 baixados = 631)
 */
SET HEADING OFF;
-- largura folgada: a linha concatenada de um animal chega a ~250 chars; 2000 dá
-- margem p/ nomes/setores/pelagens longos sem truncar campos (isql trunca calado).
SET WIDTH LINHA 2000;

/* ── CONTRATO INTERMEDIÁRIO DO ACASALAMENTO (BLOCO D) ────────────────────────
 * Delimitador ~|~; prefixos/campos esperados pelo build-rebanho-json:
 * @MEDACAS@     ideagriId | nome | tipo | consanguinidadeMax | exigePedigree(0|1) | ativo(0|1)
 * @ITEMMEDACAS@ medidaIdeagriId | indicadorSigla | peso | minimo | maximo
 * @COMBACAS@    ideagriId | nome | ativo(0|1)
 * @ITEMCOMBACAS@ combinacaoIdeagriId | medidaIdeagriId | peso | obrigatoria(0|1) | ordem
 * @CASOACAS@    ideagriId | nome | entradaJson | rankingEsperadoJson
 *
 * GAP confirmado na fonte (DADOS777.FDB, backup 2026-07-28): o IDEAGRI desta base
 * NÃO persiste medidas/combinações/casos de acasalamento. ESQUEMAMEDIDA=0,
 * ESQUEMAMEDIDAITEM=0, MEDIDASCOMBINADAS=0, RECOMENDACAO=0; TIPOMEDIDA=38 e
 * MEDIDA=93 referem-se só a escore corporal (não ao motor de acasalamento). A
 * tela "Recomendação de acasalamento" só grava até 3 reprodutores manuais por
 * animal (RECOMENDACAO.CDREPRODUTOR1/2/3), sem pesos, ranking ou consanguinidade.
 * Não há SELECT para estes prefixos: emiti-los seria inventar dado. Bloco D fica
 * N/A na fonte; o motor do Fazendinha permanece coberto pela fixture sintética.
 */

/* ── ANIMAIS (631) ────────────────────────────────────────────────────────── */
SELECT '@A@' || a.NUMERO
  || '~|~' || COALESCE(a.NOME,'')
  || '~|~' || a.SEXO
  || '~|~' || CAST(a.CDCATEGORIA AS VARCHAR(4))
  || '~|~' || COALESCE(CAST(a.DTNASCIMENTO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(a.DTENTFAZENDA AS VARCHAR(12)),'')
  || '~|~' || COALESCE(a.BRINCOELETRONICO,'')
  || '~|~' || COALESCE(a.SISBOV,'')
  || '~|~' || COALESCE(CAST(a.NUMPARTOENTRADA AS VARCHAR(8)),'0')
  || '~|~' || (CASE WHEN a.DTBAIXA IS NULL THEN 'ATIVO' ELSE 'BAIXADO' END)
  || '~|~' || COALESCE(CAST(a.DTBAIXA AS VARCHAR(12)),'')
  || '~|~' || COALESCE(mb.DESCRICAO,'')
  || '~|~' || COALESCE(c.SETOR,'')
  || '~|~' || COALESCE(c.RACA,'')
  || '~|~' || COALESCE(c.GRUPO,'')
  || '~|~' || COALESCE(mae.NUMERO,'')
  || '~|~' || COALESCE(pai.NOME, pai.NUMERO, '')
  AS "LINHA"
FROM ANIMAL a
  LEFT JOIN MOTIVOBAIXA mb ON mb.CDMOTIVOBAIXA = a.CDMOTIVOBAIXA
  LEFT JOIN ANIMALINFO_CADASTRO c ON c.CDANIMAL = a.CDANIMAL
  LEFT JOIN ANIMAL mae ON mae.CDANIMAL = a.CDMAE
  LEFT JOIN ANIMAL pai ON pai.CDANIMAL = a.CDPAI
WHERE a.TIPOANIMAL='A'
  AND (a.ANIMALREBANHO=1 OR EXISTS (SELECT 1 FROM COLETA co WHERE co.CDDOADORA = a.CDANIMAL))
ORDER BY a.NUMERO;

/* ── PRODUÇÃO (read-model ANIMALINFO_PRODUCAO) ────────────────────────────── */
SELECT '@P@' || a.NUMERO
  || '~|~' || COALESCE(CAST(p.ORDEMLACTACAO AS VARCHAR(6)),'')
  || '~|~' || COALESCE(CAST(p.MEDIAPRODLACATUAL AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(p.PRODUCAO305ULTLAC AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(p.ULTCCSLACATUAL AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(p.DTPREVISTASECAGEM AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(p.DTINICIOULTLAC AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(p.DTULTSECAGEM AS VARCHAR(12)),'')
  AS "LINHA"
FROM ANIMALINFO_PRODUCAO p
  JOIN ANIMAL a ON a.CDANIMAL = p.CDANIMAL
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1;

/* ── REPRODUÇÃO (read-model ANIMALINFO_REPRODUCAO) ────────────────────────── */
SELECT '@R@' || a.NUMERO
  || '~|~' || COALESCE(CAST(r.DTULTDG AS VARCHAR(12)),'')
  || '~|~' || COALESCE(r.RESULTADOULTDG,'')
  || '~|~' || COALESCE(CAST(r.IEPPROJETADO AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(r.DTPREVPARTO AS VARCHAR(12)),'')
  AS "LINHA"
FROM ANIMALINFO_REPRODUCAO r
  JOIN ANIMAL a ON a.CDANIMAL = r.CDANIMAL
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1;

/* ── CONTROLES LEITEIROS (LEITE) ──────────────────────────────────────────── */
SELECT '@L@' || a.NUMERO
  || '~|~' || CAST(l.DTLEITE AS VARCHAR(12))
  || '~|~' || COALESCE(CAST(l.PESO1 AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(l.PESO2 AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(l.PESO3 AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(l.PESOTOTAL AS VARCHAR(10)),'')
  AS "LINHA"
FROM LEITE l
  JOIN ANIMAL a ON a.CDANIMAL = l.CDANIMAL
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND l.DTLEITE IS NOT NULL;

/* ── EVENTOS REPRODUTIVOS (REPRODUCAO) ───────────────────────────────────────
 * Campos: numero | ideagriId | cdtipo | data | reprodutor | doadoraNumero |
 * doadoraNome | embriaoId | diagnostico | dtParto | tipoParto | auxilioParto |
 * numCrias | sexoCria
 * TE: receptora=r.CDANIMAL; embrião=r.CDEMBRIAO; doadora=emb.CDMAE; sêmen=emb.CDPAI.
 */
SELECT '@E@' || a.NUMERO
  || '~|~' || CAST(r.CDREPRODUCAO AS VARCHAR(12))
  || '~|~' || CAST(r.CDTIPOREPRODUCAO AS VARCHAR(4))
  || '~|~' || CAST(r.DATA AS VARCHAR(12))
  || '~|~' || COALESCE(rep.NOME, rep.NUMERO, pai.NOME, pai.NUMERO, '')
  || '~|~' || COALESCE(doa.NUMERO, '')
  || '~|~' || COALESCE(doa.NOME, '')
  || '~|~' || COALESCE(CAST(r.CDEMBRIAO AS VARCHAR(12)), '')
  || '~|~' || COALESCE(r.DIAGNOSTICO,'')
  || '~|~' || COALESCE(CAST(r.DTPARTOPROVAVEL AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(r.CDTIPOPARTO AS VARCHAR(4)),'')
  || '~|~' || COALESCE(CAST(r.CDAUXILIOPARTO AS VARCHAR(4)),'')
  || '~|~' || COALESCE(CAST(r.NUMCRIA AS VARCHAR(4)),'')
  || '~|~' || COALESCE(r.SEXOCRIA1,'')
  AS "LINHA"
FROM REPRODUCAO r
  JOIN ANIMAL a ON a.CDANIMAL = r.CDANIMAL
  LEFT JOIN ANIMAL rep ON rep.CDANIMAL = r.CDREPRODUTOR
  LEFT JOIN ANIMAL emb ON emb.CDANIMAL = r.CDEMBRIAO
  LEFT JOIN ANIMAL doa ON doa.CDANIMAL = emb.CDMAE
  LEFT JOIN ANIMAL pai ON pai.CDANIMAL = emb.CDPAI
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND r.DATA IS NOT NULL;

/* ── DOENÇAS / OCORRÊNCIAS (DOENCAANIMAL) ──────────────────────────────────── */
SELECT '@D@' || a.NUMERO
  || '~|~' || COALESCE(doe.NOMECOMPLETO,'')
  || '~|~' || COALESCE(CAST(da.DTINICIO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(da.DTFIM AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(da.DIASTRATAMENTO AS VARCHAR(6)),'')
  || '~|~' || COALESCE(da.OBSERVACAO,'')
  AS "LINHA"
FROM DOENCAANIMAL da
  JOIN ANIMAL a ON a.CDANIMAL = da.CDANIMAL
  LEFT JOIN DOENCA doe ON doe.CDDOENCA = da.CDDOENCA
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND da.DTINICIO IS NOT NULL;

/* ── APLICAÇÕES DE PRODUTO (APLICACAOPRODUTO) ──────────────────────────────── */
SELECT '@V@' || a.NUMERO
  || '~|~' || COALESCE(p.NOME,'')
  || '~|~' || COALESCE(CAST(ap.DTAPLICACAOPRODUTO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(ap.DOSEAPLICADA AS VARCHAR(20)),'')
  || '~|~' || COALESCE(CAST(ap.CARENCIA AS VARCHAR(6)),'')
  || '~|~' || COALESCE(ap.OBSERVACAO,'')
  AS "LINHA"
FROM APLICACAOPRODUTO ap
  JOIN ANIMAL a ON a.CDANIMAL = ap.CDANIMAL
  LEFT JOIN PRODUTO p ON p.CDPRODUTO = ap.CDPRODUTO
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND ap.DTAPLICACAOPRODUTO IS NOT NULL;

/* ── ANÁLISES DE LEITE (ANALISELEITE) → EXAME ──────────────────────────────── */
SELECT '@Q@' || a.NUMERO
  || '~|~' || CAST(al.DTANALISELEITE AS VARCHAR(12))
  || '~|~' || COALESCE(CAST(al.CCS AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(al.GORDURA AS VARCHAR(10)),'')
  || '~|~' || COALESCE(CAST(al.PROTEINA AS VARCHAR(10)),'')
  || '~|~' || COALESCE(al.OBSERVACAO,'')
  AS "LINHA"
FROM ANALISELEITE al
  JOIN ANIMAL a ON a.CDANIMAL = al.CDANIMAL
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND al.DTANALISELEITE IS NOT NULL;

/* ── MASTITE (MAMITE) → MASTITE ────────────────────────────────────────────── */
SELECT '@M@' || a.NUMERO
  || '~|~' || CAST(m.DATA AS VARCHAR(12))
  || '~|~' || COALESCE(m.AD,'')
  || '~|~' || COALESCE(m.AE,'')
  || '~|~' || COALESCE(m.PD,'')
  || '~|~' || COALESCE(m.PE,'')
  || '~|~' || COALESCE(mo.NOME,'')
  || '~|~' || COALESCE(m.OBSERVACAO,'')
  AS "LINHA"
FROM MAMITE m
  JOIN ANIMAL a ON a.CDANIMAL = m.CDANIMAL
  LEFT JOIN MICROORGANISMO mo ON mo.CDMICROORGANISMO = m.CDMICROORGANISMO1
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND m.DATA IS NOT NULL;

/* ── PESAGENS (PESO) → curva de crescimento / GMD ──────────────────────────── */
SELECT '@W@' || a.NUMERO
  || '~|~' || CAST(pw.DTPESO AS VARCHAR(12))
  || '~|~' || COALESCE(CAST(pw.PESO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(pw.GMD AS VARCHAR(12)),'')
  AS "LINHA"
FROM PESO pw
  JOIN ANIMAL a ON a.CDANIMAL = pw.CDANIMAL
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND pw.DTPESO IS NOT NULL AND pw.PESO IS NOT NULL;

/* ── LACTAÇÕES (LACTACAO ~335) — histórico por animal ───────────────────────
 * Produção/duração só existem para a lactação CORRENTE (ANIMALINFO_PRODUCAO,
 * casada por DTINICIOULTLAC = DTINICIO); lactações anteriores saem sem produção.
 * NÃO selecionar OBSERVACAO (blob → quebra isql). */
SELECT '@Y@' || an.NUMERO
  || '~|~' || COALESCE(CAST(ip.ORDEMLACTACAO AS VARCHAR(8)),'')
  || '~|~' || COALESCE(CAST(l.DTINICIO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(l.DTFIM AS VARCHAR(12)),'')
  || '~|~' || COALESCE(ms.DESCRICAO,'')
  || '~|~' || COALESCE(l.TIPOALEITAMENTO,'')
  || '~|~' || COALESCE(CAST(l.INDUZIDA AS VARCHAR(2)),'0')
  || '~|~' || COALESCE(CAST(ip.PRODUCAOTOTALULTLAC AS VARCHAR(16)),'')
  || '~|~' || COALESCE(CAST(ip.PRODUCAO305ULTLAC AS VARCHAR(16)),'')
  || '~|~' || COALESCE(CAST(ip.DURACAOLACTACAO AS VARCHAR(8)),'')
  AS "LINHA"
FROM LACTACAO l
  JOIN ANIMAL an ON an.CDANIMAL = l.CDANIMAL
  LEFT JOIN MOTIVOSECAGEM ms ON ms.CDMOTIVOSECAGEM = l.CDMOTIVOSECAGEM
  LEFT JOIN ANIMALINFO_PRODUCAO ip ON ip.CDANIMAL = l.CDANIMAL AND ip.DTINICIOULTLAC = l.DTINICIO
WHERE an.TIPOANIMAL='A' AND an.ANIMALREBANHO=1
ORDER BY an.NUMERO, l.DTINICIO;

/* ═══════════════════════════════════════════════════════════════════════════
 * BLOCO A — IATF/TETF (PROTOCOLOIATF / PRINCIPIOATIVO / PROGRAMACAO / ASSOCIACAO)
 * Finalidade não é coluna física: derivada do protocolo. Confirmado na fonte que
 * o protocolo 13 ("TETF - NOVILHAS") é o único de transferência; demais são IATF.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* @PROTOIATF@ ideagriId | nome | finalidade(IATF|TETF) */
SELECT '@PROTOIATF@' || CAST(pr.CDPROTOCOLOIATF AS VARCHAR(8))
  || '~|~' || COALESCE(pr.DESCRICAO, '')
  || '~|~' || (CASE WHEN pr.CDPROTOCOLOIATF = 13 THEN 'TETF' ELSE 'IATF' END)
  AS "LINHA"
FROM PROTOCOLOIATF pr
ORDER BY pr.CDPROTOCOLOIATF;

/* @PROTOPRIN@ protocoloIdeagriId | dia | principio | produto | dose | uso */
SELECT '@PROTOPRIN@' || CAST(pp.CDPROTOCOLOIATF AS VARCHAR(8))
  || '~|~' || COALESCE(CAST(pp.DIA AS VARCHAR(6)), '')
  || '~|~' || COALESCE(pa.NOME, '')
  || '~|~' || COALESCE(pd.NOME, '')
  || '~|~' || COALESCE(CAST(pp.DOSE AS VARCHAR(20)), '')
  || '~|~' || COALESCE(CAST(pp.USO AS VARCHAR(30)), '')
  AS "LINHA"
FROM PROTOCOLOIATFPRINCIPIOATIVO pp
  LEFT JOIN PRINCIPIOATIVO pa ON pa.CDPRINCIPIOATIVO = pp.CDPRINCIPIOATIVO
  LEFT JOIN PRODUTO pd ON pd.CDPRODUTO = pp.CDPRODUTO
ORDER BY pp.CDPROTOCOLOIATF, pp.DIA;

/* @PROGIATF@ ideagriId | nome | dataInicio(YYYY-MM-DD) | protocoloIdeagriId
 * A programação vincula o protocolo pela associação (PROGRAMACAOIATFASSOCIACAO);
 * o protocolo dominante da programação é o mais frequente entre suas associações. */
SELECT '@PROGIATF@' || CAST(pg.CDPROGRAMACAOIATF AS VARCHAR(8))
  || '~|~' || COALESCE(pg.NOME, '')
  || '~|~' || COALESCE(CAST(pg.DTIMPLANTE AS VARCHAR(12)), '')
  || '~|~' || CAST((
       SELECT FIRST 1 a2.CDPROTOCOLOIATF FROM PROGRAMACAOIATFASSOCIACAO a2
       WHERE a2.CDPROGRAMACAOIATF = pg.CDPROGRAMACAOIATF AND a2.CDPROTOCOLOIATF IS NOT NULL
       GROUP BY a2.CDPROTOCOLOIATF ORDER BY COUNT(*) DESC
     ) AS VARCHAR(8))
  AS "LINHA"
FROM PROGRAMACAOIATF pg
WHERE EXISTS (SELECT 1 FROM PROGRAMACAOIATFASSOCIACAO a3
              WHERE a3.CDPROGRAMACAOIATF = pg.CDPROGRAMACAOIATF AND a3.CDPROTOCOLOIATF IS NOT NULL)
ORDER BY pg.CDPROGRAMACAOIATF;

/* @PROGASSOC@ numeroAnimal | ideagriId | programacaoIdeagriId | usoCidr(0|1) | estimulo | perdaImplante(0|1) */
SELECT '@PROGASSOC@' || COALESCE(a.NUMERO, '')
  || '~|~' || CAST(ass.CDPROGRAMACAOIATFASSOCIACAO AS VARCHAR(10))
  || '~|~' || CAST(ass.CDPROGRAMACAOIATF AS VARCHAR(10))
  || '~|~' || COALESCE(CAST(ass.USOCIDR AS VARCHAR(2)), '0')
  || '~|~' || COALESCE(CAST(ass.ESTIMULO AS VARCHAR(30)), '')
  || '~|~' || (CASE WHEN ass.PERDA IS NULL OR ass.PERDA = 0 THEN '0' ELSE '1' END)
  AS "LINHA"
FROM PROGRAMACAOIATFASSOCIACAO ass
  JOIN ANIMAL a ON a.CDANIMAL = ass.CDANIMAL
WHERE ass.CDPROTOCOLOIATF IS NOT NULL
ORDER BY ass.CDPROGRAMACAOIATFASSOCIACAO;

/* ═══════════════════════════════════════════════════════════════════════════
 * BLOCO B — dicionário ginecológico oficial (RESULTADOEXAMEGINECOLOGICO)
 * @RESULTGINE@ codigo | nomeResumido | nomeCompleto | tipo | padrao(0|1)
 * ═══════════════════════════════════════════════════════════════════════════ */
SELECT '@RESULTGINE@' || CAST(rg.CDRESULTADOEXAMEGINECOLOGICO AS VARCHAR(8))
  || '~|~' || COALESCE(rg.NOMERESUMIDO, '')
  || '~|~' || COALESCE(rg.NOMECOMPLETO, '')
  || '~|~' || COALESCE(rg.TIPO, '')
  || '~|~' || COALESCE(CAST(rg.PADRAO AS VARCHAR(2)), '')
  AS "LINHA"
FROM RESULTADOEXAMEGINECOLOGICO rg
ORDER BY rg.CDRESULTADOEXAMEGINECOLOGICO;

/* ═══════════════════════════════════════════════════════════════════════════
 * BLOCO C — catálogos de genética/sêmen (ANIMALINFO_REPRODUTOR / GENCATALOGO* / TIPOSEMEN)
 * GAP confirmado: GENPROVA=0, GENVALORIND=0, GENMARCADORPROVA=0, GENCASEINAPROVA=0,
 * GENPEDIGREE=0 na fonte. Os catálogos existem; os VALORES por touro não. Não há
 * SELECT para @VALORIND@/@VALORMARC@/@VALORCAS@/@ESTSEMEN@/@PEDIGREE@ — emiti-los
 * seria inventar dado (arrays ficam vazios, aceito pelo builder).
 * ═══════════════════════════════════════════════════════════════════════════ */

/* @REPRODUTOR@ ideagriId | nome | codigo | racaSigla | centralSigla
 * NOME pode vir string vazia (não-nula); NULLIF(TRIM(...)) cai p/ NUMERO então.
 * racaSigla e centralSigla ficam VAZIOS: o import resolve racaSigla por Raca.codigo
 * (sigla) e a fonte guarda só o nome livre da raça em ANIMALINFO_REPRODUTOR.RACA
 * (ex.: "Gir Leiteiro", "Girolando"), que não é sigla cadastrada. Ambos são
 * opcionais no import (null = pula) — emitir o nome livre inventaria um vínculo. */
SELECT '@REPRODUTOR@' || CAST(r.CDANIMAL AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(r.NOME), ''), NULLIF(TRIM(r.NUMERO), ''), CAST(r.CDANIMAL AS VARCHAR(10)))
  || '~|~' || COALESCE(NULLIF(TRIM(r.NUMERO), ''), '')
  || '~|~' || ''
  || '~|~' || ''
  AS "LINHA"
FROM ANIMALINFO_REPRODUTOR r
ORDER BY r.CDANIMAL;

/* @INDICADOR@ ideagriId | sigla | nome | unidade | direcao | colunaLegada | ranking(0|1)
 * SENTIDO da fonte: mapeado p/ direcao. colunaLegada só p/ o conjunto conhecido do
 * parser (ptaLeite/ptaGordura/ptaProteina/tpi) — aqui vazio (sem coluna legada real). */
SELECT '@INDICADOR@' || CAST(gi.CDGENCATALOGOINDICADOR AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(gi.CODINTERNO), ''), 'IND') || '_' || CAST(gi.CDGENCATALOGOINDICADOR AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(gi.NOMEEXIBICAO), ''), 'IND' || CAST(gi.CDGENCATALOGOINDICADOR AS VARCHAR(10)))
  || '~|~' || COALESCE(gi.UNIDADEPADRAO, '')
  || '~|~' || (CASE WHEN UPPER(COALESCE(gi.SENTIDO,'M')) = 'N'
                    OR UPPER(COALESCE(gi.SENTIDO,'M')) STARTING WITH 'MEN'
               THEN 'menor_melhor' ELSE 'maior_melhor' END)
  || '~|~' || ''
  || '~|~' || '0'
  AS "LINHA"
FROM GENCATALOGOINDICADOR gi
WHERE COALESCE(gi.ATIVO, 'T') = 'T'
ORDER BY gi.CDGENCATALOGOINDICADOR;

/* @MARCADOR@ ideagriId | sigla | nome */
SELECT '@MARCADOR@' || CAST(gm.CDGENCATALOGOMARCADOR AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(gm.CODIGO), ''), CAST(gm.CDGENCATALOGOMARCADOR AS VARCHAR(10)))
  || '~|~' || COALESCE(NULLIF(TRIM(gm.NOMEEXIBICAO), ''), 'MARC' || CAST(gm.CDGENCATALOGOMARCADOR AS VARCHAR(10)))
  AS "LINHA"
FROM GENCATALOGOMARCADOR gm
ORDER BY gm.CDGENCATALOGOMARCADOR;

/* @CASEINA@ ideagriId | sigla | nome */
SELECT '@CASEINA@' || CAST(gc.CDGENCATALOGOCASEINA AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(gc.CODINTERNO), ''), 'CAS') || '_' || CAST(gc.CDGENCATALOGOCASEINA AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(gc.NOMEEXIBICAO), ''), 'CAS' || CAST(gc.CDGENCATALOGOCASEINA AS VARCHAR(10)))
  AS "LINHA"
FROM GENCATALOGOCASEINA gc
ORDER BY gc.CDGENCATALOGOCASEINA;

/* @TIPOSEMEN@ ideagriId | sigla | nome */
SELECT '@TIPOSEMEN@' || CAST(ts.CDTIPOSEMEN AS VARCHAR(10))
  || '~|~' || 'TS' || CAST(ts.CDTIPOSEMEN AS VARCHAR(10))
  || '~|~' || COALESCE(ts.NOME, '')
  AS "LINHA"
FROM TIPOSEMEN ts
ORDER BY ts.CDTIPOSEMEN;

/* ═══════════════════════════════════════════════════════════════════════════
 * BLOCO E — FIV/TE: classificações + coletas + oócitos. GAP confirmado: os 171
 * embriões da fonte estão SEM classificação/estágio (CDEMBRIAOCLASSIFICACAO NULL),
 * e as contagens agregadas de estágio na COLETA são zero. GRUPOPOOL=0. Portanto
 * @FERTCOL@/@EMBRIAO@/@POOLGRP@/@POOLITEM@ ficam sem SELECT (arrays vazios). Só
 * emitimos classificações, coletas e oócitos por qualidade, que a fonte comprova.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* @EMBCLASS@ ideagriId | sigla | nome | ordem */
SELECT '@EMBCLASS@' || CAST(ec.CDEMBRIAOCLASSIFICACAO AS VARCHAR(6))
  || '~|~' || 'EC' || CAST(ec.CDEMBRIAOCLASSIFICACAO AS VARCHAR(6))
  || '~|~' || COALESCE(ec.DESCRICAO, '')
  || '~|~' || CAST(ec.CDEMBRIAOCLASSIFICACAO AS VARCHAR(6))
  AS "LINHA"
FROM EMBRIAOCLASSIFICACAO ec
ORDER BY ec.CDEMBRIAOCLASSIFICACAO;

/* @COLETA@ ideagriId | doadoraNumero | data | tecnico | metodo(FIV|TE_CONVENCIONAL) | laboratorio | status
 * metodo derivado de TIPOCOLETA: na fonte todas as 7 coletas são TIPOCOLETA=1 (FIV). */
SELECT '@COLETA@' || CAST(c.CDCOLETA AS VARCHAR(10))
  || '~|~' || COALESCE(NULLIF(TRIM(d.NUMERO), ''), '')
  || '~|~' || COALESCE(CAST(c.DATACOLETA AS VARCHAR(12)), '')
  || '~|~' || ''
  || '~|~' || TRIM(CASE WHEN c.TIPOCOLETA = 1 THEN 'FIV' ELSE 'TE_CONVENCIONAL' END)
  || '~|~' || ''
  || '~|~' || 'IMPORTADA'
  AS "LINHA"
FROM COLETA c
  JOIN ANIMAL d ON d.CDANIMAL = c.CDDOADORA
ORDER BY c.CDCOLETA;

/* @OOCITO@ coletaIdeagriId | qualidade | viavel(0|1) | quantidade
 * Uma linha por bucket de qualidade não-nulo/positivo na COLETA (colunas agregadas). */
SELECT '@OOCITO@' || CAST(c.CDCOLETA AS VARCHAR(10)) || '~|~GRAU1~|~1~|~' || CAST(c.NUMOOCITOGRAU1 AS VARCHAR(6)) AS "LINHA"
FROM COLETA c WHERE c.NUMOOCITOGRAU1 > 0;
SELECT '@OOCITO@' || CAST(c.CDCOLETA AS VARCHAR(10)) || '~|~GRAU2~|~1~|~' || CAST(c.NUMOOCITOGRAU2 AS VARCHAR(6)) AS "LINHA"
FROM COLETA c WHERE c.NUMOOCITOGRAU2 > 0;
SELECT '@OOCITO@' || CAST(c.CDCOLETA AS VARCHAR(10)) || '~|~GRAU3~|~1~|~' || CAST(c.NUMOOCITOGRAU3 AS VARCHAR(6)) AS "LINHA"
FROM COLETA c WHERE c.NUMOOCITOGRAU3 > 0;
SELECT '@OOCITO@' || CAST(c.CDCOLETA AS VARCHAR(10)) || '~|~DESNUDO~|~0~|~' || CAST(c.NUMOOCITODESNUDO AS VARCHAR(6)) AS "LINHA"
FROM COLETA c WHERE c.NUMOOCITODESNUDO > 0;
SELECT '@OOCITO@' || CAST(c.CDCOLETA AS VARCHAR(10)) || '~|~ATRESICO~|~0~|~' || CAST(c.NUMOOCITOATRESICO AS VARCHAR(6)) AS "LINHA"
FROM COLETA c WHERE c.NUMOOCITOATRESICO > 0;
