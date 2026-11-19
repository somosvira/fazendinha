-- Referências oficiais conferidas. Preserva perfis da fazenda e fatos históricos.
DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.msd-saude-animal.com.br/produto/folligon-5-000-ui/","titulo":"Folligon 5000 Ui — ficha oficial MSD Brasil","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"e973d0ad7f804df31618e072c159bb0da76130407937c587ceea3adc1e5de076","especie":"Bovinos","concentracao":"Gonadotrofina sérica equina (eCG): frasco de 5.000 UI acompanhado de ampola de 25 mL de diluente.","dosagem":"Vacas: superovulação, 1.500–3.000 UI entre o 8º e o 13º dia do ciclo, seguido 48 horas depois de PGF2α. Anestro ou aumento de fertilidade após progestágenos: 500–1.000 UI. Esquemas da tabela oficial; não são doses por kg.","proporcoes":[],"via":"Intramuscular.","carencias":{"leite":{"estado":"PRAZO","horas":0,"condicao":"Bovinos: carência zero expressamente informada na fonte."},"carne":{"estado":"PRAZO","horas":0,"condicao":"Bovinos: carência zero expressamente informada na fonte."}},"cuidados":"Não usar em prenhes. Risco de reação anafilática. Conservar entre 2 e 8 °C, protegido da luz. Utilizar todo o conteúdo após abertura e reconstituição. Prescrição e orientação veterinária.","camposFonte":{"concentracao":{"url":"https://www.msd-saude-animal.com.br/produto/folligon-5-000-ui/","secao":"Apresentação / Resumo da bula"},"dosagem":{"url":"https://www.msd-saude-animal.com.br/wp-content/uploads/sites/55/2024/10/Folligon-5000ui.png","secao":"Tabela ilustrada oficial — Modo de emprego e posologia"},"proporcoes":{"url":"https://www.msd-saude-animal.com.br/wp-content/uploads/sites/55/2024/10/Folligon-5000ui.png","secao":"Tabela ilustrada oficial — Modo de emprego e posologia"},"via":{"url":"https://www.msd-saude-animal.com.br/wp-content/uploads/sites/55/2024/10/Folligon-5000ui.png","secao":"Tabela ilustrada oficial — Modo de emprego e posologia"},"carenciasLeite":{"url":"https://www.msd-saude-animal.com.br/produto/folligon-5-000-ui/","secao":"Períodos de carência — Bovinos — Leite"},"carenciasCarne":{"url":"https://www.msd-saude-animal.com.br/produto/folligon-5-000-ui/","secao":"Períodos de carência — Bovinos — Abate"},"cuidados":{"url":"https://www.msd-saude-animal.com.br/produto/folligon-5-000-ui/","secao":"Precauções / Conservação"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Intervet do Brasil Veterinária Ltda.'
      AND p.nome = 'Folligon 5000 Ui' AND ((p.id = 'a00de7b6-a1d2-598a-9e75-983ef937de3e'::uuid AND p.apresentacao = 'Ampola 25 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 1 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;

DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.msd-saude-animal.com.br/produto/fertagyl/","titulo":"Fertagyl — ficha oficial MSD Brasil","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"c0befa01b409ef3d577b57bf86bdee119ff129cbf4d76fd75a3f01cfecbc18e4","especie":"Bovinos","concentracao":"Gonadorelina 0,1 mg/mL.","dosagem":"Vacas: ovários císticos, 5 mL; indução de ovulação, 2,5 mL. A tabela não especifica intervalo nem duração; não estruturar como dose por kg.","proporcoes":[],"via":"Intramuscular.","carencias":{"leite":{"estado":"PRAZO","horas":0,"condicao":"Bovinos: carência zero expressamente informada na fonte."},"carne":{"estado":"PRAZO","horas":0,"condicao":"Bovinos: carência zero expressamente informada na fonte."}},"cuidados":"Aplicar com assepsia e evitar autoinjeção; procurar atendimento se ocorrer. Refrigerar entre 2 e 8 °C, protegido da luz. Usar imediatamente após abertura. Prescrição e orientação veterinária.","camposFonte":{"concentracao":{"url":"https://www.msd-saude-animal.com.br/produto/fertagyl/","secao":"Resumo da bula — solução de gonadorelina"},"dosagem":{"url":"https://www.msd-saude-animal.com.br/wp-content/uploads/sites/55/2020/07/indicacoes.png","secao":"Tabela ilustrada oficial — Indicações"},"proporcoes":{"url":"https://www.msd-saude-animal.com.br/wp-content/uploads/sites/55/2020/07/indicacoes.png","secao":"Tabela ilustrada oficial — Indicações"},"via":{"url":"https://www.msd-saude-animal.com.br/wp-content/uploads/sites/55/2020/07/indicacoes.png","secao":"Tabela ilustrada oficial — Indicações"},"carenciasLeite":{"url":"https://www.msd-saude-animal.com.br/produto/fertagyl/","secao":"Períodos de carência — Bovinos — Leite"},"carenciasCarne":{"url":"https://www.msd-saude-animal.com.br/produto/fertagyl/","secao":"Períodos de carência — Bovinos — Abate"},"cuidados":{"url":"https://www.msd-saude-animal.com.br/produto/fertagyl/","secao":"Precauções / Conservação"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Intervet do Brasil Veterinária Ltda.'
      AND p.nome = 'Fertagyl' AND ((p.id = 'abb78e80-cf3a-5800-960f-c63b059f9ff8'::uuid AND p.apresentacao = 'Frasco 5 ml') OR (p.id = '6bcfc22b-9b15-53f9-a79d-719658a650c1'::uuid AND p.apresentacao = 'Frasco 50 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 2 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;

DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.msd-saude-animal.com.br/produto/metricure/","titulo":"Metricure — ficha oficial MSD Brasil","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"d0f56b51e23e3a441c7d7a8e62d63c7c0d6178d552a4828b1b8a1ab92a42f54f","especie":"Bovinos","concentracao":"Cefapirina base 500 mg por seringa de 19 g.","dosagem":"Vacas com endometrite subaguda ou crônica: conteúdo de uma seringa no lúmen uterino, com cateter. Mínimo de 14 dias após o parto; normalmente um tratamento. Não é dose por kg.","proporcoes":[],"via":"Intrauterina, com o cateter do produto.","carencias":{"leite":{"estado":"PRAZO","horas":0,"condicao":"Bovinos: carência zero expressamente informada na fonte."},"carne":{"estado":"PRAZO","horas":48,"condicao":"Bovinos: após a última aplicação."}},"cuidados":"Não usar em animais alérgicos a cefalosporinas. A ficha admite tratamento um dia após inseminação e orienta pré-tratamento de piometra com prostaglandinas. Conservar entre 15 e 30 °C, seco e protegido da luz.","camposFonte":{"concentracao":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Fórmula"},"dosagem":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Indicações / Dosagem e administração"},"proporcoes":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Indicações / Dosagem e administração"},"via":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Indicações / Dosagem e administração"},"carenciasLeite":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Períodos de carência — Bovinos — Leite"},"carenciasCarne":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Períodos de carência — Bovinos — Abate"},"cuidados":{"url":"https://www.msd-saude-animal.com.br/produto/metricure/","secao":"Precauções / Conservação / Contraindicações / Dosagem e administração"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Intervet do Brasil Veterinária Ltda.'
      AND p.nome = 'Metricure' AND ((p.id = '4c9e59d4-0155-503f-9aad-25e226fddbbf'::uuid AND p.apresentacao = 'Seringa 19 g'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 1 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;

DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.msd-saude-animal.com.br/produto/borgal/","titulo":"Borgal — ficha oficial MSD Brasil","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"ca31abbadd2918287e812accb52d2495b8280a5f4178ec5efe49c1017bd589fc","especie":"Bovinos","concentracao":"Por 100 mL: sulfadoxina 20 g e trimetoprima 4 g.","dosagem":"Bovinos: 3 mL/50 kg em dose única, por via intramuscular ou intravenosa.","proporcoes":[{"quantidade":"3","unidade":"ML","pesoKg":"50","condicao":"Bovinos, dose única; vias intramuscular ou intravenosa."}],"via":"Bovinos: intramuscular ou intravenosa.","carencias":{"leite":{"estado":"PRAZO","horas":48,"condicao":"Bovinos: após a última aplicação."},"carne":{"estado":"PRAZO","horas":96,"condicao":"Bovinos: após a última aplicação."}},"cuidados":"Máximo de 10 mL por ponto intramuscular; pode causar nódulo transitório. Não usar em glomerulonefrite, insuficiência renal aguda ou hipersensibilidade às sulfonamidas. Conservar entre 15 e 30 °C, seco e protegido da luz. Prescrição e orientação veterinária.","camposFonte":{"concentracao":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Fórmula"},"dosagem":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Posologia e Modo de Usar"},"proporcoes":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Posologia e Modo de Usar"},"via":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Posologia e Modo de Usar"},"carenciasLeite":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Períodos de carência — Bovinos — Leite"},"carenciasCarne":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Períodos de carência — Bovinos — Abate"},"cuidados":{"url":"https://www.msd-saude-animal.com.br/produto/borgal/","secao":"Precauções / Conservação"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Intervet do Brasil Veterinária Ltda.'
      AND p.nome = 'Borgal' AND ((p.id = 'd641f692-6783-577f-8b0b-d838a5e809e3'::uuid AND p.apresentacao = 'Frasco 10 ml') OR (p.id = '33d0a6a4-a7e3-5dea-9072-9793d20466e9'::uuid AND p.apresentacao = 'Frasco 5 ml') OR (p.id = '68c90395-0906-5b66-ad6d-8fb058fac211'::uuid AND p.apresentacao = 'Frasco 50 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 3 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;

DO $curadoria$
DECLARE quantidade integer;
BEGIN
  UPDATE public."ProdutoCatalogo" p
    SET "orientacaoBula" = '{"versao":2,"fonte":"https://www.msd-saude-animal.com.br/produto/panacur-10/","titulo":"Panacur 10% — ficha oficial MSD Brasil","tipoFonte":"FICHA_OFICIAL","consultadaEm":"2026-11-17","documentoSha256":"d31f94ae179e9398a1c1f4c25c4a2717d8016945caa77c9bb9ad091ef503fc73","especie":"Bovinos","concentracao":"Fenbendazol 100 mg/mL.","dosagem":"Bovinos: 5 mg de fenbendazol/kg em dose única por via oral. A ficha expressa a dose em mg/kg; a relação em mL/kg não foi transcrita como proporção explícita.","proporcoes":[],"via":"Oral.","carencias":{"leite":{"estado":"PRAZO","horas":120,"condicao":"Bovinos: após a última aplicação."},"carne":{"estado":"PRAZO","horas":264,"condicao":"Bovinos: após a última aplicação."}},"cuidados":"Agitar antes de usar. Usar todo o conteúdo imediatamente após abertura. Conservar em local fresco, seco e protegido da luz. Prescrição e orientação veterinária.","camposFonte":{"concentracao":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Fórmula"},"dosagem":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Dosagem e Modo de Usar"},"proporcoes":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Dosagem e Modo de Usar"},"via":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Dosagem e Modo de Usar"},"carenciasLeite":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Períodos de carência — Bovinos — Leite"},"carenciasCarne":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Períodos de carência — Bovinos — Abate"},"cuidados":{"url":"https://www.msd-saude-animal.com.br/produto/panacur-10/","secao":"Precauções / Conservação"}}}'::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP
    FROM public."FabricanteProduto" f
    WHERE f.id = p."fabricanteId" AND f.nome = 'Intervet do Brasil Veterinária Ltda.'
      AND p.nome = 'Panacur 10%' AND ((p.id = '55aaa884-a361-570c-80a1-1575a8af9c2f'::uuid AND p.apresentacao = 'Frasco 1 l') OR (p.id = '9b333c60-b67f-549f-9d38-1eb93d008bbd'::uuid AND p.apresentacao = 'Frasco 20 ml'));
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  IF quantidade <> 2 THEN
    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';
  END IF;
END $curadoria$;
