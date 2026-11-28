# Persistent storage checklist

The ISO boot configuration includes the `persistence` kernel parameter. A separate writable partition is still required.

1. Back up all USB contents.
2. Identify the exact USB device and capacity before changing partitions.
3. Choose a boot/USB layout that supports a separate persistence partition.
4. Format that partition as ext4 and label it exactly `persistence`.
5. Create a root-level file named `persistence.conf` containing:

   `/ union`

6. Ensure the live boot entry includes `persistence`.
7. Boot and create a harmless test file in the home directory.
8. Reboot and confirm that the file remains.

Do not run formatting or partition commands until the device is positively identified. Commands such as `mkfs`, `dd`, and partition editors can destroy data.