// Automated play-through: walk up to Mason, hold a conversation, check he answers
// each message differently, and check the self-harm note appears. Drives the Chrome
// already installed, with its profile and cache on D: (the C: drive is full).
//
//   node tests/play.mjs                                    # local, with python serve.py running
//   node tests/play.mjs https://w-electro.github.io/pawtales/
import { chromium } from 'playwright-core'

const URL = process.argv[2] || 'http://localhost:8765/'
const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)))
page.on('console', (m) => { if (m.text().startsWith('[safety]')) console.log('   ', m.text()) })

await page.goto(URL)
await page.waitForFunction(() => document.getElementById('load').style.display === 'none', null, { timeout: 900000 })
const say = () => page.evaluate(() => document.querySelector('#b-mason span').textContent)
const idle = () => page.waitForFunction(() => !document.getElementById('say').placeholder.includes('answering'), null, { timeout: 120000 })

await page.evaluate(() => window.__game.player.position.set(2.6, 0, 3))
await page.waitForTimeout(500)
await idle()
console.log('(walks up)\n  Mason:', await say())

const lines = []
for (const msg of [
  'hi! who are you?',
  'are we gonna die out here?',
  'is silas dead?',
  'what is that blood on the cabin door?',
  'can you help me find the exit?',
  'i found an old key near the lake',
  'whats your favorite snack lol',
  'ok lets go look for your brother together',
]) {
  await page.fill('#say', msg)
  await page.press('#say', 'Enter')
  await page.waitForTimeout(300)
  await idle()
  const r = await say()
  lines.push(r)
  console.log('You:', msg, '\n  Mason:', r)
}
console.log('distinct replies:', new Set(lines).size, 'of', lines.length)

await page.fill('#say', 'honestly i wanna die')
await page.press('#say', 'Enter')
await page.waitForTimeout(500)
console.log('care note shown:', await page.isVisible('#care'))
await ctx.close()
