Build a single-page static web app (pure HTML/CSS/JavaScript — no framework, 
no build step, no bundler) that must be deployable directly on GitHub Pages 
by just pushing the repo. Everything must run client-side in the browser.

PROJECT STRUCTURE
- index.html
- style.css
- script.js
- /libs (vendored copies of any third-party JS, e.g. gif.js + gif.worker.js, 
  downloaded locally — do NOT rely on a CDN that might be blocked or go down)
- README.md with exact GitHub Pages deployment steps (which branch/folder to 
  publish from, and that it needs zero configuration beyond enabling Pages)

CORE FEATURE 1 — Static Pencil Sketch
- User uploads an image (drag-and-drop area + file picker button).
- Convert the image to a realistic pencil-sketch using canvas: grayscale → 
  invert → gaussian blur → "color dodge" blend against the grayscale layer 
  (the standard photo-to-pencil-sketch technique). Implement this manually 
  with canvas pixel manipulation (ImageData), no external image-processing 
  library needed.
- Show a live preview, plus a slider to control sketch intensity/blur radius 
  and a toggle for "pencil" vs "charcoal" style if easy to add.
- Export button: "Download PNG" — saves the final sketch as a .png at the 
  original image resolution using canvas.toBlob().

CORE FEATURE 2 — Animated "Drawing From Scratch"
- Using the SAME uploaded image, simulate the sketch being drawn progressively 
  on a blank canvas, as if a hand were sketching it stroke by stroke, ending 
  at the same final pencil-sketch result from Feature 1.
- Implementation approach: 
  1. Compute the final sketch's edge/line map (e.g. via Sobel edge detection 
     or the dodge-blend sketch output thresholded into strokes).
  2. Extract line paths/contours from that edge map (simple approach: sample 
     dark pixels in a sensible drawing order — e.g. sort by contour/connected 
     components, or scan in a natural sequence — and reveal them progressively 
     rather than truly vectorizing).
  3. Animate by incrementally drawing more of the strokes onto a canvas each 
     frame, going from a blank canvas to the fully drawn sketch over ~3-6 
     seconds, with a visible "drawing" progression (not just a fade-in or 
     wipe — it should look like linework accumulating).
  4. Show this animation live in the browser (play/pause/replay controls).
- Export button: "Download GIF" — captures the actual animation frames and 
  exports as an animated .gif using the gif.js library (vendor gif.js and 
  gif.worker.js locally in /libs so it works offline on GitHub Pages; make 
  sure the worker script path is correctly referenced relative to index.html, 
  since GitHub Pages serves from a subpath like username.github.io/repo/).
- Show a progress indicator while the GIF is being encoded, since gif.js 
  encoding can take a few seconds.

UI/UX REQUIREMENTS
- Clean, responsive layout that works on mobile and desktop.
- Clear tabs or sections: "1. Static Sketch" and "2. Drawing Animation".
- Loading/progress states for both sketch generation and GIF export (don't 
  let the UI look frozen during processing).
- Handle large images gracefully (downscale internally for processing if 
  needed, e.g. cap at ~1200px on the long edge, but still export at a 
  reasonable resolution).
- Basic error handling: invalid file type, no image selected, export failure.

TECHNICAL CONSTRAINTS
- No backend, no API calls, no server-side processing — everything must run 
  in-browser so it works as a static GitHub Pages site.
- No build tools (no webpack/vite/npm build step) — plain <script> tags only, 
  so "git push" + enabling Pages is the entire deployment process.
- Vendor any third-party library files locally instead of pulling from a CDN 
  at runtime, to avoid CORS/offline issues on GitHub Pages.
- Test that the relative paths for the gif.js worker file work correctly when 
  hosted under a GitHub Pages project subpath (not just at the domain root).

DELIVERABLE
- All files ready to commit directly to a repo's root (or /docs folder — 
  pick one and document it in the README).
- A README.md explaining: what the app does, how to run it locally (just 
  open index.html or run a simple local server), and the exact GitHub Pages 
  settings to enable (Settings → Pages → deploy from branch/folder).