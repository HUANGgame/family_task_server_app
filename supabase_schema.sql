create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  family_code text unique not null,
  family_name text,
  manager_name text not null,
  manager_password_hash text not null,
  recovery_question text,
  recovery_answer_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  child_code text unique not null,
  child_name text not null,
  points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  task_name text not null,
  task_note text,
  category text default '家事',
  need_photo boolean default false,
  points integer default 1,
  done boolean default false,
  rewarded boolean default false,
  photo_url text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists fines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  points integer not null,
  deducted integer not null,
  reason text not null,
  created_at timestamptz default now()
);

create table if not exists shop_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  name text not null,
  description text,
  cost integer not null,
  stock integer default 1,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  shop_item_id uuid references shop_items(id),
  item_name text not null,
  cost integer not null,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists encouragement_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  message text not null,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists children_family_id_idx on children(family_id);
create index if not exists tasks_family_child_idx on tasks(family_id, child_id);
create index if not exists fines_family_child_idx on fines(family_id, child_id);
create index if not exists shop_items_family_id_idx on shop_items(family_id);
create index if not exists redemptions_family_child_idx on redemptions(family_id, child_id);
create index if not exists encouragement_family_id_idx on encouragement_messages(family_id);

drop trigger if exists set_families_updated_at on families;
create trigger set_families_updated_at
before update on families
for each row execute function set_updated_at();

drop trigger if exists set_children_updated_at on children;
create trigger set_children_updated_at
before update on children
for each row execute function set_updated_at();

drop trigger if exists set_shop_items_updated_at on shop_items;
create trigger set_shop_items_updated_at
before update on shop_items
for each row execute function set_updated_at();

-- Storage setup:
-- 1. Create a Supabase Storage bucket named the same as SUPABASE_STORAGE_BUCKET.
-- 2. If the bucket is public, the app stores public image URLs in tasks.photo_url.
-- 3. Keep SUPABASE_SERVICE_ROLE_KEY only on the server or Render environment.
