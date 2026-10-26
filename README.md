# HeadForge Studio Pro

A browser-based 3D character creator (head, face, skin, eyes, grooms, barber tools) built on Three.js r128, evolved from *3D Head Hair Studio v2*. Open `index.html` in a modern desktop browser with WebGL; no install needed (Three.js loads from a CDN).

## Tools
- **Blend** – DNA-style blend wheel between six face archetypes, plus random face/character.
- **Face** – 33 symmetric region controls (head, brows, eyes, nose, cheeks, mouth, jaw, ears, neck) and an Age slider (sagging, wrinkles, greying).
- **Sculpt** – free sculpting on a Loop-subdivided mesh (up to 60k tris): Draw, Inflate, Grab, Smooth, Flatten, Restore, with X symmetry. Hair, brows, lashes, eyes and mouth follow the surface.
- **Skin** – melanin × undertone tone map, roughness, pores, freckles, under-eye darkness, oil, subsurface scattering, translucency.
- **Eyes** – procedural irises (fibres, crypts, limbal ring), heterochromia, pupil/eyeball size, sclera, gaze modes, strand eyelashes.
- **Makeup** – lipstick + gloss, blush, eyeshadow, eyeliner.
- **Hair** – 13 styles, up to 140k GPU strands, real-time guide-hair physics, material controls, strand eyebrows.
- **Facial hair** – stubble, mustache, goatee, boxed, full and long beards as strand grooms.
- **Barber** – clipper with guards, blades, motors and auto fade; cuts scalp hair and beards; timed scoring challenge.
- **Expressions** – 9 expression controls, emotion presets, live Idle / Talking / Emotion-tour previews.
- **Lighting** – 8 lighting rigs with matching reflections, rotation, exposure, tone mapping, backgrounds (incl. transparent / green screen), focal length, turntable.
- **Export** – PNG up to 4×, GLB and OBJ (mesh + baked hair strands), save/load full character JSON (including sculpt and haircut).
- Undo/redo (Ctrl+Z / Ctrl+Y), viewport modes (lit, clay, wireframe, topology), English / العربية UI with RTL.

## Development
Sources live in `src/` (`template.html`, `app.js`, `head-data.js`). Rebuild the single-file app with:

```sh
node build.mjs   # writes index.html
```
