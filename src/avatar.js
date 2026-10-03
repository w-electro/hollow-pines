// Blocky, Roblox-style characters: a box head with a drawn face, a box torso, and
// four limbs that swing from the shoulders and hips when they walk.
import * as THREE from 'three'

const mats = new Map()
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra)
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }))
  return mats.get(key)
}

/* ── faces, drawn on a canvas like a Roblox decal ───────────────────── */
function faceTexture(kind, skin) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#' + skin.toString(16).padStart(6, '0')
  g.fillRect(0, 0, 128, 128)
  g.lineCap = 'round'
  if (kind === 'mask') {
    // a cracked, stained mask with deep eye holes
    g.fillStyle = '#e6e0d0'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#0a0a0a'
    for (const x of [40, 88]) { g.beginPath(); g.ellipse(x, 56, 12, 9, 0, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#b9b2a0'
    for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(30 + (i % 6) * 14, 86 + Math.floor(i / 6) * 10, 2.4, 0, Math.PI * 2); g.fill() }
    g.strokeStyle = '#8f8a7c'
    g.lineWidth = 2
    g.beginPath(); g.moveTo(64, 0); g.lineTo(60, 30); g.lineTo(68, 48); g.stroke()
    g.fillStyle = 'rgba(110, 10, 10, .75)'
    g.beginPath(); g.ellipse(96, 100, 14, 8, 0.4, 0, Math.PI * 2); g.fill()
    g.fillRect(92, 100, 4, 22)
  } else {
    g.fillStyle = '#111'
    const eyes = kind === 'scared' ? [[44, 54, 7, 9], [84, 54, 7, 9]] : [[44, 56, 6, 7], [84, 56, 6, 7]]
    for (const [x, y, rx, ry] of eyes) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#fff'
    for (const [x, y] of eyes) { g.beginPath(); g.arc(x + 2, y - 3, 2, 0, Math.PI * 2); g.fill() }
    g.strokeStyle = '#111'
    g.lineWidth = 5
    g.beginPath()
    if (kind === 'scared') {
      // brows up, small open mouth
      g.moveTo(34, 38); g.lineTo(52, 42); g.moveTo(94, 38); g.lineTo(76, 42); g.stroke()
      g.fillStyle = '#3a1010'; g.beginPath(); g.ellipse(64, 90, 8, 10, 0, 0, Math.PI * 2); g.fill()
    } else if (kind === 'determined') {
      g.moveTo(34, 42); g.lineTo(52, 46); g.moveTo(94, 42); g.lineTo(76, 46); g.stroke()
      g.beginPath(); g.moveTo(48, 88); g.quadraticCurveTo(64, 96, 80, 88); g.stroke()
    } else {
      // the classic smile
      g.arc(64, 74, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function box(w, h, d, m) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.castShadow = true
  return mesh
}

// A limb hangs from a pivot at its top, so rotating the pivot swings it.
function limb(w, h, m, x, y) {
  const pivot = new THREE.Group()
  pivot.position.set(x, y, 0)
  const b = box(w, h, w, m)
  b.position.y = -h / 2
  pivot.add(b)
  return pivot
}

/**
 * opts: skin, shirt, pants, face ('smile' | 'scared' | 'determined' | 'mask'),
 *       hair (color or null), hood (color), scale, shoes
 */
export function makeAvatar(opts) {
  const { skin = 0xf2c79c, shirt = 0x2f6fd6, pants = 0x2b3a55, face = 'smile', hair = null, hood = null, scale = 1, shoes = 0x1b1b1b } = opts
  const root = new THREE.Group()
  const body = new THREE.Group() // bobs and leans without moving the root
  root.add(body)

  const legL = limb(0.42, 0.9, mat(pants), -0.22, 0.9)
  const legR = limb(0.42, 0.9, mat(pants), 0.22, 0.9)
  for (const leg of [legL, legR]) {
    const shoe = box(0.44, 0.14, 0.5, mat(shoes))
    shoe.position.set(0, -0.84, 0.04)
    leg.add(shoe)
  }
  const torso = box(0.88, 0.9, 0.44, mat(shirt))
  torso.position.y = 1.35
  const armL = limb(0.38, 0.86, mat(shirt), -0.64, 1.78)
  const armR = limb(0.38, 0.86, mat(shirt), 0.64, 1.78)
  for (const arm of [armL, armR]) {
    const hand = box(0.36, 0.2, 0.36, mat(skin))
    hand.position.y = -0.9
    arm.add(hand)
  }

  // head: skin on five sides, the face decal on the front
  const headMats = Array(6).fill(mat(skin))
  headMats[4] = new THREE.MeshStandardMaterial({ map: faceTexture(face, skin), roughness: 0.8 })
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), headMats)
  head.castShadow = true
  head.position.y = 2.12
  if (hair) {
    const cap = box(0.68, 0.2, 0.68, mat(hair))
    cap.position.y = 0.32
    head.add(cap)
    const back = box(0.68, 0.42, 0.14, mat(hair))
    back.position.set(0, 0.12, -0.28)
    head.add(back)
  }
  if (hood) {
    const h = box(0.74, 0.74, 0.74, mat(hood))
    h.scale.set(1, 1, 1)
    h.position.set(0, 0.05, -0.06)
    // a hood is a box with the front removed: hide its front face
    h.material = [mat(hood), mat(hood), mat(hood), mat(hood), new THREE.MeshBasicMaterial({ visible: false }), mat(hood)]
    head.add(h)
  }
  body.add(legL, legR, torso, armL, armR, head)
  root.scale.setScalar(scale)
  root.userData.rig = { body, head, torso, armL, armR, legL, legR, phase: Math.random() * 10, swing: 0, attack: 0 }
  return root
}

// speed: 0..1 of a full run. Limbs swing with the walk; idle breathes.
export function animateAvatar(avatar, dt, speed, { talking = false } = {}) {
  const r = avatar.userData.rig
  r.phase += dt * (4 + speed * 8)
  r.swing += ((speed > 0.05 ? 1 : 0) - r.swing) * Math.min(1, dt * 10)
  const a = Math.sin(r.phase) * 0.9 * r.swing * Math.min(1, 0.4 + speed)
  r.legL.rotation.x = a
  r.legR.rotation.x = -a
  r.armL.rotation.x = -a * 0.8
  if (r.attack > 0) {
    // bat swing: the right arm comes over the shoulder and down
    r.attack = Math.max(0, r.attack - dt * 3.2)
    const p = 1 - r.attack
    r.armR.rotation.x = p < 0.3 ? -2.6 * (p / 0.3) : -2.6 + 3.4 * ((p - 0.3) / 0.7)
  } else {
    r.armR.rotation.x = a * 0.8
  }
  r.body.position.y = r.swing > 0.1 ? Math.abs(Math.sin(r.phase)) * 0.08 * r.swing : Math.sin(r.phase * 0.25) * 0.02
  r.head.rotation.x = talking ? Math.sin(r.phase * 3) * 0.06 : 0
}

export function swingAttack(avatar) {
  avatar.userData.rig.attack = 1
}
