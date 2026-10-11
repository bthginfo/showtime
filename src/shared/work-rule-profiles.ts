import { z } from "zod";
export const workRulesInput = z.object({
  minimumBreakMinutes: z.number().int().min(0).max(180),
  breakAfterHours: z.number().min(1).max(24),
  minimumRestHours: z.number().min(0).max(48),
  maxDutyHours: z.number().min(1).max(24),
  maxWeeklyHours: z.number().min(1).max(168).optional(),
  maxConsecutiveDays: z.number().int().min(1).max(31).optional(),
  confirmedByTheater: z.boolean(),
});
export const workRuleProfilesInput = z
  .array(
    z.object({
      id: z.string().min(1).max(100),
      name: z.string().trim().min(1).max(100),
      memberIds: z.array(z.string().max(100)).max(2000),
      actorIds: z.array(z.string().max(100)).max(2000).default([]),
      rules: workRulesInput,
    }),
  )
  .max(30)
  .superRefine((profiles, ctx) => {
    const seen = new Set<string>();
    for (const p of profiles)
      for (const id of [
        ...p.memberIds.map((id) => "member:" + id),
        ...p.actorIds.map((id) => "actor:" + id),
      ]) {
        if (seen.has(id))
          ctx.addIssue({
            code: "custom",
            message: "Jede Person kann nur einem Regelprofil zugeordnet sein.",
          });
        seen.add(id);
      }
  });
export type WorkRuleProfile = z.infer<typeof workRuleProfilesInput>[number];
