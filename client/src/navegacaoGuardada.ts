type IntencaoNavegacao = "navegacao" | "troca-sitio";
type GuardaNavegacao = (intencao: IntencaoNavegacao) => Promise<boolean>;
type RegistroGuarda = { id: symbol; guarda: GuardaNavegacao };

let registro: RegistroGuarda | null = null;
let registros: RegistroGuarda[] = [];
const execucoesPendentes = new Map<IntencaoNavegacao, { id: symbol; promessa: Promise<boolean> }>();
let execucaoAutorizadaSincrona = 0;
let proximaIntencao = 0;
let intencaoDoLote: IntencaoNavegacao | null = null;

function registrarIntencao(intencao: IntencaoNavegacao): number {
  if (intencaoDoLote !== intencao) {
    const sequencia = ++proximaIntencao;
    intencaoDoLote = intencao;
    queueMicrotask(() => { if (sequencia === proximaIntencao) intencaoDoLote = null; });
  }
  return proximaIntencao;
}

/** Registra a guarda temporária de uma tela com alterações que precisam ser salvas. */
export function registrarGuardaNavegacao(guarda: GuardaNavegacao): () => void {
  const novo = { id: Symbol("guarda-navegacao"), guarda };
  registros.push(novo);
  atualizarRegistro();
  return () => {
    registros = registros.filter(item => item.id !== novo.id);
    atualizarRegistro();
  };
}

/** Uma tela pode conter vários formulários independentes; todos devem liberar a saída. */
function atualizarRegistro() {
  if (!registros.length) { registro = null; return; }
  const atuais = [...registros];
  registro = {
    id: Symbol("conjunto-guardas-navegacao"),
    guarda: async (intencao) => {
      for (const item of atuais) {
        if (!registros.some(ativo => ativo.id === item.id)) return false;
        if (!await item.guarda(intencao)) return false;
      }
      return true;
    },
  };
}

/** Executa a ação imediatamente quando não há guarda; com guarda, só após confirmação. */
export function executarComGuardaNavegacao(acao: () => void, intencao: IntencaoNavegacao = "navegacao"): void | Promise<boolean> {
  if (execucaoAutorizadaSincrona > 0) { acao(); return; }
  const atual = registro;
  if (!atual) { acao(); return; }
  const sequencia = registrarIntencao(intencao);

  const pendente = execucoesPendentes.get(intencao);
  let promessa = pendente?.id === atual.id ? pendente.promessa : null;
  if (!promessa) {
    let retorno: Promise<boolean>;
    try { retorno = Promise.resolve(atual.guarda(intencao)); }
    catch { retorno = Promise.resolve(false); }
    promessa = retorno.catch(() => false).then(Boolean);
    const referencia = promessa;
    execucoesPendentes.set(intencao, { id: atual.id, promessa });
    void promessa.finally(() => {
      if (execucoesPendentes.get(intencao)?.promessa === referencia) execucoesPendentes.delete(intencao);
    });
  }
  return promessa.then(ok => {
    if (!ok || registro?.id !== atual.id) return false;
    // O salvamento foi aceito, mas uma ação mais recente já substituiu este
    // destino. Consome sem executar e sem sinalizar falha para não reverter URL.
    if (sequencia !== proximaIntencao) return true;
    execucaoAutorizadaSincrona++;
    try { acao(); }
    finally { queueMicrotask(() => { execucaoAutorizadaSincrona = Math.max(0, execucaoAutorizadaSincrona - 1); }); }
    return true;
  });
}
