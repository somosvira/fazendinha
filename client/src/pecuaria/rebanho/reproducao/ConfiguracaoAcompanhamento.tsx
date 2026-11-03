import { AjudaCampo } from "../../../components/Dica";
import { useEffect, useRef, useState } from "react";
import { ModalPolitica } from "./ModalPolitica";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { reqV4 } from "./api";
import { FormularioAcompanhamento, type RegistroPoliticaAcompanhamento, type TipoExameAcompanhamento } from "./FormularioAcompanhamento";

type Regra = { tipoExameId?: string; tipoExameVersao?: number };
export type PoliticaAcompanhamento = {
  id: string;
  versao: number;
  vigenteDesde: string;
  parametros: {
    versao: 1;
    efeito: "ALERTA";
    diagnostico: (Regra & { diasAposTentativa: number }) | null;
    reconfirmacoes: Array<Regra & { ocorrencia: number; diasAposPrimeiroPositivo: number }>;
  };
};
type Props = { propriedadeId: number; podeLancar: boolean };

export function ConfiguracaoAcompanhamento(props: Props) {
  return <ConteudoConfiguracaoAcompanhamento key={props.propriedadeId} {...props} />;
}

function ConteudoConfiguracaoAcompanhamento({ propriedadeId, podeLancar }: Props) {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [politicas, setPoliticas] = useState<PoliticaAcompanhamento[]>([]);
  const [tipos, setTipos] = useState<TipoExameAcompanhamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const geracao = useRef(0);

  useEffect(() => {
    const g = ++geracao.current;
    void Promise.all([
      reqV4<PoliticaAcompanhamento[]>("/reproducao/acompanhamento/politicas", undefined, "GET", propriedadeId),
      reqV4<TipoExameAcompanhamento[]>("/reproducao/tipos-exame", undefined, "GET", propriedadeId),
    ]).then(([p, t]) => {
      if (g === geracao.current) {
        setPoliticas(p);
        setTipos(t.filter(x => x.ativo && x.contexto !== "SANITARIO"));
      }
    }).catch(e => { if (g === geracao.current) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (g === geracao.current) setCarregando(false); });
    return () => { geracao.current++; };
  }, [propriedadeId]);

  async function salvar(input: RegistroPoliticaAcompanhamento) {
    if (ocupado) return;
    const g = geracao.current;
    setErro(null);
    setMensagem("");
    setOcupado(true);
    try {
      await reqV4("/reproducao/acompanhamento/politicas", input, "POST", propriedadeId);
      const p = await reqV4<PoliticaAcompanhamento[]>("/reproducao/acompanhamento/politicas", undefined, "GET", propriedadeId);
      if (g === geracao.current) {
        setPoliticas(p);
        setFormularioAberto(false);
        setAlterado(false);
        setMensagem("Versão registrada. Os fatos e demandas existentes foram preservados; a adoção em casos antigos exige conferência explícita.");
      }
    } catch (e) {
      if (g === geracao.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === geracao.current) setOcupado(false);
    }
  }

  const vigente = [...politicas].filter(p => p.vigenteDesde.slice(0, 10) <= getHojeISO()).sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao)[0];
  const ordenadas = [...politicas].sort((a, b) => Number(b.id === vigente?.id) - Number(a.id === vigente?.id) || b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao);
  return <section className="space-y-4 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-semibold">Diagnóstico e reconfirmações <AjudaCampo rotulo="Ajuda sobre prazos de acompanhamento" texto="Escolha os prazos com o responsável pelo manejo. As regras geram alertas e conservam sua versão em cada demanda. Não há prazo clínico padrão."/></h2>
    {podeLancar && <Button type="button" variant="outline" onClick={() => setFormularioAberto(true)}>Nova versão de acompanhamento</Button>}
    </div>
    {!formularioAberto && <ErrorBox erro={erro} />}
    {carregando && <p role="status">Carregando políticas…</p>}
    {!carregando && !erro && !politicas.length && <p>Nenhuma política registrada neste sítio.</p>}
    {mensagem && <p role="status">{mensagem}</p>}

    {ordenadas.map(p => <details key={p.id} open={p.id === vigente?.id} className="rounded border border-border bg-card p-3">
      <summary>{p.id === vigente?.id && "Política vigente · "}Versão {p.versao} · vigente desde {formatBRDateISO(p.vigenteDesde)}</summary>
      <p>Diagnóstico: {p.parametros.diagnostico ? `${p.parametros.diagnostico.diasAposTentativa} dias após a tentativa` : "não configurado"}</p>
      {p.parametros.reconfirmacoes.map(r => <p key={r.ocorrencia}>Reconfirmação {r.ocorrencia}: {r.diasAposPrimeiroPositivo} dias desde o primeiro DG positivo{r.tipoExameId ? ` · exame configurado, versão ${r.tipoExameVersao}` : ""}</p>)}
    </details>)}
    {podeLancar && formularioAberto && <ModalPolitica aberto titulo="Nova versão de acompanhamento" bloqueado={ocupado} alteracoesExternas={alterado} onFechar={() => { setFormularioAberto(false); setAlterado(false); setErro(null); }} rodape={fechar => <><Button type="button" variant="outline" onClick={fechar} disabled={ocupado}>Cancelar</Button><Button type="submit" form="nova-politica-acompanhamento" disabled={ocupado || carregando}>{ocupado ? "Registrando…" : "Registrar nova versão"}</Button></>}>
      <ErrorBox erro={erro}/>
      <FormularioAcompanhamento visivel propriedadeId={propriedadeId} tipos={tipos} ocupado={ocupado} aoSalvar={salvar} aoAlterar={() => setAlterado(true)} aoErro={mensagemErro => { setErro(mensagemErro); setMensagem(""); }} />
    </ModalPolitica>}
  </section>;
}
