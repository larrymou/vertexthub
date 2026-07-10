# 深度测试问题修复任务

## 目标
修复深度测试发现的所有7个问题。

## 问题清单

### P1 问题（必须修复）

#### 1. pr_merge_rate 格式化
**问题**：周报 metrics 显示为 0.53，应该显示为 53%
**位置**：
- `packages/core/src/ai/weekly-report.ts` - 生成端
- `apps/web/src/App.tsx` - 前端显示端
**要求**：
- 后端返回原始值（0.53）
- 前端格式化为百分比（53%）
- 保留2位小数

#### 2. Entity Invalid Date
**问题**：Entities 页面所有实体显示 "Updated: Invalid Date"
**位置**：`apps/web/src/App.tsx` - EntitiesList 组件
**原因**：前端 Entity 接口有 updated_at 字段，但后端返回 consistency.last_checked
**要求**：
- 更新前端 Entity 接口，匹配后端返回结构
- 使用 entity.consistency.last_checked 显示日期
- 使用 entity.consistency.status 显示状态

#### 3. 添加 loading 反馈
**问题**：点击 Refresh 按钮后没有 loading 状态
**位置**：`apps/web/src/App.tsx` - WeeklyReportView 组件
**要求**：
- 点击 Refresh 后显示 "Generating..."
- 禁用按钮防止重复点击
- 生成完成后恢复按钮状态

#### 4. 添加错误边界
**问题**：如果 API 失败，前端可能白屏
**位置**：`apps/web/src/App.tsx`
**要求**：
- 添加 React Error Boundary
- API 失败时显示友好错误信息
- 提供重试按钮

### P2 问题（尽量修复）

#### 5. Summary 双句号
**问题**：周报摘要有两个句号"。。"
**位置**：`packages/core/src/ai/weekly-report.ts` - generateNarrativeSummary 函数
**要求**：修复标点符号拼接逻辑

#### 6. Insights metrics key 显示
**问题**：Insights 页面 metrics 显示为 snake_case（如 pr_merge_rate）
**位置**：`apps/web/src/App.tsx` - InsightsList 组件
**要求**：
- 添加 key → label 映射表
- 将 pr_merge_rate 显示为 "PR Merge Rate"
- 将 total_prs 显示为 "Total PRs"

#### 7. 添加 404 页面
**问题**：所有路径都显示主页，没有404页面
**位置**：`apps/web/src/App.tsx`
**要求**：
- 添加简单的路由判断
- 未知路径显示 404 页面
- 提供返回主页链接

## 验收标准
1. 所有7个问题都已修复
2. TypeScript 编译通过
3. 浏览器测试通过
4. 不破坏现有功能