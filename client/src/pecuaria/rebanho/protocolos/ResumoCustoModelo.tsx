import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Button, ErrorBox, brl } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { getUsuario } from "../../../lib/auth";
import { Paginacao } from "../ui";
import type { EtapaIatf } from "../reproducao/Iatf";
import { reqProtocolo } from "./api";
type Referencia = {
  descricao: string;
  situacao: string;
  natureza: string;
  origem: string;
  data: string | null;
  unidade: string | null;
  quantidade: string | null;
  valorUnitario: string | null;
  valor: string | null;
};
type Estimativa = {
  situacao: string;
  total: string | null;
  totalConhecido: string | null;
  componentesConhecidos: number;
  componentesPendentes: number;
  escopo?: { tipo: "SITIO" | "CONSOLIDADO" };
  referencias: {
    itens: Referencia[];
    total: number;
    pagina: number;
    porPagina: number;
  };
};
export function ResumoCustoModelo({
  etapas,
  propriedadeId: propriedadeInformada,
  completo,
}: {
  etapas: EtapaIatf[];
  propriedadeId: number | null;
  completo: boolean;
}) {
  const usuario = getUsuario(),
    permitido =
      !usuario ||
      usuario.dono ||
      (usuario.areas.includes("financeiro") &&
        usuario.flags.includes("verValores"));
  const propriedadeId = propriedadeInformada;
  const [dados, setDados] = useState<Estimativa | null>(null),
    [erro, setErro] = useState<string | null>(null),
    [aberto, setAberto] = useState(false),
    [pagina, setPagina] = useState(1),
    [tentativa, setTentativa] = useState(0);
  const payload = JSON.stringify({
    referenciasPagina: pagina,
    etapas: etapas.map((e) => ({
      nome: e.nome,
      tipo: e.tipo,
      ...(e.planoAplicacao?.produtoId ? { produtoId: e.planoAplicacao.produtoId } : {}),
      ...(e.planoAplicacao?.produtoCatalogoId ? { produtoCatalogoId: e.planoAplicacao.produtoCatalogoId } : {}),
      ...(e.tipo === "APLICACAO" && e.planoAplicacao?.dose ? { quantidade: e.planoAplicacao.dose, unidade: e.planoAplicacao.unidadeDose } : {}),
      ...(e.referenciasCusto?.servico ? { referenciasCusto: { servico: e.referenciasCusto.servico } } : {}),
    })),
  });
  useEffect(() => {
    if (!permitido || !completo) return;
    let ativo = true;
    setDados(null);
    setErro(null);
    const espera = window.setTimeout(() => {
      reqProtocolo<Estimativa>(
        "/modelos/estimativa",
        propriedadeId ?? undefined,
        JSON.parse(payload),
      )
        .then((d) => {
          if (ativo) setDados(d);
        })
        .catch((e) => {
          if (ativo) setErro(e instanceof Error ? e.message : String(e));
        });
    }, 300);
    return () => {
      ativo = false;
      window.clearTimeout(espera);
    };
  }, [payload, permitido, propriedadeId, completo, tentativa]);
  return (
    <section
      className="cadastro-protocolo-custo"
      aria-label="Custo previsto do modelo"
    >
      <h3>Custo previsto por animal</h3>
      {!permitido ? (
        <p>Valores ocultos</p>
      ) : !completo ? (
        <p>Carregue toda a estrutura para estimar.</p>
      ) : erro ? (
        <>
          <ErrorBox erro={erro} />
          <Button
            secondary
            type="button"
            onClick={() => setTentativa((v) => v + 1)}
          >
            Tentar estimar novamente
          </Button>
        </>
      ) : !dados ? (
        <p role="status">Consultando referências de custo…</p>
      ) : (
        <>
          <strong className="block text-xl">
            {dados.totalConhecido == null
              ? "Não apurado"
              : brl(dados.totalConhecido)}
          </strong>
          <span className="quadro-custo-situacao">{dados.situacao === "COMPLETO" ? "Completo" : dados.situacao === "PARCIAL" ? "Parcial" : "Pendente"}</span>
          <Button secondary type="button" onClick={() => setAberto(true)}>
            <Package size={18} aria-hidden /> Conferir referências
          </Button>
        </>
      )}
      {aberto && (
        <PainelCadastro
          aberto
          titulo="Referências do custo previsto por animal"
          camada="sobreDetalhe"
          onFechar={() => setAberto(false)}
          rodape={
            <Button secondary type="button" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          }
        >
          
          {!dados ? (
            erro ? (
              <ErrorBox erro={erro} />
            ) : (
              <p role="status">Consultando referências…</p>
            )
          ) : (
            <>
              <p>{dados.componentesPendentes} componentes não apurados · {dados.escopo?.tipo === "CONSOLIDADO" ? "Consolidado" : "Sítio selecionado"}</p>
              <div className="protocolo-tabela">
                <table aria-label="Referências do modelo">
                  <thead>
                    <tr>
                      <th>Procedimento</th>
                      <th>Componente</th>
                      <th>Origem e data</th>
                      <th>Quantidade</th>
                      <th>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.referencias.itens.map((r, i) => (
                      <tr key={`${r.descricao}:${r.natureza}:${i}`}>
                        <td>{r.descricao}</td>
                        <td>
                          {r.natureza === "MATERIAL" ? "Material" : "Serviço"}
                        </td>
                        <td>
                          {r.origem}
                          {r.data && (
                            <span className="block">
                              {r.data
                                .slice(0, 10)
                                .split("-")
                                .reverse()
                                .join("/")}
                            </span>
                          )}
                        </td>
                        <td>
                          {r.quantidade ?? "A definir"} {r.unidade ?? ""}
                        </td>
                        <td>
                          {r.valor == null ? ({ CATALOGO_NAO_ADOTADO: "Produto ainda não adotado", PRODUTO_NAO_INFORMADO: "Produto não informado", PRODUTO_NAO_ENCONTRADO: "Produto não encontrado", UNIDADE_INCOMPATIVEL: "Unidade incompatível", QUANTIDADE_PENDENTE: "Quantidade pendente", COBERTURA_INSUFICIENTE: "Cobertura insuficiente", SALDO_ZERO: "Sem saldo", ESCOPO_VAZIO: "Sem sítios no escopo", REFERENCIA_INCOMPLETA: "Referência incompleta" }[r.situacao] ?? "Não apurado") : brl(r.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacao
                paginaAtual={dados.referencias.pagina}
                totalPaginas={Math.max(
                  1,
                  Math.ceil(dados.referencias.total / 10),
                )}
                totalItens={dados.referencias.total}
                itensPorPagina={10}
                onPaginaChange={setPagina}
                rotulo="referências"
                idSelect="custo-modelo-referencias"
              />
            </>
          )}
        </PainelCadastro>
      )}
    </section>
  );
}
