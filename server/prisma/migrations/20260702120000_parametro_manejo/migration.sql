-- Parâmetros de manejo do rebanho (metas Embrapa + regras da fazenda).
-- Modelo key/value: cada chave é um parâmetro; o serviço parametros.ts sabe
-- interpretar cada uma. Referência Embrapa fica sempre gravada em separado,
-- pra UI exibir "seu valor: X | Embrapa: Y".

CREATE TABLE "ParametroManejo" (
    "chave" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT,
    "valorNumero" DECIMAL(14, 4),
    "valorNumeroAceitavel" DECIMAL(14, 4),
    "valorTexto" TEXT,
    "modo" TEXT,
    "direcao" TEXT,
    "referenciaNumero" DECIMAL(14, 4),
    "referenciaNumeroAceitavel" DECIMAL(14, 4),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametroManejo_pkey" PRIMARY KEY ("chave")
);

CREATE INDEX "ParametroManejo_categoria_ordem_idx"
    ON "ParametroManejo" ("categoria", "ordem");

-- ============================================================================
-- Seed dos defaults (Embrapa) — os mesmos valores hoje hardcoded em
-- indicadores-embrapa.ts (METAS_EMBRAPA, PESO_REF_KG) e insights.ts
-- (META_PRODUCAO_POR_CATEGORIA, janelas PRIME).
-- ============================================================================

INSERT INTO "ParametroManejo"
    ("chave","categoria","descricao","unidade","valorNumero","valorNumeroAceitavel","modo","direcao","referenciaNumero","referenciaNumeroAceitavel","ordem","atualizadoEm")
VALUES
-- Manejo específico da fazenda (regras que Embrapa dá em dias, mas a fazenda
-- usa por peso). Modo escolhe entre DIAS e PESO; os dois valores ficam
-- guardados, e o consumidor lê aquele indicado pelo modo.
    ('DESMAME_MODO',      'MANEJO',    'Como decidir a hora do desmame',      NULL,       NULL, NULL, 'DIAS',  NULL, NULL, NULL,  1, NOW()),
    ('DESMAME_DIAS',      'MANEJO',    'Idade de desmame (por dias)',         'dias',      120, NULL, NULL,    NULL,  120, NULL,  2, NOW()),
    ('DESMAME_PESO_KG',   'MANEJO',    'Peso de desmame (por peso)',          'kg',        180, NULL, NULL,    NULL,  180, NULL,  3, NOW()),
    ('PESO_UA_REF_KG',    'MANEJO',    'Peso vivo de 1 UA',                   'kg',        450, NULL, NULL,    NULL,  450, NULL,  4, NOW()),

-- Peso de referência por categoria (usado no cálculo de UA / Taxa de Lotação).
    ('PESO_REF_VACA',     'MANEJO',    'Peso referência VACA',                'kg',        500, NULL, NULL,    NULL,  500, NULL, 10, NOW()),
    ('PESO_REF_TOURO',    'MANEJO',    'Peso referência TOURO',               'kg',        800, NULL, NULL,    NULL,  800, NULL, 11, NOW()),
    ('PESO_REF_NOVILHA',  'MANEJO',    'Peso referência NOVILHA',             'kg',        280, NULL, NULL,    NULL,  280, NULL, 12, NOW()),
    ('PESO_REF_BEZERRA',  'MANEJO',    'Peso referência BEZERRA',             'kg',        120, NULL, NULL,    NULL,  120, NULL, 13, NOW()),
    ('PESO_REF_BEZERRO',  'MANEJO',    'Peso referência BEZERRO',             'kg',        120, NULL, NULL,    NULL,  120, NULL, 14, NOW()),
    ('PESO_REF_CABRA',    'MANEJO',    'Peso referência CABRA',               'kg',         55, NULL, NULL,    NULL,   55, NULL, 15, NOW()),
    ('PESO_REF_BODE',     'MANEJO',    'Peso referência BODE',                'kg',         75, NULL, NULL,    NULL,   75, NULL, 16, NOW()),
    ('PESO_REF_CABRITA',  'MANEJO',    'Peso referência CABRITA',             'kg',         25, NULL, NULL,    NULL,   25, NULL, 17, NOW()),
    ('PESO_REF_CABRITO',  'MANEJO',    'Peso referência CABRITO',             'kg',         25, NULL, NULL,    NULL,   25, NULL, 18, NOW()),

-- Produção mínima esperada por categoria (base do "vaca abaixo do mínimo"
-- em insights.ts). Valores só para VACA e CABRA — as demais categorias não
-- produzem leite.
    ('PROD_META_VACA',    'PRODUCAO',  'Meta de produção — VACA',             'L/vaca/dia', 28, NULL, NULL,    NULL,   28, NULL, 20, NOW()),
    ('PROD_META_CABRA',   'PRODUCAO',  'Meta de produção — CABRA',            'L/cabra/dia', 4, NULL, NULL,    NULL,    4, NULL, 21, NOW()),

