import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { PainelReprodutivo } from "./api";
import {
  anularDecisao,
  consultarElegibilidade,
  decidirElegibilidade,
  descreverMotivo,
  vincularPolitica,
  type ElegibilidadeNaData,
} from "./elegibilidade-api";
export function ElegibilidadeAnimal({
  animalId,
  propriedadeId,
  painel,
  podeLancar,
  onMudou,
}: {
  animalId: string;
  propriedadeId: number;
  painel: PainelReprodutivo;
  podeLancar: boolean;
  onMudou?: () => void;
}) {
  const [data, setData] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    ),
  );
  const [resultado, setResultado] = useState<ElegibilidadeNaData | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [origem, setOrigem] = useState("");
  const [tipo, setTipo] = useState<"LIBERAR" | "BLOQUEAR" | "RETOMAR_POLITICA">(
    "LIBERAR",
  );
  const [apta, setApta] = useState("");
  const [motivo, setMotivo] = useState("");
  const assinatura = `${propriedadeId}:${animalId}:${data}`;
  const atual = useRef(assinatura);
  atual.current = assinatura;
  const chave = useRef<{ assinatura: string; chave: string } | null>(null);
  const idempotencia = (s: string) => {
    if (chave.current?.assinatura !== s)
      chave.current = { assinatura: s, chave: crypto.randomUUID() };
    return chave.current.chave;
  };
  useEffect(() => {
    let ativo = true;
    setResultado(null);
    setErro("");
    setConfirmacao(false);
    setOrigem("");
    setMotivo("");
    setApta("");
    if (data)
      void consultarElegibilidade(animalId, propriedadeId, data)
        .then((v) => {
          if (ativo) setResultado(v);
        })
        .catch((e) => {
          if (ativo) setErro(e.message);
        });
    return () => {
      ativo = false;
    };
  }, [animalId, propriedadeId, data]);
  const r =
    resultado?.animalId === animalId &&
    resultado.propriedadeId === propriedadeId &&
    resultado.dataReferencia === data
      ? resultado
      : null;
  const iniciais = (painel.situacoesIniciais ?? []).filter(
    (i) =>
      i.animalId === animalId &&
      i.status === "VALIDO" &&
      i.data.slice(0, 10) <= data,
  );
  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await acao();
      const v = await consultarElegibilidade(animalId, propriedadeId, data);
      if (atual.current === assinatura) {
        setResultado(v);
        setConfirmacao(false);
        setMotivo("");
        onMudou?.();
      }
    } catch (e) {
      if (atual.current === assinatura)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar a alteração.",
        );
    } finally {
      setOcupado(false);
    }
  }
  function vincular() {
    if (!r?.ciclo || !confirmacao) return;
    const fonte = r.ciclo.partoId
      ? { partoId: r.ciclo.partoId }
      : { situacaoInicialId: origem };
    if (!r.ciclo.partoId && !origem) {
      setErro("Selecione a situação inicial que comprova o ciclo.");
      return;
    }
    const input = { propriedadeId, animalId, ...fonte };
    void executar(() =>
      vincularPolitica({
        ...input,
        chave: idempotencia(JSON.stringify(input)),
      }),
    );
  }
  function decidir() {
    if (!r?.vinculoCicloId) return;
    if (motivo.trim().length < 5) {
      setErro("Descreva o motivo com pelo menos 5 caracteres.");
      return;
    }
    if (tipo === "LIBERAR" && (!apta || apta < data)) {
      setErro("Informe apta desde a data da decisão ou depois.");
      return;
    }
    const input = {
      propriedadeId,
      vinculoCicloId: r.vinculoCicloId,
      data,
      tipo,
      aptaDesde: tipo === "LIBERAR" ? apta : null,
      motivo,
    };
    void executar(() =>
      decidirElegibilidade({
        ...input,
        chave: idempotencia(JSON.stringify(input)),
      }),
    );
  }
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="font-semibold">Elegibilidade para reprodução</h3>
      <label>
        Consultar na data
        <Input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </label>
      {erro && <p role="alert">{erro}</p>}
      {r && (
        <>
          <p className="font-medium">
            {r.estado === "ELEGIVEL"
              ? "Elegível"
              : r.estado === "NAO_ELEGIVEL"
                ? "Não elegível"
                : "Pendente de informação"}
          </p>
          <p>
            Apta desde: {r.aptaDesde ?? "Não informada"} · Política:{" "}
            {r.politicaVersao
              ? `versão ${r.politicaVersao}`
              : "Sem versão vinculada"}
          </p>
          {r.motivos.map((m) => (
            <p key={m}>{descreverMotivo(m)}</p>
          ))}
          {r.alertas.map((m) => (
            <p key={m}>Atenção: {descreverMotivo(m)}</p>
          ))}
          {podeLancar && r.ciclo && !r.vinculoCicloId && (
            <div className="space-y-3 border-t pt-3">
              <p>
                Associar a política vigente no início deste ciclo (
                {r.ciclo.inicioCiclo}). Esta ação preserva a versão aplicável;
                sem política naquela data, será necessária liberação individual.
              </p>
              {r.ciclo.partoId ? (
                <p>Parto de origem comprovado: {r.ciclo.partoId}</p>
              ) : (
                <label>
                  Situação inicial que comprova o ciclo
                  <select
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value)}
                    className="h-10 w-full rounded border bg-background px-3"
                  >
                    <option value="">Selecione a evidência</option>
                    {iniciais.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.data.slice(0, 10)} · {i.situacao}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.checked)}
                />
                Revisei a origem e confirmo a associação deste ciclo.
              </label>
              <Button
                disabled={
                  ocupado || !confirmacao || (!r.ciclo.partoId && !origem)
                }
                onClick={vincular}
              >
                Associar política ao ciclo
              </Button>
            </div>
          )}
          {podeLancar && r.vinculoCicloId && (
            <div className="space-y-3 border-t pt-3">
              <h4 className="font-medium">Decisão individual neste ciclo</h4>
              <p className="text-sm text-muted-foreground">
                A data consultada será a data da decisão. Restrições, papel e
                situação gestacional continuam sendo considerados.
              </p>
              <label>
                Decisão
                <select
                  className="h-10 w-full rounded border bg-background px-3"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as typeof tipo)}
                >
                  <option value="LIBERAR">Liberar desde uma data</option>
                  <option value="BLOQUEAR">Bloquear</option>
                  <option value="RETOMAR_POLITICA">
                    Retomar regras da política
                  </option>
                </select>
              </label>
              {tipo === "LIBERAR" && (
                <label>
                  Apta desde
                  <Input
                    type="date"
                    min={data}
                    value={apta}
                    onChange={(e) => setApta(e.target.value)}
                  />
                </label>
              )}
              <label>
                Motivo
                <Input
                  minLength={5}
                  maxLength={1000}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={ocupado || motivo.trim().length < 5}
                  onClick={decidir}
                >
                  Registrar decisão
                </Button>
                {r.decisaoId && (
                  <Button
                    variant="outline"
                    disabled={ocupado || motivo.trim().length < 5}
                    onClick={() => {
                      const id = r.decisaoId!;
                      const input = { propriedadeId, motivo };
                      void executar(() =>
                        anularDecisao(id, {
                          ...input,
                          chave: idempotencia(JSON.stringify({ id, ...input })),
                        }),
                      );
                    }}
                  >
                    Anular decisão vigente com motivo
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
