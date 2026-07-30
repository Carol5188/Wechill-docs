#  WeChill Server 现有风控逻辑梳理

版本：v1.0  
生成时间：2026-07-07 10:54 CST  
代码来源：`/Users/xinyintiaodong/Downloads/server.rar`  
解压目录：`/private/tmp/wechill_server_extract`  

> 说明：本文按当前代码包静态梳理，重点还原“已经存在的服务端风控能力、触发入口、处置动作、名单/表结构、后台能力与已发现风险点”。部分能力受 Apollo/配置开关影响，且代码包中存在若干“框架已接入但执行路径被关闭/模拟通过”的情况，文末单独列出。

## 1. 总览

当前代码里的风控不是单一“封号系统”，而是分布在多个服务里的组合能力：

| 层级 | 模块 | 主要能力 | 处置形态 |
|---|---|---|---|
| 网关入口层 | `app-gateway` | IP 黑名单、路径黑名单、停服白名单、内部接口禁止外调 | 直接拒绝请求 |
| 登录与设备层 | `app-user` | 设备环境识别、危险设备/异常设备、安全用户等级、账号/设备/手机号/三方/邮箱封禁 | 禁止登录、弹封禁窗、标记危险、踢下线 |
| 内容审核层 | `app-state`、`app-bases/audit`、`app-chat` | 图文审核、私聊/群聊广告拦截、敏感词替换、批量私聊行为告警 | 拦截/替换/告警/异步隐藏 |
| 直播互动层 | `app-live`、`im-live` | 直播封禁、直播禁言、禁麦/禁视频、直播截图风控、列表隐藏 | 禁播、禁言、隐藏、警告、结束直播/通话 |
| 支付资产层 | `app-payer` | 充值限额/封禁/白名单、地区充值风险、红包风控、钻石兑换金币黑名单、提现档位/白名单 | 充值拦截、隐藏档位、红包入口禁用、限制返奖、后台黑名单 |
| 后台运营层 | `admin-content` | 封号封设备、设备/手机号白名单、直播封禁、红包风控后台、通用黑白名单 | 人工处置、查询、解封、续期、调级 |
| 实时 IM 层 | `im-*` | SmartFox 连接层 Ban/Kick、直播间禁言/禁麦/禁视频变量同步 | 实时房间权限控制 |

## 2. 风控分类与封禁类型建议

结合代码现状，后台筛选项不建议只叫“封禁类型”，建议拆成“处置类型/业务域/作用对象”。如果前端只能放一个筛选，可先用以下枚举：

| 筛选项 | 代码中对应能力 | 说明 |
|---|---|---|
| 账号封禁 | `app_user_ban.user_id` | 禁止账号登录/使用，通常同步更新 `app_user.status=DISABLED` |
| 设备封禁 | `app_user_ban.unique_id + app_type` | 禁止设备登录；后台“封号封设备”会封当前设备及设备下关联账号 |
| 手机号封禁 | `app_user_ban_phone` | 登录/注册校验时按手机号维度拦截 |
| 三方账号封禁 | `app_user_ban_third` | 按第三方账号维度拦截 |
| 邮箱封禁 | `app_user_ban_email` | 按邮箱维度拦截 |
| 充值封禁 | `app_payer_recharge_ban.limit_type=3` | 官方充值准备阶段直接拒绝 |
| 充值限额 | `app_payer_recharge_ban.limit_type=1/2` 或全局 500 美金 | 非完全封禁，但会阻断超额充值 |
| 红包危险级 | `app_payer_red_packet_risk_log.blacklist_level=3` | 不展示红包入口，禁发禁领 |
| 红包限制级 | `blacklist_level=2` | 可发可领，但发红包不享返奖 |
| 直播封禁 | `app_live_ban.type` | 坐等/直播/派对/游戏/短剧能力封禁 |
| 直播间禁言 | `app_live_message_ban` | 房间内公屏禁言，不等同账号封禁 |
| 派对游戏短局限制 | Redis `live:party-game:risk-duration:flag` | 异常短局多次后，限制非免费游戏上座 |
| 钻石兑换金币黑名单 | `app_common_access_list.biz_code=PAYER_DIAMONDS_PURCHASE` | 通用黑名单承载 |

## 3. 网关入口风控

涉及模块：`app-gateway`

### 3.1 配置项

`RequestProperties` 使用 `gateway.request` 前缀，包含：

| 配置 | 作用 |
|---|---|
| `stopServing` / `stopAdminServing` | App/Admin 停服开关 |
| `stopServingIps` | 停服白名单 IP |
| `blacklistIps` | IP 黑名单，支持 IP 段/CIDR |
| `blacklist` | 路径黑名单 |
| `whitelist` | 无需 token 的路径白名单 |
| `safePaths` | 三方访问等自保证安全路径 |
| `monitorUserIds` | 监控用户 ID |
| `minLogExecuteTime` / `minAlarmExecuteTime` | 慢请求日志/告警阈值 |

### 3.2 执行逻辑

`AccessFilter` 在请求入口处理：

1. 内部接口路径包含 `/internal` 时禁止外部访问，返回服务不存在。
2. 命中 `blacklistIps` 返回 `ACCESS_REJECT`。
3. 命中路径黑名单返回 `ACCESS_REJECT`。
4. 停服场景下，非白名单 IP 被停服响应拦截。

### 3.3 特点

- 优点：拦截位置靠前，适合处理攻击流量、临时关闭故障接口。
- 边界：不识别用户业务状态，无法做精细化风控。

## 4. 账号、设备与登录风控

涉及模块：`app-user`、`admin-content`

### 4.1 账号/设备封禁数据模型

核心表：`app_user_ban`

