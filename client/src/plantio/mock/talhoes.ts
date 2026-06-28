import type { Talhao, ResumoTalhao } from "../types";

/* Mock realista — Lavoura Cafundó (Sul de Minas, ~1.080 m).
 * Densidade calculada por 10.000 ÷ (espaçamento_rua × espaçamento_pé).
 * Idade dos talhões e variedades cobrem cenário típico de uma fazenda em
 * transição: lavouras antigas (Catuaí/Mundo Novo > 12 anos), renovação com
 * Topázio/Arara e setor pós-recepa em formação. */

export const talhoes: Talhao[] = [
  // Cafundó alto — bloco mais antigo, em produção plena
  { id: "T-001", codigo: "CAF-01", nome: "Cafundó alto · setor 1",
    variedade: "Catuaí Vermelho IAC 144", espacamento: "3,80 × 0,60 m", plantasHa: 4385,
    areaHa: 4.2, anoPlantio: 2010, altitude: 1080, exposicao: "leste", declive: 14, irrigado: false,
    estado: "ATIVO", lavoura: "Cafundó", dataPlantio: "2010-11-12", ultimaRecepa: "2020-08-15" },
  { id: "T-002", codigo: "CAF-02", nome: "Cafundó alto · setor 2",
    variedade: "Catuaí Vermelho IAC 144", espacamento: "3,80 × 0,60 m", plantasHa: 4385,
    areaHa: 3.6, anoPlantio: 2010, altitude: 1085, exposicao: "leste", declive: 12, irrigado: false,
    estado: "ATIVO", lavoura: "Cafundó", dataPlantio: "2010-11-14" },
  { id: "T-003", codigo: "CAF-03", nome: "Cafundó alto · setor 3",
    variedade: "Catuaí Amarelo IAC 62", espacamento: "3,80 × 0,60 m", plantasHa: 4385,
    areaHa: 3.0, anoPlantio: 2012, altitude: 1078, exposicao: "leste", declive: 11, irrigado: false,
    estado: "ATIVO", lavoura: "Cafundó", dataPlantio: "2012-10-30" },

  // Tijuco — talhões adensados (renovação 2018)
  { id: "T-004", codigo: "TIJ-01", nome: "Tijuco · adensado leste",
    variedade: "Topázio MG-1190", espacamento: "3,50 × 0,50 m", plantasHa: 5714,
    areaHa: 5.1, anoPlantio: 2018, altitude: 1020, exposicao: "leste", declive: 9, irrigado: false,
    estado: "ATIVO", lavoura: "Tijuco", dataPlantio: "2018-11-08" },
  { id: "T-005", codigo: "TIJ-02", nome: "Tijuco · adensado oeste",
    variedade: "Topázio MG-1190", espacamento: "3,50 × 0,50 m", plantasHa: 5714,
    areaHa: 4.7, anoPlantio: 2018, altitude: 1025, exposicao: "oeste", declive: 8, irrigado: false,
    estado: "ATIVO", lavoura: "Tijuco", dataPlantio: "2018-11-10" },
  { id: "T-006", codigo: "TIJ-03", nome: "Tijuco · baixada",
    variedade: "Mundo Novo IAC 502-9", espacamento: "3,80 × 0,60 m", plantasHa: 4385,
    areaHa: 6.4, anoPlantio: 2015, altitude: 985, exposicao: "norte", declive: 6, irrigado: true,
    estado: "ATIVO", lavoura: "Tijuco", dataPlantio: "2015-12-02" },

  // Mata da Capela — meia-encosta, área nobre
  { id: "T-007", codigo: "CAP-01", nome: "Mata da Capela alto",
    variedade: "Bourbon Amarelo", espacamento: "4,00 × 0,70 m", plantasHa: 3571,
    areaHa: 2.8, anoPlantio: 2017, altitude: 1140, exposicao: "leste", declive: 22, irrigado: false,
    estado: "ATIVO", lavoura: "Mata da Capela", dataPlantio: "2017-11-25" },
  { id: "T-008", codigo: "CAP-02", nome: "Mata da Capela meio",
    variedade: "Bourbon Amarelo", espacamento: "4,00 × 0,70 m", plantasHa: 3571,
    areaHa: 3.5, anoPlantio: 2017, altitude: 1130, exposicao: "leste", declive: 19, irrigado: false,
    estado: "ATIVO", lavoura: "Mata da Capela", dataPlantio: "2017-11-26" },

  // Pasto Velho — bloco renovado com Arara em 2022
  { id: "T-009", codigo: "PVE-01", nome: "Pasto Velho · Arara A",
    variedade: "Arara", espacamento: "3,50 × 0,50 m", plantasHa: 5714,
    areaHa: 4.0, anoPlantio: 2022, altitude: 1050, exposicao: "norte", declive: 7, irrigado: false,
    estado: "ATIVO", lavoura: "Pasto Velho", dataPlantio: "2022-11-18" },
  { id: "T-010", codigo: "PVE-02", nome: "Pasto Velho · Arara B",
    variedade: "Arara", espacamento: "3,50 × 0,50 m", plantasHa: 5714,
    areaHa: 3.8, anoPlantio: 2022, altitude: 1055, exposicao: "norte", declive: 6, irrigado: false,
    estado: "ATIVO", lavoura: "Pasto Velho", dataPlantio: "2022-11-19" },

  // Recepa de 2025 — em formação (1ª safra reduzida em 2026)
  { id: "T-011", codigo: "CAF-04", nome: "Cafundó · recepa 2025",
    variedade: "Catuaí Vermelho IAC 144", espacamento: "3,80 × 0,60 m", plantasHa: 4385,
    areaHa: 5.4, anoPlantio: 2009, altitude: 1075, exposicao: "leste", declive: 13, irrigado: false,
    estado: "FORMACAO", lavoura: "Cafundó", dataPlantio: "2009-11-20", ultimaRecepa: "2025-08-12",
    observacao: "Recepa baixa a 35 cm em agosto/2025 após safra de carga pesada. Brotos selecionados em fev/2026 — 2 hastes/planta." },

  // Plantio novo 2025 — Catucaí formação plena
  { id: "T-012", codigo: "NOV-01", nome: "Novo Sul · setor A",
    variedade: "Catuaí Amarelo IAC 144", espacamento: "3,50 × 0,60 m", plantasHa: 4762,
    areaHa: 4.5, anoPlantio: 2025, altitude: 1010, exposicao: "norte", declive: 5, irrigado: true,
    estado: "FORMACAO", lavoura: "Novo Sul", dataPlantio: "2025-11-12",
    observacao: "Mudas saídas do viveiro com 6 pares de folhas. Adubação de formação seguindo recomendação 5B." },

  // Mata Seca — Acauã para resistência à ferrugem
  { id: "T-013", codigo: "SEC-01", nome: "Mata Seca · Acauã",
    variedade: "Acauã Novo", espacamento: "3,50 × 0,70 m", plantasHa: 4081,
    areaHa: 6.0, anoPlantio: 2019, altitude: 990, exposicao: "oeste", declive: 4, irrigado: false,
    estado: "ATIVO", lavoura: "Mata Seca", dataPlantio: "2019-11-22" },
  { id: "T-014", codigo: "SEC-02", nome: "Mata Seca · Icatu",
    variedade: "Icatu", espacamento: "3,80 × 0,70 m", plantasHa: 3759,
    areaHa: 5.5, anoPlantio: 2014, altitude: 985, exposicao: "oeste", declive: 5, irrigado: false,
    estado: "ATIVO", lavoura: "Mata Seca", dataPlantio: "2014-12-10" },

  // Talhão baixado em 2024 (área retornada a pasto)
  { id: "T-015", codigo: "CAF-05", nome: "Cafundó baixo (baixado)",
    variedade: "Mundo Novo IAC 379-19", espacamento: "4,00 × 0,80 m", plantasHa: 3125,
    areaHa: 2.2, anoPlantio: 1998, altitude: 1060, exposicao: "sul", declive: 17, irrigado: false,
    estado: "BAIXADO", lavoura: "Cafundó", dataPlantio: "1998-10-22",
    observacao: "Lavoura erradicada em 2024 — perdeu produção após 3 anos sem retomada. Área convertida a pasto para o gado." },
];

