import assert from "node:assert/strict";
import test from "node:test";

import events, { refs } from "../data/scenario/index.js";
import { replay, evaluateGate, evaluateClearance, currentReleaseList, planRevocations, contributorStatement } from "../src/clearance.js";

// 样例时间线的“当前”是 2026-10-16（潮玩授权到期之后）。
const NOW = "2026-10-16T12:00:00+08:00";
const RELEASE_DAY = "2026-09-21T12:00:00+08:00";

test("三团队时间线重放无任何流级违规", () => {
  const state = replay(events);
  assert.deepEqual(state.violations, []);
});

test("发行日各市场清单：四闸门全过的版本才出现", () => {
  const state = replay(events);
  assert.deepEqual(currentReleaseList(state, "SA", { at: RELEASE_DAY }), [refs.versions.gameSa]);
  assert.deepEqual(currentReleaseList(state, "TW", { at: RELEASE_DAY }), [refs.versions.dramaTw, refs.versions.gameTw]);
  assert.deepEqual(currentReleaseList(state, "US", { at: RELEASE_DAY }), [refs.versions.dramaUsV2]);
  assert.deepEqual(currentReleaseList(state, "KR", { at: RELEASE_DAY }), [refs.versions.toyKr]);
  assert.deepEqual(currentReleaseList(state, "MY", { at: RELEASE_DAY }), []); // 从未进入清单
  assert.deepEqual(currentReleaseList(state, "DE", { at: RELEASE_DAY }), []); // 欧盟越界被否
});

test("当前时刻：分级暂停与授权到期自动撤出清单，其他版本不受影响", () => {
  const state = replay(events, { at: NOW });
  assert.deepEqual(currentReleaseList(state, "SA"), []); // 沙特分级暂停
  assert.deepEqual(currentReleaseList(state, "KR"), []); // 博物馆授权到期
  assert.deepEqual(currentReleaseList(state, "MY"), []); // 合作方退出
  assert.deepEqual(currentReleaseList(state, "TW"), [refs.versions.dramaTw, refs.versions.gameTw]);
  assert.deepEqual(currentReleaseList(state, "US"), [refs.versions.dramaUsV2]);
});

test("沙特版在分级变化前合法、变化后被阻断（同一版本不同时间点）", () => {
  const state = replay(events);
  assert.equal(evaluateGate(state, refs.versions.gameSa, "RATING", { at: RELEASE_DAY }).status, "PASSED");
  assert.equal(evaluateGate(state, refs.versions.gameSa, "RATING", { at: NOW }).status, "FAILED");
});

test("潮玩韩国版在授权到期日前合法、到期日权利闸门失败", () => {
  const state = replay(events);
  assert.equal(evaluateGate(state, refs.versions.toyKr, "RIGHTS", { at: "2026-10-15T12:00:00+08:00" }).status, "PASSED");
  const after = evaluateGate(state, refs.versions.toyKr, "RIGHTS", { at: NOW });
  assert.equal(after.status, "FAILED");
  assert.match(after.reasons.join("\n"), /MUSEUM_IMAGE/);
});

test("美版 v1：即使权利人与市场双赞成，文化顾问否决仍使文化边界失败", () => {
  const state = replay(events);
  const clearance = evaluateClearance(state, refs.versions.dramaUsV1, { at: "2026-08-14T00:00:00+08:00" });
  assert.equal(clearance.gates.CULTURAL_BOUNDARY.status, "FAILED");
  const reasons = clearance.gates.CULTURAL_BOUNDARY.reasons.join("\n");
  assert.match(reasons, /禁用异议/);
  assert.match(reasons, /不可变要素/);
});

test("美版 v2：退回语言译写后四闸门全部通过", () => {
  const state = replay(events);
  const clearance = evaluateClearance(state, refs.versions.dramaUsV2, { at: RELEASE_DAY });
  assert.equal(clearance.cleared, true);
});

test("繁中短剧保留国内叙事仅译写：不可变要素的 TRANSLATED 处理合法", () => {
  const state = replay(events);
  assert.equal(evaluateGate(state, refs.versions.dramaTw, "CULTURAL_BOUNDARY", { at: RELEASE_DAY }).status, "PASSED");
});

test("欧盟潮玩越界：限定市场之外文化边界失败", () => {
  const state = replay(events);
  const result = evaluateGate(state, refs.versions.toyEu, "CULTURAL_BOUNDARY", { at: "2026-08-13T00:00:00+08:00" });
  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join("\n"), /不含 DE/);
});

