/* Mocks server-side do módulo Plantio.
 *
 * Por enquanto, o backend serve os mesmos dados que o frontend mantém em
 * client/src/plantio/mock/. Quando o Prisma for plugado, essas funções viram
 * `prisma.talhao.findMany(...)` — a forma do JSON retornado ao cliente não muda.
 *
 * Justificativa: o módulo nasce navegável em produção, sem depender de
 * migration; a forma já é a final, então não há retrabalho quando o banco
 * for materializado.
 */

type Estado = "ATIVO" | "RECEPADO" | "FORMACAO" | "BAIXADO";
type Fase =
  | "REPOUSO" | "INDUCAO_FLORAL" | "FLORADA" | "CHUMBINHO" | "EXPANSAO"
  | "GRANACAO" | "MATURACAO_VERDE" | "MATURACAO_CEREJA" | "COLHEITA" | "POS_COLHEITA";

export interface Talhao {
  id: string;
  codigo: string;
  nome: string;
  variedade: string;
  espacamento: string;
  plantasHa: number;
  areaHa: number;
  anoPlantio: number;
  altitude: number;
  exposicao?: "norte" | "sul" | "leste" | "oeste" | null;
  declive?: number | null;
  irrigado: boolean;
  estado: Estado;
  lavoura: string;
  ultimaRecepa?: string | null;
  dataPlantio: string;
  observacao?: string | null;
  resumo?: ResumoTalhao | null;
}

export interface ResumoTalhao {
  talhaoId: string;
  fase: Fase;
  diasNaFase?: number;
  proximaOperacao?: string;
  proximaOperacaoEm?: string;
  produtividadeEsperada?: number;
  produtividadeUltima?: number;
  bienalidade?: "POSITIVA" | "NEGATIVA";
  maturacaoCereja?: number;
  maturacaoVerde?: number;
  maturacaoBoia?: number;
  ferrugem?: number;
  bichoMineiro?: number;
  broca?: number;
  cercosporiose?: number;
  tendFerrugem?: "subindo" | "estavel" | "caindo";
  ultimaInspecaoData?: string;
  ultimaAnaliseSolo?: string;
  pH?: number;
  v?: number;
  mo?: number;
  fosforo?: number;
  potassio?: number;
  ultimaAnaliseFoliar?: string;
  nFoliar?: number;
  kFoliar?: number;
}

export interface EventoTimeline {
  id: string; talhaoId: string; data: string;
  dominio: "fenologia" | "fitossanidade" | "nutricao" | "colheita";
  titulo: string; detalhe?: string; alerta?: boolean;
  marcador?: string; responsavel?: string; impacto?: string; proximoPasso?: string;
}

export interface Lavoura { id: number; nome: string; variedade?: string; numTalhoes: number; areaHa: number; produtividadeMedia?: number; planoAdubacaoNome?: string | null; }
export interface PlanoAdubacao { id: number; nome: string; descricao?: string; nKgHa?: number; p2o5KgHa?: number; k2oKgHa?: number; parcelas?: number; ativo: boolean; }

