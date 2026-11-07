import { useEffect, useRef, useState } from "react";
import { ModalPolitica } from "./ModalPolitica";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { reqV4 } from "./api";
import {
  FormularioAcompanhamento,
  type RegistroPoliticaAcompanhamento,
  type TipoExameAcompanhamento,
} from "./FormularioAcompanhamento";
import { Empty } from "@/financeiro/financeiro-ui";
import { EsqueletoFormulario } from "../../../components/Esqueleto";

import type {
  ConfiguracaoAcompanhamentoV2,
  PoliticaAcompanhamento,
} from "./acompanhamento-api";
import { RevisaoPrazosAcompanhamento } from "./RevisaoPrazosAcompanhamento";
export type { PoliticaAcompanhamento } from "./acompanhamento-api";
type Props = { propriedadeId: number; podeLancar: boolean };

export function ConfiguracaoAcompanhamento(props: Props) {
  return (
    <ConteudoConfiguracaoAcompanhamento key={props.propriedadeId} {...props} />
  );
}

function ConteudoConfiguracaoAcompanhamento({
  propriedadeId,
  podeLancar,
}: Props) {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [inicial, setInicial] = useState<ConfiguracaoAcompanhamentoV2 | null>(
    null,
  );
  const [alterado, setAlterado] = useState(false);
  const [politicas, setPoliticas] = useState<PoliticaAcompanhamento[]>([]);
  const [tipos, setTipos] = useState<TipoExameAcompanhamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const geracao = useRef(0);

  useEffect(() => {
    const g = ++geracao.current;
    void Promise.all([
      reqV4<PoliticaAcompanhamento[]>(
        "/reproducao/acompanhamento/politicas",
        undefined,
        "GET",
        propriedadeId,
      ),
      reqV4<TipoExameAcompanhamento[]>(
        "/reproducao/tipos-exame",
        undefined,
        "GET",
        propriedadeId,
      ),
    ])
      .then(([p, t]) => {
        if (g === geracao.current) {
          setPoliticas(p);
          setTipos(t.filter((x) => x.ativo && x.contexto !== "SANITARIO"));
        }
      })
      .catch((e) => {
        if (g === geracao.current)
          setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (g === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [propriedadeId]);

  async function salvar(input: RegistroPoliticaAcompanhamento) {
    if (ocupado) return;
    const g = geracao.current;
    setErro(null);
    setMensagem("");
    setOcupado(true);
    try {
      await reqV4(
        "/reproducao/acompanhamento/politicas",
        input,
        "POST",
        propriedadeId,
      );
      const p = await reqV4<PoliticaAcompanhamento[]>(
        "/reproducao/acompanhamento/politicas",
        undefined,
        "GET",
        propriedadeId,
      );
      if (g === geracao.current) {
        setPoliticas(p);
        setFormularioAberto(false);
        setAlterado(false);
        setMensagem(
          "Versão registrada. Os fatos e demandas existentes foram preservados; a adoção em casos antigos exige conferência explícita.",
        );
      }
    } catch (e) {
      if (g === geracao.current)
        setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === geracao.current) setOcupado(false);
    }
  }

  const vigente = [...politicas]
    .filter((p) => p.vigenteDesde.slice(0, 10) <= getHojeISO())
    .sort(
      (a, b) =>
        b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao,
    )[0];
  const ordenadas = [...politicas].sort(
    (a, b) =>
      Number(b.id === vigente?.id) - Number(a.id === vigente?.id) ||
      b.vigenteDesde.localeCompare(a.vigenteDesde) ||
      b.versao - a.versao,
  );
  return (
    <section className="space-y-4 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Diagnóstico e reconfirmações
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            Escolha os prazos com o responsável pelo manejo; não há prazo
            clínico padrão. As regras geram alertas.
          </p>
        </div>
        {podeLancar && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setInicial(null);
              setFormularioAberto(true);
            }}
          >
            Nova versão de acompanhamento
          </Button>
        )}
      </div>
      {!formularioAberto && <ErrorBox erro={erro} />}
      {carregando && <EsqueletoFormulario label="Carregando políticas" />}
      {!carregando && !erro && !politicas.length && (
        <Empty>Nenhuma política registrada neste sítio.</Empty>
      )}
      {mensagem && <p role="status">{mensagem}</p>}

      {ordenadas.map((p) => (
        <article key={p.id} className="space-y-2 border-t border-border py-3">
          <h3 className="font-semibold">
            {p.id === vigente?.id && "Política vigente · "}Versão {p.versao} ·
            vigente desde {formatBRDateISO(p.vigenteDesde)}
          </h3>
          {p.parametros.versao === 1 ? (
            <>
              <p className="text-sm text-ink-3">
                Formato histórico V1. Mantido sem alteração.
              </p>
              <p>
                Diagnóstico:{" "}
                {p.parametros.diagnostico
                  ? `${p.parametros.diagnostico.diasAposTentativa} dias após a tentativa`
                  : "não configurado"}
              </p>
              {p.parametros.reconfirmacoes.map((r) => (
                <p key={r.ocorrencia}>
                  Reconfirmação {r.ocorrencia}: {r.diasAposPrimeiroPositivo}{" "}
                  dias desde o primeiro DG positivo
                </p>
              ))}
              {podeLancar && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (p.parametros.versao !== 1) return;
                    const antigo = p.parametros;
                    setInicial({
                      versao: 2,
                      efeito: "ALERTA",
                      regras: [
                        ...(antigo.diagnostico
                          ? (["IA", "TE", "COBERTURA"] as const).map(
                              (publico) => ({
                                finalidade: "DIAGNOSTICO" as const,
                                ocorrencia: 1,
                                publico,
                                referencia: publico,
                                intervalo:
                                  antigo.diagnostico!.diasAposTentativa,
                                unidade: "DIAS" as const,
                                antecedencia: NaN,
                                tolerancia: NaN,
                                resolucao: "DIAGNOSTICO_CONCLUSIVO" as const,
                                ...(antigo.diagnostico!.tipoExameId
                                  ? {
                                      tipoExameId:
                                        antigo.diagnostico!.tipoExameId,
                                      tipoExameVersao:
                                        antigo.diagnostico!.tipoExameVersao,
                                    }
                                  : {}),
                              }),
                            )
                          : []),
                        ...antigo.reconfirmacoes.map((r) => ({
                          finalidade: "RECONFIRMACAO" as const,
                          ocorrencia: r.ocorrencia,
                          publico: "GESTACAO" as const,
                          referencia: "PRIMEIRO_DG_POSITIVO" as const,
                          intervalo: r.diasAposPrimeiroPositivo,
                          unidade: "DIAS" as const,
                          antecedencia: NaN,
                          tolerancia: NaN,
                          resolucao: "RECONFIRMACAO_CONCLUSIVA" as const,
                          ...(r.tipoExameId
                            ? {
                                tipoExameId: r.tipoExameId,
                                tipoExameVersao: r.tipoExameVersao,
                              }
                            : {}),
                        })),
                      ],
                    });
                    setFormularioAberto(true);
                  }}
                >
                  Criar versão V2 a partir da versão {p.versao}
                </Button>
              )}
            </>
          ) : (
            p.parametros.regras.map((r) => (
              <p
                key={`${r.publico}:${r.finalidade}:${r.ocorrencia}`}
                className="text-sm"
              >
                {r.finalidade === "DIAGNOSTICO"
                  ? `Diagnóstico após ${r.publico}`
                  : `Reconfirmação ${r.ocorrencia}`}{" "}
                · {r.intervalo} dias desde{" "}
                {r.referencia === "PRIMEIRO_DG_POSITIVO"
                  ? "o primeiro DG positivo"
                  : r.referencia}{" "}
                · antecedência {r.antecedencia} dias · tolerância {r.tolerancia}{" "}
                dias ·{" "}
                {r.resolucao === "DIAGNOSTICO_CONCLUSIVO"
                  ? "diagnóstico conclusivo"
                  : "reconfirmação conclusiva"}
              </p>
            ))
          )}
        </article>
      ))}
      {podeLancar && !carregando && politicas.length > 0 && (
        <RevisaoPrazosAcompanhamento
          propriedadeId={propriedadeId}
          politicas={ordenadas}
        />
      )}
      {podeLancar && formularioAberto && (
        <ModalPolitica
          aberto
          titulo="Nova versão de acompanhamento"
          bloqueado={ocupado}
          alteracoesExternas={alterado}
          onFechar={() => {
            setFormularioAberto(false);
            setAlterado(false);
            setErro(null);
          }}
          rodape={(fechar) => (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={fechar}
                disabled={ocupado}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="nova-politica-acompanhamento"
                disabled={ocupado || carregando}
              >
                {ocupado ? "Registrando…" : "Registrar nova versão"}
              </Button>
            </>
          )}
        >
          <ErrorBox erro={erro} />
          <FormularioAcompanhamento
            inicial={inicial}
            visivel
            propriedadeId={propriedadeId}
            tipos={tipos}
            ocupado={ocupado}
            aoSalvar={salvar}
            aoAlterar={() => setAlterado(true)}
            aoErro={(mensagemErro) => {
              setErro(mensagemErro);
              setMensagem("");
            }}
          />
        </ModalPolitica>
      )}
    </section>
  );
}
