import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_OBJECT_BYTES = 1024 * 1024;

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export class LocalStorage {
  constructor(rootDir, { maxObjectBytes = MAX_OBJECT_BYTES } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.objectsDir = path.join(this.rootDir, "objects");
    this.manifestsDir = path.join(this.rootDir, "manifests");
    this.maxObjectBytes = maxObjectBytes;
  }

  async init() {
    await mkdir(this.objectsDir, { recursive: true });
    await mkdir(this.manifestsDir, { recursive: true });
  }

  validateId(id) {
    if (typeof id !== "string" || !SAFE_ID.test(id)) {
      throw Object.assign(new Error("Invalid object id"), { statusCode: 400 });
    }
  }

  objectPath(id) {
    this.validateId(id);
    return path.join(this.objectsDir, id + ".bin");
  }

  manifestPath(id) {
    this.validateId(id);
    return path.join(this.manifestsDir, id + ".json");
  }

  async put(data, id = randomUUID()) {
    this.validateId(id);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
    if (buffer.length > this.maxObjectBytes) {
      throw Object.assign(new Error("Object exceeds configured size limit"), { statusCode: 413 });
    }

    const digest = sha256(buffer);
    const objectPath = this.objectPath(id);
    const manifestPath = this.manifestPath(id);
    const tempObject = objectPath + "." + randomUUID() + ".tmp";
    const tempManifest = manifestPath + "." + randomUUID() + ".tmp";
    const manifest = {
      schemaVersion: 1,
      objectId: id,
      sha256: digest,
      sizeBytes: buffer.length,
      createdAt: new Date().toISOString(),
      mode: "local-test-only"
    };

    try {
      await writeFile(tempObject, buffer, { flag: "wx", mode: 0o600 });
      await rename(tempObject, objectPath);
      await writeFile(tempManifest, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      await rename(tempManifest, manifestPath);
    } catch (error) {
      await rm(tempObject, { force: true }).catch(() => {});
      await rm(tempManifest, { force: true }).catch(() => {});
      throw error;
    }

    return manifest;
  }

  async get(id) {
    const data = await readFile(this.objectPath(id));
    return { data, sha256: sha256(data) };
  }

  async readManifest(id) {
    return JSON.parse(await readFile(this.manifestPath(id), "utf8"));
  }

  async verify(id) {
    const [manifest, data] = await Promise.all([
      this.readManifest(id),
      readFile(this.objectPath(id))
    ]);
    const actual = sha256(data);
    return {
      objectId: id,
      valid: actual === manifest.sha256 && data.length === manifest.sizeBytes,
      expectedSha256: manifest.sha256,
      actualSha256: actual,
      expectedSizeBytes: manifest.sizeBytes,
      actualSizeBytes: data.length
    };
  }

  async stats() {
    let objectCount = 0;
    let bytes = 0;
    const { readdir } = await import("node:fs/promises");
    for (const name of await readdir(this.objectsDir)) {
      const info = await stat(path.join(this.objectsDir, name));
      if (info.isFile()) {
        objectCount++;
        bytes += info.size;
      }
    }
    return { objectCount, storedBytes: bytes, maxObjectBytes: this.maxObjectBytes };
  }
}