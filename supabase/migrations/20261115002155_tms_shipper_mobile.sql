begin;

create schema tms_shipper_private;
revoke all on schema tms_shipper_private from public, anon, authenticated;
grant usage on schema tms_shipper_private to service_role;

-- External Auth accounts do not receive a sys_user identity or TMS web roles.
create table tms_shipper_private.accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.sys_tenant(id) on delete cascade,
  customer_id uuid not null references public.mdm_customer(id) on delete cascade,
  order_actor_id uuid references public.sys_user(id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index tms_shipper_accounts_tenant_idx on tms_shipper_private.accounts (tenant_id);
create index tms_shipper_accounts_customer_idx on tms_shipper_private.accounts (customer_id);
create index tms_shipper_accounts_actor_idx on tms_shipper_private.accounts (order_actor_id);

create table tms_shipper_private.submissions (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  order_id uuid references public.tms_order(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, request_id)
);
create index tms_shipper_submissions_order_idx on tms_shipper_private.submissions (order_id);

create table tms_shipper_private.saved_items (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references tms_shipper_private.accounts(auth_user_id) on delete cascade,
  tenant_id uuid not null,
  customer_id uuid not null,
  kind text not null check (kind in ('cargo', 'address')),
  title text not null,
  contact jsonb,
  updated_at timestamptz not null default now()
);
create index tms_shipper_saved_items_owner_idx
  on tms_shipper_private.saved_items (auth_user_id, tenant_id, customer_id, kind, updated_at desc);

create table tms_shipper_private.message_reads (
  auth_user_id uuid not null references tms_shipper_private.accounts(auth_user_id) on delete cascade,
  order_id uuid not null references public.tms_order(id) on delete cascade,
  seen_update_time timestamptz not null,
  primary key (auth_user_id, order_id)
);
create index tms_shipper_message_reads_order_idx on tms_shipper_private.message_reads (order_id);

alter table tms_shipper_private.accounts enable row level security;
alter table tms_shipper_private.submissions enable row level security;
alter table tms_shipper_private.saved_items enable row level security;
alter table tms_shipper_private.message_reads enable row level security;
revoke all on all tables in schema tms_shipper_private from public, anon, authenticated;
grant select on tms_shipper_private.accounts to service_role;
grant select, insert on tms_shipper_private.submissions to service_role;
grant select, insert, update, delete on tms_shipper_private.saved_items to service_role;
grant select, insert, update on tms_shipper_private.message_reads to service_role;

create index tms_shipper_order_list_idx
  on public.tms_order (tenant_id, shipping_customer_id, create_time desc, id desc);
create index tms_shipper_order_updates_idx
  on public.tms_order (tenant_id, shipping_customer_id, update_time desc, id desc);

create function tms_shipper_private.order_group(p_status text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case
    when p_status in ('signed', 'completed') then 'signed'
    when p_status in ('transporting', 'partially_signed') then 'in_progress'
    when p_status = 'cancelled' then 'cancelled'
    else 'pending'
  end
$$;

create function tms_shipper_private.order_summary(p_order public.tms_order)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p_order.id, 'orderNo', p_order.order_no, 'status', p_order.order_status,
    'origin', p_order.origin_station, 'destination', p_order.destination_station,
    'cargoName', coalesce(nullif(p_order.cargo_items->0->>'cargo_name', ''), nullif(p_order.cargo_items->0->>'name', ''), '货物'),
    'cargoQuantity', p_order.cargo_quantity_total,
    'cargoUnit', (
      select case when count(distinct coalesce(nullif(cargo->>'unit', ''), '件')) <= 1
        then coalesce(max(nullif(cargo->>'unit', '')), '件') end
      from jsonb_array_elements(p_order.cargo_items) cargo
    ),
    'cargoWeightKg', p_order.cargo_weight_total,
    'cargoVolumeM3', p_order.cargo_volume_total, 'createdAt', p_order.create_time
  )
$$;

create function tms_shipper_private.order_detail(p_order public.tms_order)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with allocations as (
    select a.id, a.waybill_id, a.quantity, a.signed_quantity, a.exception_quantity, a.receipt_recorded_at
    from public.tms_waybill_order_allocation a
    where a.tenant_id = p_order.tenant_id and a.order_id = p_order.id
    union all
    select w.id, w.id, p_order.cargo_quantity_total, null, null, null
    from public.tms_waybill w
    where w.tenant_id = p_order.tenant_id and w.order_id = p_order.id
      and not exists (select 1 from public.tms_waybill_order_allocation a where a.waybill_id = w.id)
  ), batches as (
    select a.*, w.waybill_no, w.status, w.create_time, w.departed_at, w.arrived_at, x.signed_at,
      (w.execution_kind = 'merge' or exists (
        select 1 from public.tms_waybill_order_allocation other
        where other.waybill_id = w.id and other.order_id <> p_order.id
      )) as shared_waybill
    from allocations a
    join public.tms_waybill w on w.id = a.waybill_id and w.tenant_id = p_order.tenant_id
    left join public.tms_waybill_execution_record x on x.waybill_id = w.id and x.tenant_id = w.tenant_id
  )
  select tms_shipper_private.order_summary(p_order) || jsonb_build_object(
    'sender', jsonb_build_object('name', p_order.shipping_contact_name, 'phone', p_order.shipping_contact_phone,
      'address', p_order.shipping_address_detail),
    'receiver', jsonb_build_object('name', p_order.receiving_contact_name, 'phone', p_order.receiving_contact_phone,
      'address', p_order.receiving_address_detail),
    'remark', p_order.order_remark, 'signedAt', p_order.signed_at,
    'cargo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(nullif(item->>'cargo_name', ''), nullif(item->>'name', ''), '货物'),
        'quantity', coalesce(nullif(item->'quantity', 'null'::jsonb), '0'::jsonb),
        'weightKg', coalesce(nullif(item->'weight_kg', 'null'::jsonb), '0'::jsonb),
        'volumeM3', coalesce(nullif(item->'volume_m3', 'null'::jsonb), '0'::jsonb),
        'unit', coalesce(nullif(item->>'unit', ''), '件')
      ) order by position)
      from jsonb_array_elements(p_order.cargo_items) with ordinality as cargo(item, position)
    ), '[]'::jsonb),
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'waybillNo', b.waybill_no, 'status', b.status, 'quantity', b.quantity,
        'dispatchedAt', b.create_time, 'departedAt', b.departed_at, 'arrivedAt', b.arrived_at,
        'signedQuantity', case when b.receipt_recorded_at is not null then b.signed_quantity end,
        'exceptionQuantity', case when b.receipt_recorded_at is not null then b.exception_quantity end,
        'receiptAt', case
          when b.status = 'cancelled' then null
          when b.shared_waybill then b.receipt_recorded_at
          when b.status in ('signed', 'completed') then coalesce(b.receipt_recorded_at, b.signed_at, p_order.signed_at)
          else b.receipt_recorded_at
        end,
        'sharedWaybill', b.shared_waybill,
        -- The driver's proof path contains the waybill id. Other proofs and shared-trip images stay out of this projection.
        'receiptPaths', case
          when b.shared_waybill or b.status not in ('signed', 'completed') or p_order.order_status = 'cancelled' then '[]'::jsonb
          else coalesce((
            select jsonb_agg(r.path order by r.uploaded_at desc, r.path)
            from (
              select split_part(p.file_url, '/storage/v1/object/public/attachments/', 2) as path,
                max(p.uploaded_at) as uploaded_at
              from public.tms_waybill_proof p
              where p.tenant_id = p_order.tenant_id and p.waybill_id = b.waybill_id and p.proof_type = 'receipt'
                and p.file_url ~* ('^https?://[^/]+/storage/v1/object/public/attachments/waybill-proofs/'
                  || b.waybill_id::text || '/receipt-[a-z0-9_-]+\.(jpg|jpeg|png|webp)$')
              group by 1
              order by uploaded_at desc, path
              limit 12
            ) r
          ), '[]'::jsonb)
        end
      ) order by b.create_time, b.id)
      from batches b
    ), '[]'::jsonb)
  )