| 字段 | 含义 |
|---|---|
| `ban_id` | 封禁记录 ID |
| `app_type` | 应用类型，`-1` 表示全 App |
| `unique_id` | 设备 ID，存在时表示设备封禁 |
| `user_id` | 用户 ID，存在时表示账号封禁 |
| `ban_reason_type` | 封禁原因 |
| `remark` | 备注 |
| `expired_time` | 到期时间 |
| `status` | 是否生效 |
| `admin_user_id` / `manager_user_id` | 后台管理员/房间管理员操作来源 |
| `create_time` / `update_time` | 创建/更新时间 |

扩展封禁表：

- `app_user_ban_phone`：手机号维度封禁。
- `app_user_ban_third`：三方账号维度封禁。
- `app_user_ban_email`：邮箱维度封禁。

### 4.2 封禁原因

`UserBanReasonType` 当前覆盖：

| 类型 | 原因 |
|---|---|
| 0 | 非法平台 |
| 1 | 广告 |
| 2 | 未成年 |
| 3 | 涉嫌广告、骚扰用户、不当言论 |
| 4 | 涉嫌虚假充值 |
| 5 | 多次展示令人不适的内容 |
| 6 | 多次被人举报未成年 |
| 7 | 多次被人举报色情 |
| 8 | 多次被人举报黑屏 |
| 9 | 多次违规昵称，疑似性暗示/广告/社恐 |
| 10 | 直播间非账号本人在直播 |
| 11 | 一个人同时开启多个直播间进行直播 |
| 12 | 直播间睡觉 |
| 13 | 房间过于昏暗 |
| 14 | 衣着过于暴露 |
| 15 | 多次上传违规内容 |
| 16 | 多人出镜 |
| 17 | 冒充平台身份 |

### 4.3 登录校验链路

`UserBanServiceImpl` 中存在多条校验：

| 方法 | 校验对象 | 命中动作 |
|---|---|---|
| `checkBanDevice` | 当前设备、危险设备 | 抛 `DEVICE_BAN` 封禁弹窗 |
| `checkBanDeviceOrPhoneNumber` | 设备或手机号 | 抛设备/手机号封禁 |
| `checkBanDeviceOrThird` | 设备或三方账号 | 抛设备/三方封禁 |
| `checkBanDeviceOrEmail` | 设备或邮箱 | 抛设备/邮箱封禁 |
| `checkUser` | 用户状态/封禁到期 | 未过期弹封禁窗；过期则恢复启用 |
| `checkDevice` | 设备封禁传导用户 | 当前设备命中封禁时，为当前用户补写账号封禁并拒绝 |

关键点：

- 设备封禁可“传导”到登录该设备的账号：`checkDevice` 会保存新的 `UserBanPo(userId=当前用户)`。
- 过期封禁自动失效：`checkUser` 和定时任务都会处理过期恢复。
- 审核用户有特殊豁免：部分用户状态禁用时，如果是 audit user 会跳过。

### 4.4 自动解封任务

`UserBanJob`：

- XXL Job：`banExpiredAutoUnbanJob`
- 注释频率：约 5 分钟
- 扫描过期且生效的封禁记录，批量置失效并刷新缓存。

### 4.5 后台封号/封设备

`admin-content` 的 `ContentUserBanServiceImpl` 提供后台操作：

| 后台封禁类型 | 枚举 |
|---|---|
| 正常 | `ContentUserBanType.NORMAL=0` |
| 封号 | `BANNED=1` |
| 封号封设备 | `DEVICE_BANNED=2` |

后台封禁时长：

- 1 小时
- 1 天
- 2 天
- 3 天
- 7 天
- 永久（9999999 小时）

封号封设备流程：

1. 根据 `userNumber` 查用户。
2. 找当前设备 `uniqueId`。
3. 查询该设备下全部账号。
4. 写入设备封禁，`app_type=-1`。
5. 写入目标用户账号封禁。
6. 对同设备其他账号逐个写账号封禁。
7. 更新用户状态为 `DISABLED`。
8. 踢出通话和直播。
9. 如果被封用户有关联后台账号，也会后台登出。

边界保护：

- 同设备关联账号数 >=10 且操作者不是超级管理员 `adminUserId=1` 时，拒绝操作并提示联系研发，避免大面积误伤。
- 按 userId 解封时，会尝试同步解除该用户当前设备的有效设备封禁，否则用户仍可能因设备封禁无法登录。

## 5. 设备安全与安全用户等级

涉及模块：`app-user`

### 5.1 设备安全状态

`DeviceSafeType`：

| 类型 | 含义 |
|---|---|
| `NORMAL=0` | 正常设备 |
| `DANGER=1` | 危险设备，禁止登录 |
| `ABNORMAL=2` | 异常设备，无法转变为安全用户 |

核心表：`app_common_device_safe`

| 字段 | 含义 |
|---|---|
| `unique_id` | 设备 ID |
| `safe_type` | 设备安全状态 |
| `verified_safe` | 人工验证安全 |
| `audit_status` | 审核状态 |
| `verified_audit` | 人工验证审核状态 |

### 5.2 风险识别规则

`DefaultAppDeviceSafeStrategy` 基于设备与网络环境判断：

危险设备条件包括：

- 中国 MCC/MNC。
- 中国 IP。
- 审核版本以外，中文语言 + VPN。
- 中文语言 + 时区与 IP 时区不匹配。

异常设备条件包括：

- VPN。
- MCC/MNC 缺失。
- Mock location。
- 中文语言。
- IP 信息缺失或异常。
- 时区不匹配。

策略实现：

| 策略 | 行为 |
|---|---|
| `DefaultAppDeviceSafeStrategy` | 按上述规则识别 |
| `StrictAppDeviceSafeStrategy` | 继承默认逻辑 |
| `LooseAppDeviceSafeStrategy` | 始终返回正常 |

