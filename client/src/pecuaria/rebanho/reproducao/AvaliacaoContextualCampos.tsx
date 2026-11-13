import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { DatePicker } from "../../../components/DatePicker";
import { ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { CamposResultadoExame, type CampoExame } from "../sanidade/CamposExame";
import { CamposAptidao } from "./CamposAptidao";
import {
  consultarCatalogoAvaliacao,
  type AvaliacaoContextualInput,
  type DadosAvaliacaoContextual,
  type CatalogoAvaliacao,
  type ContextoAvaliacao,
  type EstadoItemAvaliacao,
  type ItemCatalogoAvaliacao,
  type VinculoConclusaoInput,
} from "./avaliacao-contextual-api";

export type DadosFormularioContextual = DadosAvaliacaoContextual;
export type NecessidadeSelecionavel = {
  id: string;
  finalidade: string;
  previstaPara?: string | null;
};

/** A adoção conserva apenas observações já informadas; não escolhe conclusões clínicas. */
export function adotarCatalogoAvaliacao(
  catalogo: CatalogoAvaliacao,
  dados: DadosFormularioContextual,
): AvaliacaoContextualInput {
  return {
    catalogoId: catalogo.id,
    itens: catalogo.itens.map((item) => {
      const valor = item.campo
        ? dados.resultados?.find((r) => r.campo === item.campo)?.valor
        : item.tipo === "APTIDAO"
          ? dados.resultadoAptidao
          : item.tipo === "SEXAGEM"
            ? dados.sexoFetal ||
              (dados.resultado === "INCONCLUSIVO" &&
              dados.finalidade === "SEXAGEM"
                ? "INCONCLUSIVO"
                : null)
            : item.tipo === "RECONFIRMACAO" &&
                dados.finalidade === "RECONFIRMACAO"
              ? dados.resultado
              : item.tipo === "DIAGNOSTICO" &&
                  !["RECONFIRMACAO", "SEXAGEM"].includes(
                    dados.finalidade ?? "",
                  ) &&
                  ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(
                    dados.resultado ?? "",
                  )
                ? dados.resultado
                : null;
      const estado: EstadoItemAvaliacao =
        valor === "INCONCLUSIVO"
          ? "INCONCLUSIVO"
          : valor != null && valor !== "" && valor !== "NAO_AVALIADO"
            ? "CONCLUSIVO"
            : "NAO_AVALIADO";
      return { codigo: item.codigo, estado };
    }),
    condutas: [],
  };
}

export function AvaliacaoContextualCampos({
  propriedadeId,
  contexto: contextoInicial,
  dados,
  campos = [],
  necessidades = [],
  onChange,
  onTipoExame,
  disabled = false,
  identificacao,
  ocultarSemCatalogo = false,
}: {
  propriedadeId: number;
  contexto: ContextoAvaliacao;
  dados: DadosFormularioContextual;
  campos?: CampoExame[];
  necessidades?: NecessidadeSelecionavel[];
  onChange: (patch: Partial<DadosFormularioContextual>) => void;
  onTipoExame: (tipoExameId: string) => void | Promise<void>;
  disabled?: boolean;
  identificacao?: string;
  ocultarSemCatalogo?: boolean;
}) {
  const [contexto, setContexto] = useState(contextoInicial);
  const [catalogo, setCatalogo] = useState<CatalogoAvaliacao | null>(null);
  const [sugeridos, setSugeridos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [adotando, setAdotando] = useState(false);
  useEffect(() => {
    setContexto(contextoInicial);
  }, [contextoInicial]);
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    consultarCatalogoAvaliacao(propriedadeId, contexto)
      .then((r) => {
        if (ativo) {
          setCatalogo(r.catalogo);
          setSugeridos(r.sugeridos);
        }
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [propriedadeId, contexto, revisao]);
  const valor = dados.avaliacaoContextual;
  const compativel = !!catalogo && valor?.catalogoId === catalogo.id;
  const rotulo = (nome: string) =>
    identificacao ? `${nome} · ${identificacao}` : nome;
  function mudar(patch: Partial<AvaliacaoContextualInput>) {
    if (valor)
      onChange({
        avaliacaoContextual: { ...valor, ...patch },
        revisaoContextual: undefined,
      });
  }
  function mudarItem(item: ItemCatalogoAvaliacao, estado: EstadoItemAvaliacao) {
    if (!valor) return;
    const patch: Partial<DadosFormularioContextual> = {
      avaliacaoContextual: {
        ...valor,
        itens: valor.itens.map((i) =>
          i.codigo === item.codigo ? { ...i, estado } : i,
        ),
      },
      revisaoContextual: undefined,
    };
    if (item.campo && estado !== "CONCLUSIVO")
      patch.resultados = (dados.resultados ?? []).filter(
        (r) => r.campo !== item.campo,
      );
    if (item.tipo === "APTIDAO") {
      patch.resultadoAptidao =
        estado === "INCONCLUSIVO" ? "INCONCLUSIVO" : null;
      if (estado === "NAO_AVALIADO") patch.retornoAptidaoEm = null;
    }
    if (item.tipo === "SEXAGEM") {
      patch.sexoFetal = null;
      if (
        estado === "INCONCLUSIVO" &&
        !["POSITIVO", "NEGATIVO", "RECONFIRMACAO"].includes(
          dados.resultado ?? "",
        )
      ) {
        patch.resultado = "INCONCLUSIVO";
        patch.finalidade = "SEXAGEM";
      } else if (dados.finalidade === "SEXAGEM") {
        patch.resultado = "NAO_AVALIADO";
        patch.realizadoSemDG = true;
      }
    }
    if (["DIAGNOSTICO", "RECONFIRMACAO"].includes(item.tipo)) {
      patch.resultado =
        estado === "INCONCLUSIVO" ? "INCONCLUSIVO" : "NAO_AVALIADO";
      patch.finalidade = item.tipo;
      patch.realizadoSemDG = estado !== "INCONCLUSIVO";
    }
    onChange(patch);
  }
  function campoConclusao(
    n: NecessidadeSelecionavel,
  ): VinculoConclusaoInput["campo"] {
    return n.finalidade === "SEXAGEM"
      ? "SEXO_FETAL"
      : ["APTIDAO", "APTIDAO_REPRODUTIVA"].includes(n.finalidade)
        ? "APTIDAO_REPRODUTIVA"
        : "CONCLUSAO_GESTACIONAL";
  }
  if (ocultarSemCatalogo && !carregando && !erro && !catalogo && !dados.avaliacaoContextual) return null;
  return (
    <fieldset
      disabled={disabled || adotando}
      className="grid gap-3 border-t border-border pt-4"
    >
      <legend className="font-semibold">
        Itens e encaminhamentos da avaliação
      </legend>
      <ErrorBox erro={erro} />
      {erro && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRevisao((v) => v + 1)}
        >
          Consultar catálogo novamente
        </Button>
      )}
      {carregando ? (
        <p role="status">Consultando o catálogo do sítio…</p>
      ) : !erro && !catalogo ? (
        <p className="text-sm text-ink-3">
          O sítio ainda não tem catálogo de avaliação contextual. O exame
          convencional continua disponível.
        </p>
      ) : (
        catalogo && (
          <>
            {!valor ? (
              <>
                <p className="text-sm text-ink-3">
                  Escolha itens e registre condutas separadas do resultado. O
                  contexto sugere itens, sem exigir todos.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setAdotando(true);
                    try {
                      const consulta = onTipoExame(catalogo.tipoExameId);
                      if (consulta) await consulta;
                      onChange({
                        avaliacaoContextual: adotarCatalogoAvaliacao(
                          catalogo,
                          dados,
                        ),
                        revisaoContextual: undefined,
                        resultados: (dados.resultados ?? []).filter((r) =>
                          catalogo.itens.some((i) => i.campo === r.campo),
                        ),
                        realizadoSemDG:
                          !dados.resultado ||
                          dados.resultado === "NAO_AVALIADO",
                        ...(!dados.resultado
                          ? { resultado: "NAO_AVALIADO" }
                          : {}),
                      });
                    } catch (e) {
                      setErro(e instanceof Error ? e.message : String(e));
                    } finally {
                      setAdotando(false);
                    }
                  }}
                >
                  {adotando
                    ? "Conferindo tipo do exame…"
                    : `Usar catálogo do sítio · versão ${catalogo.versao}`}
                </Button>
              </>
            ) : !compativel ? (
              <p role="alert">
                O catálogo mudou. Reabra o atendimento para conferir os itens e
                a versão atuais antes de registrar.
              </p>
            ) : (
              <>
                <label>
                  {rotulo("Contexto da avaliação")}
                  <SelectCampo
                    value={contexto}
                    onValueChange={(v) => setContexto(v as ContextoAvaliacao)}
                  >
                    <option value="NOVILHA">Novilha</option>
                    <option value="APOS_TENTATIVA">Após tentativa</option>
                    <option value="GESTACAO_CONHECIDA">
                      Gestação conhecida
                    </option>
                    <option value="OUTRO">Outro contexto</option>
                  </SelectCampo>
                </label>
                <p className="text-sm text-ink-3">
                  Não avaliado não significa negativo. As conclusões de gestação
                  e aptidão são independentes.
                </p>
                {catalogo.itens.map((item) => {
                  const v = valor.itens.find(
                    (i) => i.codigo === item.codigo,
                  ) ?? { codigo: item.codigo, estado: "NAO_AVALIADO" as const };
                  const campo = campos.find((c) => c.codigo === item.campo);
                  return (
                    <div
                      key={item.codigo}
                      className="grid gap-3 border-t border-border py-3"
                    >
                      <label className="grid gap-2">
                        <span>
                          {item.rotulo}{" "}
                          {sugeridos.includes(item.codigo) && (
                            <Pill>Sugerido pelo contexto</Pill>
                          )}
                        </span>
                        <SelectCampo
                          aria-label={rotulo(`Estado de ${item.rotulo}`)}
                          value={v.estado}
                          onValueChange={(e) =>
                            mudarItem(item, e as EstadoItemAvaliacao)
                          }
                        >
                          <option value="NAO_AVALIADO">Não avaliado</option>
                          <option value="INCONCLUSIVO">Inconclusivo</option>
                          <option value="CONCLUSIVO">Conclusivo</option>
                        </SelectCampo>
                      </label>
                      {v.estado === "CONCLUSIVO" && (
                        <>
                          {item.campo &&
                            (campo ? (
                              <CamposResultadoExame
                                campos={[campo]}
                                valores={(dados.resultados ?? []).filter(
                                  (r) => r.campo === item.campo,
                                )}
                                onChange={(resultados) =>
                                  onChange({
                                    resultados: [
                                      ...(dados.resultados ?? []).filter(
                                        (r) => r.campo !== item.campo,
                                      ),
                                      ...resultados,
                                    ],
                                  })
                                }
                              />
                            ) : (
                              <p role="alert">
                                O campo deste item não está disponível no
                                formato do exame selecionado.
                              </p>
                            ))}
                          {["DIAGNOSTICO", "RECONFIRMACAO"].includes(
                            item.tipo,
                          ) && (
                            <label>
                              {rotulo(`Conclusão de ${item.rotulo}`)}
                              <SelectCampo
                                value={
                                  [
                                    "POSITIVO",
                                    "NEGATIVO",
                                    "RECONFIRMACAO",
                                  ].includes(dados.resultado ?? "")
                                    ? dados.resultado
                                    : ""
                                }
                                onValueChange={(r) =>
                                  onChange({
                                    resultado: r || "NAO_AVALIADO",
                                    finalidade: item.tipo,
                                    realizadoSemDG: !r,
                                    ...(r === "NEGATIVO"
                                      ? { sexoFetal: null }
                                      : {}),
                                  })
                                }
                              >
                                <option value="">Informe a conclusão</option>
                                <option
                                  value={
                                    item.tipo === "RECONFIRMACAO"
                                      ? "RECONFIRMACAO"
                                      : "POSITIVO"
                                  }
                                >
                                  Gestação confirmada
                                </option>
                                <option value="NEGATIVO">
                                  Gestação não confirmada
                                </option>
                              </SelectCampo>
                            </label>
                          )}
                          {item.tipo === "SEXAGEM" && (
                            <label>
                              {rotulo("Sexo fetal observado")}
                              <SelectCampo
                                value={dados.sexoFetal ?? ""}
                                onValueChange={(sexoFetal) =>
                                  onChange({
                                    sexoFetal: sexoFetal || null,
                                    ...(sexoFetal &&
                                    ![
                                      "POSITIVO",
                                      "NEGATIVO",
                                      "RECONFIRMACAO",
                                    ].includes(dados.resultado ?? "")
                                      ? {
                                          resultado: "SEXAGEM",
                                          finalidade: "SEXAGEM",
                                          realizadoSemDG: false,
                                        }
                                      : {}),
                                  })
                                }
                              >
                                <option value="">Informe o sexo fetal</option>
                                <option value="F">Fêmea</option>
                                <option value="M">Macho</option>
                              </SelectCampo>
                            </label>
                          )}
                          {item.tipo === "APTIDAO" && (
                            <CamposAptidao
                              dados={dados}
                              onChange={(patch) =>
                                onChange({
                                  ...patch,
                                  ...(patch.resultadoAptidao === "INCONCLUSIVO"
                                    ? {
                                        avaliacaoContextual: {
                                          ...valor,
                                          itens: valor.itens.map((i) =>
                                            i.codigo === item.codigo
                                              ? { ...i, estado: "INCONCLUSIVO" }
                                              : i,
                                          ),
                                        },
                                      }
                                    : {}),
                                })
                              }
                            />
                          )}
                        </>
                      )}
                      {v.estado !== "NAO_AVALIADO" && (
                        <label>
                          {rotulo(`Observação de ${item.rotulo} (opcional)`)}
                          <textarea
                            className={classeInput}
                            maxLength={1000}
                            value={v.observacao ?? ""}
                            onChange={(e) =>
                              mudar({
                                itens: valor.itens.map((i) =>
                                  i.codigo === item.codigo
                                    ? { ...i, observacao: e.target.value }
                                    : i,
                                ),
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
                {catalogo.condutas.length > 0 && (
                  <fieldset className="grid gap-3">
                    <legend className="mb-2 font-semibold">
                      Encaminhamentos
                    </legend>
                    {catalogo.condutas.map((c) => {
                      const v = valor.condutas.find(
                        (v) => v.codigo === c.codigo,
                      );
                      const atualizar = (
                        patch: Partial<
                          AvaliacaoContextualInput["condutas"][number]
                        >,
                      ) =>
                        mudar({
                          condutas: valor.condutas.map((i) =>
                            i.codigo === c.codigo ? { ...i, ...patch } : i,
                          ),
                        });
                      return (
                        <div key={c.codigo} className="grid gap-2">
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={!!v}
                              onCheckedChange={(checked) =>
                                mudar({
                                  condutas:
                                    checked === true
                                      ? [
                                          ...valor.condutas,
                                          { codigo: c.codigo },
                                        ]
                                      : valor.condutas.filter(
                                          (i) => i.codigo !== c.codigo,
                                        ),
                                })
                              }
                            />
                            {c.rotulo}
                          </label>
                          {v && (
                            <div className="grid gap-2 pl-6">
                              {c.tipo === "RETORNO" && (
                                <label>
                                  {rotulo(`Data de ${c.rotulo}`)}
                                  <DatePicker
                                    value={v.retornoEm ?? ""}
                                    onChange={(retornoEm) =>
                                      atualizar({
                                        retornoEm: retornoEm || null,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {[
                                "INDICAR_TENTATIVA",
                                "INDICAR_PROTOCOLO",
                                "NAO_PROSSEGUIR",
                              ].includes(c.tipo) && (
                                <label>
                                  {rotulo(`Destino de ${c.rotulo}`)}
                                  <input
                                    className={classeInput}
                                    required
                                    maxLength={300}
                                    value={v.destino ?? ""}
                                    onChange={(e) =>
                                      atualizar({ destino: e.target.value })
                                    }
                                  />
                                </label>
                              )}
                              {c.exigeRevisao && (
                                <label>
                                  {rotulo(`Revisar ${c.rotulo} em`)}
                                  <DatePicker
                                    value={v.revisaoEm ?? ""}
                                    onChange={(revisaoEm) =>
                                      atualizar({
                                        revisaoEm: revisaoEm || null,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              <label>
                                {rotulo(`Observação de ${c.rotulo} (opcional)`)}
                                <textarea
                                  className={classeInput}
                                  maxLength={1000}
                                  value={v.observacao ?? ""}
                                  onChange={(e) =>
                                    atualizar({ observacao: e.target.value })
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </fieldset>
                )}
                {necessidades.length > 0 && (
                  <fieldset className="grid gap-2">
                    <legend className="mb-2 font-semibold">
                      Cuidados que este atendimento deve resolver
                    </legend>
                    <p className="text-sm text-ink-3">
                      Selecione somente os cuidados atendidos por uma conclusão
                      compatível. Os demais permanecem pendentes.
                    </p>
                    {necessidades.map((n) => (
                      <label className="flex items-center gap-2" key={n.id}>
                        <Checkbox
                          checked={
                            !!dados.vinculosConclusao?.some(
                              (v) => v.demandaId === n.id,
                            )
                          }
                          onCheckedChange={(checked) =>
                            onChange({
                              vinculosConclusao:
                                checked === true
                                  ? [
                                      ...(dados.vinculosConclusao ?? []),
                                      {
                                        demandaId: n.id,
                                        campo: campoConclusao(n),
                                      },
                                    ]
                                  : (dados.vinculosConclusao ?? []).filter(
                                      (v) => v.demandaId !== n.id,
                                    ),
                            })
                          }
                        />
                        {n.finalidade === "DIAGNOSTICO"
                          ? "Diagnóstico"
                          : n.finalidade === "RECONFIRMACAO"
                            ? "Reconfirmação"
                            : n.finalidade === "SEXAGEM"
                              ? "Sexagem"
                              : "Avaliação de aptidão"}
                        {n.previstaPara
                          ? ` · ${n.previstaPara}`
                          : " · sem prazo definido"}
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}
          </>
        )
      )}
    </fieldset>
  );
}
