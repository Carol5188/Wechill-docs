# wechill 游戏房产品设计框架

> **产品**: wechill  
> **版本**: v1.0  
> **日期**: 2026-04-22  
> **面向**: MENA（中东）语聊房  
> **三方SDK**: BytesunGame（语聊房模式）v1.0.7  

---

## 一、产品定位

### 1.1 核心定位

```
语聊房 + 游戏房 = 社交 + 轻游戏 双轮驱动

wechill 游戏房不是传统游戏房，而是"边玩边聊"的社交催化剂。
游戏是话题，不是目的。
```

### 1.2 目标用户画像

| 画像 | 特征 | 核心诉求 | 占比预估 |
|------|------|---------|---------|
| 社交型玩家 | 以聊天为主，游戏是润滑剂 | 认识人、找话题 | 40% |
| 休闲玩家 | 想玩游戏但不想下载重度App | 即开即玩、轻量 | 30% |
| 组局党 | 拉朋友一起玩 | 社交裂变、好友互动 | 15% |
| 观战党 | 不想玩但想看 | 内容消费、弹幕互动 | 10% |
| 竞技党 | 想赢、想上分 | 排行榜、段位 | 5% |

### 1.3 与现有功能的关系

| 功能 | 游戏房接入点 | 说明 |
|------|-------------|------|
| 红包返奖 | 游戏结算后可触发Lucky Pocket抽奖 | 复用现有返奖分档和风控体系 |
| 龙蛋玩法 | 游戏贡献值计入龙蛋进度 | 按分区独立配置，GMT+3统计 |
| CP/Soul Pair | 游戏内亲密值来源（一起玩） | 同游戏可获得亲密值加成 |
| 风控体系 | 复用红包风控黑名单机制 | 危险级用户禁止进入游戏房 |

---

## 二、房间类型设计

### 2.1 房间分类

| 房间类型 | 核心功能 | 游戏支持 | 典型场景 |
|---------|---------|---------|---------|
| 纯语聊房 | 语音聊天 | 无 | 原有语聊房，保持不变 |
| 游戏房 | 游戏驱动+语音 | Ludo/UNO/Domino等 | 游戏为主，语音辅助 |
| 混合房 | 语聊为主 | 可挂起小游戏 | 聊天为主，随时开一局 |
| 专用房 | 单一游戏深度 | 固定游戏竞技 | 锦标赛/排位赛 |

### 2.2 房间状态机

```
[创建房间] → [等待中] → [准备阶段] → [游戏中] → [结算] → [等待中]
                ↓              ↓            ↓           ↓
           [房间解散]    [玩家上座/下座]  [断线重连]  [再来一局/换游戏]
                              ↓
                        [强制开始/AI补位]
```

### 2.3 中东本地化房间配置

| 配置项 | 默认值 | 中东适配说明 |
|-------|-------|-------------|
| 时区统计 | GMT+3 | 与龙蛋玩法保持一致 |
| 语言默认 | 阿拉伯语(7) | Bytesun language参数 |
| 服务器节点 | gsp=201 | 迪拜AWS，延迟最低 |
| 视觉主题 | 星月/绿洲/灯笼 | 游戏皮肤本地化 |
| 保守分区 | 关闭公开秀关系动画 | CP关系仅在私密展示 |

---

## 三、游戏接入框架

### 3.1 游戏分级（结合Bytesun支持列表）

#### 第一梯队（优先接入）

| 游戏 | 人数 | 时长 | 中东适配 | Bytesun游戏ID |
|------|------|------|---------|--------------|
| Ludo（飞行棋） | 2-4人 | 10-20分钟 | ★★★★★ 经典中东游戏 | Snake Ladder |
| Domino（多米诺） | 2-4人 | 5-15分钟 | ★★★★★ 中东传统游戏 | DominoPlus |
| UNO | 2-8人 | 5-15分钟 | ★★★★☆ 规则简单 | UnoPlus |

#### 第二梯队（候选）