$$;

create function tms_shipper_private.input_text(p_data jsonb, p_field text, p_max integer, p_required boolean default true)
returns text language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_value text := btrim(coalesce(p_data->>p_field, ''));
begin
  if (p_data ? p_field and jsonb_typeof(p_data->p_field) <> 'string')
    or char_length(v_value) > p_max or (p_required and v_value = '') then
    raise exception 'Invalid shipment input' using errcode = '22023';
  end if;
  return v_value;
end
$$;

create function tms_shipper_private.create_order(p_account tms_shipper_private.accounts, p_params jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_request_id text := tms_shipper_private.input_text(p_params, 'requestId', 70);
  v_sender jsonb := p_params->'sender';
  v_receiver jsonb := p_params->'receiver';
  v_line jsonb;
  v_cargo jsonb := '[]'::jsonb;
  v_name text;
  v_quantity numeric;
  v_weight numeric;
  v_volume numeric;
  v_total_quantity numeric := 0;
  v_total_weight numeric := 0;
  v_total_volume numeric := 0;
  v_sender_phone text;
  v_receiver_phone text;
  v_origin public.mdm_station%rowtype;
  v_destination public.mdm_station%rowtype;
  v_order public.tms_order%rowtype;
  v_existing_order_id uuid;
begin
  if v_request_id !~ '^[a-zA-Z0-9-]{8,70}$' then
    raise exception 'Invalid request id' using errcode = '22023';
  end if;

  -- A successful response can be retried without allocating another TMS document number.
  perform pg_advisory_xact_lock(hashtextextended(p_account.auth_user_id::text || ':' || v_request_id, 0));
  select s.order_id into v_existing_order_id from tms_shipper_private.submissions s
  where s.auth_user_id = p_account.auth_user_id and s.request_id = v_request_id;
  if found then
    select o.* into v_order from public.tms_order o
    where o.id = v_existing_order_id and o.tenant_id = p_account.tenant_id and o.shipping_customer_id = p_account.customer_id;
    if not found then raise exception 'Request already processed' using errcode = 'PT409'; end if;
    return jsonb_build_object('id', v_order.id, 'orderNo', v_order.order_no);
  end if;

  if not exists (
    select 1 from public.sys_user u
    where u.id = p_account.order_actor_id and u.tenant_id = p_account.tenant_id
      and u.status = '1' and u.deleted_at is null
  ) then
    raise exception 'Shipper order account is disabled' using errcode = '42501';
  end if;

  select s.* into v_origin from public.mdm_station s
  where s.id = (p_params->>'originStationId')::uuid and s.tenant_id = p_account.tenant_id and s.enabled;
  select s.* into v_destination from public.mdm_station s
  where s.id = (p_params->>'destinationStationId')::uuid and s.tenant_id = p_account.tenant_id and s.enabled;
  if v_origin.id is null or v_destination.id is null then
    raise exception 'Invalid shipment station' using errcode = '22023';
  end if;

  v_sender_phone := tms_shipper_private.input_text(v_sender, 'phone', 24);
  v_receiver_phone := tms_shipper_private.input_text(v_receiver, 'phone', 24);
  if v_sender_phone !~ '^\+?[0-9][0-9() -]{4,22}[0-9]$' or v_receiver_phone !~ '^\+?[0-9][0-9() -]{4,22}[0-9]$' then
    raise exception 'Invalid contact phone' using errcode = '22023';
  end if;
  if jsonb_typeof(p_params->'cargo') is distinct from 'array' then
    raise exception 'Cargo is required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_params->'cargo') not between 1 and 12 then
    raise exception 'Invalid cargo line count' using errcode = '22023';
  end if;
  for v_line in select value from jsonb_array_elements(p_params->'cargo') loop
    v_name := tms_shipper_private.input_text(v_line, 'name', 120);
    if jsonb_typeof(v_line->'quantity') is distinct from 'number'
      or jsonb_typeof(v_line->'weightKg') is distinct from 'number'
      or jsonb_typeof(v_line->'volumeM3') is distinct from 'number' then
      raise exception 'Invalid cargo amounts' using errcode = '22023';
    end if;
    v_quantity := (v_line->>'quantity')::numeric;
    v_weight := (v_line->>'weightKg')::numeric;
    v_volume := (v_line->>'volumeM3')::numeric;
    if v_quantity not between 1 and 1000000 or v_quantity <> trunc(v_quantity)
      or v_weight not between 0 and 10000000 or v_weight <> round(v_weight, 3)
      or v_volume not between 0 and 10000000 or v_volume <> round(v_volume, 3) then
      raise exception 'Invalid cargo amounts' using errcode = '22023';
    end if;
    v_cargo := v_cargo || jsonb_build_array(jsonb_build_object(
      'cargo_name', v_name, 'quantity', v_quantity, 'unit', '件', 'weight_kg', v_weight, 'volume_m3', v_volume
    ));
    v_total_quantity := v_total_quantity + v_quantity;
    v_total_weight := v_total_weight + v_weight;
    v_total_volume := v_total_volume + v_volume;
  end loop;

  if not exists (
    select 1 from public.sys_document_number_rule r
    where r.tenant_id = p_account.tenant_id and r.rule_key = 'tms.order' and r.enabled and r.auto_enabled
  ) then
    raise exception 'Automatic order numbering is disabled' using errcode = 'PT422';
  end if;

  insert into public.tms_order (
    order_no, tenant_id, shipping_customer_id, created_by_user_id, create_by,
    order_status, origin_station, origin_station_id, destination_station, destination_station_id,
    shipping_contact_name, shipping_contact_phone, shipping_address_detail,
    receiving_contact_name, receiving_contact_phone, receiving_address_detail,
    cargo_items, cargo_quantity_total, cargo_weight_total, cargo_volume_total,
    transport_mode, delivery_method, payment_method, order_remark
  ) values (
    '', p_account.tenant_id, p_account.customer_id, p_account.order_actor_id, '货主端 · ' || p_account.display_name,
    'pending_load', v_origin.station_name, v_origin.id, v_destination.station_name, v_destination.id,
    tms_shipper_private.input_text(v_sender, 'name', 60), v_sender_phone, tms_shipper_private.input_text(v_sender, 'address', 240),
    tms_shipper_private.input_text(v_receiver, 'name', 60), v_receiver_phone, tms_shipper_private.input_text(v_receiver, 'address', 240),
    v_cargo, v_total_quantity, v_total_weight, v_total_volume,
    'road', 'door', 'collect', nullif(tms_shipper_private.input_text(p_params, 'remark', 500, false), '')
  ) returning * into v_order;
  insert into tms_shipper_private.submissions (auth_user_id, request_id, order_id)
  values (p_account.auth_user_id, v_request_id, v_order.id);

  return jsonb_build_object('id', v_order.id, 'orderNo', v_order.order_no);
end
$$;

create function tms_shipper_private.manage_saved_item(
  p_account tms_shipper_private.accounts, p_action text, p_params jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_params->>'id')::uuid;
  v_kind text := coalesce(p_params->>'kind', '');
  v_title text;
  v_contact jsonb;
begin
  if v_kind not in ('cargo', 'address') then raise exception 'Invalid saved item kind' using errcode = '22023'; end if;
  if p_action = 'saved_items' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'contact', i.contact) order by i.updated_at desc, i.id)
      from tms_shipper_private.saved_items i
      where i.auth_user_id = p_account.auth_user_id and i.tenant_id = p_account.tenant_id
        and i.customer_id = p_account.customer_id and i.kind = v_kind
    ), '[]'::jsonb);
  end if;

  if p_action = 'delete_item' then
    delete from tms_shipper_private.saved_items i
    where i.id = v_id and i.auth_user_id = p_account.auth_user_id and i.tenant_id = p_account.tenant_id
      and i.customer_id = p_account.customer_id and i.kind = v_kind;
    if not found then raise exception 'Saved item unavailable' using errcode = 'PT404'; end if;
    return 'true'::jsonb;
  end if;

  v_title := tms_shipper_private.input_text(p_params, 'title', 120);
  if v_kind = 'address' then
    v_contact := jsonb_build_object(
      'name', tms_shipper_private.input_text(p_params->'contact', 'name', 60),
      'phone', tms_shipper_private.input_text(p_params->'contact', 'phone', 24),
      'address', tms_shipper_private.input_text(p_params->'contact', 'address', 240)
    );
    if v_contact->>'phone' !~ '^\+?[0-9][0-9() -]{4,22}[0-9]$' then
      raise exception 'Invalid contact phone' using errcode = '22023';
    end if;
  end if;
  if v_id is null then
    insert into tms_shipper_private.saved_items (auth_user_id, tenant_id, customer_id, kind, title, contact)
      values (p_account.auth_user_id, p_account.tenant_id, p_account.customer_id, v_kind, v_title, v_contact)
      returning id into v_id;
  else
    update tms_shipper_private.saved_items i set title = v_title, contact = v_contact, updated_at = now()
    where i.id = v_id and i.auth_user_id = p_account.auth_user_id and i.tenant_id = p_account.tenant_id
      and i.customer_id = p_account.customer_id and i.kind = v_kind;
    if not found then raise exception 'Saved item unavailable' using errcode = 'PT404'; end if;
  end if;
  return jsonb_build_object('id', v_id, 'title', v_title, 'contact', v_contact);
end
$$;

-- The calling Edge Function validates the JWT with Auth and supplies its user id.
create function public.tms_shipper_mobile(p_auth_user_id uuid, p_action text, p_params jsonb default '{}'::jsonb)
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
  when 'statements' then
    return coalesce((
      select jsonb_agg(r.statement order by r.period_end desc, r.id desc) from (
        select s.id, s.period_end, jsonb_build_object(
          'id', s.id, 'number', s.statement_no, 'periodStart', s.period_start, 'periodEnd', s.period_end,
          'amount', s.statement_amount, 'settled', s.settled_amount
        ) as statement
        from public.tms_customer_statement_summary s
        where s.tenant_id = v_account.tenant_id and s.customer_id = v_account.customer_id and s.status = 'confirmed'
        order by s.period_end desc, s.id desc limit 50
      ) r
    ), '[]'::jsonb);
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

revoke execute on all functions in schema tms_shipper_private from public, anon, authenticated;
grant execute on all functions in schema tms_shipper_private to service_role;
revoke execute on function public.tms_shipper_mobile(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.tms_shipper_mobile(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
