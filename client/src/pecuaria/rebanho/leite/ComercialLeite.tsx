import { CabecalhoTabela, TabelaFinanceira, Paginacao, Pill } from "../../../financeiro/financeiro-ui";
import { PeriodoFinanceiroControl } from "../../../financeiro/PeriodoFinanceiroControl";
import { DialogComercialLeite } from "./ComercialConsultaLeite";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import {
  obterConfiguracoesFinanceiras,
  type ConfiguracoesFinanceiras,
} from "../../../financeiro/novo-api";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { dataValida, formatarLitros, hojeOperacional } from "./modelo";
import {
  montarConferencia,
  nomeComponente,
  nomeSituacaoEntrega,
  type PaginaComercial,
  type EntregaComercial,
  type DemonstrativoComercial,
  type ConferenciaDraft,
} from "./comercial-types";
import { CamposConferenciaEntrega } from "./ConferenciaComercialLeite";
import { NovaEntregaComercialLeite } from "./NovaEntregaComercialLeite";
import { NovoDemonstrativoLeite } from "./NovoDemonstrativoLeite";
import { ComprovantesEntregaLeite } from "./ComprovantesEntregaLeite";
import "./operacoes.css";
const dataPt = (valor: string) =>
  valor.slice(0, 10).split("-").reverse().join("/");
