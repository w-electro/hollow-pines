# Camp Hollow Pines — Roblox version

The same game as the browser version one folder up (`../src`, live at https://w-electro.github.io/hollow-pines/), rebuilt in Roblox Studio. The parent `CLAUDE.md` rules apply here too: nothing on C:, zero budget, 13+ horror (mild blood, no detailed injuries, torture or self-harm), no Friday the 13th names — the brothers are Mason and Silas.

## How we work

- Roblox Studio is connected through its built-in MCP server (`Roblox_Studio`, user scope). Studio must be open with the place loaded. Use a fresh place, never one the user cares about.
- Build by running Luau in Studio (`execute_luau`), check with `screen_capture`, test with `start_stop_play` and `get_console_output`. Look at the result after every major step — don't assume it worked.
- Keep the Luau that builds things in this folder too (e.g. `build/*.luau`, `scripts/*.luau`), so the map can be rebuilt and the code lives in git, not only inside the place file.

## The map (from the browser version — see `../src/world.js` for exact positions)

- Night, moon and stars, fog; dark but readable, like a Roblox horror map.
- A campfire in the middle with log seats; Mason sits by it.
- Three cabins (one with a bloody handprint on the door and a trail), a generator shed to the west, lamp posts that light up when the generator runs.
- A lake to the south with a dock and a boathouse; a ranger station far north.
- Dense pine woods all around, a dark ring of trees at the edge.

## The game (port in stages, after the map)

Objectives: meet Mason → firewood ×3 to the fire → batteries ×2 from cabin doorsteps → fuse from the boathouse → fix the generator → Silas's journal pages ×3 → ranger key on the dock → radio at the ranger station → survive the finale until Silas reaches the fire → reunite. Shades (shadow enemies with red eyes) avoid light, flinch from the flashlight, break apart after bat hits. Silas stalks and vanishes. Roblox gives multiplayer and phones for free; design for both.

Roblox can't run the browser version's AI models (Gemma dialogue, Kokoro voices). Check what Roblox's own AI APIs offer today before promising talking characters; written dialogue is the fallback.
