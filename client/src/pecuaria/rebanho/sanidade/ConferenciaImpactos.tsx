import { useEffect, useRef, useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { ListaRascunho } from "../protocolos/ListaRascunho";
import {
  preverImpactos,
  type EntradaImpacto,
  type ConfirmacaoImpacto,
  type PreviaImpactos,
} from "./impactos-api";
import { dataSanitaria } from "./rotulos";
import { horarioIatf } from "../reproducao/CampoDataIatf";

const efeitos = {
  AVISAR: "Aviso para conferência",
  BLOQUEAR: "Bloquear continuidade",
  RETIRAR: "Retirar participação",
};
type Conferencia = {
  previas: PreviaImpactos[];
  nomes: Record<string, string>;
  resolver: (valor: Array<ConfirmacaoImpacto | undefined> | null) => void;
};

/** Conserva a entrada capturada; a execução só reutiliza aceite do mesmo payload. */
export function useConferenciaImpactos() {
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const pendente = useRef<Conferencia | null>(null);
  const cache = useRef<{
    referencia: string;
    confirmacoes: Array<ConfirmacaoImpacto | undefined>;
  } | null>(null);
  useEffect(
    () => () => {
      pendente.current?.resolver(null);
    },
    [],
  );
  async function conferir(
    entradas: EntradaImpacto[],
    nomes: Record<string, string> = {},
    referencia?: string,
  ) {
    if (referencia && cache.current?.referencia === referencia)
      return cache.current.confirmacoes;
    const previas: PreviaImpactos[] = [];
    // Consulta limitada pelo conjunto já selecionado; cada sítio usa seu escopo explícito.
    for (const entrada of entradas) previas.push(await preverImpactos(entrada));
    if (!previas.some((p) => p.exigeConfirmacao))
      return previas.map(() => undefined);
    return new Promise<Array<ConfirmacaoImpacto | undefined> | null>(
      (resolve) => {
        const resolver = (
          valor: Array<ConfirmacaoImpacto | undefined> | null,
        ) => {
          if (valor && referencia)
            cache.current = { referencia, confirmacoes: valor };
          resolve(valor);
        };
        const atual = { previas, nomes, resolver };
        pendente.current = atual;
        setConferencia(atual);
      },
    );
  }
  function finalizar(valor: Array<ConfirmacaoImpacto | undefined> | null) {
    pendente.current?.resolver(valor);
    pendente.current = null;
    setConferencia(null);
  }
  return {
    conferir,
    invalidar: () => {
      cache.current = null;
    },
    painel: conferencia && (
      <ConferenciaImpactos
        previas={conferencia.previas}
        nomes={conferencia.nomes}
        onCancelar={() => finalizar(null)}
        onConfirmar={finalizar}
      />
    ),
  };
}
export function ConferenciaImpactos({
  previas,
  nomes,
  onCancelar,
  onConfirmar,
}: {
  previas: PreviaImpactos[];
  nomes: Record<string, string>;
  onCancelar: () => void;
  onConfirmar: (confirmacoes: Array<ConfirmacaoImpacto | undefined>) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [ciencia, setCiencia] = useState(false);
  return (
    <PainelCadastro
      aberto
      camada="sobreDetalhe"
      titulo="Conferir impactos nos protocolos"
      onFechar={onCancelar}
      rodape={
        <>
          <Button secondary onClick={onCancelar}>
            Voltar ao registro
          </Button>
          <Button
            disabled={!ciencia || motivo.trim().length < 5}
            onClick={() =>
              onConfirmar(
                previas.map((p) =>
                  p.exigeConfirmacao
                    ? { revisao: p.revisao, motivo: motivo.trim() }
                    : undefined,
                ),
              )
            }
          >
            Confirmar dados e impactos
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p>
          O fato e seus efeitos serão confirmados juntos. Se regras,
          participações ou automações mudarem, será necessário conferir
          novamente.
        </p>
        <ListaRascunho
          itens={previas.filter((p) => p.exigeConfirmacao)}
          rotulo="animais com impacto"
          texto={(p) => nomes[p.entrada.animalId] ?? "Animal selecionado"}
          renderizar={(p) => (
            <section key={p.entrada.animalId} className="grid gap-3">
              <h3 className="font-semibold">
                {nomes[p.entrada.animalId] ?? "Animal selecionado"} ·{" "}
                {dataSanitaria(p.entrada.data)}
              </h3>
              {p.itens.map((i) => (
                <section
                  key={i.participacaoId}
                  className="grid gap-2 border-b border-border pb-3"
                >
                  <h4 className="font-semibold">
                    {i.protocolo.nome} · v{i.protocolo.versao}
                  </h4>
                  <p>{efeitos[i.efeito]}</p>
                  {i.regras.map((r) => (
                    <p key={r.id} className="text-sm">
                      {r.motivo}
                    </p>
                  ))}
                  <p className="text-sm">
                    {i.tarefas.length} tarefas pendentes · {i.automacoes.length}{" "}
                    automações{" "}
                    {i.efeito === "AVISAR"
                      ? "sem cancelamento automático"
                      : "serão canceladas"}
                  </p>
                  {!!i.automacoes.length && (
                    <ListaRascunho
                      itens={i.automacoes}
                      rotulo="automações afetadas"
                      renderizar={(a) => (
                        <p key={a.id} className="text-sm">
                          Automação de {horarioIatf(a.programadaPara)} ·{" "}
                          {a.estado === "FALHOU"
                            ? "Falha pendente de revisão"
                            : "Agendada"}
                        </p>
                      )}
                    />
                  )}
                  {!!i.tarefas.length && (
                    <ListaRascunho
                      itens={i.tarefas}
                      rotulo="tarefas afetadas"
                      renderizar={(t) => (
                        <p key={t.id} className="text-sm">
                          {t.nomeSnapshot ?? t.etapa.nome} ·{" "}
                          {t.previstaPara
                            ? dataSanitaria(t.previstaPara)
                            : "Sem data definida"}
                        </p>
                      )}
                    />
                  )}
                </section>
              ))}
              {!!p.dispositivos.length && (
                <section className="grid gap-2">
                  <ListaRascunho
                    itens={p.dispositivos}
                    rotulo="inserções sem retirada registrada"
                    renderizar={(d) => (
                      <p key={d.id} className="text-sm">
                        Inserção documentada em {dataSanitaria(d.data)}
                      </p>
                    )}
                  />
                  <p className="text-sm">
                    {p.dispositivos.length} inserção(ões) sem retirada física
                    registrada. A retirada da participação não remove o
                    dispositivo: o cuidado continua disponível no alerta do
                    animal até o fato de retirada.
                  </p>
                </section>
              )}
            </section>
          )}
        />
        <CampoFormulario
          id="impacto-motivo"
          rotulo="Motivo da confirmação"
          obrigatorio
        >
          {(p) => (
            <textarea
              {...p}
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              className={classeInput}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          )}
        </CampoFormulario>
        <ConfirmacaoCiencia
          id="impacto-ciencia"
          checked={ciencia}
          onChange={setCiencia}
          obrigatorio
        >
          Conferi as participações, tarefas, automações e o cuidado físico dos
          dispositivos.
        </ConfirmacaoCiencia>
      </div>
    </PainelCadastro>
  );
}