| 游戏 | 人数 | 时长 | 中东适配 | 特殊要求 |
|------|------|------|---------|---------|
| 狼人杀 | 6-12人 | 20-40分钟 | ★★★☆☆ 语音场景契合 | isGameRTC=true |
| 谁是卧底 | 4-10人 | 15-30分钟 | ★★★☆☆ 轻量推理 | isGameRTC=true |
| 你画我猜 | 3-12人 | 15-30分钟 | ★★★★☆ 强社交 | 需同步聊天区 |

#### 第三梯队（扩展）

| 游戏 | 状态 | 说明 |
|------|------|------|
| 麻将/扑克 | 风险评估中 | 地域性强，合规风险 |
| 台球 | 技术评估中 | 需要观战视角优化 |

### 3.2 游戏房间参数模板

```yaml
# 基于 Bytesun getConfig 协议
GameRoomConfig:
  ludo:
    name: 飞行棋
    name_ar: لعبة الطيران  # 阿语名称
    game_id: 3001  # Bytesun游戏ID（示例）
    players: {min: 2, max: 4, optimal: 4}
    duration: 10-20分钟
    spectator: true
    rejoinable: true
    ai_backup: true
    turn_timeout: 30秒
    ticket_slots: [0, 100, 500, 1000]  # 门票档位
    
  domino:
    name: 多米诺
    name_ar: الدومينو
    game_id: 3002
    players: {min: 2, max: 4, optimal: 4}
    duration: 5-15分钟
    spectator: true
    rejoinable: true
    ai_backup: true
    turn_timeout: 20秒
    
  uno:
    name: UNO
    name_ar: أونو
    game_id: 3003
    players: {min: 2, max: 8, optimal: 4}
    duration: 5-15分钟
    spectator: true
    rejoinable: true
    ai_backup: true
    turn_timeout: 15秒
    team_mode: optional  # 2v2可选

  werewolf:
    name: 狼人杀
    name_ar: ذئب мафия
    game_id: 3010
    players: {min: 6, max: 12, optimal: 9}
    duration: 20-40分钟
    spectator: true
    rejoinable: false  # 中途加入破坏游戏
    ai_backup: false
    is_game_rtc: true  # 使用游戏内置语音
```

---

## 四、场景全景

### 4.1 创建房间场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S1.1 | 创建游戏房 | 点击"创建房间"→ 选择"游戏房" | 开启一局游戏 | 展示游戏列表，引导选游戏、设参数 |
| S1.2 | 快速创建 | 点击游戏快捷入口 | 跳过配置直接开房 | 用默认参数创建，自动匹配等待玩家 |
| S1.3 | 选择游戏类型 | 展示Ludo/Domino/UNO列表 | 选择想玩的游戏 | 加载对应游戏资源包 |
| S1.4 | 设置门票档位 | 创建房间时选择门票 | 设置入场门槛 | ticket_slots参数传给游戏 |
| S1.5 | 设置房间密码 | 勾选"私密房间" | 邀请制房间 | 生成邀请码，仅受邀请者可进入 |
| S1.6 | 继承语聊房配置 | 从现有语聊房切换 | 保持原房间关系 | 继承房间ID、成员、语音频道 |
| S1.7 | 选择服务器节点 | 高级设置中选择 | 低延迟优化 | 默认gsp=201迪拜，可选其他节点 |

### 4.2 邀请与传播场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S2.1 | 房间内邀请 | 房主点击"邀请好友" | 快速拉人 | 生成房间链接/二维码 |
| S2.2 | 游戏进行中邀请 | 游戏中显示空位 | 补位 | 展示空座位，点击邀请 |
| S2.3 | WhatsApp分享 | 点击分享到WhatsApp | 社交裂变 | 生成带房间预览的分享卡片（阿语RTL） |
| S2.4 | 好友在线推送 | 好友在线时邀请 | 精准触达 | 推送通知，点击直达房间 |
| S2.5 | 深链拉起 | 用户点击房间链接（App外） | 无缝跳转 | 深链唤醒App，自动进入房间 |

