# 文化出海本地化合议

把“海外版可以改”这句邮件变成一套**可追溯的合议契约**：三十多个协作制片团队不靠邮件确认，而是围绕同一组领域对象、事件与机器可判定的合议规则协同工作。

本仓库是这套合议的**领域层**——统一对象身份、版本语义和关键负载字段，并把业务原则落成事件流不变量。业务服务在保持兼容的前提下继续建设（投影构建、提醒、BI 等）。

## 合议规则（与代码对应的六条业务原则）

1. **先说明，再分别决定。** 每条本地化改写必须以 `ADAPTATION_PROPOSED` 写清三件事——变更对象（`change_target`）、目标受众（`target_audience`，含市场/语言/分级意图/渠道）、触发的授权（`triggered_clearances`）。随后由**适当的**权利人、文化顾问、市场负责人通过 `PANEL_DECISION_RECORDED` 分别独立决定；同一角色对同一改写只能登记一次立场，不能靠重复投票压过异议。
2. **禁用范围多数不可覆盖。** 文化顾问（及权利人）登记的 `hard_veto` 会同时卡住文化闸口和发行：即使其余角色全部 approved，含该改写的版本也不能放行、不能换皮重提；触碰禁用范围后被阻断的版本不允许恢复。市场方没有 hard veto 权。
3. **不同地区可合法形成不同版本。** 同一叙事节点在不同市场可以有各自的提案、决定、版本与发行记录（样例中同一仪式关在 SA 版改为集市护送、在 MY 版改为码头对话，两者独立审理、各自合法）。
4. **权利按地区/渠道/有效期精确支撑。** `RIGHTS_CLEARED` 必须列明 granted_by、markets、channels、有效期与状态。博物馆等限定市场的授权不得越界：样例中仅凭 CN 博物馆授权上架 AE 的版本被权利闸口直接拦截，补签 AE 授权、另提新版本后才合法形成。
5. **四闸口放行制。** 文化边界、权利、分级、交付校验四项（`cultural / rights / rating / delivery`）在 `CLEARANCE_GATE_EVALUATED` 中逐项判定，**四项全 passed 且合议完整（三类角色都决定过、无 rejected）**，版本才能经 `MARKET_RELEASED` 进入当地发行清单。
6. **精确收回与恢复重审。** 合作方退出、权利到期、分级变化触发 `ACCESS_REVOKED`，效果精确到 `subject_ids`（撤访问）与 `affected_build_ids`（阻断版本、摘除清单）；其他团队、其他地区版本不受牵连。到期续约、分级调整完成后可 `VERSION_REINSTATED`，但**恢复不溯及闸口**——必须重新判定四闸口才能重新上架；而 `veto_breach` 阻断永不恢复。

此外两条贯穿性义务：

- **年轻创作者单独署名分账。** 镜头、译写、设计贡献以 `CONTRIBUTION_ACCEPTED` 登记独立署名与分账比例；`USAGE_SETTLED` 记录内容怎样被采用、投放与结算，且只允许针对**已在清单上**的版本发生，贡献者随后可核对（reported → confirmed/disputed → paid）。
- **AI 资产来源三件套。** `AI_ASSET_REGISTERED` 必须同时给出输入许可（引用真实授权并说明范围）、工具名称+版本+提供方、人工修订（谁、何时、做了什么）；工具升级或再次修订用 `AI_ASSET_REVISED` 追加。未登记来源的资产不能进入任何版本。

## 对象与事件总览

| 聚合根（aggregate_type） | 承载事件 |
| --- | --- |
| `source_ip` | `BOUNDARY_REGISTERED`（不可变要素 `immutable_elements` + 禁用项 `prohibitions`） |
| `market_adaptation` | `ADAPTATION_PROPOSED` |
| `rights_grant` | `RIGHTS_CLEARED` |
| `review_panel` | `PANEL_DECISION_RECORDED`（approved / rejected / hard_veto / abstained） |
| `contributor_term` | `CONTRIBUTION_ACCEPTED` |
| `ai_asset` | `AI_ASSET_REGISTERED` / `AI_ASSET_REVISED` |
| `market_build` | `MARKET_BUILD_ASSEMBLED` / `VERSION_REINSTATED`（与 clearance 聚合联动） |
| `release_clearance` | `CLEARANCE_GATE_EVALUATED` / `MARKET_RELEASED` / `ACCESS_REVOKED` / `VERSION_REINSTATED` |
| `usage_settlement` | `USAGE_SETTLED` |

