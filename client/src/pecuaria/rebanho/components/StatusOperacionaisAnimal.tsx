import { useEffect, useState } from "react";
import { ClipboardList, HeartPulse } from "lucide-react";
import { Pill } from "../../../financeiro/financeiro-ui";
import { getHojeISO } from "../../../lib/hoje";
import { reqSanidade } from "../sanidade/api";
import { reqV4 } from "../reproducao/api";
import type { ParticipanteIatf, ProgramacaoIatf } from "../reproducao/Iatf";
type Ocorrencia = {
  id: string;
  status: string;
  inicio: string;
  fim: string | null;
  doenca?: { nome: string };
};
/** Precisão DIA conserva o dia civil; HORA considera o instante efetivo. */
function ocorreu(valor: string | null | undefined, precisao?: "DIA" | "HORA" | null): boolean {
  if (!valor) return false;
  return precisao === "DIA" || valor.length === 10
    ? valor.slice(0, 10) <= getHojeISO()
    : new Date(valor).getTime() <= Date.now();
}
function temEtapaPendente(p: ParticipanteIatf): boolean {
  return !p.tarefas?.length || p.tarefas.some(t => t.regularizacaoPendente ||
    !(ocorreu(t.realizadaEm, t.precisaoRealizacao ?? t.realizadoSnapshot?.precisaoRealizacao) || ocorreu(t.dispensadaEm)));
}
/** Apenas sinais positivos comprovados; ausência de dado nunca vira "saudável". */
export function StatusOperacionaisAnimal({
  animalId,
  propriedadeId,
  revisao,
}: {
  animalId: string;
  propriedadeId: number | null;
  revisao: number;
}) {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]),
    [protocolo, setProtocolo] = useState<"iniciado" | "previsto" | null>(null),
    [falhas, setFalhas] = useState<string[]>([]);
  useEffect(() => {
    let atual = true;
    setOcorrencias([]);
    setProtocolo(null);
    setFalhas([]);
    const q = new URLSearchParams({
      animalId,
      status: "VALIDO",
      situacao: "ABERTA",
      pageSize: "100",
    });
    void reqSanidade<Ocorrencia[]>(
      `/ocorrencias?${q}`,
      undefined,
      propriedadeId ?? undefined,
    )
      .then((lista) => {
        if (atual && Array.isArray(lista))
          setOcorrencias(
            lista.filter(
              (o) =>
                o.status === "VALIDO" &&
                o.inicio.slice(0, 10) <= getHojeISO() &&
                (!o.fim || o.fim.slice(0, 10) >= getHojeISO()),
            ),
          );
      })
      .catch(() => {
        if (atual) setFalhas((v) => v.includes("Ocorrências não consultadas") ? v : [...v, "Ocorrências não consultadas"]);
      });
    void reqV4<ProgramacaoIatf[]>(
      `/reproducao/participacoes?animalId=${encodeURIComponent(animalId)}`,
      undefined,
      "GET",
      propriedadeId ?? undefined,
    )
      .then((lista) => {
        if (atual && Array.isArray(lista))
          setProtocolo(
            lista.some((g) =>
              g.participantes?.some(
                (p) =>
                  p.animalId === animalId && !ocorreu(p.encerradoEm) && ocorreu(p.inicioEfetivo, p.precisaoInicioEfetivo) && temEtapaPendente(p),
              ),
            )
              ? "iniciado"
              : lista.some((g) =>
                    g.participantes?.some(
                      (p) => p.animalId === animalId && !ocorreu(p.encerradoEm) && !ocorreu(p.inicioEfetivo, p.precisaoInicioEfetivo) && temEtapaPendente(p),
                    ),
                  )
                ? "previsto"
                : null,
          );
      })
      .catch(() => {
        if (atual) setFalhas((v) => v.includes("Protocolos não consultados") ? v : [...v, "Protocolos não consultados"]);
      });
    return () => {
      atual = false;
    };
  }, [animalId, propriedadeId, revisao]);
  return (
    <>
      {ocorrencias.map((o) => (
        <Pill key={o.id} tone="amber">
          <HeartPulse size={13} aria-hidden="true" />
          {o.doenca?.nome ?? "Ocorrência sanitária em aberto"}
        </Pill>
      ))}
      {protocolo && (
        <Pill tone="green">
          <ClipboardList size={13} aria-hidden="true" />
          {protocolo === "iniciado"
            ? "Em protocolo reprodutivo"
            : "Protocolo reprodutivo programado"}
        </Pill>
      )}
      {falhas.map((f) => (
        <Pill key={f} tone="neutral">
          {f}
        </Pill>
      ))}
    </>
  );
}
