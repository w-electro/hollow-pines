# Camp Hollow Pines

A browser horror game for players 13+. An abandoned summer camp at night: Mason came back to find his lost brother Silas, and something else came back too. Fight the shades with a bat and a flashlight, keep the campfire alive, restore the power, find Silas's journal, and bring the brothers together.

The characters talk back and speak out loud. Their words come from a small AI (Gemma 3 1B) and their voices from another (Kokoro, 82M), both running on the player's own computer. There is no server: nothing a player types leaves their device.

**Live:** https://w-electro.github.io/hollow-pines/ — Chrome or Edge on a computer with a decent GPU. The first visit downloads about 850 MB, once.

## Controls

| | |
|---|---|
| WASD / arrows | move |
| Shift | sprint |
| Mouse drag | look around |
| Click | swing the bat |
| Right click (hold) | focus the flashlight — burns shades, drains the battery |
| E | pick up, use (hold at the generator) |
| Enter | talk to someone nearby |
| 1 | use a bandage |

## What's in it

- **Story:** eight objectives from the campfire to a finale and an ending; Mason's AI knows the current objective and gives hints.
- **Fights:** shades hunt you in the dark, avoid firelight and lamps, flinch from the flashlight and burn under a focused beam; three bat hits break one apart.
- **Survival:** health, stamina, a flashlight battery, a fire that burns down and needs wood, bandages and batteries dropped by shades.
- **Ecosystem:** deer and rabbits graze and bolt, crows scatter; shades hunt the rabbits too.
- **Voices:** each line goes through its own horror effect chain (Silas: pitched down, distorted, echoing) and comes from where the character stands.

## Safety

Players are teenagers, so safety is in code, not just in the prompt:

- Requests for violent detail never reach the model; the character refuses in character.
- Every reply is checked word by word as it streams; a violent description is stopped, never shown, never spoken, never remembered.
- Self-harm wording pauses the game and shows a note telling the player to talk to a trusted adult. A character never handles that.

Content level: mild blood, like Roblox horror games rated 13+. No detailed injuries, torture, or self-harm.

## Develop

```
npm install                 # libraries (this drive)
python serve.py             # http://localhost:8765 — models served from D:\W\.spike-model-cache
node tests/story.mjs        # plays the whole story to the win screen in Chrome
node tests/play.mjs         # talking and fighting
node tests/perf.mjs         # frame rate
```

Code is plain ES modules in `src/`, no build step. Voice engine: `src/voice-worker.js` (text normalisation and phonemes adapted from [kokoro-js](https://github.com/hexgrad/kokoro), Apache-2.0). `coi.js` makes the live page cross-origin isolated so the voice can use several CPU threads.
