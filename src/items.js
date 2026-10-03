// Things you can pick up: they bob and turn so they read from a distance in the dark.
import * as THREE from 'three'
import { mat } from './avatar.js'

const glow = (color) => new THREE.MeshBasicMaterial({ color })

const BUILD = {
  log: () => {
    const g = new THREE.Group()
    for (const [y, r] of [[0, 0.3], [0.22, -0.4]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 7), mat(0x5a3a1e))
      l.rotation.set(Math.PI / 2, r, 0)
      l.position.y = 0.15 + y
      g.add(l)
    }
    return g
  },
  battery: () => {
    const g = new THREE.Group()
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), glow(0xe8c547))
    b.position.y = 0.5
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), glow(0xdddddd))
    cap.position.y = 0.74
    g.add(b, cap)
    return g
  },
  fuse: () => {
    const g = new THREE.Group()
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.18), glow(0xd94b2b))
    b.position.y = 0.5
    g.add(b)
    return g
  },
  key: () => {
    const g = new THREE.Group()
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 12), glow(0xf2c14e))
    ring.position.y = 0.6
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), glow(0xf2c14e))
    shaft.position.y = 0.32
    g.add(ring, shaft)
    return g
  },
  page: () => {
    const g = new THREE.Group()
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshBasicMaterial({ color: 0xe9e1c9, side: THREE.DoubleSide }))
    p.position.y = 0.6
    g.add(p)
    return g
  },
  bandage: () => {
    const g = new THREE.Group()
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.26), glow(0xf0f0f0))
    b.position.y = 0.45
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.06), glow(0xd02020))
    c1.position.y = 0.56
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.2), glow(0xd02020))
    c2.position.y = 0.56
    g.add(b, c1, c2)
    return g
  },
}

export const ITEM_INFO = {
  log: { icon: '🪵', name: 'Firewood' },
  battery: { icon: '🔋', name: 'Battery' },
  bandage: { icon: '🩹', name: 'Bandage' },
  fuse: { icon: '🧯', name: 'Fuse' },
  key: { icon: '🗝️', name: 'Ranger key' },
  page: { icon: '📄', name: 'Journal page' },
}

export function makeItems(scene) {
  const items = []
  function add(kind, pos, extra = {}) {
    const mesh = BUILD[kind]()
    mesh.position.copy(pos)
    // a faint ring on the ground, so items read in the dark
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 20), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.35, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.04
    mesh.add(ring)
    scene.add(mesh)
    const it = { kind, pos: pos.clone(), mesh, active: true, phase: Math.random() * 6, ...extra }
    items.push(it)
    return it
  }
  function take(it) {
    it.active = false
    scene.remove(it.mesh)
  }
  function update(dt) {
    for (const it of items) {
      if (!it.active) continue
      it.phase += dt
      const inner = it.mesh.children
      for (const c of inner) if (!c.geometry || c.geometry.type !== 'RingGeometry') {
        c.position.y += Math.sin(it.phase * 2) * 0.002
      }
      if (it.kind !== 'log') it.mesh.rotation.y += dt * 1.2
    }
  }
  const nearest = (pos, range = 1.9) => items.filter((i) => i.active && i.pos.distanceTo(pos) < range).sort((a, b) => a.pos.distanceTo(pos) - b.pos.distanceTo(pos))[0]
  return { items, add, take, update, nearest }
}
