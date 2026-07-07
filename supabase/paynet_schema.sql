-- Paynet multi-store POS + APoint schema.
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists store_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists store_types_code_key on store_types(code);

create table if not exists product_statuses (
  code text primary key,
  name text not null,
  sort_order int not null default 100
);

create unique index if not exists product_statuses_code_key on product_statuses(code);

create table if not exists warehouse_statuses (
  code text primary key,
  name text not null,
  sort_order int not null default 100
);

create unique index if not exists warehouse_statuses_code_key on warehouse_statuses(code);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  branch text not null default 'Main Branch',
  store_type_id uuid references store_types(id),
  status text not null default 'active' check (status in ('active', 'disabled')),
  owner_wallet text not null,
  receiver_wallet text not null,
  image_folder text,
  accent text default '#2563eb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table stores add column if not exists slug text;
alter table stores add column if not exists branch text not null default 'Main Branch';
alter table stores add column if not exists branch_name text;
alter table stores add column if not exists store_type_id uuid references store_types(id);
alter table stores add column if not exists status text not null default 'active';
alter table stores add column if not exists owner_wallet text;
alter table stores add column if not exists receiver_wallet text;
alter table stores add column if not exists image_folder text;
alter table stores add column if not exists accent text default '#2563eb';
alter table stores add column if not exists updated_at timestamptz not null default now();

update stores
set
  slug = coalesce(slug, lower(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))),
  branch = coalesce(branch, branch_name, 'Main Branch'),
  branch_name = coalesce(branch_name, branch, 'Main Branch'),
  owner_wallet = coalesce(owner_wallet, '0x0000000000000000000000000000000000000000'),
  receiver_wallet = coalesce(receiver_wallet, owner_wallet, '0x0000000000000000000000000000000000000000')
where slug is null or branch is null or branch_name is null or owner_wallet is null or receiver_wallet is null;

create unique index if not exists stores_slug_key on stores(slug);

create table if not exists store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  full_name text not null,
  role text not null default 'cashier',
  wallet_address text not null,
  avatar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, wallet_address)
);

alter table store_staff add column if not exists full_name text;
alter table store_staff add column if not exists role text not null default 'cashier';
alter table store_staff add column if not exists wallet_address text;
alter table store_staff add column if not exists avatar text;
alter table store_staff add column if not exists is_active boolean not null default true;
alter table store_staff add column if not exists updated_at timestamptz not null default now();

create unique index if not exists store_staff_store_wallet_key on store_staff(store_id, wallet_address);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  sku text not null,
  barcode text,
  category text not null default 'Other',
  unit text not null default 'unit',
  sell_price bigint not null default 0,
  cost_price bigint not null default 0,
  stock_quantity numeric not null default 0,
  min_stock numeric not null default 0,
  image_url text,
  description text,
  status text not null default 'active' references product_statuses(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, sku)
);

alter table products add column if not exists category text not null default 'Other';
alter table products add column if not exists unit text not null default 'unit';
alter table products add column if not exists status text not null default 'active';
alter table products add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_store_sku_key on products(store_id, sku);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  address text,
  status text not null default 'active' references warehouse_statuses(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, name)
);

alter table warehouses add column if not exists address text;
alter table warehouses add column if not exists status text not null default 'active';
alter table warehouses add column if not exists updated_at timestamptz not null default now();

create unique index if not exists warehouses_store_name_key on warehouses(store_id, name);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  quantity numeric not null default 0,
  min_quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique(product_id, warehouse_id)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  full_name text not null default 'Wallet Customer',
  point_balance numeric not null default 0,
  total_spent bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_wallet_address_key on customers(wallet_address);

create table if not exists payment_networks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  chain_id numeric,
  rpc_url text,
  explorer_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_networks_code_key on payment_networks(code);

create table if not exists payment_tokens (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references payment_networks(id) on delete cascade,
  symbol text not null,
  contract_address text,
  decimals int not null default 6,
  is_active boolean not null default true,
  unique(network_id, symbol)
);

create unique index if not exists payment_tokens_network_symbol_key on payment_tokens(network_id, symbol);

create table if not exists store_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  network_id uuid not null references payment_networks(id),
  token_id uuid not null references payment_tokens(id),
  receiver_wallet text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(store_id, network_id, token_id)
);

alter table store_payment_methods add column if not exists updated_at timestamptz not null default now();