/* Resumos derivados — cada talhão tem um "diagnóstico atual" análogo ao
 * ResumoAnimal. Os números refletem o estado típico em 28/mai/2026:
 *   • Sul de Minas em final de colheita das partes baixas.
 *   • Maturação cereja > 60% nos talhões mais altos.
 *   • Bienalidade positiva da safra 2026 — produtividade esperada elevada.
 *   • Pressão de ferrugem ativa nos blocos suscetíveis (Catuaí), Acauã/Icatu controlam. */

export const resumos: ResumoTalhao[] = [
  { talhaoId: "T-001", fase: "MATURACAO_CEREJA", diasNaFase: 38,
    proximaOperacao: "Iniciar colheita (cereja 71%)", proximaOperacaoEm: "2026-06-02",
    produtividadeEsperada: 38, produtividadeUltima: 22, bienalidade: "POSITIVA",
    maturacaoCereja: 71, maturacaoVerde: 19, maturacaoBoia: 10,
    ferrugem: 9, bichoMineiro: 18, broca: 3.2, cercosporiose: 4, tendFerrugem: "subindo",
    ultimaInspecaoData: "2026-05-22",
    ultimaAnaliseSolo: "2025-08-10", pH: 5.4, v: 58, mo: 32, fosforo: 18, potassio: 96,
    ultimaAnaliseFoliar: "2026-02-14", nFoliar: 2.9, kFoliar: 1.7 },
  { talhaoId: "T-002", fase: "MATURACAO_CEREJA", diasNaFase: 36,
    proximaOperacao: "Iniciar colheita (cereja 68%)", proximaOperacaoEm: "2026-06-04",
    produtividadeEsperada: 36, produtividadeUltima: 21, bienalidade: "POSITIVA",
    maturacaoCereja: 68, maturacaoVerde: 21, maturacaoBoia: 11,
    ferrugem: 11, bichoMineiro: 22, broca: 4.1, cercosporiose: 5, tendFerrugem: "subindo",
    ultimaInspecaoData: "2026-05-22",
    ultimaAnaliseSolo: "2025-08-10", pH: 5.3, v: 56, mo: 31, fosforo: 17, potassio: 88 },
  { talhaoId: "T-003", fase: "MATURACAO_CEREJA", diasNaFase: 32,
    proximaOperacao: "2ª aplicação fungicida (cuprovinil)", proximaOperacaoEm: "2026-05-30",
    produtividadeEsperada: 34, produtividadeUltima: 19, bienalidade: "POSITIVA",
    maturacaoCereja: 62, maturacaoVerde: 26, maturacaoBoia: 12,
    ferrugem: 13, bichoMineiro: 25, broca: 5.3, cercosporiose: 7, tendFerrugem: "subindo",
    ultimaInspecaoData: "2026-05-22" },
  { talhaoId: "T-004", fase: "COLHEITA", diasNaFase: 14,
    proximaOperacao: "Programar 2ª passada", proximaOperacaoEm: "2026-06-12",
    produtividadeEsperada: 52, produtividadeUltima: 28, bienalidade: "POSITIVA",
    maturacaoCereja: 82, maturacaoVerde: 8, maturacaoBoia: 10,
    ferrugem: 4, bichoMineiro: 12, broca: 2.1, cercosporiose: 2, tendFerrugem: "estavel",
    ultimaInspecaoData: "2026-05-26", ultimaAnaliseSolo: "2025-09-04",
    pH: 5.7, v: 65, mo: 34, fosforo: 22, potassio: 118 },
  { talhaoId: "T-005", fase: "COLHEITA", diasNaFase: 12,
    proximaOperacao: "Programar 2ª passada", proximaOperacaoEm: "2026-06-14",
    produtividadeEsperada: 48, produtividadeUltima: 26, bienalidade: "POSITIVA",
    maturacaoCereja: 79, maturacaoVerde: 11, maturacaoBoia: 10,
    ferrugem: 5, bichoMineiro: 14, broca: 2.4, cercosporiose: 3, tendFerrugem: "estavel" },
  { talhaoId: "T-006", fase: "COLHEITA", diasNaFase: 22,
    proximaOperacao: "Avaliar parar 2ª passada (cereja em queda)", proximaOperacaoEm: "2026-06-06",
    produtividadeEsperada: 44, produtividadeUltima: 24, bienalidade: "POSITIVA",
    maturacaoCereja: 74, maturacaoVerde: 8, maturacaoBoia: 18,
    ferrugem: 3, bichoMineiro: 10, broca: 1.8, cercosporiose: 2, tendFerrugem: "caindo",
    ultimaInspecaoData: "2026-05-24" },
  { talhaoId: "T-007", fase: "MATURACAO_CEREJA", diasNaFase: 40,
    proximaOperacao: "Aguardar derriça (cereja 64%)", proximaOperacaoEm: "2026-06-08",
    produtividadeEsperada: 28, produtividadeUltima: 16, bienalidade: "POSITIVA",
    maturacaoCereja: 64, maturacaoVerde: 24, maturacaoBoia: 12,
    ferrugem: 14, bichoMineiro: 19, broca: 3.6, cercosporiose: 6, tendFerrugem: "subindo",
    ultimaInspecaoData: "2026-05-20" },
  { talhaoId: "T-008", fase: "MATURACAO_CEREJA", diasNaFase: 38,
    proximaOperacao: "Aguardar derriça (cereja 60%)", proximaOperacaoEm: "2026-06-10",
    produtividadeEsperada: 26, produtividadeUltima: 15, bienalidade: "POSITIVA",
    maturacaoCereja: 60, maturacaoVerde: 27, maturacaoBoia: 13,
    ferrugem: 16, bichoMineiro: 21, broca: 4.0, cercosporiose: 8, tendFerrugem: "subindo",
    ultimaInspecaoData: "2026-05-20" },
  { talhaoId: "T-009", fase: "MATURACAO_VERDE", diasNaFase: 12,
    proximaOperacao: "Monitorar broca (frutos verdes ≠ alvo)", proximaOperacaoEm: "2026-06-02",
    produtividadeEsperada: 42, produtividadeUltima: 19, bienalidade: "POSITIVA",
    maturacaoCereja: 32, maturacaoVerde: 56, maturacaoBoia: 12,
    ferrugem: 2, bichoMineiro: 8, broca: 1.2, cercosporiose: 1, tendFerrugem: "estavel" },
  { talhaoId: "T-010", fase: "MATURACAO_VERDE", diasNaFase: 14,
    proximaOperacao: "Monitorar broca / armadilhas", proximaOperacaoEm: "2026-06-02",
    produtividadeEsperada: 40, produtividadeUltima: 18, bienalidade: "POSITIVA",
    maturacaoCereja: 28, maturacaoVerde: 60, maturacaoBoia: 12,
    ferrugem: 2, bichoMineiro: 9, broca: 1.4, cercosporiose: 1, tendFerrugem: "estavel" },
  { talhaoId: "T-011", fase: "REPOUSO", diasNaFase: 60,
    proximaOperacao: "1ª desbrota da brotação", proximaOperacaoEm: "2026-07-15",
    produtividadeEsperada: 8, produtividadeUltima: 32, bienalidade: "NEGATIVA",
    ferrugem: 1, bichoMineiro: 4, broca: 0.4, cercosporiose: 1, tendFerrugem: "caindo" },
  { talhaoId: "T-012", fase: "REPOUSO", diasNaFase: 90,
    proximaOperacao: "Adubação de formação 3ª parcela", proximaOperacaoEm: "2026-07-05",
    produtividadeEsperada: 0, produtividadeUltima: 0, bienalidade: "POSITIVA",
    ferrugem: 0, bichoMineiro: 2, broca: 0, cercosporiose: 0,
    ultimaAnaliseSolo: "2025-09-22", pH: 5.6, v: 62, mo: 24, fosforo: 12, potassio: 72 },
  { talhaoId: "T-013", fase: "MATURACAO_CEREJA", diasNaFase: 32,
    proximaOperacao: "Iniciar colheita (cereja 76%)", proximaOperacaoEm: "2026-06-01",
    produtividadeEsperada: 36, produtividadeUltima: 22, bienalidade: "POSITIVA",
    maturacaoCereja: 76, maturacaoVerde: 14, maturacaoBoia: 10,
    ferrugem: 1, bichoMineiro: 6, broca: 2.5, cercosporiose: 1, tendFerrugem: "estavel" },
  { talhaoId: "T-014", fase: "MATURACAO_CEREJA", diasNaFase: 34,
    proximaOperacao: "Iniciar colheita (cereja 70%)", proximaOperacaoEm: "2026-06-03",
    produtividadeEsperada: 30, produtividadeUltima: 19, bienalidade: "POSITIVA",
    maturacaoCereja: 70, maturacaoVerde: 18, maturacaoBoia: 12,
    ferrugem: 2, bichoMineiro: 8, broca: 2.0, cercosporiose: 2, tendFerrugem: "estavel" },
];
