/**
 * 三团队「海外版可以改」可追溯合议样例（事件流数据源）。
 *
 * 三条业务线：
 *   游戏《丝路奇旅》——替换宗教性场景（合法本地化；后遇沙特分级暂停）
 *   短剧《长安驿丞》——美版 v1 重写人物关系触碰不可变要素被否决，v2 退回译写；
 *                      马来版合作方退出，未发行版本被精确阻断
 *   文物潮玩——壁画神鸟授权仅限特定市场：欧盟越界被顾问否决，韩国版到期收回
 *
 * 事件只追加、不修改；版本号由构造器按聚合自动连续编号。
 */

const counter = { seq: 0, perAggregate: new Map() };

function ev(eventType, aggregateType, aggregateId, occurredAt, summary, payload = {}, { causationId, correlationId } = {}) {
  counter.seq += 1;
  const key = `${aggregateType}/${aggregateId}`;
  const version = (counter.perAggregate.get(key) ?? 0) + 1;
  counter.perAggregate.set(key, version);
  const event = {
    event_id: `${occurredAt.slice(0, 10).replace(/-/g, "")}-${String(counter.seq).padStart(3, "0")}`,
    event_type: eventType,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    occurred_at: occurredAt,
    version,
    summary,
    payload,
  };
  if (causationId) event.causation_id = causationId;
  if (correlationId) event.correlation_id = correlationId;
  return event;
}

const T = {
  boundary: "BOUNDARY_REGISTERED",
  propose: "ADAPTATION_PROPOSED",
  revise: "PROPOSAL_REVISED",
  rights: "RIGHTS_DECISION",
  objection: "ADVISORY_OBJECTION_FILED",
  advisor: "ADVISORY_DECISION",
  market: "MARKET_DECISION",
  team: "TEAM_REGISTERED",
  exit: "PARTNER_EXITED",
  granted: "RIGHTS_CLEARED",
  revoke: "RIGHTS_REVOKED",
  contribution: "CONTRIBUTION_ACCEPTED",
  ai: "AI_ASSET_REGISTERED",
  aiRevision: "AI_REVISION_RECORDED",
  milestone: "MILESTONE_RECORDED",
  freeze: "VERSION_FROZEN",
  rating: "RATING_GRANTED",
  ratingChanged: "RATING_CHANGED",
  delivery: "DELIVERY_VERIFIED",
  gate: "GATE_EVALUATED",
  clearance: "CLEARANCE_GRANTED",
  block: "VERSION_BLOCKED",
  access: "ACCESS_REVOKED",
  list: "DISTRIBUTION_PUBLISHED",
  release: "MARKET_RELEASED",
  usage: "USAGE_RECORDED",
  settle: "SETTLEMENT_RECORDED",
};

const A = {
  ip: "source_ip",
  element: "cultural_element",
  proposal: "adaptation_proposal",
  version: "market_adaptation",
  grant: "rights_grant",
  review: "advisory_review",
  term: "contributor_term",
  asset: "ai_asset",
  milestone: "production_milestone",
  rating: "rating_record",
  clearance: "release_clearance",
  list: "release_list",
  team: "partner_team",
  ledger: "contributor_ledger",
};

const CORR = { game: "corr-silk-road-game", drama: "corr-changan-courier", toy: "corr-auspicious-beast" };
const GATES_ALL_PASSED = ["CULTURAL_BOUNDARY", "RIGHTS", "RATING", "DELIVERY"].map((gate) => ({ gate, status: "PASSED" }));

const events = [];
for (const section of [teams(), boundaries(), game(), drama(), toy()]) events.push(...section);
events.sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0));

/** 三十多个协作制片团队：全部登记在册，本样例只展开其中四个团队的合议。 */
function teams() {
  const out = [];
  for (let i = 1; i <= 32; i += 1) {
    const id = `team-coprod-${String(i).padStart(2, "0")}`;
    out.push(ev(T.team, A.team, id, "2026-08-01T09:00:00+08:00", `登记协作制片团队 ${i}`, {
      team: { id, name: `协作制片团队 ${i}`, partner_id: `partner-studio-${String(i).padStart(2, "0")}` },
    }));
  }
  out.push(
    ev(T.team, A.team, "team-game-overseas", "2026-08-01T09:01:00+08:00", "登记游戏海外版团队", {
      team: { id: "team-game-overseas", name: "丝路游戏海外发行组", partner_id: "partner-silkroad-studio" },
    }),
    ev(T.team, A.team, "team-drama-studio", "2026-08-01T09:02:00+08:00", "登记短剧自制团队", {
      team: { id: "team-drama-studio", name: "长安驿丞自制组", partner_id: "partner-inhouse" },
    }),
    ev(T.team, A.team, "team-drama-sea", "2026-08-01T09:03:00+08:00", "登记短剧东南亚合作方", {
      team: { id: "team-drama-sea", name: "南星传媒", partner_id: "partner-sea-media" },
    }),
    ev(T.team, A.team, "team-toy-design", "2026-08-01T09:04:00+08:00", "登记潮玩设计团队", {
      team: { id: "team-toy-design", name: "瑞物化造设计组", partner_id: "partner-toyco" },
    })
  );
  return out;
}

