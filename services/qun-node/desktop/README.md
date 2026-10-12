# QUN Node Desktop

Windows desktop wrapper around the current local QUN Node test agent.

## Local development
From this directory run `npm install` and `npm start`.

## Build
Run `npm run dist:win`. GitHub Actions builds an NSIS installer and a portable EXE and publishes them as workflow artifacts.

## Security and current limitations
- Agent binds only to 127.0.0.1 and stores data under Electron's per-user application data directory.
- No automatic update and no Windows service yet.
- This is an unsigned early-access build; Windows SmartScreen may warn about an unknown publisher.
- It is not a public-network enrollment client and does not issue QUN rewards.
- Before general release, add code signing, signed update manifests, hardened IPC, reproducible release checks, and a tested uninstall/backup flow.
