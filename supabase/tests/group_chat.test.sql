-- Group chat: who can read and write, reactions, unread counts, muting,
-- batched pushes, blocks, deleting, reporting and the moments the app posts.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Alex owns the group; Blair, Casey and Drew join; Eli is an outsider.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com', '{"full_name": "Alex Smith"}'),
  ('00000000-0000-0000-0000-00000000000b', 'blair@example.com', '{"full_name": "Blair"}'),
  ('00000000-0000-0000-0000-00000000000c', 'casey@example.com', '{"full_name": "Casey"}'),
  ('00000000-0000-0000-0000-00000000000d', 'drew@example.com', '{"full_name": "Drew"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eli@example.com', '{"full_name": "Eli"}');
update public.profiles set timezone = 'UTC';
update public.profiles set mascot = 'capybara' where id = '00000000-0000-0000-0000-00000000000a';

create temp table g (id uuid, code text);
create temp table msg (name text, id uuid);
grant select, insert, delete on g, msg to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into g select id, invite_code from public.create_group('Gym Rats');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.join_group((select code from g));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.join_group((select code from g));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.join_group((select code from g));

-- Everything in a test runs at the same now(), so start everyone's read
-- marker an hour back to make new messages count as unread.
reset role;
update public.group_members set last_read_at = now() - interval '1 hour';
delete from public.notifications;

-- ─── Joining posts a moment ──────────────────────────────────────────────────

select is(
  (select count(*)::int from public.group_messages where group_id = (select id from g) and kind = 'joined'),
  3, 'each person who joins shows up in the chat (not the creator)');

-- ─── Sending and reading ─────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select throws_ok($$ select public.send_group_message((select id from g), 'hi') $$, '42501', null,
  'outsiders can''t send');
select is((select count(*)::int from public.group_chat((select id from g))), 0, 'or read the chat');
select is((select count(*)::int from public.group_messages), 0, 'even straight from the table');
select is((select count(*)::int from public.my_chats()), 0, 'and have no chats');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into msg select 'first', id from public.send_group_message((select id from g), '  Who''s walking tonight?  ');
select is((select body from public.group_messages where id = (select id from msg where name = 'first')),
  'Who''s walking tonight?', 'members can send; the text is trimmed');
select throws_ok($$ select public.send_group_message((select id from g), '   ') $$, 'P0001', null,
  'empty messages are refused');
select throws_ok($$ select public.send_group_message((select id from g), repeat('a', 1001)) $$, 'P0001', null,
  'and so are ones over 1,000 characters');
select throws_ok(
  $$ insert into public.group_messages (group_id, user_id, body) values ((select id from g), auth.uid(), 'sneaky') $$,
  '42501', null, 'messages can''t be written to the table directly');

-- Same now() as the join moments; move those back so the message is newest.
reset role;
update public.group_messages set created_at = now() - interval '2 minutes' where kind = 'joined';

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(
  (select name || ' ' || mascot || ' ' || is_me::text from public.group_chat((select id from g)) where kind = 'text'),
  'Alex capybara false', 'members see the sender''s first name and buddy');
select is((select count(*)::int from public.group_chat((select id from g))), 4, 'and every message, newest first');
select is((select unread from public.my_chats()), 3, 'unread counts what others posted that you haven''t seen');
select is((select last_name || ': ' || last_body from public.my_chats()), 'Alex: Who''s walking tonight?',
  'the Chats tab previews the newest message');

-- ─── Pushes ──────────────────────────────────────────────────────────────────

reset role;
select is(
  (select array_agg(user_id order by user_id) from public.notifications where kind = 'group_chat'),
  array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c',
        '00000000-0000-0000-0000-00000000000d']::uuid[],
  'a message pushes to everyone else');
select is(
  (select title || ' | ' || body || ' | ' || url from public.notifications where kind = 'group_chat' limit 1),
  '🔥 Gym Rats | Alex: Who''s walking tonight? | /group/chat/' || (select id from g),
  'with the group, sender, message and a link to the chat');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.send_group_message((select id from g), 'Anyone?');
reset role;
select is((select count(*)::int from public.notifications where kind = 'group_chat'), 3,
  'a second message in a burst doesn''t push again');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.mark_group_read((select id from g));
