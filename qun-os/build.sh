#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo ./qun-os/build.sh"
  exit 1
fi
command -v lb >/dev/null 2>&1 || { echo "Install live-build first"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$ROOT/.build"
mkdir -p "$WORK"
cd "$WORK"
lb clean --purge || true

lb config \
  --mode debian \
  --distribution bookworm \
  --architectures amd64 \
  --binary-images iso-hybrid \
  --debian-installer false \
  --archive-areas "main contrib non-free-firmware" \
  --bootappend-live "boot=live components username=qun hostname=qun-os locales=en_US.UTF-8 keyboard-layouts=us persistence" \
  --iso-application "QUN OS" \
  --iso-publisher "QUN Community" \
  --iso-volume "QUN_OS"

mkdir -p config/package-lists config/includes.chroot/usr/share/backgrounds/qun
cp "$ROOT/config/package-lists/qun.list.chroot" config/package-lists/
cp "$ROOT/config/includes.chroot/usr/share/backgrounds/qun/qun-wallpaper.svg" config/includes.chroot/usr/share/backgrounds/qun/

lb build
ISO="$(find . -maxdepth 1 -type f -name '*.iso' -print -quit)"
if [[ -z "$ISO" ]]; then
  echo "Build finished but no ISO was found in $WORK"
  exit 2
fi
cp "$ISO" "$ROOT/qun-os-live-amd64.iso"
sha256sum "$ROOT/qun-os-live-amd64.iso" > "$ROOT/qun-os-live-amd64.iso.sha256"
echo "ISO created at $ROOT/qun-os-live-amd64.iso"
