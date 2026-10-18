import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { urlConsultaComSitio } from "./contexto-consulta";
import { listarPoliticas, type PoliticaElegibilidade } from "./elegibilidade-api";

type ConsultaPolitica = { sitioId: number; politicas: PoliticaElegibilidade[] | null; erro: string | null };
export function ResumoPoliticaReprodutiva({ propriedadeId }: { propriedadeId: number }) {
  const [consulta, setConsulta] = useState<ConsultaPolitica>({ sitioId: propriedadeId, politicas: null, erro: null });
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setConsulta({ sitioId: propriedadeId, politicas: null, erro: null });
    void listarPoliticas(propriedadeId)
      .then(politicas => { if (ativo) setConsulta({ sitioId: propriedadeId, politicas, erro: null }); })
      .catch(e => { if (ativo) setConsulta({ sitioId: propriedadeId, politicas: null, erro: e instanceof Error ? e.message : "Não foi possível consultar a política." }); });
    return () => { ativo = false; };
  }, [propriedadeId, revisao]);
  const politicas = consulta.sitioId === propriedadeId ? consulta.politicas : null;
  const erro = consulta.sitioId === propriedadeId ? consulta.erro : null;
  const vigente = politicas?.filter(p => p.vigenteDesde.slice(0, 10) <= getHojeISO()).sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao)[0];
  const destino = urlConsultaComSitio("/configuracoes/pecuaria/reproducao/politica", propriedadeId);
  return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
    <div className="min-w-0 flex-1 space-y-1"><h2 className="text-sm font-semibold">Política reprodutiva vigente</h2>
      <ErrorBox erro={erro}/>
      {erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
      {!erro && politicas === null && <p role="status" className="text-sm text-muted-foreground">Carregando política…</p>}
      {!erro && politicas !== null && (vigente ? <p className="text-sm text-muted-foreground">Versão {vigente.versao} · desde {formatBRDateISO(vigente.vigenteDesde)} · PEV: {vigente.parametros.pevPrimiparasDias} dias após primeiro parto e {vigente.parametros.pevMultiparasDias} dias após demais partos.</p> : <p className="text-sm text-muted-foreground">Nenhuma política vigente neste sítio. A elegibilidade permanece pendente quando não há regra comprovada.</p>)}
    </div>
    <a className="inline-flex min-h-10 items-center text-sm font-semibold underline underline-offset-4" href={destino}
      onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navegarPara(destino); }}>Gerenciar política</a>
  </div>;
}
