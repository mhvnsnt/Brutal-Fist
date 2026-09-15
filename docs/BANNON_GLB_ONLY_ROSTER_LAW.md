# Brutal Fist — Bannon GLB-Only Roster Law

## HARD RULE
Only Bannon characters with an actual GLB character model in mhvnsnt/Bannon may enter the Brutal Fist playable roster.

A character that exists only as a procedural model, procedural definition, metadata record, concept, or placeholder in Bannon is NOT a Brutal Fist character.

This rule is absolute.

## Promotion rule
Bannon roster record + actual character GLB exists + GLB loads + unified skinned mesh passes + canonical skeleton/rest pose passes + required animation/resource gates pass = PLAYABLE BRUTAL FIST FIGHTER.

Anything missing a requirement remains OUT of the playable roster.

## Never do this
- create a procedural fighter because a Bannon metadata record exists;
- generate a primitive character to fill a roster slot;
- turn a procedural-only Bannon character into a playable fighter;
- use a procedural fallback when a GLB is missing;
- silently substitute an unrelated GLB;
- display a procedural character in Character Select as if it were real;
- count procedural geometry as evidence that a GLB exists.

## Character Select rule
Character Select must be generated from the validated GLB-backed roster manifest, NOT every Bannon metadata record.

Classify every source record as:
- GLB_PLAYABLE
- GLB_INVALID
- PROCEDURAL_ONLY
- MISSING_ASSET

Only GLB_PLAYABLE reaches normal playable Character Select. PROCEDURAL_ONLY is never playable.

## Renderer rule
The match renderer must receive a validated GLB-backed fighter resource. If it receives a procedural-only resource, fail closed during development/QA instead of rendering a fake character.

## Asset discovery
The authoritative question is: Does Bannon contain an actual GLB character model for this specific fighter?

Do not infer GLB availability from names, bios, procedural code, screenshots, previews, or generated geometry.

## Animation rule
Animations may come from Bannon and other approved sources, but an animation does not make a procedural-only character eligible. The character must first have its own actual GLB model.

## QA acceptance
The roster build must report total Bannon records inspected, GLB-backed characters found, valid/invalid GLBs, procedural-only records excluded, missing assets excluded, final playable count, and exact promoted fighter IDs/names.

UNKNOWN is never PASS.

## AI instruction
If procedural-only Bannon characters appear in the playable roster, that is a build defect. Fix the roster-generation pipeline so the eligibility filter enforces GLB-only promotion automatically on every rebuild.

Do not solve this by manually deleting individual characters.

## Visual relationship
Every qualifying fighter remains real 3D polygonal geometry under PS1_3D by default. RETRO8 is optional and must never replace a GLB with a procedural/sprite character.
