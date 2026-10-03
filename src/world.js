// The camp: terrain, woods, buildings, lights, and where everything is.
import * as THREE from 'three'
import { mat } from './avatar.js'

// Where things are. Gameplay code refers to these names, never to raw numbers.
export const SPOTS = {
  fire: new THREE.Vector3(0, 0, 0),
  masonSeat: new THREE.Vector3(2.4, 0, 1.6),
  playerStart: new THREE.Vector3(0, 0, 9),
  cabinA: new THREE.Vector3(-11, 0, 5),
  cabinB: new THREE.Vector3(11, 0, 7),
  cabinC: new THREE.Vector3(-7, 0, -13),
  generator: new THREE.Vector3(-18, 0, -3),
  lake: new THREE.Vector3(8, 0, -27),
  dockEnd: new THREE.Vector3(8, 0, -20.5),
  boathouse: new THREE.Vector3(18, 0, -19),
  ranger: new THREE.Vector3(-9, 0, -34),
  rangerDoor: new THREE.Vector3(-9, 0, -31.2),
}
export const PAGES = [new THREE.Vector3(-21, 0, 12), new THREE.Vector3(22, 0, -4), new THREE.Vector3(-17, 0, -22)]
export const BATTERIES = [new THREE.Vector3(-11, 0, 7.4), new THREE.Vector3(11, 0, 9.4), new THREE.Vector3(-7, 0, -10.6)]
export const LOGS = [
  new THREE.Vector3(-6, 0, 14), new THREE.Vector3(7, 0, 15), new THREE.Vector3(15, 0, 1), new THREE.Vector3(-15, 0, 4),
  new THREE.Vector3(-3, 0, -18), new THREE.Vector3(14, 0, -10), new THREE.Vector3(-22, 0, -10), new THREE.Vector3(20, 0, 14),
]
export const LAMPS = [new THREE.Vector3(-5, 0, 6), new THREE.Vector3(6, 0, -6), new THREE.Vector3(-10, 0, -6), new THREE.Vector3(12, 0, -14), new THREE.Vector3(-6, 0, -24), new THREE.Vector3(5, 0, 11)]
export const WORLD_RADIUS = 38

