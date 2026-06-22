# RemiFocus 架构重设计

## 🔍 现有问题分析

### 问题 1：卡片提取不工作（"暂无卡片数据"）

**根因定位：**
| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | `file-open` 事件处理函数**是空的**，没有调用 `scanFile` | [`main.ts:580-585`](../main.ts:580) | 用户打开已有笔记时不会触发扫描 |
| 2 | `modify` 事件只在**保存时**触发，初次加载已有文件不会触发 | [`main.ts:567`](../main.ts:567) | 已存在的笔记不被扫描 |
| 3 | `hasFlashcardContent` 检测依赖标签或 `decks:`，无标签则跳过 | [`main.ts:604-607`](../main.ts:604) | 纯列表格式的笔记可能被跳过 |
| 4 | `metadataCache.getFileCache` 在文件刚修改时可能返回 null | [`main.ts:600`](../main.ts:600) | tags 为空数组导致误判 |

**修复方案：**
- 修复 `file-open` 事件处理函数，调用 `scanFile`
- 添加 `layout-ready` 事件监听，在 Obsidian 加载完成后扫描所有已打开的文件
- 放宽 `hasFlashcardContent` 检测条件（任何有列表项的 md 文件都试一下）

### 问题 2：Ribbon 图标打开的是侧边栏，不是弹窗

**现状：**
- Ribbon 图标 → `activateHomeView()` → 打开右侧边栏 `RemiHomeView`（空的）

**用户期望：**
- Ribbon 图标 → 打开全屏 Modal（类弹窗）
- 弹窗内可以选模式 + 开始学习
- 弹窗内有"主页"按钮 → 打开 Dashboard

### 问题 3：没有真正的"主页" Dashboard

**用户想要的主页：**
- 左侧：大日历热力图（GitHub style contribution graph）
- 右侧：滚动内容栏
  - 今日复习进度条
  - 文件夹统计
  - 复习规划（今日/明日/本周）
  - 基于所选调度算法计算

### 问题 4：右侧栏没有用途

**现状：** `RemiHomeView` 显示在右侧边栏，目前是空的。

**建议用途：** 小部件面板

---

## 🏗 新架构设计

### 导航流程

```
┌──────────────────────────────────────────────────────────┐
│  用户点击 🧠 Ribbon 图标                                  │
│                                                          │
│   ┌─────────────────────────────────────┐                │
│   │  RemiMainPopup（全屏 Modal）          │                │
│   │                                     │                │
│   │  ┌ 模式选择 ──────────────────┐     │                │
│   │  │  [Exposure] [Test] [Review] │     │                │
│   │  │         [▶ 开始学习]        │     │                │
│   │  └────────────────────────────┘     │                │
│   │                                     │                │
│   │  ┌ 卡组列表 ──────────────────┐     │                │
│   │  │ 📁 英语 (150词)            │     │                │
│   │  │ 📁 西综-呼吸 (30词)         │     │                │
│   │  │ 📁 西综-循环 (45词)         │     │                │
│   │  └────────────────────────────┘     │                │
│   │                                     │                │
│   │  [🏠 主页]                          │                │
│   └──────────┬──────────────────────────┘                │
│              │                                            │
│              │ 点击"主页"                                  │
│              ▼                                            │
│   ┌─────────────────────────────────────┐                │
│   │  RemiDashboard（全屏 Modal）          │                │
│   │                                     │                │
│   │  ┌─── 左侧 ───┐ ┌─── 右侧 ───────┐ │                │
│   │  │ 📅 热力图   │ │ 📊 今日复习    │ │                │
│   │  │            │ │ 📁 文件夹统计  │ │                │
│   │  │ 日一二三    │ │ 📅 复习规划    │ │                │
│   │  │ 四五六     │ │ 🎯 进度条     │ │                │
│   │  └────────────┘ └───────────────┘ │                │
│   └─────────────────────────────────────┘                │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │ 右侧边栏：RemiQuickView（小部件）              │        │
│  │                                              │        │
│  │  ┌ 今日概览 ────────────────┐                │        │
│  │  │ 待复习: 12 词  ████░░    │                │        │
│  │  │ [▶ 快速复习]             │                │        │
│  │  └─────────────────────────┘                │        │
│  │  ┌ 文件夹速览 ──────────────┐                │        │
│  │  │ 英语: 150词              │                │        │
│  │  │ 西综:  30词              │                │        │
│  │  └─────────────────────────┘                │        │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

### 组件清单

| 组件 | 类型 | 位置 | 说明 |
|------|------|------|------|
| `RemiMainPopup` | Modal | `main.ts` | 全屏弹窗：模式选择 + 卡组列表 + 主页按钮 |
| `RemiDashboard` | Modal | `main.ts` | 全屏主页：日历热力图 + 右侧统计 |
| `RemiQuickView` | ItemView | `main.ts` | 右侧边栏小部件（替换现有的空 RemiHomeView） |
| `HeatmapWidget` | UI 组件 | `ui/heatmap.ts` | 新文件：日历热力图（GitHub contribution style） |
| `StatsPanel` | UI 组件 | `ui/stats.ts` | 新文件：统计面板（文件夹/进度/规划） |
| `QuickReview` | UI 组件 | `ui/quickReview.ts` | 新文件：右侧边栏快速复习小部件 |

### 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 🔴 修改 | [`main.ts`](../main.ts) | Ribbon 图标 → 弹窗；修复扫描逻辑；注册新 View |
| 🔴 修改 | [`ui/popup.ts`](../ui/popup.ts) | 重写为主弹窗：模式选择 + 卡组列表 |
| 🔴 修改 | [`ui/home.ts`](../ui/home.ts) | 重写为 Dashboard：热力图 + 统计 |
| 🟢 新建 | [`ui/heatmap.ts`](../ui/heatmap.ts) | 日历热力图组件 |
| 🟢 新建 | [`ui/stats.ts`](../ui/stats.ts) | 统计面板组件 |
| 🟢 新建 | [`ui/quickReview.ts`](../ui/quickReview.ts) | 快速复习小部件 |
| 🟢 新建 | [`ui/quickView.ts`](../ui/quickView.ts) | 右侧边栏容器视图 |

### 数据流

```
用户笔记 (markdown)
    │
    ▼
