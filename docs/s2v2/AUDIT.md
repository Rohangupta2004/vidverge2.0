# Script-to-Video audit and S2V 2.0

Workspace: Vidverge (workspace-660069). Audited from the downloaded source (845 files) and the server functions `stv-scene-generate`, `s2v-recovery-sweeper`, `s2v-film-qa` and `asset-image-gen`, on 13 Nov 2026. No paid render was run, so none of the quality claims below have been measured on real clips yet.

## Why clips come out inconsistent or distorted

| # | Finding | Where | Effect |
|---|---|---|---|
| 1 | Films made in the default 3-step studio never get the anti-distortion shot spec. The studio saves a short field prompt (`composePrompt`). Start writes the full SHOT SPEC (start pose, end pose, hands, physical plausibility, MUST NOT list) only when a clip's prompt is empty, and the browser path reuses the studio prompt verbatim. | `studioFilm.ts`, `App.tsx` `startUnattendedProduction` → `preparePrompt`, `orchestrator.ts` `prepareScene` (`prompt_source === 'studio'`) | No "no morphing / no extra fingers / no warping faces" rules, and no planned end pose to seed the next clip. |
| 2 | Clips are packed to each model's maximum length (up to 30s on Seedance), with all the beats squeezed into one timed beat. | `studioAgent.ts` BREAKDOWN prompt ("as close as possible to the model's MAXIMUM"), `studioFilm.ts` (one `timed_beats` entry per clip) | Rushed, overloaded motion. This is the biggest single cause of warping. |
| 3 | On Kling 3.0 (and Kling 3.0 Omni with a single reference, plus Seedance 2.0), a new shot uses the character sheet itself as the first frame. Character sheets are collages (front view plus close-up), and Kling ranks sheets above storyboard frames. | `s2v-recovery-sweeper` `klingReferencePlan`, `submitScene` (`!seed && refs[0] → imageData`) | The model has to morph a reference collage into a scene, which produces classic distortion in the first second. |
| 4 | The runner never sends a negative prompt. `spec.negative` is computed and then unused. | `s2v-recovery-sweeper` `submitScene` `requestBody` | Kling and Seedance lose their native "avoid" channel. |
| 5 | Every render is fixed at 720p. | same `requestBody` (`resolution: '720p'`) | Small faces in wide shots warp more. |
| 6 | On Kling 3.0 and Seedance, continuing clips get only the previous clip's last frame, with no character sheet. Gemini Omni Flash (and Kling Omni on its multi-image route) send the frame and the sheets together. | `plannedReferences` / `klingReferencePlan` | Faces drift over long films on frame-only models. |
| 7 | The finished-film check looks for black frames, missing sound and a cut-off ending, but not for warping. Per-clip checks only confirm that the expected people are visible. | `s2v-film-qa`, frame-chaining report | A warped clip passes, and its last frame seeds the next clip. |
| 8 | The UI has three creation flows (3-step studio, classic CreateFlow, handoff), plus a Simple / More detail toggle, a Blocks panel, AutoRunChecklist, AssemblyBar and FilmFixPanel, all in a 3,020-line App.tsx. | `apps/ScriptToVideo/App.tsx` | Overlapping screens and unclear progress. |

## What S2V 2.0 changes (app side only, no server change)

- **Every clip is directed.** The full SHOT SPEC is written for every clip, plus motion-realism rules: one action per beat, never a fast camera and fast subject together, the motions models usually distort staged in their simplest form, faces kept large, the 180-degree rule, and a clean still end frame. Clips are directed in sequence, so clip N's start pose is clip N−1's end pose.
- **Realistic pacing by default.** Clips are capped at Omni 8s, Kling 10s, Seedance 2.5 10s and Seedance 2.0 8s, and each clip carries real timed beats.
- **Seven extra MUST NOT items** cover identity changes, wardrobe and colour drift, limbs passing through bodies, crawling textures, sliding feet, duplicated people and captions.
- **Start frames for new shots** are drawn *from* the locked character sheets as a single full frame (image-to-image, high fidelity). The video starts from a real frame instead of a collage. This applies to Omni, Kling Omni and Seedance 2.5; Kling 3.0 still prefers the sheet (finding 3), so it gets none.
- **Turnaround character sheets** show three views (front, three-quarter, close-up) with both hands visible.
- **Every finished clip is checked.** Four sampled frames are judged for artifacts, identity drift and plan match. If a clip looks off, production pauses before its last frame can seed the next clip, and you choose: re-render (re-directed to avoid the problems found, after a cost confirmation) or keep it.
- **Honest model guide** in the picker: "Same people" and "Motion" ratings, taken from how the runner actually routes references.
- **New UI** with four steps (Brief → Plan → Make → Finish), a plan screen showing cast, shots, beats, end poses, the exact prompt and a quality checklist, and the cost confirmed before anything renders.

**Unchanged and reused:** films, scenes and the library (shared with the old app), Start, the background runner, credits, refunds, frame chaining, audio and assembly. Billing recovery is copied verbatim into `recovery.ts`.

## Server changes I'd propose (each needs your yes; they go live for both apps at once)

1. Kling 3.0 / single-reference routes: prefer a scene start frame over a character sheet as the first frame (finding 3).
2. Send `negativePrompt` from `spec.negative` on the models that accept it (finding 4).
3. Optional 1080p for close-ups on models that support it (finding 5). This changes cost.
4. Use first-frame plus last-frame interpolation (`lastFrameImage`) on Omni and Seedance 2.5 when the next clip's start frame is known.

## Files

- `apps/S2V2/App.tsx`: controller (planning, production, polling, the clip-check hold, re-render)
- `apps/S2V2/screens.tsx`: Library, Brief, Plan, Make and Finish
- `apps/S2V2/quality.ts`: model profiles, pacing, shot director, start frames, clip check
- `apps/S2V2/recovery.ts`: refund and runner recovery, copied unchanged from Script-to-Video
- `apps/S2V2/model.ts`: types and helpers
- `apps/S2V2/theme.ts`: styles on the Vidverge tokens
- `config.json.patch`: adds the "S2V 2.0" dock entry next to Script-to-Video

**Verified:** TypeScript strict check against the real workspace code passes with 0 errors in these files.

**Not verified:** a live preview, and any paid render.