### 5.3 白名单绕过

`AppDeviceWhitelistServiceImpl` 支持：

- IP 白名单：`userLoginProperties.ipWhitelist`
- 设备白名单：`app_common_device_whitelist`
- 手机白名单：`app_common_phone_whitelist`
- 测试设备白名单：`testDeviceWhitelist`

命中白名单后，可跳过设备安全校验、短信风控、登录限制等。

后台入口：`admin-content/app/whitelist`

| 功能 | 接口能力 |
|---|---|
| 根据 userNumber 查设备码 | `device/simple` |
| 根据危险序列号查设备码 | `device/simple/index` |
| 查询设备下账号 | `device/unique-id` |
| 查询/添加/删除设备白名单 | `device/list`、`device/add`、`device/remove` |
| 查询/添加/删除手机号白名单 | `phone/list`、`phone/add`、`phone/remove` |

### 5.4 安全用户等级

`UserSafeLevelType`：

- Level 0：非安全用户
- Level 1：一级用户
- Level 2：二级用户
- Level 3：三级用户

自动升级任务：

| Job | 频率/说明 |
|---|---|
| `abnormalUserUpgradeScanJob` | 扫描异常用户转正常 |
| `normalUserUpgradeScanJob` | 扫描正常用户安全等级升级 |

升级依据包括：

- 是否投放/公会/家族来源。
- 充值总额。
- 活跃天数。
- 女用户评级。
- 是否新用户。

默认阈值示例：

| 配置 | 默认 |
|---|---|
| 异常用户转正常充值阈值 | 50000 coin |
| 普通用户 Level0 -> Level1 | 10000 coin |
| 普通用户 Level1 -> Level2 | 30000 coin + 活跃条件 |
| 普通用户 Level2 -> Level3 | 500000 coin + 连续活跃 |
| 投放用户 Level2 -> Level3 | 10000 coin |

### 5.5 关键配置

`UserLoginProperties`：

| 配置 | 默认/作用 |
|---|---|
| `safeLoginLimit` | 是否在登录时拦截危险设备 |
| `safeEnabled` | 非线上环境可关闭安全检查 |
| `dangerCheckEnabled` | 是否检查危险设备 |
| `userInfectDeviceEnabled` | 危险用户是否传导危险设备，默认 false |
| `deviceRegisterMax` | 单设备注册上限，默认 5 |
| `deviceUserMax` | 单设备用户上限，默认 5 |
| `banAreaCodes` | 默认 `48,670` |
| `dangerAreaCodes` | 危险区号 |
| `ignoreAreaCodes` | 默认 `92` |
| `richLevelExemption` / `charmLevelExemption` | 高等级豁免 |

## 6. 短信风控

涉及模块：`app-user`

### 6.1 设计链路

`AppSmsServiceImpl` 发送验证码前：

1. 判断是否模拟发送。
2. 判断 IP/设备/手机号是否白名单。
3. 非模拟且非白名单，调用 `AppSmsRiskService.checkSmsRisk`。
4. 风控不通过则抛 `SEND_CODE_ERROR`。

`AppSmsRiskServiceImpl` 设计上接入 Telesign：

- 请求地址：`https://rest-ww.telesign.com/v1/score/{phone}`
- 参数包含：
  - `account_lifecycle_event`
  - `request_risk_insights=true`
  - `originating_ip`
  - `device_id`

### 6.2 阈值

`AppSmsRiskProperties`：

| 配置 | 默认 |
|---|---|
| `highRiskScore` | 650 |
| `highRiskScoreCore["84"]` | 401 |
| 高风险缓存 | 30 分钟 |

### 6.3 当前代码现状

`AppSmsRiskServiceImpl.checkSmsRisk` 开头存在：

```kotlin
val disabled = true
if (disabled) {
    return true
}
```

也就是说：当前代码包中短信风控被硬编码临时关闭，不会真正请求 Telesign，也不会拦截短信发送。

## 7. 内容审核与聊天风控

涉及模块：`app-state`、`app-bases/bases-provider/audit`、`app-chat`

### 7.1 图文风险类型

`RiskType.RiskFromType` 覆盖：

| 类型 | 场景 | 同步/异步 | 标签 |
|---|---|---|---|
| 1 | 头像/相册 | 同步 | 广告、二维码、色情 |
| 2 | 私聊 | 同步 | 广告、二维码、色情 |
| 3 | 封面照 | 同步 | 色情 |
| 4 | 直播 | 异步 | 色情 |
| 5 | 免费通话 | 异步 | 色情 |
| 6 | 付费通话 | 异步 | 色情 |
| 7 | 打招呼 | 同步 | 色情 |
| 8 | 私聊图片广告 | 同步 | 广告 |
| 9 | 视频派对 | 异步 | 色情 |
| 10 | 派对背景 | 异步 | 色情 |
| 11 | 群聊 | 同步 | 广告、二维码、色情 |
| 12 | 社区 | 同步 | 广告、二维码、色情 |
| 13 | 公会头像 | 同步 | 广告、二维码、色情 |

风险等级：

- `PASS=0`
- `REVIEW=1`
- `BLOCK=2`

标签：

- `PORN=100`
- `AD=200`
- `QR_CODE=210`

### 7.2 图片审核链路

`StatePhotoRiskServiceImpl`：

| 方法 | 用途 |
|---|---|
| `checkImageRisk` | 同步审核；保存明细；发送 SNS 风险事件 |
| `checkImageRiskAsync` | 异步审核；保存异步明细 |
| `imageRiskNetEaseCallBack` | 处理网易异步回调；补全风险等级/标签；发送 SNS |

### 7.3 当前图片审核现状

`NetEasePhotoRiskHandler.imageRisk` 当前同步路径直接返回模拟通过：

