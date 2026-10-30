import {CiclosIndicadoresVisuais} from "./CiclosIndicadoresVisuais";
import { AjudaCampo } from "../../../components/Dica";
import { useState } from "react";
import { Paginacao } from "../ui";
import {
  navegarConsultaComSitio,
  urlConsultaComSitio,
} from "./contexto-consulta";
type LinhaEspera = {
  animalId: string;
  cicloId: string;
  inicio: string;
  primeiraLiberacao: { data: string } | null;
  primeiroServico: { id: string; data: string; tipo: string } | null;
  diasPartoServico: number | null;
  diasFimPevServico: number | null;
  diasLiberacaoServico: number | null;
  diasEsperaObservada: number | null;
  esperaObservadaAte: string;
  repeticoes: number;
  restricoesIntermediarias: Array<{
    id: string;
    inicio: string;
    fim: string | null;
    efeito: string;
  }>;
  pendencias: string[];
  saidaEm: string | null;
  antecipacoes: Array<{
    referencia: string;
    desde: string;
    servicoEm: string;
    dias: number;
  }>;
};
export type AcompanhamentoIndicadores = {
  exclusoesEscopo?: Array<{
    animalId: string;
    populacao: string;
    referenciaId: string;
    motivos: string[];
  }>;
  identificacoes?: Array<{
    id: string;
    brinco: string | null;
    nome: string | null;
  }>;
  versao: 2;
  versaoMetodologia: string;
  origemCoberturaSeguimento?: string;
  pendenciasOrigemCiclo: Array<{ animalId: string; motivo: string }>;
  espera: {
    pendenciasEscopo?: Array<{ cicloId: string; populacao: string }>;
    coorte: LinhaEspera[];
    filaAtual: LinhaEspera[];
    pendenciasFila: Array<{ motivo: string; linha: LinhaEspera }>;
    resumoCoorte: {
      ciclos: number;
      comServico: number;
      semServico: number;
      saidas: number;
      repeticoes: number;
      mediaDiasLiberacaoServico: number | null;
    };
  };
  perdas: {
    pendenciasEscopo?: string[];
    janelaDias: number | null;
    numerador: number | null;
    denominador: number | null;
    percentual: number | null;
    contagens: {
      gestacoes: number;
      perdasAteCorte: number;
      perdasRegistradas: number;
      abortos: number;
      incompletos: number;
      semPrimeiroDg: number;
      encerramentosNaoIdentificados: number;
    };
    composicaoNumerador: { perdasRegistradas: number; abortos: number };
    coorte: Array<{
      gestacaoId: string;
      animalId: string;
      estado: string;
      primeiroDgPositivo: { id: string; data: string } | null;
      fimJanela: string | null;
      encerramento: {
        tipo: string;
        subtipo?: string;
        data: string;
        fatoId: string;
        explicacao?: string;
      } | null;
      motivos: string[];
      lacunas: string[];
      evidenciaIds: string[];
    }>;
  };
  iep: {
    modo: string;
    mediaDias: number | null;
    pares: Array<{
      animalId: string;
      anteriorId: string;
      atualId: string;
      anteriorEm: string;
      atualEm: string;
      dias: number;
      abortosIntermediarios: Array<{ id: string; data: string }>;
    }>;
    abortos: Array<{ id: string; data: string }>;
    pendencias: Array<{ partoId: string; motivo: string }>;
    semAnterior: string[];
  };
  tentativasPorConcepcao: {
    estado: string;
    mediaTentativas?: number | null;
    linhas?: Array<{
      concepcaoId: string;
      animalId: string;
      tentativaId: string;
      servicoEm: string;
      confirmadaEm: string;
      numeroTentativas: number | null;
      tentativaIds: string[];
      tipos: string[];
      evidenciaIds: string[];
      pendencias: string[];
    }>;
    pendencias?: Array<{ concepcaoId: string; motivo: string }>;
  };
};
const numero = (v: number | null | undefined) =>
  v == null
    ? "Não comprovado"
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const data = (v: string | null | undefined) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "Não informado";
const motivo = (v: string) => v.toLowerCase().replaceAll("_", " ");
export function IndicadoresAcompanhamento({
  dados: d,
  secao = "todos",
  propriedadeId,
}: {
  dados: AcompanhamentoIndicadores;
  secao?: "todos" | "desempenho" | "fila" | "pendencias";
  propriedadeId?: number;
}) {
  const [paginaFila, setPaginaFila] = useState(1);
  const [paginaPendencias, setPaginaPendencias] = useState(1);
  const pendenciasAnaliticas = [
    ...d.perdas.coorte
      .filter((g) => g.motivos.length || g.lacunas.length)
      .map((g) => ({
        id: `gestacao:${g.gestacaoId}`,
        animalId: g.animalId,
        origem: "Seguimento da gestação",
        referencia: g.gestacaoId,
        motivos: [...g.motivos, ...g.lacunas],
      })),
    ...d.iep.pendencias.map((p) => ({
      id: `parto:${p.partoId}`,
      animalId: null,
      origem: "Intervalo entre partos",
      referencia: p.partoId,
      motivos: [p.motivo],
    })),
    ...(d.tentativasPorConcepcao.pendencias ?? []).map((p) => ({
      id: `concepcao:${p.concepcaoId}`,
      animalId:
        d.tentativasPorConcepcao.linhas?.find(
          (l) => l.concepcaoId === p.concepcaoId,
        )?.animalId ?? null,
      origem: "Tentativas por concepção",
      referencia: p.concepcaoId,
      motivos: [p.motivo],
    })),
  ];
  const desempenho = secao === "todos" || secao === "desempenho",
    fila = secao === "todos" || secao === "fila",
    pendencias = secao === "todos" || secao === "pendencias";
  const link = (destino: string, label: string) => (
    <a
      className="underline"
      href={urlConsultaComSitio(destino, propriedadeId)}
      onClick={(e) => {
        e.preventDefault();
        navegarConsultaComSitio(destino, propriedadeId);
      }}
    >
      {label}
    </a>
  );
  const nome = (id: string) => {
    const a = d.identificacoes?.find((a) => a.id === id);
    return a
      ? `${a.brinco ?? "Sem brinco"}${a.nome ? ` · ${a.nome}` : ""}`
      : "Animal sem identificação preservada";
  };
  const animal = (id: string) =>
    link(`/pecuaria/rebanho/animais/${id}#reproducao`, nome(id));
  const fato = (animalId: string, id: string, label: string) =>
    link(
      `/pecuaria/reproducao?rotina=ciclos&animalId=${animalId}&fatoId=${id}`,
      label,
    );
  const linhas = (lista: LinhaEspera[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm consulta-tabela">
        <thead>
          <tr>
            <th>Animal / início do ciclo</th>
            <th>Liberação → serviço</th>
            <th>Dias corridos</th>
            <th>Outros intervalos</th>
            <th>Repetições e restrições</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((l) => (
            <tr key={l.cicloId} className="border-t align-top">
              <td className="p-2">
                {animal(l.animalId)}
                <p>{data(l.inicio)}</p>
              </td>
              <td className="p-2">
                {data(l.primeiraLiberacao?.data)} →{" "}
                {data(l.primeiroServico?.data)}
                <p>{l.primeiroServico?.tipo ?? "Serviço ausente"}</p>
              </td>
              <td className="p-2">
                {numero(l.diasLiberacaoServico)}
                <p>
                  Espera observada: {numero(l.diasEsperaObservada)} até{" "}
                  {data(l.esperaObservadaAte)}
                </p>
                {l.saidaEm && <p>Saída: {data(l.saidaEm)}</p>}
              </td>
              <td className="p-2">
                Parto → serviço: {numero(l.diasPartoServico)}
                <br />
                Fim PEV → serviço: {numero(l.diasFimPevServico)}
                {l.antecipacoes.map((a) => (
                  <p key={a.referencia}>
                    Serviço {a.dias} dias antes de {motivo(a.referencia)} (
                    {data(a.desde)})
                  </p>
                ))}
              </td>
              <td className="p-2">
                {l.repeticoes} repetições
                {l.restricoesIntermediarias.map((r) => (
                  <p key={r.id}>
                    {data(r.inicio)} a {data(r.fim)} · {motivo(r.efeito)}
                  </p>
                ))}
                {l.pendencias.map((p) => (
                  <p key={p}>{motivo(p)}</p>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!lista.length && <p className="p-3">Nenhum ciclo nesta população.</p>}
    </div>
  );
  return (
    <section className="space-y-5 rounded-xl border p-4">
      <h2 className="text-xl font-semibold">
        {secao === "fila"
          ? "Fila atual de manejo"
          : secao === "pendencias"
            ? "Pendências do acompanhamento"
            : "Espera, perdas e intervalos"}
      </h2>
      {pendencias &&
        (d.espera.pendenciasEscopo?.length ?? 0) +
          (d.perdas.pendenciasEscopo?.length ?? 0) >
          0 && (
          <section className="rounded border p-3">
            <h3 className="font-semibold">
              Fora dos cálculos por escopo histórico não comprovado
            </h3>
            <p>
              {d.espera.pendenciasEscopo?.length ?? 0} participações na
              espera/fila e {d.perdas.pendenciasEscopo?.length ?? 0} gestações.
              Localização, lote ou papel ausentes não entram silenciosamente no
              denominador.
            </p>
            {d.exclusoesEscopo?.map((p) => (
              <p key={`${p.populacao}:${p.referenciaId}`}>
                {animal(p.animalId)} · {motivo(p.populacao)} ·{" "}
                {p.motivos.map(motivo).join("; ")}
              </p>
            ))}
          </section>
        )}

      {desempenho && (secao === "todos" ? <CiclosIndicadoresVisuais dados={d} nome={nome} tabela={linhas(d.espera.coorte)} detalhar={l=>linhas([l])}/> :         <section className="space-y-2">
          <h3 className="font-semibold">
            Coorte de ciclos iniciados no período <AjudaCampo rotulo="Ajuda sobre a metodologia dos intervalos" texto="Dias corridos; as restrições intermediárias permanecem visíveis e não são descontadas da espera. Coorte: ciclos iniciados no período, com sítio, lote e papel daquela data. A fila usa a disponibilidade no corte."/>
          </h3>
          <p>
            {d.espera.resumoCoorte.ciclos} ciclos ·{" "}
            {d.espera.resumoCoorte.comServico} com serviço ·{" "}
            {d.espera.resumoCoorte.semServico} sem serviço ·{" "}
            {d.espera.resumoCoorte.saidas} saídas. Média liberação → serviço:{" "}
            {numero(d.espera.resumoCoorte.mediaDiasLiberacaoServico)} dias.
          </p>
          <details><summary className="cursor-pointer">Conferir ciclos e intervalos</summary>{linhas(d.espera.coorte)}</details>
        </section>
      )}
      {fila && (
        <section className="space-y-2">
          <h3 className="font-semibold">Fila atual de liberadas sem serviço</h3>
          {linhas(
            secao === "todos"
              ? d.espera.filaAtual
              : d.espera.filaAtual.slice(
                  (paginaFila - 1) * 10,
                  paginaFila * 10,
                ),
          )}
          {secao !== "todos" && (
            <Paginacao
              paginaAtual={paginaFila}
              totalPaginas={Math.max(
                1,
                Math.ceil(d.espera.filaAtual.length / 10),
              )}
              totalItens={d.espera.filaAtual.length}
              itensPorPagina={10}
              onPaginaChange={setPaginaFila}
              rotulo="ciclos na fila"
              idSelect="indicadores-fila-pagina"
            />
          )}
        </section>
      )}
      {pendencias && (
        <section className="space-y-2">
          <h3 className="font-semibold">
            Pendências fora da fila liberada (
            {d.espera.pendenciasFila.length + d.pendenciasOrigemCiclo.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm consulta-tabela">
              <thead>
                <tr>
                  <th className="p-3">Animal</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3">Primeira liberação</th>
                </tr>
              </thead>
              <tbody>
                {d.espera.pendenciasFila.map((p) => (
                  <tr className="border-t" key={p.linha.cicloId}>
                    <td className="p-3">{animal(p.linha.animalId)}</td>
                    <td className="p-3">{motivo(p.motivo)}</td>
                    <td className="p-3">
                      {data(p.linha.primeiraLiberacao?.data)}
                    </td>
                  </tr>
                ))}
                {d.pendenciasOrigemCiclo.map((p) => (
                  <tr className="border-t" key={p.animalId}>
                    <td className="p-3">{animal(p.animalId)}</td>
                    <td className="p-3">{motivo(p.motivo)}</td>
                    <td className="p-3">Origem do ciclo não comprovada</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.espera.pendenciasFila.length + d.pendenciasOrigemCiclo.length ===
            0 && <p>Nenhuma pendência fora da fila nesta consulta.</p>}
        </section>
      )}
      {secao === "pendencias" && (
        <section className="space-y-3">
          <h3 className="font-semibold">Lacunas nas análises de desempenho</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm consulta-tabela">
              <thead>
                <tr>
                  <th className="p-3">Animal / referência</th>
                  <th className="p-3">Análise</th>
                  <th className="p-3">Motivos</th>
                </tr>
              </thead>
              <tbody>
                {pendenciasAnaliticas
                  .slice((paginaPendencias - 1) * 10, paginaPendencias * 10)
                  .map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">
                        {p.animalId
                          ? animal(p.animalId)
                          : "Identificação não preservada"}
                        <p className="text-sm text-muted-foreground">
                          {p.referencia}
                        </p>
                      </td>
                      <td className="p-3">{p.origem}</td>
                      <td className="p-3">
                        {p.motivos.map(motivo).join("; ")}
                      </td>
                    </tr>
                  ))}
                {!pendenciasAnaliticas.length && (
                  <tr>
                    <td colSpan={3} className="p-3">
                      Nenhuma lacuna individual nestas análises.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacao
            paginaAtual={paginaPendencias}
            totalPaginas={Math.max(
              1,
              Math.ceil(pendenciasAnaliticas.length / 10),
            )}
            totalItens={pendenciasAnaliticas.length}
            itensPorPagina={10}
            onPaginaChange={setPaginaPendencias}
            rotulo="lacunas analíticas"
            idSelect="indicadores-pendencias-analiticas"
          />
        </section>
      )}
      {desempenho && (
        <>
          <section className="space-y-2">
            <h3 className="font-semibold">Perdas gestacionais</h3>
            <p>
              Coorte pelo primeiro DG positivo no período, com os filtros na
              data desse exame. {d.perdas.contagens.perdasAteCorte} perdas até o
              corte: {d.perdas.contagens.perdasRegistradas} perdas registradas e{" "}
              {d.perdas.contagens.abortos} abortos factuais.
            </p>
            {d.perdas.janelaDias == null ? (
              <p>Sem duração escolhida: somente contagens.</p>
            ) : (
              <p>
                Janela: {d.perdas.janelaDias} dias desde o primeiro DG positivo.
                Numerador {d.perdas.numerador ?? "Não comprovado"} / denominador
                com seguimento demonstrável{" "}
                {d.perdas.denominador ?? "Não comprovado"} ·{" "}
                {d.perdas.percentual == null
                  ? "Percentual não calculável"
                  : `${numero(d.perdas.percentual)}%`}
                . Composição: {d.perdas.composicaoNumerador.perdasRegistradas}{" "}
                perdas registradas + {d.perdas.composicaoNumerador.abortos}{" "}
                abortos. {d.perdas.contagens.incompletos} incompletas separadas.
              </p>
            )}
            <details>
              <summary>Conferir gestações e evidências</summary>
              {d.perdas.coorte.map((g) => (
                <article key={g.gestacaoId} className="border-t py-2 text-sm">
                  {animal(g.animalId)} · acompanhamento da gestação
                  <p>
                    Primeiro DG: {data(g.primeiroDgPositivo?.data)} · fim da
                    janela: {data(g.fimJanela)} · {motivo(g.estado)}
                  </p>
                  {g.encerramento && (
                    <p>
                      {motivo(g.encerramento.subtipo ?? g.encerramento.tipo)} ·{" "}
                      {data(g.encerramento.data)} ·{" "}
                      {g.encerramento.explicacao ??
                        "Explicação histórica não informada"}{" "}
                      ·{" "}
                      {fato(
                        g.animalId,
                        g.encerramento.fatoId,
                        "Abrir desfecho",
                      )}
                    </p>
                  )}
                  {[...g.motivos, ...g.lacunas].map((p) => (
                    <p key={p}>{motivo(p)}</p>
                  ))}
                  <p>
                    Provas:{" "}
                    {g.evidenciaIds.length
                      ? g.evidenciaIds.map((id, i) => (
                          <span key={id}>
                            {i > 0 ? ", " : ""}
                            {fato(g.animalId, id, `Evidência ${i + 1}`)}
                          </span>
                        ))
                      : "Não suficientes"}
                  </p>
                </article>
              ))}
            </details>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Intervalo entre partos</h3>
            <p>
              {d.iep.modo === "TODOS_PARTOS"
                ? "Todos os partos (alternativa selecionada)"
                : "Principal: nascimento vivo ou natimorto comprovado"}
              . O segundo parto qualifica o período; o anterior pode estar fora
              dele. Média: {numero(d.iep.mediaDias)} dias.
            </p>
            {d.iep.pares.map((p) => (
              <p key={p.atualId}>
                {animal(p.animalId)} · {data(p.anteriorEm)} → {data(p.atualEm)}{" "}
                · {p.dias} dias ·{" "}
                {fato(p.animalId, p.anteriorId, "Parto anterior")} e{" "}
                {fato(p.animalId, p.atualId, "Parto atual")}
                {p.abortosIntermediarios.length > 0 &&
                  ` · abortos intermediários: ${p.abortosIntermediarios.map((a) => `${data(a.data)}`).join(", ")}`}
              </p>
            ))}
            <p>
              {d.iep.abortos.length} abortos no período ·{" "}
              {d.iep.semAnterior.length} sem parto anterior qualificante ·{" "}
              {d.iep.pendencias.length} pendências.
            </p>
            {d.iep.pendencias.map((p) => (
              <p key={p.partoId}>Parto com pendência · {motivo(p.motivo)}</p>
            ))}
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Tentativas por concepção</h3>
            <p>
              Período e filtros pela data factual do serviço conceptivo. A
              contagem acumula as tentativas válidas dos tipos escolhidos no
              mesmo ciclo, inclusive anteriores ao período; uma perda não
              reinicia essa contagem. Média:{" "}
              {numero(d.tentativasPorConcepcao.mediaTentativas)}.
            </p>
            {d.tentativasPorConcepcao.linhas?.map((c) => (
              <details key={c.concepcaoId}>
                <summary>
                  {nome(c.animalId)} · serviço {data(c.servicoEm)} ·{" "}
                  {numero(c.numeroTentativas)} tentativas
                </summary>
                <p>
                  Confirmação: {data(c.confirmadaEm)} ·{" "}
                  {fato(c.animalId, c.tentativaId, "Abrir serviço conceptivo")}
                </p>
                <p>
                  Tentativas:{" "}
                  {c.tentativaIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 ? ", " : ""}
                      {fato(c.animalId, id, `${i + 1}ª · ${c.tipos[i]}`)}
                    </span>
                  ))}
                </p>
                {c.pendencias.map((p) => (
                  <p key={p}>{motivo(p)}</p>
                ))}
                <p>Concepção comprovada pelo vínculo factual da gestação.</p>
              </details>
            ))}
            {d.tentativasPorConcepcao.pendencias?.map((p) => (
              <p key={p.concepcaoId}>
                Concepção com pendência · {motivo(p.motivo)}
              </p>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
