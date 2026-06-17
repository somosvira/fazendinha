/* Rio Novo — memória entre conversas da IA (persistente em localStorage).
 * Port de src/dataMemoria.js. Frontend-only: o histórico vive no navegador.
 */

export type Conversa = { id: string; data: string; titulo: string; resumo: string; topicos: string[] };
export type Fato = { id: string; texto: string; origem: string };
export type Pendencia = { id: string; texto: string; deOnde: string };
export type Memoria = { conversas: Conversa[]; fatos: Fato[]; pendencias: Pendencia[] };

const KEY = "rioNovo.ia.memoria.v1";

// fatos que a IA "lembra" entre sessões — derivados das conversas anteriores
export const memoriaInicial: Memoria = {
  conversas: [
    { id: "c1", data: "02/mai", titulo: "Custeio do leite no Q2", resumo: "Marco perguntou por que o leite não se paga. Concluímos: déficit operacional de R$ 700k em 2025, custo/litro acima do preço.", topicos: ["leite", "custeio", "break-even"] },
    { id: "c2", data: "28/abr", titulo: "Compra de matrizes", resumo: "Discutimos os R$ 1,31 mi de Animal Aquisição em custeio. Marco concordou em tratar como investimento.", topicos: ["investimento", "gado", "classificação"] },
    { id: "c3", data: "22/abr", titulo: "Salto do Curral", resumo: "Curral subiu 142%. Marco disse que é reforma do galpão de ordenha — confirmar split investimento/custeio.", topicos: ["curral", "reforma", "anomalia"] },
    { id: "c4", data: "18/abr", titulo: "Folha de pagamento", resumo: "Folha cresceu 80% em 22 meses. Marco quer acompanhar se produção justifica.", topicos: ["pessoal", "folha"] },
  ],
  fatos: [
    { id: "f1", texto: "Prefere ver investimento separado do custeio operacional sempre.", origem: "28/abr" },
    { id: "f2", texto: "Considera a reforma do curral um investimento, não custeio.", origem: "22/abr" },
    { id: "f3", texto: "Acompanha de perto o custo por litro de leite — é o KPI que mais importa pra ele.", origem: "02/mai" },
    { id: "f4", texto: "Lê em 30 segundos: quer título, número e uma frase.", origem: "preferência" },
  ],
  pendencias: [
    { id: "p1", texto: "Confirmar o split investimento/custeio da reforma do curral", deOnde: "Salto do Curral · 22/abr" },
    { id: "p2", texto: "Verificar se a produção de leite acompanhou o crescimento da folha", deOnde: "Folha de pagamento · 18/abr" },
  ],
};

export function load(): Memoria {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Memoria;
  } catch {
    /* ignora storage indisponível */
  }
  return JSON.parse(JSON.stringify(memoriaInicial)) as Memoria;
}

export function save(mem: Memoria): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* ignora storage indisponível */
  }
}

export function reset(): Memoria {
  const fresh = JSON.parse(JSON.stringify(memoriaInicial)) as Memoria;
  save(fresh);
  return fresh;
}

// dado um texto de pergunta, encontra a conversa anterior mais relacionada
export function recall(mem: Memoria, pergunta: string): Conversa | null {
  const q = (pergunta || "").toLowerCase();
  const hits = mem.conversas.filter(
    (c) => c.topicos.some((t) => q.includes(t)) || q.includes(c.titulo.toLowerCase().split(" ")[0]),
  );
  return hits[0] || null;
}