select is((select unread from public.my_chats()), 0, 'reading the chat clears unread');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.set_group_chat_muted((select id from g), true);
select is((select muted from public.my_chats()), true, 'you can mute a chat');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.send_group_message((select id from g), 'Last call');
reset role;
select is(
  (select array_agg(user_id order by user_id) from public.notifications where kind = 'group_chat'
   and body = 'Alex: Last call'),
  array['00000000-0000-0000-0000-00000000000b']::uuid[],
  'after you''ve read it you get the next push; muted and still-unread members don''t');

-- ─── Reactions ───────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(public.toggle_group_reaction((select id from msg where name = 'first'), 'treat'), true,
  'members can toss a treat');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.toggle_group_reaction((select id from msg where name = 'first'), 'treat');
select is(
  (select reactions from public.group_chat((select id from g)) where id = (select id from msg where name = 'first')),
  '[{"reaction": "treat", "count": 2, "mine": true}]'::jsonb, 'reactions show a count and whether you added one');
select is(public.toggle_group_reaction((select id from msg where name = 'first'), 'treat'), false,
  'tapping again takes it back');
select throws_ok($$ select public.toggle_group_reaction((select id from msg where name = 'first'), 'poop') $$,
  '23514', null, 'only the five reactions');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select throws_ok($$ select public.toggle_group_reaction((select id from msg where name = 'first'), 'heart') $$,
  'P0002', null, 'outsiders can''t react');

-- ─── Blocking ────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into msg select 'casey', id from public.send_group_message((select id from g), 'I''m in');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.toggle_group_reaction((select id from msg where name = 'casey'), 'heart');
select public.block_user('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.group_chat((select id from g)) where user_id = '00000000-0000-0000-0000-00000000000c'),
  0, 'you don''t see messages from someone you blocked');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(
  (select reactions from public.group_chat((select id from g)) where id = (select id from msg where name = 'casey')),
  '[]'::jsonb, 'and they don''t see your messages or reactions');

reset role;
delete from public.notifications;
update public.group_members set last_read_at = now() - interval '1 hour';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.send_group_message((select id from g), 'Blocked test');
reset role;
select ok(not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000c'),
  'or get pushes for them');

-- ─── Deleting and reporting ──────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.delete_group_message((select id from msg where name = 'first')) $$, '42501', null,
  'members can''t delete other people''s messages');
select lives_ok(
  $$ select public.report_content('00000000-0000-0000-0000-00000000000c', 'group_message',
       (select id from msg where name = 'casey'), 'harassment') $$,
  'but can report them');
reset role;
select is((select snapshot from public.content_reports where kind = 'group_message'), 'I''m in',
  'the report keeps a copy of the message');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.delete_group_message((select id from msg where name = 'casey'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.delete_group_message((select id from msg where name = 'first'));
reset role;
select is((select count(*)::int from public.group_messages where id in (select id from msg)), 0,
  'senders delete their own messages, and the owner can delete any');

-- ─── Moments ─────────────────────────────────────────────────────────────────

insert into public.streaks (user_id, current_weeks, this_week_days, this_week_goal)
values ('00000000-0000-0000-0000-00000000000b', 1, 3, 3)
on conflict (user_id) do update set this_week_days = 3, this_week_goal = 3;
update public.streaks set this_week_days = 2 where user_id = '00000000-0000-0000-0000-00000000000b';
update public.streaks set this_week_days = 3 where user_id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select count(*)::int from public.group_messages where kind = 'goal_hit'
   and user_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'hitting your weekly goal posts once a week');

insert into public.group_week_notices (group_id, week_start, kind)
values ((select id from g), public.week_of(current_date), 'done');
select is((select count(*)::int from public.group_messages where kind = 'squad_done'), 1,
  'making the squad week posts too');
select is((select count(*)::int from public.notifications where kind = 'group_chat' and body like '%goal%'), 0,
  'moments don''t push (the group pushes already cover them)');

-- ─── Limits ──────────────────────────────────────────────────────────────────

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select public.send_group_message((select id from g), 'spam ' || i) from generate_series(1, 20) i;
select throws_ok($$ select public.send_group_message((select id from g), 'one more') $$, 'P0001', null,
  'up to 20 messages a minute');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.group_chat((select id from g), null, 5)), 5, 'the chat loads in pages');

select * from finish();
rollback;
