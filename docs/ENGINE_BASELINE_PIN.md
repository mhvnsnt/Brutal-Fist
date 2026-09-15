# Schwarzerblitz baseline pin

Pinned upstream engine commit: `83287a2e9c5f77408e176136ecca047067a3cc24`.

The upstream project states that its engine code is BSD 3-Clause, while its included characters, stages, music and other game assets are not covered by that engine license and may not be redistributed. Brutal Fist therefore uses the engine as a pinned source dependency and does not import upstream game assets.

The engine documentation also describes a Windows/Visual Studio/DirectX 9 baseline and .X skeletal-character format. Brutal Fist's content pipeline therefore treats Bannon GLBs as source assets and converts/validates them into the engine's resource boundary rather than copying upstream characters.

Target migration:
- preserve engine architecture and required notices;
- replace game-specific content with Brutal Fist/Bannon content;
- retain provenance for every upstream dependency;
- progressively replace upstream subsystems where that reduces technical debt;
- never treat modification alone as a license change.
