-- 146enterprises - Supabase database schema
-- Run this once in Supabase Dashboard > SQL Editor.
-- It is written with comments so the data model is easy to study.

-- Required for gen_random_uuid(), which creates unique record IDs.
create extension if not exists pgcrypto;

-- A company is the workspace that owns all business records.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auth.users is Supabase's built-in login table.
-- This table stores the extra business profile shown in the app.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership makes the database safe for more than one company later.
-- The first user who creates a company becomes its owner.
create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner', 'employee')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'internal' check (type in ('internal', 'outside')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  main_stage text not null default 'weaving',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null default 'Other',
  name text not null,
  size text not null,
  weight_per_piece numeric(10, 3),
  color text not null default '',
  fabric_type text not null default '',
  style text not null default '',
  custom_fields jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thread_lots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text not null default '',
  quantity_kg numeric(12, 3) not null default 0 check (quantity_kg >= 0),
  min_quantity_kg numeric(12, 3) not null default 0 check (min_quantity_kg >= 0),
  location_id uuid references public.locations(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row is one traceable production batch/lot.
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  batch_number text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  color text not null default '',
  initial_pieces integer not null check (initial_pieces > 0),
  thread_kg numeric(12, 3) not null default 0 check (thread_kg >= 0),
  current_stage text not null default 'weaving',
  status text not null default 'in_progress' check (status in ('in_progress', 'exception', 'completed')),
  expected_date date,
  location_id uuid references public.locations(id) on delete set null,
  finished_pieces integer not null default 0 check (finished_pieces >= 0),
  issued_pieces integer not null default 0 check (issued_pieces >= 0),
  loss_pieces integer not null default 0 check (loss_pieces >= 0),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, batch_number)
);

-- A batch event is the history behind the current batch status.
-- Keeping events separate means we can see who changed what and when.
create table if not exists public.batch_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  stage_key text not null,
  event_type text not null check (event_type in ('started', 'sent', 'received', 'completed', 'exception', 'rework', 'rejected')),
  sent_pieces integer check (sent_pieces is null or sent_pieces >= 0),
  received_pieces integer check (received_pieces is null or received_pieces >= 0),
  loss_pieces integer not null default 0 check (loss_pieces >= 0),
  vendor_id uuid references public.vendors(id) on delete set null,
  expected_date date,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Every change to material quantity is a stock movement.
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  item_type text not null check (item_type in ('thread', 'finished')),
  thread_lot_id uuid references public.thread_lots(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null default 'pcs' check (unit in ('kg', 'pcs')),
  location_id uuid references public.locations(id) on delete set null,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (thread_lot_id is not null or batch_id is not null)
);

create table if not exists public.quality_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  result text not null check (result in ('pass', 'rework', 'reject')),
  reason text not null default '',
  notes text not null default '',
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  text text not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  batch_id uuid not null references public.batches(id) on delete restrict,
  pieces integer not null check (pieces > 0),
  issue_date date not null default current_date,
  promised_date date,
  delivered_pieces integer not null default 0 check (delivered_pieces >= 0),
  returned_pieces integer not null default 0 check (returned_pieces >= 0),
  replaced_pieces integer not null default 0 check (replaced_pieces >= 0),
  return_type text check (return_type is null or return_type in ('return', 'replacement')),
  return_reason text not null default '',
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Alerts can be generated by the website and read on every device.
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  alert_type text not null,
  title text not null,
  message text not null default '',
  related_type text not null default '',
  related_id uuid,
  active boolean not null default true,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  low_stock_kg numeric(12, 3) not null default 30 check (low_stock_kg >= 0),
  alert_lead_days integer not null default 2 check (alert_lead_days >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, field_key)
);

-- Helpful indexes for the queries used by the dashboard.
create index if not exists batches_company_stage_idx on public.batches(company_id, current_stage);
create index if not exists batches_company_status_idx on public.batches(company_id, status);
create index if not exists batch_events_batch_idx on public.batch_events(batch_id, created_at);
create index if not exists movements_company_created_idx on public.stock_movements(company_id, created_at desc);
create index if not exists alerts_company_active_idx on public.alerts(company_id, active, created_at desc);

-- Keep updated_at columns current without making the app remember to do it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists thread_lots_set_updated_at on public.thread_lots;
create trigger thread_lots_set_updated_at before update on public.thread_lots for each row execute function public.set_updated_at();
drop trigger if exists batches_set_updated_at on public.batches;
create trigger batches_set_updated_at before update on public.batches for each row execute function public.set_updated_at();
drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();
drop trigger if exists customer_issues_set_updated_at on public.customer_issues;
create trigger customer_issues_set_updated_at before update on public.customer_issues for each row execute function public.set_updated_at();

-- Create a profile whenever someone signs up through Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Security helper functions let row-level security policies stay readable.
create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.active = true
  );
$$;

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and m.active = true
  );
$$;

-- The creator needs to add themselves as the first owner immediately after
-- creating the company row, before the normal membership helper can work.
create or replace function public.is_company_creator(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and c.created_by = auth.uid()
  );
$$;

-- Turn on Row Level Security (RLS). RLS is the database's security guard.
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.locations enable row level security;
alter table public.vendors enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.thread_lots enable row level security;
alter table public.batches enable row level security;
alter table public.batch_events enable row level security;
alter table public.stock_movements enable row level security;
alter table public.quality_checks enable row level security;
alter table public.notes enable row level security;
alter table public.customer_issues enable row level security;
alter table public.alerts enable row level security;
alter table public.company_settings enable row level security;
alter table public.custom_fields enable row level security;

-- Company membership policies.
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated using (public.is_company_member(id));
drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies for insert to authenticated with check (created_by = auth.uid());
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated using (public.is_company_owner(id)) with check (public.is_company_owner(id));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists members_select on public.company_members;
create policy members_select on public.company_members for select to authenticated using (public.is_company_member(company_id));
drop policy if exists members_insert on public.company_members;
create policy members_insert on public.company_members for insert to authenticated with check (public.is_company_creator(company_id) or public.is_company_owner(company_id));
drop policy if exists members_update on public.company_members;
create policy members_update on public.company_members for update to authenticated using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));
drop policy if exists members_delete on public.company_members;
create policy members_delete on public.company_members for delete to authenticated using (public.is_company_owner(company_id));

-- Member data policies. Employees can read and update operational records;
-- the website can enforce finer business actions in its service layer later.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['locations', 'vendors', 'customers', 'products', 'thread_lots', 'batches', 'batch_events', 'stock_movements', 'quality_checks', 'notes', 'customer_issues', 'alerts', 'company_settings', 'custom_fields'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id))', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_company_member(company_id))', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', table_name || '_update', table_name);
  end loop;
end;
$$;

-- Deletion is owner-only for reference data and operational history.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['locations', 'vendors', 'customers', 'products', 'thread_lots', 'batches', 'batch_events', 'stock_movements', 'quality_checks', 'notes', 'customer_issues', 'alerts', 'company_settings', 'custom_fields'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_company_owner(company_id))', table_name || '_delete', table_name);
  end loop;
end;
$$;