### 4.3 匹配与就绪场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S3.1 | 快速匹配 | 点击"快速匹配" | 系统帮忙找房间 | 进入匹配队列，显示等待动画 |
| S3.2 | 指定游戏匹配 | 点击某游戏下的"匹配" | 玩特定游戏 | 进入该游戏的匹配队列 |
| S3.3 | 语言匹配 | 选择"同语言匹配" | 阿语玩家优先 | 只匹配语言类型=7的玩家 |
| S3.4 | 地区匹配 | 选择"同地区匹配" | 低延迟 | 只匹配中东地区玩家（gsp=201） |
| S3.5 | VIP优先匹配 | VIP用户点击匹配 | 更快匹配 | 匹配权重+50% |
| S3.6 | 就绪等待 | 进入房间后点击"准备" | 等待开局 | 发送type=16座位同步，显示就绪状态 |
| S3.7 | 强制开始 | 房主点击"开始游戏" | 人数不足也开 | 调用quick_start_room API |
| S3.8 | 匹配超时 | 匹配超过60秒 | 不想等了 | 弹出"创建房间"建议 |

### 4.4 游戏进行中场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S4.1 | 游戏加载 | 进入游戏房 | 显示加载进度 | 显示加载动画，等待gameLoaded回调 |
| S4.2 | 座位上座 | 用户点击空座位 | 加入游戏 | 调用gameActionUpdate type=4 |
| S4.3 | 座位下座 | 用户点击"离开座位" | 离开座位 | optType=1，AI接管或空位 |
| S4.4 | 座位同步 | 游戏主动同步座位状态 | 状态一致 | 收到type=16，更新UI |
| S4.5 | 踢人请求 | 房主点击"踢出" | 清理捣乱者 | 收到type=17，返回type=6结果 |
| S4.6 | 游戏开始 | 所有人准备完成 | 正式开始 | 收到type=13，进入游戏 |
| S4.7 | 游戏结束 | 游戏结算完成 | 查看结果 | 收到type=14，展示结算页 |
| S4.8 | 断线重连 | 用户网络断开后重连 | 回到游戏 | 重连逻辑，保留座位 |
| S4.9 | 余额不足 | 游戏内金币不够 | 充值 | 收到gameRecharge，打开商城 |
| S4.10 | 聊天同步 | 你画我猜等游戏 | 同步猜测 | type=22/2014双向同步 |
| S4.11 | RTC同步 | 狼人杀等需要语音 | 游戏内语音 | type=3001同步麦克风状态 |

### 4.5 观战与互动场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S5.1 | 纯观战模式 | role=1游客身份 | 看看再说 | 只能观战，不能上座 |
| S5.2 | 观战转玩家 | 玩家退出，观战者补位 | 上场玩 | 调用座位上座，role改为0 |
| S5.3 | 观战打赏 | 观战者点击"送礼" | 互动支持 | 弹出礼物面板，发送礼物 |
| S5.4 | 弹幕吐槽 | 你画我猜等游戏 | 互动 | 同步到游戏聊天区 |

### 4.6 游戏结算场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S6.1 | 正常结算 | 游戏按规则结束 | 查看结果 | 展示排名/得分 |
| S6.2 | 返奖触发 | 结算后达到返奖条件 | Lucky Pocket抽奖 | 复用红包返奖逻辑 |
| S6.3 | 继续再来一局 | 点击"再来一局" | 继续玩 | 保留房间，重置游戏 |
| S6.4 | 更换游戏 | 点击"换游戏" | 换玩法 | 切换游戏类型，重新等待 |
| S6.5 | 解散房间 | 房主结束房间 | 散伙 | 调用destroy，关闭游戏 |
| S6.6 | 成绩分享 | 点击"分享" | 炫耀 | 生成成绩卡片（阿语RTL） |

### 4.7 异常与边界场景

