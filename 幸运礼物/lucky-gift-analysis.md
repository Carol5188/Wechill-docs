# 幸运礼物逻辑梳理

> 范围：`server.rar` 解包后的 `app-payer`、`app-live`、`app-bases`、`app-user` 相关代码。  
> 结论口径：当前工作树不包含线上 DB 里的幸运礼物规则行；我从 `app-payer/.git` 里恢复到了最近一批已删除的历史配置快照 `0983141 fix: 幸运礼物轨道配置代码-20251210`，下面概率表按这批配置计算。真实线上现行配置仍以 `app_payer_gift_luck_lane`、`app_payer_gift_luck_lane_rule` 和 Apollo 配置为准。

## 1. 主链路

幸运礼物在 `app-payer` 里处理，展示在 `app-live` 里处理。

1. 入口按礼物类型进入 pipeline：
   - 金币幸运礼物：`SendLuckGiftTransPipelineBuilder`
   - 背包幸运礼物：`SendLuckBackpackGiftTransPipelineBuilder`
2. pipeline 顺序：
   - `SendGiftParamValidHandler`：基础参数校验。
   - `SendGiftCheckValidHandler`：礼物、余额、关系等业务校验。
   - `SendLuckGiftCheckValidHandler`：调用 `GiftLuckService.preCheck(...)`，主要判断是否走新人轨道。
   - `SendGiftCoreHandler`：先完成普通送礼扣费、收礼侧入账、生成 `detailId`。
   - `SendLuckGiftCoreHandler` / `SendLuckBackpackGiftCoreHandler`：抽幸运返奖。
   - `SendGiftAfterHandler`：当前为空壳。
3. 抽奖调用链：
   - `GiftLuckServiceImpl`
   - `LaneGiftLuckMechanism`
   - `GiftLuckLaneServiceImpl`
   - `PayerRedisExtension.raffleGiftLickLaneUntil(...)`
   - Redis Lua：`gift_luck_lane_raffle.lua`

## 2. 轨道模型

核心不是每次运行时按随机数算概率，而是预生成 Redis 轨道列表：

1. 规则表：
   - `app_payer_gift_luck_lane`：礼物绑定哪个轨道规则，可配置共享 `lane_key`、区域规则。
   - `app_payer_gift_luck_lane_rule`：完整轨道规则 JSON。
   - `app_payer_gift_luck_lane_cycle_rule`：历史上用于拆分周期规则。
   - `app_payer_gift_luck_lane_newcomer`：用户/礼物维度新人累计次数。
2. 规则结构：
   - `GiftLuckLaneRule.composites`：组合多个周期。
   - `GiftLuckLaneCycleRule.amount`：一个周期的坑位数量。
   - `multiples`：中奖倍数和坑位数，例如 `2x` 放 350 个坑位。
   - `limits`：只限制奖项出现位置，不改变总概率。
3. 轨道生成：
   - `GiftLuckLaneExtension.generateLane(rule)` 生成一串数字。
   - `0` 表示未中奖，正数表示中奖倍数。
   - 连续 `0` 会被 `compressNumbers` 压缩成负数，例如 `-12` 表示连续 12 次未中奖。
   - 生成结果 `rightPushAll` 到 Redis list。
4. 抽奖：
   - Lua 从 list 头部消费。
   - 正数：`lPop` 并记录倍数。
   - `0` / `-1`：消费一次未中奖。
   - 负数：表示一段连续未中奖，按本次请求次数扣减，必要时 `lSet` 回剩余未中奖段。
5. 奖池补充：
   - 定时任务 `giftLuckLaneAddonJob` 会检查所有有效幸运礼物。
   - 送礼时若轨道空，会加锁补充后递归重试。
   - 大额送礼或缓存间隔命中时，会异步检查是否需要补充。
6. 新人轨道：
   - Apollo `payer.gift.luck.newcomerGiftIds` 决定哪些礼物有新人轨道。
   - Apollo `payer.gift.luck.newcomerLaneRule` 绑定新人规则 id。
   - 当用户累计送该礼物次数 `< 新人规则 sunAmount()` 时走新人轨道。
   - 抽奖后异步 `incrGiftNewcomer` 更新累计次数。

## 3. 返奖和入账

金币幸运礼物：

- 抽奖结果 `rewards` 是倍数列表。
- `rewardMultiple = rewards.sum()`。
- `rewardCoin = rewardMultiple * gift.coin`。
- 通过 `UserCoinClient.give(...)` 给送礼方发金币返奖，流水类型是 `LUCK_GIFT_REWARD(501)`。
- `luckReward` 写回 `SendGiftDto`，后续消息展示使用。

