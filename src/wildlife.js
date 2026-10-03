// The camp's animals: deer and rabbits graze and bolt, crows sit and scatter.
// Shades hunt rabbits too, so the woods feel alive and the dark feels dangerous.
import * as THREE from 'three'
import { mat } from './avatar.js'
import { collide, WORLD_RADIUS } from './world.js'
import { sfx } from './audio.js'

function deer() {
  const g = new THREE.Group()
  const fur = mat(0x6b4a2b), dark = mat(0x3a2716)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.4), fur)
  body.position.y = 1.1
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), fur)
  neck.position.set(0, 1.55, 0.65)
  neck.rotation.x = -0.35
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.5), fur)
  head.position.set(0, 1.95, 0.85)
  g.add(body, neck, head)
  for (const x of [-0.12, 0.12]) {
    const antler = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), dark)
    antler.position.set(x, 2.3, 0.78)
    antler.rotation.z = x * 2.5
    g.add(antler)
  }
  const legs = []
  for (const [x, z] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]]) {
    const pivot = new THREE.Group()
    pivot.position.set(x, 0.85, z)
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.85, 0.13), dark)
    leg.position.y = -0.42
    pivot.add(leg)
    g.add(pivot)
    legs.push(pivot)
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  g.userData = { legs, head }
  return g
}

function rabbit() {
  const g = new THREE.Group()
  const fur = mat(0x8a8178)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.45), fur)
  body.position.y = 0.2
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), fur)
  head.position.set(0, 0.38, 0.22)
  g.add(body, head)
  for (const x of [-0.06, 0.06]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.05), fur)
    ear.position.set(x, 0.62, 0.2)
    g.add(ear)
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat(0xdedad2))
  tail.position.set(0, 0.24, -0.26)
  g.add(tail)
  g.userData = { legs: [], head }
  return g
}

function crow() {
  const g = new THREE.Group()
  const black = mat(0x0b0b0e)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.36), black)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), black)
  head.position.set(0, 0.12, 0.2)
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), mat(0x2a2a2a))
  beak.position.set(0, 0.1, 0.32)
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.22), black)
  wingL.position.x = -0.22
  const wingR = wingL.clone()
  wingR.position.x = 0.22
  g.add(body, head, beak, wingL, wingR)
  g.userData = { wingL, wingR }
  return g
}

export function makeWildlife(scene, { player, shades }) {
  const animals = []
  const rand = (a, b) => a + Math.random() * (b - a)
  const spot = () => { const a = Math.random() * Math.PI * 2, r = rand(10, WORLD_RADIUS - 4); return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r) }

  function add(kind) {
    const mesh = kind === 'deer' ? deer() : kind === 'rabbit' ? rabbit() : crow()
    mesh.position.copy(spot())
    if (kind === 'crow') mesh.position.y = rand(0, 0.1)
    scene.add(mesh)
    animals.push({ kind, mesh, state: 'idle', t: rand(1, 4), dir: new THREE.Vector3(), phase: Math.random() * 6, vy: 0 })
  }
  for (let i = 0; i < 4; i++) add('deer')
  for (let i = 0; i < 7; i++) add('rabbit')
  for (let i = 0; i < 9; i++) add('crow')

  function update(dt, colliders) {
    const pp = player.avatar.position
    for (let i = animals.length - 1; i >= 0; i--) {
      const a = animals[i]
      const m = a.mesh
      const dPlayer = m.position.distanceTo(pp)
      let threat = null
      if (dPlayer < (a.kind === 'deer' ? 9 : a.kind === 'crow' ? 5 : 6)) threat = pp
      for (const s of shades.list) if (s.mesh.position.distanceTo(m.position) < 8) threat = s.mesh.position

      if (a.kind === 'crow') {
        if (a.state !== 'fly' && threat) { a.state = 'fly'; a.vy = 4; a.dir.set(rand(-1, 1), 0, rand(-1, 1)).normalize(); sfx.crow() }
        if (a.state === 'fly') {
          m.position.addScaledVector(a.dir, dt * 6)
          m.position.y += a.vy * dt
          a.vy -= dt * 0.8
          const flap = Math.sin(performance.now() / 50 + i) * 0.9
          m.userData.wingL.rotation.z = flap
          m.userData.wingR.rotation.z = -flap
          if (m.position.y > 14 || m.position.length() > 55) { m.position.copy(spot()); m.position.y = 0; a.state = 'idle'; a.vy = 0; m.userData.wingL.rotation.z = m.userData.wingR.rotation.z = 0 }
        } else if (Math.random() < dt * 0.3) m.rotation.y += rand(-1, 1)
        m.rotation.y = a.state === 'fly' ? Math.atan2(a.dir.x, a.dir.z) : m.rotation.y
        continue
      }

      if (threat) {
        a.state = 'flee'
        a.dir.copy(m.position).sub(threat).setY(0).normalize()
        a.t = 2
      } else {
        a.t -= dt
        if (a.t <= 0) {
          a.state = Math.random() < 0.5 ? 'idle' : 'walk'
          a.dir.set(rand(-1, 1), 0, rand(-1, 1)).normalize()
          a.t = rand(2, 6)
        }
      }
      const speed = a.state === 'flee' ? (a.kind === 'deer' ? 7 : 5.5) : a.state === 'walk' ? 1 : 0
      if (speed) {
        m.position.addScaledVector(a.dir, speed * dt)
        m.rotation.y = Math.atan2(a.dir.x, a.dir.z)
      }
      collide(m.position, colliders, a.kind === 'deer' ? 0.6 : 0.25)
      a.phase += dt * speed * 3
      if (a.kind === 'rabbit') m.position.y = speed ? Math.abs(Math.sin(a.phase)) * 0.35 : 0
      for (const [k, leg] of m.userData.legs.entries()) leg.rotation.x = speed ? Math.sin(a.phase + (k % 2 ? Math.PI : 0)) * 0.6 : 0
      if (!speed) m.userData.head.rotation.x = Math.sin(performance.now() / 900 + i) * 0.2 + 0.25 // grazing

      // a shade that catches a rabbit: the rabbit is simply gone, and another appears later
      if (a.kind === 'rabbit') for (const s of shades.list) if (s.mesh.position.distanceTo(m.position) < 1.2) {
        m.position.copy(spot())
        break
      }
    }
  }
  return { update, animals }
}
