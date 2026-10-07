import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { listarRodadas, type PaginaSanitaria, type RodadaSanitaria } from "./rodadas-api";
import { dataSanitaria } from "./rotulos";
export function RodadasAnimal({ animalId, revisao }: { animalId: string; revisao: number }) {
  const [pagina, setPagina] = useState(1);
  const [rodadas, setRodadas] = useState<PaginaSanitaria<RodadaSanitaria> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => { let vivo = true; setRodadas(null); setErro(null); listarRodadas({ animalId, pagina, porPagina: 20 }).then((v) => { if (vivo) setRodadas(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId, pagina, revisao, tentativa]);
  return <section className="my-4 grid gap-3"><h3 className="font-semibold">Participações em ciclos</h3>{erro ? <><ErrorBox erro={erro} /><Button secondary onClick={() => setTentativa((v) => v + 1)}>Tentar novamente</Button></> : !rodadas ? <p>Carregando participações…</p> : <>{rodadas.itens?.map((r) => <div key={r.id} className="rounded-lg border border-border p-3"><a className="underline" href={`/pecuaria/rebanho/sanidade?aba=agenda&visaoAgenda=rodadas&rodadaId=${encodeURIComponent(r.id)}&animalId=${encodeURIComponent(animalId)}`}>{r.nome} · {r.protocolo.nome} · v{r.protocolo.versao}</a><p className="text-sm">Início de referência: {dataSanitaria(r.inicioReferencia)}{r.contagens ? ` · Etapas: ${r.contagens.pendentes} pendentes, ${r.contagens.realizadas} realizadas, ${r.contagens.dispensadas} dispensadas` : ""}</p></div>)}{!rodadas.itens?.length && <p>Nenhuma participação em ciclo.</p>}{rodadas.total > rodadas.porPagina && <div className="flex gap-2"><Button secondary disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><span>Página {pagina}</span><Button secondary disabled={pagina * rodadas.porPagina >= rodadas.total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div>}</>}</section>;
}
