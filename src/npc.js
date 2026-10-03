// Mason and Silas: bodies, voices, personalities, and what they do when not talking.
import * as THREE from 'three'
import { makeAvatar, animateAvatar } from './avatar.js'
import { SPOTS } from './world.js'

function pickFrom(list, last) {
  const opts = list.filter((s) => s !== last)
  return opts[Math.floor(Math.random() * opts.length)]
}

export function makeNPCs(scene) {
  const mason = {
    id: 'mason',
    name: 'Mason',
    mesh: makeAvatar({ skin: 0xe8b88a, shirt: 0x4b5563, pants: 0x1f2937, face: 'scared', hood: 0x374151 }),
    persona: 'Mason is 13 and came back to the abandoned Camp Hollow Pines to find his older brother Silas, who vanished here years ago. He is a scared teenager, not an adult: he talks like a kid, whispers, jumps at noises, knows the camp legends, and is sure Silas is still alive out in the woods. He believes the shadows (the Shades) are afraid of light. He is kind to the Player and grateful for the help.',
    maxSentences: 2,
    // hidden example exchanges: small models copy examples far better than they follow rules
    examples: [
      ['who are you?', "I'm Mason. I came back here for my brother... please, keep your voice down."],
      ['what should i do?', "Keep the fire going, okay? When it goes dark, they come closer."],
      ['are you scared?', "Of course I'm scared. But Silas would come for me, so I'm not leaving without him."],
    ],
    voice: { id: 'am_puck', speed: 1.05, fx: { rate: 0.93, reverb: 0.3, lowpass: 6500 } },
    turns: [],
    safe: ["I don't want to talk about that. Not here, not in the dark.", "Stop. Some things in this camp you don't say out loud.", "Don't ask me that. Just... help me find Silas.",
      'Shh. If we talk about it, they hear us.', "Ask me something else. Please.", "No. I've had enough nightmares about this place."],
    greetings: ["Whoa! Point that light down... you scared me. You're not one of them, right?", "Shh, keep your voice low. Did you see my brother out there?",
      "You came back here too? Nobody comes back here. Will you help me find Silas?"],
    home: SPOTS.masonSeat,
  }
  const silas = {
    id: 'silas',
    name: 'Silas',
    mesh: makeAvatar({ skin: 0x8f877e, shirt: 0x15171c, pants: 0x0d0e11, face: 'mask', hood: 0x0f1013, scale: 1.22 }),
    persona: 'Silas is the masked figure in the woods: Mason\'s older brother, who has been lost in Camp Hollow Pines for years and keeps the Shades away from his little brother. He never explains himself and never narrates. He speaks in first person, in a low whisper, 1 to 6 words, cryptic and creepy. Examples: Mason... where are you. | You should not be here. | The light. Keep it burning. | They are coming.',
    maxSentences: 1,
    examples: [
      ['who are you?', 'Not who you think.'],
      ['where is mason?', 'Keep him in the light.'],
    ],
    voice: { id: 'am_onyx', speed: 0.85, fx: { rate: 0.72, reverb: 0.55, drive: 30, lowpass: 3200, echo: 0.28 } },
    turns: [],
    safe: ['Not for you.', 'Leave. Now.', 'Mason...?', 'Go back to the fire.', 'You ask too much.', 'Turn around.'],
    greetings: ['You. With the light.', 'Mason... is that you?', 'Wrong way.', 'I heard you coming.'],
    home: new THREE.Vector3(-14, 0, -9),
    // Silas whispers: one sentence, a handful of words, never a description of the scene
    shape: (text) => {
      const words = text.split(/(?<=[.!?…])\s+/)[0].split(' ')
      return words.slice(0, 8).join(' ') + (words.length > 8 ? '…' : '')
    },
  }
  for (const n of [mason, silas]) {
    n.fallback = () => (n.lastSafe = pickFrom(n.safe, n.lastSafe))
    n.greet = () => pickFrom(n.greetings)
    n.mesh.position.copy(n.home)
    n.bubble = { text: '', thinking: false, until: 0 }
    n.speaking = false
    n.greeted = false
    scene.add(n.mesh)
  }
  // a little fire glow on Mason's face side, so he reads from across the camp
  mason.mesh.rotation.y = Math.atan2(-mason.home.x, -mason.home.z)

  // where Silas lurks at each point of the story
  const SILAS_SPOTS = [new THREE.Vector3(-14, 0, -9), new THREE.Vector3(16, 0, -12), new THREE.Vector3(-20, 0, 8), new THREE.Vector3(14, 0, 16), new THREE.Vector3(-3, 0, -26), new THREE.Vector3(24, 0, -2)]
  let silasT = 20

  function update(dt, { player, finale }) {
    const pp = player.avatar.position
    // Mason: sits by the fire, turns toward you when you come close
    const dM = mason.mesh.position.distanceTo(pp)
    if (dM < 8) face(mason.mesh, pp, dt * 4)
    animateAvatar(mason.mesh, dt, 0, { talking: mason.speaking })

    // Silas: watches from the trees. Always turns to face you, slowly. Moves when you look away.
    const dS = silas.mesh.position.distanceTo(pp)
    face(silas.mesh, pp, dt * 1.2)
    let moving = 0
    if (finale && !finale.done) {
      // in the finale he walks to the fire
      const to = SPOTS.fire.clone().add(new THREE.Vector3(-2.5, 0, -2)).sub(silas.mesh.position)
      if (to.length() > 0.3) { silas.mesh.position.addScaledVector(to.normalize(), dt * 1.2); moving = 0.25 }
    } else {
      silasT -= dt
      const behind = silas.mesh.position.clone().sub(pp).normalize().dot(player.forward()) < 0
      // he leaves when you look away for long enough, after he has spoken, or if you rush him
      if (!silas.talkLock && ((silasT <= 0 && behind && dS > 12) || silas.vanishNow || dS < 1.8)) {
        const far = SILAS_SPOTS.filter((p) => p.distanceTo(pp) > 14)
        silas.mesh.position.copy(far[Math.floor(Math.random() * far.length)] ?? SILAS_SPOTS[0])
        silas.vanished = dS < 14
        silas.vanishNow = false
        silasT = 18 + Math.random() * 20
      }
    }
    animateAvatar(silas.mesh, dt, moving, { talking: silas.speaking })
  }

  function face(mesh, target, k) {
    const want = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z)
    mesh.rotation.y += Math.atan2(Math.sin(want - mesh.rotation.y), Math.cos(want - mesh.rotation.y)) * Math.min(1, k)
  }

  return { mason, silas, all: [mason, silas], update }
}
