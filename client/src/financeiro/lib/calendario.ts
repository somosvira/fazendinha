/** Datas financeiras são datas civis: nunca converter o dia para o fuso local. */
export function diasDoCalendario(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, numero - 1, 1));
  const ultimo = new Date(Date.UTC(ano, numero, 0));
  const quantidade = Math.ceil((primeiro.getUTCDay() + ultimo.getUTCDate()) / 7) * 7;
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(Date.UTC(ano, numero - 1, 1 - primeiro.getUTCDay() + indice));
    return { data: data.toISOString().slice(0, 10), dia: data.getUTCDate() };
  });
}

export function deslocarMes(mes: string, deslocamento: number) {
  const [ano, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numero - 1 + deslocamento, 1)).toISOString().slice(0, 7);
}

export function nomeMes(mes: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${mes}-01T00:00:00Z`));
}