export function buildWorld(scene) {
  const colliders = [] // { x, z, r } circles, or { box: [minX, minZ, maxX, maxZ] }
  const occluders = [] // big things the camera should not end up behind
  const lightSources = [] // { pos, radius(): number } — places the shadows will not enter

  // dark, but readable: like a Roblox horror map, you can always see shapes and characters
  scene.background = new THREE.Color(0x0a0d18)
  scene.fog = new THREE.FogExp2(0x0a0d18, 0.03)
  scene.add(new THREE.HemisphereLight(0x5a6aa8, 0x1a140e, 1.25))
  scene.add(new THREE.AmbientLight(0x2a2f48, 0.6))
  const moon = new THREE.DirectionalLight(0xb4c2ff, 1.25)
  moon.position.set(-20, 30, -10)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 90 })
  scene.add(moon)

  // the moon itself, low and big
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: 0xd8dcff, fog: false }))
  moonDisc.position.set(-60, 45, -90)
  moonDisc.lookAt(0, 0, 0)
  scene.add(moonDisc)

  /* stars: a few thousand points on a far dome, brighter near the top */
  const starPos = []
  for (let i = 0; i < 2200; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.pow(Math.random(), 0.6) * Math.PI * 0.48
    starPos.push(Math.cos(a) * Math.cos(e) * 140, 8 + Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd6ff, size: 0.55, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 })))

  /* terrain: gentle bumps, darker dirt paths, painted with vertex colours */
  const g = new THREE.PlaneGeometry(110, 110, 110, 110)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  const colors = []
  const grass = new THREE.Color(0x1c2b1c), dirt = new THREE.Color(0x2f2619), dark = new THREE.Color(0x121a12)
  const pathPts = [SPOTS.fire, SPOTS.cabinA, SPOTS.cabinB, SPOTS.cabinC, SPOTS.generator, SPOTS.dockEnd, SPOTS.boathouse, SPOTS.rangerDoor]
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const y = r < 30 ? Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.18 : 0.6 + Math.sin(x * 0.1 + z * 0.13) * 0.8
    pos.setY(i, y)
    // distance to the nearest path segment from the fire
    let dPath = Infinity
    for (const p of pathPts.slice(1)) {
      const ax = 0, az = 0, bx = p.x, bz = p.z
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)))
      dPath = Math.min(dPath, Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))))
    }
    const c = grass.clone()
    if (dPath < 1.3) c.lerp(dirt, 1 - dPath / 1.3)
    c.lerp(dark, Math.min(1, Math.max(0, (r - 22) / 18)))
    c.multiplyScalar(0.85 + Math.random() * 0.3)
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  ground.receiveShadow = true
  scene.add(ground)

  /* lake + dock + boathouse */
  const lake = new THREE.Mesh(new THREE.CircleGeometry(8.5, 48), new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.08, metalness: 0.7 }))
  lake.rotation.x = -Math.PI / 2
  lake.position.set(SPOTS.lake.x, 0.05, SPOTS.lake.z)
  scene.add(lake)
  // water you can't walk on — except the dock, which reaches out over it
  colliders.push({ x: SPOTS.lake.x, z: SPOTS.lake.z, r: 8.2, water: true, except: [SPOTS.dockEnd.x - 0.85, -22.2, SPOTS.dockEnd.x + 0.85, -16] })
  const plank = mat(0x4a3622)
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), plank)
    p.position.set(SPOTS.dockEnd.x, 0.25, -17.5 - i * 0.55)
    p.castShadow = p.receiveShadow = true
    scene.add(p)
  }
  building(scene, colliders, SPOTS.boathouse, 4, 3, 2.6, 0x2c3a46, 0x161d24)

  /* cabins */
  for (const c of [SPOTS.cabinA, SPOTS.cabinB, SPOTS.cabinC]) building(scene, colliders, c, 5, 3.6, 2.8, 0x43301f, 0x1d1510, true)
  building(scene, colliders, SPOTS.generator, 3, 2.6, 2.2, 0x3a3a34, 0x1c1c18)
  const ranger = building(scene, colliders, SPOTS.ranger, 6, 4.6, 3.4, 0x2f3a2a, 0x151a13, true)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.08), mat(0x6b5a2e))
  sign.position.set(SPOTS.ranger.x, 3.1, SPOTS.ranger.z + 2.36)
  scene.add(sign)

  /* the generator machine, visible through the shed's open front */
  const gen = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), mat(0x6a6a1e, { metalness: 0.4 }))
  gen.position.set(SPOTS.generator.x, 0.45, SPOTS.generator.z + 1.9)
  gen.castShadow = true
  scene.add(gen)

  /* campfire: logs, a flame, a flickering light that keeps the dark away */
  const fire = { fuel: 0.7, light: null, flame: null }
  const fg = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6), mat(0x2b1d14))
    log.rotation.set(Math.PI / 2, 0, (i * Math.PI) / 5)
    log.position.y = 0.12
    fg.add(log)
  }
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), mat(0x3d3a38))
    s.position.set(Math.cos(i / 1.6) * 1.05, 0.08, Math.sin(i / 1.6) * 1.05)
    fg.add(s)
  }
  fire.flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xff8a35 }))
  fire.flame.position.y = 0.6
  fg.add(fire.flame)
  fire.light = new THREE.PointLight(0xff7a2a, 40, 18, 1.6)
  fire.light.position.y = 1.2
  fire.light.castShadow = true
  fire.light.shadow.mapSize.set(512, 512)
  fg.add(fire.light)
  scene.add(fg)
  colliders.push({ x: 0, z: 0, r: 1.2 })
  lightSources.push({ pos: SPOTS.fire, radius: () => (fire.fuel > 0 ? 3.5 + fire.fuel * 5 : 0) })
  // logs around the fire to sit on
  for (const [x, z, ry] of [[2.6, 1.8, 0.6], [-2.6, 1.6, -0.6], [0, -3, 0]]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2, 8), mat(0x3a2818))
    seat.rotation.set(0, ry, Math.PI / 2)
    seat.position.set(x, 0.28, z)
    seat.castShadow = true
    scene.add(seat)
  }

  /* lamp posts: dark until the generator runs */
  const lamps = LAMPS.map((p) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), mat(0x222428, { metalness: 0.6 }))
    post.position.set(p.x, 1.7, p.z)
    post.castShadow = true
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }))
    bulb.position.set(p.x, 3.45, p.z)
    const light = new THREE.PointLight(0xffe2a8, 0, 14, 1.8)
    light.position.set(p.x, 3.3, p.z)
    scene.add(post, bulb, light)
    colliders.push({ x: p.x, z: p.z, r: 0.3 })
    const lamp = { pos: p, light, bulb, on: false }
    lightSources.push({ pos: p, radius: () => (lamp.on ? 5.5 : 0) })
    return lamp
  })

  /* woods: seeded, so the camp is the same every visit; keep paths and buildings clear */
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const keepClear = [SPOTS.fire, SPOTS.cabinA, SPOTS.cabinB, SPOTS.cabinC, SPOTS.generator, SPOTS.lake, SPOTS.boathouse, SPOTS.ranger, SPOTS.dockEnd, SPOTS.playerStart,
    new THREE.Vector3(0, 0, 15), ...PAGES, ...LAMPS]
  const trunkMat = mat(0x2a1c12), leafMats = [mat(0x0f2416), mat(0x12291a), mat(0x0c1f13)]
  for (let i = 0; i < 230; i++) {
    const a = rnd() * Math.PI * 2, r = 9 + rnd() * 40
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    if (keepClear.some((p) => Math.hypot(x - p.x, z - p.z) < (p === SPOTS.lake ? 10.5 : p === SPOTS.ranger ? 6 : 5))) continue
    const h = 3.5 + rnd() * 5
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.4, 6), trunkMat)
    trunk.position.y = 0.7
    tree.add(trunk)
    // stacked cones: a blocky pine
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * 0.35) * (0.8 + rnd() * 0.4), h * 0.45, 6), leafMats[(i + k) % 3])
      cone.position.y = 1.3 + k * h * 0.24 + h * 0.2
      cone.castShadow = true
      tree.add(cone)
    }
    tree.position.set(x, 0, z)
    tree.rotation.y = rnd() * 6
    scene.add(tree)
    occluders.push(tree)
    if (r < WORLD_RADIUS) colliders.push({ x, z, r: 0.45 })
  }
  // a dark ring of trees at the edge: the camp's wall
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2
    const t = new THREE.Mesh(new THREE.ConeGeometry(2.4, 11, 6), leafMats[i % 3])
    t.position.set(Math.cos(a) * 44, 5, Math.sin(a) * 44)
    scene.add(t)
  }

  /* blood: a handprint on cabin B's door and a trail toward the woods */
  const blood = mat(0x4f0808, { roughness: 0.5 })
  const hand = new THREE.Group()
  hand.add(new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), blood))
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.22), blood)
    f.position.set(-0.11 + i * 0.075, 0.24, 0)
    hand.add(f)
  }
  hand.position.set(SPOTS.cabinB.x - 0.9, 1.4, SPOTS.cabinB.z + 1.83)
  scene.add(hand)
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.25 + (i % 3) * 0.12, 10), blood)
    d.rotation.x = -Math.PI / 2
    d.position.set(SPOTS.cabinB.x + 1 + i * 1.6, 0.06 + i * 0.001, SPOTS.cabinB.z + 3 + Math.sin(i) * 0.6)
    scene.add(d)
  }

  /* embers: sparks rising from the fire, recycled forever */
  const EMBERS = 70
  const emberPos = new Float32Array(EMBERS * 3)
  const emberLife = new Float32Array(EMBERS).map(() => Math.random())
  const emberGeo = new THREE.BufferGeometry()
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }))
  scene.add(embers)

  let t = 0
  function update(dt) {
    for (let i = 0; i < EMBERS; i++) {
      emberLife[i] += dt * (0.35 + (i % 5) * 0.06)
      if (emberLife[i] > 1) emberLife[i] = fire.fuel > 0 ? 0 : 1.01
      const l = emberLife[i]
      emberPos[i * 3] = Math.sin(i * 7.1 + l * 3) * (0.25 + l * 0.6)
      emberPos[i * 3 + 1] = l > 1 ? -5 : 0.5 + l * (2.5 + fire.fuel * 2)
      emberPos[i * 3 + 2] = Math.cos(i * 3.3 + l * 2) * (0.25 + l * 0.6)
    }
    emberGeo.attributes.position.needsUpdate = true
    t += dt
    fire.fuel = Math.max(0, fire.fuel - dt / 210) // a full fire lasts about three and a half minutes
    const on = fire.fuel > 0
    fire.flame.visible = on
    fire.flame.scale.set(0.5 + fire.fuel * 0.6, (0.5 + fire.fuel * 0.7) * (1 + Math.sin(t * 11) * 0.1), 0.5 + fire.fuel * 0.6)
    fire.light.intensity = on ? (14 + fire.fuel * 34) * (1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.1) : 0
    for (const l of lamps) if (l.on) l.light.intensity = 9 * (Math.random() < 0.004 ? 0.2 : 1)
  }

  scene.traverse((o) => { if (o.userData.building) occluders.push(o) })
  return { colliders, occluders, lightSources, fire, lamps, ground, update, ranger }
}