function boundaries() {
  return [
    ev(T.boundary, A.ip, "ip-silk-road-game", "2026-08-03T10:00:00+08:00", "登记原始 IP《丝路奇旅》与权利人", {
      source_ip: { title: "丝路奇旅", rights_holder_id: "party/silkroad-studio", baseline_version: "v3.1" },
    }),
    ev(T.boundary, A.ip, "ip-changan-courier", "2026-08-03T10:05:00+08:00", "登记原始 IP 短剧《长安驿丞》与权利人", {
      source_ip: { title: "长安驿丞", rights_holder_id: "party/changan-media", baseline_version: "v2.0" },
    }),
    ev(T.boundary, A.ip, "ip-museum-auspicious-beast", "2026-08-03T10:10:00+08:00", "登记原始 IP「瑞兽系列」与博物馆授权方", {
      source_ip: { title: "瑞兽系列", rights_holder_id: "party/northwest-museum", baseline_version: "v1.2" },
    }),
    ev(T.boundary, A.element, "el-ribat-procession", "2026-08-03T10:20:00+08:00", "登记文化要素：宗教巡游场景（可本地化）", {
      element: { name: "宗教巡游场景", stability: "LOCALIZABLE", restrictions: [] },
    }),
    ev(T.boundary, A.element, "el-mentor-code", "2026-08-03T10:25:00+08:00", "登记文化要素：师门伦理关系（不可变；禁用范围=改写其实质，译写除外）", {
      element: {
        name: "师门伦理",
        stability: "IMMUTABLE",
        restrictions: [],
      },
    }),
    ev(T.boundary, A.element, "el-mural-bird", "2026-08-03T10:30:00+08:00", "登记文化要素：壁画神鸟形象（博物馆限定市场授权）", {
      element: {
        name: "壁画神鸟",
        stability: "LOCALIZABLE",
        restrictions: [{ scope: "LIMITED", markets: ["CN", "KR"], note: "博物馆图像授权仅限中国大陆与韩国" }],
      },
    }),
  ];
}

function game() {
  const c = CORR.game;
  const out = [];
  out.push(
    ev(T.propose, A.proposal, "prop-game-overseas", "2026-08-05T11:00:00+08:00", "游戏海外版：以世俗巴扎开市仪式替换宗教巡游场景", {
      source_ip_id: "ip-silk-road-game",
      team_id: "team-game-overseas",
      kind: "SCENE_REWRITE",
      target_markets: ["SA", "TW"],
      target_audience: "15+ 泛中东与繁体中文玩家",
      change_targets: [
        {
          target_type: "scene",
          target_ref: "scene-ch3-ribat-procession",
          treatment: "REPLACED",
          element_refs: ["el-ribat-procession"],
          rationale: "移除特定宗教仪式表现，替换为不具宗教属性的巴扎开市仪式，保留商队入城的叙事功能",
        },
        { target_type: "material", target_ref: "asset-ai-bg-souq", treatment: "RETAINED", rationale: "AI 生成的巴扎背景图按授权使用" },
        { target_type: "material", target_ref: "asset-footage-kaohsiung", treatment: "RETAINED", rationale: "繁中版使用年轻创作者拍摄的海港空镜" },
      ],
      triggered_authorizations: [
        { rights_type: "ADAPTATION", rights_holder_id: "party/silkroad-studio" },
        { rights_type: "DISTRIBUTION", rights_holder_id: "party/silkroad-studio", markets: ["SA", "TW"] },
        { rights_type: "CAST_LIKENESS", rights_holder_id: "party/talent-guild", markets: ["SA", "TW"] },
        { rights_type: "AI_INPUT", rights_holder_id: "party/silkroad-studio", markets: ["SA", "TW"] },
      ],
    }, { correlationId: c }),
    ev(T.rights, A.proposal, "prop-game-overseas", "2026-08-06T10:00:00+08:00", "权利人批准场景替换", {
      proposal_id: "prop-game-overseas", role: "RIGHTS_HOLDER", decision: "APPROVED", rights_holder_id: "party/silkroad-studio",
    }, { correlationId: c }),
    ev(T.advisor, A.proposal, "prop-game-overseas", "2026-08-06T14:00:00+08:00", "文化顾问批准：替换未触碰不可变要素", {
      proposal_id: "prop-game-overseas", advisor_id: "advisor/karim-h", role: "CULTURAL_ADVISOR", decision: "APPROVED",
    }, { correlationId: c }),
    ev(T.market, A.proposal, "prop-game-overseas", "2026-08-07T09:00:00+08:00", "沙特市场负责人批准", {
      proposal_id: "prop-game-overseas", market: "SA", decision: "APPROVED", market_owner_id: "owner/mea",
    }, { correlationId: c }),
    ev(T.market, A.proposal, "prop-game-overseas", "2026-08-07T09:30:00+08:00", "繁中市场负责人批准", {
      proposal_id: "prop-game-overseas", market: "TW", decision: "APPROVED", market_owner_id: "owner/greater-china",
    }, { correlationId: c })
  );

  for (const [id, type, markets, until, elementRefs = []] of [
    ["grant-game-adapt", "ADAPTATION", ["SA", "TW"], "2027-08-31T23:59:59+08:00"],
    ["grant-game-dist", "DISTRIBUTION", ["SA", "TW"], "2027-08-31T23:59:59+08:00"],
    ["grant-game-cast", "CAST_LIKENESS", ["SA", "TW"], "2027-08-31T23:59:59+08:00"],
    ["grant-game-aiinput", "AI_INPUT", ["SA", "TW"], "2027-08-31T23:59:59+08:00", ["el-ribat-procession"]],
  ]) {
    out.push(ev(T.granted, A.grant, id, "2026-08-08T10:00:00+08:00", `游戏授权：${type}`, {
      grant: {
        rights_type: type,
        grantee_team_id: "team-game-overseas",
        markets,
        element_refs: elementRefs,
        valid_from: "2026-08-01T00:00:00+08:00",
        valid_until: until,
        status: "GRANTED",
      },
    }, { correlationId: c }));
  }

  out.push(
    ev(T.contribution, A.term, "term-footage-linxiaoman", "2026-08-10T11:00:00+08:00", "年轻创作者林小满海港空镜：单独署名与分账", {
      term: {
        contributor_id: "person/lin-xiaoman",
        contributor_type: "INDIVIDUAL",
        emerging_creator: true,
        kind: "FOOTAGE",
        asset_refs: ["asset-footage-kaohsiung"],
        credit: { individual: true, credit_name: "林小满", credit_role: "海港空镜摄影" },
        compensation: { model: "REVENUE_PERCENT", value: 1.5, currency: "TWD" },
      },
    }, { correlationId: c }),
    ev(T.ai, A.asset, "asset-ai-bg-souq", "2026-08-10T15:00:00+08:00", "登记 AI 巴扎背景资产：输入许可与工具版本", {
      asset: {
        kind: "IMAGE",
        tool: { name: "NuwaCanvas", version: "3.2.1", model_version: "nuwa-img-7.4" },
        input_grants: [{ grant_id: "grant-game-aiinput", source_ref: "el-ribat-procession" }],
        prompt_ref: "prompt/bazaar-opening-v12",
      },
    }, { correlationId: c }),
    ev(T.aiRevision, A.asset, "asset-ai-bg-souq", "2026-08-12T10:00:00+08:00", "记录美术指导的人工修订（两轮）", {
      asset_id: "asset-ai-bg-souq",
      human_revision: { revised_by: "person/zhao-yi", revision_count: 2, summary: "去除疑似宗教符号，统一光影与角色原画风格" },
    }, { correlationId: c, causationId: "asset-ai-bg-souq" })
  );

  releaseFlow(out, {
    correlation: c,
    versions: [
      { id: "ver-game-sa", market: "SA", hash: "sha256:game-sa-9f3a2c", ratingCode: "PG", cert: "sa-gc-2026-0911" },
      { id: "ver-game-tw", market: "TW", hash: "sha256:game-tw-71bd04", ratingCode: "6+", cert: "tw-rating-2026-0887" },
    ],
    proposalId: "prop-game-overseas",
    teamId: "team-game-overseas",
    list: { id: "list-2026-09-mea", market: "SA", at: "2026-09-18T10:00:00+08:00" },
    lists: [
      { id: "list-2026-09-mea", market: "SA", versionIds: ["ver-game-sa"] },
      { id: "list-2026-09-greater-china", market: "TW", versionIds: ["ver-game-tw"] },
    ],
    releaseAt: "2026-09-20T10:00:00+08:00",
  });

  // 沙特分级在发行后被暂停：评级闸门立即失败，版本被阻断并撤出发行清单。
  out.push(
    ev(T.ratingChanged, A.rating, "rating-game-sa-1", "2026-10-10T09:00:00+08:00", "沙特分级机构暂停该版本分级，待复审", {
      version_id: "ver-game-sa", market: "SA", change_type: "SUSPENDED", effective_at: "2026-10-10T00:00:00+08:00",
    }, { correlationId: c }),
    ev(T.block, A.version, "ver-game-sa", "2026-10-10T09:30:00+08:00", "分级暂停：阻断沙特版，复审通过前不得发行", {
      version_id: "ver-game-sa", gate: "RATING", reasons: ["当地分级被 SUSPENDED，证书 sa-gc-2026-0911 失效"],
    }, { correlationId: c })
  );

  // 繁中版年轻创作者的投放与结算台账。
  out.push(
    ev(T.usage, A.ledger, "ledger-term-footage-linxiaoman", "2026-10-01T08:00:00+08:00", "记录 9 月繁中版投放与收入", {
      term_id: "term-footage-linxiaoman", version_id: "ver-game-tw", period: "2026-09",
      usage: { platform_views: 1_840_000 }, revenue: { amount: 120000, currency: "TWD" },
    }, { correlationId: c }),
    ev(T.settle, A.ledger, "ledger-term-footage-linxiaoman", "2026-10-02T10:00:00+08:00", "按 1.5% 结算林小满 9 月分账", {
      term_id: "term-footage-linxiaoman", period: "2026-09", amount: 1800, currency: "TWD", status: "PAID",
    }, { correlationId: c })
  );
  return out;
}

