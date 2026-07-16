# Parked / Long-term

Explicitly **not now**. Captured so we don't lose them.

- **Run via a HOST APP on device (not a native build) — PARKED (explicit).** Don't package the game natively. Let a host app on Android / **Retroid Pocket 5** run the HTML: fullscreen browser or PWA ("Add to Home screen"), a local web-app runner, or a PortMaster-style host. Zero build step. *(CORRECTED 2026-07-15 by an on-device probe — the previous note said "RP5 = Android 13, Snapdragon 865,
8GB" and was marked **confirmed**. It was wrong on device, SoC and OS. The actual hardware, read off its
own user-agent and spec sheet: **Retroid Pocket G2** — Snapdragon G2 Gen2 (1xGoldPlus@2.8 / 4xGold@2.57 /
3xSilver@1.9), Adreno A22, 8GB LPDDR5x, UFS 3.1, **Android 15**, 5.5" AMOLED **1080p @ 60Hz**, dual 3D
hall-effect sticks, analog L2/R2, six-axis gyro, **vibration motor present**, Wi-Fi 6, BT 5.4. It is the
RP5's successor and shares its form factor, which is why the shorthand stuck. Measured on device:
refresh 61Hz, performance.now() clamped to 0.1ms, maxTouchPoints 5.)* This is the chosen long-term direction over a native APK.
- **Lift the file-size / self-contained limit.** The single-file, base64-embedded diet only exists because the game is served in-chat. Once a host app runs it from local storage, drop the constraint — go fat with art & audio. (Tied to the host-app route.)
- **Real on-device save state.** With a host app + local storage, saves become real (localStorage/filesystem): persistent, offline, no paste-to-Claude. The save-code flow (Roadmap #8) then becomes optional / for sharing.
- **Physical controls on the handheld.** Map the Retroid's thumbstick + buttons to move/act instead of touch-only.
- **Claude Code on Android (Termux).** Ambitious: run a Claude Code session *on the device* to rebuild/patch/save locally.
- **Native APK wrap (Capacitor/Cordova).** Considered, then deprioritized in favor of the host-app route. Kept for reference only.
