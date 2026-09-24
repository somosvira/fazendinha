/* Dump delimitado do IDEAGRI (Firebird) para a carga da Pecuária v1 (rebanho).
 * Consumido por scripts/build-pecuaria-json.mjs → server/prisma/pecuaria_v1.json.
 * Orquestrado por scripts/extract-pecuaria.sh (isql.exe numa CÓPIA do DADOS777.FDB).
 *
 * Convenções (iguais às de rebanho-dump.sql):
 *  - cada linha sai prefixada (@A@/@RACA@/@MB@/@RC@/@P@) e os campos separados por '~|~';
 *  - datas 'YYYY-MM-DD' (CAST de DATE para VARCHAR no Firebird);
 *  - NÃO selecionar colunas blob (OBSERVACAO etc.) — quebram o isql (SU$APPENDBLOBTOFILE);
 *  - chaves estáveis = códigos internos do IDEAGRI (CDANIMAL, CDRACA, CDMOTIVOBAIXA, CDPESO),
 *    que viram `ideagriId` no JSON (importador idempotente por ideagriId).
 *
 * Filtro do rebanho da v1: TIPOANIMAL='A' AND ANIMALREBANHO=1.
 *   (sem o antigo "OR EXISTS COLETA": as doadoras externas DB01–DB06 ficam para a v2.)
 *
 * ENCODING: o banco guarda texto em WIN1252. Conforme o charset da conexão do isql, a saída
 * chega como CP1252 puro OU como UTF-8 (a extração de jul/2026 chegou UTF-8 e foi lida como
 * latin1 pelo builder antigo → "HolandÃªs"). O build-pecuaria-json.mjs resolve isso sozinho
 * (não depende da máquina Windows): decodifica o arquivo como UTF-8 se ele for UTF-8 válido,
 * senão como windows-1252, e ainda repara campos já "mojibakados" (Ã§ → ç). Não é preciso
 * iconv no .sh.
 */
SET HEADING OFF;
SET WIDTH LINHA 2000;

/* ── ANIMAIS ───────────────────────────────────────────────────────────────────
 * @A@ cdanimal | numero | nome | sexo | dtNascimento | dtEntFazenda | brincoEletronico |
 *     sisbov | numPartoEntrada | dtBaixa | cdMotivoBaixa | motivoBaixa | setor | grupo | racaTexto |
 *     cdCategoria | cdTipoBaixa
 * racaTexto (ANIMALINFO_CADASTRO.RACA, ex. "3/4 HO, GL") é só fallback p/ quem não tem ANIMALRACA.
 * cdCategoria (ANIMAL.CDCATEGORIA, 1–7 da tabela CATEGORIA) vira categoria manual no import
 * quando diverge da calculada pelas regras (ex.: reprodutor, vaca sem parto importado).
 * cdTipoBaixa (ANIMAL.CDTIPOBAIXA, FK p/ TIPOBAIXA — independente de CDMOTIVOBAIXA) distingue
 * descarte voluntário/involuntário de morte; o importador cruza os dois (build-pecuaria-json.mjs
 * não interpreta, só repassa).
 */
