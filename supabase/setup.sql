create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create schema if not exists private;

create table public.modules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 160),
 file_name text not null,
 storage_path text not null,
 subject text not null default 'Umum' check (char_length(subject) <= 60),
 status text not null default 'processing' check (status in ('processing','ready','error')),
 page_count integer not null default 0 check (page_count between 0 and 150),
 chunk_count integer not null default 0,
 error_message text,
 created_at timestamptz not null default now(),
 unique(id,user_id),
 check (storage_path like user_id::text || '/' || id::text || '/%')
);
create index modules_user_created_idx on public.modules(user_id,created_at desc);
create table public.module_chunks (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null,
 user_id uuid not null default auth.uid(),
 chunk_index integer not null check(chunk_index >= 0),
 page integer not null check(page between 1 and 150),
 content text not null check(char_length(content) between 1 and 2500),
 embedding extensions.vector(384) not null,
 foreign key(module_id,user_id) references public.modules(id,user_id) on delete cascade,
 unique(module_id,chunk_index)
);
create index chunks_owner_idx on public.module_chunks(user_id);
create index chunks_module_owner_idx on public.module_chunks(module_id,user_id);
-- Exact cosine search within one module is deliberate for this bounded MVP.
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid(),
 module_id uuid not null,
 title text not null default 'Percakapan baru' check(char_length(title)<=160),
 created_at timestamptz not null default now(),
 foreign key(module_id,user_id) references public.modules(id,user_id) on delete cascade,
 unique(id,user_id)
);
create index conversations_owner_idx on public.conversations(user_id,created_at desc);
create index conversations_module_idx on public.conversations(module_id,user_id);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null,
 user_id uuid not null default auth.uid(),
 role text not null check(role in ('user','assistant')),
 content text not null check(char_length(content) between 1 and 20000),
 sources jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 foreign key(conversation_id,user_id) references public.conversations(id,user_id) on delete cascade
);
create index messages_conversation_idx on public.messages(conversation_id,created_at);
create index messages_owner_idx on public.messages(user_id);
create index messages_conversation_owner_idx on public.messages(conversation_id,user_id);

alter table public.modules enable row level security;
alter table public.module_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy own_modules on public.modules for all to authenticated
 using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_chunks on public.module_chunks for all to authenticated
 using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_conversations on public.conversations for all to authenticated
 using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_messages on public.messages for all to authenticated
 using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.modules,public.module_chunks,public.conversations,public.messages from anon;
grant select,insert,update,delete on public.modules,public.module_chunks,public.conversations,public.messages to authenticated;

create function public.match_module_chunks(
 p_module_id uuid, query_embedding extensions.vector(384), match_count integer default 6
) returns table(id uuid,content text,page integer,similarity double precision)
language sql stable security invoker set search_path = '' as $$
 select c.id,c.content,c.page,1-(c.embedding operator(extensions.<=>) query_embedding)
 from public.module_chunks c join public.modules m on m.id=c.module_id
 where c.module_id=p_module_id and c.user_id=(select auth.uid()) and m.status='ready'
 order by c.embedding operator(extensions.<=>) query_embedding
 limit least(greatest(match_count,1),8);
$$;
revoke all on function public.match_module_chunks(uuid,extensions.vector,integer) from public,anon;
grant execute on function public.match_module_chunks(uuid,extensions.vector,integer) to authenticated;

-- A bounded, atomic per-user budget. Users cannot edit usage counters.
create table private.chat_usage (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now()
);
create index chat_usage_owner_time_idx on private.chat_usage(user_id,requested_at);
alter table private.chat_usage enable row level security;
create policy deny_direct_quota_access on private.chat_usage for all to authenticated using(false) with check(false);
revoke all on private.chat_usage from public,anon,authenticated;
create function private.consume_chat_request() returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); recent integer; daily integer;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
 select count(*) filter(where requested_at > now()-interval '1 minute'), count(*)
 into recent,daily from private.chat_usage where user_id=uid and requested_at > now()-interval '24 hours';
 if recent >= 8 or daily >= 100 then return false; end if;
 delete from private.chat_usage where user_id=uid and requested_at < now()-interval '24 hours';
 insert into private.chat_usage(user_id) values(uid);
 return true;
end $$;
revoke all on function private.consume_chat_request() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.consume_chat_request() to authenticated;
create function public.consume_chat_request() returns boolean
language sql security invoker set search_path='' as $$
 select private.consume_chat_request();
$$;
revoke all on function public.consume_chat_request() from public,anon;
grant execute on function public.consume_chat_request() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('modules','modules',false,15728640,array['application/pdf']);
create policy module_files_select on storage.objects for select to authenticated
 using(bucket_id='modules' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy module_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='modules' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.modules m where m.storage_path=name and m.user_id=(select auth.uid())));
create policy module_files_delete on storage.objects for delete to authenticated
 using(bucket_id='modules' and (storage.foldername(name))[1]=(select auth.uid())::text);
