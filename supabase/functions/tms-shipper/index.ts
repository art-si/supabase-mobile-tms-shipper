const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8'
}

const actions = new Set([
  'profile', 'dashboard', 'list', 'detail', 'stations', 'create',
  'messages', 'read_message', 'saved_items', 'save_item', 'delete_item', 'statements', 'statements_page', 'statement_detail'
])
const errors: Record<string, [number, string]> = {
  42501: [403, 'SHIPPER_NOT_BOUND'],
  P0002: [404, 'SHIPPER_ORDER_NOT_FOUND'],
  PT404: [404, 'SHIPPER_RECORD_NOT_FOUND'],
  22023: [400, 'SHIPPER_ORDER_INPUT'],
  '22P02': [400, 'SHIPPER_ORDER_INPUT'],
  '22007': [400, 'SHIPPER_ORDER_INPUT'],
  PT409: [409, 'SHIPPER_REQUEST_USED'],
  PT422: [422, 'SHIPPER_NUMBER_RULE']
}

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply({ code: 'METHOD_NOT_ALLOWED' }, 405)
  const bearer = request.headers.get('Authorization')
  if (!bearer || !/^Bearer [^\s]+$/.test(bearer)) return reply({ code: 'UNAUTHORIZED' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publicKey || !serviceKey) return reply({ code: 'SHIPPER_UNAVAILABLE' }, 503)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return reply({ code: 'SHIPPER_ORDER_INPUT' }, 400)
  }
  if (!input || typeof input !== 'object' || !('action' in input) ||
      typeof input.action !== 'string' || !actions.has(input.action)) {
    return reply({ code: 'SHIPPER_ORDER_INPUT' }, 400)
  }
  const params = 'params' in input ? input.params : {}
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return reply({ code: 'SHIPPER_ORDER_INPUT' }, 400)
  }

  try {
    const auth = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: bearer }
    })
    if (auth.status === 401 || auth.status === 403) return reply({ code: 'UNAUTHORIZED' }, 401)
    if (!auth.ok) return reply({ code: 'SHIPPER_UNAVAILABLE' }, 503)
    const identity: unknown = await auth.json()
    if (!identity || typeof identity !== 'object' || !('id' in identity) ||
        typeof identity.id !== 'string' || !/^[a-f\d-]{36}$/i.test(identity.id) ||
        ('is_anonymous' in identity && identity.is_anonymous === true)) {
      return reply({ code: 'UNAUTHORIZED' }, 401)
    }

    const result = await fetch(`${url}/rest/v1/rpc/tms_shipper_mobile`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_auth_user_id: identity.id, p_action: input.action, p_params: params })
    })
    const data = await result.json()
    if (result.ok) return reply(data)
    const failure = typeof data?.code === 'string' && Object.hasOwn(errors, data.code) ? errors[data.code] : undefined
    if (failure) return reply({ code: failure[1] }, failure[0])
    console.error('tms_shipper_mobile', input.action, result.status, data?.code)
  } catch (error) {
    console.error('tms_shipper_mobile connection failed', error instanceof Error ? error.name : 'unknown')
  }
  return reply({ code: 'SHIPPER_UNAVAILABLE' }, 503)
})
