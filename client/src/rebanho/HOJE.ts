// "Hoje" real (data corrente). Antes ancorado em 2026-06-16 pro mock;
// agora delega ao lib central para casar com o resto do app.
import { getHojeISO } from "../lib/hoje";

export const HOJE = getHojeISO();
