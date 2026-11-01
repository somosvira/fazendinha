import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { obterReproducao, type PainelReprodutivo } from "./api";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import "./reproducao-individual.css";

export type LactacaoIndividualProps = {
  animalId: string; propriedadeId?: number | null; podeLancar: boolean;
  recarregarToken?: number; onMudou?: () => void;
};

/** A leitura e os formulários seguem o mesmo núcleo da lactação reprodutiva. */
export function LactacaoIndividual(props: LactacaoIndividualProps) {
  return <ConteudoLactacao key={`${props.animalId}:${props.propriedadeId ?? "consolidado"}`} {...props}/>;
}
function ConteudoLactacao({ animalId, propriedadeId, podeLancar, recarregarToken = 0, onMudou }: LactacaoIndividualProps) {
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const geracao = useRef(0);
  const carregar = useCallback(async () => {
    const pedido = ++geracao.current;
    setErro(null); setCarregando(true);
    try { const dados = await obterReproducao(animalId, propriedadeId ?? undefined); if (pedido === geracao.current) setPainel(dados); }
    catch (e) { if (pedido === geracao.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (pedido === geracao.current) setCarregando(false); }
  }, [animalId, propriedadeId]);
  useEffect(() => { void carregar(); return () => { geracao.current++; }; }, [carregar, recarregarToken]);
  return <div className="repro-individual lactacao-individual"><ErrorBox erro={erro}/>
    {erro && <Button variant="outline" onClick={() => void carregar()}>Tentar carregar lactação novamente</Button>}
    {carregando && <p role="status">Carregando lactação…</p>}
    {painel && <AcoesReprodutivas modo="lactacao" painel={painel} animalId={animalId} propriedadeId={propriedadeId ?? undefined} podeLancar={podeLancar} onMudou={async () => { await carregar(); onMudou?.(); }}/>}
  </div>;
}
