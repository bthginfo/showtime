import { bavarianHoliday } from "@/shared/bavarian-holidays";
import styles from "./holiday-label.module.css";
export const shortNames: Record<string, string> = {
    "Heilige Drei Könige": "3 Könige",
    Karfreitag: "Karfreit.",
    Ostermontag: "Osterm.",
    "Tag der Arbeit": "1. Mai",
    "Christi Himmelfahrt": "Himmelf.",
    Pfingstmontag: "Pfingstm.",
    Fronleichnam: "Fronl.",
    "Mariä Himmelfahrt": "Mariä H.",
    "Tag der Deutschen Einheit": "Einheit",
    Allerheiligen: "Allerh.",
    "1. Weihnachtstag": "1. Weihn.",
    "2. Weihnachtstag": "2. Weihn.",
};
export { default as HolidayLabel } from "./holiday-label.HolidayLabel.svelte";
