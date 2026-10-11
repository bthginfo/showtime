<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import MoreRecords from "./more-records.svelte";
  import { clearPrivateBrowserData } from "@/shared/private-browser-data";
  import { initialState } from "@/shared/svelte-runtime";

  import TheaterModule from "@/modules/theater/theater-module.svelte";
  import { scopedBrowserKey } from "@/shared/browser-scope";
  import { BrandMark } from "./brand-mark";
  import {
    Bell,
    Building2,
    ArrowLeft,
    BookOpen,
    CalendarDays,
    ClipboardCheck,
    Clock3,
    Download,
    Home,
    CircleHelp,
    Layers3,
    LogOut,
    Menu,
    MessageSquare,
    Package,
    Search,
    Settings2,
    Theater,
    Users,
    WifiOff,
    X,
    type LucideIcon,
  } from "@lucide/svelte";
  import {
    captureNavigationScroll,
    closeRecordDetail,
    navigateWorkspace,
    navigationReturn,
    recordHref,
    restoreNavigationScroll,
    returnToContext,
    setNavigationUser,
  } from "@/shared/client-navigation";
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
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { nav as allNav, ExportsModule } from "./workspace-shell";
  import { visibleNavigation } from "@/shared/navigation-policy";
  const effects = createEffects();
  // Native SvelteKit links do not emit popstate. Notify all workspace query stores.
  afterNavigate(() => window.dispatchEvent(new Event("showtime-location")));
  const workspaceStore = useWorkspace();
  let { workspace, notice, notify, online, action } = $workspaceStore;
  $: ({ workspace, notice, notify, online, action } = $workspaceStore);
  let nav = visibleNavigation(allNav, workspace.user);
  $: nav = visibleNavigation(allNav, workspace.user);
  const queryStore = externalStore(
    subscribeLocation,
    () => location.search,
    () => "",
  );
  let query = $queryStore;
  $: query = $queryStore;
  let params = new URLSearchParams(query);
  let requestedModule =
    params.get("module") === "productions" && params.get("tab") === "handovers"
      ? "handovers"
      : params.get("module") || "today";
  let activeModule = nav.some((item) => item.id === requestedModule) ? requestedModule : "today";
  let recordId = params.get("record") || "";
  let mobileMenu: boolean = false;
  const setMobileMenu = (
    next: typeof mobileMenu | ((current: typeof mobileMenu) => typeof mobileMenu),
  ) => {
    mobileMenu =
      typeof next === "function"
        ? (next as (current: typeof mobileMenu) => typeof mobileMenu)(mobileMenu)
        : next;
  };
  let searchOpen: boolean = false;
  const setSearchOpen = (
    next: typeof searchOpen | ((current: typeof searchOpen) => typeof searchOpen),
  ) => {
    searchOpen =
      typeof next === "function"
        ? (next as (current: typeof searchOpen) => typeof searchOpen)(searchOpen)
        : next;
  };
  let search: string = "";
  const setSearch = (next: typeof search | ((current: typeof search) => typeof search)) => {
    search =
      typeof next === "function"
        ? (next as (current: typeof search) => typeof search)(search)
        : next;
  };
  let detail: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setDetail = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    detail =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(detail)
        : next;
  };
  let notificationOpen: boolean = false;
  const setNotificationOpen = (
    next: typeof notificationOpen | ((current: typeof notificationOpen) => typeof notificationOpen),
  ) => {
    notificationOpen =
      typeof next === "function"
        ? (next as (current: typeof notificationOpen) => typeof notificationOpen)(notificationOpen)
        : next;
  };
  let tourRequested: boolean = false;
  const setTourRequested = (
    next: typeof tourRequested | ((current: typeof tourRequested) => typeof tourRequested),
  ) => {
    tourRequested =
      typeof next === "function"
        ? (next as (current: typeof tourRequested) => typeof tourRequested)(tourRequested)
        : next;
  };
  let needsTour =
    workspace.user.preferences !== undefined &&
    workspace.user.preferences.onboardingVersion < onboardingVersion;
  let main = { current: null as HTMLElement | null };
  let sidebar = { current: null as HTMLElement | null };
  let menuOpener = { current: null as HTMLElement | null | null };
  const isMobileStore = externalStore(
    subscribeMobile,
    () => matchMedia("(max-width: 760px)").matches,
    () => false,
  );
  let isMobile = $isMobileStore;
  $: isMobile = $isMobileStore;
  $: effects.run(
    0,
    () => {
      setNavigationUser(workspace.user.id);
      const previous = history.scrollRestoration;
      history.scrollRestoration = "manual";
      let timeout: ReturnType<typeof setTimeout>;
      const saveScroll = () => {
        clearTimeout(timeout);
        timeout = setTimeout(captureNavigationScroll, 120);
      };
      window.addEventListener("scroll", saveScroll, { passive: true });
      return () => {
        clearTimeout(timeout);
        window.removeEventListener("scroll", saveScroll);
        history.scrollRestoration = previous;
      };
    },
    [workspace.user.id],
  );
  $: effects.run(1, () => restoreNavigationScroll(), [query]);
  $: effects.run(
    2,
    () => {
      const key = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "k") {
          event.preventDefault();
          setSearchOpen(true);
        }
      };
      window.addEventListener("keydown", key);
      return () => {
        window.removeEventListener("keydown", key);
      };
    },
    [],
  );
  let openMenu = () => {
    menuOpener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMobileMenu(true);
  };
  $: effects.run(
    3,
    () => {
      if (!mobileMenu || !isMobile) return;
      const previousFocus = menuOpener.current || document.activeElement;
      const previousOverflow = document.body.style.overflow;
      document.body.style.setProperty("overflow", "hidden");
      const items = () =>
        Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") || [],
        ).filter((element) => element.getClientRects().length);
      items()[0]?.focus();
      const key = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setMobileMenu(false);
        }
        if (event.key === "Tab") {
          const focusable = items();
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      };
      window.addEventListener("keydown", key);
      return () => {
        window.removeEventListener("keydown", key);
        document.body.style.setProperty("overflow", previousOverflow);
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
      };
    },
    [mobileMenu, isMobile],
  );
  $: effects.run(
    4,
    () => {
      if (!notice) return;
      const timeout = setTimeout(() => notify(""), 7000);
      return () => clearTimeout(timeout);
    },
    [notice, notify],
  );
  const navigate = (next: string) => {
    setMobileMenu(false);
    navigateWorkspace(next.startsWith("/") ? next : next === "today" ? "/" : `/?module=${next}`);
  };
  let logout = async () => {
    let drafts: unknown[] = [];
    try {
      drafts = [
        ...JSON.parse(
          localStorage.getItem(scopedBrowserKey(`digitalmask-time-drafts:${workspace.user.id}`)) ||
            "[]",
        ),
        ...JSON.parse(
          localStorage.getItem(
            scopedBrowserKey(`digitalmask-attendance-drafts:${workspace.user.id}`),
          ) || "[]",
        ),
      ];
    } catch {}
    if (
      drafts.length &&
      !confirm(
        "Es gibt lokale Zeitentwürfe. Beim Abmelden werden sie auf diesem Gerät gelöscht. Trotzdem abmelden?",
      )
    )
      return;
    try {
      await stopPushOnLogout(workspace.user.id);
      await post("/api/logout", {});
      await clearPrivateBrowserData(workspace.user.id);
      delete document.documentElement.dataset.accent;
      location.replace("/login");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Abmelden fehlgeschlagen");
    }
  };
  let unread = unreadNotifications(workspace.records.notifications, workspace.user.id);
  let chatUnread = chatUnreadCounts(workspace.records.notifications, workspace.user.id).total;
  let results =
    search.length >= 2
      ? Object.values(workspace.records)
          .flat()
          .filter(
            (record) =>
              ![
                "files",
                "notifications",
                "timesheets",
                "messages",
                "time",
                "feedback",
                "attendance",
                "calendarCategories",
                "conversations",
              ].includes(record.kind) &&
              (record.kind !== "people" || isDirectoryPerson(record)) &&
              JSON.stringify(record.data).toLowerCase().includes(search.toLowerCase()),
          )
          .slice(0, 30)
      : [];
  let queryRecord = recordId
    ? Object.values(workspace.records)
        .flat()
        .find((record) => record.id === recordId && record.kind !== "maskPlans")
    : undefined;
  let closeDetail = () => {
    setDetail(null);
    closeRecordDetail();
  };
  let active = nav.find((x) => x.id === activeModule)!;
  const screen = true;

  $: params = new URLSearchParams(query);
  $: requestedModule =
    params.get("module") === "productions" && params.get("tab") === "handovers"
      ? "handovers"
      : params.get("module") || "today";
  $: activeModule = nav.some((item) => item.id === requestedModule) ? requestedModule : "today";
  $: recordId = params.get("record") || "";
  $: needsTour =
    workspace.user.preferences !== undefined &&
    workspace.user.preferences.onboardingVersion < onboardingVersion;

  $: unread = unreadNotifications(workspace.records.notifications, workspace.user.id);
  $: chatUnread = chatUnreadCounts(workspace.records.notifications, workspace.user.id).total;
  $: results =
    search.length >= 2
      ? Object.values(workspace.records)
          .flat()
          .filter(
            (record) =>
              ![
                "files",
                "notifications",
                "timesheets",
                "messages",
                "time",
                "feedback",
                "attendance",
                "calendarCategories",
                "conversations",
              ].includes(record.kind) &&
              (record.kind !== "people" || isDirectoryPerson(record)) &&
              JSON.stringify(record.data).toLowerCase().includes(search.toLowerCase()),
          )
          .slice(0, 30)
      : [];
  $: queryRecord = recordId
    ? Object.values(workspace.records)
        .flat()
        .find((record) => record.id === recordId && record.kind !== "maskPlans")
    : undefined;

  $: active = nav.find((x) => x.id === activeModule)!;
