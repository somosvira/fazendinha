import { useCallback, useEffect, useRef, useState } from "react";
import { DateRangePicker, formatRangeLabel, isoDate, type DateRange } from "../../../components/DateRangePicker";
import { getHoje } from "../../../lib/hoje";
import { descricaoCusto, ultimosDozeMeses } from "./apresentacao";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { getUsuario } from "../../../lib/auth";
import { temAcessoArea } from "../../../lib/areas";
import { obterCustos, type CustosDTO, type EscopoCustos, type Componente } from "./api";
import { ResumoCustosDiretos } from "./ResumoCustosDiretos";
import { EditorClassificacaoCusto } from "./EditorClassificacaoCusto";
import { VinculosPreparatorios } from "./VinculosPreparatorios";
import { Button } from "../../../financeiro/financeiro-ui";

type Props = { fatoEmConsulta?: Pick<Componente, "tipoFonte" | "fonteId">; linksJaExibidos?: readonly string[]; mostrarTitulo?: boolean; propriedadeId: number; podeLancar: boolean; finalidadeInicial?: "REPRODUCAO" | "SANIDADE" | "ROTINA" } & EscopoCustos;

export function CustosDiretos(props: Props) {
  // Uma nova identidade inicia filtros e rascunhos próprios, sem herdar o sítio anterior.
  const chave = JSON.stringify([props.propriedadeId, props.animalId, props.tentativaId, props.participacaoId, props.aplicacaoId, props.exameId, props.manejoId, props.programacaoId, props.finalidadeInicial]);
  return <ComposicaoCustos key={chave} {...props} />;
}

