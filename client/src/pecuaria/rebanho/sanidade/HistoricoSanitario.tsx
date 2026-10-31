import { useState } from "react";
import { History, HeartPulse, FlaskConical, Search } from "lucide-react";
import { LinkInterno } from "../../../components/LinkInterno";
import {
  LinhaTempoConsulta,
  CartaoConsulta,
} from "../../../components/ConsultaVisual";
import {
  AlternarVisualizacaoConsulta,
  useVisualizacaoConsulta,
} from "../../../components/VisualizacaoConsulta";
import {
  PaginacaoLocal,
  usePaginacaoLocal,
} from "../../../components/PaginacaoLocal";
import {
  DateRangePicker,
  dateFromIso,
  isoDate,
} from "../../../components/DateRangePicker";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { dataRelativaFato } from "../lib/historicoAnimal";
import { dataSanitaria, resultadoExameSanitario } from "./rotulos";
import type { ExameResultado } from "./ResultadoExame";
import {
  enderecoSanidadeFicha,
  useAgoraSanitario,
  useColecaoFichaSanitaria,
} from "./consultaFichaSanitaria";
import "./ficha-sanitaria-consultas.css";
export type PropsConsultaSanitaria = {
  animalId?: string;
  loteId?: string;
  abrir?: (
    tipo: string,
    id: string,
    propriedadeId?: number,
    valor?: unknown,
  ) => void;
  recarregarEm?: number;
};
type Fato = Partial<ExameResultado> & {
  id: string;
  propriedadeId?: number;
  inicio?: string;
  data?: string;
  fim?: string | null;
  status?: string;
  doenca?: { nome: string };
  tipoExame?: { nome: string };
};
const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export function HistoricoSanitario({
  animalId,
  loteId,
  abrir,
  onNovoFato,
  recarregarEm,
}: PropsConsultaSanitaria & {
  onNovoFato?: (tipo: "ocorrencia" | "exame") => void;
}) {
  const q = new URLSearchParams({
    ...(animalId ? { animalId } : {}),
    ...(loteId ? { loteId } : {}),
  });
  const ocorrencias = useColecaoFichaSanitaria<Fato>(
    `/ocorrencias?${q}`,
    recarregarEm,
  );
  const exames = useColecaoFichaSanitaria<Fato>(`/exames?${q}`, recarregarEm);
  const agora = useAgoraSanitario();
  const referenciaCivil = new Date(
    `${agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}T12:00:00`,
  );
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const visual = useVisualizacaoConsulta(
    "visualHistoricoSanitario",
    "pecuaria",
  );
  const registros = [
    ...(ocorrencias.dados ?? []).map((f) => ({
      f,
      tipo: "ocorrencia",
      data: f.inicio ?? "",
      nome: f.doenca?.nome ?? "Ocorrência",
      situacao:
        f.status === "ANULADO" ? "Anulada" : f.fim ? "Encerrada" : "Aberta",
    })),
    ...(exames.dados ?? []).map((f) => ({
      f,
      tipo: "exame",
      data: f.data ?? "",
      nome: f.tipoExame?.nome ?? "Exame",
      situacao:
        f.status === "ANULADO"
          ? "Anulado"
          : f.formatoSnapshot
            ? resultadoExameSanitario(f as ExameResultado) ===
              "Aguardando resultado"
              ? "Aguardando resultado"
              : "Resultado informado"
            : "Não informado",
    })),
  ].sort(
    (a, b) => b.data.localeCompare(a.data) || a.f.id.localeCompare(b.f.id),
  );
  const filtrados = registros.filter(
    (r) =>
      (!tipo || r.tipo === tipo) &&
      (!de || r.data.slice(0, 10) >= de) &&
      (!ate || r.data.slice(0, 10) <= ate) &&
      normalizar(`${r.nome} ${r.situacao}`).includes(normalizar(busca.trim())),
  );
  const paginacao = usePaginacaoLocal(
    filtrados,
    `${animalId}|${loteId}|${tipo}|${busca}|${de}|${ate}`,
    10,
  );
  const erro = ocorrencias.erro ?? exames.erro;
  const carregando = !ocorrencias.dados || !exames.dados;
  const detalhes = (r: (typeof registros)[number]) =>
    abrir ? (
      <Button
        onClick={() => abrir(r.tipo, r.f.id, r.f.propriedadeId)}
      >
        Detalhes
      </Button>
    ) : (
      <LinkInterno
        area="pecuaria"
        aparencia="botao-primario"
        href={enderecoSanidadeFicha(
          r.tipo === "exame" ? "exames" : "ocorrencias",
          animalId,
          loteId,
        )}
      >
        Ver registros
      </LinkInterno>
    );
  return (
    <SecaoGeralAnimal
      id="historico-sanitario"
      titulo="Histórico sanitário"
      icon={History}
      className="historico-sanitario-animal"
      acao={
        onNovoFato && (
          <>
            <Button onClick={() => onNovoFato("ocorrencia")}>
              Nova ocorrência
            </Button>
            <Button onClick={() => onNovoFato("exame")}>Registrar exame</Button>
          </>
        )
      }
    >
      <div className="ficha-sanitaria-toolbar">
        <label className="ficha-sanitaria-busca">
          <Search size={17} aria-hidden />
          <input
            aria-label="Buscar histórico sanitário"
            placeholder="Buscar histórico sanitário"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <label className="sr-only" htmlFor="tipo-historico-sanitario">
          Tipo de registro
        </label>
        <SelectCampo
          id="tipo-historico-sanitario"
          value={tipo}
          onValueChange={setTipo}
        >
          <option value="">Todos os tipos</option>
          <option value="ocorrencia">Ocorrências</option>
          <option value="exame">Exames</option>
        </SelectCampo>
        <DateRangePicker
          anchor="right"
          triggerAriaLabel="Período do histórico sanitário"
          allowAll
          value={{ start: dateFromIso(de), end: dateFromIso(ate) }}
          onChange={({ start, end }) => {
            setDe(start ? isoDate(start) : "");
            setAte(end ? isoDate(end) : "");
          }}
        />
        <AlternarVisualizacaoConsulta
          {...visual}
          visual="Linha do tempo"
          rotulo="Visualização do histórico sanitário"
        />
      </div>
      <ErrorBox erro={erro} />
      {erro ? (
        <Button
          secondary
          onClick={() => {
            ocorrencias.tentar();
            exames.tentar();
          }}
        >
          Tentar novamente
        </Button>
      ) : carregando ? (
        <p role="status">Carregando histórico…</p>
      ) : (
        <>
          {!filtrados.length ? (
            <div className="ficha-sanitaria-vazio" role="status">
              <HeartPulse size={28} aria-hidden />
              <strong>
                {registros.length
                  ? "Nenhum registro encontrado para os filtros."
                  : "Nenhum histórico sanitário registrado."}
              </strong>
            </div>
          ) : visual.modo === "visual" ? (
            <LinhaTempoConsulta
              rotulo="Histórico sanitário por data"
              itens={paginacao.itens}
              dataDe={(r) => r.data}
              chaveDe={(r) => `${r.tipo}:${r.f.id}`}
              complementoData={(data) =>
                ` - ${dataRelativaFato(data, referenciaCivil)}`
              }
              render={(r) => (
                <CartaoConsulta
                  className="ficha-sanitaria-evento"
                  icon={r.tipo === "exame" ? FlaskConical : HeartPulse}
                  titulo={r.tipo === "exame" ? "Exame" : "Ocorrência"}
                  acoes={detalhes(r)}
                >
                  <div className="ficha-sanitaria-evento-resumo">
                    <strong>{r.nome}</strong>
                    <span> - {r.situacao}</span>
                  </div>
                </CartaoConsulta>
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="consulta-tabela w-full">
                <thead>
                  <tr>
                    {["Data", "Tipo", "Registro", "Situação", "Ações"].map(
                      (t) => (
                        <th key={t}>{t}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginacao.itens.map((r) => (
                    <tr key={`${r.tipo}:${r.f.id}`}>
                      <td>
                        {dataSanitaria(r.data)}
                        <small className="block">
                          {dataRelativaFato(r.data, referenciaCivil)}
                        </small>
                      </td>
                      <td>{r.tipo === "exame" ? "Exame" : "Ocorrência"}</td>
                      <td>{r.nome}</td>
                      <td>{r.situacao}</td>
                      <td>{detalhes(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginacaoLocal
            controles={paginacao.controles}
            substantivo="registros sanitários"
            id="pagina-historico-sanitario"
          />
        </>
      )}
    </SecaoGeralAnimal>
  );
}
