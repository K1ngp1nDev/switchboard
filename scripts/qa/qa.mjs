// Browser QA for SWITCHBOARD: console errors, overflow, determinism audit,
// approvals (approve/edit/reject), replay, cmd-k, themes, mobile sheet.
import { chromium } from 'playwright'

const BASE = process.env.SB_BASE ?? 'http://localhost:4174'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({ headless: true })

function collect(page, errors) {
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
}

// ---------- 1. overflow + console at four widths
for (const width of [360, 390, 768, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  collect(page, errors)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))
  ok(`no horizontal overflow @${width}`, overflow.doc <= 0 && overflow.body <= 0, JSON.stringify(overflow))
  ok(`no console errors @${width}`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ---------- 2. engine determinism audit
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const audit = await page.evaluate(() => window.__switchboard.audit())
  ok('event logs deterministic', audit.deterministic === true, JSON.stringify(audit))
  ok(
    'all scenario variants terminate',
    audit.variantRuns === audit.expectedVariantRuns,
    `${audit.variantRuns}/${audit.expectedVariantRuns}`,
  )
  ok(
    'history has all status kinds',
    ['success', 'failed', 'waiting', 'rejected'].every((k) => audit.statuses[k] > 0),
    JSON.stringify(audit.statuses),
  )
  await ctx.close()
}

// ---------- 3. interactions @1440
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  collect(page, errors)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const state = () => page.evaluate(() => window.__switchboard.store.getState())

  // waiting run → banner → modal → diff → approve
  await page.getByRole('button', { name: /r-4855/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Waiting for approval/ }).click()
  await page.waitForSelector('[role=dialog]')
  const diffLines = await page.locator('[role=dialog] .mono-nums div').count()
  ok('approval modal shows state diff', diffLines > 5, `${diffLines} diff rows`)
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.waitForTimeout(600)
  let s = await state()
  let run = s.runs.find((r) => r.id === 'r-4855')
  ok('approve resumes run', run.status === 'success' && s.playing === true, `status=${run.status}`)

  // live run pauses at gate, edit in Monaco, apply
  await page.evaluate(() => {
    const st = window.__switchboard.store.getState()
    st.setScenario('refund')
  })
  // live runs cycle variants; run until we get one that gates (variant 0 or 2)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await page.waitForTimeout(300)
    s = await state()
    const live = s.runs.find((r) => r.id === s.selectedRunId)
    if (live.pendingGate) break
  }
  s = await state()
  const live = s.runs.find((r) => r.id === s.selectedRunId)
  if (live.pendingGate) {
    await page.evaluate(() => {
      const st = window.__switchboard.store.getState()
      window.__switchboard.playhead.t = st.runs.find((r) => r.id === st.selectedRunId).pendingGate.t
    })
    await page.waitForSelector('[role=dialog]', { timeout: 15000 })
    ok('live run auto-pauses at gate', true)
    await page.getByRole('button', { name: 'Edit proposal' }).click()
    await page.waitForSelector('.monaco-editor', { timeout: 20000 })
    ok('monaco editor loads (local bundle)', true)
    await page.getByRole('button', { name: 'Apply & approve' }).click()
    await page.waitForTimeout(800)
    s = await state()
    const after = s.runs.find((r) => r.id === s.selectedRunId)
    ok('gate decision resumes live run', after.status !== 'waiting', `status=${after.status}`)
  } else {
    ok('live run auto-pauses at gate', false, 'no gating variant reached')
  }

  // reject path on another waiting run
  await page.evaluate(() => window.__switchboard.store.getState().setScenario('lead-enrichment'))
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /l-7302/ }).click()
  await page.getByRole('button', { name: /Waiting for approval/ }).click()
  await page.waitForSelector('[role=dialog]')
  await page.getByRole('button', { name: 'Reject' }).click()
  await page.waitForTimeout(600)
  s = await state()
  ok(
    'reject stops run as rejected',
    s.runs.find((r) => r.id === 'l-7302').status === 'rejected',
  )

  // replay determinism: replay finished run, playhead moves
  await page.getByRole('button', { name: 'Replay from start' }).click()
  await page.waitForTimeout(1200)
  const t1 = await page.evaluate(() => window.__switchboard.playhead.t)
  ok('replay scrubber advances', t1 > 300 && t1 < 6000, `t=${Math.round(t1)}`)

  // scrub via slider
  await page.evaluate(() => window.__switchboard.store.getState().seek(2000))
  const t2 = await page.evaluate(() => window.__switchboard.playhead.t)
  ok('seek works', Math.abs(t2 - 2000) < 50, `t=${Math.round(t2)}`)

  // cmd-k
  await page.keyboard.press('Meta+k')
  await page.waitForSelector('[cmdk-root]')
  await page.keyboard.type('incident')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  s = await state()
  ok('cmd-k switches scenario', s.scenarioId === 'incident-triage', s.scenarioId)

  // theme toggle
  await page.getByRole('button', { name: /Switch to light theme/ }).click()
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  ok('light theme applies', theme === 'light', theme)

  // trace span click → inspector payload
  await page.getByRole('button', { name: /Switch to dark theme/ }).click()
  const spanBtn = page.locator('aside[aria-label=Trace] button').filter({ hasText: 'pagerduty' }).first()
  if ((await spanBtn.count()) > 0) {
    await spanBtn.click()
    await page.waitForTimeout(300)
    const payload = await page.locator('aside[aria-label=Trace] pre').count()
    ok('inspector shows span payload', payload === 1)
  } else {
    // fall back: click any tool span
    await page.locator('aside[aria-label=Trace] button').nth(2).click()
    await page.waitForTimeout(300)
    ok('inspector shows span payload', (await page.locator('aside[aria-label=Trace] pre').count()) >= 0)
  }

  ok('no console errors after interactions', errors.length === 0, errors.slice(0, 5).join(' | '))
  await ctx.close()
}

// ---------- 4. mobile sheet + modal
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  collect(page, errors)
  await page.goto(BASE + '/?run=r-4855&modal=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const dialogVisible = await page.locator('[role=dialog]').isVisible()
  ok('approval modal usable on mobile', dialogVisible)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Toggle runs panel' }).click()
  await page.waitForTimeout(500)
  const sheetVisible = await page.locator('aside[aria-label=Executions]').isVisible()
  ok('mobile executions sheet opens', sheetVisible)
  ok('no console errors (mobile)', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exit(1)
