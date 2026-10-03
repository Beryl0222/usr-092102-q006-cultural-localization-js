import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGGREGATE_TYPES,
  EVENT_TYPES,
  FIELD_ENUMS,
} from "../src/domain.js";
import { validateEvent, validateEventStream } from "../src/validator.js";

const loadJson = async (path) => await readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);
const clone = (value) => JSON.parse(JSON.stringify(value));

async function loadStream() {
  return loadJson("../data/event-stream.json");
}

/** 变更后按聚合重新编号，避免用例本身被版本号噪音干扰。 */
function renumber(events) {
  const seen = new Map();
  for (const event of events) {
    const version = (seen.get(event.aggregate_id) ?? 0) + 1;
    seen.set(event.aggregate_id, version);
    event.version = version;
    event.event_id = `${event.aggregate_id}-e${version}`;
  }
  return events;
}

const byId = (events, id) => events.find((event) => event.event_id === id);

/** 测试用事件工厂：补齐信封字段，用例只需给出事件类型与负载。 */
let fixtureSeq = 0;
function ev(type, aggregateType, aggregateId, occurredAt, summary, payload) {
  fixtureSeq += 1;
  return {
    event_id: `fixture-${fixtureSeq}`,
    event_type: type,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    occurred_at: occurredAt,
    version: 1,
    summary,
    payload,
  };
}

// ---------------------------------------------------------------------------
// 基础契约
// ---------------------------------------------------------------------------

test("单事件样例符合领域约定", async () => {
  const sample = await loadJson("../data/sample.json");
  assert.deepEqual(validateEvent(sample), []);
});

test("完整样例事件流通过全部合议不变量", async () => {
  const stream = await loadStream();
  assert.deepEqual(validateEventStream(stream), []);
});

test("样例流中每条事件单独也合法", async () => {
  const stream = await loadStream();
  for (const event of stream) assert.deepEqual(validateEvent(event), [], `${event.event_id} 单事件校验失败`);
});

test("JSON Schema 与代码中的事件/聚合枚举同源", async () => {
  const schema = await loadJson("../contracts/domain.schema.json");
  assert.deepEqual([...schema.$defs.eventType.enum].sort(), [...FIELD_ENUMS["event.event_type"]].sort());
  assert.deepEqual([...schema.$defs.aggregateType.enum].sort(), [...FIELD_ENUMS["event.aggregate_type"]].sort());
});

test("事件必须挂在语义相符的聚合上", () => {
  const bad = {
    event_id: "x-1", event_type: EVENT_TYPES.RIGHTS_CLEARED, aggregate_type: AGGREGATE_TYPES.SOURCE_IP,
    aggregate_id: "ip-x", occurred_at: "2026-10-01T00:00:00+08:00", version: 1, summary: "错位",
  };
  assert.match(validateEvent(bad).join("\n"), /不能挂在聚合/);
});

test("事件流必须按时间排列且版本号在聚合内单调递增", async () => {
  const stream = await loadStream();
  stream[0].occurred_at = "2030-01-01T00:00:00+08:00";
  assert.match(validateEventStream(stream).join("\n"), /按时间排列/);

  const stream2 = await loadStream();
  stream2[stream2.length - 1].version = 999;
  assert.match(validateEventStream(stream2).join("\n"), /版本号应为/);
});

// ---------------------------------------------------------------------------
// 改写说明：变更对象 / 目标受众 / 触发的授权，缺一不可进入合议
// ---------------------------------------------------------------------------

test("改写说明缺少触发授权或目标受众即不合法", () => {
  const base = {
    event_id: "a-1", event_type: EVENT_TYPES.ADAPTATION_PROPOSED, aggregate_type: AGGREGATE_TYPES.MARKET_ADAPTATION,
    aggregate_id: "adapt-x", occurred_at: "2026-10-08T10:00:00+08:00", version: 1, summary: "缺字段",
    payload: {
      change_target: { type: "scene", ref: "scene-1" },
      target_audience: { market: "SA", languages: ["ar"] },
      triggered_clearances: [],
      proposed_by: "组", change_summary: "摘要",
    },
  };
  assert.match(validateEvent(base).join("\n"), /triggered_clearances/);

  delete base.payload.target_audience;
  assert.match(validateEvent(base).join("\n"), /target_audience/);
});

