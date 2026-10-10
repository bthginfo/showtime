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
export const nav: {
    id: string;
    label: string;
    icon: LucideIcon;
    group: string;
}[] = [
    {id:"theater",label:"Theaterbetrieb",icon:Theater,group:"ARBEITSRAUM"},
    { id: "today", label: "Heute", icon: Home, group: "ARBEITSRAUM" },
    { id: "productions", label: "Produktionen", icon: Theater, group: "ARBEITSRAUM" },
    { id: "calendar", label: "Kalender", icon: CalendarDays, group: "ARBEITSRAUM" },
    { id: "tasks", label: "Teamboard", icon: Layers3, group: "ARBEITSRAUM" },
    { id: "time", label: "Zeit buchen", icon: Clock3, group: "ARBEITSRAUM" },
    { id: "chat", label: "Kommunikation", icon: MessageSquare, group: "ARBEITSRAUM" },
    { id: "people", label: "Ansprechpersonen", icon: Users, group: "WISSEN & FUNDUS" },
    { id: "actors", label: "Schauspielerkatalog", icon: Users, group: "WISSEN & FUNDUS" },
    { id: "documentation", label: "Aufschriebe", icon: BookOpen, group: "WISSEN & FUNDUS" },
    { id: "inventory", label: "Fundus & Material", icon: Package, group: "WISSEN & FUNDUS" },
    { id: "handovers", label: "Dienstübergaben", icon: ClipboardCheck, group: "WISSEN & FUNDUS" },
    { id: "exports", label: "Exporte", icon: Download, group: "VERWALTUNG" },
    { id: "help", label: "Hilfe & Feedback", icon: CircleHelp, group: "VERWALTUNG" },
    { id: "settings", label: "Einstellungen", icon: Settings2, group: "VERWALTUNG" },
];
export { default as WorkspaceShell } from "./workspace-shell.WorkspaceShell.svelte";
export { default as ExportsModule } from "./workspace-shell.ExportsModule.svelte";
