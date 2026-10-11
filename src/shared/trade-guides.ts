export type TradeGuide = {
  label: string;
  purpose: string;
  work: string;
  partners: string;
  example: string;
  target: string;
  check: string;
};
export const tradeGuides: Record<string, TradeGuide> = {
  intendance: {
    label: "Intendanz",
    purpose:
      "Den Spielbetrieb überblicken, Prioritäten setzen und Entscheidungen nachvollziehbar machen.",
    work: "Besucher, Einnahmen und Budgets einordnen, offene Leitungsentscheidungen klären und die Umsetzung von Zielen verfolgen.",
    partners: "Disposition, Produktionsleitungen, Verwaltung und künstlerische Gewerke",
    example:
      "Eine Produktionsentscheidung mit der Disposition abstimmen und die Umsetzung verfolgen",
    target: "disposition",
    check:
      "Entscheidung, Begründung, Zuständigkeit und nächster Termin sind festgehalten. Fachliche und gesetzliche Abnahmen bleiben bei den zuständigen Gewerken.",
  },
  design: {
    label: "Ausstattung & Bühnenbild",
    purpose:
      "Entwürfe mit Bühne, Werkstätten, Kostüm und Maske zu einem geprüften Produktionsstand verbinden.",
    work: "Entwurfs- und Zeichnungsfassungen anlegen, Anlagen beifügen, Modell- und Bauprobe disponieren und offene Änderungen verteilen.",
    partners: "Regie, Werkstätten, Bühne, Kostüm und Maske",
    example: "Eine geänderte Figurine mit privater Anlage zur Prüfung an die Maske schicken",
    target: "makeup",
    check:
      "Der unveränderte Entwurf wurde durch die zuständige andere Leitung freigegeben; Abgaben und Bauprobe sind geklärt.",
  },
  disposition: {
    label: "Disposition & KBB",
    purpose: "Termine, Besetzung und verfügbare Räume zu einer belastbaren Planung verbinden.",
    work: "Proben und Umbesetzungen erfassen; Spielplanentwürfe prüfen und erst danach veröffentlichen.",
    partners: "Regie, Ensemble, Inspizienz und technische Gewerke",
    example: "Geänderte Probenzeit und neue Besetzung abstimmen",
    target: "stage-management",
    check: "Beteiligte, Raum und Zeiten sind bestätigt; betroffene Gewerke kennen den neuen Stand.",
  },
  direction: {
    label: "Regie & Regieassistenz",
    purpose: "Entscheidungen aus den Proben nachvollziehbar an die richtigen Gewerke geben.",
    work: "Probenberichte und szenische Änderungswünsche einer Produktion zuordnen.",
    partners: "Dramaturgie, Inspizienz, Ausstattung und Ensemble",
    example: "Umbau und Maskenwechsel für die zweite Szene abstimmen",
    target: "makeup",
    check: "Szene, gewünschte Wirkung, Termin und Rückmeldung sind festgehalten.",
  },
  dramaturgy: {
    label: "Dramaturgie",
    purpose: "Fassungen, Recherche und künstlerische Zusammenhänge aktuell halten.",
    work: "Textfassungen und Recherchepakete eindeutig benennen und freigegebene Stände markieren.",
    partners: "Regie, Ensemble, Presse und Theaterpädagogik",
    example: "Neue Textfassung vor der nächsten Probe prüfen lassen",
    target: "direction",
    check: "Fassung und offene Fragen sind eindeutig; die Empfänger haben den Stand übernommen.",
  },
  ensemble: {
    label: "Ensemble & Gäste",
    purpose: "Persönliche Verfügbarkeit und Vorbereitung mit der Produktion koordinieren.",
    work: "Proben und Szenenvorbereitung verfolgen; Verfügbarkeiten im eigenen Bereich pflegen.",
    partners: "Disposition, Regie, Kostüm und Maske",
    example: "Anprobe und Maskenprobe zeitlich abstimmen",
    target: "costume",
    check:
      "Zeit, beteiligte Personen und Zuständigkeit sind bestätigt. Gäste sehen nur freigegebene Produktionen.",
  },
  "stage-management": {
    label: "Inspizienz",
    purpose: "Den Ablauf auf der Bühne und die beteiligten Gewerke zusammenführen.",
    work: "Cues, Vorstellungsberichte und Bereitschaft dokumentieren; Änderungen je Szene verteilen.",
    partners: "Bühne, Licht, Ton, Video, Kostüm und Maske",
    example: "Neuen Umbau-Cue mit der Bühnentechnik prüfen",
    target: "stage",
    check:
      "Cue, Auslöser und Reihenfolge sind geprüft; die technische Leitung bestätigt ihren Bereich.",
  },
  stage: {
    label: "Bühnentechnik",
    purpose: "Einrichtung, Umbauten und sicheren Spielbetrieb vorbereiten.",
    work: "Aufbau- und Umbaupläne pflegen; Risiken und offene Arbeiten festhalten.",
    partners: "Ausstattung, Werkstätten, Inspizienz und Licht",
    example: "Bauprobe: Sichtachsen und Umbauwege zur Prüfung übergeben",
    target: "lighting",
    check:
      "Aufbau, Wege und technische Vorarbeiten sind geprüft. Eine App-Freigabe ersetzt keine vorgeschriebene Abnahme.",
  },
  lighting: {
    label: "Licht",
    purpose: "Lichtpläne und Cues auf den jeweiligen Produktionsstand abstimmen.",
    work: "Lichtstände, Fokus und technische Proben dokumentieren; Bereitschaft bewusst bestätigen.",
    partners: "Regie, Bühnentechnik, Video und Inspizienz",
    example: "Fokusänderung nach der Bauprobe freigeben lassen",
    target: "stage-management",
    check: "Positionen, Sichtbarkeit und Cue-Reihenfolge sind gemeinsam geprüft.",
  },
  sound: {
    label: "Ton",
    purpose: "Mikrofonierung, Zuspielungen und Klang mit Szene und Besetzung abstimmen.",
    work: "Mikrofonpläne und Cues pflegen; die passende Besetzung und Version angeben.",
    partners: "Ensemble, Musik, Maske und Inspizienz",
    example: "Headset-Position mit Perücke und Kostüm abstimmen",
    target: "makeup",
    check: "Trageweise, Sichtbarkeit und Wechselwege sind praktisch geprüft.",
  },
  video: {
    label: "Video & Medien",
    purpose: "Medienstände und Projektionen nachvollziehbar für die Bühne bereitstellen.",
    work: "Medienfassungen und technische Cues dokumentieren; Dateiversionen klar benennen.",
    partners: "Licht, Ton, Regie und Inspizienz",
    example: "Neue Projektion gemeinsam mit Licht testen",
    target: "lighting",
    check: "Bildstand, Bildfläche und Auslöser passen zum vereinbarten Ablauf.",
  },
  workshops: {
    label: "Werkstätten",
    purpose: "Entwürfe in herstellbare, überprüfbare Bauteile und Dekorationen übersetzen.",
    work: "Bauaufträge, Materialien und Übergaben pflegen; Maße und Termine eindeutig festhalten.",
    partners: "Ausstattung, Bühnentechnik und Requisite",
    example: "Fertiges Dekorationselement zur technischen Prüfung übergeben",
    target: "stage",
    check: "Maße, Material, Handhabung und offene Punkte sind beim empfangenden Gewerk angekommen.",
  },
  costume: {
    label: "Kostüm & Garderobe",
    purpose: "Figurinen, Anproben und Wechsel mit der Ausstattung und Maske koordinieren.",
    work: "Kostümzuordnungen, Anproben, Umkleidepläne und Pflege dokumentieren. Maßdaten bleiben geschützt.",
    partners: "Ausstattung, Maske, Ensemble und Ton",
    example: "Ausstattungsentwurf: Frisur und Perücke zur Kostümfigurine abstimmen",
    target: "makeup",
    check:
      "Figur, gewünschter Look, Wechsel und Rückmeldetermin sind klar; geschützte Maßdaten werden nicht mitgeteilt.",
  },
  makeup: {
    label: "Maske",
    purpose: "Looks, Perücken und Maskenpläne für Proben und Vorstellungen bereitstellen.",
    work: "Aufschriebe und Maskenpläne aus DigitalMask weiterführen; Vorbereitungen im Fachmodul ergänzen.",
    partners: "Ausstattung, Kostüm, Ensemble und Ton",
    example: "Maskenprobe: Frisur und Headset-Sitz rückmelden",
    target: "costume",
    check:
      "Look, Vorlauf und Wechsel sind erprobt; die Rückmeldung liegt beim empfangenden Gewerk.",
  },
  props: {
    label: "Requisite",
    purpose: "Szenisch benötigte Gegenstände herstellen, bereitstellen und nachbereiten.",
    work: "Requisitenlisten und Übergaben pflegen; Zuständigkeit und Einsatz je Szene festhalten.",
    partners: "Regie, Werkstätten, Bühnentechnik und Inspizienz",
    example: "Neue Handrequisite für die Probe übergeben",
    target: "direction",
    check: "Beschaffenheit, Funktion, sichere Handhabung und Rückgabe sind geklärt.",
  },
  music: {
    label: "Chor & Orchester",
    purpose: "Musikalische Proben und Aufführungsstände mit dem Bühnenbetrieb abstimmen.",
    work: "Proben, Stimmenmaterial und Besetzung im eigenen Fachbereich verfolgen.",
    partners: "Disposition, Regie, Ton und Inspizienz",
    example: "Geänderten musikalischen Einsatz mit Ton abstimmen",
    target: "sound",
    check: "Fassung, Einsatz und benötigte Besetzung sind bekannt.",
  },
  dance: {
    label: "Ballett & Tanz",
    purpose: "Choreografie, Proben und Wechsel mit den technischen Gewerken verbinden.",
    work: "Proben und Bewegungsfolgen dokumentieren; Kostüm und Bühne rechtzeitig einbeziehen.",
    partners: "Regie, Bühne, Kostüm und Disposition",
    example: "Kostümwechsel für eine neue Bewegungsfolge prüfen",
    target: "costume",
    check: "Bewegungsfreiheit, Wechselzeit und Probenstand wurden gemeinsam geprüft.",
  },
  "front-of-house": {
    label: "Vorderhaus & Publikumsservice",
    purpose: "Publikumsabläufe vorbereiten und gespielte Vorstellungen sauber erfassen.",
    work: "Briefings und Rückmeldungen pflegen. Besucher- und Kassenberichte je gespielter Vorstellung erfassen.",
    partners: "Disposition, Inspizienz, Marketing und Verwaltung",
    example: "Geänderten Einlass und barrierefreie Wege abstimmen",
    target: "facilities",
    check:
      "Einlass, Zuständigkeit und Wege sind geklärt; Zahlen im Bericht sind tatsächlich erfasst.",
  },
  marketing: {
    label: "Presse & Marketing",
    purpose: "Freigegebene Texte, Bilder und Termine für die Kommunikation vorbereiten.",
    work: "Kampagnen, Pressebriefings und Nutzungsrechte pflegen; Freigaben dokumentieren.",
    partners: "Dramaturgie, Regie, Vorderhaus und Theaterpädagogik",
    example: "Programmtext zur redaktionellen Freigabe schicken",
    target: "dramaturgy",
    check: "Textstand, Termin und Bild- beziehungsweise Textrechte sind geprüft.",
  },
  education: {
    label: "Theaterpädagogik",
    purpose: "Vermittlungsangebote mit Produktion und Hausbetrieb abstimmen.",
    work: "Workshops mit Zielgruppe, Räumen, Personal und Materialbedarf planen.",
    partners: "Dramaturgie, Disposition, Vorderhaus und Marketing",
    example: "Workshopmaterial zur Produktion gemeinsam prüfen",
    target: "dramaturgy",
    check: "Zielgruppe, pädagogischer Inhalt und organisatorische Voraussetzungen sind klar.",
  },
  administration: {
    label: "Verwaltung & Einkauf",
    purpose: "Budgets, Bedarfsanträge und Beschaffung nachvollziehbar bearbeiten.",
    work: "Freigegebene Budgetrahmen und Bedarfsanträge verbinden; eigene Anträge werden durch eine andere berechtigte Person entschieden.",
    partners: "Intendanz, Produktionsleitung und anfordernde Gewerke",
    example: "Materialbedarf mit den Werkstätten konkretisieren",
    target: "workshops",
    check:
      "Menge, Termin und Begründung sind vollständig. Eine fachliche Rückmeldung ersetzt keine Budgetgenehmigung.",
  },
  facilities: {
    label: "Haustechnik & IT",
    purpose: "Räume, Anlagen und Infrastruktur für den Theaterbetrieb verfügbar halten.",
    work: "Wartungen und technische Anliegen mit Termin und Zuständigkeit pflegen.",
    partners: "Bühne, Vorderhaus, Disposition und Verwaltung",
    example: "Wartungsfenster vor einer Vorstellung abstimmen",
    target: "disposition",
    check: "Zeitraum und Auswirkungen sind bekannt; der Betrieb kann weiter geplant werden.",
  },
};
