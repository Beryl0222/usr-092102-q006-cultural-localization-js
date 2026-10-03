/**
 * 文化出海本地化合议——领域事件词汇。
 *
 * 本文件是跨团队交换的唯一事实来源：事件信封、稳定枚举与关键负载字段
 * 均在此登记，JSON Schema（contracts/domain.schema.json）与校验器
 * （src/validator.js）引用同一组常量，不允许各方私下增删。
 */

// ---------------------------------------------------------------------------
// 事件信封
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DomainEvent
 * @property {string} event_id        全局唯一事件标识，建议 项目-对象-序号
 * @property {string} event_type      见 EVENT_TYPES
 * @property {string} aggregate_type  见 AGGREGATE_TYPES
 * @property {string} aggregate_id    聚合根稳定标识；收回/阻断等事件通过此引用精确命中对象
 * @property {string} occurred_at     ISO-8601 时间
 * @property {number} version         同一 aggregate 内单调递增，从 1 开始
 * @property {string} summary         人类可读摘要
 * @property {Object} [payload]       事件负载，字段约定见各 EVENT_PAYLOAD_FIELDS
 */

export const domainEventFields = Object.freeze([
  "event_id",
  "event_type",
  "aggregate_type",
  "aggregate_id",
  "occurred_at",
  "version",
  "summary",
]);

// ---------------------------------------------------------------------------
// 聚合根（合议中可独立追溯的对象）
// ---------------------------------------------------------------------------

export const AGGREGATE_TYPES = Object.freeze({
  /** 原始 IP：原始作品及其不可变文化要素清单的挂载点 */
  SOURCE_IP: "source_ip",
  /** 本地化改写：一条“改什么、给谁看、触发谁授权”的变更说明及其审理过程 */
  MARKET_ADAPTATION: "market_adaptation",
  /** 权利依据：演员/素材/博物馆授权、地域与有效期、合作方身份 */
  RIGHTS_GRANT: "rights_grant",
  /** 合议：针对一条改写，权利人/文化顾问/市场负责人按角色分别作出的决定集合 */
  REVIEW_PANEL: "review_panel",
  /** 贡献约定：年轻创作者等个人的署名方式与分账条款 */
  CONTRIBUTOR_TERM: "contributor_term",
  /** AI 资产：模型生成素材的输入许可、工具版本与人工修订记录 */
  AI_ASSET: "ai_asset",
  /** 市场版本：某一地区、某一分级下的具体成片/商品版本 */
  MARKET_BUILD: "market_build",
  /** 发行清关：文化边界、权利、分级、交付四项闸口的逐版放行记录 */
  RELEASE_CLEARANCE: "release_clearance",
  /** 采用与结算：贡献如何被采用、投放以及对贡献者的结算明细（可由贡献者核对） */
  USAGE_SETTLEMENT: "usage_settlement",
});

// ---------------------------------------------------------------------------
// 事件类型
// ---------------------------------------------------------------------------

export const EVENT_TYPES = Object.freeze({
  /** 登记原始 IP 与不可变文化要素（含强制禁用项），后续任何合议不得推翻 */
  BOUNDARY_REGISTERED: "BOUNDARY_REGISTERED",
  /** 提出本地化改写说明：必须写明变更对象、目标受众、触发的授权 */
  ADAPTATION_PROPOSED: "ADAPTATION_PROPOSED",
  /** 登记/更新一项授权：权利人、地域、渠道、有效期、分级约束 */
  RIGHTS_CLEARED: "RIGHTS_CLEARED",
  /** 合议中某一角色（权利人/文化顾问/市场负责人）给出独立决定 */
  PANEL_DECISION_RECORDED: "PANEL_DECISION_RECORDED",
  /** 登记贡献者（含年轻创作者）的署名与分账条款 */
  CONTRIBUTION_ACCEPTED: "CONTRIBUTION_ACCEPTED",
  /** 登记 AI 资产：输入许可、工具版本、人工修订 */
  AI_ASSET_REGISTERED: "AI_ASSET_REGISTERED",
  /** 人工修订 AI 资产的追加记录（工具版本或修订人变化时） */
  AI_ASSET_REVISED: "AI_ASSET_REVISED",
  /** 产生一个市场版本（地区 + 分级 + 所采用改写/资产/贡献的清单） */
  MARKET_BUILD_ASSEMBLED: "MARKET_BUILD_ASSEMBLED",
  /** 四项闸口（文化/权利/分级/交付）逐项判定；全部通过才放行 */
  CLEARANCE_GATE_EVALUATED: "CLEARANCE_GATE_EVALUATED",
  /** 版本进入地区发行清单（只有四项闸口全部通过才允许） */
  MARKET_RELEASED: "MARKET_RELEASED",
  /** 合作方退出 / 权利到期 / 分级变化：精确收回访问或阻断受影响版本 */
  ACCESS_REVOKED: "ACCESS_REVOKED",
  /** 被阻断的版本恢复（重新取得权利或重新评级后），仍需重新走闸口 */
  VERSION_REINSTATED: "VERSION_REINSTATED",
  /** 记录内容如何被采用、投放，并形成可核对的分账结算 */
  USAGE_SETTLED: "USAGE_SETTLED",
});

