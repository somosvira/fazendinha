import { useEffect, useState } from "react";
import { navegarPara } from "../../../router";
import { Wheat } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { ConsumoAnimalCard } from "./ConsumoAnimalCard";
import { SecaoFicha } from "../components/SecaoRecolhivel";
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
  return <SecaoFicha className="nutricao-animal lg:col-span-2" titulo={<span className="inline-flex items-center gap-3"><Wheat size={22} aria-hidden />Consumo atribuído ao animal</span>} resumo="Atribuído por permanência nos lotes, a partir dos consumos conferidos. Não mede a ingestão individual.">
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((r) => r + 1)}>Tentar novamente</Button>}
    {carregando ? <p>Carregando consumo…</p> : !erro && (itens.length ? <div className="space-y-3">{itens.map((item) => <ConsumoAnimalCard key={item.id} consumo={item} verValores={valores} />)}</div> : <div className="space-y-3" role="status"><h3 className="text-base font-semibold">Nenhum consumo atribuído a este animal</h3><p>Confira a dieta e os fornecimentos do lote no período de permanência do animal. A ausência de consumo conferido não comprova que o lote está sem dieta.</p><Button secondary onClick={() => navegarPara("/pecuaria/nutricao")}>Conferir nutrição do lote</Button></div>)}
    {!carregando && !erro && total > 25 && <div className="mt-3 flex flex-wrap items-center gap-3"><Button secondary disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><span>Página {pagina} · {total} fechamentos</span><Button secondary disabled={pagina * 25 >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div>}
  </SecaoFicha>;
}
