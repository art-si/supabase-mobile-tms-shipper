<script setup lang="ts">
import MobileBottomNav from '@mobile-core/components/MobileBottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { openShipmentForm } from '@/utils/orders'
import { openWorkspace } from '@/utils/workspace'

type NavKey = 'home' | 'order' | 'message' | 'mine'
defineProps<{ active: NavKey }>()
const auth = useAuthStore()

const items = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/home/index' },
  { key: 'order', label: '运单', icon: 'waybill', url: '/pages/order/index' },
  { key: 'shipment', label: '发货', icon: 'add', action: true },
  { key: 'message', label: '消息', icon: 'message', url: '/pages/message/index' },
  { key: 'mine', label: '我的', icon: 'user', url: '/pages/mine/index' }
]

function startShipment() {
  if (auth.staff) openWorkspace('open')
  else openShipmentForm()
}
</script>

<template>
  <MobileBottomNav :active="active" :items="items" @action="startShipment" />
</template>
