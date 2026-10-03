// Shades: figures made of shadow. They live in the dark, avoid firelight and lamps,
// flinch from the flashlight, burn under a focused beam, and break apart when hit.
// Nothing bleeds: when a shade dies it comes apart into rising smoke.
import * as THREE from 'three'
import { collide, inLight, WORLD_RADIUS } from './world.js'
import { sfx } from './audio.js'

const baseBodyMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 1, transparent: true, opacity: 0.92 })
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a })
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x15121c, transparent: true, opacity: 0.7, depthWrite: false })

function shadeMesh() {
  const g = new THREE.Group()
  const bodyMat = baseBodyMat.clone() // its own, so only the shade in the beam flickers
  // tall, thin, slightly wrong proportions
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.5), bodyMat)
  body.position.y = 1.4
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.55), bodyMat)
  head.position.y = 2.6
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.22), bodyMat)
  armL.position.set(-0.55, 1.25, 0.1)
  armL.rotation.z = 0.12
  const armR = armL.clone()
  armR.position.x = 0.55
  armR.rotation.z = -0.12
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 6), bodyMat)
  tail.position.y = 0.5
  tail.rotation.x = Math.PI
  for (const x of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), eyeMat)
    eye.position.set(x, 2.66, 0.28)
    g.add(eye)
  }
  const glow = new THREE.PointLight(0xff2a1a, 1.5, 3)
  glow.position.set(0, 2.6, 0.5)
  g.add(body, head, armL, armR, tail, glow)
  g.userData.parts = { armL, armR, body, head }
  return g
}

