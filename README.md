# Camp Hollow Pines

A browser horror game for players 13+. You explore an abandoned summer camp at night with a flashlight. Mason is looking for his lost brother; Silas, the masked figure in the trees, is looking for him too. Walk up to either and talk — they answer.

The characters are a small AI (Gemma 3 1B) running on the player's own GPU through WebGPU. There is no server: nothing a player types leaves their device.

**Live:** https://w-electro.github.io/hollow-pines/ — needs Chrome or Edge on a computer with a decent GPU; the AI is a one-time ~750 MB download.

## Controls

WASD / arrow keys to move, or click the ground to walk there. Get close to someone to talk.

## Safety

Players are teenagers, so safety is in code, not just in the prompt:

- Requests for violent detail never reach the model; the character refuses in character.
- Every reply is checked word by word as it streams; a violent description is stopped, never shown, and never remembered.
- Self-harm wording pauses the game and shows a note telling the player to talk to a trusted adult. A character never handles that.

Content level: mild blood, like Roblox horror games rated 13+. No detailed injuries, torture, or self-harm.

## Develop

```
npm install            # libraries, on this drive
python serve.py        # http://localhost:8765 — model served from D:\W\.spike-model-cache
node tests/play.mjs    # automated play-through in Chrome
```
