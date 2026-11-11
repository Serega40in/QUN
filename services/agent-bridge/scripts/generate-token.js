import { randomBytes } from "node:crypto";

const token = randomBytes(32).toString("hex");
process.stdout.write(token + "\n");
