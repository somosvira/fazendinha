import { AjudaCampo } from "@/components/Dica";
import { Button } from "@/components/ui/button";
import { DateRangePicker, dateFromIso, isoDate } from "@/components/DateRangePicker";
import "./ordenhas-gerais.css";
import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional } from "./modelo";
import { DatasQualidade } from "./DatasQualidade";
import { dataSanitaria } from "../sanidade/rotulos";
import { SecaoFicha } from "../components/SecaoRecolhivel";
import type { AmostraQualidade } from "./qualidade-types";
import "./operacoes.css";
import "./historico-produtivo.css";

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
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState(hojeOperacional);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Consulta | null>(null);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    setPagina(1);
  }, [animalId, propriedadeId]);
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
    <SecaoFicha
      id="qualidade-individual-leite"
      className="leite-qualidade-animal"
      titulo={<>Qualidade individual do leite <AjudaCampo rotulo="Sobre as amostras individuais" texto="Coletas e resultados independem da frequência de medição de litros." /></>}
      acoes={propriedadeId != null ? <DateRangePicker anchor="right" allowAll triggerLabel={!inicio && fim ? `Até ${dataSanitaria(fim)}` : undefined} triggerAriaLabel={!inicio && fim ? `Período das amostras: até ${dataSanitaria(fim)}` : "Período das amostras"} value={{ start: dateFromIso(inicio), end: dateFromIso(fim) }} onChange={({ start, end }) => {
        setInicio(start ? isoDate(start) : "");
        setFim(end ? isoDate(end) : "");
        setPagina(1);
      }} /> : undefined}
    >
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
            <p role="status">Carregando análises individuais…</p>
          ) : (
            <>
              {dados.itens.length > 0 && <p className="producao-ficha-nota">{dados.total} amostra(s) deste animal no período e sítio consultados.</p>}
              {!dados.itens.length && (
                <p className="producao-ficha-vazio">Nenhuma análise individual registrada neste recorte.</p>
              )}
              {dados.itens.map((a) => (
                <article key={a.id} className="leite-qualidade-amostra">
                  <header><h3>
                    {a.data.split("-").reverse().join("/")} ·{" "}
                    {a.formatoSnapshot.nome}
                  </h3>
                  <span>
                    {a.status === "ANULADO" || a.status === "ANULADA"
                      ? "Anulada — preservada no histórico"
                      : a.resultados.length
                        ? "Resultado registrado"
                        : "Aguardando laudo"}{" "}
                    · Versão {a.versao}
                  </span></header>
                  <DatasQualidade {...a} />
                  <dl>
                    {a.resultados.map((r) => {
                      const campo = a.formatoSnapshot.campos.find(
                        (c) => c.codigo === r.campo,
                      );
                      return (
                        <div key={r.campo}>
                          <dt>{campo?.rotulo || r.campo}</dt>
                          <dd>
                            {typeof r.valor === "boolean"
                              ? r.valor
                                ? "Sim"
                                : "Não"
                              : r.valor}{" "}
                            {campo?.unidade ?? ""}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {a.responsavel && <p>Responsável: {a.responsavel}</p>}
                </article>
              ))}
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
    </SecaoFicha>
  );
}
