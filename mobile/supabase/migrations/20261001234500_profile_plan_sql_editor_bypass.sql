-- Allow SQL Editor / service_role / postgres to change profiles.plan and profiles.role
-- when auth.uid() is null. Still block authenticated non-admins (idempotent).

create or replace function public.enforce_profile_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.plan is distinct from old.plan then
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_admin() then
      raise exception 'Only admins can change subscription plans';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'admin' and not public.is_admin() then
      new.role := 'member';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change user roles';
  end if;

  return new;
end;
$$;
