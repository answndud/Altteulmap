import process from "node:process";

const [major, minor, patch] = process.versions.node
  .split(".")
  .map((value) => Number.parseInt(value, 10));

const minimum = [20, 19, 0];
const current = [major, minor, patch];
let isSupported = true;

for (let index = 0; index < minimum.length; index += 1) {
  if (current[index] > minimum[index]) {
    break;
  }

  if (current[index] < minimum[index]) {
    isSupported = false;
    break;
  }
}

if (!isSupported) {
  throw new Error(
    `Node.js ${minimum.join(".")} or newer is required; detected ${process.versions.node}.`,
  );
}

process.stdout.write(`Node.js ${process.versions.node} satisfies the build minimum.\n`);
