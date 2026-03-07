-- Reserved for post-MVP account and cloud sync activation.
-- This baseline mirrors local entities with ownership fields.

create table if not exists profiles (
  id uuid primary key,
  created_at timestamptz not null default now()
);
