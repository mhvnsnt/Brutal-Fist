# Brutal Fist canon source

**Do not guess gender, names, or bios.** Authoritative source is `mhvnsnt/Bannon`:

- `canon/01_book1_life_in_limbo.md` and later `canon/0*_book*.md`
- `Off The Top Rope_ *.txt` book files
- `canon/characters/*.txt`
- `canon/godwithin/`
- `assets/models/CANON_MODELS.md`

If a roster line contradicts those files, the book wins.

## Pronouns

| Identity | Who | Pronouns |
|---|---|---|
| **Marquis Deshaun Whitacre** | Real man under every mask | he/him |
| **Bannon** | His masked heel | he/him |
| **Maime** | Feral alter, **same man**, not a woman | he/him |
| **Finxsse** | Narvin Jackson | he/him |
| **Stick-Up / Jackboy** | Andre Curtis | he/him |
| **Tyneshia (Tye) Hall** | The Anchor | she/her |
| **Grixf / Artemis** | Analytical rival | he/him |
| **Cain Elias** | The Executioner | he/him |
| **Cody Callahan** | Corduroy Kid | he/him |
| **Hall Nighter** | Showstopper / HBK, Book 6 | he/him |
| **Triple XXX** | Lars Van Horn | he/him |
| **Onyx** | Obsidian Hex, game-only | she/her |
| **Echo** | Mimic/Read, Onyx stable | she/her |
| **Cipher** | Anti-Pattern, Lio Rush-type | he/him |
| **Static** | Enzo-type interference | he/him |
| **Hollow** | LP 0, silent | **not stated — do not guess** |
| **Tarzanian Devil** | Tarzan Duran indie | he/him |

Marquis / Bannon / Maime are **one man**. Maime's playable slot still uses he/him.

## Visual budget

Maime is the PS1 yardstick: **~18,108 triangles, 256px textures**. `src/data/maimePolyBudget.ts`. Do not upscale. Decimate over-budget playable GLBs with `tools/psx/decimate-fighter.mjs`. Do not rewrite skin weights to hit the number (Jager stays slightly over because simplify would eat JOINTS_0).
