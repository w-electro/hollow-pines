// The player: movement, camera, flashlight, bat, health, stamina, inventory.
import * as THREE from 'three'
import { makeAvatar, animateAvatar, swingAttack } from './avatar.js'
import { collide } from './world.js'
import { sfx } from './audio.js'

export function makePlayer(scene, camera, dom, start) {
  const avatar = makeAvatar({ skin: 0xf1c27d, shirt: 0xc0392b, pants: 0x23324f, face: 'determined', hair: 0x3b2414 })
  avatar.position.copy(start)
  avatar.rotation.y = Math.PI // facing the fire, flashlight forward
  scene.add(avatar)

  // the bat, held in the right hand
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 }))
  bat.position.set(0, -1.15, 0.35)
  bat.rotation.x = Math.PI / 2.3
  avatar.userData.rig.armR.add(bat)

  // flashlight in the left hand: a spot that follows where the player faces
  const flashlight = new THREE.SpotLight(0xfff1cf, 60, 22, 0.42, 0.45, 1.4)
  flashlight.castShadow = true
  flashlight.shadow.mapSize.set(1024, 1024)
  flashlight.position.set(-0.6, 1.5, 0.3)
  avatar.add(flashlight)
  avatar.add(flashlight.target)
  flashlight.target.position.set(-0.3, 0.4, 8)
  // a soft moonlit fill around the player, so nearby faces and shapes always read
  const fill = new THREE.PointLight(0x9fb0ff, 7, 11, 1.6)
  fill.position.set(0, 4, -2)
  avatar.add(fill)

  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 }))
  torch.rotation.x = Math.PI / 2
  torch.position.set(0, -0.85, 0.2)
  avatar.userData.rig.armL.add(torch)

  const p = {
    avatar, flashlight,
    hp: 100, stamina: 100, battery: 100,
    inv: { log: 0, battery: 0, bandage: 1, fuse: 0, key: 0, page: 0 },
    yaw: Math.PI, pitch: 0.42, dist: 9,
    attackCd: 0, focus: false, hurtFlash: 0, speed: 0,
    talking: false, frozen: false, invuln: 0, shake: 0,
  }

  /* input */
  const keys = new Set()
  addEventListener('keydown', (e) => {
    if (p.talking) return
    keys.add(e.code)
  })
  addEventListener('keyup', (e) => keys.delete(e.code))
  addEventListener('blur', () => keys.clear())
  let dragging = false, lastX = 0, lastY = 0, moved = 0
  dom.addEventListener('contextmenu', (e) => e.preventDefault())
  dom.addEventListener('pointerdown', (e) => {
    if (e.button === 2) { p.focus = true; return }
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY
  })
  addEventListener('pointerup', (e) => {
    if (e.button === 2) { p.focus = false; return }
    // a click that barely moved is an attack; a drag turns the camera
    if (dragging && moved < 6 && !p.talking && !p.frozen) p.attack()
    dragging = false
  })
  addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX, dy = e.clientY - lastY
    moved += Math.abs(dx) + Math.abs(dy)
    lastX = e.clientX; lastY = e.clientY
    p.yaw -= dx * 0.006
    p.pitch = Math.max(0.12, Math.min(1.15, p.pitch + dy * 0.004))
  })
  dom.addEventListener('wheel', (e) => { p.dist = Math.max(5, Math.min(14, p.dist + Math.sign(e.deltaY))) }, { passive: true })

  let hitListeners = []
  p.onAttack = (fn) => hitListeners.push(fn)
  p.attack = () => {
    if (p.attackCd > 0) return
    p.attackCd = 0.55
    swingAttack(avatar)
    sfx.swing()
    // the hit lands a moment into the swing
    setTimeout(() => hitListeners.forEach((fn) => fn(avatar.position.clone(), forward())), 160)
  }

  const forward = () => new THREE.Vector3(Math.sin(avatar.rotation.y), 0, Math.cos(avatar.rotation.y))
  p.forward = forward

  p.damage = (n) => {
    if (p.invuln > 0 || p.hp <= 0) return
    p.hp = Math.max(0, p.hp - n)
    p.hurtFlash = 1
    p.invuln = 0.6
    sfx.hurt()
    p.shake = 0.4
  }
  p.heal = (n) => { p.hp = Math.min(100, p.hp + n) }

  let stepT = 0
  const ray = new THREE.Raycaster()
  let hiddenTrees = new Set()
  p.update = (dt, colliders, occluders = []) => {
    p.attackCd = Math.max(0, p.attackCd - dt)
    p.invuln = Math.max(0, p.invuln - dt)
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 1.5)

    // movement relative to where the camera looks
    let ix = 0, iz = 0
    if (!p.talking && !p.frozen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix += 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix -= 1
    }
    const moving = ix || iz
    const sprint = moving && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && p.stamina > 1
    p.stamina = Math.max(0, Math.min(100, p.stamina + (sprint ? -22 : 14) * dt))
    const speed = moving ? (sprint ? 7.2 : 4.3) : 0
    if (moving) {
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw)
      const dir = new THREE.Vector3(fx * iz + fz * ix, 0, fz * iz - fx * ix).normalize()
      avatar.position.addScaledVector(dir, speed * dt)
      const want = Math.atan2(dir.x, dir.z)
      avatar.rotation.y += Math.atan2(Math.sin(want - avatar.rotation.y), Math.cos(want - avatar.rotation.y)) * Math.min(1, dt * 12)
      stepT -= dt * (sprint ? 1.6 : 1)
      if (stepT <= 0) { sfx.step(); stepT = 0.36 }
    }
    collide(avatar.position, colliders, 0.5)
    p.speed = speed / 7.2
    animateAvatar(avatar, dt, p.speed)

    // flashlight: drains, flickers when low, a focused beam drains fast
    const on = p.battery > 0
    p.battery = Math.max(0, p.battery - dt * (p.focus && on ? 4 : 0.45))
    p.flicker = Math.max(0, (p.flicker ?? 0) - dt)
    const low = (p.battery < 18 && Math.random() < 0.08) || (p.flicker > 0 && Math.random() < 0.45)
    flashlight.intensity = !on ? 0 : low ? 6 : p.focus ? 140 : 60
    flashlight.angle = p.focus ? 0.22 : 0.42
    flashlight.distance = p.focus ? 30 : 22

    // camera: orbit behind the player, never under the ground
    const target = avatar.position.clone().add(new THREE.Vector3(0, 1.8, 0))
    const cp = new THREE.Vector3(
      target.x - Math.sin(p.yaw) * Math.cos(p.pitch) * p.dist,
      target.y + Math.sin(p.pitch) * p.dist,
      target.z - Math.cos(p.yaw) * Math.cos(p.pitch) * p.dist)
    // something between the camera and the player: trees step aside (hidden, like Roblox
    // does), buildings pull the camera in
    const back = cp.clone().sub(target)
    const want = back.length()
    ray.set(target, back.normalize())
    ray.far = want
    const blockers = new Set()
    let hit = null
    for (const h of ray.intersectObjects(occluders, true)) {
      let o = h.object
      while (o.parent && !o.userData.tree && !o.userData.building) o = o.parent
      if (o.userData.tree) blockers.add(o)
      else if (!hit) hit = h
    }
    // and trees whose branches reach into the view: anything within ~2 m of the line from
    // the camera to the player (a pine is wide; the exact line misses it but the screen doesn't)
    const sx = target.x - cp.x, sz = target.z - cp.z, len2 = sx * sx + sz * sz
    for (const o of occluders) {
      if (!o.userData.tree) continue
      const k = Math.max(0, Math.min(1, ((o.position.x - cp.x) * sx + (o.position.z - cp.z) * sz) / len2))
      if (Math.hypot(o.position.x - (cp.x + k * sx), o.position.z - (cp.z + k * sz)) < 2.1) blockers.add(o)
    }
    for (const t of hiddenTrees) if (!blockers.has(t)) t.visible = true
    for (const t of blockers) t.visible = false
    hiddenTrees = blockers
    if (hit) cp.copy(target).addScaledVector(back, Math.max(1.6, hit.distance - 0.4))
    camera.position.lerp(cp, 1 - Math.exp(-dt * (hit ? 18 : 10)))
    camera.lookAt(target)
    if (p.shake > 0) {
      p.shake = Math.max(0, p.shake - dt)
      camera.position.x += (Math.random() - 0.5) * p.shake * 0.5
      camera.position.y += (Math.random() - 0.5) * p.shake * 0.5
    }
  }
  return p
}
