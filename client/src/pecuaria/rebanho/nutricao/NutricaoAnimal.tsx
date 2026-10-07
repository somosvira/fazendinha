import { useEffect, useState } from "react";
import { Wheat } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { fmtMoneyExact } from "../../../components/charts";
import { CardFicha } from "../ui";
import { formatarDataBR } from "../lib/rotulos";
import { consultarConsumoAnimal, type ConsumoAnimal } from "./api";

export function NutricaoAnimal({ animalId, recarregarToken = 0 }: { animalId: string; recarregarToken?: number }) {
  const [itens, setItens] = useState<ConsumoAnimal[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [valores, setValores] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => { setPagina(1); setItens([]); }, [animalId, recarregarToken]);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    consultarConsumoAnimal(animalId, pagina).then((r) => { if (vivo) { setItens(r.itens); setTotal(r.total); setValores(r.verValores); } })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [animalId, pagina, recarregarToken, revisao]);
  return <CardFicha icon={Wheat} titulo="Nutrição" className="lg:col-span-2">
    <p className="mb-3 text-sm text-ink-3">Atribuído por permanência nos lotes, a partir dos consumos conferidos. Não mede a ingestão individual.</p>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((r) => r + 1)}>Tentar novamente</Button>}
    {carregando ? <p>Carregando consumo…</p> : !erro && (itens.length ? <div className="space-y-3">{itens.map((i) => <div key={i.id} className="rounded-lg border border-border p-3 text-sm">
      <p className="font-semibold">{formatarDataBR(i.inicio)} – {formatarDataBR(i.fim)} · {i.lote.nome} · {i.dias} dias · {i.status === "CONFIRMADO" ? "Confirmado" : "Estornado — fora do consumo atual"}</p>
      <p>{i.dieta.nome} v{i.dieta.versao}</p>
      {valores && <p>Custo conhecido: {i.custoConhecido == null ? "não apurado" : fmtMoneyExact(Number(i.custoConhecido))}{!i.coberturaCustoCompleta && " · cobertura incompleta"}</p>}
      {valores && i.custoConhecidoPorDia != null && <p>≈ {fmtMoneyExact(Number(i.custoConhecidoPorDia))}/animal-dia, sobre o custo conhecido</p>}
      {i.itens.map((item) => <p key={item.produtoId}>{item.nome}: {item.quantidadeAtribuida} {item.unidade} (≈ {item.quantidadePorDia} {item.unidade}/dia){valores && <> · {item.custoConhecido == null ? "custo não apurado" : fmtMoneyExact(Number(item.custoConhecido))}</>}</p>)}
      <a className="mt-2 inline-block underline" href={`/pecuaria/rebanho/nutricao?fechamentoId=${i.id}`}>Abrir fechamento do lote</a>
    </div>)}</div> : <p className="text-sm">Ainda sem consumo conferido para este animal. <a className="underline" href="/pecuaria/rebanho/nutricao">Conferir consumo do lote</a>.</p>)}
    {!carregando && !erro && total > 25 && <div className="mt-3 flex flex-wrap items-center gap-3"><Button secondary disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><span>Página {pagina} · {total} fechamentos</span><Button secondary disabled={pagina * 25 >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div>}
  </CardFicha>;
}
