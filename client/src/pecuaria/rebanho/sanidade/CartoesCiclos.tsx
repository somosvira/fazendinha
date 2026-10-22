import { useEffect, useState } from "react";
import { CalendarDays, Check, Circle, Users } from "lucide-react";
import { Button } from "@/financeiro/financeiro-ui";
import { dataSanitaria } from "./rotulos";
import { listarEtapasRodada, type EtapaRodada, type RodadaSanitaria } from "./rodadas-api";

function CartaoCiclo({ ciclo: r, onAbrir, revisao }: { ciclo: RodadaSanitaria; onAbrir: (id: string) => void; revisao: number }) {
  const [etapas, setEtapas] = useState<{ itens: EtapaRodada[]; total: number } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { let vivo = true; setEtapas(null); setErro(false); listarEtapasRodada(r.id, { pagina: 1, porPagina: 4 }).then(v => { if (vivo) setEtapas(v); }).catch(() => { if (vivo) setErro(true); }); return () => { vivo = false; }; }, [r.id, revisao]);
  const c = r.contagens;
  const partes = c ? [{ nome: "Realizadas", singular: "realizada", qtd: c.realizadas, classe: "realizadas" }, { nome: "Pendentes no prazo", singular: "pendente no prazo", qtd: Math.max(0, c.pendentes - c.atrasadas), classe: "pendentes" }, { nome: "Atrasadas", singular: "atrasada", qtd: c.atrasadas, classe: "atrasadas" }, { nome: "Outras situações", singular: "outra situação", qtd: Math.max(0, c.total - c.realizadas - c.pendentes), classe: "outras" }] : [];
  return <article className="san-ciclo-cartao"><header><div><h2>{r.nome}</h2><p>{r.protocolo.nome} · v{r.protocolo.versao}</p></div><span className="san-ciclo-participantes"><Users size={16} aria-hidden />{r.participantes ?? "—"} {r.participantes === 1 ? "animal" : "animais"}</span></header>
    <p className="san-visual-meta"><CalendarDays size={15} aria-hidden />Início em {dataSanitaria(r.inicioReferencia)}</p>
    {c ? <div className="san-ciclo-progresso"><div className="san-ciclo-progresso-titulo"><span>Tarefas do ciclo no sítio consultado</span><strong>{c.realizadas} de {c.total} realizadas</strong></div><div className="san-ciclo-barra" aria-label={partes.map(p => `${p.qtd} ${p.nome.toLowerCase()}`).join(", ")}>{partes.filter(p => p.qtd > 0).map(p => <span key={p.classe} className={`san-progresso-${p.classe}`} style={{ flex: p.qtd }} />)}</div><div className="san-ciclo-legenda">{partes.filter(p=>p.qtd>0).map(p=><span key={p.classe}><i className={`san-progresso-${p.classe}`}/>{p.qtd} {p.qtd === 1 ? p.singular : p.nome.toLowerCase()}</span>)}</div>{((c.regularizacoes ?? 0)>0 || (c.encerradasSemSubstituicao ?? 0)>0) && <p className="san-visual-meta">{c.regularizacoes ?? 0} a regularizar · {c.encerradasSemSubstituicao ?? 0} encerradas sem substituição</p>}</div> : <p className="san-visual-meta">Contagens indisponíveis</p>}
    <div className="san-ciclo-etapas-visuais" aria-label={`Etapas de ${r.nome}`}>
      {!etapas && !erro && <p className="san-visual-meta">Carregando etapas…</p>}
      {erro && <p className="san-visual-meta">Consulte as etapas em Ver ciclo.</p>}
      {etapas?.itens.map(e => { const completa = e.contagens.total > 0 && e.contagens.realizadas === e.contagens.total; return <div key={e.id} className={completa ? "san-etapa-concluida" : ""}><span className="san-etapa-marca">{completa ? <Check size={17} aria-hidden /> : <Circle size={17} aria-hidden />}</span><strong>Dia {e.diaRelativo}</strong><span>{e.tipo === "APLICACAO" ? "Aplicação" : "Exame"}</span><small>{e.contagens.realizadas} de {e.contagens.total} realizadas</small></div>; })}
      {etapas && etapas.total > etapas.itens.length && <span className="san-etapas-restantes">+{etapas.total - etapas.itens.length} etapas no ciclo</span>}
    </div><Button secondary onClick={() => onAbrir(r.id)}>Ver ciclo</Button>
  </article>;
}
export function CartoesCiclos({ ciclos, onAbrir, revisao }: { ciclos: RodadaSanitaria[]; onAbrir: (id: string) => void; revisao: number }) {
  return <div className="san-ciclos-cartoes">{ciclos.map(ciclo => <CartaoCiclo key={ciclo.id} ciclo={ciclo} onAbrir={onAbrir} revisao={revisao} />)}</div>;
}
