# Stage 001 工作日志

## 目标
建立可运行的教学工作台与常见算法覆盖基线。

## 已确认
- 本地新项目 D:/Work/algo-atlas，当前 GitHub 身份 ax2，未发现同名本地目录。
- 技术：React / TypeScript / Vite，纯函数轨迹引擎与本地学习存储分离。
- 正在进行独立视觉概念设计与教学内容建模。
- 资料入口已核查：Princeton Algorithms、Open Data Structures、CP-Algorithms；正文独立编写，不复制第三方教材。

## 完成记录（2026-10-30）

- 实现 65 个非占位课程和 6 个可计算综合专题；覆盖范围逐项记录在 docs/coverage.md。
- 分层目录、搜索/过滤/排序、真实轨迹播放器、历史/原理/复杂度/源码/练习、本地收藏/笔记/完成状态、备份导入导出与参数分享均已实现。
- 在线接口与乐观并发契约预留；账号、云端同步和服务器未部署。
- 36 项 Vitest 测试通过，包含随机排序性质、图算法交叉对照、最大流与割 oracle、树结构约束、字符串匹配与动态规划、备份边界；类型检查和生产构建通过。
- IAB 中遍历 65 个课程的首尾状态；后续以 Playwright 对桌面和移动 Chromium 复现核心用户流程，Stage 002 后共 10 项通过。
- 桌面截图 1536×1024、移动端布局视口 390×844（DPR 3），深色主题，无页面级横向溢出；课程页签在小屏有意横向滚动。IAB 宿主截图清晰度受缩放影响，留存截图使用独立 Chromium 测试运行器。Browser plugin not available；使用 CUA IAB 与仓库 Playwright 作为验证路径。
- npm audit 官方 registry 检查结果为 0 vulnerabilities；锁文件不包含凭据。已配置 GitHub Actions 验证与手动静态部署工作流。
- public GitHub 仓库 https://github.com/ax2/algo-atlas 已创建，代码提交与远端验证随后记录。

## 发布记录

2026-10-30 已推送到 ax2/algo-atlas 的 main，功能提交 `1a564f8`。GitHub API 确认 PUBLIC / MIT / main。独立 Ubuntu / Node 22 CI 的依赖安装、36 项测试、类型检查、生产构建、10 项桌面/移动 Chromium 回归全部成功：[Verify 41067612890](https://github.com/ax2/algo-atlas/actions/runs/41067612890)。后续提交仅补充本记录，不修改经过验证的程序代码。静态 Pages 部署工作流为手动入口，本次未启用公网站点。

## 已知边界

机制场景不等于所有数据结构操作。历史与复杂度独立编写并附资料入口，尚未经专业课程审定。移动端为模拟视口，不能声称真机或用户验收。常用度是编辑判断，并非实时统计。详见 README 和覆盖清单。
