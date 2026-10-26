import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AjudaCampo } from "@/components/Dica";
import { GlassWater, House, Trash2, Users } from "lucide-react";
import { formatarLitros } from "./modelo";
import type { DiaOperacionalLeite } from "./resumo-producao";
import "./distribuicao-consumo.css";

export function DistribuicaoConsumoLeite({ dados, compacto = false, carregando = false, erro = false }: {
  dados: DiaOperacionalLeite | null; compacto?: boolean; carregando?: boolean; erro?: boolean;
}) {
  const consumo = dados?.consumo, descarte = dados?.descarte;
  const total = consumo?.totalLitros == null ? null : Number(consumo.totalLitros);
  const alimentacao = [
    { nome: "Limpo", valor: consumo?.comumLitros, cor: "comum", ajuda: "Leite comum ou comercial declarado na alimentação. A classificação não certifica aptidão sanitária." },
    { nome: "Sujo", valor: consumo?.naoComercialLitros, cor: "nao-comercial", ajuda: "Leite não comercial destinado à alimentação, conforme a classificação registrada." },
    { nome: "Colostro", valor: consumo?.colostroLitros, cor: "colostro", ajuda: "Volume de colostro registrado na alimentação, incluído no volume destinado." },
  ];
  const descartes = [
    { nome: "Do limpo", valor: descarte?.comercialLitros }, { nome: "Do sujo", valor: descarte?.naoComercialLitros },
    { nome: "De colostro", valor: descarte?.colostroLitros }, { nome: "A classificar", valor: descarte?.semClassificacaoLitros },
  ];
  const volume = (valor: string | null | undefined) => carregando ? <Skeleton className="h-5 w-16" /> : erro ? "Indisponível" : formatarLitros(valor == null ? null : Number(valor));
  const conhecidos = !carregando && !erro && total !== null && total > 0;
  return <div className={`consumo-distribuicao${compacto ? " consumo-distribuicao-compacta" : ""}`}>
    <section aria-label="Distribuição da alimentação" className="consumo-alimentacao">
      {!compacto && <header><div><GlassWater size={18} aria-hidden /><h3>Alimentação</h3><AjudaCampo rotulo="Sobre alimentação" texto="Destinos internos e fornecimentos nutricionais confirmados. Descartes são separados e não fazem parte deste volume." /></div><strong>{volume(consumo?.totalLitros)}</strong></header>}
      {conhecidos && <div className="consumo-composicao" role="img" aria-label={alimentacao.map(a => `${a.nome}: ${formatarLitros(a.valor == null ? null : Number(a.valor))}`).join("; ")}>{alimentacao.map(a => <span key={a.nome} className={a.cor} style={{ flexGrow: Number(a.valor ?? 0) }} />)}</div>}
      <dl className="consumo-legenda">{alimentacao.map(a => <div key={a.nome}><dt><i className={a.cor} aria-hidden />{a.nome}<AjudaCampo rotulo={`Sobre ${a.nome.toLocaleLowerCase("pt-BR")}`} texto={a.ajuda} /></dt><dd>{volume(a.valor)}{conhecidos && a.valor != null && <small>{(Number(a.valor) / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</small>}</dd></div>)}</dl>
    </section>
    <section aria-label="Distribuição do descarte" className="consumo-descarte"><header><div><Trash2 size={16} aria-hidden /><h3>Descarte</h3><AjudaCampo rotulo="Sobre descarte" texto="Descarte físico confirmado, separado da alimentação. A classificação vem do registro histórico da alocação." /></div><strong>{volume(descarte?.totalLitros)}</strong></header><dl>{descartes.map(d => <div key={d.nome}><dt>{d.nome}<AjudaCampo rotulo={`Sobre descarte ${d.nome.toLocaleLowerCase("pt-BR")}`} texto={d.nome === "A classificar" ? "Descarte sem classificação comprovada na alocação da origem." : `Volume fisicamente descartado ${d.nome.toLocaleLowerCase("pt-BR")}, sem somar à alimentação.`} /></dt><dd>{volume(d.valor)}</dd>{!carregando && !erro && d.valor != null && descarte?.totalLitros != null && Number(descarte.totalLitros) > 0 && <div className="consumo-descarte-barra" aria-hidden><i style={{ width: `${Number(d.valor) / Number(descarte.totalLitros) * 100}%` }} /></div>}</div>)}</dl></section>
    <section aria-label="Retiradas internas" className="consumo-retiradas">{!compacto && <h3>Retiradas internas</h3>}<div>{[{ nome: "Funcionários", Icone: Users }, { nome: "Casa", Icone: House }].map(({ nome, Icone }) => <div key={nome}><Icone size={16} aria-hidden /><span>{nome}<AjudaCampo rotulo={`Sobre ${nome.toLocaleLowerCase("pt-BR")}`} texto="Destino em aberto, sem volume atribuído. Não representa zero nem integra o total de alimentação." /></span><Badge variant="outline">Em aberto</Badge></div>)}</div></section>
  </div>;
}
