-- Projektzentrale — Supabase-Schema
-- Einmal im Supabase SQL-Editor ausführen (Project → SQL Editor → New query → einfügen → Run).

-- Ein einziger Key-Value-Speicher genügt: jeder bisherige interne Speicher-Key der App
-- (z.B. "projects", "tasks:<projekt-id>", "doc-section-defs", "knowledge-base", …)
-- wird pro Nutzer als eine Zeile mit seinem JSON-Inhalt abgelegt.
create table if not exists projektzentrale_kv (
  key text not null,
  user_id uuid not null references auth.users(id),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (key, user_id)
);

-- Row Level Security aktivieren...
alter table projektzentrale_kv enable row level security;

-- ...und jedem eingeloggten Nutzer (Supabase Auth, E-Mail-Login) ausschließlich Zugriff
-- auf seine eigenen Zeilen geben. Der anon key allein reicht damit nicht mehr, um Daten
-- zu lesen oder zu schreiben, und ein Nutzer sieht nie die Daten eines anderen Nutzers —
-- siehe README, Abschnitt "Login einrichten", für die nötigen Auth-Einstellungen.
-- drop+create statt nur create, damit dieses Skript auch gefahrlos ein zweites Mal
-- ausgeführt werden kann (z.B. falls es aus Versehen erneut eingefügt wird) — das
-- schließt alte Policies aus früheren Versionen mit ein.
drop policy if exists "Allow all for anon" on projektzentrale_kv;
drop policy if exists "Allow all for authenticated" on projektzentrale_kv;
create policy "Allow all for authenticated" on projektzentrale_kv
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
