import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Baby, Banknote, BarChart3, Bell, BellRing, Boxes, Building2,
  CalendarCheck, CalendarClock, CalendarDays, ClipboardList, Cog, Dna, Droplets, FileText, FlaskConical, Gauge, GitBranch, HandCoins,
  Heart, HeartPulse, Landmark, Layers, ListChecks, MapPin, Milk, Package, Receipt, RefreshCw, Ruler, Scale, ShieldAlert,
  ShieldCheck, Stethoscope, Syringe, Tag, Tractor, Truck, Users, Utensils, Wallet, Wheat,
} from "lucide-react";
import { VacaIcon } from "./icons/VacaIcon";

export type IconeTabela = ComponentType<Pick<LucideProps, "size" | "aria-hidden">>;

const Vaca: IconeTabela = ({ size }) => <VacaIcon width={size} height={size} />;

/**
 * Ícones padronizados das linhas de tabela: cada chave nomeia O QUE a linha é.
 * Use sempre estas chaves (em `icone`/`iconeDe` da TabelaFinanceira) em vez de importar
 * um ícone avulso, para a mesma coisa ter o mesmo ícone em todas as telas.
 */
export const ICONES_TABELA = {
  // rebanho
  animal: Vaca,
  lote: Layers,
  sitio: MapPin,
  cria: Baby,
  coleira: Tag,
  parto: Baby,
  // sanidade
  aplicacao: Syringe,
  tarefa: ListChecks,
  ocorrencia: Stethoscope,
  carencia: ShieldAlert,
  programacao: CalendarClock,
  agenda: CalendarDays,
  exame: FlaskConical,
  protocolo: GitBranch,
  etapaProtocolo: ClipboardList,
  // reprodução
  reproducao: Heart,
  visita: Stethoscope,
  indicador: Gauge,
  // nutrição / estoque
  dieta: Wheat,
  ingrediente: Wheat,
  consumo: Utensils,
  fechamento: CalendarCheck,
  produto: Package,
  estoque: Boxes,
  movimentoEntrada: ArrowDownToLine,
  movimentoSaida: ArrowUpFromLine,
  movimentoTroca: ArrowLeftRight,
  // leite
  leite: Milk,
  ordenha: Droplets,
  coleta: Truck,
  qualidade: FlaskConical,
  calibracao: Ruler,
  peso: Scale,
  // financeiro
  operacao: Receipt,
  compromisso: CalendarClock,
  conta: Landmark,
  receber: HandCoins,
  pagar: Banknote,
  parceiro: Building2,
  categoria: Tag,
  valor: Wallet,
  relatorio: FileText,
  analise: BarChart3,
  // gerais
  alerta: Bell,
  alertaUrgente: BellRing,
  regra: Cog,
  genetica: Dna,
  pessoa: Users,
  saude: HeartPulse,
  fase: Activity,
  ciclo: RefreshCw,
  propriedade: Tractor,
  conferencia: ShieldCheck,
} satisfies Record<string, IconeTabela>;

/** Ícone de um cuidado/alerta conforme o que ele pede (etapa, diagnóstico, retorno, avaliação…). */
export function iconeDoCuidado(produtor?: string | null, tipo?: string | null): IconeTabela {
  if (tipo === "ETAPA_VENCIDA" || tipo === "TENTATIVA_APOS_PREPARO") return ICONES_TABELA.etapaProtocolo;
  if (tipo === "DG_VENCIDO" || tipo === "RECONFIRMACAO_VENCIDA") return ICONES_TABELA.exame;
  if (tipo === "RETORNO_VENCIDO" || tipo === "AGENDAMENTO_INCOMPLETO") return ICONES_TABELA.agenda;
  if (tipo === "APTA_SEM_ENCAMINHAMENTO" || tipo?.startsWith("AVALIACAO")) return ICONES_TABELA.conferencia;
  if (tipo === "DISPOSITIVO_SEM_RETIRADA") return ICONES_TABELA.alertaUrgente;
  if (tipo === "PROGRAMACAO") return ICONES_TABELA.programacao;
  return produtor === "reproducao" ? ICONES_TABELA.reproducao : ICONES_TABELA.aplicacao;
}
