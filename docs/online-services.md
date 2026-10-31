# 在线服务契约（预留，未部署）

客户端默认只有 LocalLearningRepository，不调用网络。HttpLearningService 是可注入的未来适配层，不在 UI 中冒充已上线能力。

## 端点

| 方法与路径 | 成功响应 | 语义 |
| --- | --- | --- |
| GET /api/v1/me | `{id, displayName}` | 当前已认证用户 |
| GET /api/v1/learning | `{revision, data: LearningData}` | 返回用户自己的版本化学习状态 |
| PUT /api/v1/learning | `{revision}` | 请求体 LearningData；If-Match 为读到的 revision |

建议错误码：401 未登录、403 无权限、409 版本冲突、413 数据超限、422 验证失败、429 限流。错误只携带可向用户显示的信息，不回传内部堆栈或凭据。

## 实施前置条件

- HTTPS，同源反向代理。会话使用 HttpOnly + Secure + SameSite Cookie；所有写操作实施 CSRF 防护。
- 服务端按当前用户强制隔离数据，不信任客户端传入用户 ID。
- 服务端再验证数据形状、课程 ID、文本长度、总容量与修改版本。
- 版本冲突先拉取合并，不能静默覆盖；跨设备删除需要 tombstone 或显式合并策略。
- 笔记可能包含用户私人文本，默认私密；公共分享另建不含笔记的资源模型。
- 增加服务测试、配额、备份、恢复、审计与隐私政策后才启用入口。

后续接口可增加课程增量、学习路径、团队课堂，但不影响本地仓库接口。当前没有登录/同步/支付服务，也没有配置或要求任何 API Key。

Stage 003：LearningData v1 新增可选 exerciseCompleted:string[]，只接受已知题目 ID；缺省视为空数组，合并取并集。它是自评进度，不是服务端判题成绩。