背包幸运礼物：

- 同样抽倍数。
- `rewardMultiple = rewards.sum()`。
- 通过 `UserBackpackClient.giveGift(...)` 给送礼方返背包礼物数量。
- 这里展示仍按 `rewardMultiple * gift.coin` 算中奖金额，但实际返的是背包礼物。

收礼侧：

- 非自赠幸运礼物默认收礼方获得礼物价值 10% 的钻石和魅力值。
- 自赠幸运礼物走 `payer.gift.self-give.*` 比例，当前默认值：
  - 金豆/水晶：`0.099`
  - 魅力值：`0.05`
  - 钻石：`0.099`

## 4. 概率和 RTP

计算公式：

```text
P(某倍数) = 该倍数坑位数 / 总坑位数
P(中奖) = 所有中奖坑位数 / 总坑位数
单次返奖 RTP = sum(倍数 * 该倍数坑位数) / 总坑位数
单次期望返奖金币 = 礼物单价 * 单次返奖 RTP
```

最新可复原历史快照 `gift20251210` 的每个礼物都使用同一套倍数分布。单周期是 10,000 坑位，实际 `laneStimulate` 由同一周期重复 3 次组成，所以实际轨道长度是 30,000，概率不变。

### 倍数分布

| 倍数 | 单周期坑位 | 实际轨道坑位 | 概率 |
|---:|---:|---:|---:|
| 未中奖 | 9,080 | 27,240 | 90.8000% |
| 2x | 350 | 1,050 | 3.5000% |
| 5x | 250 | 750 | 2.5000% |
| 10x | 175 | 525 | 1.7500% |
| 20x | 80 | 240 | 0.8000% |
| 30x | 29 | 87 | 0.2900% |
| 50x | 20 | 60 | 0.2000% |
| 70x | 9 | 27 | 0.0900% |
| 100x | 3 | 9 | 0.0300% |
| 150x | 2 | 6 | 0.0200% |
| 200x | 1 | 3 | 0.0100% |
| 300x | 1 | 3 | 0.0100% |
| 合计中奖 | 920 | 2,760 | 9.2000% |

单次返奖 RTP：

```text
(2*350 + 5*250 + 10*175 + 20*80 + 30*29 + 50*20 + 70*9 + 100*3 + 150*2 + 200*1 + 300*1) / 10000
= 8900 / 10000
= 89.0000%
```

### 每个礼物的概率和单次 RTP

> 这批历史配置类里 `giftIds = [-1]` 是占位，真实礼物 id / 名称需要从 DB 的 `app_payer_gift_luck_lane.gift_id` 和 `app_payer_gift` 映射。表里先按配置单价/规则对象列出。

| 礼物单价 coin | 历史配置对象 | 未中奖 | 2x | 5x | 10x | 20x | 30x | 50x | 70x | 100x | 150x | 200x | 300x | 中奖率 | 单次返奖 RTP | 单次期望返奖 | 单次期望净值 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | `GiftMena20251210Rule100` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 89.00 | -11.00 |
| 159 | `GiftMena20251210Rule159` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 141.51 | -17.49 |
| 177 | `GiftMena20251210Rule177` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 157.53 | -19.47 |
| 199 | `GiftMena20251210Rule199` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 177.11 | -21.89 |
| 233 | `GiftMena20251210Rule233` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 207.37 | -25.63 |
| 300 | `GiftMena20251210Rule300` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 267.00 | -33.00 |
| 511 | `GiftMena20251210Rule511` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 454.79 | -56.21 |
| 777 | `GiftMena20251210Rule777` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 691.53 | -85.47 |
| 1111 | `GiftMena20251210Rule1111` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 988.79 | -122.21 |
| 1777 | `GiftMena20251210Rule1777` | 90.8000% | 3.5000% | 2.5000% | 1.7500% | 0.8000% | 0.2900% | 0.2000% | 0.0900% | 0.0300% | 0.0200% | 0.0100% | 0.0100% | 9.2000% | 89.0000% | 1,581.53 | -195.47 |

注意：这里的 RTP 是送礼方金币/背包返奖 RTP，不含收礼方 10% 钻石/魅力值、自赠折算、活动积分、主播/公会结算等外部经济口径。

## 5. 现有问题

