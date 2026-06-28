import type { IaInsight } from "../types";

/* Insights da IA "Caatinga" — espelho do "Rúmi" do rebanho. Cada insight tem
 * escopo (lavoura/talhao) e domínio (fenologia/fitossanidade/nutricao/colheita).
 * O texto pode conter <b>…</b> para ênfase editorial. */

export const insights: IaInsight[] = [
  {
    id: "ins-001", escopo: "lavoura", dominio: "fitossanidade",
    texto: "A pressão de <b>ferrugem subiu em 4 talhões de Catuaí</b> nos últimos 30 dias — média de incidência passou de 6% para 11%. Os blocos com Acauã, Icatu e Arara ficaram abaixo de 3%. Vale acelerar a próxima aplicação nos suscetíveis enquanto a colheita ainda não fechou o calendário.",
    acoes: [{ label: "Ver talhões em alerta", primaria: true }, { label: "Programar fungicida" }],
  },
  {
    id: "ins-002", escopo: "lavoura", dominio: "colheita",
    texto: "Com <b>71% de cereja</b> na média dos talhões altos, o pico da derriça é entre <b>02 e 10 de junho</b>. Considerando 480 L/sc de rendimento e a disponibilidade da Jacto K3 só na 2ª semana, vale começar pelo Tijuco mecanizado para liberar o pano para Mata da Capela depois.",
    acoes: [{ label: "Ver calendário de colheita", primaria: true }, { label: "Simular cronograma" }],
  },
  {
    id: "ins-003", escopo: "lavoura", dominio: "nutricao",
    texto: "A análise foliar de fev/26 mostrou <b>K abaixo do ideal em 3 talhões de Catuaí</b> (1,5–1,8% contra 2,1–2,5% recomendados). Considerando o preço do KCl em queda e a janela pós-colheita curta, vale comprar o adubo do pós-colheita já em junho.",
    acoes: [{ label: "Ver análise foliar", primaria: true }],
  },
  {
    id: "ins-004", escopo: "lavoura", dominio: "fenologia",
    texto: "A <b>recepa de 2025 (T-011)</b> está em formação dentro do esperado — 2 hastes/toco. A próxima decisão é a 2ª desbrota em julho. Pensando 3 anos à frente: a 1ª safra cheia deve ser em <b>2028</b>, com produtividade-piso de 30 sc/ha.",
    acoes: [{ label: "Abrir T-011", primaria: true }],
  },
  {
    id: "ins-005", escopo: "talhao", talhaoId: "T-001", dominio: "fitossanidade",
    texto: "Este talhão acumulou <b>3 aplicações na safra</b> e a incidência de ferrugem ainda está subindo. Considerar revisar densidade (4.385 plantas/ha está alto para Catuaí em meia-encosta) na próxima recepa.",
    acoes: [{ label: "Histórico fitossanitário" }],
  },
];
