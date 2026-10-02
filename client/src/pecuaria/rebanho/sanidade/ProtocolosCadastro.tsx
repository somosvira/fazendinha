import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { listarTiposAplicacao, reqSanidade, type TipoAplicacao } from "./api";
import type { TipoExame } from "./CadastrosSanitarios";
type Etapa = {
  diaRelativo: number;
  tipo: "APLICACAO" | "EXAME";
  produtoId: string;
  tipoExameId: string;
  tipoAplicacaoId: string;
  dose: string;
  unidade: string;
};
type Protocolo = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versao: number;
  publicadoEm: string | null;
  etapas: Array<
    Omit<
      Etapa,
      "produtoId" | "tipoExameId" | "tipoAplicacaoId" | "dose" | "unidade"
    > & {
      produtoId: string | null;
      tipoExameId: string | null;
      tipoAplicacaoId: string | null;
      dose: string | null;
      unidade: string | null;
      tipoAplicacaoNomeSnapshot: string | null;
    }
  >;
};
const nova = (): Etapa => ({
  diaRelativo: 0,
  tipo: "APLICACAO",
  produtoId: "",
  tipoExameId: "",
  tipoAplicacaoId: "",
  dose: "",
  unidade: "ML",
});
export function ProtocolosCadastro({ podeLancar }: { podeLancar: boolean }) {
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [tipos, setTipos] = useState<TipoAplicacao[]>([]);
  const [exames, setExames] = useState<TipoExame[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([nova()]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      reqSanidade<Protocolo[]>("/protocolos?incluirInativos=true"),
      listarProdutos({ ativo: true }),
      listarTiposAplicacao(),
      reqSanidade<TipoExame[]>("/tipos-exame?incluirInativos=true"),
    ])
      .then(([p, ps, ts, es]) => {
        if (vivo) {
          setProtocolos(p);
          setProdutos(ps);
          setTipos(ts.filter((t) => t.ativo));
          setExames(es.filter((t) => t.ativo));
        }
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
    };
  }, [revisao]);
  async function enviar(path: string, body: object, method = "POST") {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await reqSanidade(path, { method, body: JSON.stringify(body) });
      setAberto(false);
      setRevisao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }
  function editar(p?: Protocolo) {
    setId(p?.publicadoEm ? null : (p?.id ?? null));
    setNome(p?.nome ?? "");
    setEtapas(
      p
        ? p.etapas.map((e) => ({
            ...e,
            produtoId: e.produtoId ?? "",
            tipoExameId: e.tipoExameId ?? "",
            tipoAplicacaoId: e.tipoAplicacaoId ?? "",
            dose: e.dose ?? "",
            unidade: e.unidade ?? "ML",
          }))
        : [nova()],
    );
    setAberto(true);
  }
  const mudar = (i: number, patch: Partial<Etapa>) =>
    setEtapas((es) => es.map((e, j) => (i === j ? { ...e, ...patch } : e)));
  return (
    <section className="rounded-xl border border-border p-4">
      <ErrorBox erro={erro} />
      <h2 className="font-semibold">Protocolos sanitários</h2>
      {podeLancar && (
        <Button className="mt-3" onClick={() => editar()}>
          Novo protocolo
        </Button>
      )}
      {protocolos.map((p) => (
        <details
          key={p.id}
          className="mt-3 rounded-lg border border-border p-3"
        >
          <summary>
            {p.nome} · v{p.versao} · {p.publicadoEm ? "Publicado" : "Rascunho"}{" "}
            · {p.ativo ? "Ativo" : "Inativo"}
          </summary>
          {p.etapas.map((e, i) => (
            <p key={i} className="mt-2 text-sm">
              Dia {e.diaRelativo}: {e.tipoAplicacaoNomeSnapshot ?? e.tipo} ·{" "}
              {produtos.find((pr) => pr.id === e.produtoId)?.nome ??
                exames.find((t) => t.id === e.tipoExameId)?.nome}{" "}
              {e.dose} {e.unidade}
            </p>
          ))}
          {podeLancar && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button secondary onClick={() => editar(p)}>
                {p.publicadoEm
                  ? "Nova versão baseada nesta"
                  : "Editar rascunho"}
              </Button>
              {!p.publicadoEm && (
                <Button
                  disabled={ocupado}
                  onClick={() => {
                    void enviar(`/protocolos/${p.id}/publicacao`, {});
                  }}
                >
                  Publicar
                </Button>
              )}
              {p.ativo && (
                <Button
                  secondary
                  disabled={ocupado}
                  onClick={() => {
                    void enviar(`/protocolos/${p.id}/inativacao`, {});
                  }}
                >
                  Inativar versão
                </Button>
              )}
            </div>
          )}
        </details>
      ))}
      {!protocolos.length && (
        <p className="mt-3 text-sm">
          Nenhum protocolo. Planejar etapas não baixa medicamentos do estoque.
        </p>
      )}
      {aberto && (
        <PainelCadastro
          aberto
          titulo={
            id ? "Editar protocolo em rascunho" : "Nova versão de protocolo"
          }
          onFechar={() => {
            if (!ocupado) setAberto(false);
          }}
          rodape={
            <Button type="submit" form="form-protocolo" disabled={ocupado}>
              Salvar rascunho
            </Button>
          }
        >
          <form
            id="form-protocolo"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(
                `/protocolos${id ? `/${id}` : ""}`,
                {
                  nome,
                  etapas: etapas.map((et) => ({
                    diaRelativo: et.diaRelativo,
                    tipo: et.tipo,
                    ...(et.tipo === "APLICACAO"
                      ? {
                          produtoId: et.produtoId,
                          tipoAplicacaoId: et.tipoAplicacaoId,
                          dose: Number(et.dose),
                          unidade: et.unidade,
                        }
                      : { tipoExameId: et.tipoExameId }),
                  })),
                },
                id ? "PATCH" : "POST",
              );
            }}
          >
            <ErrorBox erro={erro} />
            <label>
              Nome
              <input
                required
                minLength={2}
                maxLength={160}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={classeInput}
              />
            </label>
            {etapas.map((et, i) => (
              <fieldset
                key={i}
                className="grid gap-3 rounded-lg border border-border p-3"
              >
                <legend>Etapa {i + 1}</legend>
                <label>
                  Dia relativo ao início
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={et.diaRelativo}
                    onChange={(e) =>
                      mudar(i, { diaRelativo: Number(e.target.value) })
                    }
                    className={classeInput}
                  />
                </label>
                <label>
                  Ação
                  <select
                    value={et.tipo}
                    onChange={(e) =>
                      mudar(i, { tipo: e.target.value as Etapa["tipo"] })
                    }
                    className={classeInput}
                  >
                    <option value="APLICACAO">Aplicação</option>
                    <option value="EXAME">Exame</option>
                  </select>
                </label>
                {et.tipo === "APLICACAO" ? (
                  <>
                    <label>
                      Tipo de aplicação
                      <select
                        required
                        value={et.tipoAplicacaoId}
                        onChange={(e) =>
                          mudar(i, { tipoAplicacaoId: e.target.value })
                        }
                        className={classeInput}
                      >
                        <option value="">Selecione</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Produto
                      <select
                        required
                        value={et.produtoId}
                        onChange={(e) =>
                          mudar(i, {
                            produtoId: e.target.value,
                            unidade:
                              produtos.find((p) => p.id === e.target.value)
                                ?.unidade ?? "ML",
                          })
                        }
                        className={classeInput}
                      >
                        <option value="">Selecione</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantidade prevista ({et.unidade})
                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={et.dose}
                        onChange={(e) => mudar(i, { dose: e.target.value })}
                        className={classeInput}
                      />
                    </label>
                  </>
                ) : (
                  <label>
                    Tipo de exame
                    <select
                      required
                      value={et.tipoExameId}
                      onChange={(e) =>
                        mudar(i, { tipoExameId: e.target.value })
                      }
                      className={classeInput}
                    >
                      <option value="">Selecione</option>
                      {exames.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button
                  secondary
                  disabled={etapas.length === 1}
                  onClick={() =>
                    setEtapas((es) => es.filter((_, j) => i !== j))
                  }
                >
                  Remover etapa
                </Button>
              </fieldset>
            ))}
            <Button
              secondary
              onClick={() => setEtapas((es) => [...es, nova()])}
            >
              Adicionar etapa
            </Button>
          </form>
        </PainelCadastro>
      )}
    </section>
  );
}