/** 事件类型允许归属的聚合类型（不属于下表的事件可挂在任意聚合，但必须语义相符）。 */
export const EVENT_AGGREGATE_SCOPE = Object.freeze({
  BOUNDARY_REGISTERED: ["source_ip"],
  ADAPTATION_PROPOSED: ["market_adaptation"],
  RIGHTS_CLEARED: ["rights_grant"],
  PANEL_DECISION_RECORDED: ["review_panel"],
  CONTRIBUTION_ACCEPTED: ["contributor_term"],
  AI_ASSET_REGISTERED: ["ai_asset"],
  AI_ASSET_REVISED: ["ai_asset"],
  MARKET_BUILD_ASSEMBLED: ["market_build"],
  CLEARANCE_GATE_EVALUATED: ["release_clearance"],
  MARKET_RELEASED: ["release_clearance"],
  ACCESS_REVOKED: ["rights_grant", "market_build", "release_clearance"],
  VERSION_REINSTATED: ["market_build", "release_clearance"],
  USAGE_SETTLED: ["usage_settlement"],
});

// ---------------------------------------------------------------------------
// 合议角色与决定
// ---------------------------------------------------------------------------

/** 决策角色：每类事项只能由“适当的”角色决定，三类角色各自独立，互不代表。 */
export const DECISION_ROLES = Object.freeze({
  RIGHTS_HOLDER: "rights_holder", // 权利人（IP 方、博物馆、演员/素材权利人）
  CULTURAL_ADVISOR: "cultural_advisor", // 文化顾问（可否决对不可变要素的改动）
  MARKET_OWNER: "market_owner", // 市场负责人（受众、发行、商业可行性）
});

export const DECISION_RESULTS = Object.freeze({
  APPROVED: "approved", // 同意
  REJECTED: "rejected", // 普通否决：可在合议中讨论修订后重新提案
  /** 强制否决：触碰不可变文化要素/禁用范围，多数意见不能覆盖，亦不可重新包装绕过 */
  HARD_VETO: "hard_veto",
  ABSTAINED: "abstained", // 弃权（不影响通过，但必须记录理由）
});

/** 哪些角色的 HARD_VETO 构成硬否决（文化顾问对不可变要素；权利人对越权使用）。 */
export const VETO_BINDING_ROLES = Object.freeze([
  DECISION_ROLES.CULTURAL_ADVISOR,
  DECISION_ROLES.RIGHTS_HOLDER,
]);

// ---------------------------------------------------------------------------
// 改写与触发授权
// ---------------------------------------------------------------------------

export const CHANGE_TARGET_TYPES = Object.freeze({
  SCENE: "scene", // 场景（如宗教性场景的替换）
  CHARACTER_RELATION: "character_relation", // 人物关系
  DIALOGUE_TRANSLATION: "dialogue_translation", // 台词译写
  NARRATIVE: "narrative", // 叙事主线
  DESIGN: "design", // 潮玩/视觉设计
  ASSET_USAGE: "asset_usage", // 文物形象等素材使用方式
});

