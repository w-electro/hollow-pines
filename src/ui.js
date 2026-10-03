// Everything drawn over the 3D view.
import * as THREE from 'three'
import { ITEM_INFO } from './items.js'

const $ = (id) => document.getElementById(id)

export function makeUI(camera) {
  const ui = {}
  const tmp = new THREE.Vector3()

  ui.show = (id, on = true) => $(id).classList.toggle('hidden', !on)
  ui.loading = (frac) => { $('loadbar').style.width = Math.round(frac * 100) + '%' }
  ui.loadError = (msg) => { $('loaderr').textContent = msg }

  ui.vitals = (p, fire) => {
    $('hpbar').style.width = p.hp + '%'
    $('batbar').style.width = p.battery + '%'
    $('stbar').style.width = p.stamina + '%'
    $('firebar').style.width = Math.round(fire.fuel * 100) + '%'
    $('hurt').style.opacity = Math.max(p.hurtFlash, p.hp < 30 ? 0.35 + Math.sin(performance.now() / 300) * 0.1 : 0)
  }

  ui.quest = (step, progress, sides) => {
    $('q-title').textContent = step.title
    $('q-detail').textContent = step.detail + (step.need ? ` (${progress}/${step.need})` : '') + (step.timer ? '' : '')
    $('q-side').innerHTML = sides.map((s) => `<div>${s}</div>`).join('')
  }
  ui.timer = (secs) => { if (secs > 0) $('q-detail').textContent = `Survive until Silas reaches the fire: ${Math.ceil(secs)}s` }

  let lastInv = ''
  ui.hotbar = (inv) => {
    const order = ['log', 'battery', 'bandage', 'fuse', 'key', 'page']
    const key = order.map((k) => inv[k]).join(',')
    if (key === lastInv) return
    const before = lastInv.split(',').map(Number)
    lastInv = key
    $('hotbar').innerHTML = order.filter((k) => inv[k] > 0 || k === 'bandage').map((k, i) => {
      const changed = before[order.indexOf(k)] !== inv[k]
      return `<div class="slot${changed ? ' pop' : ''}" title="${ITEM_INFO[k].name}">${k === 'bandage' ? '<i>1</i>' : ''}${ITEM_INFO[k].icon}<b>${inv[k]}</b></div>`
    }).join('')
  }

  ui.toast = (text, kind = '') => {
    const t = document.createElement('div')
    t.className = 'toast ' + kind
    t.textContent = text
    $('toasts').append(t)
    setTimeout(() => t.remove(), 3500)
  }

  let lastPrompt = null
  ui.prompt = (text) => {
    if (text === lastPrompt) return
    lastPrompt = text
    $('prompt').classList.toggle('hidden', !text)
    if (text) $('prompt').innerHTML = text
  }

  // an arrow at the screen edge pointing to the objective, when it is off-screen
  ui.waypoint = (world) => {
    const w = $('waypoint')
    if (!world) { w.classList.add('hidden'); return }
    tmp.copy(world).setY(1.5).project(camera)
    const behind = tmp.z > 1
    let x = tmp.x, y = tmp.y
    if (behind) { x = -x; y = -y }
    const onScreen = !behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85
    w.classList.remove('hidden')
    if (onScreen) {
      w.style.left = ((x + 1) / 2) * innerWidth + 'px'
      w.style.top = ((1 - y) / 2) * innerHeight - 24 + 'px'
      w.style.transform = 'translate(-50%, -50%) rotate(180deg)'
      w.style.opacity = 0.75
    } else {
      const a = Math.atan2(y, x)
      const ex = Math.cos(a), ey = Math.sin(a)
      const k = Math.min(0.9 / Math.abs(ex || 1e-6), 0.85 / Math.abs(ey || 1e-6))
      w.style.left = ((ex * k + 1) / 2) * innerWidth + 'px'
      w.style.top = ((1 - ey * k) / 2) * innerHeight + 'px'
      w.style.transform = `translate(-50%, -50%) rotate(${-a + Math.PI / 2}rad)`
      w.style.opacity = 1
    }
  }

  /* speech bubbles over heads */
  const bubbleEls = new Map()
  ui.bubbles = (npcs, playerPos) => {
    for (const n of npcs) {
      let el = bubbleEls.get(n)
      if (!el) {
        el = document.createElement('div')
        el.className = 'bubble ' + n.id
        el.innerHTML = `<b>${n.name.toUpperCase()}</b><span></span>`
        $('bubbles').append(el)
        bubbleEls.set(n, el)
      }
      const b = n.bubble
      const active = (b.text || b.thinking) && performance.now() < b.until
      const d = n.mesh.position.distanceTo(playerPos)
      tmp.copy(n.mesh.position).setY(n.mesh.position.y + 3.0 * n.mesh.scale.y).project(camera)
      const show = active && d < 16 && tmp.z < 1
      el.style.display = show ? 'block' : 'none'
      if (!show) continue
      el.classList.toggle('thinking', b.thinking && !b.text)
      el.querySelector('span').textContent = b.text
      el.style.left = ((tmp.x + 1) / 2) * innerWidth + 'px'
      el.style.top = ((1 - tmp.y) / 2) * innerHeight + 'px'
    }
    // two characters talking side by side: stack their bubbles instead of overlapping them
    const shown = [...bubbleEls.values()].filter((e) => e.style.display === 'block')
    if (shown.length > 1) {
      const rects = shown.map((e) => ({ e, r: e.getBoundingClientRect() })).sort((a, b) => b.r.bottom - a.r.bottom)
      for (let i = 1; i < rects.length; i++) {
        const lower = rects[i - 1].r, cur = rects[i].r
        const overlapX = cur.left < lower.right && cur.right > lower.left
        if (overlapX && cur.bottom > lower.top - 6) {
          const shift = cur.bottom - lower.top + 6
          rects[i].e.style.top = parseFloat(rects[i].e.style.top) - shift + 'px'
          rects[i].r = rects[i].e.getBoundingClientRect()
        }
      }
    }
  }

  ui.page = (title, text) => { $('page-title').textContent = title; $('page-text').textContent = text; ui.show('page') }

  ui.talk = (npc) => {
    ui.show('talk', !!npc)
    if (npc) { $('talk-to').textContent = 'TALKING TO ' + npc.name.toUpperCase(); $('say').value = ''; setTimeout(() => $('say').focus(), 0) } else $('say').blur()
  }
  ui.talkBusy = (busy, name) => {
    $('say').disabled = busy
    $('send').disabled = busy
    $('say').placeholder = busy ? `${name} is answering…` : 'Say something…'
    if (!busy) $('say').focus()
  }
  return ui
}
