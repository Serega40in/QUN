# QUN Node for Android

Standalone Android application module, separate from the QUN Messenger app.

## Build
The GitHub Actions workflow `.github/workflows/build-qun-node-android.yml` runs:

```bash
gradle :node-android:assembleDebug
```

The APK is published as an Actions artifact named `QUN-Node-Android`.

## Current capabilities
- Explicit start/stop of a foreground service.
- Persistent notification while the mobile agent is running.
- On-device display of battery level, agent uptime and app storage usage.
- Clear status that public enrollment and QUN rewards are not available.

## Important limitations
This is the first native Android monitoring/agent shell, not yet the full QUN distributed storage node. It does not register with a public network, replicate objects to peers, or earn tokens. Android may restrict long-running work and can stop processes under battery or system pressure. The first build is a debug-signed test APK; a public release needs testing on physical devices, security review, release signing, privacy disclosures and Play/RuStore compliance.
