# 打磨体验第一步：Demo 数据 + 洞察质量提升

## 目标
让用户首次打开 VertexHub 就能看到有意义的内容，不需要配置任何东西。

## 核心问题
当前 demo 的问题：
1. 冷启动：需要自己配 GitHub token 才能看数据
2. 洞察质量差：只是简单计数统计，没有叙事性
3. 价值不可见：看不出比手动写周报好在哪

## 任务清单

### 1. 预置 Demo 数据
**目标**：启动即可看到真实数据，零配置

**要求**：
- 创建 `packages/core/src/demo/seed-data.ts`
- 预置一套真实 GitHub 仓库数据（模拟 hermes 项目）：
  - 15-20 个 PR（不同状态：merged, open, closed）
  - 20-30 个 Issue（不同标签：bug, feature, docs）
  - 50+ 个 Commit（不同作者）
- 在 `SqliteEventStore` 初始化时自动加载 demo 数据
- 添加 `isDemo` 标记，区分 demo 数据和真实数据

### 2. 改进洞察生成
**目标**：生成叙事性周报，不是简单统计

**当前问题**：
```
// 当前输出（太简单）
{ summary: "本周有 10 个 PR，5 个 Issue" }
```

**期望输出**：
```
// 期望输出（叙事性）
{
  summary: "本周团队聚焦认证模块重构。Alice 主导的 #123 将登录耗时降低 40%，
            但引入了一个回归 bug（#456），已在周五 hotfix。",
  highlights: [
    "性能提升：登录 P95 从 800ms 降至 480ms",
    "风险项：#789 已超期 3 天，需要跟进"
  ],
  metrics: {
    pr_merge_rate: 0.75,
    avg_review_time_hours: 4.2,
    bugs_opened: 3,
    bugs_closed: 5
  }
}
```

**要求**：
- 修改 `packages/core/src/ai/summary-generator.ts`
- 新增 `generateWeeklyReport()` 方法
- 分析 PR、Issue、Commit 数据，生成叙事性摘要
- 提取关键指标（merge rate、review time、bug 趋势）
- 识别风险项（超期 issue、长期未合并 PR）
- 使用 rule engine，不依赖 AI provider（保持零依赖）

### 3. 更新前端展示
**目标**：仪表板展示改进后的洞察

**要求**：
- 修改 `apps/web/src/App.tsx`
- 添加"周报"视图，展示叙事性摘要
- 高亮显示关键指标和风险项
- 添加"刷新"按钮，重新生成周报
- 确保首次加载就能看到 demo 数据

### 4. 启动脚本优化
**目标**：`npm run dev` 一键启动

**要求**：
- 确保 `npm run dev` 启动后自动初始化 demo 数据
- 前端自动连接后端 API
- 添加启动日志，显示访问地址

## 验收标准
1. `npm run dev` 启动后，打开 http://localhost:3000 能立即看到周报
2. 周报包含叙事性摘要、关键指标、风险项
3. 数据看起来真实可信（不是 "10 个 PR" 这种简单统计）
4. 点击"刷新"能重新生成周报

## 技术约束
- 不依赖 AI provider，纯 rule engine 实现
- 最小化依赖，优先使用原生 API
- 保持 TypeScript 类型安全
- 添加单元测试
