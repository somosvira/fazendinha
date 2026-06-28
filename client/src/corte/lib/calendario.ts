/* Calendário sanitário Sul de Minas — gado de corte.
 * Baseado no cronograma 11 (Embrapa Gado de Corte) e nas datas oficiais
 * MAPA para aftosa. Cada item descreve a janela típica e o motivo. */

export interface ItemCalendario {
  mes: number;          // 1-12
  titulo: string;
  detalhe: string;
  publico: string;      // categorias afetadas
  obrigatorio: boolean;
}

export const CALENDARIO_SANITARIO: ItemCalendario[] = [
  { mes: 5,  titulo: "Vacinação aftosa · etapa 1",
    detalhe: "Vacina trivalente. Cada estado define a janela exata; Sul de Minas costuma ser a 1ª quinzena de maio.",
    publico: "Todas as categorias", obrigatorio: true },
  { mes: 5,  titulo: "Vermifugação 5-8-11 · etapa maio",
    detalhe: "Bovinos da desmama até 2 anos (recria/garrotes). Doramectina ou levamisol.",
    publico: "Recria / garrotes / novilhas", obrigatorio: false },
  { mes: 7,  titulo: "Desmama típica safra anterior",
    detalhe: "Bezerros aos ~7 meses (entram na recria); inicia vermifugação + 1ª clostridiose se ainda não foi feita.",
    publico: "Bezerros mama → recria", obrigatorio: false },
  { mes: 8,  titulo: "Vermifugação 5-8-11 · etapa agosto",
    detalhe: "Repete protocolo de maio. Foco em verminose seca.",
    publico: "Recria / garrotes / novilhas", obrigatorio: false },
  { mes: 9,  titulo: "Andrológico de touros",
    detalhe: "60 dias antes da estação de monta (nov). Exame clínico + biometria testicular + colheita seminal.",
    publico: "Touros", obrigatorio: false },
  { mes: 10, titulo: "Pesagem pré-IATF",
    detalhe: "Novilhas precisam atingir 320 kg para 1ª IATF (Embrapa). Pesar e descartar abaixo do alvo.",
    publico: "Novilhas", obrigatorio: false },
  { mes: 11, titulo: "Vacinação aftosa · etapa 2",
    detalhe: "Etapa final do ano. Cobre 100% do rebanho.",
    publico: "Todas as categorias", obrigatorio: true },
  { mes: 11, titulo: "Vermifugação 5-8-11 · etapa novembro",
    detalhe: "Etapa águas — controle de pico parasitário com chuva.",
    publico: "Recria / garrotes / novilhas", obrigatorio: false },
  { mes: 11, titulo: "Início estação de monta / IATF",
    detalhe: "Protocolo Ovsynch ou implante de progesterona. Sincronização para parição concentrada em out/nov.",
    publico: "Matrizes / novilhas aptas", obrigatorio: false },
  { mes: 12, titulo: "Brucelose B19 (fêmeas 3-8 meses)",
    detalhe: "Janela fixa por idade — pode acontecer em qualquer mês. Atenção a fêmeas que entram nos 8 meses.",
    publico: "Bezerras 3-8 meses", obrigatorio: true },
];

export function itensDoMes(mes: number): ItemCalendario[] {
  return CALENDARIO_SANITARIO.filter((i) => i.mes === mes);
}
