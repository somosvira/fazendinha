ALTER TABLE public."ProdutoCatalogo"
 ADD COLUMN "conteudoEmbalagem" DECIMAL(12,3),
 ADD COLUMN "rotuloEmbalagem" TEXT,
 ADD COLUMN "orientacaoBula" JSONB,
 ADD CONSTRAINT "ProdutoCatalogo_conteudo_positivo" CHECK ("conteudoEmbalagem" IS NULL OR "conteudoEmbalagem" > 0);
ALTER TABLE public."ItemOperacao" ADD COLUMN "embalagemSnapshot" JSONB;
-- Somente apresentações completas, simples e sem ambiguidade. Produtos adotados e fatos históricos são preservados.
WITH candidatos AS (
 SELECT id, regexp_match(trim(apresentacao), '^(Frasco(-ampola)?|Ampola|Bisnaga|Sachê|Sache|Balde|Pote|Saco|Galão|Galao)\s+([0-9]+([.,][0-9]+)?)\s*(ml|l|litros?|g|kg|doses?)$', 'i') AS m
 FROM public."ProdutoCatalogo" WHERE "usoSanitario"
), interpretados AS (
 SELECT id, m[1] AS rotulo, lower(m[5]) AS unidade, replace(m[3], ',', '.')::numeric AS quantidade
 FROM candidatos WHERE m IS NOT NULL
)
UPDATE public."ProdutoCatalogo" p SET
 "unidadeSugerida" = (CASE WHEN i.unidade IN ('ml','l','litro','litros') THEN 'ML' WHEN i.unidade IN ('g','kg') THEN 'G' ELSE 'DOSE' END)::public."UnidadeMedida",
 "conteudoEmbalagem" = i.quantidade * CASE WHEN i.unidade IN ('l','litro','litros','kg') THEN 1000 ELSE 1 END,
 "rotuloEmbalagem" = i.rotulo, "atualizadoEm" = CURRENT_TIMESTAMP
FROM interpretados i WHERE p.id = i.id
 AND i.quantidade > 0
 AND i.quantidade * CASE WHEN i.unidade IN ('l','litro','litros','kg') THEN 1000 ELSE 1 END <= 999999999.999
 AND scale(trim_scale(i.quantidade * CASE WHEN i.unidade IN ('l','litro','litros','kg') THEN 1000 ELSE 1 END)) <= 3;
-- Referência documental, sem prescrição automática. Vinculada à formulação e fabricante exatos.
UPDATE public."ProdutoCatalogo" p SET "orientacaoBula" = jsonb_build_object(
 'fonte', 'https://www2.zoetis.com.br/content/_assets/Linha-Terramicina/tmla-bula_08.05.15_.pdf',
 'titulo', 'Bula do fabricante — Terramicina/LA Solução Injetável',
 'consultadaEm', '2026-11-17',
 'especie', 'Bovinos',
 'concentracao', '200 mg de oxitetraciclina dihidratada por mL',
 'dosagem', 'A bula informa 1 mL por 10 kg de peso para bovinos.',
 'via', 'Subcutânea ou intramuscular',
 'cuidados', 'A bula limita a 10 mL por local de aplicação e informa uso do conteúdo em até 28 dias após a primeira retirada. Venda sob prescrição e aplicação sob orientação veterinária.'
)
FROM public."FabricanteProduto" f WHERE p."fabricanteId"=f.id
 AND p.nome='Terramicina LA Solução Injetável' AND f.nome ILIKE '%zoetis%';
