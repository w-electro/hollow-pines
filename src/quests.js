// The story, as steps. Each step says what to do, where, and what Mason knows about it,
// so his AI dialogue can give real hints. Mechanics live in main.js, never in the model.
import { SPOTS, PAGES } from './world.js'

export const STEPS = [
  { id: 'meet', title: 'Follow the firelight', detail: 'Someone is sitting by the campfire.', target: SPOTS.masonSeat,
    hint: 'The Player just arrived. You need help finding your brother Silas.' },
  { id: 'wood', title: 'Keep the fire alive', detail: 'Bring firewood back to the campfire', need: 3, counter: 'log', target: SPOTS.fire,
    hint: 'The fire is dying, and the Shades come closer when it is dark. Ask the Player to bring three pieces of firewood from the woods around camp and throw them on the fire.' },
  { id: 'batteries', title: 'Find batteries', detail: 'Check the doorsteps of the cabins', need: 2, counter: 'battery', target: SPOTS.cabinA,
    hint: 'The Player\'s flashlight needs batteries. The old cabins around camp used to have spare batteries by the doors.' },
  { id: 'fuse', title: 'Find the fuse', detail: 'Search the boathouse by the lake', target: SPOTS.boathouse,
    hint: 'The camp generator is missing its fuse. Silas used to fix things in the boathouse by the lake, on the east side.' },
  { id: 'power', title: 'Restore the power', detail: 'Fix the generator in the shed west of camp', target: SPOTS.generator,
    hint: 'The Player has the fuse. The generator shed is west of the fire. If the lamps come on, the Shades will have fewer places to hide.' },
  { id: 'pages', title: 'Find Silas\'s journal', detail: 'Pages are scattered in the woods', need: 3, counter: 'page', targets: PAGES,
    hint: 'With the power on, you remembered Silas always wrote in a journal. Its pages must be somewhere in the woods around camp. You are scared of what they say.' },
  { id: 'key', title: 'Get the ranger key', detail: 'Silas said it was at the end of the dock', target: SPOTS.dockEnd,
    hint: 'The journal said the ranger station radio still works, and the key is at the end of the dock on the lake. The ranger station is far north.' },
  { id: 'radio', title: 'Call for Silas', detail: 'Open the ranger station in the north and use the radio', target: SPOTS.rangerDoor,
    hint: 'The Player has the ranger key. The ranger station is in the north of camp. The radio might reach Silas.' },
  { id: 'finale', title: 'Hold the light', detail: 'Survive until Silas reaches the fire', target: SPOTS.fire, timer: 75,
    hint: 'Silas answered the radio and is coming to the fire. The Shades are swarming. Stay in the light and keep the fire burning.' },
  { id: 'reunite', title: 'Bring them together', detail: 'Talk to Silas at the fire', target: SPOTS.fire,
    hint: 'Silas is here, at the fire. You are crying and cannot believe it.' },
]

export const PAGE_TEXT = [
  { title: 'Page 1', text: 'Day 3.\nThe counselors left in the truck and never came back.\nMason is asleep in cabin B. I keep the fire going all night.\nThe shadows walk around the edge of the light but they never step into it.' },
  { title: 'Page 2', text: 'Day 9.\nI know what they are now. They are made of the dark.\nLight burns them. A flashlight makes them back off. Batteries are almost gone.\nIf Mason reads this: the generator needs a new fuse. I left one in the boathouse.' },
  { title: 'Page 3', text: 'Day ??\nSomething in me is changing. The dark doesn\'t hurt me anymore.\nI wear the mask so Mason won\'t see my face like this.\nIf you find my brother, keep him in the light.\nThe ranger radio still works. The key is at the end of the dock.' },
]

export function makeQuests(onChange) {
  const q = { index: 0, progress: 0, started: performance.now(), timer: 0, kills: 0 }
  q.step = () => STEPS[q.index]
  q.is = (id) => STEPS[q.index]?.id === id
  q.past = (id) => q.index > STEPS.findIndex((s) => s.id === id)
  q.advance = () => {
    q.index = Math.min(STEPS.length - 1, q.index + 1)
    q.progress = 0
    q.timer = STEPS[q.index].timer ?? 0
    onChange?.(STEPS[q.index], true)
  }
  q.bump = (n = 1) => {
    q.progress += n
    onChange?.(STEPS[q.index], false)
    if (STEPS[q.index].need && q.progress >= STEPS[q.index].need) q.advance()
  }
  // what Mason knows right now, for his prompt
  q.context = () => {
    const s = STEPS[q.index]
    const left = s.need ? ` (${s.need - q.progress} left)` : ''
    return `What is happening now: ${s.hint} The Player's current task: ${s.title} — ${s.detail}${left}. If the Player seems lost or asks what to do, tell them this in your own words.`
  }
  return q
}
