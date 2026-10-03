/**
 * 合议状态重放与发行判定。
 *
 * 事实来源只有事件流：重放后得到原始 IP、文化要素、提案、授权、版本、
 * 分级等当前状态；四道闸门（文化边界 / 权利 / 分级 / 交付）全部依据
 * 这些事实计算，而不是依据邮件或口头确认。
 */
import { eventTypes as T, releaseGates } from "./domain.js";
import { validateEvent } from "./validator.js";

const MUTATING_TREATMENTS = new Set(["MODIFIED", "REPLACED", "REMOVED"]);

function emptyState() {
  return {
    ips: new Map(),
    elements: new Map(),
    proposals: new Map(),
    teams: new Map(),
    grants: new Map(),
    terms: new Map(),
    assets: new Map(),
    milestones: [],
    versions: new Map(),
    clearances: new Map(),
    releaseLists: new Map(), // market -> { list_id, version_ids: Set, published_at }
    releases: [], // {version_id, market, at}
    ledger: new Map(), // term_id -> {usages: [], settlements: []}
    revocations: [],
    blocks: [],
    aggregateVersions: new Map(), // `${type}/${id}` -> 最大 version
    eventIds: new Set(),
    lastAt: null,
  };
}

function normalizeAt(value, state) {
  if (value === undefined) return state.lastAt ?? Date.now();
  return typeof value === "number" ? value : (Date.parse(value) || state.lastAt || Date.now());
}

