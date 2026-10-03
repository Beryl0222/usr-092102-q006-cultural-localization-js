import { aggregateTypes, domainEventFields, enums, eventAggregates, eventTypes } from "./domain.js";

const envelopeRequired = [...domainEventFields, "payload"];

/** 载荷字段 -> 对应稳定枚举（出现即必须取值合法） */
const payloadEnums = Object.freeze({
  kind: enums.proposalKind,
  decision: enums.decision,
  role: enums.decisionRole,
  objection_kind: enums.objectionKind,
  asserts_prohibited: null,
  treatment: enums.treatment,
  target_type: enums.changeTargetType,
  rights_type: enums.rightsType,
  status: null, // 各事件的 status 枚举不同，在定制规则里单独校验
  stability: enums.elementStability,
  restriction_scope: enums.restrictionScope,
  scope: enums.restrictionScope,
  gate: enums.gate,
  gate_status: enums.gateStatus,
  result: enums.verificationResult,
  trigger: enums.revocationTrigger,
  change_type: enums.ratingChangeType,
  contributor_type: ["INDIVIDUAL", "TEAM"],
  "term.kind": enums.contributionKind,
  "term.compensation.model": enums.revenueShareModel,
  "term.credit.individual": null,
  "asset.kind": enums.aiAssetKind,
});

/** 各事件类型必须出现的载荷字段（点号表示嵌套路径） */
const requiredPayload = Object.freeze({
  [eventTypes.BOUNDARY_REGISTERED]: [], // source_ip 或 element，由定制规则二选一
  [eventTypes.ADAPTATION_PROPOSED]: [
    "source_ip_id",
    "team_id",
    "kind",
    "target_markets",
    "target_audience",
    "change_targets",
    "triggered_authorizations",
  ],
  [eventTypes.PROPOSAL_REVISED]: [
    "source_ip_id",
    "team_id",
    "kind",
    "target_markets",
    "target_audience",
    "change_targets",
    "triggered_authorizations",
  ],
  [eventTypes.RIGHTS_DECISION]: ["role", "decision", "rights_holder_id"],
  [eventTypes.ADVISORY_OBJECTION_FILED]: ["proposal_id", "advisor_id", "objection_kind", "element_refs", "asserts_prohibited"],
  [eventTypes.ADVISORY_DECISION]: ["proposal_id", "advisor_id", "role", "decision"],
  [eventTypes.MARKET_DECISION]: ["proposal_id", "market", "decision", "market_owner_id"],
  [eventTypes.TEAM_REGISTERED]: ["team"],
  [eventTypes.PARTNER_EXITED]: ["partner_id", "effective_at"],
  [eventTypes.RIGHTS_CLEARED]: ["grant"],
  [eventTypes.RIGHTS_REVOKED]: ["grant_id", "status", "reason", "effective_at"],
  [eventTypes.CONTRIBUTION_ACCEPTED]: ["term"],
  [eventTypes.AI_ASSET_REGISTERED]: ["asset"],
  [eventTypes.AI_REVISION_RECORDED]: ["asset_id", "human_revision"],
  [eventTypes.MILESTONE_RECORDED]: ["version_id", "milestone", "status"],
  [eventTypes.VERSION_FROZEN]: ["proposal_id", "market", "content_hash"],
  [eventTypes.RATING_GRANTED]: ["version_id", "market", "rating_code", "certificate_ref"],
  [eventTypes.RATING_CHANGED]: ["version_id", "market", "change_type", "effective_at"],
  [eventTypes.DELIVERY_VERIFIED]: ["version_id", "result", "checks"],
  [eventTypes.GATE_EVALUATED]: ["version_id", "gate", "status"],
  [eventTypes.CLEARANCE_GRANTED]: ["version_id", "gates"],
  [eventTypes.VERSION_BLOCKED]: ["version_id", "gate", "reasons"],
  [eventTypes.ACCESS_REVOKED]: ["team_id", "trigger", "effective_at"],
  [eventTypes.DISTRIBUTION_PUBLISHED]: ["market", "version_ids"],
  [eventTypes.MARKET_RELEASED]: ["version_id", "market", "release_list_id"],
  [eventTypes.USAGE_RECORDED]: ["term_id", "version_id", "period", "usage", "revenue"],
  [eventTypes.SETTLEMENT_RECORDED]: ["term_id", "period", "amount", "currency", "status"],
});

