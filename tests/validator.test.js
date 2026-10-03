import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateEvent, validateEventStream } from "../src/validator.js";
import events from "../data/scenario/index.js";

const validProposal = () => ({
  event_id: "e-1",
  event_type: "ADAPTATION_PROPOSED",
  aggregate_type: "adaptation_proposal",
  aggregate_id: "prop-1",
  occurred_at: "2026-09-01T00:00:00+08:00",
  version: 1,
  summary: "测试提案",
  payload: {
    source_ip_id: "ip-1",
    team_id: "team-1",
    kind: "SCENE_REWRITE",
    target_markets: ["SA"],
    target_audience: "当地成年玩家",
    change_targets: [
      { target_type: "scene", target_ref: "scene-1", treatment: "REPLACED", rationale: "世俗化替换" },
    ],
    triggered_authorizations: [{ rights_type: "ADAPTATION", rights_holder_id: "party/x" }],
  },
});

test("样例符合领域约定", async () => {
  const sample = JSON.parse(await readFile(new URL("../data/sample.json", import.meta.url), "utf8"));
  assert.deepEqual(validateEvent(sample), []);
});

test("三团队时间线全部通过校验", () => {
  assert.deepEqual(validateEventStream(events), []);
});

test("timeline.json 与数据源保持同步", async () => {
  const exported = JSON.parse(await readFile(new URL("../data/scenario/timeline.json", import.meta.url), "utf8"));
  assert.deepEqual(exported, events);
});

test("改写必须声明目标受众、变更对象与触发的授权", () => {
  const event = validProposal();
  delete event.payload.target_audience;
  event.payload.change_targets = [];
  delete event.payload.triggered_authorizations;
  const errors = validateEvent(event);
  assert.match(errors.join("\n"), /target_audience/);
  assert.match(errors.join("\n"), /变更对象/);
  assert.match(errors.join("\n"), /触发的授权/);
});

test("变更文化要素必须给出 element_refs", () => {
  const event = validProposal();
  event.payload.change_targets = [
    { target_type: "cultural_element", target_ref: "el-x", treatment: "MODIFIED", rationale: "调整" },
  ];
  assert.match(validateEvent(event).join("\n"), /element_refs/);
});

test("主张禁用范围的顾问异议必须给出依据", () => {
  const event = {
    ...validProposal(),
    event_type: "ADVISORY_OBJECTION_FILED",
    aggregate_type: "advisory_review",
    aggregate_id: "review-1",
    payload: { proposal_id: "prop-1", advisor_id: "a-1", objection_kind: "PROHIBITED_ELEMENT", element_refs: ["el-1"], asserts_prohibited: true },
  };
  assert.match(validateEvent(event).join("\n"), /basis/);
});

test("顾问/权利决定的角色不得错位", () => {
  const event = {
    ...validProposal(),
    event_type: "RIGHTS_DECISION",
    payload: { proposal_id: "prop-1", role: "CULTURAL_ADVISOR", decision: "APPROVED", rights_holder_id: "p" },
  };
  assert.match(validateEvent(event).join("\n"), /RIGHTS_HOLDER/);
});

test("年轻创作者必须个人署名，且不接受买断", () => {
  const base = {
    event_id: "e-2",
    event_type: "CONTRIBUTION_ACCEPTED",
    aggregate_type: "contributor_term",
    aggregate_id: "term-1",
    occurred_at: "2026-09-01T00:00:00+08:00",
    version: 1,
    summary: "贡献条款",
  };
  const noPersonalCredit = validateEvent({
    ...base,
    payload: {
      term: {
        contributor_id: "c-1", contributor_type: "INDIVIDUAL", emerging_creator: true, kind: "FOOTAGE",
        credit: { individual: false }, compensation: { model: "REVENUE_PERCENT", value: 1 },
      },
    },
  });
  assert.match(noPersonalCredit.join("\n"), /单独署名/);

  const buyout = validateEvent({
    ...base,
    payload: {
      term: {
        contributor_id: "c-1", contributor_type: "INDIVIDUAL", emerging_creator: true, kind: "FOOTAGE",
        credit: { individual: true, credit_name: "小林" }, compensation: { model: "BUYOUT", value: 5000 },
      },
    },
  });
  assert.match(buyout.join("\n"), /分账/);
});

test("AI 资产必须记录输入许可与工具版本", () => {
  const base = {
    event_id: "e-3",
    event_type: "AI_ASSET_REGISTERED",
    aggregate_type: "ai_asset",
    aggregate_id: "asset-1",
    occurred_at: "2026-09-01T00:00:00+08:00",
    version: 1,
    summary: "AI 资产",
  };
  const missing = validateEvent({ ...base, payload: { asset: { kind: "IMAGE", tool: { name: "X" }, input_grants: [] } } });
  const text = missing.join("\n");
  assert.match(text, /工具名称与版本/);
  assert.match(text, /输入许可/);
});

test("发行许可要求四道闸门全部 PASSED", () => {
  const event = {
    event_id: "e-4",
    event_type: "CLEARANCE_GRANTED",
    aggregate_type: "release_clearance",
    aggregate_id: "clr-1",
    occurred_at: "2026-09-01T00:00:00+08:00",
    version: 1,
    summary: "许可",
    payload: {
      version_id: "ver-1",
      gates: [
        { gate: "CULTURAL_BOUNDARY", status: "PASSED" },
        { gate: "RIGHTS", status: "FAILED" },
        { gate: "RATING", status: "PASSED" },
        { gate: "DELIVERY", status: "PASSED" },
      ],
    },
  };
  assert.match(validateEvent(event).join("\n"), /全部 PASSED/);
});

test("事件不能归属于错误的聚合", () => {
  const event = { ...validProposal(), aggregate_type: "market_adaptation" };
  assert.match(validateEvent(event).join("\n"), /不能归属/);
});

test("未知事件类型被拒绝", () => {
  const event = { ...validProposal(), event_type: "EMAIL_CONFIRMED" };
  assert.match(validateEvent(event).join("\n"), /未知事件类型/);
});
