import { and, eq, ne, sql } from "drizzle-orm";
import { HttpError } from "@/platform/http";
import { can, type Context } from "@/platform/context";
import type { Transaction } from "@/platform/db";
import {
  tradeItems,
  tradeItemHistory,
  memberships,
  venueResources,
  records,
  performances,
} from "@/platform/db/schema";
import { assertProject } from "@/modules/records/repository";
import { emit } from "@/platform/events";
import type { Feature } from "./registry";
import { moduleById } from "./registry";
type Item = typeof tradeItems.$inferSelect;
type Proposal = {
  id?: string;
  moduleId: string;
  type: string;
  productionId?: string;
  status: string;
  title: string;
};

export const overlapDmx = (
  a: { universe: number; address: number; footprint: number },
  b: typeof a,
) =>
  a.universe === b.universe &&
  a.address <= b.address + b.footprint - 1 &&
  b.address <= a.address + a.footprint - 1;
export const validLimitedWindow = (from: unknown, to: unknown) =>
  typeof from === "string" &&
  typeof to === "string" &&
  /^\d{2}:\d{2}$/.test(from) &&
  /^\d{2}:\d{2}$/.test(to) &&
  from < to &&
  from >= "00:00" &&
  to <= "23:59" &&
  Number(from.slice(3)) < 60 &&
  Number(to.slice(3)) < 60;