const getPath = (obj, path) => path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

function checkEnums(payload, prefix, errors) {
  for (const [field, allowed] of Object.entries(payloadEnums)) {
    if (allowed === null) continue;
    const path = prefix ? `${prefix}.${field}` : field;
    const value = getPath(payload, path);
    if (value !== undefined && !allowed.includes(value)) {
      errors.push(`非法枚举：${path}=${JSON.stringify(value)}`);
    }
  }
}

function requirePaths(payload, paths, errors) {
  for (const path of paths) {
    const value = getPath(payload, path);
    if (value === undefined || value === null || value === "") {
      errors.push(`payload 缺少字段：${path}`);
    }
  }
}

/** 事件级定制规则 */
const rules = {
  [eventTypes.BOUNDARY_REGISTERED](payload, errors) {
    if (!payload.source_ip && !payload.element) errors.push("payload 需要 source_ip 或 element");
    if (payload.element) {
      if (!payload.element.name) errors.push("payload.element 缺少字段：name");
      if (!enums.elementStability.includes(payload.element.stability)) errors.push("payload.element.stability 非法");
      for (const restriction of payload.element.restrictions ?? []) {
        if (!enums.restrictionScope.includes(restriction.scope)) errors.push("element.restrictions[].scope 非法");
        if (restriction.scope === "LIMITED" && !(restriction.markets?.length > 0)) {
          errors.push("LIMITED 限制必须声明 markets");
        }
      }
    }
    if (payload.source_ip && !payload.source_ip.rights_holder_id) errors.push("payload.source_ip 缺少字段：rights_holder_id");
  },

  [eventTypes.ADAPTATION_PROPOSED]: checkProposal,
  [eventTypes.PROPOSAL_REVISED]: checkProposal,

  [eventTypes.ADVISORY_OBJECTION_FILED](payload, errors) {
    if (!Array.isArray(payload.element_refs) || payload.element_refs.length === 0) {
      errors.push("顾问异议必须指向具体要素：element_refs 不能为空");
    }
    if (payload.asserts_prohibited === true && (!payload.basis || !String(payload.basis).trim())) {
      errors.push("主张禁用（asserts_prohibited）必须给出依据 basis");
    }
  },

  [eventTypes.RIGHTS_DECISION](payload, errors) {
    if (payload.role !== "RIGHTS_HOLDER") errors.push("权利决定的 role 必须是 RIGHTS_HOLDER");
  },
  [eventTypes.ADVISORY_DECISION](payload, errors) {
    if (payload.role !== "CULTURAL_ADVISOR") errors.push("顾问决定的 role 必须是 CULTURAL_ADVISOR");
  },
  [eventTypes.MARKET_DECISION](payload, errors) {
    if (payload.role && payload.role !== "MARKET_OWNER") errors.push("市场决定的 role 必须是 MARKET_OWNER");
  },

  [eventTypes.RIGHTS_CLEARED](payload, errors) {
    const grant = payload.grant ?? {};
    const keys = ["rights_type", "grantee_team_id", "markets", "valid_from", "valid_until"];
    requirePaths(grant, keys, errors);
    if (grant.rights_type && !enums.rightsType.includes(grant.rights_type)) errors.push("grant.rights_type 非法");
    if (Array.isArray(grant.markets) && grant.markets.length === 0) errors.push("grant.markets 不能为空");
    if (grant.valid_from && grant.valid_until && Date.parse(grant.valid_until) <= Date.parse(grant.valid_from)) {
      errors.push("grant.valid_until 必须晚于 valid_from");
    }
  },
  [eventTypes.RIGHTS_REVOKED](payload, errors) {
    if (!enums.rightsStatus.includes(payload.status)) errors.push("RIGHTS_REVOKED 的 status 非法");
  },

  [eventTypes.CONTRIBUTION_ACCEPTED](payload, errors) {
    const term = payload.term ?? {};
    requirePaths(term, ["contributor_id", "contributor_type", "kind", "credit", "compensation"], errors);
    if (term.kind && !enums.contributionKind.includes(term.kind)) errors.push("term.kind 非法");
    const credit = term.credit ?? {};
    const comp = term.compensation ?? {};
    if (credit.individual !== undefined && typeof credit.individual !== "boolean") errors.push("term.credit.individual 必须是布尔");
    if (credit.individual === true && !credit.credit_name) errors.push("个人署名必须提供 credit_name");
    if (comp.model && !enums.revenueShareModel.includes(comp.model)) errors.push("term.compensation.model 非法");
    if (comp.value !== undefined && (typeof comp.value !== "number" || comp.value < 0)) errors.push("term.compensation.value 必须是非负数");
    // 年轻创作者必须单独署名、单独分账，不能被团队署名或买断吞没
    if (term.emerging_creator === true) {
      if (credit.individual !== true) errors.push("年轻创作者贡献必须单独署名（credit.individual=true）");
      if (!["REVENUE_PERCENT", "POINTS"].includes(comp.model)) errors.push("年轻创作者贡献必须按比例/点数分账，不接受 BUYOUT");
    }
  },

  [eventTypes.AI_ASSET_REGISTERED](payload, errors) {
    const asset = payload.asset ?? {};
    if (asset.kind && !enums.aiAssetKind.includes(asset.kind)) errors.push("asset.kind 非法");
    if (!asset.tool?.name || !asset.tool.version) errors.push("AI 资产必须记录工具名称与版本（asset.tool.name/version）");
    if (!Array.isArray(asset.input_grants) || asset.input_grants.length === 0) {
      errors.push("AI 资产必须记录输入许可（asset.input_grants 不能为空）");
    }
    for (const grant of asset.input_grants ?? []) {
      if (!grant.grant_id) errors.push("input_grants[].grant_id 不能为空");
    }
  },
  [eventTypes.AI_REVISION_RECORDED](payload, errors) {
    const revision = payload.human_revision ?? {};
    requirePaths(revision, ["revised_by", "revision_count", "summary"], errors);
    if (revision.revision_count !== undefined && (!Number.isInteger(revision.revision_count) || revision.revision_count < 1)) {
      errors.push("human_revision.revision_count 必须是正整数");
    }
  },

  [eventTypes.MILESTONE_RECORDED](payload, errors) {
    if (!enums.milestoneStatus.includes(payload.status)) errors.push("里程碑 status 非法");
    if (!payload.milestone?.name) errors.push("里程碑必须提供 milestone.name");
  },

  [eventTypes.RATING_CHANGED](payload, errors) {
    if (!enums.ratingChangeType.includes(payload.change_type)) errors.push("rating change_type 非法");
  },

  [eventTypes.DELIVERY_VERIFIED](payload, errors) {
    if (!Array.isArray(payload.checks) || payload.checks.length === 0) errors.push("交付校验必须列出 checks");
  },

  [eventTypes.GATE_EVALUATED](payload, errors) {
    if (!enums.gate.includes(payload.gate)) errors.push("gate 非法");
    if (!enums.gateStatus.includes(payload.status)) errors.push("gate status 非法");
  },

  [eventTypes.CLEARANCE_GRANTED](payload, errors) {
    const gates = payload.gates;
    if (!Array.isArray(gates) || gates.length !== 4) {
      errors.push("发行许可必须同时包含四道闸门的结果");
      return;
    }
    const names = gates.map((g) => g.gate);
    if (names.some((name) => !enums.gate.includes(name))) errors.push("gates 中存在非法闸门名称");
    if (new Set(names).size !== 4) errors.push("四道闸门必须各出现一次");
    if (!gates.every((g) => g.status === "PASSED")) errors.push("只有四道闸门全部 PASSED 才能授予发行许可");
  },
  [eventTypes.VERSION_BLOCKED](payload, errors) {
    if (!enums.gate.includes(payload.gate)) errors.push("阻断原因 gate 非法");
    if (!Array.isArray(payload.reasons) || payload.reasons.length === 0) errors.push("阻断必须给出 reasons");
  },

  [eventTypes.ACCESS_REVOKED](payload, errors) {
    if (!enums.revocationTrigger.includes(payload.trigger)) errors.push("收回 trigger 非法");
  },
  [eventTypes.DISTRIBUTION_PUBLISHED](payload, errors) {
    if (!Array.isArray(payload.version_ids) || payload.version_ids.length === 0) errors.push("发行清单必须包含 version_ids");
  },
  [eventTypes.USAGE_RECORDED](payload, errors) {
    if (typeof payload.revenue?.amount !== "number") errors.push("投放记录必须包含 revenue.amount");
    if (!payload.period) errors.push("投放记录必须包含 period");
  },
  [eventTypes.SETTLEMENT_RECORDED](payload, errors) {
    if (!enums.settlementStatus.includes(payload.status)) errors.push("结算 status 非法");
    if (typeof payload.amount !== "number") errors.push("结算 amount 必须是数字");
  },
};

