import { useEffect, useRef, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
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
  const [politicas, setPoliticas] = useState<PoliticaAcompanhamento[]>([]);
  const [tipos, setTipos] = useState<TipoExameAcompanhamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
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
    }).catch(e => { if (g === geracao.current) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { geracao.current++; };
  }, [propriedadeId]);

  async function salvar(input: RegistroPoliticaAcompanhamento) {
    const g = geracao.current;
    setErro(null);
    setMensagem("");
    setOcupado(true);
    try {
      await reqV4("/reproducao/acompanhamento/politicas", input, "POST", propriedadeId);
      const p = await reqV4<PoliticaAcompanhamento[]>("/reproducao/acompanhamento/politicas", undefined, "GET", propriedadeId);
      if (g === geracao.current) {
        setPoliticas(p);
        setMensagem("Versão registrada. Os fatos e demandas existentes foram preservados; a adoção em casos antigos exige conferência explícita.");
      }
    } catch (e) {
      if (g === geracao.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === geracao.current) setOcupado(false);
    }
  }

  return <section className="space-y-4 border-t pt-5">
    <h2 className="text-xl font-semibold">Diagnóstico e reconfirmações</h2>
    <p className="text-sm">Escolha os prazos com o responsável pelo manejo. As regras geram alertas e conservam sua versão em cada demanda. Não há prazo clínico padrão.</p>
    <ErrorBox erro={erro} />
    {mensagem && <p role="status">{mensagem}</p>}
    <FormularioAcompanhamento visivel={podeLancar} propriedadeId={propriedadeId} tipos={tipos} ocupado={ocupado} aoSalvar={salvar} aoErro={mensagemErro => { setErro(mensagemErro); setMensagem(""); }} />
    {politicas.map(p => <details key={p.id} className="rounded border p-3">
      <summary>Versão {p.versao} · vigente desde {formatBRDateISO(p.vigenteDesde)}</summary>
      <p>Diagnóstico: {p.parametros.diagnostico ? `${p.parametros.diagnostico.diasAposTentativa} dias após a tentativa` : "não configurado"}</p>
      {p.parametros.reconfirmacoes.map(r => <p key={r.ocorrencia}>Reconfirmação {r.ocorrencia}: {r.diasAposPrimeiroPositivo} dias desde o primeiro DG positivo{r.tipoExameId ? ` · exame configurado, versão ${r.tipoExameVersao}` : ""}</p>)}
    </details>)}
  </section>;
}