export function stockAfter(
  stock: { available: number; loaned: number; consumed: number },
  movement: string,
  quantity: number,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new HttpError(400, "Die Menge muss eine positive ganze Zahl sein.");
  const next = { ...stock };
  if (!["receive", "consume", "loan", "return"].includes(movement))
    throw new HttpError(400, "Unbekannte Bestandsbewegung.");
  if (movement === "receive") next.available += quantity;
  if (["consume", "loan"].includes(movement)) next.available -= quantity;
  if (movement === "consume") next.consumed += quantity;
  if (movement === "loan") next.loaned += quantity;
  if (movement === "return") {
    next.available += quantity;
    next.loaned -= quantity;
  }
  if (Object.values(next).some((value) => value < 0 || !Number.isSafeInteger(value)))
    throw new HttpError(
      409,
      "Die Bewegung überschreitet den verfügbaren Bestand oder die ausgeliehene Menge.",
    );
  return next;
}
export async function validateFach(
  context: Context,
  proposal: Proposal,
  data: Record<string, unknown>,
  feature: Feature,
  existing: Item | undefined,
  tx: Transaction,
  readable: (item: Item) => boolean,
) {
  const referenceVersions: Record<string, number> = {};
  for (const field of feature.fields) {
    const values =
      field.type === "trades" || field.type === "members"
        ? Array.isArray(data[field.key])
          ? (data[field.key] as string[])
          : []
        : data[field.key]
          ? [String(data[field.key])]
          : [];
    if (field.type === "member" || field.type === "members")
      for (const id of values) {
        const [member] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.userId, id), eq(memberships.status, "active")))
          .limit(1);
        if (!member)
          throw new HttpError(400, "Eine zugeordnete Person gehört nicht zum aktiven Theaterteam.");
      }
    if (field.type === "resource" && values.length) {
      const [resource] = await tx
        .select()
        .from(venueResources)
        .where(eq(venueResources.id, values[0]))
        .limit(1);
      if (!resource) throw new HttpError(400, "Die Ressource gehört nicht zu diesem Theater.");
      if (
        proposal.moduleId === "dance" &&
        proposal.type === "training" &&
        resource.type !== "studio"
      )
        throw new HttpError(
          409,
          "Training benötigt eine als Studio gekennzeichnete Raumressource.",
        );
      if (data.requiredRoomFeature) {
        const assets = await tx
          .select()
          .from(tradeItems)
          .where(
            and(
              eq(tradeItems.type, "asset"),
              sql`${tradeItems.data}->>'resourceId'=${resource.id}`,
            ),
          );
        if (
          !assets.some((a) =>
            String(a.data.roomFeatures || "")
              .split(/[;,\n]/)
              .map((s) => s.trim().toLowerCase())
              .includes(String(data.requiredRoomFeature).toLowerCase()),
          )
        )
          throw new HttpError(
            409,
            "Die geforderte Raumeigenschaft ist für dieses Studio nicht dokumentiert.",
          );
      }
    }
    if (field.type === "performance" && values.length) {
      const [show] = await tx
        .select()
        .from(performances)
        .where(eq(performances.id, values[0]))
        .limit(1);
      if (!show || show.productionId !== proposal.productionId || show.status === "cancelled")
        throw new HttpError(
          400,
          "Die Vorstellung gehört nicht zu dieser Produktion oder wurde abgesagt.",
        );
    }
    if (["trade", "trades"].includes(field.type))
      for (const id of values) {
        if (id === proposal.id)
          throw new HttpError(400, "Ein Fachstand kann nicht auf sich selbst verweisen.");
        const [target] = await tx.select().from(tradeItems).where(eq(tradeItems.id, id)).limit(1);
        if (
          !target ||
          !readable(target) ||
          (field.key !== "sourceItemId" && ["archived", "cancelled"].includes(target.status)) ||
          (field.sourceTypes?.length && !field.sourceTypes.includes(target.type))
        )
          throw new HttpError(
            400,
            "Eine Fachreferenz ist nicht zugänglich oder hat den falschen Typ.",
          );
        await assertProject(context, target.productionId, tx);
        if (field.key !== "sourceItemId") referenceVersions[target.id] = target.version;
        if (
          !feature.private &&
          moduleById(target.moduleId)?.features.find((f) => f.id === target.type)?.private
        )
          throw new HttpError(
            400,
            "Vertrauliche Fachstände dürfen nicht mit einem allgemein sichtbaren Eintrag verknüpft werden.",
          );
        if (target.productionId && target.productionId !== (proposal.productionId || null))
          throw new HttpError(400, "Der Fachstand gehört zu einer anderen Produktion.");
        if (
          target.type === "purchase" &&
          proposal.type === "procurement" &&
          target.status !== "approved"
        )
          throw new HttpError(409, "Eine Bestellung benötigt einen genehmigten Bedarf.");
        if (
          target.type === "asset" &&
          ["blocked", "maintenance"].includes(String(target.data.condition)) &&
          ![
            "incident",
            "maintenance",
            "inspection",
            "care-cycle",
            "wig-care",
            "stock-movement",
          ].includes(proposal.type) &&
          !(proposal.type === "loan" && existing && data.returnedAt && !existing.data.returnedAt)
        )
          throw new HttpError(409, "Das zugeordnete Gerät / Teil ist gesperrt oder in Pflege.");
      }
  }
  if (Object.keys(referenceVersions).length) data._referenceVersions = referenceVersions;
  if (
    proposal.type === "device-profile" &&
    (!Number.isSafeInteger(data.footprint) ||
      Number(data.footprint) < 1 ||
      Number(data.footprint) > 512)
  )
    throw new HttpError(400, "Der Footprint muss zwischen 1 und 512 Kanälen liegen.");
  if (
    proposal.type === "maintenance-series" &&
    (!Number.isSafeInteger(data.intervalDays) ||
      Number(data.intervalDays) < 1 ||
      Number(data.intervalDays) > 3650)
  )
    throw new HttpError(400, "Wartungsintervalle liegen zwischen 1 und 3650 Tagen.");
  if (
    proposal.type === "availability" &&
    data.availability === "limited" &&
    !validLimitedWindow(data.allowedFrom, data.allowedTo)
  )
    throw new HttpError(
      400,
      "Gib für eingeschränkte Verfügbarkeit ein gültiges tägliches Zeitfenster an.",
    );
  if (existing && proposal.type === "stock-movement")
    throw new HttpError(
      409,
      "Bestandsbewegungen bleiben als Nachweis erhalten. Buche eine Gegenbewegung.",
    );
  if (proposal.type === "loan") {
    if (!Number.isSafeInteger(data.quantity) || Number(data.quantity) < 1)
      throw new HttpError(400, "Die Leihmenge muss eine positive ganze Zahl sein.");
    if (
      existing &&
      (data.assetId !== existing.data.assetId ||
        data.quantity !== existing.data.quantity ||
        (existing.data.returnedAt && data.returnedAt !== existing.data.returnedAt))
    )
      throw new HttpError(
        409,
        "Artikel, Menge und verbuchte Rückgabe bleiben als Nachweis erhalten. Lege für einen neuen Vorgang eine neue Leihe an.",
      );
    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: context.timezone || "Europe/Berlin",
    }).format(new Date());
    if (data.returnedAt && String(data.returnedAt) > today)
      throw new HttpError(
        400,
        "Eine Rückgabe kann erst nach tatsächlichem Eingang verbucht werden.",
      );
    if (proposal.status === "done" && !data.returnedAt)
      throw new HttpError(409, "Buche die Rückgabe, bevor du die Leihe abschließt.");
  }
  if (proposal.type === "asset") {
    if (!Number.isSafeInteger(data.quantity) || Number(data.quantity) < 0)
      throw new HttpError(400, "Der Bestand muss eine ganze nicht negative Zahl sein.");
    if (
      existing &&
      existing.data._stock &&
      Number(data.quantity) !== Number(existing.data.quantity)
    )
      throw new HttpError(409, "Ändere den Bestand über eine Bestandsbewegung.");
    data._stock = existing?.data._stock || {
      available: Number(data.quantity),
      loaned: 0,
      consumed: 0,
    };
  }
  if (
    proposal.moduleId === "lighting" &&
    proposal.type === "patch" &&
    (data.dmxAddress || data.dmxUniverse || data.footprint)
  ) {
    const patch = {
      universe: Number(data.dmxUniverse),
      address: Number(data.dmxAddress),
      footprint: Number(data.footprint),
    };
    if (
      !Object.values(patch).every(Number.isSafeInteger) ||
      patch.universe < 1 ||
      patch.universe > 63999 ||
      patch.address < 1 ||
      patch.footprint < 1 ||
      patch.address + patch.footprint - 1 > 512
    )
      throw new HttpError(400, "DMX: Universe 1–63999, Adresse/Kanäle innerhalb 1–512 angeben.");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":patch"}))`,
    );
    const patches = await tx
      .select()
      .from(tradeItems)
      .where(
        and(
          eq(tradeItems.moduleId, "lighting"),
          eq(tradeItems.type, "patch"),
          proposal.id ? ne(tradeItems.id, proposal.id) : undefined,
        ),
      );
    if (
      patches.some(
        (p) =>
          p.productionId === (proposal.productionId || null) &&
          !["archived", "cancelled"].includes(p.status) &&
          p.data.dmxAddress &&
          overlapDmx(patch, {
            universe: Number(p.data.dmxUniverse),
            address: Number(p.data.dmxAddress),
            footprint: Number(p.data.footprint),
          }),
      )
    )
      throw new HttpError(
        409,
        "Der DMX-Adressbereich überschneidet sich mit einem anderen Gerät dieser Produktion.",
      );
  }
  if (
    proposal.moduleId === "sound" &&
    proposal.type === "channel" &&
    (data.channelNumber || data.frequencyMHz)
  ) {
    if (
      data.channelNumber &&
      (!Number.isSafeInteger(data.channelNumber) || Number(data.channelNumber) < 1)
    )
      throw new HttpError(400, "Die Kanalnummer muss positiv und ganzzahlig sein.");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":sound"}))`,
    );
    const channels = await tx
      .select()
      .from(tradeItems)
      .where(
        and(
          eq(tradeItems.moduleId, "sound"),
          eq(tradeItems.type, "channel"),
          proposal.id ? ne(tradeItems.id, proposal.id) : undefined,
        ),
      );
    if (
      channels.some(
        (p) =>
          p.productionId === (proposal.productionId || null) &&
          !["archived", "cancelled"].includes(p.status) &&
          ((data.channelNumber && Number(p.data.channelNumber) === Number(data.channelNumber)) ||
            (data.frequencyMHz && Number(p.data.frequencyMHz) === Number(data.frequencyMHz))),
      )
    )
      throw new HttpError(
        409,
        "Kanal oder Frequenz ist in dieser Produktion bereits zugeteilt. Die Prüfung ersetzt keine Funkkoordination am Ort.",
      );
  }
  if (data.qualification && Array.isArray(data.participantIds)) {
    const proofs = await tx.select().from(tradeItems).where(eq(tradeItems.type, "qualification"));
    const day = new Intl.DateTimeFormat("sv-SE", {
      timeZone: context.timezone || "Europe/Berlin",
    }).format(new Date(String(data.start || new Date().toISOString())));
    if (
      data.participantIds.some(
        (id) =>
          !proofs.some(
            (p) =>
              p.data.memberId === id &&
              p.data.qualification === data.qualification &&
              String(p.data.validUntil) >= day &&
              !["archived", "cancelled"].includes(p.status),
          ),
      )
    )
      throw new HttpError(
        409,
        "Für mindestens eine beteiligte Person fehlt ein gültiger Qualifikationsnachweis.",
      );
  }
  if (proposal.type === "group-booking") {
    if (!Number.isSafeInteger(data.participants) || Number(data.participants) < 1)
      throw new HttpError(400, "Die Gruppengröße muss eine positive ganze Zahl sein.");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":education"}))`,
    );
    const [workshop] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, String(data.workshopId)))
      .limit(1);
    const bookings = await tx
      .select()
      .from(tradeItems)
      .where(
        and(
          eq(tradeItems.type, "group-booking"),
          sql`${tradeItems.data}->>'workshopId'=${String(data.workshopId)}`,
          proposal.id ? ne(tradeItems.id, proposal.id) : undefined,
        ),
      );
    const used = bookings
      .filter((b) => !["archived", "cancelled"].includes(b.status))
      .reduce((sum, b) => sum + Number(b.data.participants || 0), 0);
    if (
      !workshop?.data.capacity ||
      used + Number(data.participants) > Number(workshop.data.capacity)
    )
      throw new HttpError(409, "Die Gruppenbuchung überschreitet die Workshop-Kapazität.");
  }
  if (proposal.type === "participant") {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":education"}))`,
    );
    const [booking] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, String(data.bookingId)))
      .limit(1);
    const members = await tx
      .select({ id: tradeItems.id })
      .from(tradeItems)
      .where(
        and(
          eq(tradeItems.type, "participant"),
          sql`${tradeItems.data}->>'bookingId'=${String(data.bookingId)}`,
          sql`${tradeItems.status} not in ('archived','cancelled')`,
          proposal.id ? ne(tradeItems.id, proposal.id) : undefined,
        ),
      );
    if (members.length + 1 > Number(booking?.data.participants || 0))
      throw new HttpError(409, "Die Teilnehmendenliste überschreitet die bestätigte Gruppengröße.");
    if (data.consentGiven && (!data.consentPurpose || !data.consentUntil))
      throw new HttpError(
        400,
        "Dokumentierte Einwilligungen benötigen Zweck und Gültigkeitsdatum.",
      );
  }
  if (proposal.type === "procurement" && data.phase === "invoiced" && !data.invoiceNumber)
    throw new HttpError(400, "Für einen Rechnungsstand fehlt die Rechnungsnummer.");
}

