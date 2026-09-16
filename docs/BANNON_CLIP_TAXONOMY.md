# Bannon clip taxonomy

The live Euler bank (`assets/moves/clips/index.json`) has **202 clips**, not 500 separate Mixamo solos. Bone count on the clip tells you how to use it.

| Skeleton kind | Bone count | What it is | How to use |
|---|---|---|---|
| `mixamo52` | ~52 | Single-person Mixamo wrestler | Bind to `BANNON_rigged` / any roster fighter **now** |
| `canonical17` | 14–17 | Reduced/canonical (ZONE, TZ slams, Jungle Juice pairs, some taunts) | Retarget onto Mixamo before fight use |
| `combined_multi` | 200–1000 | **Attacker + opponent (or tag partners) in one FBX** | Labelled 1v1 / TAG. Do **not** play as a solo fighter until the clip is split |

The “500 bone wrestler clips” are these combined grapples — one file contains two (sometimes three) bodies.

## Cast

| Cast | Meaning |
|---|---|
| `solo` | One performer (strike, kick, loco, taunt, zone, reaction) |
| `attacker` | 1v1 throw/grapple — this clip is the giver |
| `victim` | Suffix `__RECV` or `VICTIM` — play on the opponent, paired with the attacker key |
| `tag` | `ASSISTED*`, `TAGSUPERKICK`, `DOUBLESUPLEX` — needs two allies |

Paired 1v1 examples: `JUNGLE_JUICE` ↔ `JUNGLE_JUICE__RECV`, `TZ_SCOOP_SLAM` ↔ `TZ_SCOOP_SLAM__RECV`, `TIGER_FEINT_KICK` ↔ `TIGER_FEINT_KICK__RECV`.

## Families in the bank

taunt (27) · zone (31) · throw (30) · locomotion (29) · strike (18) · kick (13) · unused_rig (12) · knockdown (9) · reaction (5) · stance (4) · cinematic (2) · wakeup (2) · weapon (1) · signature (rest)

Taunts in the bank: `TAUNT`, `TAUNT2`, `TAUNT_ARMS_WIDE`, `TAUNT_CALLOUT`, `TAUNT_FLEX`, `TAUNT_POINT`, `TAUNT_KOFIKINGSTON`, `TAU_BUTTSLAP`, `TAU_DIVA`, `TAU_GAMEOVER`, `TAU_GENERALFEMALE`, `TAU_HEADCRACK`, plus breakdance / capoeira / can-can / Brooklyn uprock / chest beating.

Tag (keep out of singles until we have a tag match): `ASSISTEDCUTTER`, `ASSISTEDDIVSENTON`, `ASSISTEDREVERSEGOOZLECHOP`, `TAGSUPERKICK`, `DOUBLESUPLEX`.

`unused_rig` (`Y_BOT`, `CH06_NONPBR`, Mixamo shop names) is inventory, not a wrestler move.

Drive FBX that is not in `index.json` yet stays unindexed — add it to the bank, then re-run the classifier.

Moveset Editor filters: **SOLO / 1v1 / TAG / TAUNT / COMBINED**.
