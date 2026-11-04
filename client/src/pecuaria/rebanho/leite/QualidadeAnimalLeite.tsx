import { DetalheProducao, VazioProducao } from "./ProducaoAnimalUI";
import { Button } from "@/components/ui/button";
import { DateRangePicker, dateFromIso, isoDate } from "@/components/DateRangePicker";
import "./ordenhas-gerais.css";
import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional } from "./modelo";
import { DatasQualidade } from "./DatasQualidade";
import { dataSanitaria } from "../sanidade/rotulos";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { FlaskConical } from "lucide-react";
import type { AmostraQualidade } from "./qualidade-types";
import "./operacoes.css";
import "./historico-produtivo.css";
import { EsqueletoTabela } from "../../../components/Esqueleto";

type Consulta = {
  itens: AmostraQualidade[];
  total: number;
  pagina: number;
  tamanho: number;
};
/** A consulta é filtrada no servidor pelo animal, sem incorporar amostras de tanque. */
export function QualidadeAnimalLeite({
  animalId,
  propriedadeId,
  recarregarToken = 0,
}: {
  animalId: string;
  propriedadeId: number | null;
  recarregarToken?: number;
}) {
  const [selecionada, setSelecionada] = useState<AmostraQualidade | null>(null);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState(hojeOperacional);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Consulta | null>(null);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    setPagina(1); setSelecionada(null);
  }, [animalId, propriedadeId, recarregarToken]);
  useEffect(() => {
    let vigente = true;
    setDados(null);
    setErro("");
    if (propriedadeId == null) return;
    if (inicio && fim && inicio > fim) {
      setErro("O início deve ser anterior ou igual ao fim.");
      return;
    }
    const query = new URLSearchParams({
      animalId,
      sujeito: "ANIMAL",
      pagina: String(pagina),
      tamanho: "20",
      ...(inicio ? { inicio } : {}),
      ...(fim ? { fim } : {}),
    });
    void consultarLeite<Consulta>(`/qualidade/amostras?${query}`, propriedadeId)
      .then((r) => {
        if (vigente) setDados(r);
      })
      .catch((e) => {
        if (vigente)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar a qualidade individual.",
          );
      });
    return () => {
      vigente = false;
    };
  }, [animalId, propriedadeId, inicio, fim, pagina, revisao, recarregarToken]);
  return (
    <SecaoGeralAnimal icon={FlaskConical}
      id="qualidade-individual-leite"
      className="leite-qualidade-animal"
      titulo="Qualidade do leite"

    >
      <div className="producao-barra"><strong>Amostras individuais</strong>{<>{propriedadeId != null ? <DateRangePicker anchor="right" allowAll triggerLabel="Período" triggerAriaLabel={!inicio && fim ? `Período das amostras: até ${dataSanitaria(fim)}` : "Período das amostras"} value={{ start: dateFromIso(inicio), end: dateFromIso(fim) }} onChange={({ start, end }) => {
        setInicio(start ? isoDate(start) : "");
        setFim(end ? isoDate(end) : "");
        setPagina(1);
      }} /> : undefined}</>}</div>
      {propriedadeId == null ? (
        <p>Selecione o sítio autorizado para consultar as amostras individuais.</p>
      ) : (
        <>
          {erro ? (
            <div role="alert">
              {erro}{" "}
              <Button
                variant="outline"
                type="button"
                onClick={() => setRevisao((r) => r + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          ) : !dados ? (
            <EsqueletoTabela label="Carregando análises individuais" />
          ) : (
            <>
              {dados.itens.length > 0 && <p className="producao-ficha-nota">{dados.total} amostra(s) deste animal no período e sítio consultados.</p>}
              {!dados.itens.length && (
                <VazioProducao>Nenhuma análise individual registrada neste recorte.</VazioProducao>
              )}
              {dados.itens.map(a => <article key={a.id} className="producao-amostra">
                <div><FlaskConical size={20} aria-hidden="true"/><strong>{dataSanitaria(a.data)}</strong></div>
                <div><strong>{a.formatoSnapshot.nome}</strong><span> — {situacaoAmostra(a)}</span></div>
                <Button onClick={() => setSelecionada(a)}>Detalhes</Button>
              </article>)}
              {dados.total > dados.tamanho && <nav className="historico-produtivo-paginas" aria-label="Páginas das análises individuais">
                <Button
                  variant="outline"
                  type="button"
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Análises anteriores
                </Button>
                <span>Página {pagina}</span>
                <Button
                  variant="outline"
                  type="button"
                  disabled={pagina * dados.tamanho >= dados.total}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próximas análises
                </Button>
              </nav>}
            </>
          )}
        </>
      )}
      {selecionada && <DetalheProducao titulo="Detalhes da amostra" fechar={() => setSelecionada(null)}>
        <section><h3>Amostra individual</h3><dl className="producao-dados"><div><dt>Animal</dt><dd>{selecionada.animal ? `${selecionada.animal.brinco}${selecionada.animal.nome ? ` · ${selecionada.animal.nome}` : ""}` : "Não informado"}</dd></div>
        <div><dt>Data de coleta</dt><dd>{dataSanitaria(selecionada.data)}</dd></div><div><dt>Formato</dt><dd>{selecionada.formatoSnapshot.nome}</dd></div><div><dt>Situação</dt><dd>{situacaoAmostra(selecionada)}</dd></div>
        <div><dt>Versão do registro</dt><dd>{selecionada.versao}</dd></div><div><dt>Responsável</dt><dd>{selecionada.responsavel ?? "Não informado"}</dd></div></dl><DatasQualidade {...selecionada}/></section>
        <section><h3>Resultados</h3>{selecionada.resultados.length ? <div className="producao-tabela"><table><thead><tr><th>Parâmetro</th><th>Resultado</th><th>Unidade</th></tr></thead><tbody>{selecionada.resultados.map(r => {
          const campo = selecionada.formatoSnapshot.campos.find(c => c.codigo === r.campo);
          return <tr key={r.campo}><td>{campo?.rotulo || r.campo}</td><td>{typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : r.valor}</td><td>{campo?.unidade ?? "—"}</td></tr>;
        })}</tbody></table></div> : <VazioProducao>Aguardando resultado do laudo</VazioProducao>}</section>
        {selecionada.anotacaoOriginal && <section><h3>Observação</h3><p>{selecionada.anotacaoOriginal}</p></section>}
      </DetalheProducao>}
    </SecaoGeralAnimal>
  );
}

function situacaoAmostra(a: AmostraQualidade) { return a.status === "ANULADO" || a.status === "ANULADA" ? "Anulada — preservada no histórico" : a.resultados.length ? "Resultado registrado" : "Aguardando laudo"; }
