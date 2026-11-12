import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { PageHeader, ErrorBox, Empty } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { EsqueletoFormulario } from "../../../components/Esqueleto";
import { navegarPara } from "../../../router";
import { ModalPolitica } from "./ModalPolitica";
import { reqV4 } from "./api";
import type { CampoExame } from "../sanidade/CamposExame";
type Contexto = "NOVILHA" | "APOS_TENTATIVA" | "GESTACAO_CONHECIDA" | "OUTRO";
type Item = {
  codigo: string;
  rotulo: string;
  tipo:
    | "UTERO"
    | "OVARIO"
    | "DIAGNOSTICO"
    | "APTIDAO"
    | "RECONFIRMACAO"
    | "SEXAGEM"
    | "CONDICAO";
  campo?: string;
  contextos: Contexto[];
};
type Conduta = {
  codigo: string;
  rotulo: string;
  tipo:
    | "RETORNO"
    | "INDICAR_TENTATIVA"
    | "INDICAR_PROTOCOLO"
    | "NAO_PROSSEGUIR"
    | "OUTRO";
  exigeRevisao: boolean;
};
type Catalogo = {
  id: string;
  versao: number;
  tipoExameId: string;
  itens: Item[];
  condutas: Conduta[];
};
type TipoExame = {
  id: string;
  nome: string;
  ativo: boolean;
  contexto?: string;
  campos: CampoExame[];
};
const contextos: Record<Contexto, string> = {
  NOVILHA: "Novilha",
  APOS_TENTATIVA: "Após tentativa",
  GESTACAO_CONHECIDA: "Gestação conhecida",
  OUTRO: "Outro contexto",
};
const tiposItem: Record<Item["tipo"], string> = {
  UTERO: "Útero",
  OVARIO: "Ovários",
  DIAGNOSTICO: "Diagnóstico gestacional",
  APTIDAO: "Aptidão",
  RECONFIRMACAO: "Reconfirmação",
  SEXAGEM: "Sexagem",
  CONDICAO: "Outra condição",
};
const tiposConduta: Record<Conduta["tipo"], string> = {
  RETORNO: "Retorno",
  INDICAR_TENTATIVA: "Indicar tentativa",
  INDICAR_PROTOCOLO: "Indicar protocolo",
  NAO_PROSSEGUIR: "Não prosseguir",
  OUTRO: "Outra conduta",
};
export function CatalogoAvaliacaoConfig({
  propriedadeId,
  podeLancar,
}: {
  propriedadeId: number;
  podeLancar: boolean;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [tipos, setTipos] = useState<TipoExame[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [tipoExameId, setTipoExameId] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [condutas, setCondutas] = useState<Conduta[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const geracao = useRef(0);
  const chave = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    const g = ++geracao.current;
    setCarregando(true);
    setErro(null);
    void Promise.all([
      reqV4<{ catalogo: Catalogo | null }>(
        "/reproducao/avaliacoes/contexto/catalogo",
        undefined,
        "GET",
        propriedadeId,
      ),
      reqV4<TipoExame[]>(
        "/reproducao/tipos-exame",
        undefined,
        "GET",
        propriedadeId,
      ),
    ])
      .then(([c, t]) => {
        if (g === geracao.current) {
          setCatalogo(c.catalogo);
          setTipos(t.filter((x) => x.ativo && x.contexto !== "SANITARIO"));
        }
      })
      .catch((e) => {
        if (g === geracao.current) setErro(e.message);
      })
      .finally(() => {
        if (g === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [propriedadeId]);
  const tipo = tipos.find((t) => t.id === tipoExameId);
  const campos = (tipo?.campos ?? []).filter(
    (c) => !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo),
  );
  function abrir() {
    setTipoExameId(catalogo?.tipoExameId ?? "");
    setItens(
      catalogo?.itens.map((i) => ({ ...i, contextos: [...i.contextos] })) ?? [],
    );
    setCondutas(catalogo?.condutas.map((c) => ({ ...c })) ?? []);
    setAlterado(false);
    setErro(null);
    setAberto(true);
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setErro(null);
    if (!itens.length) {
      setErro("Configure ao menos um item de avaliação.");
      return;
    }
    if (
      itens.some(
        (i) =>
          !i.rotulo.trim() ||
          !i.codigo.trim() ||
          (["UTERO", "OVARIO", "CONDICAO"].includes(i.tipo) && !i.campo),
      )
    ) {
      setErro("Informe código, nome e campo de exame dos itens adicionais.");
      return;
    }
    const body = {
      propriedadeId,
      tipoExameId,
      versaoEsperada: catalogo?.versao ?? 0,
      itens,
      condutas,
    };
    const payload = JSON.stringify(body);
    if (chave.current?.payload !== payload)
      chave.current = { payload, id: crypto.randomUUID() };
    const g = geracao.current;
    setOcupado(true);
    try {
      const salvo = await reqV4<Catalogo>(
        "/reproducao/avaliacoes/contexto/catalogo",
        { ...body, chave: chave.current.id },
        "POST",
        propriedadeId,
      );
      if (g === geracao.current) {
        setCatalogo(salvo);
        setAberto(false);
        setAlterado(false);
        setMensagem(
          "Nova versão publicada. Avaliações existentes conservam seus itens e condutas.",
        );
      }
    } catch (e) {
      if (g === geracao.current)
        setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === geracao.current) setOcupado(false);
    }
  }
  const editarItem = (n: number, p: Partial<Item>) => {
    setItens((v) => v.map((i, k) => (k === n ? { ...i, ...p } : i)));
    setAlterado(true);
  };
  const editarConduta = (n: number, p: Partial<Conduta>) => {
    setCondutas((v) => v.map((i, k) => (k === n ? { ...i, ...p } : i)));
    setAlterado(true);
  };
  return (
    <section className="space-y-4">
      <PageHeader
        titulo="Campos e encaminhamentos da avaliação"
        descricao="Configure uma vez o que pode ser avaliado. Cada atendimento registra somente os itens realizados."
        acao={
          podeLancar && (
            <Button disabled={carregando} onClick={abrir}>
              Nova versão do catálogo
            </Button>
          )
        }
      />
      {!aberto && <ErrorBox erro={erro} />}{" "}
      {mensagem && <p role="status">{mensagem}</p>}
      {carregando ? (
        <EsqueletoFormulario label="Carregando catálogo" />
      ) : catalogo ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Versão {catalogo.versao} · publicada
          </h2>
          <p>
            Formato:{" "}
            {tipos.find((t) => t.id === catalogo.tipoExameId)?.nome ??
              "Versão de exame preservada"}
          </p>
          <h3 className="font-semibold">Itens disponíveis</h3>
          {catalogo.itens.map((i) => (
            <p key={i.codigo}>
              {i.rotulo} · {tiposItem[i.tipo]} ·{" "}
              {i.contextos.map((c) => contextos[c]).join(", ") ||
                "Sem sugestão contextual"}
            </p>
          ))}
          <h3 className="font-semibold">Condutas disponíveis</h3>
          {catalogo.condutas.length ? (
            catalogo.condutas.map((c) => (
              <p key={c.codigo}>
                {c.rotulo} · {tiposConduta[c.tipo]}
                {c.exigeRevisao ? " · exige revisão" : ""}
              </p>
            ))
          ) : (
            <p>Nenhuma conduta configurada.</p>
          )}
        </div>
      ) : (
        <Empty>Nenhum catálogo configurado neste sítio.</Empty>
      )}
      <Button
        variant="outline"
        onClick={() =>
          navegarPara(
            `/configuracoes/pecuaria/reproducao/tipos-exame?sitio=${propriedadeId}`,
          )
        }
      >
        Gerenciar formatos, unidades e opções de exame
      </Button>
      {aberto && (
        <ModalPolitica
          aberto
          titulo="Nova versão do catálogo"
          bloqueado={ocupado}
          alteracoesExternas={alterado}
          onFechar={() => {
            setAberto(false);
            setErro(null);
          }}
          rodape={(fechar) => (
            <>
              <Button variant="outline" disabled={ocupado} onClick={fechar}>
                Cancelar
              </Button>
              <Button
                form="catalogo-avaliacao"
                type="submit"
                disabled={ocupado}
              >
                {ocupado ? "Publicando…" : "Publicar nova versão"}
              </Button>
            </>
          )}
        >
          <form id="catalogo-avaliacao" onSubmit={salvar} className="space-y-4">
            <ErrorBox erro={erro} />
            <fieldset disabled={ocupado} className="min-w-0 space-y-4">
              <p>
                Versões publicadas são imutáveis. Esta publicação cria uma nova
                versão e não reescreve avaliações anteriores.
              </p>
              <label>
                Formato de exame
                <SelectCampo
                  required
                  className={classeInput}
                  value={tipoExameId}
                  onValueChange={(v) => {
                    setTipoExameId(v);
                    setItens(itens.map((i) => ({ ...i, campo: undefined })));
                    setAlterado(true);
                  }}
                >
                  <option value="">Selecione um formato ativo</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </SelectCampo>
              </label>
              {itens.map((item, n) => (
                <fieldset key={n} className="min-w-0 space-y-3 border-t pt-3">
                  <legend className="font-semibold">Item {n + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      Código do item
                      <input
                        required
                        pattern="[A-Z][A-Z0-9_]{0,59}"
                        maxLength={60}
                        className={classeInput}
                        value={item.codigo}
                        onChange={(e) =>
                          editarItem(n, {
                            codigo: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </label>
                    <label>
                      Nome do item
                      <input
                        required
                        maxLength={120}
                        className={classeInput}
                        value={item.rotulo}
                        onChange={(e) =>
                          editarItem(n, { rotulo: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Tipo de item
                      <SelectCampo
                        value={item.tipo}
                        onValueChange={(v) =>
                          editarItem(n, {
                            tipo: v as Item["tipo"],
                            campo: undefined,
                          })
                        }
                      >
                        {Object.entries(tiposItem).map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </SelectCampo>
                    </label>
                    {["UTERO", "OVARIO", "CONDICAO"].includes(item.tipo) && (
                      <label>
                        Campo do formato
                        <SelectCampo
                          required
                          value={item.campo ?? ""}
                          onValueChange={(v) =>
                            editarItem(n, { campo: v || undefined })
                          }
                        >
                          <option value="">Selecione</option>
                          {campos.map((c) => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.rotulo ?? c.codigo}
                              {c.unidade ? ` · ${c.unidade}` : ""}
                            </option>
                          ))}
                        </SelectCampo>
                      </label>
                    )}
                  </div>
                  {item.campo && (
                    <p className="text-sm text-ink-3">
                      {campos.find((c) => c.codigo === item.campo)?.tipo} ·{" "}
                      {campos
                        .find((c) => c.codigo === item.campo)
                        ?.opcoes?.join(", ") ??
                        "Resultado conforme o formato do exame"}
                    </p>
                  )}
                  <fieldset>
                    <legend>Sugerir nos contextos</legend>
                    <div className="mt-2 flex flex-wrap gap-4">
                      {Object.entries(contextos).map(([v, r]) => (
                        <label className="flex gap-2" key={v}>
                          <input
                            type="checkbox"
                            checked={item.contextos.includes(v as Contexto)}
                            onChange={(e) =>
                              editarItem(n, {
                                contextos: e.target.checked
                                  ? [...item.contextos, v as Contexto]
                                  : item.contextos.filter((c) => c !== v),
                              })
                            }
                          />
                          {r}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setItens(itens.filter((_, i) => i !== n));
                      setAlterado(true);
                    }}
                  >
                    Remover item {n + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={itens.length >= 40}
                onClick={() => {
                  setItens([
                    ...itens,
                    { codigo: "", rotulo: "", tipo: "CONDICAO", contextos: [] },
                  ]);
                  setAlterado(true);
                }}
              >
                Adicionar item de avaliação
              </Button>
              {condutas.map((c, n) => (
                <fieldset key={n} className="min-w-0 space-y-3 border-t pt-3">
                  <legend className="font-semibold">Conduta {n + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      Código da conduta
                      <input
                        required
                        pattern="[A-Z][A-Z0-9_]{0,59}"
                        maxLength={60}
                        className={classeInput}
                        value={c.codigo}
                        onChange={(e) =>
                          editarConduta(n, {
                            codigo: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </label>
                    <label>
                      Nome da conduta
                      <input
                        required
                        maxLength={120}
                        className={classeInput}
                        value={c.rotulo}
                        onChange={(e) =>
                          editarConduta(n, { rotulo: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Tipo de conduta
                      <SelectCampo
                        value={c.tipo}
                        onValueChange={(v) =>
                          editarConduta(n, { tipo: v as Conduta["tipo"] })
                        }
                      >
                        {Object.entries(tiposConduta).map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </SelectCampo>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c.exigeRevisao}
                        onChange={(e) =>
                          editarConduta(n, { exigeRevisao: e.target.checked })
                        }
                      />
                      Exigir revisão
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCondutas(condutas.filter((_, i) => i !== n));
                      setAlterado(true);
                    }}
                  >
                    Remover conduta {n + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={condutas.length >= 30}
                onClick={() => {
                  setCondutas([
                    ...condutas,
                    {
                      codigo: "",
                      rotulo: "",
                      tipo: "OUTRO",
                      exigeRevisao: false,
                    },
                  ]);
                  setAlterado(true);
                }}
              >
                Adicionar conduta
              </Button>
            </fieldset>
          </form>
        </ModalPolitica>
      )}
    </section>
  );
}
