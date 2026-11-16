import { AjudaCampo } from "@/components/Dica";
import { dataSanitaria } from "../sanidade/rotulos";
import { formatarLitros } from "./modelo";
import type { DiaHistoricoProdutivo } from "./historico-types";
import { DetalheProducao } from "./ProducaoAnimalUI";
export function AfericaoAnimalDetalhe({ dia, animal, fechar }: { dia: DiaHistoricoProdutivo; animal: string; fechar: () => void }) {
  return <DetalheProducao titulo={`Aferição de ${dataSanitaria(dia.dataOperacional)}`} fechar={fechar}>
    <section><h3>Detalhes</h3><dl className="producao-dados">
      <div><dt>Animal</dt><dd>{animal}</dd></div><div><dt>Data operacional</dt><dd>{dataSanitaria(dia.dataOperacional)}</dd></div>
      <div><dt>Volume conhecido</dt><dd>{formatarLitros(dia.totais.litros)}</dd></div>
      <div><dt>Situação</dt><dd>{dia.excluidoEm ? "Excluída dos totais" : dia.totais.completa ? "Completa" : "Parcial"}</dd></div>
      <div><dt>Lactação e DEL<AjudaCampo rotulo="Sobre lactação e DEL" texto="DEL: dias em lactação, contados a partir do início da lactação (D0)."/></dt><dd>{dia.del === null ? "DEL não informado" : `${dia.del} dias em lactação`}</dd><dd>{dia.lactacao ? `Início em ${dataSanitaria(dia.lactacao.inicio)}` : "Lactação não informada"}</dd></div>
      <div><dt>Finalidade na data</dt><dd>{dia.finalidade.estado === "COMPROVADA" ? "Leite comprovada na data" : "Finalidade histórica a conciliar"}</dd>{dia.finalidade.estado !== "COMPROVADA" && <dd>Litros registrados preservados; finalidade ainda não comprovada.</dd>}</div>
    </dl>{dia.excluidoEm && <p>Excluída em {dataSanitaria(dia.excluidoEm)} · {dia.motivoExclusao ?? "Motivo não informado"}</p>}</section>
    <section><h3>Ordenhas</h3><div className="producao-tabela" role="region" aria-label="Ordenhas registradas" tabIndex={0}><table><thead><tr><th>Ordenha</th><th>Volume</th><th>Situação</th><th>Motivo</th></tr></thead><tbody>{dia.medicoes.map(m => <tr key={m.posicaoId}><td>{m.nomeOrdenha}</td><td>{m.estado === "MEDIDO" ? formatarLitros(m.litros) : "—"}</td><td>{m.estado === "MEDIDO" ? "Medida" : m.estado === "NAO_ORDENHADO" ? "Não ordenhado" : "Medição pendente"}</td><td>{m.motivo ?? "—"}</td></tr>)}</tbody></table></div></section>
  </DetalheProducao>;
}
