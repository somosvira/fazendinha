import { LinkInterno } from "../../../components/LinkInterno";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileText, MinusCircle } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { SecaoFicha } from "../components/SecaoRecolhivel";
import { listarRodadas, type PaginaSanitaria, type RodadaSanitaria } from "./rodadas-api";
import { dataSanitaria } from "./rotulos";
export function RodadasAnimal({ animalId, revisao }: { animalId: string; revisao: number }) {
  const [pagina, setPagina] = useState(1);
  const [rodadas, setRodadas] = useState<PaginaSanitaria<RodadaSanitaria> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => { let vivo = true; setRodadas(null); setErro(null); listarRodadas({ animalId, pagina, porPagina: 20 }).then((v) => { if (vivo) setRodadas(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId, pagina, revisao, tentativa]);
  return <SecaoFicha titulo={<span className="ficha-titulo-com-icone"><FileText size={20} aria-hidden />Protocolos sanitários do animal</span>}>
    {erro ? <><ErrorBox erro={erro} /><Button secondary onClick={() => setTentativa((v) => v + 1)}>Tentar novamente</Button></> : !rodadas ? <p>Carregando protocolos…</p> : <div className="grid gap-3">{rodadas.itens?.map((r) => <article key={r.id} className="protocolo-sanitario-animal">
      <header><h3>{r.nome} · {r.protocolo.nome} · v{r.protocolo.versao}</h3><LinkInterno area="pecuaria" aparencia="botao-secundario" href={`/pecuaria/rebanho/sanidade?aba=agenda&visaoAgenda=rodadas&rodadaId=${encodeURIComponent(r.id)}&animalId=${encodeURIComponent(animalId)}`}>Ver protocolo</LinkInterno></header>
      <div className="protocolo-sanitario-dados"><p><CalendarDays size={20} aria-hidden /><span>Início de referência<br /><strong>{dataSanitaria(r.inicioReferencia)}</strong></span></p>{r.contagens && <><p><CheckCircle2 size={20} aria-hidden />{r.contagens.realizadas} realizadas</p><p><Clock3 size={20} aria-hidden />{r.contagens.pendentes} pendentes</p><p><MinusCircle size={20} aria-hidden />{r.contagens.dispensadas} dispensadas</p></>}</div>
    </article>)}{!rodadas.itens?.length && <p>Nenhum protocolo sanitário para este animal.</p>}{rodadas.total > rodadas.porPagina && <div className="flex gap-2"><Button secondary disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><span>Página {pagina}</span><Button secondary disabled={pagina * rodadas.porPagina >= rodadas.total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div>}</div>}
  </SecaoFicha>;
}
