import { afterEach } from "vite-plus/test";
import { cleanupApp } from "./test-utils.tsx";

afterEach(async () => {
  await cleanupApp();
});