```kotlin
return simulationImageRiskDto(...)
```

真实网易同步请求代码被注释。异步路径仍会在非模拟环境调用网易 `asyncCheck`。

结论：

- 私聊图片、群聊图片、头像/相册等同步图审在当前代码包中疑似直接 PASS。
- 直播/通话/派对视频等异步图审仍有真实调用路径，但受模拟环境配置影响。

### 7.4 文本审核链路

`TextAntiRiskServiceImpl` 根据 `RiskTextFromType.provider` 分发到文本审核 handler。

文本场景包括：

- 昵称
- 私聊
- 打招呼
- About me
- 私聊文本广告
- 公屏文本广告
- 欢迎语
- 群聊
- 社区

### 7.5 当前文本审核现状

`NetEaseTextRiskHandler.textRisk` 当前直接返回模拟通过：

```kotlin
return simulationTextRiskDto(content)
```

真实网易文本检测代码被注释。

结论：

- 当前代码包中同步文本审核疑似不会真实拦截。
- 业务侧仍保留广告标签拦截、敏感词替换等处理代码，但取决于审核返回。

### 7.6 私聊/群聊处理逻辑

私聊文本：

1. 币商白名单且非审核用户时跳过。
2. 普通用户给审核用户发命中特定模板内容，直接拦截并告警。
3. 家族用户放行。
4. 调用文本审核。
5. 命中广告标签：拦截，并调用 `chatMessageRiskService.adRisk`。
6. 风险等级非 PASS：替换敏感词后继续发送。

私聊图片：

1. 调用图片审核。
2. 命中广告策略：拦截，并计入广告风控。
3. `BLOCK`：拦截并返回图片风险错误。

群聊文本：

1. 调用文本审核，场景为 `GROUP`。
2. 命中广告：直接拦截。
3. 非 PASS：替换敏感词。

群聊图片：

1. 调用图片审核，场景为 `GROUP_MESSAGE`。
2. 命中广告：拦截。
3. `BLOCK`：失败并提示图片风险。

### 7.7 私聊行为风控

`ChatMessageRiskServiceImpl` 是“发送行为告警”，不是直接封禁：

| 规则 | 默认阈值 | 窗口 | 动作 |
|---|---:|---|---|
| 相同文本 SHA256 | >=10 次 | 24 小时 | 告警 |
| 相似文本 SimHash | >=15 次，相似度 >=0.7 | 24 小时 | 告警 |
| 多人触达 | >=20 人 | 24 小时 | 告警 |
| 广告风控次数 | >=3 次 | 24 小时 | 告警 |

豁免：

- `chat.risk.enabled=false` 时整体关闭。
- 文本长度 <10 不处理。
- 风控白名单。
- 币商白名单。
- 官方用户。

## 8. 直播与实时互动风控

涉及模块：`app-live`、`im-live`

### 8.1 直播封禁类型

`LiveBan.Type`：

| 类型 | 说明 | 对应处罚 |
|---|---|---|
| 1 | 坐等 | `BAN_WAIT` |
| 2 | 直播 | `BAN_LIVE` |
| 3 | 派对 | `BAN_PARTY` |
| 4 | 游戏 | `BAN_GAME` |
| 5 | 短剧 | `BAN_SHORT_PLAY` |

封禁时长：

- 1 小时
- 3 小时
- 6 小时
- 12 小时
- 1 天
- 2 天
- 3 天
- 7 天
- 永久

系统封禁原因：

- 自动封禁
- 男用户不允许接单
- 举报封禁

旧直播封禁原因还包含未成年、色情、广告骚扰、不露脸、躺播、背景杂乱、睡觉等。

### 8.2 直播封禁执行

`LiveBanServiceImpl.ban`：

1. 写 `LiveBanDetailPo` 明细。
2. 更新/插入 `LiveBanPo` 当前有效封禁。
3. 删除 Redis 缓存。
4. 更新缓存池。

`LiveBanClientImpl.ban`：

1. 调用 `LiveBanService.ban`。
2. 调用 `liveSystemStopService.systemEndByUser` 结束对应直播类型。

后台 `ContentLiveBanServiceImpl.liveBan`：

1. 调 live-service 封禁。
2. 写处罚明细。
3. 异步发送官方通知。
4. 如果用户正在直播，向直播间发送警告。

### 8.3 直播间公屏禁言

`LiveMessageBanServiceImpl`：

| 能力 | 说明 |
|---|---|
| 禁言/解禁 | 按直播间 + 用户维度记录 |
| 时长校验 | 必须在枚举内 |
| VIP 防禁言 | 有防禁言特权且操作者 VIP 不高于被禁用户时禁止 |
| 权限校验 | 操作者需具备 `BAN_MESSAGE` 权限 |
| 到期刷新 | 定期/刷新时更新过期禁言状态 |

新禁言时长：

- 30 分钟
- 12 小时
- 72 小时
- 1 周
- 1 个月
- 12 个月

兼容旧时长：

- 1 分钟
- 5 分钟
- 15 分钟
- 1 小时
- 1 天
- 3 天

### 8.4 直播截图风控

`ScreenshotStrategyServiceImpl` 对直播、派对、通话截图做异步审核：

1. 根据场景和间隔判断是否需要送审。
2. 调用 `statePhotoRiskClient.photoRiskAsync`。
3. 回调后按风险等级更新计数。
4. 交给具体场景 handler 处理。

直播场景：

- 主播离开时不送审。
- 风险标签重新计算后调用 `LiveRiskLabelService.checkHide`。
- 第 1 次 `BLOCK`：直播间警告、遮罩、记录处罚。
- 第 2 次及以上 `BLOCK`：
  - 女用户：走 female block 逻辑。
  - 男用户：封禁直播 12 小时。
  - 结束直播。

