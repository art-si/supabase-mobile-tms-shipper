begin;

-- This changes only the known local shipper contract. Check the hosted baseline
-- separately before deployment; do not replace a missing or divergent RPC.
do $$
declare
  v_rpc oid;
begin
  select p.oid into v_rpc
  from pg_catalog.pg_proc p
  where p.oid = pg_catalog.to_regprocedure('public.tms_shipper_mobile(uuid,text,jsonb)')
    and not p.prosecdef
    and p.proconfig = array['search_path=""']
    and pg_catalog.md5(pg_catalog.replace(p.prosrc, pg_catalog.chr(13), '')) = '142eb2ced54adbea6ae18425753ef7ef';
  if v_rpc is null or pg_catalog.to_regclass('tms_shipper_private.accounts') is null then
    raise exception 'Expected the base shipper RPC and accounts from migration 20261115002155';
  end if;
  if not pg_catalog.has_function_privilege('service_role', v_rpc, 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', v_rpc, 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', v_rpc, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      where p.oid = v_rpc and acl.privilege_type = 'EXECUTE'
        and acl.grantee not in (p.proowner, ('service_role'::pg_catalog.regrole)::oid)
    ) then
    raise exception 'Expected a service-role-only base shipper RPC';
  end if;
end
$$;

create or replace function public.tms_shipper_mobile(p_auth_user_id uuid, p_action text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_account tms_shipper_private.accounts%rowtype;
  v_profile jsonb;
  v_order public.tms_order%rowtype;
  v_filter text := coalesce(p_params->>'filter', 'all');
  v_search text := lower(btrim(coalesce(p_params->>'keyword', '')));
  v_cursor_time timestamptz := (p_params#>>'{cursor,createdAt}')::timestamptz;
  v_cursor_id uuid := (p_params#>>'{cursor,id}')::uuid;
  v_result jsonb;
  v_statement_cursor jsonb;
  v_statement_end public.tms_customer_statement_summary.period_end%type;
  v_statement_next jsonb;
begin
  select a.*, jsonb_build_object('displayName', a.display_name, 'customerName', c.customer_name, 'tenantName', t.tenant_name)
    into v_account.auth_user_id, v_account.tenant_id, v_account.customer_id, v_account.order_actor_id,
      v_account.display_name, v_account.enabled, v_account.created_at, v_profile
  from tms_shipper_private.accounts a
  join public.mdm_customer c on c.id = a.customer_id and c.tenant_id = a.tenant_id and c.enabled
  join public.sys_tenant t on t.id = a.tenant_id and t.status = '1'
    and (t.service_start_date is null or t.service_start_date <= (now() at time zone 'Asia/Shanghai')::date)
    and (t.service_end_date is null or t.service_end_date >= (now() at time zone 'Asia/Shanghai')::date)
  where a.auth_user_id = p_auth_user_id and a.enabled
    and not exists (select 1 from public.sys_user u where u.auth_user_id = p_auth_user_id);
  if not found then raise exception 'Active shipper account required' using errcode = '42501'; end if;

  case p_action
  when 'profile' then
    return v_profile;
  when 'stations' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.station_name) order by s.sort, s.station_name, s.id)
      from public.mdm_station s where s.tenant_id = v_account.tenant_id and s.enabled
    ), '[]'::jsonb);
  when 'create' then
    return tms_shipper_private.create_order(v_account, p_params);
  when 'saved_items', 'save_item', 'delete_item' then
    return tms_shipper_private.manage_saved_item(v_account, p_action, p_params);
  when 'messages' then
    return coalesce((
      select jsonb_agg(r.message order by r.update_time desc, r.id desc)
      from (
        select o.id, o.update_time, jsonb_build_object(
          'id', o.id, 'orderNo', o.order_no, 'status', o.order_status, 'createdAt', o.update_time,
          'isRead', coalesce(m.seen_update_time >= o.update_time, false)
        ) as message
        from public.tms_order o
        left join tms_shipper_private.message_reads m on m.order_id = o.id and m.auth_user_id = p_auth_user_id
        where o.tenant_id = v_account.tenant_id and o.shipping_customer_id = v_account.customer_id
        order by o.update_time desc, o.id desc limit 50
      ) r
    ), '[]'::jsonb);
  when 'read_message' then
    insert into tms_shipper_private.message_reads as m (auth_user_id, order_id, seen_update_time)
    select p_auth_user_id, o.id, least(o.update_time, (p_params->>'createdAt')::timestamptz)
    from public.tms_order o
    where o.id = (p_params->>'id')::uuid and o.tenant_id = v_account.tenant_id
      and o.shipping_customer_id = v_account.customer_id and p_params->>'createdAt' is not null
    on conflict (auth_user_id, order_id) do update
      set seen_update_time = greatest(m.seen_update_time, excluded.seen_update_time);
    return 'true'::jsonb;
  when 'statements', 'statements_page' then
    if p_action = 'statements_page' and p_params ? 'cursor' and p_params->'cursor' <> 'null'::jsonb then
      v_statement_cursor := p_params->'cursor';
      if jsonb_typeof(v_statement_cursor) is distinct from 'object'
        or jsonb_typeof(v_statement_cursor->'id') is distinct from 'string'
        or coalesce(jsonb_typeof(v_statement_cursor->'periodEnd'), '') not in ('null', 'string') then
        raise exception 'Invalid statement cursor' using errcode = '22023';
      end if;
      begin
        v_statement_end := v_statement_cursor->>'periodEnd';
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception 'Invalid statement cursor' using errcode = '22023';
      end;
      if v_statement_end is not null and to_jsonb(v_statement_end) is distinct from v_statement_cursor->'periodEnd' then
        raise exception 'Invalid statement cursor' using errcode = '22023';
      end if;
    end if;

    with page as (
      select s.id, s.period_end, jsonb_build_object(
        'id', s.id, 'number', s.statement_no, 'periodStart', s.period_start, 'periodEnd', s.period_end,
        'amount', s.statement_amount, 'settled', s.settled_amount
      ) as item
      from public.tms_customer_statement_summary s
      where s.tenant_id = v_account.tenant_id and s.customer_id = v_account.customer_id and s.status = 'confirmed'
        and (v_statement_cursor is null or case
          -- DESC puts undated rows first. Finish that group before seeking dated rows.
          when v_statement_end is null then s.period_end is not null or s.id < v_cursor_id
          else (s.period_end, s.id) < (v_statement_end, v_cursor_id)
        end)
      order by s.period_end desc nulls first, s.id desc
      limit case when p_action = 'statements_page' then 51 else 50 end
    ), visible as (
      select * from page order by period_end desc nulls first, id desc limit 50
    )
    select coalesce(jsonb_agg(v.item order by v.period_end desc nulls first, v.id desc), '[]'::jsonb),
      case when (select count(*) from page) > 50 then (
        select jsonb_build_object('periodEnd', period_end, 'id', id)
        from visible order by period_end asc nulls last, id asc limit 1
      ) end
    into v_result, v_statement_next from visible v;
    if p_action = 'statements' then return v_result; end if;
    return jsonb_build_object('items', v_result, 'nextCursor', v_statement_next);
  when 'statement_detail' then
    select jsonb_build_object(
      'id', s.id, 'number', s.statement_no, 'periodStart', s.period_start, 'periodEnd', s.period_end,
      'amount', s.statement_amount, 'settled', s.settled_amount,
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'orderNo', i.order_no_snapshot, 'origin', i.origin_station_snapshot,
          'destination', i.destination_station_snapshot, 'amount', i.line_amount
        ) order by i.create_time, i.id)
        from public.tms_customer_statement_item i
        where i.statement_id = s.id and i.tenant_id = s.tenant_id and i.customer_id = s.customer_id and i.is_active
      ), '[]'::jsonb)
    ) into v_result
    from public.tms_customer_statement_summary s
    where s.id = (p_params->>'id')::uuid and s.tenant_id = v_account.tenant_id
      and s.customer_id = v_account.customer_id and s.status = 'confirmed';
    if v_result is null then raise exception 'Statement unavailable' using errcode = 'PT404'; end if;
    return v_result;
  when 'detail' then
    select o.* into v_order from public.tms_order o
    where o.id = (p_params->>'id')::uuid and o.tenant_id = v_account.tenant_id
      and o.shipping_customer_id = v_account.customer_id;
    if not found then raise exception 'Order unavailable' using errcode = 'P0002'; end if;
    return tms_shipper_private.order_detail(v_order);
  when 'dashboard' then
    return jsonb_build_object(
      'profile', v_profile,
      'counts', jsonb_build_object('pending', 0, 'in_progress', 0, 'signed', 0, 'cancelled', 0)
        || coalesce((
          select jsonb_object_agg(groups.name, groups.total) from (
            select tms_shipper_private.order_group(o.order_status) as name, count(*) as total
            from public.tms_order o
            where o.tenant_id = v_account.tenant_id and o.shipping_customer_id = v_account.customer_id
            group by 1
          ) groups
        ), '{}'::jsonb),
      'recent', coalesce((
        select jsonb_agg(r.item order by r.create_time desc, r.id desc) from (
          select tms_shipper_private.order_summary(o) as item, o.create_time, o.id
          from public.tms_order o
          where o.tenant_id = v_account.tenant_id and o.shipping_customer_id = v_account.customer_id
          order by o.create_time desc, o.id desc limit 3
        ) r
      ), '[]'::jsonb)
    );
  when 'list' then
    if v_filter not in ('all', 'pending', 'in_progress', 'signed', 'cancelled')
      or char_length(v_search) > 64 or (v_cursor_time is null) <> (v_cursor_id is null) then
      raise exception 'Invalid order filter' using errcode = '22023';
    end if;
    with page as (
      select tms_shipper_private.order_summary(o) as item, o.create_time, o.id
      from public.tms_order o
      where o.tenant_id = v_account.tenant_id and o.shipping_customer_id = v_account.customer_id
        and (v_filter = 'all' or tms_shipper_private.order_group(o.order_status) = v_filter)
        and (v_cursor_time is null or (o.create_time, o.id) < (v_cursor_time, v_cursor_id))
        and (
          v_search = '' or strpos(lower(concat_ws(' ', o.order_no, o.origin_station, o.destination_station)), v_search) > 0
          or exists (
            select 1 from jsonb_array_elements(o.cargo_items) line
            where strpos(lower(coalesce(line->>'cargo_name', line->>'name', '')), v_search) > 0
          )
        )
      order by o.create_time desc, o.id desc limit 21
    ), visible as (
      select * from page order by create_time desc, id desc limit 20
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(v.item order by v.create_time desc, v.id desc), '[]'::jsonb),
      'nextCursor', case when (select count(*) from page) > 20 then (
        select jsonb_build_object('createdAt', create_time, 'id', id) from visible order by create_time, id limit 1
      ) end
    ) into v_result from visible v;
    return v_result;
  else
    raise exception 'Unknown shipper action' using errcode = '22023';
  end case;
end
$$;

notify pgrst, 'reload schema';
commit;