vault.on("modify") / workspace.on("file-open")
    │
    ▼
scanFile() ─── CardExtractor.extract()
    │                        │
    │                   ┌────┴────┐
    │                   │ 格式检测 │
    │                   ├─────────┤
    │                   │ english │ → word - meaning 英语格式
    │                   │ xizong  │ → ### 【看到啥】西综格式
    │                   │ generic │ → 通用格式
    │                   └─────────┘
    │
    ▼
deck.json  (唯一状态源)
    │
    ├── IEngine.getDeckInfos()  → 弹窗/主页 显示
    ├── IEngine.getQueue()      → Session 学习
    ├── IEngine.computeMastery()→ 进度条/热力图
    └── IEngine.processResult() → 更新调度（SM-2/FSRS）
```

### 热力图设计

```
📅 6月学习记录
    日  一  二  三  四  五  六
                    1   2   3   4
  5   6   7   8   9  10  11  12
 13  14  15  16  17  18  19  20
 21  22  23  24  25  26  27  28
 29  30

🟩 无学习  🟩 1-5词  🟩 6-15词  🟩 16-30词  🟩 30+词
```

- 每个格子 = 一天
- 颜色深度 = 当天学习的卡片数
- 点击某天 → 显示该天的学习详情（可选）

### 热力图实现方案

基于 CSS Grid 渲染，无需第三方库：
```
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cell { width: 16px; height: 16px; border-radius: 3px; }
.level-0 { background: #ebedf0; }
.level-1 { background: #9be9a8; }
.level-2 { background: #40c463; }
.level-3 { background: #30a14e; }
.level-4 { background: #216e39; }
```

数据来源：遍历 `deck.json` 中所有 `WordEntry.history`，按日期聚合计数。

### 复习计划计算

基于调度算法的预测：
- **今日待复习**：`state === "review" && next <= today`
- **明日待复习**：`state === "review" && next === tomorrow`
- **本周待复习**：`state === "review" && next <= this_week_end`
- **新词推荐**：`state === "new"`，按每日目标逐步引入

### 右侧栏小部件

```
┌─────────────────────────────┐
│ 🧠 RemiFocus               │
│                             │
│ 📊 今日概览                  │
│ 待复习: 12 词   ████░░░░    │
│ 新词:   5 词                │
│                             │
│ [▶ 快速复习]  [📋 详情]     │
│                             │
│ 📁 文件夹速览                │
│ 英语 ████████░ 150词 80%    │
│ 西综 ████░░░░░ 30词  40%    │
│                             │
│ ───────────────────────     │
│ 💡 下次学习: 21:00          │
└─────────────────────────────┘
```

---

## ✅ 实施步骤

### Step 1: 修复卡片提取
- 修复 `file-open` 处理函数
- 添加 `layout-ready` 初始扫描

### Step 2: 重写主弹窗
- `ui/popup.ts` → `RemiMainPopup`：模式选择 + 卡组列表
- `main.ts`：Ribbon 图标 → Modal

### Step 3: 重构右侧栏
- 新建 `ui/quickView.ts`：小部件面板
- 替换现有的空 `RemiHomeView`

### Step 4: 新建热力图
- `ui/heatmap.ts`：基于 CSS Grid 的日历热力图

### Step 5: 新建统计面板
- `ui/stats.ts`：文件夹统计 + 复习规划

### Step 6: 构建 Dashboard 主页
- `ui/home.ts`：左热力图 + 右统计面板
- `main.ts`：RemiDashboard Modal

### Step 7: 编译 + 部署测试