派对视频场景：

- 主播命中风险时会检查是否隐藏列表。
- 第 1 次 `BLOCK`：警告并记录处罚。
- 后续 `BLOCK`：封禁直播 24 小时并警告。

通话场景：

- 免费/付费通话送审策略不同。
- 付费通话审核受 `PAID_CALL_RISK_SWITCH` 控制。
- `BLOCK` 达到警告次数时发警告和遮罩。
- 超过警告次数后，普通情况下自动结束通话。
- 投放用户或部分短时发送方风险场景，不直接结束，倾向遮罩保护。

### 8.5 直播列表隐藏

`LiveRiskLabelServiceImpl` 根据图片标签计算风险：

| 条件 | 风险等级 |
|---|---|
| 色情分 >=0.9 | BLOCK |
| 色情分 >=0.76 | REVIEW |
| 低俗分 >=0.76 | REVIEW |
| 其他 | PASS |

隐藏逻辑：

- `PASS`：不处理。
- `BLOCK`：立即隐藏。
- `REVIEW`：5 分钟内累计 2 次后隐藏。
- 隐藏成功后：
  - 调 `listPageClient.riskHideV2`。
  - 写 `LIST_HIDE` 处罚明细。
  - 60 秒内只通知一次。
  - 发送直播风险隐藏提示。

### 8.6 IM 实时房间层

`im-live` 中存在：

- 直播间禁麦：`LiveSiteMicBanHandle`
- 直播间禁视频：`LiveSiteVideoBanHandle`
- 用户变量同步禁言状态：`ImLiveBanMessageDto`
- 房间变量同步禁言用户列表：`banMessageUser`

SmartFox zone 配置中也有 kicks before ban 等基础连接层限制：

- `kicksBeforeBan=2`
- `kicksBeforeBanMinutes=3`
- `secondsBeforeBanOrKick=5`
- `secondsBeforeBan=5`

这些属于实时连接/房间权限控制，不等同于业务账号封禁。

## 9. 派对游戏与玩法资产风控

涉及模块：`app-live`

### 9.1 异常短局限制

`PartyGameProperties.riskRules` 用于“防止通过游戏刷 diamonds”。

默认规则示例：黑八 `PartyGameType.BLACK8`

| 条件 | 规则 |
|---|---|
| 单局时长 | <=30 秒才进入统计 |
| 24 小时内 | >=10 次，封禁 60 分钟 |
| 5 分钟内 | >=3 次，封禁 2 分钟 |

执行：

1. 游戏结算时统计参与用户。
2. 若单局耗时小于等于 `minTime`，写入 Redis ZSet。
3. 命中规则后写入 `PARTY_GAME_RISK_DURATION_FLAG`。
4. 用户上座非免费游戏时，如果存在该 flag，则拒绝上座。

### 9.2 黑产提现用户限制

`PartyGameSiteServiceImpl.upSite`：

- 如果用户在 `blackIndustryProperties.banWithdraws` 中，且当前游戏是黑八，直接关闭功能。

该规则更像黑产名单能力，数据来源需要结合配置确认。

## 10. 支付与资产风控

涉及模块：`app-payer`、`app-bases/tools`、`admin-content`

### 10.1 充值限额/封禁

核心表：

- `app_payer_recharge_ban`
- `app_payer_recharge_ban_log`
- `app_payer_recharge_whitelist`
- `app_payer_recharge_summary`

`app_payer_recharge_ban.limit_type`：

| 值 | 含义 |
|---:|---|
| 0 | 无限制 |
| 1 | 限额 200 美金 |
| 2 | 限额 1000 美金 |
| 3 | 已限制充值/充值封禁 |

`PayerRechargeLimitServiceImpl.checkRechargeAllowed`：

1. 命中充值白名单，直接通过。
2. 查询用户充值封禁配置。
3. 查询官方充值总额 `officialTotalUsd`。
4. 根据 `limit_type` 判断：
   - 3：返回 `RECHARGE_BANNED_MANUAL`
   - 1：本次 + 官方总额 >200，返回 `RECHARGE_LIMITED_MANUAL`
   - 2：本次 + 官方总额 >1000，返回 `RECHARGE_LIMITED_MANUAL`
   - 其他：本次 + 官方总额 >500，返回 `RECHARGE_LIMITED_GLOBAL`

触发入口：

- `PayerRechargeServiceImpl.rechargePrepare`
- 仅官方渠道校验：iOS/Android 且 priceId 不包含 H5。
- 命中后会按语言取 `recharge_limit_reached` 文案，找不到再回退默认错误。

后台能力：

- 查询用户充值限制状态。
- 设置/更新充值限制。
- 写操作日志。
- 充值白名单查询、添加、移除、预览用户信息。

### 10.2 充值拒绝 Banner / 地区拒绝

`RechargeRejectServiceImpl.filterRechargeReject`：

1. 根据 `appType_platformType` 取拒绝国家列表。
2. 必须满足：
   - `rechargeRejectEnabled=true`
   - 用户已充值 `recharged=YES`
3. 设备国家或 IP 国家命中配置国家列表，返回拒绝。

触发入口：

- `rechargePrepare` 阶段，命中后抛 `RECHARGE_REJECT_NOTE_ERROR`。

### 10.3 台湾商店充值风控

台湾用户规则：

- 用户设备 IP 国家或首次 IP 国家为 `TW`。
- 仅 Apple/Google 商店充值。
- 非台湾充值白名单。

统计：

- 连续次数 key：`PAYER_RECHARGE_TW_STORE_CONTINUOUS_NUM`
- 连续金额 key：`PAYER_RECHARGE_TW_STORE_CONTINUOUS_AMOUNT`
- 默认窗口：24 小时