export const talhoes: Talhao[] = [
  { id: "T-001", codigo: "CAF-01", nome: "Cafundó alto · setor 1", variedade: "Catuaí Vermelho IAC 144", espacamento: "3,80 × 0,60 m", plantasHa: 4385, areaHa: 4.2, anoPlantio: 2010, altitude: 1080, exposicao: "leste", declive: 14, irrigado: false, estado: "ATIVO", lavoura: "Cafundó", dataPlantio: "2010-11-12", ultimaRecepa: "2020-08-15" },
  { id: "T-002", codigo: "CAF-02", nome: "Cafundó alto · setor 2", variedade: "Catuaí Vermelho IAC 144", espacamento: "3,80 × 0,60 m", plantasHa: 4385, areaHa: 3.6, anoPlantio: 2010, altitude: 1085, exposicao: "leste", declive: 12, irrigado: false, estado: "ATIVO", lavoura: "Cafundó", dataPlantio: "2010-11-14" },
  { id: "T-003", codigo: "CAF-03", nome: "Cafundó alto · setor 3", variedade: "Catuaí Amarelo IAC 62", espacamento: "3,80 × 0,60 m", plantasHa: 4385, areaHa: 3.0, anoPlantio: 2012, altitude: 1078, exposicao: "leste", declive: 11, irrigado: false, estado: "ATIVO", lavoura: "Cafundó", dataPlantio: "2012-10-30" },
  { id: "T-004", codigo: "TIJ-01", nome: "Tijuco · adensado leste", variedade: "Topázio MG-1190", espacamento: "3,50 × 0,50 m", plantasHa: 5714, areaHa: 5.1, anoPlantio: 2018, altitude: 1020, exposicao: "leste", declive: 9, irrigado: false, estado: "ATIVO", lavoura: "Tijuco", dataPlantio: "2018-11-08" },
  { id: "T-005", codigo: "TIJ-02", nome: "Tijuco · adensado oeste", variedade: "Topázio MG-1190", espacamento: "3,50 × 0,50 m", plantasHa: 5714, areaHa: 4.7, anoPlantio: 2018, altitude: 1025, exposicao: "oeste", declive: 8, irrigado: false, estado: "ATIVO", lavoura: "Tijuco", dataPlantio: "2018-11-10" },
  { id: "T-006", codigo: "TIJ-03", nome: "Tijuco · baixada", variedade: "Mundo Novo IAC 502-9", espacamento: "3,80 × 0,60 m", plantasHa: 4385, areaHa: 6.4, anoPlantio: 2015, altitude: 985, exposicao: "norte", declive: 6, irrigado: true, estado: "ATIVO", lavoura: "Tijuco", dataPlantio: "2015-12-02" },
  { id: "T-007", codigo: "CAP-01", nome: "Mata da Capela alto", variedade: "Bourbon Amarelo", espacamento: "4,00 × 0,70 m", plantasHa: 3571, areaHa: 2.8, anoPlantio: 2017, altitude: 1140, exposicao: "leste", declive: 22, irrigado: false, estado: "ATIVO", lavoura: "Mata da Capela", dataPlantio: "2017-11-25" },
  { id: "T-008", codigo: "CAP-02", nome: "Mata da Capela meio", variedade: "Bourbon Amarelo", espacamento: "4,00 × 0,70 m", plantasHa: 3571, areaHa: 3.5, anoPlantio: 2017, altitude: 1130, exposicao: "leste", declive: 19, irrigado: false, estado: "ATIVO", lavoura: "Mata da Capela", dataPlantio: "2017-11-26" },
  { id: "T-009", codigo: "PVE-01", nome: "Pasto Velho · Arara A", variedade: "Arara", espacamento: "3,50 × 0,50 m", plantasHa: 5714, areaHa: 4.0, anoPlantio: 2022, altitude: 1050, exposicao: "norte", declive: 7, irrigado: false, estado: "ATIVO", lavoura: "Pasto Velho", dataPlantio: "2022-11-18" },
  { id: "T-010", codigo: "PVE-02", nome: "Pasto Velho · Arara B", variedade: "Arara", espacamento: "3,50 × 0,50 m", plantasHa: 5714, areaHa: 3.8, anoPlantio: 2022, altitude: 1055, exposicao: "norte", declive: 6, irrigado: false, estado: "ATIVO", lavoura: "Pasto Velho", dataPlantio: "2022-11-19" },
  { id: "T-011", codigo: "CAF-04", nome: "Cafundó · recepa 2025", variedade: "Catuaí Vermelho IAC 144", espacamento: "3,80 × 0,60 m", plantasHa: 4385, areaHa: 5.4, anoPlantio: 2009, altitude: 1075, exposicao: "leste", declive: 13, irrigado: false, estado: "FORMACAO", lavoura: "Cafundó", dataPlantio: "2009-11-20", ultimaRecepa: "2025-08-12" },
  { id: "T-012", codigo: "NOV-01", nome: "Novo Sul · setor A", variedade: "Catuaí Amarelo IAC 144", espacamento: "3,50 × 0,60 m", plantasHa: 4762, areaHa: 4.5, anoPlantio: 2025, altitude: 1010, exposicao: "norte", declive: 5, irrigado: true, estado: "FORMACAO", lavoura: "Novo Sul", dataPlantio: "2025-11-12" },
  { id: "T-013", codigo: "SEC-01", nome: "Mata Seca · Acauã", variedade: "Acauã Novo", espacamento: "3,50 × 0,70 m", plantasHa: 4081, areaHa: 6.0, anoPlantio: 2019, altitude: 990, exposicao: "oeste", declive: 4, irrigado: false, estado: "ATIVO", lavoura: "Mata Seca", dataPlantio: "2019-11-22" },
  { id: "T-014", codigo: "SEC-02", nome: "Mata Seca · Icatu", variedade: "Icatu", espacamento: "3,80 × 0,70 m", plantasHa: 3759, areaHa: 5.5, anoPlantio: 2014, altitude: 985, exposicao: "oeste", declive: 5, irrigado: false, estado: "ATIVO", lavoura: "Mata Seca", dataPlantio: "2014-12-10" },
  { id: "T-015", codigo: "CAF-05", nome: "Cafundó baixo (baixado)", variedade: "Mundo Novo IAC 379-19", espacamento: "4,00 × 0,80 m", plantasHa: 3125, areaHa: 2.2, anoPlantio: 1998, altitude: 1060, exposicao: "sul", declive: 17, irrigado: false, estado: "BAIXADO", lavoura: "Cafundó", dataPlantio: "1998-10-22" },
];