</script>

{#if true}
  {#snippet render_screen()}{#if activeModule === "theater"}{#key `${params.get("view") || ""}:${params.get("productionId") || ""}:${params.get("requestId") || ""}:${params.get("itemId") || ""}`}<TheaterModule
          initialView={params.get("view") || "trade"}
          productionId={params.get("productionId") || ""}
          requestId={params.get("requestId") || ""}
          itemId={params.get("itemId") || ""}
        />{/key}{:else if activeModule === "today"}<TodayModule {navigate}
      ></TodayModule>{:else}{#if activeModule === "productions"}<ProductionsModule
          productionId={params.get("productionId") || ""}
          activeTab={params.get("tab") === "handovers"
            ? "overview"
            : params.get("tab") || "overview"}
          onNavigate={(id, tab) => {
            const next = new URLSearchParams({
              module: "productions",
              ...(id ? { productionId: id, tab } : {}),
            });
            navigateWorkspace(`/?${next}`);
          }}
        ></ProductionsModule>{:else}{#if activeModule === "calendar"}<CalendarModule
          ></CalendarModule>{:else}{#if activeModule === "tasks"}<TasksModule
            ></TasksModule>{:else}{#if activeModule === "time"}<TimeModule
              ></TimeModule>{:else}{#if activeModule === "chat"}<ChatModule
                  conversationId={params.get("conversationId") || ""}
                  productionId={params.get("productionId") || ""}
                  onNavigate={(conversationId, productionId) => {
                    const query = new URLSearchParams({
                      module: "chat",
                      ...(conversationId
                        ? { conversationId }
                        : productionId
                          ? { productionId }
                          : {}),
                    });
                    navigateWorkspace(`/?${query}`);
                  }}
                ></ChatModule>{:else}{#if activeModule === "people"}<PeopleModule
                  ></PeopleModule>{:else}{#if activeModule === "actors"}<ActorsModule
                    ></ActorsModule>{:else}{#if activeModule === "documentation"}<DocumentationModule
                      ></DocumentationModule>{:else}{#if activeModule === "inventory"}<ResourceView
                          kind="materials"
                          description="Perücken, Produkte und Werkzeuge. Lagerorte, Bestand und Einkaufsbedarf im Blick."
                        ></ResourceView>{:else}{#if activeModule === "handovers"}<ResourceView
                            kind="handovers"
                            description="Was bei der nächsten Vorstellung wichtig ist: Checklisten, offene Punkte und klare Übergaben."

                          ></ResourceView>{:else}{#if activeModule === "help"}{#key params.get("guide") || "default"}<HelpModule
                                initialGuide={params.get("guide") || undefined}
                                {navigate}
                                onStartTour={() => setTourRequested(true)}

                              ></HelpModule>{/key}{:else}{#if activeModule === "exports"}<ExportsModule
                              ></ExportsModule>{:else}<SettingsModule {navigate}
                              ></SettingsModule>{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/snippet}
  <div class="workspace">
    <ProfileAccent></ProfileAccent>
    <a class="skip-link" href="#main"> Zum Inhalt </a>
    {#if mobileMenu}<button
        type="button"
        class="sidebar-backdrop"
        aria-label="Navigation schließen"
        tabindex="-1"
        on:click={() => setMobileMenu(false)}
      ></button>{/if}
    <aside
      bind:this={sidebar.current}
      inert={isMobile && !mobileMenu}
      aria-hidden={isMobile && !mobileMenu ? true : undefined}
      role={isMobile && mobileMenu ? "dialog" : undefined}
      aria-modal={isMobile && mobileMenu ? true : undefined}
      aria-label="Navigation"
      class={`sidebar ${mobileMenu ? "mobile-open" : ""}`}
    >
      <a
        class="brand"
        href="/"
        on:click={(event) => {
          if (
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.shiftKey
          )
            return;
          event.preventDefault();
          navigate("today");
        }}
      >
        <BrandMark></BrandMark>
        <span>
          showtime<span class="brand-sub">{workspace.organization.name}</span>
        </span>
      </a>
      <button
        class="mobile-close icon-button"
        on:click={() => setMobileMenu(false)}
        aria-label="Menü schließen"
      >
        <X size={20}></X>
      </button>
      <div class="department-switch">
        <span class="department-icon">
          <Theater size={19}></Theater>
        </span>
        <div>
          <strong>{workspace.department.name}</strong>
          <span class="small muted">{workspace.organization.name}</span>
        </div>
        <Badge tone="green">Team</Badge>
      </div>
      <nav aria-label="Hauptnavigation">
        {#each ["ARBEITSRAUM", "WISSEN & FUNDUS", "VERWALTUNG"] as group (group)}<div
            class="nav-group"
          >
            <p class="eyebrow">{group}</p>
            {#each nav.filter((x) => x.group === group) as item (item.id)}<button
                class={`nav-item ${activeModule === item.id ? "active" : ""}`}
                on:click={() => navigate(item.id)}
                aria-current={activeModule === item.id ? "page" : undefined}
                aria-label={item.label}
                data-description={item.id === "chat" && chatUnread
                  ? `${chatUnread} ungelesene Nachrichten`
                  : undefined}
              >
                <svelte:component this={item.icon} size={18} strokeWidth={1.7}></svelte:component>
                <span>{item.label}</span>
                {#if item.id === "chat" && chatUnread > 0}<span
                    class="chat-unread-count"
                    aria-hidden="true"
                  >
                    {chatUnread > 99 ? "99+" : chatUnread}
                  </span>{/if}
              </button>{/each}
          </div>{/each}
      </nav>
      <footer class="sidebar-footer">
        <div class="user-summary">
          <span class="avatar">{initials(workspace.user.name)}</span>
          <div>
            <strong>{workspace.user.name}</strong>
            <span class="small muted">
              {workspace.user.role === "superadmin"
                ? "Superadmin"
                : workspace.user.role === "admin"
                  ? "Admin"
                  : "Teammitglied"}
            </span>
          </div>
        </div>
        <button
          class="icon-button"
          on:click={() => void logout()}
          aria-label="Abmelden"
          title="Abmelden"
        >
          <LogOut size={17}></LogOut>
        </button>
      </footer>
    </aside>
    <div
      class={`workspace-content${activeModule === "chat" ? ` ${chatStyles.mobileShell}` : ""}`}
      inert={isMobile && mobileMenu}
    >
      <header class="topbar">
        <div class="breadcrumbs">
          {#if navigationReturn() && !recordId}<button
              class="icon-button"
              on:click={() => returnToContext("/")}
              title="Zur vorherigen Ansicht"
              aria-label="Zur vorherigen Ansicht"
            >
              <ArrowLeft size={18}></ArrowLeft>
            </button>{/if}
          <button
            class="icon-button mobile-menu-button"
            on:click={openMenu}
            aria-label="Menü öffnen"
          >
            <Menu size={19}></Menu>
          </button>
          <span>{workspace.department.name}</span>
          <span class="crumb-separator">/</span>
          <strong>{active.label}</strong>
        </div>
        <div class="topbar-actions">
          {#if workspace.platformAdmin}<a
              href="/platform"
              class="icon-button"
              aria-label="Plattformverwaltung"
              title="Theater verwalten"><Building2 size={19} /></a
            >{/if}
          <button class="global-search-button" on:click={() => setSearchOpen(true)}>
            <Search size={16}></Search>
            <span>Alles durchsuchen</span>
            <kbd>⌘ K</kbd>
          </button>
          <button
            class="icon-button search-mobile"
            on:click={() => setSearchOpen(true)}
            aria-label="Globale Suche"
          >
            <Search size={19}></Search>
          </button>
          <ThemeSwitch></ThemeSwitch>
          <button
            class="icon-button notification-button"
            on:click={() => setNotificationOpen(true)}
            aria-label={`${unread.length} ungelesene Mitteilungen`}
          >
            <Bell size={19}></Bell>
            {#if unread.length > 0}<span>{unread.length}</span>{/if}
          </button>
          <span class="avatar topbar-avatar">{initials(workspace.user.name)}</span>
        </div>
      </header>
      {#if !online}<div class="connectivity-banner" role="status">
          <WifiOff size={17}></WifiOff>
          Du bist offline. Zeitentwürfe kannst du lokal speichern und später synchronisieren.
        </div>{/if}
      <main bind:this={main.current} id="main" class="main-content" tabindex="-1">
        {@render render_screen()}
        <MoreRecords module={activeModule} />
      </main>
      <footer class="workspace-footer">
        <span>Showtime · Gemeinsam hinter der Bühne.</span>
        <LiveStatus recovery></LiveStatus>
        <AppInstall onOpenHelp={() => navigate("/?module=help&guide=app-install")}></AppInstall>
      </footer>
    </div>
    <nav class="bottom-nav" inert={isMobile && mobileMenu} aria-label="Mobile Navigation">
      {#each [["today", "Heute", Home], ["calendar", "Kalender", CalendarDays], ["productions", "Stücke", Theater], ["time", "Zeit", Clock3], ["chat", "Chat", MessageSquare], ["more", "Mehr", Menu]].filter(([key]) => key === "more" || nav.some((item) => item.id === key)) as [key, label, Icon] (String(key))}{@const Component =
          Icon as LucideIcon}<button
          class={activeModule === key ||
          (key === "more" &&
            !["today", "calendar", "productions", "time", "chat"].includes(activeModule))
            ? "active"
            : ""}
          aria-current={activeModule === key ? "page" : undefined}
          aria-label={key === "chat" ? "Kommunikation" : String(label)}
          data-description={key === "chat" && chatUnread
            ? `${chatUnread} ungelesene Nachrichten`
            : undefined}
          on:click={() => (key === "more" ? openMenu() : navigate(String(key)))}
        >
          <svelte:component this={Component} size={20}></svelte:component>
          {#if key === "chat" && chatUnread > 0}<span class="chat-unread-count" aria-hidden="true">
              {chatUnread > 99 ? "99+" : chatUnread}
            </span>{/if}
          <span>{String(label)}</span>
        </button>{/each}
    </nav>
    {#if notice}<div class="toast" role="status">
        {notice}
        <button on:click={() => notify("")} aria-label="Hinweis schließen">
          <X size={15}></X>
        </button>
      </div>{/if}
    {#if searchOpen}<Modal
        title="Im Arbeitsraum suchen"
        initialFocus="input[aria-label=Suchbegriff]"
        onClose={() => {
          setSearchOpen(false);
          setSearch("");
        }}
        wide
      >
        <div class="global-search-field">
          <Search size={20}></Search>
          <input
            placeholder="Produktion, Figur, Schauspieler, Material …"
            aria-label="Suchbegriff"
            value={search}
            on:input={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        {#if search.length < 2}<p class="empty-inline">
            Mindestens 2 Zeichen eingeben. Die Suche verwendet die bereits geladenen, für dich
            freigegebenen Daten.
          </p>{:else}{#if results.length}<div class="search-results">
              {#each results as result (result.id)}<button
                  on:click={() => {
                    navigate(recordHref(result));
                    setSearchOpen(false);
                    setSearch("");
                  }}
                >
                  <span class="small muted">{labels[result.kind][1]}</span>
                  <strong>
                    {value(result.data, "title") || value(result.data, "name") || "Eintrag"}
                  </strong>
                  <span class="small muted">
                    {value(result.data, "description") || value(result.data, "notes")}
                  </span>
                </button>{/each}
            </div>{:else}<Empty
              title="Nichts Passendes gefunden."
              description="Versuche einen anderen Namen oder Begriff."
            ></Empty>{/if}{/if}
      </Modal>{/if}
    {#if notificationOpen}<Modal title="Mitteilungen" onClose={() => setNotificationOpen(false)}>
        {#if unread.length}<div class="list">
            {#each unread as item (item.id)}<button
                class="notification-row"
                on:click={async () => {
                  try {
                    await action("notification-read", item.id);
                    setNotificationOpen(false);
                    const link = value(item.data, "link");
                    if (link.startsWith("/") && !link.startsWith("//")) {
                      const next = new URL(link, location.origin);
                      const productionId = value(item.data, "productionId");
                      if (next.searchParams.get("module") === "tasks" && productionId) {
                        next.searchParams.set("module", "productions");
                        next.searchParams.set("productionId", productionId);
                        next.searchParams.set("tab", "tasks");
                      }
                      navigate(next.pathname + next.search);
                    }
                  } catch (e) {
                    notify(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
                  }
                }}
              >
                <span class={item.data.read ? "notice-dot read" : "notice-dot"}></span>
                <div>
                  <strong>{value(item.data, "title")}</strong>
                  <p class="small muted">{value(item.data, "body")}</p>
                </div>
              </button>{/each}
          </div>{:else}<Empty
            title="Alles ruhig hinter der Bühne."
            description="Neue Aufgaben und wichtige Änderungen erscheinen hier."
          ></Empty>{/if}
      </Modal>{/if}
    {#if tourRequested || needsTour}<OnboardingTour
        {navigate}
        onDone={() => {
          setTourRequested(false);
          // Wait for the dialog to leave the native top layer before restoring focus.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => main.current?.focus({ preventScroll: true })),
          );
        }}
      ></OnboardingTour>{/if}
    {#if detail || queryRecord}{#key (detail || queryRecord)!.id}<RecordDetail
          record={(detail || queryRecord)!}
          onClose={closeDetail}
          onNavigate={() => setDetail(null)}
        ></RecordDetail>{/key}{/if}
  </div>
{/if}
