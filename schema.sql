-- Projektzentrale — Supabase-Schema
-- Einmal im Supabase SQL-Editor ausführen (Project → SQL Editor → New query → einfügen → Run).

-- Ein einziger Key-Value-Speicher genügt: jeder bisherige interne Speicher-Key der App
-- (z.B. "projects", "tasks:<projekt-id>", "doc-section-defs", "knowledge-base", …)
-- wird als eine Zeile mit seinem JSON-Inhalt abgelegt.
create table if not exists projektzentrale_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security aktivieren...
alter table projektzentrale_kv enable row level security;

-- ...aber für den anon key (den einzigen Zugang, den die App verwendet) alles erlauben.
-- Sicherheit entsteht hier dadurch, dass das GitHub-Repository und die App-URL privat
-- bleiben (kein Login-System) — genau wie bei den anderen Apps nach diesem Muster.
-- drop+create statt nur create, damit dieses Skript auch gefahrlos ein zweites Mal
-- ausgeführt werden kann (z.B. falls es aus Versehen erneut eingefügt wird).
drop policy if exists "Allow all for anon" on projektzentrale_kv;
create policy "Allow all for anon" on projektzentrale_kv
  for all
  to anon
  using (true)
  with check (true);
