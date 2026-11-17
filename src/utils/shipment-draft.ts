import type { ShipmentContact } from '@/api/types'

export interface ShipmentFormCargo {
  id: number
  name: string
  quantity: string
  weightKg: string
  volumeM3: string
}

interface ShipmentFormDraft {
  requestId: string
  stationIds: Record<'sender' | 'receiver', string>
  contacts: Record<'sender' | 'receiver', ShipmentContact>
  cargo: ShipmentFormCargo[]
  remark: string
  remarkOpen: boolean
}

// A browser Back can unmount a Uni H5 page before its guards run. Keep contact data in tab memory.
let saved: { owner: string; draft: ShipmentFormDraft } | undefined

export function rememberShipmentDraft(owner: string, draft: ShipmentFormDraft) {
  saved = { owner, draft }
}

export function takeShipmentDraft(owner: string) {
  const draft = saved?.owner === owner ? saved.draft : undefined
  clearShipmentDraft()
  return draft
}

export function clearShipmentDraft(requestId?: string) {
  if (!requestId || saved?.draft.requestId === requestId) saved = undefined
}