test("收回计划：合作方退出只波及该团队未发行版本，不影响其他团队", () => {
  const state = replay(events);
  const plans = planRevocations(state);
  const exit = plans.find((p) => p.trigger === "PARTNER_EXIT" && p.team_id === refs.teams.dramaSea);
  assert.ok(exit);
  assert.deepEqual(exit.version_ids, [refs.versions.dramaMy]);
  assert.deepEqual(exit.block_unreleased, [refs.versions.dramaMy]);
  assert.deepEqual(exit.withdraw_list_entries, []); // 尚未发行，无需从清单撤回
  const grantTypes = exit.grant_ids.map((g) => g.rights_type).sort();
  assert.deepEqual(grantTypes, ["ADAPTATION", "DISTRIBUTION"]);
  for (const plan of plans) {
    if (plan.trigger === "PARTNER_EXIT") {
      assert.ok(!(plan.version_ids ?? []).includes(refs.versions.gameTw));
      assert.ok(!(plan.version_ids ?? []).includes(refs.versions.dramaUsV2));
    }
  }
});

test("收回计划：分级变化精确指向受影响版本与清单条目", () => {
  const state = replay(events);
  const plan = planRevocations(state).find((p) => p.trigger === "RATING_CHANGE");
  assert.deepEqual(plan.version_ids, [refs.versions.gameSa]);
  assert.deepEqual(plan.markets, ["SA"]);
  assert.deepEqual(plan.withdraw_list_entries, ["SA:ver-game-sa"]);
});

test("收回计划：权利到期列出受影响版本与清单撤回条目", () => {
  const state = replay(events);
  const expiryPlans = planRevocations(state).filter((p) => p.trigger === "RIGHTS_EXPIRY" && p.grant_id.startsWith("grant-toy"));
  assert.equal(expiryPlans.length, 2);
  for (const plan of expiryPlans) {
    assert.deepEqual(plan.version_ids, [refs.versions.toyKr]);
    assert.deepEqual(plan.withdraw_list_entries, ["KR:ver-toy-kr"]);
  }
});

test("贡献者台账：镜头/译写/设计各自可核对采用版本、投放与分账", () => {
  const state = replay(events);
  const footage = contributorStatement(state, refs.terms.footage);
  assert.equal(footage.emerging_creator, true);
  assert.equal(footage.credit.individual, true);
  const footageAdopted = Object.fromEntries(footage.adopted_by.map((v) => [v.version_id, v]));
  assert.equal(footageAdopted[refs.versions.gameTw].currently_distributable, true);
  assert.equal(footageAdopted[refs.versions.gameSa].blocked, true); // 分级暂停
  assert.equal(footageAdopted[refs.versions.gameSa].currently_distributable, false);
  assert.deepEqual(footage.payable, { amount: 1800, currency: "TWD" });
  assert.equal(footage.outstanding.amount, 0);

  const translation = contributorStatement(state, refs.terms.translation);
  const adopted = Object.fromEntries(translation.adopted_by.map((v) => [v.version_id, v]));
  assert.equal(adopted[refs.versions.dramaUsV1].released, false);
  assert.equal(adopted[refs.versions.dramaUsV1].blocked, true);
  assert.equal(adopted[refs.versions.dramaUsV2].released, true);
  assert.deepEqual(translation.payable, { amount: 2080, currency: "USD" });

  const design = contributorStatement(state, refs.terms.design);
  assert.equal(design.credit.credit_name, "白若汐 / Baek Seo-ah");
  assert.deepEqual(design.payable, { amount: 21_000_000, currency: "KRW" });
});

// ---- 合成事件流：重放期不变量 ----

function builder() {
  const seen = new Map();
  let seq = 0;
  return (eventType, aggregateType, aggregateId, payload, occurredAt = "2026-09-01T10:00:00+08:00") => {
    seq += 1;
    const key = `${aggregateType}/${aggregateId}`;
    const version = (seen.get(key) ?? 0) + 1;
    seen.set(key, version);
    return {
      event_id: `syn-${String(seq).padStart(3, "0")}`,
      event_type: eventType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      occurred_at: occurredAt,
      version,
      summary: "合成事件",
      payload,
    };
  };
}

test("与事实不符的发行许可会在重放时被拒绝（盖章不能覆盖闸门）", () => {
  const stream = [...events, {
    event_id: "syn-bad-clearance",
    event_type: "CLEARANCE_GRANTED",
    aggregate_type: "release_clearance",
    aggregate_id: "clr-ver-drama-us-v1",
    occurred_at: "2026-09-15T10:00:00+08:00",
    version: 1,
    summary: "试图给被否决的 v1 盖通行章",
    payload: {
      version_id: refs.versions.dramaUsV1,
      gates: ["CULTURAL_BOUNDARY", "RIGHTS", "RATING", "DELIVERY"].map((gate) => ({ gate, status: "PASSED" })),
    },
  }];
  const state = replay(stream);
  assert.match(state.violations.join("\n"), /发行许可.*与事实不符/);
});

