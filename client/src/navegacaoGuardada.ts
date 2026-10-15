type GuardaNavegacao = () => Promise<boolean>;
type RegistroGuarda = { id: symbol; guarda: GuardaNavegacao };

let registro: RegistroGuarda | null = null;
let execucaoPendente: { id: symbol; promessa: Promise<boolean> } | null = null;
let execucaoAutorizadaSincrona = 0;
let proximaIntencao = 0;
let loteAberto = false;

function registrarIntencao(): number {
  if (!loteAberto) {
    proximaIntencao++;
    loteAberto = true;
    queueMicrotask(() => { loteAberto = false; });
  }
  return proximaIntencao;
}

/** Registra a guarda temporária de uma tela com alterações que precisam ser salvas. */
export function registrarGuardaNavegacao(guarda: GuardaNavegacao): () => void {
  const novo = { id: Symbol("guarda-navegacao"), guarda };
  registro = novo;
  return () => {
    if (registro?.id === novo.id) registro = null;
  };
}

/** Executa a ação imediatamente quando não há guarda; com guarda, só após confirmação. */
export function executarComGuardaNavegacao(acao: () => void): void | Promise<boolean> {
  if (execucaoAutorizadaSincrona > 0) { acao(); return; }
  const atual = registro;
  if (!atual) { acao(); return; }
  const intencao = registrarIntencao();

  let promessa = execucaoPendente?.id === atual.id ? execucaoPendente.promessa : null;
  if (!promessa) {
    let retorno: Promise<boolean>;
    try { retorno = Promise.resolve(atual.guarda()); }
    catch { retorno = Promise.resolve(false); }
    promessa = retorno.catch(() => false).then(Boolean);
    const referencia = promessa;
    execucaoPendente = { id: atual.id, promessa };
    void promessa.finally(() => { if (execucaoPendente?.promessa === referencia) execucaoPendente = null; });
  }
  return promessa.then(ok => {
    if (!ok || registro?.id !== atual.id) return false;
    // O salvamento foi aceito, mas uma ação mais recente já substituiu este
    // destino. Consome sem executar e sem sinalizar falha para não reverter URL.
    if (intencao !== proximaIntencao) return true;
    execucaoAutorizadaSincrona++;
    try { acao(); }
    finally { queueMicrotask(() => { execucaoAutorizadaSincrona = Math.max(0, execucaoAutorizadaSincrona - 1); }); }
    return true;
  });
}
