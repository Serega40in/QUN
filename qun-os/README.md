# QUN OS — Live USB starter

First buildable prototype of QUN OS based on Debian Live and XFCE. It is a branded Linux live system, not a new kernel.

## Build in GitHub Actions
Open **Actions → Build QUN OS ISO → Run workflow**. The workflow builds an ISO and uploads it as an artifact named `qun-os-live-iso`. Download the artifact ZIP from the completed workflow run.

The build is not yet a signed/release-certified distribution. Test the ISO in a VM before booting on hardware.

## Persistent storage
The live boot configuration requests the `persistence` kernel option. A separate writable partition labelled `persistence` must be created on the USB and contain a root-level `persistence.conf` file with this line:

```
/ union
```

The exact USB layout depends on the chosen writer/boot method. Back up the USB and positively identify the target device before partitioning. No script in this project formats or writes to USB devices.

## Included
- Debian Bookworm amd64 live image
- XFCE desktop, LightDM, NetworkManager
- Firefox ESR, Thunar, terminal, text editor, system monitor
- QUN-branded SVG wallpaper
- Kernel boot parameters including persistence

## Known next steps
- Configure XFCE defaults and desktop wallpaper automatically
- Add QUN boot splash and polished icon theme
- Test persistence and hardware compatibility on target Lenovo laptop
- Publish a checksum and a reproducible release