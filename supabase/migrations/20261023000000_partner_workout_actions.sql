-- "Just worked out" pushes carry the partner_workout category, so iOS shows
-- 👏 Cheer and ✅ Verify buttons on them (the app registers the category; see
-- src/lib/notification-actions.ts). Other kinds are sent without a category.

create or replace function public.notification_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind when 'partner_workout' then 'partner_workout' end;
$$;

create or replace function public.deliver_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'to', t.token,
    'title', new.title,
    'body', new.body,
    'sound', 'default',
    'categoryId', public.notification_category(new.kind),
    'data', jsonb_build_object('url', new.url, 'kind', new.kind)
  )))
  into messages
  from public.push_tokens t
  where t.user_id = new.user_id;

  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return null;
end;
$$;
