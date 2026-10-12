import { revalidateTag } from "@/platform/cache";
import { db } from "@/platform/db";
import { and, eq, sql } from "drizzle-orm";
import { memberships, profilePreferences,tenantProfiles } from "@/platform/db/schema";
import { type Context } from "@/platform/context";
import { hasPermission } from "@/platform/access";
import { HttpError } from "@/platform/http";
import { scheduleLiveChange } from "@/platform/realtime";
import { invalidateTeam } from "@/modules/records/workspace";
import { auditChange } from "@/platform/events";
import { localDay } from "@/modules/time-tracking/rules";
import type { WorkingTimeSettings } from "@/shared/working-time";
import { onboardingVersion, type RecordData } from "@/shared/contracts";
import { profileUpdateSchema } from "./schema";

export async function updateProfile(context: Context, input: RecordData) {
  const data = profileUpdateSchema.parse(input);
  if (data.workingTime || data.workingTimeDelete) {
    const targetId = data.memberId || context.user.id;
    const managesTeam = (["personnel.manage", "time.team.manage"] as const).some(permission =>
      hasPermission({ id: context.user.id, grants: context.grants }, permission, { departmentId: context.departmentId }),
    );
    if (data.workingTimeDelete || targetId !== context.user.id) {
      if (!managesTeam) throw new HttpError(403, "Für diese Sollzeit-Änderung brauchst du Teamzeit- oder Personalrechte.");
    } else if (!managesTeam && !context.grants.some(grant => hasPermission(
      { id: context.user.id, grants: [grant] }, "time.own", {
        departmentId: grant.scope === "department" ? grant.scopeId || undefined : undefined,
        productionId: grant.scope === "production" ? grant.scopeId || undefined : undefined,
      },
    ))) throw new HttpError(403, "Für dein Wochensoll brauchst du eigene Zeitbuchungsrechte.");
    const change = data.workingTime || data.workingTimeDelete!;
    const profile = await db.transaction(async (tx) => {
      const [membership] = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, targetId),
            eq(memberships.departmentId, context.departmentId),
            eq(memberships.organizationId, context.organizationId),
            eq(memberships.status, "active"),
          ),
        )
        .limit(1);
      if (!membership || (membership.role === "superadmin" && targetId !== context.user.id))
        throw new HttpError(
          403,
          "Wochenstunden können nur für Teammitglieder deiner Abteilung gepflegt werden.",
        );
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`working-time:${targetId}`}))`);
      const [existing] = await tx
        .select({ settings: tenantProfiles.workingTime })
        .from(tenantProfiles)
        .where(and(eq(tenantProfiles.userId,targetId),eq(tenantProfiles.organizationId,context.organizationId)))
        .limit(1);
      const previous = existing?.settings;
      if ((previous?.version || 0) !== change.expectedVersion)
        throw new HttpError(
          409,
          "Die Wochenstunden wurden inzwischen geändert. Lade den aktuellen Stand und prüfe deine Angaben erneut.",
        );
      let settings: WorkingTimeSettings;
      if (data.workingTimeDelete) {
        const effectiveFrom = data.workingTimeDelete.effectiveFrom;
        if (!previous?.schedules.some((schedule) => schedule.effectiveFrom === effectiveFrom))
          throw new HttpError(404, "Dieser Sollzeit-Eintrag ist nicht mehr vorhanden.");
        settings = {
          ...previous,
          version: previous.version + 1,
          schedules: previous.schedules.filter(
            (schedule) => schedule.effectiveFrom !== effectiveFrom,
          ),
        };
      } else {
        const update = data.workingTime!;
        if (previous?.schedules.length && update.effectiveFrom < localDay(new Date(), context.timezone))
          throw new HttpError(
            400,
            "Neue Wochenstunden gelten frühestens heute. Frühere Sollzeiten bleiben erhalten.",
          );
        const schedules = [
          ...(previous?.schedules || []).filter(
            (schedule) => schedule.effectiveFrom !== update.effectiveFrom,
          ),
          {
            effectiveFrom: update.effectiveFrom,
            weeklyMinutes: update.weeklyMinutes,
            workingDays: [...update.workingDays].sort((a, b) => a - b),
          },
        ].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
        if (schedules.length > 200)
          throw new HttpError(
            400,
            "Es sind bereits sehr viele Sollzeit-Änderungen hinterlegt. Bitte kontaktiere den Superadmin.",
          );
        settings = {
          version: (previous?.version || 0) + 1,
          openingBalanceSeconds: update.openingBalanceSeconds,
          schedules,
        };
      }
      const [saved] = await tx
        .insert(tenantProfiles)
        .values({userId:targetId,organizationId:context.organizationId,workingTime:settings})
        .onConflictDoUpdate({
          target:[tenantProfiles.organizationId,tenantProfiles.userId],
          set: { workingTime: settings, updatedAt: new Date() },
        })
        .returning({


          workingTime: tenantProfiles.workingTime,
        });
      await auditChange(
        tx,
        context,
        data.workingTimeDelete ? "profile.working-time.deleted" : "profile.working-time.updated",
        targetId,
      );
      return saved;
    });
    revalidateTag(`member:${targetId}`, { expire: 0 });
    invalidateTeam(context.departmentId);
    scheduleLiveChange(context.departmentId);
    return profile;
  }
  const changes = {
    ...(data.accentPalette ? { accentPalette: data.accentPalette } : {}),
    ...(data.onboardingCompleted ? { onboardingVersion, onboardingCompletedAt: new Date() } : {}),
    updatedAt: new Date(),
  };
  const [profile] = await db
    .insert(profilePreferences)
    .values({ userId: context.user.id, ...changes })
    .onConflictDoUpdate({ target: profilePreferences.userId, set: changes })
    .returning({
      accentPalette: profilePreferences.accentPalette,
      onboardingVersion: profilePreferences.onboardingVersion,
    });
  // Personal preferences do not invalidate the shared department data.
  revalidateTag(`member:${context.user.id}`, { expire: 0 });
  return profile;
}
