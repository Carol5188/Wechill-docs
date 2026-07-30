# 红包项目索引

更新时间：2026-06-26

## 当前定位

红包模块重点围绕红包返奖、概率预算、风控黑名单、领取记录、配置后台和字段说明。

## 当前版候选

| 类型 | 当前建议读取文件 | 说明 |
|---|---|---|
| PRD | [hongbao-rebate-prd-v2.md](hongbao-rebate-prd-v2.md) | 红包返奖当前较新版本 |
| 配置后台 | [hongbao-config-redesign.html](hongbao-config-redesign.html) | 红包配置后台重设计 |
| 风控页面 | [04-risk.html](04-risk.html) | 红包风控页面 |
| 返奖页面 | [07-rebates.html](07-rebates.html) | 返奖页面 |
| 领取记录 | [09-claim-records.html](09-claim-records.html) | 领取记录页面 |

## 字段说明

- [04-risk-field-doc.md](04-risk-field-doc.md)
- [06-packets-field-doc.md](06-packets-field-doc.md)
- [07-rebates-field-doc.md](07-rebates-field-doc.md)
- [09-claim-records-field-doc.md](09-claim-records-field-doc.md)

## 历史版本

- 未带版本号的 `hongbao-rebate-prd.md` 已移入工作区清理隔离区；当前保留并默认读取 v2。

## 当前口径

- 红包返奖需要考虑同设备/IP、多账号互抢、异常高频大额、预算熔断和幂等发奖。
- 高风险用户和高风险房间应区分告警、限制返奖、禁发禁领等处理等级。
- 返奖预算、日上限、开奖唯一主键和补发队列是评审重点。

## 待确认问题

- 黑名单等级是否与风控总后台复用。
- 同设备/IP 阈值是否按红包类型、房间规模、国家分区动态调整。
- 红包预算触顶后是关闭返奖还是同时隐藏入口。

## 下次给 Codex 的推荐提示

```text
先读 红包/PROJECT_INDEX.md。
以 hongbao-rebate-prd-v2.md 和 hongbao-config-redesign.html 为当前候选。
涉及返奖和风控时，必须检查预算、幂等、设备/IP、多账号、发奖失败补偿和客服可解释性。
```
