import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AjudaCampo } from "@/components/Dica";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { dataSanitaria } from "../sanidade/rotulos";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { periodoProducao, useHistoricoProdutivo } from "./consulta-producao-animal";
import { DetalheProducao, PeriodoProducao, VazioProducao } from "./ProducaoAnimalUI";
import type { ControleHistoricoLeite } from "./historico-types";
const quantidade = (v: string | number | null) => v == null ? "Não informado" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export function ControlesDocumentaisAnimal({ animalId, propriedadeId, recarregarToken = 0 }: { animalId: string; propriedadeId: number | null; recarregarToken?: number }) {
  const [periodo, setPeriodo] = useState(() => periodoProducao(366));
  const { dados, erro, carregando, tentarNovamente } = useHistoricoProdutivo(animalId, propriedadeId, periodo, recarregarToken, false);
  const [detalhe, setDetalhe] = useState<ControleHistoricoLeite | null>(null);
  const [pagina, setPagina] = useState(1);
  useEffect(() => { setPagina(1); setDetalhe(null); }, [animalId, propriedadeId, periodo, recarregarToken]);
  const itens = dados?.controlesDocumentais ?? [];
  const paginaAtual = Math.min(pagina, Math.max(1, Math.ceil(itens.length / 10)));
  return <SecaoGeralAnimal id="controles-documentais-animal" titulo="Controles históricos" icon={FileText} className="producao-documentos">
    <div className="producao-barra"><strong>Controles documentais<AjudaCampo rotulo="Sobre os controles históricos" texto="Documentos preservados na unidade original, separados das aferições operacionais. Não preenchem dias sem medição, não geram saldo de estoque e não convertem quilogramas em litros."/></strong><PeriodoProducao periodo={periodo} onChange={setPeriodo} rotulo="Período dos controles históricos"/></div>
    {propriedadeId == null ? <p>Selecione o sítio autorizado para consultar os controles históricos.</p> : <><ErrorBox erro={erro}/>{erro && <Button variant="outline" onClick={tentarNovamente}>Tentar novamente</Button>}{carregando && <p role="status">Consultando controles históricos…</p>}
    {!erro && !carregando && (itens.length ? <><div className="producao-tabela" role="region" aria-label="Controles documentais" tabIndex={0}><table><thead><tr><th scope="col">Data</th><th scope="col">Total declarado</th><th scope="col">Unidade</th><th scope="col">Origem</th><th scope="col">Ações</th></tr></thead><tbody>{itens.slice((paginaAtual - 1) * 10, paginaAtual * 10).map(i => <tr key={i.id}><td>{dataSanitaria(i.inicio)}{i.fim !== i.inicio && <> a {dataSanitaria(i.fim)}</>}</td><td>{quantidade(i.total)}</td><td>{i.unidade === "KG" ? "kg" : "L"}</td><td>{i.origem.banco ?? "Não informada"}</td><td><Button onClick={() => setDetalhe(i)}>Ver origem</Button></td></tr>)}</tbody></table></div>
    {itens.length > 10 && <nav className="historico-produtivo-paginas" aria-label="Páginas dos controles documentais"><span>Página {paginaAtual} · {itens.length} registros</span><Button variant="outline" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button><Button variant="outline" disabled={paginaAtual * 10 >= itens.length} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button></nav>}</> : <VazioProducao>Nenhum controle histórico no período</VazioProducao>)}</>}
    {detalhe && <DetalheProducao titulo="Origem e conferência" fechar={() => setDetalhe(null)}><dl className="producao-dados">
      <div><dt>Animal</dt><dd>{dados?.animal.brinco}{dados?.animal.nome ? ` · ${dados.animal.nome}` : ""}</dd></div>
      <div><dt>Período</dt><dd>{dataSanitaria(detalhe.inicio)} a {dataSanitaria(detalhe.fim)}</dd></div>
      <div><dt>Total declarado</dt><dd>{quantidade(detalhe.total)} {detalhe.unidade === "KG" ? "kg" : "L"}</dd></div>
      <div><dt>Unidade original</dt><dd>{detalhe.referenciaUnidade}</dd></div>
      <div><dt>Fonte</dt><dd>{detalhe.origem.banco ?? "Não informada"}</dd></div><div><dt>Referência de origem</dt><dd>{detalhe.origem.chave ?? "Não informada"}</dd></div>
      <div><dt>Evidência do documento</dt><dd>{detalhe.origem.evidencia ?? "Não informada"}</dd></div><div><dt>Lactação</dt><dd>{detalhe.lactacaoId ? "Vínculo conferido no período" : "Sem lactação comprovada"}</dd></div>
      <div><dt>Versão do documento</dt><dd>{detalhe.versao}</dd></div>
    </dl><section><h3>Parcelas conhecidas</h3>{detalhe.parcelas.length ? <div className="producao-tabela"><table><thead><tr><th>Parcela</th><th>Quantidade</th><th>Horário</th></tr></thead><tbody>{detalhe.parcelas.map((p, i) => <tr key={i}><td>{p.rotulo ?? "Não informado"}</td><td>{quantidade(p.quantidade)} {detalhe.unidade === "KG" ? "kg" : "L"}</td><td>{p.hora ?? "Não informado"}</td></tr>)}</tbody></table></div> : <p>Parcelas não informadas</p>}</section></DetalheProducao>}
  </SecaoGeralAnimal>;
}
