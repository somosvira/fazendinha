import { camposNumericos, camposValores } from "./planner-api";
/** A folha só interpreta dados preservados na emissão; não consulta contexto atual. */
export const LEGENDA_FOLHA = "DEL: dias em lactação; D0 é o dia de início da lactação. Partos: fatos realizados, incluindo aborto e natimorto; não é previsão do próximo parto. RP: retenção de placenta do último parto conhecido (Sim / Não / Não informado), independente de acompanhamento sanitário atual. —: informação não preservada ou desconhecida; zero é um valor conhecido. Motivos comuns aparecem uma vez no cabeçalho da atividade; diferenças individuais aparecem na linha do animal.";

export function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
export function textoPreservado(valor: unknown): string {
  if (valor == null || valor === "") return "—";
  if (Array.isArray(valor)) return valor.map(textoPreservado).join(", ");
  if (typeof valor === "object") return Object.entries(registro(valor)).map(([k, v]) => `${k}: ${textoPreservado(v)}`).join("; ");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

const CAMPOS: Record<string, string> = {
  ...camposNumericos, ...camposValores,
  DEL: "DEL", DIAS_POS_PARTO: "Dias pós-parto", DIAS_TENTATIVA: "Dias desde tentativa",
  DIAS_CONFIRMACAO: "Dias desde confirmação", IDADE_GESTACIONAL: "Idade gestacional",
  DIAS_ATE_RETORNO: "Dias até retorno", PARTOS: "Partos realizados", TENTATIVAS_CICLO: "Tentativas no ciclo",
  CATEGORIA: "Categoria", LOTE: "Lote", RP: "RP do último parto", SITUACAO: "Situação reprodutiva",
  PAPEL_REPRODUTIVO: "Papel reprodutivo", SITUACAO_PRODUTIVA: "Situação produtiva",
  DESCARTE: "Descarte", RETORNO_INFORMADO: "Retorno informado", BRINCO: "Brinco", NOME: "Nome",
};
const SITUACOES: Record<string, string> = { VAZIA: "Vazia", GESTANTE: "Gestante", DESCONHECIDA: "Desconhecida", APTA: "Apta", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico" };
const PRODUTIVAS: Record<string, string> = { LACTANTE: "Lactante", SECA: "Seca", SEM_LACTACAO: "Sem lactação", NAO_INFORMADA: "Não informada" };
const PAPEIS: Record<string, string> = { NENHUM: "Sem papel reprodutivo", DOADORA: "Doadora", RECEPTORA: "Receptora", MATRIZ: "Matriz" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALORES_LEGIVEIS: Record<string, Record<string, string>> = {
  SEXO: {F:"Fêmea",M:"Macho"}, ORIGEM:{NASCIDO:"Nascimento na fazenda",COMPRADO:"Compra"}, APTIDAO:{LEITE:"Leite",CORTE:"Corte",REPRODUCAO:"Reprodução"}, NASCIMENTO_ESTIMADO:{SIM:"Sim",NAO:"Não"}, HISTORICO_PARTO:{CONHECIDO:"Com parto conhecido",SEM_REGISTRO:"Sem registro"}, PROTOCOLO_ATIVO:{QUALQUER:"Qualquer domínio",REPRODUTIVO:"Reprodutivo",SANITARIO:"Sanitário",AMBOS:"Ambos",NENHUM:"Sem protocolo ativo"},
  SITUACAO: SITUACOES, SITUACAO_PRODUTIVA: PRODUTIVAS, PAPEL_REPRODUTIVO: PAPEIS,
  RP: { SIM: "Sim", NAO: "Não", "NÃO": "Não", DESCONHECIDO: "Não informado" },
  DESCARTE: { SIM: "Sim", NAO: "Não", "NÃO": "Não" },
  RETORNO_INFORMADO: { SIM: "Sim", NAO: "Não", "NÃO": "Não" },
};

export function descreverCondicaoPreservada(valor: unknown, apresentacao: Record<string, unknown> = {}): string {
  const c = registro(valor), campo = CAMPOS[String(c.campo)] ?? "Campo";
  if (c.tipo === "DESCONHECIDO") return `${campo}: não informado ou conflitante`;
  if (c.tipo === "VALORES") {
    const valores = Array.isArray(c.valores) ? c.valores.filter((v): v is string => typeof v === "string") : [];
    const referencias = Array.isArray(apresentacao.referenciasSelecao) ? apresentacao.referenciasSelecao.map(registro) : [];
    if (["CATEGORIA","LOTE","RACA","PROTOCOLO"].includes(String(c.campo)) && valores.length && valores.every(v=>referencias.some(r=>r.id===v))) return `${campo}: ${valores.map(v=>referencias.find(r=>r.id===v)?.nome).join(" ou ")}`;
    if (c.campo === "BUSCA") return `${campo}: ${valores.join(" ou ")}`;
    const conhecidos = VALORES_LEGIVEIS[String(c.campo)];
    const nomes = conhecidos ? valores.map(v => conhecidos[v] ?? null).filter((v): v is string => !!v) : [];
    if (conhecidos && nomes.length === valores.length && nomes.length) return `${campo}: ${nomes.join(" ou ")}`;
    if (c.campo === "CATEGORIA" || c.campo === "LOTE") {
      const nome = c.campo === "CATEGORIA" ? apresentacao.categoriaNome : apresentacao.loteNome;
      return `${campo}: ${typeof nome === "string" && nome && !UUID.test(nome) ? nome : "nome não preservado"}${valores.length > 1 ? ` (${valores.length} selecionado(s))` : ""}`;
    }
    return `${campo}: ${valores.length} valor(es) selecionado(s); nomes não preservados`;
  }
  if (c.tipo === "FAIXA") {
    const min = typeof c.min === "number" && Number.isFinite(c.min) ? `${c.incluirMin === false ? ">" : "≥"} ${c.min}` : "sem mínimo";
    const max = typeof c.max === "number" && Number.isFinite(c.max) ? `${c.incluirMax === false ? "<" : "≤"} ${c.max}` : "sem máximo";
    return `${campo}: ${min} e ${max}`;
  }
  return "Condição não preservada em formato legível.";
}

function exclusoesFolha(valor: unknown): string {
  if (valor == null) return "Exclusões não preservadas.";
  if (!Array.isArray(valor)) return "Exclusões preservadas; quantidade não disponível.";
  if (!valor.length) return "Nenhuma exclusão.";
  const legiveis = valor.map(item => {
    const e = registro(item), nome = [e.brinco, e.nome].filter((v): v is string => typeof v === "string" && !!v && !UUID.test(v)).join(" · ");
    const motivo = typeof e.motivo === "string" && !UUID.test(e.motivo) ? e.motivo : "";
    return nome || motivo ? `${nome || "Animal sem identificação legível"}${motivo ? ` — ${motivo}` : ""}` : null;
  }).filter((v): v is string => !!v);
  return legiveis.length
    ? `Exclusões (${valor.length}): ${legiveis.join("; ")}${legiveis.length < valor.length ? `; mais ${valor.length - legiveis.length} sem identificação legível` : ""}.`
    : `${valor.length} exclusão(ões); identificações não preservadas.`;
}

/** Apresenta apenas critérios legíveis, descartando chaves técnicas e IDs. */
export function criteriosFolha(contexto: unknown): string[] {
  const ctx = registro(contexto), c = registro(ctx.selecaoCriterios ?? ctx.criterios ?? registro(ctx.filtros).criterios);
  const apresentacao: Record<string,unknown> = {...registro(ctx.apresentacao),referenciasSelecao:ctx.referenciasSelecao};
  if (!Object.keys(c).length) return ["Critérios de inclusão não preservados nesta emissão.", exclusoesFolha(registro(ctx.ajustesManuais).excluidos ?? ctx.excluidos)];
  const linhas: string[] = [];
  if (Array.isArray(c.todas)) linhas.push(`Condições obrigatórias (E): ${c.todas.length ? c.todas.map(v => descreverCondicaoPreservada(v, apresentacao)).join(" E ") : "nenhuma"}`);
  if (Array.isArray(c.qualquer)) linhas.push(`Alternativas (OU; E dentro de cada bloco): ${c.qualquer.length ? c.qualquer.map(b => {
    const bloco = Array.isArray(registro(b).todas) ? registro(b).todas as unknown[] : [];
    return `(${bloco.map(v => descreverCondicaoPreservada(v, apresentacao)).join(" E ") || "nenhuma condição"})`;
  }).join(" OU ") : "nenhuma"}`);
  if (c.politicaDesconhecidos != null) linhas.push(`Dados desconhecidos: ${c.politicaDesconhecidos === "INCLUIR" ? "incluir" : c.politicaDesconhecidos === "EXCLUIR" ? "excluir" : "política não reconhecida"}`);
  if (Array.isArray(c.ordenacao) && c.ordenacao.length) {
    const ordenacao = c.ordenacao.map(item => {
      const o = registro(item), campo = CAMPOS[String(o.campo)];
      return campo ? `${campo} ${o.direcao === "DESC" ? "decrescente" : "crescente"}` : null;
    }).filter((v): v is string => !!v);
    if (ordenacao.length) linhas.push(`Ordenação definida: ${ordenacao.join("; ")}. A folha conserva a ordem persistida dos participantes.`);
  }
  const nomeCategoria = typeof apresentacao.categoriaNome === "string" ? apresentacao.categoriaNome : null;
  const nomeLote = typeof apresentacao.loteNome === "string" ? apresentacao.loteNome : null;
  const situacao = typeof c.situacao === "string" ? SITUACOES[c.situacao] : null;
  if (situacao) linhas.push(`Situação reprodutiva: ${situacao}.`);
  if (typeof c.categoriaId === "string") linhas.push(`Categoria: ${nomeCategoria && !UUID.test(nomeCategoria) ? nomeCategoria : "nome não preservado"}.`);
  if (typeof c.loteId === "string") linhas.push(`Lote: ${nomeLote && !UUID.test(nomeLote) ? nomeLote : "nome não preservado"}.`);
  if (typeof c.situacao === "string" && !situacao) linhas.push("Situação: valor/nome não preservado em formato reconhecido.");
  for (const [campo, rotulo] of [["diasTentativa", "Dias desde tentativa"], ["diasParto", "Dias pós-parto"], ["diasGestacao", "Dias de gestação"]] as const) {
    const minimo = c[`${campo}Min`], maximo = c[`${campo}Max`];
    if (typeof minimo === "number" && Number.isFinite(minimo) || typeof maximo === "number" && Number.isFinite(maximo)) {
      linhas.push(`${rotulo}: ${typeof minimo === "number" && Number.isFinite(minimo) ? `≥ ${minimo}` : "sem mínimo"} e ${typeof maximo === "number" && Number.isFinite(maximo) ? `≤ ${maximo}` : "sem máximo"}.`);
    }
  }
  linhas.push(exclusoesFolha(registro(ctx.ajustesManuais).excluidos ?? ctx.excluidos));
  const manuais = registro(ctx.ajustesManuais).incluidos;
  if (Array.isArray(manuais) && manuais.length) linhas.push(`Inclusões manuais (${manuais.length}): ${manuais.map(v=>{const a=registro(v);return `${a.brinco??"Sem brinco"}${a.nome?` · ${a.nome}`:""}`;}).join("; ")}.`);
  const origem = registro(ctx.grupoPlanner);
  if (origem.origem === "EXTRA" && typeof origem.nome === "string") linhas.push(`Grupo extra: ${UUID.test(origem.nome) ? "nome não preservado" : origem.nome}.`);
  else if (origem.origem === "SELECAO") linhas.push("Seleção habitual; nome não preservado nesta emissão.");
  return linhas;
}

export function motivosComunsFolha(participantes: Array<{ snapshot: unknown }>): string[] {
  if (!participantes.length) return [];
  const linhas = participantes.map(p => {
    const valores = registro(p.snapshot).motivos;
    return Array.isArray(valores) ? valores.filter((v): v is string => typeof v === "string" && !!v && !UUID.test(v)) : [];
  });
  return [...new Set(linhas[0])].filter(motivo => linhas.every(m => m.includes(motivo)));
}

export function motivosIndividuaisFolha(snapshot: unknown, comuns: string[]): string[] {
  const motivos = registro(snapshot).motivos;
  return (Array.isArray(motivos) ? motivos : []).filter((v): v is string => typeof v === "string" && !!v && !UUID.test(v) && !comuns.includes(v));
}

/** Usa nomes e datas do snapshot de tarefa, ignorando completamente suas chaves internas. */
export function detalhesTarefaFolha(nomeAtividade: string, contexto: unknown, participantes: Array<{ snapshot: unknown }>): string[] {
  const tarefas = participantes.map(p => registro(registro(p.snapshot).tarefaPlanejada));
  const tarefa = registro(tarefas.map(t => t.tarefa).find(v => v != null));
  const execucao = registro(tarefa.execucao);
  const protocolo = registro(tarefa.protocolo ?? execucao.protocolo);
  const etapa = registro(tarefa.etapa ?? execucao.etapa);
  const linhas: string[] = [];
  const protocoloNome = typeof protocolo.nome === "string" ? protocolo.nome : null;
  const etapaNome = typeof etapa.nome === "string" ? etapa.nome : typeof tarefa.nome === "string" ? tarefa.nome : null;
  const versao = protocolo.versao ?? tarefa.versao;
  const prevista = typeof tarefa.previstaPara === "string" ? tarefa.previstaPara : null;
  if (protocoloNome) linhas.push(`Protocolo: ${protocoloNome}${versao != null ? ` · versão ${String(versao)}` : " · versão não preservada"}.`);
  else if (registro(contexto).grupoPlanner && registro(registro(contexto).grupoPlanner).origem === "PROTOCOLO") linhas.push(`Detalhes estruturados do protocolo não preservados; nome do grupo: ${nomeAtividade || "não preservado"}.`);
  if (etapaNome) linhas.push(`Etapa: ${etapaNome}.`);
  else if (registro(contexto).grupoPlanner && registro(registro(contexto).grupoPlanner).origem === "PROTOCOLO" && protocoloNome) linhas.push("Nome da etapa não preservado separadamente.");
  if (prevista) linhas.push(`Previsão preservada: ${prevista.slice(0, 10)}.`);
  if (!linhas.length && !nomeAtividade) linhas.push("Nome do grupo não preservado nesta emissão.");
  return linhas;
}

export function rpFolha(snapshot: unknown): string {
  const s = registro(snapshot);
  if (s.retencaoPlacenta === true) return "Sim";
  if (s.retencaoPlacenta === false) return "Não";
  // Apenas saldo explicitamente zero comprova que não houve parto no snapshot.
  if (s.partos === 0) return "Sem parto registrado";
  return "Não informado";
}