/** 改写说明必须触发并指明的授权类别——“改什么”决定“谁有权决定”。 */
export const TRIGGERED_CLEARANCES = Object.freeze({
  IP_HOLDER: "ip_holder", // 原始 IP 权利人
  MUSEUM: "museum", // 博物馆（文物授权通常限定市场/渠道）
  TALENT: "talent", // 演员
  MATERIAL: "material", // 素材（影像/音乐/形象）
  CULTURAL_REVIEW: "cultural_review", // 文化边界审查
  RATING_BOARD: "rating_board", // 分级机构
});

// ---------------------------------------------------------------------------
// 权利与收回
// ---------------------------------------------------------------------------

export const RIGHTS_STATUS = Object.freeze({
  ACTIVE: "active",
  EXPIRED: "expired",
  REVOKED: "revoked", // 合作方退出等主动收回
  SUSPENDED: "suspended", // 分级调查期间临时中止
});

/** 收回触发原因：决定收回动作是“撤访问”还是“阻断版本”，以及可否恢复。 */
export const REVOCATION_REASONS = Object.freeze({
  PARTNER_EXIT: "partner_exit", // 合作方退出：撤其访问 + 阻断含其独占授权的版本
  RIGHTS_EXPIRY: "rights_expiry", // 权利到期：阻断到期地域/渠道上的版本
  RATING_CHANGE: "rating_change", // 分级变化：阻断原分级版本，等待重新评级
  VETO_BREACH: "veto_breach", // 发现触碰禁用范围：立即阻断，不允许恢复发行
});

/** 收回影响范围，要求精确命中，不允许无差别下架。 */
export const REVOCATION_EFFECTS = Object.freeze({
  ACCESS_WITHDRAWN: "access_withdrawn", // 仅收回主体访问权限
  VERSIONS_BLOCKED: "versions_blocked", // 阻断指定版本（不得出现在发行清单）
});

// ---------------------------------------------------------------------------
// AI 资产
// ---------------------------------------------------------------------------

export const ASSET_KINDS = Object.freeze({
  FOOTAGE: "footage", // 镜头
  TRANSLATION: "translation", // 译写文稿
  DESIGN: "design", // 设计稿/潮玩
  VOICE: "voice",
  MUSIC: "music",
  IMAGE: "image",
});

// ---------------------------------------------------------------------------
// 贡献者署名与分账
// ---------------------------------------------------------------------------

export const CONTRIBUTION_KINDS = Object.freeze({
  FOOTAGE: "footage", // 年轻创作者拍摄的镜头
  TRANSLATION: "transcreation", // 译写
  DESIGN: "design", // 设计
  SCRIPT: "script",
  PERFORMANCE: "performance",
});

export const SETTLEMENT_STATUS = Object.freeze({
  REPORTED: "reported", // 已上报采用与投放，待对账
  CONFIRMED: "confirmed", // 贡献者已核对
  DISPUTED: "disputed", // 贡献者提出异议
  PAID: "paid",
});

// ---------------------------------------------------------------------------
// 发行闸口：四项全部通过，成片才能出现在当地发行清单
// ---------------------------------------------------------------------------

export const CLEARANCE_GATES = Object.freeze({
  CULTURAL: "cultural", // 文化边界：无未决硬否决，禁用项零触碰
  RIGHTS: "rights", // 权利：所采用素材/演员/文物授权覆盖该地区、渠道且在有效期
  RATING: "rating", // 分级：该版本持有目标地区现行有效分级
  DELIVERY: "delivery", // 交付校验：技术质检与版本物料齐全
});

export const GATE_RESULTS = Object.freeze({
  PASSED: "passed",
  FAILED: "failed",
  PENDING: "pending",
});

// ---------------------------------------------------------------------------
// 关键事件负载的必备字段（校验器与 JSON Schema 同源）
// ---------------------------------------------------------------------------

