# Card Battle beta integration

This is an additive update to the supplied The-new-world bot archive. No existing Shoob card collection, Gold balance, AI conversation, or moderation data is migrated or overwritten. Card Battle uses its own Credits, card instances, decks and inventory under the optional `cardBattle` key in the existing bot snapshot (local JSON and configured Supabase snapshot). No new environment variables or database tables are required. Back up the existing bot and persistent data before deploying. Install and run using the project's existing commands.

## Commands

- `.cb help` — command directory
- `.cb start` — one-time starter pack and 500 Credits
- `.cb collection`, `.cb deck [indices]`, `.cb card <index> [moves]`
- `.cb cmi <card index> <move index>`, `.cb learn <card index> <move index> <forget index or 0>`
- `.cb wild`, `.cb claim`, `.cb pvp @user`, `.cb pvp accept`, `.cb pvp decline`
- `.cb move <number>`, `.cb switch [number]`, `.cb desperate`, `.cb pass`, `.cb heal`
- `.cb tower [start]`, `.cb exped [difficulty|select <a> <b> <c>|confirm]`
- `.cb shop [1|2]`, `.cb buy <number>`, `.cb openpack`, `.cb openspack`
- `.cb bag`, `.cb use <number> [move index]`
- `.cb merge <a> <b> <c>` (requires a defined higher-rarity version; none in the supplied base roster yet)

Unoccupied direct aliases include `.pvp`, `.tower`, `.exped`, `.move`, `.switch`, `.bag`, `.heal`, `.openpack`, `.openspack`, `.merge`, `.learn`, `.cmi`, `.wild`. Existing `.card`, `.claim`, `.deck`, `.cardshop`, `.buy`, and `.use` retain original behavior; use `.cb` equivalents for the new system. The new commands are group-only. `.cb wild` enables subsequent group spawns approximately every 30 minutes while connected. Scheduled sweeps run every 30 seconds when WhatsApp is connected; expiry and reward settlement also occur during successful game commands. Scheduled messages are best-effort, not durable delivery receipts.

## Beta decisions and limitations

- Ascension transformations and raids are not implemented. Ascension Cores can still accumulate for future releases.
- Card art uses the provided battle sprites; full collectible art and alternate forms are not supplied. Merge validation exists but the base roster has no configured merge targets, so merging is not enabled for actual characters yet.
- Cards and Credits are separate from Shoob. PvP does not persist battle HP damage; Wild and Tower do. HP healing is free every 30 minutes. Consumables are disabled in PvP. Health Potion restores 30% maximum HP; status cures remove the first eligible effect; Energy Elixir reduces a selected cooldown; XP Booster can be activated outside battle. These are provisional balance choices.
- Direct mention handling uses existing Baileys JID identity; mixed phone/LID identities and live WhatsApp delivery require testing on a paired account. Existing dashboard simulator strips image buffers and does not emulate real WhatsApp mentions.
- All 10 original module test suites and the adapter integration test passed (renderer using Sharp fallback available in test environment). Modified TypeScript syntax checked; full dependency installation, project build/type check, native Canvas backend and live WhatsApp/Supabase were not tested. The original package already depends on @napi-rs/canvas; no production dependency changes were made. If image generation fails, the command falls back to text.
- Single-instance deployment assumed for the snapshot store; distributed concurrency has not been verified. Pack reveal currently sends a summary rather than individual artwork messages. Automatic notifications are best-effort and may be missed when completion is settled by a command before the timer.

## Testing

From project root, `node server/cardBattle/test-integration.cjs`. Other `test*.cjs` files in that directory cover roster, moves, progression, engine, renderer, wild, PvP, tower, expeditions and economy. Renderer test writes preview.png to working directory.