function asTime(value) {
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * 重放事件流。
 * @param {Array<Record<string, unknown>>} events
 * @param {{validate?: boolean}} [options]
 */
export function replay(events, options = {}) {
  const state = emptyState();
  const violations = [];

  events.forEach((event, index) => {
    if (options.validate !== false) {
      for (const error of validateEvent(event)) violations.push(`事件#${index} ${event.event_id ?? ""}：${error}`);
    }
    apply(state, event, violations);
  });

  state.violations = violations;
  return state;
}

function bumpAggregateVersion(state, event, violations) {
  const key = `${event.aggregate_type}/${event.aggregate_id}`;
  const previous = state.aggregateVersions.get(key) ?? 0;
  if (event.version !== previous + 1) {
    violations.push(`${key} 版本号不连续：期望 ${previous + 1}，实际 ${event.version}（事件 ${event.event_id}）`);
  }
  state.aggregateVersions.set(key, event.version);
}

function apply(state, event, violations) {
  if (state.eventIds.has(event.event_id)) violations.push(`event_id 重复：${event.event_id}`);
  state.eventIds.add(event.event_id);
  bumpAggregateVersion(state, event, violations);
  const at = asTime(event.occurred_at);
  if (at && (!state.lastAt || at > state.lastAt)) state.lastAt = at;
  const p = event.payload ?? {};

  switch (event.event_type) {
    case T.BOUNDARY_REGISTERED:
      if (event.aggregate_type === "source_ip") {
        state.ips.set(event.aggregate_id, { id: event.aggregate_id, ...p.source_ip });
      } else {
        const element = {
          id: event.aggregate_id,
          name: p.element.name,
          stability: p.element.stability,
          restrictions: p.element.restrictions ?? [],
        };
        state.elements.set(event.aggregate_id, element);
      }
      break;

    case T.TEAM_REGISTERED:
      state.teams.set(p.team.id, { ...p.team, active: true });
      break;
    case T.PARTNER_EXITED:
      for (const team of state.teams.values()) {
        if (team.partner_id === p.partner_id) {
          team.active = false;
          team.exitedAt = p.effective_at;
        }
      }
      break;

    case T.ADAPTATION_PROPOSED:
    case T.PROPOSAL_REVISED: {
      const revision = state.aggregateVersions.get(`${event.aggregate_type}/${event.aggregate_id}`);
      const previous = state.proposals.get(event.aggregate_id);
      state.proposals.set(event.aggregate_id, snapshotProposal(event.aggregate_id, p, revision));
      if (previous && event.event_type === T.PROPOSAL_REVISED) {
        // 新版稿提交后，上一版次的异议与决定不再自动延续，需重新合议。
        state.proposals.get(event.aggregate_id).supersedes = previous;
      }
      break;
    }

    case T.RIGHTS_DECISION: {
      const proposal = state.proposals.get(event.aggregate_id);
      if (proposal) proposal.rightsDecisions.set(p.rights_holder_id, p.decision);
      else violations.push(`权利决定指向未知提案：${event.aggregate_id}`);
      break;
    }
    case T.ADVISORY_OBJECTION_FILED: {
      const proposal = state.proposals.get(p.proposal_id);
      if (!proposal) {
        violations.push(`顾问异议指向未知提案：${p.proposal_id}`);
        break;
      }
      proposal.objections.push({
        advisor_id: p.advisor_id,
        kind: p.objection_kind,
        element_refs: p.element_refs,
        asserts_prohibited: p.asserts_prohibited,
        basis: p.basis,
        at: event.occurred_at,
      });
      break;
    }
    case T.ADVISORY_DECISION: {
      const proposal = state.proposals.get(p.proposal_id);
      if (proposal) proposal.advisorDecisions.set(p.advisor_id, p.decision);
      else violations.push(`顾问决定指向未知提案：${p.proposal_id}`);
      break;
    }
    case T.MARKET_DECISION: {
      const proposal = state.proposals.get(p.proposal_id);
      if (proposal) proposal.marketDecisions.set(p.market, { decision: p.decision, owner: p.market_owner_id });
      else violations.push(`市场决定指向未知提案：${p.proposal_id}`);
      break;
    }

    case T.RIGHTS_CLEARED:
      state.grants.set(event.aggregate_id, {
        id: event.aggregate_id,
        ...p.grant,
        markets: new Set(p.grant.markets),
        element_refs: new Set(p.grant.element_refs ?? []),
        status: p.grant.status ?? "GRANTED",
      });
      break;
    case T.RIGHTS_REVOKED: {
      const grant = state.grants.get(p.grant_id);
      if (grant) {
        grant.status = p.status;
        grant.revokedAt = p.effective_at;
        grant.revokeReason = p.reason;
      } else violations.push(`权利收回指向未知授权：${p.grant_id}`);
      break;
    }

    case T.CONTRIBUTION_ACCEPTED:
      state.terms.set(event.aggregate_id, { id: event.aggregate_id, ...p.term });
      state.ledger.set(event.aggregate_id, { usages: [], settlements: [] });
      break;

    case T.AI_ASSET_REGISTERED:
      state.assets.set(event.aggregate_id, {
        id: event.aggregate_id,
        ...p.asset,
        input_grants: p.asset.input_grants,
        revisions: p.asset.human_revision ? [p.asset.human_revision] : [],
      });
      break;
    case T.AI_REVISION_RECORDED: {
      const asset = state.assets.get(p.asset_id);
      if (asset) asset.revisions.push(p.human_revision);
      else violations.push(`AI 修订指向未知资产：${p.asset_id}`);
      break;
    }

    case T.MILESTONE_RECORDED:
      state.milestones.push({ version_id: p.version_id, ...p.milestone, status: p.status, at: event.occurred_at });
      break;

    case T.VERSION_FROZEN: {
      const proposal = state.proposals.get(p.proposal_id);
      if (!proposal) {
        violations.push(`版本冻结指向未知提案：${p.proposal_id}`);
        break;
      }
      state.versions.set(event.aggregate_id, {
        id: event.aggregate_id,
        proposal_id: p.proposal_id,
        team_id: proposal.team_id,
        market: p.market,
        content_hash: p.content_hash,
        revision: proposal.revision,
        targets: structuredClone(proposal.targets),
        authorizations: structuredClone(proposal.authorizations),
        // 冻结时快照当时的禁用异议：之后提案再修订不影响已成片版本的证据。
        prohibitedObjections: proposal.objections
          .filter((objection) => objection.asserts_prohibited)
          .map((objection) => ({ advisor_id: objection.advisor_id, kind: objection.kind, element_refs: objection.element_refs })),
        frozenAt: event.occurred_at,
        delivery: null,
        rating: null,
        ratingDirty: false,
      });
      break;
    }
    case T.DELIVERY_VERIFIED: {
      const version = state.versions.get(p.version_id);
      if (version) version.delivery = { result: p.result, checks: p.checks, at: event.occurred_at };
      else violations.push(`交付校验指向未知版本：${p.version_id}`);
      break;
    }
    case T.RATING_GRANTED: {
      const version = state.versions.get(p.version_id);
      if (!marketMatches(version, p.market)) {
        violations.push(`分级授予与版本市场不符：${p.version_id} / ${p.market}`);
        break;
      }
      version.rating = { code: p.rating_code, certificate_ref: p.certificate_ref, at: event.occurred_at };
      version.ratingDirty = false;
      break;
    }
    case T.RATING_CHANGED: {
      const version = state.versions.get(p.version_id);
      if (!marketMatches(version, p.market)) {
        violations.push(`分级变化与版本市场不符：${p.version_id} / ${p.market}`);
        break;
      }
      // 分级一旦变化，受影响版本在重新取证前不得继续发行。
      version.ratingDirty = { change_type: p.change_type, at: p.effective_at };
      break;
    }

    case T.GATE_EVALUATED: {
      const clearance = clearanceFor(state, event.aggregate_id, p.version_id);
      clearance.assessments[p.gate] = { status: p.status, reasons: p.reasons ?? [], at: event.occurred_at };
      break;
    }
    case T.CLEARANCE_GRANTED: {
      const clearance = clearanceFor(state, event.aggregate_id, p.version_id);
      clearance.granted = true;
      clearance.gates = Object.fromEntries(p.gates.map((g) => [g.gate, g.status]));
      clearance.grantedAt = event.occurred_at;
      // 许可快照必须与事实重算结果一致，防止“盖章”覆盖闸门。
      for (const gate of releaseGates) {
        const fact = evaluateGate(state, p.version_id, gate, { at: asTime(event.occurred_at) });
        if (fact.status !== "PASSED") {
          violations.push(
            `发行许可 ${event.aggregate_id} 与事实不符：${gate} 实际为 ${fact.status}（${fact.reasons.join("；")}）`
          );
        }
      }
      break;
    }
    case T.VERSION_BLOCKED: {
      const version = state.versions.get(p.version_id);
      if (version) state.blocks.push({ version_id: p.version_id, gate: p.gate, reasons: p.reasons, at: event.occurred_at });
      else violations.push(`版本阻断指向未知版本：${p.version_id}`);
      break;
    }
    case T.ACCESS_REVOKED:
      state.revocations.push({
        team_id: p.team_id,
        trigger: p.trigger,
        scope: p.revocation_scope ?? {},
        effective_at: p.effective_at,
        event_id: event.event_id,
      });
      break;

    case T.DISTRIBUTION_PUBLISHED: {
      const list = { list_id: event.aggregate_id, version_ids: new Set(p.version_ids), published_at: event.occurred_at };
      const existing = state.releaseLists.get(p.market);
      state.releaseLists.set(p.market, existing
        ? { ...list, version_ids: new Set([...existing.version_ids, ...p.version_ids]) }
        : list);
      for (const id of p.version_ids) {
        if (!state.versions.has(id)) violations.push(`发行清单包含未知版本：${id}`);
      }
      break;
    }
    case T.MARKET_RELEASED: {
      const failures = releaseInvariants(state, p.version_id, p.market, asTime(event.occurred_at));
      for (const failure of failures) violations.push(`发行 ${event.event_id} 不成立：${failure}`);
      state.releases.push({ version_id: p.version_id, market: p.market, at: event.occurred_at });
      break;
    }

    case T.USAGE_RECORDED: {
      const entry = state.ledger.get(p.term_id);
      if (!entry) violations.push(`投放记录指向未知贡献者条款：${p.term_id}`);
      else entry.usages.push(stripKnown(p, ["term_id"]));
      break;
    }
    case T.SETTLEMENT_RECORDED: {
      const entry = state.ledger.get(p.term_id);
      if (!entry) violations.push(`结算记录指向未知贡献者条款：${p.term_id}`);
      else entry.settlements.push(stripKnown(p, ["term_id"]));
      break;
    }
    default:
      violations.push(`未识别事件类型：${event.event_type}`);
  }
}

function stripKnown(payload, keys) {
  const copy = { ...payload };
  for (const key of keys) delete copy[key];
  return copy;
}

function marketMatches(version, market) {
  return version && version.market === market;
}

function snapshotProposal(id, p, revision) {
  return {
    id,
    source_ip_id: p.source_ip_id,
    team_id: p.team_id,
    kind: p.kind,
    markets: new Set(p.target_markets),
    audience: p.target_audience,
    targets: structuredClone(p.change_targets),
    authorizations: structuredClone(p.triggered_authorizations),
    revision,
    rightsDecisions: new Map(),
    advisorDecisions: new Map(),
    marketDecisions: new Map(),
    objections: [],
  };
}

function clearanceFor(state, clearanceId, versionId) {
  if (!state.clearances.has(clearanceId)) {
    state.clearances.set(clearanceId, { id: clearanceId, version_id: versionId, assessments: {}, gates: {}, granted: false });
  }
  return state.clearances.get(clearanceId);
}

/**
 * 重算单个版本的单道闸门。
 * @returns {{status: 'PASSED'|'FAILED', reasons: string[]}}
 */
export function evaluateGate(state, versionId, gate, options = {}) {
  const version = state.versions.get(versionId);
  if (!version) return { status: "FAILED", reasons: ["版本不存在"] };
  const at = normalizeAt(options.at, state);
  switch (gate) {
    case "CULTURAL_BOUNDARY":
      return culturalBoundary(state, version);
    case "RIGHTS":
      return rightsGate(state, version, at);
    case "RATING":
      return ratingGate(version, at);
    case "DELIVERY":
      return deliveryGate(version);
    default:
      return { status: "FAILED", reasons: [`未知闸门：${gate}`] };
  }
}

function referencedElementIds(version) {
  const ids = new Set();
  for (const target of version.targets) {
    if (target.target_type === "cultural_element" && target.target_ref) ids.add(target.target_ref);
    for (const ref of target.element_refs ?? []) ids.add(ref);
  }
  return ids;
}

function culturalBoundary(state, version) {
  const reasons = [];

  // 1. 冻结时仍在册的顾问禁用异议：VETO 性质，不能被多数意见覆盖。
  for (const objection of version.prohibitedObjections ?? []) {
    reasons.push(`文化顾问 ${objection.advisor_id} 对 ${objection.element_refs.join("、")} 提出禁用异议（${objection.kind}）`);
  }

  // 2. 不可变要素不得被改写；译写（TRANSLATED）是允许的本地化通道。
  for (const ref of referencedElementIds(version)) {
    const element = state.elements.get(ref);
    if (!element) {
      reasons.push(`引用了未登记的文化要素：${ref}`);
      continue;
    }
    if (element.stability === "IMMUTABLE") {
      for (const target of version.targets) {
        const touches = target.target_ref === ref || (target.element_refs ?? []).includes(ref);
        if (touches && MUTATING_TREATMENTS.has(target.treatment)) {
          reasons.push(`不可变要素「${element.name}」不允许 ${target.treatment}`);
        }
      }
    }
    // 3. 明确禁用与限定市场的限制。
    for (const restriction of element.restrictions) {
      if (restriction.scope === "PROHIBITED") {
        reasons.push(`要素「${element.name}」在禁用范围内`);
      } else if (restriction.scope === "LIMITED" && !restriction.markets.includes(version.market)) {
        reasons.push(`要素「${element.name}」仅授权 ${restriction.markets.join("、")}，不含 ${version.market}`);
      }
    }
  }

  return reasons.length ? { status: "FAILED", reasons } : { status: "PASSED", reasons: [] };
}

function rightsGate(state, version, at) {
  const reasons = [];
  const team = state.teams.get(version.team_id);
  if (team && !team.active) reasons.push(`合作方团队 ${version.team_id} 已退出`);

  for (const need of version.authorizations) {
    const candidates = [...state.grants.values()].filter((grant) => {
      if (grant.id && need.grant_ref && grant.id !== need.grant_ref) return false;
      // 撤销/到期事件若晚于判定时刻，该时刻授权仍然有效（历史可追溯）。
      const revocationAt = grant.revokedAt ? asTime(grant.revokedAt) : null;
      const statusOk = grant.status === "GRANTED" || (revocationAt !== null && revocationAt > at);
      return (
        grant.rights_type === need.rights_type &&
        grant.grantee_team_id === version.team_id &&
        grant.markets.has(version.market) &&
        statusOk &&
        asTime(grant.valid_from) <= at &&
        asTime(grant.valid_until) >= at
      );
    });
    const grant = candidates.find((g) => g.element_refs.size === 0) ?? candidates[0];
    if (!grant) {
      reasons.push(`${version.market} 缺少 ${need.rights_type} 授权（权利人 ${need.rights_holder_id}）`);
      continue;
    }
    // 授权若限定到具体要素，必须覆盖提案实际触碰的要素。
    if (grant.element_refs.size > 0) {
      const needed = referencedElementIds(version);
      for (const ref of needed) {
        if (!grant.element_refs.has(ref)) {
          reasons.push(`${grant.id} 未覆盖要素 ${ref}（${need.rights_type}）`);
        }
      }
    }
  }
  return reasons.length ? { status: "FAILED", reasons } : { status: "PASSED", reasons: [] };
}

function ratingGate(version, at) {
  if (version.ratingDirty && asTime(version.ratingDirty.at) <= at) {
    return { status: "FAILED", reasons: [`分级发生 ${version.ratingDirty.change_type} 变化，待重新取证`] };
  }
  if (!version.rating) return { status: "FAILED", reasons: ["尚未取得当地分级"] };
  return { status: "PASSED", reasons: [] };
}

function deliveryGate(version) {
  if (!version.delivery) return { status: "FAILED", reasons: ["尚未完成交付校验"] };
  if (version.delivery.result !== "PASSED") return { status: "FAILED", reasons: ["交付校验未通过"] };
  return { status: "PASSED", reasons: [] };
}

/** 版本四道闸门的完整快照 */
export function evaluateClearance(state, versionId, options = {}) {
  const gates = Object.fromEntries(
    releaseGates.map((gate) => [gate, evaluateGate(state, versionId, gate, options)])
  );
  return {
    version_id: versionId,
    gates,
    cleared: releaseGates.every((gate) => gates[gate].status === "PASSED"),
  };
}

function releaseInvariants(state, versionId, market, at) {
  const failures = [];
  const version = state.versions.get(versionId);
  if (!version) return ["版本不存在"];
  if (version.market !== market) failures.push(`版本不属于市场 ${market}`);
  for (const gate of releaseGates) {
    const result = evaluateGate(state, versionId, gate, { at });
    if (result.status !== "PASSED") failures.push(`${gate} 未通过：${result.reasons.join("；")}`);
  }
  const list = state.releaseLists.get(market);
  if (!list || !list.version_ids.has(versionId)) failures.push("版本不在已发布的当地发行清单中");
  const blocked = state.blocks.find((block) => block.version_id === versionId && asTime(block.at) <= at);
  if (blocked) failures.push(`版本已被阻断（${blocked.gate}：${blocked.reasons.join("；")}）`);
  return failures;
}

/**
 * 当前时刻可合法进入某市场发行清单的版本：四道闸门全部通过、未被阻断、
 * 且已被该市场清单收录。合作方退出、权利到期或分级变化都会在此自动剔除。
 */
export function currentReleaseList(state, market, options = {}) {
  const at = normalizeAt(options.at, state);
  const published = state.releaseLists.get(market)?.version_ids ?? new Set();
  return [...published]
    .filter((versionId) => {
      const blocked = state.blocks.some((block) => block.version_id === versionId && asTime(block.at) <= at);
      if (blocked) return false;
      return releaseGates.every((gate) => evaluateGate(state, versionId, gate, { at }).status === "PASSED");
    })
    .sort();
}

/**
 * 触发事实 -> 精确收回计划。只列出受影响的授权、版本与市场，
 * 不波及同一团队的其他在产版本。
 */
export function planRevocations(state, options = {}) {
  const at = normalizeAt(options.at, state);
  const plans = [];

  // 合作方退出
  for (const team of state.teams.values()) {
    if (!team.active) {
      const teamGrants = [...state.grants.values()].filter((g) => g.grantee_team_id === team.id);
      const grantIds = teamGrants.map((g) => ({ grant_id: g.id, rights_type: g.rights_type, status: g.status }));
      const affected = affectedVersions(state, (v) => v.team_id === team.id, at);
      plans.push({ trigger: "PARTNER_EXIT", team_id: team.id, exited_at: team.exitedAt, grant_ids: grantIds, ...affected });
    }
  }

  // 权利到期（含撤销）
  for (const grant of state.grants.values()) {
    const expired = grant.status === "REVOKED" || grant.status === "EXPIRED" || asTime(grant.valid_until) < at;
    if (!expired) continue;
    const affected = affectedVersions(state, (v) =>
      v.authorizations.some((need) =>
        (need.grant_ref ? need.grant_ref === grant.id : need.rights_type === grant.rights_type) &&
        v.team_id === grant.grantee_team_id &&
        grant.markets.has(v.market)
      ), at);
    plans.push({ trigger: "RIGHTS_EXPIRY", grant_id: grant.id, reason: grant.revokeReason, ...affected });
  }

  // 分级变化
  for (const version of state.versions.values()) {
    if (version.ratingDirty) {
      plans.push({
        trigger: "RATING_CHANGE",
        version_ids: [version.id],
        markets: [version.market],
        withdraw_list_entries: [`${version.market}:${version.id}`],
        block_unreleased: [version.id],
      });
    }
  }

  return plans;
}

function affectedVersions(state, predicate, at) {
  const versionIds = [...state.versions.values()].filter(predicate).map((v) => v.id);
  const withdrawListEntries = [];
  for (const [market, list] of state.releaseLists.entries()) {
    for (const id of list.version_ids) {
      if (versionIds.includes(id)) withdrawListEntries.push(`${market}:${id}`);
    }
  }
  const released = new Set(state.releases.filter((r) => asTime(r.at) <= at).map((r) => r.version_id));
  return {
    version_ids: versionIds,
    markets: [...new Set(versionIds.map((id) => state.versions.get(id).market))],
    withdraw_list_entries: withdrawListEntries,
    block_unreleased: versionIds.filter((id) => !released.has(id)),
  };
}

/** 贡献者台账：本人的内容被怎样采用、在哪些版本投放、如何结算。 */
export function contributorStatement(state, termId) {
  const term = state.terms.get(termId);
  if (!term) return null;
  const account = state.ledger.get(termId) ?? { usages: [], settlements: [] };
  const adoptedBy = [...state.versions.values()]
    .filter((version) => (term.asset_refs ?? []).some((ref) => versionTargetsAsset(version, ref)))
    .map((version) => {
      const at = state.lastAt ?? Date.now();
      const blocked = state.blocks.some((block) => block.version_id === version.id && asTime(block.at) <= at);
      const released = state.releases.some((r) => r.version_id === version.id && r.market === version.market);
      const gates = evaluateClearance(state, version.id, { at });
      return {
        version_id: version.id,
        market: version.market,
        content_hash: version.content_hash,
        released,
        blocked,
        currently_distributable: released && !blocked && gates.cleared,
      };
    });

  const grossRevenue = account.usages.reduce((sum, u) => sum + (u.revenue?.amount ?? 0), 0);
  const currency = account.usages[0]?.revenue?.currency ?? term.compensation?.currency;
  const share = term.compensation?.model === "REVENUE_PERCENT" ? term.compensation.value / 100 : 0;
  const payable = Math.round(grossRevenue * share * 100) / 100;
  const settled = account.settlements.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return {
    term_id: termId,
    contributor_id: term.contributor_id,
    credit: term.credit,
    emerging_creator: term.emerging_creator === true,
    adopted_by: adoptedBy,
    usage: account.usages,
    settlements: account.settlements,
    gross_revenue: { amount: grossRevenue, currency },
    revenue_share: term.compensation,
    payable: { amount: payable, currency },
    settled: { amount: settled, currency: account.settlements[0]?.currency ?? currency },
    outstanding: { amount: Math.round((payable - settled) * 100) / 100, currency },
  };
}

function versionTargetsAsset(version, assetRef) {
  return version.targets.some((target) => target.target_ref === assetRef || (target.element_refs ?? []).includes(assetRef));
}