function checkProposal(payload, errors) {
  if (!Array.isArray(payload.target_markets) || payload.target_markets.length === 0) {
    errors.push("改写必须声明目标受众市场：target_markets 不能为空");
  }
  if (!payload.target_audience || !String(payload.target_audience).trim()) {
    errors.push("改写必须声明目标受众：target_audience 不能为空");
  }
  if (!Array.isArray(payload.change_targets) || payload.change_targets.length === 0) {
    errors.push("改写必须说明变更对象：change_targets 不能为空");
  }
  for (const [index, target] of (payload.change_targets ?? []).entries()) {
    const prefix = `change_targets[${index}]`;
    for (const key of ["target_type", "target_ref", "treatment", "rationale"]) {
      if (target[key] === undefined || target[key] === null || target[key] === "") errors.push(`${prefix} 缺少字段：${key}`);
    }
    if (target.target_type && !enums.changeTargetType.includes(target.target_type)) errors.push(`${prefix}.target_type 非法`);
    if (target.treatment && !enums.treatment.includes(target.treatment)) errors.push(`${prefix}.treatment 非法`);
    if (target.target_type === "cultural_element" && !(target.element_refs?.length > 0)) {
      errors.push(`${prefix} 变更文化要素时必须给出 element_refs`);
    }
  }
  if (!Array.isArray(payload.triggered_authorizations) || payload.triggered_authorizations.length === 0) {
    errors.push("改写必须声明触发的授权：triggered_authorizations 不能为空");
  }
  for (const [index, auth] of (payload.triggered_authorizations ?? []).entries()) {
    if (!auth.rights_type || !enums.rightsType.includes(auth.rights_type)) {
      errors.push(`triggered_authorizations[${index}].rights_type 缺失或非法`);
    }
    if (!auth.rights_holder_id) errors.push(`triggered_authorizations[${index}].rights_holder_id 不能为空`);
  }
}