export const resumos: ResumoTalhao[] = [
  { talhaoId: "T-001", fase: "MATURACAO_CEREJA", diasNaFase: 38, proximaOperacao: "Iniciar colheita (cereja 71%)", proximaOperacaoEm: "2026-06-02", produtividadeEsperada: 38, produtividadeUltima: 22, bienalidade: "POSITIVA", maturacaoCereja: 71, maturacaoVerde: 19, maturacaoBoia: 10, ferrugem: 9, bichoMineiro: 18, broca: 3.2, cercosporiose: 4, tendFerrugem: "subindo", ultimaInspecaoData: "2026-05-22", ultimaAnaliseSolo: "2025-08-10", pH: 5.4, v: 58, mo: 32, fosforo: 18, potassio: 96, ultimaAnaliseFoliar: "2026-02-14", nFoliar: 2.9, kFoliar: 1.7 },
  { talhaoId: "T-002", fase: "MATURACAO_CEREJA", diasNaFase: 36, proximaOperacao: "Iniciar colheita (cereja 68%)", proximaOperacaoEm: "2026-06-04", produtividadeEsperada: 36, produtividadeUltima: 21, bienalidade: "POSITIVA", maturacaoCereja: 68, maturacaoVerde: 21, maturacaoBoia: 11, ferrugem: 11, bichoMineiro: 22, broca: 4.1, cercosporiose: 5, tendFerrugem: "subindo", ultimaInspecaoData: "2026-05-22", ultimaAnaliseSolo: "2025-08-10", pH: 5.3, v: 56, mo: 31, fosforo: 17, potassio: 88 },
  { talhaoId: "T-003", fase: "MATURACAO_CEREJA", diasNaFase: 32, proximaOperacao: "2ª aplicação fungicida (cuprovinil)", proximaOperacaoEm: "2026-05-30", produtividadeEsperada: 34, produtividadeUltima: 19, bienalidade: "POSITIVA", maturacaoCereja: 62, maturacaoVerde: 26, maturacaoBoia: 12, ferrugem: 13, bichoMineiro: 25, broca: 5.3, cercosporiose: 7, tendFerrugem: "subindo", ultimaInspecaoData: "2026-05-22" },
  { talhaoId: "T-004", fase: "COLHEITA", diasNaFase: 14, proximaOperacao: "Programar 2ª passada", proximaOperacaoEm: "2026-06-12", produtividadeEsperada: 52, produtividadeUltima: 28, bienalidade: "POSITIVA", maturacaoCereja: 82, maturacaoVerde: 8, maturacaoBoia: 10, ferrugem: 4, bichoMineiro: 12, broca: 2.1, cercosporiose: 2, tendFerrugem: "estavel", ultimaInspecaoData: "2026-05-26", ultimaAnaliseSolo: "2025-09-04", pH: 5.7, v: 65, mo: 34, fosforo: 22, potassio: 118 },
  { talhaoId: "T-005", fase: "COLHEITA", diasNaFase: 12, proximaOperacao: "Programar 2ª passada", proximaOperacaoEm: "2026-06-14", produtividadeEsperada: 48, produtividadeUltima: 26, bienalidade: "POSITIVA", maturacaoCereja: 79, maturacaoVerde: 11, maturacaoBoia: 10, ferrugem: 5, bichoMineiro: 14, broca: 2.4, cercosporiose: 3, tendFerrugem: "estavel" },
  { talhaoId: "T-006", fase: "COLHEITA", diasNaFase: 22, proximaOperacao: "Avaliar parar 2ª passada (cereja em queda)", proximaOperacaoEm: "2026-06-06", produtividadeEsperada: 44, produtividadeUltima: 24, bienalidade: "POSITIVA", maturacaoCereja: 74, maturacaoVerde: 8, maturacaoBoia: 18, ferrugem: 3, bichoMineiro: 10, broca: 1.8, cercosporiose: 2, tendFerrugem: "caindo", ultimaInspecaoData: "2026-05-24" },
  { talhaoId: "T-007", fase: "MATURACAO_CEREJA", diasNaFase: 40, proximaOperacao: "Aguardar derriça (cereja 64%)", proximaOperacaoEm: "2026-06-08", produtividadeEsperada: 28, produtividadeUltima: 16, bienalidade: "POSITIVA", maturacaoCereja: 64, maturacaoVerde: 24, maturacaoBoia: 12, ferrugem: 14, bichoMineiro: 19, broca: 3.6, cercosporiose: 6, tendFerrugem: "subindo", ultimaInspecaoData: "2026-05-20" },
  { talhaoId: "T-008", fase: "MATURACAO_CEREJA", diasNaFase: 38, proximaOperacao: "Aguardar derriça (cereja 60%)", proximaOperacaoEm: "2026-06-10", produtividadeEsperada: 26, produtividadeUltima: 15, bienalidade: "POSITIVA", maturacaoCereja: 60, maturacaoVerde: 27, maturacaoBoia: 13, ferrugem: 16, bichoMineiro: 21, broca: 4.0, cercosporiose: 8, tendFerrugem: "subindo", ultimaInspecaoData: "2026-05-20" },
  { talhaoId: "T-009", fase: "MATURACAO_VERDE", diasNaFase: 12, proximaOperacao: "Monitorar broca (frutos verdes ≠ alvo)", proximaOperacaoEm: "2026-06-02", produtividadeEsperada: 42, produtividadeUltima: 19, bienalidade: "POSITIVA", maturacaoCereja: 32, maturacaoVerde: 56, maturacaoBoia: 12, ferrugem: 2, bichoMineiro: 8, broca: 1.2, cercosporiose: 1, tendFerrugem: "estavel" },
  { talhaoId: "T-010", fase: "MATURACAO_VERDE", diasNaFase: 14, proximaOperacao: "Monitorar broca / armadilhas", proximaOperacaoEm: "2026-06-02", produtividadeEsperada: 40, produtividadeUltima: 18, bienalidade: "POSITIVA", maturacaoCereja: 28, maturacaoVerde: 60, maturacaoBoia: 12, ferrugem: 2, bichoMineiro: 9, broca: 1.4, cercosporiose: 1, tendFerrugem: "estavel" },
  { talhaoId: "T-011", fase: "REPOUSO", diasNaFase: 60, proximaOperacao: "1ª desbrota da brotação", proximaOperacaoEm: "2026-07-15", produtividadeEsperada: 8, produtividadeUltima: 32, bienalidade: "NEGATIVA", ferrugem: 1, bichoMineiro: 4, broca: 0.4, cercosporiose: 1, tendFerrugem: "caindo" },
  { talhaoId: "T-012", fase: "REPOUSO", diasNaFase: 90, proximaOperacao: "Adubação de formação 3ª parcela", proximaOperacaoEm: "2026-07-05", produtividadeEsperada: 0, produtividadeUltima: 0, bienalidade: "POSITIVA", ferrugem: 0, bichoMineiro: 2, broca: 0, cercosporiose: 0, ultimaAnaliseSolo: "2025-09-22", pH: 5.6, v: 62, mo: 24, fosforo: 12, potassio: 72 },
  { talhaoId: "T-013", fase: "MATURACAO_CEREJA", diasNaFase: 32, proximaOperacao: "Iniciar colheita (cereja 76%)", proximaOperacaoEm: "2026-06-01", produtividadeEsperada: 36, produtividadeUltima: 22, bienalidade: "POSITIVA", maturacaoCereja: 76, maturacaoVerde: 14, maturacaoBoia: 10, ferrugem: 1, bichoMineiro: 6, broca: 2.5, cercosporiose: 1, tendFerrugem: "estavel" },
  { talhaoId: "T-014", fase: "MATURACAO_CEREJA", diasNaFase: 34, proximaOperacao: "Iniciar colheita (cereja 70%)", proximaOperacaoEm: "2026-06-03", produtividadeEsperada: 30, produtividadeUltima: 19, bienalidade: "POSITIVA", maturacaoCereja: 70, maturacaoVerde: 18, maturacaoBoia: 12, ferrugem: 2, bichoMineiro: 8, broca: 2.0, cercosporiose: 2, tendFerrugem: "estavel" },
];

