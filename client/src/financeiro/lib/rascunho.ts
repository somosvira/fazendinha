import type { RascunhoOperacao } from "../novo-api";
import { brl, TIPO_OPERACAO } from "../financeiro-ui";

/** O que o atalho "Trabalho ativo" da sidebar mostra sobre o rascunho. */
export type ResumoRascunho = {
  /** Descrição da operação; sem ela, o primeiro item; sem itens, "Nova operação". */
  titulo: string;
  /** Valor e tipo prontos para exibição, ex.: "R$ 1.250,00 · Venda". O valor vem
   *  primeiro porque a sidebar é estreita e o fim da linha é truncado. */
  detalhe: string;
  atualizadoEm: string;
};

type Registro = Record<string, unknown>;

// `dados` é JSON livre gravado pelo formulário: cada campo é conferido antes do uso.
const registro = (valor: unknown): Registro | null => valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : null;
const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : "";
const numero = (valor: unknown) => {
  const convertido = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() ? Number(valor) : Number.NaN;
  return Number.isFinite(convertido) ? convertido : 0;
};

/** Mesmo total que o formulário calcula: soma dos itens quando há itens, senão o valor da operação. */
function valorDoRascunho(operacao: Registro | null, formulario: Registro | null) {
  const itens = Array.isArray(operacao?.itens) ? operacao.itens.map(registro).filter((item): item is Registro => !!item) : [];
  if (itens.length) {
    const soma = itens.reduce((total, item) => total + numero(item.quantidade) * numero(item.valorUnitario), 0);
    return Math.round(soma * 100) / 100;
  }
  return numero(operacao?.valorTotal ?? formulario?.valorOperacao);
}

export function resumoRascunho(rascunho: RascunhoOperacao): ResumoRascunho {
  const operacao = registro(rascunho.dados?.operacao);
  const formulario = registro(rascunho.dados?.formulario);
  const primeiroItem = Array.isArray(operacao?.itens)
    ? operacao.itens.map((item) => texto(registro(item)?.descricao)).find(Boolean)
    : undefined;
  const tipo = texto(operacao?.tipo) || texto(formulario?.tipo);
  const valor = valorDoRascunho(operacao, formulario);
  return {
    titulo: texto(operacao?.descricao) || texto(formulario?.descricao) || primeiroItem || "Nova operação",
    detalhe: [valor > 0 ? brl(valor) : null, TIPO_OPERACAO[tipo]].filter(Boolean).join(" · "),
    atualizadoEm: rascunho.updatedAt,
  };
}

const inicioDoDia = (instante: number) => { const dia = new Date(instante); dia.setHours(0, 0, 0, 0); return dia.getTime(); };

/** Quando o rascunho foi salvo, em linguagem de gente: "agora", "há 5 min", "ontem"… */
export function quandoSalvo(iso: string, agora: number = Date.now()): string {
  const instante = new Date(iso).getTime();
  if (!Number.isFinite(instante)) return "Rascunho salvo";
  const minutos = Math.max(0, Math.floor((agora - instante) / 60_000));
  if (minutos < 1) return "Rascunho salvo agora";
  if (minutos < 60) return `Rascunho salvo há ${minutos} min`;
  // Dias de calendário (e não blocos de 24 h), arredondados por causa do horário de verão.
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(instante)) / 86_400_000);
  if (dias <= 0) return `Rascunho salvo há ${Math.floor(minutos / 60)} h`;
  if (dias === 1) return "Rascunho salvo ontem";
  return `Rascunho salvo em ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(instante))}`;
}
