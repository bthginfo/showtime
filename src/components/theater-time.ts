import { get } from "svelte/store";
import { useWorkspace } from "./workspace-context";
import * as time from "@/shared/client-api";
/** Component-local helpers always read this workspace; no shared mutable tenant timezone. */
export function useTheaterTime() {
  const store = useWorkspace();
  const zone = () => get(store).workspace.timezone || "Europe/Berlin";
  return {
    timezone: zone,
    localDate: (date = new Date()) => time.localDate(date, zone()),
    instantDate: (value: string) => time.instantDate(value, zone()),
    localDateTime: (value: string) => time.localDateTime(value, zone()),
    dateLabel: (value: string, withTime = false) => time.dateLabel(value, withTime, zone()),
    weekStart: (date = new Date()) => time.weekStart(date, zone()),
  };
}
