# Projektzentrale

Projekt-Datenbank und Aufgabenplanung für Consulting-Projekte — Aufgaben, Dokumentation,
Kommunikation, Wissensdatenbank und KI-Auswertungen an einem Ort. Läuft als React-App
(Vite + TypeScript), automatisch gebaut und veröffentlicht über GitHub Actions, Daten
liegen in Supabase, gehostet über GitHub Pages.

Die alte Single-File-Fassung (`index.html`, kein Build-Schritt) liegt zum Vergleich
weiterhin unter [`legacy/index.html`](legacy/index.html) — sie wird nicht mehr gepflegt.

## 1. Supabase einrichten

**Du kannst dafür ein bestehendes Supabase-Projekt weiterverwenden** (z.B. dasselbe wie für deinen
Zyklustracker) — `schema.sql` legt nur eine eigene, neue Tabelle namens `projektzentrale_kv` an und
rührt keine vorhandenen Tabellen an. Ein neues Projekt ist also nicht nötig.

1. Falls noch kein Projekt vorhanden ist: eines auf [supabase.com](https://supabase.com) anlegen.
   Hast du bereits eines (z.B. vom Zyklustracker), kannst du direkt zu Schritt 2.
2. Im **SQL Editor** den Inhalt von `schema.sql` einfügen und ausführen.
3. Unter **Project Settings → API** die **Project URL** und den **anon public key**
   (den klassischen langen JWT-Key, nicht den neuen "Publishable key") kopieren —
   bei einem wiederverwendeten Projekt sind das dieselben Werte wie bei der anderen App.

## 2. Hosten mit GitHub Pages (automatisches Deployment)

Diese App wird nicht mehr als fertige Datei hochgeladen, sondern aus dem Quellcode
automatisch gebaut. Das ist nur einmalig einzurichten:

1. Im Repository zu **Settings → Pages**.
2. Bei **Source** die Option **"GitHub Actions"** auswählen (statt "Deploy from a branch").
3. Jeder Push auf den `main`-Branch löst automatisch den Workflow unter
   `.github/workflows/deploy.yml` aus: er installiert die Abhängigkeiten, prüft die
   Typen, baut die App und veröffentlicht das Ergebnis.
4. Nach dem ersten erfolgreichen Lauf (sichtbar im Tab **Actions** des Repos) ist die App
   unter der in **Settings → Pages** angezeigten `github.io`-Adresse erreichbar.

Für spätere Änderungen reicht ein normaler `git push` auf `main` — GitHub Pages
aktualisiert sich dann automatisch, kein manueller Upload-Schritt mehr nötig.

### Lokal entwickeln (optional)

Mit installiertem [Node.js](https://nodejs.org):

```
npm install
npm run dev       # lokaler Entwicklungsserver mit Hot Reload
npm run typecheck # TypeScript-Prüfung
npm run build     # Produktions-Build nach dist/ (wird von der CI ebenfalls ausgeführt)
```

## 3. Einmalig einrichten

1. Die App-URL öffnen.
2. Beim ersten Öffnen erscheint der Einrichtungs-Bildschirm: Project URL und anon key
   eintragen, **"Verbinden & speichern"** klicken.
3. Ab jetzt merkt sich der Browser die Verbindung — beim nächsten Öffnen erscheint
   direkt das Dashboard.

Öffnest du die App auf einem zweiten Gerät (z.B. Handy), muss dieser Schritt dort
einmal wiederholt werden (URL + Key sind identisch, die Eingabe passiert lokal auf
jedem Gerät).

## 4. KI-Funktionen aktivieren (optional)

KI-Suche, KI-Übersicht, Wissensdatenbank-Update, Aufgaben-Erkennung aus
Kommunikationseinträgen und der persönliche Berater brauchen einen eigenen
**Anthropic API-Key**:

1. Key erstellen unter [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
2. In der App unter **⋯ Mehr → 🔑 KI-Einstellungen** eintragen und speichern.

Der Key wird nur lokal im Browser gespeichert (`localStorage`) und bei jeder
KI-Anfrage direkt aus dem Browser an Anthropic gesendet — er ist damit über die
Netzwerk-Ansicht der Browser-Entwicklertools einsehbar. Für die persönliche Nutzung
auf den eigenen Geräten ist das unkritisch, den Key oder das Gerät aber nicht mit
Dritten teilen. Ohne hinterlegten Key funktioniert die App normal weiter, nur die
KI-Funktionen zeigen dann einen entsprechenden Hinweis statt eines Ergebnisses.

## Backup

Über **⇅ CSV Import / Export** in der App lässt sich jederzeit der gesamte
Datenbestand als CSV-Datei sichern und bei Bedarf wieder einspielen — unabhängig
von Supabase, als zusätzliche Absicherung.
