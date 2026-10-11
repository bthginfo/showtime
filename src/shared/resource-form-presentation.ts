import type { Field } from "@/components/resource-fields";

const core = new Set([
  "title",
  "name",
  "description",
  "productionId",
  "season",
  "status",
  "priority",
  "start",
  "end",
  "due",
  "date",
  "category",
  "quantity",
  "memberIds",
  "assigneeIds",
]);
/** Preserve mandatory controls while keeping less frequent details available on demand. */
export function primaryResourceFields(fields: Field[]) {
  return fields.filter((field) => field.required || core.has(field.key));
}
