// Open a dev page in the installed Chrome (profile and cache on D:), wait for window.__done,
// print it and any errors, and save a screenshot.
//   node tests/check.mjs tests/voice-check.html [shot.png] [timeoutSeconds]
import { chromium } from 'playwright-core'

const [rawPath = '', shot, secs = '300'] = process.argv.slice(2)
// pass paths without a leading slash: Git Bash rewrites /x into C:/Program Files/Git/x
const path = '/' + rawPath.replace(/^\/+/, '')
const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache', '--autoplay-policy=no-user-gesture-required'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)))
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/powerPreference|404/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 300)) })
await page.goto('http://localhost:8765' + path)
try {
  const done = await page.waitForFunction(() => window.__done, null, { timeout: Number(secs) * 1000 })
  console.log(JSON.stringify(await done.jsonValue(), null, 1))
} catch (e) {
  console.log('timed out; page says:', (await page.textContent('body')).slice(0, 500))
}
if (shot) await page.screenshot({ path: shot })
await ctx.close()