事件信封为 `event_id / event_type / aggregate_type / aggregate_id / occurred_at / version / summary / payload`；同一聚合的 `version` 从 1 单调递增，事件流按 `occurred_at` 全局排列。收回、阻断等事件通过 `aggregate_id` 与负载中的 id 引用精确命中对象，不用模糊下架。

## 目录

- `src/domain.js`：跨团队唯一事实来源——事件信封、聚合/事件/角色/闸口枚举、关键负载必备字段。
- `src/validator.js`：两级校验。`validateEvent` 校验单事件结构；`validateEventStream` 判定跨事件不变量（硬否决生效、权利覆盖、四闸口、阻断、结算前提等）。
- `contracts/domain.schema.json`：JSON Schema 契约，枚举与 `src/domain.js` 同源（测试保证两者一致）。
- `data/event-stream.json`：三个团队在同一契约下的完整 84 条事件流（由脚本生成并通过全部校验），也是联调数据。
- `data/sample.json`：一条单事件联调样例。
- `scripts/gen-sample-event-stream.mjs`：样例生成器，按时间排序自动编排各聚合版本号，生成后立即自检，非法流不落盘。
- `tests/contract.test.js`：25 项契约测试——正样例通过 + 各类违规变体必被拒绝。

## 样例事件流（三个团队的合议轨迹）

生成器用一条时间线串起题目中的三种误读及纠正：

1. **丝路游戏**：宗教性仪式战斗关，SA 版整体替换为中性集市护送、MY 版改为码头驿站对话；另有把朝圣终点改成品牌打卡广场的提案，在权利方与市场方两张赞成票下仍被文化顾问 `hard_veto`（`P-SR-02`），永不发行。
2. **短剧《归家长路》**：保留国内寻亲叙事主线，美版改写为寄养家庭支持网络、韩版改写为社区会馆照护网络，三类角色分别通过；后续美国分级变化 → 精确阻断美版（韩版不受影响）→ 修订（含 AI 译写工具升级与人工修订登记）→ 取得新分级文号 → 重过四闸口 → 复播；韩国配音合作方退出 → 收回其访问并只阻断韩语版。
3. **文物潮玩**：仅凭博物馆 CN 限定市场授权直上 AE 的尝试被权利闸口拦截、不进清单；12 月独立补签 AE 跨境授权、另提 `adapt-toy-design-ae` 新提案、重建版本并重过四闸口后才上架；CN 版次年 1 月授权到期被精确阻断下架、2 月续约后重审上架（AE 版始终不受影响）。

青年创作者贡献与 AI 资产贯穿其中：李昂（镜头）、林晓（补拍）、陈然（译写）、Kiki 朱绮（设计）均独立署名与分账；三个 AI 资产都带输入许可、工具版本与人工修订；退出/阻断后的版本不产生结算，复播/在架版本的采用明细与金额由贡献者核对后确认。

## 本地检查

```bash
npm test               # 25 项契约测试
npm run generate-sample  # 重新生成 data/event-stream.json（生成前会自检）
```

## 给下游服务的接口约定

任何团队/服务拿到一批事件后：

1. 入口逐条 `validateEvent`；
2. 聚合按 `aggregate_id` 折叠、按 `version` 应用，全局按 `occurred_at` 排序；
3. 对完整流（或某版本相关的切片）调用 `validateEventStream`，返回空数组才允许进入各自的工作流；
4. 投影只对外暴露通过四闸口且未被阻断的版本——这正是“当地发行清单”的定义；
5. 任何一方对事件有异议，凭 `event_id` 与 `trigger_ref` 即可回溯到改写说明、角色决定、授权与分级文号——不再需要翻邮件。
