import { Loader } from "../../components/Loading";
import { useTalhoes } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao } from "../types";

export function FenologiaTab({ onAbrirTalhao }: { onAbrirTalhao: (id: string) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><RebHeader eyebrow="Lavoura" title="Fenologia" /><Loader /></main>;
  if (erro) return <main className="rb-main"><RebHeader title="Fenologia" /><p className="text-sm text-prejuizo">Erro: {erro}</p></main>;
  // Resumo real embutido em cada talhão (.resumo). Talhão recém-criado pode vir
  // sem resumo → filtramos pra não quebrar a view.
  const resumos: ResumoTalhao[] = data.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));
  return <LavouraDomainView
    key="fenologia"
    config={DOMAINS.fenologia}
    resumos={resumos}
    insight={insightDaLavoura("fenologia")}
    nomes={nomes}
    onAbrirTalhao={onAbrirTalhao}
    dicaLinha="clique num talhão pra ver a timeline editorial" />;
}