create unique index if not exists store_payment_methods_store_network_token_key on store_payment_methods(store_id, network_id, token_id);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid references customers(id),
  staff_id uuid references store_staff(id),
  code text unique not null,
  checkout_token text unique not null,
  customer_wallet text,
  subtotal bigint not null default 0,
  tax_rate numeric not null default 10,
  tax_amount bigint not null default 0,
  total_before_points bigint not null default 0,
  apoints_redeemed numeric not null default 0,
  discount_amount bigint not null default 0,
  total_amount bigint not null default 0,
  apoints_earned numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists orders_code_key on orders(code);
create unique index if not exists orders_checkout_token_key on orders(checkout_token);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  sku text,
  quantity numeric not null,
  unit_price bigint not null default 0,
  total_price bigint not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  network_id uuid references payment_networks(id),
  token_id uuid references payment_tokens(id),
  payer_wallet text,
  receiver_wallet text not null,
  amount bigint not null default 0,
  tx_hash text,
  chain_id numeric,
  contract_address text,
  proof_tx_hash text,
  proof_contract_address text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table payments add column if not exists chain_id numeric;
alter table payments add column if not exists contract_address text;
alter table payments add column if not exists proof_tx_hash text;
alter table payments add column if not exists proof_contract_address text;

create table if not exists apoint_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  store_id uuid references stores(id),
  store_name text,
  order_id uuid references orders(id),
  invoice_id text,
  type text not null check (type in ('earned', 'redeemed', 'earn', 'redeem', 'adjust', 'refund')),
  points numeric not null,
  balance_after numeric,
  tx_hash text,
  payment_tx_hash text,
  proof_tx_hash text,
  note text,
  created_at timestamptz not null default now()
);

alter table apoint_ledger add column if not exists store_name text;
alter table apoint_ledger add column if not exists invoice_id text;
alter table apoint_ledger add column if not exists payment_tx_hash text;
alter table apoint_ledger add column if not exists proof_tx_hash text;

do $$
begin
  alter table apoint_ledger drop constraint if exists apoint_ledger_type_check;
  alter table apoint_ledger add constraint apoint_ledger_type_check
    check (type in ('earned', 'redeemed', 'earn', 'redeem', 'adjust', 'refund'));
end $$;

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_wallet text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into store_types(code, name, sort_order) values
  ('grocery', 'Grocery', 10),
  ('coffee', 'Coffee', 20),
  ('noodle_restaurant', 'Noodle Restaurant', 30),
  ('restaurant', 'Restaurant', 40),
  ('retail', 'Retail', 50)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into product_statuses(code, name, sort_order) values
  ('active', 'Active', 10),
  ('inactive', 'Inactive', 20),
  ('discontinued', 'No longer produced', 30)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into warehouse_statuses(code, name, sort_order) values
  ('active', 'Active', 10),
  ('inactive', 'Inactive', 20),
  ('discontinued', 'No longer used', 30)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into payment_networks(code, name, chain_id, rpc_url, explorer_url) values
  ('arc-testnet', 'Arc Testnet', 5042002, 'https://rpc.testnet.arc.network', 'https://testnet.arcscan.app')
on conflict (code) do update set name = excluded.name, chain_id = excluded.chain_id;

with n as (select id from payment_networks where code = 'arc-testnet')
insert into payment_tokens(network_id, symbol, contract_address, decimals)
select n.id, 'USDC', '0x3600000000000000000000000000000000000000', 6 from n
on conflict (network_id, symbol) do update set contract_address = excluded.contract_address, decimals = excluded.decimals;

with st as (select id, code from store_types),
seed(slug, name, branch, type_code, owner_wallet, receiver_wallet, image_folder, accent) as (
  values
  ('minh-chau-grocery', 'Minh Chau Grocery', 'Da Nang Branch', 'grocery', '0x863FBd9eaC8D1001828B2502A71d9520Cf85636D', '0x863FBd9eaC8D1001828B2502A71d9520Cf85636D', '/png/stores/minh-chau-grocery/products', '#5b35f5'),
  ('morning-arc-cafe', 'Morning Cafe', 'Central Counter', 'coffee', '0xc8044822b1cBF8416489e5Fc676c7746E2515aC6', '0xc8044822b1cBF8416489e5Fc676c7746E2515aC6', '/png/stores/morning-arc-cafe/products', '#0f766e'),
  ('golden-bowl-noodles', 'Golden Bowl Noodles', 'Kitchen 01', 'noodle_restaurant', '0x1e09B25731eef93646A36aD03E20147D3dfF3214', '0x1e09B25731eef93646A36aD03E20147D3dfF3214', '/png/stores/golden-bowl-noodles/products', '#b45309')
)
insert into stores(slug, name, branch, branch_name, store_type_id, owner_wallet, receiver_wallet, image_folder, accent)
select seed.slug, seed.name, seed.branch, seed.branch, st.id, seed.owner_wallet, seed.receiver_wallet, seed.image_folder, seed.accent
from seed join st on st.code = seed.type_code
on conflict (slug) do update set
  name = excluded.name,
  branch = excluded.branch,
  branch_name = excluded.branch_name,
  store_type_id = excluded.store_type_id,
  owner_wallet = excluded.owner_wallet,
  receiver_wallet = excluded.receiver_wallet,
  image_folder = excluded.image_folder,
  accent = excluded.accent;

