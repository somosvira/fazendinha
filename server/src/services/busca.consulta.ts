import { Prisma } from "@prisma/client";
import { temArea, temPermissao, type Area } from "./auth/papeis.js";
import type { UsuarioContexto } from "./auth/sessao.js";

export type LinhaBusca = { tipo: string; id: string; label: string; contexto: string; alvoId: string; propriedadeId: number | null };
export type FonteBusca = {
  tipo: string; grupo: string; tab: string; area?: Area | "estoque"; aba?: string;
  valores?: boolean; gestao?: boolean; global?: boolean; consulta: Prisma.Sql;
  caminho: (r: LinhaBusca) => string;
};
const sql = Prisma.sql;
const sitio = sql`p.nome`;
const localAnimal = sql`LEFT JOIN LATERAL (SELECT l."propriedadeId" FROM pecuaria."LocalizacaoAnimal" l WHERE l."animalId" = a.id ORDER BY (l.ate IS NULL) DESC, l.desde DESC, l."criadoEm" DESC, l.id DESC LIMIT 1) loc ON true LEFT JOIN public."Propriedade" p ON p.id = loc."propriedadeId"`;
// Somente nomes de tabela/coluna constantes do catálogo, nunca texto recebido na request.
function cadastro(tipo: string, tabela: string, grupo: string, caminho: string, area: Area = "pecuaria"): FonteBusca {
  const tabelaSql = Prisma.raw(`${area === "pecuaria" ? 'pecuaria' : 'public'}."${tabela}"`);
  return { tipo, grupo, tab: area === "pecuaria" ? "config" : "cadastros", area, global: true, ...(area === "financeiro" ? { aba: "cadastros" } : {}),
    consulta: sql`SELECT t.id::text AS id, t.nome::text AS label, ${grupo}::text AS contexto, concat_ws(' ', t.nome) AS texto, t.id::text AS "alvoId", NULL::integer AS "propriedadeId" FROM ${tabelaSql} t`,
    caminho: r => `${caminho}${caminho.includes('?') ? '&' : '?'}busca=${encodeURIComponent(r.label)}` };
}
function fatoAnimal(tipo: string, tabela: string, grupo: string, titulo: Prisma.Sql, caminho: FonteBusca["caminho"], tab = "pec-reproducao"): FonteBusca {
  return { tipo, grupo, tab, area: "pecuaria",
    consulta: sql`SELECT t.id, concat_ws(' — ', ${titulo}, a.brinco, a.nome) AS label, concat_ws(' › ', ${grupo}::text, p.nome, to_char(t.data, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', ${titulo}, a.brinco, a.nome, to_char(t.data, 'DD/MM/YYYY')) AS texto, a.id AS "alvoId", t."propriedadeId" FROM ${Prisma.raw('pecuaria."' + tabela + '"')} t JOIN pecuaria."Animal" a ON a.id = t."animalId" LEFT JOIN public."Propriedade" p ON p.id = t."propriedadeId"`, caminho };
}
export const FONTES_BUSCA: FonteBusca[] = [
  { tipo: "animal", grupo: "Animais", tab: "pec-rebanho", area: "pecuaria",
    consulta: sql`SELECT a.id, concat_ws(' — ', a.brinco, nullif(a.nome, '')) AS label, concat_ws(' › ', 'Rebanho', p.nome) AS contexto, concat_ws(' ', a.brinco, a.nome, a."brincoEletronico", a.sisbov, a."codigoProvisorio", a."ideagriId"::text) AS texto, a.id AS "alvoId", loc."propriedadeId" FROM pecuaria."Animal" a ${localAnimal}`,
    caminho: r => `/pecuaria/rebanho/animais/${r.id}` },
  { tipo: "lote", grupo: "Lotes de animais", tab: "pec-rebanho", area: "pecuaria",
    consulta: sql`SELECT l.id, l.nome AS label, concat_ws(' › ', 'Rebanho', p.nome) AS contexto, concat_ws(' ', l.nome, l."ideagriId"::text) AS texto, l.id AS "alvoId", l."propriedadeId" FROM pecuaria."Lote" l JOIN public."Propriedade" p ON p.id = l."propriedadeId"`,
    caminho: r => `/pecuaria/rebanho/lotes/${r.id}` },
  { tipo: "produto", grupo: "Produtos", tab: "estoque", area: "estoque", global: true,
    consulta: sql`SELECT t.id, t.nome AS label, 'Estoque › Produtos'::text AS contexto, concat_ws(' ', t.nome) AS texto, t.id AS "alvoId", NULL::integer AS "propriedadeId" FROM public."Produto" t`,
    caminho: r => `/estoque/produtos/${r.id}` },
  { tipo: "partida", grupo: "Lotes de produtos", tab: "estoque", area: "estoque", global: true,
    consulta: sql`SELECT t.id, concat_ws(' — ', t.codigo, t.nome, p.nome) AS label, 'Estoque › Lotes de produtos'::text AS contexto, concat_ws(' ', t.codigo, t.nome, t.fabricante, p.nome) AS texto, t."produtoId" AS "alvoId", NULL::integer AS "propriedadeId" FROM public."PartidaProduto" t JOIN public."Produto" p ON p.id = t."produtoId"`,
    caminho: r => `/estoque/produtos/${r.alvoId}?partidaId=${r.id}` },
  { tipo: "parceiro", grupo: "Parceiros", tab: "cadastros", area: "financeiro", aba: "cadastros", global: true,
    consulta: sql`SELECT t.id, t.nome AS label, 'Financeiro › Clientes e fornecedores'::text AS contexto, concat_ws(' ', t.nome, t."nomeFantasia", t.documento, t."pessoaContato") AS texto, t.id AS "alvoId", NULL::integer AS "propriedadeId" FROM public."Parceiro" t`,
    caminho: r => `/financeiro/configuracoes?aba=parceiros&parceiro=${r.id}` },
  cadastro("categoria", "Categoria", "Categorias financeiras", "/financeiro/configuracoes?aba=categorias", "financeiro"),
  cadastro("centro", "CentroCusto", "Centros de custo", "/financeiro/configuracoes?aba=centros", "financeiro"),
  cadastro("grupo", "GrupoCategoria", "Grupos de categorias", "/financeiro/configuracoes?aba=grupos", "financeiro"),
  { tipo: "operacao", grupo: "Operações", tab: "lancar", area: "financeiro", aba: "lancar",
    consulta: sql`SELECT o.id, concat('OP-', lpad(o.numero::text, greatest(4, length(o.numero::text)), '0'), ' — ', coalesce(nullif(o.descricao, ''), replace(o.tipo::text, '_', ' '))) AS label, concat_ws(' › ', 'Financeiro', p.nome, to_char(o.data, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', o.descricao, o.numero::text, concat('OP-', lpad(o.numero::text, greatest(4, length(o.numero::text)), '0')), o.tipo::text, pa.nome) AS texto, o.id AS "alvoId", o."propriedadeId" FROM public."Operacao" o JOIN public."Propriedade" p ON p.id = o."propriedadeId" LEFT JOIN public."Parceiro" pa ON pa.id = o."parceiroId" WHERE o.status::text <> 'RASCUNHO'`,
    caminho: r => `/financeiro/operacoes/${r.id}` },
  { tipo: "conta", grupo: "Contas", tab: "caixinha", area: "financeiro", aba: "caixinha", valores: true,
    consulta: sql`SELECT t.id, t.nome AS label, concat_ws(' › ', 'Contas e extratos', p.nome) AS contexto, concat_ws(' ', t.nome, t.instituicao, t.identificacao) AS texto, t.id AS "alvoId", t."propriedadeId" FROM public."ContaFinanceira" t JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/financeiro/contas/${r.id}` },
  { tipo: "compromisso", grupo: "Compromissos", tab: "gastos", area: "financeiro", aba: "gastos", valores: true,
    consulta: sql`SELECT c.id, concat('Compromisso ', c.seq, ' — ', coalesce(pa.nome, o.descricao, c.tipo::text)) AS label, concat_ws(' › ', 'Financeiro', p.nome, to_char(c."dataVencimento", 'DD/MM/YYYY')) AS contexto, concat_ws(' ', c.seq::text, o.descricao, pa.nome, c.tipo::text) AS texto, c.id AS "alvoId", o."propriedadeId" FROM public."CompromissoFinanceiro" c JOIN public."Operacao" o ON o.id = c."operacaoId" JOIN public."Propriedade" p ON p.id = o."propriedadeId" LEFT JOIN public."Parceiro" pa ON pa.id = c."parceiroId"`,
    caminho: r => `/financeiro/compromissos?compromisso=${r.id}&situacao=todos&status=todos` },
  { tipo: "relatorio-financeiro", grupo: "Relatórios financeiros", tab: "relatorio", area: "financeiro", aba: "relatorio", valores: true,
    consulta: sql`SELECT t.id, t.nome AS label, concat_ws(' › ', 'Relatórios', p.nome) AS contexto, concat_ws(' ', t.nome) AS texto, t.id AS "alvoId", t."propriedadeId" FROM public."RelatorioFinanceiro" t JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/financeiro/relatorios/${r.id}` },
  { tipo: "visita", grupo: "Visitas veterinárias", tab: "pec-visitas", area: "pecuaria",
    consulta: sql`SELECT t.id, t.nome AS label, concat_ws(' › ', 'Visitas', p.nome, to_char(t.data, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', t.nome, t.responsavel, to_char(t.data, 'DD/MM/YYYY')) AS texto, t.id AS "alvoId", t."propriedadeId" FROM pecuaria."VisitaVeterinaria" t JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/visitas/${r.id}` },
  { ...cadastro("dieta", "Dieta", "Receitas nutricionais", "/pecuaria/nutricao?aba=receitas"), tab: "pec-nutricao",
    caminho: r => `/pecuaria/nutricao?aba=receitas&receitaId=${r.id}&formReceita=detalhe` },
  { ...cadastro("protocolo", "Protocolo", "Protocolos", "/configuracoes/pecuaria/sanidade/protocolos"),
    consulta: sql`SELECT t.id, t.nome AS label, concat('Protocolos › Versão ', t.versao) AS contexto, concat_ws(' ', t.nome, t.descricao) AS texto, t.tipo::text AS "alvoId", NULL::integer AS "propriedadeId" FROM pecuaria."Protocolo" t`,
    caminho: r => `/configuracoes/pecuaria/${r.alvoId === 'REPRODUTIVO' ? 'reproducao' : 'sanidade'}/protocolos?cadastroBusca=${encodeURIComponent(r.label)}&cadastroSituacao=TODAS` },
  { ...cadastro("genitor", "GenitorExterno", "Genitores externos", "/configuracoes/pecuaria/genetica/genitores"),
    consulta: sql`SELECT t.id, t.nome AS label, 'Genética › Genitores externos'::text AS contexto, concat_ws(' ', t.nome, t.codigo, t.fornecedor) AS texto, t.id AS "alvoId", NULL::integer AS "propriedadeId" FROM pecuaria."GenitorExterno" t` },
  { ...cadastro("raca", "Raca", "Raças", "/configuracoes/pecuaria/genetica/racas"),
    consulta: sql`SELECT t.id, t.nome AS label, 'Genética › Raças'::text AS contexto, concat_ws(' ', t.nome, t.sigla) AS texto, t.id AS "alvoId", NULL::integer AS "propriedadeId" FROM pecuaria."Raca" t` },
  cadastro("categoria-animal", "CategoriaAnimal", "Categorias do rebanho", "/configuracoes/pecuaria/rebanho/categorias"),
  cadastro("doenca", "Doenca", "Doenças", "/configuracoes/pecuaria/sanidade/doencas"),
  cadastro("tipo-exame", "TipoExame", "Tipos de exame", "/configuracoes/pecuaria/sanidade/tipos-exame"),
  cadastro("tipo-aplicacao", "TipoAplicacaoSanitaria", "Tipos de aplicação", "/configuracoes/pecuaria/sanidade/tipos-aplicacao"),
  { tipo: "ocorrencia", grupo: "Ocorrências sanitárias", tab: "pec-sanidade", area: "pecuaria",
    consulta: sql`SELECT t.id, concat_ws(' — ', coalesce(t."doencaNomeSnapshot", d.nome), a.brinco, a.nome) AS label, concat_ws(' › ', 'Sanidade', p.nome, to_char(t.inicio, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', d.nome, t."doencaNomeSnapshot", a.brinco, a.nome) AS texto, a.id AS "alvoId", t."propriedadeId" FROM pecuaria."OcorrenciaSanitaria" t JOIN pecuaria."Animal" a ON a.id = t."animalId" JOIN pecuaria."Doenca" d ON d.id = t."doencaId" LEFT JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/sanidade?aba=ocorrencias&detalheTipo=ocorrencia&detalheId=${r.id}` },
  { tipo: "exame", grupo: "Exames", tab: "pec-sanidade", area: "pecuaria",
    consulta: sql`SELECT t.id, concat_ws(' — ', e.nome, a.brinco, a.nome) AS label, concat_ws(' › ', 'Exames', p.nome, to_char(t.data, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', e.nome, a.brinco, a.nome, t.responsavel) AS texto, a.id AS "alvoId", t."propriedadeId" FROM pecuaria."ExameAnimal" t JOIN pecuaria."Animal" a ON a.id = t."animalId" JOIN pecuaria."TipoExame" e ON e.id = t."tipoExameId" LEFT JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/sanidade?aba=exames&detalheTipo=exame&detalheId=${r.id}` },
  { tipo: "venda-leite", grupo: "Vendas de leite", tab: "pec-leite", area: "pecuaria", valores: true,
    consulta: sql`SELECT t.id, t.referencia AS label, concat_ws(' › ', 'Leite', p.nome, pa.nome) AS contexto, concat_ws(' ', t.referencia, pa.nome) AS texto, t.id AS "alvoId", t."propriedadeId" FROM pecuaria."OperacaoComercialLeite" t JOIN public."Propriedade" p ON p.id = t."propriedadeId" JOIN public."Parceiro" pa ON pa.id = t."parceiroId"`,
    caminho: r => `/pecuaria/leite?leiteSecao=vendas&operacaoLeiteId=${r.id}` },
  { tipo: "tanque", grupo: "Tanques de leite", tab: "pec-leite", area: "pecuaria",
    consulta: sql`SELECT t.id, t.nome AS label, concat_ws(' › ', 'Tanques', p.nome) AS contexto, concat_ws(' ', t.nome, t."numeroSerie", t.fabricante, t.modelo) AS texto, t.id AS "alvoId", t."propriedadeId" FROM pecuaria."TanqueLeite" t JOIN public."Propriedade" p ON p.id = t."propriedadeId" WHERE t."vigenteDesde" <= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT EXISTS (SELECT 1 FROM pecuaria."TanqueLeite" v WHERE v."identidadeId" = t."identidadeId" AND v.versao > t.versao AND v."vigenteDesde" <= (now() AT TIME ZONE 'America/Sao_Paulo')::date)`,
    caminho: r => `/configuracoes/pecuaria/producao/leite?tanqueId=${r.id}` },
  { tipo: "material", grupo: "Materiais genéticos", tab: "config", area: "pecuaria", global: true,
    consulta: sql`SELECT m.id, p.nome AS label, 'Genética › Materiais'::text AS contexto, concat_ws(' ', p.nome, m.tipo::text, a.nome, a.brinco, g.nome, g.codigo) AS texto, m.id AS "alvoId", NULL::integer AS "propriedadeId" FROM pecuaria."MaterialGenetico" m JOIN public."Produto" p ON p.id = m."produtoId" LEFT JOIN pecuaria."Animal" a ON a.id = coalesce(m."touroId", m."doadoraId") LEFT JOIN pecuaria."GenitorExterno" g ON g.id = coalesce(m."touroExternoId", m."doadoraExternaId")`,
    caminho: r => `/configuracoes/pecuaria/genetica/material-genetico?material=${r.id}` },
  { tipo: "programacao", grupo: "Programações de protocolos", tab: "pec-reproducao", area: "pecuaria",
    consulta: sql`SELECT t.id, t.nome AS label, concat_ws(' › ', 'Protocolos', p.nome) AS contexto, concat_ws(' ', t.nome, pr.nome, t."referenciaExterna") AS texto, pr.tipo::text AS "alvoId", t."propriedadeId" FROM pecuaria."ProgramacaoProtocolo" t JOIN pecuaria."Protocolo" pr ON pr.id = t."protocoloId" JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => r.alvoId === "SANITARIO" ? `/pecuaria/sanidade?aba=agenda&rodadaId=${r.id}` : `/pecuaria/reproducao/programacoes/${r.id}` },
  fatoAnimal("tentativa", "TentativaReprodutiva", "Tentativas reprodutivas", sql`concat('Tentativa ', t.tipo, ' ', t.ordem)`, r => `/pecuaria/reproducao?rotina=ciclos&visao=historico&animalId=${r.alvoId}&tentativaId=${r.id}`),
  fatoAnimal("parto", "PartoAnimal", "Partos", sql`concat('Parto ', t.tipo)`, r => `/pecuaria/reproducao/partos/${r.id}`),
  fatoAnimal("aplicacao", "AplicacaoProduto", "Aplicações sanitárias", sql`t."nomeProdutoAplicado"`, r => `/pecuaria/sanidade?aba=aplicacoes&aplicacaoId=${r.id}&animalId=${r.alvoId}`, "pec-sanidade"),
  { tipo: "fechamento-nutricao", grupo: "Fechamentos nutricionais", tab: "pec-nutricao", area: "pecuaria",
    consulta: sql`SELECT t.id, concat('Consumo — ', l.nome, ' — ', to_char(t.inicio, 'DD/MM/YYYY')) AS label, concat_ws(' › ', 'Nutrição', p.nome) AS contexto, concat_ws(' ', l.nome, 'consumo fechamento', to_char(t.inicio, 'DD/MM/YYYY'), to_char(t.fim, 'DD/MM/YYYY')) AS texto, l.id AS "alvoId", t."propriedadeId" FROM pecuaria."FechamentoConsumo" t JOIN pecuaria."Lote" l ON l.id = t."loteId" JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/nutricao?aba=fechamentos&fechamentoId=${r.id}` },
  { tipo: "movimento-estoque", grupo: "Movimentos de estoque", tab: "estoque", area: "estoque",
    consulta: sql`SELECT m.id, concat('Movimento ', m.seq, ' — ', pr.nome) AS label, concat_ws(' › ', 'Estoque', p.nome, to_char(m.data, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', m.seq::text, pr.nome, m.origem::text, m.observacao) AS texto, m.id AS "alvoId", m."propriedadeId" FROM public."MovimentoEstoque" m JOIN public."Produto" pr ON pr.id = m."produtoId" LEFT JOIN public."Propriedade" p ON p.id = m."propriedadeId"`,
    caminho: r => `/estoque?aba=movimentacoes&movimentoId=${r.id}` },
  { tipo: "documento", grupo: "Documentos financeiros", tab: "lancar", area: "financeiro", aba: "lancar", valores: true,
    consulta: sql`SELECT t.id, concat_ws(' — ', t.nome, t.numero) AS label, concat_ws(' › ', 'Documentos', p.nome) AS contexto, concat_ws(' ', t.nome, t.numero) AS texto, o.id AS "alvoId", o."propriedadeId" FROM public."DocumentoFinanceiro" t JOIN public."Operacao" o ON o.id = t."operacaoId" JOIN public."Propriedade" p ON p.id = o."propriedadeId"`,
    caminho: r => `/financeiro/operacoes/${r.alvoId}` },
  { tipo: "producao-leite", grupo: "Produção de leite", tab: "pec-leite", area: "pecuaria",
    consulta: sql`SELECT t.id, concat('Produção de leite — ', to_char(t."dataOperacional", 'DD/MM/YYYY')) AS label, concat_ws(' › ', 'Ordenhas', p.nome) AS contexto, concat_ws(' ', 'producao leite ordenhas', to_char(t."dataOperacional", 'DD/MM/YYYY'), to_char(t."dataOperacional", 'YYYY-MM-DD'), p.nome) AS texto, to_char(t."dataOperacional", 'YYYY-MM-DD') AS "alvoId", t."propriedadeId" FROM pecuaria."DiaProducaoLeite" t JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/leite?leiteSecao=ordenhas&leiteModo=individual&dataOperacional=${r.alvoId}` },
  { tipo: "amostra-leite", grupo: "Qualidade do leite", tab: "pec-leite", area: "pecuaria",
    consulta: sql`SELECT t.id, concat_ws(' — ', e.nome, coalesce(a.brinco, t."origemColetiva"), to_char(t.data, 'DD/MM/YYYY')) AS label, concat_ws(' › ', 'Qualidade do leite', p.nome) AS contexto, concat_ws(' ', 'amostra qualidade leite', e.nome, a.brinco, a.nome, t.responsavel, t."origemColetiva", to_char(t.data, 'DD/MM/YYYY')) AS texto, t.id AS "alvoId", t."propriedadeId" FROM pecuaria."AmostraQualidadeLeite" t JOIN pecuaria."TipoExame" e ON e.id = t."tipoExameId" LEFT JOIN pecuaria."ExameAnimal" ex ON ex.id = t."exameAnimalId" LEFT JOIN pecuaria."Animal" a ON a.id = ex."animalId" JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/leite?leiteSecao=qualidade&amostraId=${r.id}` },
  { tipo: "coleta-leite", grupo: "Coletas de leite", tab: "pec-leite", area: "pecuaria",
    consulta: sql`SELECT t.id, t.referencia AS label, concat_ws(' › ', 'Coletas de leite', p.nome, to_char(m.data, 'DD/MM/YYYY')) AS contexto, concat_ws(' ', t.referencia, t."pontoColeta", pa.nome, to_char(m.data, 'DD/MM/YYYY')) AS texto, concat(to_char(m.data, 'YYYY-MM-DD'), '|', t.referencia) AS "alvoId", o."propriedadeId" FROM pecuaria."RetiradaOperacaoLeite" t JOIN pecuaria."OperacaoComercialLeite" o ON o.id = t."comercialId" JOIN public."MovimentoEstoque" m ON m.id = t."movimentoId" JOIN public."Propriedade" p ON p.id = o."propriedadeId" JOIN public."Parceiro" pa ON pa.id = o."parceiroId"`,
    caminho: r => { const [data, ...referencia] = r.alvoId.split('|'); return `/pecuaria/leite?leiteSecao=coletas&coletasDe=${data}&coletasAte=${data}&coletasBusca=${encodeURIComponent(referencia.join('|'))}`; } },
  { tipo: "emissao-leite", grupo: "Relatórios do leite", tab: "pec-leite", area: "pecuaria", valores: true,
    consulta: sql`SELECT t.id, concat('Relatório do leite — ', to_char(t.inicio, 'DD/MM/YYYY'), ' a ', to_char(t.fim, 'DD/MM/YYYY')) AS label, concat_ws(' › ', 'Relatórios', p.nome) AS contexto, concat_ws(' ', 'relatorio leite emissao', to_char(t.inicio, 'DD/MM/YYYY'), to_char(t.fim, 'DD/MM/YYYY')) AS texto, t.id AS "alvoId", t."propriedadeId" FROM pecuaria."EmissaoRelatorioLeite" t JOIN public."Propriedade" p ON p.id = t."propriedadeId"`,
    caminho: r => `/pecuaria/leite?leiteSecao=relatorios&emissaoId=${r.id}` },
  { tipo: "sitio", grupo: "Sítios", tab: "sitios", gestao: true,
    consulta: sql`SELECT t.id::text, t.nome AS label, 'Administração › Sítios'::text AS contexto, concat_ws(' ', t.nome, t.apelido, t.cidade) AS texto, t.id::text AS "alvoId", t.id AS "propriedadeId" FROM public."Propriedade" t`,
    caminho: r => `/configuracoes/sitios?busca=${encodeURIComponent(r.label)}` },
  { tipo: "usuario", grupo: "Usuários", tab: "acessos", gestao: true, global: true,
    consulta: sql`SELECT t.id::text, t.nome AS label, 'Administração › Acessos'::text AS contexto, concat_ws(' ', t.nome, t.email) AS texto, t.id::text AS "alvoId", NULL::integer AS "propriedadeId" FROM public."Usuario" t`,
    caminho: r => `/acessos?usuario=${r.id}` },
];

export function fontesAutorizadas(u: UsuarioContexto): FonteBusca[] {
  return FONTES_BUSCA.filter(f => {
    if (f.gestao && !temPermissao(u, "gerenciarAcessos")) return false;
    if (f.area === "estoque" ? !temArea(u, "pecuaria") && !temArea(u, "financeiro") : f.area && !temArea(u, f.area)) return false;
    if (f.aba && !u.dono && !u.abas.includes(f.aba) && !(f.aba === "caixinha" && u.abas.includes("cadastros"))) return false;
    if (f.valores && (!temArea(u, "financeiro") || !temPermissao(u, "verValores"))) return false;
    return true;
  });
}
export const normalizarTermoBusca = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const escaparTermoBusca = (s: string) => s.replace(/[!%_]/g, c => `!${c}`);
const normalizado = (campo: Prisma.Sql) => sql`translate(lower(normalize(${campo}, NFC)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')`;
export function montarConsultaBusca(q: string, fontes: FonteBusca[], propriedadeId: number | null): Prisma.Sql {
  const termos = normalizarTermoBusca(q.trim()).split(/\s+/).filter(Boolean);
  const inteira = escaparTermoBusca(normalizarTermoBusca(q.trim()));
  const consultas = fontes.map(f => sql`(SELECT ${f.tipo}::text AS tipo, b.id, b.label, b.contexto, b."alvoId", b."propriedadeId",
    CASE WHEN b.id = ${q.trim()} OR split_part(${normalizado(sql`regexp_replace(b.label, '^(Movimento |Compromisso )', '')`)}, ' — ', 1) = ${normalizarTermoBusca(q.trim())} THEN 0 WHEN ${normalizado(sql`b.label`)} LIKE ${inteira + '%'} ESCAPE '!' THEN 1 ELSE 2 END AS ordem
    FROM (${f.consulta}) b WHERE (${Prisma.join(termos.map(t => sql`${normalizado(sql`concat_ws(' ', b.texto, ${f.grupo}::text, ${f.tipo}::text)`)} LIKE ${'%' + escaparTermoBusca(t) + '%'} ESCAPE '!'`), ' AND ')} OR b.id = ${q.trim()})
    ${propriedadeId == null || f.global ? Prisma.empty : sql`AND b."propriedadeId" = ${propriedadeId}`}
    ORDER BY ordem, b.label, b.id LIMIT 6)`);
  return sql`SELECT tipo, id, label, contexto, "alvoId", "propriedadeId" FROM (${Prisma.join(consultas, ' UNION ALL ')}) resultados ORDER BY ordem, label, tipo, id LIMIT 120`;
}
