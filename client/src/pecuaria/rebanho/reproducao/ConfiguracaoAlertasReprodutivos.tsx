import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { PageHeader, ErrorBox, Empty } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { EsqueletoFormulario } from "../../../components/Esqueleto";
import { requisicaoAlertas } from "../alertas/api";
import { ModalPolitica } from "./ModalPolitica";
import { formatBRDateISO } from "../../../lib/hoje";
const contratos = {
  TENTATIVA_APOS_PREPARO: {
    titulo: "Tentativa após preparo",
    referencia: "PREPARO_CONCLUIDO",
    nomeReferencia: "Preparo concluído",
    resolucao: "TENTATIVA_REALIZADA",
    nomeResolucao: "Tentativa realizada",
  },
  APTA_SEM_ENCAMINHAMENTO: {
    titulo: "Apta sem encaminhamento",
    referencia: "EXAME_APTIDAO",
    nomeReferencia: "Exame de aptidão",
    resolucao: "ENCAMINHAMENTO_EXPLICITO",
    nomeResolucao: "Encaminhamento explícito",
  },
  AVALIACAO_NECESSARIA: {
    titulo: "Avaliação necessária",
    referencia: "INICIO_CICLO",
    nomeReferencia: "Início do ciclo",
    resolucao: "AVALIACAO_REALIZADA",
    nomeResolucao: "Avaliação realizada",
  },
  AVALIACAO_DESATUALIZADA: {
    titulo: "Avaliação desatualizada",
    referencia: "ULTIMA_AVALIACAO",
    nomeReferencia: "Última avaliação",
    resolucao: "AVALIACAO_REALIZADA",
    nomeResolucao: "Avaliação realizada",
  },
} as const;
type Tipo = keyof typeof contratos;
type Regra = {
  tipo: Tipo;
  publico: "FEMEAS";
  referencia: string;
  intervalo: number;
  unidade: "DIAS";
  antecedencia: number;
  tolerancia: number;
  resolucao: string;
};
type Politica = {
  id: string;
  versao: number;
  vigenteDesde: string;
  parametros: { versao: 1; regras: Regra[] };
};
export function ConfiguracaoAlertasReprodutivos({
  propriedadeId,
  podeLancar,
}: {
  propriedadeId: number;
  podeLancar: boolean;
}) {
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [vigencia, setVigencia] = useState("");
  const [aberto, setAberto] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const chave = useRef<{ payload: string; id: string } | null>(null);
  const geracao = useRef(0);
  useEffect(() => {
    let atual = true;
    geracao.current++;
    setCarregando(true);
    setErro(null);
    void requisicaoAlertas<Politica[]>(
      "/reproducao/politicas",
      undefined,
      undefined,
      propriedadeId,
    )
      .then((p) => {
        if (atual) setPoliticas(p);
      })
      .catch((e) => {
        if (atual) setErro(e.message);
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
      geracao.current++;
    };
  }, [propriedadeId]);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setErro(null);
    if (!vigencia) {
      setErro("Informe a vigência.");
      return;
    }
    if (
      regras.some((r) =>
        [r.intervalo, r.antecedencia, r.tolerancia].some(
          (n) => !Number.isInteger(n) || n < 0 || n > 1000,
        ),
      )
    ) {
      setErro("Informe todos os prazos em dias inteiros entre 0 e 1000.");
      return;
    }
    const body = {
      propriedadeId,
      vigenteDesde: vigencia,
      parametros: { versao: 1 as const, regras },
    };
    const payload = JSON.stringify(body);
    if (chave.current?.payload !== payload)
      chave.current = { payload, id: crypto.randomUUID() };
    const g = geracao.current;
    setOcupado(true);
    try {
      const salvo = await requisicaoAlertas<Politica>(
        "/reproducao/politicas",
        {
          method: "POST",
          body: JSON.stringify({ ...body, chave: chave.current.id }),
        },
        undefined,
        propriedadeId,
      );
      if (g === geracao.current) {
        setPoliticas((p) => [salvo, ...p]);
        setAberto(false);
        setAlterado(false);
        setMensagem(
          "Nova versão registrada. Necessidades existentes conservam os parâmetros adotados.",
        );
      }
    } catch (e) {
      if (g === geracao.current)
        setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === geracao.current) setOcupado(false);
    }
  }
  return (
    <section className="space-y-4">
      <PageHeader
        titulo="Alertas operacionais da reprodução"
        descricao="Defina quando acompanhar e o fato que resolve cada necessidade."
        acao={
          podeLancar && (
            <Button
              disabled={carregando}
              onClick={() => {
                setRegras(
                  politicas[0]?.parametros.regras.map((r) => ({ ...r })) ?? [],
                );
                setVigencia("");
                setAlterado(false);
                setErro(null);
                setAberto(true);
              }}
            >
              Nova versão de alertas
            </Button>
          )
        }
      />
      {!aberto && <ErrorBox erro={erro} />}{" "}
      {mensagem && <p role="status">{mensagem}</p>}
      {carregando ? (
        <EsqueletoFormulario label="Carregando regras de alerta" />
      ) : !politicas.length ? (
        <Empty>
          Nenhuma regra operacional configurada. Prazos clínicos não são
          presumidos.
        </Empty>
      ) : (
        politicas.map((p) => (
          <article key={p.id} className="space-y-2 border-t py-3">
            <h2 className="font-semibold">
              Versão {p.versao} · vigente desde{" "}
              {formatBRDateISO(p.vigenteDesde)}
            </h2>
            {p.parametros.regras.length ? (
              p.parametros.regras.map((r) => (
                <p key={r.tipo}>
                  {contratos[r.tipo].titulo}: {r.intervalo} dias desde{" "}
                  {contratos[r.tipo].nomeReferencia.toLocaleLowerCase("pt-BR")}{" "}
                  · antecedência {r.antecedencia} · tolerância {r.tolerancia} ·
                  resolução:{" "}
                  {contratos[r.tipo].nomeResolucao.toLocaleLowerCase("pt-BR")}
                </p>
              ))
            ) : (
              <p>Sem regras para novas adoções.</p>
            )}
          </article>
        ))
      )}
      <p className="text-sm text-ink-3">
        DG e reconfirmações usam a política de acompanhamento. Etapas,
        dispositivos e retornos usam seus compromissos registrados.
      </p>
      {aberto && (
        <ModalPolitica
          aberto
          titulo="Nova versão de alertas"
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
                type="submit"
                form="politica-alertas-reproducao"
                disabled={ocupado}
              >
                {ocupado ? "Registrando…" : "Registrar versão de alertas"}
              </Button>
            </>
          )}
        >
          <form
            id="politica-alertas-reproducao"
            onSubmit={salvar}
            className="space-y-4"
          >
            <ErrorBox erro={erro} />
            <fieldset disabled={ocupado} className="min-w-0 space-y-4">
              <label>
                Vigente desde
                <DatePicker
                  required
                  value={vigencia}
                  onChange={(v) => {
                    setVigencia(v);
                    setAlterado(true);
                  }}
                />
              </label>
              <p>
                As regras se aplicam às novas adoções. Desmarcar uma regra não
                encerra necessidades já existentes.
              </p>
              {(
                Object.entries(contratos) as Array<
                  [Tipo, (typeof contratos)[Tipo]]
                >
              ).map(([tipo, c]) => {
                const r = regras.find((r) => r.tipo === tipo);
                return (
                  <fieldset
                    key={tipo}
                    className="min-w-0 space-y-3 border-t pt-3"
                  >
                    <legend>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r}
                          onChange={(e) => {
                            setRegras((v) =>
                              e.target.checked
                                ? [
                                    ...v,
                                    {
                                      tipo,
                                      publico: "FEMEAS",
                                      referencia: c.referencia,
                                      resolucao: c.resolucao,
                                      unidade: "DIAS",
                                      intervalo: NaN,
                                      antecedencia: NaN,
                                      tolerancia: NaN,
                                    },
                                  ]
                                : v.filter((r) => r.tipo !== tipo),
                            );
                            setAlterado(true);
                          }}
                        />
                        {c.titulo}
                      </label>
                    </legend>
                    {r && (
                      <>
                        <p className="text-sm">
                          Público: fêmeas · referência: {c.nomeReferencia} ·
                          resolução: {c.nomeResolucao}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {(
                            [
                              ["intervalo", "Intervalo (dias)"],
                              ["antecedencia", "Antecedência (dias)"],
                              ["tolerancia", "Tolerância (dias)"],
                            ] as const
                          ).map(([campo, rotulo]) => (
                            <label key={campo}>
                              {rotulo}
                              <input
                                className={classeInput}
                                type="number"
                                min={0}
                                max={1000}
                                step={1}
                                required
                                value={
                                  Number.isFinite(r[campo]) ? r[campo] : ""
                                }
                                onChange={(e) => {
                                  setRegras((v) =>
                                    v.map((x) =>
                                      x.tipo === tipo
                                        ? {
                                            ...x,
                                            [campo]:
                                              e.target.value === ""
                                                ? NaN
                                                : Number(e.target.value),
                                          }
                                        : x,
                                    ),
                                  );
                                  setAlterado(true);
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </fieldset>
                );
              })}
            </fieldset>
          </form>
        </ModalPolitica>
      )}
    </section>
  );
}