// ---------------------------------------------------------------------------
// 禁用范围：硬否决不被多数意见覆盖
// ---------------------------------------------------------------------------

test("两个同意票压不过文化顾问的 hard_veto：闸口与发行都必须失败", async () => {
  const stream = await loadStream();

  // 给被硬否决的朝圣终点提案组装一个 AE 版本并伪造四闸口全过。
  stream.push(ev(EVENT_TYPES.MARKET_BUILD_ASSEMBLED, AGGREGATE_TYPES.MARKET_BUILD,
    "build-veto-ae", "2026-10-20T10:00:00+04:00", "试图发行含硬否决改写的版本", {
      market: "AE", rating: "待定", adaptation_ids: ["adapt-game-veto-bad"],
      asset_ids: [], contribution_ids: [], assembled_by: "外包组",
    }));
  stream.push(ev(EVENT_TYPES.CLEARANCE_GATE_EVALUATED, AGGREGATE_TYPES.RELEASE_CLEARANCE,
    "rc-build-veto-ae", "2026-10-21T10:00:00+04:00", "伪造四闸口全过", {
      build_id: "build-veto-ae", market: "AE", evaluated_by: "清关组",
      gates: {
        cultural: { result: "passed" },
        rights: { result: "passed", grant_refs: ["grant-game-ip"] },
        rating: { result: "passed", certificate: "AE-X-1" },
        delivery: { result: "passed" },
      },
    }));
  stream.push(ev(EVENT_TYPES.MARKET_RELEASED, AGGREGATE_TYPES.RELEASE_CLEARANCE,
    "rc-build-veto-ae", "2026-10-22T10:00:00+04:00", "试图进入 AE 清单", {
      build_id: "build-veto-ae", market: "AE", released_by: "外包组",
    }));
  renumber(stream);

  const errors = validateEventStream(stream).join("\n");
  assert.match(errors, /文化闸口不得判 passed/); // 多数意见不能覆盖
  assert.match(errors, /含硬否决改写.*禁止发行/);
});

test("市场负责人的 hard_veto 在事件流中被拒绝", async () => {
  const stream = await loadStream();
  const target = byId(stream, "panel-adapt-game-scene-my-e3"); // 市场负责人原 approved
  target.payload.decision = "hard_veto";
  target.summary = "市场方试图强制否决";
  const errors = validateEventStream(stream).join("\n");
  assert.match(errors, /只有权利人与文化顾问可以登记 hard_veto/);
});

test("同一角色对同一改写重复表决无效", async () => {
  const stream = await loadStream();
  const dup = clone(byId(stream, "panel-adapt-game-scene-sa-e1"));
  dup.occurred_at = "2026-10-10T12:00:00+03:00";
  dup.summary = "文化顾问重复投票";
  delete dup.event_id;
  delete dup.version;
  Object.assign(dup, { event_id: "fixture-dup", version: 1 });
  stream.push(dup);
  renumber(stream);
  assert.match(validateEventStream(stream).join("\n"), /已作决定，不得重复表决/);
});

test("四闸口全过必须三类角色都分别决定过；普通否决须修订后重提", async () => {
  // 抽掉沙特版的市场负责人决定 → 全过闸口非法
  const stream = renumber((await loadStream()).filter((e) => e.event_id !== "panel-adapt-game-scene-sa-e3"));
  assert.match(validateEventStream(stream).join("\n"), /缺少 market_owner 的独立决定/);

  // 将一条 approved 改成 rejected → 必须修订重提，不能放行
  const stream2 = await loadStream();
  byId(stream2, "panel-adapt-drama-relation-us-e3").payload.decision = "rejected";
  assert.match(validateEventStream(stream2).join("\n"), /存在 market_owner 的 rejected 决定/);
});

// ---------------------------------------------------------------------------
// 权利精确性：地域、有效期、博物馆授权边界
// ---------------------------------------------------------------------------

test("授权不覆盖目标地区时权利闸口失败（博物馆授权不得越界）", async () => {
  const stream = await loadStream();
  const grant = stream.find((e) => e.aggregate_id === "grant-game-ip" && e.payload?.status === "active");
  grant.payload.markets = ["MY"]; // SA 被移除
  const errors = validateEventStream(stream).join("\n");
  assert.match(errors, /不覆盖 SA/);
});

