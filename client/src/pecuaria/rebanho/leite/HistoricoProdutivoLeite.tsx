import { useEffect, useId, useState, type FormEvent } from "react";
import { Milk } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { dataHoraSanitaria, dataSanitaria } from "../sanidade/rotulos";
import { navegarPara } from "../../../router";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros, dataValida } from "./modelo";
import type { HistoricoProdutivo, ContextoCarenciaLeite } from "./historico-types";
import "./historico-produtivo.css";
function periodoInicial() { const fim = hojeOperacional(), inicio = new Date(`${fim}T00:00:00Z`); inicio.setUTCDate(inicio.getUTCDate() - 29); return { inicio: inicio.toISOString().slice(0, 10), fim }; }
function ContextoCarencia({ contexto, animalId }: { contexto: ContextoCarenciaLeite; animalId: string }) {
  let texto = "Contexto disponível em Sanidade, no sítio atual do animal.";
  if (contexto.disponibilidade === "DISPONIVEL") {
    const prazo = contexto.leite;
    texto = contexto.revisaoLeitePendente || contexto.revisaoAdministracaoPendente ? "Carência em revisão — confira os registros sanitários."
      : prazo.estado === "NAO_INFORMADO" ? "Carência não informada — confira os registros sanitários."
      : prazo.estado === "NENHUMA" ? "Sem aplicações válidas registradas até a data de referência."
      : prazo.estado === "NAO_APLICAVEL" ? "Não se aplica, conforme registro sanitário."
      : prazo.estado === "CONHECIDO" ? prazo.prazoZero ? "Prazo zero confirmado no registro sanitário."
      : `Prazo registrado até ${dataHoraSanitaria(prazo.ate)}${prazo.precisaoAproximada ? " (data aproximada)" : ""}.` : "Carência não informada.";
  }
  return <aside className="historico-produtivo-carencia" aria-label="Contexto de carência do leite">
    <div><h3>Carência do leite</h3><p className="text-sm text-ink-3">Referência em {dataSanitaria(contexto.dataReferencia)}</p></div>
    <p>{texto}</p>
    <p className="text-sm text-ink-3">O destino do leite é registrado separadamente. Este contexto não confirma descarte nem aptidão sanitária.</p>
    <Button secondary onClick={() => navegarPara(`/pecuaria/rebanho/animais/${animalId}#sanidade`)}>Conferir Sanidade</Button>
  </aside>;
}
export function HistoricoProdutivoLeite({ animalId, propriedadeId, recarregarToken = 0 }: { animalId: string; propriedadeId: number | null; recarregarToken?: number }) {
  const id = useId();
  const [periodo, setPeriodo] = useState(periodoInicial), [edicao, setEdicao] = useState(periodoInicial);
  const [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<HistoricoProdutivo | null>(null), [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(true);
  useEffect(() => { setPagina(1); setDados(null); }, [animalId, propriedadeId]);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null); setDados(null);
    consultarLeite<HistoricoProdutivo>(`/animais/${encodeURIComponent(animalId)}?${new URLSearchParams({ ...periodo, pagina: String(pagina), tamanho: "20" })}`, propriedadeId)
      .then(r => { if (vivo) setDados(r); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível consultar a produção"); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [animalId, propriedadeId, periodo, pagina, recarregarToken, revisao]);
  function consultar(event: FormEvent) {
    event.preventDefault();
    if (!dataValida(edicao.inicio) || !dataValida(edicao.fim) || edicao.inicio > edicao.fim) { setErro("Informe um período válido, com o fim posterior ao início."); return; }
    setPagina(1); setPeriodo({ ...edicao });
  }
  return <SecaoRecolhivel id="historico-produtivo-leite" className="historico-produtivo" titulo={<span className="ficha-titulo-com-icone"><Milk size={20} aria-hidden />Histórico produtivo</span>} resumo="Litros registrados por ordenha e dia, com a lactação conhecida em cada data.">
    <form onSubmit={consultar} className="historico-produtivo-filtros">
      <label htmlFor={`${id}-inicio`}>Produção desde<input id={`${id}-inicio`} className={classeInput} type="date" required max={hojeOperacional()} value={edicao.inicio} onChange={e => setEdicao(v => ({ ...v, inicio: e.target.value }))} /></label>
      <label htmlFor={`${id}-fim`}>Produção até<input id={`${id}-fim`} className={classeInput} type="date" required max={hojeOperacional()} value={edicao.fim} onChange={e => setEdicao(v => ({ ...v, fim: e.target.value }))} /></label>
      <Button type="submit" disabled={carregando}>Consultar período</Button>
    </form>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status">Consultando histórico produtivo…</p>}
    {!carregando && !erro && dados && <>
      <div className="historico-produtivo-resumo"><p><strong>{formatarLitros(dados.totaisPeriodo.litros)}</strong><br /><span className="text-sm text-ink-3">Litros registrados no período</span></p>
        <p>{dados.coberturaPeriodo.diasComRegistro} de {dados.coberturaPeriodo.diasCalendario} dias com participação registrada.<br /><span className="text-sm text-ink-3">Dias sem registro não foram preenchidos com zero.</span></p>
        {dados.totaisPeriodo.pendentes > 0 && <p role="status">Produção parcial: {dados.totaisPeriodo.pendentes} ordenha(s) aguardando medição.</p>}
      </div>
      {dados.itens.length ? <div className="historico-produtivo-tabela" role="region" aria-label="Produção diária com rolagem horizontal" tabIndex={0}>
        <table><caption className="sr-only">Produção diária do animal entre {dataSanitaria(dados.periodo.inicio)} e {dataSanitaria(dados.periodo.fim)}</caption>
          <thead><tr><th scope="col">Dia</th><th scope="col">Produção registrada</th><th scope="col">Finalidade na produção</th><th scope="col">Lactação e DEL</th><th scope="col">Ordenhas</th></tr></thead>
          <tbody>{dados.itens.map(d => <tr key={d.participanteId}>
            <td>{dataSanitaria(d.dataOperacional)}{d.excluidoEm && <p className="text-sm">Excluído dos totais{d.motivoExclusao ? ` · ${d.motivoExclusao}` : ""}</p>}</td>
            <td className="tabular-nums">{formatarLitros(d.totais.litros)}{!d.totais.completa && <p className="text-sm text-ink-3">Parcial</p>}</td>
            <td>{d.finalidade?.estado === "COMPROVADA" ? "Leite comprovada na data" : "Finalidade histórica a conciliar"}{d.finalidade?.estado !== "COMPROVADA" && <p className="text-sm text-ink-3">Litros registrados preservados; finalidade ainda não comprovada.</p>}</td>
            <td>{d.del === null ? "DEL não informado" : `${d.del} dias em lactação`}<p className="text-sm text-ink-3">{d.lactacao ? `Início em ${dataSanitaria(d.lactacao.inicio)}` : "Lactação não informada"}</p></td>
            <td><details><summary>Ver {d.medicoes.length} ordenha(s)</summary><ul>{d.medicoes.map(m => <li key={m.posicaoId}><strong>{m.nomeOrdenha}:</strong> {m.estado === "MEDIDO" ? formatarLitros(m.litros) : m.estado === "NAO_ORDENHADO" ? "Não ordenhado" : "Medição pendente"}{m.motivo ? ` · ${m.motivo}` : ""}</li>)}</ul></details></td>
          </tr>)}</tbody></table>
      </div> : <p role="status">Nenhum registro de produção neste período. A ausência de registros não confirma produção zero nem secagem.</p>}
      {dados.total > dados.tamanho && <nav aria-label="Páginas do histórico produtivo" className="historico-produtivo-paginas"><Button secondary disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button><span>Página {pagina} · {dados.total} registros</span><Button secondary disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina(p => p + 1)}>Próxima</Button></nav>}
      <p className="text-xs text-ink-3">DEL usa D0 no início da lactação e a data de cada registro. Lactação ausente permanece não informada.</p>
      <ContextoCarencia contexto={dados.carenciaLeite} animalId={animalId} />
    </>}
  </SecaoRecolhivel>;
}