export function makeShades(scene, { player, world, onKill }) {
  const list = []
  const puffs = []
  let spawnT = 4
  let maxCount = 3

  function spawn() {
    // somewhere dark, out of sight-ish, not too close
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 14
      const pos = player.avatar.position.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
      if (pos.length() > WORLD_RADIUS - 2 || inLight(pos, world.lightSources)) continue
      const mesh = shadeMesh()
      mesh.position.copy(pos)
      mesh.scale.setScalar(0.01)
      scene.add(mesh)
      list.push({ mesh, hp: 3, burn: 0, stun: 0, grow: 0, flash: 0, hissT: Math.random() * 4, knock: new THREE.Vector3(), wander: Math.random() * 6 })
      return
    }
  }

  function kill(s, i) {
    sfx.shadeDie()
    // smoke: a few blocks that drift up and fade
    for (let k = 0; k < 10; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), smokeMat.clone())
      m.position.copy(s.mesh.position).add(new THREE.Vector3((Math.random() - 0.5) * 1, 0.5 + Math.random() * 2.2, (Math.random() - 0.5) * 1))
      scene.add(m)
      puffs.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1 + Math.random(), (Math.random() - 0.5) * 0.8), life: 1.2 })
    }
    scene.remove(s.mesh)
    list.splice(i, 1)
    onKill?.()
  }

  // bat hits: anything in front of the player within reach
  player.onAttack((from, dir) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      const to = s.mesh.position.clone().sub(from)
      const d = to.length()
      if (d > 3.0) continue
      if (to.normalize().dot(dir) < 0.35) continue
      sfx.hit()
      s.hp -= 1
      s.stun = 0.6
      s.knock.copy(dir).multiplyScalar(4.5)
      s.flash = 0.18
      player.shake = 0.25
      if (s.hp <= 0) kill(s, i)
    }
  })

  function update(dt, { aggression = 1, fireOut = false }) {
    maxCount = Math.round(2 + aggression * 3 + (fireOut ? 2 : 0))
    spawnT -= dt
    if (spawnT <= 0 && list.length < maxCount) { spawn(); spawnT = 6 / aggression + Math.random() * 4 }

    const pp = player.avatar.position
    const fwd = player.forward()
    const beamOn = player.battery > 0
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      const m = s.mesh
      s.grow = Math.min(1, s.grow + dt * 0.8)
      m.scale.setScalar(0.01 + s.grow)
      const toP = pp.clone().sub(m.position)
      const dist = toP.length()
      toP.normalize()

      // the flashlight: inside the cone, close enough → the shade flinches; focused → it burns
      const toS = m.position.clone().sub(pp)
      const inBeam = beamOn && toS.length() < (player.focus ? 22 : 14) && toS.normalize().dot(fwd) > (player.focus ? 0.94 : 0.86)
      if (inBeam) {
        s.burn += dt * (player.focus ? 1 : 0.25)
        s.stun = Math.max(s.stun, player.focus ? 0.4 : 0.15)
        if (s.burn > 1.6) { kill(s, i); continue }
      } else s.burn = Math.max(0, s.burn - dt * 0.3)

      let move = new THREE.Vector3()
      const lit = inLight(m.position, world.lightSources)
      if (lit) {
        // backs out of the light
        const nearest = world.lightSources.filter((l) => l.radius() > 0).sort((a, b) => a.pos.distanceTo(m.position) - b.pos.distanceTo(m.position))[0]
        if (nearest) move.copy(m.position).sub(nearest.pos).setY(0).normalize().multiplyScalar(3)
      } else if (s.stun > 0) {
        move.copy(toP).multiplyScalar(-1.5)
      } else if (dist < 22) {
        // hunts the player, but won't step into light to do it
        const step = m.position.clone().addScaledVector(toP, 1.2)
        if (!inLight(step, world.lightSources)) move.copy(toP).multiplyScalar(dist < 3 ? 1.4 : 2.9 * (0.8 + aggression * 0.3))
        else move.set(-toP.z, 0, toP.x).multiplyScalar(1.5) // circles the edge of the light
      } else {
        s.wander += dt * 0.4
        move.set(Math.cos(s.wander), 0, Math.sin(s.wander)).multiplyScalar(1)
      }
      s.stun = Math.max(0, s.stun - dt)
      move.add(s.knock)
      s.knock.multiplyScalar(Math.exp(-dt * 6))
      m.position.addScaledVector(move, dt)
      collide(m.position, world.colliders, 0.5)
      m.rotation.y = Math.atan2(toP.x, toP.z)
      const parts = m.userData.parts
      parts.armL.rotation.x = Math.sin(performance.now() / 180 + i) * 0.4
      parts.armR.rotation.x = -Math.sin(performance.now() / 180 + i) * 0.4
      m.position.y = Math.sin(performance.now() / 400 + i) * 0.15 // they hover, just barely
      // the beam makes them flicker; a bat hit makes them flash
      parts.body.material.opacity = inBeam ? 0.5 + Math.random() * 0.4 : 0.92
      s.flash = Math.max(0, s.flash - dt)
      parts.body.material.emissive.setHex(s.flash > 0 ? 0x661111 : 0x000000)

      if (dist < 1.6 && s.stun <= 0 && !lit) player.damage(12)
      s.hissT -= dt
      if (s.hissT <= 0 && dist < 12) { sfx.shadeHiss(); s.hissT = 3 + Math.random() * 5 }
    }

    for (let i = puffs.length - 1; i >= 0; i--) {
      const f = puffs[i]
      f.life -= dt
      f.m.position.addScaledVector(f.v, dt)
      f.m.material.opacity = Math.max(0, f.life / 1.2) * 0.7
      f.m.rotation.x += dt * 2
      if (f.life <= 0) { scene.remove(f.m); puffs.splice(i, 1) }
    }
  }

  const nearestDist = () => list.reduce((d, s) => Math.min(d, s.mesh.position.distanceTo(player.avatar.position)), Infinity)
  const clear = () => { for (const s of list) scene.remove(s.mesh); list.length = 0 }
  return { list, update, nearestDist, clear, spawnNear: (n) => { for (let i = 0; i < n; i++) spawn() } }
}