-- Janela "prime" (idade de melhor rendimento) por espécie — usada no score
-- reprodutivo do animal.
    ('PRIME_BOVINO_MIN',  'PRODUCAO',  'Idade mín. do PRIME (bovino)',        'anos',        3, NULL, NULL,    NULL,    3, NULL, 30, NOW()),
    ('PRIME_BOVINO_MAX',  'PRODUCAO',  'Idade máx. do PRIME (bovino)',        'anos',        7, NULL, NULL,    NULL,    7, NULL, 31, NOW()),
    ('PRIME_CAPRINO_MIN', 'PRODUCAO',  'Idade mín. do PRIME (caprino)',       'anos',        2, NULL, NULL,    NULL,    2, NULL, 32, NOW()),
    ('PRIME_CAPRINO_MAX', 'PRODUCAO',  'Idade máx. do PRIME (caprino)',       'anos',        5, NULL, NULL,    NULL,    5, NULL, 33, NOW()),

-- 24 METAS EMBRAPA (semáforo verde/amarelo/vermelho).
-- Formato: valorNumero=ideal (verde), valorNumeroAceitavel=aceitável (amarelo).
-- Produtivo
    ('META_VL',        'PRODUCAO',  '% Vacas em Lactação',                    '%',          83,   75, NULL, 'maior_melhor',   83,   75, 50, NOW()),
    ('META_DL',        'PRODUCAO',  'Duração da Lactação',                    'dias',      305,  270, NULL, 'maior_melhor',  305,  270, 51, NOW()),
    ('META_PERS',      'PRODUCAO',  'Persistência da Lactação',               '%',          90,   80, NULL, 'maior_melhor',   90,   80, 52, NOW()),
    ('META_PVO',       'PRODUCAO',  'Produção por Vaca Ordenhada',            'L/vaca/dia', 18,   10, NULL, 'maior_melhor',   18,   10, 53, NOW()),
    ('META_PL',        'PRODUCAO',  'Produção por Lactação',                  'kg/lactação',5500,3000, NULL,'maior_melhor', 5500, 3000, 54, NOW()),
    ('META_PS_DRY',    'PRODUCAO',  'Período Seco',                           'dias',       60,   70, NULL, 'menor_melhor',   60,   70, 55, NOW()),
-- Reprodutivo
    ('META_IP',        'REPRODUCAO','Intervalo de Partos',                    'dias',      395,  425, NULL, 'menor_melhor',  395,  425, 60, NOW()),
    ('META_PS',        'REPRODUCAO','Período de Serviço',                     'dias',      120,  150, NULL, 'menor_melhor',  120,  150, 61, NOW()),
    ('META_PRENH',     'REPRODUCAO','% Prenhez do Rebanho',                   '%',          60,   45, NULL, 'maior_melhor',   60,   45, 62, NOW()),
    ('META_PR1S',      'REPRODUCAO','% Prenhez ao 1º Serviço',                '%',          50,   40, NULL, 'maior_melhor',   50,   40, 63, NOW()),
    ('META_TG',        'REPRODUCAO','Taxa de Gestação',                       '%',          40,   30, NULL, 'maior_melhor',   40,   30, 64, NOW()),
    ('META_IPP',       'REPRODUCAO','Idade ao 1º Parto',                      'meses',      26,   30, NULL, 'menor_melhor',   26,   30, 65, NOW()),
    ('META_NAT',       'REPRODUCAO','Taxa de Natalidade',                     '%',          80,   70, NULL, 'maior_melhor',   80,   70, 66, NOW()),
    ('META_AB',        'REPRODUCAO','Taxa de Abortos e Natimortos',           '%',           5,    8, NULL, 'menor_melhor',    5,    8, 67, NOW()),
-- Produtivo × Reprodutivo (combinados)
    ('META_PDIP',      'PRODUCAO',  'PDIP — Produção por dia de IEP',         'kg/dia',     14,   10, NULL, 'maior_melhor',   14,   10, 70, NOW()),
    ('META_PLVA',      'PRODUCAO',  'PLVA — Produção por Vaca/Ano',           'kg/vaca/ano',5000,2500, NULL,'maior_melhor', 5000, 2500, 71, NOW()),
-- Gestão
    ('META_LOT',       'GESTAO',    'Taxa de Lotação',                        'UA/ha',     3.0,  1.5, NULL, 'maior_melhor',  3.0,  1.5, 80, NOW()),
    ('META_PT',        'GESTAO',    'Produtividade da Terra',                 'L/ha/ano', 5000, 1500, NULL, 'maior_melhor', 5000, 1500, 81, NOW()),
    ('META_PMO',       'GESTAO',    'Produtividade da Mão de Obra',           'L/func/dia',250,  150, NULL, 'maior_melhor',  250,  150, 82, NOW()),
    ('META_LC',        'GESTAO',    'Relação Leite / Concentrado',            'L/kg',      2.0,  1.5, NULL, 'maior_melhor',  2.0,  1.5, 83, NOW()),
    ('META_DESC',      'GESTAO',    'Taxa de Descarte',                       '%/ano',      22,   30, NULL, 'menor_melhor',   22,   30, 84, NOW()),
-- Sanitário
    ('META_MORT_AD',   'SANITARIO', 'Mortalidade de Adultos',                 '%/ano',       2,    4, NULL, 'menor_melhor',    2,    4, 90, NOW()),
    ('META_MORT_BEZ',  'SANITARIO', 'Mortalidade de Bezerros (até 1 ano)',    '%/ano',       8,   12, NULL, 'menor_melhor',    8,   12, 91, NOW()),
    ('META_CCS',       'SANITARIO', 'CCS — Contagem de Células Somáticas',    'mil/mL',    200,  400, NULL, 'menor_melhor',  200,  400, 92, NOW());
