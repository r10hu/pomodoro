/* ==========================================================================
   POMODORO TIMER ENGINE
   ==========================================================================
   Uses real system timestamps (Date.now()) so the clock stays accurate even
   when the browser tab is in the background.
   ========================================================================== */

(function () {
  "use strict";

  class PomodoroTimer {
    constructor({
      focusSeconds = 50 * 60,
      breakSeconds = 10 * 60,
      autoMode = true,
      onUpdate = null,
      onSecondTick = null,
      onSessionComplete = null,
      onStateChange = null,
    } = {}) {
      this.focusSeconds = Math.max(1, focusSeconds);
      this.breakSeconds = Math.max(1, breakSeconds);
      this.autoMode = Boolean(autoMode);

      this.session = "focus"; // "focus" or "break"
      this.isRunning = false;
      this.remainingMs = this.focusSeconds * 1000;
      this.endTime = null;
      this.lastWholeSecond = Math.ceil(this.remainingMs / 1000);
      this.intervalId = null;

      this.onUpdate = onUpdate;
      this.onSecondTick = onSecondTick;
      this.onSessionComplete = onSessionComplete;
      this.onStateChange = onStateChange;
    }

    getTotalMs() {
      return (this.session === "focus" ? this.focusSeconds : this.breakSeconds) * 1000;
    }

    getRemainingSeconds() {
      return Math.ceil(this.remainingMs / 1000);
    }

    // Progress ratio from 0 (start of session) to 1 (session finished)
    getProgress() {
      const total = this.getTotalMs();
      if (total <= 0) return 0;
      return Math.min(1, Math.max(0, (total - this.remainingMs) / total));
    }

    // Current audio/UI state: "focus", "break", or "pause"
    getPlaybackState() {
      if (!this.isRunning) return "pause";
      return this.session;
    }

    isMidSession() {
      return this.remainingMs < this.getTotalMs() && this.remainingMs > 0;
    }

    start() {
      if (this.isRunning) return;
      if (this.remainingMs <= 0) {
        this.remainingMs = this.getTotalMs();
      }

      this.isRunning = true;
      this.endTime = Date.now() + this.remainingMs;
      this.lastWholeSecond = Math.ceil(this.remainingMs / 1000);

      this._startLoop();
      this._emitStateChange();
      this._emitUpdate();
    }

    pause() {
      if (!this.isRunning) return;
      this.remainingMs = Math.max(0, this.endTime - Date.now());
      this.isRunning = false;
      this.endTime = null;

      this._stopLoop();
      this._emitStateChange();
      this._emitUpdate();
    }

    toggle() {
      if (this.isRunning) {
        this.pause();
      } else {
        this.start();
      }
    }

    reset() {
      this._stopLoop();
      this.isRunning = false;
      this.endTime = null;
      this.remainingMs = this.getTotalMs();
      this.lastWholeSecond = Math.ceil(this.remainingMs / 1000);

      this._emitStateChange();
      this._emitUpdate();
    }

    skip() {
      this._stopLoop();
      this.isRunning = false;
      this.endTime = null;
      this.session = this.session === "focus" ? "break" : "focus";
      this.remainingMs = this.getTotalMs();
      this.lastWholeSecond = Math.ceil(this.remainingMs / 1000);

      this._emitStateChange();
      this._emitUpdate();
    }

    setAutoMode(enabled) {
      this.autoMode = Boolean(enabled);
    }

    setDurations(focusSeconds, breakSeconds) {
      const cleanFocus = Math.max(1, Math.round(focusSeconds));
      const cleanBreak = Math.max(1, Math.round(breakSeconds));
      this.focusSeconds = cleanFocus;
      this.breakSeconds = cleanBreak;

      // If paused, reflect the new session duration immediately on screen
      if (!this.isRunning) {
        this.remainingMs = this.getTotalMs();
        this.lastWholeSecond = Math.ceil(this.remainingMs / 1000);
      } else if (this.remainingMs > this.getTotalMs()) {
        this.remainingMs = this.getTotalMs();
        this.endTime = Date.now() + this.remainingMs;
      }

      this._emitUpdate();
    }

    _startLoop() {
      this._stopLoop();
      // 100ms tick gives smooth progress-ring movement and crisp second transitions
      this.intervalId = window.setInterval(() => this._tick(), 100);
    }

    _stopLoop() {
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    _tick() {
      if (!this.isRunning || this.endTime === null) return;

      const now = Date.now();
      this.remainingMs = Math.max(0, this.endTime - now);
      const currentWholeSecond = Math.ceil(this.remainingMs / 1000);

      // Trigger the subtle clock-tick sound once per elapsed second
      if (currentWholeSecond < this.lastWholeSecond && this.remainingMs > 0) {
        this.lastWholeSecond = currentWholeSecond;
        if (typeof this.onSecondTick === "function") {
          this.onSecondTick();
        }
      }

      if (this.remainingMs <= 0) {
        this._handleSessionComplete();
        return;
      }

      this._emitUpdate();
    }

    _handleSessionComplete() {
      const finishedSession = this.session;

      if (typeof this.onSessionComplete === "function") {
        this.onSessionComplete(finishedSession);
      }

      // Advance to the next session (Focus -> Break, Break -> Focus)
      this.session = finishedSession === "focus" ? "break" : "focus";
      this.remainingMs = this.getTotalMs();
      this.lastWholeSecond = Math.ceil(this.remainingMs / 1000);

      if (this.autoMode) {
        // Keep running seamlessly in Auto mode
        this.isRunning = true;
        this.endTime = Date.now() + this.remainingMs;
      } else {
        // Pause at the start of the next session in Manual mode
        this._stopLoop();
        this.isRunning = false;
        this.endTime = null;
      }

      this._emitStateChange();
      this._emitUpdate();
    }

    _emitUpdate() {
      if (typeof this.onUpdate === "function") {
        this.onUpdate({
          session: this.session,
          isRunning: this.isRunning,
          remainingSeconds: this.getRemainingSeconds(),
          progress: this.getProgress(),
          isMidSession: this.isMidSession(),
        });
      }
    }

    _emitStateChange() {
      if (typeof this.onStateChange === "function") {
        this.onStateChange({
          session: this.session,
          isRunning: this.isRunning,
          playbackState: this.getPlaybackState(),
        });
      }
    }
  }

  window.PomodoroTimer = PomodoroTimer;
})();