| 场景编号 | 场景名称 | 触发条件 | 用户目标 | 系统响应 |
|---------|---------|---------|---------|---------|
| S8.1 | 游戏崩溃 | Bytesun SDK异常 | 恢复游戏 | 弹出"游戏无响应"，重试或结算 |
| S8.2 | 上座失败 | 收到type=18 | 提示用户 | 弹出"上座失败，请重试" |
| S8.3 | 余额扣款失败 | change_balance返回1008 | 充值提示 | 弹出"余额不足"，跳转商城 |
| S8.4 | 用户被封禁 | 用户类型=3黑名单 | 无法进入 | 错误码1020，弹出提示 |
| S8.5 | 游戏维护中 | 返回1019 | 等待恢复 | 弹出"游戏维护中" |
| S8.6 | IP受限 | 返回1023 | 无法进入 | 弹出"地区限制" |
| S8.7 | 设备性能不足 | 低端设备 | 能够游玩 | 降低画质/关闭动画 |
| S8.8 | 低电量模式 | 电量<20% | 节省电量 | 降低性能，简化UI |

---

## 五、Bytesun三方对接细节

### 5.1 对接架构

```
┌─────────────────────────────────────────────────────────────┐
│  wechill App                                                │
│  ├── 语聊房主进程                                            │
│  ├── WebView (游戏H5)                                        │
│  │   └── JSBridge (NativeBridge类)                         │
│  └── 语音频道（RTC）                                         │
├─────────────────────────────────────────────────────────────┤
│  wechill 服务端                                              │
│  ├── /v1/api/get_sstoken                                     │
│  ├── /v1/api/get_user_info                                  │
│  ├── /v1/api/change_balance                                 │
│  ├── /v1/api/create_room / join_room / leave_room           │
│  └── 回调接收：/v1/api/callback/*                            │
├─────────────────────────────────────────────────────────────┤
│  Bytesun 游戏服务                                            │
│  ├── 游戏逻辑引擎                                            │
│  ├── 房间管理服务                                            │
│  └── 回调通知服务                                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 前端协议（JSBridge）

#### 5.2.1 getConfig - 游戏获取配置

```javascript
// 游戏JS调用，App返回配置
{
  "appChannel": "wechill",        // 渠道标识
  "appId": 88888888,               // 商户ID（Bytesun分配）
  "userId": "534206265",           // 用户ID
  "code": "wfmlG5dnjCt3...",       // 一次性认证码
  "roomId": "20230201",            // 语聊房ID
  "gameRoomId": "",                // 保留字段，传空
  "gameMode": "3",                 // 固定"3"=语聊房模式
  "language": "7",                 // 7=阿拉伯语
  "gameConfig": {
    "sceneMode": 0,                 // 场馆级别
    "currencyIcon": "https://..."  // 货币图标URL
  },
  "gsp": 201,                      // 201=迪拜AWS
  "role": 0                        // 0=正常 1=游客 2=主持人
}
```

#### 5.2.2 sendGameAction - 游戏主动通知App

| type | 场景 | 参数 |
|------|------|------|
| 7 | 拉起用户资料卡 | userId |
| 13 | 游戏开始 | - |
| 14 | 游戏结束 | - |
| 15 | 上/下座位 | optType(0上/1下), userId, seat |
| 16 | 座位信息同步 | seats[] |
| 17 | 发起踢人 | userId, seat |
| 18 | 上座失败 | userId |
| 20 | 语聊房准备完成 | - |
| 21 | 查询音乐/音效状态 | bgmStatus, seStatus |
| 22 | 画猜消息同步 | isSystem, userId, nickName, content... |
| 23 | 上报游戏参数 | isMall |
| 30 | 最大人数/门票变更 | peopleNum, ticketSlots |
| 3001 | RTC同步 | status, users[] |

#### 5.2.3 gameActionUpdate - App主动通知游戏

| type | 场景 | 参数 |
|------|------|------|
| 4 | 操作游戏座位 | optType(0上/1下), seat, userId |
| 5 | 变更用户身份 | role, userId |
| 6 | 返回踢人结果 | optResult, optUserId, userId, reason |
| 2012 | 查询音乐/音效状态 | - |
| 2014 | 聊天内容同步到游戏 | userId, content |
| 2016 | 最小化状态变更 | collapseStatus |

### 5.3 服务端API

#### 5.3.1 获取SS Token

```
POST /v1/api/get_sstoken
请求: { app_id, user_id, code }
响应: { ss_token, expire_date }
```

#### 5.3.2 查询用户信息

```
POST /v1/api/get_user_info
请求: { app_id, user_id, ss_token, client_ip, game_id }
响应: { 
  user_id, user_name, user_avatar, balance,
  user_type,  // 1=普通 2=白名单 3=黑名单（复用红包风控）
  release_cond 
}
```

#### 5.3.3 货币修改

```
POST /v1/api/change_balance
请求: {
  app_id, user_id, ss_token,
  currency_diff,  // 负值=下注 正值=结算
  diff_msg,       // "bet"|"result"|"refund"
  game_id, game_round_id, room_id,
  change_time_at, order_id
}
响应: { 
  code, message, unique_id,
  balance,  // 最新余额
  currency_diff  // 实际变化值
}