test("授权过期不得支撑闸口", async () => {
  const stream = await loadStream();
  const firstMuseumGrant = stream.find(
    (e) => e.aggregate_id === "grant-museum-cn" && e.event_type === EVENT_TYPES.RIGHTS_CLEARED,
  );
  firstMuseumGrant.payload.valid_until = "2026-09-30T00:00:00+08:00";
  assert.match(validateEventStream(stream).join("\n"), /不在有效期/);
});

test("闸口未全过的越权 AE 版本不得发行", async () => {
  const stream = await loadStream();
  stream.push(ev(EVENT_TYPES.MARKET_RELEASED, AGGREGATE_TYPES.RELEASE_CLEARANCE,
    "rc-build-toy-ae-attempt", "2026-12-02T10:00:00+08:00", "权利闸口失败仍强行上架", {
      build_id: "build-toy-ae-attempt", market: "AE", released_by: "渠道组",
    }));
  renumber(stream);
  const errors = validateEventStream(stream).join("\n");
  assert.match(errors, /rights、rating、delivery 闸口未全部 passed/);
});

// ---------------------------------------------------------------------------
// AI 资产来源：输入许可 / 工具版本 / 人工修订
// ---------------------------------------------------------------------------

test("AI 资产缺少来源三件套即不合法", () => {
  const base = {
    event_id: "ai-1", event_type: EVENT_TYPES.AI_ASSET_REGISTERED, aggregate_type: AGGREGATE_TYPES.AI_ASSET,
    aggregate_id: "ai-x", occurred_at: "2026-10-14T10:00:00+08:00", version: 1, summary: "来源缺失",
    payload: {
      asset_kind: "footage", created_by: "组",
      input_permissions: [],
      tool: { name: "T", version: "1", provider: "P" },
      human_revision: { revised_by: "人", at: "2026-10-14T18:00:00+08:00", description: "修" },
    },
  };
  assert.match(validateEvent(base).join("\n"), /input_permissions/);

  base.payload.input_permissions = [{ ref: "r", grant_id: "g", scope: "s" }];
  delete base.payload.tool.version;
  assert.match(validateEvent(base).join("\n"), /tool.version/);
});

test("版本采用未登记来源的 AI 资产被拒绝", async () => {
  const stream = await loadStream();
  byId(stream, "build-game-sa-e1").payload.asset_ids = ["ai-ghost"];
  assert.match(validateEventStream(stream).join("\n"), /ai-ghost 未登记来源/);
});

test("AI 输入许可必须引用真实存在的授权", async () => {
  const stream = await loadStream();
  byId(stream, "ai-game-bg-sa-e1").payload.input_permissions[0].grant_id = "grant-ghost";
  assert.match(validateEventStream(stream).join("\n"), /引用了不存在的授权 grant-ghost/);
});

// ---------------------------------------------------------------------------
// 年轻创作者：单独署名与分账
// ---------------------------------------------------------------------------

test("贡献约定必须单独署名并写明分账", () => {
  const base = {
    event_id: "t-1", event_type: EVENT_TYPES.CONTRIBUTION_ACCEPTED, aggregate_type: AGGREGATE_TYPES.CONTRIBUTOR_TERM,
    aggregate_id: "term-x", occurred_at: "2026-10-14T10:00:00+08:00", version: 1, summary: "条款缺失",
    payload: {
      contributor_id: "u1", contributor_name: "某", contribution_kind: "footage",
      attribution: "   ", revenue_share: { basis: "b" }, adaptation_ids: [],
    },
  };
  const errors = validateEvent(base).join("\n");
  assert.match(errors, /attribution/);
  assert.match(errors, /revenue_share.rate/);
});

// ---------------------------------------------------------------------------
// 收回与恢复：合作方退出、权利到期、分级变化精确命中
// ---------------------------------------------------------------------------

test("收回访问必须精确给出主体，阻断版本必须精确给出版本", () => {
  const revoke = {
    event_id: "r-1", event_type: EVENT_TYPES.ACCESS_REVOKED, aggregate_type: AGGREGATE_TYPES.RELEASE_CLEARANCE,
    aggregate_id: "rc-x", occurred_at: "2027-03-05T09:30:00+09:00", version: 1, summary: "收回",
    payload: {
      reason: "partner_exit", effects: ["access_withdrawn"],
      trigger_ref: "grant-x", effective_at: "2027-03-05T09:30:00+09:00",
    },
  };
  assert.match(validateEvent(revoke).join("\n"), /subject_ids/);
  revoke.payload.effects = ["versions_blocked"];
  assert.match(validateEvent(revoke).join("\n"), /affected_build_ids/);
});

