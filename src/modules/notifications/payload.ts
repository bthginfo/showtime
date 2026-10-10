import type { RecordData } from "@/shared/contracts";

export function safeNotificationLink(link: unknown) {
  if (typeof link !== "string" || !link.startsWith("/?")) return "/";
  try {
    const url = new URL(link, "https://showtime.invalid");
    return url.origin === "https://showtime.invalid" && url.pathname === "/"
      ? url.pathname + url.search
      : "/";
  } catch {
    return "/";
  }
}
export function pushPayload(
  type: string,
  noticeId: string,
  userId: string,
  count: number,
  data: RecordData,
  organizationId: string,
) {
  const labels: Record<string, string> = {
    ChatMessageCreatedV1: "Neue Nachricht",
    TaskAssignedV1: "Neue Aufgabe",
    ServiceChangedV1: "Dein Dienstplan wurde geändert",
    ShiftSwapChangedV1: "Neue Information zum Diensttausch",
    LeaveRequestDecidedV1: "Dein Freiwunsch wurde beantwortet",
    LookPublishedV1: "Neuer Aufschrieb",
  };
  return {
    title: `Showtime · ${labels[type] || "Neue Mitteilung"}`,
    // Message contents and personal planning details stay inside the authenticated app.
    body: "Öffne Showtime, um die Mitteilung zu lesen.",
    url: safeNotificationLink(data.link),
    tag: noticeId,
    userId,
    organizationId,
    ownerId: `${organizationId}:${userId}`,
    unreadCount: Math.max(0, Math.floor(count)),
    timestamp: Date.now(),
  };
}