with s as (select id, slug, owner_wallet from stores)
insert into store_staff(store_id, full_name, role, wallet_address, avatar)
select id, 'Grocery Owner', 'owner', owner_wallet, 'GO' from s where slug = 'minh-chau-grocery'
union all select id, 'Grocery Cashier', 'cashier', '0xCb55bA6B93A54Ae9406710620cD0686BDce4522d', 'GC' from s where slug = 'minh-chau-grocery'
union all select id, 'Cafe Owner', 'owner', owner_wallet, 'CO' from s where slug = 'morning-arc-cafe'
union all select id, 'Cafe Barista', 'cashier', '0x8F524d30238C1a5734ddd1Fc7470Fe72204539E8', 'CB' from s where slug = 'morning-arc-cafe'
union all select id, 'Noodle Owner', 'owner', owner_wallet, 'NO' from s where slug = 'golden-bowl-noodles'
union all select id, 'Noodle Cashier', 'cashier', '0x34104D0684434918EFa4B87eeC291C38ae25B8A1', 'NC' from s where slug = 'golden-bowl-noodles'
on conflict (store_id, wallet_address) do update set full_name = excluded.full_name, role = excluded.role, avatar = excluded.avatar, is_active = true;

with s as (select id, slug, branch from stores)
insert into warehouses(store_id, name, address, status)
select id, 'Main Store', branch, 'active' from s where slug = 'minh-chau-grocery'
union all select id, 'Main Counter', branch, 'active' from s where slug = 'morning-arc-cafe'
union all select id, 'Main Kitchen', branch, 'active' from s where slug = 'golden-bowl-noodles'
on conflict (store_id, name) do update set address = excluded.address, status = excluded.status;

