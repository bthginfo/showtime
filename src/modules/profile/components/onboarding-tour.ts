import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Clock3, Layers3, MessageSquare, Theater, } from "@lucide/svelte";
import { onboardingVersion, type AccentPalette } from "@/shared/contracts";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";
import { AccentPicker, useAccentPreview } from "./accent-picker";
export const steps = [
    {
        module: "today",
        title: "Dein Tag hinter der Bühne.",
        icon: Check,
        text: "Heute bündelt deine Aufgaben, die nächsten Dienste und deine gebuchte Zeit. Von hier kommst du direkt zu deinem nächsten Arbeitsschritt.",
        tips: [
            "Persönliche Aufgaben öffnen immer den passenden Produktionsarbeitsraum.",
            "Die Suche findet Einträge aus deinen freigegebenen Bereichen.",
        ],
    },
    {
        module: "productions",
        title: "Ein Stück. Ein gemeinsamer Arbeitsraum.",
        icon: Theater,
        text: "Öffne ein Stück, um Team, Aufgaben, Figuren, Bilder und Termine zu sehen. Die Maskenbetreuung steht schon auf der Produktionskarte.",
        tips: [
            "Ihr könnt Produktionen, Kontakte, Figuren und Besetzungen gemeinsam anlegen und bearbeiten.",
            "Figuren und Besetzungen können mehrere Bilder bekommen: zuerst speichern, dann die Galerie nutzen.",
        ],
    },
    {
        module: "tasks",
        title: "Klar verteilen, gemeinsam vorankommen.",
        icon: Layers3,
        text: "Hier stehen allgemeine Aufgaben der Maske. Die Aufgaben eines Stücks findest du in der Produktion. Dort zeigt ein Board den Arbeitsstand; Sprints bündeln Aufgaben für einen Zeitraum.",
        tips: [
            "Aufgaben können Verantwortliche, Unteraufgaben und Checklisten haben.",
            "Am Smartphone kannst du den Status auch im Auswahlfeld der Aufgabe ändern.",
        ],
    },
    {
        module: "documentation",
        title: "Wissen bleibt im Team.",
        icon: BookOpen,
        text: "Aufschriebe sammeln euer Wissen zu einer Schauspielperson. Vorbereitung, Makeup, Haare und Wechsel haben eigene Textfelder. Allgemeine und archivierte Aufschriebe findest du hier gemeinsam.",
        tips: [
            "Der Schauspielerkatalog bündelt Kontakte, Perückenmaße, Hinweise und Fotos.",
            "Ansprechpersonen verwaltest du im Verzeichnis. Dienstübergaben sind ein gemeinsamer Bereich mit Hinweisen und Checklisten.",
        ],
    },
    {
        module: "calendar",
        title: "Gemeinsam planen, persönlich sehen.",
        icon: CalendarDays,
        text: "Wähle die Personen aus, deren Termine du sehen möchtest. Unter Team siehst du eine ganze Woche oder einen Monat gemeinsam. Deinen eigenen Kalender kannst du selbst planen. Termine für andere Personen und die Freigabe freier Tage übernehmen Admins.",
        tips: [
            "Am Smartphone öffnest du die Kalenderauswahl über dem Kalender. Tippe einen Tag an, um Namen und Zeiten zu sehen. Unter Aktionen kannst du den Kalender exportieren oder einen freien Tag wünschen.",
            "Kategorien verwalten Admins. Unter Einstellungen kannst du deinen persönlichen Kalender abonnieren.",
        ],
    },
    {
        module: "time",
        title: "Arbeitszeit ohne Papierstapel.",
        icon: Clock3,
        text: "Zwei Timer erfassen getrennt, wie lange du im Theater bist und woran du arbeitest. Beide dürfen gleichzeitig laufen. Du kannst Zeiten auch später eintragen und korrigieren.",
        tips: [
            "Ohne Internet kannst du Zeiten auf dem Gerät vormerken. Sobald du wieder verbunden bist, kannst du sie speichern.",
            "Deine Zeiten werden direkt gespeichert und bleiben bearbeitbar. Unter Einstellungen hinterlegst du deine Wochenstunden für das persönliche Zeitkonto. Anwesenheit bleibt getrennt von Produktionsarbeit.",
        ],
    },
    {
        module: "chat",
        title: "Kurze Wege und Hilfe, wenn du sie brauchst.",
        icon: MessageSquare,
        text: "In Teamkanälen erreichst du die ganze Maske. Admins können weitere Teamkanäle anlegen. Private Chats sind nur für die ausgewählten Personen sichtbar. Absprachen zu einem Stück stehen im Projektchat. Hilfe erklärt dir alle Schritte.",
        tips: [
            "Deine Rückmeldungen findest du dort im eigenen Verlauf.",
            "Du kannst diese Einführung jederzeit aus der Hilfe neu starten.",
        ],
    },
] as const;
export { default as OnboardingTour } from "./onboarding-tour.OnboardingTour.svelte";
