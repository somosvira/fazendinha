import { z } from "zod";

/** Identidade canônica das entidades sincronizáveis. */
export const entityIdSchema = z.string().uuid();

/** Identidade de um comando persistido na fila offline. */
export const commandIdSchema = entityIdSchema;

export type EntityId = z.infer<typeof entityIdSchema>;
export type CommandId = z.infer<typeof commandIdSchema>;

export function newEntityId(): EntityId {
  return crypto.randomUUID();
}