export const EVENT_PAYLOAD_FIELDS = Object.freeze({
  BOUNDARY_REGISTERED: [
    "ip_name",
    "immutable_elements", // [{ element_id, name, rule }]
    "prohibitions", // [{ prohibition_id, statement }] 禁用范围，任何多数不可覆盖
  ],
  ADAPTATION_PROPOSED: [
    "change_target", // { type, ref } 变更对象
    "target_audience", // { market, languages[], rating_intent, channels[] } 目标受众
    "triggered_clearances", // string[] 触发的授权（取值见 TRIGGERED_CLEARANCES）
    "proposed_by",
    "change_summary",
  ],
  RIGHTS_CLEARED: [
    "grant_kind", // ip_holder | museum | talent | material
    "granted_by",
    "markets", // ISO 地区码；博物馆授权尤其不得越界
    "channels",
    "valid_from",
    "valid_until",
    "status",
  ],
  PANEL_DECISION_RECORDED: [
    "adaptation_id",
    "role",
    "decision",
    "decided_by",
    "rationale",
  ],
  CONTRIBUTION_ACCEPTED: [
    "contributor_id",
    "contributor_name",
    "contribution_kind",
    "attribution", // 署名方式（单独署名，不得并入集体）
    "revenue_share", // 分账：{ basis, rate, currency }
    "adaptation_ids", // 该贡献被哪些改写/版本采用
  ],
  AI_ASSET_REGISTERED: [
    "asset_kind",
    "input_permissions", // 输入材料的许可依据 [{ ref, grant_id, scope }]
    "tool", // { name, version, provider } 工具版本
    "human_revision", // { revised_by, at, description } 人工修订
    "created_by",
  ],
  AI_ASSET_REVISED: ["tool", "human_revision"],
  MARKET_BUILD_ASSEMBLED: [
    "market", // ISO 地区码
    "rating",
    "adaptation_ids",
    "asset_ids",
    "contribution_ids",
    "assembled_by",
  ],
  CLEARANCE_GATE_EVALUATED: [
    "build_id",
    "market",
    "gates", // { cultural: {result}, rights: {result, grant_refs[]}, rating: {result, certificate}, delivery: {result} }
    "evaluated_by",
  ],
  MARKET_RELEASED: ["build_id", "market", "released_by"],
  ACCESS_REVOKED: [
    "reason", // partner_exit | rights_expiry | rating_change | veto_breach
    "effects", // access_withdrawn 时必填 subject_ids；versions_blocked 时必填 affected_build_ids
    "trigger_ref", // 触发依据：授权 id / 分级文号 / 禁用项 id，保证可追溯
    "effective_at",
    // subject_ids / affected_build_ids 按 effects 条件必填，由校验器判定
  ],
  VERSION_REINSTATED: ["build_id", "reason", "reinstated_by"],
  USAGE_SETTLED: [
    "contributor_id",
    "build_ids", // 在哪些版本中采用
    "markets", // 在哪些地区投放
    "usage_detail", // 采用方式（镜头时长/译写字数/设计件数）
    "amount", // { value, currency }
    "status", // reported | confirmed | disputed | paid
  ],
});

/** 各字段允许取值的枚举（供校验器与 schema 生成共用）。 */
export const FIELD_ENUMS = Object.freeze({
  "event.event_type": Object.values(EVENT_TYPES),
  "event.aggregate_type": Object.values(AGGREGATE_TYPES),
  "payload.grant_kind": [
    TRIGGERED_CLEARANCES.IP_HOLDER,
    TRIGGERED_CLEARANCES.MUSEUM,
    TRIGGERED_CLEARANCES.TALENT,
    TRIGGERED_CLEARANCES.MATERIAL,
  ],
  "payload.status_rights": Object.values(RIGHTS_STATUS),
  "payload.role": Object.values(DECISION_ROLES),
  "payload.decision": Object.values(DECISION_RESULTS),
  "payload.change_target.type": Object.values(CHANGE_TARGET_TYPES),
  "payload.triggered_clearances[]": Object.values(TRIGGERED_CLEARANCES),
  "payload.revocation_reason": Object.values(REVOCATION_REASONS),
  "payload.revocation_effects[]": Object.values(REVOCATION_EFFECTS),
  "payload.asset_kind": Object.values(ASSET_KINDS),
  "payload.contribution_kind": Object.values(CONTRIBUTION_KINDS),
  "payload.settlement_status": Object.values(SETTLEMENT_STATUS),
  "payload.gate": Object.values(CLEARANCE_GATES),
  "payload.gate_result": Object.values(GATE_RESULTS),
});