错误码：
0=成功
1008=余额不足（弹出充值）
1020=用户被封禁
1022=账号功能限制
```

### 5.4 回调通知

#### 5.4.1 房间状态回调

```
POST /v1/api/callback/room_status
请求: {
  event: "room_created"|"game_started"|"game_ended"|"room_destroyed",
  room_id, game_id, game_round_id,
  players: [{ user_id, score, rank }],
  winner_ids: [],
  timestamp
}
```

#### 5.4.2 余额变化回调

```
POST /v1/api/callback/balance_changed
请求: {
  user_id, balance_diff, reason,
  game_id, game_round_id, room_id,
  order_id, timestamp
}
```

### 5.5 签名验证

```
算法: Signature = md5(SignatureNonce + AppKey + Timestamp)
- SignatureNonce: 随机字符串，15秒内不可重复
- Timestamp: 当前时间戳
- AppKey: Bytesun分配的密钥
- 有效期: 15秒
```

---

## 六、与现有功能融合

### 6.1 红包返奖融合

#### 6.1.1 触发条件

游戏结算后，满足以下条件可触发Lucky Pocket返奖：

| 条件 | 说明 |
|------|------|
| 游戏类型 | 支持"游戏房间红包"的游戏（后台配置） |
| 门票门槛 | 房间门票>=200金币（A档）/ 500金币（B档） |
| 游戏时长 | >=5分钟（防止秒局刷奖） |
| 有效玩家 | >=2人真人（AI不计数） |
| 用户状态 | 发送人非限制级/危险级黑名单 |

#### 6.1.2 返奖分档（复用现有逻辑）

| 档位 | 门槛 | 概率 | 比例 |
|------|------|------|------|
| A档 | 门票200-499 | 3% | 5% |
| B档 | 门票>=500 | 5% | 10% |

#### 6.1.3 流程

```
游戏结束
    ↓
判断是否满足返奖门槛
    ↓ 是
创建"游戏房间红包"
    ↓
发送方收到返奖结果弹窗（复用红包交互策略）
    ↓
记录返奖流水（复用hongbao-admin-pages）
```

### 6.2 龙蛋玩法融合

#### 6.2.1 贡献值来源

```yaml
# 游戏贡献值配置（按分区独立）
DragonEggGameConfig:
  ludo:
    contribute_per_game: 10      # 每局基础贡献
    contribute_per_win: 30       # 获胜额外贡献
    contribute_per_minute: 2    # 每分钟贡献
    
  domino:
    contribute_per_game: 10
    contribute_per_win: 30
    contribute_per_minute: 2
```

#### 6.2.2 统计口径

- 统计日: GMT+3 00:00 - 23:59:59
- 后端结算: 游戏结束回调触发，写入龙蛋贡献表
- 房主奖励: 房间游戏总贡献的20%计入房主

### 6.3 CP/Soul Pair融合

#### 6.3.1 亲密值来源

```yaml
# 游戏亲密值配置
CPIntimacyGameConfig:
  play_together: 5           # 一起玩游戏（同房间）
  win_together: 15           # 一起获胜（队友模式）
  play_duration: 1           # 每分钟游戏时长
  
