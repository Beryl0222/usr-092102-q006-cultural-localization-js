/** 从 data/scenario/index.js 重新生成 timeline.json。 */
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import events from "../data/scenario/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../data/scenario/timeline.json");
await writeFile(target, JSON.stringify(events, null, 2) + "\n", "utf8");
console.log(`已写入 ${events.length} 条事件 -> ${target}`);
