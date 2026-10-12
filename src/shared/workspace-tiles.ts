import {
  CalendarDays,
  BookOpen,
  MessagesSquare,
  Boxes,
  Settings2,
  Link2,
  FileCheck2,
  Building2,
  ListChecks,
  Layers3,
} from "@lucide/svelte";

/** Tile content names existing destinations; no permissions or data are invented here. */
export const theaterAreaTiles: Record<string, { description: string; icon: typeof CalendarDays }> =
  {
    trade: { description: "Fachliche Einträge öffnen und weiterbearbeiten.", icon: BookOpen },
    collaborations: {
      description: "Rückmeldungen und Freigaben mit anderen Gewerken abstimmen.",
      icon: MessagesSquare,
    },
    resources: { description: "Räume und Ausstattung finden oder reservieren.", icon: Boxes },
    schedule: {
      description: "Vorstellungen, Stücke und Spielzeiten organisieren.",
      icon: CalendarDays,
    },
    readiness: {
      description: "Offene Punkte und Bestätigungen für Produktionen prüfen.",
      icon: FileCheck2,
    },
    overview: {
      description: "Publikum, Budget und Produktionsstände im Blick behalten.",
      icon: Building2,
    },
    integrations: {
      description: "Daten importieren, exportieren und Systeme anbinden.",
      icon: Link2,
    },
    administration: {
      description: "Mitglieder, Rollen und Theatermodule verwalten.",
      icon: Settings2,
    },
  };

export const homeWorkTiles = [
  {
    id: "trade",
    title: "Arbeitsstände",
    description: "Facheinträge finden, anlegen und bearbeiten.",
    href: "/?module=theater&view=trade",
    icon: ListChecks,
  },
  {
    id: "calendar",
    title: "Mein Kalender",
    description: "Termine, Dienste und Verfügbarkeit sehen.",
    href: "/?module=calendar",
    icon: CalendarDays,
  },
  {
    id: "collaborations",
    title: "Abstimmungen",
    description: "Ideen teilen und Rückmeldungen einholen.",
    href: "/?module=theater&view=collaborations",
    icon: MessagesSquare,
  },
];

export const scheduleAreaTiles = [
  {
    id: "performances",
    title: "Vorstellungen",
    description: "Beginn, Bühne und Beteiligte planen.",
    icon: CalendarDays,
  },
  {
    id: "shift",
    title: "Termine verschieben",
    description: "Mehrere Termine gemeinsam ändern und vorher prüfen.",
    icon: Layers3,
  },
  {
    id: "versions",
    title: "Plan prüfen & veröffentlichen",
    description: "Entwurf sichern, prüfen und den gültigen Plan freigeben.",
    icon: FileCheck2,
  },
  {
    id: "works",
    title: "Werke",
    description: "Stücktitel und Urheberinnen oder Urheber verwalten.",
    icon: BookOpen,
  },
  {
    id: "seasons",
    title: "Spielzeiten",
    description: "Spielzeit und ihren Beginn und ihr Ende festlegen.",
    icon: CalendarDays,
  },
  {
    id: "phases",
    title: "Produktionsphasen",
    description: "Werk und Spielzeit zuordnen und den Arbeitsstand setzen.",
    icon: ListChecks,
  },
  {
    id: "runs",
    title: "Vorstellungsserien",
    description: "Zusammengehörige Aufführungen einer Produktion bündeln.",
    icon: Layers3,
  },
];
