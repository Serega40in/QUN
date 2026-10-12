# QUN Node Desktop

Windows desktop wrapper around the current local QUN Node test agent.

## Local development
From this directory run `npm install` and `npm start`.

## Build
Run `npm run dist:win`. GitHub Actions builds an NSIS installer and a portable EXE and publishes them as workflow artifacts.

## Security and current limitations
- Agent binds only to 127.0.0.1 and stores data under Electron's per-user application data directory.
- Background update checks every six hours through GitHub Releases; downloads are verified by `electron-updater` and the signed update manifest before the user confirms restart/install.
- The first updater-enabled installer must be installed manually once; subsequent versions can update in-app. The portable EXE does not support the same in-place NSIS update flow.
- A release requires the `QUN_UPDATE_SIGN_PRIVATE_KEY` GitHub Actions secret. Windows code signing is not yet configured, so SmartScreen may still warn; update manifest signatures protect the release metadata, but a publisher certificate is still recommended.
- This is an unsigned early-access build; Windows SmartScreen may warn about an unknown publisher.
- It is not a public-network enrollment client and does not issue QUN rewards.
- Before general release, add code signing, signed update manifests, hardened IPC, reproducible release checks, and a tested uninstall/backup flow.


Windows build workflow: [Build QUN Node for Windows](https://github.com/Serega40in/QUN/actions/workflows/build-qun-node-windows.yml). The workflow publishes both the installer and portable EXE as a single downloadable artifact.
