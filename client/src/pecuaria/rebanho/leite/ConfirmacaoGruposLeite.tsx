import { useState } from "react";
import type { FolhaLeite } from "./types";
import { formatarLitros } from "./modelo";
export type NaturezaGrupoLeite = "COMERCIAL" | "COLOSTRO" | "NAO_COMERCIAL";
export const nomeNaturezaGrupo = (natureza: string) =>
  (
    ({
      COMERCIAL: "Comercial",
      COLOSTRO: "Colostro",
      NAO_COMERCIAL: "Não comercial",
      NAO_INFORMADA: "A declarar",
    }) as Record<string, string>
  )[natureza] ?? "A declarar";
export function ConfirmacaoGruposLeite({
  folha,
  produtoId,
  produtos,
  podeLancar,
  ocupado,
  executar,
}: {
  folha: FolhaLeite;
  produtoId: string;
  produtos: { id: string; nome: string }[];
  podeLancar: boolean;
  ocupado: boolean;
  executar: (
    caminho: string,
    dados: Record<string, unknown>,
    sucesso: string,
  ) => Promise<void>;
}) {
  return (
    <>
      {folha.sessoes.map((s) => (
        <ConfirmarGrupo
          key={`${s.posicaoId}:${folha.versao}`}
          folha={folha}
          sessao={s}
          produtoId={produtoId}
          produtos={produtos}
          podeLancar={podeLancar}
          ocupado={ocupado}
          executar={executar}
        />
      ))}
    </>
  );
}
function ConfirmarGrupo({
  folha,
  sessao,
  produtoId,
  produtos,
  podeLancar,
  ocupado,
  executar,
}: {
  folha: FolhaLeite;
  sessao: FolhaLeite["sessoes"][number];
  produtoId: string;
  produtos: { id: string; nome: string }[];
  podeLancar: boolean;
  ocupado: boolean;
  executar: (
    caminho: string,
    dados: Record<string, unknown>,
    sucesso: string,
  ) => Promise<void>;
}) {
  const [grupos, setGrupos] = useState<{ chave: string; produtoId: string; medicaoIds: string[]; natureza: NaturezaGrupoLeite; motivoNatureza: string; litros: number }[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [natureza, setNatureza] = useState<NaturezaGrupoLeite | "">("");
  const [motivo, setMotivo] = useState("");
  const [motivoParcial, setMotivoParcial] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const linhas = folha.animais.flatMap((a) => {
    const medicao = a.medicoes.find((m) => m.posicaoId === sessao.posicaoId);
    return medicao ? [{ animal: a, medicao }] : [];
  });
  const disponivel = (m: (typeof linhas)[number]["medicao"]) =>
    m.id !== null &&
    m.estado === "MEDIDO" &&
    m.litros !== null &&
    m.litros > 0 &&
    m.confirmacaoEstoque === null &&
    !grupos.some(g => m.id && g.medicaoIds.includes(m.id));
  const escolhidas = linhas.filter(
    (l) =>
      l.medicao.id &&
      selecionadas.includes(l.medicao.id) &&
      disponivel(l.medicao),
  );
  const litros =
    Math.round(
      escolhidas.reduce((s, l) => s + (l.medicao.litros ?? 0), 0) * 1000,
    ) / 1000;
  const filtradas = linhas.filter((l) =>
    `${l.animal.nome ?? ""} ${l.animal.brinco}`
      .toLocaleLowerCase("pt-BR")
      .includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const paginas = Math.max(1, Math.ceil(filtradas.length / 10));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * 10, paginaAtual * 10);
  const faltandoMetadados = linhas.some(
    (l) => l.medicao.confirmacaoEstoque === undefined,
  );
  const exigeParcial = sessao.totais.pendentes > 0;
  const podeConfirmar =
    podeLancar &&
    !ocupado &&
    !!sessao.id &&
    !!produtoId &&
    !faltandoMetadados &&
    escolhidas.length > 0 &&
    !!natureza &&
    motivo.trim().length >= 5;
  return (
    <form
      noValidate
      aria-label={`Separar produção da ordenha ${sessao.nome}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeConfirmar) return;
        setGrupos(atual => [...atual, { chave: crypto.randomUUID(), produtoId, medicaoIds: escolhidas.map(l => l.medicao.id!), natureza: natureza as NaturezaGrupoLeite, motivoNatureza: motivo.trim(), litros }]);
        setSelecionadas([]);
        setNatureza("");
        setMotivo("");
      }}
    >
      <fieldset disabled={ocupado}>
        <legend>{sessao.nome} · grupos de produção</legend>
        <p>
          {formatarLitros(sessao.totais.litros)} medidos ·{" "}
          {sessao.totais.pendentes} pendentes. Selecione medições inteiras de
          animais com a mesma natureza para criar uma origem. Cada medição só
          pode entrar uma vez, em qualquer produto.
        </p>
        {faltandoMetadados && (
          <p role="alert">
            A disponibilidade das medições não foi informada. Atualize a
            conferência antes de confirmar.
          </p>
        )}
        {!!sessao.entradasEstoque?.length && (
          <details>
            <summary>
              Grupos já registrados nesta ordenha (
              {sessao.entradasEstoque.length})
            </summary>
            <ul>
              {sessao.entradasEstoque.map((g) => (
                <li key={g.entradaId}>
                  {nomeNaturezaGrupo(g.natureza)} ·{" "}
                  {formatarLitros(Number(g.quantidadeLitros))} ·{" "}
                  {produtos.find((p) => p.id === g.produtoId)?.nome ??
                    "Outro produto do estoque"}{" "}
                  ·{" "}
                  {g.status === "CONFIRMADA"
                    ? "Confirmado"
                    : g.status === "ANULADA"
                      ? "Anulado"
                      : g.status}
                  <small>
                    {linhas
                      .filter(
                        (l) =>
                          l.medicao.confirmacaoEstoque?.entradaId ===
                          g.entradaId,
                      )
                      .map(
                        (l) =>
                          `${l.animal.nome || l.animal.brinco} (${formatarLitros(l.medicao.litros)})`,
                      )
                      .join(", ") ||
                      "Detalhe dos animais não disponível nesta folha"}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        )}
        <label>
          Buscar animal em {sessao.nome}
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        <div className="leite-tabela-scroll">
          <table>
            <caption>Selecionar animais da ordenha {sessao.nome}</caption>
            <thead>
              <tr>
                <th>Selecionar</th>
                <th>Animal</th>
                <th>Medição</th>
                <th>Disponibilidade</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ animal: a, medicao: m }) => (
                <tr key={a.animalId}>
                  <td>
                    <input
                      style={{ width: 24, minHeight: 24 }}
                      type="checkbox"
                      aria-label={`Selecionar ${a.nome || "animal"} em ${sessao.nome} · brinco ${a.brinco}`}
                      disabled={!disponivel(m) || !podeLancar || ocupado}
                      checked={
                        !!m.id && selecionadas.includes(m.id) && disponivel(m)
                      }
                      onChange={(e) => {
                        const id = m.id;
                        if (id)
                          setSelecionadas((atual) =>
                            e.target.checked
                              ? [...new Set([...atual, id])]
                              : atual.filter((v) => v !== id),
                          );
                      }}
                    />
                  </td>
                  <td>
                    {a.nome || a.brinco}
                    <small>Brinco {a.brinco}</small>
                  </td>
                  <td>{formatarLitros(m.litros)}</td>
                  <td>
                    {m.confirmacaoEstoque ? (
                      <>
                        Já confirmado ·{" "}
                        {nomeNaturezaGrupo(m.confirmacaoEstoque.natureza)}
                        <small>
                          {produtos.find(
                            (p) => p.id === m.confirmacaoEstoque?.produtoId,
                          )?.nome ?? "Outro produto do estoque"}
                        </small>
                      </>
                    ) : m.confirmacaoEstoque === undefined ? (
                      "Conferência necessária"
                    ) : grupos.some(g => m.id && g.medicaoIds.includes(m.id)) ? (
                      "Grupo preparado · aguardando confirmação da sessão"
                    ) : m.estado === "NAO_ORDENHADO" ? (
                      "Não ordenhado"
                    ) : m.estado === "PENDENTE" ? (
                      "Medição pendente"
                    ) : m.litros === 0 ? (
                      "Zero medido · sem volume para entrada"
                    ) : (
                      "Disponível para este grupo"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visiveis.length && <p>Nenhum animal nesta busca.</p>}
        <div className="leite-form-inline">
          <button
            type="button"
            className="leite-secondary"
            disabled={paginaAtual <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Animais anteriores de {sessao.nome}
          </button>
          <span>
            Página {paginaAtual} de {paginas}
          </span>
          <button
            type="button"
            className="leite-secondary"
            disabled={paginaAtual >= paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próximos animais de {sessao.nome}
          </button>
        </div>
        {podeLancar && (
          <>
            <p>
              <strong>
                {escolhidas.length} animais selecionados ·{" "}
                {formatarLitros(litros)}
              </strong>
              . Destino da entrada:{" "}
              {produtos.find((p) => p.id === produtoId)?.nome ??
                "selecione um produto"}
              .
            </p>
            <div className="leite-form-inline">
              <label>
                Natureza do grupo de {sessao.nome}
                <select
                  required
                  value={natureza}
                  onChange={(e) =>
                    setNatureza(e.target.value as NaturezaGrupoLeite)
                  }
                >
                  <option value="">Escolha a natureza</option>
                  <option value="COMERCIAL">Comercial</option>
                  <option value="COLOSTRO">Colostro</option>
                  <option value="NAO_COMERCIAL">Não comercial</option>
                </select>
              </label>
              <label>
                Justificativa da natureza de {sessao.nome}
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
            </div>
            <small>
              A declaração vale para o grupo selecionado. Os demais animais e
              grupos da mesma ordenha conservam suas naturezas. Esta informação
              não certifica aptidão sanitária.
            </small>
            {exigeParcial && (
              <label>
                Justificativa da produção parcial de {sessao.nome}
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  value={motivoParcial}
                  onChange={(e) => setMotivoParcial(e.target.value)}
                />
              </label>
            )}
            <button disabled={!podeConfirmar}>
              Preparar grupo de {sessao.nome} · {formatarLitros(litros)}
            </button>
          </>
        )}
        {grupos.length > 0 && (
          <div aria-label={`Grupos preparados de ${sessao.nome}`}>
            <h3>Confira os grupos antes de confirmar a ordenha</h3>
            <p>Preparar grupos ainda não gera estoque. Confirme todos juntos ao terminar a separação dos animais.</p>
            <ul>
              {grupos.map((g, indice) => <li key={g.chave}>
                {nomeNaturezaGrupo(g.natureza)} · {formatarLitros(g.litros)} · {g.medicaoIds.length} animais
                <button type="button" disabled={ocupado} onClick={() => setGrupos(atual => atual.filter(item => item.chave !== g.chave))}>Remover grupo {indice + 1} de {sessao.nome}</button>
              </li>)}
            </ul>
            <p role="status">{formatarLitros(grupos.reduce((total, g) => total + g.litros, 0))} em grupos · {linhas.filter(l => disponivel(l.medicao)).length} animais ainda sem grupo</p>
            <button type="button" disabled={!podeLancar || ocupado || faltandoMetadados || linhas.some(l => disponivel(l.medicao)) || (exigeParcial && motivoParcial.trim().length < 5)}
              onClick={() => void executar("/estoque/confirmacoes-sessao", {
                sessaoId: sessao.id, versaoEsperada: sessao.versao,
                grupos: grupos.map(({ litros: _litros, ...g }) => g),
                ...(exigeParcial ? { motivoParcial: motivoParcial.trim() } : {}),
              }, "Ordenha confirmada. Todos os grupos foram registrados juntos, com suas origens preservadas.")}>
              Confirmar sessão de {sessao.nome} · {formatarLitros(grupos.reduce((total, g) => total + g.litros, 0))}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
