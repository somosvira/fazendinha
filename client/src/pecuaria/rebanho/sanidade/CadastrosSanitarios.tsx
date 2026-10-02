import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import {
  listarTiposAplicacao,
  reqSanidade,
  salvarTipoAplicacao,
  type TipoAplicacao,
} from "./api";
import { ProtocolosCadastro } from "./ProtocolosCadastro";

export type Doenca = { id: string; nome: string; ativo: boolean };
export type TipoExame = {
  id: string;
  nome: string;
  ativo: boolean;
  tipoResultado: "TEXTO" | "NUMERO" | "OPCAO";
  unidade: string | null;
  opcoes: string[] | null;
};
export function CadastrosSanitarios({ podeLancar }: { podeLancar: boolean }) {
  const [tipos, setTipos] = useState<TipoAplicacao[]>([]);
  const [doencas, setDoencas] = useState<Doenca[]>([]);
  const [exames, setExames] = useState<TipoExame[]>([]);
  const [versao, setVersao] = useState(0);
  const [painel, setPainel] = useState<{
    tipo: "aplicacao" | "doenca" | "exame";
    id?: string;
  } | null>(null);
  const [nome, setNome] = useState("");
  const [formato, setFormato] = useState<TipoExame["tipoResultado"]>("TEXTO");
  const [unidade, setUnidade] = useState("");
  const [opcoes, setOpcoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([
      listarTiposAplicacao(),
      reqSanidade<Doenca[]>("/doencas?incluirInativos=true"),
      reqSanidade<TipoExame[]>("/tipos-exame?incluirInativos=true"),
    ])
      .then(([t, d, e]) => {
        if (vivo) {
          setTipos(t);
          setDoencas(d);
          setExames(e);
          setErro(null);
        }
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [versao]);
  async function executar(fn: () => Promise<unknown>) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      setVersao((v) => v + 1);
      setPainel(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }
  function salvarCadastro() {
    if (!painel) return Promise.resolve();
    if (painel.tipo === "aplicacao")
      return salvarTipoAplicacao({ nome }, painel.id);
    const recurso = painel.tipo === "doenca" ? "doencas" : "tipos-exame";
    const body =
      painel.tipo === "doenca"
        ? { nome }
        : {
            nome,
            tipoResultado: formato,
            unidade: unidade || null,
            opcoes:
              formato === "OPCAO"
                ? opcoes
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : null,
          };
    return reqSanidade(`/${recurso}${painel.id ? `/${painel.id}` : ""}`, {
      method: painel.id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
  }
  function abrir(
    tipo: NonNullable<typeof painel>["tipo"],
    item?: TipoAplicacao | Doenca | TipoExame,
  ) {
    setPainel({ tipo, id: item?.id });
    setNome(item?.nome ?? "");
    const exame =
      tipo === "exame" ? (item as TipoExame | undefined) : undefined;
    setFormato(exame?.tipoResultado ?? "TEXTO");
    setOpcoes(exame?.opcoes?.join("\n") ?? "");
    setUnidade(exame?.unidade ?? "");
  }
  return (
    <section className="mt-5 grid gap-5">
      <ErrorBox erro={erro} />
      <ProtocolosCadastro podeLancar={podeLancar} />
      {carregando && <p>Carregando cadastros sanitários…</p>}
      {erro && (
        <Button secondary onClick={() => setVersao((v) => v + 1)}>
          Tentar novamente
        </Button>
      )}
      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Tipos de aplicação</h2>
        <p className="mt-1 text-sm text-ink-3">
          Descrevem a finalidade, sem determinar estoque, Serviço ou carência.
          Renomear não altera os nomes preservados nos fatos e protocolos
          publicados.
        </p>
        {podeLancar && (
          <Button className="mt-3" onClick={() => abrir("aplicacao")}>
            Novo tipo de aplicação
          </Button>
        )}
        {tipos.map((t) => (
          <div
            key={t.id}
            className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"
          >
            <span>
              {t.nome} · {t.ativo ? "Ativo" : "Inativo"}
            </span>
            {podeLancar && (
              <div className="flex gap-2">
                <Button secondary onClick={() => abrir("aplicacao", t)}>
                  Renomear
                </Button>
                <Button
                  secondary
                  disabled={ocupado}
                  onClick={() => {
                    void executar(() =>
                      salvarTipoAplicacao({ ativo: !t.ativo }, t.id),
                    );
                  }}
                >
                  {t.ativo ? "Inativar" : "Ativar"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Doenças</h2>
        {podeLancar && (
          <Button className="mt-3" onClick={() => abrir("doenca")}>
            Nova doença
          </Button>
        )}
        {doencas.length ? (
          doencas.map((d) => (
            <div
              key={d.id}
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"
            >
              <span>
                {d.nome} · {d.ativo ? "Ativa" : "Inativa"}
              </span>
              {podeLancar && (
                <div className="flex gap-2">
                  <Button secondary onClick={() => abrir("doenca", d)}>
                    Editar
                  </Button>
                  <Button
                    secondary
                    disabled={ocupado}
                    onClick={() => {
                      void executar(() =>
                        reqSanidade(`/doencas/${d.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ ativo: !d.ativo }),
                        }),
                      );
                    }}
                  >
                    {d.ativo ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="mt-3 text-sm text-ink-3">Nenhuma doença cadastrada.</p>
        )}
      </div>
      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Tipos de exame</h2>
        {podeLancar && (
          <Button className="mt-3" onClick={() => abrir("exame")}>
            Novo tipo de exame
          </Button>
        )}
        {exames.length ? (
          exames.map((e) => (
            <div
              key={e.id}
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"
            >
              <span>
                {e.nome} · {e.tipoResultado} {e.unidade ?? ""} ·{" "}
                {e.ativo ? "Ativo" : "Inativo"}
              </span>
              {podeLancar && (
                <div className="flex gap-2">
                  <Button secondary onClick={() => abrir("exame", e)}>
                    Editar
                  </Button>
                  <Button
                    secondary
                    disabled={ocupado}
                    onClick={() => {
                      void executar(() =>
                        reqSanidade(`/tipos-exame/${e.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ ativo: !e.ativo }),
                        }),
                      );
                    }}
                  >
                    {e.ativo ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="mt-3 text-sm text-ink-3">
            Nenhum tipo de exame cadastrado.
          </p>
        )}
      </div>
      {painel && (
        <PainelCadastro
          aberto
          titulo={
            painel.tipo === "aplicacao"
              ? "Tipo de aplicação"
              : painel.tipo === "doenca"
                ? "Doença"
                : "Tipo de exame"
          }
          onFechar={() => {
            if (!ocupado) setPainel(null);
          }}
          rodape={
            <>
              <Button
                secondary
                disabled={ocupado}
                onClick={() => setPainel(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="cadastro-sanitario"
                disabled={ocupado}
              >
                Salvar
              </Button>
            </>
          }
        >
          <form
            id="cadastro-sanitario"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(salvarCadastro);
            }}
          >
            <ErrorBox erro={erro} />
            <CampoFormulario id="cad-san-nome" rotulo="Nome" obrigatorio>
              {(p) => (
                <input
                  {...p}
                  required
                  minLength={2}
                  maxLength={120}
                  className={classeInput}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              )}
            </CampoFormulario>
            {painel.tipo === "exame" && (
              <>
                <CampoFormulario
                  id="cad-san-formato"
                  rotulo="Formato do resultado"
                >
                  {(p) => (
                    <select
                      {...p}
                      className={classeInput}
                      value={formato}
                      onChange={(e) =>
                        setFormato(e.target.value as typeof formato)
                      }
                    >
                      <option value="TEXTO">Texto</option>
                      <option value="NUMERO">Número</option>
                      <option value="OPCAO">Opção</option>
                    </select>
                  )}
                </CampoFormulario>
                <CampoFormulario
                  id="cad-san-unidade"
                  rotulo="Unidade (opcional)"
                >
                  {(p) => (
                    <input
                      {...p}
                      className={classeInput}
                      value={unidade}
                      onChange={(e) => setUnidade(e.target.value)}
                    />
                  )}
                </CampoFormulario>
                {formato === "OPCAO" && (
                  <CampoFormulario
                    id="cad-san-opcoes"
                    rotulo="Uma opção por linha"
                    obrigatorio
                  >
                    {(p) => (
                      <textarea
                        {...p}
                        required
                        className={classeInput}
                        value={opcoes}
                        onChange={(e) => setOpcoes(e.target.value)}
                      />
                    )}
                  </CampoFormulario>
                )}
              </>
            )}
          </form>
        </PainelCadastro>
      )}
    </section>
  );
}
