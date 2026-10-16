import { useEffect, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  hoje,
  Panel,
} from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { listarAnimais, listarGenitores, listarLotes } from "../api";
import type { AnimalResumo, GenitorDTO, Lote } from "../types";
import { obterReproducao, reqV4 } from "./api";
type Exposicao = {
  id: string;
  loteId: string;
  inicio: string;
  fim: string | null;
  observacao: string | null;
  touro?: { brinco: string };
  touroExterno?: { nome: string };
  lote?: { nome: string };
};
export function Exposicoes({ podeLancar }: { podeLancar: boolean }) {
  const [encerrando, setEncerrando] = useState<Exposicao | null>(null);
  const [dataFim, setDataFim] = useState(hoje());
  const [motivoFim, setMotivoFim] = useState("");
  const [lista, setLista] = useState<Exposicao[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [touros, setTouros] = useState<AnimalResumo[]>([]);
  const [externos, setExternos] = useState<GenitorDTO[]>([]);
  const [aberto, setAberto] = useState(false);
  const [loteId, setLoteId] = useState("");
  const [touro, setTouro] = useState("");
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [chave] = useState(() => crypto.randomUUID());
  const carregar = async () => {
    try {
      const [e, l, t, x] = await Promise.all([
        obterReproducao().then((p) => p.exposicoes ?? []),
        listarLotes(),
        listarAnimais({ sexo: "M", pageSize: 200 }),
        listarGenitores({ sexo: "M" }),
      ]);
      setLista(e);
      setLotes(l);
      setTouros(t.itens);
      setExternos(x);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void carregar();
  }, []);
  return (
    <Panel>
      <CabecalhoTabela
        titulo="Exposição ao touro"
        acao={
          podeLancar && (
            <Button secondary onClick={() => setAberto(true)}>
              Registrar exposição
            </Button>
          )
        }
      />
      <div className="p-4 space-y-3">
        <ErrorBox erro={erro} />
        <p className="text-sm text-ink-3">
          Registra lote e período de exposição; não presume coberturas
          individuais.
        </p>
        {lista.map((e) => (
          <div
            className="text-sm border-t border-border pt-3 flex flex-wrap justify-between gap-3"
            key={e.id}
          >
            <span>
              {e.lote?.nome ?? lotes.find((l) => l.id === e.loteId)?.nome} ·{" "}
              {e.touro?.brinco ?? e.touroExterno?.nome ?? "Touro"} ·{" "}
              {e.inicio.slice(0, 10)} até {e.fim?.slice(0, 10) ?? "em aberto"}
            </span>
            {podeLancar && !e.fim && (
              <Button
                secondary
                onClick={() => {
                  setEncerrando(e);
                  setDataFim(hoje());
                  setMotivoFim("");
                }}
              >
                Encerrar exposição
              </Button>
            )}
          </div>
        ))}
        {!lista.length && (
          <p className="text-sm">Nenhuma exposição registrada.</p>
        )}
      </div>
      {encerrando && (
        <PainelCadastro
          aberto
          titulo="Encerrar período de exposição"
          onFechar={() => setEncerrando(null)}
          bloqueado={ocupado}
          rodape={
            <>
              <Button secondary onClick={() => setEncerrando(null)}>
                Cancelar
              </Button>
              <Button
                form="encerrar-exposicao"
                type="submit"
                disabled={ocupado}
              >
                Encerrar período
              </Button>
            </>
          }
        >
          <form
            id="encerrar-exposicao"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const propriedadeId = getPropriedadeAtiva();
              if (!propriedadeId) {
                setErro("Selecione o sítio.");
                return;
              }
              setOcupado(true);
              setErro(null);
              reqV4(`/reproducao/exposicoes/${encerrando.id}/encerramento`, {
                propriedadeId,
                data: dataFim,
                motivo: motivoFim,
              })
                .then(async () => {
                  setEncerrando(null);
                  await carregar();
                })
                .catch((e) => setErro(e.message))
                .finally(() => setOcupado(false));
            }}
          >
            <ErrorBox erro={erro} />
            <label>
              Fim da exposição
              <input
                type="date"
                required
                min={encerrando.inicio.slice(0, 10)}
                className={classeInput}
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </label>
            <label>
              Motivo
              <textarea
                className={classeInput}
                minLength={5}
                required
                value={motivoFim}
                onChange={(e) => setMotivoFim(e.target.value)}
              />
            </label>
          </form>
        </PainelCadastro>
      )}
      {aberto && (
        <PainelCadastro
          aberto
          titulo="Registrar exposição ao touro"
          onFechar={() => setAberto(false)}
          bloqueado={ocupado}
          rodape={
            <>
              <Button secondary onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button form="exposicao" type="submit" disabled={ocupado}>
                Registrar
              </Button>
            </>
          }
        >
          <form
            id="exposicao"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const propriedadeId = getPropriedadeAtiva();
              if (!propriedadeId) {
                setErro("Selecione um sítio.");
                return;
              }
              setOcupado(true);
              setErro(null);
              reqV4("/reproducao/exposicoes", {
                chave,
                propriedadeId,
                loteId,
                inicio,
                fim: fim || undefined,
                observacao: observacao || undefined,
                ...(touro.startsWith("externo:")
                  ? { touroExternoId: touro.slice(8) }
                  : { touroId: touro }),
              })
                .then(async () => {
                  setAberto(false);
                  await carregar();
                })
                .catch((e) => setErro(e.message))
                .finally(() => setOcupado(false));
            }}
          >
            <ErrorBox erro={erro} />
            <label>
              Lote
              <select
                className={classeInput}
                required
                value={loteId}
                onChange={(e) => setLoteId(e.target.value)}
              >
                <option value="">Selecione</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Touro
              <select
                className={classeInput}
                required
                value={touro}
                onChange={(e) => setTouro(e.target.value)}
              >
                <option value="">Selecione</option>
                {touros.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.brinco} {t.nome}
                  </option>
                ))}
                {externos.map((t) => (
                  <option key={t.id} value={`externo:${t.id}`}>
                    {t.nome} · externo
                  </option>
                ))}
              </select>
            </label>
            <label>
              Início
              <input
                type="date"
                required
                className={classeInput}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label>
              Fim (opcional)
              <input
                type="date"
                min={inicio}
                className={classeInput}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
            <label>
              Observação
              <textarea
                className={classeInput}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </label>
          </form>
        </PainelCadastro>
      )}
    </Panel>
  );
}
