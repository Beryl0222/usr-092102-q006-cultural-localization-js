/**
 * 文化出海本地化合议——领域词汇。
 *
 * 事件信封沿用七个基础字段（见 domainEventFields），业务字段统一放在
 * `payload` 下。event_type 与 aggregate_type 的取值、事件可归属的聚合、
 * 以及各稳定枚举只在此处登记一次，schema、校验器与样例都以此为准。
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

/** 聚合类型 */
export const aggregateTypes = Object.freeze({
  SOURCE_IP: "source_ip",
  CULTURAL_ELEMENT: "cultural_element",
  ADAPTATION_PROPOSAL: "adaptation_proposal",
  MARKET_ADAPTATION: "market_adaptation",
  RIGHTS_GRANT: "rights_grant",
  ADVISORY_REVIEW: "advisory_review",
  CONTRIBUTOR_TERM: "contributor_term",
  AI_ASSET: "ai_asset",
  PRODUCTION_MILESTONE: "production_milestone",
  RATING_RECORD: "rating_record",
  RELEASE_CLEARANCE: "release_clearance",
  RELEASE_LIST: "release_list",
  PARTNER_TEAM: "partner_team",
  CONTRIBUTOR_LEDGER: "contributor_ledger",
});

/** 事件类型（时间线上唯一可追加的事实） */
export const eventTypes = Object.freeze({
  BOUNDARY_REGISTERED: "BOUNDARY_REGISTERED",
  ADAPTATION_PROPOSED: "ADAPTATION_PROPOSED",
  PROPOSAL_REVISED: "PROPOSAL_REVISED",
  RIGHTS_DECISION: "RIGHTS_DECISION",
  ADVISORY_OBJECTION_FILED: "ADVISORY_OBJECTION_FILED",
  ADVISORY_DECISION: "ADVISORY_DECISION",
  MARKET_DECISION: "MARKET_DECISION",
  TEAM_REGISTERED: "TEAM_REGISTERED",
  PARTNER_EXITED: "PARTNER_EXITED",
  RIGHTS_CLEARED: "RIGHTS_CLEARED",
  RIGHTS_REVOKED: "RIGHTS_REVOKED",
  CONTRIBUTION_ACCEPTED: "CONTRIBUTION_ACCEPTED",
  AI_ASSET_REGISTERED: "AI_ASSET_REGISTERED",
  AI_REVISION_RECORDED: "AI_REVISION_RECORDED",
  MILESTONE_RECORDED: "MILESTONE_RECORDED",
  VERSION_FROZEN: "VERSION_FROZEN",
  RATING_GRANTED: "RATING_GRANTED",
  RATING_CHANGED: "RATING_CHANGED",
  DELIVERY_VERIFIED: "DELIVERY_VERIFIED",
  GATE_EVALUATED: "GATE_EVALUATED",
  CLEARANCE_GRANTED: "CLEARANCE_GRANTED",
  VERSION_BLOCKED: "VERSION_BLOCKED",
  ACCESS_REVOKED: "ACCESS_REVOKED",
  DISTRIBUTION_PUBLISHED: "DISTRIBUTION_PUBLISHED",
  MARKET_RELEASED: "MARKET_RELEASED",
  USAGE_RECORDED: "USAGE_RECORDED",
  SETTLEMENT_RECORDED: "SETTLEMENT_RECORDED",
});

/**
 * 事件可归属的聚合。多数事件只属于一个聚合；边界登记既可落在原始 IP
 * （登记权利人与基线），也可落在单个文化要素（登记稳定性与禁用范围）。
 */
