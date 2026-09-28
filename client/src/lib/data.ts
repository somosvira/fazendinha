export const dia = (valor: string) => valor.slice(0, 10);
export const dataIso = (data: Date | string) =>
  typeof data === "string" ? new Date(`${dia(data)}T00:00:00.000Z`).toISOString() : data.toISOString();
export const hojeIso = () => `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
