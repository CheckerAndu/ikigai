/**
 * Interactive Ikigai diagram — 3D tilt parallax + idle bell shakes + bee swarm.
 * Does not touch Explore form, API, or rate-limit behavior.
 */
(function initIkigaiDiagram() {
  const diagram = document.querySelector(".ikigai-diagram");
  if (!diagram) return;

  const svg = diagram.querySelector(".ikigai-diagram-svg");
  const circles = Array.from(diagram.querySelectorAll(".diagram-circle"));
  if (!svg || !circles.length) return;

  const labelByKey = {
    love: diagram.querySelector(".label-love"),
    good: diagram.querySelector(".label-good"),
    world: diagram.querySelector(".label-world"),
    paid: diagram.querySelector(".label-paid")
  };
  const centerLabel = diagram.querySelector(".diagram-center");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** Max planar parting in viewBox units (kept modest — tilt carries the 3D feel). */
  const MAX_PUSH = 2.4;
  /** Max tilt toward / away from the cursor (deg). Tasteful card-tilt range. */
  const MAX_TILT = 14;
  /** Max depth sink when the cursor is near (px). */
  const MAX_Z = 28;
  /** Distance (viewBox units) where influence falls to zero. */
  const INFLUENCE_RADIUS = 48;
  /** Lerp factor per frame toward targets. */
  const EASE = 0.2;
  /** Rest-position radius used for hit-testing (matches SVG r). */
  const HIT_RADIUS = 29;

  /** Idle “bell” shake: one circle, ~500ms, ~3s between (with light jitter). */
  const SHAKE_MS = 500;
  const SHAKE_GAP_MIN_MS = 2600;
  const SHAKE_GAP_MAX_MS = 3600;
  const SHAKE_START_DELAY_MS = 2200;

  /**
   * Click bee-swarm: scatter → overlapping wander → homing bee flight (~4s).
   * Roughly ~2s of free flight, then ~2s still flying like bees while
   * fluently seeking original rest positions (not a frozen glide).
   * Offsets stay in viewBox units so bees stay inside the circles region.
   * Skipped entirely when prefers-reduced-motion is set.
   */
  const SWARM_MS = 4000;
  const SWARM_SCATTER_END = 0.12;
  /** Settle occupies the second half — slow homing bee flight. */
  const SWARM_SETTLE_START = 0.5;
  /** Peak wander amplitude (viewBox units) — playful, still inside the diagram. */
  const SWARM_AMP = 14;
  const SWARM_RZ_DEG = 7;

  const state = circles.map((el) => ({
    el,
    key: el.getAttribute("data-circle"),
    cx: Number(el.getAttribute("cx")) || 50,
    cy: Number(el.getAttribute("cy")) || 50,
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    scale: 1,
    tx: 0,
    ty: 0,
    tz: 0,
    tRx: 0,
    tRy: 0,
    tScale: 1,
    swarmRz: 0
  }));

  let pointerInside = false;
  let lastPointer = null;
  let activeKey = null;
  let focusedEl = null;
  let rafId = 0;
  let shakeTimer = 0;
  let shakingKey = null;
  let lastShakeKey = null;
  let shakeStartedAt = 0;
  let swarming = false;
  let swarmStartedAt = 0;
  /** @type {null | Array<{fx:number,fy:number,fx2:number,fy2:number,fr:number,px:number,py:number,px2:number,py2:number,pr:number,ax:number,ay:number,ax2:number,ay2:number}>} */
  let swarmParams = null;
  /** Snapshot of each circle’s offset when settle begins — eased home from here. */
  /** @type {null | Array<{x:number,y:number,rz:number}>} */
  let swarmSettleFrom = null;

  function setInteracting(active) {
    diagram.classList.toggle("is-interacting", Boolean(active));
  }

  function setActiveByKey(key) {
    activeKey = key;
    for (const item of state) {
      item.el.classList.toggle("is-active", item.key === key);
    }
    setInteracting(Boolean(key) || pointerInside || Boolean(focusedEl));
  }

  function clientToSvg(clientX, clientY) {
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      const box = svg.getBoundingClientRect();
      return {
        x: ((clientX - box.left) / box.width) * 100,
        y: ((clientY - box.top) / box.height) * 100
      };
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function hitTest(px, py) {
    let best = null;
    let bestDist = Infinity;
    for (const item of state) {
      const dist = Math.hypot(item.cx - px, item.cy - py);
      if (dist <= HIT_RADIUS && dist < bestDist) {
        best = item;
        bestDist = dist;
      }
    }
    return best;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOutCubic(t) {
    const p = clamp(t, 0, 1);
    return 1 - Math.pow(1 - p, 3);
  }

  /** Balanced ease for a long, unhurried settle home. */
  function easeInOutCubic(t) {
    const p = clamp(t, 0, 1);
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  /** True when a viewBox point sits in the four-circle cluster (generous padding). */
  function inCirclesRegion(px, py) {
    if (hitTest(px, py)) return true;
    // Soft envelope around the overlapping cluster so edge clicks still count.
    const dist = Math.hypot(px - 50, py - 50);
    return dist <= 46;
  }

  function buildSwarmParams() {
    return state.map((item, index) => {
      // Bias wander outward from rest so paths cross through the center.
      const outward = Math.atan2(item.cy - 50, item.cx - 50) + randRange(-0.55, 0.55);
      const amp = SWARM_AMP * randRange(0.82, 1.12);
      // Stagger frequencies so trajectories overlap without locking in sync.
      // ~2–3 primary loops across the 2s flight reads as bees, not vibration.
      const base = 0.0055 + index * 0.0007;
      return {
        fx: base * randRange(0.95, 1.3),
        fy: base * randRange(0.9, 1.35) * 1.2,
        fx2: base * randRange(1.8, 2.5),
        fy2: base * randRange(1.7, 2.6),
        fr: base * randRange(2.0, 3.0),
        px: outward + randRange(-Math.PI, Math.PI),
        py: outward * 1.3 + randRange(-Math.PI, Math.PI),
        px2: randRange(0, Math.PI * 2),
        py2: randRange(0, Math.PI * 2),
        pr: randRange(0, Math.PI * 2),
        ax: Math.cos(outward) * amp * randRange(0.8, 1.1),
        ay: Math.sin(outward) * amp * randRange(0.8, 1.1),
        ax2: amp * randRange(0.35, 0.55),
        ay2: amp * randRange(0.35, 0.55)
      };
    });
  }

  function swarmEnvelope(progress) {
    if (progress <= 0) return 0;
    if (progress >= 1) return 0;
    if (progress < SWARM_SCATTER_END) {
      return easeOutCubic(progress / SWARM_SCATTER_END);
    }
    // Free-flight + settle both keep full envelope; settle homes via seek, not amp kill.
    return 1;
  }

  function sampleSwarmFlight(itemIndex, now, envelope) {
    const p = swarmParams[itemIndex];
    if (!p || envelope <= 0) return { x: 0, y: 0, rz: 0 };
    // Overlapping Lissajous-ish wander — organic “bee” crossings inside the region.
    const x =
      (Math.sin(now * p.fx + p.px) * p.ax + Math.sin(now * p.fx2 + p.px2) * p.ax2) *
      envelope;
    const y =
      (Math.cos(now * p.fy + p.py) * p.ay + Math.sin(now * p.fy2 + p.py2) * p.ay2) *
      envelope;
    const rz = Math.sin(now * p.fr + p.pr) * SWARM_RZ_DEG * envelope;
    return {
      x: clamp(x, -SWARM_AMP * 1.25, SWARM_AMP * 1.25),
      y: clamp(y, -SWARM_AMP * 1.25, SWARM_AMP * 1.25),
      rz
    };
  }

  /**
   * Homing bee flight: orbit center seeks rest, while a strong living wander
   * keeps the path bee-like (not a frozen slide along a straight line).
   */
  function sampleSwarmSettle(itemIndex, now, settleT) {
    const from = swarmSettleFrom && swarmSettleFrom[itemIndex];
    const p = swarmParams && swarmParams[itemIndex];
    if (!from || !p) return { x: 0, y: 0, rz: 0 };

    // Fluent home pull on the seek target (where the bee is trying to go).
    const homePull = easeInOutCubic(settleT);
    const centerX = from.x * (1 - homePull);
    const centerY = from.y * (1 - homePull);
    const centerRz = from.rz * (1 - homePull);
    const remainDist = Math.hypot(centerX, centerY);

    // Keep wingbeat lively — only gently lazy near landing.
    const slow = 0.7 + 0.3 * (1 - settleT);
    // Wiggle scales with remaining distance, with a visible floor until late settle.
    const wiggle =
      Math.max(remainDist * 0.62, SWARM_AMP * 0.28 * (1 - settleT)) *
      Math.pow(1 - settleT, 0.25);

    const bx =
      (Math.sin(now * p.fx * slow + p.px) * (p.ax / SWARM_AMP) +
        Math.sin(now * p.fx2 * slow + p.px2) * (p.ax2 / SWARM_AMP)) *
      wiggle;
    const by =
      (Math.cos(now * p.fy * slow + p.py) * (p.ay / SWARM_AMP) +
        Math.sin(now * p.fy2 * slow + p.py2) * (p.ay2 / SWARM_AMP)) *
      wiggle;
    const brz =
      Math.sin(now * p.fr * slow + p.pr) * SWARM_RZ_DEG * (0.35 + 0.65 * (1 - settleT));

    return {
      x: clamp(centerX + bx, -SWARM_AMP * 1.35, SWARM_AMP * 1.35),
      y: clamp(centerY + by, -SWARM_AMP * 1.35, SWARM_AMP * 1.35),
      rz: centerRz * 0.25 + brz
    };
  }

  function startSwarm() {
    // Respect prefers-reduced-motion: skip flight (CSS also freezes transforms).
    if (reduceMotion.matches) return false;

    swarmParams = buildSwarmParams();
    swarmSettleFrom = null;
    pauseIdleShakes();
    swarming = true;
    swarmStartedAt = performance.now();
    diagram.classList.add("is-swarming");
    setInteracting(true);
    // Clear tilt targets so bees own planar motion during the flight.
    resetTargets();
    centerTarget.x = 0;
    centerTarget.y = 0;
    scheduleTick();
    return true;
  }

  function endSwarm() {
    swarming = false;
    swarmParams = null;
    swarmSettleFrom = null;
    diagram.classList.remove("is-swarming");
    for (const item of state) {
      item.swarmRz = 0;
      item.tx = 0;
      item.ty = 0;
      item.tz = 0;
      item.tRx = 0;
      item.tRy = 0;
      item.tScale = 1;
      item.el.classList.remove("is-swarming");
      const label = labelByKey[item.key];
      if (label) label.classList.remove("is-swarming");
    }
    setInteracting(Boolean(activeKey) || pointerInside || Boolean(focusedEl));
    if (pointerInside && lastPointer && !reduceMotion.matches) {
      updateFromPointer(lastPointer.x, lastPointer.y);
    } else if (idleAllowed()) {
      scheduleIdleShake(randomGap());
    }
  }

  /**
   * Cursor-driven 3D response: circles incline as if the pointer passes through
   * them in depth — near edge sinks back, face tilts toward the path, slight part.
   */
  function computeTargets(px, py) {
    let avgX = 0;
    let avgY = 0;

    for (const item of state) {
      const dx = item.cx - px; // center ← cursor (push-away axis)
      const dy = item.cy - py;
      const ox = px - item.cx; // cursor relative to center (tilt axis)
      const oy = py - item.cy;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const t = Math.max(0, 1 - dist / INFLUENCE_RADIUS);
      // Smoothstep falloff — stronger when the pointer is on the disc.
      const influence = t * t * (3 - 2 * t);

      item.tx = (dx / dist) * MAX_PUSH * influence;
      item.ty = (dy / dist) * MAX_PUSH * influence;
      // Sink back in Z as the cursor moves through the circle.
      item.tz = -MAX_Z * influence;

      // Incline: edge nearest the cursor tips away (making space in depth).
      const tilt = influence * MAX_TILT;
      item.tRy = clamp((-ox / HIT_RADIUS) * tilt, -MAX_TILT, MAX_TILT);
      item.tRx = clamp((oy / HIT_RADIUS) * tilt, -MAX_TILT, MAX_TILT);

      // Slight scale: nearer (more influence) reads a touch smaller (farther in Z).
      item.tScale = 1 - influence * 0.035;

      avgX += item.tx;
      avgY += item.ty;
    }

    return {
      centerX: -(avgX / state.length) * 0.25,
      centerY: -(avgY / state.length) * 0.25
    };
  }

  function resetTargets() {
    for (const item of state) {
      item.tx = 0;
      item.ty = 0;
      item.tz = 0;
      item.tRx = 0;
      item.tRy = 0;
      item.tScale = 1;
    }
    return { centerX: 0, centerY: 0 };
  }

  let centerTarget = { x: 0, y: 0 };
  let centerCurrent = { x: 0, y: 0 };

  function viewBoxToPixels() {
    const box = svg.getBoundingClientRect();
    return {
      x: box.width / 100,
      y: box.height / 100
    };
  }

  function shakeSample(now) {
    if (!shakingKey) return { x: 0, y: 0, rz: 0 };
    const elapsed = now - shakeStartedAt;
    if (elapsed >= SHAKE_MS) return { x: 0, y: 0, rz: 0 };
    const p = elapsed / SHAKE_MS;
    // Decaying oscillation — struck-bell envelope (ease-out amplitude).
    const envelope = Math.pow(1 - p, 2);
    const waves = Math.sin(p * Math.PI * 6);
    return {
      x: waves * envelope * 0.55,
      y: -Math.cos(p * Math.PI * 5) * envelope * 0.35,
      rz: waves * envelope * 1.6
    };
  }

  function applyTransforms(now = performance.now()) {
    const unit = viewBoxToPixels();
    const shake = shakeSample(now);

    for (const item of state) {
      const isShaking = !swarming && item.key === shakingKey;
      const sx = isShaking ? shake.x : 0;
      const sy = isShaking ? shake.y : 0;
      const srz = isShaking ? shake.rz : item.swarmRz;

      item.el.style.setProperty("--parallax-x", `${(item.x * unit.x + sx).toFixed(2)}px`);
      item.el.style.setProperty("--parallax-y", `${(item.y * unit.y + sy).toFixed(2)}px`);
      item.el.style.setProperty("--parallax-z", `${item.z.toFixed(2)}px`);
      item.el.style.setProperty("--parallax-rx", `${item.rx.toFixed(2)}deg`);
      item.el.style.setProperty("--parallax-ry", `${item.ry.toFixed(2)}deg`);
      item.el.style.setProperty("--parallax-rz", `${srz.toFixed(2)}deg`);
      item.el.style.setProperty("--parallax-scale", item.scale.toFixed(4));
      item.el.classList.toggle("is-shaking", isShaking);
      item.el.classList.toggle("is-swarming", swarming);

      const label = labelByKey[item.key];
      if (label) {
        label.style.setProperty("--parallax-x", `${(item.x + sx * 0.15).toFixed(3)}%`);
        label.style.setProperty("--parallax-y", `${(item.y + sy * 0.15).toFixed(3)}%`);
        label.style.setProperty("--parallax-z", `${(item.z * 0.35).toFixed(2)}px`);
        label.style.setProperty("--parallax-rx", `${item.rx.toFixed(2)}deg`);
        label.style.setProperty("--parallax-ry", `${item.ry.toFixed(2)}deg`);
        label.style.setProperty("--parallax-rz", `${(srz * 0.5).toFixed(2)}deg`);
        label.classList.toggle("is-shaking", isShaking);
        label.classList.toggle("is-swarming", swarming);
      }
    }

    if (centerLabel) {
      centerLabel.style.setProperty("--parallax-x", `${centerCurrent.x.toFixed(3)}%`);
      centerLabel.style.setProperty("--parallax-y", `${centerCurrent.y.toFixed(3)}%`);
    }
  }

  function tick(now) {
    rafId = 0;

    if (reduceMotion.matches) {
      for (const item of state) {
        item.x = 0;
        item.y = 0;
        item.z = 0;
        item.rx = 0;
        item.ry = 0;
        item.scale = 1;
        item.swarmRz = 0;
      }
      centerCurrent.x = 0;
      centerCurrent.y = 0;
      shakingKey = null;
      applyTransforms(now);
      diagram.classList.remove("is-parallaxing");
      return;
    }

    let moving = false;

    if (swarming && swarmParams) {
      const progress = (now - swarmStartedAt) / SWARM_MS;
      if (progress >= 1) {
        for (const item of state) {
          item.x = 0;
          item.y = 0;
          item.z = 0;
          item.rx = 0;
          item.ry = 0;
          item.scale = 1;
          item.swarmRz = 0;
        }
        centerCurrent.x = 0;
        centerCurrent.y = 0;
        applyTransforms(now);
        endSwarm();
        // Continue one more frame if pointer/idle needs the loop.
        if (pointerInside || shakingKey) {
          rafId = requestAnimationFrame(tick);
        } else {
          diagram.classList.toggle("is-parallaxing", false);
        }
        return;
      }

      let sampleFn;
      if (progress >= SWARM_SETTLE_START) {
        // First settle frame: remember where each bee is, then fly home from there.
        if (!swarmSettleFrom) {
          swarmSettleFrom = state.map((_, index) =>
            sampleSwarmFlight(index, now, 1)
          );
        }
        const settleT = (progress - SWARM_SETTLE_START) / (1 - SWARM_SETTLE_START);
        sampleFn = (index) => sampleSwarmSettle(index, now, settleT);
      } else {
        const envelope = swarmEnvelope(progress);
        sampleFn = (index) => sampleSwarmFlight(index, now, envelope);
      }

      state.forEach((item, index) => {
        const sample = sampleFn(index);
        item.x = sample.x;
        item.y = sample.y;
        item.swarmRz = sample.rz;
        // Ease tilt/depth home while bees fly.
        item.z += (0 - item.z) * EASE;
        item.rx += (0 - item.rx) * EASE;
        item.ry += (0 - item.ry) * EASE;
        item.scale += (1 - item.scale) * EASE;
      });
      centerCurrent.x += (0 - centerCurrent.x) * EASE;
      centerCurrent.y += (0 - centerCurrent.y) * EASE;
      moving = true;
    } else {
      for (const item of state) {
        item.swarmRz = 0;
        item.x += (item.tx - item.x) * EASE;
        item.y += (item.ty - item.y) * EASE;
        item.z += (item.tz - item.z) * EASE;
        item.rx += (item.tRx - item.rx) * EASE;
        item.ry += (item.tRy - item.ry) * EASE;
        item.scale += (item.tScale - item.scale) * EASE;
        if (
          Math.abs(item.tx - item.x) > 0.02 ||
          Math.abs(item.ty - item.y) > 0.02 ||
          Math.abs(item.tz - item.z) > 0.2 ||
          Math.abs(item.tRx - item.rx) > 0.05 ||
          Math.abs(item.tRy - item.ry) > 0.05 ||
          Math.abs(item.tScale - item.scale) > 0.002
        ) {
          moving = true;
        }
      }

      centerCurrent.x += (centerTarget.x - centerCurrent.x) * EASE;
      centerCurrent.y += (centerTarget.y - centerCurrent.y) * EASE;
      if (
        Math.abs(centerTarget.x - centerCurrent.x) > 0.02 ||
        Math.abs(centerTarget.y - centerCurrent.y) > 0.02
      ) {
        moving = true;
      }

      if (shakingKey && now - shakeStartedAt < SHAKE_MS) {
        moving = true;
      } else if (shakingKey && now - shakeStartedAt >= SHAKE_MS) {
        shakingKey = null;
        for (const item of state) {
          item.el.classList.remove("is-shaking");
          const label = labelByKey[item.key];
          if (label) label.classList.remove("is-shaking");
        }
      }
    }

    applyTransforms(now);
    diagram.classList.toggle("is-parallaxing", pointerInside || moving || swarming);

    if (moving || pointerInside || shakingKey || swarming) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function scheduleTick() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function idleAllowed() {
    return (
      !reduceMotion.matches &&
      !swarming &&
      !pointerInside &&
      !focusedEl &&
      !document.hidden &&
      !diagram.classList.contains("is-interacting")
    );
  }

  function clearShakeTimer() {
    if (shakeTimer) {
      clearTimeout(shakeTimer);
      shakeTimer = 0;
    }
  }

  function randomGap() {
    return SHAKE_GAP_MIN_MS + Math.random() * (SHAKE_GAP_MAX_MS - SHAKE_GAP_MIN_MS);
  }

  function pickShakeTarget() {
    const keys = state.map((item) => item.key);
    if (keys.length <= 1) return keys[0] || null;
    let next = keys[Math.floor(Math.random() * keys.length)];
    // Avoid striking the same circle twice in a row (less mechanical).
    if (next === lastShakeKey) {
      next = keys[(keys.indexOf(next) + 1 + Math.floor(Math.random() * (keys.length - 1))) % keys.length];
    }
    return next;
  }

  function scheduleIdleShake(delay = randomGap()) {
    clearShakeTimer();
    if (reduceMotion.matches) return;
    shakeTimer = window.setTimeout(() => {
      shakeTimer = 0;
      if (!idleAllowed()) {
        scheduleIdleShake(randomGap());
        return;
      }
      const key = pickShakeTarget();
      if (!key) {
        scheduleIdleShake(randomGap());
        return;
      }
      lastShakeKey = key;
      shakingKey = key;
      shakeStartedAt = performance.now();
      scheduleTick();
      // Queue the next strike after this shake finishes + gap.
      scheduleIdleShake(SHAKE_MS + randomGap());
    }, delay);
  }

  function pauseIdleShakes() {
    clearShakeTimer();
    shakingKey = null;
    for (const item of state) {
      item.el.classList.remove("is-shaking");
      const label = labelByKey[item.key];
      if (label) label.classList.remove("is-shaking");
    }
  }

  function updateFromPointer(clientX, clientY) {
    lastPointer = { x: clientX, y: clientY };
    const svgPoint = clientToSvg(clientX, clientY);
    const hit = hitTest(svgPoint.x, svgPoint.y);

    if (focusedEl) {
      setActiveByKey(focusedEl.getAttribute("data-circle"));
    } else {
      setActiveByKey(hit ? hit.key : null);
    }

    if (reduceMotion.matches || swarming) return;

    const center = computeTargets(svgPoint.x, svgPoint.y);
    centerTarget.x = center.centerX;
    centerTarget.y = center.centerY;
    scheduleTick();
  }

  diagram.addEventListener("pointerenter", (event) => {
    pointerInside = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    pauseIdleShakes();
    diagram.classList.add("is-parallaxing");
    updateFromPointer(event.clientX, event.clientY);
  });

  diagram.addEventListener("pointermove", (event) => {
    pointerInside = true;
    updateFromPointer(event.clientX, event.clientY);
  });

  diagram.addEventListener("pointerleave", () => {
    pointerInside = false;
    lastPointer = null;
    if (!swarming) {
      const center = resetTargets();
      centerTarget.x = center.centerX;
      centerTarget.y = center.centerY;
    }
    if (!focusedEl) setActiveByKey(null);
    scheduleTick();
    if (!swarming) scheduleIdleShake(randomGap());
  });

  // Click in the circles region → brief bee-swarm, then settle home.
  diagram.addEventListener("click", (event) => {
    const svgPoint = clientToSvg(event.clientX, event.clientY);
    if (!inCirclesRegion(svgPoint.x, svgPoint.y)) return;
    startSwarm();
  });

  circles.forEach((circle) => {
    circle.addEventListener("focus", () => {
      focusedEl = circle;
      pauseIdleShakes();
      setActiveByKey(circle.getAttribute("data-circle"));
    });
    circle.addEventListener("blur", () => {
      if (focusedEl === circle) focusedEl = null;
      if (!pointerInside) {
        setActiveByKey(null);
        scheduleIdleShake(randomGap());
      }
    });
    circle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      focusedEl = circle;
      pauseIdleShakes();
      setActiveByKey(circle.getAttribute("data-circle"));
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseIdleShakes();
    } else if (idleAllowed()) {
      scheduleIdleShake(SHAKE_START_DELAY_MS);
    }
  });

  function clearParallaxStyles() {
    for (const item of state) {
      [
        "--parallax-x",
        "--parallax-y",
        "--parallax-z",
        "--parallax-rx",
        "--parallax-ry",
        "--parallax-rz",
        "--parallax-scale"
      ].forEach((prop) => item.el.style.removeProperty(prop));
      item.el.classList.remove("is-shaking");
      const label = labelByKey[item.key];
      if (label) {
        [
          "--parallax-x",
          "--parallax-y",
          "--parallax-z",
          "--parallax-rx",
          "--parallax-ry",
          "--parallax-rz"
        ].forEach((prop) => label.style.removeProperty(prop));
        label.classList.remove("is-shaking");
      }
    }
    if (centerLabel) {
      centerLabel.style.removeProperty("--parallax-x");
      centerLabel.style.removeProperty("--parallax-y");
    }
    diagram.classList.remove("is-parallaxing");
  }

  function syncMotionPreference() {
    diagram.classList.toggle("reduce-motion", reduceMotion.matches);
    if (reduceMotion.matches) {
      pointerInside = false;
      pauseIdleShakes();
      if (swarming) {
        swarming = false;
        swarmParams = null;
        swarmSettleFrom = null;
        diagram.classList.remove("is-swarming");
      }
      resetTargets();
      for (const item of state) {
        item.x = 0;
        item.y = 0;
        item.z = 0;
        item.rx = 0;
        item.ry = 0;
        item.scale = 1;
        item.swarmRz = 0;
        item.el.classList.remove("is-swarming");
        const label = labelByKey[item.key];
        if (label) label.classList.remove("is-swarming");
      }
      centerCurrent.x = 0;
      centerCurrent.y = 0;
      clearParallaxStyles();
      if (!focusedEl) setActiveByKey(null);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } else if (idleAllowed()) {
      scheduleIdleShake(SHAKE_START_DELAY_MS);
    }
  }

  syncMotionPreference();
  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", syncMotionPreference);
  } else if (typeof reduceMotion.addListener === "function") {
    reduceMotion.addListener(syncMotionPreference);
  }

  // Expose a tiny test hook for Playwright (non-enumerable-ish on diagram dataset).
  diagram.dataset.diagramMotion = "3d-tilt-bell-shake-bee-swarm";
  diagram._ikigaiDiagramTest = {
    triggerShake(key) {
      if (reduceMotion.matches || swarming) return false;
      pauseIdleShakes();
      shakingKey = key || pickShakeTarget();
      lastShakeKey = shakingKey;
      shakeStartedAt = performance.now();
      scheduleTick();
      scheduleIdleShake(SHAKE_MS + randomGap());
      return Boolean(shakingKey);
    },
    triggerSwarm() {
      return startSwarm();
    },
    isSwarming: () => swarming,
    getSwarmSample: () =>
      state.map((item) => ({
        key: item.key,
        x: item.x,
        y: item.y,
        rz: item.swarmRz
      })),
    getShakeKey: () => shakingKey,
    getTiltSample: () =>
      state.map((item) => ({
        key: item.key,
        rx: item.rx,
        ry: item.ry,
        z: item.z
      }))
  };
})();
