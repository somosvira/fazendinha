// Seção "Peso e ganho" da ficha do animal: indicadores de peso/GMD (com o seletor de
// período), o gráfico de evolução do peso e os cartões de pesagens
// (GMD desde a anterior, observação, editar/excluir).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AjudaCampo } from "@/components/Dica";
import { useEffect, useState, type ReactNode } from "react";
import { Info, Pencil, Scale, Trash2, Weight } from "lucide-react";
import { SeletorPeriodoGmd } from "./SeletorPeriodoGmd";
import { Paginacao, CardFicha } from "../ui";
import { GraficoPeso, ROTULO_TIPO_PESAGEM } from "./GraficoPeso";
import { formatarGmd, inicioJanelaGmd, pesoCompativelIndicador, rotuloContextoPeso, rotuloOrigemPesagem, rotuloPeriodoGmd, rotuloPrecisaoPeso } from "../lib/peso";
import { hoje } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import type { AnimalFicha, HistoricoPesagem, PeriodoGmd, Pesagem } from "../types";

const avisoDemonstracao = "Cenário sintético de desenvolvimento. Animais, doses, resultados e intervalos fictícios; não são recomendação clínica.";
function observacaoVisivel(texto: string | null | undefined) { return texto?.replaceAll(avisoDemonstracao, "").trim() ?? ""; }

/** GMD entre uma pesagem e a imediatamente anterior (lista mais recente primeiro) — usado só na
 *  campo "GMD desde a anterior" dos cartões; o cálculo de verdade (recente/período/entrada) vem do
 *  servidor em `animal.peso`. */
function gmdEntre(atual: HistoricoPesagem, anterior: HistoricoPesagem | undefined): string {
  if (!anterior || !pesoCompativelIndicador(atual) || !pesoCompativelIndicador(anterior)) return "—";
  const dias = (new Date(atual.data).getTime() - new Date(anterior.data).getTime()) / 86_400_000;
  if (dias <= 0) return "—";
  return formatarGmd((atual.pesoKg - anterior.pesoKg) / dias);
}