阈值：

| 配置 | 默认 |
|---|---:|
| `twRechargeRiskCount` | 3 |
| `twRechargeRiskAmount` | 100 |
| `twRechargePriceMaxAmount` | 30 |

动作：

- `twStoreRechargeCheck` 命中次数或金额阈值后，`rechargePrepare` 直接抛 `CHANNEL_NOT_SUPPORT_ERROR`。
- 台湾用户非白名单时，充值档位列表只展示低于 `twRechargePriceMaxAmount` 的档位。

### 10.4 越南 Apple 充值风险

规则：

- 仅 iOS。
- 用户识别为 VN 用户。
- 非越南充值风控白名单。

统计维度：

- 用户账号：`PAYER_RECHARGE_APPLE_VN_RISK_ACCOUNT`
- IP：`PAYER_RECHARGE_APPLE_VN_RISK_IP`
- 设备：`PAYER_RECHARGE_APPLE_VN_RISK_DEVICE`

窗口：

- 每次充值后递增金额，TTL 30 天。

阈值：

- `vnRechargeRiskAmount` 默认 30。

动作：

- 获取充值档位时，如果任一维度累计金额 > 阈值，返回空档位列表。
- 同时写入 `app_payer_vn_recharge_risk_detail`，标记风险类型：
  - 用户
  - IP
  - 设备

### 10.5 越南白名单限额

白名单用户不会走越南充值过滤，但会统计每日额度：

| appType | 默认限额 |
|---:|---:|
| 0 | 2050 |
| 5 | 550 |

超过限额后调用 `userInfoClient.kick` 踢下线。

### 10.6 商店连续充值预警

`rechargeRiskEarlyWarning` 当前保留 1 分钟连续充值计数，但真实告警发送逻辑被注释。

结论：当前代码包中这条只计数，不发送告警。

## 11. 红包风控

涉及模块：`app-payer`

### 11.1 红包风控等级

`RedPacketBlackListLevelType`：

| 等级 | 说明 | 业务动作 |
|---|---|---|
| 0 不加黑 | 无处置 | 不影响 |
| 1 观察名单 | 仅告警，不直接拦截 | 待审核 |
| 2 限制级 | 可发可领，但发放红包限制返奖资格 | 已风控 |
| 3 危险级 | 不展示红包入口，禁发禁领 | 已风控 |

用户当前红包风控状态由 `PayerRedPacketRiskLogService.queryUserActiveRiskState` 计算：

- 只统计未过期的限制级/危险级。
- 危险级优先级高于限制级。
- 危险级：
  - `hideRedPacketEntry=true`
  - `canSendRedPacket=false`
  - `canReceiveRedPacket=false`
- 限制级：
  - `canSendRedPacket=true`
  - `canReceiveRedPacket=true`
  - `canEnjoyRebateWhenSend=false`

### 11.2 红包风控日志表

核心表：`app_payer_red_packet_risk_log`

| 字段 | 含义 |
|---|---|
| `user_id` | 风控用户，可空 |
| `room_id` | 房间 ID |
| `red_packet_id` | 红包 ID |
| `source` | 命中来源 |
| `rule_type` | 命中规则 |
| `hit_detail` | JSON 证据 |
| `process_status` | 待审核/已风控 |
| `alert_status` | 飞书发送状态 |
| `blacklist_level` | 观察/限制/危险 |
| `black_reason` | 加黑原因 |
| `process_source` | 处理来源 |
| `operator_user_id` | 操作人 |
| `expire_at` | 过期时间，空表示永久 |

### 11.3 红包风控规则

`RedPacketRiskRuleType`：

| 类型 | 名称 | 等级 | 描述 |
|---:|---|---|---|
| 1 | 同设备互抢 | 观察 | 同一红包多个账号来自同设备 |
| 2 | 同 IP 互抢 | 观察 | 同一红包多个账号来自高风险同 IP |
| 3 | 多账号互抢 | 限制 | 多账号互抢 |
| 4 | 1 小时达标红包次数超限 | 观察 | 单用户 1 小时内发送达标红包次数 >30 |
| 5 | 1 小时达标红包总额超限 | 观察 | 单用户 1 小时内达标红包总金额 >3,000,000 |
| 6 | 每日平台返奖超限 | 观察 | 全站每日返奖预算 2,000,000 金币 |
| 7 | 10 分钟 B 档 >=10 笔 | 观察 | 同房间 10 分钟内 >=10 笔 B 档红包 |
| 8 | 10 分钟 B 档 >=20 笔 | 限制 | 同房间 10 分钟内 >=20 笔 B 档红包 |
| 9 | 固定核心领取团伙 | 观察 | 同房间自然日 50 个有效红包中固定 5 人全勤领取 |
| 10 | 送礼占比过低 | 限制 | 红包消耗高但自然送礼低 |
| 11 | 红包中奖率异常高 | 限制 | 房间中奖率显著高于正常区间 |
| 12 | 疑似机器人抢包 | 限制 | 连续两次抢红包间隔 <500ms |
| 100 | 后台手动风控 | 限制 | 后台管理风控 |

### 11.4 实时领取/发送风控

发红包：

- 发送金币红包/礼物红包前检查 `canSendRedPacket`。
- 危险级用户不能发送。
- 发送后调用 10 分钟 B 档红包数量规则。

领红包：

- 领取前检查 `canReceiveRedPacket`。
- 危险级用户不能领取。
- 同用户重复领取：直接拒绝。
- 同设备重复领取：
  - 写观察名单日志。
  - 发送飞书。
  - 拒绝领取。

领取成功后：

