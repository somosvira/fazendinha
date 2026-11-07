import { useEffect, useState } from "react";
import { Button, ErrorBox, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { formatBRDateISO } from "../../../lib/hoje";
import { reqV4, type PainelReprodutivo } from "./api";
import { IdentificacaoReproducao, LinkReproducao } from "./ConsultaReproducaoUI";

/** Previsão pertence à gestação vigente; nunca deriva da data de um parto realizado. */
export function PartosPrevistos({ propriedadeId }: { propriedadeId: number }) {
  const [consulta, setConsulta] = useState<{ sitio: number; painel: PainelReprodutivo } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setErro(null); setCarregando(true);
    void reqV4<PainelReprodutivo>("/reproducao", undefined, "GET", propriedadeId)
      .then(painel => { if (ativo) setConsulta({sitio:propriedadeId,painel}); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar as previsões de parto."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [propriedadeId, revisao]);
  const animais = consulta?.sitio === propriedadeId ? (consulta.painel.animais ?? []).filter(a => a.situacao === "GESTANTE" && a.gestacao?.status === "VALIDO" && !a.gestacao.encerradaEm).sort((a,b) => (a.gestacao?.previsaoParto ?? "9999").localeCompare(b.gestacao?.previsaoParto ?? "9999") || a.brinco.localeCompare(b.brinco)) : [];
  return <Panel><section aria-label="Partos previstos"><header className="repro-consulta-titulo"><h2>Partos previstos</h2></header><ErrorBox erro={erro}/>{erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Consultar previsões novamente</Button>}{carregando ? <EsqueletoTabela label="Carregando previsões de parto"/> : !erro && <>{animais.length ? <TabelaFinanceira visualizacao="tabela" rotulo="Previsões de parto" itens={animais} chaveDe={a => a.animalId} colunas={[
    {chave:"matriz",titulo:"Matriz",principal:true,larguraFlexivel:true,larguraMinima:180,celula:a=><IdentificacaoReproducao id={a.animalId} brinco={a.brinco} nome={a.nome} sitio={propriedadeId}/>},
    {chave:"previsao",titulo:"Previsão de parto",larguraMinima:160,celula:a=>a.gestacao?.previsaoParto ? formatBRDateISO(a.gestacao.previsaoParto) : "Não informada"},
    {chave:"acao",titulo:"Ações",acoes:true,larguraMinima:150,celula:a=><LinkReproducao botao sitio={propriedadeId} href={`/pecuaria/rebanho/animais/${encodeURIComponent(a.animalId)}#reproducao`}>Ver gestação</LinkReproducao>},
  ]}/> : <p className="p-4 text-sm text-muted-foreground">Nenhuma gestação vigente no sítio consultado.</p>}</>}</section></Panel>;
}
