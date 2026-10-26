-- Apply this migration in Supabase SQL Editor to an existing QR Attendance database.
-- It is safe to run more than once.

alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'admin'
  );
$$;

create or replace function public.prevent_untrusted_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and auth.role() is distinct from 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
    and not public.is_admin()
  then
    raise exception 'Only an administrator can change account roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_changes on public.profiles;
create trigger prevent_profile_role_changes
  before update of role on public.profiles
  for each row execute procedure public.prevent_untrusted_role_changes();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('student', 'teacher')
        then new.raw_user_meta_data ->> 'role'
      else 'student'
    end
  );
  return new;
end;
$$;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id and active);
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_active_user() and public.is_admin());
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('student', 'teacher') and active);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id and active)
  with check (auth.uid() = id and active);
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
  on public.profiles for update
  using (public.is_active_user() and public.is_admin())
  with check (public.is_active_user() and public.is_admin());

drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user"
  on public.events for select
  using (auth.role() = 'authenticated' and public.is_active_user());
drop policy if exists "Users can insert events" on public.events;
create policy "Users can insert events"
  on public.events for insert
  with check (public.is_active_user());
drop policy if exists "Users can update their own events" on public.events;
create policy "Users can update their own events"
  on public.events for update
  using (public.is_active_user() and (auth.uid() = created_by or public.is_admin()))
  with check (public.is_active_user() and (auth.uid() = created_by or public.is_admin()));
drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete
  using (public.is_active_user() and public.is_admin());

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance"
  on public.attendance for select
  using (public.is_active_user() and auth.uid() = student_id);
drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert
  with check (public.is_active_user() and auth.uid() = student_id);
drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  using (
    public.is_active_user() and exists (
      select 1 from public.events e
      where e.id = attendance.event_id and e.created_by = auth.uid()
    )
  );
drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select
  using (public.is_active_user() and public.is_admin());

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees"
  on public.profiles for select
  using (
    public.is_active_user() and exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id and e.created_by = auth.uid()
    )
  );

-- Promote the first admin after applying this migration:
-- update public.profiles set role = 'admin' where email = 'admin@school.edu';
