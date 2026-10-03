/**
 * 两级领域校验：
 *
 * 1. validateEvent(record)        —— 单事件信封与负载结构（任何一方都可在入口调用）
 * 2. validateEventStream(events)  —— 跨事件不变量，把合议规则落成机器可判定条件：
 *      · 改写说明必须写清“变更对象 / 目标受众 / 触发的授权”
 *      · 禁用范围的硬否决不被多数意见覆盖，且涉事版本不得放行
 *      · 权利授权按地区/渠道/有效期精确支撑闸口，到期、退出、分级变化精确阻断
 *      · 只有文化、权利、分级、交付四闸口全部通过的版本才能进入发行清单
 *      · AI 资产来源齐备、贡献者单独署名分账，结算只针对已发行版本
 */

import {
  CLEARANCE_GATES,
  DECISION_RESULTS,
  DECISION_ROLES,
  EVENT_AGGREGATE_SCOPE,
  EVENT_PAYLOAD_FIELDS,
  EVENT_TYPES,
  FIELD_ENUMS,
  GATE_RESULTS,
  REVOCATION_EFFECTS,
  REVOCATION_REASONS,
  VETO_BINDING_ROLES,
  domainEventFields,
} from "./domain.js";

const requiredEnvelope = [...domainEventFields];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isISODateTime(value) {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && /\d{4}-\d{2}-\d{2}T/.test(value);
}

function enumError(label, value, allowed) {
  return `${label} 取值非法：${JSON.stringify(value)}，允许 ${allowed.join(" | ")}`;
}

function checkObject(path, obj, errors, requiredKeys) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    errors.push(`${path} 必须是对象`);
    return false;
  }
  for (const key of requiredKeys) {
    const v = obj[key];
    const missing = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (missing) errors.push(`${path}.${key} 为必填项`);
  }
  return true;
}

