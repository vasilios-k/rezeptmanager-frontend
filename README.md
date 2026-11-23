# Rezeptmanager – Frontend

[![Frontend CI](https://github.com/vasilios-k/rezeptmanager-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/vasilios-k/rezeptmanager-frontend/actions/workflows/ci.yml)

Webanwendung zum Verwalten einer persönlichen Rezeptsammlung.
Das Projekt wird als Einzelprojekt im Modul Web-Technologien umgesetzt.

Benutzer können eigene Rezepte verwalten, Zutatenmengen anpassen,
Einkaufslisten zusammenstellen und Kosten anhand ausgewählter
Produktpreise schätzen.

## Links

- [Webanwendung](https://rezeptmanager-frontend.onrender.com/)
- [Backend-Repository](https://github.com/vasilios-k/rezeptmanager-backend)
- [Öffentlicher Backend-Healthcheck](https://rezeptmanager-backend.onrender.com/api/health)

## Funktionen und Use Cases

| ID | Use Case | Umsetzung |
|---|---|---|
| UC01 | Konto verwenden | Registrieren, anmelden und abmelden über Auth0 |
| UC02 | Rezept anlegen | Rezept mit Zutaten, Mengen, Einheiten, Zubereitung, Dauer und Portionen speichern |
| UC03 | Rezepte suchen | Eigene Sammlung nach Rezeptnamen und Zutaten durchsuchen |
| UC04 | Rezept beim Kochen verwenden | Detailseite mit Zubereitungsschritten und abhakbaren Zutaten öffnen |
| UC05 | Rezept bearbeiten | Bestehende Rezeptdaten in einem Dialog ändern und speichern |
| UC06 | Rezept löschen | Löschung in einem Bestätigungsdialog ausdrücklich bestätigen |
| UC07 | Portionen anpassen | Zutatenmengen proportional zur gewünschten Portionszahl berechnen |
| UC08 | Einkaufsliste erstellen | Mehrere Rezepte auswählen und passende Zutatenmengen zusammenfassen |
| UC09 | Zutatenpreise zuordnen | Erfasste Produktpreise suchen oder eigene Packungspreise eingeben |
| UC10 | Kosten schätzen | Verbrauchskosten, Kosten pro Portion und benötigte Einkaufspackungen berechnen |

Die Portionszahl kann erhöht werden. Die im Originalrezept gespeicherte
Portionszahl bildet die Untergrenze.

## Anmeldung und Datenhaltung

Die Anwendung verwendet Auth0 für die Anmeldung.

- Rezepte werden kontobezogen im Backend und in PostgreSQL gespeichert.
- Jeder Benutzer sieht und bearbeitet ausschließlich seine eigenen Rezepte.
- Das Backend prüft die Zugriffsrechte bei jeder Rezeptanfrage.
- Neue Konten beginnen mit einer leeren Rezeptsammlung.
- Einkaufsliste, Einkaufshäkchen, Preiszuordnungen und Vorratsmarkierungen
  werden pro Konto im jeweiligen Browser gespeichert.
- Beim Abmelden oder Kontowechsel wird der sichtbare Zustand zurückgesetzt.
- Die Häkchen auf einer Rezeptdetailseite gelten für die aktuelle Ansicht
  und werden bei einer Portionsänderung zurückgesetzt.
- Zugriffstokens werden vom Auth0-SDK im Arbeitsspeicher verwaltet.

Einkaufslisten und Preiszuordnungen werden derzeit nicht zwischen
verschiedenen Browsern oder Geräten synchronisiert.

## Technologien

- Vue 3 und TypeScript
- Vue Router
- Vite
- Auth0 Vue SDK
- Vitest und Vue Test Utils
- ESLint, Oxlint und Prettier
- GitHub Actions
- Render Static Site

## Lokal starten

Voraussetzungen:

- Node.js mit npm; die CI verwendet Node.js 26.12.0
- Git

```powershell
git clone https://github.com/vasilios-k/rezeptmanager-frontend.git
cd rezeptmanager-frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Anschließend öffnen:

```text
http://localhost:5173
```

Die vorhandene `.env` verbindet das lokale Frontend mit dem
veröffentlichten Render-Backend. Damit werden auch bei dieser lokalen
Frontend-Ausführung die online gespeicherten Rezepte des angemeldeten
Kontos verwendet.

### Lokales Backend verwenden

Für ein lokal gestartetes Backend eine Datei `.env.local` im
Frontend-Hauptordner anlegen:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

Danach den Vite-Entwicklungsserver neu starten.
Die Einrichtung des Backends ist im Backend-Repository beschrieben.

## Konfiguration

| Variable | Bedeutung |
|---|---|
| `VITE_API_BASE_URL` | Basisadresse der Backend-API |
| `VITE_AUTH0_DOMAIN` | Domain des Auth0-Tenants |
| `VITE_AUTH0_CLIENT_ID` | Öffentliche Client-ID der Auth0-SPA |
| `VITE_AUTH0_AUDIENCE` | Identifier der in Auth0 registrierten Backend-API |
| `VITE_LEGACY_OWNER_SUBJECT` | Optional: Benutzer-ID für die Übernahme bisheriger Browserdaten |

Die `VITE_`-Variablen werden beim Build in das Frontend übernommen.
Sie enthalten öffentliche Konfigurationswerte und dürfen keine
Passwörter oder Client Secrets enthalten.

## Projektstruktur

| Verzeichnis | Zweck |
|---|---|
| `public/` | Öffentlich erreichbare statische Dateien, beispielsweise das Logo |
| `src/auth/` | Auth0-Anbindung und Verwaltung des aktiven Kontos |
| `src/components/` | Wiederverwendbare Oberflächenkomponenten |
| `src/views/` | Rezeptübersicht, Rezeptdetailseite und Einkaufsliste |
| `src/services/` | Authentifizierte HTTP-Anfragen an das Backend |
| `src/stores/` | Zustandsverwaltung und kontobezogener Browserspeicher |
| `src/types/` | TypeScript-Datentypen |
| `src/utils/` | Suche, Mengenformatierung, Portions- und Kostenberechnung |
| `src/data/` | Beispielrezepte für Tests |
| `__tests__/` | Tests bei den jeweils zugehörigen Komponenten und Modulen |

## Code prüfen

```powershell
npm run format
npm run lint
npm run test:unit -- --run
npm run build
npm audit
```

Der geprüfte Projektstand umfasst 149 Tests in 19 Testdateien.

Geprüft werden unter anderem:

- Rezeptanzeige und Formulare
- Suche und Portionsberechnung
- Dialoge zum Bearbeiten und Löschen
- Rezeptdetailseiten und Zutatenchecklisten
- Zusammenfassung der Einkaufsliste
- Preiszuordnungen und Kostenberechnungen
- Anmeldung, Kontowechsel und getrennte Browserdaten
- Übermittlung von Zugriffstokens
- Abbruch und Verwerfen veralteter HTTP-Anfragen

Die `overrides` in `package.json` legen geprüfte Versionen indirekter
Abhängigkeiten von `js-beautify` fest. Sie werden bei zukünftigen
Abhängigkeitsupdates mit überprüft.

## Continuous Integration und Deployment

GitHub Actions führt bei Pushes und Pull Requests folgende Schritte aus:

1. Abhängigkeiten mit `npm ci` installieren
2. Oxlint und ESLint ausführen
3. Frontendtests ausführen
4. TypeScript-Prüfung und Produktionsbuild ausführen

Render-Konfiguration:

| Einstellung | Wert |
|---|---|
| Service-Typ | Static Site |
| Branch | `master` |
| Root Directory | Repository-Hauptordner |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Auto-Deploy | After CI Checks Pass |

Für direkte Aufrufe und das Neuladen von Unterseiten ist diese
Rewrite-Regel eingerichtet:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

## Preisdaten und Kostenschätzung

Die Preissuche verwendet über das Backend
[Open Prices / Open Food Facts](https://prices.openfoodfacts.org/).

Die Anwendung unterscheidet:

- Verbrauchskosten für die tatsächlich verwendete Zutatenmenge
- Kosten pro Portion
- Einkaufskosten für die benötigten ganzen Packungen

Als vorhanden markierte Vorräte reduzieren die berechneten
Einkaufskosten.

Die angebotenen Preise sind erfasste Preisbeobachtungen und können
veraltet oder unvollständig sein. Händler und Erfassungsdatum werden
angezeigt. Fehlende Preise können manuell eingegeben werden.