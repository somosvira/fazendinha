import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { Card } from "@/components/ui/card";
import { Milk } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CabecalhoTabela, TabelaFinanceira } from "@/financeiro/financeiro-ui";
import { DatePicker } from "@/components/DatePicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { obterConfiguracao } from "./api";
import { contextoParcelas } from "./parcelas-api";
import { ConfiguracoesOrdenha } from "./ConfiguracoesOrdenha";
import { ConfiguracaoTanques } from "./ConfiguracaoTanques";
import type { ContextoParcelas } from "./parcelas-types";
import type { ConfiguracaoOrdenha } from "./types";
import type { TanqueLeite } from "./tanques-types";
import { dataValida, hojeOperacional, formatarLitros } from "./modelo";
import { formatarDataBR } from "../lib/rotulos";

export function ConfiguracoesProducaoLeite({ podeLancar }: { podeLancar: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [data, setData] = useState(hojeOperacional);
  const [dados, setDados] = useState<ContextoParcelas | null>(null);
  const [historico, setHistorico] = useState<ConfiguracaoOrdenha[]>([]);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [config, setConfig] = useState(false);
  const [tanque, setTanque] = useState<TanqueLeite | null | undefined>();
  const [detalhe, setDetalhe] = useState<TanqueLeite | null>(null);
  useEffect(() => {
    const abrir = () => { const id = new URLSearchParams(location.search).get("tanqueId"); if (id && dados) setDetalhe(dados.tanques.find(t => t.id === id) ?? null); };
    abrir(); window.addEventListener("popstate", abrir); return () => window.removeEventListener("popstate", abrir);
  }, [dados]);

  useEffect(() => {
    if (sitio == null) return;
    let ativo = true;
    setDados(null); setErro("");
    void Promise.all([contextoParcelas(sitio, data), obterConfiguracao(data, sitio)]).then(([c, h]) => { if (ativo) { setDados(c); setHistorico(h.historico); } }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar as configurações."); });
    return () => { ativo = false; };
  }, [sitio, data, revisao]);
  if (sitio == null) return <p className="p-5">Selecione um sítio para consultar as configurações.</p>;
  const criterio = dados?.contexto?.criterioColostro ?? dados?.configuracao.criterioColostro;
  return <div className="leite-page leite-configuracoes-consulta">
    <CabecalhoTabela titulo="Rotina de produção" acao={<DatePicker aria-label="Data de referência da configuração" value={data} onChange={v => { if (dataValida(v)) setData(v); }} />} />
    {erro ? <div role="alert" className="p-5">{erro}<Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></div> : !dados ? <p role="status" className="p-5">Carregando configurações…</p> : <>
      <div className="p-5 grid gap-5">
        <div className="flex items-center flex-wrap gap-3"><h3 className="mr-auto">Produção · desde {formatarDataBR(dados.configuracao.vigenteDesde)}</h3>{podeLancar && <Button variant="outline" onClick={() => setConfig(true)}>Nova configuração</Button>}</div>
        <dl className="grid gap-4 leite-configuracao-fatos"><div><dt>Ordenhas do dia</dt><dd>{dados.configuracao.ordenhas.map(o => o.nome).join(" · ")}</dd></div><div><dt>Controle individual</dt><dd>A cada {dados.configuracao.intervaloIndividualQuantidade ?? 1} {dados.configuracao.intervaloIndividualUnidade === "DIAS" ? "dia(s)" : "mês(es)"} · Fonte {dados.configuracao.fonteProducao === "GERAL" ? "geral" : "individual"}</dd></div><div><dt>Critério de colostro</dt><dd>{criterio?.tipo === "PRIMEIRA_ORDENHA" ? "Primeira ordenha após o parto" : criterio?.tipo === "JANELA_DIAS" ? `Janela pós-parto de ${criterio.dias} dias, incluindo D0` : "Não informado"}</dd></div></dl>
      </div>
      <CabecalhoTabela titulo="Tanques e calibração" acao={podeLancar && <Button onClick={() => setTanque(null)}>Cadastrar tanque</Button>} />
      {!dados.tanques.length ? <p className="p-5">Nenhum tanque cadastrado.</p> : <ListaConsultaLeite preferencia="tanquesLeiteVisualizacao" layout="grade" renderizarVisual={t => <Card className="leite-card-visual leite-equipamento"><header><Milk size={20} aria-hidden/><h3>{t.nome}</h3></header><strong>{formatarLitros(t.capacidadeLitros)}</strong><span>Capacidade nominal</span><dl><div><dt>Modelo / série</dt><dd>{[t.modelo,t.numeroSerie].filter(Boolean).join(" · ") || "Não informado"}</dd></div><div><dt>Versão</dt><dd>v{t.versao} · {t.ativo ? "Ativo" : "Inativo"}</dd></div></dl><Button variant="outline" onClick={() => setDetalhe(t)}>Equipamento e tabela</Button></Card>} rotulo="Tanques cadastrados" itens={dados.tanques} chaveDe={t => t.id} onAbrir={setDetalhe} colunas={[
        { chave: "nome", titulo: "Tanque", principal: true, celula: t => t.nome },
        { chave: "capacidade", titulo: "Capacidade", alinhamento: "direita", celula: t => formatarLitros(t.capacidadeLitros) },
        { chave: "modelo", titulo: "Modelo / série", celula: t => [t.modelo, t.numeroSerie].filter(Boolean).join(" · ") || "Não informado" },
        { chave: "versao", titulo: "Versão", celula: t => `v${t.versao} · ${t.ativo ? "Ativo" : "Inativo"}` },
        { chave: "acoes", titulo: "Ação", acoes: true, celula: t => <Button variant="outline" onClick={() => setDetalhe(t)}>Equipamento e tabela</Button> },
      ]} />}
      <CabecalhoTabela titulo="Vigências anteriores" />
      {!historico.length ? <p className="p-5">Nenhuma configuração anterior.</p> : <TabelaFinanceira rotulo="Histórico das configurações" itens={historico} chaveDe={h => h.id ?? h.vigenteDesde} colunas={[
        { chave: "vigencia", titulo: "Vigência", principal: true, celula: h => formatarDataBR(h.vigenteDesde) },
        { chave: "ordenhas", titulo: "Ordenhas", celula: h => h.ordenhas.map(o => o.nome).join(" · ") },
        { chave: "fonte", titulo: "Fonte", celula: h => h.fonteProducao === "GERAL" ? "Geral" : "Individual" },
        { chave: "colostro", titulo: "Colostro", celula: h => h.criterioColostro?.tipo === "PRIMEIRA_ORDENHA" ? "Primeira ordenha" : h.criterioColostro?.tipo === "JANELA_DIAS" ? `${h.criterioColostro.dias} dias, incluindo D0` : "Não informado" },
      ]} />}
      {config && <ConfiguracoesOrdenha configuracao={dados.configuracao} data={data} aoFechar={() => setConfig(false)} aoSalvar={() => { setConfig(false); setRevisao(r => r + 1); }} />}
      {tanque !== undefined && <ConfiguracaoTanques sitio={sitio} data={data} tanque={tanque ?? undefined} aoFechar={() => setTanque(undefined)} aoSalvar={() => { setTanque(undefined); setRevisao(r => r + 1); }} />}
      <Dialog open={!!detalhe} onOpenChange={v => { if (!v) setDetalhe(null); }}><DialogContent className="max-w-3xl" aria-describedby={undefined}><DialogHeader><DialogTitle>{detalhe?.nome} · v{detalhe?.versao}</DialogTitle></DialogHeader>{detalhe && <div className="grid gap-4 max-h-[60vh] overflow-auto"><p>{formatarLitros(detalhe.capacidadeLitros)} · Vigência {formatarDataBR(detalhe.vigenteDesde)}</p><p>{[detalhe.fabricante, detalhe.modelo, detalhe.numeroSerie].filter(Boolean).join(" · ") || "Especificações adicionais não informadas"}</p><p>Referência: {detalhe.referenciaTabela || "Não informada"}</p>{detalhe.tabelaConversao.length ? <TabelaFinanceira rotulo="Tabela de calibração" itens={detalhe.tabelaConversao} chaveDe={p => String(p.mm)} colunas={[{ chave: "mm", titulo: "Régua (mm)", principal: true, celula: p => p.mm }, { chave: "litros", titulo: "Volume exato (L)", celula: p => p.litros }]} /> : <p>Nenhum ponto de calibração cadastrado.</p>}</div>}<DialogFooter><Button variant="outline" onClick={() => setDetalhe(null)}>Fechar</Button>{podeLancar && detalhe && <Button onClick={() => { setTanque(detalhe); setDetalhe(null); }}>Nova versão do tanque</Button>}</DialogFooter></DialogContent></Dialog>
    </>}
  </div>;
}
