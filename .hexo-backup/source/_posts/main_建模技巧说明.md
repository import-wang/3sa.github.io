---
title: 记 VRP 项目
date: 2025-12-17 14:00:00
categories:
  - coding
tags:
  - vrptw
  - pyvrp
  - modeling trick
---

近期做了一个 vrp项目，整理其核心建模思路与“技巧点”：

- 用 [PyVRP](https://pyvrp.org/api/pyvrp.html) 建模带时间窗的多车辆路径问题（VRPTW）。
- 同时处理“多个真实出发点 + 单一最终回场点”的业务形态。
- 通过“两阶段求解 + 自定义车辆起点”把“午休”嵌入到路线中，避免直接在单次求解中硬塞复杂约束。
- 通过“接驳点（handover）”把 bike 阶段结果反哺到 car 阶段，实现分段/接驳的联动。

---

## 1. 数据与距离矩阵：先把“输入干净化”

### 1.1 只保留距离矩阵中存在的节点

在构建模型前，先用距离矩阵的 `start/end` 并集作为 `valid_nodes`，把 Excel 站点表中不在矩阵里的点剔除（避免后面边缺失导致大量不可行/惩罚边）。

这一段是“工程上最值钱”的预处理：把不可控的数据缺失尽早暴露，并把问题从“求解器坏掉”变成“输入数据缺边”。

### 1.2 统一距离/时长的单位，并对 bike 做速度缩放

脚本把矩阵中的 `distance`（km）统一转成米，并把 `duration` 转为秒；同时 bike 模式把 `duration` 除以 2（等价于“bike 更快/更慢”取决于你矩阵的定义）。

建模技巧：

- 在 VRP 中“距离”和“时间”往往来源不同系统，尺度差异会导致惩罚参数难调（后续 PyVRP 也会有 `PenaltyBoundWarning`）。在入口处统一尺度是控制难度的关键。
- bike 与 car 共用距离矩阵结构时，用速度缩放（`t/2`）比重做一套矩阵更轻量。

---

## 2. 多出发点的关键：`VirtualDepot` + 边的“最短真实出发点”映射

业务上可能有多个“出发点”（站点类型为 `出发点`），但在求解器里如果把它们都建成真实 depot，会显著增加模型复杂度（车辆类型、流量约束等都会膨胀）。脚本采用了更“工程化”的技巧：

### 2.1 用一个 `VirtualDepot` 代表“从任意真实出发点出发”

当没有自定义车辆时，车辆统一从 `VirtualDepot` 出发（`m.add_depot(name="VirtualDepot")`），然后通过边的代价把它“投影”到离目标点最近的真实出发点。

### 2.2 `VirtualDepot -> client` 的边：取所有真实出发点到该 client 的最小距离

这是核心技巧：当边的一端是 `VirtualDepot` 时，不直接查 `(VirtualDepot, code)`，而是在所有真实出发点集合里取最小距离。

建模上的意义：

- 求解器看到的是“从一个 depot 出发”的标准 VRP。
- 业务含义是“每条路线会隐式选择一个最近的真实出发点”。
- 把“路线分配到哪个出发点”的离散选择，变成了边代价的局部最小化，通常比显式建多个 depot 更稳定。

### 2.3 输出时把 `VirtualDepot` 还原成“最近真实出发点”

求解时用 `VirtualDepot`，但输出路线时需要写清楚车到底从哪个仓/点出发。脚本在导出 merged 结果时，会对每条 route 找一个“锚点”（第一个非 `VirtualDepot` 的真实点），再用同样的最小距离逻辑找到最佳真实出发点，写回到结果 Excel。

---

## 3. 是否回场：`DummyEnd` 实现开放式路线（open route）

对于 bike 阶段，脚本经常用 `return_to_depot=False`，意味着不强制回 `s339`（可能更贴近“接驳后由 car 继续”的业务）。实现方式是创建一个 `DummyEnd` depot，并对所有 `to == DummyEnd` 的边设置 `distance=0,duration=0`，等价于“到终点不计成本”。

建模技巧：

- 这比“强行回场再扣掉”更干净，因为回场会干扰时间窗、午休、最大里程等约束。
- 也比在目标函数里调整“回场成本”更直观，且不引入额外变量。

---

## 4. 午休的两种建模：优先用“更稳定”的方式

脚本同时实现了两种午休建模思路：

### 4.1 思路 A：客户点拆成 `-am/-pm` 的互斥二选一（Client Group）

如果客户“需要午休”，就把同一个客户拆成两个候选点：上午版本（截止 11:30）与下午版本（最早 13:00），用 `client_group` 把它们绑定成“二选一”。

细节：

- bike：`group.required=False` 且两个点 `required=False`，并设置 `prize=500`。这会让求解器在不可行时允许跳过，同时通过 prize 提供“做了更好”的激励。
- car：`group.required=True` 且两个点 `required=False`。这会强制“必须服务该客户，但上午/下午二选一”。

这是一种非常标准的 VRPTW 技巧：把“需要午休”的复杂逻辑下沉为“时间窗选择”。

### 4.2 思路 B（脚本主线）：两阶段求解，把午休当成“路线内事件”

脚本的 `solve_two_stage_vrp()` 采用更工程化的路线级处理：

1. 先求 Stage 1（正常求解）。
2. 根据每条 route 的 schedule，判断是否跨越午休窗口 12:00-13:00。
3. 若跨越，则选择一个 break 点，把 route 切成 head/tail。
4. 以 break 点为“新车辆起点”，构造 Stage 2 的自定义车辆（每条被切的 route 一辆）。
5. Stage 2 只服务 tail 中的客户。
6. 最后把 head + Lunch 节点 + tail 拼回一条“合并后的路线”，并导出。

对应实现：

- 午休窗口与切分策略
  - “在 12:00-13:00 内结束服务的点”作为候选，取最晚的一个
  - 如果没有候选但 route 超过 13:00：在超窗前一个点切
- Stage 2 自定义车辆的生成
- Stage 2 的目标客户集
- 合并输出（插入 `Lunch-xxx` 节点）

为什么两阶段会更稳定：

- 直接在单次 VRP 中引入“必须午休 30 分钟”往往需要显式 break 变量/约束，建模与调参都重。
- 两阶段把难题拆成两个标准 VRPTW，并把 break 的离散选择变成“后处理 + 再求解”，更好落地。

---

## 5. 自定义车辆：把“从某个客户继续跑”变成标准 VRP

两阶段的关键是 Stage 2 的车辆不是从 `VirtualDepot` 出发，而是从 break 点出发。

### 5.1 给每辆 Stage2 车创建一个专用 start depot

对每条被切分的路线，脚本创建一个 depot：`name="Start-<vehicle_name>"`，并把 `tw_early` 设置为“break 结束 + 30min”。

### 5.2 把已消耗的时间/里程扣掉（shift_duration / max_distance）

这是非常实用的技巧：Stage 2 的车辆不是“全新上班”，它在 Stage 1 已经跑了一段。所以 Stage 2 车辆类型要扣掉已消耗资源：

- `shift_duration = 9h - consumed_time`
- bike 还额外限制最大里程：`max_distance = 35000 - consumed_dist`

这样 Stage 2 的可行性就能自然反映“午休前已经跑太久/太远”的现实。

### 5.3 自定义 start depot 的边：用 `custom_start_locs` 做真实点映射

新加的 start depot 名字是 `Start-...`，不在距离矩阵里。脚本用 `custom_start_locs` 把它映射回真实 `start_loc_name`（再做 base name），然后查 `dist_map`。

如果找不到边，会插入一条超大距离 `1e7` 的惩罚边。

工程含义：

- “缺边”不会让模型直接崩溃，而是让该路径极其不优，迫使求解器绕开。
- 同时会打印 warning，方便追溯矩阵缺失。

---

## 6. 目标函数与约束的取舍：bike 不一定要“最短路”

脚本对 bike 的一个显著策略是：

- `unit_distance_cost=0`
- 但用 `max_distance=35000` 做硬约束

这等价于：bike 阶段更关注“在可行的里程上限内把点覆盖掉”，而不是精细优化距离。

建模技巧：

- 当你的距离矩阵/时间窗数据噪声较大时，强行最短路可能引导求解器在噪声里过拟合。
- 先用硬约束保业务可行，再在 car 阶段或后处理做精细优化，整体更稳。

---

## 7. 接驳（bike -> car）联动：用“最后点到达时间”更新 car 的最早服务时间

脚本的主程序（`__main__`）展示了一个完整联动流程：

1. 先跑 bike 两阶段求解，得到合并后的路线 `MergedSolution`。
2. 从每条 bike 路线里，把“除最后一个客户外的点”标为 merge points（后续 car 不再访问）；把“最后一个客户”作为 visit point（接驳点）。
3. 生成 car 输入：删除 merge points，并把接驳点的 `最早可开始提货时间` 更新为 bike 到达时间。

对应实现：

- merge/visit 点提取（`MergedSolution.get_merge_and_visit_points()`）
- car 输入过滤与时间更新

建模技巧：

- 这是一种典型的“分阶段 VRP”串联方式：前一阶段产生可行的时空约束，后一阶段只需要把它当作新的 time window。
- 不需要在同一个模型里显式建“bike 与 car 的交接约束”，大幅降低复杂度。

---

## 8. 结果导出：把“路线”结构化成可分析的表

`export_merged_results()` 会把合并后的 `routes_data` 展平为一个 Excel，字段包含：

- 路线粒度：`problem_id`, `route`, `vehicle_type`, `index`
- 点粒度：`location`, `lat/lng`, `address`, `chinese_name`
- 时间窗与服务：`start`, `end`, `tw_early`, `tw_late`, `service_duration`
- 路径累积：`cumulative_distance`，以及“最后一点回到 s339 的距离”`back_distance`

关键实现：

- 写入起点行（index=0）并带真实出发点坐标
- 累积距离计算与回场距离计算

这使得后续做“每条线路里程汇总 / 每条线路停靠点明细 / 回场距离”都不需要再解析求解器对象。

---

## 9. 你可以复用的“建模模板”

如果把 `data/main.py` 抽象成可复用模板，其结构大致是：

1. 预处理：用距离矩阵过滤点（`solve_vrp_base()` 开头）。
2. 单次 VRPTW 建模：
   - depot：`s339`（可选 `DummyEnd`）
   - vehicles：`VirtualDepot` 或 custom start depots
   - clients：时间窗推导 + service duration 调整 +（可选）client group
   - edges：普通边 + VirtualDepot 边 + custom start depot 边
3. 复杂业务拆分：两阶段（午休）与多阶段（bike->car 接驳）。
4. 导出：把求解结果结构化为“停靠点表”。
