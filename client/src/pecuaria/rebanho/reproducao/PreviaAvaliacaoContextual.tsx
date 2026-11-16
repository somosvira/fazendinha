import { Pill } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import type { PreviaAvaliacaoContextual as Previa } from "./avaliacao-contextual-api";

const resultados: Record<string, string> = {
  POSITIVO: "Gestação confirmada",
  NEGATIVO: "Gestação não confirmada",
  RECONFIRMACAO: "Gestação reconfirmada",
  SEXAGEM: "Sexagem registrada",
  INCONCLUSIVO: "Conclusão gestacional inconclusiva",
  NAO_AVALIADO: "DG não avaliado neste atendimento",
};
const estados = {
  NAO_AVALIADO: "Não avaliado",
  INCONCLUSIVO: "Inconclusivo",
  CONCLUSIVO: "Conclusivo",
};
const aptidao: Record<string, string> = {
  APTO: "Apta",
  NAO_APTO: "Não apta",
  INCONCLUSIVO: "Pendente de avaliação",
};
export function PreviaAvaliacaoContextual({ dados }: { dados: Previa }) {
  return (
    <section
      aria-label="Efeitos da avaliação contextual"
      className="grid gap-4"
    >
      <div>
        <h3 className="font-semibold">Fatos que serão registrados</h3>
        <p>{resultados[dados.exame.resultado] ?? dados.exame.resultado}</p>
        {dados.exame.resultadoAptidao && (
          <p>
            Aptidão:{" "}
            {aptidao[dados.exame.resultadoAptidao] ??
              dados.exame.resultadoAptidao}
          </p>
        )}
        {dados.exame.sexoFetal && (
          <p>Sexo fetal: {dados.exame.sexoFetal === "F" ? "Fêmea" : "Macho"}</p>
        )}
        {dados.exame.gestacaoCriada && (
          <p>Uma gestação será aberta a partir deste diagnóstico.</p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Itens do atendimento</h3>
        <ul className="divide-y divide-border">
          {dados.itens.map((item) => (
            <li
              key={item.codigo}
              className="flex flex-wrap justify-between gap-2 py-2"
            >
              <span>
                {item.rotulo}
                {item.observacao && (
                  <small className="block text-ink-3">{item.observacao}</small>
                )}
              </span>
              <Pill>{estados[item.estado]}</Pill>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Cuidados existentes</h3>
        {dados.necessidades.length ? (
          <ul className="divide-y divide-border">
            {dados.necessidades.map((n) => (
              <li key={n.id} className="py-2">
                <strong>
                  {n.finalidade === "DIAGNOSTICO"
                    ? "Diagnóstico"
                    : n.finalidade === "RECONFIRMACAO"
                      ? "Reconfirmação"
                      : n.finalidade === "SEXAGEM"
                        ? "Sexagem"
                        : "Avaliação de aptidão"}
                </strong>{" "}
                ·{" "}
                {n.previstaPara
                  ? formatBRDateISO(n.previstaPara)
                  : "Sem prazo definido"}
                <p>
                  {n.acao === "RESOLVER"
                    ? "Será resolvido pela conclusão selecionada."
                    : "Permanece pendente. Não foi selecionada uma conclusão compatível para este cuidado."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum cuidado existente foi projetado para este atendimento.</p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Acompanhamentos gerados</h3>
        {dados.necessidadesGeradas.length ? (
          <ul>
            {dados.necessidadesGeradas.map((n, i) => (
              <li key={`${n.finalidade}:${n.ocorrencia}:${i}`}>
                {n.finalidade === "RECONFIRMACAO"
                  ? `Reconfirmação ${n.ocorrencia}`
                  : n.finalidade === "DIAGNOSTICO"
                    ? "Diagnóstico"
                    : n.finalidade}{" "}
                ·{" "}
                {n.previstaPara
                  ? formatBRDateISO(n.previstaPara)
                  : "Planejamento pendente, sem prazo configurado"}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum acompanhamento novo projetado.</p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Encaminhamentos</h3>
        {dados.condutas.length ? (
          <ul>
            {dados.condutas.map((c) => (
              <li key={c.codigo} className="py-1">
                {c.rotulo}
                {c.destino && ` · ${c.destino}`}
                {c.retornoEm && ` · retorno em ${formatBRDateISO(c.retornoEm)}`}
                {c.revisaoEm && ` · revisão em ${formatBRDateISO(c.revisaoEm)}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem encaminhamento informado.</p>
        )}
        <p className="mt-2 text-sm text-ink-3">
          A indicação exige planejamento e confirmação próprios para incluir o
          animal em um protocolo.
        </p>
      </div>
    </section>
  );
}
