# Card Battle

Card Battle is the active card system. Its Credits, cards, decks and inventory use the existing local JSON or Supabase snapshot. Shoob collections are retained as historical data. During save loading, resolvable legacy auctions return the escrowed card and refund the last bidder. Unresolved auctions remain in the save. No new tables or environment variables are required.

## Commands

- `.cb help` — command directory
- `.cb start` — four level-5 Common or Uncommon cards and 500 Credits
- `.cb catalog [page or search]` — browse all 491 collectible cards
- `.ss <series> [page]` — search cards by anime or series
- `.ci <name> [C|R|SR|SSR|UR] [page]` — search by character name and optional tier
- `.cb collection [page or search]`, `.cb deck [indices]`, `.cb card <collection index> [moves]`
- `.cb cmi <card index> <move index>`, `.cb learn <card index> <move index> <forget index or 0>`
- `.cb wild`, `.cb claim`, `.cb pvp @user`, `.cb pvp accept`, `.cb pvp decline`
- `.cb move <number>`, `.cb switch [number]`, `.cb desperate`, `.cb pass`, `.cb heal`
- `.cb tower [start]`, `.cb exped [difficulty|select <a> <b> <c>|confirm]`
- `.cb shop [1|2]`, `.cb buy <number>`, `.cb openpack`, `.cb openspack`
- `.cb bag`, `.cb use <number> [move index]`
- `.cb merge <a> <b> <c>` (requires a defined higher-rarity version; none in the supplied base roster yet)

Direct aliases include `.starter`, `.catalog`, `.ss`, `.ci`, `.cards`, `.card`, `.deck`, `.wild`, `.claim`, `.pvp`, `.tower`, `.exped`, `.move`, `.switch`, `.forfeit`, `.cardshop`, `.bag` and `.heal`. Card Battle commands are group-only. `.wild` refreshes an idle encounter and leaves an active battle running. Scheduled checks run every 30 seconds during a WhatsApp connection.

## Collectible artwork

The bundled 491-entry Mazoku catalog is the collectible catalog and pack pool. Every catalog card can be collected, searched and viewed. The 20 catalog cards marked with `⚔` are mapped to existing fighters and can enter decks and battles now; the other 471 remain collectible-only until their battle stats and sprites are added. Existing saved battle cards and the full 37-character battle roster remain valid. Battles continue using sprites, while card details and pack reveals use collectible artwork. Remote AVIF artwork is converted to JPEG for WhatsApp when the CDN and image decoder are available. The original catalog rarity stays independent of Card Battle rarity.

The dashboard Cards tab shows the same catalog in a paginated artwork grid with name, series and tier filters. It labels battle-ready cards and cards that are still waiting for sprites.

## Beta decisions and limitations

- Ascension transformations and raids are not implemented. Ascension Cores can still accumulate for future releases.
- Merge validation exists but the base roster has no configured merge targets, so merging is not enabled for actual characters yet.
- Cards and Credits are separate from Shoob. PvP does not persist battle HP damage; Wild and Tower do. HP healing is free every 30 minutes. Consumables are disabled in PvP. Health Potion restores 30% maximum HP; status cures remove the first eligible effect; Energy Elixir reduces a selected cooldown; XP Booster can be activated outside battle. These are provisional balance choices.
- In the integrated Baileys client, `.p` shows your profile, `.p @user` shows a tagged profile, and replying with `.p` shows the quoted author's profile. On an unverified or missing target, the bot reports that the profile could not be found. The dashboard simulator and exported standalone script do not emulate WhatsApp profile identity.
- If image rendering fails, the command falls back to text. Run `node server/test-bot-audit.mjs` for the text-only identity, command, economy and persistence checks. Live WhatsApp and Supabase behavior require a paired deployment.
- Single-instance deployment assumed for the snapshot store; distributed concurrency has not been verified. Pack reveal sends the first card's artwork plus a summary of the full pack rather than one artwork message per card. Automatic notifications are best-effort and may be missed when completion is settled by a command before the timer.

## Testing

From project root, `node server/cardBattle/test-integration.cjs`. Other `test*.cjs` files in that directory cover roster, moves, progression, engine, renderer, wild, PvP, tower, expeditions and economy. Renderer test writes preview.png to working directory.
