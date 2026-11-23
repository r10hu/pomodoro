/* ==========================================================================
   AUDIO ENGINE — BUILT-IN WEB AUDIO API SOUNDS + RADIO STREAM PLAYER
   ==========================================================================
   - Synthesizes Focus End click, Break End soft buzz, and Clock Tick locally
     using the browser's built-in Web Audio API (zero external requests).
   - Supports optional custom sound URLs from config.js with automatic fallback.
   - Manages background radio streams cleanly and handles browser autoplay rules.
   ========================================================================== */

(function () {
  "use strict";

  class PomodoroAudio {
    constructor(config) {
      this.config = config;
      this.ctx = null;
      this.tickAlternator = false;

      // Persistent HTML5 audio element for background radio streams
      this.radioEl = new Audio();
      this.radioEl.preload = "none";

      this.musicEnabled = true;
      this.tickEnabled = true;
      this.activeStationId = "off";
      this.activeStationUrl = "";
      this.pendingAutoplayStationId = null;

      // Optional UI callback: ({ stationId, statusText, isPlaying })
      this.onRadioStatusChange = null;

      this._bindRadioEvents();
      this._bindAutoplayUnlock();
    }

    // ----------------------------------------------------------------------
    // Browser Autoplay Unlock (runs smoothly on the user's first click/key)
    // ----------------------------------------------------------------------
    _bindAutoplayUnlock() {
      const unlock = () => {
        this._ensureAudioContext();
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        // Retry any radio stream that was waiting for the first user gesture
        if (this.pendingAutoplayStationId && this.musicEnabled) {
          const stationToResume = this.pendingAutoplayStationId;
          this.pendingAutoplayStationId = null;
          this.playStation(stationToResume, { forceReplay: true });
        }
      };

      document.addEventListener("pointerdown", unlock, { passive: true });
      document.addEventListener("keydown", unlock, { passive: true });
    }

    _ensureAudioContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    _bindRadioEvents() {
      this.radioEl.addEventListener("playing", () => {
        this._emitRadioStatus(this.activeStationId, "Playing", true);
      });

      this.radioEl.addEventListener("waiting", () => {
        if (this.musicEnabled && this.activeStationUrl) {
          this._emitRadioStatus(this.activeStationId, "Connecting...", false);
        }
      });

      this.radioEl.addEventListener("error", () => {
        // Ignore errors triggered when intentionally clearing the stream source
        if (!this.activeStationUrl) return;
        this._emitRadioStatus(
          this.activeStationId,
          "Could not load stream — check the URL in config.js",
          false
        );
      });
    }

    _emitRadioStatus(stationId, statusText, isPlaying) {
      if (typeof this.onRadioStatusChange === "function") {
        this.onRadioStatusChange({ stationId, statusText, isPlaying });
      }
    }

    // ----------------------------------------------------------------------
    // Master Settings
    // ----------------------------------------------------------------------
    setTickEnabled(enabled) {
      this.tickEnabled = Boolean(enabled);
    }

    setMusicEnabled(enabled) {
      this.musicEnabled = Boolean(enabled);
      if (!this.musicEnabled) {
        this.pendingAutoplayStationId = null;
        this.radioEl.pause();
        this._emitRadioStatus(this.activeStationId, "Music muted", false);
      } else if (this.activeStationId && this.activeStationId !== "off") {
        this.playStation(this.activeStationId, { forceReplay: true });
      }
    }

    // ----------------------------------------------------------------------
    // Radio Stream Playback
    // ----------------------------------------------------------------------
    findStation(stationId) {
      const stations = this.config.radioStations || [];
      return stations.find((s) => s.id === stationId) || null;
    }

    stopRadio() {
      this.activeStationId = "off";
      this.activeStationUrl = "";
      this.pendingAutoplayStationId = null;
      this.radioEl.pause();
      this.radioEl.removeAttribute("src");
      this.radioEl.load();
      this._emitRadioStatus("off", "", false);
    }

    playStation(stationId, { forceReplay = false } = {}) {
      if (!stationId || stationId === "off") {
        this.stopRadio();
        return;
      }

      const station = this.findStation(stationId);
      if (!station) {
        this.stopRadio();
        return;
      }

      const cleanUrl = typeof station.url === "string" ? station.url.trim() : "";
      this.activeStationId = station.id;

      // Placeholder or blank URL — handle gracefully without errors
      if (!cleanUrl) {
        this.activeStationUrl = "";
        this.radioEl.pause();
        this.radioEl.removeAttribute("src");
        this._emitRadioStatus(
          station.id,
          `${station.name} has no stream URL yet — paste a link in config.js`,
          false
        );
        return;
      }

      // Respect master Music On/Off toggle
      if (!this.musicEnabled) {
        this.activeStationUrl = cleanUrl;
        this.radioEl.pause();
        this._emitRadioStatus(station.id, "Music is muted (click the note icon to unmute)", false);
        return;
      }

      // Avoid restarting if this exact stream is already playing
      if (!forceReplay && this.activeStationUrl === cleanUrl && !this.radioEl.paused) {
        this._emitRadioStatus(station.id, "Playing", true);
        return;
      }

      this.activeStationUrl = cleanUrl;
      this.radioEl.src = cleanUrl;
      this._emitRadioStatus(station.id, `Starting ${station.name}...`, false);

      const playPromise = this.radioEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          if (err && err.name === "NotAllowedError") {
            // Browser blocked autoplay before user interaction — queue it seamlessly
            this.pendingAutoplayStationId = station.id;
            this._emitRadioStatus(
              station.id,
              "Click anywhere to allow audio playback",
              false
            );
          } else {
            this._emitRadioStatus(
              station.id,
              "Could not play stream — verify the URL in config.js",
              false
            );
          }
        });
      }
    }

    // ----------------------------------------------------------------------
    // Sound Effects (Custom URL -> Fallback to Built-In Web Audio API)
    // ----------------------------------------------------------------------
    _playCustomOrFallback(customUrl, fallbackFn) {
      const url = typeof customUrl === "string" ? customUrl.trim() : "";
      if (!url) {
        fallbackFn();
        return;
      }

      try {
        const audio = new Audio(url);
        audio.volume = 0.7;
        let fellBack = false;
        const triggerFallback = () => {
          if (!fellBack) {
            fellBack = true;
            fallbackFn();
          }
        };
        audio.addEventListener("error", triggerFallback, { once: true });
        const p = audio.play();
        if (p && typeof p.catch === "function") {
          p.catch(triggerFallback);
        }
      } catch (_err) {
        fallbackFn();
      }
    }

    // 1. Crisp clicking sound at the end of a Focus session
    playFocusEnd() {
      const customUrl = this.config.sounds && this.config.sounds.focusEnd;
      this._playCustomOrFallback(customUrl, () => this._synthFocusClick());
    }

    _synthFocusClick() {
      const ctx = this._ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Crisp double mechanical click (clean, tactile, unmistakable)
      [0, 0.11].forEach((offset, idx) => {
        const t = now + offset;

        // Short resonant woody/mechanical snap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        const startFreq = idx === 0 ? 1950 : 2300;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(420, t + 0.028);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.32, t + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.036);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.042);

        // Tiny crisp high-frequency transient burst
        const bufferSize = Math.floor(ctx.sampleRate * 0.015);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 3200;
        filter.Q.value = 1.6;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.22, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(t);
      });
    }

    // 2. Gentle soft buzz sound at the end of a Break session
    playBreakEnd() {
      const customUrl = this.config.sounds && this.config.sounds.breakEnd;
      this._playCustomOrFallback(customUrl, () => this._synthBreakBuzz());
    }

    _synthBreakBuzz() {
      const ctx = this._ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Two gentle, warm low-mid pulses (soft buzz feel, never harsh)
      [0, 0.42].forEach((offset) => {
        const t = now + offset;
        const duration = 0.34;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = "triangle";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(196, t); // Warm G3
        osc2.frequency.setValueAtTime(294, t); // Gentle fifth D4

        // Subtle vibrato for a soft tactile buzz character
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(24, t);
        lfoGain.gain.setValueAtTime(3.2, t);
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(520, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.06);
        gain.gain.setValueAtTime(0.15, t + duration - 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(t);
        osc2.start(t);
        lfo.start(t);

        osc1.stop(t + duration + 0.02);
        osc2.stop(t + duration + 0.02);
        lfo.stop(t + duration + 0.02);
      });
    }

    // 3. Subtle continuous clock-ticking sound while timer is running
    playTick() {
      if (!this.tickEnabled) return;
      const customUrl = this.config.sounds && this.config.sounds.tick;
      this._playCustomOrFallback(customUrl, () => this._synthClockTick());
    }

    _synthClockTick() {
      const ctx = this._ensureAudioContext();
      if (!ctx || ctx.state !== "running") return;

      const now = ctx.currentTime;
      this.tickAlternator = !this.tickAlternator;

      // Subtle alternating tick / tock tone
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(this.tickAlternator ? 1150 : 920, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.012);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(this.tickAlternator ? 1600 : 1250, now);
      filter.Q.setValueAtTime(1.4, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.018);
    }
  }

  window.PomodoroAudio = PomodoroAudio;
})();
