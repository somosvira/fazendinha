import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import type { AnimalReprodutivo } from "./api";
import {
  adicionarAtividade,
  obterSugestoesVisita,
  type SugestoesVisita,
  type TipoAtividade,
  type Visita,
} from "./visitas-api";
const TIPOS: [TipoAtividade, string][] = [
  ["AVALIACAO_REPRODUTIVA", "Avaliação reprodutiva"],
  ["APLICACAO_SANITARIA", "Aplicação sanitária"],
  ["TAREFA_IATF", "Etapa IATF"],
  ["INICIAR_IATF", "Início efetivo IATF"],
  ["EXAME_SANITARIO", "Exame sanitário"],
  ["INICIAR_SANITARIO", "Iniciar protocolo sanitário"],
];
export function FormAtividade({
  visita,
  onFechar,
  onSalvo,
}: {
  visita: Visita;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [sugestoes, setSugestoes] = useState<SugestoesVisita | null>(null);
  const [origem, setOrigem] = useState("animais");
  const [contextoId, setContextoId] = useState("");
  const [animais, setAnimais] = useState<AnimalReprodutivo[]>([]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [tipo, setTipo] = useState<TipoAtividade>("AVALIACAO_REPRODUTIVA");
  const [nome, setNome] = useState("Avaliação reprodutiva");
  const [extra, setExtra] = useState(false);
  const [situacaoFiltro, setSituacaoFiltro] = useState("");
  const [motivosFiltro, setMotivosFiltro] = useState<string[]>([]);
  const motivosDoAnimal = (a: AnimalReprodutivo) => [
    ...(a.gestacao ? ["Gestação conhecida"] : []),
    ...(a.situacao === "AGUARDANDO_DIAGNOSTICO"
      ? ["Diagnóstico pós-tentativa"]
      : []),
    ...(a.situacao === "VAZIA" ? ["Vazia"] : []),
    ...(a.restricoes.length ? ["Restrição reprodutiva"] : []),
    ...(a.situacao === "DESCONHECIDA" ? ["Situação desconhecida"] : []),
  ];
  const [q, setQ] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    obterSugestoesVisita(visita.data.slice(0, 10))
      .then((p) => {
        setSugestoes(p);
        setAnimais(Array.isArray(p.animais) ? p.animais : p.animais.animais);
      })
      .catch((e) => setErro(e.message));
  }, [visita.data]);
  const tarefas =
    origem === "sanidade"
      ? (sugestoes?.tarefasSanitarias ?? [])
      : (sugestoes?.tarefasIatf ?? []);
  const tarefasCompativeis = tarefas.filter((t) =>
    origem === "sanidade"
      ? tipo === "APLICACAO_SANITARIA"
        ? t.tipo === "APLICACAO"
        : tipo === "EXAME_SANITARIO"
          ? t.tipo === "EXAME"
          : true
      : true,
  );
  const disponiveis = animais.filter(
    (a) =>
      `${a.brinco} ${a.nome ?? ""}`.toLowerCase().includes(q.toLowerCase()) &&
      (!situacaoFiltro || a.situacao === situacaoFiltro) &&
      (!motivosFiltro.length ||
        motivosFiltro.some((m) => motivosDoAnimal(a).includes(m))),
  );
  return (
    <PainelCadastro
      aberto
      titulo="Adicionar atividade"
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <>
          <Button secondary onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            form="atividade-visita"
            type="submit"
            disabled={ocupado || !escolhidos.length}
          >
            Adicionar {escolhidos.length} animais
          </Button>
        </>
      }
    >
      <form
        id="atividade-visita"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setOcupado(true);
          setErro(null);
          adicionarAtividade(visita.id, {
            propriedadeId: visita.propriedadeId,
            tipo,
            nome,
            extra,
            contexto: {
              ...(contextoId ? { protocoloId: contextoId } : {}),
              busca: q,
              situacao: situacaoFiltro,
              motivos: motivosFiltro,
            },
            participantes: escolhidos.map((id) => {
              if (origem === "animais")
                return {
                  animalId: id,
                  motivos: motivosDoAnimal(
                    animais.find((a) => a.animalId === id)!,
                  ),
                };
              const t = tarefasCompativeis.find((t) => t.id === id)!;
              return {
                animalId: t.animalId,
                motivos: [t.nome ?? t.tipo],
                ...(origem === "sanidade"
                  ? { tarefaSanitariaId: t.id }
                  : { tarefaIatfId: t.id }),
              };
            }),
          })
            .then(onSalvo)
            .catch((e) => setErro(e.message))
            .finally(() => setOcupado(false));
        }}
      >
        <ErrorBox erro={erro} />
        <label className="text-sm">
          Tipo de atividade
          <select
            className={classeInput}
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoAtividade;
              setTipo(t);
              if (t === "TAREFA_IATF") setOrigem("iatf");
              setEscolhidos([]);
              setNome(TIPOS.find(([v]) => v === t)?.[1] ?? "");
            }}
          >
            {TIPOS.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Nome
          <input
            className={classeInput}
            value={nome}
            required
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={extra}
            onChange={(e) => setExtra(e.target.checked)}
          />{" "}
          Atividade extra da visita
        </label>
        <label className="text-sm">
          Sugestões / origem da seleção
          <select
            className={classeInput}
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value);
              setEscolhidos([]);
            }}
          >
            <option value="animais">Animais · atividade extra</option>
            <option value="sanidade">Tarefas sanitárias abertas</option>
            <option value="iatf">Tarefas IATF abertas</option>
          </select>
        </label>
        {tipo === "INICIAR_SANITARIO" && (
          <label className="text-sm">
            Protocolo sanitário publicado
            <select
              required
              className={classeInput}
              value={contextoId}
              onChange={(e) => setContextoId(e.target.value)}
            >
              <option value="">Selecione</option>
              {sugestoes?.protocolosSanitarios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} · v{p.versao}
                </option>
              ))}
            </select>
          </label>
        )}
        {origem === "animais" && (
          <>
            <label className="text-sm">
              Situação reprodutiva
              <select
                className={classeInput}
                value={situacaoFiltro}
                onChange={(e) => setSituacaoFiltro(e.target.value)}
              >
                <option value="">Todas</option>
                {Array.from(new Set(animais.map((a) => a.situacao))).map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <fieldset>
              <legend className="text-sm">
                Motivos de inclusão (qualquer um)
              </legend>
              <div className="flex flex-wrap gap-3 mt-2">
                {Array.from(new Set(animais.flatMap(motivosDoAnimal))).map(
                  (m) => (
                    <label key={m} className="text-sm">
                      <input
                        type="checkbox"
                        checked={motivosFiltro.includes(m)}
                        onChange={(e) =>
                          setMotivosFiltro(
                            e.target.checked
                              ? [...motivosFiltro, m]
                              : motivosFiltro.filter((v) => v !== m),
                          )
                        }
                      />{" "}
                      {m}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
          </>
        )}
        <label className="text-sm">
          Buscar animal
          <input
            className={classeInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="max-h-96 overflow-auto divide-y divide-border border border-border rounded-lg">
          {origem !== "animais"
            ? tarefasCompativeis
                .filter((t) =>
                  `${t.animal?.brinco ?? animais.find((a) => a.animalId === t.animalId)?.brinco ?? ""} ${t.nome ?? t.tipo}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
                .map((t) => (
                  <label key={t.id} className="flex gap-3 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={escolhidos.includes(t.id)}
                      onChange={(e) =>
                        setEscolhidos(
                          e.target.checked
                            ? [...escolhidos, t.id]
                            : escolhidos.filter((id) => id !== t.id),
                        )
                      }
                    />
                    <span>
                      {t.animal?.brinco ??
                        animais.find((a) => a.animalId === t.animalId)
                          ?.brinco}{" "}
                      · {t.nome ?? t.tipo} ·{" "}
                      {(t.previstaPara ?? t.previstaEm)?.slice(0, 10)}
                    </span>
                  </label>
                ))
            : disponiveis.map((a) => (
                <label key={a.animalId} className="flex gap-3 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={escolhidos.includes(a.animalId)}
                    onChange={(e) =>
                      setEscolhidos(
                        e.target.checked
                          ? [...escolhidos, a.animalId]
                          : escolhidos.filter((id) => id !== a.animalId),
                      )
                    }
                  />
                  <span>
                    {a.brinco} {a.nome} · {a.situacao}
                  </span>
                </label>
              ))}
        </div>
      </form>
    </PainelCadastro>
  );
}
