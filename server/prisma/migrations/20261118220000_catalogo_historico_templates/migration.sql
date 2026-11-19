-- Referências próprias PRODUTO 11179,11199,11203,11294 do DADOS777.FDB.
-- SHA-256 65eada38680c2c71e8ff72f1676924eeda4c5d88c3552ec311e99a0877ded56a.
-- Unidade 13 = mL; Excede tem volume explícito no nome. Sem assumir formulação
-- PPU/Forte para Pencivet Plus. Sem doses, adoção, movimentos ou custos.
INSERT INTO public."ProdutoCatalogo"
(id,fonte,"codigoOrigem",nome,"nomeNormalizado",apresentacao,"unidadeSugerida","conteudoEmbalagem","rotuloEmbalagem","usoSanitario","versaoCatalogo")
VALUES
('82bad078-9e63-4770-a664-9645a0882033'::uuid, 'IDEAGRI_DADOS777', '11179', 'ECP', public.normalizar_nome_produto_v1('ECP'), NULL, 'ML'::"UnidadeMedida", NULL, NULL, true, 1),
('2f2fb877-f17d-47ae-9a3a-eb93fc3ce300'::uuid, 'IDEAGRI_DADOS777', '11199', 'Flumax', public.normalizar_nome_produto_v1('Flumax'), NULL, 'ML'::"UnidadeMedida", NULL, NULL, true, 1),
('db5b9c82-87f9-4945-bfef-71d2f046395f'::uuid, 'IDEAGRI_DADOS777', '11203', 'Pencivet Plus', public.normalizar_nome_produto_v1('Pencivet Plus'), NULL, 'ML'::"UnidadeMedida", NULL, NULL, true, 1),
('932bdcc8-dad9-40b6-a499-b13959461dd3'::uuid, 'IDEAGRI_DADOS777', '11294', 'Excede', public.normalizar_nome_produto_v1('Excede'), 'Frasco 100 mL', 'ML'::"UnidadeMedida", 100, 'frasco', true, 1)
ON CONFLICT (fonte,"codigoOrigem") DO NOTHING;