- 机器人快速抢包：同用户连续两次领取间隔 <500ms，写限制级。
- 同 IP：同红包同 IP 领取用户数 >=5，批量写观察名单并飞书。
- 发送人 1 小时达标红包次数/金额：
  - 次数 >30 写观察名单。
  - 金额 >3,000,000 写观察名单。
- 红包领完后：
  - 同房间自然日达标场次达到 50 时，检查是否存在 5 人固定核心全勤领取。

返奖结算：

- 当日全站返奖金额 >=2,000,000 金币时，发送飞书并不再返奖。
- 发送人处于限制级/危险级时，不享受返奖。

### 11.5 隔天房间统计风控

XXL Job：`payerRedRoomDailyRiskStatJob`

统计昨天房间维度：

- A/B 档发出红包数。
- A/B 档中奖红包数。
- A/B 档中奖率。
- 房间礼物金币消耗。
- 房间红包金币消耗。

触发规则：

| 规则 | 条件 | 动作 |
|---|---|---|
| 中奖率异常高 | A 档中奖率 >4% 或 B 档中奖率 >6% | 昨天该房间发过红包的用户逐个写限制级日志并飞书 |
| 送礼占比过低 | `giftCoinCost / (giftCoinCost + redPacketCoinCost) < sendGiftRate`，默认 0.3 | 昨天该房间发过红包的用户逐个写限制级日志并飞书 |

### 11.6 红包风控后台

后台能力：

| 能力 | 说明 |
|---|---|
| 风控规则列表 | 返回 `RedPacketRiskRuleType` |
| 风控面板 | 限制级/危险级/观察名单/机器人规则/今日返奖金额 |
| 风控日志列表 | 支持时间、用户、房间、规则、等级、审核状态筛选 |
| 删除风控 | 删除记录并写操作日志 |
| 维持/续期 | 可设置永久或按天延长 |
| 调整等级 | 观察/限制/危险互转 |
| 手动加入 | 默认规则 `ADMIN_CONTENT` |

后台请求中的审核状态：

- 1：待审核，映射 `blacklist_level=1`
- 2：已风控，映射 `blacklist_level in (2,3)`

## 12. 通用黑白名单与钻石兑换金币黑名单

涉及模块：`admin-content`

核心表：`app_common_access_list`

| 字段 | 含义 |
|---|---|
| `biz_code` | 业务编码 |
| `list_type` | 黑名单/白名单 |
| `subject_type` | 主体类型：用户/设备 |
| `subject_value` | 主体值 |
| `enabled` | 是否启用 |
| `reason` | 原因 |
| `start_at` / `expire_at` | 生效/失效时间 |
| `priority` | 优先级 |
| `admin_user_id` | 操作人 |

枚举：

- `CommonAccessListType.BLACK=1`
- `CommonAccessListType.WHITE=2`
- `CommonAccessSubjectType.USER_ID=1`
- `CommonAccessSubjectType.DEVICE_ID=2`

当前已使用业务：

- `PAYER_DIAMONDS_PURCHASE`：钻石兑换金币黑名单。

后台操作：

- 添加用户到钻石兑换金币黑名单。
- 从黑名单移除用户。
- 用户列表/薪资列表会展示 `payerDiamondsPurchaseBlacklisted`。

## 13. 提现相关风控能力

当前代码中提现侧更偏“档位/白名单/审核”：

| 能力 | 表/入口 | 说明 |
|---|---|---|
| 提现限额白名单 | `app_payer_withdraw_limit_whitelist` | 用户维度，状态有效/失效 |
| 公会提现渠道限制 | `app_payer_agency_withdraw_channels_limit` | 按公会限制提现渠道 |
| 用户提现档位 | 后台 `withdrawalLevelByUser` / `withdrawalLevelUpdateByUser` | 管理用户提现档位 |
| 提现审核 | `ContentOperationAuditWithdraw*`、`ContentFinanceWithdraw*` | 运营/财务审核链路 |

未在当前扫描中发现类似“提现封禁”的强拦截黑名单主链路，更多是审核、档位、渠道限制。

## 14. 后台管理现状

`admin-content` 已覆盖的风控后台能力：

| 后台能力 | 说明 |
|---|---|
| 用户封禁列表 | 查询账号/设备封禁 |
| 设备封禁关联账号列表 | 查询 uniqueId 下封禁账号 |
| 封号/封号封设备 | 支持原因、时长、备注 |
| 解封 | 支持按详情/按用户解封，按用户会尝试解除当前设备封禁 |
| 设备白名单 | 支持按用户/危险序列号添加，删除后刷新 Apollo 缓存 |
| 手机号白名单 | 支持添加/删除 |
| 直播封禁 | 封禁坐等/直播/派对/游戏/短剧 |
| 充值封禁/限额 | 支持查询、保存、日志 |
| 充值白名单 | 支持列表、添加、移除、预览 |
| 红包风控 | 支持面板、列表、规则、删除、维持、调级、手动加黑 |
| 钻石兑换金币黑名单 | 通过通用黑名单实现 |
| 提现审核与档位 | 支持审核、代理支付、用户提现档位 |

## 15. 已发现的关键风险点

### 15.1 内容机审同步路径疑似未真正生效

图片同步审核 `NetEasePhotoRiskHandler.imageRisk` 当前直接 `simulationImageRiskDto`。

文本审核 `NetEaseTextRiskHandler.textRisk` 当前直接 `simulationTextRiskDto`。

影响：

- 私聊/群聊/资料等同步内容审核可能全部 PASS。
- 业务侧广告拦截、敏感词替换依赖审核返回，可能无法生效。

建议：

- 与研发确认该代码包是否为线上分支。
- 若线上也是该逻辑，需要恢复真实审核调用或通过配置控制，不建议硬编码直接 PASS。

### 15.2 短信风控硬编码关闭