export const eventos: EventoTimeline[] = [
  { id: "e-001", talhaoId: "T-001", data: "2025-09-12", dominio: "fenologia", titulo: "Florada de São José", detalhe: "Chuvas de 38 mm em 4 dias dispararam abertura uniforme", marcador: "abertura da safra 2026" },
  { id: "e-002", talhaoId: "T-001", data: "2025-10-08", dominio: "nutricao", titulo: "Adubação cobertura · 1ª parcela", detalhe: "20-00-20 a 400 kg/ha", responsavel: "Wagner", impacto: "R$ 1.840" },
  { id: "e-003", talhaoId: "T-001", data: "2025-11-22", dominio: "fitossanidade", titulo: "Aplicação preventiva ferrugem", detalhe: "Epoxiconazol + piraclostrobina", responsavel: "Wagner", impacto: "R$ 612" },
  { id: "e-004", talhaoId: "T-001", data: "2026-01-18", dominio: "nutricao", titulo: "Adubação cobertura · 3ª parcela", detalhe: "Sulfato de amônio 250 kg/ha + KCl 200 kg/ha", responsavel: "Wagner", impacto: "R$ 2.105" },
  { id: "e-005", talhaoId: "T-001", data: "2026-02-14", dominio: "nutricao", titulo: "Análise foliar 3º par", detalhe: "N 2,9% OK, K 1,7% abaixo do ideal", impacto: "ajustar 4ª parcela KCl" },
  { id: "e-006", talhaoId: "T-001", data: "2026-04-02", dominio: "fitossanidade", titulo: "Monitoramento MIP — folhas", detalhe: "Ferrugem 6%, bicho-mineiro 14%", alerta: true, proximoPasso: "aplicar fungicida sistêmico em 7 dias" },
  { id: "e-007", talhaoId: "T-001", data: "2026-04-10", dominio: "fitossanidade", titulo: "Aplicação fungicida sistêmico", detalhe: "Ciproconazol + Trifloxistrobina", responsavel: "Wagner", impacto: "R$ 798 · carência 30 dias" },
  { id: "e-008", talhaoId: "T-001", data: "2026-05-22", dominio: "fitossanidade", titulo: "Inspeção pré-colheita", detalhe: "Ferrugem 9% (subindo), broca 3,2%", alerta: true, proximoPasso: "atenção à derriça — separar boia" },
  { id: "e-009", talhaoId: "T-001", data: "2026-05-25", dominio: "fenologia", titulo: "Maturação cereja > 70%", detalhe: "Amostragem em 5 plantas · cereja 71% · verde 19% · boia 10%", proximoPasso: "iniciar derriça no pano" },
  { id: "e-020", talhaoId: "T-004", data: "2025-10-05", dominio: "fenologia", titulo: "Florada principal Topázio", detalhe: "Uniformidade alta — chuva acumulada 62 mm", marcador: "safra 2026 cheia" },
  { id: "e-021", talhaoId: "T-004", data: "2026-05-14", dominio: "colheita", titulo: "1ª passada · derriça mecanizada", detalhe: "Colhedora Jacto K3 · 18.420 L cereja · rendimento 480 L/sc", responsavel: "Jair", impacto: "≈ 38 sc beneficiadas" },
  { id: "e-022", talhaoId: "T-004", data: "2026-05-15", dominio: "colheita", titulo: "Lavador + secagem terreiro", detalhe: "Boia separada (12%) — terreiro híbrido por 6 dias", proximoPasso: "armazém em 16 dias" },
  { id: "e-030", talhaoId: "T-009", data: "2025-09-30", dominio: "fenologia", titulo: "Florada Arara · uniforme", detalhe: "Variedade resistente a ferrugem", marcador: "4ª safra cheia" },
  { id: "e-031", talhaoId: "T-009", data: "2025-11-18", dominio: "nutricao", titulo: "Adubação cobertura · 1ª parcela", detalhe: "Formulado 25-00-20 a 500 kg/ha", impacto: "R$ 2.250" },
  { id: "e-032", talhaoId: "T-009", data: "2026-03-12", dominio: "fitossanidade", titulo: "Monitoramento MIP", detalhe: "Ferrugem 1%, bicho-mineiro 6%", proximoPasso: "sem necessidade de aplicação" },
  { id: "e-040", talhaoId: "T-011", data: "2025-08-12", dominio: "fenologia", titulo: "Recepa baixa · 35 cm", detalhe: "Após safra de 32 sc/ha", marcador: "início do ciclo de formação", impacto: "renovação · R$ 11.880" },
  { id: "e-041", talhaoId: "T-011", data: "2026-02-08", dominio: "fenologia", titulo: "1ª desbrota", detalhe: "Mantidas 2 hastes mais vigorosas", responsavel: "Wagner", proximoPasso: "2ª desbrota em julho" },
  { id: "e-050", talhaoId: "T-013", data: "2025-09-22", dominio: "fenologia", titulo: "Florada Acauã", detalhe: "Variedade tardia — 5 dias depois das Catuaí" },
  { id: "e-051", talhaoId: "T-013", data: "2026-05-24", dominio: "fenologia", titulo: "Maturação cereja 76%", detalhe: "Variedade muito uniforme", proximoPasso: "iniciar colheita amanhã" },
  { id: "e-060", talhaoId: "T-006", data: "2026-05-06", dominio: "colheita", titulo: "1ª passada · derriça no pano", detalhe: "8 panistas · 14.200 L · rendimento 510 L/sc", responsavel: "Equipe externa", impacto: "≈ 28 sc beneficiadas" },
];

