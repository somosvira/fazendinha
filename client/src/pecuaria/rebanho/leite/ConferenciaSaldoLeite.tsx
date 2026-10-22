import { useEffect, useRef, useState } from "react";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { formatarLitros } from "./modelo";
interface Conferencia {
  id: string;
  propriedadeId: number;
  produtoNome: string;
  data: string;
  litrosObservados: number;
  referencia: string;
  responsavel: string;
  versao: number;
  motivoCorrecao: string | null;
  criadoEm: string;
}
interface Lista {
  propriedadeId: number;
  itens: Conferencia[];
  total: number;
  tamanho: number;
}
export function ConferenciaSaldoLeite({
  produtoId,
  data,
  propriedadeId,
  podeLancar,
}: {
  produtoId: string;
  data: string;
  propriedadeId: number | null;
  podeLancar: boolean;
}) {
  const [lista, setLista] = useState<Lista | null>(null),
    [atual, setAtual] = useState<Conferencia | null>(null),
    [pagina, setPagina] = useState(1),
    [revisao, setRevisao] = useState(0);
  const [litros, setLitros] = useState(""),
    [referencia, setReferencia] = useState(""),
    [responsavel, setResponsavel] = useState(""),
    [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    geracao = useRef(0);
  useEffect(() => {
    setPagina(1);
    setLitros("");
    setReferencia("");
    setResponsavel("");
    setMotivo("");
    setAviso("");
  }, [produtoId, data, propriedadeId]);
  useEffect(() => {
    let ativa = true;
    geracao.current++;
    setErro("");
    setLista(null);
    const params = new URLSearchParams({ produtoId, data });
    void Promise.all([
      consultarLeite<Lista>(
        `/conferencias-saldo?${params}&pagina=1`,
        propriedadeId,
      ),
      pagina === 1
        ? Promise.resolve(null)
        : consultarLeite<Lista>(
            `/conferencias-saldo?${params}&pagina=${pagina}`,
            propriedadeId,
          ),
    ])
      .then(([primeira, hist]) => {
        if (ativa) {
          setAtual(primeira.itens[0] ?? null);
          setLista(hist ?? primeira);
        }
      })
      .catch((e) => {
        if (ativa)
          setErro(
            e instanceof Error ? e.message : "Falha na consulta da conferência",
          );
      });
    return () => {
      ativa = false;
      geracao.current++;
    };
  }, [produtoId, data, propriedadeId, pagina, revisao]);
  const volume = /^\d+(?:[.,]\d{1,3})?$/.test(litros)
    ? Number(litros.replace(",", "."))
    : null;
  async function salvar() {
    if (trava.current || volume === null || !lista) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    setAviso("");
    const token = geracao.current;
    try {
      await registrarLeite("/conferencias-saldo", lista.propriedadeId, {
        produtoId,
        data,
        litrosObservados: volume,
        referencia,
        responsavel,
        versaoEsperada: atual?.versao ?? 0,
        ...(atual ? { motivoCorrecao: motivo } : {}),
      });
      if (token === geracao.current) {
        setAviso(
          "Conferência física registrada. O saldo de estoque não foi alterado.",
        );
        setPagina(1);
        setRevisao((r) => r + 1);
        setLitros("");
        setMotivo("");
      }
    } catch (e) {
      if (token === geracao.current)
        setErro(
          e instanceof Error ? e.message : "Falha ao registrar conferência",
        );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <details>
      <summary>Conferência física do tanque em {data}</summary>
      <p>
        Informe o volume realmente observado para este produto no encerramento
        do dia. A conferência não cria entrada, saída nem ajuste no estoque. A
        comparação com o razão fica preservada ao emitir o relatório.
      </p>
      {atual ? (
        <p>
          Última conferência: {formatarLitros(atual.litrosObservados)} · versão{" "}
          {atual.versao} · {atual.responsavel}.
        </p>
      ) : (
        <p>
          Nenhuma medição física informada para esta data. Ausência não
          significa tanque vazio.
        </p>
      )}
      {podeLancar && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>
              {atual
                ? "Corrigir conferência física"
                : "Registrar medição física"}
            </legend>
            <div className="leite-form-inline">
              <label>
                Litros observados no tanque
                <input
                  required
                  inputMode="decimal"
                  value={litros}
                  onChange={(e) => setLitros(e.target.value)}
                />
              </label>
              <label>
                Referência da medição
                <input
                  required
                  minLength={3}
                  maxLength={500}
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </label>
              <label>
                Responsável pela conferência
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </label>
            </div>
            {atual && (
              <label>
                Motivo da correção física
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
            )}
            <button
              disabled={
                ocupado ||
                !lista ||
                volume === null ||
                referencia.trim().length < 3 ||
                responsavel.trim().length < 2 ||
                (!!atual && motivo.trim().length < 5)
              }
            >
              Salvar conferência sem ajustar estoque
            </button>
          </fieldset>
        </form>
      )}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {lista && (
        <>
          <div className="leite-tabela-scroll">
            <table>
              <caption>Histórico de conferências da data</caption>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Volume observado</th>
                  <th>Responsável</th>
                  <th>Referência e motivo</th>
                </tr>
              </thead>
              <tbody>
                {lista.itens.map((c) => (
                  <tr key={c.id}>
                    <td>{c.versao}</td>
                    <td>{formatarLitros(c.litrosObservados)}</td>
                    <td>{c.responsavel}</td>
                    <td>
                      {c.referencia}
                      {c.motivoCorrecao && <small>{c.motivoCorrecao}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="leite-form-inline">
            <button
              className="leite-secondary"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Conferências anteriores
            </button>
            <span>Página {pagina}</span>
            <button
              className="leite-secondary"
              disabled={pagina * lista.tamanho >= lista.total}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próximas conferências
            </button>
          </div>
        </>
      )}
    </details>
  );
}