async function changedFach(
  context: Context,
  item: Item,
  patch: Partial<Item>,
  tx: Transaction,
  action: string,
) {
  const [updated] = await tx
    .update(tradeItems)
    .set({ ...patch, version: item.version + 1, updatedAt: new Date() })
    .where(eq(tradeItems.id, item.id))
    .returning();
  await tx.insert(tradeItemHistory).values({
    organizationId: context.organizationId,
    itemId: item.id,
    version: updated.version,
    createdBy: context.user.id,
    data: { title: updated.title, status: updated.status, data: updated.data, action },
  });
  await emit(tx, { ...context, departmentId: item.departmentId }, "TradeItemChangedV1", {
    recordId: item.id,
    version: updated.version,
    moduleId: item.moduleId,
    productionId: item.productionId || "",
  });
  return updated;
}

async function nextMaintenance(context: Context, series: Item, tx: Transaction) {
  const day = String(series.data.nextService);
  const [previous] = await tx
    .select()
    .from(tradeItems)
    .where(eq(tradeItems.id, `maintenance-run:${series.id}:${day}`))
    .limit(1)
    .for("update");
  if (previous?.status === "done")
    throw new HttpError(
      409,
      "Dieser Wartungstermin wurde bereits abgeschlossen. Wähle einen neuen Termin.",
    );
  if (previous && ["archived", "cancelled"].includes(previous.status)) {
    await changedFach(
      context,
      previous,
      {
        status: "draft",
        ownerId: String(series.data.responsibleId),
        data: {
          ...previous.data,
          assetId: series.data.assetId,
          responsibleId: series.data.responsibleId,
          checklist: series.data.checklist,
        },
      },
      tx,
      "maintenance-series-restored",
    );
    return;
  }
  const [run] = await tx
    .insert(tradeItems)
    .values({
      id: `maintenance-run:${series.id}:${day}`,
      organizationId: context.organizationId,
      departmentId: series.departmentId,
      productionId: series.productionId,
      moduleId: "facilities",
      type: "maintenance",
      title: series.title + " · " + day,
      ownerId: String(series.data.responsibleId),
      createdBy: context.user.id,
      dueAt: new Date(day + "T12:00Z"),
      data: {
        asset: series.title,
        assetId: series.data.assetId,
        seriesId: series.id,
        responsibleId: series.data.responsibleId,
        checklist: series.data.checklist || "",
        nextService: day,
      },
    })
    .onConflictDoNothing()
    .returning();
  if (!run) return;
  await tx.insert(tradeItemHistory).values({
    organizationId: context.organizationId,
    itemId: run.id,
    version: run.version,
    createdBy: context.user.id,
    data: { title: run.title, status: run.status, data: run.data, action: "maintenance-series" },
  });
  await emit(tx, { ...context, departmentId: run.departmentId }, "TradeItemChangedV1", {
    recordId: run.id,
    version: run.version,
    moduleId: run.moduleId,
    productionId: run.productionId || "",
  });
}

