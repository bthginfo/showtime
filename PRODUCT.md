# Product: Showtime

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Beschäftigte aller Theatergewerke, Teamleitungen, Produktionsleitungen, Disposition, Intendanz und Theateradministration arbeiten im jeweils berechtigten Theater- und Arbeitsbereich. Plattform-Superadmins betreuen die Plattform. Die Intendanz besitzt einen eigenen Arbeitsbereich.

## Product Purpose

Showtime ist eine eigenständige, auf DigitalMask aufbauende Theateranwendung. Ziel ist eine skalierbare SaaS-Anwendung, die fachliche Arbeit, Planung und Zusammenarbeit aller Gewerke verbindet und die Daten unterschiedlicher Theater voneinander isoliert. Eine erfolgreiche Bedienung bedeutet, dass Menschen ihre aktuelle Arbeit erkennen, ausführen und das Ergebnis nachvollziehen können, auch bei geringer technischer Erfahrung.

## Operating Context

Die bestehende Anwendung verwendet SvelteKit, Svelte und TypeScript mit einer modularen, ereignisbasierten Architektur. Sie wird am Desktop und im mobilen Browser genutzt. Die Veröffentlichung ist für ein separates Showtime-Projekt auf Vercel vorgesehen; dieser Produktbrief bestätigt keinen bereits erfolgten Deploymentstand. DigitalMask bleibt die historische Referenz.

## Capabilities and Constraints

Die bestätigten Anforderungen umfassen gewerkbezogene Arbeitsbereiche, theaterweite Kommunikation, Rückmeldungen zwischen Gewerken, geführte Hilfe und pausierbares Onboarding, eine offene API sowie CSV-Import und -Export. Zeitbuchungen sollen sich bearbeiten und löschen lassen. Dienstregelprofile sind konfigurierbar; unbestätigte Profile sind nicht als bereits verbindliche Regelgrundlage zu behandeln.

Aktuelle Theaterzugehörigkeit, Fachbereich, Produktionszugang und Inhaltsfreigaben begrenzen die Arbeit. Eine Plattformrolle gewährt keinen automatischen Zugriff auf private Theaterinhalte. Ein gewählter operativer Arbeitsbereich bleibt auch bei zusätzlichen Rollen der Orientierungspunkt.

## Brand Commitments

Der Name ist Showtime. Die bestehende Identität von DigitalMask wird weitergeführt. [DESIGN.md](DESIGN.md) ist die verbindliche Gestaltungsvorgabe; diese Erweiterung ersetzt das Erscheinungsbild nicht.

## Evidence on Hand

[UI-BEDIENBARKEIT.md](docs/UI-BEDIENBARKEIT.md) dokumentiert die konkrete UI-Prüfung, Korrekturen, Gewerk- und Rollenabdeckung sowie deren Nachweisgrenzen. Browserprüfungen und automatisierte Tests verwenden synthetische Showtime-Daten. Es liegt keine externe Nutzerstudie vor. Der Produktbrief enthält keine belegten Kunden-, Leistungs-, Verfügbarkeits- oder kommerziellen Erfolgsversprechen; Skalierbarkeit ist ein Produktziel.

## Product Principles

- Die tägliche Facharbeit bestimmt den Einstieg; Zusatzrollen ersetzen den gewählten Arbeitsbereich nicht.
- Theaterdaten und private Inhalte bleiben an ihre aktuellen Zugehörigkeiten und Freigaben gebunden.
- Menschen erkennen vor einer Änderung deren Wirkung und danach das gespeicherte Ergebnis.
- Gemeinsame Abläufe verbinden alle Gewerke und verwenden deren verständliche Fachbegriffe.

## Accessibility & Inclusion

Die Bedienung muss auch bei geringer technischer Erfahrung und auf schmalen Geräten nachvollziehbar bleiben. Sichtbare Beschriftungen, verständliche Rückmeldungen, erreichbare Aktionen und Tastaturbedienung unterstützen dieses Ziel. Vollständige Barrierefreiheit wird durch diesen Produktbrief nicht als bereits nachgewiesen behauptet.
