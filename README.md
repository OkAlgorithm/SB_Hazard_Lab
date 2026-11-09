# Samruk · Обход рабочего места

Working browser prototype of a Russian-language industrial hazard identification course.

This standalone export contains the published course with the repaired 3D startup. The application source comes from commit `14563a1de6a4de4a9b491ac8c5f5855ec6414efe`.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Select **«Знакомство с цехом»** to open the 3D workshop.

```sh
npm test
npm run build
npm run preview
```

## Deploy from GitHub to Vercel

1. Extract the ZIP into a folder. Use the folder containing `package.json` and `vercel.json` as the repository root.
2. Create an empty GitHub repository. From the extracted folder, run the commands below with your repository URL.
3. In Vercel, add a new project and import the GitHub repository. Choose the repository root and the **Vite** preset. The included `vercel.json` sets the build command to `npm run build` and the output directory to `dist`. Deploy the project.

```sh
git init -b main
git add .
git commit -m "Initial Samruk Hazard Lab"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

All required models, textures, illustrations, and MP3 narration files are included in `public/`. The build needs no environment variables or service keys. The scripts in `tools/` are optional for regenerating assets.

The course uses a demo Sign In button and stores learner progress in the browser. For internal distribution, set the intended access policy on the deployed site.

## Included

- Seven lecture chapters using the approved Russian narration and instructor portrait. The default 2D view uses concept artwork with chapter-specific clickable objects, zoom, drag-to-pan and keyboard-accessible object buttons. A 2D/3D switch retains the existing 3D camera views and animated examples without restarting narration or lecture progress. Three optional observation checks give immediate explanations and save their progress locally.
- Optional self-hosted Russian neural narration (Silero CIS base, male `ru_eduard` voice). Seven MP3s preserve the lecture text and existing three-minute scene timing. Playback supports pause/resume, chapter changes and mute without relying on installed browser voices. Audio provenance is in `public/audio/lecture/manifest.json`.
- A concept-led industrial workshop with a detailed original GLB lathe, textured concrete, plaster, painted steel and wood, a complete windowed interior, ceiling structure, services and a distant industrial yard. Three inspection zones, an eye-level starting camera, an optional cutaway overview, mouse/keyboard controls and on-screen movement buttons.
- Four static hazards, three distractors and two authored 12-second 3D animation episodes with pause, seeking and scene-based selection.
- Explicit marking and category confirmation, editable journal, four-minute and untimed attempts, full feedback and the «Глаз-алмаз» badge. Untimed practice explains each confirmed mark immediately; timed assessment defers explanations until the result.
- Local progress/attempt persistence. The timer uses a deadline rather than counting animation frames, so switching tabs does not pause an active attempt.
- WebGL rendering through Babylon.js. A small CPU rasterizer uses the same Babylon geometry, transforms and ray picking if WebGL is unavailable. It renders at a lower frame rate with a cached directional shadow map, warm pendant fill and approximate metal highlights. Near-plane clipping preserves visible surfaces while walking; texture transparency and perspective correction keep observation pins and signs readable.
- Text descriptions of static objects as an alternative to spatial inspection. Compact navigation and a fixed attempt toolbar keep the timer, marking and journal available on narrow screens.

## Structure

| File                        | Responsibility                                                             |
| --------------------------- | -------------------------------------------------------------------------- |
| `src/content.json`          | Lecture, hazards, categories, feedback and production notes                |
| `src/assessment.ts`         | Selection validation, unique marks, deadline and deterministic scoring     |
| `src/episode-timeline.ts`   | Shared animation timing and accepted answer intervals                      |
| `src/workshop.ts`           | Procedural scene, cameras, controls, selection and authored animation      |
| `src/workshop-shell.ts`     | Workshop architecture, windows, services, yard and overview cutaway        |
| `src/workshop-materials.ts` | PBR textures, physical UV scales, lighting environment and raster sampling |
| `src/workshop-lighting.ts`  | Shared sun/lamp layout, bounded retina resolution and shadow raster maths   |
| `src/software-shadows.ts`  | Cached geometry-based directional shadows for the compatibility renderer    |
| `src/software-renderer.ts`  | Compatibility renderer for browsers without WebGL                          |
| `src/Workshop.tsx`          | React/Babylon lifecycle boundary                                           |
| `src/LectureArtwork.tsx`    | Interactive 2D lecture artwork, object inspection, zoom and pan            |
| `src/lecture-art.ts`        | Chapter-specific visible objects, source quotes and inspection notes       |
| `src/Episode.tsx`           | Animation playback and seeking controls                                    |
| `src/App.tsx`               | Lecture, preparation, attempt, journal and review flow                     |

## Scoring

+10 per unique hazard, +5 for its correct category, −5 per unique false mark, floor zero, maximum 90. Repeated marks update the category without multiplying points. H5 requires episode V1 at 6–10 seconds; H6 requires episode V2 at 4–9 seconds. The long-load animation is calculated from the same authored time interval and tested against the path boundaries.

The badge requires six correct findings, six correct categories and no false marks in the timed attempt. Untimed practice receives points but no timed badge. These are pilot parameters, not an official corporate certification rubric.

## Prototype boundaries

- Sign In is a mock session button. It does not authenticate or transmit learner identity.
- Progress exists only in this browser. There is no employee database, server-validated grade, LMS, SSO, certificate or analytics service.
- Equipment geometry approximates the approved concept and the proportions of a 1К62-style lathe. It is not manufacturer CAD. Production equipment, animation, signage and the hazard taxonomy still need review by the client's safety specialist.
- Episodes are interactive 3D animations, not MP4 files. Their authored movement can later be produced with Blender/GLB assets or rendered as video.
- Browser QA covered the software renderer in the provided browser, including canvas selection, video marking, journal editing, completion and persistence. A real-device pass is still needed for the GPU renderer, iOS and Android.

## Assets

The original lathe GLB is authored with the reproducible Blender script `tools/build-lathe.py` (15,248 triangles, joined by material). Remaining workshop architecture and props are built in application code. CC0 Poly Haven materials and the Babylon environment are self-hosted under `public/assets/workshop`; provenance and SHA-256 hashes are in `CREDITS.md` and `asset-manifest.json`. The fetch script is `tools/fetch-workshop-materials.py`. No runtime asset CDN is required. The instructor portrait is reused from the preceding module. The 2D lecture uses the approved concept artwork and two derived teaching frames in `public/assets/lecture-art`; its credits distinguish illustrative scenes from recorded events. Manrope is bundled locally through `@fontsource/manrope`; UI icons use Lucide. Dependency licences remain available in their respective packages.

## Extending

Keep stable hazard IDs when replacing meshes. Update the scenario version when assessment geometry, timing or answers change. Keep lesson content, grading and rendered geometry separate. For production employee records, add authenticated server-side attempt storage and validate submissions there. Choose an LMS adapter only after confirming the target LMS and its supported standard.

## Version 0.2

The hazard IDs, categories, timing and grading rubric remain unchanged. Visual details now include a visibly split cable jacket and exposed conductors, irregular liquid boundaries, crate planks, machine-tool controls and numbered observation pins. Selection respects visible occluding geometry. The engine chunk groups only actually imported Babylon modules rather than importing the root engine bundle.

## Version 0.3

The approved workshop concept is implemented as real 3D geometry and materials in the existing course. Both animations share the workshop architecture and material library. The starting view is at eye level; overview hides the near walls and ceiling. The expanded scene works inside the page, including browsers without the Fullscreen API, and Escape closes it. GPU rendering uses normal/roughness maps, environment reflections and directional shadows. The software renderer shares the geometry, albedo textures, picking and assessment logic, with simpler lighting and correct opaque-before-transparent composition. GPU appearance and touch performance still require real-device validation. The concept illustration is not used as a flat background for the inspection.

## Lighting and material refinement

One low afternoon sun enters through the left windows; four warm downward lights align with the visible ceiling pendants. Reduced ambient illumination preserves depth. Cabinet enamel, rack paint, wood, cast iron, brass and machined steel use distinct finishes. Exposed metal is reflective; painted surfaces are dielectric. WebGL uses filtered shadows, restrained contact occlusion on supported desktop GPUs, antialiasing, anisotropic texture filtering and a device-pixel render ratio capped at 1.75 with a 2.8-megapixel target budget. Large displays retain at least CSS resolution. Phone input and WASD settings are preserved.

The compatibility renderer now casts directional shadows from the actual workshop geometry, including window frames and equipment. Its 768px shadow map updates when geometry changes, at most five times a second for moving scenes, and texture sampling copies retain 1024px detail. The GPU still uses the shipped 1K/2K source maps. Browser QA can verify the compatibility path here; final GPU appearance and real-phone performance require hardware validation.
# SB_Hazard_Lab
