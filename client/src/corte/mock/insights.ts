import type { IaInsight } from "../types";

/* Insights da IA "Capão" — assistente do módulo Corte.
 * O nome vem de "capão", como o boi castrado é chamado em algumas regiões,
 * uma piada interna que não destoa do tom Rúmi/Caatinga dos outros módulos. */

export const insights: IaInsight[] = [
  {
    id: "ins-c-001", escopo: "fazenda", dominio: "comercial",
    texto: "Os <b>14 bois prontos (TER-02)</b> e os <b>22 F1 Angus (TER-01)</b> chegando em setembro coincidem com o <b>contango da B3</b> — agosto/2026 a R$ 345, setembro a R$ 347, outubro a R$ 356. Atrasar a venda do TER-02 para set/out pode render R$ 7-12 mil a mais (sem desconto frete cama), mas o GMD nessa idade já é baixo (0,42 kg/d) — vale rodar o cálculo de break-even.",
    acoes: [{ label: "Abrir simulador de venda", primaria: true }, { label: "Ver curva B3" }],
  },
  {
    id: "ins-c-002", escopo: "fazenda", dominio: "pesagem",
    texto: "O lote <b>RDM-01 (recria machos)</b> está em GMD <b>0,38 kg/dia</b> nos últimos 60d, abaixo da meta Embrapa para recria pasto (0,45-0,50). Como ainda restam 35 dias de seca antes das primeiras chuvas, vale antecipar a transição para <b>suplemento proteico seca</b>.",
    acoes: [{ label: "Abrir L-006", primaria: true }],
  },
  {
    id: "ins-c-003", escopo: "fazenda", dominio: "sanidade",
    texto: "<b>26 bezerras (BMM-02)</b> têm a janela de vacinação <b>brucelose B19 (3-8 meses)</b> fechando em julho. Após 8 meses, a vacina não pode mais ser aplicada nessa categoria. Programar com a MV Carla.",
    acoes: [{ label: "Agendar vacinação", primaria: true }],
  },
  {
    id: "ins-c-004", escopo: "fazenda", dominio: "nutricao",
    texto: "O <b>PQ-04 (Mata Grande)</b> recebe 48 matrizes + 57 bezerros simultaneamente. Lotação está em <b>0,73 UA/ha</b> (ok no início da seca, mas estoure ≥ 0,9 UA/ha se a sequência de meses sem chuva se prolongar). Plano B: deslocar garrotes do PQ-06 para um piquete reformado.",
    acoes: [{ label: "Ver mapa de piquetes" }],
  },
  {
    id: "ins-c-005", escopo: "lote", loteId: "L-008", dominio: "sanidade",
    texto: "Garrotes acumulam <b>mortalidade 10%</b> desde a formação (2 mortes em 20). Acima da média Embrapa (3-5% até abate). Considerar revisar cerca elétrica e protocolo de adaptação ao Mombaça.",
    acoes: [{ label: "Histórico do lote" }],
  },
];
