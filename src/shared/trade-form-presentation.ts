import type { Field } from "@/modules/theater/registry";

/** Explicit domain hierarchy overrides the fallback; mandatory inputs never collapse. */
export function primaryTradeFields(fields: Field[]) {
  const editable = fields.filter((field) => !field.managed);
  const specified = editable.some((field) => field.primary === true);
  const first = new Set(
    (specified ? [] : editable.filter((field) => field.primary !== false).slice(0, 4)).map(
      (field) => field.key,
    ),
  );
  return fields.filter(
    (field) =>
      !field.managed &&
      (field.required ||
        field.primary === true ||
        first.has(field.key) ||
        ["start", "end", "participantIds", "resourceId"].includes(field.key)),
  );
}
