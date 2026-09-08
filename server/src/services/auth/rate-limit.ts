import crypto from "node:crypto";

type Entrada = { quantidade: number; reiniciaEm: number };

export class LimiteFixo {
  private readonly entradas = new Map<string, Entrada>();

  constructor(private readonly maximo: number, private readonly janelaMs: number) {}

  consumir(chave: string, agora = Date.now()): boolean {
    const atual = this.entradas.get(chave);
    if (!atual || atual.reiniciaEm <= agora) {
      this.entradas.set(chave, { quantidade: 1, reiniciaEm: agora + this.janelaMs });
      this.limparExpiradas(agora);
      return true;
    }
    atual.quantidade += 1;
    return atual.quantidade <= this.maximo;
  }

  limpar(): void {
    this.entradas.clear();
  }

  private limparExpiradas(agora: number): void {
    if (this.entradas.size < 1_000) return;
    for (const [chave, entrada] of this.entradas) {
      if (entrada.reiniciaEm <= agora) this.entradas.delete(chave);
    }
  }
}

export class LimiteRecuperacaoSenha {
  private readonly porEmail: LimiteFixo;
  private readonly porOrigem: LimiteFixo;

  constructor(opcoes: { porEmail: number; porOrigem: number; janelaMs: number }) {
    this.porEmail = new LimiteFixo(opcoes.porEmail, opcoes.janelaMs);
    this.porOrigem = new LimiteFixo(opcoes.porOrigem, opcoes.janelaMs);
  }

  permitir(email: string, origem: string, agora = Date.now()): boolean {
    const emailHash = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    // Ambas as tentativas são contabilizadas, inclusive quando uma das chaves já
    // estourou o limite, para impedir rotação de endereços pela mesma origem.
    const emailPermitido = this.porEmail.consumir(emailHash, agora);
    const origemPermitida = this.porOrigem.consumir(origem || "desconhecida", agora);
    return emailPermitido && origemPermitida;
  }

  limpar(): void {
    this.porEmail.limpar();
    this.porOrigem.limpar();
  }
}
