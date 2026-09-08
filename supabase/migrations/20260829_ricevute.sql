-- Ricevute dell'associazione (ASD Tie-Break), create e stampate da /admin/ricevute/nuova.
-- Il numero progressivo è assegnato da una sequence Postgres tramite il DEFAULT
-- della colonna: l'INSERT è quindi atomico e non può generare duplicati anche in
-- caso di salvataggi quasi simultanei (niente MAX(numero)+1 lato client).
-- Tutti gli accessi passano dalla service role (bypassa RLS): nessuna policy per
-- anon/authenticated, come per le altre tabelle amministrative.

create sequence if not exists public.ricevute_numero_seq as integer start with 1;

create table if not exists public.ricevute (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique default nextval('public.ricevute_numero_seq'),
  data date not null default current_date,
  nominativo text not null,
  importo_lettere text not null,
  causale text not null,
  importo_cifre numeric(10, 2) not null check (importo_cifre > 0),
  created_at timestamptz not null default now()
);

alter sequence public.ricevute_numero_seq owned by public.ricevute.numero;

alter table public.ricevute enable row level security;
revoke all on table public.ricevute from anon, authenticated;

-- Prossimo numero disponibile per l'anteprima del form: NON consuma la sequence,
-- si limita a leggerne lo stato corrente.
create or replace function public.prossimo_numero_ricevuta()
returns integer
language sql
security definer
set search_path = public
as $$
  select last_value + (case when is_called then 1 else 0 end)::integer
  from public.ricevute_numero_seq;
$$;

-- Inserimento atomico: il numero arriva dal DEFAULT (nextval), qui si validano
-- e normalizzano solo i campi testuali.
create or replace function public.crea_ricevuta(
  p_data date,
  p_nominativo text,
  p_importo_lettere text,
  p_causale text,
  p_importo_cifre numeric
)
returns public.ricevute
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ricevute;
begin
  if coalesce(btrim(p_nominativo), '') = ''
     or coalesce(btrim(p_importo_lettere), '') = ''
     or coalesce(btrim(p_causale), '') = '' then
    raise exception 'Tutti i campi sono obbligatori.';
  end if;

  if p_importo_cifre is null or p_importo_cifre <= 0 then
    raise exception 'Il totale deve essere un numero positivo.';
  end if;

  insert into public.ricevute (data, nominativo, importo_lettere, causale, importo_cifre)
  values (
    coalesce(p_data, current_date),
    btrim(p_nominativo),
    btrim(p_importo_lettere),
    btrim(p_causale),
    p_importo_cifre
  )
  returning * into r;

  return r;
end;
$$;

revoke all on function public.prossimo_numero_ricevuta() from public;
revoke all on function public.crea_ricevuta(date, text, text, text, numeric) from public;
grant execute on function public.prossimo_numero_ricevuta() to service_role;
grant execute on function public.crea_ricevuta(date, text, text, text, numeric) to service_role;
