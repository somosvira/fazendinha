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
