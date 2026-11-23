/* ==========================================================================
   DYNAMIC IMAGE COLOR THEMING (CANVAS EXTRACTION)
   ==========================================================================
   Samples the currently displayed artwork on an offscreen canvas, finds its
   most visually dominant vibrant hue, and generates balanced Dark & Light
   mode palettes for the CSS variables in styles.css.

   Falls back silently to styles.css defaults on grayscale images, load
   errors, or local file:// canvas restrictions.
   ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------------------
  // EASY-TO-EDIT COLOR INTENSITY CONTROLS
  // Adjust any number below, save, and refresh to tune the look.
  // ------------------------------------------------------------------------
  const THEME_SETTINGS = {
    sampleSize: 64,            // Offscreen canvas size (64x64 is fast and accurate)
    minAlpha: 128,             // Ignore transparent / semi-transparent pixels (0-255)
    bgTintStrength: 1.0,       // Background color tint: 0 = neutral gray, 1 = balanced, 1.4 = richer
    accentSaturationMin: 38,   // Minimum saturation (%) for the progress ring & accent
    accentSaturationMax: 66,   // Maximum saturation (%) so accents stay calm, never neon
    minPixelSaturation: 14,    // Ignore dull gray pixels below this saturation (%)
    minPixelLightness: 12,     // Ignore near-black pixels below this lightness (%)
    maxPixelLightness: 90,     // Ignore near-white pixels above this lightness (%)
    hueBuckets: 24,            // Hue wheel divisions (24 buckets = 15 degrees each)
    minVibrantPixels: 12,      // Below this count, treat image as grayscale and use styles.css defaults
  };

  // Exact CSS variable names from the top of styles.css managed by this module
  const MANAGED_CSS_VARS = [
    "--bg-page",
    "--bg-card",
    "--bg-card-hover",
    "--bg-input",
    "--border-subtle",
    "--text-primary",
    "--text-secondary",
    "--icon-color",
    "--ring-track",
    "--ring-progress-focus",
    "--ring-progress-break",
    "--timer-text",
    "--timer-text-break",
    "--station-active-bg",
    "--station-active-accent",
    "--tick-track-off",
  ];

  // ------------------------------------------------------------------------
  // Color Math Helpers (RGB <-> HSL & WCAG Contrast Guarantee)
  // ------------------------------------------------------------------------
  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    const l = (max + min) / 2;

    if (delta === 0) {
      return { h: 0, s: 0, l: l * 100 };
    }

    const s = delta / (1 - Math.abs(2 * l - 1));
    let h;
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    return { h, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    const sn = clamp(s, 0, 100) / 100;
    const ln = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    const hue = ((h % 360) + 360) % 360;

    if (hue < 60) {
      r1 = c; g1 = x; b1 = 0;
    } else if (hue < 120) {
      r1 = x; g1 = c; b1 = 0;
    } else if (hue < 180) {
      r1 = 0; g1 = c; b1 = x;
    } else if (hue < 240) {
      r1 = 0; g1 = x; b1 = c;
    } else if (hue < 300) {
      r1 = x; g1 = 0; b1 = c;
    } else {
      r1 = c; g1 = 0; b1 = x;
    }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  function relativeLuminance(r, g, b) {
    const channel = (v) => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrastRatio(hslA, hslB) {
    const rgbA = hslToRgb(hslA.h, hslA.s, hslA.l);
    const rgbB = hslToRgb(hslB.h, hslB.s, hslB.l);
    const lumA = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
    const lumB = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Gently nudges lightness up (dark mode) or down (light mode) until contrast target is met
  function ensureReadable(fgHsl, bgHsl, minRatio, isDark) {
    let l = fgHsl.l;
    const step = isDark ? 2 : -2;
    for (let i = 0; i < 35; i++) {
      if (contrastRatio({ h: fgHsl.h, s: fgHsl.s, l }, bgHsl) >= minRatio) {
        break;
      }
      l = clamp(l + step, 6, 96);
    }
    return { h: fgHsl.h, s: fgHsl.s, l };
  }

  function formatHsl(hsl) {
    return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
  }

  function formatHsla(h, s, l, alpha) {
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${alpha})`;
  }

  // ------------------------------------------------------------------------
  // Dominant Vibrant Color Extraction (Offscreen Canvas + Hue Bucketing)
  // ------------------------------------------------------------------------
  function extractDominantHsl(imgEl) {
    if (!imgEl || !imgEl.complete || imgEl.naturalWidth === 0) {
      return null;
    }

    const size = THEME_SETTINGS.sampleSize;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(imgEl, 0, 0, size, size);

    // Wrapped in try/catch for local file:// security restrictions or tainted canvases
    let pixels;
    try {
      pixels = ctx.getImageData(0, 0, size, size).data;
    } catch (_securityOrCanvasError) {
      return null;
    }

    const bucketCount = THEME_SETTINGS.hueBuckets;
    const bucketWidth = 360 / bucketCount;
    const buckets = Array.from({ length: bucketCount }, () => ({
      weight: 0,
      sinSum: 0,
      cosSum: 0,
      satSum: 0,
      lightSum: 0,
      count: 0,
    }));

    let validVibrantPixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha < THEME_SETTINGS.minAlpha) continue;

      const { h, s, l } = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);

      // Skip near-black, near-white, and dull gray pixels
      if (
        s < THEME_SETTINGS.minPixelSaturation ||
        l < THEME_SETTINGS.minPixelLightness ||
        l > THEME_SETTINGS.maxPixelLightness
      ) {
        continue;
      }

      validVibrantPixels += 1;

      // Weight pixels by saturation and mid-tone clarity so rich hues win cleanly
      const satFactor = Math.pow(s / 100, 1.35);
      const midToneFactor = Math.max(0.18, 1 - Math.abs(l - 52) / 52);
      const weight = satFactor * midToneFactor;

      const idx = Math.floor(h / bucketWidth) % bucketCount;
      const b = buckets[idx];
      const rad = (h * Math.PI) / 180;

      b.weight += weight;
      b.sinSum += Math.sin(rad) * weight;
      b.cosSum += Math.cos(rad) * weight;
      b.satSum += s * weight;
      b.lightSum += l * weight;
      b.count += 1;
    }

    // Pure grayscale or nearly monochrome image -> fall back to styles.css defaults
    if (validVibrantPixels < THEME_SETTINGS.minVibrantPixels) {
      return null;
    }

    let best = null;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].weight > 0 && (!best || buckets[i].weight > best.weight)) {
        best = buckets[i];
      }
    }

    if (!best || best.weight <= 0) {
      return null;
    }

    let meanHue = (Math.atan2(best.sinSum, best.cosSum) * 180) / Math.PI;
    if (meanHue < 0) meanHue += 360;

    return {
      h: meanHue,
      s: best.satSum / best.weight,
      l: best.lightSum / best.weight,
    };
  }

  // ------------------------------------------------------------------------
  // Palette Builder (Harmonious Dark & Light Mode Tokens)
  // ------------------------------------------------------------------------
  function buildPalette(dominantHsl, mode) {
    const isDark = mode !== "light";
    const tint = clamp(THEME_SETTINGS.bgTintStrength, 0, 1.5);
    const h = dominantHsl.h;
    const breakH = (h + 140) % 360; // Calm contrasting hue for Break sessions
    const accentS = clamp(
      dominantHsl.s,
      THEME_SETTINGS.accentSaturationMin,
      THEME_SETTINGS.accentSaturationMax
    );

    if (isDark) {
      const bgPage = { h, s: clamp(18 * tint, 0, 32), l: 10 };
      const bgCard = { h, s: clamp(20 * tint, 0, 34), l: 16 };
      const bgCardHover = { h, s: clamp(22 * tint, 0, 36), l: 21 };
      const bgInput = { h, s: clamp(19 * tint, 0, 32), l: 13 };

      const textPrimary = ensureReadable(
        { h, s: clamp(14 * tint, 0, 22), l: 94 },
        bgCard,
        9.0,
        true
      );
      const textSecondary = ensureReadable(
        { h, s: clamp(15 * tint, 0, 24), l: 72 },
        bgCard,
        4.8,
        true
      );
      const iconColor = ensureReadable(
        { h, s: clamp(14 * tint, 0, 22), l: 89 },
        bgPage,
        8.0,
        true
      );
      const ringProgressFocus = ensureReadable(
        { h, s: accentS, l: 71 },
        bgPage,
        5.0,
        true
      );
      const ringProgressBreak = ensureReadable(
        { h: breakH, s: clamp(accentS - 6, 30, 56), l: 67 },
        bgPage,
        5.0,
        true
      );
      const timerText = ensureReadable(
        { h, s: clamp(accentS - 10, 24, 54), l: 78 },
        bgPage,
        7.0,
        true
      );
      const timerTextBreak = ensureReadable(
        { h: breakH, s: clamp(accentS - 8, 26, 54), l: 75 },
        bgPage,
        7.0,
        true
      );

      return {
        "--bg-page": formatHsl(bgPage),
        "--bg-card": formatHsl(bgCard),
        "--bg-card-hover": formatHsl(bgCardHover),
        "--bg-input": formatHsl(bgInput),
        "--border-subtle": formatHsla(h, clamp(24 * tint, 0, 38), 86, 0.11),
        "--text-primary": formatHsl(textPrimary),
        "--text-secondary": formatHsl(textSecondary),
        "--icon-color": formatHsl(iconColor),
        "--ring-track": formatHsl({ h, s: clamp(14 * tint, 0, 24), l: 31 }),
        "--ring-progress-focus": formatHsl(ringProgressFocus),
        "--ring-progress-break": formatHsl(ringProgressBreak),
        "--timer-text": formatHsl(timerText),
        "--timer-text-break": formatHsl(timerTextBreak),
        "--station-active-bg": formatHsl({ h, s: clamp(24 * tint, 0, 38), l: 23 }),
        "--station-active-accent": formatHsl(ringProgressFocus),
        "--tick-track-off": formatHsl({ h, s: clamp(18 * tint, 0, 30), l: 25 }),
      };
    }

    // Light Mode
    const bgPage = { h, s: clamp(18 * tint, 0, 30), l: 94 };
    const bgCard = { h, s: clamp(17 * tint, 0, 28), l: 88 };
    const bgCardHover = { h, s: clamp(18 * tint, 0, 30), l: 83 };
    const bgInput = { h, s: clamp(14 * tint, 0, 24), l: 97 };

    const textPrimary = ensureReadable(
      { h, s: clamp(22 * tint, 0, 32), l: 17 },
      bgCard,
      9.0,
      false
    );
    const textSecondary = ensureReadable(
      { h, s: clamp(18 * tint, 0, 28), l: 36 },
      bgCard,
      4.8,
      false
    );
    const iconColor = ensureReadable(
      { h, s: clamp(20 * tint, 0, 30), l: 21 },
      bgPage,
      8.0,
      false
    );
    const ringProgressFocus = ensureReadable(
      { h, s: accentS, l: 43 },
      bgPage,
      4.6,
      false
    );
    const ringProgressBreak = ensureReadable(
      { h: breakH, s: clamp(accentS - 4, 32, 58), l: 38 },
      bgPage,
      4.6,
      false
    );
    const timerText = ensureReadable(
      { h, s: clamp(accentS - 8, 26, 54), l: 33 },
      bgPage,
      7.0,
      false
    );
    const timerTextBreak = ensureReadable(
      { h: breakH, s: clamp(accentS - 8, 26, 54), l: 31 },
      bgPage,
      7.0,
      false
    );

    return {
      "--bg-page": formatHsl(bgPage),
      "--bg-card": formatHsl(bgCard),
      "--bg-card-hover": formatHsl(bgCardHover),
      "--bg-input": formatHsl(bgInput),
      "--border-subtle": formatHsla(h, clamp(22 * tint, 0, 36), 20, 0.13),
      "--text-primary": formatHsl(textPrimary),
      "--text-secondary": formatHsl(textSecondary),
      "--icon-color": formatHsl(iconColor),
      "--ring-track": formatHsl({ h, s: clamp(15 * tint, 0, 25), l: 80 }),
      "--ring-progress-focus": formatHsl(ringProgressFocus),
      "--ring-progress-break": formatHsl(ringProgressBreak),
      "--timer-text": formatHsl(timerText),
      "--timer-text-break": formatHsl(timerTextBreak),
      "--station-active-bg": formatHsl({ h, s: clamp(24 * tint, 0, 36), l: 82 }),
      "--station-active-accent": formatHsl(ringProgressFocus),
      "--tick-track-off": formatHsl({ h, s: clamp(14 * tint, 0, 24), l: 72 }),
    };
  }

  // ------------------------------------------------------------------------
  // Public Controller Class (window.PomodoroTheme)
  // ------------------------------------------------------------------------
  class PomodoroTheme {
    constructor(config) {
      this.config = config || {};
      this.cache = new Map(); // imageSrc -> extracted { h, s, l } or null
      this.requestId = 0;
    }

    isEnabled() {
      const defaults = this.config.defaults || {};
      if (this.config.dynamicThemeFromImage === false) return false;
      if (defaults.dynamicThemeFromImage === false) return false;
      return true;
    }

    clear() {
      const rootStyle = document.documentElement.style;
      MANAGED_CSS_VARS.forEach((varName) => rootStyle.removeProperty(varName));
    }

    _applyPalette(dominantHsl, mode) {
      if (!dominantHsl) {
        this.clear();
        return;
      }
      const palette = buildPalette(dominantHsl, mode);
      const rootStyle = document.documentElement.style;
      Object.keys(palette).forEach((varName) => {
        rootStyle.setProperty(varName, palette[varName]);
      });
    }

    applyFromImage(imgEl, mode) {
      if (!this.isEnabled() || !imgEl) {
        this.clear();
        return;
      }

      const token = ++this.requestId;
      const srcKey = imgEl.getAttribute("src") || imgEl.currentSrc || "";

      // Reuse cached extraction immediately when toggling Light / Dark mode
      if (srcKey && this.cache.has(srcKey)) {
        this._applyPalette(this.cache.get(srcKey), mode);
        return;
      }

      const runExtraction = () => {
        // Ignore stale callbacks if the user switched images or mode mid-load
        if (token !== this.requestId) return;
        const resolvedKey = imgEl.getAttribute("src") || imgEl.currentSrc || srcKey;
        const dominant = extractDominantHsl(imgEl);
        if (resolvedKey) {
          this.cache.set(resolvedKey, dominant);
        }
        this._applyPalette(dominant, mode);
      };

      if (imgEl.complete && imgEl.naturalWidth > 0) {
        runExtraction();
      } else {
        imgEl.addEventListener("load", runExtraction, { once: true });
        imgEl.addEventListener(
          "error",
          () => {
            if (token === this.requestId) {
              this.clear();
            }
          },
          { once: true }
        );
      }
    }
  }

  window.PomodoroTheme = PomodoroTheme;
})();
