import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const origin = process.env.TMS_SMOKE_URL || 'http://127.0.0.1:5186/'
const browser = await chromium.launch({ channel: process.env.TMS_SMOKE_BROWSER || 'chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

const text = (value) => page.getByText(value, { exact: true })
const button = (value) => page.getByRole('button', { name: value, exact: true })
const tab = (value) => page.getByRole('link', { name: value, exact: true })
const fieldSelector = (id) => `#${id} input, #${id} textarea`
const field = (id) => page.locator(fieldSelector(id))

async function waitForFieldValue(id, value) {
  await page.waitForFunction(
    ({ selector, value }) => document.querySelector(selector)?.value === value,
    { selector: fieldSelector(id), value },
  )
}

async function noOverflow() {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions))
}

try {
  await mkdir('artifacts', { recursive: true })
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('form', { name: '货主端账号登录' }).waitFor()
  await page.screenshot({ path: 'artifacts/shipper-login.png' })
  await page.getByText('进入演示', { exact: false }).click()
  await text('订单概览').waitFor()
  await noOverflow()
  await page.screenshot({ path: 'artifacts/shipper-home.png' })

  await tab('运单').click()
  await button('合单').click()
  await text('勾选允许合单的多张运输单，再点「合单配载」。').waitFor()
  assert.match(await page.getByRole('link', { name: /打开 Web TMS/ }).getAttribute('href'), /#\/tms\/waybill-management\/pending$/)
  await button('返回上一页').click()
  await button('履约中').click()
  await text('部分签收').waitFor()
  await page.locator('.order-search input').fill('没有这张订单')
  await button('搜索').click()
  await text('没有符合条件的订单').waitFor()
  await button('清除搜索').click()
  await text('部分签收').waitFor()

  await tab('消息').click()
  await text('运输动态 · 部分签收').waitFor()
  await text('运输动态 · 部分签收').click()
  await text('运输批次与回单').waitFor()
  await text('2 个批次').waitFor()
  const receipt = page.getByRole('button', { name: '查看回单 1' }).first()
  await receipt.scrollIntoViewIfNeeded()
  const imageSource = await receipt.locator('uni-image img').getAttribute('src')
  assert.match(imageSource, /receipt\.png$/)
  assert.ok((await page.request.get(new URL(imageSource, origin).href)).ok())
  await receipt.click()
  const preview = page.locator('#u-a-p > div').first()
  await preview.waitFor()
  await page.screenshot({ path: 'artifacts/shipper-receipt.png' })
  await preview.click({ position: { x: 355, y: 20 } })
  await button('返回上一页').click()
  assert.equal(await page.locator('.message-row').filter({ hasText: '部分签收' }).getByText('未读', { exact: true }).count(), 0)

  await tab('我的').click()
  await text('基础数据').waitFor()
  for (const title of ['常用货物', '地址', '司机管理', '线路管理', '车辆管理', '挂车管理', '客户对账', '承运商对账', '司机对账', '运单费用']) {
    await button(title).waitFor()
  }
  await page.screenshot({ path: 'artifacts/shipper-mine.png', fullPage: true })
  await button('司机对账').click()
  await button('演示司机').click()
  await text('¥85.50').waitFor()
  await button('报销').click()
  await text('该司机暂无此类费用记录。').waitFor()
  await button('返回上一页').click()
  await button('客户对账').click()
  await text('DZ-DEMO-001').click()
  await text('对账明细').waitFor()
  await button('返回上一页').click()
  await button('常用货物').click()
  await page.getByText('新增货物', { exact: false }).click()
  await field('saved-title').fill('测试家电配件')
  await text('保存').click()
  await text('测试家电配件').waitFor()
  await button('编辑 测试家电配件').click()
  await field('saved-title').fill('测试托盘')
  await text('保存').click()
  await text('测试托盘').waitFor()
  await button('返回上一页').click()

  await button('发货').click()
  await text('发货信息').waitFor()
  await text('提交发货委托').click()
  await text('请选择发货站点。').waitFor()
  await page.locator('#sender-station').selectOption({ label: '杭州临平站' })
  await page.locator('#receiver-station').selectOption({ label: '宁波北仑站' })
  const senderAddress = page.getByRole('combobox', { name: '发货使用常用地址' })
  await senderAddress.selectOption({ label: '临平发货仓' })
  await waitForFieldValue('sender-name', '陈经理')
  await waitForFieldValue('sender-phone', '18000000001')
  await waitForFieldValue('sender-address', '临平区示例产业园 1 号仓')
  await field('sender-name').fill('测试发货处')
  await senderAddress.selectOption({ label: '临平发货仓' })
  await waitForFieldValue('sender-name', '陈经理')
  await field('receiver-name').fill('测试收货处')
  await field('receiver-phone').fill('18000000003')
  await field('receiver-address').fill('测试物流园 3 号卸货口')
  await page.getByRole('combobox', { name: '选用常用货物' }).selectOption({ label: '测试托盘' })
  await waitForFieldValue('cargo-1-name', '测试托盘')
  await field('cargo-1-quantity').fill('10')
  await field('cargo-1-weightKg').fill('121.25')
  await text('提交发货委托').click()
  await text('发货委托已提交，服务商将安排运输。').waitFor()
  await text('测试托盘').waitFor()
  await page.screenshot({ path: 'artifacts/shipper-created.png', fullPage: true })

  await page.setViewportSize({ width: 320, height: 720 })
  await noOverflow()
  await button('返回上一页').focus()
  await page.keyboard.press('Enter')
  await text('基础数据').waitFor()
  await noOverflow()
  await page.screenshot({ path: 'artifacts/shipper-mine-320.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS H5 demo: navigation, dispatch link, order search, receipt, message read, saved cargo, customer statement, and shipment submission.')
} finally {
  await browser.close()
}
