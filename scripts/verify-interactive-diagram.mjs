/**
 * Playwright verification for the interactive SVG Ikigai diagram (#26).
 * Run: node scripts/verify-interactive-diagram.mjs
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
  process.env.DIAGRAM_OUT_DIR ||
  path.join(repoRoot, "..", "..", "cursor", "stores", "self", "media", "interactive-diagram");

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

  const svgCount = await page.locator(".ikigai-diagram-svg").count();
  record("svg present", svgCount === 1, `count=${svgCount}`);

  const circleCount = await page.locator(".diagram-circle").count();
  record("four vector circles", circleCount === 4, `count=${circleCount}`);

  const divCircles = await page.locator(".ikigai-diagram > .circle").count();
  record("no legacy div.circle", divCircles === 0, `count=${divCircles}`);

  const groupRole = await diagram.getAttribute("role");
  record("diagram role=group", groupRole === "group", `role=${groupRole}`);

  const love = page.locator('.diagram-circle[data-circle="love"]');
  const loveTab = await love.getAttribute("tabindex");
  record("love circle focusable", loveTab === "0", `tabindex=${loveTab}`);

  const loveAria = await love.getAttribute("aria-label");
  record("love aria-label set", Boolean(loveAria && loveAria.length > 2), `aria="${loveAria}"`);

  const motionMode = await diagram.getAttribute("data-diagram-motion");
  record(
    "3d tilt + bell-shake motion mode",
    motionMode === "3d-tilt-bell-shake" ||
      motionMode === "3d-tilt-bell-shake-bee-swarm",
    `mode=${motionMode}`
  );

  // No continuous opacity shimmer — idle motion is discrete bell shakes.
  const idleAnim = await love.evaluate((el) => getComputedStyle(el).animationName);
  record(
    "no continuous idle opacity animation",
    idleAnim === "none",
    `animationName=${idleAnim}`
  );

  await page.screenshot({
    path: path.join(outDir, "diagram_idle.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  // Trigger a single-circle bell shake via test hook.
  const shakeResult = await page.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    const api = root && root._ikigaiDiagramTest;
    if (!api) return { ok: false, reason: "missing test hook" };
    const ok = api.triggerShake("love");
    return { ok, key: api.getShakeKey() };
  });
  record(
    "bell shake triggers one circle",
    shakeResult.ok && shakeResult.key === "love",
    JSON.stringify(shakeResult)
  );
  await page.waitForTimeout(120);
  const loveShaking = await love.evaluate((el) => el.classList.contains("is-shaking"));
  const othersShaking = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".diagram-circle.is-shaking")).map((el) =>
      el.getAttribute("data-circle")
    )
  );
  record(
    "only one circle shakes at a time",
    loveShaking && othersShaking.length === 1,
    `shaking=${othersShaking.join(",")}`
  );

  await page.screenshot({
    path: path.join(outDir, "diagram_bell_shake_love.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  // Wait for shake to finish
  await page.waitForTimeout(520);

  // Hover the exclusive top crescent of "love".
  const loveBox = await love.boundingBox();
  if (!loveBox) throw new Error("love circle has no bounding box");
  await page.mouse.move(
    loveBox.x + loveBox.width * 0.5,
    loveBox.y + loveBox.height * 0.18
  );
  await page.waitForTimeout(320);
  const interacting = await diagram.evaluate((el) => el.classList.contains("is-interacting"));
  const loveActive = await love.evaluate((el) => el.classList.contains("is-active"));
  const loveOpacity = await love.evaluate((el) => getComputedStyle(el).fillOpacity);
  record("hover sets is-interacting", interacting, `is-interacting=${interacting}`);
  record("hover sets is-active on love", loveActive, `is-active=${loveActive}`);
  record(
    "hovered circle fill denser",
    Number(loveOpacity) >= 0.75,
    `fillOpacity=${loveOpacity}`
  );

  const goodOpacity = await page
    .locator('.diagram-circle[data-circle="good"]')
    .evaluate((el) => getComputedStyle(el).fillOpacity);
  record(
    "sibling still visible for labels",
    Number(goodOpacity) >= 0.3 && Number(goodOpacity) < Number(loveOpacity),
    `goodFillOpacity=${goodOpacity}`
  );

  await page.screenshot({
    path: path.join(outDir, "diagram_hover_love.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  // Keyboard focus
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await love.focus();
  await page.waitForTimeout(200);
  const focusedActive = await love.evaluate((el) => el.classList.contains("is-active"));
  record("keyboard focus activates circle", focusedActive);

  await page.screenshot({
    path: path.join(outDir, "diagram_focus_love.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  // prefers-reduced-motion: no tilt / no shake hook effect
  const reduced = await browser.newPage({
    viewport: { width: 1100, height: 900 },
    reducedMotion: "reduce"
  });
  await reduced.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await reduced.waitForSelector(".ikigai-diagram-svg", { timeout: 10000 });
  const reducedAccept = reduced.locator("#monitoring-accept");
  if (await reducedAccept.isVisible().catch(() => false)) {
    await reducedAccept.click();
  }
  const reducedShake = await reduced.evaluate(() => {
    const root = document.querySelector(".ikigai-diagram");
    const api = root && root._ikigaiDiagramTest;
    if (!api) return { ok: false };
    return { ok: api.triggerShake("love"), key: api.getShakeKey() };
  });
  record(
    "reduced-motion blocks bell shake",
    reducedShake.ok === false && !reducedShake.key,
    JSON.stringify(reducedShake)
  );
  await reduced.close();

  const labelLoveVisible = await page.locator(".label-love").isVisible();
  const centerVisible = await page.locator(".diagram-center").isVisible();
  record("labels remain visible", labelLoveVisible && centerVisible);

  // 3D parallax: move through center and expect tilt + depth vars.
  const dbox = await diagram.boundingBox();
  await page.mouse.move(dbox.x + dbox.width * 0.5, dbox.y + dbox.height * 0.42, {
    steps: 10
  });
  await page.waitForTimeout(400);
  const tiltSample = await love.evaluate((el) => ({
    rx: getComputedStyle(el).getPropertyValue("--parallax-rx").trim(),
    ry: getComputedStyle(el).getPropertyValue("--parallax-ry").trim(),
    z: getComputedStyle(el).getPropertyValue("--parallax-z").trim(),
    parallaxing: el.closest(".ikigai-diagram")?.classList.contains("is-parallaxing")
  }));
  const rx = Number.parseFloat(tiltSample.rx) || 0;
  const ry = Number.parseFloat(tiltSample.ry) || 0;
  const z = Number.parseFloat(tiltSample.z) || 0;
  record(
    "3d tilt while pointer inside",
    tiltSample.parallaxing && (Math.abs(rx) > 0.4 || Math.abs(ry) > 0.4 || Math.abs(z) > 1),
    `rx=${tiltSample.rx} ry=${tiltSample.ry} z=${tiltSample.z}`
  );

  await page.screenshot({
    path: path.join(outDir, "diagram_parallax_center.png"),
    fullPage: false,
    clip: await diagram.boundingBox()
  });

  await page.selectOption("#lang-select", "de");
  await page.waitForTimeout(100);
  const deAria = await love.getAttribute("aria-label");
  record(
    "i18n updates circle aria (de)",
    deAria === "Was du liebst",
    `aria="${deAria}"`
  );

  const form = page.locator("#ikigai-form");
  const findBtn = page.locator("#find-button");
  record("explore form intact", (await form.count()) === 1 && (await findBtn.count()) === 1);

  fs.writeFileSync(
    path.join(outDir, "pw_diagram_summary.json"),
    JSON.stringify(results, null, 2)
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed.`);
console.log(`Artifacts: ${outDir}`);
