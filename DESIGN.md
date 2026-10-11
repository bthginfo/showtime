# Showtime: verbindliche Gestaltung

Showtime führt die Gestaltung von DigitalMask weiter. Neue Fachmodule, Verwaltung, Zusammenarbeit, Hilfe und Dashboards verwenden dieselbe visuelle Sprache; sie bilden keine zweite Oberfläche.

- Geist als lokale Schrift; die bestehenden Größen und Gewichte aus `src/styles/globals.css`.
- Die gemeinsamen Tokens `--bg`, `--surface`, `--surface-soft`, `--text`, `--muted`, `--border`, `--accent`, `--accent-soft` und `--radius` für helle und dunkle Darstellung. Keine zusätzlichen Farbsysteme pro Gewerk.
- Gemeinsame Komponenten aus `src/components/ui`: PageHeader, Button, Badge, ErrorMessage, Empty und Modal. Lucide-Symbole mit konsistenten Strichen.
- Die vorhandene Seitenleiste, obere Navigation und mobile Hauptnavigation bleiben die Orientierung. Fachbereiche verwenden am Desktop Tabs und auf schmalen Geräten eine native Bereichsauswahl.
- Arbeitsflächen priorisieren Aufgaben und Inhalte. Formulare für längere Arbeitsaufträge stehen in der Seite; modale Bearbeitung folgt den vorhandenen DigitalMask-Dialogen.
- Filter und Formularfelder besitzen sichtbare Beschriftungen. Fehler benennen den nächsten Schritt und behalten Eingaben. Laden, leer, gesperrt, veraltet und abgeschlossen sind ausdrückliche Zustände.
- Mobile Formulare stehen einspaltig. Texte dürfen umbrechen; breite Tabellen scrollen innerhalb ihres Containers. Die ganze Seite darf nicht horizontal scrollen.
- Nach Öffnen oder Schrittwechsel geht der Tastaturfokus zur passenden Überschrift. Tastaturfokus bleibt sichtbar. Status trägt Text zusätzlich zur Farbe.
- Onboarding unterstützt die konkrete Arbeit des Gewerks, bleibt pausierbar und erstellt keine Daten automatisch. Fortschritt ist nach Theater, Person und Gewerk getrennt.
- Zahlen erscheinen im deutschen Format. Fehlende Besucher- oder Finanzdaten erscheinen ausdrücklich als fehlend; synthetische Inhalte tragen „DEMO“.

Die Impeccable-Prüfung dient der Bedienbarkeit und handwerklichen Qualität innerhalb dieser Vorgaben. Ein anderes Erscheinungsbild benötigt eine ausdrückliche Änderung des Produktbriefs.

Abnahme: relevante Arbeitsabläufe im echten Browser; Desktop und mobile Viewports; Formular-, Fokus-, Fehler- und Leerzustände; reale Rechte und Dateiablage. Builds und Codevergleich allein belegen keine pixelgenaue Gleichheit.