function drama() {
  const c = CORR.drama;
  const out = [];

  // 繁中版：保留国内叙事，仅做译写——直接通过。
  out.push(
    ev(T.propose, A.proposal, "prop-drama-tw", "2026-08-05T13:00:00+08:00", "短剧繁中版：保留原叙事与人物关系，繁体译写", {
      source_ip_id: "ip-changan-courier",
      team_id: "team-drama-studio",
      kind: "TRANSLATION",
      target_markets: ["TW"],
      target_audience: "25-44 岁繁体中文短剧观众",
      change_targets: [
        { target_type: "cultural_element", target_ref: "el-mentor-code", treatment: "TRANSLATED", element_refs: ["el-mentor-code"], rationale: "师门关系原样保留，仅做语体本地化" },
      ],
      triggered_authorizations: [
        { rights_type: "ADAPTATION", rights_holder_id: "party/changan-media", markets: ["TW"] },
        { rights_type: "DISTRIBUTION", rights_holder_id: "party/changan-media", markets: ["TW"] },
      ],
    }, { correlationId: c })
  );
  decideAll(out, "prop-drama-tw", c, { markets: ["TW"], rightsHolder: "party/changan-media", advisor: "advisor/zhou-r" });
  dramaGrants(out, "grant-drama-tw", "team-drama-studio", ["TW"], "2026-08-08T11:00:00+08:00", c);
  releaseFlow(out, {
    correlation: c,
    versions: [{ id: "ver-drama-tw", market: "TW", hash: "sha256:drama-tw-a81e", ratingCode: "6+", cert: "tw-rating-2026-0902" }],
    proposalId: "prop-drama-tw",
    teamId: "team-drama-studio",
    lists: [{ id: "list-2026-09-greater-china", market: "TW", versionIds: ["ver-drama-tw"] }],
    releaseAt: "2026-09-20T10:05:00+08:00",
  });

  // 美版 v1：重写人物关系（把师徒改成情侣线）——触碰不可变要素。
  out.push(
    ev(T.propose, A.proposal, "prop-drama-us", "2026-08-05T15:00:00+08:00", "短剧美版 v1：重写人物关系为情侣主线", {
      source_ip_id: "ip-changan-courier",
      team_id: "team-drama-studio",
      kind: "RELATIONSHIP_REWRITE",
      target_markets: ["US"],
      target_audience: "18-34 岁北美流媒体观众",
      change_targets: [
        {
          target_type: "character_relationship",
          target_ref: "rel-master-disciple",
          treatment: "REPLACED",
          element_refs: ["el-mentor-code"],
          rationale: "北美受众调研显示情侣主线转化更高，将师徒关系改写为同龄恋人",
        },
        { target_type: "material", target_ref: "asset-drama-us-subtitles", treatment: "TRANSLATED", rationale: "英文字幕随关系改写重译" },
      ],
      triggered_authorizations: [
        { rights_type: "ADAPTATION", rights_holder_id: "party/changan-media", markets: ["US"] },
        { rights_type: "DISTRIBUTION", rights_holder_id: "party/changan-media", markets: ["US"] },
      ],
    }, { correlationId: c }),
    ev(T.rights, A.proposal, "prop-drama-us", "2026-08-06T11:00:00+08:00", "权利人 v1 批准（后被文化边界否决覆盖）", {
      proposal_id: "prop-drama-us", role: "RIGHTS_HOLDER", decision: "APPROVED", rights_holder_id: "party/changan-media",
    }, { correlationId: c }),
    ev(T.objection, A.review, "review-drama-us-v1", "2026-08-06T16:00:00+08:00", "文化顾问异议：师徒关系属禁用改写范围", {
      proposal_id: "prop-drama-us", advisor_id: "advisor/zhou-r", objection_kind: "PROHIBITED_ELEMENT",
      element_refs: ["el-mentor-code"], asserts_prohibited: true,
      basis: "边界登记明确师门伦理 IMMUTABLE，关系实质改写落入禁用范围；多数意见不能覆盖",
    }, { correlationId: c }),
    ev(T.advisor, A.proposal, "prop-drama-us", "2026-08-06T16:05:00+08:00", "文化顾问行使否决：禁用范围不被多数意见覆盖", {
      proposal_id: "prop-drama-us", advisor_id: "advisor/zhou-r", role: "CULTURAL_ADVISOR", decision: "VETO",
    }, { correlationId: c }),
    ev(T.market, A.proposal, "prop-drama-us", "2026-08-07T10:00:00+08:00", "北美市场负责人 v1 批准（不构成放行）", {
      proposal_id: "prop-drama-us", market: "US", decision: "APPROVED", market_owner_id: "owner/nam",
    }, { correlationId: c }),
    ev(T.freeze, A.version, "ver-drama-us-v1", "2026-08-12T10:00:00+08:00", "冻结美版 v1（后被阻断）", {
      proposal_id: "prop-drama-us", market: "US", content_hash: "sha256:drama-us-v1-000000",
    }, { correlationId: c }),
    ev(T.block, A.version, "ver-drama-us-v1", "2026-08-14T10:00:00+08:00", "文化边界闸门失败：否决优先于权利人与市场的赞成多数", {
      version_id: "ver-drama-us-v1", gate: "CULTURAL_BOUNDARY",
      reasons: ["不可变要素「师门伦理」不允许 REPLACED", "文化顾问 advisor/zhou-r 对 el-mentor-code 提出禁用异议"],
    }, { correlationId: c }),

    // 美版 v2：保留师徒关系实质，改为语言层面的译写——不同地区形成合法不同版本。
    ev(T.revise, A.proposal, "prop-drama-us", "2026-08-18T11:00:00+08:00", "美版 v2：恢复师徒主线，仅重写台词与字幕的本地化表达", {
      source_ip_id: "ip-changan-courier",
      team_id: "team-drama-studio",
      kind: "TRANSLATION",
      target_markets: ["US"],
      target_audience: "18-34 岁北美流媒体观众",
      change_targets: [
        { target_type: "cultural_element", target_ref: "el-mentor-code", treatment: "TRANSLATED", element_refs: ["el-mentor-code"], rationale: "师门关系实质保留，称谓与台词做英文语境译写" },
        { target_type: "material", target_ref: "asset-drama-us-subtitles", treatment: "TRANSLATED", rationale: "按恢复后的关系重译字幕" },
      ],
      triggered_authorizations: [
        { rights_type: "ADAPTATION", rights_holder_id: "party/changan-media", markets: ["US"] },
        { rights_type: "DISTRIBUTION", rights_holder_id: "party/changan-media", markets: ["US"] },
      ],
    }, { correlationId: c }),
    ev(T.rights, A.proposal, "prop-drama-us", "2026-08-19T09:00:00+08:00", "权利人批准 v2", {
      proposal_id: "prop-drama-us", role: "RIGHTS_HOLDER", decision: "APPROVED", rights_holder_id: "party/changan-media",
    }, { correlationId: c }),
    ev(T.advisor, A.proposal, "prop-drama-us", "2026-08-19T10:00:00+08:00", "文化顾问批准 v2：仅语言译写，未越禁用范围", {
      proposal_id: "prop-drama-us", advisor_id: "advisor/zhou-r", role: "CULTURAL_ADVISOR", decision: "APPROVED",
    }, { correlationId: c }),
    ev(T.market, A.proposal, "prop-drama-us", "2026-08-19T11:00:00+08:00", "北美市场负责人批准 v2", {
      proposal_id: "prop-drama-us", market: "US", decision: "APPROVED", market_owner_id: "owner/nam",
    }, { correlationId: c })
  );
  dramaGrants(out, "grant-drama-us", "team-drama-studio", ["US"], "2026-08-20T10:00:00+08:00", c);

  out.push(
    ev(T.contribution, A.term, "term-translation-chenkeyu", "2026-08-21T10:00:00+08:00", "年轻译者陈可妤美版字幕：单独署名与分账", {
      term: {
        contributor_id: "person/chen-keyu",
        contributor_type: "INDIVIDUAL",
        emerging_creator: true,
        kind: "TRANSLATION",
        asset_refs: ["asset-drama-us-subtitles"],
        credit: { individual: true, credit_name: "Keyu Chen", credit_role: "英文字幕翻译" },
        compensation: { model: "REVENUE_PERCENT", value: 0.8, currency: "USD" },
      },
    }, { correlationId: c })
  );

  releaseFlow(out, {
    correlation: c,
    versions: [{ id: "ver-drama-us-v2", market: "US", hash: "sha256:drama-us-v2-c5f7", ratingCode: "TV-14", cert: "us-mpa-2026-4471" }],
    proposalId: "prop-drama-us",
    teamId: "team-drama-studio",
    lists: [{ id: "list-2026-09-nam", market: "US", versionIds: ["ver-drama-us-v2"] }],
    releaseAt: "2026-09-20T10:10:00+08:00",
  });

  out.push(
    ev(T.usage, A.ledger, "ledger-term-translation-chenkeyu", "2026-10-01T09:00:00+08:00", "记录 9 月美版投放与收入", {
      term_id: "term-translation-chenkeyu", version_id: "ver-drama-us-v2", period: "2026-09",
      usage: { streaming_minutes: 9_200_000 }, revenue: { amount: 260000, currency: "USD" },
    }, { correlationId: c }),
    ev(T.settle, A.ledger, "ledger-term-translation-chenkeyu", "2026-10-02T11:00:00+08:00", "按 0.8% 结算陈可妤 9 月分账", {
      term_id: "term-translation-chenkeyu", period: "2026-09", amount: 2080, currency: "USD", status: "PAID",
    }, { correlationId: c })
  );

  // 马来版：东南亚合作方在发行前退出——精确阻断其版本与访问，不影响其他团队。
  out.push(
    ev(T.propose, A.proposal, "prop-drama-my", "2026-08-22T10:00:00+08:00", "短剧马来语版：南星传媒本地化合作", {
      source_ip_id: "ip-changan-courier",
      team_id: "team-drama-sea",
      kind: "TRANSLATION",
      target_markets: ["MY"],
      target_audience: "马来语短剧观众",
      change_targets: [
        { target_type: "cultural_element", target_ref: "el-mentor-code", treatment: "TRANSLATED", element_refs: ["el-mentor-code"], rationale: "关系保留，马来语译写" },
      ],
      triggered_authorizations: [
        { rights_type: "ADAPTATION", rights_holder_id: "party/changan-media", markets: ["MY"] },
        { rights_type: "DISTRIBUTION", rights_holder_id: "party/changan-media", markets: ["MY"] },
      ],
    }, { correlationId: c })
  );
  decideAll(out, "prop-drama-my", c, { markets: ["MY"], rightsHolder: "party/changan-media", advisor: "advisor/zhou-r", at: "2026-08-22T14:00:00+08:00" });
  dramaGrants(out, "grant-drama-my", "team-drama-sea", ["MY"], "2026-08-24T10:00:00+08:00", c);
  out.push(
    ev(T.freeze, A.version, "ver-drama-my", "2026-09-10T10:00:00+08:00", "冻结马来语版（尚未发行）", {
      proposal_id: "prop-drama-my", market: "MY", content_hash: "sha256:drama-my-b2d9",
    }, { correlationId: c }),
    ev(T.exit, A.team, "team-drama-sea", "2026-09-28T17:00:00+08:00", "南星传媒退出合作，当日生效", {
      partner_id: "partner-sea-media", effective_at: "2026-09-28T17:00:00+08:00",
    }, { correlationId: c }),
    ev(T.revoke, A.grant, "grant-drama-my-adaptation", "2026-09-28T17:05:00+08:00", "合作方退出：收回其马来语改编授权", {
      grant_id: "grant-drama-my-adaptation", status: "REVOKED", reason: "合作方 partner-sea-media 退出", effective_at: "2026-09-28T17:05:00+08:00",
    }, { correlationId: c }),
    ev(T.revoke, A.grant, "grant-drama-my-distribution", "2026-09-28T17:06:00+08:00", "合作方退出：收回其马来语发行授权", {
      grant_id: "grant-drama-my-distribution", status: "REVOKED", reason: "合作方 partner-sea-media 退出", effective_at: "2026-09-28T17:06:00+08:00",
    }, { correlationId: c }),
    ev(T.access, A.team, "team-drama-sea", "2026-09-28T17:10:00+08:00", "精确收回南星传媒的素材库访问，阻断其未发行版本", {
      team_id: "team-drama-sea", trigger: "PARTNER_EXIT", effective_at: "2026-09-28T17:10:00+08:00",
      revocation_scope: { grant_ids: ["grant-drama-my-adaptation", "grant-drama-my-distribution"], version_ids: ["ver-drama-my"] },
    }, { correlationId: c }),
    ev(T.block, A.version, "ver-drama-my", "2026-09-28T17:15:00+08:00", "权利闸门失败：合作方退出，马来语版不得发行", {
      version_id: "ver-drama-my", gate: "RIGHTS", reasons: ["合作方团队 team-drama-sea 已退出", "ADAPTATION/DISTRIBUTION 授权已 REVOKED"],
    }, { correlationId: c })
  );
  return out;
}

