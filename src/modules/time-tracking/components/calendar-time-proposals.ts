import { CalendarCheck, ChevronDown } from "@lucide/svelte";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { dateLabel, hours } from "@/shared/client-api";
import { isActiveStaff } from "@/shared/client-members";
import { categoriesFor } from "@/shared/domain-categories";
import { useStoredValue } from "@/shared/client-storage";
import type { PeriodFilter } from "@/shared/period-filter";
import { calendarTimeProposals, type CalendarTimeProposal, type ProposalRange, } from "../calendar-proposals";
import { TimeBookingEditor } from "./time-booking-editor";
import styles from "./time-history.module.css";

export { default as CalendarTimeProposals } from "./calendar-time-proposals.CalendarTimeProposals.svelte";
