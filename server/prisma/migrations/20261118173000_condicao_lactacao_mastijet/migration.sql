-- Conserva explicitamente a condição de uso publicada no resumo brasileiro: vacas em lactação.
DO $condicao$ DECLARE quantidade integer; BEGIN
UPDATE public."ProdutoCatalogo" SET "orientacaoBula" = jsonb_set(jsonb_set("orientacaoBula", '{especie}', '"Bovinos — vacas em lactação"'::jsonb), '{dosagem}', '"Em vacas em lactação, infundir uma seringa inteira em cada teto infectado. A quantidade por vaca depende do número de tetos tratados; não há proporção por peso publicada."'::jsonb)
WHERE id = '54bf9b59-c6a0-57ab-91f1-98f939383fc4'::uuid AND "orientacaoBula"->>'fonte' = 'https://www.msd-saude-animal.com.br/produto/mastijet-forte/';
GET DIAGNOSTICS quantidade = ROW_COUNT; IF quantidade <> 1 THEN RAISE EXCEPTION 'Referência Mastijet não corresponde à fonte conferida'; END IF; END $condicao$;