with s as (select id, slug, image_folder from stores),
seed(store_slug, name, sku, barcode, category, unit, sell_price, cost_price, stock_quantity, min_stock, image_file, description) as (
  values
  ('minh-chau-grocery','ChocoPie Cake','CHOCO-PIE','893000001001','Snacks','box',12000,9500,43,15,'chocopie-cake.png','Chocolate pie snack'),
  ('minh-chau-grocery','Coca-Cola Can 330ml','COCA-330','893000001002','Drinks','can',9000,7000,45,20,'coca-cola-can-330ml.png','Soft drink can'),
  ('minh-chau-grocery','Neptune Cooking Oil 1L','NEPTUNE-1L','893000001003','Condiments','bottle',42000,35000,28,10,'neptune-cooking-oil-1l.png','Cooking oil bottle'),
  ('minh-chau-grocery','ST25 Rice 5kg','ST25-5KG','893000001004','Food','bag',155000,130000,21,30,'st25-rice-5kg.png','Premium rice bag'),
  ('minh-chau-grocery','Pulppy Toilet Paper','PULPPY-10','893000001005','Household','pack',35000,28000,26,20,'pulppy-toilet-paper.png','Toilet paper pack'),
  ('morning-arc-cafe','Americano','AMERICANO','CAFE001','Coffee','cup',28000,12000,80,20,'cafe-americano.png','Double shot espresso with hot water'),
  ('morning-arc-cafe','Latte','LATTE','CAFE002','Coffee','cup',38000,16000,70,20,'cafe-latte.png','Espresso with steamed milk'),
  ('morning-arc-cafe','Cold Brew','COLD-BREW','CAFE003','Cold Drinks','bottle',42000,18000,36,12,'cafe-cold-brew.png','Slow brewed cold coffee'),
  ('morning-arc-cafe','Matcha Tea','MATCHA','CAFE004','Tea','cup',40000,17000,52,15,'cafe-matcha.png','Ceremonial matcha latte'),
  ('morning-arc-cafe','Butter Croissant','CROISSANT','CAFE005','Bakery','piece',32000,15000,24,10,'cafe-croissant.png','Daily baked croissant'),
  ('golden-bowl-noodles','Beef Noodle Bowl','BEEF-NOODLE','NOODLE001','Noodles','bowl',65000,35000,50,12,'noodle-beef-bowl.png','Signature beef broth noodle bowl'),
  ('golden-bowl-noodles','Chicken Noodle Bowl','CHICKEN-NOODLE','NOODLE002','Noodles','bowl',58000,30000,54,12,'noodle-chicken-bowl.png','Chicken broth with herbs'),
  ('golden-bowl-noodles','Spicy Dry Noodles','SPICY-DRY','NOODLE003','Noodles','bowl',52000,26000,42,10,'noodle-spicy-dry.png','Dry noodles with chili oil'),
  ('golden-bowl-noodles','Spring Rolls','ROLLS','NOODLE004','Sides','plate',30000,14000,30,8,'noodle-spring-rolls.png','Fresh rolls with dipping sauce'),
  ('golden-bowl-noodles','Iced Tea','ICED-TEA','NOODLE005','Drinks','glass',12000,3000,120,30,'noodle-iced-tea.png','House iced tea')
)
insert into products(store_id, name, sku, barcode, category, unit, sell_price, cost_price, stock_quantity, min_stock, image_url, description, status)
select s.id, seed.name, seed.sku, seed.barcode, seed.category, seed.unit, seed.sell_price, seed.cost_price, seed.stock_quantity, seed.min_stock, s.image_folder || '/' || seed.image_file, seed.description, 'active'
from seed join s on s.slug = seed.store_slug
on conflict (store_id, sku) do update set
  name = excluded.name,
  barcode = excluded.barcode,
  category = excluded.category,
  unit = excluded.unit,
  sell_price = excluded.sell_price,
  cost_price = excluded.cost_price,
  stock_quantity = excluded.stock_quantity,
  min_stock = excluded.min_stock,
  image_url = excluded.image_url,
  description = excluded.description;

insert into customers(wallet_address, full_name, point_balance, total_spent)
values
  ('0xf3a00000000000000000000000000000009b2c1d', 'Wallet Customer', 394, 409000),
  ('0x7b2e1af93c000000000000000000000000abc123', 'Guest Wallet', 128, 128000)
on conflict (wallet_address) do update set full_name = excluded.full_name;

insert into store_payment_methods(store_id, network_id, token_id, receiver_wallet, is_default, is_active)
select stores.id, payment_networks.id, payment_tokens.id, stores.receiver_wallet, true, true
from stores
join payment_networks on payment_networks.code = 'arc-testnet'
join payment_tokens on payment_tokens.network_id = payment_networks.id and payment_tokens.symbol = 'USDC'
on conflict (store_id, network_id, token_id) do update set receiver_wallet = excluded.receiver_wallet, is_default = true, is_active = true;

update stores
set receiver_wallet = owner_wallet,
    updated_at = now()
where receiver_wallet is distinct from owner_wallet;

update store_payment_methods
set receiver_wallet = stores.owner_wallet
from stores
where store_payment_methods.store_id = stores.id
  and store_payment_methods.receiver_wallet is distinct from stores.owner_wallet;

alter table store_types enable row level security;
alter table product_statuses enable row level security;
alter table warehouse_statuses enable row level security;
alter table stores enable row level security;
alter table store_staff enable row level security;
alter table products enable row level security;
alter table warehouses enable row level security;
alter table inventory enable row level security;
alter table customers enable row level security;
alter table payment_networks enable row level security;
alter table payment_tokens enable row level security;
alter table store_payment_methods enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table apoint_ledger enable row level security;
alter table audit_logs enable row level security;

-- Prototype policies for anon frontend. Tighten these before production.
do $$
declare t text;
begin
  foreach t in array array[
    'store_types','product_statuses','warehouse_statuses','stores','store_staff','products',
    'warehouses','inventory','customers','payment_networks','payment_tokens',
    'store_payment_methods','orders','order_items','payments','apoint_ledger','audit_logs'
  ] loop
    execute format('drop policy if exists "prototype_all_%1$s" on %1$I', t);
    execute format('create policy "prototype_all_%1$s" on %1$I for all using (true) with check (true)', t);
  end loop;
end $$;