function checkNonEmptyArray(path, arr, errors) {
  if (!Array.isArray(arr) || arr.length === 0) {
    errors.push(`${path} 必须是非空数组`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 单事件校验
// ---------------------------------------------------------------------------

export function validateEvent(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return ["事件必须是对象"];
  }

  for (const name of requiredEnvelope) {
    if (!(name in record)) errors.push(`缺少字段：${name}`);
  }
  if (errors.length > 0) return errors;

  if (!isNonEmptyString(record.event_id)) errors.push("event_id 不能为空");
  if (!isNonEmptyString(record.aggregate_id)) errors.push("aggregate_id 不能为空");
  if (!isNonEmptyString(record.summary)) errors.push("summary 不能为空");
  if (!Number.isInteger(record.version) || record.version < 1) {
    errors.push("version 必须是正整数");
  }
  if (!isISODateTime(record.occurred_at)) errors.push("occurred_at 必须是 ISO-8601 日期时间");
  if (!FIELD_ENUMS["event.event_type"].includes(record.event_type)) {
    errors.push(enumError("event_type", record.event_type, FIELD_ENUMS["event.event_type"]));
  }
  if (!FIELD_ENUMS["event.aggregate_type"].includes(record.aggregate_type)) {
    errors.push(enumError("aggregate_type", record.aggregate_type, FIELD_ENUMS["event.aggregate_type"]));
  }

  const scope = EVENT_AGGREGATE_SCOPE[record.event_type];
  if (scope && !scope.includes(record.aggregate_type)) {
    errors.push(
      `事件 ${record.event_type} 不能挂在聚合 ${record.aggregate_type} 上，允许：${scope.join(" | ")}`,
    );
  }

  const payloadRequired = EVENT_PAYLOAD_FIELDS[record.event_type];
  if (payloadRequired) validatePayload(record, payloadRequired, errors);

  return errors;
}

function validatePayload(record, requiredKeys, errors) {
  const tag = `[${record.event_id}] payload`;
  const payload = record.payload;
  if (!checkObject(tag, payload, errors, requiredKeys)) return;

  for (const key of requiredKeys) {
    const v = payload[key];
    if (v === undefined || v === null) continue; // 缺失已由 checkObject 报告
    if (typeof v === "string" && v.trim() === "") errors.push(`${tag}.${key} 不能为空串`);
  }

  switch (record.event_type) {
    case EVENT_TYPES.BOUNDARY_REGISTERED: {
      if (checkNonEmptyArray(`${tag}.immutable_elements`, payload.immutable_elements, errors)) {
        payload.immutable_elements.forEach((el, i) =>
          checkObject(`${tag}.immutable_elements[${i}]`, el, errors, ["element_id", "name", "rule"]),
        );
      }
      if (checkNonEmptyArray(`${tag}.prohibitions`, payload.prohibitions, errors)) {
        payload.prohibitions.forEach((el, i) =>
          checkObject(`${tag}.prohibitions[${i}]`, el, errors, ["prohibition_id", "statement"]),
        );
      }
      break;
    }

    case EVENT_TYPES.ADAPTATION_PROPOSED: {
      // 先让每个改写说明变更对象、目标受众和触发的授权，缺一不可进入合议。
      if (checkObject(`${tag}.change_target`, payload.change_target, errors, ["type", "ref"])) {
        if (!FIELD_ENUMS["payload.change_target.type"].includes(payload.change_target.type)) {
          errors.push(
            enumError(
              `${tag}.change_target.type`,
              payload.change_target.type,
              FIELD_ENUMS["payload.change_target.type"],
            ),
          );
        }
      }
      if (checkObject(`${tag}.target_audience`, payload.target_audience, errors, ["market"])) {
        if (!Array.isArray(payload.target_audience.languages) || payload.target_audience.languages.length === 0) {
          errors.push(`${tag}.target_audience.languages 必须是非空数组`);
        }
      }
      if (checkNonEmptyArray(`${tag}.triggered_clearances`, payload.triggered_clearances, errors)) {
        for (const c of payload.triggered_clearances) {
          if (!FIELD_ENUMS["payload.triggered_clearances[]"].includes(c)) {
            errors.push(enumError(`${tag}.triggered_clearances[]`, c, FIELD_ENUMS["payload.triggered_clearances[]"]));
          }
        }
      }
      break;
    }

    case EVENT_TYPES.RIGHTS_CLEARED: {
      if (!FIELD_ENUMS["payload.grant_kind"].includes(payload.grant_kind)) {
        errors.push(enumError(`${tag}.grant_kind`, payload.grant_kind, FIELD_ENUMS["payload.grant_kind"]));
      }
      if (!FIELD_ENUMS["payload.status_rights"].includes(payload.status)) {
        errors.push(enumError(`${tag}.status`, payload.status, FIELD_ENUMS["payload.status_rights"]));
      }
      checkNonEmptyArray(`${tag}.markets`, payload.markets, errors);
      checkNonEmptyArray(`${tag}.channels`, payload.channels, errors);
      if (!isISODateTime(payload.valid_from) || !isISODateTime(payload.valid_until)) {
        errors.push(`${tag}.valid_from / valid_until 必须是 ISO-8601 日期时间`);
      } else if (Date.parse(payload.valid_until) <= Date.parse(payload.valid_from)) {
        errors.push(`${tag}.valid_until 必须晚于 valid_from`);
      }
      break;
    }

    case EVENT_TYPES.PANEL_DECISION_RECORDED: {
      if (!FIELD_ENUMS["payload.role"].includes(payload.role)) {
        errors.push(enumError(`${tag}.role`, payload.role, FIELD_ENUMS["payload.role"]));
      }
      if (!FIELD_ENUMS["payload.decision"].includes(payload.decision)) {
        errors.push(enumError(`${tag}.decision`, payload.decision, FIELD_ENUMS["payload.decision"]));
      }
      break;
    }

    case EVENT_TYPES.CONTRIBUTION_ACCEPTED: {
      // 镜头、译写、设计贡献必须单独署名并写明分账，不允许并入集体名单。
      if (!FIELD_ENUMS["payload.contribution_kind"].includes(payload.contribution_kind)) {
        errors.push(
          enumError(`${tag}.contribution_kind`, payload.contribution_kind, FIELD_ENUMS["payload.contribution_kind"]),
        );
      }
      if (!isNonEmptyString(payload.attribution)) errors.push(`${tag}.attribution 必须给出单独署名`);
      checkObject(`${tag}.revenue_share`, payload.revenue_share, errors, ["basis", "rate", "currency"]);
      if (!Array.isArray(payload.adaptation_ids)) errors.push(`${tag}.adaptation_ids 必须是数组`);
      break;
    }

    case EVENT_TYPES.AI_ASSET_REGISTERED:
    case EVENT_TYPES.AI_ASSET_REVISED: {
      // AI 资产须记录输入许可、工具版本及人工修订，三件套缺一不可。
      if (record.event_type === EVENT_TYPES.AI_ASSET_REGISTERED) {
        if (!FIELD_ENUMS["payload.asset_kind"].includes(payload.asset_kind)) {
          errors.push(enumError(`${tag}.asset_kind`, payload.asset_kind, FIELD_ENUMS["payload.asset_kind"]));
        }
        if (checkNonEmptyArray(`${tag}.input_permissions`, payload.input_permissions, errors)) {
          payload.input_permissions.forEach((perm, i) =>
            checkObject(`${tag}.input_permissions[${i}]`, perm, errors, ["ref", "grant_id", "scope"]),
          );
        }
      }
      checkObject(`${tag}.tool`, payload.tool, errors, ["name", "version", "provider"]);
      checkObject(`${tag}.human_revision`, payload.human_revision, errors, ["revised_by", "at", "description"]);
      if (payload.human_revision && !isISODateTime(payload.human_revision.at)) {
        errors.push(`${tag}.human_revision.at 必须是 ISO-8601 日期时间`);
      }
      break;
    }

    case EVENT_TYPES.MARKET_BUILD_ASSEMBLED: {
      if (!isNonEmptyString(payload.market)) errors.push(`${tag}.market 必须是地区码`);
      checkNonEmptyArray(`${tag}.adaptation_ids`, payload.adaptation_ids, errors);
      if (!Array.isArray(payload.asset_ids)) errors.push(`${tag}.asset_ids 必须是数组`);
      if (!Array.isArray(payload.contribution_ids)) errors.push(`${tag}.contribution_ids 必须是数组`);
      break;
    }

    case EVENT_TYPES.CLEARANCE_GATE_EVALUATED: {
      const gateKeys = Object.values(CLEARANCE_GATES);
      if (!checkObject(`${tag}.gates`, payload.gates, errors, gateKeys)) break;
      for (const gate of gateKeys) {
        const node = payload.gates[gate];
        if (!checkObject(`${tag}.gates.${gate}`, node, errors, ["result"])) continue;
        if (!Object.values(GATE_RESULTS).includes(node.result)) {
          errors.push(enumError(`${tag}.gates.${gate}.result`, node.result, Object.values(GATE_RESULTS)));
        }
      }
      const rights = payload.gates[CLEARANCE_GATES.RIGHTS];
      if (rights?.result === GATE_RESULTS.PASSED && !checkNonEmptyArray(`${tag}.gates.rights.grant_refs`, rights.grant_refs, errors)) {
        errors.push(`${tag}.gates.rights 通过时必须给出支撑授权 grant_refs`);
      }
      if (payload.gates[CLEARANCE_GATES.RATING]?.result === GATE_RESULTS.PASSED) {
        if (!isNonEmptyString(payload.gates[CLEARANCE_GATES.RATING].certificate)) {
          errors.push(`${tag}.gates.rating 通过时必须给出现行分级文号 certificate`);
        }
      }
      break;
    }

    case EVENT_TYPES.ACCESS_REVOKED: {
      if (!FIELD_ENUMS["payload.revocation_reason"].includes(payload.reason)) {
        errors.push(enumError(`${tag}.reason`, payload.reason, FIELD_ENUMS["payload.revocation_reason"]));
      }
      if (!checkNonEmptyArray(`${tag}.effects`, payload.effects, errors)) break;
      for (const effect of payload.effects) {
        if (!FIELD_ENUMS["payload.revocation_effects[]"].includes(effect)) {
          errors.push(enumError(`${tag}.effects[]`, effect, FIELD_ENUMS["payload.revocation_effects[]"]));
        }
      }
      if (payload.effects.includes(REVOCATION_EFFECTS.ACCESS_WITHDRAWN) && !(payload.subject_ids?.length > 0)) {
        errors.push(`${tag}.effects 含 access_withdrawn 时必须精确给出 subject_ids`);
      }
      if (payload.effects.includes(REVOCATION_EFFECTS.VERSIONS_BLOCKED) && !(payload.affected_build_ids?.length > 0)) {
        errors.push(`${tag}.effects 含 versions_blocked 时必须精确给出 affected_build_ids`);
      }
      if (!isNonEmptyString(payload.trigger_ref)) errors.push(`${tag}.trigger_ref 必须引用收回依据（授权/分级文号/禁用项）`);
      if (!isISODateTime(payload.effective_at)) errors.push(`${tag}.effective_at 必须是 ISO-8601 日期时间`);
      if (payload.reason === REVOCATION_REASONS.RIGHTS_EXPIRY && !payload.effects.includes(REVOCATION_EFFECTS.VERSIONS_BLOCKED)) {
        errors.push(`${tag}.reason 为 rights_expiry 时必须阻断受影响版本`);
      }
      break;
    }

    case EVENT_TYPES.VERSION_REINSTATED: {
      if (!isNonEmptyString(payload.build_id)) errors.push(`${tag}.build_id 必填`);
      break;
    }

    case EVENT_TYPES.MARKET_RELEASED: {
      if (!isNonEmptyString(payload.build_id) || !isNonEmptyString(payload.market)) {
        errors.push(`${tag}.build_id 与 market 必填`);
      }
      break;
    }

    case EVENT_TYPES.USAGE_SETTLED: {
      if (!FIELD_ENUMS["payload.settlement_status"].includes(payload.status)) {
        errors.push(enumError(`${tag}.status`, payload.status, FIELD_ENUMS["payload.settlement_status"]));
      }
      checkNonEmptyArray(`${tag}.build_ids`, payload.build_ids, errors);
      checkNonEmptyArray(`${tag}.markets`, payload.markets, errors);
      checkObject(`${tag}.amount`, payload.amount, errors, ["value", "currency"]);
      if (payload.amount && !(Number.isFinite(payload.amount.value) && payload.amount.value >= 0)) {
        errors.push(`${tag}.amount.value 必须是非负数字`);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 事件流不变量
// ---------------------------------------------------------------------------

/**
 * @param {Array<Object>} events 已按 occurred_at 先后排列的事件序列
 * @returns {Array<string>} 违反合议规则的说明（空数组表示通过）
 */
export function validateEventStream(events) {
  const errors = [];

  // 先逐条做结构校验，结构不合法就不进入跨事件推理。
  events.forEach((event, index) => {
    for (const problem of validateEvent(event)) {
      errors.push(`第 ${index + 1} 条事件（${event.event_id ?? "无 id"}）：${problem}`);
    }
  });
  if (errors.length > 0) return errors;

  const seenEventIds = new Set();
  const versionsByAggregate = new Map();
  let previousTime = null;

  // 索引
  const adaptations = new Map(); // aggregate_id -> { payload, vetoes[], decisions[] }
  const grants = new Map(); // aggregate_id -> 最新 RIGHTS_CLEARED 负载
  const builds = new Map(); // build_id(=market_build 聚合 id) -> assembled payload
  const contributorTerms = new Map(); // contributor_term 聚合 id -> 负载
  const contributorsByName = new Map(); // payload.contributor_id -> term 负载
  const aiAssets = new Set(); // ai_asset 聚合 id
  const gateEvalsByBuild = new Map(); // build_id -> [{event, payload}]，按时间顺序
  const listedKeys = new Set(); // `${build_id}|${market}` 当前在发行清单上
  const blockedBuilds = new Map(); // build_id -> { reason, at }
  const reinstatedAt = new Map(); // build_id -> 最近一次恢复时间，恢复后必须重走闸口
  // 注：access_withdrawn 的主体撤权由下游访问控制系统订阅 ACCESS_REVOKED 执行，
  // 事件流只保证主体标识与触发依据精确可追溯，不在此重复实现访问控制。

  for (const event of events) {
    if (seenEventIds.has(event.event_id)) errors.push(`event_id 重复：${event.event_id}`);
    seenEventIds.add(event.event_id);

    if (previousTime !== null && Date.parse(event.occurred_at) < previousTime) {
      errors.push(`[${event.event_id}] occurred_at 早于前一条事件，事件流必须按时间排列`);
    }
    previousTime = Date.parse(event.occurred_at);

    const seq = versionsByAggregate.get(event.aggregate_id) ?? [];
    const expectedVersion = seq.length + 1;
    if (event.version !== expectedVersion) {
      errors.push(
        `[${event.event_id}] 聚合 ${event.aggregate_id} 版本号应为 ${expectedVersion}，实际为 ${event.version}（须从 1 单调递增）`,
      );
    }
    seq.push(event);
    versionsByAggregate.set(event.aggregate_id, seq);

    const p = event.payload ?? {};

    switch (event.event_type) {
      case EVENT_TYPES.ADAPTATION_PROPOSED: {
        adaptations.set(event.aggregate_id, { payload: p, vetoes: [], decisions: new Map() });
        break;
      }

      case EVENT_TYPES.RIGHTS_CLEARED: {
        grants.set(event.aggregate_id, p);
        break;
      }

      case EVENT_TYPES.PANEL_DECISION_RECORDED: {
        const adaptation = adaptations.get(p.adaptation_id);
        if (!adaptation) {
          errors.push(`[${event.event_id}] 决定引用了不存在的改写 ${p.adaptation_id}`);
          break;
        }
        // 由适当的角色分别决定：一个角色对同一改写只登记一次立场，避免靠重复投票压过异议。
        if (adaptation.decisions.has(p.role)) {
          errors.push(`[${event.event_id}] 角色 ${p.role} 对改写 ${p.adaptation_id} 已作决定，不得重复表决`);
        }
        adaptation.decisions.set(p.role, p);
        if (p.decision === DECISION_RESULTS.HARD_VETO) {
          if (!VETO_BINDING_ROLES.includes(p.role)) {
            errors.push(`[${event.event_id}] 只有权利人与文化顾问可以登记 hard_veto，市场负责人无此权力`);
          }
          adaptation.vetoes.push({ event, role: p.role, rationale: p.rationale });
        }
        break;
      }

      case EVENT_TYPES.CONTRIBUTION_ACCEPTED: {
        contributorTerms.set(event.aggregate_id, p);
        contributorsByName.set(p.contributor_id, p);
        break;
      }

      case EVENT_TYPES.AI_ASSET_REGISTERED: {
        aiAssets.add(event.aggregate_id);
        // 输入许可必须引用真实存在的授权。
        for (const perm of p.input_permissions) {
          if (!grants.has(perm.grant_id)) {
            errors.push(`[${event.event_id}] AI 资产输入许可 ${perm.ref} 引用了不存在的授权 ${perm.grant_id}`);
          }
        }
        break;
      }

      case EVENT_TYPES.AI_ASSET_REVISED: {
        if (!aiAssets.has(event.aggregate_id)) {
          errors.push(`[${event.event_id}] 修订了从未登记 AI_ASSET_REGISTERED 的资产 ${event.aggregate_id}`);
        }
        break;
      }

      case EVENT_TYPES.MARKET_BUILD_ASSEMBLED: {
        builds.set(event.aggregate_id, p);
        for (const adaptationId of p.adaptation_ids) {
          if (!adaptations.has(adaptationId)) {
            errors.push(`[${event.event_id}] 版本引用了不存在的改写 ${adaptationId}`);
          }
        }
        for (const assetId of p.asset_ids ?? []) {
          if (!aiAssets.has(assetId)) {
            errors.push(`[${event.event_id}] 版本采用的 AI 资产 ${assetId} 未登记来源（输入许可/工具版本/人工修订）`);
          }
        }
        for (const termId of p.contribution_ids ?? []) {
          if (!contributorTerms.has(termId)) {
            errors.push(`[${event.event_id}] 版本引用了不存在的贡献约定 ${termId}`);
          }
        }
        break;
      }

      case EVENT_TYPES.CLEARANCE_GATE_EVALUATED: {
        const build = builds.get(p.build_id);
        if (!build) {
          errors.push(`[${event.event_id}] 闸口判定针对不存在的版本 ${p.build_id}`);
          break;
        }
        if (build.market !== p.market) {
          errors.push(`[${event.event_id}] 闸口地区 ${p.market} 与版本组装地区 ${build.market} 不一致`);
        }
        gateEvalsByBuild.set(p.build_id, [...(gateEvalsByBuild.get(p.build_id) ?? []), { event, payload: p }]);

        // 文化闸口：禁用硬否决不被多数意见覆盖——哪怕其余角色全部 approved。
        if (p.gates[CLEARANCE_GATES.CULTURAL].result === GATE_RESULTS.PASSED) {
          const vetoed = build.adaptation_ids.filter((id) => (adaptations.get(id)?.vetoes.length ?? 0) > 0);
          if (vetoed.length > 0) {
            errors.push(
              `[${event.event_id}] 版本 ${p.build_id} 含被硬否决的改写 ${vetoed.join("、")}，文化闸口不得判 passed（多数意见不能覆盖禁用范围）`,
            );
          }
        }

        // 四闸口声称全过时，合议必须完整：三类角色分别决定过，且没有普通否决在案。
        const allPassed = Object.values(CLEARANCE_GATES).every((g) => p.gates[g].result === GATE_RESULTS.PASSED);
        if (allPassed) {
          for (const adaptationId of build.adaptation_ids) {
            const adaptation = adaptations.get(adaptationId);
            if (!adaptation) continue; // 未知改写已在 MARKET_BUILD_ASSEMBLED 分支报告
            for (const role of Object.values(DECISION_ROLES)) {
              if (!adaptation.decisions.has(role)) {
                errors.push(
                  `[${event.event_id}] 改写 ${adaptationId} 缺少 ${role} 的独立决定，不能以四闸口全过放行`,
                );
              }
            }
            for (const [role, decision] of adaptation.decisions) {
              if (decision.decision === DECISION_RESULTS.REJECTED) {
                errors.push(
                  `[${event.event_id}] 改写 ${adaptationId} 存在 ${role} 的 rejected 决定，需修订后重新提案再审理`,
                );
              }
            }
          }
        }

        // 权利闸口：每项 grant_ref 必须真实、覆盖该地区、在有效期内、状态有效。
        if (p.gates[CLEARANCE_GATES.RIGHTS].result === GATE_RESULTS.PASSED) {
          const at = Date.parse(event.occurred_at);
          for (const grantId of p.gates[CLEARANCE_GATES.RIGHTS].grant_refs) {
            const grant = grants.get(grantId);
            if (!grant) {
              errors.push(`[${event.event_id}] 权利闸口引用了不存在的授权 ${grantId}`);
              continue;
            }
            if (!grant.markets.includes(p.market)) {
              errors.push(
                `[${event.event_id}] 授权 ${grantId} 地域 ${grant.markets.join("/")} 不覆盖 ${p.market}（博物馆等授权不得越过限定市场）`,
              );
            }
            if (grant.status !== "active") {
              errors.push(`[${event.event_id}] 授权 ${grantId} 状态为 ${grant.status}，不能支撑权利闸口`);
            }
            if (Date.parse(grant.valid_from) > at || Date.parse(grant.valid_until) < at) {
              errors.push(`[${event.event_id}] 授权 ${grantId} 在 ${event.occurred_at} 不在有效期（${grant.valid_from} ~ ${grant.valid_until}）`);
            }
          }
        }
        break;
      }

      case EVENT_TYPES.MARKET_RELEASED: {
        const build = builds.get(p.build_id);
        if (!build) {
          errors.push(`[${event.event_id}] 发行了不存在的版本 ${p.build_id}`);
          break;
        }
        const key = `${p.build_id}|${p.market}`;
        if (listedKeys.has(key)) {
          errors.push(`[${event.event_id}] 版本 ${p.build_id} 在 ${p.market} 重复进入发行清单`);
        }
        listedKeys.add(key);

        if (build.market !== p.market) {
          errors.push(`[${event.event_id}] 版本 ${p.build_id} 只能在其组装地区 ${build.market} 发行，而非 ${p.market}`);
        }

        // 四闸口必须全部通过，且以发行前最后一次判定为准。
        const evals = (gateEvalsByBuild.get(p.build_id) ?? []).filter(
          (item) => item.payload.market === p.market && Date.parse(item.event.occurred_at) <= Date.parse(event.occurred_at),
        );
        if (evals.length === 0) {
          errors.push(`[${event.event_id}] 版本 ${p.build_id} 未经四闸口判定即进入 ${p.market} 发行清单`);
        } else {
          const latestEvalAt = Date.parse(evals[evals.length - 1].event.occurred_at);
          const latest = evals[evals.length - 1].payload.gates;
          const failed = Object.values(CLEARANCE_GATES).filter((g) => latest[g].result !== GATE_RESULTS.PASSED);
          if (failed.length > 0) {
            errors.push(
              `[${event.event_id}] 版本 ${p.build_id} 的 ${failed.join("、")} 闸口未全部 passed，只有四项全过才能出现在 ${p.market} 发行清单`,
            );
          }
          // 恢复（或阻断登记）之后必须重新判定四闸口，旧判定不溯及新状态。
          const reinstated = reinstatedAt.get(p.build_id);
          if (reinstated && latestEvalAt < Date.parse(reinstated)) {
            errors.push(`[${event.event_id}] 版本 ${p.build_id} 恢复后未重新通过四闸口判定，不得发行`);
          }
        }

        // 含硬否决改写的版本永不放行。
        const vetoed = build.adaptation_ids.filter((id) => (adaptations.get(id)?.vetoes.length ?? 0) > 0);
        if (vetoed.length > 0) {
          errors.push(`[${event.event_id}] 版本 ${p.build_id} 含硬否决改写 ${vetoed.join("、")}，禁止发行`);
        }

        if (blockedBuilds.has(p.build_id)) {
          const block = blockedBuilds.get(p.build_id);
          errors.push(
            `[${event.event_id}] 版本 ${p.build_id} 自 ${block.at} 起因 ${block.reason} 被阻断，未经恢复与重审不得发行`,
          );
        }
        break;
      }

      case EVENT_TYPES.ACCESS_REVOKED: {
        // access_withdrawn：subject_ids 已在单事件校验中按 effects 条件强制给出，
        // 撤权动作由下游访问控制系统执行（见文件内职责说明）。
        if (p.effects.includes(REVOCATION_EFFECTS.VERSIONS_BLOCKED)) {
          for (const buildId of p.affected_build_ids) {
            const blockedBuild = builds.get(buildId);
            if (!blockedBuild) {
              errors.push(`[${event.event_id}] 收回事件阻断了不存在的版本 ${buildId}`);
              continue;
            }
            blockedBuilds.set(buildId, { reason: p.reason, at: event.occurred_at });
            // 阻断即时摘除该版本所在地区的发行清单：撤回后不得再被当作已发行结算。
            listedKeys.delete(`${buildId}|${blockedBuild.market}`);
          }
        }
        break;
      }

      case EVENT_TYPES.VERSION_REINSTATED: {
        const block = blockedBuilds.get(p.build_id);
        if (!block) {
          errors.push(`[${event.event_id}] 版本 ${p.build_id} 未处于阻断状态，无需恢复`);
        } else if (block.reason === REVOCATION_REASONS.VETO_BREACH) {
          errors.push(`[${event.event_id}] 版本 ${p.build_id} 因触碰禁用范围被阻断，不允许恢复发行`);
        } else {
          blockedBuilds.delete(p.build_id);
          reinstatedAt.set(p.build_id, event.occurred_at);
        }
        // 恢复不溯及闸口：发行前必须重新做一次四闸口判定（见 MARKET_RELEASED 分支）。
        break;
      }

      case EVENT_TYPES.USAGE_SETTLED: {
        if (!contributorsByName.has(p.contributor_id)) {
          errors.push(`[${event.event_id}] 结算对象 ${p.contributor_id} 没有署名分账约定（CONTRIBUTION_ACCEPTED）`);
        }
        for (const buildId of p.build_ids) {
          const build = builds.get(buildId);
          if (!build) {
            errors.push(`[${event.event_id}] 结算引用了不存在的版本 ${buildId}`);
            continue;
          }
          const releasedSomewhere = p.markets.some((market) => listedKeys.has(`${buildId}|${market}`));
          if (!releasedSomewhere) {
            errors.push(
              `[${event.event_id}] 版本 ${buildId} 尚未在结算所列地区发行（或已被阻断撤回），不能结算采用/投放（贡献者只能核对已投放内容）`,
            );
          }
        }
        break;
      }
    }
  }

  return errors;
}