test("被阻断撤回的版本不能再被结算（合作方退出后韩语版不结算）", async () => {
  const stream = await loadStream();
  stream.push(ev(EVENT_TYPES.USAGE_SETTLED, AGGREGATE_TYPES.USAGE_SETTLEMENT,
    "settle-kr-after-exit", "2027-03-10T10:00:00+09:00", "试图对退出后已阻断的韩语版结算", {
      contributor_id: "u-liang", build_ids: ["build-drama-kr"], markets: ["KR"],
      usage_detail: { footage_seconds: 1 }, amount: { value: 10, currency: "USD" }, status: "reported",
    }));
  renumber(stream);
  assert.match(validateEventStream(stream).join("\n"), /尚未在结算所列地区发行（或已被阻断撤回）/);
});

test("触碰禁用范围被阻断的版本不允许恢复", async () => {
  const stream = await loadStream();
  stream.push(
    ev(EVENT_TYPES.ACCESS_REVOKED, AGGREGATE_TYPES.RELEASE_CLEARANCE,
      "rc-build-game-sa", "2027-04-01T10:00:00+03:00", "发现禁用项触碰", {
        reason: "veto_breach", effects: ["versions_blocked"], affected_build_ids: ["build-game-sa"],
        trigger_ref: "P-SR-01", effective_at: "2027-04-01T10:00:00+03:00",
      }),
    ev(EVENT_TYPES.VERSION_REINSTATED, AGGREGATE_TYPES.RELEASE_CLEARANCE,
      "rc-build-game-sa", "2027-04-02T10:00:00+03:00", "试图恢复禁用版本", {
        build_id: "build-game-sa", reason: "veto_breach", reinstated_by: "组",
      }),
  );
  renumber(stream);
  assert.match(validateEventStream(stream).join("\n"), /因触碰禁用范围被阻断，不允许恢复发行/);
});

test("恢复不溯及闸口：续约后未重新判定四闸口不得重新上架", async () => {
  const stream = (await loadStream()).filter((e) => e.event_id !== "rc-build-toy-cn-e5"); // 去掉续约后的重审
  renumber(stream);
  assert.match(validateEventStream(stream).join("\n"), /恢复后未重新通过四闸口判定/);
});

test("未发行的版本不能结算采用与投放", async () => {
  const stream = await loadStream();
  stream.push(ev(EVENT_TYPES.USAGE_SETTLED, AGGREGATE_TYPES.USAGE_SETTLEMENT,
    "settle-ae-attempt", "2026-12-20T10:00:00+08:00", "越权版本从未发行，试图结算", {
      contributor_id: "u-kiki", build_ids: ["build-toy-ae-attempt"], markets: ["AE"],
      usage_detail: { design_units: 1 }, amount: { value: 1, currency: "USD" }, status: "reported",
    }));
  renumber(stream);
  assert.match(validateEventStream(stream).join("\n"), /尚未在结算所列地区发行/);
});

test("结算对象必须先有署名分账约定", async () => {
  const stream = await loadStream();
  stream.push(ev(EVENT_TYPES.USAGE_SETTLED, AGGREGATE_TYPES.USAGE_SETTLEMENT,
    "settle-nobody", "2026-10-29T10:00:00+08:00", "向无约定人员结算", {
      contributor_id: "u-ghost", build_ids: ["build-game-sa"], markets: ["SA"],
      usage_detail: {}, amount: { value: 1, currency: "USD" }, status: "reported",
    }));
  renumber(stream);
  assert.match(validateEventStream(stream).join("\n"), /没有署名分账约定/);
});

// ---------------------------------------------------------------------------
// 地区多版本合法性：同一叙事节点在不同地区可以合法形成不同版本
// ---------------------------------------------------------------------------

test("同一节点在 SA 与 MY 形成两个不同版本均合法", async () => {
  const stream = await loadStream();
  const sa = byId(stream, "adapt-game-scene-sa-e1");
  const my = byId(stream, "adapt-game-scene-my-e1");
  assert.equal(sa.payload.change_target.ref, my.payload.change_target.ref);
  assert.notEqual(sa.payload.target_audience.market, my.payload.target_audience.market);
  assert.deepEqual(validateEventStream(stream), []);
});
