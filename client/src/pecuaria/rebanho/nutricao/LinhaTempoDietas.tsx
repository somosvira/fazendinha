import { Leaf } from "lucide-react";
import type { Vigencia } from "./api";
import { Pill } from "@/financeiro/financeiro-ui";
import { LinkNutricional } from "./componentes";
import { rotaOperacaoNutricional } from "./navegacao";
import { formatarDataBR } from "../lib/rotulos";
export function LinhaTempoDietas({ itens, vigenteId, programada, escrever, loteId }: { itens: Vigencia[]; vigenteId?: string; programada: Vigencia | null; escrever: boolean | undefined; loteId: string }) {
  const hoje = Date.now(), dia = 86400000;
  const inicio = Math.min(hoje, ...itens.map(v => new Date(v.desde).getTime()));
  const fim = Math.max(hoje, ...itens.flatMap(v => [new Date(v.desde).getTime(), ...(v.ate ? [new Date(v.ate).getTime()] : [])]));
  const amplitude = Math.max(dia, fim - inicio);
  return <div className="dietas-linha-tempo"><div className="dietas-linha-eixo"><time>{formatarDataBR(new Date(inicio).toISOString())}</time><span>Vigências registradas</span><time>{formatarDataBR(new Date(fim).toISOString())}</time></div>{itens.map(v => {
    const atual = vigenteId === v.id, futura = programada != null && v.desde >= programada.desde;
    const desde = new Date(v.desde).getTime(), ate = v.ate ? new Date(v.ate).getTime() : Math.max(hoje, desde);
    return <section key={v.id} className="dietas-linha-registro"><header><Leaf size={18} aria-hidden /><h3>{v.dieta.nome} <span>· v{v.dieta.versao}</span></h3><Pill tone={atual ? "green" : futura ? "blue" : "neutral"}>{atual ? "Vigente" : futura ? "Programada" : "Histórica"}</Pill></header><div className="dietas-linha-trilho" role="img" aria-label={`Vigência desde ${formatarDataBR(v.desde)}, ${v.ate ? `até ${formatarDataBR(v.ate)}` : "sem fim programado"}`}><span data-futura={futura} style={{ marginLeft: `${(desde - inicio) / amplitude * 100}%`, width: `${Math.max(0, ate - desde) / amplitude * 100}%` }} /></div><footer><span>{formatarDataBR(v.desde)} — {v.ate ? formatarDataBR(v.ate) : atual ? "Hoje · sem fim programado" : "Sem fim programado"}</span>{escrever && <LinkNutricional className="nutricao-link" href={rotaOperacaoNutricional("corrigir", loteId, v.id)}>Corrigir vigência</LinkNutricional>}</footer></section>; })}</div>;
}
