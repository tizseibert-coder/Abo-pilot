# Abo-Pilot Schweiz – MVP (Stufe 1)

Web-App, die die Verträge eines Haushalts erfasst, jede Kündigungsfrist berechnet und neutral zeigt,
welcher Wechsel sich über 24 Monate lohnt. Grundlage ist das Dokument «Abo-Pilot Schweiz – Business Case,
Entwicklungsplan & Rechtsrahmen».

## Was das MVP kann

| Funktion | Wo |
| --- | --- |
| Konto mit E-Mail und Passwort (scrypt-Hash, httpOnly-Session-Cookie) | `/` |
| Profil-Assistent: Haushalt, Nutzung, heutige Kosten – legt Verträge automatisch an | `/start` |
| Nur passende Angebote zuerst (Datenmenge, EU-Roaming, Internet-Speed, TV) | `src/lib/profile.ts` |
| Angebotspflege mit Prüfprozess, Quelle, Gültigkeit und CSV-Import (nur Team) | `/admin/angebote` |
| Krankenkassen-Vergleich für den ganzen Haushalt mit offiziellen BAG-Prämien | `/krankenkasse` |
| Import BAG-Prämien und Prämienregionen (Upload oder URL, nur Team) | `/admin/daten` |
| Angebots-Suchlauf über Tarifseiten der Anbieter (JSON-LD, sonst Claude), täglich per Cron | `/admin/quellen`, `/api/cron/angebote` |
| Schnell-Check: Kategorie, Anbieter, Preis – sofort Frist und Sparpotenzial (2 Klicks) | `/vertraege/neu` |
| Vertrag erfassen aus eingefügtem Rechnungstext oder PDF (Anbieter, Preis, Nummer, Beginn) | `/vertraege/neu` → «Rechnung / alle Details» |
| Überprüfung mit Datum: Vorschlag (60 Tage vor Frist, KK 1. Oktober), «Alles gut – geprüft» mit einem Klick, im Kalender | Vertragsseite |
| Wechsel-Assistent: Frist, Sperrfrist, Startdatum, Portierung geprüft; Sparpotenzial pro Monat / 1. Jahr / 24 Mt.; ein Klick startet Kündigung + Prämien-Tracking | `/vertraege/[id]/wechseln` |
| Krankenkasse wechseln mit einem Klick aus dem Vergleich: Kündigungsbrief inkl. versicherter Personen + Checkliste | `/krankenkasse` |
| Fristenrechner: Mindestlaufzeit, automatische Verlängerung, Monatsende, Krankenkasse (30.11.) | `src/lib/deadlines.ts` |
| Ampel und Übersicht, Krankenkassen-Hinweis im Herbst mit Link auf priminfo.admin.ch | `/dashboard` |
| Kalender-Export (.ics) mit Erinnerungen 60/30/7 Tage vorher | `/api/kalender` |
| Nettonutzen über 24 Monate, Rangliste ohne Einfluss der Provision, Neukunden-Sperrfristen | `src/lib/benefit.ts` |
| Kündigungsbrief zum Drucken und Unterschreiben (App ist Botin, nicht Stellvertreterin) | `/vertraege/[id]/kuendigung` |
| Prämien-Tracker mit Reklamationsvorlage bei Verzug | `/praemien` |
| Datenexport (JSON) und sofortige Kontolöschung (DSG) | `/konto` |

Bewusst **nicht** im MVP (siehe Rechtsrahmen): Provisionen aus der Grundversicherung, Versicherungsvergleiche
(Stufe 2, erst mit registriertem Broker), automatischer Abschluss, Zugriff auf Postfach oder Bankkonto.

## Aktuelle Angebote

Angebote liegen in der Datenbank, nicht im Code. Kundinnen und Kunden sehen ein Angebot nur, wenn es
**geprüft**, **nicht abgelaufen** (`valid_until`) und **höchstens 30 Tage seit der letzten Prüfung** ist.
Jede Änderung oder jeder Import setzt ein Angebot auf «Entwurf» zurück.

- Team-Zugang: E-Mail-Adressen in `ADMIN_EMAILS` (kommagetrennt) sehen den Menüpunkt «Angebote».
- Start-Entwürfe (`src/data/offers.seed.ts`) stammen aus einer Websuche vom 26.10.2026. Sie sind **nicht** auf den
  Anbieterseiten verifiziert und widersprechen sich teilweise. Vor der Freigabe die Quelle öffnen, korrigieren, «Heute geprüft».
- Partner-Feeds oder Tabellen: CSV mit den Spalten aus `CSV_COLUMNS` (`src/lib/offer-types.ts`) einfügen.
- Nur Stufe-1-Kategorien (Handy, Internet, Streaming, Bank) sind importierbar; Versicherungen und Grundversicherung
  werden abgewiesen (Rechtsrahmen).
- Kein automatisches Scraping von Anbieterseiten (UWG Art. 5 lit. c, Anbieter-AGB). Ziel sind Partner- oder Affiliate-Feeds.

## Wie Angebote automatisch gefunden werden

