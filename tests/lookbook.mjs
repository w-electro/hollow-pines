// Close-up screenshots of every character, for judging how they look.
//   node tests/lookbook.mjs     (python serve.py running) → SHOTS/look-*.png
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const SHOTS = process.env.SHOTS || 'D:/W/_scratch/shots'
fs.mkdirSync(SHOTS, { recursive: true })
const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(process.argv[2] || 'http://localhost:8765/')
await page.waitForFunction(() => window.__game?.state() === 'title', null, { timeout: 900000 })
await page.click('#start')
await page.waitForTimeout(800)
const G = (fn, a) => page.evaluate(fn, a)
await G(() => { const g = window.__game; g.player.damage = () => {}; g.player.dist = 5; g.player.pitch = 0.25 })

// Mason by the fire, the player facing him
await G(() => { const g = window.__game; g.teleport(2.4, 4.6); g.player.avatar.rotation.y = Math.PI; g.player.yaw = Math.PI + 0.6 })
await page.waitForTimeout(1500)
await page.screenshot({ path: SHOTS + '/look-mason.png' })

// Silas, brought into the open next to a lamp
await G(() => { const g = window.__game; const s = g.npcs.silas.mesh; s.position.set(6, 0, -3.5); g.teleport(6, 1); g.player.avatar.rotation.y = Math.PI; g.player.yaw = Math.PI + 0.5 })
await page.waitForTimeout(1500)
await page.screenshot({ path: SHOTS + '/look-silas.png' })

// a shade in the flashlight
await G(() => { const g = window.__game; g.teleport(-20, 18); g.player.avatar.rotation.y = 0; g.player.yaw = 0; g.shades.spawnNear(1); const s = g.shades.list.at(-1); s.mesh.position.set(-20, 0, 22.5); s.grow = 1 })
await page.waitForTimeout(700)
await page.screenshot({ path: SHOTS + '/look-shade.png' })

// the player from the front
await G(() => { const g = window.__game; g.teleport(0, 6); g.player.avatar.rotation.y = 0; g.player.yaw = Math.PI; g.player.dist = 4.5 })
await page.waitForTimeout(1200)
await page.screenshot({ path: SHOTS + '/look-player.png' })
await ctx.close()
