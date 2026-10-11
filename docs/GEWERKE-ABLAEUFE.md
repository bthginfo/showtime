# Zusammenarbeit, Intendanz und Einstieg

Recherche und Umsetzung vom 11. Oktober 2026. Der bestehende DigitalMask-Aufbau bleibt die visuelle Referenz. Die Ergänzungen benutzen den gemeinsamen Theaterkern, die Rollen, die tenantgebundenen Daten und die vorhandene Ereignisverarbeitung.

## Fachliche Grundlage

Das Künstlerische Betriebsbüro des Münchner Volkstheaters beschreibt die Planung vom Jahresspielplan über Bauproben bis zu Modell-, Skizzen-, Kostüm- und Maskenabgaben. Daraus folgt ein gemeinsamer Produktionsbezug für Aufträge, Termine und Arbeitsstände. [Münchner Volkstheater: Schaltzentrale des Hauses](https://www.muenchner-volkstheater.de/blog/artikel/wir-sind-die-schaltzentrale-des-hauses)

Die Bühnen Köln beschreiben die gemeinsame Konzeption von Regie, Bühnenbild und Kostüm und ihre anschließende Umsetzung in den Werkstätten. Die Fachansichten brauchen deshalb konkrete Übergaben und Rückmeldungen zwischen den Bereichen. [Bühnen Köln: Produktion](https://buehnen.koeln/produktion)

Die Technische Direktion verbindet laut Deutschem Bühnenverein Produktionsbesprechungen, Bauproben, technische Einrichtungen, beteiligte Fachabteilungen und Budgetplanung. Die Anwendung unterstützt die Koordination; fachliche Prüfungen und Sicherheitsabnahmen bleiben bei den verantwortlichen Personen. [Deutscher Bühnenverein: Technische Direktion](https://www.buehnenverein.de/de/technische-direktion)

Die Bauprobe zu „Das Geisterhaus“ und die Theaterführungen des Theaters Ingolstadt bestätigen vor Ort die Zusammenarbeit von Regie und Ausstattung sowie die Wege zwischen Bühne, Werkstätten, Kostüm, Requisite und Maske. [Theater Ingolstadt: Bauprobe](https://theater.ingolstadt.de/aktuelles/aktuelles/aktuelles-detailansicht/bauprobe-zu-das-geisterhaus.html), [Theaterführungen](https://theater.ingolstadt.de/mitmachen-vermittlung/eintauchen/theaterfuehrungen.html)

Die folgenden Abläufe sind die aus diesen Quellen abgeleitete Produktgestaltung, kein universell vorgeschriebener Theaterprozess.

## Anfragen zwischen Gewerken

Unter **Theaterbetrieb → Zusammenarbeit** sendet eine berechtigte Person einen Produktionsstand an ein anderes aktives Gewerk. Vier Zwecke stehen zur Wahl: Feedback, Freigabe, Übergabe und Änderung. Auftrag, Empfänger, Produktion, optionaler Termin und Erledigungskriterium bleiben zusammen.

Der Empfänger kann kommentieren oder Änderungen anfordern. Der Absender überarbeitet den Stand und die Versionsnummer steigt. Eine Freigabe darf eine berechtigte Leitung des empfangenden Gewerks erteilen; der Ersteller darf seinen eigenen Auftrag nicht freigeben. Bei Übergaben und Feedback bestätigt der Empfänger den Abschluss. Abgeschlossene Stände und Anlagen sind unveränderlich; weitere Arbeit beginnt mit einer neuen Anfrage.

PDF, Bilder und Office-Dateien werden als private Anlagen am Auftrag gespeichert. Anlagenänderungen erhöhen den Prüfstand. Eine Entscheidung auf einer inzwischen veralteten Version wird zurückgewiesen; der eingegebene Rückmeldungstext bleibt im Formular erhalten. Geschützte Maße, Personaldaten und Budgeteinträge werden nicht automatisch in Aufträge kopiert. Fachbezogene öffentliche Arbeitseinträge des sendenden Gewerks können als Ausgangspunkt dienen.

Aktive Zugehörigkeit zu einem beteiligten Gewerk, aktuelle Rechte und Produktionszugang sind erforderlich. Plattformrechte allein reichen nicht. Nicht beteiligte Gewerke sehen weder Auftrag noch Datei. Rechteentzug gilt auch für bestehende Benachrichtigungen und Dateilinks. Speichern und Outbox-Ereignis erfolgen atomar; `TradeCollaborationChangedV1` enthält nur Referenzen. Die wiederholbare Verarbeitung prüft Empfängerrechte erneut.

Beispiele im Demo-Theater: Ausstattung/Kostüm → Maske mit privatem PDF; Überarbeitung und Freigabe einer Kragen-/Perückenabstimmung; Probenänderung Inspizienz → Ton; Werkstattübergabe → Bühnentechnik; Textfeedback Dramaturgie → Marketing; Pausen-/Einlasshinweise → Vorderhaus. Ausstattung verteilt sich im aktuellen Modell auf Kostüm, Bühnentechnik und Werkstätten.

## Dashboard der Intendanz

Die Intendanz erhält die Hausübersicht auf ihrer Startseite; Personen mit passenden Budgetrechten erreichen sie auch unter Theaterbetrieb. Sie zeigt aktive Produktionen, Bereitschaft erforderlicher Gewerke, blockierte Arbeitseinträge, offene und überfällige zugängliche Abstimmungen, den Spielplan und Budgetbindung.

Der Budgetrahmen stammt aus veröffentlichten Budgeteinträgen. Bindung stammt aus genehmigten Beschaffungsanträgen. Offene Anträge stehen separat. Diese Werte sind keine Zahlungs- oder Buchhaltungsdaten. Budget und Bereitschaft beziehen sich auf aktive zugängliche Produktionen; der Zeitraum filtert Vorstellungen und Besucherberichte.

Das Vorderhaus erfasst für eine tatsächliche vergangene, nicht abgesagte Vorstellung genau einen Besucher- und Kassenbericht. Angebotenes Platzkontingent, Besucher, bezahlte Karten, Freikarten und erfasste Einnahmen bilden die Grundlage. Doppelte Berichte und unplausible Werte werden abgewiesen. Auslastung ist die Summe der erfassten Besucher geteilt durch die Summe der angebotenen Plätze derselben Berichte. Die Übersicht zeigt die Abdeckung; fehlende Berichte erzeugen keine erfundenen Zahlen. Die Demo-Werte sind fiktiv und gekennzeichnet. Ein Ticketing-Import ist weiterhin eine spätere Integration.

## Hilfe und geführter Einstieg

Alle zwanzig Gewerke haben eigene Leitfäden für Tagesarbeit, typische Partner, eine Beispielanfrage und Bereitschaft. Unter **Hilfe & Feedback → Mein Gewerk** lassen sich die Leitfäden lesen und die Führung starten. Der Fachbereich bietet denselben Einstieg direkt an.

Fünf Schritte führen durch Zugehörigkeit, Produktionsbezug, Tagesarbeit, Zusammenarbeit und Bereitschaft. Pausieren, Zurück, Weiter und erneutes Starten sind möglich. Die Führung erklärt die tatsächlich erlaubten Aktionen und legt keine Datensätze im Hintergrund an. Fortschritt wird auf dem jeweiligen Gerät getrennt nach Theater, Zugang und Gewerk gespeichert.

## Gestaltungsstandard

Die verbindlichen Regeln stehen in [DESIGN.md](../DESIGN.md). Neue Arbeitsflächen verwenden DigitalMask-Tokens, Geist, gemeinsame UI-Komponenten und Lucide-Symbole. Auf Mobilgeräten sind Formulare einspaltig, Bereichsauswahl und Rückweg in die Anfrageliste sichtbar. Fehler erhalten Texte; Status und fehlende Daten sind in Worten erkennbar. Das Onboarding bleibt beim Wechsel in einen Fachbereich aktiv und lässt sich jederzeit pausieren.