注：保守分区游戏内不展示CP关系动画，仅在私密页展示
```

#### 6.3.2 游戏内展示

| 分区类型 | CP展示 | 说明 |
|---------|-------|------|
| 开放分区 | 显示 | 座位旁显示CP头像 |
| 保守分区 | 隐藏 | 仅在CP主页展示 |

### 6.4 风控体系复用

#### 6.4.1 黑名单映射

| 红包风控等级 | Bytesun用户类型 | 游戏房影响 |
|-------------|----------------|-----------|
| 危险级 | user_type=3 | 禁止进入游戏房 |
| 限制级 | user_type=2 | 可进入，但不能参与返奖 |
| 观察名单 | user_type=1 | 正常，记录日志 |

#### 6.4.2 风控规则扩展

```yaml
# 游戏房风控规则
GameRiskRules:
  high_freq_play:           # 高频游戏
    threshold: 100局/小时
    action: 限制级标记
    
  same_device_play:        # 同设备多账号
    threshold: 3个账号
    action: 观察名单
    
  abnormal_win_rate:       # 异常胜率
    threshold: >80% (样本>=50局)
    action: 观察名单+告警
    
  game_collusion:          # 游戏串通作弊
    detect: 同IP+同房间高频出现
    action: 危险级+封禁
```

---

## 七、匹配系统设计

### 7.1 匹配入口

| 入口 | 说明 | 优先级 |
|------|------|-------|
| 快速匹配 | 系统自动匹配 | P0 |
| 游戏匹配 | 指定游戏类型 | P1 |
| 好友房间 | 好友在玩的房间 | P2 |
| VIP匹配 | VIP专属队列 | P0（VIP用户） |

### 7.2 匹配策略

```
Step 1: 游戏类型分发
  - Ludo队列 / Domino队列 / UNO队列
  
Step 2: 地区优先
  - 默认gsp=201（迪拜）
  - 同地区玩家优先匹配
  
Step 3: 语言偏好
  - language=7（阿拉伯语）优先匹配
  
Step 4: 房间状态
  - 优先匹配"等待中"房间（有空位）
  - 次优凑人创建新房
  - 保底AI补位房间

Step 5: 超时处理
  - 0-30秒：严格匹配
  - 30-60秒：放宽地区/语言
  - 60-120秒：建议创建房间
```

### 7.3 匹配等待时间预估

| 游戏类型 | 低峰期 | 高峰期 | 极端情况 |
|---------|-------|-------|---------|
| Ludo | 5-15秒 | 2-5秒 | 30秒+AI补位 |
| Domino | 5-10秒 | 1-3秒 | 15秒+AI补位 |
| UNO | 5-10秒 | 1-3秒 | 15秒+AI补位 |
| 狼人杀 | 60-120秒 | 15-30秒 | 通常需预约 |

---

## 八、技术架构

### 8.1 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│  客户端层                                                    │
│  ├── wechill App (iOS/Android/HarmonyOS/Web/Electron)      │
│  ├── 语音SDK (RTC)                                          │
│  └── WebView (游戏H5)                                        │
│      └── JSBridge (NativeBridge)                            │
├─────────────────────────────────────────────────────────────┤
│  网关层                                                      │
│  ├── WebSocket (房间状态同步)                                │
│  ├── HTTP RESTful (业务请求)                                 │
│  └── Bytesun Proxy (游戏消息转发)                            │
├─────────────────────────────────────────────────────────────┤
│  业务层                                                      │
│  ├── 房间管理服务                                            │
│  ├── 匹配服务                                                │
│  ├── 用户服务 (复用红包风控)                                  │
│  ├── 游戏调度服务                                            │
│  ├── 语音服务                                                │
│  ├── 龙蛋服务 (复用现有)                                      │
│  ├── CP服务 (复用现有)                                        │
│  └── 红包返奖服务 (复用现有)                                   │
├─────────────────────────────────────────────────────────────┤
│  Bytesun接入层                                               │
│  ├── GameAdapter (协议适配)                                  │
│  ├── API转发                                                │
│  └── 回调接收                                                │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 数据模型

#### 8.2.1 游戏房间

```yaml
GameRoom:
  room_id: string              # wechill房间ID
  bytesun_room_id: string      # Bytesun房间ID
  game_id: int                 # 游戏ID
  game_type: string            # ludo/domino/uno/werewolf
  owner_id: string             # 房主UID
  voice_room_id: string        # 语聊房ID
  config:
    max_players: int
    min_players: int
    ticket_slot: int           # 门票档位
    is_private: bool
    password: string
    gsp: int                   # 服务器节点（默认201）
  state: enum[waiting, preparing, playing, settled, ended]
  players: list[GamePlayer]
  spectators: list[User]
  game_round_id: string        # 当前局ID
  created_at: timestamp
  updated_at: timestamp
