import { Fragment, useId } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { dataSanitaria } from "../sanidade/rotulos";
import type { ControleHistoricoLeite } from "./historico-types";
import "./controles-historicos.css";

const quantidade = (valor: string | number | null, unidade: "L" | "KG") => valor === null
  ? "Não informado" : `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unidade === "KG" ? "kg" : "L"}`;

export function ControlesHistoricosLeite({ itens, coletivo = false }: { itens: ControleHistoricoLeite[]; coletivo?: boolean }) {
  const id = useId();
  const titulo = coletivo ? "Agregados históricos do sítio" : "Controles históricos do animal";
  return <section className="controles-historicos-leite" aria-labelledby={id}>
    <header><h3 id={id}>{titulo}</h3></header>
    {itens.length === 0 ? <p className="controles-historicos-vazio">{coletivo ? "Nenhum agregado histórico no período." : "Nenhum controle histórico no período."}</p> : <>
      <div className="controles-historicos-tabela" role="region" aria-label={titulo} tabIndex={0}>
        <Table semContainer className="consulta-tabela">
          <TableCaption className="sr-only">{titulo}, separados das aferições operacionais</TableCaption>
          <TableHeader><TableRow><TableHead scope="col">{coletivo ? "Período e origem coletiva" : "Data do controle"}</TableHead><TableHead scope="col" className="text-right">Total registrado</TableHead><TableHead scope="col">Parcelas conhecidas</TableHead><TableHead scope="col">Unidade</TableHead></TableRow></TableHeader>
          <TableBody>{itens.map(item => {
            const periodo = item.inicio === item.fim ? dataSanitaria(item.inicio) : `${dataSanitaria(item.inicio)} a ${dataSanitaria(item.fim)}`;
            return <Fragment key={item.id}>
              <TableRow><TableCell><time dateTime={item.inicio}>{periodo}</time>{coletivo && <p>{item.origemColetiva ?? "Origem não informada"}</p>}</TableCell>
                <TableCell className="controles-historicos-total">{quantidade(item.total, item.unidade)}</TableCell>
                <TableCell>{item.parcelas.length ? <ul aria-label={`Parcelas de ${periodo}`}>{item.parcelas.map((parcela, i) => <li key={i}>
                  <span>{parcela.rotulo ?? "Parcela sem rótulo"}: {quantidade(parcela.quantidade, item.unidade)}</span>
                  <small>{parcela.hora ?? "Horário não informado"}</small>
                </li>)}</ul> : "Parcelas não informadas"}</TableCell>
                <TableCell>{item.unidade === "L" ? "Litros" : "Quilogramas"}<p className="controles-historicos-referencia">{item.referenciaUnidade}</p></TableCell>
              </TableRow>
              <TableRow className="controles-historicos-origem"><TableCell colSpan={4}>
                <details><summary>Ver origem e conferência de {periodo}</summary>
                  <dl>
                    <div><dt>Fonte</dt><dd>{item.origem.banco ?? "Não informada"}</dd></div>
                    <div><dt>Referência de origem</dt><dd>{item.origem.chave ?? "Não informada"}</dd></div>
                    {item.origem.evidencia && <div><dt>Evidência do documento</dt><dd>{item.origem.evidencia}</dd></div>}
                    {!coletivo && <div><dt>Lactação</dt><dd>{item.lactacaoId ? "Vínculo conferido no período" : "Sem lactação comprovada"}</dd></div>}
                    <div><dt>Versão do documento</dt><dd>{item.versao}</dd></div>
                  </dl>
                </details>
              </TableCell></TableRow>
            </Fragment>;
          })}</TableBody>
        </Table>
      </div>
      <p className="controles-historicos-nota">Documentos históricos separados das aferições operacionais. Não geram saldo de estoque. {coletivo ? "O agregado mensal não é distribuído pelos dias ou animais." : "Controles periódicos não preenchem os dias sem medição na curva."}</p>
    </>}
  </section>;
}