/**
 * 校验单条领域事件。
 * @param {Record<string, unknown>} record
 * @returns {string[]} 错误信息数组，空数组表示通过
 */
export function validateEvent(record) {
  const errors = envelopeRequired
    .filter((name) => !(name in record))
    .map((name) => `缺少字段：${name}`);

  if (!errors.length) {
    if (!Number.isInteger(record.version) || record.version < 1) errors.push("version 必须是正整数");
    if (!Object.values(eventTypes).includes(record.event_type)) {
      errors.push(`未知事件类型：${record.event_type}`);
    }
    if (!Object.values(aggregateTypes).includes(record.aggregate_type)) {
      errors.push(`未知聚合类型：${record.aggregate_type}`);
    }
    const allowedAggregates = eventAggregates[record.event_type];
    if (allowedAggregates && !allowedAggregates.includes(record.aggregate_type)) {
      errors.push(`事件 ${record.event_type} 不能归属于聚合 ${record.aggregate_type}`);
    }
    if (Number.isNaN(Date.parse(record.occurred_at))) errors.push("occurred_at 不是合法时间");
  }

  const payload = record.payload;
  if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
    errors.push("payload 必须是对象");
    return errors;
  }
  if (payload) {
    requirePaths(payload, requiredPayload[record.event_type] ?? [], errors);
    checkEnums(payload, null, errors);
    rules[record.event_type]?.(payload, errors);
  }

  return errors;
}

/**
 * @param {Array<Record<string, unknown>>} records
 * @returns {Array<{event_id?: string, errors: string[]}>}
 */
export function validateEventStream(records) {
  if (!Array.isArray(records)) return [{ errors: ["事件流必须是数组"] }];
  return records
    .map((record) => ({ event_id: record?.event_id, errors: validateEvent(record) }))
    .filter((result) => result.errors.length > 0);
}