function toy() {
  const c = CORR.toy;
  const out = [];

  // 欧盟越界：博物馆图像授权仅限 CN/KR。
  out.push(
    ev(T.propose, A.proposal, "prop-toy-eu", "2026-08-08T10:00:00+08:00", "潮玩欧盟版：申请把壁画神鸟形象延伸到德法市场", {
      source_ip_id: "ip-museum-auspicious-beast",
      team_id: "team-toy-design",
      kind: "MARKET_SCOPE_EXTENSION",
      target_markets: ["DE", "FR"],
      target_audience: "欧洲博物馆文创消费者",
      change_targets: [
        {
          target_type: "ip_market_scope",
          target_ref: "scope-museum-image",
          treatment: "MODIFIED",
          element_refs: ["el-mural-bird"],
          rationale: "认为「海外版可以改」即包含授权地域扩大，将神鸟盲盒铺货德法",
        },
      ],
      triggered_authorizations: [
        { rights_type: "MUSEUM_IMAGE", rights_holder_id: "party/northwest-museum", markets: ["DE", "FR"] },
        { rights_type: "MERCHANDISE", rights_holder_id: "party/northwest-museum", markets: ["DE", "FR"] },
      ],
    }, { correlationId: c }),
    ev(T.rights, A.proposal, "prop-toy-eu", "2026-08-09T09:00:00+08:00", "博物馆拒绝：图像授权不包含欧盟", {
      proposal_id: "prop-toy-eu", role: "RIGHTS_HOLDER", decision: "REJECTED", rights_holder_id: "party/northwest-museum",
    }, { correlationId: c }),
    ev(T.objection, A.review, "review-toy-eu", "2026-08-09T10:00:00+08:00", "文化顾问异议：超出限定市场即落入禁用范围", {
      proposal_id: "prop-toy-eu", advisor_id: "advisor/pei-w", objection_kind: "PROHIBITED_ELEMENT",
      element_refs: ["el-mural-bird"], asserts_prohibited: true,
      basis: "壁画神鸟为博物馆 LIMITED[CN,KR] 要素，德法不在授权市场，使用即违反禁用范围",
    }, { correlationId: c }),
    ev(T.advisor, A.proposal, "prop-toy-eu", "2026-08-09T10:05:00+08:00", "文化顾问否决欧盟延伸", {
      proposal_id: "prop-toy-eu", advisor_id: "advisor/pei-w", role: "CULTURAL_ADVISOR", decision: "VETO",
    }, { correlationId: c }),
    ev(T.market, A.proposal, "prop-toy-eu", "2026-08-09T15:00:00+08:00", "欧洲市场负责人要求先补授权", {
      proposal_id: "prop-toy-eu", market: "DE", decision: "CHANGES_REQUESTED", market_owner_id: "owner/eu",
    }, { correlationId: c }),
    ev(T.freeze, A.version, "ver-toy-eu", "2026-08-12T11:00:00+08:00", "冻结欧盟试产版（内部样机，后被阻断）", {
      proposal_id: "prop-toy-eu", market: "DE", content_hash: "sha256:toy-eu-deadbeef",
    }, { correlationId: c }),
    ev(T.block, A.version, "ver-toy-eu", "2026-08-13T09:00:00+08:00", "文化边界与权利双闸门失败：欧盟版禁止投产", {
      version_id: "ver-toy-eu", gate: "CULTURAL_BOUNDARY",
      reasons: ["要素「壁画神鸟」仅授权 CN、KR，不含 DE", "文化顾问 advisor/pei-w 提出禁用异议", "博物馆 MUSEUM_IMAGE/MERCHANDISE 授权缺失"],
    }, { correlationId: c })
  );

  // 韩国版：在授权市场内合法本地化。
  out.push(
    ev(T.propose, A.proposal, "prop-toy-kr", "2026-08-10T09:00:00+08:00", "潮玩韩国版：神鸟盲盒在授权市场内做设计本地化", {
      source_ip_id: "ip-museum-auspicious-beast",
      team_id: "team-toy-design",
      kind: "DESIGN",
      target_markets: ["KR"],
      target_audience: "20-35 岁韩国盲盒收藏者",
      change_targets: [
        { target_type: "cultural_element", target_ref: "el-mural-bird", treatment: "MODIFIED", element_refs: ["el-mural-bird"], rationale: "在授权市场内做色彩与比例的潮玩化设计，保留纹样与出处标注" },
        { target_type: "material", target_ref: "asset-toy-bird-figure", treatment: "RETAINED", rationale: "年轻设计师白若汐的原型雕刻" },
        { target_type: "material", target_ref: "asset-ai-toy-packaging", treatment: "RETAINED", rationale: "AI 辅助包装图，经人工修订" },
      ],
      triggered_authorizations: [
        { rights_type: "MUSEUM_IMAGE", rights_holder_id: "party/northwest-museum", markets: ["KR"], grant_ref: "grant-toy-museum-kr" },
        { rights_type: "MERCHANDISE", rights_holder_id: "party/northwest-museum", markets: ["KR"], grant_ref: "grant-toy-merch-kr" },
      ],
    }, { correlationId: c })
  );
  decideAll(out, "prop-toy-kr", c, { markets: ["KR"], rightsHolder: "party/northwest-museum", advisor: "advisor/pei-w", at: "2026-08-10T11:00:00+08:00" });

  out.push(
    ev(T.granted, A.grant, "grant-toy-museum-kr", "2026-08-11T10:00:00+08:00", "博物馆图像授权：仅韩国，2026-10-15 到期", {
      grant: {
        rights_type: "MUSEUM_IMAGE", grantee_team_id: "team-toy-design", markets: ["KR"], element_refs: ["el-mural-bird"],
        valid_from: "2026-08-01T00:00:00+08:00", valid_until: "2026-10-15T23:59:59+08:00", status: "GRANTED",
      },
    }, { correlationId: c }),
    ev(T.granted, A.grant, "grant-toy-merch-kr", "2026-08-11T10:05:00+08:00", "周边商品化授权：仅韩国，2026-10-15 到期", {
      grant: {
        rights_type: "MERCHANDISE", grantee_team_id: "team-toy-design", markets: ["KR"],
        valid_from: "2026-08-01T00:00:00+08:00", valid_until: "2026-10-15T23:59:59+08:00", status: "GRANTED",
      },
    }, { correlationId: c }),
    ev(T.contribution, A.term, "term-design-bairuoxi", "2026-08-12T14:00:00+08:00", "年轻设计师白若汐：原型雕刻单独署名与分账", {
      term: {
        contributor_id: "person/bai-ruoxi",
        contributor_type: "INDIVIDUAL",
        emerging_creator: true,
        kind: "DESIGN",
        asset_refs: ["asset-toy-bird-figure", "asset-ai-toy-packaging"],
        credit: { individual: true, credit_name: "白若汐 / Baek Seo-ah", credit_role: "原型设计" },
        compensation: { model: "REVENUE_PERCENT", value: 2.5, currency: "KRW" },
      },
    }, { correlationId: c }),
    ev(T.ai, A.asset, "asset-ai-toy-packaging", "2026-08-13T10:00:00+08:00", "登记 AI 包装图：输入许可限定博物馆 KR 图像授权", {
      asset: {
        kind: "IMAGE",
        tool: { name: "MuralDiffusion", version: "1.8.0", model_version: "murald-xl-2026-07" },
        input_grants: [{ grant_id: "grant-toy-museum-kr", source_ref: "el-mural-bird" }],
        prompt_ref: "prompt/bird-box-kr-v4",
      },
    }, { correlationId: c }),
    ev(T.aiRevision, A.asset, "asset-ai-toy-packaging", "2026-08-15T10:00:00+08:00", "白若汐人工修订三轮并补博物馆出处标注", {
      asset_id: "asset-ai-toy-packaging",
      human_revision: { revised_by: "person/bai-ruoxi", revision_count: 3, summary: "校正纹样配色、补出处与馆藏编号标注" },
    }, { correlationId: c, causationId: "asset-ai-toy-packaging" })
  );

  releaseFlow(out, {
    correlation: c,
    versions: [{ id: "ver-toy-kr", market: "KR", hash: "sha256:toy-kr-ee13", ratingCode: "ALL", cert: "kr-rb-2026-0773" }],
    proposalId: "prop-toy-kr",
    teamId: "team-toy-design",
    lists: [{ id: "list-2026-09-kr", market: "KR", versionIds: ["ver-toy-kr"] }],
    releaseAt: "2026-09-20T10:15:00+08:00",
  });

  out.push(
    ev(T.usage, A.ledger, "ledger-term-design-bairuoxi", "2026-10-01T10:00:00+08:00", "记录 9 月韩国版投放与销售额", {
      term_id: "term-design-bairuoxi", version_id: "ver-toy-kr", period: "2026-09",
      usage: { units_sold: 42000 }, revenue: { amount: 840_000_000, currency: "KRW" },
    }, { correlationId: c }),
    ev(T.settle, A.ledger, "ledger-term-design-bairuoxi", "2026-10-02T14:00:00+08:00", "按 2.5% 结算白若汐 9 月分账", {
      term_id: "term-design-bairuoxi", period: "2026-09", amount: 21_000_000, currency: "KRW", status: "PAID",
    }, { correlationId: c }),

    // 授权到期：韩国版自动撤出发行清单并阻断，精确到到期授权与受影响版本。
    ev(T.revoke, A.grant, "grant-toy-museum-kr", "2026-10-16T00:05:00+08:00", "博物馆图像授权到期", {
      grant_id: "grant-toy-museum-kr", status: "EXPIRED", reason: "授权有效期至 2026-10-15", effective_at: "2026-10-16T00:00:00+08:00",
    }, { correlationId: c }),
    ev(T.revoke, A.grant, "grant-toy-merch-kr", "2026-10-16T00:06:00+08:00", "周边授权到期", {
      grant_id: "grant-toy-merch-kr", status: "EXPIRED", reason: "授权有效期至 2026-10-15", effective_at: "2026-10-16T00:00:00+08:00",
    }, { correlationId: c }),
    ev(T.access, A.team, "team-toy-design", "2026-10-16T00:10:00+08:00", "权利到期：收回博物馆图像库访问", {
      team_id: "team-toy-design", trigger: "RIGHTS_EXPIRY", effective_at: "2026-10-16T00:10:00+08:00",
      revocation_scope: { grant_ids: ["grant-toy-museum-kr"], version_ids: ["ver-toy-kr"] },
    }, { correlationId: c }),
    ev(T.block, A.version, "ver-toy-kr", "2026-10-16T00:15:00+08:00", "权利闸门失败：授权到期，韩国版撤出发行清单", {
      version_id: "ver-toy-kr", gate: "RIGHTS", reasons: ["MUSEUM_IMAGE 授权 EXPIRED（2026-10-15）", "MERCHANDISE 授权 EXPIRED（2026-10-15）"],
    }, { correlationId: c })
  );
  return out;
}

