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
  || '~|~' || COALESCE(pe.DESCRICAO,'')
  || '~|~' || COALESCE(c.GRUPO,'')
  AS "LINHA"
FROM ANIMAL a
  LEFT JOIN MOTIVOBAIXA mb ON mb.CDMOTIVOBAIXA = a.CDMOTIVOBAIXA
  LEFT JOIN ANIMALINFO_CADASTRO c ON c.CDANIMAL = a.CDANIMAL
  LEFT JOIN PELAGEM pe ON pe.CDPELAGEM = a.CDPELAGEM
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1
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

/* ── EVENTOS REPRODUTIVOS (REPRODUCAO) ─────────────────────────────────────── */
SELECT '@E@' || a.NUMERO
  || '~|~' || CAST(r.CDTIPOREPRODUCAO AS VARCHAR(4))
  || '~|~' || CAST(r.DATA AS VARCHAR(12))
  || '~|~' || COALESCE(rep.NOME, rep.NUMERO, '')
  || '~|~' || COALESCE(r.DIAGNOSTICO,'')
  || '~|~' || COALESCE(CAST(r.DTPARTOPROVAVEL AS VARCHAR(12)),'')
  || '~|~' || COALESCE(CAST(r.CDTIPOPARTO AS VARCHAR(4)),'')
  || '~|~' || COALESCE(CAST(r.NUMCRIA AS VARCHAR(4)),'')
  || '~|~' || COALESCE(r.SEXOCRIA1,'')
  AS "LINHA"
FROM REPRODUCAO r
  JOIN ANIMAL a ON a.CDANIMAL = r.CDANIMAL
  LEFT JOIN ANIMAL rep ON rep.CDANIMAL = r.CDREPRODUTOR
WHERE a.TIPOANIMAL='A' AND a.ANIMALREBANHO=1 AND r.DATA IS NOT NULL;
