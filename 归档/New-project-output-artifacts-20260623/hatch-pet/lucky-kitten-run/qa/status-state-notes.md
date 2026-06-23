# 丸丸状态响应说明

Codex overlay 当前使用固定图集行来播放 pet 状态：

- `idle`: 第 0 行，普通待机。
- `running-right` / `running-left`: 第 1 / 2 行，拖动宠物时左右移动。
- `waving`: 第 3 行，打招呼。
- `jumping`: 第 4 行，鼠标 hover 的临时状态。
- `failed`: 第 5 行，失败或阻塞。
- `waiting`: 第 6 行，需要用户输入、批准或处理请求。
- `running`: 第 7 行，Codex 正在运行、思考或执行任务。
- `review`: 第 8 行，有完成内容等待查看。

本轮优化把 `waiting` 改成更明显的抬爪等待，把 `running` 加强成更明显的低头专注/思考晃动，并让 `review`、`failed` 和 `idle` 之间更容易区分。

重要限制：宠物素材本身不能主动读取 Codex 状态。Codex app 需要先在 overlay 里生成 running / waiting / review / failed 通知，宠物才会切换到对应行。如果 overlay 没有收到状态通知，宠物仍会停在 `idle`，这不是 `pet.json` 能配置出来的。
