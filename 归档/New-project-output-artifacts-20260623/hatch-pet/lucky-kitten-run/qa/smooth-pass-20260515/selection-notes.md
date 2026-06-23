# Smooth Motion Pass

Date: 2026-05-15

Codex pet playback uses fixed row frame counts, so this pass keeps the 8x9 atlas contract and improves continuity inside the existing frame slots.

Accepted rows:
- `idle`: smoother breathing/blink loop.
- `jumping`: clearer crouch, lift, peak, descent, settle sequence.
- `failed`: softer sad-to-recover loop.
- `waiting`: clearer expectant/user-input pose.
- `running`: smoother focused-work loop, not directional locomotion.
- `review`: smoother inspect/blink/head-tilt loop.

Preserved rows:
- `running-right`: kept current stable row.
- `running-left`: kept current stable row.
- `waving`: kept the prior mirror-fixed row where frame 2 is an exact mirror of frame 1.

Rejected candidate:
- `running-right` smooth-pass candidate: visually energetic, but the mirrored `running-left` test placed some frames too close to the cell edge, creating crop risk.

Validation:
- `validate_atlas.py`: passed.
- Atlas size: `1536x1872`.
- Transparent RGB residue: `0`.
- Unused cells: transparent.
