# Tekken Research Integration

These sources are pinned under `Research/` as Git submodules. They are research/tooling inputs, not competing game engines and not a license to copy proprietary game assets.

| Source | Role in Brutal Fist | Integration boundary |
|---|---|---|
| `Modding-Zaibatsu/ue4-tekkengame` | UE4/Tekken 7 structural reference | Study class/data/asset-pipeline organization; do not make UE4 the BF runtime foundation. |
| `emiraldol/Tekken_HY352` | Combat/frame-data DSL reference | Mine explicit frame/mathematical modeling ideas and reconcile them into BF's single move contract. |
| `xan1242/Tek3Ex` | Tekken 3 BinStream extractor/packer | Isolate as archival/research tooling for lawful local dumps; never require copyrighted game data in BF CI. |
| `FishB0nes98/Tekken3Recompiled` | PS1 Tekken 3 native recompilation/reference | Study reverse-engineered runtime architecture, fixed-point/PS1-era constraints, rendering/resource boundaries, and gameplay state; do not import proprietary assets or retail data into BF. |

## Source authority

1. User/BF requirements
2. BF shared contracts
3. Bannon authoritative fighter/content data
4. Schwarzerblitz native runtime semantics
5. Verified Grok v1-v7 architecture
6. Tekken research sources
7. Other supporting engines/tools

The Tekken sources can improve BF's architecture, frame modeling, tooling, resource understanding, and PS1-era presentation. They do not override Bannon character authority or Schwarzerblitz runtime authority.

## Current pinned commits

- `ue4-tekkengame`: `f0cc2e7cb2e4801676d77932be9738033ec2c060`
- `Tekken_HY352`: `aa3e1b5553e6e329cc72ae708fc58f8040b78e6d`
- `Tek3Ex`: `448e63cb06baa502af0b09ab70dab1d3bd58f3eb`
- `Tekken3Recompiled`: `8a23a51a6d93aa54b6358c6c99abf5b241509b4d`

## Explicit safety/clean-room boundary

No retail Tekken executable, ISO, proprietary character model, texture, animation, sound, or other copyrighted asset is copied into Brutal Fist by this integration. `Tek3Ex` and the recompiled project may be used against legally owned local material outside the repository; BF source control must remain free of those retail assets.
