/**
 * Playwright verification for diagram bee-swarm click motion.
 * Run: node scripts/verify-bee-swarm.mjs
 * Expects a static server at BASE_URL (default http://127.0.0.1:8000).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8000";
const outDir =
  process.env.BEE_SWARM_OUT_DIR ||
  "/cursor/stores/bc-b2621aaa-107e-45ad-b85f-0bab2713c01a/media/bee-swarm";

fs.mkdirSync(outDir, { recursive: true });

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

try {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".ikigai-diagram-svg", { timeout: 10000 });

  const accept = page.locator("#monitoring-accept");
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }

  const diagram = page.locator(".ikigai-diagram");
  await diagram.waitFor({ state: "visible" });

  const motionMode = await diagram.getAttribute("data-diagram-motion");
  record(
    "bee-swarm motion mode registered",
    motionMode === "3d-tilt-bell-shake-bee-swarm",
    `mode=${motionMode}`
  );

  const box = await diagram.boundingBox();
  if (!box) throw new Error("diagram has no bounding box");

  await page.screenshot({
    path: path.join(outDir, "swarm_idle_before.png"),
    fullPage: false,
    clip: box
  });

  // Start swarm via test hook so pointer leave stays clean for settle measurement.
  const started = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    return root._ikigaiDiagramTest.triggerSwarm();
  });
  record("triggerSwarm starts", started === true);

  // Leave diagram so tilt does not contaminate settle offsets.
  await page.mouse.move(8, 8);
  await page.waitForTimeout(280);

  const mid = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    const api = root && root._ikigaiDiagramTest;
    if (!api) return { ok: false, reason: "missing test hook" };
    const swarming = api.isSwarming();
    const sample = api.getSwarmSample();
    const maxAbs = Math.max(...sample.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y))));
    const rootSwarming = root.classList.contains("is-swarming");
    const circleSwarming = document.querySelectorAll(".diagram-circle.is-swarming").length;
    return { ok: true, swarming, maxAbs, rootSwarming, circleSwarming, sample };
  });

  record(
    "swarm active on all circles",
    mid.ok && mid.swarming && mid.rootSwarming && mid.circleSwarming === 4,
    JSON.stringify({
      swarming: mid.swarming,
      rootSwarming: mid.rootSwarming,
      circleSwarming: mid.circleSwarming,
      maxAbs: mid.maxAbs
    })
  );

  record(
    "circles leave rest during swarm",
    mid.ok && mid.maxAbs > 1.5,
    `maxAbs=${mid.maxAbs}`
  );

  // Capture mid-flight frame (~700ms into the 2s flight).
  await page.waitForTimeout(500);
  const during = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    const api = root._ikigaiDiagramTest;
    const sample = api.getSwarmSample();
    return {
      swarming: api.isSwarming(),
      maxAbs: Math.max(...sample.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y)))),
      sample
    };
  });
  record(
    "mid-flight still swarming with offset",
    during.swarming && during.maxAbs > 2,
    `maxAbs=${during.maxAbs}`
  );

  await page.screenshot({
    path: path.join(outDir, "swarm_mid_flight.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  // During settle: living bee motion should still change positions frame-to-frame.
  await page.waitForTimeout(1400);
  const settleA = await page.evaluate(() =>
    document.querySelector(".ikigai-diagram")._ikigaiDiagramTest.getSwarmSample()
  );
  await page.waitForTimeout(180);
  const settleB = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    return {
      swarming: root._ikigaiDiagramTest.isSwarming(),
      sample: root._ikigaiDiagramTest.getSwarmSample()
    };
  });
  const settleDelta = Math.max(
    ...settleA.map((s, i) => Math.hypot(s.x - settleB.sample[i].x, s.y - settleB.sample[i].y))
  );
  record(
    "settle keeps living bee motion",
    settleB.swarming && settleDelta > 0.4,
    `delta=${settleDelta.toFixed(3)} swarming=${settleB.swarming}`
  );

  // Wait for settle finish (~4s total + small buffer). Keep pointer off the diagram.
  await page.waitForTimeout(2100);
  const after = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    const api = root._ikigaiDiagramTest;
    const sample = api.getSwarmSample();
    return {
      swarming: api.isSwarming(),
      rootSwarming: root.classList.contains("is-swarming"),
      circleSwarming: document.querySelectorAll(".diagram-circle.is-swarming").length,
      maxAbs: Math.max(...sample.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y)))),
      sample
    };
  });
  record(
    "swarm settles back to rest",
    !after.swarming && !after.rootSwarming && after.circleSwarming === 0 && after.maxAbs < 0.5,
    JSON.stringify({
      swarming: after.swarming,
      rootSwarming: after.rootSwarming,
      circleSwarming: after.circleSwarming,
      maxAbs: after.maxAbs
    })
  );

  // Also verify a real click path starts the swarm.
  const clickStarted = await page.evaluate(async () => {
    const root = document.querySelector(".ikigai-diagram");
    const svg = root.querySelector(".ikigai-diagram-svg");
    const rect = svg.getBoundingClientRect();
    svg.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.5
      })
    );
    await new Promise((r) => requestAnimationFrame(r));
    return root._ikigaiDiagramTest.isSwarming();
  });
  record("click in circles region starts swarm", clickStarted === true);
  await page.waitForTimeout(4200);

  await page.screenshot({
    path: path.join(outDir, "swarm_settled_after.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  // Reduced motion: swarm must skip.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(50);
  const reduced = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    const api = root._ikigaiDiagramTest;
    const started = api.triggerSwarm();
    return { started, swarming: api.isSwarming() };
  });
  record(
    "prefers-reduced-motion skips swarm",
    reduced.started === false && reduced.swarming === false,
    JSON.stringify(reduced)
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Hover/tilt still works after swarm.
  const love = page.locator('.diagram-circle[data-circle="love"]');
  const loveBox = await love.boundingBox();
  await page.mouse.move(loveBox.x + loveBox.width * 0.5, loveBox.y + loveBox.height * 0.18);
  await page.waitForTimeout(180);
  const tilt = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    return root._ikigaiDiagramTest.getTiltSample();
  });
  const anyTilt = tilt.some((t) => Math.abs(t.rx) > 0.5 || Math.abs(t.ry) > 0.5 || Math.abs(t.z) > 1);
  record("tilt still works after swarm", anyTilt, JSON.stringify(tilt));

  // Bell shake still works.
  const shake = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    // Leave diagram so idle/shake path is clean.
    root.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    return root._ikigaiDiagramTest.triggerShake("good");
  });
  await page.waitForTimeout(80);
  const shakeKey = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    return root._ikigaiDiagramTest.getShakeKey();
  });
  record("bell shake still works after swarm", shake === true && shakeKey === "good", `key=${shakeKey}`);

  // Explore form untouched.
  const form = page.locator("#ikigai-form");
  record("explore form present", await form.count() === 1);

  // Record a short webm of one swarm via page.video isn't available in this launch —
  // instead stitch timed screenshots into a walkthrough using CDP screencast-like
  // capture: Playwright context with recordVideo.
} finally {
  await browser.close();
}

// Second pass: record a short video of the swarm for Adrian.
const videoDir = path.join(outDir, "_video-tmp");
fs.mkdirSync(videoDir, { recursive: true });
const videoBrowser = await chromium.launch({ headless: true });
const context = await videoBrowser.newContext({
  viewport: { width: 900, height: 780 },
  recordVideo: { dir: videoDir, size: { width: 900, height: 780 } }
});
const videoPage = await context.newPage();
try {
  await videoPage.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  const accept = videoPage.locator("#monitoring-accept");
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
  const diagram = videoPage.locator(".ikigai-diagram");
  await diagram.waitFor({ state: "visible" });
  await videoPage.evaluate(() => {
    document.querySelector(".ikigai-diagram")?.scrollIntoView({ block: "center" });
  });
  await videoPage.waitForTimeout(400);
  const box = await diagram.boundingBox();
  await videoPage.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await videoPage.waitForTimeout(4300);
  // Second click to show it is re-triggerable.
  await videoPage.mouse.click(box.x + box.width * 0.48, box.y + box.height * 0.52);
  await videoPage.waitForTimeout(4300);
} finally {
  await context.close();
  await videoBrowser.close();
}

const recorded = fs.readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
if (recorded.length) {
  const dest = path.join(outDir, "bee_swarm_walkthrough.webm");
  fs.renameSync(path.join(videoDir, recorded[0]), dest);
  record("walkthrough video written", true, dest);
} else {
  record("walkthrough video written", false, "no webm produced");
}
try {
  fs.rmSync(videoDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

const summaryPath = path.join(outDir, "pw_bee_swarm_summary.json");
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(
  summaryPath,
  JSON.stringify({ ok: failed.length === 0, failed: failed.length, results }, null, 2)
);
console.log(`\nSummary → ${summaryPath}`);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll bee-swarm checks passed");
