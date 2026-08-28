# Android launcher artwork

`assets/icon.png` is the canonical Command Protocols launcher artwork.

The Android project keeps checked-in launcher resources under `android/app/src/main/res/`. Modern Android versions use the adaptive icon XML in the `mipmap-anydpi-v26` / `mipmap-anydpi-v33` directories. Those adaptive icons route the artwork through `drawable/command_protocols_foreground.xml`, which places the artwork in a fixed 72dp centered foreground before Android applies the device's icon mask. Do not use a `<scale>` drawable here: adaptive launchers do not set a ScaleDrawable level, which can make the foreground render at zero size.

`npm run build` does not generate launcher PNGs. Its `postbuild` step runs `scripts/verify-android-icon.mjs`, which validates the canonical PNG, approved drawable copies, legacy fallback PNGs, and the adaptive-icon resource chain.

If the source artwork changes, update `assets/icon.png` and the approved drawable copies. Legacy density-specific launcher PNGs should be regenerated separately if support for pre-Android-8 launchers is required.
