// Abas do Rebanho: mesmas primitivas e estilo das Configurações financeiras.
// Cada seção mantém seu endereço e o histórico do navegador.

import { SubTabs } from "../../../components/SubTabs";
import { navegarPara } from "../../../router";
import { LayoutDashboard, Layers, type LucideProps } from "lucide-react";
import { VacaIcon } from "../../../components/icons/VacaIcon";

export type SecaoRebanho = "visao-geral" | "animais" | "lotes" | "cadastros" | "sanidade" | "nutricao";

const SECOES: { valor: SecaoRebanho; rotulo: string; href: string }[] = [
  { valor: "visao-geral", rotulo: "Visão geral", href: "/pecuaria/rebanho" },
  { valor: "animais", rotulo: "Animais", href: "/pecuaria/rebanho/animais" },
  { valor: "lotes", rotulo: "Lotes", href: "/pecuaria/rebanho/lotes" },
];

export function NavRebanho({ ativa, comIcones = true }: { ativa: SecaoRebanho; comIcones?: boolean }) {
  const icones = [LayoutDashboard, IconeAnimais, Layers];
  return <SubTabs variant="financeiro" ariaLabel="Rebanho" tabs={SECOES.map((s, i) => ({ id: s.valor, label: s.rotulo, icon: comIcones ? icones[i] : undefined }))} active={ativa} onSelect={id => { const secao = SECOES.find(s => s.valor === id); if (secao) navegarPara(secao.href); }} className="rebanho-nav" />;
}

function IconeAnimais({ size = 20, ...props }: LucideProps) {
  return <VacaIcon {...props} width={size} height={size} />;
}
