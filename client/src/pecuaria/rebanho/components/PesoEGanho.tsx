// Seção "Peso e ganho" da ficha do animal: indicadores de peso/GMD (com o seletor de
// período), o gráfico de evolução do peso e a tabela de pesagens já existente
// (GMD desde a anterior, observação, editar/excluir).

import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Scale, Trash2, Weight } from "lucide-react";
import { SeletorPeriodoGmd } from "./SeletorPeriodoGmd";
import { Paginacao, CardFicha } from "../ui";
import { GraficoPeso, ROTULO_TIPO_PESAGEM } from "./GraficoPeso";
import { formatarGmd, inicioJanelaGmd, rotuloPeriodoGmd } from "../lib/peso";
import { hoje } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import type { AnimalFicha, PeriodoGmd, Pesagem } from "../types";

/** GMD entre uma pesagem e a imediatamente anterior (lista mais recente primeiro) — usado só na
 *  coluna "GMD desde a anterior" da tabela; o cálculo de verdade (recente/período/entrada) vem do
 *  servidor em `animal.peso`. */
function gmdEntre(atual: { pesoKg: number; data: string }, anterior: { pesoKg: number; data: string } | undefined): string {
  if (!anterior) return "—";
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

  const mesmaBase = historicoPesagens.length === 2 && peso.gmdPeriodo.pesagens === 2
    && peso.gmdPeriodo.valor != null && peso.gmdPeriodo.valor === peso.gmdRecente
    && peso.gmdRecente === peso.gmdDesdeEntrada;
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [animal.id, historicoPesagens.length]);
  const totalPaginas = Math.max(1, Math.ceil(historicoPesagens.length / 5));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <div className="ficha-peso-conjunto space-y-4">
    <div className="ficha-gmd-cabecalho">
      <dl className="ficha-gmd-leitura">
        <div><dt>GMD do período</dt><dd><strong>{formatarGmd(peso.gmdPeriodo.valor)}</strong><small>{detalhePeriodo}</small></dd></div>
        {mesmaBase ? <div><dt><span>GMD recente</span> e <span>GMD desde a entrada</span></dt><dd className="text-sm">Mesmas duas pesagens do período.</dd></div> : <>
          <div><dt>GMD recente</dt><dd>{formatarGmd(peso.gmdRecente)}<small>Duas últimas pesagens</small></dd></div>
          <div><dt>GMD desde a entrada</dt><dd>{formatarGmd(peso.gmdDesdeEntrada)}<small>Primeira × última pesagem</small></dd></div>
        </>}

      </dl>
      <SeletorPeriodoGmd id="periodo-gmd-animal" valor={periodo} onChange={onPeriodoChange}/>
    </div>
    <div className="ficha-peso-distribuicao">
      <CardFicha icon={Scale} titulo="Evolução do peso"><GraficoPeso historicoPesagens={historicoPesagens} desde={desde} ate={limite}/></CardFicha>
      <CardFicha icon={Weight} titulo="Últimas pesagens">
      {historicoPesagens.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm consulta-tabela">
        <thead className="text-xs text-ink-3"><tr>
          <th className="py-1.5 pr-3 font-semibold">Data</th>
          <th className="py-1.5 pr-3 font-semibold">Peso</th>
          <th className="py-1.5 pr-3 font-semibold">Tipo</th>
          <th className="py-1.5 pr-3 font-semibold">GMD desde a anterior</th>
          <th className="py-1.5 pr-3 font-semibold">Origem</th>
          <th className="py-1.5 pr-3 font-semibold" />
        </tr></thead>
        <tbody className="divide-y divide-border">
          {historicoPesagens.slice((paginaAtual-1)*5,paginaAtual*5).map((pesagem, indice) => <tr key={pesagem.id}>
            <td className="whitespace-nowrap py-2 pr-3">{formatarDataBR(pesagem.data)}</td>
            <td className="whitespace-nowrap py-2 pr-3">{pesagem.pesoKg.toLocaleString("pt-BR")} kg</td>
            <td className="py-2 pr-3">{ROTULO_TIPO_PESAGEM[pesagem.tipo] ?? pesagem.tipo}{pesagem.observacao && <div className="mt-0.5 break-words text-xs text-ink-3">{pesagem.observacao}</div>}</td>
            <td className="whitespace-nowrap py-2 pr-3">{gmdEntre(pesagem, historicoPesagens[(paginaAtual-1)*5 + indice + 1])}</td>
            <td className="py-2 pr-3">{pesagem.origem === "BALANCA" ? "Balança" : "Manual"}</td>
            <td className="py-2 pr-3 text-right">{podeLancar && <div className="flex justify-end gap-1">
              <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Editar pesagem de ${formatarDataBR(pesagem.data)}`} title="Editar pesagem" onClick={() => onEditarPesagem({ id: pesagem.id, animalId: animal.id, data: pesagem.data, pesoKg: pesagem.pesoKg, tipo: pesagem.tipo as Pesagem["tipo"], origem: pesagem.origem as Pesagem["origem"], observacao: pesagem.observacao })}><Pencil size={16} /></button>
              <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-red-50 hover:text-red-800" aria-label={`Excluir pesagem de ${formatarDataBR(pesagem.data)}`} title="Excluir pesagem" onClick={() => onExcluirPesagem({ id: pesagem.id, animalId: animal.id, data: pesagem.data, pesoKg: pesagem.pesoKg, tipo: pesagem.tipo as Pesagem["tipo"], origem: pesagem.origem as Pesagem["origem"] })}><Trash2 size={16} /></button>
            </div>}</td>
          </tr>)}
        </tbody>
      </table></div> : <p className="text-sm text-ink-3">Nenhuma pesagem registrada.</p>}
      {historicoPesagens.length > 5 && <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={historicoPesagens.length} itensPorPagina={5} onPaginaChange={setPagina} rotulo="pesagens" idSelect="pagina-pesagens-animal"/>}
      </CardFicha>
    </div>
    {manejo}
  </div>;
}