function ComposicaoCustos({ propriedadeId, podeLancar, finalidadeInicial, mostrarTitulo = true, fatoEmConsulta, linksJaExibidos, ...escopo }: Props) {
  const [resposta, setResposta] = useState<CustosDTO | null>(null);
  const [respostaIdentidade, setRespostaIdentidade] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<DateRange>(() => escopo.animalId ? ultimosDozeMeses(getHoje()) : { start: null, end: null });
  const [atalho, setAtalho] = useState(escopo.animalId ? "12m" : "todos");
  const [erroPeriodo, setErroPeriodo] = useState("");
  const inicio = periodo.start ? isoDate(periodo.start) : "";
  const fim = periodo.end ? isoDate(periodo.end) : "";
  const [finalidade, setFinalidade] = useState<string>(finalidadeInicial ?? "");
  const [pagina, setPagina] = useState(1);
  const [fontesPagina,setFontesPagina]=useState(1);
  const [preparosPagina,setPreparosPagina]=useState(1);
  const [atualizacao, setAtualizacao] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const usuario = getUsuario();
  const podeEditar = podeLancar && !!usuario && temAcessoArea(usuario.areas, "financeiro", !!usuario.dono) && (!!usuario.dono || usuario.flags.includes("verValores"));
  const { animalId, tentativaId, participacaoId, aplicacaoId, exameId, manejoId, programacaoId } = escopo;
  const identidade = JSON.stringify([propriedadeId, animalId, tentativaId, participacaoId, aplicacaoId, exameId, manejoId, programacaoId]);
  const contextoAtual = useRef({ identidade });
  if (contextoAtual.current.identidade !== identidade) contextoAtual.current = { identidade };
  const contexto = contextoAtual.current;
  const sequencia = useRef(0);
  const consulta = JSON.stringify([identidade, inicio, fim, pagina, finalidade,fontesPagina,preparosPagina]);
  const bruto = respostaIdentidade === consulta ? resposta : null;
  const dados = bruto ? { ...bruto, componentes: bruto.componentes.map(c => ({ ...c, descricao: descricaoCusto(c.descricao) })), fontes: bruto.fontes.map(f => ({ ...f, descricao: descricaoCusto(f.descricao) })), atribuicoesPreparos: bruto.atribuicoesPreparos.map(a => ({ ...a, descricao: descricaoCusto(a.descricao) })) } : null;

  const carregar = useCallback(async () => {
    const pedido = ++sequencia.current;
    setCarregando(true);
    setResposta(null);
    setErro("");
    try {
      const r = await obterCustos({ animalId, tentativaId, participacaoId, aplicacaoId, exameId, manejoId, programacaoId }, propriedadeId, inicio, fim, pagina, finalidade,fontesPagina,preparosPagina);
      if (contexto === contextoAtual.current && pedido === sequencia.current) {
        setResposta(r);
        setRespostaIdentidade(consulta);
        setErro("");
      }
    } catch (e) {
      if (contexto === contextoAtual.current && pedido === sequencia.current) {
        setResposta(null);
        setErro(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (contexto === contextoAtual.current && pedido === sequencia.current) setCarregando(false);
    }
  }, [animalId, tentativaId, participacaoId, aplicacaoId, exameId, manejoId, programacaoId, propriedadeId, inicio, fim, pagina, finalidade,fontesPagina,preparosPagina, contexto, consulta]);

  useEffect(() => { void carregar(); return () => { sequencia.current += 1; }; }, [carregar, atualizacao]);
  useEffect(() => {
    setFontesPagina(1);setPreparosPagina(1);setMotivo(""); setErro(""); setOcupado(false); setPagina(1); setChave(crypto.randomUUID());
  }, [identidade]);

  const alterar = () => setChave(crypto.randomUUID());
  async function gravar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await acao();
      if (contexto === contextoAtual.current) {
        setAtualizacao(v => v + 1);
        setChave(crypto.randomUUID());
      }
    } catch (e) {
      if (contexto === contextoAtual.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (contexto === contextoAtual.current) setOcupado(false);
    }
  }

  function mudarPeriodo(range: DateRange) {
    if (!range.start || !range.end || !Number.isFinite(range.start.getTime()) || !Number.isFinite(range.end.getTime()) || range.start > range.end) {
      setErroPeriodo("Informe um período válido, com fim igual ou posterior ao início.");
      return;
    }
    setErroPeriodo(""); setPeriodo(range); setAtalho("personalizado"); setPagina(1);
  }
  const visivel = !!dados && !carregando;
  return <section className={mostrarTitulo ? "space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" : "space-y-4"} aria-label="Composição dos custos diretos">
    {mostrarTitulo && <h3 className="text-lg font-semibold">Custos diretos</h3>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-56 text-sm">Período<select className={classeInput} value={atalho} onChange={e => {
        setAtalho(e.target.value); setErroPeriodo(""); setPagina(1);
        if (e.target.value === "12m") setPeriodo(ultimosDozeMeses(getHoje()));
        if (e.target.value === "todos") setPeriodo({ start: null, end: null });
      }}>
        <option value="12m">Últimos 12 meses</option><option value="todos">Todo o período</option><option value="personalizado" disabled>Personalizado</option>
      </select></label>
      <label className="min-w-48 text-sm">Finalidade do custo<select className={classeInput} value={finalidade} onChange={e => { setFinalidade(e.target.value); setPagina(1); }}>
        <option value="">Todas as finalidades</option><option value="REPRODUCAO">Reprodução</option><option value="SANIDADE">Sanidade</option><option value="ROTINA">Rotina/manutenção</option><option value="SEM_CLASSIFICACAO">Sem classificação</option>
      </select></label>
      <DateRangePicker value={periodo} onChange={mudarPeriodo} showPresets={false} triggerAriaLabel="Personalizar período dos custos" triggerLabel={<>Personalizar período{periodo.start && periodo.end ? ` · ${formatRangeLabel(periodo)}` : ""}</>} />
    </div>
    {erroPeriodo && <p role="alert" className="text-destructive">{erroPeriodo}</p>}
    {carregando && <p role="status">Consultando custos…</p>}
    {erro && <div role="alert" className="flex flex-wrap items-center gap-3 text-destructive"><p>{erro}</p><Button secondary disabled={carregando} onClick={() => void carregar()}>Tentar novamente</Button></div>}
    {dados && visivel && <ResumoCustosDiretos fatoEmConsulta={fatoEmConsulta} linksJaExibidos={linksJaExibidos} dados={dados} propriedadeId={propriedadeId} porAnimal={!!animalId} tentativaId={tentativaId} comRecorte={!!(inicio || fim || finalidade)} pagina={pagina} aoMudarPagina={setPagina} aoMudarPaginaPreparos={setPreparosPagina} />}
    {/* Os editores conservam rascunhos durante a recarga e reiniciam ao trocar o alvo/sítio. */}
    <EditorClassificacaoCusto key={`classificacao:${identidade}`} dados={dados} aoMudarPagina={setFontesPagina} visivel={visivel && podeEditar} propriedadeId={propriedadeId} chave={chave} ocupado={ocupado} motivo={motivo} aoMudarMotivo={setMotivo} aoAlterar={alterar} gravar={gravar} />
    {tentativaId && <VinculosPreparatorios key={`preparatorios:${identidade}`} dados={dados} aoMudarPaginaVinculos={setPreparosPagina} visivel={visivel && podeEditar} propriedadeId={propriedadeId} tentativaId={tentativaId} chave={chave} ocupado={ocupado} motivo={motivo} aoMudarMotivo={setMotivo} aoAlterar={alterar} aoErro={setErro} gravar={gravar} />}
  </section>;
}