/** 填充一套完整的「三方决定 → 冻结 → 证据 → 闸门 → 清单 → 发行」流程。 */
function releaseFlow(out, { correlation, versions, proposalId, teamId, lists, releaseAt }) {
  for (const version of versions) {
    out.push(
      ev(T.milestone, A.milestone, `ms-${version.id}-picture-lock`, "2026-08-25T10:00:00+08:00", `${version.market} 版画面锁定并通过验收`, {
        version_id: version.id, milestone: { name: "画面锁定", owner: teamId }, status: "ACCEPTED",
      }, { correlationId: correlation }),
      ev(T.freeze, A.version, version.id, "2026-08-26T10:00:00+08:00", `冻结 ${version.market} 市场版本`, {
        proposal_id: proposalId, market: version.market, content_hash: version.hash,
      }, { correlationId: correlation }),
      ev(T.delivery, A.version, version.id, "2026-09-05T10:00:00+08:00", `${version.market} 版交付校验通过`, {
        version_id: version.id, result: "PASSED",
        checks: ["母版哈希一致", "字幕/配音轨齐全", "授权水印与出处标注齐全", "禁用要素自动扫描通过"],
      }, { correlationId: correlation }),
      ev(T.rating, A.rating, `rating-${version.id}`, "2026-09-10T10:00:00+08:00", `${version.market} 版取得当地分级 ${version.ratingCode}`, {
        version_id: version.id, market: version.market, rating_code: version.ratingCode, certificate_ref: version.cert,
      }, { correlationId: correlation })
    );
    for (const gate of ["CULTURAL_BOUNDARY", "RIGHTS", "RATING", "DELIVERY"]) {
      out.push(ev(T.gate, A.clearance, `clr-${version.id}`, "2026-09-12T10:00:00+08:00", `${version.market} 版闸门评估：${gate} 通过`, {
        version_id: version.id, gate, status: "PASSED", evidence_event_ids: [],
      }, { correlationId: correlation }));
    }
    out.push(ev(T.clearance, A.clearance, `clr-${version.id}`, "2026-09-13T10:00:00+08:00", `${version.market} 版四道闸门全部通过，授予发行许可`, {
      version_id: version.id, gates: GATES_ALL_PASSED,
    }, { correlationId: correlation }));
  }

  const published = new Set();
  for (const list of lists) {
    if (published.has(list.market)) continue; // 同一清单可收录多个版本，只发布一次
    published.add(list.market);
    out.push(ev(T.list, A.list, list.id, "2026-09-18T10:00:00+08:00", `发布 ${list.market} 市场 9 月发行清单`, {
      market: list.market, version_ids: list.versionIds,
    }, { correlationId: correlation }));
  }
  for (const version of versions) {
    const list = lists.find((entry) => entry.market === version.market);
    out.push(ev(T.release, A.version, version.id, releaseAt, `${version.market} 版上线发行`, {
      version_id: version.id, market: version.market, release_list_id: list.id,
    }, { correlationId: correlation }));
  }
}

