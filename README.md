# 文化出海本地化合议

「海外版可以改」不再由邮件确认。本仓库把原始 IP、不可变文化要素、可本地化范围、
译写提案、市场版本、演员与素材权利、顾问异议、制作里程碑与发行许可落成一条
**只追加、可重放、可追溯**的事件时间线，并由代码执行合议规则：

- 每条改写先说明**变更对象、目标受众/市场、触发的授权**；
- 权利人、文化顾问、市场负责人在同一提案上**分别决定**；
- 文化顾问对**禁用范围**的否决是 VETO，不能被多数意见覆盖；
- 不同地区可以合法形成不同版本，各自取证、各自发行；
- 合作方退出、权利到期、分级变化按事件**精确收回**访问并阻断受影响版本；
- 只有**文化边界 / 权利 / 分级 / 交付**四道闸门同时通过的成片才进入当地发行清单；
- 贡献者（含年轻创作者）事后可核对内容被哪些版本采用、如何投放、如何结算。

## 目录

- `contracts/domain.schema.json`：事件信封、按事件类型分派的载荷 JSON Schema 与稳定枚举。
- `src/domain.js`：聚合、事件、枚举与事件→聚合归属的唯一登记处。
- `src/validator.js`：单事件校验（强制披露、角色、禁用异议依据、署名分账、AI 溯源等）。
- `src/clearance.js`：事件重放、四闸门判定、触发式收回计划、发行清单、贡献者台账。
- `data/scenario/`：三条业务线的完整合议样例（`index.js` 为数据源，`timeline.json` 为导出）。
- `tests/`：契约一致性、校验器、闸门/收回/台账共 31 项检查。

## 合议主流程

```
BOUNDARY_REGISTERED (source_ip / cultural_element)   登记 IP 基线与要素稳定性
        │
TEAM_REGISTERED                                      协作制片团队登记（样例含 32 个在册团队）
RIGHTS_CLEARED                                       授权：权利类型 / 市场 / 期限 / 要素范围
        │
ADAPTATION_PROPOSED ── PROPOSAL_REVISED              提案必须含：
        │                                              change_targets（变更对象与处理方式）
        │                                              target_markets + target_audience
        │                                              triggered_authorizations（触发的授权）
        ├─ RIGHTS_DECISION        权利人（APPROVED/CHANGES_REQUESTED/REJECTED）
        ├─ ADVISORY_OBJECTION_FILED → ADVISORY_DECISION   文化顾问（可 VETO，须给 basis）
        └─ MARKET_DECISION        各市场负责人（按市场分别决定）
        │
CONTRIBUTION_ACCEPTED  镜头/译写/设计条款（年轻创作者须个人署名 + 比例/点数分账）
AI_ASSET_REGISTERED → AI_REVISION_RECORDED  输入许可、工具名称/版本、人工修订
MILESTONE_RECORDED → VERSION_FROZEN     冻结时快照变更对象与禁用异议
        │
DELIVERY_VERIFIED  交付校验（母版哈希、轨别、出处标注、禁用要素扫描）
RATING_GRANTED （→ RATING_CHANGED 时评级闸门立即失败，待重新取证）
GATE_EVALUATED ×4 → CLEARANCE_GRANTED  四道闸门全 PASSED 才授予许可
        │
DISTRIBUTION_PUBLISHED → MARKET_RELEASED  只放行清单内且当下四闸门仍通过的版本
        │
USAGE_RECORDED → SETTLEMENT_RECORDED     贡献者核对采用、投放与分账
```

阻断与收回（均可在发行前后发生）：

- `VERSION_BLOCKED`：任一闸门失败，版本不得发行；
- `RIGHTS_REVOKED`：授权撤销/到期（`REVOKED` / `EXPIRED`）；
- `PARTNER_EXITED` + `ACCESS_REVOKED`：合作方退出，精确收回其授权与素材库访问；
- `RATING_CHANGED`：分级暂停/撤销/降级，受影响版本撤出清单直至重新取证。

`planRevocations(state)` 依据这些事实输出**精确**的收回计划：只列出受影响的授权、
版本、市场与清单条目（`market:version`），不波及同一团队或同一 IP 的其他版本。

## 四道闸门

| 闸门 | 失败条件（任一即失败） |
| --- | --- |
| `CULTURAL_BOUNDARY` | 冻结时仍在册的顾问**禁用异议**；`IMMUTABLE` 要素被 MODIFIED/REPLACED/REMOVED（TRANSLATED 允许）；要素 `PROHIBITED`；`LIMITED` 要素用于授权市场之外 |
| `RIGHTS` | 提案声明的每类授权在该市场、该团队、该时刻无有效授权；授权要素范围未覆盖实际触碰要素；团队已退出 |
| `RATING` | 未取得当地分级；分级发生变化且已生效、尚未重新取证 |
| `DELIVERY` | 未完成交付校验或结果非 PASSED |

关键语义：禁用范围是**否决项**而非表决项——美版短剧 v1 中即使权利人与市场负责人
都赞成，文化顾问对不可变「师门伦理」的 VETO 仍使文化边界失败；v2 退回语言译写后
作为**另一个合法地区版本**通过。

## 判定的时间点语义

闸门函数接受 `{ at }`（ISO 时间或毫秒）。授权在撤销生效前、分级在变化生效前
仍判定为有效，因此可以回答「当时能否发行」和「现在为何必须撤回」两个问题。
`currentReleaseList(state, market, { at })` 返回该时刻清单中仍然合法的版本。

## 样例时间线

`data/scenario/index.js` 覆盖题述三种「海外版可以改」的理解：

1. **丝路游戏（SA/TW）**：宗教巡游场景（LOCALIZABLE）替换为世俗巴扎开市仪式，
   合法发行；后沙特分级 SUSPENDED，版本被阻断并撤出清单；繁中版年轻创作者
   林小满的海港空镜单独署名、按 1.5% 分账。
2. **短剧《长安驿丞》**：繁中版保留国内叙事仅译写；美版 v1 把师徒关系改写为
   情侣线，触碰 IMMUTABLE 要素被顾问否决阻断，v2 恢复关系实质、仅译写后发行，
   译者陈可妤单独署名、按 0.8% 分账；马来语版合作方南星传媒在发行前退出，
   其版本被精确阻断，其他团队版本不受影响。
3. **文物潮玩**：壁画神鸟为博物馆 `LIMITED[CN,KR]` 要素，欧盟延伸（DE/FR）
   被博物馆拒绝并被顾问否决；韩国版在授权市场内设计本地化后合法发行，设计师
   白若汐按 2.5% 分账；10 月 15 日授权到期后韩国版自动撤出清单。

时间线导出：

```bash
npm run scenario:export   # 由 data/scenario/index.js 重新生成 timeline.json
```

## 本地检查

```bash
npm test
```
