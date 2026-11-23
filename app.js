/* ==========================================================================
   MAIN APPLICATION CONTROLLER
   ==========================================================================
   Connects the HTML interface, localStorage preferences, PomodoroTimer,
   and PomodoroAudio together.
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "pomodoro_clock_preferences_v1";
  const config = window.POMODORO_CONFIG;

  // ------------------------------------------------------------------------
  // Time Formatting Helpers (MM:SS)
  // ------------------------------------------------------------------------
  function formatTime(totalSeconds) {
    const safe = Math.max(0, Math.round(totalSeconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Accepts "50:00", "25", "1:30", etc. Returns total seconds or null if invalid.
  function parseTimeInput(rawText) {
    const cleaned = String(rawText || "").trim();
    if (!cleaned) return null;

    if (cleaned.includes(":")) {
      const parts = cleaned.split(":");
      if (parts.length !== 2) return null;
      const mins = Number(parts[0]);
      const secs = Number(parts[1]);
      if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0) {
        return null;
      }
      const total = Math.floor(mins) * 60 + Math.floor(secs);
      return total >= 1 && total <= 180 * 60 ? total : null;
    }

    // Plain number is treated as minutes (e.g., "25" -> 25:00)
    const minutesOnly = Number(cleaned);
    if (!Number.isFinite(minutesOnly) || minutesOnly <= 0 || minutesOnly > 180) {
      return null;
    }
    return Math.round(minutesOnly * 60);
  }

  // ------------------------------------------------------------------------
  // Preferences Persistence (localStorage)
  // ------------------------------------------------------------------------
  function getDefaultPreferences() {
    const d = config.defaults || {};
    const firstImage = (config.images && config.images[0] && config.images[0].id) || "";
    return {
      theme: d.theme === "light" ? "light" : "dark",
      imageId: firstImage,
      focusSeconds: (d.focusMinutes || 50) * 60,
      breakSeconds: (d.breakMinutes || 10) * 60,
      tickEnabled: d.tickEnabled !== false,
      mode: d.mode === "manual" ? "manual" : "auto",
      musicEnabled: d.musicEnabled !== false,
      focusRadio: d.focusRadio || "off",
      breakRadio: d.breakRadio || "off",
      pauseRadio: d.pauseRadio || "off",
    };
  }

  function loadPreferences() {
    const defaults = getDefaultPreferences();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return Object.assign({}, defaults, parsed);
    } catch (_err) {
      return defaults;
    }
  }

  function savePreferences(prefs) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (_err) {
      // Ignore storage quota or private-mode restrictions
    }
  }

  // ------------------------------------------------------------------------
  // Initialize App on DOM Ready
  // ------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const prefs = loadPreferences();

    // DOM Elements — Main View
    const musicToggleBtn = document.getElementById("music-toggle-btn");
    const musicToggleIcon = document.getElementById("music-toggle-icon");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeToggleIcon = document.getElementById("theme-toggle-icon");
    const settingsOpenBtn = document.getElementById("settings-open-btn");
    const artworkBtn = document.getElementById("artwork-toggle-theme");
    const artworkImg = document.getElementById("main-artwork");
    const timerColumn = document.getElementById("timer-column");
    const timerRingBtn = document.getElementById("timer-ring-btn");
    const ringProgress = document.getElementById("ring-progress");
    const timerDisplay = document.getElementById("timer-display");
    const timerStatusPill = document.getElementById("timer-status-pill");
    const resetBtn = document.getElementById("timer-reset-btn");
    const skipBtn = document.getElementById("timer-skip-btn");

    // DOM Elements — Settings Bento Overlay
    const settingsOverlay = document.getElementById("settings-overlay");
    const settingsCloseBtn = document.getElementById("settings-close-btn");
    const stationListEl = document.getElementById("station-list");
    const stationStatusNote = document.getElementById("station-status-note");
    const focusDurationInput = document.getElementById("focus-duration-input");
    const breakDurationInput = document.getElementById("break-duration-input");
    const tickToggleInput = document.getElementById("tick-toggle-input");
    const focusRadioSelect = document.getElementById("focus-radio-select");
    const breakRadioSelect = document.getElementById("break-radio-select");
    const pauseRadioSelect = document.getElementById("pause-radio-select");
    const imageSelect = document.getElementById("image-select");
    const modeAutoBtn = document.getElementById("mode-auto-btn");
    const modeManualBtn = document.getElementById("mode-manual-btn");

    // Prepare SVG clockwise progress ring math
    const radius = Number(ringProgress.getAttribute("r"));
    const circumference = 2 * Math.PI * radius;
    ringProgress.style.strokeDasharray = `${circumference}`;
    ringProgress.style.strokeDashoffset = `${circumference}`;

    // Initialize Dynamic Image Theme Engine (optional module)
    const dynamicTheme = window.PomodoroTheme ? new window.PomodoroTheme(config) : null;

    // Initialize Audio & Timer Engines
    const audio = new window.PomodoroAudio(config);
    audio.setTickEnabled(prefs.tickEnabled);
    audio.setMusicEnabled(prefs.musicEnabled);

    const timer = new window.PomodoroTimer({
      focusSeconds: prefs.focusSeconds,
      breakSeconds: prefs.breakSeconds,
      autoMode: prefs.mode === "auto",
      onUpdate: renderTimer,
      onSecondTick: () => audio.playTick(),
      onSessionComplete: (finishedSession) => {
        if (finishedSession === "focus") {
          audio.playFocusEnd();
        } else {
          audio.playBreakEnd();
        }
      },
      onStateChange: ({ playbackState }) => {
        applyStateRadio(playbackState);
      },
    });

    // ----------------------------------------------------------------------
    // Theme (Light / Dark)
    // ----------------------------------------------------------------------
    function applyTheme(theme, { applyDynamic = true } = {}) {
      prefs.theme = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", prefs.theme);
      if (themeToggleIcon && themeToggleBtn) {
        const isDark = prefs.theme === "dark";
        themeToggleIcon.textContent = isDark ? "light_mode" : "dark_mode";
        themeToggleBtn.title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
        themeToggleBtn.setAttribute("aria-label", themeToggleBtn.title);
      }
      if (applyDynamic && dynamicTheme) {
        dynamicTheme.applyFromImage(artworkImg, prefs.theme);
      }
      savePreferences(prefs);
    }
    function applyTheme(theme, { applyDynamic = true } = {}) {
      prefs.theme = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", prefs.theme);
      if (applyDynamic && dynamicTheme) {
        dynamicTheme.applyFromImage(artworkImg, prefs.theme);
      }
      savePreferences(prefs);
    }

    // ----------------------------------------------------------------------
    // Artwork Selection (Auto-scanned images.json + config.js fallback)
    // ----------------------------------------------------------------------
    let availableImages = Array.isArray(config.images) ? config.images.slice() : [];

    async function loadAvailableImages() {
      const fallbackImages = Array.isArray(config.images) ? config.images.slice() : [];
      const autoScanEnabled =
        !config.defaults || config.defaults.autoScanImages !== false;

      if (!autoScanEnabled) {
        availableImages = fallbackImages;
        return;
      }

      try {
        const response = await fetch("assets/img/images.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Manifest not available");
        }
        const scanned = await response.json();
        if (!Array.isArray(scanned) || scanned.length === 0) {
          availableImages = fallbackImages;
          return;
        }

        // Preserve any custom id/label defined in config.js for matching files
        const configByPath = new Map();
        fallbackImages.forEach((item) => {
          if (item && item.path) {
            configByPath.set(item.path, item);
          }
        });

        availableImages = scanned
          .filter((item) => item && typeof item.path === "string" && item.path.trim())
          .map((item) => {
            const custom = configByPath.get(item.path);
            return {
              id: (custom && custom.id) || item.id,
              label: (custom && custom.label) || item.label || item.id,
              path: item.path,
            };
          });

        if (availableImages.length === 0) {
          availableImages = fallbackImages;
        }
      } catch (_err) {
        // Opening locally via file:// or without images.json falls back cleanly to config.js
        availableImages = fallbackImages;
      }
    }

    function populateImageSelect() {
      const images = availableImages;
      imageSelect.innerHTML = "";

      if (images.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No images found in assets/img/";
        imageSelect.appendChild(opt);
        return;
      }

      images.forEach((img) => {
        const opt = document.createElement("option");
        opt.value = img.id;
        opt.textContent = img.label;
        imageSelect.appendChild(opt);
      });

      const valid = images.some((img) => img.id === prefs.imageId);
      if (!valid) {
        prefs.imageId = images[0].id;
      }
      imageSelect.value = prefs.imageId;
      applySelectedImage(prefs.imageId);
    }

    function applySelectedImage(imageId) {
      const images = availableImages;
      const chosen = images.find((img) => img.id === imageId) || images[0];
      if (!chosen) return;
      prefs.imageId = chosen.id;
      artworkImg.src = chosen.path;
      artworkImg.alt = chosen.label;
      if (dynamicTheme) {
        dynamicTheme.applyFromImage(artworkImg, prefs.theme);
      }
      savePreferences(prefs);
    }

    // ----------------------------------------------------------------------
    // Radio Station List & State Dropdowns
    // ----------------------------------------------------------------------
    function populateRadioControls() {
      const stations = config.radioStations || [];

      // 1. Clickable Station List Card
      stationListEl.innerHTML = "";
      stations.forEach((station) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "station-item-btn";
        btn.dataset.stationId = station.id;

        const nameWrap = document.createElement("span");
        nameWrap.className = "station-name-wrap";

        const dot = document.createElement("span");
        dot.className = "station-dot";
        dot.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.textContent = station.name;

        nameWrap.appendChild(dot);
        nameWrap.appendChild(label);
        btn.appendChild(nameWrap);

        if (!station.url || !station.url.trim()) {
          const badge = document.createElement("span");
          badge.className = "station-badge";
          badge.textContent = "Placeholder";
          btn.appendChild(badge);
        }

        btn.addEventListener("click", () => {
          // Clicking a station immediately plays/previews it (unmuting if needed)
          if (!prefs.musicEnabled) {
            prefs.musicEnabled = true;
            audio.setMusicEnabled(true);
            renderMusicButton();
            savePreferences(prefs);
          }
          audio.playStation(station.id, { forceReplay: true });
          highlightActiveStation(station.id);
        });

        li.appendChild(btn);
        stationListEl.appendChild(li);
      });

      // 2. Focus / Break / Pause Radio Dropdowns
      const dropdowns = [
        { el: focusRadioSelect, key: "focusRadio" },
        { el: breakRadioSelect, key: "breakRadio" },
        { el: pauseRadioSelect, key: "pauseRadio" },
      ];

      dropdowns.forEach(({ el, key }) => {
        el.innerHTML = "";

        const offOption = document.createElement("option");
        offOption.value = "off";
        offOption.textContent = "Silent / Off";
        el.appendChild(offOption);

        stations.forEach((station) => {
          const opt = document.createElement("option");
          opt.value = station.id;
          opt.textContent = station.name;
          el.appendChild(opt);
        });

        const isValid =
          prefs[key] === "off" || stations.some((s) => s.id === prefs[key]);
        if (!isValid) {
          prefs[key] = "off";
        }
        el.value = prefs[key];
      });
    }

    function highlightActiveStation(activeId) {
      const buttons = stationListEl.querySelectorAll(".station-item-btn");
      buttons.forEach((btn) => {
        const isActive = btn.dataset.stationId === activeId;
        btn.classList.toggle("is-active", isActive);
      });
    }

    function getConfiguredRadioForState(playbackState) {
      if (playbackState === "focus") return prefs.focusRadio;
      if (playbackState === "break") return prefs.breakRadio;
      return prefs.pauseRadio;
    }

    function applyStateRadio(playbackState) {
      const targetStationId = getConfiguredRadioForState(playbackState);
      audio.playStation(targetStationId);
      highlightActiveStation(targetStationId);
    }

    audio.onRadioStatusChange = ({ stationId, statusText }) => {
      highlightActiveStation(stationId);
      stationStatusNote.textContent = statusText || "";
    };

    // ----------------------------------------------------------------------
    // Music Toggle & Mode Rendering
    // ----------------------------------------------------------------------
    function renderMusicButton() {
      musicToggleIcon.textContent = prefs.musicEnabled ? "music_note" : "music_off";
      musicToggleBtn.classList.toggle("is-muted", !prefs.musicEnabled);
      musicToggleBtn.setAttribute(
        "aria-label",
        prefs.musicEnabled ? "Turn background music off" : "Turn background music on"
      );
      musicToggleBtn.title = prefs.musicEnabled ? "Music: On" : "Music: Off";
    }

    function renderModeButtons() {
      const isAuto = prefs.mode === "auto";
      modeAutoBtn.classList.toggle("is-active", isAuto);
      modeManualBtn.classList.toggle("is-active", !isAuto);
      modeAutoBtn.setAttribute("aria-pressed", String(isAuto));
      modeManualBtn.setAttribute("aria-pressed", String(!isAuto));
    }

    function renderDurationInputs() {
      focusDurationInput.value = formatTime(prefs.focusSeconds);
      breakDurationInput.value = formatTime(prefs.breakSeconds);
    }

    // ----------------------------------------------------------------------
    // Timer Ring, Countdown Text & Live Browser Tab Title
    // ----------------------------------------------------------------------
    function renderTimer({ session, isRunning, remainingSeconds, progress, isMidSession }) {
      const timeStr = formatTime(remainingSeconds);
      timerDisplay.textContent = timeStr;

      // Animate ring clockwise from 12 o'clock as elapsed progress grows 0 -> 1
      const dashOffset = circumference * (1 - progress);
      ringProgress.style.strokeDashoffset = `${dashOffset}`;

      const isBreak = session === "break";
      timerColumn.classList.toggle("is-break", isBreak);
      timerColumn.classList.toggle("is-paused-midway", !isRunning && isMidSession);

      const sessionLabel = isBreak ? "Break" : "Focus";
      if (isRunning) {
        timerStatusPill.textContent = sessionLabel;
        document.title = `${timeStr} · ${sessionLabel}`;
      } else if (isMidSession) {
        timerStatusPill.textContent = `${sessionLabel} · Paused`;
        document.title = `${timeStr} · Paused`;
      } else {
        timerStatusPill.textContent = sessionLabel;
        document.title = `${timeStr} · ${sessionLabel}`;
      }
    }

    // ----------------------------------------------------------------------
    // Settings Overlay Open / Close
    // ----------------------------------------------------------------------
    function openSettings() {
      settingsOverlay.classList.add("is-open");
      settingsOverlay.setAttribute("aria-hidden", "false");
    }

    function closeSettings() {
      settingsOverlay.classList.remove("is-open");
      settingsOverlay.setAttribute("aria-hidden", "true");
    }

    // ----------------------------------------------------------------------
    // Wire Up Event Listeners
    // ----------------------------------------------------------------------

    // Click main artwork -> cycle to the next image
    artworkBtn.addEventListener("click", () => {
      if (availableImages.length < 2) return;
      const currentIndex = availableImages.findIndex((img) => img.id === prefs.imageId);
      const nextImage = availableImages[(currentIndex + 1) % availableImages.length];
      applySelectedImage(nextImage.id);
      imageSelect.value = nextImage.id;
    });

    // Top-right Light / Dark mode button
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        applyTheme(prefs.theme === "dark" ? "light" : "dark");
      });
    }

    // Single-click timer -> Start / Pause
    timerRingBtn.addEventListener("click", () => {
      timer.toggle();
    });

    // Double-click timer -> Reset current session cleanly
    timerRingBtn.addEventListener("dblclick", () => {
      timer.reset();
    });

    // Keyboard support on timer ring (Space or Enter to start/pause)
    timerRingBtn.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        timer.toggle();
      }
    });

    // Subtle hover controls below the ring
    resetBtn.addEventListener("click", () => timer.reset());
    skipBtn.addEventListener("click", () => timer.skip());

    // Top-right Music On/Off button
    musicToggleBtn.addEventListener("click", () => {
      prefs.musicEnabled = !prefs.musicEnabled;
      audio.setMusicEnabled(prefs.musicEnabled);
      if (prefs.musicEnabled && audio.activeStationId === "off") {
        applyStateRadio(timer.getPlaybackState());
      }
      renderMusicButton();
      savePreferences(prefs);
    });

    // Settings open / close
    settingsOpenBtn.addEventListener("click", openSettings);
    settingsCloseBtn.addEventListener("click", closeSettings);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && settingsOverlay.classList.contains("is-open")) {
        closeSettings();
      }
    });

    // Editable Focus & Break durations
    function commitDurationEdit(inputEl, prefKey) {
      const parsedSeconds = parseTimeInput(inputEl.value);
      if (parsedSeconds !== null) {
        prefs[prefKey] = parsedSeconds;
        timer.setDurations(prefs.focusSeconds, prefs.breakSeconds);
        savePreferences(prefs);
      }
      renderDurationInputs();
    }

    focusDurationInput.addEventListener("change", () =>
      commitDurationEdit(focusDurationInput, "focusSeconds")
    );
    focusDurationInput.addEventListener("blur", () =>
      commitDurationEdit(focusDurationInput, "focusSeconds")
    );
    breakDurationInput.addEventListener("change", () =>
      commitDurationEdit(breakDurationInput, "breakSeconds")
    );
    breakDurationInput.addEventListener("blur", () =>
      commitDurationEdit(breakDurationInput, "breakSeconds")
    );

    // Tick toggle switch
    tickToggleInput.addEventListener("change", () => {
      prefs.tickEnabled = tickToggleInput.checked;
      audio.setTickEnabled(prefs.tickEnabled);
      savePreferences(prefs);
    });

    // State-based radio dropdowns
    function handleRadioDropdownChange(key, matchingState, value) {
      prefs[key] = value;
      savePreferences(prefs);
      if (timer.getPlaybackState() === matchingState) {
        applyStateRadio(matchingState);
      }
    }

    focusRadioSelect.addEventListener("change", (e) =>
      handleRadioDropdownChange("focusRadio", "focus", e.target.value)
    );
    breakRadioSelect.addEventListener("change", (e) =>
      handleRadioDropdownChange("breakRadio", "break", e.target.value)
    );
    pauseRadioSelect.addEventListener("change", (e) =>
      handleRadioDropdownChange("pauseRadio", "pause", e.target.value)
    );

    // Image dropdown
    imageSelect.addEventListener("change", (e) => {
      applySelectedImage(e.target.value);
    });

    // Auto / Manual mode buttons
    modeAutoBtn.addEventListener("click", () => {
      prefs.mode = "auto";
      timer.setAutoMode(true);
      renderModeButtons();
      savePreferences(prefs);
    });

    modeManualBtn.addEventListener("click", () => {
      prefs.mode = "manual";
      timer.setAutoMode(false);
      renderModeButtons();
      savePreferences(prefs);
    });

    // ----------------------------------------------------------------------
    // Initial Render
    // ----------------------------------------------------------------------
    applyTheme(prefs.theme, { applyDynamic: false });
    loadAvailableImages().then(() => {
      populateImageSelect();
    });
    populateRadioControls();
    renderDurationInputs();
    tickToggleInput.checked = prefs.tickEnabled;
    renderMusicButton();
    renderModeButtons();

    renderTimer({
      session: timer.session,
      isRunning: timer.isRunning,
      remainingSeconds: timer.getRemainingSeconds(),
      progress: timer.getProgress(),
      isMidSession: timer.isMidSession(),
    });

    // Apply Pause Radio on initial load if one is configured
    const initialRadio = getConfiguredRadioForState(timer.getPlaybackState());
    if (initialRadio && initialRadio !== "off") {
      applyStateRadio(timer.getPlaybackState());
    }
  });
})();
