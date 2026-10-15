import { useEffect, useState } from "react";
import { ChevronRight, Wheat } from "lucide-react";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { fmtMoneyExact } from "../../../components/charts";
import { CardFicha } from "../ui";
import { formatarDataBR } from "../lib/rotulos";
import { consultarConsumoAnimal, type ConsumoAnimal } from "./api";
import { LinkNutricional, rotaNutricao } from "./componentes";
import { quantidadeNutricional } from "./quantidades";
import { EstadoConsulta } from "./componentes";

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
    {carregando ? <EstadoConsulta erro={erro} carregando recarregar={async () => setRevisao((r) => r + 1)} estrutura="cartoes" label="Carregando consumo nutricional…" /> : !erro && (itens.length ? <div className="pec-nutricao-animal-grade">{itens.map((i) => <section key={i.id} className={`pec-consumo-animal ${i.status === "ESTORNADO" ? "pec-consumo-animal-estornado" : ""}`}>
      <header><div><h3>{formatarDataBR(i.inicio)} – {formatarDataBR(i.fim)}</h3><p>{i.lote.nome} · {i.dias} dias · {i.dieta.nome} v{i.dieta.versao}</p></div><Pill tone={i.status === "CONFIRMADO" ? "green" : "amber"}>{i.status === "CONFIRMADO" ? "Confirmado" : "Estornado"}</Pill></header>
      <details className="pec-consumo-animal-corpo">
        <summary className="cursor-pointer py-2 text-sm font-semibold">Conferir ingredientes e origem{valores ? " · custos" : ""}</summary>
        {i.status === "ESTORNADO" && <p className="mb-3 text-xs text-ink-3">Estornado — fora do consumo atual</p>}
        {valores && <div className="pec-consumo-custo"><div>Custo conhecido<strong>{i.custoConhecido == null ? "Não apurado" : fmtMoneyExact(Number(i.custoConhecido))}</strong>{!i.coberturaCustoCompleta && <small>Cobertura incompleta</small>}</div>{i.custoConhecidoPorDia != null && <span>≈ {fmtMoneyExact(Number(i.custoConhecidoPorDia))}/animal-dia<br /><small>Sobre o custo conhecido</small></span>}</div>}
        <ul className="pec-consumo-ingredientes">{i.itens.map(item => <li key={item.produtoId}><span>{item.nome}{valores && <small>{item.custoConhecido == null ? "Custo não apurado" : fmtMoneyExact(Number(item.custoConhecido))}</small>}</span><span className="pec-quantidade"><strong>{quantidadeNutricional(item.quantidadeAtribuida)} {item.unidade}</strong><small>≈ {quantidadeNutricional(item.quantidadePorDia)} {item.unidade}/dia</small></span></li>)}</ul>
        <LinkNutricional className="pec-consumo-link nutricao-link" href={rotaNutricao({ fechamentoId: i.id })}>Abrir fechamento do lote <ChevronRight aria-hidden="true" size={14} /></LinkNutricional>
      </details>
    </section>)}</div> : <p className="text-sm">Ainda sem consumo conferido para este animal. <LinkNutricional href={rotaNutricao()}>Conferir consumo do lote</LinkNutricional>.</p>)}
    {!carregando && !erro && total > 25 && <div className="mt-3 flex flex-wrap items-center gap-3"><Button secondary disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><span>Página {pagina} · {total} fechamentos</span><Button secondary disabled={pagina * 25 >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div>}
  </CardFicha>;
}