export const eventAggregates = Object.freeze({
  BOUNDARY_REGISTERED: [aggregateTypes.SOURCE_IP, aggregateTypes.CULTURAL_ELEMENT],
  ADAPTATION_PROPOSED: [aggregateTypes.ADAPTATION_PROPOSAL],
  PROPOSAL_REVISED: [aggregateTypes.ADAPTATION_PROPOSAL],
  RIGHTS_DECISION: [aggregateTypes.ADAPTATION_PROPOSAL],
  ADVISORY_OBJECTION_FILED: [aggregateTypes.ADVISORY_REVIEW],
  ADVISORY_DECISION: [aggregateTypes.ADAPTATION_PROPOSAL],
  MARKET_DECISION: [aggregateTypes.ADAPTATION_PROPOSAL],
  TEAM_REGISTERED: [aggregateTypes.PARTNER_TEAM],
  PARTNER_EXITED: [aggregateTypes.PARTNER_TEAM],
  RIGHTS_CLEARED: [aggregateTypes.RIGHTS_GRANT],
  RIGHTS_REVOKED: [aggregateTypes.RIGHTS_GRANT],
  CONTRIBUTION_ACCEPTED: [aggregateTypes.CONTRIBUTOR_TERM],
  AI_ASSET_REGISTERED: [aggregateTypes.AI_ASSET],
  AI_REVISION_RECORDED: [aggregateTypes.AI_ASSET],
  MILESTONE_RECORDED: [aggregateTypes.PRODUCTION_MILESTONE],
  VERSION_FROZEN: [aggregateTypes.MARKET_ADAPTATION],
  RATING_GRANTED: [aggregateTypes.RATING_RECORD],
  RATING_CHANGED: [aggregateTypes.RATING_RECORD],
  DELIVERY_VERIFIED: [aggregateTypes.MARKET_ADAPTATION],
  GATE_EVALUATED: [aggregateTypes.RELEASE_CLEARANCE],
  CLEARANCE_GRANTED: [aggregateTypes.RELEASE_CLEARANCE],
  VERSION_BLOCKED: [aggregateTypes.MARKET_ADAPTATION],
  ACCESS_REVOKED: [aggregateTypes.PARTNER_TEAM],
  DISTRIBUTION_PUBLISHED: [aggregateTypes.RELEASE_LIST],
  MARKET_RELEASED: [aggregateTypes.MARKET_ADAPTATION, aggregateTypes.RELEASE_LIST],
  USAGE_RECORDED: [aggregateTypes.CONTRIBUTOR_LEDGER],
  SETTLEMENT_RECORDED: [aggregateTypes.CONTRIBUTOR_LEDGER],
});

/** 稳定枚举：业务代码与 JSON schema 必须保持一致 */
export const enums = Object.freeze({
  /** 文化要素稳定性：不可变 / 可本地化 */
  elementStability: ["IMMUTABLE", "LOCALIZABLE"],
  /** 限制范围：明确禁用 / 限定市场或条件 */
  restrictionScope: ["PROHIBITED", "LIMITED"],
  /** 变更处理方式 */
  treatment: ["RETAINED", "MODIFIED", "REPLACED", "REMOVED", "TRANSLATED"],
  /** 改写提案的变更类型 */
  proposalKind: [
    "SCENE_REWRITE",
    "RELATIONSHIP_REWRITE",
    "TRANSLATION",
    "DESIGN",
    "MARKET_SCOPE_EXTENSION",
  ],
  /** 变更对象类型：文化要素 / 场景 / 人物关系 / 素材 / 授权地域范围 */
  changeTargetType: [
    "cultural_element",
    "scene",
    "character_relationship",
    "material",
    "ip_market_scope",
  ],
  decisionRole: ["RIGHTS_HOLDER", "CULTURAL_ADVISOR", "MARKET_OWNER"],
  decision: ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "VETO"],
  objectionKind: ["PROHIBITED_ELEMENT", "SENSITIVE_CONTEXT", "FACTUAL_ACCURACY"],
  rightsType: [
    "ADAPTATION",
    "TRANSLATION",
    "DISTRIBUTION",
    "MERCHANDISE",
    "MUSEUM_IMAGE",
    "CAST_LIKENESS",
    "MATERIAL_USE",
    "AI_INPUT",
  ],
  rightsStatus: ["GRANTED", "EXPIRED", "REVOKED", "SUSPENDED"],
  contributionKind: ["FOOTAGE", "TRANSLATION", "DESIGN", "OTHER"],
  revenueShareModel: ["REVENUE_PERCENT", "POINTS", "BUYOUT"],
  aiAssetKind: ["IMAGE", "VIDEO", "VOICE", "TEXT"],
  milestoneStatus: ["PLANNED", "SUBMITTED", "ACCEPTED", "BLOCKED"],
  versionStatus: ["DRAFT", "IN_REVIEW", "APPROVED", "BLOCKED", "RELEASED", "WITHDRAWN"],
  ratingStatus: ["GRANTED", "SUPERSEDED", "REVOKED"],
  ratingChangeType: ["SUSPENDED", "REVOKED", "DOWNGRADED", "REISSUED"],
  gate: ["CULTURAL_BOUNDARY", "RIGHTS", "RATING", "DELIVERY"],
  gateStatus: ["PENDING", "PASSED", "FAILED"],
  verificationResult: ["PASSED", "FAILED"],
  /** 访问收回 / 版本阻断的触发来源 */
  revocationTrigger: [
    "PARTNER_EXIT",
    "RIGHTS_EXPIRY",
    "RATING_CHANGE",
    "PROHIBITION_VIOLATION",
  ],
  settlementStatus: ["PAYABLE", "PAID", "CONFIRMED"],
});

/** 发行前必须同时通过的四道闸门（顺序即合议顺序） */
export const releaseGates = Object.freeze([
  "CULTURAL_BOUNDARY",
  "RIGHTS",
  "RATING",
  "DELIVERY",
]);
