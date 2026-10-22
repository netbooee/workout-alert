-- Partner workout pushes carry the category that shows Cheer and Verify. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(3);

select is(public.notification_category('partner_workout'), 'partner_workout',
  'partner workout pushes get the partner_workout category');
select is(public.notification_category('nudge'), null, 'other pushes get no category');
select is(
  jsonb_strip_nulls(jsonb_build_object('to', 'x', 'categoryId', public.notification_category('nudge'))),
  '{"to": "x"}'::jsonb,
  'a missing category is left out of the message, not sent as null');

select * from finish();
rollback;