| Kategorie | Quelle | Automatisierung | Rechtliche Einordnung |
| --- | --- | --- | --- |
| Krankenkasse (Grundversicherung) | Offene Daten des BAG: Prämientabelle + Prämienregionen | Jährlich Ende September importieren (`/admin/daten`, Upload oder URL) | Amtliche Daten, frei nutzbar; keine Provision, keine Vermittlung |
| Handy, Internet, Streaming, Bank | Tarifseiten der Anbieter | Täglicher Suchlauf; strukturierte Daten (JSON-LD) zuerst, sonst Extraktion mit Claude | Nur Anbieterseiten, robots.txt, erkennbarer Bot, Beleg-Zitat; Änderungen gehen durch das Team |
| alle Stufe-1-Kategorien | Partner- oder Affiliate-Feeds | CSV-Import (`/admin/angebote`) | Vertraglich geregelt – der sauberste Weg |
| Zusatz- und Sachversicherungen | – | bewusst nicht | erst Stufe 2 mit registriertem Broker |

Suchlauf im Detail (`src/lib/crawler/`):

1. Seite laden (`page.ts`): nur https, robots.txt beachten, User-Agent `AboPilotBot`, max. 3 MB, höchstens einmal in 20 Std.
2. Angebote lesen (`extract.ts`): zuerst schema.org-JSON-LD (nur Monatspreise in CHF). Fehlt das, liest Claude
   (`claude-opus-5-5`, strukturierte Ausgabe) den Seitentext. Jedes Ergebnis braucht ein wörtliches Zitat und den Preis
   auf der Seite, sonst wird es verworfen.
3. Abgleich (`run.ts`): neu → Entwurf; geändert → zurück auf Entwurf mit «Änderung erkannt: Preis 29.9 → 24.9»;
   unverändert und geprüft → Prüfdatum automatisch auf heute. Kunden sehen nur geprüfte Angebote.

Server-Cronjob (täglich):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/angebote
```

Die Start-Quellen (`src/data/sources.seed.ts`) sind inaktiv angelegt: URL und Nutzungsbedingungen prüfen, dann aktivieren.
Die BAG-Spaltennamen werden tolerant erkannt (`src/lib/kk/premiums.ts`). Nach dem ersten echten Import Stichproben
mit priminfo.admin.ch vergleichen, weil das genaue Dateiformat hier nicht überprüft werden konnte.

## Starten

Voraussetzung: Node.js ≥ 22.13 (nutzt das eingebaute `node:sqlite`).

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Unit-Tests (Fristen, Nettonutzen, Erkennung, Kalender)
npm run build && COOKIE_SECURE=false npm start   # Produktionsbuild lokal über http
```

Die Daten liegen in `data/abo-pilot.db` (über `ABO_DB_PATH` änderbar, nicht im Git).
Für die Angebotspflege z. B. `ADMIN_EMAILS=du@example.ch npm run dev`.

## Betrieb in der Schweiz

```bash
docker build -t abo-pilot .
docker run -d -p 3000:3000 -v abo-data:/data abo-pilot
```

Hinter einen TLS-Proxy (Caddy oder Nginx) auf einem Server in einem Schweizer Rechenzentrum stellen.
Das Volume `/data` täglich verschlüsselt sichern.

## Aufbau

```
src/
  app/            Seiten (Next.js App Router) und Server Actions (actions.ts)
  components/     Formulare (Client-Komponenten)
  data/offers.seed.ts  Start-Entwürfe für Angebote (ungeprüft)
  lib/
    dates.ts      Datumsrechnung in UTC
    deadlines.ts  Fristen und Ampel
    benefit.ts    Nettonutzen und Sperrfristen
    extract.ts    Felderkennung aus Rechnungstext
    letter.ts     Kündigungsbrief, Reklamation
    ics.ts        Kalender-Export
    offers.ts     Angebots-DB, Sichtbarkeit, CSV-Import
    profile.ts    Kundenprofil und Passung
    db.ts, repo.ts, auth.ts
tests/            Vitest
```

## Nächste Schritte bis Beta (Gate G3)

- [ ] BAG-Prämien 2027 und Prämienregionen importieren, Stichproben gegen priminfo.admin.ch
- [ ] Start-Quellen prüfen, aktivieren, `CRON_SECRET` und `ANTHROPIC_API_KEY` setzen, Cronjob einrichten
- [ ] Start-Entwürfe prüfen und freigeben; Prüf-Routine (z. B. jeden Montag) im Team festlegen
- [ ] Partner-/Affiliate-Feeds anbinden (Telecom, Bank) über den CSV-Import bzw. eine Import-API
- [ ] Internet-Verfügbarkeit nach PLZ/Adresse (Glasfaser ja/nein) in die Profil-Passung aufnehmen
- [ ] E-Mail-Erinnerungen zusätzlich zum Kalender (Schweizer Versanddienst, Double-Opt-in)
- [ ] Passwort-Reset und E-Mail-Bestätigung
- [ ] Rate-Limiting für Login und Import
- [ ] Datenschutz-Folgenabschätzung, Pen-Test, AGB und Datenschutzerklärung anwaltlich finalisieren
- [ ] Postfach-Anbindung (Gmail/Outlook OAuth) erst nach dem Google-CASA-Audit
