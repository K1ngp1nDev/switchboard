// Captures docs/screenshots for SWITCHBOARD.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.SB_BASE ?? 'http://localhost:4174'
const OUT = fileURLToPath(new URL('../../docs/screenshots', import.meta.url))
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--hide-scrollbars'] })

async function shot(name, { viewport, dsf, url, prep }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf })
  const page = await ctx.newPage()
  await page.goto(BASE + url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (prep) await prep(page)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`captured ${name}.png (${viewport.width * dsf}x${viewport.height * dsf})`)
  await ctx.close()
}

const desktop = { width: 1600, height: 1000 }

// 1 — hero: finished refund run, full chrome, warm graph
await shot('switchboard-hero', {
  viewport: desktop,
  dsf: 2,
  url: '/?run=r-4821',
  prep: (page) => page.waitForTimeout(1500),
})

// 2 — canvas active: streaming node + packets frozen mid-flight
await shot('switchboard-canvas-active', {
  viewport: desktop,
  dsf: 2,
  url: '/?run=r-4821',
  prep: async (page) => {
    await page.evaluate(() => {
      const s = window.__switchboard.store.getState()
      const run = s.runs.find((r) => r.id === s.selectedRunId)
      // seek into the flow window right before the refund reasoner starts
      const flow = run.events.filter((e) => e.kind === 'edge.flow')[4]
      s.seek(flow ? flow.t + flow.ms * 0.55 : 6000)
    })
    await page.waitForTimeout(700)
    // nudge one frame so packet transitions settle
    await page.evaluate(() => {
      const s = window.__switchboard.store.getState()
      s.seek(window.__switchboard.playhead.t + 30)
    })
    await page.waitForTimeout(500)
  },
})

// 3 — approval modal with state diff
await shot('switchboard-approval', {
  viewport: desktop,
  dsf: 2,
  url: '/?run=r-4855&modal=1',
  prep: (page) => page.waitForTimeout(1200),
})

// 4 — trace waterfall on the incident scenario (retry chip + gate span)
await shot('switchboard-trace', {
  viewport: desktop,
  dsf: 2,
  url: '/?run=i-2607',
  prep: (page) => page.waitForTimeout(1200),
})

// 5 — replay: mid-run, lanes expanded, playhead visible
await shot('switchboard-replay', {
  viewport: desktop,
  dsf: 2,
  url: '/?run=l-7284&play=1',
  prep: async (page) => {
    await page.evaluate(() => {
      const s = window.__switchboard.store.getState()
      s.setSpeed(2)
      s.seek(s.runs.find((r) => r.id === 'l-7284').duration * 0.42)
    })
    await page.waitForTimeout(1400)
  },
})

// 6 — mobile: executions sheet open over the canvas
await shot('switchboard-mobile', {
  viewport: { width: 390, height: 844 },
  dsf: 3,
  url: '/?run=r-4821&t=8000',
  prep: async (page) => {
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Toggle runs panel' }).click()
    await page.waitForTimeout(600)
  },
})

// bonus — light theme hero
await shot('switchboard-light', {
  viewport: desktop,
  dsf: 2,
  url: '/?run=r-4821&theme=light',
  prep: (page) => page.waitForTimeout(1500),
})

await browser.close()
console.log('done')
