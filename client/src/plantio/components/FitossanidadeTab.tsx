import { Loader } from "../../components/Loading";
import { useTalhoes } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebMain } from "@/components/rb/RebPrimitives";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao, Talhao } from "../types";

export function FitossanidadeTab({ onRegistrarOperacao }: { onRegistrarOperacao: (talhao: Talhao) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  if (loading) return <RebMain><RebHeader eyebrow="Lavoura" title="Fitossanidade" /><Loader /></RebMain>;
  if (erro) return <RebMain><RebHeader title="Fitossanidade" /><p className="text-sm text-prejuizo">Erro: {erro}</p></RebMain>;
  // Resumo real embutido em cada talhão (.resumo); filtra nulos (talhão sem resumo).
  const resumos: ResumoTalhao[] = data.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));
  const abrir = (id: string) => { const t = data.find((x) => x.id === id); if (t) onRegistrarOperacao(t); };
  return <LavouraDomainView
    key="fitossanidade"
    config={DOMAINS.fitossanidade}
    resumos={resumos}
    insight={insightDaLavoura("fitossanidade")}
    nomes={nomes}
    onAbrirTalhao={abrir}
    dicaLinha="clique numa linha pra registrar aplicação/inspeção" />;
}
