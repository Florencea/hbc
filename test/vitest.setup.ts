import { afterEach } from "vitest";
import { cleanupApp } from "./test-utils.tsx";

afterEach(async () => {
  await cleanupApp();
});
