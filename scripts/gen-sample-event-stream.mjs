/**
 * 生成 data/event-stream.json —— 三个团队（丝路游戏 / 短剧 / 文物潮玩）
 * 在同一套合议契约下协作的完整事件流。
 *
 * 设计意图：
 *   · 事件按 occurred_at 全局排列，版本号由生成器按各聚合出现次序自动编排；
 *   · 生成后立即用 validateEventStream 自检，非法流不得落盘——样例即“活的契约”；
 *   · 负向情形（越权市场发行、多数覆盖硬否决、到期仍结算等）不写入本样例，
 *     由 tests/contract.test.js 基于本流变体构造。
 *
 * 运行：node scripts/gen-sample-event-stream.mjs
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { AGGREGATE_TYPES, EVENT_TYPES } from "../src/domain.js";
import { validateEventStream } from "../src/validator.js";

const A = AGGREGATE_TYPES;
const E = EVENT_TYPES;

const stream = [];

function emit(type, aggregateType, aggregateId, at, summary, payload) {
  // 暂存为“未定稿”事件；版本号与 event_id 在全局时间排序后统一编排，
  // 保证“事件按 occurred_at 排列、同一聚合 version 从 1 单调递增”。
  stream.push({
    event_type: type,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    occurred_at: at,
    summary,
    payload,
  });
}

// 给同一改写登记三类角色的独立决定。
function panel(adaptationId, decisions) {
  const panelId = `panel-${adaptationId}`;
  for (const d of decisions) {
    emit(E.PANEL_DECISION_RECORDED, A.REVIEW_PANEL, panelId, d.at, d.summary, {
      adaptation_id: adaptationId,
      role: d.role,
      decision: d.decision,
      decided_by: d.decided_by,
      rationale: d.rationale,
      prohibition_ref: d.prohibition_ref,
    });
  }
}

const ROLE = {
  RH: "rights_holder",
  CA: "cultural_advisor",
  MO: "market_owner",
};

// -------------------------------------------------------------------------
// 2026-10-05 登记三个原始 IP 的不可变文化要素与禁用范围
// -------------------------------------------------------------------------

emit(E.BOUNDARY_REGISTERED, A.SOURCE_IP, "ip-game-silkroad", "2026-10-05T09:00:00+08:00",
  "丝路题材游戏《驿路长风》：登记不可变文化要素与禁用范围", {
    ip_name: "驿路长风",
    immutable_elements: [
      { element_id: "IE-SR-01", name: "丝路商道驿站网络与多语书信传统", rule: "海外版可替换场景外观，但驿站接力、书信转译的叙事结构不得删除" },
      { element_id: "IE-SR-02", name: "宗教性仪式仪轨", rule: "涉及真实宗教仪式的仪轨顺序、朝向与祝祷词须保持尊重性呈现，不得戏谑化" },
    ],
    prohibitions: [
      { prohibition_id: "P-SR-01", statement: "真实宗教性仪式场景不得改造为娱乐化战斗或抽卡关卡" },
      { prohibition_id: "P-SR-02", statement: "朝圣终点空间不得替换为商业打卡地标或品牌植入场景" },
    ],
  });

emit(E.BOUNDARY_REGISTERED, A.SOURCE_IP, "ip-drama-homeward", "2026-10-05T09:05:00+08:00",
  "现实题材短剧《归家长路》：登记不可变文化要素与禁用范围", {
    ip_name: "归家长路",
    immutable_elements: [
      { element_id: "IE-DR-01", name: "寻亲回家的叙事主线与结局", rule: "海外版可调整次要人物关系与对白节奏，但主线、时代背景与团圆结局不得改变" },
    ],
    prohibitions: [
      { prohibition_id: "P-DR-01", statement: "不得将寻亲主线改写为浪漫爱情主线" },
      { prohibition_id: "P-DR-02", statement: "不得美化或同情化人口贩卖相关人物" },
    ],
  });

emit(E.BOUNDARY_REGISTERED, A.SOURCE_IP, "ip-museum-cranes", "2026-10-05T09:10:00+08:00",
  "院藏《瑞鹤图》潮玩衍生：登记文物要素与授权边界", {
    ip_name: "瑞鹤图潮玩衍生",
    immutable_elements: [
      { element_id: "IE-MU-01", name: "宋徽宗题签与群鹤构图", rule: "题签文字、群鹤二十只的数量与祥云朝向为不可变要素，须完整呈现" },
      { element_id: "IE-MU-02", name: "绢本石青设色", rule: "海外版本可调整材质工艺，但核心色彩识别不得反相或污名化处理" },
    ],
    prohibitions: [
      { prohibition_id: "P-MU-01", statement: "不得遮挡、裁切或戏仿题签" },
      { prohibition_id: "P-MU-02", statement: "文物高清数字件不得在博物馆授权市场之外使用" },
    ],
  });

// -------------------------------------------------------------------------
// 2026-10-06 登记各项权利：地域/渠道/有效期缺一不可
// -------------------------------------------------------------------------

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-game-ip", "2026-10-06T10:00:00+08:00",
  "游戏 IP 方授权：覆盖沙特、马来西亚等市场的主机与移动端", {
    grant_kind: "ip_holder", granted_by: "驿路长风工作室",
    markets: ["SA", "MY", "AE"], channels: ["console", "mobile"],
    valid_from: "2026-01-01T00:00:00+08:00", valid_until: "2028-01-01T00:00:00+08:00",
    status: "active",
  });

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-drama-ip", "2026-10-06T10:05:00+08:00",
  "短剧 IP 方授权：美国、韩国流媒体改编", {
    grant_kind: "ip_holder", granted_by: "归家长路制片有限公司",
    markets: ["US", "KR"], channels: ["streaming"],
    valid_from: "2026-09-01T00:00:00+08:00", valid_until: "2028-09-01T00:00:00+08:00",
    status: "active",
  });

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-talent-drama", "2026-10-06T10:10:00+08:00",
  "主演肖像与配音授权：美韩市场", {
    grant_kind: "talent", granted_by: "主演经纪人团队",
    markets: ["US", "KR"], channels: ["streaming"],
    valid_from: "2026-09-01T00:00:00+08:00", valid_until: "2028-09-01T00:00:00+08:00",
    status: "active",
  });

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-museum-cn", "2026-10-06T10:15:00+08:00",
  "博物馆授权：瑞鹤图数字件仅限中国大陆市场（跨境授权须另签）", {
    grant_kind: "museum", granted_by: "某省博物馆 文创授权处",
    markets: ["CN"], channels: ["retail", "ecommerce"],
    valid_from: "2026-01-01T00:00:00+08:00", valid_until: "2027-01-01T00:00:00+08:00",
    status: "active", scope_note: "仅限中国大陆；不得据此外推其他地区的衍生权利",
  });

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-toy-ip", "2026-10-06T10:20:00+08:00",
  "潮玩出品方自有权利：中国与阿联酋", {
    grant_kind: "ip_holder", granted_by: "瑞鹤潮玩（东莞）有限公司",
    markets: ["CN", "AE"], channels: ["retail", "ecommerce"],
    valid_from: "2026-09-01T00:00:00+08:00", valid_until: "2028-09-01T00:00:00+08:00",
    status: "active",
  });

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-partner-kr-dub", "2026-10-06T10:25:00+08:00",
  "韩国合作配音工作室：韩语配音音轨独占授权", {
    grant_kind: "material", granted_by: "韩声配音工作室（合作方）",
    markets: ["KR"], channels: ["streaming"],
    valid_from: "2026-09-15T00:00:00+08:00", valid_until: "2028-02-01T00:00:00+08:00",
    status: "active",
  });

// -------------------------------------------------------------------------
// 2026-10-08 各团队提交改写说明：每条必须写清变更对象、目标受众、触发的授权
// -------------------------------------------------------------------------

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-game-scene-sa", "2026-10-08T11:00:00+03:00",
  "沙特版：将宗教性仪式战斗关卡整体替换为中性商队集市护送关", {
    change_target: { type: "scene", ref: "scene-0423-仪式战斗关" },
    target_audience: { market: "SA", languages: ["ar"], rating_intent: "GCAM 全年龄向", channels: ["console", "mobile"] },
    triggered_clearances: ["ip_holder", "cultural_review", "rating_board"],
    proposed_by: "丝路游戏中东北非发行组",
    change_summary: "删除战斗化演出，替换为集市护送与多语书信解谜，保留驿站叙事结构",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-game-scene-my", "2026-10-08T11:05:00+08:00",
  "马来西亚版：同一关改为驿站对话与物资调配玩法（与沙特版可合法不同）", {
    change_target: { type: "scene", ref: "scene-0423-仪式战斗关" },
    target_audience: { market: "MY", languages: ["ms", "en"], rating_intent: "LPF P12", channels: ["console", "mobile"] },
    triggered_clearances: ["ip_holder", "cultural_review", "rating_board"],
    proposed_by: "丝路游戏东南亚发行组",
    change_summary: "以马来本地玩家熟悉的码头驿站对话承载同一叙事节点，玩法为物资调配",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-game-veto-bad", "2026-10-08T11:10:00+04:00",
  "被否提案：拟把朝圣终点改为品牌赞助打卡广场", {
    change_target: { type: "narrative", ref: "node-0701-朝圣终点" },
    target_audience: { market: "AE", languages: ["ar", "en"], channels: ["console", "mobile"] },
    triggered_clearances: ["ip_holder", "cultural_review", "rating_board"],
    proposed_by: "某商业合作外包组",
    change_summary: "终点空间替换为赞助商打卡广场以承接广告植入",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-drama-relation-us", "2026-10-08T14:00:00+08:00",
  "美国版：保留国内寻亲叙事主线，重写次要人物关系以贴近当地观众", {
    change_target: { type: "character_relation", ref: "rel-lead-02-邻里线" },
    target_audience: { market: "US", languages: ["en"], rating_intent: "TV-14", channels: ["streaming"] },
    triggered_clearances: ["ip_holder", "talent", "cultural_review", "rating_board"],
    proposed_by: "短剧北美译写组",
    change_summary: "将松散邻里关系改写为寄养家庭支持网络；主线、结局与时代背景不变",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-drama-relation-kr", "2026-10-08T14:05:00+08:00",
  "韩国版：人物关系改写为社区会馆照护网络，韩语配音", {
    change_target: { type: "character_relation", ref: "rel-lead-02-邻里线" },
    target_audience: { market: "KR", languages: ["ko"], rating_intent: "15+", channels: ["streaming"] },
    triggered_clearances: ["ip_holder", "talent", "material", "cultural_review", "rating_board"],
    proposed_by: "短剧韩国合作组",
    change_summary: "以韩国会馆文化重写邻里支持线，使用合作工作室配音音轨",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-toy-design-cn", "2026-10-08T15:00:00+08:00",
  "国内版潮玩：瑞鹤图立体便签摆件，完整保留题签与群鹤构图", {
    change_target: { type: "design", ref: "sku-crane-notes-cn" },
    target_audience: { market: "CN", languages: ["zh"], channels: ["retail", "ecommerce"] },
    triggered_clearances: ["museum", "ip_holder", "cultural_review"],
    proposed_by: "瑞鹤潮玩设计中心",
    change_summary: "石青绢本色立体便签，题签独立金属件不裁切",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-toy-design-ae-bad", "2026-10-08T15:05:00+08:00",
  "越权提案：凭国内授权拟在阿联酋上架同款（博物馆授权仅限 CN）", {
    change_target: { type: "asset_usage", ref: "sku-crane-notes-cn → AE" },
    target_audience: { market: "AE", languages: ["ar", "en"], channels: ["retail", "ecommerce"] },
    triggered_clearances: ["museum", "cultural_review"],
    proposed_by: "海外渠道拓展组（初版）",
    change_summary: "未另签跨境授权，直接以 CN 授权物料上架海湾市场",
  });

// -------------------------------------------------------------------------
// 2026-10-10..13 权利人、文化顾问、市场负责人分别独立决定
// -------------------------------------------------------------------------

panel("adapt-game-scene-sa", [
  { at: "2026-10-10T10:00:00+03:00", role: ROLE.CA, decision: "approved", decided_by: "文化顾问 马和丰",
    summary: "文化顾问同意沙特版场景替换：仪轨元素整体移除而非戏谑化",
    rationale: "替换方案不裁剪、不嘲讽任何宗教元素，驿站结构保留，符合 P-SR-01" },
  { at: "2026-10-10T15:00:00+08:00", role: ROLE.RH, decision: "approved", decided_by: "驿路长风工作室 权",
    summary: "IP 权利人同意沙特版改写", rationale: "在授权地域与有效期内，且不触碰不可变要素" },
  { at: "2026-10-11T09:00:00+04:00", role: ROLE.MO, decision: "approved", decided_by: "中东北非市场负责人",
    summary: "市场负责人同意沙特版发行安排", rationale: "全年龄向定位与渠道排期匹配" },
]);

panel("adapt-game-scene-my", [
  { at: "2026-10-10T10:30:00+08:00", role: ROLE.CA, decision: "approved", decided_by: "文化顾问 马和丰",
    summary: "文化顾问同意马来西亚版对话玩法", rationale: "与沙特版呈现不同，但各自合法且均不触碰禁用范围" },
  { at: "2026-10-10T15:05:00+08:00", role: ROLE.RH, decision: "approved", decided_by: "驿路长风工作室 权",
    summary: "IP 权利人同意马来西亚版", rationale: "MY 在授权地域内" },
  { at: "2026-10-11T10:00:00+08:00", role: ROLE.MO, decision: "approved", decided_by: "东南亚市场负责人",
    summary: "市场负责人同意马来西亚版", rationale: "P12 分级与码头驿站玩法适配本地渠道" },
]);

panel("adapt-game-veto-bad", [
  { at: "2026-10-12T10:00:00+04:00", role: ROLE.RH, decision: "approved", decided_by: "驿路长风工作室 商务",
    summary: "权利方一度同意赞助方案", rationale: "商务收益可观（但无权覆盖禁用范围）" },
  { at: "2026-10-12T11:00:00+04:00", role: ROLE.MO, decision: "approved", decided_by: "中东北非市场负责人",
    summary: "市场方同意赞助方案", rationale: "赞助费可观（多数意见同样不能覆盖禁用范围）" },
  { at: "2026-10-13T09:00:00+08:00", role: ROLE.CA, decision: "hard_veto", decided_by: "文化顾问 马和丰",
    summary: "文化顾问强制否决：朝圣终点商业植入触碰禁用范围",
    rationale: "违反 P-SR-02；禁用范围不接受多数表决覆盖，亦不得换皮重提", prohibition_ref: "P-SR-02" },
]);

panel("adapt-drama-relation-us", [
  { at: "2026-10-10T16:00:00+08:00", role: ROLE.RH, decision: "approved", decided_by: "归家长路制片 权",
    summary: "权利方同意美版人物关系改写", rationale: "寻亲主线与团圆结局不变，符合 P-DR-01" },
  { at: "2026-10-11T09:30:00+08:00", role: ROLE.CA, decision: "approved", decided_by: "文化顾问 岑之榕",
    summary: "文化顾问确认国内叙事得以保留", rationale: "仅重写次要人物关系，时代背景与价值取向未改" },
  { at: "2026-10-11T10:30:00-04:00", role: ROLE.MO, decision: "approved", decided_by: "北美市场负责人",
    summary: "市场方同意美版译写方向", rationale: "寄养家庭线在试映中理解度更高" },
]);

panel("adapt-drama-relation-kr", [
  { at: "2026-10-10T16:05:00+08:00", role: ROLE.RH, decision: "approved", decided_by: "归家长路制片 权",
    summary: "权利方同意韩版关系改写", rationale: "KR 在授权地域内" },
  { at: "2026-10-11T09:35:00+08:00", role: ROLE.CA, decision: "approved", decided_by: "文化顾问 岑之榕",
    summary: "文化顾问同意会馆照护线", rationale: "不触碰不可变要素" },
  { at: "2026-10-11T11:00:00+09:00", role: ROLE.MO, decision: "approved", decided_by: "韩国市场负责人",
    summary: "市场方同意韩版", rationale: "15+ 定位与流媒体渠道匹配" },
]);

panel("adapt-toy-design-cn", [
  { at: "2026-10-10T17:00:00+08:00", role: ROLE.RH, decision: "approved", decided_by: "某省博物馆文创授权处",
    summary: "博物馆同意国内版设计", rationale: "在 CN 授权范围内，题签完整" },
  { at: "2026-10-11T09:00:00+08:00", role: ROLE.CA, decision: "approved", decided_by: "文创顾问 怀瑾",
    summary: "文化顾问同意国内版工艺", rationale: "群鹤数量、朝向与设色识别完整" },
  { at: "2026-10-11T14:00:00+08:00", role: ROLE.MO, decision: "approved", decided_by: "国内渠道负责人",
    summary: "市场方同意国内版上架", rationale: "零售与电商渠道物料齐备" },
]);
// 注意：adapt-toy-design-ae-bad 未进入合议——权利闸口直接判失败，见 12-01 闸口事件。

// -------------------------------------------------------------------------
// 2026-10-14 AI 资产登记（输入许可 / 工具版本 / 人工修订）与年轻创作者条款
// -------------------------------------------------------------------------

emit(E.AI_ASSET_REGISTERED, A.AI_ASSET, "ai-game-bg-sa", "2026-10-14T10:00:00+08:00",
  "沙特版集市背景 AI 生成镜头：登记来源与人工修订", {
    asset_kind: "footage", created_by: "美术技术组",
    input_permissions: [
      { ref: "自有场景概念画库 lib-scene-bg#44", grant_id: "grant-game-ip", scope: "全球数字版本背景生成" },
    ],
    tool: { name: "FrameForge Studio", version: "3.2.1", provider: "帧造科技" },
    human_revision: { revised_by: "李昂（青年创作计划）", at: "2026-10-14T18:00:00+08:00", description: "重绘阿语招牌书法与光影，去除生成式文字错误" },
  });

emit(E.AI_ASSET_REGISTERED, A.AI_ASSET, "ai-drama-trans-us", "2026-10-14T10:30:00+08:00",
  "美版译写 AI 初稿：剧本使用经授权，人工逐场重写", {
    asset_kind: "translation", created_by: "北美译写组",
    input_permissions: [
      { ref: "《归家长路》中文剧本 v3", grant_id: "grant-drama-ip", scope: "英译译写辅助，不得对外公开原文" },
    ],
    tool: { name: "LinguaCraft", version: "1.8.0", provider: "言工社" },
    human_revision: { revised_by: "陈然（青年译写者）", at: "2026-10-14T20:00:00+08:00", description: "逐场重写寄养家庭线对白，统一南方小城意象" },
  });

emit(E.AI_ASSET_REGISTERED, A.AI_ASSET, "ai-toy-design-cn", "2026-10-14T11:00:00+08:00",
  "国内版潮玩 AI 辅助造型：文物数字件仅限 CN 授权范围", {
    asset_kind: "design", created_by: "瑞鹤潮玩设计中心",
    input_permissions: [
      { ref: "瑞鹤图高清数字件 artifact-crane-img", grant_id: "grant-museum-cn", scope: "CN 潮玩衍生设计，禁止输出到跨境物料库" },
    ],
    tool: { name: "FormaMaker", version: "5.0.4", provider: "器形智能" },
    human_revision: { revised_by: "结构工程师 何鸣", at: "2026-10-14T17:30:00+08:00", description: "修正鹤足受力结构与金属题签嵌位" },
  });

emit(E.CONTRIBUTION_ACCEPTED, A.CONTRIBUTOR_TERM, "term-liang", "2026-10-14T15:00:00+08:00",
  "青年创作者李昂：沙特版镜头修订单独署名分账", {
    contributor_id: "u-liang", contributor_name: "李昂", contribution_kind: "footage",
    attribution: "片尾独立署名：美术修订摄影 李昂（青年创作计划）",
    revenue_share: { basis: "沙特版净收入分成", rate: 0.03, currency: "USD" },
    adaptation_ids: ["adapt-game-scene-sa"],
  });

emit(E.CONTRIBUTION_ACCEPTED, A.CONTRIBUTOR_TERM, "term-xiaolin", "2026-10-14T15:10:00+08:00",
  "青年创作者林晓：美版补拍镜头单独署名分账", {
    contributor_id: "u-xiaolin", contributor_name: "林晓", contribution_kind: "footage",
    attribution: "片尾独立署名：B组摄影 林晓（青年创作计划）",
    revenue_share: { basis: "美国版净收入分成", rate: 0.04, currency: "USD" },
    adaptation_ids: ["adapt-drama-relation-us"],
  });

emit(E.CONTRIBUTION_ACCEPTED, A.CONTRIBUTOR_TERM, "term-chenran", "2026-10-14T15:20:00+08:00",
  "青年译写者陈然：美版译写单独署名分账", {
    contributor_id: "u-chenran", contributor_name: "陈然", contribution_kind: "transcreation",
    attribution: "片头字幕独立署名：译写 陈然",
    revenue_share: { basis: "美国版净收入分成", rate: 0.025, currency: "USD" },
    adaptation_ids: ["adapt-drama-relation-us"],
  });

// -------------------------------------------------------------------------
// 2026-10-16 组装六个市场版本
// -------------------------------------------------------------------------

const builds = [
  ["build-game-sa", "2026-10-16T09:00:00+03:00", "SA", "GCAM 全年龄向", ["adapt-game-scene-sa"], ["ai-game-bg-sa"], ["term-liang"], "中东北非发行组"],
  ["build-game-my", "2026-10-16T10:00:00+08:00", "MY", "LPF P12", ["adapt-game-scene-my"], [], [], "东南亚发行组"],
  ["build-drama-us", "2026-10-16T11:00:00+08:00", "US", "TV-14", ["adapt-drama-relation-us"], ["ai-drama-trans-us"], ["term-xiaolin", "term-chenran"], "北美发行组"],
  ["build-drama-kr", "2026-10-16T12:00:00+09:00", "KR", "15+", ["adapt-drama-relation-kr"], [], [], "韩声配音工作室"],
  ["build-toy-cn", "2026-10-16T14:00:00+08:00", "CN", "GB/T 玩具适用年龄 12+", ["adapt-toy-design-cn"], ["ai-toy-design-cn"], [], "瑞鹤潮玩供应链"],
  ["build-toy-ae-attempt", "2026-10-16T15:00:00+08:00", "AE", "待定", ["adapt-toy-design-ae-bad"], [], [], "海外渠道拓展组"],
];
for (const [id, at, market, rating, adaptation_ids, asset_ids, contribution_ids, assembled_by] of builds) {
  emit(E.MARKET_BUILD_ASSEMBLED, A.MARKET_BUILD, id, at, `组装版本 ${id}（${market}）`, {
    market, rating, adaptation_ids, asset_ids, contribution_ids, assembled_by,
  });
}

// -------------------------------------------------------------------------
// 2026-10-18 四闸口逐项判定：越权 AE 版权利闸口失败，其余全过
// -------------------------------------------------------------------------

function gates(id, at, market, table, evaluated_by, summary) {
  emit(E.CLEARANCE_GATE_EVALUATED, A.RELEASE_CLEARANCE, `rc-${id}`, at, summary, {
    build_id: id, market, evaluated_by,
    gates: {
      cultural: { result: table[0][0], note: table[0][1] },
      rights: { result: table[1][0], grant_refs: table[1][1], note: table[1][2] },
      rating: { result: table[2][0], certificate: table[2][1], note: table[2][2] },
      delivery: { result: table[3][0], note: table[3][1] },
    },
  });
}

gates("build-game-sa", "2026-10-18T09:00:00+03:00", "SA", [
  ["passed", "无在案否决，替换方案已获文化顾问同意"],
  ["passed", ["grant-game-ip"], "IP 授权覆盖 SA 且在有效期"],
  ["passed", "SA-GCAM-2026-1188", "全年龄向分级文号"],
  ["passed", "阿语包与主机移动端物料校验通过"],
], "发行清关组", "沙特版四闸口全部通过");

gates("build-game-my", "2026-10-18T10:00:00+08:00", "MY", [
  ["passed", "马来西亚版呈现与沙特版不同，但无在案否决"],
  ["passed", ["grant-game-ip"], "IP 授权覆盖 MY"],
  ["passed", "MY-LPF-2026-771", "P12 分级文号"],
  ["passed", "马来语/英语包校验通过"],
], "发行清关组", "马来西亚版四闸口全部通过");

gates("build-drama-us", "2026-10-18T11:00:00+08:00", "US", [
  ["passed", "国内叙事主线保留，无在案否决"],
  ["passed", ["grant-drama-ip", "grant-talent-drama"], "IP 与主演授权覆盖 US"],
  ["passed", "US-MPARP-2026-5520", "TV-14 分级文号"],
  ["passed", "字幕、音频描述与交付清单校验通过"],
], "发行清关组", "美国版短剧四闸口全部通过");

gates("build-drama-kr", "2026-10-18T12:00:00+09:00", "KR", [
  ["passed", "无在案否决"],
  ["passed", ["grant-drama-ip", "grant-talent-drama", "grant-partner-kr-dub"], "含韩语配音合作方独占授权"],
  ["passed", "KR-KMRB-2026-3341", "15+ 分级文号"],
  ["passed", "韩语音轨与流媒体规格校验通过"],
], "发行清关组", "韩国版短剧四闸口全部通过");

gates("build-toy-cn", "2026-10-18T14:00:00+08:00", "CN", [
  ["passed", "题签与群鹤构图完整"],
  ["passed", ["grant-museum-cn", "grant-toy-ip"], "博物馆 CN 授权与自有权利齐备"],
  ["passed", "CN-TOY-2026-902", "国内玩具适用年龄标识"],
  ["passed", "包装、质检报告与电商物料校验通过"],
], "发行清关组", "国内潮玩四闸口全部通过");

gates("build-toy-ae-attempt", "2026-12-01T10:00:00+08:00", "AE", [
  ["passed", "设计本身不触碰文物不可变要素"],
  ["failed", [], "博物馆授权仅限 CN，不覆盖 AE；权利闸口失败，禁止发行"],
  ["pending", undefined, "未取得海湾地区分级"],
  ["pending", undefined, "阿语包装未开始"],
], "发行清关组", "越权阿联酋版被权利闸口拦截：不进入发行清单");

// -------------------------------------------------------------------------
// 2026-10-20..24 只有四闸口全过的版本进入当地发行清单
// -------------------------------------------------------------------------

const releases = [
  ["build-game-sa", "2026-10-20T00:00:00+03:00", "SA", "中东北非发行组"],
  ["build-game-my", "2026-10-21T00:00:00+08:00", "MY", "东南亚发行组"],
  ["build-drama-us", "2026-10-22T00:00:00-04:00", "US", "北美发行组"],
  ["build-drama-kr", "2026-10-23T00:00:00+09:00", "KR", "韩国发行组"],
  ["build-toy-cn", "2026-10-24T00:00:00+08:00", "CN", "国内渠道组"],
];
for (const [id, at, market, by] of releases) {
  emit(E.MARKET_RELEASED, A.RELEASE_CLEARANCE, `rc-${id}`, at, `${id} 进入 ${market} 当地发行清单`, {
    build_id: id, market, released_by: by,
  });
}

emit(E.USAGE_SETTLED, A.USAGE_SETTLEMENT, "settle-liang-2026q4", "2026-10-28T10:00:00+08:00",
  "李昂核对沙特版镜头采用与首笔分账", {
    contributor_id: "u-liang", build_ids: ["build-game-sa"], markets: ["SA"],
    usage_detail: { footage_seconds: 42 },
    amount: { value: 1260, currency: "USD" }, status: "confirmed",
  });

// -------------------------------------------------------------------------
// 2026-12 博物馆跨境授权补签后，阿联酋版合法形成（与国内版是不同版本）
// -------------------------------------------------------------------------

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-museum-ae", "2026-12-10T10:00:00+08:00",
  "博物馆跨境补充授权：瑞鹤图数字件阿联酋市场", {
    grant_kind: "museum", granted_by: "某省博物馆 文创授权处",
    markets: ["AE"], channels: ["retail", "ecommerce"],
    valid_from: "2026-12-10T00:00:00+08:00", valid_until: "2028-12-10T00:00:00+08:00",
    status: "active", scope_note: "独立于 CN 授权，仅覆盖 AE",
  });

emit(E.ADAPTATION_PROPOSED, A.MARKET_ADAPTATION, "adapt-toy-design-ae", "2026-12-11T09:00:00+08:00",
  "阿联酋版新提案：在新签 AE 授权下重做设计与阿语物料", {
    change_target: { type: "design", ref: "sku-crane-notes-ae" },
    target_audience: { market: "AE", languages: ["ar", "en"], channels: ["retail", "ecommerce"] },
    triggered_clearances: ["museum", "ip_holder", "cultural_review", "rating_board"],
    proposed_by: "海外渠道拓展组（补授权后修订版）",
    change_summary: "阿拉伯文包装盒独立排版，题签仍完整不裁切；与 CN 版为不同市场版本",
  });

panel("adapt-toy-design-ae", [
  { at: "2026-12-11T14:00:00+08:00", role: ROLE.RH, decision: "approved", decided_by: "某省博物馆文创授权处",
    summary: "博物馆确认 AE 补充授权已生效", rationale: "新授权独立覆盖 AE，与 CN 授权互不推定" },
  { at: "2026-12-11T15:00:00+08:00", role: ROLE.CA, decision: "approved", decided_by: "文创顾问 怀瑾",
    summary: "文化顾问同意阿语包装版式", rationale: "题签独立金属件，群鹤构图完整" },
  { at: "2026-12-11T16:00:00+04:00", role: ROLE.MO, decision: "approved", decided_by: "中东海湾市场负责人",
    summary: "市场方同意海湾上架排期", rationale: "授权与分级路径明确" },
]);

emit(E.AI_ASSET_REGISTERED, A.AI_ASSET, "ai-toy-design-ae", "2026-12-12T10:00:00+08:00",
  "阿联酋版 AI 辅助设计：输入依据改用 AE 补充授权", {
    asset_kind: "design", created_by: "瑞鹤潮玩设计中心",
    input_permissions: [
      { ref: "瑞鹤图高清数字件 artifact-crane-img", grant_id: "grant-museum-ae", scope: "AE 潮玩衍生设计" },
    ],
    tool: { name: "FormaMaker", version: "5.1.0", provider: "器形智能" },
    human_revision: { revised_by: "朱绮（青年设计师 Kiki）", at: "2026-12-12T19:00:00+08:00", description: "重排阿语包装与题签金属件位置" },
  });

emit(E.CONTRIBUTION_ACCEPTED, A.CONTRIBUTOR_TERM, "term-kiki", "2026-12-12T15:00:00+08:00",
  "青年设计师朱绮：阿联酋版设计单独署名分账", {
    contributor_id: "u-kiki", contributor_name: "朱绮（Kiki）", contribution_kind: "design",
    attribution: "包装独立署名：设计师 Kiki 朱绮",
    revenue_share: { basis: "阿联酋版净收入分成", rate: 0.035, currency: "USD" },
    adaptation_ids: ["adapt-toy-design-ae"],
  });

emit(E.MARKET_BUILD_ASSEMBLED, A.MARKET_BUILD, "build-toy-ae", "2026-12-15T10:00:00+08:00",
  "组装合法阿联酋版本 build-toy-ae", {
    market: "AE", rating: "NMC 建议 7+", adaptation_ids: ["adapt-toy-design-ae"],
    asset_ids: ["ai-toy-design-ae"], contribution_ids: ["term-kiki"], assembled_by: "海外渠道拓展组",
  });

gates("build-toy-ae", "2026-12-16T10:00:00+08:00", "AE", [
  ["passed", "无在案否决"],
  ["passed", ["grant-museum-ae", "grant-toy-ip"], "AE 补充授权与自有权利均覆盖 AE 且在有效期"],
  ["passed", "AE-NMC-2026-447", "阿联酋分级文号"],
  ["passed", "阿语/英语包装与交付物料校验通过"],
], "发行清关组", "阿联酋版四闸口全部通过");

emit(E.MARKET_RELEASED, A.RELEASE_CLEARANCE, "rc-build-toy-ae", "2026-12-18T00:00:00+04:00",
  "build-toy-ae 进入 AE 发行清单（与 CN 版各自合法）", {
    build_id: "build-toy-ae", market: "AE", released_by: "中东海湾市场负责人",
  });

// -------------------------------------------------------------------------
// 2027-01-02 博物馆 CN 授权到期：精确阻断国内版并摘除清单（AE 版不受影响）
// -------------------------------------------------------------------------

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-museum-cn", "2027-01-02T00:05:00+08:00",
  "CN 授权状态更新：到期", {
    grant_kind: "museum", granted_by: "某省博物馆 文创授权处",
    markets: ["CN"], channels: ["retail", "ecommerce"],
    valid_from: "2026-01-01T00:00:00+08:00", valid_until: "2027-01-01T00:00:00+08:00",
    status: "expired",
  });

emit(E.ACCESS_REVOKED, A.RELEASE_CLEARANCE, "rc-build-toy-cn", "2027-01-02T00:10:00+08:00",
  "权利到期：精确阻断 build-toy-cn 并从 CN 发行清单摘除（不影响 AE 版）", {
    reason: "rights_expiry",
    effects: ["versions_blocked"],
    affected_build_ids: ["build-toy-cn"],
    trigger_ref: "grant-museum-cn（2027-01-01 到期）",
    effective_at: "2027-01-02T00:00:00+08:00",
  });

// -------------------------------------------------------------------------
// 2027-02 续约后恢复国内版：恢复不溯及闸口，必须重判四闸口才能重新上架
// -------------------------------------------------------------------------

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-museum-cn", "2027-02-01T10:00:00+08:00",
  "CN 授权续约：状态恢复 active", {
    grant_kind: "museum", granted_by: "某省博物馆 文创授权处",
    markets: ["CN"], channels: ["retail", "ecommerce"],
    valid_from: "2027-02-01T00:00:00+08:00", valid_until: "2029-02-01T00:00:00+08:00",
    status: "active",
  });

emit(E.VERSION_REINSTATED, A.RELEASE_CLEARANCE, "rc-build-toy-cn", "2027-02-01T11:00:00+08:00",
  "续约后解除 build-toy-cn 阻断；旧闸口判定不溯及，须重审", {
    build_id: "build-toy-cn", reason: "rights_expiry", reinstated_by: "发行清关组",
  });

gates("build-toy-cn", "2027-02-02T10:00:00+08:00", "CN", [
  ["passed", "题签与群鹤构图仍完整"],
  ["passed", ["grant-museum-cn", "grant-toy-ip"], "续约授权覆盖 CN 且在新有效期内"],
  ["passed", "CN-TOY-2027-118", "续期年龄标识"],
  ["passed", "新周期包装与质检复核通过"],
], "发行清关组", "国内版续约后重新通过四闸口");

emit(E.MARKET_RELEASED, A.RELEASE_CLEARANCE, "rc-build-toy-cn", "2027-02-05T00:00:00+08:00",
  "build-toy-cn 重新进入 CN 发行清单", {
    build_id: "build-toy-cn", market: "CN", released_by: "国内渠道组",
  });

// -------------------------------------------------------------------------
// 2027-02-10 美国分级变化：精确阻断美版短剧（韩国版不受影响）
// -------------------------------------------------------------------------

emit(E.ACCESS_REVOKED, A.RELEASE_CLEARANCE, "rc-build-drama-us", "2027-02-10T09:00:00-05:00",
  "分级机构下调可投放分级：阻断 build-drama-us 并从 US 清单摘除", {
    reason: "rating_change",
    effects: ["versions_blocked"],
    affected_build_ids: ["build-drama-us"],
    trigger_ref: "分级调整通知 RRN-2027-02（US-MPARP-2026-5520 暂停适用于本版本）",
    effective_at: "2027-02-10T09:00:00-05:00",
  });

emit(E.AI_ASSET_REVISED, A.AI_ASSET, "ai-drama-trans-us", "2027-02-20T10:00:00+08:00",
  "重审期间升级译写工具并追加人工修订记录", {
    tool: { name: "LinguaCraft", version: "1.9.2", provider: "言工社" },
    human_revision: { revised_by: "陈然（青年译写者）", at: "2027-02-20T16:00:00+08:00", description: "按新分级意见调整两处冲突对白的表达强度" },
  });

emit(E.VERSION_REINSTATED, A.RELEASE_CLEARANCE, "rc-build-drama-us", "2027-02-24T10:00:00-05:00",
  "完成内容修订并取得新分级后解除阻断，等待重审", {
    build_id: "build-drama-us", reason: "rating_change", reinstated_by: "北美发行组",
  });

gates("build-drama-us", "2027-02-25T10:00:00-05:00", "US", [
  ["passed", "修订后仍无在案否决"],
  ["passed", ["grant-drama-ip", "grant-talent-drama"], "授权持续覆盖 US"],
  ["passed", "US-MPARP-2027-0918", "新分级文号，旧文号已停用"],
  ["passed", "修订版字幕与交付物料复核通过"],
], "发行清关组", "美版短剧按新分级重新通过四闸口");

emit(E.MARKET_RELEASED, A.RELEASE_CLEARANCE, "rc-build-drama-us", "2027-03-01T00:00:00-05:00",
  "build-drama-us 重新进入 US 发行清单", {
    build_id: "build-drama-us", market: "US", released_by: "北美发行组",
  });

// -------------------------------------------------------------------------
// 2027-03-05 韩国合作方退出：撤访问 + 只阻断韩语版（美版及其他团队不受影响）
// -------------------------------------------------------------------------

emit(E.RIGHTS_CLEARED, A.RIGHTS_GRANT, "grant-partner-kr-dub", "2027-03-05T09:00:00+09:00",
  "合作方退出：韩语配音授权状态更新为 revoked", {
    grant_kind: "material", granted_by: "韩声配音工作室（合作方）",
    markets: ["KR"], channels: ["streaming"],
    valid_from: "2026-09-15T00:00:00+08:00", valid_until: "2028-02-01T00:00:00+08:00",
    status: "revoked", scope_note: "合作方提前退出，授权提前终止",
  });

emit(E.ACCESS_REVOKED, A.RELEASE_CLEARANCE, "rc-build-drama-kr", "2027-03-05T09:30:00+09:00",
  "合作方退出：收回其协作访问，并精确阻断含其独占配音授权的韩语版", {
    reason: "partner_exit",
    effects: ["access_withdrawn", "versions_blocked"],
    subject_ids: ["partner-kr-dub-studio"],
    affected_build_ids: ["build-drama-kr"],
    trigger_ref: "grant-partner-kr-dub（韩声配音工作室退出通知 2027-03-05）",
    effective_at: "2027-03-05T09:30:00+09:00",
  });

// -------------------------------------------------------------------------
// 2027-03-15 已投放版本结算：贡献者可核对采用、投放与金额（被阻断的 KR 不结算）
// -------------------------------------------------------------------------

emit(E.USAGE_SETTLED, A.USAGE_SETTLEMENT, "settle-xiaolin-2027q1", "2027-03-15T10:00:00+08:00",
  "林晓核对美版复播后的镜头采用与分账", {
    contributor_id: "u-xiaolin", build_ids: ["build-drama-us"], markets: ["US"],
    usage_detail: { footage_seconds: 76 },
    amount: { value: 3040, currency: "USD" }, status: "confirmed",
  });

emit(E.USAGE_SETTLED, A.USAGE_SETTLEMENT, "settle-chenran-2027q1", "2027-03-15T10:10:00+08:00",
  "陈然核对美版译写采用字数与分账（含分级重审后的修订）", {
    contributor_id: "u-chenran", build_ids: ["build-drama-us"], markets: ["US"],
    usage_detail: { transcreation_words: 9200 },
    amount: { value: 2300, currency: "USD" }, status: "confirmed",
  });

emit(E.USAGE_SETTLED, A.USAGE_SETTLEMENT, "settle-kiki-2027q1", "2027-03-15T10:20:00+08:00",
  "朱绮核对阿联酋版设计采用与首笔分账（等待本人确认）", {
    contributor_id: "u-kiki", build_ids: ["build-toy-ae"], markets: ["AE"],
    usage_detail: { design_units: 2 },
    amount: { value: 980, currency: "USD" }, status: "reported",
  });

// -------------------------------------------------------------------------
// 按时间排序 → 编排各聚合版本号与 event_id → 自检 → 落盘
// -------------------------------------------------------------------------

stream.sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.aggregate_id.localeCompare(b.aggregate_id));

const versionByAggregate = new Map();
for (const event of stream) {
  const version = (versionByAggregate.get(event.aggregate_id) ?? 0) + 1;
  versionByAggregate.set(event.aggregate_id, version);
  event.version = version;
  event.event_id = `${event.aggregate_id}-e${version}`;
}

// 将 event_id 与版本号放回键序前部，输出更稳定易读。
const ordered = stream.map((event) => ({
  event_id: event.event_id,
  event_type: event.event_type,
  aggregate_type: event.aggregate_type,
  aggregate_id: event.aggregate_id,
  occurred_at: event.occurred_at,
  version: event.version,
  summary: event.summary,
  payload: event.payload,
}));

const problems = validateEventStream(ordered);
if (problems.length > 0) {
  console.error("生成的样例事件流未通过领域校验：");
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

const out = fileURLToPath(new URL("../data/event-stream.json", import.meta.url));
await writeFile(out, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
console.log(`已写入 ${out}（${ordered.length} 条事件）`);