export const lavouras: Lavoura[] = [
  { id: 1, nome: "Cafundó", variedade: "Catuaí Vermelho IAC 144", numTalhoes: 4, areaHa: 16.2, produtividadeMedia: 31, planoAdubacaoNome: "Padrão Catuaí 35 sc/ha" },
  { id: 2, nome: "Tijuco", variedade: "Topázio MG-1190", numTalhoes: 3, areaHa: 16.2, produtividadeMedia: 48, planoAdubacaoNome: "Adensado alta produção" },
  { id: 3, nome: "Mata da Capela", variedade: "Bourbon Amarelo", numTalhoes: 2, areaHa: 6.3, produtividadeMedia: 27, planoAdubacaoNome: "Bourbon micro-lote" },
  { id: 4, nome: "Pasto Velho", variedade: "Arara", numTalhoes: 2, areaHa: 7.8, produtividadeMedia: 41, planoAdubacaoNome: "Arara resistente" },
  { id: 5, nome: "Novo Sul", variedade: "Catuaí Amarelo IAC 144", numTalhoes: 1, areaHa: 4.5, planoAdubacaoNome: "Formação 1º ano" },
  { id: 6, nome: "Mata Seca", variedade: "Acauã Novo", numTalhoes: 2, areaHa: 11.5, produtividadeMedia: 33, planoAdubacaoNome: "Padrão Catuaí 35 sc/ha" },
];