function decideAll(out, proposalId, correlation, { markets, rightsHolder, advisor, at = "2026-08-07T08:30:00+08:00" }) {
  // 所有决定时间沿用东八区墙钟，保持与事件流其余时间戳一致。
  const atMinutes = (offset) => {
    const d = new Date(Date.parse(at) + offset * 60_000 + 8 * 3600_000);
    return d.toISOString().slice(0, 19) + "+08:00";
  };
  out.push(ev(T.rights, A.proposal, proposalId, atMinutes(0), "权利人批准", {
    proposal_id: proposalId, role: "RIGHTS_HOLDER", decision: "APPROVED", rights_holder_id: rightsHolder,
  }, { correlationId: correlation }));
  out.push(ev(T.advisor, A.proposal, proposalId, atMinutes(15), "文化顾问批准", {
    proposal_id: proposalId, advisor_id: advisor, role: "CULTURAL_ADVISOR", decision: "APPROVED",
  }, { correlationId: correlation }));
  markets.forEach((market, i) => {
    out.push(ev(T.market, A.proposal, proposalId, atMinutes(30 + i * 15), `${market} 市场负责人批准`, {
      proposal_id: proposalId, market, decision: "APPROVED", market_owner_id: `owner/${market.toLowerCase()}`,
    }, { correlationId: correlation }));
  });
}