const moeda = (valor: string) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function ComercialLeite({
  podeLancar,
  podeFinanceiro, contexto,
}: {
  podeLancar: boolean;
  podeFinanceiro: boolean;
  contexto?: { de: string; ate: string; parceiroId: string; parceiroNome: string };
}) {
  const sitio = getPropriedadeAtiva();
  const [de, setDe] = useState(() => contexto?.de ?? `${hojeOperacional().slice(0, 7)}-01`),
    [ate, setAte] = useState(() => contexto?.ate ?? hojeOperacional()),
    [pagina, setPagina] = useState(1),
    [paginaDoc, setPaginaDoc] = useState(1),
    [revisao, setRevisao] = useState(0),
    [resolvido, setResolvido] = useState<number | null>(sitio),
    [entregas, setEntregas] =
      useState<PaginaComercial<EntregaComercial> | null>(null),
    [docs, setDocs] = useState<PaginaComercial<DemonstrativoComercial> | null>(
      null,
    ),
    [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null),
    [erro, setErro] = useState(""),
    [erroDoc, setErroDoc] = useState(""),
    [erroConfig, setErroConfig] = useState(""),
    [carregando, setCarregando] = useState(false),
    [aviso, setAviso] = useState(""),
    [novaEntrega, setNovaEntrega] = useState(false),
    [novoDoc, setNovoDoc] = useState(false),
    [conferir, setConferir] = useState<EntregaComercial | null>(null),
    [anular, setAnular] = useState<DemonstrativoComercial | null>(null),
    [motivoAnulacao, setMotivoAnulacao] = useState(""),
    [anulando, setAnulando] = useState(false);
  const [detalheEntrega, setDetalheEntrega] = useState<EntregaComercial | null>(null), [detalheDoc, setDetalheDoc] = useState<DemonstrativoComercial | null>(null);
  const geracao = useRef(0),
    travaAnulacao = useRef(false);
  useEffect(() => {
    let atual = true;
    setConfig(null);
    setErroConfig("");
    if (podeFinanceiro)
      void obterConfiguracoesFinanceiras()
        .then((c) => {
          if (atual) setConfig(c);
        })
        .catch((e) => {
          if (atual)
            setErroConfig(
              e instanceof Error
                ? e.message
                : "Não foi possível consultar cadastros financeiros.",
            );
        });
    return () => {
      atual = false;
    };
  }, [podeFinanceiro, sitio, revisao]);
  useEffect(() => {
    const atual = ++geracao.current;
    setEntregas(null);
    setDocs(null);
    setErro("");
    setErroDoc("");
    if (!dataValida(de) || !dataValida(ate) || de > ate) {
      setErro("Informe um intervalo de datas válido.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const consulta = new URLSearchParams({ de, ate, pagina: String(pagina), ...(contexto ? { parceiroId: contexto.parceiroId } : {}) });
    const operacoes: Promise<unknown>[] = [
      consultarLeite<PaginaComercial<EntregaComercial>>(
        `/comercial/entregas?${consulta}`,
        sitio,
      )
        .then((r) => {
          if (atual === geracao.current) {
            setEntregas(r);
            setResolvido(r.propriedadeId);
          }
        })
        .catch((e) => {
          if (atual === geracao.current)
            setErro(
              e instanceof Error
                ? e.message
                : "Não foi possível consultar entregas.",
            );
        }),
    ];
    if (podeFinanceiro)
      operacoes.push(
        consultarLeite<PaginaComercial<DemonstrativoComercial>>(
          `/comercial/demonstrativos?${new URLSearchParams({ de, ate, pagina: String(paginaDoc), ...(contexto ? { parceiroId: contexto.parceiroId } : {}) })}`,
          sitio,
        )
          .then((r) => {
            if (atual === geracao.current) setDocs(r);
          })
          .catch((e) => {
            if (atual === geracao.current)
              setErroDoc(
                e instanceof Error
                  ? e.message
                  : "Não foi possível consultar demonstrativos.",
              );
          }),
      );
    void Promise.allSettled(operacoes).then(() => {
      if (atual === geracao.current) setCarregando(false);
    });
    return () => {
      geracao.current++;
    };
  }, [sitio, de, ate, pagina, paginaDoc, revisao, podeFinanceiro, contexto?.parceiroId]);
  useEffect(() => {
    setResolvido(sitio);
    setNovaEntrega(false);
    setNovoDoc(false);
    setConferir(null);
    setAnular(null);
    setAviso("");
    setDetalheEntrega(null); setDetalheDoc(null);
  }, [sitio]);
  function atualizar() {
    setRevisao((r) => r + 1);
  }
  function alterarPeriodo(campo: "de" | "ate", valor: string) {
    if (campo === "de") setDe(valor);
    else setAte(valor);
    setPagina(1);
    setPaginaDoc(1);
    setNovaEntrega(false);
    setNovoDoc(false);
    setConferir(null);
    setAnular(null);
    setDetalheEntrega(null); setDetalheDoc(null);
  }
  async function confirmarAnulacao() {
    if (!anular || travaAnulacao.current || !podeFinanceiro || !podeLancar)
      return;
    if (motivoAnulacao.trim().length < 5) {
      setErroDoc("Explique a anulação com ao menos 5 caracteres.");
      return;
    }
    const atual = geracao.current;
    travaAnulacao.current = true;
    setAnulando(true);
    try {
      await registrarLeite(
        `/comercial/demonstrativos/${anular.id}/anulacao`,
        anular.propriedadeId,
        { versaoEsperada: anular.versao, motivo: motivoAnulacao.trim() },
      );
      if (atual !== geracao.current) return;
      setAnular(null);
      setDetalheDoc(null);
      setAviso(
        "Demonstrativo anulado. Alocações liberadas e histórico preservado; estoque e caixa não foram alterados.",
      );
      atualizar();
    } catch (e) {
      if (atual === geracao.current)
        setErroDoc(
          e instanceof Error
            ? e.message
            : "Não foi possível anular o demonstrativo.",
        );
    } finally {
      travaAnulacao.current = false;
      setAnulando(false);
    }
  }
  return <section className="leite-operacoes leite-comercial-consulta" aria-label="Comercial do leite">
    <CabecalhoTabela titulo="Documentos comerciais" descricao={contexto?.parceiroNome} ajuda={contexto ? "Aceite, comprovantes e demonstrativos." : "Aceite, comprovantes e demonstrativos das entregas."} rotuloAjuda="Sobre os documentos comerciais" acao={<>{podeLancar && <Button disabled={resolvido === null || !entregas || carregando} onClick={() => setNovaEntrega(true)}>Registrar entrega</Button>}{podeLancar && podeFinanceiro && <Button disabled={!config || resolvido === null || !entregas || carregando} onClick={() => setNovoDoc(true)}>Registrar demonstrativo</Button>}</>} />
    <PeriodoFinanceiroControl inicio={de} fim={ate} label="Período das entregas e documentos" onChange={({inicio,fim}) => { alterarPeriodo("de", inicio); alterarPeriodo("ate", fim); }} />
    {carregando && <p role="status">Consultando documentos comerciais…</p>}{erro && <p role="alert">{erro}</p>}{erroConfig && podeFinanceiro && <p role="alert">{erroConfig}</p>}{aviso && <p role="status">{aviso}</p>}
    <CabecalhoTabela titulo="Entregas e conferências" />
    {entregas && <>
      <TabelaFinanceira rotulo="Histórico de entregas do sítio" itens={entregas.itens} chaveDe={e => e.id} colunas={[
        {chave:"entrega",titulo:"Entrega",principal:true,celula:e => <strong>{e.referencia}</strong>},
        {chave:"data",titulo:"Data",celula:e => dataPt(e.data)},
        {chave:"comprador",titulo:"Comprador",celula:e => e.parceiroNome ?? "Não informado"},
        {chave:"expedido",titulo:"Expedido",alinhamento:"direita",celula:e => formatarLitros(Number(e.expedidoLitros))},
        {chave:"aceito",titulo:"Aceito",alinhamento:"direita",celula:e => e.volumeAceito === null ? "Não informado" : formatarLitros(Number(e.volumeAceito))},
        {chave:"situacao",titulo:"Situação",celula:e => nomeSituacaoEntrega(e.situacao)},
        {chave:"acao",titulo:"Ações",acoes:true,celula:e => <><Button variant="outline" onClick={() => setDetalheEntrega(e)}>Ver entrega</Button>{podeLancar && Number(e.quantidadeFaturada) === 0 && <Button variant="outline" onClick={() => setConferir(e)}>Conferir {e.referencia}</Button>}</>},
      ]} />
      {!entregas.itens.length && <p>Nenhuma entrega registrada no período.</p>}
      <Paginacao pagina={pagina} totalPaginas={Math.max(1,Math.ceil(entregas.total/entregas.porPagina))} total={entregas.total} porPagina={entregas.porPagina} rotulo="Paginação de entregas" substantivo="entregas" idSelect="pagina-entregas-leite" onPagina={setPagina} />
    </>}
    {podeFinanceiro && <><CabecalhoTabela titulo="Demonstrativos do comprador" ajuda="Composição documental e alocações das entregas." rotuloAjuda="Sobre demonstrativos do comprador" />{erroDoc && <p role="alert">{erroDoc}</p>}{docs && <>
      <TabelaFinanceira rotulo="Demonstrativos e anulações preservados" itens={docs.itens} chaveDe={d => d.id} colunas={[
        {chave:"referencia",titulo:"Documento",principal:true,celula:d => <strong>{d.referencia}</strong>},
        {chave:"comprador",titulo:"Comprador",celula:d => config?.parceiros.find(p => p.id === d.parceiroId)?.nome ?? "Comprador do documento"},
        {chave:"periodo",titulo:"Período",celula:d => `${dataPt(d.inicio)} a ${dataPt(d.fim)}`},
        {chave:"litros",titulo:"Reconhecido",alinhamento:"direita",celula:d => formatarLitros(Number(d.volumeReconhecido))},
        {chave:"estado",titulo:"Situação",celula:d => <Pill tone={d.status === "ANULADO" ? "red" : "green"}>{d.status === "ANULADO" ? "Anulado" : "Válido"}</Pill>},
        {chave:"acao",titulo:"Ação",acoes:true,celula:d => <Button variant="outline" onClick={() => setDetalheDoc(d)}>Ver demonstrativo</Button>},
      ]} />
      {!docs.itens.length && <p>Nenhum demonstrativo registrado no período.</p>}
      <Paginacao pagina={paginaDoc} totalPaginas={Math.max(1,Math.ceil(docs.total/docs.porPagina))} total={docs.total} porPagina={docs.porPagina} rotulo="Paginação de demonstrativos" substantivo="demonstrativos" idSelect="pagina-docs-leite" onPagina={setPaginaDoc} />
    </>}</>}
    <DialogComercialLeite titulo="Registrar entrega" aberto={novaEntrega && podeLancar} onFechar={() => setNovaEntrega(false)}>{resolvido !== null && <NovaEntregaComercialLeite key={`${sitio}:${de}:${ate}`} sitio={resolvido} de={de} ate={ate} podeFinanceiro={podeFinanceiro} config={config} aoCancelar={() => setNovaEntrega(false)} aoSalvar={() => { setNovaEntrega(false); setAviso("Entrega registrada. O vínculo físico e comercial foi preservado sem duplicar a retirada."); atualizar(); }} />}</DialogComercialLeite>
    <DialogComercialLeite titulo="Registrar demonstrativo" aberto={novoDoc && podeLancar && podeFinanceiro} onFechar={() => setNovoDoc(false)}>{resolvido !== null && config && <NovoDemonstrativoLeite key={`${sitio}:${de}:${ate}`} sitio={resolvido} config={config} de={de} ate={ate} aoCancelar={() => setNovoDoc(false)} aoSalvar={() => { setNovoDoc(false); setAviso("Demonstrativo registrado sobre as entregas e vendas existentes, sem nova saída ou recebimento."); atualizar(); }} />}</DialogComercialLeite>
    <DialogComercialLeite titulo={`Conferir entrega ${conferir?.referencia ?? ""}`} aberto={!!conferir && podeLancar} onFechar={() => setConferir(null)}>{conferir && <ConferirEntrega key={`${conferir.id}:${conferir.versao}`} entrega={conferir} aoCancelar={() => setConferir(null)} aoSalvar={() => { setConferir(null); setDetalheEntrega(null); setAviso("Nova conferência registrada. Nenhum retorno ao estoque ou efeito financeiro foi presumido."); atualizar(); }} />}</DialogComercialLeite>
    <DialogComercialLeite titulo={detalheEntrega?.referencia ?? "Entrega"} aberto={!!detalheEntrega} onFechar={() => setDetalheEntrega(null)}>{detalheEntrega && <>
      <dl className="leite-comercial-fatos"><div><dt>Data e comprador</dt><dd>{dataPt(detalheEntrega.data)} · {detalheEntrega.parceiroNome ?? "Não informado"}</dd></div><div><dt>Venda</dt><dd>#{detalheEntrega.numeroOperacao}</dd></div><div><dt>Ponto de coleta</dt><dd>{detalheEntrega.pontoColeta ?? "Não informado"}</dd></div><div><dt>Horário</dt><dd>{detalheEntrega.horarioColeta ?? "Não informado"}</dd></div><div><dt>Já alocado</dt><dd>{formatarLitros(Number(detalheEntrega.quantidadeFaturada))}</dd></div>{podeFinanceiro && detalheEntrega.valorFaturado !== null && <div><dt>Valor alocado</dt><dd>{moeda(detalheEntrega.valorFaturado)}</dd></div>}</dl>
      <p>{detalheEntrega.motivo}</p>{detalheEntrega.destinacaoInformada && <p>Destinação informada: {detalheEntrega.destinacaoInformada}</p>}
      {Number(detalheEntrega.quantidadeFaturada) > 0 && <p>Anule os demonstrativos ativos no Financeiro antes de revisar o aceite ou a destinação.</p>}
      <h3>Histórico de conferências</h3>{detalheEntrega.historico.map(h => <p key={h.versao}>Versão {h.versao}: {nomeSituacaoEntrega(h.situacao)} · aceite {h.volumeAceito === null ? "desconhecido" : formatarLitros(Number(h.volumeAceito))}. {h.motivo}{h.destinacaoInformada ? ` · ${h.destinacaoInformada}` : ""}</p>)}
      <ComprovantesEntregaLeite entrega={detalheEntrega} sitio={detalheEntrega.propriedadeId} podeLancar={podeLancar} onMudou={() => { setDetalheEntrega(null); setAviso("Comprovante anexado à entrega."); atualizar(); }} />
      {podeFinanceiro && <Button variant="outline" asChild><a href={`/financeiro/operacoes/${detalheEntrega.operacaoId}`}>Abrir operação financeira #{detalheEntrega.numeroOperacao}</a></Button>}
    </>}</DialogComercialLeite>
    <DialogComercialLeite titulo={detalheDoc?.referencia ?? "Demonstrativo"} aberto={!!detalheDoc && podeFinanceiro} onFechar={() => setDetalheDoc(null)}>{detalheDoc && <>
      <dl className="leite-comercial-fatos"><div><dt>Volume reconhecido</dt><dd>{formatarLitros(Number(detalheDoc.volumeReconhecido))}</dd></div><div><dt>Preço-base</dt><dd>R$ {Number(detalheDoc.precoBase).toLocaleString("pt-BR",{minimumFractionDigits:4,maximumFractionDigits:4})}/L</dd></div><div><dt>Valor comercial</dt><dd>{moeda(detalheDoc.valorComercial)}</dd></div><div><dt>Pagamento informado</dt><dd>{detalheDoc.valorPagamentoInformado === null ? "Desconhecido" : moeda(detalheDoc.valorPagamentoInformado)}</dd></div></dl>
      <p>O pagamento informado no documento não confirma recebimento no Financeiro.</p>
      <h3>Composição</h3>{detalheDoc.componentes.length ? detalheDoc.componentes.map((c,i) => <p key={i}>{nomeComponente(c.natureza)}: {moeda(String(c.valor))} · {c.referencia}</p>) : <p>Sem componentes adicionais informados.</p>}
      <h3>Parcelas do demonstrativo</h3>{detalheDoc.alocacoes.map(a => <p key={a.id}>{entregas?.itens.find(e => e.id === a.entregaId)?.referencia ?? "Entrega vinculada"} · {formatarLitros(Number(a.quantidade))} · {moeda(a.valor)} · {a.ativo ? "ativa" : "preservada no histórico"}{a.motivoAceitePendente ? ` · Aceite pendente: ${a.motivoAceitePendente}` : ""}</p>)}
      {detalheDoc.motivoAnulacao && <p>Motivo da anulação: {detalheDoc.motivoAnulacao}</p>}
      {podeLancar && detalheDoc.status === "VALIDO" && <Button variant="outline" onClick={() => { setAnular(detalheDoc); setMotivoAnulacao(""); }}>Anular {detalheDoc.referencia}</Button>}
    </>}</DialogComercialLeite>
    <DialogComercialLeite titulo={`Anular demonstrativo ${anular?.referencia ?? ""}`} aberto={!!anular && podeLancar && podeFinanceiro} onFechar={() => { if (!anulando) setAnular(null); }}>{anular && <form onSubmit={e => { e.preventDefault(); void confirmarAnulacao(); }}><fieldset disabled={anulando}><legend>Anular demonstrativo {anular.referencia}</legend><p>A anulação libera suas alocações e preserva o histórico. Não devolve leite ao estoque nem movimenta caixa.</p><label>Motivo da anulação<textarea required minLength={5} maxLength={1000} value={motivoAnulacao} onChange={e => setMotivoAnulacao(e.target.value)} /></label>{erroDoc && <p role="alert">{erroDoc}</p>}<div className="leite-comercial-acoes"><Button variant="outline" type="button" onClick={() => setAnular(null)}>Cancelar anulação</Button><Button>{anulando ? "Anulando…" : "Confirmar anulação do demonstrativo"}</Button></div></fieldset></form>}</DialogComercialLeite>
  </section>;
}

function ConferirEntrega({
  entrega,
  aoSalvar,
  aoCancelar,
}: {
  entrega: EntregaComercial;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [valor, setValor] = useState<ConferenciaDraft>({
    situacao: entrega.situacao,
    aceito: entrega.volumeAceito ?? "",
    motivo: "",
    destinacao: entrega.destinacaoInformada ?? "",
  });
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const vivo = useRef(true),
    trava = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  async function salvar() {
    if (trava.current) return;
    setErro("");
    try {
      const payload = {
        versaoEsperada: entrega.versao,
        ...montarConferencia(valor),
      };
      trava.current = true;
      setOcupado(true);
      await registrarLeite(
        `/comercial/entregas/${entrega.id}/conferencias`,
        entrega.propriedadeId,
        payload,
      );
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar a conferência.",
        );
    } finally {
      trava.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={ocupado}>
        <legend>Conferir entrega {entrega.referencia}</legend>
        <p>
          Expedido: {formatarLitros(Number(entrega.expedidoLitros))}. Cada
          correção conserva as conferências anteriores.
        </p>
        <CamposConferenciaEntrega valor={valor} onChange={setValor} />
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <Button variant="outline" type="button"
            className="leite-secondary"
            onClick={aoCancelar}>
            Cancelar conferência
          </Button>
          <Button >
            {ocupado ? "Registrando…" : "Confirmar conferência da entrega"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
