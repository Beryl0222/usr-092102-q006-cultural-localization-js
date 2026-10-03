import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { aggregateTypes, enums, eventTypes } from "../src/domain.js";
import { validateEvent } from "../src/validator.js";

test("样例符合领域约定", async () => {
  const sample = JSON.parse(await readFile(new URL("../data/sample.json", import.meta.url), "utf8"));
  assert.deepEqual(validateEvent(sample), []);
});

test("schema 事件枚举与代码一致", async () => {
  const schema = JSON.parse(await readFile(new URL("../contracts/domain.schema.json", import.meta.url), "utf8"));
  assert.deepEqual([...schema.properties.event_type.enum].sort(), Object.values(eventTypes).sort());
  assert.deepEqual([...schema.properties.aggregate_type.enum].sort(), Object.values(aggregateTypes).sort());
});

test("schema 各稳定枚举与代码登记一致", async () => {
  const schema = JSON.parse(await readFile(new URL("../contracts/domain.schema.json", import.meta.url), "utf8"));
  const prop = schema.$defs.payload.properties;
  const checks = [
    [prop.kind.enum, enums.proposalKind],
    [prop.decision.enum, enums.decision],
    [prop.role.enum, enums.decisionRole],
    [prop.treatment.enum, enums.treatment],
    [prop.rights_type.enum, enums.rightsType],
    [prop.gate.enum, enums.gate],
    [prop.gate_status.enum, enums.gateStatus],
    [prop.trigger.enum, enums.revocationTrigger],
    [prop.change_type.enum, enums.ratingChangeType],
  ];
  for (const [schemaValues, codeValues] of checks) {
    assert.deepEqual([...schemaValues].sort(), [...codeValues].sort());
  }
});