function dramaGrants(out, prefix, teamId, markets, at, correlation) {
  out.push(
    ev(T.granted, A.grant, `${prefix}-adaptation`, at, "改编授权", {
      grant: { rights_type: "ADAPTATION", grantee_team_id: teamId, markets, valid_from: "2026-08-01T00:00:00+08:00", valid_until: "2027-07-31T23:59:59+08:00", status: "GRANTED" },
    }, { correlationId: correlation }),
    ev(T.granted, A.grant, `${prefix}-distribution`, at, "发行授权", {
      grant: { rights_type: "DISTRIBUTION", grantee_team_id: teamId, markets, valid_from: "2026-08-01T00:00:00+08:00", valid_until: "2027-07-31T23:59:59+08:00", status: "GRANTED" },
    }, { correlationId: correlation })
  );
}

/** 测试与台账核对时直接引用的稳定标识 */
export const refs = Object.freeze({
  versions: {
    gameSa: "ver-game-sa", gameTw: "ver-game-tw",
    dramaTw: "ver-drama-tw", dramaUsV1: "ver-drama-us-v1", dramaUsV2: "ver-drama-us-v2", dramaMy: "ver-drama-my",
    toyKr: "ver-toy-kr", toyEu: "ver-toy-eu",
  },
  terms: { footage: "term-footage-linxiaoman", translation: "term-translation-chenkeyu", design: "term-design-bairuoxi" },
  teams: { dramaSea: "team-drama-sea", toyDesign: "team-toy-design" },
  grants: { toyMuseumKr: "grant-toy-museum-kr", toyMerchKr: "grant-toy-merch-kr" },
});

export default events;
