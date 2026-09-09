import crypto from "node:crypto";

type Entrada = { quantidade: number; reiniciaEm: number };

export class LimiteFixo {
  private readonly entradas = new Map<string, Entrada>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
    private readonly maximoChaves = 10_000,
  ) {}

  consumir(chave: string, agora = Date.now()): boolean {
    const atual = this.entradas.get(chave);
    if (atual && atual.reiniciaEm > agora) {
      atual.quantidade += 1;
      return atual.quantidade <= this.maximo;
    }

    if (atual) this.entradas.delete(chave);
    if (this.entradas.size >= this.maximoChaves) {
      this.limparExpiradas(agora);
      if (this.entradas.size >= this.maximoChaves) return false;
    }

    this.entradas.set(chave, { quantidade: 1, reiniciaEm: agora + this.janelaMs });
    return true;
  }

  private limparExpiradas(agora: number): void {
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
    const origemPermitida = this.porOrigem.consumir(origem || "desconhecida", agora);
    if (!origemPermitida) return false;

    const emailHash = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    return this.porEmail.consumir(emailHash, agora);
  }
}
