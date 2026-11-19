-- Cadastros próprios da fazenda identificados no DADOS777.FDB fornecido pelo usuário.
-- SHA-256: 65eada38680c2c71e8ff72f1676924eeda4c5d88c3552ec311e99a0877ded56a.
-- PRODUTO 11268/11269/11357. Volume de Kinetomax é explícito em NOME.
-- Unidade de aplicação mL documentada em DOENCAANIMAL 174/175.
-- Apresentação de Banamine/Catosal, fabricante, via, concentração, bula e carências
-- permanecem desconhecidos. Não há doses, adoção de Produto nem saldo inicial.
-- A fonte é distinta do catálogo comercial DADOS000; não renomeia históricos.
INSERT INTO public."ProdutoCatalogo"
 (id, fonte, "codigoOrigem", nome, "nomeNormalizado", apresentacao, "unidadeSugerida", "conteudoEmbalagem", "rotuloEmbalagem", "usoSanitario", "versaoCatalogo")
VALUES
 ('2d3c2183-acc8-50c5-b54a-b9f67e2786d2'::uuid, 'IDEAGRI_DADOS777', '11268', 'Banamine', public.normalizar_nome_produto_v1('Banamine'), NULL, 'ML'::"UnidadeMedida", NULL, NULL, true, 1),
 ('b1a2ac71-82d3-55ac-82ca-b2906ecfedae'::uuid, 'IDEAGRI_DADOS777', '11269', 'Catosal B12', public.normalizar_nome_produto_v1('Catosal B12'), NULL, 'ML'::"UnidadeMedida", NULL, NULL, true, 1),
 ('3f620bfb-07eb-566e-8678-b0b144c52ec1'::uuid, 'IDEAGRI_DADOS777', '11357', 'Kinetomax', public.normalizar_nome_produto_v1('Kinetomax'), 'Frasco 100 mL', 'ML'::"UnidadeMedida", 100, 'frasco', true, 1)
ON CONFLICT ("fonte", "codigoOrigem") DO NOTHING;
