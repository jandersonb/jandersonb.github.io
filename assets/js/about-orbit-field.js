(function () {
  "use strict";

  const CANVAS_ID = "about-orbit-field-canvas";
  const GRAVITY = 0.018;
  const SOFTENING = 2200;
  const CENTER_PULL = 0.0000012;
  const DRAG = 0.9988;
  const MAX_TRAIL_POINTS = 12;

  let canvas = null;
  let context = null;
  let palettePoller = null;
  let bodies = [];
  let paletteSignature = "";
  let prefersReducedMotion = false;

  function getThemeColor(name, fallback) {
    let computed = getComputedStyle(document.documentElement);
    let value = computed.getPropertyValue(name).trim();
    if (value) {
      return value;
    }

    if (document.body) {
      computed = getComputedStyle(document.body);
      value = computed.getPropertyValue(name).trim();
      if (value) {
        return value;
      }
    }

    return fallback;
  }

  function parseColor(color, fallback) {
    if (!color) {
      return fallback;
    }

    const probe = document.createElement("span");
    probe.style.color = color;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const normalized = getComputedStyle(probe).color;
    probe.remove();

    const match = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) {
      return fallback;
    }

    const parts = match[1].split(",").map(function (part) {
      return Number.parseFloat(part.trim());
    });

    if (parts.length < 3 || parts.some(function (value) {
      return Number.isNaN(value);
    })) {
      return fallback;
    }

    return {
      r: parts[0],
      g: parts[1],
      b: parts[2],
    };
  }

  function colorToCss(color, alpha) {
    return "rgba(" + color.r + ", " + color.g + ", " + color.b + ", " + alpha + ")";
  }

  function mixColors(a, b, weight) {
    return {
      r: Math.round(a.r * weight + b.r * (1 - weight)),
      g: Math.round(a.g * weight + b.g * (1 - weight)),
      b: Math.round(a.b * weight + b.b * (1 - weight)),
    };
  }

  function getPaletteSignature() {
    return [
      getThemeColor("--global-theme-color", ""),
      getThemeColor("--global-divider-color", ""),
      getComputedStyle(document.body).backgroundColor,
      getComputedStyle(document.body).color,
    ].join("|");
  }

  function applyBodyLayering() {
    document.body.style.isolation = "isolate";

    Array.from(document.body.children).forEach(function (element) {
      if (element === canvas) {
        return;
      }

      if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
        return;
      }

      const computed = getComputedStyle(element);
      if (computed.position === "static") {
        element.style.position = "relative";
      }
      element.style.zIndex = "1";
    });
  }

  function resizeCanvas() {
    if (!canvas) {
      return;
    }

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    if (context) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }

  function buildBodies() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(width, height);
    const centerX = width * 0.52;
    const centerY = height * 0.34;
    const clusterRadius = scale * 0.11;
    const outerRadius = scale * 0.29;

    const result = [];

    const heavySeeds = [
      { angle: -0.9, radius: clusterRadius * 0.85, mass: 360, speed: 0.18 },
      { angle: 0.6, radius: clusterRadius * 0.7, mass: 340, speed: -0.22 },
      { angle: 2.1, radius: clusterRadius * 0.95, mass: 390, speed: 0.14 },
      { angle: 3.0, radius: clusterRadius * 0.78, mass: 330, speed: -0.16 },
    ];

    heavySeeds.forEach(function (seed, index) {
      const x = centerX + Math.cos(seed.angle) * seed.radius;
      const y = centerY + Math.sin(seed.angle) * seed.radius * 0.76;
      result.push({
        x: x,
        y: y,
        vx: -Math.sin(seed.angle) * seed.speed,
        vy: Math.cos(seed.angle) * seed.speed * 0.84,
        mass: seed.mass,
        radius: 3.8 + index * 0.35,
        hue: index,
        trail: [],
      });
    });

    for (let i = 0; i < 28; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = clusterRadius + Math.pow(Math.random(), 0.55) * outerRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * (0.72 + Math.random() * 0.22);
      const orbitalSpeed = Math.sqrt((GRAVITY * 1500) / Math.max(radius, 1)) * (Math.random() > 0.5 ? 1 : -1);
      result.push({
        x: x,
        y: y,
        vx: -Math.sin(angle) * orbitalSpeed + (Math.random() - 0.5) * 0.25,
        vy: Math.cos(angle) * orbitalSpeed * 0.86 + (Math.random() - 0.5) * 0.25,
        mass: 1 + Math.random() * 3,
        radius: 0.9 + Math.random() * 1.4,
        hue: 4,
        trail: [],
      });
    }

    for (let j = 0; j < 18; j += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = scale * (0.36 + Math.random() * 0.32);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.8;
      result.push({
        x: x,
        y: y,
        vx: -Math.sin(angle) * 0.12 + (Math.random() - 0.5) * 0.2,
        vy: Math.cos(angle) * 0.12 + (Math.random() - 0.5) * 0.2,
        mass: 0.8 + Math.random() * 1.2,
        radius: 0.7 + Math.random() * 1.2,
        hue: 5,
        trail: [],
      });
    }

    return result;
  }

  function updateSimulation() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width * 0.52;
    const centerY = height * 0.34;
    const dt = 0.7;

    const accelerations = bodies.map(function () {
      return { ax: 0, ay: 0 };
    });

    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const first = bodies[i];
        const second = bodies[j];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distanceSquared = dx * dx + dy * dy + SOFTENING;
        const inverseDistance = 1 / Math.sqrt(distanceSquared);
        const force = (GRAVITY * inverseDistance * inverseDistance) / Math.sqrt(distanceSquared);
        const accelX = dx * force;
        const accelY = dy * force;

        accelerations[i].ax += accelX * second.mass;
        accelerations[i].ay += accelY * second.mass;
        accelerations[j].ax -= accelX * first.mass;
        accelerations[j].ay -= accelY * first.mass;
      }
    }

    for (let index = 0; index < bodies.length; index += 1) {
      const body = bodies[index];
      const acceleration = accelerations[index];
      const offsetX = body.x - centerX;
      const offsetY = body.y - centerY;

      body.vx += acceleration.ax * dt - offsetX * CENTER_PULL;
      body.vy += acceleration.ay * dt - offsetY * CENTER_PULL;
      body.vx *= DRAG;
      body.vy *= DRAG;
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      body.trail.push({ x: body.x, y: body.y });
      if (body.trail.length > MAX_TRAIL_POINTS) {
        body.trail.shift();
      }
    }
  }

  function drawBackground(palette) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const bg = palette.background;

    context.save();
    context.clearRect(0, 0, width, height);
    context.fillStyle = colorToCss(bg, 0.95);
    context.fillRect(0, 0, width, height);

    const halo = context.createRadialGradient(width * 0.52, height * 0.32, 0, width * 0.52, height * 0.32, Math.max(width, height) * 0.68);
    halo.addColorStop(0, colorToCss(palette.accent, 0.14));
    halo.addColorStop(0.45, colorToCss(palette.accentSoft, 0.08));
    halo.addColorStop(1, colorToCss(bg, 0));
    context.fillStyle = halo;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function drawConnections(palette) {
    const threshold = Math.min(window.innerWidth, window.innerHeight) * 0.17;
    const thresholdSquared = threshold * threshold;

    context.save();
    context.lineWidth = 1;
    for (let i = 0; i < bodies.length; i += 1) {
      const first = bodies[i];
      for (let j = i + 1; j < bodies.length; j += 1) {
        const second = bodies[j];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > thresholdSquared) {
          continue;
        }

        const opacity = (1 - distanceSquared / thresholdSquared) * 0.16;
        context.strokeStyle = colorToCss(palette.connection, opacity);
        context.beginPath();
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, second.y);
        context.stroke();
      }
    }
    context.restore();
  }

  function drawBodies(palette) {
    context.save();
    bodies.forEach(function (body) {
      const trailColor = body.mass > 100 ? palette.accent : palette.star;
      const trailLength = body.trail.length;
      for (let index = 1; index < trailLength; index += 1) {
        const previous = body.trail[index - 1];
        const current = body.trail[index];
        const alpha = (index / trailLength) * 0.12;
        context.strokeStyle = colorToCss(trailColor, alpha);
        context.lineWidth = body.mass > 100 ? 1.6 : 0.9;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(current.x, current.y);
        context.stroke();
      }

      const glowRadius = body.mass > 100 ? body.radius * 5.6 : body.radius * 3.4;
      const glow = context.createRadialGradient(body.x, body.y, 0, body.x, body.y, glowRadius);
      glow.addColorStop(0, colorToCss(trailColor, body.mass > 100 ? 0.95 : 0.72));
      glow.addColorStop(0.42, colorToCss(trailColor, body.mass > 100 ? 0.24 : 0.18));
      glow.addColorStop(1, colorToCss(trailColor, 0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(body.x, body.y, glowRadius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = colorToCss(body.mass > 100 ? palette.accent : palette.star, body.mass > 100 ? 1 : 0.88);
      context.beginPath();
      context.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  }

  function render() {
    if (!context || !canvas) {
      return;
    }

    const palette = getPalette();
    drawBackground(palette);

    if (!prefersReducedMotion) {
      updateSimulation();
      drawConnections(palette);
      drawBodies(palette);
    } else {
      drawConnections(palette);
      drawBodies(palette);
    }

    window.requestAnimationFrame(render);
  }

  function getPalette() {
    const bodyBackground = parseColor(getComputedStyle(document.body).backgroundColor, { r: 255, g: 255, b: 255 });
    const textColor = parseColor(getComputedStyle(document.body).color, { r: 68, g: 68, b: 68 });
    const accentColor = parseColor(getThemeColor("--global-theme-color", ""), textColor);
    const mutedAccent = mixColors(accentColor, bodyBackground, 0.72);
    const connectionColor = mixColors(accentColor, textColor, 0.58);

    return {
      background: bodyBackground,
      accent: accentColor,
      accentSoft: mutedAccent,
      star: connectionColor,
      connection: mixColors(accentColor, bodyBackground, 0.5),
    };
  }

  function refreshTheme() {
    const nextSignature = getPaletteSignature();
    if (nextSignature !== paletteSignature) {
      paletteSignature = nextSignature;
      bodies = buildBodies();
    }
  }

  function initCanvas() {
    if (!document.body || canvas) {
      return;
    }

    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "0";
    canvas.style.opacity = "0.95";
    canvas.style.display = "block";

    document.body.insertBefore(canvas, document.body.firstChild);
    applyBodyLayering();

    context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) {
      return;
    }

    paletteSignature = getPaletteSignature();
    resizeCanvas();
    bodies = buildBodies();
    window.addEventListener("resize", function () {
      resizeCanvas();
      bodies = buildBodies();
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", refreshTheme);
    }

    if (typeof window.MutationObserver === "function") {
      const observer = new MutationObserver(refreshTheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
      if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme"] });
      }
    }

    if (palettePoller) {
      window.clearInterval(palettePoller);
    }
    palettePoller = window.setInterval(refreshTheme, 400);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCanvas, { once: true });
  } else {
    initCanvas();
  }
})();