export async function applyFachEffects(
  context: Context,
  saved: Item,
  tx: Transaction,
  existing?: Item,
) {
  if (saved.type === "loan") {
    const post = async (movement: "loan" | "return") => {
      const [ledger] = await tx
        .insert(tradeItems)
        .values({
          id: `loan-movement:${saved.id}:${movement}`,
          organizationId: context.organizationId,
          departmentId: saved.departmentId,
          productionId: saved.productionId,
          moduleId: saved.moduleId,
          type: "stock-movement",
          title: (movement === "loan" ? "Ausleihe: " : "Rückgabe: ") + saved.title,
          createdBy: context.user.id,
          ownerId: saved.ownerId,
          data: {
            assetId: saved.data.assetId,
            movement,
            quantity: saved.data.quantity,
            reason: "Verbucht aus Leihvorgang",
            sourceItemId: saved.id,
          },
        })
        .onConflictDoNothing()
        .returning();
      if (!ledger) return;
      await tx.insert(tradeItemHistory).values({
        organizationId: context.organizationId,
        itemId: ledger.id,
        version: ledger.version,
        createdBy: context.user.id,
        data: {
          title: ledger.title,
          status: ledger.status,
          data: ledger.data,
          action: "loan-ledger",
        },
      });
      await emit(tx, context, "TradeItemChangedV1", {
        recordId: ledger.id,
        version: ledger.version,
        moduleId: ledger.moduleId,
        productionId: ledger.productionId || "",
      });
      await applyFachEffects(context, ledger, tx);
    };
    if (!existing) await post("loan");
    if (saved.data.returnedAt && !existing?.data.returnedAt) await post("return");
  }
  if (saved.type === "maintenance-series") {
    const active = !["archived", "cancelled"].includes(saved.status);
    const changed =
      !existing ||
      ["nextService", "responsibleId", "assetId", "checklist"].some(
        (key) => saved.data[key] !== existing.data[key],
      ) ||
      saved.status !== existing.status;
    if (changed) {
      const pending = await tx
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.type, "maintenance"),
            sql`${tradeItems.data}->>'seriesId'=${saved.id}`,
            sql`${tradeItems.status} not in ('done','archived','cancelled')`,
          ),
        )
        .for("update");
      for (const run of pending) {
        if (!active || run.data.nextService !== saved.data.nextService) {
          await changedFach(
            context,
            run,
            { status: "cancelled", data: { ...run.data, _seriesChangeId: saved.id } },
            tx,
            "maintenance-series-changed",
          );
        } else
          await changedFach(
            context,
            run,
            {
              ownerId: String(saved.data.responsibleId),
              data: {
                ...run.data,
                assetId: saved.data.assetId,
                responsibleId: saved.data.responsibleId,
                checklist: saved.data.checklist,
              },
            },
            tx,
            "maintenance-series-changed",
          );
      }
      if (active) await nextMaintenance(context, saved, tx);
    }
  }
  if (
    saved.type === "maintenance" &&
    saved.status === "done" &&
    existing?.status !== "done" &&
    saved.data.seriesId
  ) {
    const [series] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, String(saved.data.seriesId)))
      .limit(1)
      .for("update");
    if (series && !["archived", "cancelled"].includes(series.status)) {
      const previous = String(saved.data.nextService);
      if (String(series.data.nextService) <= previous) {
        const day = new Date(
          Date.parse(previous + "T12:00Z") + Number(series.data.intervalDays) * 86400000,
        )
          .toISOString()
          .slice(0, 10);
        const updated = await changedFach(
          context,
          series,
          { data: { ...series.data, nextService: day } },
          tx,
          "maintenance-completed",
        );
        await nextMaintenance(context, updated, tx);
      }
    }
  }
  if (["care-cycle", "wig-care"].includes(saved.type) && saved.status !== "blocked") {
    const [asset] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, String(saved.data.assetId)))
      .limit(1)
      .for("update");
    if (asset && !can(context, "inventory.manage", asset.productionId || "", asset.departmentId))
      throw new HttpError(403, "Keine Berechtigung für dieses Fundusteil.");
    const ongoing = await tx
      .select({ id: tradeItems.id })
      .from(tradeItems)
      .where(
        and(
          sql`${tradeItems.type} in ('care-cycle','wig-care')`,
          sql`${tradeItems.data}->>'assetId'=${String(saved.data.assetId)}`,
          sql`${tradeItems.status} not in ('done','archived','cancelled')`,
          sql`coalesce(${tradeItems.data}->>'care','')<>'return'`,
        ),
      )
      .limit(1);
    const condition = ongoing.length ? "maintenance" : "available";
    if (asset && asset.data.condition !== "blocked" && asset.data.condition !== condition)
      await changedFach(
        context,
        asset,
        { data: { ...asset.data, condition, _careId: saved.id } },
        tx,
        "care-cycle",
      );
  }
  if (
    saved.type === "cast-change" &&
    (!existing ||
      saved.data.actorId !== existing.data.actorId ||
      saved.data.characterId !== existing.data.characterId)
  ) {
    const affected = await tx
      .select()
      .from(tradeItems)
      .where(
        and(
          eq(tradeItems.productionId, saved.productionId!),
          sql`${tradeItems.status} not in ('archived','cancelled')`,
          sql`${tradeItems.type} not in ('workspace','readiness','collaboration','cast-change')`,
          sql`(${tradeItems.data}->>'characterId'=${String(saved.data.characterId)} or (${String(saved.data.previousActorId || "")}<>'' and ${tradeItems.data}->>'actorId'=${String(saved.data.previousActorId || "")}))`,
        ),
      )
      .for("update");
    for (const item of affected) {
      if (moduleById(item.moduleId)?.features.find((f) => f.id === item.type)?.private) continue;
      const data = {
        ...item.data,
        _castImpact: { changeId: saved.id, actorId: saved.data.actorId },
      } as Record<string, unknown>;
      delete data._approval;
      await changedFach(
        context,
        item,
        {
          data,
          status: ["published", "ready", "done"].includes(item.status) ? "review" : item.status,
        },
        tx,
        "cast-impact",
      );
      const id = `cast-followup:${saved.id}:${saved.version}:${item.id}`;
      const task = {
        title: "Umbesetzung prüfen: " + item.title,
        description:
          "Prüfe Personenbezug und Vorbereitung. Die bisherige Zuordnung bleibt bis zur fachlichen Korrektur erhalten.",
        status: "todo",
        priority: "high",
        productionId: saved.productionId,
        assigneeIds: item.ownerId ? [item.ownerId] : [],
        sourceItemId: saved.id,
        affectedItemId: item.id,
        due: String(saved.data.effectiveFrom || ""),
      };
      const added = await tx
        .insert(records)
        .values({
          id,
          organizationId: context.organizationId,
          departmentId: item.departmentId,
          kind: "tasks",
          productionId: saved.productionId,
          createdBy: context.user.id,
          ownerId: item.ownerId,
          data: task,
        })
        .onConflictDoNothing()
        .returning();
      if (added.length)
        await emit(tx, { ...context, departmentId: item.departmentId }, "TaskAssignedV1", {
          recordId: id,
          version: 1,
          productionId: saved.productionId || "",
          userIds: task.assigneeIds,
          title: "Umbesetzung prüfen",
          body: "Eine neue Besetzung betrifft einen Fachstand.",
          link: "/?module=tasks&record=" + encodeURIComponent(id),
        });
    }
  }
  if (saved.type !== "stock-movement") return;
  const [asset] = await tx
    .select()
    .from(tradeItems)
    .where(eq(tradeItems.id, String(saved.data.assetId)))
    .limit(1)
    .for("update");
  if (!asset || !can(context, "inventory.manage", asset.productionId || "", asset.departmentId))
    throw new HttpError(403, "Keine Berechtigung für diesen Bestandsartikel.");
  const stock = asset.data._stock as { available: number; loaned: number; consumed: number };
  const next = stockAfter(
    stock || { available: Number(asset.data.quantity || 0), loaned: 0, consumed: 0 },
    String(saved.data.movement),
    Number(saved.data.quantity),
  );
  const [updated] = await tx
    .update(tradeItems)
    .set({
      data: { ...asset.data, _stock: next },
      version: asset.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(tradeItems.id, asset.id))
    .returning();
  await tx.insert(tradeItemHistory).values({
    organizationId: context.organizationId,
    itemId: asset.id,
    version: updated.version,
    createdBy: context.user.id,
    data: {
      title: asset.title,
      status: asset.status,
      data: updated.data,
      action: "stock-movement",
      movementId: saved.id,
    },
  });
  await emit(tx, context, "TradeItemChangedV1", {
    recordId: asset.id,
    version: updated.version,
    moduleId: asset.moduleId,
    productionId: asset.productionId || "",
  });
}
