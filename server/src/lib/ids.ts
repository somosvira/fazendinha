import { entityIdSchema, type EntityId } from "@fazendinha/shared";

export class EntityIdError extends Error {
  constructor() {
    super("Identificador inválido");
  }
}

export function parseEntityId(value: string): EntityId {
  const parsed = entityIdSchema.safeParse(value);
  if (!parsed.success) throw new EntityIdError();
  return parsed.data;
}
