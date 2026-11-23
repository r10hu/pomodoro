/* ==========================================================================
   POMODORO CLOCK — EASY-TO-EDIT CONFIGURATION FILE
   ==========================================================================
   Everything you might want to customize lives right here.
   Tips for editing:
   - Keep quotes ("...") around text and commas (,) between list items.
   - Save the file and refresh your browser to see your changes.
   ========================================================================== */

window.POMODORO_CONFIG = {
  // ------------------------------------------------------------------------
  // 1. DEFAULT TIMER DURATIONS (in minutes)
  //    You can also change these anytime inside the app's Settings screen.
  // ------------------------------------------------------------------------
  defaults: {
    focusMinutes: 50,      // Default Focus session length (50:00)
    breakMinutes: 10,      // Default Break session length (10:00)
    tickEnabled: true,     // Subtle clock-ticking sound while timer runs
    mode: "auto",          // "auto" = cycle automatically | "manual" = pause after each session
    theme: "dark",         // "dark" or "light" (click the main image to toggle)
    dynamicThemeFromImage: true, // Automatically match UI colors to the displayed artwork (false = styles.css defaults)
    autoScanImages: true,  // Automatically load images scanned into assets/img/images.json on GitHub Pages
    musicEnabled: true,    // Master Background Music switch (top-right icon)
    focusRadio: "off",     // Station id to play during Focus (or "off")
    breakRadio: "off",     // Station id to play during Break (or "off")
    pauseRadio: "off",     // Station id to play while Paused (or "off")
  },

  // ------------------------------------------------------------------------
  // 2. LOCAL ARTWORK IMAGES (stored in assets/img/)
  //    On GitHub Pages, the GitHub Actions auto-scanner detects every image
  //    in assets/img/ automatically (no editing needed here!).
  //    This list acts as a local offline fallback and lets you set custom
  //    display names (labels) for any matching file.
  // ------------------------------------------------------------------------
  images: [
    {
      id: "pixel-castle",
      label: "Moving Castle (Sample)",
      path: "assets/img/pixel-castle.svg",
    },
    {
      id: "pixel-desk",
      label: "Night Desk (Sample)",
      path: "assets/img/pixel-desk.svg",
    },
    {
      id: "pixel-tea",
      label: "Tea & Books (Sample)",
      path: "assets/img/pixel-tea.svg",
    },
    // Example — remove the "//" at the start of these lines once you add your own file:
    // {
    //   id: "my-castle",
    //   label: "My Castle Artwork",
    //   path: "assets/img/my-castle.png",
    // },
  ],

  // ------------------------------------------------------------------------
  // 3. RADIO STATIONS (Placeholders — paste your own stream links below)
  //    Paste any direct audio stream URL (such as an MP3, AAC, OGG, or
  //    online radio stream URL) inside the quotes next to "url:".
  //    Leave "url" as "" if you haven't added a link yet — the app will
  //    handle empty links safely without breaking.
  // ------------------------------------------------------------------------
  radioStations: [
    {
      id: "swiss-jazz",
      name: "Radio Swiss Jazz",
      url: "https://stream.srg-ssr.ch/srgssr/rsj/aac/192",
    },
    {
      id: "swiss-classic",
      name: "Radio Swiss Classic",
      url: "https://stream.srg-ssr.ch/srgssr/rsc_de/aac/192",
    },
    {
      id: "nightwave-plaza",
      name: "Nightwave Plaza",
      url: "https://radio.plaza.one/mp3",
    },
    {
      id: "rp-kfat",
      name: "Radio Paradise · KFAT",
      url: "https://stream.radioparadise.com/kfat-128",
    },
    {
      id: "rp-sanctuary",
      name: "Radio Paradise · Sanctuary",
      url: "https://stream.radioparadise.com/sanctuary",
    },
    {
      id: "rp-beyond",
      name: "Radio Paradise · Beyond",
      url: "https://stream.radioparadise.com/beyond-320",
    },
    {
      id: "rp-mellow",
      name: "Radio Paradise · Mellow",
      url: "https://stream.radioparadise.com/mellow-320",
    },
    {
      id: "code-radio",
      name: "Code Radio",
      url: "https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3",
    },
    {
      id: "somafm-dronezone",
      name: "SomaFM · Drone Zone",
      url: "https://ice1.somafm.com/dronezone-128-mp3",
    },
    {
      id: "nightride",
      name: "Nightride FM",
      url: "https://stream.nightride.fm/nightride.ogg",
    },
    {
      id: "chillsynth",
      name: "Nightride · Chillsynth",
      url: "https://stream.nightride.fm/chillsynth.ogg",
    },
    // Want more stations? Copy one of the blocks above and give it a unique id!
  ],

  // ------------------------------------------------------------------------
  // 4. OPTIONAL CUSTOM SOUND EFFECTS (Leave blank to use built-in sounds)
  //    By default, the app generates crisp Web Audio API sound effects right
  //    inside your browser (no internet files needed).
  //    If you ever want to override a sound, paste a link or relative path
  //    to an .mp3 or .wav file below. If blank or unreachable, it falls back
  //    automatically to the built-in sound.
  // ------------------------------------------------------------------------
  sounds: {
    focusEnd: "", // Crisp click at the end of a Focus session
    breakEnd: "", // Gentle soft buzz at the end of a Break session
    tick: "",     // Subtle clock-ticking sound while timer is running
  },
};