export function PesoEGanho({ animal, periodo, onPeriodoChange, podeLancar, onEditarPesagem, onExcluirPesagem, manejo }: {
  manejo?: ReactNode;
  animal: AnimalFicha;
  periodo: PeriodoGmd;
  onPeriodoChange: (periodo: PeriodoGmd) => void;
  podeLancar: boolean;
  onEditarPesagem: (pesagem: Pesagem) => void;
  onExcluirPesagem: (pesagem: Pesagem) => void;
}) {
  const { peso, historicoPesagens } = animal;
  // mesma janela do "GMD do período": conta para trás a partir de hoje, ou da baixa para quem saiu
  const limite = animal.baixa?.data?.slice(0, 10) ?? hoje();
  const desde = inicioJanelaGmd(periodo, limite);
  const detalhePeriodo = peso.gmdPeriodo.valor == null
    ? "Pesagens insuficientes"
    // `gmdPeriodo.dias` é o intervalo entre a 1ª e a última pesagem usadas, não a janela escolhida
    : `${peso.gmdPeriodo.pesagens} pesagens em ${peso.gmdPeriodo.dias ?? 0} dias · ${rotuloPeriodoGmd(periodo)}`;

  const mesmaBase = historicoPesagens.length === 2 && historicoPesagens.every(pesoCompativelIndicador) && peso.gmdPeriodo.pesagens === 2
    && peso.gmdPeriodo.valor != null && peso.gmdPeriodo.valor === peso.gmdRecente
    && peso.gmdRecente === peso.gmdDesdeEntrada;
  const datasDaBase = mesmaBase ? historicoPesagens.map(p => p.data).sort() : [];
  const [pagina, setPagina] = useState(1);
  const [pesagemAberta, setPesagemAberta] = useState<HistoricoPesagem | null>(null);
  useEffect(() => { setPagina(1); setPesagemAberta(null); }, [animal.id, historicoPesagens.length]);
  const totalPaginas = Math.max(1, Math.ceil(historicoPesagens.length / 5));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <div className="ficha-peso-conjunto space-y-4">
    <div className="ficha-gmd-cabecalho">
      <dl className="ficha-gmd-leitura">
        <div><dt>{mesmaBase ? "Ganho médio diário (GMD)" : "GMD do período"}</dt><dd><strong>{formatarGmd(peso.gmdPeriodo.valor)}</strong><small>{mesmaBase ? `2 pesagens · ${formatarDataBR(datasDaBase[0])} a ${formatarDataBR(datasDaBase[1])}` : detalhePeriodo}</small></dd></div>
        {!mesmaBase && <>
          <div><dt>GMD recente</dt><dd>{formatarGmd(peso.gmdRecente)}<AjudaCampo rotulo="Sobre o GMD recente" texto="Calculado entre as duas últimas pesagens compatíveis. Pesos estimados, informados e externos ficam fora do cálculo."/></dd></div>
          <div><dt>GMD desde a entrada</dt><dd>{formatarGmd(peso.gmdDesdeEntrada)}<AjudaCampo rotulo="Sobre o GMD desde a entrada" texto="Calculado entre a primeira e a última pesagem compatíveis. Pesos estimados, informados e externos ficam fora do cálculo."/></dd></div>
        </>}

      </dl>
      <SeletorPeriodoGmd id="periodo-gmd-animal" valor={periodo} onChange={onPeriodoChange}/>
      {mesmaBase && <details className="ficha-gmd-calculo"><summary>Como foi calculado</summary><p>O ganho médio diário considera a diferença de peso entre as pesagens de {formatarDataBR(datasDaBase[0])} e {formatarDataBR(datasDaBase[1])}, dividida pelo intervalo de {peso.gmdPeriodo.dias} dias.</p><p>Como há apenas duas pesagens, <span>GMD recente</span> e <span>GMD desde a entrada</span> usam esses mesmos registros.</p></details>}
    </div>
    <div className="ficha-peso-distribuicao">
      <CardFicha icon={Scale} titulo="Evolução do peso"><GraficoPeso historicoPesagens={historicoPesagens} desde={desde} ate={limite}/></CardFicha>
      <CardFicha icon={Weight} titulo="Últimas pesagens">
      {historicoPesagens.length ? <ul className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2" aria-label="Últimas pesagens">
        {historicoPesagens.slice((paginaAtual-1)*5,paginaAtual*5).map((pesagem, indice) => <li key={pesagem.id} className="min-w-0">
          <Card asChild className="h-full gap-0 p-4 shadow-none"><article aria-label={`Pesagem de ${formatarDataBR(pesagem.data)}`}>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <time dateTime={pesagem.data.slice(0, 10)} className="text-sm font-semibold tabular-nums">{formatarDataBR(pesagem.data)}</time>
              <Badge variant="secondary">{ROTULO_TIPO_PESAGEM[pesagem.tipo] ?? pesagem.tipo}</Badge>
            </header>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{pesagem.pesoKg.toLocaleString("pt-BR")} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">GMD desde a anterior</dt><dd className="whitespace-nowrap font-medium tabular-nums">{gmdEntre(pesagem, historicoPesagens[(paginaAtual-1)*5 + indice + 1])}</dd></div>
              {!pesoCompativelIndicador(pesagem) && <div className="flex flex-wrap items-center gap-2"><dt className="sr-only">Limites desta pesagem</dt><dd className="flex flex-wrap gap-2"><Badge variant="outline">{rotuloPrecisaoPeso(pesagem.precisao)}</Badge>{pesagem.contextoHistorico === "EXTERNO" && <Badge variant="outline">Externo</Badge>}</dd></div>}
            </dl>
            {observacaoVisivel(pesagem.observacao) && <p className="mt-3 border-t border-border pt-3 text-sm break-words">{observacaoVisivel(pesagem.observacao)}</p>}
            {pesagem.referenciaHistorica && <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">Reconciliação auditada para corrigir este registro histórico.</p>}
            <footer className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
              <Button variant="ghost" size="sm" aria-label={`Detalhes da pesagem de ${formatarDataBR(pesagem.data)}`} onClick={() => setPesagemAberta(pesagem)}><Info size={16} aria-hidden/>Detalhes</Button>
              {podeLancar && !pesagem.referenciaHistorica && <div className="flex gap-2">
              <Button variant="ghost" size="icon" aria-label={`Editar pesagem de ${formatarDataBR(pesagem.data)}`} onClick={() => onEditarPesagem({ id: pesagem.id, animalId: animal.id, data: pesagem.data, pesoKg: pesagem.pesoKg, tipo: pesagem.tipo as Pesagem["tipo"], origem: pesagem.origem as Pesagem["origem"], observacao: pesagem.observacao })}><Pencil size={16} /></Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={`Excluir pesagem de ${formatarDataBR(pesagem.data)}`} onClick={() => onExcluirPesagem({ id: pesagem.id, animalId: animal.id, data: pesagem.data, pesoKg: pesagem.pesoKg, tipo: pesagem.tipo as Pesagem["tipo"], origem: pesagem.origem as Pesagem["origem"] })}><Trash2 size={16} /></Button>
              </div>}
            </footer>
          </article></Card>
        </li>)}
      </ul> : <p className="text-sm text-ink-3">Nenhuma pesagem registrada.</p>}
      {historicoPesagens.length > 5 && <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={historicoPesagens.length} itensPorPagina={5} onPaginaChange={setPagina} rotulo="pesagens" idSelect="pagina-pesagens-animal"/>}
      </CardFicha>
    </div>
    {manejo}
    <Dialog open={!!pesagemAberta} onOpenChange={aberto => { if (!aberto) setPesagemAberta(null); }}>
      <DialogContent aria-describedby={undefined} className="max-w-xl">
        <DialogHeader><DialogTitle>Detalhes da pesagem</DialogTitle></DialogHeader>
        {pesagemAberta && <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-base">
          <div><dt className="text-muted-foreground">Data</dt><dd className="mt-1 font-semibold">{formatarDataBR(pesagemAberta.data)}</dd></div>
          <div><dt className="text-muted-foreground">Peso</dt><dd className="mt-1 font-semibold">{pesagemAberta.pesoKg.toLocaleString("pt-BR")} kg</dd></div>
          <div><dt className="text-muted-foreground">Origem</dt><dd className="mt-1">{rotuloOrigemPesagem(pesagemAberta.origem)}</dd></div>
          <div><dt className="text-muted-foreground">Tipo</dt><dd className="mt-1">{ROTULO_TIPO_PESAGEM[pesagemAberta.tipo] ?? pesagemAberta.tipo}</dd></div>
          <div><dt className="text-muted-foreground">Precisão</dt><dd className="mt-1">{rotuloPrecisaoPeso(pesagemAberta.precisao)}</dd></div>
          <div><dt className="text-muted-foreground">Contexto</dt><dd className="mt-1">{rotuloContextoPeso(pesagemAberta.contextoHistorico)}</dd></div>
          {pesagemAberta.referenciaHistorica && <div className="col-span-2"><dt className="text-muted-foreground">Referência histórica</dt><dd className="mt-1 break-words">{pesagemAberta.referenciaHistorica}</dd></div>}
        </dl>}
      </DialogContent>
    </Dialog>
  </div>;
}
