import { spawnSync } from "node:child_process";

if (process.env.MORSHID_RESET_CONFIRM !== "reset-local") {
  console.error(
    "Refusing to reset the local database. Set MORSHID_RESET_CONFIRM=reset-local to continue.",
  );
  process.exit(1);
}

const result = spawnSync(
  "npm",
  ["run", "db:reset", "--workspace", "server", "--if-present"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
