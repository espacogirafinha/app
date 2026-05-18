import { spawnSync } from "node:child_process";

const env = { ...process.env, NODE_ENV: "development" };

const run = (args) => {
  const result = spawnSync("corepack", ["pnpm", ...args], {
    env,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(["run", "build"]);
run(["run", "start"]);