SELECT '@A@' || CAST(a.CDANIMAL AS VARCHAR(12))
  || '~|~' || COALESCE(a.NUMERO,'')
  || '~|~' || COALESCE(a.NOME,'')
  || '~|~' || COALESCE(a.SEXO,'')
  || '~|~' || COALESCE(CAST(a.DTNASCIMENTO AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(a.DTENTFAZENDA AS VARCHAR(12)),'')
  || '~|~' || COALESCE(a.BRINCOELETRONICO,'')
  || '~|~' || COALESCE(a.SISBOV,'')
  || '~|~' || COALESCE(CAST(a.NUMPARTOENTRADA AS VARCHAR(8)),'0')
  || '~|~' || COALESCE(CAST(a.DTBAIXA AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(a.CDMOTIVOBAIXA AS VARCHAR(8)),'')
  || '~|~' || COALESCE(mb.DESCRICAO,'')
  || '~|~' || COALESCE(c.SETOR,'')
  || '~|~' || COALESCE(c.GRUPO,'')
  || '~|~' || COALESCE(c.RACA,'')
  || '~|~' || COALESCE(CAST(a.CDCATEGORIA AS VARCHAR(4)),'')
  || '~|~' || COALESCE(CAST(a.CDTIPOBAIXA AS VARCHAR(4)),'')
  AS "LINHA"
FROM ANIMAL a
  LEFT JOIN MOTIVOBAIXA mb ON mb.CDMOTIVOBAIXA = a.CDMOTIVOBAIXA
  LEFT JOIN ANIMALINFO_CADASTRO c ON c.CDANIMAL = a.CDANIMAL
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1
ORDER BY a.CDANIMAL;

/* ── COMPOSIÇÃO RACIAL (ANIMALRACA) ────────────────────────────────────────────
 * @RACA@ cdanimal | cdraca | sigla | descricao | percentual
 * VALIDAR NA 1ª EXECUÇÃO (não testado contra o Firebird; colunas vindas do mapa do IDEAGRI):
 *  - nomes ANIMALRACA.CDANIMAL/CDRACA/PERCENTUAL e RACA.SIGLA/DESCRICAO existem como escritos;
 *  - PERCENTUAL está em 0–100 (e não 0–1 ou em 64 avos) — o builder assume 0–100 e avisa
 *    se a soma de um animal fugir de ~100;
 *  - CAST para VARCHAR(20) não trunca decimais (ex. 37.5, 12.5, 6.25);
 *  - quantos animais do rebanho têm linhas aqui (quem não tiver cai no racaTexto do @A@).
 */
SELECT '@RACA@' || CAST(ar.CDANIMAL AS VARCHAR(12))
  || '~|~' || CAST(ar.CDRACA AS VARCHAR(8))
  || '~|~' || COALESCE(r.SIGLA,'')
  || '~|~' || COALESCE(r.DESCRICAO,'')
  || '~|~' || COALESCE(CAST(ar.PERCENTUAL AS VARCHAR(20)),'')
  AS "LINHA"
FROM ANIMALRACA ar
  JOIN ANIMAL a ON a.CDANIMAL = ar.CDANIMAL
  LEFT JOIN RACA r ON r.CDRACA = ar.CDRACA
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1
ORDER BY ar.CDANIMAL, ar.CDRACA;

/* ── CATÁLOGO MOTIVOBAIXA ──────────────────────────────────────────────────────
 * @MB@ cdmotivobaixa | descricao
 */
SELECT '@MB@' || CAST(mb.CDMOTIVOBAIXA AS VARCHAR(8))
  || '~|~' || COALESCE(mb.DESCRICAO,'')
  AS "LINHA"
FROM MOTIVOBAIXA mb
ORDER BY mb.CDMOTIVOBAIXA;

/* ── CATÁLOGO TIPOBAIXA ────────────────────────────────────────────────────────
 * @TB@ cdtipobaixa | descricao
 * 3 linhas fixas do IDEAGRI: 1 Voluntária, 2 Descarte involuntário, 3 Morte.
 */
SELECT '@TB@' || CAST(tb.CDTIPOBAIXA AS VARCHAR(4))
  || '~|~' || COALESCE(tb.DESCRICAO,'')
  AS "LINHA"
FROM TIPOBAIXA tb
ORDER BY tb.CDTIPOBAIXA;

/* ── CATÁLOGO RACA ─────────────────────────────────────────────────────────────
 * @RC@ cdraca | sigla | descricao
 * (validar se é preciso filtrar por RACA.ESPECIE = bovino; hoje vem o catálogo inteiro)
 */
SELECT '@RC@' || CAST(r.CDRACA AS VARCHAR(8))
  || '~|~' || COALESCE(r.SIGLA,'')
  || '~|~' || COALESCE(r.DESCRICAO,'')
  AS "LINHA"
FROM RACA r
ORDER BY r.CDRACA;

/* ── PESAGENS (PESO) ───────────────────────────────────────────────────────────
 * @P@ cdpeso | cdanimal | dtPeso | peso | tipoPeso
 * VALIDAR NA 1ª EXECUÇÃO: PESO.CDTIPOPESO e a tabela TIPOPESO(CDTIPOPESO, DESCRICAO) existem
 * com esses nomes (o dump antigo só lia DTPESO/PESO/GMD). Se não existirem, trocar o
 * LEFT JOIN por '' no campo tipoPeso.
 */
SELECT '@P@' || CAST(p.CDPESO AS VARCHAR(12))
  || '~|~' || CAST(p.CDANIMAL AS VARCHAR(12))
  || '~|~' || CAST(p.DTPESO AS VARCHAR(12))
  || '~|~' || CAST(p.PESO AS VARCHAR(12))
  || '~|~' || COALESCE(tp.DESCRICAO,'')
  AS "LINHA"
FROM PESO p
  JOIN ANIMAL a ON a.CDANIMAL = p.CDANIMAL
  LEFT JOIN TIPOPESO tp ON tp.CDTIPOPESO = p.CDTIPOPESO
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1
  AND p.DTPESO IS NOT NULL AND p.PESO IS NOT NULL
ORDER BY p.CDPESO;