`AppSmsRiskServiceImpl.checkSmsRisk` 中 `disabled=true`，当前不会请求 Telesign。

建议：

- 改为 Apollo 配置开关。
- 关闭时也记录监控，避免长期无人发现。

### 15.3 风控动作分散，后台筛选需要统一口径

同样叫“风控”，动作差异很大：

- 账号/设备封禁：登录强拦截。
- 充值限额：充值准备阶段强拦截。
- 红包观察名单：只告警，不拦截。
- 红包限制级：不禁发禁领，只限制返奖。
- 直播禁言：房间内权限，不影响登录。
- 直播列表隐藏：影响曝光，不影响直播能力。

建议后台统一展示：

- 业务域：账号、设备、充值、红包、直播、聊天、提现、通用名单。
- 处置等级：观察、限制、封禁、隐藏、告警。
- 作用对象：用户、设备、手机号、IP、房间、红包、直播间。
- 是否强拦截：是/否。
- 是否自动产生：系统自动/后台手动/用户投诉/巡房/人工复核。

### 15.4 白名单权限很高，需要审计

设备/手机号/IP 白名单会跳过较多登录、短信、设备安全规则；充值白名单会跳过充值限额/风险规则。

建议：

- 白名单必须有原因、操作人、有效期。
- 后台列表增加“即将过期/永久白名单”筛选。
- 高风险白名单操作需要二次确认或审批。

### 15.5 设备封禁有传导机制，需防误伤

设备封禁会传导到当前登录用户；后台封设备也会封设备下其他账号。

已有保护：

- 设备关联账号 >=10 时，非超级管理员禁止操作。

建议：

- 后台封设备弹窗必须展示关联账号数、关联账号列表、是否包含高价值/公会/主播用户。
- 对高价值账号、官方账号、管理员账号加二次确认或禁止自动封。

### 15.6 红包风控等级语义需在后台明确

观察/限制/危险差异较大，如果后台只显示“黑名单”容易误解。

建议：

- 列表直接展示业务效果：
  - 观察：仅告警
  - 限制：发红包不返奖
  - 危险：禁发禁领且隐藏入口
- 操作按钮区分“解除”“维持”“升为危险”“降为观察”。

### 15.7 仅告警规则没有自动闭环

私聊行为风控、部分充值连续预警、红包观察名单都偏告警/记录。

建议：

- 明确哪些规则只告警，哪些需要运营复核。
- 对连续命中告警但未处理的用户，自动升级为待审核任务。

## 16. 后续产品/后台补充建议

### 16.1 管理后台筛选项建议

基础筛选：

- 用户 ID / 用户 Number
- 设备 ID / 危险序列号
- 手机号 / 区号
- IP
- 房间 ID
- 业务域
- 封禁/处置类型
- 处置等级
- 命中规则
- 来源：系统自动/后台手动/投诉/巡房/人工复核/关联设备 IP
- 状态：生效中/已过期/已解除/待审核/已风控
- 是否强拦截
- 操作人
- 创建时间/更新时间/到期时间

封禁/处置类型枚举建议：

- 账号封禁
- 设备封禁
- 手机号封禁
- 三方账号封禁
- 邮箱封禁
- 充值封禁
- 充值限额
- 红包观察
- 红包限制
- 红包危险
- 直播封禁
- 直播间禁言
- 直播列表隐藏
- 禁麦
- 禁视频
- 派对游戏短局限制
- 钻石兑换金币黑名单
- 提现限额白名单/提现档位限制
- IP 黑名单
- 路径黑名单

### 16.2 详情页必须展示的证据

| 类型 | 建议展示 |
|---|---|
| 账号/设备封禁 | 关联设备、同设备账号数、封禁原因、封禁来源、到期时间、操作人 |
| 设备安全 | MCC/MNC、IP 国家、语言、时区、VPN、Mock location、危险序列号 |
| 充值限制 | 官方累计充值、当前档位金额、limit_type、白名单状态、命中地区规则 |
| 红包风控 | 规则、红包 ID、房间 ID、命中明细 JSON、等级、是否影响入口/返奖 |
| 直播风控 | 直播 ID、截图审核标签/分数、警告次数、隐藏/封禁动作 |
| 聊天风控 | 文案 hash、相似度、触达人数、广告命中次数、告警发送状态 |

### 16.3 操作确认建议

高风险操作需要二次确认：

- 设备封禁。
- 永久封禁。
- 危险级红包风控。
- 解除设备封禁。
- 添加长期白名单。
- 对高价值/公会/主播用户操作。

确认弹窗建议展示：

- 影响范围。
- 生效时间。
- 到期时间。
- 是否踢下线/结束直播/结束通话。
- 是否同步关联账号。
- 操作原因必填。

## 17. 结论

当前代码已有一套比较完整但分散的风控底座：

1. 登录与设备侧：账号/设备/手机号/三方/邮箱封禁，危险设备识别，安全用户等级。
2. 内容侧：图文审核框架、聊天广告拦截、批量私聊行为告警。
3. 直播侧：直播封禁、禁言、截图风控、列表隐藏、通话/派对风险处理。
4. 支付侧：充值限额/封禁/白名单、台湾/越南地区充值风控、红包观察/限制/危险三级风控。
5. 后台侧：封号封设备、白名单、直播封禁、充值限制、红包风控、通用黑名单等管理能力。

但也存在几个评审必须提前兜住的点：

- 同步图文审核当前代码疑似直接模拟通过。
- 短信风控硬编码关闭。
- 风控动作语义不统一，后台必须把“观察/限制/封禁/隐藏/告警”分清。
- 白名单和设备封禁影响范围大，需要操作审计和二次确认。
- 红包风控已经有完整等级体系，建议不要混入普通账号封禁列表，而是在统一风控后台中作为独立业务域展示。