```

#### 8.2.2 游戏玩家

```yaml
GamePlayer:
  user_id: string
  seat: int                    # 座位号（0-7）
  role: int                    # 0=正常 1=游客 2=主持人
  is_ready: bool
  is_online: bool
  is_ai: bool                  # 是否AI托管
  score: int                   # 游戏得分
  rank: int                    # 排名
  joined_at: timestamp
```

#### 8.2.3 游戏记录

```yaml
GameRecord:
  record_id: string
  game_round_id: string        # Bytesun局ID
  room_id: string
  game_id: int
  players: list[PlayerRecord]
  winner_ids: list[string]
  started_at: timestamp
  ended_at: timestamp
  duration_seconds: int
  bets_total: int              # 总下注
  results_total: int           # 总结算
  rebate_triggered: bool       # 是否触发返奖
  rebate_amount: int           # 返奖金额
```

---

## 九、后台管理

### 9.1 一级菜单

```
游戏房管理
├── 游戏配置
├── 房间管理
├── 匹配配置
├── 门票档位
├── 游戏记录
├── 结算管理
├── 返奖配置
├── 风控配置
├── 数据看板
└── 操作日志
```

### 9.2 核心页面说明

#### 9.2.1 游戏配置页

| 功能 | 说明 |
|------|------|
| 游戏开关 | 启用/禁用游戏 |
| 游戏参数 | 人数上限、时长、超时设置 |
| 中东本地化 | 阿语名称、视觉主题配置 |
| 服务器节点 | 默认gsp设置 |

#### 9.2.2 门票档位页

| 档位 | 门票金额 | 返奖资格 | 说明 |
|------|---------|---------|------|
| 免费档 | 0 | 无 | 仅体验 |
| 档位1 | 100 | 无 | 休闲娱乐 |
| 档位2 | 200 | A档 | 返奖门槛 |
| 档位3 | 500 | B档 | 高返奖 |

#### 9.2.3 游戏记录页

| 字段 | 说明 |
|------|------|
| 游戏局ID | game_round_id |
| 房间信息 | room_id, owner |
| 游戏类型 | Ludo/Domino/UNO |
| 玩家人数 | 真人/AI分别统计 |
| 游戏时长 | 开始-结束时间 |
| 下注总额 | currency_diff负值总和 |
| 结算总额 | currency_diff正值总和 |
| 返奖状态 | 是否触发/金额 |

---

## 十、数据埋点

### 10.1 核心事件

```yaml
# 游戏房核心埋点
Events:
  # 房间生命周期
  - game_room_create: {game_type, ticket_slot, owner_id, source}
  - game_room_join: {room_id, user_id, seat, role}
  - game_room_leave: {room_id, user_id, reason, duration}
  - game_room_destroy: {room_id, reason}
  
  # 匹配流程
  - match_enter: {game_type, language, gsp}
  - match_success: {game_type, wait_time}
  - match_timeout: {game_type, wait_time}
  - match_cancel: {game_type, wait_time, reason}
  
  # 游戏流程
  - game_loaded: {game_type, load_time}
  - game_start: {room_id, game_type, player_count, is_ai_fill}
  - game_end: {room_id, game_type, duration, winner_ids}
  
  # 座位操作
  - seat_up: {room_id, user_id, seat}
  - seat_down: {room_id, user_id, seat, reason}
  - seat_sync: {room_id, player_count}
  - kick_player: {room_id, operator_id, target_id, reason}
  
  # 货币
  - balance_bet: {user_id, game_type, amount, order_id}
  - balance_result: {user_id, game_type, amount, order_id}
  - balance_refund: {user_id, game_type, amount, order_id}
  
  # 返奖
  - rebate_trigger: {room_id, game_type, tier, amount}
  - rebate_win: {room_id, game_type, amount}
  - rebate_lose: {room_id, game_type}
  
  # 错误
  - game_error: {error_code, game_type, user_id}
  - balance_error: {error_code, amount}
