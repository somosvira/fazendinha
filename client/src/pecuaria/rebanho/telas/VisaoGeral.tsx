// Visão geral do Rebanho — GET /pecuaria/rebanho/painel. Métricas, "Por
// categoria"/"Por sítio" (listas divide-y com barra proporcional) e "Últimos
// cadastros e saídas", no padrão de VisaoGeralFinanceira.tsx.

import { useEffect, useState } from "react";
import { ChevronRight, MapPin, Plus, TrendingDown, Users } from "lucide-react";
import { obterPainelRebanho } from "../api";
import type { PainelGeral } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { navegarPara } from "../../../router";
import { Button, Empty, ErrorBox, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel } from "../../../financeiro/financeiro-ui";
import { NavRebanho } from "./NavRebanho";

const URL_ANIMAIS = "/pecuaria/rebanho/animais";
const URL_NOVO_ANIMAL = "/pecuaria/rebanho/animais/novo";

const ROTULO_EVENTO: Record<string, string> = { CADASTRO: "Cadastro", SAIDA: "Saída", ESTORNO: "Estorno de saída" };

function BarraProporcional({ valor, maximo }: { valor: number; maximo: number }) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-mast" style={{ width: `${pct}%` }} /></div>;
}

export function VisaoGeral({ podeLancar = true }: { podeLancar?: boolean }) {
  const [painel, setPainel] = useState<PainelGeral | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vigente = true;
    obterPainelRebanho()
      .then((dados) => { if (vigente) setPainel(dados); })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, []);

  if (carregando) return <PaginaCarregando label="Carregando painel do rebanho" />;

  const maxCategoria = painel ? Math.max(1, ...painel.porCategoria.map((c) => c.qtd)) : 1;
  const maxSitio = painel ? Math.max(1, ...painel.porSitio.map((s) => s.qtd)) : 1;

  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Rebanho" descricao="Efetivo, receptoras, sítios e últimos eventos do rebanho." acao={podeLancar ? <Button onClick={() => navegarPara(URL_NOVO_ANIMAL)}><Plus size={16} /> Novo animal</Button> : undefined} />
    <NavRebanho ativa="visao-geral" />
    <ErrorBox erro={erro} />
    {painel && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Animais ativos" valor={painel.ativos.toLocaleString("pt-BR")} detalhe="Efetivo atual do rebanho" icon={Users} />
        <Metric label="Receptoras" valor={`${painel.receptorasPct.toLocaleString("pt-BR")}%`} detalhe="Das fêmeas ativas" icon={Users} />
        <Metric label="Sítios com animais" valor={String(painel.porSitio.length)} detalhe="Sítios com pelo menos um animal ativo" icon={MapPin} />
        <Metric label="Saídas em 30 dias" valor={String(painel.saidas30d)} detalhe="Vendas, abates, mortes e demais saídas" icon={TrendingDown} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Por categoria</h2></div>
          {painel.porCategoria.length ? <div className="divide-y divide-border">{painel.porCategoria.map((c) => <div key={c.categoriaId ?? "sem-categoria"} className="px-5 py-4"><div className="flex items-center justify-between gap-3 text-sm"><span>{c.categoria}</span><strong>{c.qtd}</strong></div><BarraProporcional valor={c.qtd} maximo={maxCategoria} /></div>)}</div> : <Empty>Nenhum animal ativo.</Empty>}
        </Panel>
        <Panel className="overflow-hidden">
          <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Por sítio</h2></div>
          {painel.porSitio.length ? <div className="divide-y divide-border">{painel.porSitio.map((s) => <div key={s.propriedadeId ?? "sem-sitio"} className="px-5 py-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words">{s.nome}</span><strong>{s.qtd}</strong></div><BarraProporcional valor={s.qtd} maximo={maxSitio} /></div>)}</div> : <Empty>Nenhum animal ativo.</Empty>}
        </Panel>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5"><h2 className="font-serif text-xl">Últimos cadastros e saídas</h2><button onClick={() => navegarPara(URL_ANIMAIS)} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver todos <ChevronRight size={15} /></button></div>
        {painel.ultimosEventos.length ? <div className="divide-y divide-border">{painel.ultimosEventos.map((evento, indice) => <button key={`${evento.animalId}-${indice}`} onClick={() => navegarPara(`${URL_ANIMAIS}/${evento.animalId}`)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-2"><div className="min-w-0"><strong className="break-words">{evento.brinco}</strong><div className="mt-1 text-xs text-ink-3">{ROTULO_EVENTO[evento.tipo] ?? evento.tipo}</div></div><span className="shrink-0 text-xs text-ink-3">{formatarDataBR(evento.data)}</span></button>)}</div> : <Empty>Nenhum evento recente.</Empty>}
      </Panel>
    </>}
  </PaginaFinanceira>;
}
