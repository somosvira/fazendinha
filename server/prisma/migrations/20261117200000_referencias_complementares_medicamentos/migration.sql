-- Referências oficiais conferidas. Preserva perfis da fazenda e fatos históricos.
DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","titulo":"Ficha oficial IBASA — Ibazole 10%","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"822ba46040567e545bfd7c0227b3af0de8a4dd68b0d9153f1285da74c18bbd8b","especie":"Bovinos","concentracao":"Albendazol 10 g/100 mL.","dosagem":"Bovinos: nematódeos gastrointestinais/pulmonares 1,5 mL/20 kg; cestódeos e Fasciola hepatica adulta 1 mL/10 kg. A ficha não especifica frequência nem carências.","proporcoes":[{"quantidade":"1.5","unidade":"ML","pesoKg":"20","condicao":"Bovinos: nematódeos gastrointestinais e pulmonares."},{"quantidade":"1","unidade":"ML","pesoKg":"10","condicao":"Bovinos: cestódeos e Fasciola hepatica adulta."}],"via":"Oral, com pistola dosificadora","carencias":{"leite":{"estado":"NAO_INFORMADO","horas":null,"condicao":"Não informado na ficha consultada; não interpretar como carência zero."},"carne":{"estado":"NAO_INFORMADO","horas":null,"condicao":"Não informado na ficha consultada; não interpretar como carência zero."}},"cuidados":"Agitar bem antes de usar; não ultrapassar doses indicadas. Informação de carência ausente na ficha oficial consultada.","camposFonte":{"concentracao":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Composição"},"dosagem":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Posologia e modo de usar / Modo de usar"},"proporcoes":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Posologia e modo de usar"},"via":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Posologia e modo de usar / Aplicações"},"carenciasLeite":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Ficha consultada: informação ausente"},"carenciasCarne":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Ficha consultada: informação ausente"},"cuidados":{"url":"https://www.ibasa.com.br/ibazole-10-ibasa-200ml-albendazol","secao":"Precauções / Contraindicações"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Laboratório Ibasa Ltda.'
      AND p.nome = 'Ibazole 10%' AND ((p.id = 'd0d5b7de-8c33-55ba-8ca6-6cfec6eccd01'::uuid AND p.apresentacao = 'Frasco 1 l') OR (p.id = '43316f62-67a6-5fb2-bdb2-4743e2dc4293'::uuid AND p.apresentacao = 'Frasco 200 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 2 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;

DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","titulo":"Ficha oficial IBASA — Dipirona Ibasa 50%","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"136e501b82d1045197582ce9f66c1922c8ad2bcd6b7b59a09e4b8a9fcc6f3284","especie":"Bovinos","concentracao":"Dipirona sódica 50 g/100 mL.","dosagem":"Bovinos: 1 mL/10 kg (50 mg/kg), para alívio da febre. A ficha não especifica frequência nem duração.","proporcoes":[{"quantidade":"1","unidade":"ML","pesoKg":"10","condicao":"Bovinos; frequência/duração não informadas na ficha."}],"via":"Intramuscular","carencias":{"leite":{"estado":"PRAZO","horas":48,"condicao":"Após a última aplicação."},"carne":{"estado":"PRAZO","horas":72,"condicao":"Após a última aplicação."}},"cuidados":"Desinfetar local de aplicação. Não administrar em hipersensibilidade ou insuficiência cardíaca, hepática ou renal.","camposFonte":{"concentracao":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Composição"},"dosagem":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Posologia e modo de usar / Modo de usar"},"proporcoes":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Posologia e modo de usar"},"via":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Posologia e modo de usar / Aplicações"},"carenciasLeite":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Período de carência — Bovinos — Leite"},"carenciasCarne":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Período de carência — Bovinos — Abate"},"cuidados":{"url":"https://www.ibasa.com.br/dipirona-50-ibasa-analgesico-antipiretico-50ml","secao":"Precauções / Contraindicações"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Laboratório Ibasa Ltda.'
      AND p.nome = 'Dipirona Ibasa 50%' AND ((p.id = '980761cf-3ecb-5798-b292-dcc7a23f6e7b'::uuid AND p.apresentacao = 'Frasco 50 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 1 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;

DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","titulo":"Ficha oficial IBASA — Gliciodo","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"e8bea9986c9a31d2c277ca432c40ad64dda3f8b7b7cc1330f1c0cbd53c482eae","especie":"Bovinos","concentracao":"Por 100 mL: iodo ressublimado 1 g, iodeto de sódio 2 g e glicerina 20 g.","dosagem":"Produto puro: tetos após cada ordenha; período seco 1 vez/dia. Umbigo neonatal: 1 vez/dia por 3 dias. Ferimentos limpos: 2 vezes/dia até cicatrizar. Lesões específicas da ficha: 3 vezes/dia até cicatrizar.","proporcoes":[],"via":"Tópica; imersão dos tetos ou aplicação local","carencias":{"leite":{"estado":"NAO_INFORMADO","horas":null,"condicao":"Não informado na ficha consultada; não interpretar como carência zero."},"carne":{"estado":"NAO_INFORMADO","horas":null,"condicao":"Não informado na ficha consultada; não interpretar como carência zero."}},"cuidados":"Conservar seco, fresco, protegido do sol e fora do alcance de crianças e animais. Ficha não informa carências; não inferir carência zero.","camposFonte":{"concentracao":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Composição"},"dosagem":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Posologia e modo de usar / Modo de usar"},"proporcoes":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Posologia e modo de usar"},"via":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Posologia e modo de usar / Aplicações"},"carenciasLeite":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Ficha consultada: informação ausente"},"carenciasCarne":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Ficha consultada: informação ausente"},"cuidados":{"url":"https://www.ibasa.com.br/gliciodo-200ml-antisseptico-antifungico","secao":"Precauções / Contraindicações"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Laboratório Ibasa Ltda.'
      AND p.nome = 'Gliciodo' AND ((p.id = '4a35cdd4-95bc-5cd9-b067-c44a37e0bd83'::uuid AND p.apresentacao = 'Frasco 1 l') OR (p.id = '0fdd693a-58ca-5d57-9e72-e6dbdfc9f09b'::uuid AND p.apresentacao = 'Frasco 200 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 2 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;