// A simple cabin: walls, a pitched roof, a lit window, an open dark doorway on the front.
function building(scene, colliders, at, w, d, h, wall, roof, window = false) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wall))
  body.position.y = h / 2
  body.castShadow = body.receiveShadow = true
  const top = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.55, 4), mat(roof))
  top.rotation.y = Math.PI / 4
  top.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d))
  top.position.y = h + h * 0.27
  top.castShadow = true
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), mat(0x050505))
  door.position.set(-w * 0.18, 0.95, d / 2 + 0.01)
  g.add(body, top, door)
  if (window) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({ color: 0x5a4210 }))
    win.position.set(w * 0.22, h * 0.55, d / 2 + 0.01)
    g.add(win)
  }
  g.position.copy(at)
  g.userData.building = true
  scene.add(g)
  colliders.push({ box: [at.x - w / 2, at.z - d / 2, at.x + w / 2, at.z + d / 2] })
  return g
}

// Push a point out of every collider it overlaps. Returns the corrected position.
export function collide(p, colliders, radius = 0.45) {
  for (const c of colliders) {
    if (c.box) {
      const [x0, z0, x1, z1] = c.box
      const cx = Math.max(x0, Math.min(p.x, x1)), cz = Math.max(z0, Math.min(p.z, z1))
      const dx = p.x - cx, dz = p.z - cz
      const d = Math.hypot(dx, dz)
      if (d < radius) {
        if (d > 1e-4) { p.x = cx + (dx / d) * radius; p.z = cz + (dz / d) * radius } else p.z = z1 + radius
      }
    } else {
      if (c.except && p.x > c.except[0] && p.x < c.except[2] && p.z > c.except[1] && p.z < c.except[3]) continue
      const dx = p.x - c.x, dz = p.z - c.z
      const d = Math.hypot(dx, dz), min = c.r + radius
      if (d < min && d > 1e-4) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min }
    }
  }
  const r = Math.hypot(p.x, p.z)
  if (r > WORLD_RADIUS) { p.x *= WORLD_RADIUS / r; p.z *= WORLD_RADIUS / r }
  return p
}

export function inLight(p, lightSources) {
  return lightSources.some((l) => p.distanceTo(l.pos) < l.radius())
}