1. 线上规则不在当前代码工作树里，审计和回滚弱。  
   当前 HEAD 已删除历史测试配置类，真正生效规则在 DB；若没有 DML、配置版本表或后台操作日志，很难从代码直接确认线上每个礼物概率。

2. 返奖失败被吞掉，不回滚主交易。  
   `SendLuckGiftCoreHandler` 和 `SendLuckBackpackGiftCoreHandler` 里返奖失败只告警，送礼扣费和收礼侧入账已经完成。结果是用户可能已消费但未拿到中奖返奖，需要人工补偿。

3. 补奖池检查间隔疑似写错单位。  
   代码注释写“每隔30秒”，但 `CHECK_ADDON_INTERVAL = 30L` 且用了 `Duration.ofMillis(...)`，实际是 30 毫秒，会导致高频异步补池检查。

4. 用压缩后 Redis list 长度估算剩余抽奖次数不精确。  
   `laneSize * 4 < rule.sunAmount() * 2` 假设压缩率稳定，但连续未中奖段会被压成一个负数。这个估算可能造成过早补池或补池不足。

5. 新人轨道并发不严谨。  
   新人判断先读缓存/DB，抽奖后异步累计。并发多笔送礼可能都看到“还是新人”，超额进入新人轨道；异步更新失败也会延长新人状态。

6. `GiftLuckLaneRaffle.remainTimes` 语义在成功和异常路径不一致。  
   成功路径里表示剩余次数；Lua/Redis 异常返回时，`raffleGiftLickLaneUntil` 里塞的是已抽次数，后续代码也按已抽次数使用。这容易误导维护者。

7. 多收礼人场景是合并抽奖。  
   抽奖次数是 `amount * recipients.size`，返奖统一给送礼方，不是每个收礼人独立抽一组。如果产品理解是“每个 recipient 独立展示/独立中奖”，这里会有口径偏差。

8. 规则缓存需要主动刷新。  
   `giftLuckLaneRuleCache` 1 小时过期，DB 改规则后需要触发 Apollo refresh key 才能立即生效；否则会出现后台已改、服务仍用旧规则的窗口期。

9. 区域/共享轨道锁粒度偏粗。  
   补池锁只按 `giftId` 拼 key，未带 region/laneKey；区域轨道或共享 key 场景下可能互相串行，影响补池效率和问题定位。

## 6. 建议

1. 把幸运礼物规则做成版本化配置：规则 JSON、绑定关系、Apollo 新人配置都落 DML 或配置版本表，发版/运营变更可审计、可回滚。
2. 增加概率报表：每次规则发布自动输出每个礼物的 `P(倍数)`、中奖率、返奖 RTP、收礼侧成本、综合成本。
3. 修正补池间隔：若预期是 30 秒，改成 `Duration.ofSeconds(30)` 或把常量改为 `30_000L`。
4. 给 Redis 轨道维护独立剩余次数计数，不要用压缩 list 长度近似。
5. 新人轨道改为 Redis Lua 原子判断+累计，避免并发超额。
6. 返奖改成可靠补偿链路：至少要有中奖结果落库、返奖幂等单号、失败补偿 job，而不是只发告警。
7. 明确 RTP 口径：返奖 RTP、收礼侧收益、活动积分、公会结算分别统计，不要混成一个数字。

## 7. 精确线上数据导出 SQL

如果要把上面的“历史配置快照表”替换成真实线上每个礼物 id/名称的表，需要导出下面数据：

```sql
select
  g.id as gift_id,
  g.gift_name,
  g.coin,
  g.type,
  g.status,
  l.lane_rule_id,
  l.lane_key,
  l.lane_type,
  l.region as lane_region,
  r.rule_name,
  r.rule,
  r.newcomer,
  r.status as rule_status,
  r.coin as rule_coin
from app_payer_gift_luck_lane l
join app_payer_gift_luck_lane_rule r
  on r.lane_rule_id = l.lane_rule_id
left join app_payer_gift g
  on g.id = l.gift_id
where g.status = 1
  and ((g.type & 2) <> 0 or (g.type & 32) <> 0)
order by g.coin, g.id;
```

新人轨道还需要 Apollo：

```text
payer.gift.luck.newcomerGiftIds
payer.gift.luck.newcomerLaneRule
```

以及新人规则本身：

```sql
select lane_rule_id, gift_id, rule_name, rule, newcomer, status, coin
from app_payer_gift_luck_lane_rule
where newcomer = 1
order by gift_id, lane_rule_id;
```