export const planosAdubacao: PlanoAdubacao[] = [
  { id: 1, nome: "Padrão Catuaí 35 sc/ha", ativo: true, descricao: "Plano de cobertura para talhões 30-40 sc/ha — 4 parcelas.", nKgHa: 320, p2o5KgHa: 60, k2oKgHa: 240, parcelas: 4 },
  { id: 2, nome: "Adensado alta produção", ativo: true, descricao: "Plano agressivo para Topázio adensado 5.700+ pl/ha.", nKgHa: 420, p2o5KgHa: 80, k2oKgHa: 300, parcelas: 5 },
  { id: 3, nome: "Bourbon micro-lote", ativo: true, descricao: "Plano moderado focado em qualidade.", nKgHa: 240, p2o5KgHa: 60, k2oKgHa: 220, parcelas: 4 },
  { id: 4, nome: "Arara resistente", ativo: true, descricao: "Sem fungicida sistêmico.", nKgHa: 340, p2o5KgHa: 60, k2oKgHa: 250, parcelas: 4 },
  { id: 5, nome: "Formação 1º ano", ativo: true, descricao: "Adubação de formação para talhão recém-plantado.", nKgHa: 120, p2o5KgHa: 140, k2oKgHa: 100, parcelas: 6 },
];

export function anexarResumo(t: Talhao, rs: ResumoTalhao[]): Talhao {
  return { ...t, resumo: rs.find((r) => r.talhaoId === t.id) ?? null };
}