test("闸门未通过的版本不得 MARKET_RELEASED", () => {
  const stream = [...events, {
    event_id: "syn-bad-release",
    event_type: "MARKET_RELEASED",
    aggregate_type: "market_adaptation",
    aggregate_id: refs.versions.toyEu,
    occurred_at: "2026-09-15T10:00:00+08:00",
    version: 3,
    summary: "试图发行被阻断的欧盟版",
    payload: { version_id: refs.versions.toyEu, market: "DE", release_list_id: "list-never" },
  }];
  const state = replay(stream);
  assert.match(state.violations.join("\n"), /发行 .* 不成立/);
});

test("PROHIBITED 限制即使没有顾问异议也独立阻断；LIMITED 限制按市场区分", () => {
  const mk = builder();
  const base = [
    mk("BOUNDARY_REGISTERED", "source_ip", "ip-x", { source_ip: { title: "X", rights_holder_id: "p" } }),
    mk("TEAM_REGISTERED", "partner_team", "team-a", { team: { id: "team-a", name: "A 组", partner_id: "pa" } }),
    mk("RIGHTS_CLEARED", "rights_grant", "g-a", {
      grant: { rights_type: "ADAPTATION", grantee_team_id: "team-a", markets: ["SA", "KR"], valid_from: "2026-01-01T00:00:00+08:00", valid_until: "2027-01-01T00:00:00+08:00" },
    }),
  ];
  const proposalPayload = (market) => ({
    source_ip_id: "ip-x", team_id: "team-a", kind: "DESIGN", target_markets: [market], target_audience: "所有人",
    change_targets: [{ target_type: "cultural_element", target_ref: "el-limited", treatment: "MODIFIED", element_refs: ["el-limited"], rationale: "潮玩化" }],
    triggered_authorizations: [{ rights_type: "ADAPTATION", rights_holder_id: "p" }],
  });

  const prohibited = replay([
    ...base,
    mk("BOUNDARY_REGISTERED", "cultural_element", "el-limited", { element: { name: "祭器", stability: "LOCALIZABLE", restrictions: [{ scope: "PROHIBITED" }] } }),
    mk("ADAPTATION_PROPOSED", "adaptation_proposal", "prop-sa", proposalPayload("SA")),
    mk("VERSION_FROZEN", "market_adaptation", "ver-sa", { proposal_id: "prop-sa", market: "SA", content_hash: "h1" }),
  ]);
  assert.equal(evaluateGate(prohibited, "ver-sa", "CULTURAL_BOUNDARY").status, "FAILED");

  const mk2 = builder();
  const base2 = [
    mk2("BOUNDARY_REGISTERED", "source_ip", "ip-x", { source_ip: { title: "X", rights_holder_id: "p" } }),
    mk2("TEAM_REGISTERED", "partner_team", "team-a", { team: { id: "team-a", name: "A 组", partner_id: "pa" } }),
    mk2("RIGHTS_CLEARED", "rights_grant", "g-a", {
      grant: { rights_type: "ADAPTATION", grantee_team_id: "team-a", markets: ["SA", "KR"], valid_from: "2026-01-01T00:00:00+08:00", valid_until: "2027-01-01T00:00:00+08:00" },
    }),
    mk2("BOUNDARY_REGISTERED", "cultural_element", "el-limited", { element: { name: "神鸟", stability: "LOCALIZABLE", restrictions: [{ scope: "LIMITED", markets: ["KR"] }] } }),
  ];
  const limited = replay([
    ...base2,
    mk2("ADAPTATION_PROPOSED", "adaptation_proposal", "prop-kr", proposalPayload("KR")),
    mk2("VERSION_FROZEN", "market_adaptation", "ver-kr", { proposal_id: "prop-kr", market: "KR", content_hash: "h1" }),
    mk2("ADAPTATION_PROPOSED", "adaptation_proposal", "prop-sa2", proposalPayload("SA")),
    mk2("VERSION_FROZEN", "market_adaptation", "ver-sa2", { proposal_id: "prop-sa2", market: "SA", content_hash: "h2" }),
  ]);
  assert.equal(evaluateGate(limited, "ver-kr", "CULTURAL_BOUNDARY").status, "PASSED");
  assert.equal(evaluateGate(limited, "ver-sa2", "CULTURAL_BOUNDARY").status, "FAILED");
});