```

### 10.2 核心指标

| 指标 | 说明 | 目标值 |
|------|------|-------|
| DAU玩游戏人数 | 每日进入游戏房的用户 | - |
| 游戏房间数 | 每日创建的游戏房间 | - |
| 匹配成功率 | 匹配成功/匹配请求 | >80% |
| 匹配等待时间 | 平均等待时间 | <30秒 |
| 游戏完成率 | 正常结束/游戏开始 | >90% |
| 返奖触发率 | 触发返奖/达标房间 | - |
| 返奖中奖率 | 中奖/触发返奖 | A档3% B档5% |

---

## 十一、版本规划

| 阶段 | 内容 | 时间 |
|------|------|------|
| V1.0 | Ludo/Domino/UNO + 基础匹配 + 语聊房融合 | 第1-2月 |
| V1.5 | 你画我猜 + 观战模式 + 返奖融合 | 第3月 |
| V2.0 | 狼人杀/谁是卧底（RTC）+ CP亲密值 + 龙蛋融合 | 第4-5月 |
| V2.5 | 游戏房间皮肤 + VIP特权 + 锦标赛模式 | 第6月 |

---

## 十二、风险与边界

### 12.1 技术风险

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| Bytesun服务不稳定 | 中 | 本地降级 + 重试机制 + 多节点切换 |
| 游戏加载慢 | 中 | CDN加速 + 预加载 + 进度提示 |
| 语音+游戏双通道带宽 | 中 | 自适应码率 + 语音优先 |

### 12.2 业务风险

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| 涉赌合规 | 高 | 门票而非真钱 + 统一金币结算 |
| 游戏版权 | 低 | Bytesun官方授权 |
| 未成年人沉迷 | 中 | 时长限制 + 家长控制 |

### 12.3 产品边界

```
不支持：
  ✗ 真钱下注
  ✗ 高度竞技游戏（MOBA/FPS）
  ✗ 单局>60分钟
  ✗ 需要额外下载

支持：
  ✓ Bytesun官方休闲游戏
  ✓ 语聊房融合模式
  ✓ 中东本地化（阿语RTL）
  ✓ 现有功能融合（红包返奖/龙蛋/CP）
```

---

## 附录A：多语言对照表（Bytesun）

| 语言 | 值 | wechill优先级 |
|------|-----|---------------|
| 阿拉伯语 | 7 | ★★★★★（默认） |
| 英语 | 2 | ★★★★☆ |
| 土耳其语 | 9 | ★★★☆☆ |
| 乌尔都语 | 10 | ★★★☆☆ |
| 波斯语 | 18 | ★★☆☆☆ |

---

## 附录B：错误码对照表

| 错误码 | 描述 | 前端处理 |
|-------|------|---------|
| 0 | 成功 | - |
| 1001 | 数据错误 | 提示"数据异常" |
| 1003 | 签名错误 | 重试 |
| 1008 | 余额不足 | 跳转充值 |
| 1019 | 游戏维护中 | 提示"游戏维护中" |
| 1020 | 用户被封禁 | 提示"账号受限" |
| 1022 | 账号功能限制 | 提示"功能受限" |
| 1023 | 地区限制 | 提示"地区不支持" |

---

*文档结束。后续补充：API详细接口文档、前端交互规范、后台原型图。*
