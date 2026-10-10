<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { BrandMark } from "./brand-mark";
import { Bell, ArrowLeft, BookOpen, CalendarDays, ClipboardCheck, Clock3, Download, Home, CircleHelp, Layers3, LogOut, Menu, MessageSquare, Package, Search, Settings2, Theater, Users, WifiOff, X, type LucideIcon, } from "@lucide/svelte";
import { captureNavigationScroll, closeRecordDetail, navigateWorkspace, navigationReturn, recordHref, restoreNavigationScroll, returnToContext, setNavigationUser, } from "@/shared/client-navigation";
import { subscribeLocation, subscribeMobile } from "@/shared/client-storage";
import { onboardingVersion, type DomainRecord, type RecordKind } from "@/shared/contracts";
import { initials, post, value } from "@/shared/client-api";
import { useWorkspace } from "./workspace-context";
import { stopPushOnLogout } from "@/modules/notifications/client";
import { chatUnreadCounts, unreadNotifications } from "@/modules/notifications/unread";
import { Badge, Empty, Modal } from "./ui";
import { ThemeSwitch } from "./theme-switch";
import { LiveStatus } from "./live-status";
import { RecordDetail, ResourceView } from "./resource-view";
import { TodayModule } from "./modules/today";
import { ProductionsModule } from "./modules/productions";
import { TasksModule } from "./modules/tasks";
import { CalendarModule } from "./modules/calendar";
import { TimeModule } from "./modules/time";
import { ChatModule } from "./modules/chat";
import chatStyles from "@/modules/chat/components/chat-viewport.module.css";
import { SettingsModule } from "./modules/settings";
import { labels } from "./resource-fields";
import { ProfileAccent } from "@/modules/profile/components/accent-picker";
import { OnboardingTour } from "@/modules/profile/components/onboarding-tour";
import { HelpModule } from "@/modules/help/components/help-module";
import { DocumentationModule } from "@/modules/documentation/components/documentation-module";
import { PeopleModule } from "@/modules/people/components";
import { ActorsModule } from "@/modules/ensemble/components/actors-module";
import { isDirectoryPerson } from "@/modules/people/components/person-data";
import { AppInstall } from "@/modules/pwa/components/app-install";
import { ExportDialog } from "./export-dialog";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { nav, WorkspaceShell } from "./workspace-shell";
const effects=createEffects();
let kind: RecordKind | null = initialState<RecordKind | null>(null);
const setKind = (next: RecordKind | null | ((current: RecordKind | null) => RecordKind | null)) => { kind = typeof next === "function" ? (next as (current: RecordKind | null) => RecordKind | null)(kind) : next; };


</script>


      <header class="page-heading">
        <div>
          <p class="eyebrow">DIE RICHTIGE ANSICHT FÜR JEDEN ZWECK</p>
          <h1>Exporte & Ausdrucke</h1>
          <p class="muted">
            Kalender, Arbeitszeit und Theaterwissen als PDF, Excel oder offene Daten.
          </p>
        </div>
      </header>
      <div class="export-options">
        {#each ([
    "events",
    "time",
    "attendance",
    "people",
    "productions",
    "actors",
    "casting",
    "looks",
    "tasks",
    "materials",
    "handovers",
] as RecordKind[]) as item (item)}<button on:click={() => setKind(item)}>
            <Download size={22}></Download>
            <div>
              <h3>{labels[item][0]}</h3>
              <p class="small muted">
                {item === "events"
    ? "Monat, Woche, Tag, Agenda & Team · PDF, ICS, Excel"
    : "PDF für Ausdrucke · Excel, CSV & JSON für Daten"}
              </p>
            </div>
            <span>Exportieren →</span>
          </button>{/each}
      </div>
      {#if kind}<ExportDialog kind={kind} onClose={() => setKind(null)}></ExportDialog>{/if}
