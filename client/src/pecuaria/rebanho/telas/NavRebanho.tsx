// Abas do Rebanho: mesmas primitivas e estilo das Configurações financeiras.
// Cada seção mantém seu endereço e o histórico do navegador.

import { SubTabs } from "../../../components/SubTabs";
import { navegarPara } from "../../../router";

export type SecaoRebanho = "visao-geral" | "animais" | "lotes" | "cadastros" | "sanidade" | "nutricao";

const SECOES: { valor: SecaoRebanho; rotulo: string; href: string }[] = [
  { valor: "visao-geral", rotulo: "Visão geral", href: "/pecuaria/rebanho" },
  { valor: "animais", rotulo: "Animais", href: "/pecuaria/rebanho/animais" },
  { valor: "lotes", rotulo: "Lotes", href: "/pecuaria/rebanho/lotes" },
];

export function NavRebanho({ ativa }: { ativa: SecaoRebanho }) {
  return <SubTabs variant="financeiro" ariaLabel="Rebanho" tabs={SECOES.map(s => ({ id: s.valor, label: s.rotulo }))} active={ativa} onSelect={id => { const secao = SECOES.find(s => s.valor === id); if (secao) navegarPara(secao.href); }} className="mt-5" />;
}
