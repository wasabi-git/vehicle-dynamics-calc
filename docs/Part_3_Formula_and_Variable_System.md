# Part 3 — 公式与变量系统

> **项目：** Vehicle Dynamics Formula Solver  
> **阶段状态：** ✅ 已完成  
> **适用版本：** v0.1 纵向加速性能最小闭环  
> **机器权威来源：** `data/*.json`、`schemas/*.schema.json`  
> **本文定位：** 第三阶段设计决策、追溯依据与开发交付规范

---

## 0. 阶段完成状态

```text
3. 公式与变量系统
├─ 3.1 确认变量元数据结构          ✅ 已完成
├─ 3.2 确认公式元数据结构          ✅ 已完成
├─ 3.3 确认公式输出方向            ✅ 已完成
├─ 3.4 确认模型分组与主路径        ✅ 已完成
├─ 3.5 选定 v0.1 公式链            ✅ 已完成
├─ 3.6 确认 v0.1 公式清单          ✅ 已完成
├─ 3.7 确认 v0.1 变量清单          ✅ 已完成
├─ 3.8 建立公式依赖关系图          ✅ 已完成
├─ 3.9 建立疑义与冲突清单          ✅ 已完成
└─ 3.10 确认交付给开发的数据格式   ✅ 已完成
```

### 0.1 权威性与跨节点修正规则

本文已经吸收后续节点对前序节点的最终修正。发生表示差异时，适用以下优先级：

```text
实际通过校验的 data/*.json
> 3.10 最终数据格式
> 3.9 疑义与冲突处理
> 3.8 结构化依赖表
> 3.1–3.7 的概念性描述
> ASCII 图示与历史示例
```

已统一应用的关键修正：

1. F001 的无量纲单位 token 使用 `decimal`，不再使用 `dimensionless_decimal`；
2. `gravity.constant_value_si = 9.80665`，课程值 `9.805 m/s²` 仅保留为来源舍入备注；
3. C002、C003 已核实与课程模型一致；C004 保留 `10 mph` 和约 `0.8 standard_gravity` 课程锚点；
4. 机器数据中的 `model_group`、`model_name` 使用 snake_case token，显示名称由 `models.v0.1.json` 统一管理；
5. `formula_constraints` 只允许显式 `all`；`invalid_range` 使用显式 `any`；
6. `known_limitations`、`notes` 为可选字段；
7. `valid_domain` 允许单条件对象或显式 `all` / `any`；
8. `catalog.meta.json` 是版本化文件索引，结构由 `catalog.schema.json` 校验。

---
## 3.1 确认变量元数据结构

状态：已确认

---

### 一、节点目标

本节点用于确认车辆动力学公式求解器中，每个变量在变量库中应具备哪些元数据字段。

变量元数据只定义“这个变量是什么”，不保存本次计算中的具体数值、来源、推导路径或警告状态。

---

### 二、设计原则

1. 变量库必须使用稳定的 `variable_id` 作为唯一引用。
2. 公式、结果对象、依赖关系均引用 `variable_id`，不依赖显示名称或旧公式编号。
3. 变量元数据负责描述变量身份、单位、维度、显示规则、合理性范围、数学/物理约束、假设/常数能力。
4. 一个变量是否能被公式推导出来，不写在变量元数据中，而由公式元数据的输出字段动态决定。
5. 异常但非无效数值是否允许用户确认继续，是全局产品规则，不作为变量字段。
6. v0.1 单位误用检测直接遍历 `allowed_units`，暂不单独设置候选单位字段。
7. 变量元数据和运行时结果对象必须分离。

---

### 三、字段结构

#### A. 身份与搜索字段

| 字段            | 用途                 | 必填/可选 | v0.1 是否必须 |
| ------------- | ------------------ | ----: | --------: |
| `variable_id` | 变量唯一 ID，公式和结果对象引用它 |    必填 |        必须 |
| `name`        | 英文显示名              |    必填 |        必须 |
| `name_zh`     | 中文显示名，后续中文界面使用     |    可选 |      暂不必须 |
| `symbol`      | 公式符号               |    必填 |        必须 |
| `aliases`     | 搜索别名               |    可选 |      建议支持 |
| `category`    | 分类浏览用              |    必填 |        必须 |
| `description` | 变量物理含义             |    必填 |        必须 |

---

#### B. 单位与维度字段

| 字段                 | 用途                           | 必填/可选 | v0.1 是否必须 |
| ------------------ | ---------------------------- | ----: | --------: |
| `dimension`        | 维度检查                         |    必填 |        必须 |
| `internal_unit`    | 内部计算单位，v0.1 默认为 SI           |    必填 |        必须 |
| `default_unit`     | 默认显示/输入单位                    |    必填 |        必须 |
| `allowed_units`    | 用户可选单位、单位误用检测候选来源            |    必填 |        必须 |
| `unit_system_tags` | 标记 SI / US / course_common 等 |    可选 |      暂不必须 |

---

#### C. 展示字段

| 字段                  | 用途           | 必填/可选 | v0.1 是否必须 |
| ------------------- | ------------ | ----: | --------: |
| `display_role`      | 结果展示角色       |    必填 |        必须 |
| `importance`        | 展示排序、缺失条件优先级 |    必填 |        必须 |
| `display_precision` | 默认小数位或有效数字   |    可选 |      暂不必须 |
| `sort_order`        | 同分类内排序       |    可选 |      暂不必须 |

`display_role` 确认取值：

```text
primary_output
derived_output
intermediate
input_only
constant
assumption
```

---

#### D. 合理性检查字段

| 字段                  | 用途         | 必填/可选 | v0.1 是否必须 |
| ------------------- | ---------- | ----: | --------: |
| `normal_range`      | 正常范围       |    必填 |      必须支持 |
| `warning_range`     | 异常但可能范围    |    必填 |      必须支持 |
| `invalid_range`     | 绝对无效范围     |    必填 |      必须支持 |
| `unit_misuse_check` | 是否启用单位误用检测 |    可选 |    必须支持开关 |

---

#### E. 数学与物理约束字段

| 字段                | 用途                                    | 必填/可选 | v0.1 是否必须 |
| ----------------- | ------------------------------------- | ----: | --------: |
| `valid_domain`    | 数学/物理定义域，例如 `> 0`、`>= 0`、`0 < η <= 1` |    必填 |        必须 |
| `sign_convention` | 正负号约定，例如坡度角、加速度、力方向                   |  条件必填 |   有方向变量必须 |
| `physical_notes`  | 物理说明或注意事项                             |    可选 |      暂不必须 |

---

#### F. 输入、假设与常数字段

| 字段                   | 用途              | 必填/可选 |     v0.1 是否必须 |
| -------------------- | --------------- | ----: | ------------: |
| `can_be_user_input`  | 是否允许用户手动输入      |    必填 |            必须 |
| `can_be_assumed`     | 是否允许作为简化假设      |  条件必填 |        假设变量必须 |
| `default_assumption` | 默认假设值、含义、是否默认启用 |  条件必填 | v0.1 默认假设变量必须 |
| `is_constant`        | 是否为系统常数         |  条件必填 |          常数必须 |
| `constant_value_si`  | 常数 SI 数值        |  条件必填 |          常数必须 |

---

#### G. 来源与维护字段

| 字段                 | 用途                                 | 必填/可选 | v0.1 是否必须 |
| ------------------ | ---------------------------------- | ----: | --------: |
| `source_reference` | 变量定义来源                             |    可选 |      建议保留 |
| `notes`            | 歧义、待确认问题                           |    可选 |      建议支持 |
| `status`           | `confirmed / draft / needs_review` |    必填 |        必须 |

---

### 四、v0.1 最低字段集合

v0.1 普通变量至少需要以下字段：

```text
variable_id
name
symbol
category
description
dimension
internal_unit
default_unit
allowed_units
display_role
importance
normal_range
warning_range
invalid_range
valid_domain
can_be_user_input
status
```

特殊变量额外需要：

```text
sign_convention        // 有正负方向的变量
can_be_assumed         // 可作为默认假设的变量
default_assumption     // v0.1 默认假设变量
is_constant            // 系统常数
constant_value_si      // 系统常数值
```

---

### 五、已删除字段

以下字段不进入最终变量元数据结构：

| 字段                           | 处理结论         | 原因                                |
| ---------------------------- | ------------ | --------------------------------- |
| `nonzero_required`           | 删除           | 统一并入 `valid_domain`，避免双字段冲突       |
| `can_be_derived`             | 删除           | 是否可推导由公式元数据 `output` 动态决定         |
| `allow_user_confirm_warning` | 删除           | 属于全局产品规则，不是变量属性                   |
| `unit_misuse_candidates`     | v0.1 删除 / 后置 | v0.1 直接遍历 `allowed_units` 做单位误用检测 |

---

### 六、明确边界

变量元数据不保存运行时结果值。

以下字段不属于变量元数据，属于运行时结果对象：

```text
value_si
display_value
display_unit
source
formula_path
dependencies
assumptions_used
model_name
is_active
is_stale
warnings
```

原因：

同一个变量可能同时存在用户输入值、公式推导值、假设值、常数值或多模型结果。

变量库只定义：

```text
这个变量是什么
```

运行时结果对象才记录：

```text
这次算出来多少
从哪里来
是否有效
是否过期
是否有警告
```

---

### 七、3.1 最终结论

采用以下变量元数据结构：

```text
变量元数据 =
身份搜索
+ 单位维度
+ 展示角色
+ 合理性范围
+ 数学/物理约束
+ 输入/假设/常数能力
+ 来源状态
```

本结构用于支撑：

1. 任意变量输入；
2. 混合单位输入；
3. 内部统一单位计算；
4. 单位误用建议；
5. 合理性检查；
6. 缺失条件分析；
7. 推导过程展示；
8. 后续公式元数据和递归推导引擎。

---

### 八、节点状态

```text
3.1 ✅ 已完成
```


---


## 3.2 确认公式元数据结构

状态：已确认

---

### 一、节点目标

本节点用于确认车辆动力学公式求解器中，每条公式在公式库中应具备哪些元数据字段。

公式元数据只定义：

```text
这条公式是什么
它需要哪些输入
它能输出什么
属于哪个模型
什么时候适用
允许使用哪些假设
表达式使用什么单位体系
来源是什么
```

公式元数据不保存本次运行中的输入值、输出值、是否过期、是否冲突、是否缺失条件等运行时状态。

---

### 二、设计原则

1. 公式库必须使用稳定的 `formula_id` 作为单条可执行公式记录的唯一引用。
2. 同一物理关系的不同输出方向，可以用 `formula_family_id` 归为同一族。
3. 每条可执行公式必须显式声明输入变量、输出变量、适用条件、数学约束和来源。
4. v0.1 不做任意自动代数反解。
5. 公式只有明确登记了某个 `output`，引擎才允许向该方向计算。
6. 真正决定某个方向能否计算的依据，是是否存在对应 `output` 的 `formula_id` 记录。
7. `allowed_output_direction` 只作为文档/规划字段，用于记录某个公式族理论上还可以登记哪些输出方向；引擎运行时不读取该字段。
8. 不同物理模型得到同一变量时，不应静默覆盖，应保留模型名称和路径角色。
9. 默认假设只能在公式明确允许时使用。
10. 公式元数据和运行时推导对象必须分离。
11. 公式元数据不得依赖旧公式编号、变量显示名或代码执行顺序。
12. 默认所有可执行 `expression` 应以内部统一单位体系书写，即 v0.1 默认为 SI 一致表达。
13. 只有当公式来源本身绑定特定单位经验常数，且不适合重新整理为 SI 系数时，才允许使用原始来源单位表达式。
14. 使用原始来源单位表达式时，必须声明代入前输入变量要换算到什么单位，以及表达式原生输出单位是什么。

---

### 三、字段结构

#### A. 身份与来源字段

| 字段                  | 用途                                              | 必填/可选 |     v0.1 是否必须 |
| ------------------- | ----------------------------------------------- | ----: | ------------: |
| `formula_id`        | 单条可执行公式记录的唯一 ID                                 |    必填 |            必须 |
| `formula_family_id` | 同一物理关系的不同输出方向归为同一族                              |    可选 | 建议支持；多输出方向时必须 |
| `name`              | 公式显示名                                           |    必填 |            必须 |
| `description`       | 公式物理含义说明                                        |    必填 |            必须 |
| `source_reference`  | 来源：教材、课堂、公式册、备注等                                |    必填 |            必须 |
| `source_priority`   | 来源权威等级，用于冲突审查，不自动覆盖结果                           |    可选 |          建议支持 |
| `status`            | `confirmed / draft / needs_review / deprecated` |    必填 |            必须 |
| `notes`             | 人工备注、疑义、待确认问题                                   |    可选 |          建议支持 |

说明：

`formula_id` 是具体可执行公式记录。

`formula_family_id` 是同一原始物理关系。

例如同一公式族可以有“求功率”“求扭矩”“求转速”等多个登记方向，但每个方向应有独立的 `formula_id`。

v0.1 如果某个物理关系只登记一个输出方向，`formula_family_id` 可以暂不强制填写；后续一旦同族登记多个方向，应补齐。

---

#### B. 公式表达与单位字段

| 字段                     | 用途                                    | 必填/可选 |             v0.1 是否必须 |
| ---------------------- | ------------------------------------- | ----: | --------------------: |
| `expression`           | 人类可读公式表达，建议 LaTeX                     |    必填 |                    必须 |
| `formula_type`         | 公式类型：代数、分段、经验、查表、近似、恒等式等              |    必填 |                    必须 |
| `computability`        | 当前是否可程序化：直接可算、需用户输入系数、需数字化曲线、暂不支持     |    必填 |                    必须 |
| `expression_unit_mode` | 公式表达式的单位模式：SI 一致或来源原生单位               |    必填 |                    必须 |
| `substitution_units`   | 声明代入 `expression` 前，每个输入变量需要换算到的具体单位  |  条件必填 | 含非 SI 经验常数或混合单位表达式时必须 |
| `native_output_unit`   | 声明 `expression` 直接算出的原生单位；引擎据此换算回内部单位 |  条件必填 |      表达式原生输出不是内部单位时必须 |
| `piecewise_cases`      | 分段公式的条件和对应表达                          |  条件必填 |                分段公式必须 |
| `approximation_level`  | 是否为精确式、小角度近似、低速近似等                    |  条件必填 |                有近似时必须 |

`formula_type` 初始取值：

```text
algebraic
piecewise
empirical
lookup_table
curve_based
approximation
identity
```

`computability` 初始取值：

```text
direct
requires_user_coefficient
requires_digitized_curve
unsupported
needs_review
```

`expression_unit_mode` 初始取值：

```text
si_consistent
source_native
```

含义：

| 取值              | 含义                                                                             |
| --------------- | ------------------------------------------------------------------------------ |
| `si_consistent` | 表达式默认接收变量的 `internal_unit`，输出也默认是输出变量的 `internal_unit`                         |
| `source_native` | 表达式沿用教材、公式册或来源资料中的原生单位，需要通过 `substitution_units` 和 `native_output_unit` 显式声明单位 |

示例：

```text
HP = T × RPM / 5252
```

该公式不能直接代入 SI 中的 N·m 和 rad/s，因为 5252 只在 T 使用 ft·lb、转速使用 RPM 时成立。

应记录为：

```text
expression_unit_mode: source_native
substitution_units:
  T_e: ft*lbf
  engine_speed: rpm
native_output_unit: hp
```

再由引擎把 hp 换算回内部 SI 功率单位 W。

再例：

```text
f_r = (0.0041 + 0.000041V) · C_h
```

如果来源明确 `V` 是 mph，则应记录为：

```text
expression_unit_mode: source_native
substitution_units:
  V: mph
native_output_unit: dimensionless
```

再例：

```text
r_w = (section_width × aspect_ratio) / 25.4 + rim_diameter / 2
```

该表达式内部混合了 mm 和 inch，应记录为：

```text
expression_unit_mode: source_native
substitution_units:
  section_width: mm
  aspect_ratio: dimensionless
  rim_diameter: in
native_output_unit: in
```

然后由引擎把输出轮胎半径换算回内部长度单位。

---

#### C. 输入与输出字段

| 字段                         | 用途                                                   | 必填/可选 | v0.1 是否必须 |
| -------------------------- | ---------------------------------------------------- | ----: | --------: |
| `required_inputs`          | 该计算方向必须具备的变量 ID 列表                                   |    必填 |        必须 |
| `output`                   | 该公式记录实际输出的变量 ID                                      |    必填 |        必须 |
| `allowed_output_direction` | 文档/规划字段，记录该公式族理论上可考虑登记的输出方向                          |    可选 |  支持但引擎不读取 |
| `direction_label`          | 当前公式方向说明，例如 `power_from_torque_and_speed`            |    可选 |      建议支持 |
| `intermediate_outputs`     | 公式内部可展示的中间量                                          |    可选 |      暂不必须 |
| `input_roles`              | 输入变量角色说明，例如 numerator、denominator、condition variable |    可选 |      暂不必须 |

关键规则：

1. v0.1 不做任意自动代数反解。
2. 公式只有明确登记了某个 `output`，才允许向该方向计算。
3. `allowed_output_direction` 不参与运行时计算判断。
4. 运行时判断某个方向能不能算，只看是否存在对应 `output` 的 `formula_id`。
5. 具体哪些方向纳入 v0.1，在 3.3 确认公式输出方向 中再决定。

---

#### D. 模型与路径字段

| 字段            | 用途                                                         | 必填/可选 | v0.1 是否必须 |
| ------------- | ---------------------------------------------------------- | ----: | --------: |
| `model_group` | 所属模块，例如 Axle Loads、Acceleration Performance                |    必填 |        必须 |
| `model_name`  | 具体物理模型名称                                                   |    必填 |        必须 |
| `model_type`  | 模型类型，例如 force balance、idealized power model、geometry model |    可选 |      建议支持 |
| `path_role`   | 路径角色：主路径、替代路径、校验路径、参考路径                                    |    必填 |        必须 |
| `priority`    | 同模型、同输出下的排序优先级                                             |    必填 |        必须 |

删除字段：

```text
reference_only
```

原因：

`path_role = reference` 已经能够表达参考路径，不需要额外布尔字段重复描述。

`path_role` 初始取值：

```text
primary
alternative
validation
reference
```

说明：

不同物理模型得到同一变量时，不自动当作冲突。

必须通过 `model_name` 和 `path_role` 标明模型差异。

如果是同一模型、同一输出、同一适用条件下得到不同结果，才进入冲突或多路径比较规则。

---

#### E. 假设与适用条件字段

| 字段                          | 用途                         | 必填/可选 | v0.1 是否必须 |
| --------------------------- | -------------------------- | ----: | --------: |
| `model_assumptions`         | 模型层面的假设说明，例如低速、忽略空气阻力、恒功率等 |    必填 |        必须 |
| `allowed_assumption_inputs` | 本公式允许由默认假设补齐的变量 ID 列表      |    必填 |        必须 |
| `applicability_conditions`  | 公式适用条件，不满足时路径不可计算          |    必填 |        必须 |
| `formula_constraints`       | 公式级数学约束，例如分母不为零、根号内非负      |    必填 |        必须 |
| `condition_explanation`     | 给用户看的适用条件解释                |    可选 |      建议支持 |

删除字段：

```text
invalid_when
```

原因：

`invalid_when` 本质上是 `applicability_conditions` 或 `formula_constraints` 的反向表述，容易造成三套条件互相矛盾。

保留两个正向字段即可：

| 字段                         | 含义     |
| -------------------------- | ------ |
| `applicability_conditions` | 模型适用条件 |
| `formula_constraints`      | 数学合法条件 |

重点区分：

| 类型                          | 含义             |
| --------------------------- | -------------- |
| `required_inputs`           | 计算所需变量         |
| `allowed_assumption_inputs` | 哪些输入可以由已启用假设补齐 |
| `applicability_conditions`  | 公式是否适用于当前工况    |
| `formula_constraints`       | 数学上能不能合法执行     |

例子：

某公式缺少坡度角时，如果该公式允许平路假设，且 `θ = 0` 假设启用，则不算 Missing。

但如果公式的适用条件不满足，不能把它显示成缺少输入。

---

#### F. 缺失条件与反向查询支持字段

| 字段                           | 用途                | 必填/可选 | v0.1 是否必须 |
| ---------------------------- | ----------------- | ----: | --------: |
| `missing_condition_template` | 当前公式无法计算时，如何解释缺失项 |    可选 |      建议支持 |
| `target_query_enabled`       | 是否允许用于目标量反向找条件    |    可选 |   默认 true |
| `reverse_search_notes`       | 反向找条件时的说明，不等于自动反解 |    可选 |      建议支持 |

说明：

反向找条件不是自动代数反解。

它只是根据已登记的 `output` 和 `required_inputs` 查找路径，告诉用户还缺什么。

v0.1 默认每条可执行公式都允许参与目标量反向查询，因此 `target_query_enabled` 可以默认 true，不必每条公式重复填写。

只有未来出现某些公式不应参与反向查询时，再显式设置为 false。

---

#### G. 推导展示字段

| 字段                       | 用途                  | 必填/可选 | v0.1 是否必须 |
| ------------------------ | ------------------- | ----: | --------: |
| `derivation_display`     | 是否在推导详情中展示          |    可选 |   默认 true |
| `derivation_template`    | 展示公式、代入、单位转换、中间量的模板 |    可选 |      建议支持 |
| `display_equation_order` | 多公式展示顺序             |    可选 |      暂不必须 |
| `result_explanation`     | 结果物理意义说明            |    可选 |      建议支持 |

说明：

v0.1 默认每条可执行公式都应进入推导详情，因此 `derivation_display` 可以默认 true，不必每条公式重复填写。

v0.1 至少要能展示：

```text
使用了哪条公式
公式表达式
输入变量
输入值
代入前单位换算
使用的假设
适用条件
输出结果
输出结果换算回内部单位
来源
```

其中“代入前单位换算”和“输出结果换算回内部单位”用于支持 `source_native` 表达式。

---

#### H. 验证与维护字段

| 字段                     | 用途           | 必填/可选 |  v0.1 是否必须 |
| ---------------------- | ------------ | ----: | ---------: |
| `test_case_ids`        | 关联测试案例 ID    |    可选 |       建议支持 |
| `comparison_tolerance` | 同模型多路径比较时的容差 |    可选 | 后续工程安全阶段细化 |
| `known_limitations`    | 已知限制         |    可选 |       建议支持 |

---

### 四、v0.1 最低字段集合

v0.1 每条可执行公式记录至少需要以下字段：

```text
formula_id
name
description
source_reference
status

expression
formula_type
computability
expression_unit_mode

required_inputs
output

model_group
model_name
path_role
priority

model_assumptions
allowed_assumption_inputs
applicability_conditions
formula_constraints
```

对于 `expression_unit_mode = source_native` 的公式，额外必须填写：

```text
substitution_units
native_output_unit
```

对于分段、近似、查表、曲线类公式，额外需要：

```text
piecewise_cases          // 分段公式
approximation_level      // 近似公式
known_limitations        // 有明显限制时
```

以下字段支持，但不作为 v0.1 每条公式的最低必填项：

```text
formula_family_id        // 多输出方向或同族管理时使用
allowed_output_direction // 文档/规划字段，引擎不读取
direction_label          // 人类可读方向标签
model_type               // 模型类型抽象
target_query_enabled     // 默认 true
derivation_display       // 默认 true
```

---

### 五、已删除或降级字段

#### 1. 删除 `reference_only`

原因：

`path_role = reference` 已经能表达参考路径。

#### 2. 删除 `invalid_when`

原因：

禁止使用条件应由以下两个字段表达：

```text
applicability_conditions
formula_constraints
```

不再维护反向字段，避免条件重复和冲突。

#### 3. 删除 `review_status`

原因：

`status` 已经包含 `confirmed / draft / needs_review / deprecated` 等审查状态，不再单独设置 `review_status`，避免两个字段表达同一件事。

#### 4. 降级 `formula_family_id`

原因：

它对同一物理关系的多方向管理有用，但 v0.1 单条公式链不一定每条都需要。

保留字段，后续同族多方向登记时再强制。

#### 5. 降级 `direction_label`

原因：

它有助于人工阅读和调试，但不是引擎运行的核心依据。

#### 6. 降级 `model_type`

原因：

`model_name` 已能满足 v0.1 的模型区分需求，`model_type` 作为更高层抽象暂不强制。

#### 7. 降级 `target_query_enabled`

原因：

v0.1 默认所有可执行公式都参与目标量反向查询。

只有未来出现例外时才需要显式填写 false。

#### 8. 降级 `derivation_display`

原因：

v0.1 默认所有可执行公式都展示推导详情。

只有未来出现不适合展示的公式时才需要显式关闭。

---

### 六、格式留待后续确认

以下字段的具体数据格式暂不在 3.2 定死：

```text
formula_constraints
applicability_conditions
valid_domain
```

它们可以是字符串，也可以是结构化对象。

具体采用哪种格式，留到 3.10 确认交付给开发的数据格式 时统一决定。

---

### 七、明确边界

公式元数据不保存运行时状态。

以下字段不属于公式元数据：

```text
current_input_values
current_output_value
is_currently_applicable
is_currently_missing
runtime_missing_variables
runtime_invalid_variables
runtime_conflict_status
is_active
is_stale
warnings
formula_path_instance
```

这些属于运行时结果对象或推导路径对象。

公式库只定义：

```text
这条公式是什么
它需要哪些输入
它能输出什么
属于哪个模型
什么时候适用
允许使用哪些假设
表达式使用什么单位体系
来源是什么
```

运行时对象才记录：

```text
这次是否能算
用了哪些实际输入
用了哪些假设
代入前换算到了什么单位
算出多少
输出结果如何换算回内部单位
是否过期
是否冲突
哪些条件缺失
```

---

### 八、3.2 最终结论

采用以下公式元数据结构：

```text
公式元数据 =
身份来源
+ 公式表达
+ 表达式单位模式
+ 输入输出
+ 模型路径
+ 假设条件
+ 反向查询支持
+ 推导展示
+ 验证维护
```

本结构用于支撑：

1. 正向递归推导；
2. 目标量反向找条件；
3. 多路径结果保留；
4. 不同物理模型区分；
5. 默认假设显式使用；
6. 公式适用条件判断；
7. 推导过程展示；
8. 来源原生单位公式的安全计算；
9. 后续 3.3 输出方向确认。

---

### 九、节点状态

```text
3.2 ✅ 已完成
```


---


## 3.3 确认公式输出方向

状态：已确认

---

### 一、节点目标

本节点用于确认车辆动力学公式求解器中，公式输出方向如何登记、如何判断、如何用于正向递归推导和目标量反向查询。

本节点只处理：

```text
公式是否允许向某个变量输出
某个输出方向如何登记
反向查询和自动反解的边界
引擎如何判断某个方向是否可以参与计算
```

本节点不处理：

```text
具体 v0.1 公式链
具体公式清单
具体变量清单
公式依赖图
代码实现
```

---

### 二、核心结论

采用 **显式登记输出方向** 规则：

```text
一条可执行方向记录 = 一个 formula_id + 一组 required_inputs + 一个 output
```

同一个物理关系如果要支持多个输出方向，必须登记为多条独立公式记录。

引擎不得根据代数关系自动猜测反解方向。

---

### 三、输出方向三种登记状态

公式输出方向分为三种状态：

| 状态                    | 含义                                                   | 引擎是否可直接执行 |
| --------------------- | ---------------------------------------------------- | --------- |
| `registered`          | 已存在具体 `formula_id`，并声明了 `required_inputs` 和 `output` | 还需继续判断    |
| `documented_possible` | 理论上可考虑登记，记录在 `allowed_output_direction` 中            | 否         |
| `not_supported`       | 不支持、未验证、存在歧义或暂不需要                                    | 否         |

关键规则：

```text
registered 只代表该输出方向存在 formula_id 记录。
```

它不等于本次一定可以执行。

是否真正可执行，还必须继续检查：

```text
computability
required_inputs 是否满足
allowed_assumption_inputs 是否允许假设补齐
applicability_conditions 是否满足
formula_constraints 是否满足
```

---

### 四、三层判断机制

引擎判断某个方向能否参与计算时，必须分三层。

#### 第一层：方向是否登记

检查是否存在：

```text
formula_id
required_inputs
output
```

如果不存在对应 `output` 的 `formula_id`，该方向不可计算。

#### 第二层：公式是否可程序化

检查 3.2 已确认的 `computability` 字段。

例如：

```text
direct
requires_user_coefficient
requires_digitized_curve
unsupported
needs_review
```

只有 `computability` 满足当前引擎能力时，公式才允许进入计算候选。

例如：

```text
某方向已经 registered，
但 computability = requires_digitized_curve，
而 v0.1 尚未数字化曲线，
则该方向仍不可执行。
```

#### 第三层：本次运行条件是否满足

即使方向已登记，且公式本身可程序化，本次运行仍需检查：

```text
required_inputs 是否齐全
缺失输入是否允许由假设补齐
applicability_conditions 是否满足
formula_constraints 是否满足
输入值是否有效
单位换算是否明确
```

只有三层全部通过，公式才可以执行并生成结果。

---

### 五、`allowed_output_direction` 的边界

`allowed_output_direction` 是文档/规划字段，不是运行时判断字段。

它的用途是记录：

```text
某个公式族理论上还可以考虑登记哪些输出方向
```

但引擎运行时不得读取它来决定是否计算。

真正决定能不能计算某个方向的依据是：

```text
是否存在对应 output 的 formula_id
```

---

### 六、每个输出方向必须独立登记

例如同一物理关系：

```text
Power = Torque × angular speed
```

理论上可有多个方向：

```text
P = T × ω
T = P / ω
ω = P / T
```

但不能只登记一条公式，然后让引擎自动变形。

应拆成：

| formula_id                | required_inputs           | output          |
| ------------------------- | ------------------------- | --------------- |
| `power_from_torque_speed` | `torque`, `angular_speed` | `power`         |
| `torque_from_power_speed` | `power`, `angular_speed`  | `torque`        |
| `speed_from_power_torque` | `power`, `torque`         | `angular_speed` |

如果 v0.1 只需要第一个方向，就只登记第一个方向。

其余方向可以记录在 `allowed_output_direction` 里，但不参与引擎执行。

---

### 七、允许登记为输出方向的条件

一个方向要成为 `registered`，至少应满足：

| 条件     | 说明                                                                       |
| ------ | ------------------------------------------------------------------------ |
| 数学关系明确 | 该输出能被唯一、稳定地求出                                                            |
| 物理意义明确 | 输出结果在车辆动力学语境中有实际解释                                                       |
| 定义域清楚  | 分母、根号、三角函数、分段边界等条件明确                                                     |
| 单位处理清楚 | 能用 `expression_unit_mode / substitution_units / native_output_unit` 安全计算 |
| 适用条件清楚 | 公式模型适用范围已明确                                                              |
| 来源可追溯  | 有教材、公式册、课堂说明或人工推导备注                                                      |
| 可测试    | 至少能设计一个手算或参考测试案例                                                         |

不满足这些条件的方向，不登记为 `registered`。

---

### 八、不允许自动登记的方向

以下方向即使代数上看似可解，也不得自动登记：

| 类型              | 原因                  |
| --------------- | ------------------- |
| 分段公式反解          | 需要先判断区间，容易多解或误判     |
| 查图/曲线公式反解       | 原始关系不是显式函数          |
| 经验公式反解          | 可能只在原方向有工程意义        |
| 多根公式反解          | 例如平方、根号、三角函数会产生多个候选 |
| 需要额外物理判断的方向     | 代数可解不等于工程可用         |
| 不在 v0.1 目标链中的方向 | 增加维护和测试负担           |
| 未验证单位常数的方向      | 容易产生隐蔽单位错误          |

---

### 九、反向查询不是自动反解

需要明确区分：

| 功能   | 含义                              |
| ---- | ------------------------------- |
| 反向查询 | 用户选目标变量，系统查找哪些已登记公式能输出它，并列出缺失输入 |
| 自动反解 | 系统把任意公式代数变形，临时生成新公式             |

v0.1 支持反向查询，不支持自动反解。

例如用户想求 `power`，系统可以查：

```text
有哪些公式的 output = power？
这些公式分别需要哪些 required_inputs？
当前满足了哪些？
还缺哪些？
```

但系统不能把任意含有 `power` 的公式自动变形成求 `power` 的形式。

---

### 十、不同公式类型的方向策略

| 公式类型            | 输出方向策略                |
| --------------- | --------------------- |
| `algebraic`     | 可登记多个方向，但每个方向必须独立验证   |
| `identity`      | 可登记多个方向，但要避免和单位系统职责重复 |
| `empirical`     | 默认只登记原始来源方向           |
| `piecewise`     | 默认只登记原始正向方向           |
| `lookup_table`  | v0.1 不登记反向方向          |
| `curve_based`   | v0.1 不登记反向方向          |
| `approximation` | 只登记近似成立条件下明确需要的方向     |

说明：

类似 `195/55R16` 这种轮胎规格字符串解析，属于输入预处理或 UI 层逻辑，不作为新的 `formula_type`。

轮胎半径计算本身可以作为普通 `algebraic` 公式登记，例如：

```text
r_w = (section_width × aspect_ratio) / 25.4 + rim_diameter / 2
```

但“快捷输入”不单独成为公式输出方向类型。

---

### 十一、与用户输入、假设、常数的关系

本节点遵循 Part 2 已确认规则，不重新定义数值优先级。

#### 1. 用户输入

用户可以输入本来可由公式推导的变量。

默认规则：

```text
用户输入值默认作为 Active 值。
公式推导值保留为 Derived 值。
两者不互相覆盖。
差异由多路径结果规则展示。
```

#### 2. 假设

假设只用于补齐公式输入，不作为公式输出方向。

例如：

```text
θ = 0
D_A = 0
R_x = 0
R_hx = 0
```

这些由变量元数据中的假设能力和公式元数据中的 `allowed_assumption_inputs` 控制。

```text
假设不是公式输出。
```

#### 3. 常数

系统常数由变量元数据提供，不作为公式输出方向登记。

例如：

```text
g
π
```

```text
常数不是公式输出。
```

---

### 十二、v0.1 输出方向策略

v0.1 采用保守策略：

```text
只登记当前公式链实际需要、来源明确、单位安全、可测试的输出方向。
```

不为了“看起来功能更强”登记所有代数可解方向。

原因：

1. v0.1 目标是跑通最小完整闭环；
2. 每多一个方向，就多一组单位、定义域、适用条件和测试负担；
3. 自动反解容易制造看似合理但错误的结果；
4. 后续扩展时可以逐步补充方向。

---

### 十三、3.3 建议结论

采用以下公式输出方向规则：

```text
公式输出方向 =
显式登记
+ 单方向记录
+ 多方向多 formula_id
+ allowed_output_direction 仅作规划
+ registered 不等于可执行
+ computability 仍需单独判断
+ 反向查询只查已登记 output
+ 不做自动代数反解
```

本规则用于支撑：

1. 正向递归推导；
2. 目标量反向找条件；
3. 防止隐式反解错误；
4. 防止 registered 与 computability 混用；
5. 控制 v0.1 公式库复杂度；
6. 后续逐步扩展公式方向；
7. 保持公式来源、单位、适用条件可追溯。

---

##


---


## 3.4 确认模型分组与主路径

状态：已确认

---

### 一、节点目标

本节点用于确认车辆动力学公式求解器中，公式如何按物理模型分组，以及当多个公式或多个模型都能得到同一变量时，系统如何判断主路径、替代路径、校验路径和参考路径。

本节点只处理：

```text
模型分组规则
模型名称规则
主路径定义
替代路径定义
校验路径定义
参考路径定义
同模型多路径结果如何处理
不同模型结果如何处理
推荐模型如何参与后续计算
路径角色如何影响递归推导
```

本节点不处理：

```text
具体 v0.1 公式链
具体 v0.1 公式清单
具体 v0.1 变量清单
具体公式依赖关系图
复杂路径展示排序算法
代码实现
```

---

### 二、核心结论

采用两层模型分组：

```text
model_group = 大模块 / 章节 / 功能域
model_name  = 具体物理模型
```

采用路径角色：

```text
path_role =
primary
alternative
validation
reference
```

采用保守主路径规则：

```text
主路径只代表在同一模型、同一输出、同一适用条件下的默认优先路径。
主路径不代表跨物理模型的绝对正确答案。
```

采用跨模型推荐规则：

```text
跨模型结果是否作为 Active，不能只看 primary。
如果多个不同模型能输出同一变量，需要推荐模型规则或用户选择。
```

---

### 三、模型分组层级

#### 1. `model_group`

`model_group` 表示公式所属的大模块或功能域。

建议初始分组包括：

```text
Axle Loads
Acceleration Performance
Braking Performance
Road Loads
Ride
Steady-State Cornering
Suspension
Rollover
Tire and Wheel Geometry
Powertrain Kinematics
```

说明：

1. 前八项对应车辆动力学主要章节或长期覆盖范围；
2. `Tire and Wheel Geometry` 用于轮胎半径、轮胎尺寸等基础几何关系；
3. `Powertrain Kinematics` 用于发动机转速、车轮转速、传动比、车速之间的运动学关系；
4. 后续如果新增模块，应先确认命名，不在公式库或代码中临时创造分组。

不设置以下分组：

```text
Constants and Unit Utilities
```

原因：

1. 常数，例如 `g`、`π`，由 3.1 变量元数据中的 `is_constant` 和 `constant_value_si` 管理；
2. 单位换算，例如 `mph ↔ m/s`、`ft·lbf ↔ N·m`，属于单位系统职责；
3. 来源原生单位公式由 3.2 中的 `expression_unit_mode`、`substitution_units`、`native_output_unit` 处理；
4. 常数和单位换算不应混入物理模型分组，否则会污染公式层职责。

---

#### 2. `model_name`

`model_name` 表示具体物理模型。

例如：

```text
Static axle load on level ground
Low-speed longitudinal load transfer
Grade load transfer
General dynamic axle load
Ideal constant-power acceleration
Engine-limited acceleration
Powertrain speed relation
Tire size radius model
Aerodynamic drag model
Rolling resistance model
```

说明：

1. `model_name` 必须描述物理模型，而不是只描述公式编号；
2. 不同 `model_name` 代表不同物理假设或适用条件；
3. 同一 `model_group` 下可以有多个 `model_name`；
4. 不同 `model_group` 下也可能输出同一个变量，但必须明确模型来源。

---

#### 3. `model_type`

`model_type` 是可选的高层分类，用于说明模型性质。

建议取值包括：

```text
force_balance
kinematic_relation
empirical_model
geometry_model
idealized_model
lookup_or_curve
definition
```

说明：

1. v0.1 不强制每条公式填写 `model_type`；
2. 如果存在不同物理模型输出同一变量，建议填写；
3. `model_type` 不参与核心计算判断，只用于展示、筛选和人工理解。

---

### 四、路径角色定义

#### 1. `primary`

`primary` 表示同一模型、同一输出、同一适用条件下的默认首选路径。

用途：

```text
默认用于生成 Active 推导结果
作为缺失条件推荐时的优先路径
作为推导展示的主线
```

限制：

```text
primary 只在同一 model_name 内有效。
primary 不跨模型压制其他模型。
primary 不代表该结果一定比其他物理模型更准确。
```

---

#### 2. `alternative`

`alternative` 表示可用的替代路径。

用途：

```text
当 primary 不可用时提供其他计算方案
在目标反向查询中作为备选路径显示
在用户需要比较不同补齐方案时展示
```

说明：

`alternative` 可以参与计算，但默认不覆盖 `primary`。

---

#### 3. `validation`

`validation` 表示主要用于校验或交叉检查的路径。

用途：

```text
验证 primary 路径结果是否一致
发现同模型多路径冲突
帮助用户检查输入或单位问题
```

限制：

```text
validation 默认不作为后续计算的 Active 来源。
除非用户明确选择，或 primary 不存在且该路径被提升为可用路径。
```

---

#### 4. `reference`

`reference` 表示只作参考的路径。

用途：

```text
展示近似模型
展示教材中的简化公式
展示不完整或不推荐参与递归推导的关系
```

限制：

```text
reference 默认不参与后续递归推导。
reference 不作为 Active 值来源。
reference 可显示，但必须标明仅供参考。
```

---

### 五、主路径选择范围

主路径选择必须限定在以下范围内：

```text
同一个 output
同一个 model_name
同一类 applicability_conditions
同一计算方向
```

不得跨以下边界强行选主路径：

```text
不同 model_name
不同 model_group
不同适用条件
不同假设体系
不同物理建模方法
```

原因：

不同物理模型之间不是普通路径竞争，而是模型假设不同。

例如：

```text
Ideal constant-power acceleration
```

和：

```text
Engine-limited acceleration
```

即使都能输出 `a_x`，也不能简单说一个是另一个的冲突路径。

它们应作为不同模型结果展示。

---

### 六、同模型多路径处理

同一 `model_name` 下，如果多个路径输出同一变量：

#### 1. 结果一致

如果多个同模型路径结果在容差范围内一致：

```text
primary 结果作为 Active
其他路径标记为 Verified 或 Alternative
推导详情中显示验证关系
```

#### 2. 结果不一致

如果多个同模型路径结果超过容差：

```text
该变量进入 Conflict 状态
不自动选择 Active 推导值
依赖该变量的后续分支暂停
提示用户检查输入、单位、假设或路径来源
```

#### 3. 有用户输入值

如果用户已经输入该变量：

```text
用户输入值默认作为 Active
公式推导值用于核对
若差异超过容差，显示用户输入与推导值差异
```

该规则遵循 Part 2 已确认的数值优先原则，不在本节点重新定义。

---

### 七、不同模型结果处理

不同 `model_name` 得到同一变量时：

```text
不自动视为冲突
不自动互相验证
必须显示模型差异
```

每个模型结果至少应能展示：

```text
model_group
model_name
model_type（如有）
path_role
applicability_conditions
model_assumptions
是否为推荐模型
是否仅供参考
```

#### 1. 存在推荐模型

如果某个模型被公式系统指定为推荐模型，且当前适用条件满足：

```text
推荐模型结果作为 Active
其他模型结果标记为 Alternative 或 Different model
后续依赖该变量的计算使用推荐模型结果
```

#### 2. 不存在推荐模型

如果多个模型都能输出同一变量，但没有明确推荐模型：

```text
不自动选择 Active
依赖该变量的后续分支暂停
提示用户选择一个模型继续
```

#### 3. 推荐模型不可用

如果推荐模型当前不可计算或适用条件不满足：

```text
不得强行使用推荐模型
不得自动改用其他模型，除非另有明确 fallback 规则
系统应提示推荐模型不可用，并显示其他可选模型
```

v0.1 默认不设置复杂 fallback 规则。

---

### 八、推荐模型与主路径的区别

必须区分：

| 概念        | 作用范围   | 含义                       |
| --------- | ------ | ------------------------ |
| `primary` | 同一模型内部 | 同一模型下的默认计算路径             |
| 推荐模型      | 不同模型之间 | 多个模型都能输出同一变量时，默认采用哪个模型结果 |

也就是说：

```text
primary 是公式路径级别。
推荐模型是物理模型级别。
```

示例：

```text
Engine-limited acceleration model
```

内部可以有一个 `primary` 路径和若干 `alternative` 路径。

但它是否优先于：

```text
Ideal constant-power acceleration model
```

不是由 `primary` 决定，而是由推荐模型规则决定。

---

### 九、推荐模型的确认方式

推荐模型不得由代码临时猜测。

推荐模型只能来自：

```text
公式系统明确指定
后续节点人工确认
用户在界面中手动选择
```

v0.1 中，如果需要推荐模型，应在后续节点中明确记录：

```text
output
model_group
recommended_model_name
适用条件
推荐原因
fallback 行为
```

本节点只确认推荐模型规则，不选定具体 v0.1 推荐模型。

---

### 十、`priority` 的最小规则

`priority` 只用于同一范围内的人工排序：

```text
同一个 model_name
同一个 output
同一个 path_role
同一类 applicability_conditions
```

建议采用：

```text
数值越小，优先级越高。
```

例如：

```text
priority = 10   高优先级
priority = 50   普通优先级
priority = 90   低优先级
```

限制：

```text
priority 不得跨 model_name 比较。
priority 不得绕过 computability。
priority 不得绕过 applicability_conditions。
priority 不得绕过 formula_constraints。
priority 不得替代推荐模型规则。
```

复杂路径展示排序规则不在本节点确认，后续可在界面与交互阶段或交付数据格式阶段再定义。

---

### 十一、路径角色与递归推导关系

递归推导时：

| path_role     | 默认是否参与递归推导 | 说明                   |
| ------------- | ---------- | -------------------- |
| `primary`     | 是          | 条件满足时作为默认候选          |
| `alternative` | 是          | 可作为备选结果，但不覆盖 primary |
| `validation`  | 条件满足时可计算   | 用于校验，不默认作为 Active    |
| `reference`   | 否          | 默认只显示，不参与后续计算        |

如果用户手动选择某条 `alternative` 或 `validation` 路径作为 Active，后续依赖可以使用该结果。

v0.1 中，`reference` 不允许作为 Active，除非后续规则另行确认。

---

### 十二、模型分组与缺失条件

目标量反向查询时：

1. 系统先查找所有 `output = target` 的 registered 公式方向；
2. 按 `model_group` 和 `model_name` 分组；
3. 每个模型组内列出 primary / alternative / validation / reference 路径；
4. 分别显示每个模型缺失哪些条件；
5. 不同模型路径不得混在一起展示成普通等价方案。

如果某个模型不可用，应说明原因：

```text
缺少输入
假设被关闭
公式不适用
数学约束不满足
computability 不支持
```

不得只显示：

```text
Cannot calculate.
```

---

### 十三、模型分组与冲突判断

冲突判断必须区分同模型和不同模型。

#### 1. 同模型冲突

同一 `model_name`、同一 `output`、同一适用条件下，多个非参考路径结果不一致：

```text
进入 Conflict
暂停依赖分支
要求用户检查或选择
```

#### 2. 不同模型差异

不同 `model_name` 得到不同结果：

```text
标记为 Different model
不自动视为 Conflict
不自动互相验证
```

如果已有推荐模型：

```text
推荐模型作为 Active
其他模型作为 Alternative / Different model
```

如果没有推荐模型：

```text
等待用户选择
```

---

### 十四、v0.1 策略

v0.1 采用保守策略：

```text
先保证每个可执行公式都能明确归入 model_group 和 model_name。
先保证每个输出在同一模型内有清楚的 path_role。
暂不追求复杂跨模型自动选择。
```

v0.1 必须做到：

1. 每条公式有 `model_group`；
2. 每条公式有 `model_name`；
3. 每条公式有 `path_role`；
4. 每条公式有 `priority`；
5. 同模型多路径不混同为不同模型；
6. 不同模型结果不误判为同模型冲突；
7. 无推荐模型时不自动选择跨模型结果；
8. 推荐模型如需使用，必须后续节点明确确认。

v0.1 暂不要求：

```text
复杂 fallback 模型选择
动态模型评分
用户自定义模型偏好
模型精度等级自动判断
跨章节综合最优路径选择
复杂路径展示排序算法
```

---

### 十五、3.4 建议结论

采用以下模型分组与主路径规则：

```text
模型分组与主路径 =
model_group 大模块分组
+ model_name 具体物理模型
+ path_role 区分 primary / alternative / validation / reference
+ primary 只在同一模型内部有效
+ priority 只在同一模型局部范围内排序
+ 推荐模型用于跨模型默认选择
+ 同模型多路径可验证或冲突
+ 不同模型结果不自动视为冲突
+ 无推荐模型时不自动选择跨模型 Active
+ 常数和单位换算不进入 model_group
```

本规则用于支撑：

1. 多路径结果保留；
2. 不同物理模型区分；
3. 主路径展示；
4. 目标量反向查询；
5. 缺失条件分组；
6. 冲突判断；
7. 后续 v0.1 公式链选择；
8. 后续公式依赖关系图建立。

---

##


---


## 3.5 选定 v0.1 公式链

状态：已确认

---

### 一、节点目标

本节点用于选定车辆动力学公式求解器 v0.1 的第一条完整公式链。

本节点只处理：

```text
v0.1 选择哪个公式链作为第一条闭环
该公式链覆盖哪些物理模型
该公式链验证哪些产品规则
该公式链的边界是什么
哪些模块暂不进入 v0.1
```

本节点不处理：

```text
具体公式元数据逐条填写
具体 v0.1 公式清单编号
具体 v0.1 变量清单
完整公式依赖关系图
代码实现
```

以上内容分别留到：

```text
3.6 确认 v0.1 公式清单
3.7 确认 v0.1 变量清单
3.8 建立公式依赖关系图
```

---

### 二、v0.1 公式链选择原则

v0.1 公式链不追求覆盖多，而追求闭环完整。

选定的公式链必须满足：

1. 能形成多步递归推导；
2. 涉及真实单位换算；
3. 涉及来源原生单位或混合单位公式；
4. 涉及默认简化假设；
5. 涉及至少一个中间变量；
6. 能测试反向找条件；
7. 能测试缺失条件路径；
8. 能测试用户输入值与推导值比较；
9. 能测试异常值和单位误用建议；
10. 能测试同变量的不同模型展示；
11. 公式数量不能过多，避免 v0.1 范围失控；
12. 每条公式应能设计手算或参考测试案例。

---

### 三、候选公式链对比

#### 1. Axle Loads 链

优点：

```text
公式清晰
物理意义直观
适合教学展示
```

不足：

```text
链条较短
单位原生问题较少
不容易覆盖动力系统、轮胎几何和多模型加速度结果
```

结论：

```text
适合作为后续扩展模块，不作为 v0.1 首选链。
```

---

#### 2. Road Loads 链

优点：

```text
包含空气阻力、滚动阻力、道路载荷
涉及 mph 等来源原生单位问题
工程意义强
```

不足：

```text
滚动阻力存在经验公式、曲线和适用条件问题
可能过早引入 Road Loads 模块复杂性
部分公式需要更细的工程阈值和来源确认
```

结论：

```text
适合 v0.2 或后续模块；v0.1 不以 Road Loads 作为主链。
```

---

#### 3. Braking 链

优点：

```text
公式链较长
结果清晰
适合展示制动距离、制动力、制动压力等结果
```

不足：

```text
涉及液压、制动比例阀、盘鼓制动、分段公式
变量数量较多
v0.1 范围容易失控
```

结论：

```text
不作为 v0.1 第一条链。
```

---

#### 4. Ride / Cornering / Rollover 链

优点：

```text
长期价值高
车辆动力学代表性强
```

不足：

```text
变量多
模型条件复杂
推导和展示难度高
不适合第一条最小闭环
```

结论：

```text
暂不进入 v0.1。
```

---

#### 5. Acceleration Performance 链

优点：

```text
能形成清晰的多步递归链
涉及轮胎半径、传动系统、发动机功率、牵引力、加速度
天然涉及单位换算
天然涉及来源原生单位公式，例如 HP = T × RPM / 5252
可以使用默认假设 θ = 0、D_A = 0、R_x = 0、R_hx = 0
能产生多个中间变量
能测试用户输入值与推导值比较
能同时展示 engine-limited acceleration 和 ideal power acceleration 两种模型
公式数量可控
```

不足：

```text
需要严格处理 weight / mass / force 的单位关系
需要明确 HP、RPM、ft·lbf 等来源原生单位
需要明确不同加速度模型不是普通冲突
```

结论：

```text
最适合作为 v0.1 第一条完整公式链。
```

---

### 四、v0.1 选定公式链

v0.1 选定：

```text
Acceleration Performance Minimal Closed Loop
```

中文名称：

```text
纵向加速性能最小闭环公式链
```

该公式链覆盖三个 model_group：

```text
Tire and Wheel Geometry
Powertrain Kinematics
Acceleration Performance
```

该公式链的主目标输出为：

```text
a_x
```

即：

```text
longitudinal acceleration
```

---

### 五、v0.1 公式链结构

#### 1. 轮胎几何子链

目标：

```text
由轮胎尺寸计算车轮半径 r_w
```

基本关系：

```text
section_width
aspect_ratio
rim_diameter
        ↓
wheel_radius r_w
```

说明：

1. `195/55R16` 这种轮胎规格字符串解析属于输入预处理或 UI 层逻辑；
2. 解析结果应拆成标准变量：

   ```text
   section_width
   aspect_ratio
   rim_diameter
   ```
3. 轮胎半径计算本身作为 `Tire and Wheel Geometry` 下的普通几何公式；
4. 该公式天然涉及混合单位：

   ```text
   section_width 使用 mm
   rim_diameter 使用 in
   输出 wheel_radius 可先得到 in，再换算为内部 SI 长度单位
   ```
5. 这条子链用于验证 3.2 中确认的：

   ```text
   expression_unit_mode
   substitution_units
   native_output_unit
   ```

---

#### 2. 动力系统运动学子链

目标：

```text
由发动机转速、车轮半径和总传动比计算车辆速度 V
```

基本关系：

```text
engine_speed
wheel_radius r_w
combined_gear_ratio N_tf
        ↓
vehicle_speed V
```

说明：

1. v0.1 可以优先允许用户直接输入 `N_tf`；
2. 是否同时支持由 `N_t × N_f` 推导 `N_tf`，留到 3.6 公式清单确认；
3. 发动机转速输入通常为 RPM，内部可换算为 rad/s；
4. 该链用于验证动力系统变量和速度变量之间的递归推导。

---

#### 3. 发动机功率子链

目标：

```text
由发动机扭矩和发动机转速计算发动机功率
```

基本关系：

```text
engine_torque T_e
engine_speed RPM
        ↓
engine_power P
```

说明：

1. 课程公式中常见表达为：

   ```text
   HP = T × RPM / 5252
   ```
2. 该表达式是来源原生单位公式；
3. `5252` 只在扭矩使用 `ft·lbf`、转速使用 `RPM`、输出使用 `hp` 时成立；
4. v0.1 应把它作为 `source_native` 公式处理；
5. 引擎执行后应将结果换算回内部 SI 功率单位；
6. 这条子链用于验证来源原生单位公式不会被错误地直接代入 SI 数值。

---

#### 4. 牵引力子链

目标：

```text
由发动机扭矩、总传动比、传动效率和车轮半径计算牵引力 F_x
```

基本关系：

```text
engine_torque T_e
combined_gear_ratio N_tf
drivetrain_efficiency η_tf
wheel_radius r_w
        ↓
tractive_force F_x
```

说明：

1. `F_x` 是 engine-limited acceleration 的关键输入；
2. 该子链把轮胎几何结果继续用于动力学计算；
3. 可测试递归推导中的中间变量继续触发后续公式。

---

#### 5. 质量因子子链

目标：

```text
由总传动比计算 mass factor M_f
```

基本关系：

```text
combined_gear_ratio N_tf
        ↓
mass_factor M_f
```

说明：

1. `M_f` 是典型中间变量；
2. 它有独立工程含义；
3. 它参与 engine-limited acceleration；
4. 默认应作为 intermediate 展示。

---

#### 6. 车辆质量/重量转换子链

目标：

```text
由车辆重量 W 得到车辆质量 M
```

基本关系：

```text
vehicle_weight W
gravity g
        ↓
vehicle_mass M
```

说明：

1. 课程公式常使用 `W` 表示重量；
2. 内部 SI 计算中必须区分重量力 `W` 和质量 `M`；
3. v0.1 优先以 `vehicle_weight W` 作为课程公式输入；
4. `M = W / g` 作为必要中间关系；
5. `g` 是系统常数，不作为公式输出方向；
6. 该子链用于防止 weight / mass 混淆。

3.6 处理注记：

```text
M = W / g 不是常数，也不是单位换算，而是一条真实物理关系。
由于 v0.1 中唯一直接消费者是 Acceleration Performance，3.6 公式清单中暂归入 model_group = Acceleration Performance。
同时在 notes 中注明：该公式具有跨模块复用潜力；未来如 Axle Loads、Braking、Steady-State Cornering 等模块也复用该关系，再评估是否拆出独立基础关系分组。
```

---

#### 7. Engine-limited acceleration 主链

目标：

```text
计算 engine-limited longitudinal acceleration
```

基本关系：

```text
tractive_force F_x
aerodynamic_drag D_A
rolling_resistance R_x
road_grade_angle θ
hitch_force R_hx
mass_factor M_f
vehicle_mass M
vehicle_weight W
        ↓
longitudinal_acceleration a_x
```

对应公式关系：

```text
M_f M a_x = F_x − D_A − R_x − W sinθ − R_hx
```

说明：

1. 这是 v0.1 的主路径；
2. 该路径直接验证默认假设系统；
3. 公式中 `M_f × M` 和 `W sinθ` 是两个独立项，必须同时保留 `M` 和 `W`；
4. 当默认假设关闭且用户未提供真实值时，应进入缺失条件；
5. 该路径输出主要结果 `a_x`；
6. 该路径属于：

   ```text
   model_group = Acceleration Performance
   model_name = Engine-limited acceleration
   path_role = primary
   ```

v0.1 中允许使用已确认默认假设：

```text
θ = 0
D_A = 0
R_x = 0
R_hx = 0
```

---

#### 8. Ideal constant-power acceleration 对比链

目标：

```text
计算 ideal constant-power acceleration
```

基本关系：

```text
engine_power P
vehicle_speed V
vehicle_mass M
        ↓
longitudinal_acceleration a_x
```

说明：

1. 该链与 engine-limited acceleration 都可以输出 `a_x`；
2. 但二者属于不同物理模型；
3. 二者结果不同不应标记为普通 Conflict；
4. 应显示为 Different model；
5. v0.1 中该链用于测试不同模型结果展示；
6. 默认不把它当作同模型 validation；
7. 是否作为 Active，服从 3.4 推荐模型规则。

建议 v0.1 中：

```text
Engine-limited acceleration = recommended model for a_x
Ideal constant-power acceleration = different-model comparison / reference branch
```

最终 `path_role` 和推荐模型字段在 3.6 公式清单中确认。

3.6 处理注记：

```text
公式表原文形式为：

a_x = (1/M)F_x = 550(g/V)(HP/W)

v0.1 建议注册的计算形式为 SI 一致等价式：

a_x = P / (V · M)

该形式数学上等价于原始表达，因为 M = W / g。
3.6 注册该公式时，必须在 notes 中写明：
“本公式为 a_x = 550gHP/(VW) 的 SI 等价简化形式，原始来源表达式见公式表 Ch2。”
不得静默替换原始来源表达式。
```

---

### 六、v0.1 主链推荐路径

v0.1 推荐主路径如下：

```text
Tire size variables
        ↓
wheel_radius r_w
        ↓
tractive_force F_x
        ↓
engine-limited acceleration a_x
```

扩展递归路径如下：

```text
engine_speed + wheel_radius + N_tf
        ↓
vehicle_speed V
        ↓
ideal constant-power acceleration a_x
```

并行功率路径如下：

```text
engine_torque + engine_speed
        ↓
engine_power P
        ↓
ideal constant-power acceleration a_x
```

质量因子路径如下：

```text
N_tf
        ↓
mass_factor M_f
        ↓
engine-limited acceleration a_x
```

重量质量路径如下：

```text
vehicle_weight W + g
        ↓
vehicle_mass M
        ↓
engine-limited acceleration a_x
ideal constant-power acceleration a_x
```

---

### 七、v0.1 可验证的产品规则

选定该链后，v0.1 可以验证以下能力：

| 产品规则        | 如何验证                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------- |
| 任意变量输入      | 用户可输入轮胎、扭矩、转速、传动比、效率、重量等任意组合                                                                 |
| 混合单位输入      | 扭矩可用 ft·lbf 或 N·m，轮胎尺寸可混合 mm / in，速度可显示 mph 或 m/s                                            |
| 来源原生单位公式    | `HP = T × RPM / 5252` 和轮胎半径公式可测试 `source_native`                                             |
| 递归推导        | r_w → F_x / V → a_x                                                                          |
| 默认假设        | θ、D_A、R_x、R_hx 可默认补齐                                                                         |
| 缺失条件        | 关闭假设或缺少扭矩、传动比、半径、重量时显示缺失项                                                                    |
| 反向找条件       | 用户选择 a_x 时，系统列出 engine-limited 和 ideal-power 两条路径缺什么                                         |
| 中间结果展示      | r_w、F_x、V、P、M_f、M 均可作为中间或推导结果                                                                |
| 用户输入 vs 推导值 | 用户手动输入 r_w 或 P，同时系统推导 r_w 或 P，用于比较差异                                                         |
| 单位误用建议      | 例如 wheel radius = 13.8 ft 时提示可能是 13.8 in                                                     |
| 无效输入阻断分支    | 例如 η_tf > 1、r_w ≤ 0、N_tf ≤ 0 只阻断相关路径                                                         |
| 不同模型展示      | engine-limited acceleration 与 ideal constant-power acceleration 同时输出 a_x，但标记 Different model |

---

### 八、v0.1 暂不纳入的内容

以下内容不进入 v0.1 第一条公式链：

```text
完整 Axle Loads 模块
完整 Road Loads 模块
完整 Braking 模块
完整 Ride 模块
完整 Steady-State Cornering 模块
完整 Suspension 模块
完整 Rollover 模块
滚动阻力经验模型
空气阻力实际计算
制动液压系统
轮胎附着极限
坡度最大爬坡能力
查图 / 曲线类公式
复杂多挡位换挡逻辑
```

说明：

1. `D_A` 在 v0.1 主链中默认使用假设值 0；
2. `R_x` 在 v0.1 主链中默认使用假设值 0；
3. `θ` 在 v0.1 主链中默认使用假设值 0；
4. 后续 Road Loads 模块可再补充空气阻力、滚动阻力和道路载荷；
5. 后续 Traction Limits 模块可再补充最大牵引力和附着限制。

---

### 九、v0.1 输入策略

v0.1 不要求用户必须按固定表单输入，但为了验证主链，推荐测试输入组合为：

```text
section_width
aspect_ratio
rim_diameter
engine_torque
engine_speed
combined_gear_ratio N_tf
drivetrain_efficiency
vehicle_weight
```

其中：

```text
road_grade_angle θ
aerodynamic_drag D_A
rolling_resistance R_x
hitch_force R_hx
```

默认由简化假设提供。

如果用户关闭这些假设，则相关路径应显示缺失条件。

---

### 十、v0.1 输出策略

v0.1 主要输出：

```text
longitudinal_acceleration a_x
```

v0.1 重要推导结果：

```text
wheel_radius r_w
tractive_force F_x
vehicle_speed V
engine_power P
mass_factor M_f
vehicle_mass M
```

其中：

```text
a_x = primary_output
F_x / V / P = derived_output 或 intermediate
r_w / M_f / M = intermediate
```

具体 `display_role` 在 3.7 变量清单中确认。

---

### 十一、v0.1 不解决的问题

v0.1 不解决：

```text
车辆是否因附着不足而打滑
最大可用牵引力
空气阻力随速度变化
滚动阻力随速度变化
坡度阻力的完整工况
发动机扭矩曲线
多挡变速箱换挡策略
不同轮胎模型
真实 0-60 mph 时间积分
```

原因：

这些会显著增加模型复杂度，不属于第一条最小闭环。

v0.1 的目标不是完整预测整车加速性能，而是验证：

```text
公式链是否能可靠运行
单位系统是否正确
递归推导是否有效
缺失条件是否清楚
默认假设是否可控
多模型结果是否能正确展示
```

---

### 十二、交给 3.6 处理的注记

#### 1. `M = W/g` 的模型分组

```text
M = W / g 暂归入 model_group = Acceleration Performance。
```

原因：

```text
v0.1 中唯一直接消费者是 Acceleration Performance 的加速度公式。
```

但 3.6 注册公式时必须在 `notes` 中注明：

```text
该公式具有跨模块复用潜力；未来如 Axle Loads、Braking、Steady-State Cornering 等模块也复用该关系，再评估是否拆出独立基础关系分组。
```

#### 2. Ideal constant-power acceleration 的表达式来源

3.6 注册 `a_x = P/(V·M)` 时，必须在 `notes` 中注明：

```text
本公式为 a_x = 550gHP/(VW) 的 SI 等价简化形式，原始来源表达式见公式表 Ch2。
```

原因：

```text
公式表原文使用 HP、W、V、g 的来源表达式。
v0.1 为避免重复引入 550 和 source_native 处理，采用 SI 一致等价形式。
该差异必须显式记录，不能静默替换。
```

---

### 十三、3.5 最终结论

v0.1 选定：

```text
Acceleration Performance Minimal Closed Loop
```

即：

```text
纵向加速性能最小闭环公式链
```

核心主链：

```text
tire size variables
→ wheel_radius
→ tractive_force
→ engine-limited acceleration
```

并行辅助链：

```text
engine_torque + engine_speed
→ engine_power

engine_speed + wheel_radius + combined_gear_ratio
→ vehicle_speed

engine_power + vehicle_speed + vehicle_mass
→ ideal constant-power acceleration
```

v0.1 的主模型建议为：

```text
Engine-limited acceleration
```

v0.1 的不同模型展示分支建议为：

```text
Ideal constant-power acceleration
```

该选择能够覆盖 Part 2 已确认的大部分 v0.1 验收规则，同时公式数量可控，适合作为第一条可实现、可测试、可展示的最小闭环。

---

### 十四、节点状态

```text
3.5 ✅ 已完成
```


---


## 3.6 确认 v0.1 公式清单

状态：已确认

---

### 一、节点目标

本节点用于确认 v0.1 纵向加速性能最小闭环中，具体纳入哪些公式记录。

本节点只处理：

```text
v0.1 公式清单
每条公式的公式 ID
每条公式的输入变量
每条公式的输出变量
每条公式的模型归属
每条公式的路径角色
每条公式的单位模式
每条公式的假设与适用边界
每条公式需要保留的 notes
v0.1 推荐模型登记
```

本节点不处理：

```text
变量完整元数据
变量 normal_range / warning_range / invalid_range
公式依赖关系图
测试用例数值
代码实现
界面布局
```

以上内容分别留到：

```text
3.7 确认 v0.1 变量清单
3.8 建立公式依赖关系图
3.9 建立疑义与冲突清单
3.10 确认交付给开发的数据格式
```

---

### 二、v0.1 公式清单总览

v0.1 纳入 8 条公式记录：

|   序号 | formula_id                               | 输出变量                        | 所属模型                              |
| ---: | ---------------------------------------- | --------------------------- | --------------------------------- |
| F001 | `F001_wheel_radius_from_tire_size`       | `wheel_radius`              | Tire size radius model            |
| F002 | `F002_vehicle_speed_from_engine_speed`   | `vehicle_speed`             | Powertrain speed relation         |
| F003 | `F003_engine_power_from_torque_rpm`      | `engine_power`              | Engine power calculation          |
| F004 | `F004_tractive_force_from_engine_torque` | `tractive_force`            | Engine tractive force at wheels   |
| F005 | `F005_mass_factor_from_total_gear_ratio` | `mass_factor`               | Mass factor approximation         |
| F006 | `F006_vehicle_mass_from_weight`          | `vehicle_mass`              | Weight-to-mass relation           |
| F007 | `F007_engine_limited_acceleration`       | `longitudinal_acceleration` | Engine-limited acceleration       |
| F008 | `F008_ideal_power_acceleration_si`       | `longitudinal_acceleration` | Ideal constant-power acceleration |

v0.1 暂不纳入：

```text
total_gear_ratio = transmission_gear_ratio × final_drive_ratio
```

原因：

1. v0.1 优先要求用户直接输入 `combined_gear_ratio` / `N_tf`；
2. 传动比拆分会引入额外变量；
3. 该关系简单但不是验证 v0.1 闭环的必要条件；
4. 后续可作为 Powertrain Kinematics 扩展公式加入。

---

### 三、公式记录

---

### F001：轮胎半径公式

#### 1. 基本信息

```text
formula_id: F001_wheel_radius_from_tire_size
name: Wheel radius from tire size
formula_family_id: tire_size_radius
status: confirmed
```

#### 2. 公式表达

```text
r_w = (section_width × aspect_ratio) / 25.4 + rim_diameter / 2
```

#### 3. 输入与输出

```text
required_inputs:
  - section_width
  - aspect_ratio
  - rim_diameter

output: wheel_radius
```

#### 4. 模型归属

```text
model_group: Tire and Wheel Geometry
model_name: Tire size radius model
model_type: geometry_model
path_role: primary
priority: 10
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: source_native
```

```text
substitution_units:
  section_width: mm
  aspect_ratio: decimal
  rim_diameter: in

native_output_unit: in
```

说明：

```text
aspect_ratio 使用小数形式，例如 55% 进入公式前应转换为 0.55。
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - tire size gives nominal unloaded tire radius
  - tire deflection under load is ignored

allowed_assumption_inputs:
  - none

applicability_conditions:
  - tire size variables are available
  - tire is represented by section width, aspect ratio, and rim diameter

formula_constraints:
  - section_width > 0
  - aspect_ratio > 0
  - rim_diameter > 0
```

#### 7. 备注

```text
195/55R16 字符串解析属于 UI 输入预处理，不属于公式引擎。
公式引擎接收拆分后的 section_width、aspect_ratio、rim_diameter。
本公式用于验证 source_native 和混合单位代入。
```

---

### F002：车辆速度公式

#### 1. 基本信息

```text
formula_id: F002_vehicle_speed_from_engine_speed
name: Vehicle speed from engine speed, wheel radius, and total gear ratio
formula_family_id: powertrain_speed_relation
status: confirmed
```

#### 2. 公式表达

```text
V = r_w × ω_e / N_tf
```

#### 3. 输入与输出

```text
required_inputs:
  - wheel_radius
  - engine_speed
  - combined_gear_ratio

output: vehicle_speed
```

#### 4. 模型归属

```text
model_group: Powertrain Kinematics
model_name: Powertrain speed relation
model_type: kinematic_relation
path_role: primary
priority: 10
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: si_consistent
```

```text
substitution_units: not required
native_output_unit: not required
```

说明：

```text
engine_speed 内部计算使用 angular speed。
用户可以用 rpm 输入，但单位系统应换算为内部角速度单位。
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - no clutch slip
  - no torque converter slip
  - no tire slip
  - combined_gear_ratio represents total engine-to-wheel speed ratio

allowed_assumption_inputs:
  - none

applicability_conditions:
  - combined gear ratio is valid for the selected gear
  - wheel radius is available
  - engine speed is available

formula_constraints:
  - wheel_radius > 0
  - engine_speed >= 0
  - combined_gear_ratio > 0
```

#### 7. 备注

```text
v0.1 暂不登记由 transmission_gear_ratio × final_drive_ratio 推导 combined_gear_ratio 的公式。
用户直接输入 combined_gear_ratio。
```

---

### F003：发动机功率公式

#### 1. 基本信息

```text
formula_id: F003_engine_power_from_torque_rpm
name: Engine power from torque and engine speed
formula_family_id: engine_power
status: confirmed
```

#### 2. 公式表达

```text
HP = T_e × RPM / 5252
```

#### 3. 输入与输出

```text
required_inputs:
  - engine_torque
  - engine_speed

output: engine_power
```

#### 4. 模型归属

```text
model_group: Acceleration Performance
model_name: Engine power calculation
model_type: definition
path_role: primary
priority: 10
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: source_native
```

```text
substitution_units:
  engine_torque: ft_lbf
  engine_speed: rpm

native_output_unit: hp
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - torque and engine speed refer to the same operating point

allowed_assumption_inputs:
  - none

applicability_conditions:
  - engine torque is available
  - engine speed is available

formula_constraints:
  - engine_torque >= 0
  - engine_speed >= 0
```

#### 7. 备注

```text
5252 常数只适用于 torque = ft·lbf、speed = RPM、power = hp。
不得把内部 SI 的 N·m 和 rad/s 直接代入该表达式。
本公式用于验证 source_native 公式的代入单位声明。
```

---

### F004：牵引力公式

#### 1. 基本信息

```text
formula_id: F004_tractive_force_from_engine_torque
name: Tractive force from engine torque
formula_family_id: tractive_force
status: confirmed
```

#### 2. 公式表达

```text
F_x = T_e × N_tf × η_tf / r_w
```

#### 3. 输入与输出

```text
required_inputs:
  - engine_torque
  - combined_gear_ratio
  - drivetrain_efficiency
  - wheel_radius

output: tractive_force
```

#### 4. 模型归属

```text
model_group: Acceleration Performance
model_name: Engine tractive force at wheels
model_type: definition
path_role: primary
priority: 10
```

说明：

```text
F004 是发动机扭矩到轮端牵引力的关系式，不是多力项平衡方程。
因此 model_type 不使用 force_balance。
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: si_consistent
```

```text
substitution_units: not required
native_output_unit: not required
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - drivetrain efficiency is represented by η_tf
  - wheel radius is the effective radius used for force calculation
  - tire slip and traction limit are not checked in v0.1

allowed_assumption_inputs:
  - none

applicability_conditions:
  - engine torque is available
  - combined gear ratio is available
  - drivetrain efficiency is available
  - wheel radius is available

formula_constraints:
  - engine_torque >= 0
  - combined_gear_ratio > 0
  - 0 < drivetrain_efficiency <= 1
  - wheel_radius > 0
```

#### 7. 备注

```text
本公式计算发动机/传动系统可提供的轮端牵引力。
v0.1 不检查轮胎附着极限，因此该结果不是最大可实现牵引力。
```

---

### F005：质量因子公式

#### 1. 基本信息

```text
formula_id: F005_mass_factor_from_total_gear_ratio
name: Mass factor from total gear ratio
formula_family_id: mass_factor
status: confirmed
```

#### 2. 公式表达

```text
M_f = 1 + 0.04 N_tf + 0.0025 N_tf²
```

#### 3. 输入与输出

```text
required_inputs:
  - combined_gear_ratio

output: mass_factor
```

#### 4. 模型归属

```text
model_group: Acceleration Performance
model_name: Mass factor approximation
model_type: empirical_model
path_role: primary
priority: 10
```

#### 5. 公式类型与单位模式

```text
formula_type: empirical
computability: direct
expression_unit_mode: si_consistent
```

```text
substitution_units: not required
native_output_unit: not required
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - mass factor is represented by a typical empirical relation
  - rotating inertia is approximated through total gear ratio

allowed_assumption_inputs:
  - none

applicability_conditions:
  - combined gear ratio is available
  - empirical mass factor approximation is acceptable for v0.1

formula_constraints:
  - combined_gear_ratio > 0
```

#### 7. 备注

```text
该公式是代表性经验近似，不是车辆专属旋转惯量模型。
v0.1 用它作为中间变量，验证 empirical formula 和 intermediate result。
```

---

### F006：重量到质量公式

#### 1. 基本信息

```text
formula_id: F006_vehicle_mass_from_weight
name: Vehicle mass from vehicle weight
formula_family_id: vehicle_mass_from_weight
status: confirmed
```

#### 2. 公式表达

```text
M = W / g
```

#### 3. 输入与输出

```text
required_inputs:
  - vehicle_weight
  - gravity

output: vehicle_mass
```

说明：

```text
gravity 是系统常数，由变量元数据提供，不需要用户输入。
```

#### 4. 模型归属

```text
model_group: Acceleration Performance
model_name: Weight-to-mass relation
model_type: definition
path_role: primary
priority: 10
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: si_consistent
```

```text
substitution_units: not required
native_output_unit: not required
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - vehicle weight W is a force
  - vehicle mass M is derived from W/g

allowed_assumption_inputs:
  - none

applicability_conditions:
  - vehicle weight is available
  - gravity constant is available

formula_constraints:
  - vehicle_weight > 0
  - gravity > 0
```

#### 7. 备注

```text
M = W/g 不是常数，也不是单位换算，而是一条真实物理关系。
由于 v0.1 中唯一直接消费者是 Acceleration Performance 的加速度公式，暂归入 model_group = Acceleration Performance。
该公式具有跨模块复用潜力；未来如 Axle Loads、Braking、Steady-State Cornering 等模块也复用该关系，再评估是否拆出独立基础关系分组。
```

---

### F007：Engine-limited acceleration 公式

#### 1. 基本信息

```text
formula_id: F007_engine_limited_acceleration
name: Engine-limited longitudinal acceleration
formula_family_id: engine_limited_acceleration
status: confirmed
```

#### 2. 公式表达

原始关系：

```text
M_f M a_x = F_x − D_A − R_x − W sinθ − R_hx
```

v0.1 登记计算方向：

```text
a_x = (F_x − D_A − R_x − W sinθ − R_hx) / (M_f M)
```

#### 3. 输入与输出

```text
required_inputs:
  - tractive_force
  - aerodynamic_drag
  - rolling_resistance
  - vehicle_weight
  - road_grade_angle
  - hitch_force
  - mass_factor
  - vehicle_mass

output: longitudinal_acceleration
```

#### 4. 模型归属

```text
model_group: Acceleration Performance
model_name: Engine-limited acceleration
model_type: force_balance
path_role: primary
priority: 10
```

说明：

```text
是否推荐该模型作为 longitudinal_acceleration 的 Active 模型，不写在 F007 公式记录中。
推荐模型属于 output + model 级别的信息，见本节点第四节“v0.1 推荐模型登记表”。
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: si_consistent
```

```text
substitution_units: not required
native_output_unit: not required
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - engine tractive force is available at the selected operating point
  - mass factor accounts for rotating inertia approximately
  - v0.1 does not check traction limit
  - v0.1 does not compute speed-dependent road loads unless provided or assumed

allowed_assumption_inputs:
  - aerodynamic_drag
  - rolling_resistance
  - road_grade_angle
  - hitch_force

applicability_conditions:
  - vehicle is evaluated at a given operating point
  - tractive force is available
  - vehicle mass is available
  - mass factor is available
  - road load terms are provided or explicitly assumed

formula_constraints:
  - vehicle_mass > 0
  - mass_factor > 0
```

说明：

```text
公式只声明 allowed_assumption_inputs。
具体默认假设值，例如 D_A = 0、R_x = 0、θ = 0、R_hx = 0，由对应变量元数据中的 default_assumption 定义。
公式记录不重复保存默认假设数值。
```

#### 7. 备注

```text
公式中 M_f × M 与 W sinθ 是两个独立项。
不得因为 M = W/g 而删除 W sinθ。
当 θ = 0 时，W sinθ 项为 0，但该项仍属于公式结构。
如果默认假设关闭，而 D_A、R_x、θ、R_hx 缺失，则该路径不可计算，并进入缺失条件展示。
```

---

### F008：Ideal constant-power acceleration 公式

#### 1. 基本信息

```text
formula_id: F008_ideal_power_acceleration_si
name: Ideal constant-power longitudinal acceleration
formula_family_id: ideal_power_acceleration
status: confirmed
```

#### 2. 公式表达

公式表原始表达：

```text
a_x = (1/M)F_x = 550(g/V)(HP/W)
```

v0.1 登记计算方向：

```text
a_x = P / (V M)
```

#### 3. 输入与输出

```text
required_inputs:
  - engine_power
  - vehicle_speed
  - vehicle_mass

output: longitudinal_acceleration
```

#### 4. 模型归属

```text
model_group: Acceleration Performance
model_name: Ideal constant-power acceleration
model_type: idealized_model
path_role: primary
priority: 10
```

说明：

```text
本模型可与 Engine-limited acceleration 共同输出 longitudinal_acceleration。
二者属于不同物理模型，不应作为同模型 Conflict 处理。
不同模型对比关系由模型分组与推荐模型登记表解释，不写成单条公式字段。
```

#### 5. 公式类型与单位模式

```text
formula_type: algebraic
computability: direct
expression_unit_mode: si_consistent
```

```text
substitution_units: not required
native_output_unit: not required
```

#### 6. 假设与适用条件

```text
model_assumptions:
  - engine power is treated as available constant power at the evaluated speed
  - power loss and traction limit are not checked in this model
  - this is an idealized comparison model

allowed_assumption_inputs:
  - none

applicability_conditions:
  - engine power is available
  - vehicle speed is available
  - vehicle mass is available
  - constant-power approximation is acceptable for comparison

formula_constraints:
  - engine_power >= 0
  - vehicle_speed > 0
  - vehicle_mass > 0
```

#### 7. 备注

```text
本公式为 a_x = 550gHP/(VW) 的 SI 等价简化形式，原始来源表达式见公式表 Ch2。
采用 a_x = P/(V·M) 是为了避免在 v0.1 中重复引入 550、HP、W、V 的 source_native 表达式。
该差异必须显式记录，不能静默替换原始来源表达式。

本模型与 Engine-limited acceleration 都输出 longitudinal_acceleration，但二者属于不同物理模型。
二者结果不同不应标记为普通 Conflict，应标记为 Different model。
v0.1 默认推荐 Engine-limited acceleration 作为 longitudinal_acceleration 的 Active 模型，具体推荐关系见本节点第四节“v0.1 推荐模型登记表”。
```

---

### 四、v0.1 推荐模型登记表

推荐模型信息不挂在单条 `formula_id` 上。

原因：

```text
primary 是公式路径级别。
推荐模型是物理模型级别。
```

因此，v0.1 单独设置推荐模型登记表。

#### 推荐模型记录 R001

```text
recommendation_id: R001_longitudinal_acceleration_recommended_model

output: longitudinal_acceleration

model_group: Acceleration Performance

recommended_model_name: Engine-limited acceleration

applicability_conditions:
  - F007_engine_limited_acceleration 的 applicability_conditions 满足
  - F007_engine_limited_acceleration 的 formula_constraints 满足
  - F007_engine_limited_acceleration 的 computability 满足当前引擎能力

recommendation_reason:
  - 该模型直接使用发动机轮端牵引力、质量因子和路载项
  - 该模型对应 v0.1 选定的主链
  - 该模型能测试默认假设、缺失条件和递归推导
  - Ideal constant-power acceleration 更适合作为不同模型对比结果

fallback_behavior:
  - 如果 Engine-limited acceleration 可计算，则其结果默认作为 Active
  - 如果 Engine-limited acceleration 不可计算，不自动切换到 Ideal constant-power acceleration
  - 系统应提示推荐模型不可用，并显示其他可选模型
  - 只有用户明确选择时，才可使用 Ideal constant-power acceleration 作为 Active
```

说明：

```text
F007 仍然是 path_role = primary。
F008 在自身模型内部也可以是 path_role = primary。
但跨模型 Active 选择由本推荐模型登记表决定。
```

---

### 五、公式清单中暂不纳入的候选公式

#### 1. 总传动比拆分公式

```text
N_tf = N_t × N_f
```

处理结论：

```text
v0.1 暂不纳入。
```

原因：

```text
v0.1 直接使用 combined_gear_ratio / N_tf。
该公式会增加 transmission_gear_ratio 和 final_drive_ratio 两个变量。
不影响 v0.1 最小闭环验证。
```

后续处理：

```text
可在 Powertrain Kinematics 扩展时加入。
```

---

#### 2. SI 功率定义公式

```text
P = T_e × ω_e
```

处理结论：

```text
v0.1 暂不单独登记。
```

原因：

```text
v0.1 使用 HP = T × RPM / 5252 作为 engine_power 公式，以验证 source_native 单位机制。
如果同时登记 P = T_e × ω_e，会引入同模型多路径验证，但不是 v0.1 必需能力。
```

后续处理：

```text
可在后续版本作为同模型 validation 路径加入，用于验证功率计算一致性。
```

---

#### 3. Road Loads 相关公式

```text
D_A
R_x
rolling resistance empirical formulas
aerodynamic drag formulas
```

处理结论：

```text
v0.1 暂不纳入。
```

原因：

```text
v0.1 中 D_A 和 R_x 默认允许使用 0 假设。
完整 Road Loads 模块会显著扩大公式范围。
```

---

#### 4. Traction limits 公式

```text
F_xmax
```

处理结论：

```text
v0.1 暂不纳入。
```

原因：

```text
v0.1 不判断轮胎附着极限。
tractive_force 表示动力系统可提供的牵引力，不代表轮胎地面可实现上限。
```

---

### 六、v0.1 公式清单最终结论

v0.1 确认纳入以下 8 条公式：

```text
F001_wheel_radius_from_tire_size
F002_vehicle_speed_from_engine_speed
F003_engine_power_from_torque_rpm
F004_tractive_force_from_engine_torque
F005_mass_factor_from_total_gear_ratio
F006_vehicle_mass_from_weight
F007_engine_limited_acceleration
F008_ideal_power_acceleration_si
```

这些公式共同支撑：

```text
轮胎尺寸 → 车轮半径
发动机转速 + 半径 + 总传动比 → 车速
发动机扭矩 + 转速 → 功率
发动机扭矩 + 总传动比 + 效率 + 半径 → 牵引力
总传动比 → 质量因子
车辆重量 → 车辆质量
牵引力 + 质量因子 + 质量 + 路载项假设 → engine-limited acceleration
功率 + 车速 + 质量 → ideal constant-power acceleration
```

v0.1 的主输出为：

```text
longitudinal_acceleration
```

v0.1 的推荐模型为：

```text
Engine-limited acceleration
```

v0.1 的不同模型对比为：

```text
Ideal constant-power acceleration
```

推荐模型关系由：

```text
R001_longitudinal_acceleration_recommended_model
```

统一登记。

---

### 七、节点状态

```text
3.6 ✅ 已完成
```


---


## 3.7 确认 v0.1 变量清单

状态：已确认

---

### 一、节点目标

本节点用于确认 v0.1 纵向加速性能最小闭环所需的变量清单，并为每个变量落实 3.1 已确认的 v0.1 最低变量元数据。

本节点只处理：

```text
v0.1 需要哪些变量
每个变量的 variable_id
每个变量的 name / symbol / category / description
每个变量的 dimension
每个变量的 internal_unit / default_unit / allowed_units
每个变量的 display_role / importance
每个变量是否可由用户输入
每个变量是否可作为默认假设
每个变量是否为系统常数
每个变量的 valid_domain
每个变量的初始合理性范围
每个变量的 status
```

本节点不处理：

```text
公式依赖关系图
运行时结果对象
具体测试用例数值
代码实现
完整 UI 布局
复杂单位误用算法
元数据最终 JSON / YAML 格式
```

以上内容分别留到：

```text
3.8 建立公式依赖关系图
3.9 建立疑义与冲突清单
3.10 确认交付给开发的数据格式
后续第 5 支 单位与工程安全
后续第 6 支 界面与交互
```

---

### 二、ID、分类和重要性规则

#### 1. 正式变量 ID

正式 `variable_id` 使用纯 snake_case 名称，例如：

```text
section_width
engine_speed
longitudinal_acceleration
```

本文件中的：

```text
V001
V002
...
V020
```

只作为文档序号使用，不是正式 `variable_id` 的组成部分。

因此，公式记录继续引用：

```text
section_width
wheel_radius
engine_power
```

而不是：

```text
V001_section_width
V004_wheel_radius
V009_engine_power
```

---

#### 2. category 的含义

`category` 用于：

```text
变量选择界面的分类浏览
搜索结果分组
变量列表整理
```

`category` 不等于公式元数据中的 `model_group`。

v0.1 使用以下变量分类：

```text
tire_wheel
powertrain
vehicle_properties
road_loads_external_forces
motion_performance
constants
```

---

#### 3. importance 的含义

`importance` 用于：

```text
变量和结果展示排序
缺失条件推荐排序
搜索结果中的优先展示
```

`importance` 不参与计算，不等于公式元数据中的 `priority`。

v0.1 使用以下等级：

```text
critical
high
medium
low
```

排序顺序：

```text
critical > high > medium > low
```

---

#### 4. status

v0.1 本节点纳入的 20 个变量统一设置为：

```text
status: confirmed
```

如果后续 3.9 发现定义、符号或范围存在未解决冲突，再将相关变量状态调整为：

```text
needs_review
```

---

#### 5. 无量纲单位命名

v0.1 对无量纲小数统一使用：

```text
decimal
```

不再同时使用：

```text
decimal
ratio
```

例如：

```text
aspect_ratio internal_unit = decimal
combined_gear_ratio internal_unit = decimal
drivetrain_efficiency internal_unit = decimal
mass_factor internal_unit = decimal
```

---

#### 6. 单一 symbol 规则

每个变量的 `symbol` 只保存一个正式物理符号。

因此：

```text
engine_speed symbol = ω_e
engine_power symbol = P
```

以下内容是单位，不是 symbol：

```text
RPM
HP
```

来源公式中仍可显示 RPM 和 HP，但变量元数据不得把单位混入 `symbol`。

---

### 三、v0.1 变量总览

v0.1 共纳入 20 个变量。

按 `category` 分类：

| category                     |     数量 |
| ---------------------------- | -----: |
| `tire_wheel`                 |      4 |
| `powertrain`                 |      7 |
| `vehicle_properties`         |      2 |
| `road_loads_external_forces` |      4 |
| `motion_performance`         |      2 |
| `constants`                  |      1 |
| **合计**                       | **20** |

分类对应关系：

```text
tire_wheel:
  section_width
  aspect_ratio
  rim_diameter
  wheel_radius

powertrain:
  engine_speed
  combined_gear_ratio
  engine_torque
  engine_power
  drivetrain_efficiency
  tractive_force
  mass_factor

vehicle_properties:
  vehicle_weight
  vehicle_mass

road_loads_external_forces:
  aerodynamic_drag
  rolling_resistance
  road_grade_angle
  hitch_force

motion_performance:
  vehicle_speed
  longitudinal_acceleration

constants:
  gravity
```

---

### 四、身份与组织元数据

|   序号 | variable_id                 | symbol  | name                      | category                     | importance | status    |
| ---: | --------------------------- | ------- | ------------------------- | ---------------------------- | ---------- | --------- |
| V001 | `section_width`             | `w_s`   | Section width             | `tire_wheel`                 | medium     | confirmed |
| V002 | `aspect_ratio`              | `AR`    | Aspect ratio              | `tire_wheel`                 | medium     | confirmed |
| V003 | `rim_diameter`              | `d_rim` | Rim diameter              | `tire_wheel`                 | medium     | confirmed |
| V004 | `wheel_radius`              | `r_w`   | Wheel radius              | `tire_wheel`                 | high       | confirmed |
| V005 | `engine_speed`              | `ω_e`   | Engine speed              | `powertrain`                 | high       | confirmed |
| V006 | `combined_gear_ratio`       | `N_tf`  | Combined gear ratio       | `powertrain`                 | high       | confirmed |
| V007 | `vehicle_speed`             | `V`     | Vehicle speed             | `motion_performance`         | high       | confirmed |
| V008 | `engine_torque`             | `T_e`   | Engine torque             | `powertrain`                 | high       | confirmed |
| V009 | `engine_power`              | `P`     | Engine power              | `powertrain`                 | high       | confirmed |
| V010 | `drivetrain_efficiency`     | `η_tf`  | Drivetrain efficiency     | `powertrain`                 | high       | confirmed |
| V011 | `tractive_force`            | `F_x`   | Tractive force            | `powertrain`                 | high       | confirmed |
| V012 | `mass_factor`               | `M_f`   | Mass factor               | `powertrain`                 | medium     | confirmed |
| V013 | `vehicle_weight`            | `W`     | Vehicle weight            | `vehicle_properties`         | high       | confirmed |
| V014 | `gravity`                   | `g`     | Gravity                   | `constants`                  | low        | confirmed |
| V015 | `vehicle_mass`              | `M`     | Vehicle mass              | `vehicle_properties`         | high       | confirmed |
| V016 | `aerodynamic_drag`          | `D_A`   | Aerodynamic drag          | `road_loads_external_forces` | medium     | confirmed |
| V017 | `rolling_resistance`        | `R_x`   | Rolling resistance        | `road_loads_external_forces` | medium     | confirmed |
| V018 | `road_grade_angle`          | `θ`     | Road grade angle          | `road_loads_external_forces` | medium     | confirmed |
| V019 | `hitch_force`               | `R_hx`  | Hitch force               | `road_loads_external_forces` | medium     | confirmed |
| V020 | `longitudinal_acceleration` | `a_x`   | Longitudinal acceleration | `motion_performance`         | critical   | confirmed |

---

### 五、正式 description

| variable_id                 | description                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `section_width`             | Nominal tire section width used in the tire-size-based wheel-radius calculation.                                 |
| `aspect_ratio`              | Tire sidewall height expressed as a fraction of nominal section width.                                           |
| `rim_diameter`              | Nominal wheel rim diameter used in the tire-size designation.                                                    |
| `wheel_radius`              | Nominal unloaded wheel and tire radius used in the v0.1 kinematic and tractive-force formulas.                   |
| `engine_speed`              | Engine crankshaft angular speed at the evaluated operating point.                                                |
| `combined_gear_ratio`       | Numerical ratio of engine speed to wheel speed, combining the selected transmission ratio and final-drive ratio. |
| `vehicle_speed`             | Longitudinal vehicle speed at the evaluated operating point.                                                     |
| `engine_torque`             | Engine output torque at the same operating point as the associated engine speed.                                 |
| `engine_power`              | Engine mechanical power at the evaluated torque and speed operating point.                                       |
| `drivetrain_efficiency`     | Combined drivetrain efficiency applied to torque transfer from the engine to the driven wheels.                  |
| `tractive_force`            | Longitudinal wheel-ground force available from the engine and drivetrain before any tire-traction-limit check.   |
| `mass_factor`               | Empirical multiplier used to approximate the effect of rotating drivetrain inertia on longitudinal acceleration. |
| `vehicle_weight`            | Gravitational force acting on the vehicle, distinct from vehicle mass.                                           |
| `gravity`                   | Gravitational acceleration constant used to convert vehicle weight to vehicle mass.                              |
| `vehicle_mass`              | Vehicle inertial mass used in the longitudinal acceleration equations.                                           |
| `aerodynamic_drag`          | Longitudinal aerodynamic resistance force opposing forward vehicle motion.                                       |
| `rolling_resistance`        | Longitudinal rolling-resistance force opposing vehicle motion.                                                   |
| `road_grade_angle`          | Road inclination angle, defined as positive for an uphill grade.                                                 |
| `hitch_force`               | External longitudinal hitch or towing force, defined as positive when resisting forward motion.                  |
| `longitudinal_acceleration` | Vehicle longitudinal acceleration, defined as positive for acceleration and negative for deceleration.           |

---

### 六、单位、维度和显示元数据

| variable_id                 | dimension     | internal_unit | default_unit | allowed_units    | display_role   | can_be_user_input |
| --------------------------- | ------------- | ------------- | ------------ | ---------------- | -------------- | ----------------: |
| `section_width`             | length        | m             | mm           | mm, in, m        | input_only     |              true |
| `aspect_ratio`              | dimensionless | decimal       | percent      | percent, decimal | input_only     |              true |
| `rim_diameter`              | length        | m             | in           | in, mm, m        | input_only     |              true |
| `wheel_radius`              | length        | m             | in           | in, mm, m        | intermediate   |              true |
| `engine_speed`              | angular_speed | rad/s         | rpm          | rpm, rad/s       | input_only     |              true |
| `combined_gear_ratio`       | dimensionless | decimal       | decimal      | decimal          | input_only     |              true |
| `vehicle_speed`             | speed         | m/s           | mph          | mph, km/h, m/s   | derived_output |              true |
| `engine_torque`             | torque        | N·m           | ft·lbf       | ft·lbf, N·m      | input_only     |              true |
| `engine_power`              | power         | W             | hp           | hp, kW, W        | derived_output |              true |
| `drivetrain_efficiency`     | dimensionless | decimal       | percent      | percent, decimal | input_only     |              true |
| `tractive_force`            | force         | N             | lbf          | lbf, N, kN       | derived_output |              true |
| `mass_factor`               | dimensionless | decimal       | decimal      | decimal          | intermediate   |              true |
| `vehicle_weight`            | force         | N             | lbf          | lbf, N, kN       | input_only     |              true |
| `gravity`                   | acceleration  | m/s²          | m/s²         | m/s², ft/s²      | constant       |             false |
| `vehicle_mass`              | mass          | kg            | kg           | kg, slug         | intermediate   |              true |
| `aerodynamic_drag`          | force         | N             | lbf          | lbf, N, kN       | assumption     |              true |
| `rolling_resistance`        | force         | N             | lbf          | lbf, N, kN       | assumption     |              true |
| `road_grade_angle`          | angle         | rad           | deg          | deg, rad         | assumption     |              true |
| `hitch_force`               | force         | N             | lbf          | lbf, N, kN       | assumption     |              true |
| `longitudinal_acceleration` | acceleration  | m/s²          | m/s²         | m/s², ft/s², g   | primary_output |              true |

说明：

1. `display_role` 表示变量的默认展示角色，不限制其运行时来源；
2. `wheel_radius`、`vehicle_speed`、`engine_power`、`tractive_force`、`mass_factor`、`vehicle_mass` 虽然可推导，仍允许用户直接输入；
3. 用户输入值和推导值的保留及 Active 规则遵循 Part 2；
4. `g` 作为加速度单位时表示重力加速度倍数，不是变量 `gravity` 的 variable_id；最终单位 token 在 3.10 确认。

---

### 七、特殊变量属性

#### 1. 默认假设变量

| variable_id          | can_be_assumed | default_assumption | 默认启用 | 含义                        |
| -------------------- | -------------: | -----------------: | ---: | ------------------------- |
| `aerodynamic_drag`   |           true |                0 N | true | Ignore aerodynamic drag   |
| `rolling_resistance` |           true |                0 N | true | Ignore rolling resistance |
| `road_grade_angle`   |           true |              0 rad | true | Level road                |
| `hitch_force`        |           true |                0 N | true | No external hitch force   |

原则：

```text
默认假设值只保存在变量元数据中。
公式元数据只通过 allowed_assumption_inputs 声明是否允许使用假设。
```

如果用户关闭默认假设，且没有提供真实值：

```text
F007_engine_limited_acceleration 不可计算。
系统应显示缺失条件，不得静默使用 0。
```

---

#### 2. 系统常数

```text
variable_id: gravity
is_constant: true
constant_value_si: 9.80665
internal_unit: m/s²
can_be_user_input: false
```

说明：

1. `gravity` 用于 F006 `M = W/g`；
2. `gravity` 不作为公式输出方向；
3. v0.1 内部统一使用标准重力 `9.80665 m/s²`；
4. 课程公式表中的 `9.805 m/s²` 作为来源舍入值保留在备注中，不作为内部常数。

---

### 八、valid_domain 和符号约定

| variable_id                 | valid_domain     | sign_convention      |
| --------------------------- | ---------------- | -------------------- |
| `section_width`             | `> 0`            | 不适用                  |
| `aspect_ratio`              | `> 0`            | 不适用                  |
| `rim_diameter`              | `> 0`            | 不适用                  |
| `wheel_radius`              | `> 0`            | 不适用                  |
| `engine_speed`              | `>= 0`           | v0.1 不处理反向旋转         |
| `combined_gear_ratio`       | `> 0`            | 使用正的 numerical ratio |
| `vehicle_speed`             | `>= 0`           | v0.1 不处理倒车速度         |
| `engine_torque`             | `>= 0`           | v0.1 只处理驱动扭矩         |
| `engine_power`              | `>= 0`           | v0.1 只处理驱动功率         |
| `drivetrain_efficiency`     | `0 < η_tf <= 1`  | 不适用                  |
| `tractive_force`            | `>= 0`           | 正值表示驱动车辆前进           |
| `mass_factor`               | `> 0`            | 不适用                  |
| `vehicle_weight`            | `> 0`            | 重量力大小使用正值            |
| `gravity`                   | `> 0`            | 作为正的加速度常数            |
| `vehicle_mass`              | `> 0`            | 不适用                  |
| `aerodynamic_drag`          | `>= 0`           | 以阻碍前进的力的大小表示         |
| `rolling_resistance`        | `>= 0`           | 以阻碍运动的力的大小表示         |
| `road_grade_angle`          | `-π/2 < θ < π/2` | 正值上坡，负值下坡            |
| `hitch_force`               | finite number    | 正值阻碍前进，负值推动前进        |
| `longitudinal_acceleration` | finite number    | 正值加速，负值减速            |

说明：

变量级 `valid_domain` 只定义变量本身是否合法。

例如：

```text
vehicle_speed = 0
```

作为变量是合法的。

但 F008 中速度位于分母，因此该公式另行要求：

```text
vehicle_speed > 0
```

---

### 九、变量与公式对应关系

#### 1. 作为公式输入

| variable_id             | 使用公式             |
| ----------------------- | ---------------- |
| `section_width`         | F001             |
| `aspect_ratio`          | F001             |
| `rim_diameter`          | F001             |
| `wheel_radius`          | F002, F004       |
| `engine_speed`          | F002, F003       |
| `combined_gear_ratio`   | F002, F004, F005 |
| `engine_torque`         | F003, F004       |
| `drivetrain_efficiency` | F004             |
| `vehicle_weight`        | F006, F007       |
| `gravity`               | F006             |
| `tractive_force`        | F007             |
| `aerodynamic_drag`      | F007             |
| `rolling_resistance`    | F007             |
| `road_grade_angle`      | F007             |
| `hitch_force`           | F007             |
| `mass_factor`           | F007             |
| `vehicle_mass`          | F007, F008       |
| `engine_power`          | F008             |
| `vehicle_speed`         | F008             |

#### 2. 作为公式输出

| variable_id                 | 输出公式       |
| --------------------------- | ---------- |
| `wheel_radius`              | F001       |
| `vehicle_speed`             | F002       |
| `engine_power`              | F003       |
| `tractive_force`            | F004       |
| `mass_factor`               | F005       |
| `vehicle_mass`              | F006       |
| `longitudinal_acceleration` | F007, F008 |

原则：

```text
变量元数据不设置 can_be_derived。
是否可推导，由是否存在 output 指向该变量的 formula_id 动态决定。
```

---

### 十、v0.1 初始合理性范围

#### 1. 范围解释

范围判断顺序：

```text
先检查 invalid_range
再检查 normal_range
再检查 warning_range
```

含义：

```text
normal_range:
  常见工况，不警告

warning_range:
  超出 normal_range，但仍属于异常而可能的工程范围

超出 warning_range、但没有违反 invalid_range:
  明显不合理，先执行单位误用检查
  用户可确认后继续

invalid_range:
  绝对无效，不允许继续使用
```

---

#### 2. 初始范围表

| variable_id                 | normal_range      | warning_range       | invalid_range   |
| --------------------------- | ----------------- | ------------------- | --------------- |
| `section_width`             | 125–355 mm        | 80–500 mm           | ≤0              |
| `aspect_ratio`              | 25–85 %           | 10–120 %            | ≤0 或 >200 %     |
| `rim_diameter`              | 10–30 in          | 5–40 in             | ≤0              |
| `wheel_radius`              | 9–25 in           | 3–60 in             | ≤0              |
| `engine_speed`              | 0–8000 rpm        | 0–15000 rpm         | <0 或 >30000 rpm |
| `combined_gear_ratio`       | 2–20              | 0.1–50              | ≤0              |
| `vehicle_speed`             | 0–150 mph         | 0–250 mph           | <0              |
| `engine_torque`             | 0–1000 ft·lbf     | 0–3000 ft·lbf       | <0              |
| `engine_power`              | 0–1000 hp         | 0–3000 hp           | <0              |
| `drivetrain_efficiency`     | 70–100 %          | 1–100 %             | ≤0 或 >100 %     |
| `tractive_force`            | 0–10000 lbf       | 0–100000 lbf        | <0              |
| `mass_factor`               | 1–5               | 1–20                | ≤0              |
| `vehicle_weight`            | 1000–10000 lbf    | 100–200000 lbf      | ≤0              |
| `gravity`                   | 9.7–9.9 m/s²      | 1–30 m/s²           | ≤0              |
| `vehicle_mass`              | 500–5000 kg       | 50–100000 kg        | ≤0              |
| `aerodynamic_drag`          | 0–1000 lbf        | 0–5000 lbf          | <0              |
| `rolling_resistance`        | 0–1000 lbf        | 0–5000 lbf          | <0              |
| `road_grade_angle`          | -15° to 15°       | -45° to 45°         | ≤-90° 或 ≥90°    |
| `hitch_force`               | -2000 to 2000 lbf | -20000 to 20000 lbf | 非有限数值           |
| `longitudinal_acceleration` | -10 to 10 m/s²    | -30 to 30 m/s²      | 非有限数值           |

说明：

1. 这些是 v0.1 初始工程范围，不是最终工程标准；
2. 后续课程题目或测试案例如超出范围，可在 3.9 或第 5 支调整；
3. `combined_gear_ratio = 2–20` 保留为课程语境下的 normal range；
4. `combined_gear_ratio` 低于 2 但大于 0 时属于 Warning，不属于 Invalid；
5. `vehicle_speed = 0` 对变量本身合法，但 F008 不可使用；
6. `hitch_force` 和 `longitudinal_acceleration` 允许负值。

---

### 十一、单位误用重点变量

v0.1 应重点启用 `unit_misuse_check` 的变量：

| variable_id        | 常见误用                |
| ------------------ | ------------------- |
| `section_width`    | mm 与 in 混淆          |
| `aspect_ratio`     | 输入 55，但单位选择 decimal |
| `rim_diameter`     | in 与 mm 混淆          |
| `wheel_radius`     | in、ft、m 混淆          |
| `engine_speed`     | rpm 与 rad/s 混淆      |
| `engine_torque`    | ft·lbf 与 N·m 混淆     |
| `engine_power`     | hp、kW、W 混淆          |
| `vehicle_weight`   | lb、lbf、kg 或质量与重量混淆  |
| `vehicle_mass`     | kg、slug、lbf 混淆      |
| `road_grade_angle` | deg 与 rad 混淆        |

规则：

```text
v0.1 不设置 unit_misuse_candidates。
单位误用检测直接遍历 allowed_units。
```

---

### 十二、跨节点一致性修正

#### 1. F001 的无量纲单位

3.6 的 F001 曾写为：

```text
aspect_ratio: decimal
```

统一修正为：

```text
aspect_ratio: decimal
```

最终汇总文档和 3.10 交付数据中，不再使用 `decimal`。

---

#### 2. engine_speed 的 symbol

正式变量符号：

```text
ω_e
```

`RPM` 只作为允许输入单位和 F003 来源表达式中的单位出现。

---

#### 3. engine_power 的 symbol

正式变量符号：

```text
P
```

`HP` 只作为允许输入单位和 F003 来源表达式中的单位出现。

---

### 十三、v0.1 暂不纳入的变量

```text
transmission_gear_ratio
final_drive_ratio
raw_tire_size_string
aerodynamic_drag_coefficient
frontal_area
air_density
rolling_resistance_coefficient
traction_limit
friction_coefficient
normal_load
engine_torque_curve
gear_index
time
distance
0_to_60_time
```

原因：

1. v0.1 直接输入 `combined_gear_ratio`；
2. `raw_tire_size_string` 属于 UI 输入预处理；
3. Road Loads 相关公式暂不纳入；
4. 牵引极限相关公式暂不纳入；
5. 真实加速时间积分暂不纳入。

---

### 十四、v0.1 变量清单最终结论

v0.1 确认纳入以下 20 个正式 `variable_id`：

```text
section_width
aspect_ratio
rim_diameter
wheel_radius
engine_speed
combined_gear_ratio
vehicle_speed
engine_torque
engine_power
drivetrain_efficiency
tractive_force
mass_factor
vehicle_weight
gravity
vehicle_mass
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
longitudinal_acceleration
```

其中：

```text
primary_output:
  longitudinal_acceleration

derived_output:
  vehicle_speed
  engine_power
  tractive_force

intermediate:
  wheel_radius
  mass_factor
  vehicle_mass

input_only:
  section_width
  aspect_ratio
  rim_diameter
  engine_speed
  combined_gear_ratio
  engine_torque
  drivetrain_efficiency
  vehicle_weight

assumption:
  aerodynamic_drag
  rolling_resistance
  road_grade_angle
  hitch_force

constant:
  gravity
```

本清单完整落实了 3.1 规定的 v0.1 最低变量字段：

```text
variable_id
name
symbol
category
description
dimension
internal_unit
default_unit
allowed_units
display_role
importance
normal_range
warning_range
invalid_range
valid_domain
can_be_user_input
status
```

并为特殊变量补充：

```text
sign_convention
can_be_assumed
default_assumption
is_constant
constant_value_si
```

本清单用于支撑：

1. 3.6 已确认的 8 条公式；
2. v0.1 递归推导；
3. 默认假设补齐；
4. 单位统一换算；
5. 单位误用检测；
6. 用户输入值与推导值比较；
7. 缺失条件分析；
8. 变量分类浏览；
9. 结果和缺失条件重要性排序；
10. 后续 3.8 公式依赖关系图。

---

### 十五、节点状态

```text
3.7 确认 v0.1 变量清单 ✅ 已完成
```


---


## 3.8 建立公式依赖关系图

状态：已确认

---

### 一、节点目标

本节点用于建立 v0.1 纵向加速性能最小闭环的公式依赖关系图。

依赖图需要明确：

```text
变量如何作为公式输入
公式如何产生输出变量
推导结果如何继续触发下游公式
同一变量的不同模型结果如何分离
目标量反向查询如何沿依赖图展开
输入变化后哪些下游结果需要失效
```

本节点只处理：

```text
8 条已确认公式之间的依赖关系
20 个已确认变量与公式之间的连接关系
正向递归推导路径
目标量反向查询路径
模型结果分支
依赖失效传播
拓扑顺序和循环检查
```

本节点不处理：

```text
新增公式
新增变量
具体数值测试案例
合理性范围争议
公式来源疑义
最终 JSON / YAML 数据结构
代码实现
界面布局
```

以上内容分别留到：

```text
3.9 建立疑义与冲突清单
3.10 确认交付给开发的数据格式
第 4 支 核心推导引擎
第 6 支 界面与交互
```

---

### 二、依赖图基本语义

v0.1 依赖图包含三类节点。

#### 1. 变量节点

变量节点使用 3.7 已确认的正式 `variable_id`，例如：

```text
engine_torque
wheel_radius
vehicle_mass
longitudinal_acceleration
```

变量节点只表示物理变量。

它不代表某一次运行中的具体值，也不区分该值来自用户输入、公式推导、假设或常数。

---

#### 2. 公式节点

公式节点使用 3.6 已确认的 `formula_id`，例如：

```text
F001_wheel_radius_from_tire_size
F007_engine_limited_acceleration
```

公式节点表示一条已登记的计算方向。

---

#### 3. 推荐模型记录节点

推荐模型选择使用：

```text
R001_longitudinal_acceleration_recommended_model
```

R001 不是物理公式，不计算新的数值。

它只负责：

```text
在多个不同模型结果之间确定默认 Active 模型
```

---

### 三、依赖边类型

#### 1. 输入依赖边

```text
变量 → 公式
```

含义：

```text
该变量是该公式的 required_input。
```

例如：

```text
engine_torque
    ↓
F003_engine_power_from_torque_rpm
```

---

#### 2. 输出生成边

```text
公式 → 变量
```

含义：

```text
该公式可以产生该变量的一个 Derived 结果。
```

例如：

```text
F003_engine_power_from_torque_rpm
    ↓
engine_power
```

---

#### 3. 模型选择边

```text
模型限定结果 → R001 → Active 选择
```

含义：

```text
R001 在不同模型的 longitudinal_acceleration 结果之间应用推荐模型规则。
```

该边不代表物理计算，只代表模型选择逻辑。

---

### 四、完整公式依赖表

| formula_id                               | required_inputs                                                                                                                                | output                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `F001_wheel_radius_from_tire_size`       | `section_width`, `aspect_ratio`, `rim_diameter`                                                                                                | `wheel_radius`              |
| `F002_vehicle_speed_from_engine_speed`   | `wheel_radius`, `engine_speed`, `combined_gear_ratio`                                                                                          | `vehicle_speed`             |
| `F003_engine_power_from_torque_rpm`      | `engine_torque`, `engine_speed`                                                                                                                | `engine_power`              |
| `F004_tractive_force_from_engine_torque` | `engine_torque`, `combined_gear_ratio`, `drivetrain_efficiency`, `wheel_radius`                                                                | `tractive_force`            |
| `F005_mass_factor_from_total_gear_ratio` | `combined_gear_ratio`                                                                                                                          | `mass_factor`               |
| `F006_vehicle_mass_from_weight`          | `vehicle_weight`, `gravity`                                                                                                                    | `vehicle_mass`              |
| `F007_engine_limited_acceleration`       | `tractive_force`, `aerodynamic_drag`, `rolling_resistance`, `vehicle_weight`, `road_grade_angle`, `hitch_force`, `mass_factor`, `vehicle_mass` | `longitudinal_acceleration` |
| `F008_ideal_power_acceleration_si`       | `engine_power`, `vehicle_speed`, `vehicle_mass`                                                                                                | `longitudinal_acceleration` |

---

### 五、完整正向依赖关系图

> **权威性说明：**依赖关系以 3.10 的结构化公式数据和本节点第四节依赖表为准；以下 ASCII 图仅作示意，不作为机器可读定义。

```text
section_width ──────┐
aspect_ratio ───────┼──→ F001 ──→ wheel_radius ─────┬──→ F002 ──→ vehicle_speed ──┐
rim_diameter ───────┘                                │                             │
                                                    └──→ F004 ──→ tractive_force ─┼──→ F007
                                                                                  │       │
engine_speed ────────────────────────────────┬──→ F002                            │       ├──→ longitudinal_acceleration
                                            └──→ F003 ──→ engine_power ──────────┼──→ F008│    [Engine-limited model]
                                                                                  │       │
engine_torque ───────────────────────────────┬──→ F003                            │       └──→ longitudinal_acceleration
                                            └──→ F004                            │            [Ideal constant-power model]
                                                                                  │
combined_gear_ratio ─────────────────────────┬──→ F002                            │
                                            ├──→ F004                            │
                                            └──→ F005 ──→ mass_factor ───────────┤
                                                                                  │
drivetrain_efficiency ───────────────────────────→ F004                           │
                                                                                  │
vehicle_weight ──────────────────────────────┬──→ F006 ──→ vehicle_mass ──────────┤
                                            └────────────────────────────────────→ F007
                                                                                  │
gravity ─────────────────────────────────────────→ F006                           │
                                                                                  │
aerodynamic_drag ────────────────────────────────────────────────────────────────→ F007
rolling_resistance ──────────────────────────────────────────────────────────────→ F007
road_grade_angle ────────────────────────────────────────────────────────────────→ F007
hitch_force ─────────────────────────────────────────────────────────────────────→ F007
```

说明：

```text
F007 和 F008 都输出 longitudinal_acceleration，
但必须保存为不同 model_name 下的独立结果实例。
```

---

### 六、模型限定结果节点

依赖图中不能在 F007 和 F008 之后立即把结果合并成一个普通数值。

运行时应形成两个模型限定结果：

```text
longitudinal_acceleration
  model_name: Engine-limited acceleration
  source_formula: F007_engine_limited_acceleration
```

以及：

```text
longitudinal_acceleration
  model_name: Ideal constant-power acceleration
  source_formula: F008_ideal_power_acceleration_si
```

这两个结果：

```text
variable_id 相同
model_name 不同
formula_path 不同
```

因此：

```text
不自动视为 Conflict
不自动互相验证
不静默覆盖
```

然后由：

```text
R001_longitudinal_acceleration_recommended_model
```

应用推荐模型规则。

---

### 七、推荐模型选择关系图

```text
F007
  ↓
longitudinal_acceleration
[Engine-limited acceleration]
  │
  ├──────────────────────────┐
  │                          │
  │                          ↓
  │                      R001 推荐模型选择
  │                          ↓
  │                     Active result
  │
F008                         ↑
  ↓                          │
longitudinal_acceleration ───┘
[Ideal constant-power acceleration]
```

R001 规则：

```text
如果 F007 结果有效：
  Engine-limited acceleration 结果默认作为 Active。

如果 F007 不可计算：
  不自动切换到 F008。
  显示推荐模型不可用。
  显示 F008 作为可选模型。
  只有用户明确选择后，F008 才可成为 Active。
```

说明：

```text
模型限定结果节点属于运行时结果实例，
不是新的 variable_id。
```

正式变量仍只有：

```text
longitudinal_acceleration
```

---

### 八、完整推导的拓扑层级

在所有主要中间量均由公式推导的情况下，v0.1 可以按以下拓扑层级理解。

#### Layer 0：初始来源变量

推荐测试输入：

```text
section_width
aspect_ratio
rim_diameter
engine_speed
combined_gear_ratio
engine_torque
drivetrain_efficiency
vehicle_weight
```

系统常数：

```text
gravity
```

默认假设或用户真实输入：

```text
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
```

---

#### Layer 1：第一层可推导结果

```text
F001 → wheel_radius
F003 → engine_power
F005 → mass_factor
F006 → vehicle_mass
```

这四条公式之间没有数值依赖，可以并行计算。

---

#### Layer 2：依赖 wheel_radius 的结果

```text
F002 → vehicle_speed
F004 → tractive_force
```

F002 和 F004 都依赖：

```text
wheel_radius
```

因此在完整推导路径中，需要等待 F001 产生 wheel_radius。

---

#### Layer 3：两个加速度模型结果

```text
F007 → longitudinal_acceleration
       [Engine-limited acceleration]

F008 → longitudinal_acceleration
       [Ideal constant-power acceleration]
```

F007 需要：

```text
tractive_force
mass_factor
vehicle_mass
vehicle_weight
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
```

F008 需要：

```text
engine_power
vehicle_speed
vehicle_mass
```

---

#### Layer 4：模型选择

```text
R001 → longitudinal_acceleration 的默认 Active 模型
```

R001 不计算数值，只执行推荐模型选择规则。

---

#### 拓扑层级的边界

以上 Layer 只是：

```text
完整默认推导路径的说明和测试顺序
```

它不是硬编码执行顺序。

如果用户直接输入：

```text
wheel_radius
vehicle_mass
engine_power
vehicle_speed
tractive_force
mass_factor
```

对应下游公式可以直接进入候选，不需要等待上游公式执行。

因此正式引擎应根据：

```text
当前已知量池
```

动态扫描可执行公式，而不是固定按 Layer 0、1、2、3 顺序写死。

---

### 九、主要正向推导路径

#### 1. Engine-limited acceleration 主路径

```text
section_width
aspect_ratio
rim_diameter
    ↓
F001
    ↓
wheel_radius
    ↓
F004
    ↓
tractive_force
    ↓
F007
    ↓
longitudinal_acceleration
[Engine-limited acceleration]
```

F004 同时需要：

```text
engine_torque
combined_gear_ratio
drivetrain_efficiency
```

F007 同时需要：

```text
mass_factor
vehicle_mass
vehicle_weight
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
```

---

#### 2. Mass factor 分支

```text
combined_gear_ratio
    ↓
F005
    ↓
mass_factor
    ↓
F007
```

---

#### 3. Weight-to-mass 分支

```text
vehicle_weight
gravity
    ↓
F006
    ↓
vehicle_mass
    ├──→ F007
    └──→ F008
```

注意：

```text
vehicle_weight 还直接进入 F007 的 W sinθ 项。
```

因此 `vehicle_weight` 对 F007 有两条不同的数据路径：

```text
vehicle_weight ───────────────→ F007
vehicle_weight → F006 → vehicle_mass → F007
```

这两条边不能合并或删除。

---

#### 4. Ideal constant-power acceleration 路径

```text
engine_torque
engine_speed
    ↓
F003
    ↓
engine_power
    ┐
    │
    ├──→ F008
    │      ↓
    │   longitudinal_acceleration
    │   [Ideal constant-power acceleration]
    │
wheel_radius
engine_speed
combined_gear_ratio
    ↓
F002
    ↓
vehicle_speed
    ┘

vehicle_weight
gravity
    ↓
F006
    ↓
vehicle_mass
    ───→ F008
```

---

### 十、变量分支关系

以下变量会同时影响多个公式或多个结果。

| variable_id           | 直接下游公式           | 影响结果                                                                 |
| --------------------- | ---------------- | -------------------------------------------------------------------- |
| `wheel_radius`        | F002, F004       | `vehicle_speed`, `tractive_force`, 两个 `longitudinal_acceleration` 模型 |
| `engine_speed`        | F002, F003       | `vehicle_speed`, `engine_power`, F008 加速度                            |
| `combined_gear_ratio` | F002, F004, F005 | `vehicle_speed`, `tractive_force`, `mass_factor`, 两个加速度模型            |
| `engine_torque`       | F003, F004       | `engine_power`, `tractive_force`, 两个加速度模型                            |
| `vehicle_weight`      | F006, F007       | `vehicle_mass`, F007 加速度，以及通过 `vehicle_mass` 影响 F008                 |
| `vehicle_mass`        | F007, F008       | 两个加速度模型                                                              |
| `aerodynamic_drag`    | F007             | Engine-limited acceleration                                          |
| `rolling_resistance`  | F007             | Engine-limited acceleration                                          |
| `road_grade_angle`    | F007             | Engine-limited acceleration                                          |
| `hitch_force`         | F007             | Engine-limited acceleration                                          |

---

### 十一、目标量反向查询图

当用户选择：

```text
target = longitudinal_acceleration
```

系统首先查找：

```text
output = longitudinal_acceleration
```

得到两条已登记公式：

```text
F007_engine_limited_acceleration
F008_ideal_power_acceleration_si
```

系统不得对其他公式做临时代数反解。

---

#### 1. F007 反向依赖展开

第一层输入：

```text
tractive_force
aerodynamic_drag
rolling_resistance
vehicle_weight
road_grade_angle
hitch_force
mass_factor
vehicle_mass
```

可继续推导的输入：

```text
tractive_force
  ← F004

mass_factor
  ← F005

vehicle_mass
  ← F006
```

继续展开：

```text
tractive_force
  ← engine_torque
  ← combined_gear_ratio
  ← drivetrain_efficiency
  ← wheel_radius

wheel_radius
  ← F001
  ← section_width
  ← aspect_ratio
  ← rim_diameter

mass_factor
  ← combined_gear_ratio

vehicle_mass
  ← vehicle_weight
  ← gravity
```

因此，使用完整推导方式时，F007 的典型叶节点条件为：

```text
engine_torque
combined_gear_ratio
drivetrain_efficiency
vehicle_weight
gravity
section_width
aspect_ratio
rim_diameter
```

以及以下变量的真实输入或允许假设：

```text
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
```

---

#### 2. F008 反向依赖展开

第一层输入：

```text
engine_power
vehicle_speed
vehicle_mass
```

可继续推导：

```text
engine_power
  ← F003
  ← engine_torque
  ← engine_speed

vehicle_speed
  ← F002
  ← wheel_radius
  ← engine_speed
  ← combined_gear_ratio

wheel_radius
  ← F001
  ← section_width
  ← aspect_ratio
  ← rim_diameter

vehicle_mass
  ← F006
  ← vehicle_weight
  ← gravity
```

因此，使用完整推导方式时，F008 的典型叶节点条件为：

```text
engine_torque
engine_speed
combined_gear_ratio
vehicle_weight
gravity
section_width
aspect_ratio
rim_diameter
```

F008 不需要：

```text
drivetrain_efficiency
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
mass_factor
```

---

### 十二、反向查询的停止规则

反向查询不应强制一直展开到最底层输入。

因为以下变量都允许用户直接输入：

```text
wheel_radius
vehicle_speed
engine_power
tractive_force
mass_factor
vehicle_mass
longitudinal_acceleration
```

因此反向查询遇到可用户输入变量时，应同时提供两类方案：

```text
方案 A：直接输入该变量
方案 B：继续通过已登记公式推导该变量
```

例如缺少 `wheel_radius` 时，应显示：

```text
可以直接输入 wheel_radius
```

或：

```text
提供 section_width + aspect_ratio + rim_diameter，
由 F001 推导 wheel_radius
```

该机制遵循 Part 2 已确认的反向条件规则，不是自动代数反解。

---

### 十三、用户输入值与推导值的图关系

依赖图描述公式能力，不决定运行时哪个值 Active。

例如用户直接输入：

```text
wheel_radius
```

同时又提供：

```text
section_width
aspect_ratio
rim_diameter
```

则运行时可以同时存在：

```text
wheel_radius [User Input]
wheel_radius [Derived by F001]
```

规则：

```text
两个结果不互相覆盖
用户输入默认作为 Active
F001 推导值用于比较
下游公式默认使用 Active 值
```

依赖图中的：

```text
F001 → wheel_radius
```

仍然保留。

它不因为用户已经输入 `wheel_radius` 而从公式图中删除。

---

### 十四、依赖失效传播

当某个输入值发生修改时，只将真正依赖该值的下游推导结果标记为 stale。

#### 1. 轮胎尺寸变化

如果以下任一变量变化：

```text
section_width
aspect_ratio
rim_diameter
```

则依次失效：

```text
F001 derived wheel_radius
F002 derived vehicle_speed
F004 derived tractive_force
F007 Engine-limited acceleration result
F008 Ideal constant-power acceleration result
R001 Active selection
```

说明：

如果下游公式实际使用的是用户直接输入的 `wheel_radius`，而不是 F001 推导值，则该下游结果不应因为轮胎尺寸变化而失效。

失效传播必须沿实际使用的来源路径进行。

---

#### 2. engine_speed 变化

失效：

```text
F002 derived vehicle_speed
F003 derived engine_power
F008 Ideal constant-power acceleration result
R001 Active selection state
```

不直接失效：

```text
F004 tractive_force
F005 mass_factor
F007 Engine-limited acceleration
```

原因：

在 v0.1 已登记公式中，F004 和 F007 没有把 `engine_speed` 作为数值输入。

---

#### 3. combined_gear_ratio 变化

失效：

```text
F002 vehicle_speed
F004 tractive_force
F005 mass_factor
F007 Engine-limited acceleration
F008 Ideal constant-power acceleration
R001 Active selection
```

---

#### 4. engine_torque 变化

失效：

```text
F003 engine_power
F004 tractive_force
F007 Engine-limited acceleration
F008 Ideal constant-power acceleration
R001 Active selection
```

---

#### 5. drivetrain_efficiency 变化

失效：

```text
F004 tractive_force
F007 Engine-limited acceleration
R001 Active selection
```

不影响：

```text
F003 engine_power
F002 vehicle_speed
F008 Ideal constant-power acceleration
```

---

#### 6. vehicle_weight 变化

失效：

```text
F006 vehicle_mass
F007 Engine-limited acceleration
F008 Ideal constant-power acceleration
R001 Active selection
```

原因：

`vehicle_weight` 既直接进入 F007，也通过 F006 生成 `vehicle_mass`。

---

#### 7. 路载或外力变量变化

如果以下变量变化：

```text
aerodynamic_drag
rolling_resistance
road_grade_angle
hitch_force
```

只失效：

```text
F007 Engine-limited acceleration
R001 Active selection
```

不影响 F008。

---

### 十五、失效传播原则

失效传播必须满足：

```text
只沿实际使用的 formula_path 传播
```

不能仅因为两个结果拥有相同 `variable_id`，就把所有下游结果全部标记失效。

例如：

```text
engine_power [User Input]
engine_power [Derived by F003]
```

如果用户修改 `engine_torque`：

```text
F003 推导的 engine_power 失效
```

但如果 F008 实际使用的是用户输入的 `engine_power`，则 F008 不应因此自动失效。

因此，运行时结果对象必须保留：

```text
source
formula_path
dependencies
```

这与 3.1 和 3.2 已确认的“元数据与运行时结果分离”一致。

---

### 十六、缺失与无效分支阻断

#### 1. 缺失输入

如果某条公式缺少 required input：

```text
只阻断该公式及其下游分支
```

例如缺少：

```text
drivetrain_efficiency
```

则：

```text
F004 不可计算
F007 主模型不可计算
```

但以下路径仍可计算：

```text
F001
F002
F003
F005
F006
F008
```

---

#### 2. 无效输入

如果某个输入违反变量 `valid_domain` 或公式 `formula_constraints`：

```text
只阻断依赖该输入的相关分支
```

例如：

```text
vehicle_speed = 0
```

变量本身有效，F002 可以产生该结果。

但：

```text
F008 因 vehicle_speed > 0 约束不满足而被阻断。
```

F007 不受影响。

---

#### 3. 假设关闭

如果用户关闭：

```text
aerodynamic_drag = 0
rolling_resistance = 0
road_grade_angle = 0
hitch_force = 0
```

对应默认假设，而又未提供真实值：

```text
F007 不可计算
```

但 F008 仍可继续计算。

---

### 十七、循环检查

v0.1 已登记的 8 条公式形成有向无环图：

```text
DAG
```

不存在以下循环：

```text
变量 A
→ 公式
→ 变量 B
→ 公式
→ 变量 A
```

一组合法拓扑顺序为：

```text
F001
F003
F005
F006
F002
F004
F007
F008
```

其中：

```text
F001、F003、F005、F006 可以并行
F002、F004 可以并行
F007、F008 可以并行
```

说明：

该拓扑顺序只是一种合法顺序，不是唯一顺序。

如果用户直接输入中间变量，部分上游公式可以不参与当前推导路径。

---

### 十八、未来扩展的循环风险

v0.1 不做自动代数反解，因此当前没有由反向公式造成的依赖循环。

未来如果登记以下反向方向：

```text
engine_speed from vehicle_speed
combined_gear_ratio from vehicle_speed
engine_torque from tractive_force
vehicle_weight from vehicle_mass
```

可能形成双向公式族或图循环。

因此后续新增公式方向时必须：

```text
重新执行循环检查
区分公式库循环和实际推导路径循环
禁止同一推导任务重复使用自身下游结果
```

具体循环检测算法留到第 4 支“核心推导引擎”确认。

---

### 十九、v0.1 图中未包含的关系

以下关系不进入当前依赖图：

```text
transmission_gear_ratio × final_drive_ratio → combined_gear_ratio
P = T_e × ω_e 的 SI 校验路径
空气阻力计算公式
滚动阻力经验公式
轮胎附着极限
发动机扭矩曲线
换挡逻辑
时间积分
0–60 mph 时间
```

原因：

```text
这些公式和变量未进入 3.6、3.7 已确认清单。
```

依赖图不得提前加入尚未登记的公式。

---

### 二十、3.8 最终建议结论

v0.1 公式依赖图由以下部分组成：

```text
变量输入节点
+ 8 个公式节点
+ 公式输出节点
+ 两个模型限定 acceleration 结果实例
+ 1 个推荐模型选择记录 R001
```

核心依赖链为：

```text
轮胎尺寸
→ wheel_radius
→ vehicle_speed / tractive_force

engine_torque + engine_speed
→ engine_power

combined_gear_ratio
→ vehicle_speed / tractive_force / mass_factor

vehicle_weight + gravity
→ vehicle_mass

tractive_force + mass_factor + vehicle_mass + 路载项
→ Engine-limited acceleration

engine_power + vehicle_speed + vehicle_mass
→ Ideal constant-power acceleration

两个模型结果
→ R001
→ 默认 Active 模型选择
```

本依赖图确认以下原则：

```text
公式图是 DAG
计算由当前已知量池动态触发
拓扑层级不得硬编码为固定步骤
用户可直接输入中间变量
反向查询只沿已登记 output 展开
不同模型结果保持分离
失效只沿实际使用的 formula_path 传播
缺失或无效输入只阻断相关分支
R001 只选择模型，不计算数值
```

本依赖图用于支撑：

1. 第 4 支递归推导引擎；
2. 缺失条件反向查询；
3. 分支阻断；
4. stale 结果失效传播；
5. 用户输入值与推导值比较；
6. 不同模型结果展示；
7. 后续 3.9 疑义与冲突审查；
8. 3.10 数据格式交付。

---

### 二十一、节点状态

```text
3.8 ✅ 已完成```


---


## 3.9 建立疑义与冲突清单

状态：已确认

---

### 一、节点目标

本节点用于汇总并处理 3.1–3.8 中发现的定义差异、来源冲突、模型边界、暂定决策和后续风险。

本节点的目标不是重新讨论已经确认的公式链，而是确保：

```text
所有已知疑义都有编号
所有冲突都有明确处理结论
暂未解决的问题都有后续负责节点
不会把来源差异或模型限制静默带入开发
```

本节点只处理：

```text
公式与变量定义冲突
来源数值差异
模型语义差异
v0.1 已接受的近似和限制
反向查询边界
依赖图表达权威性
需要交给 3.10 的数据完整性问题
需要交给第 5 支或第 7 支的后续问题
```

本节点不处理：

```text
新增公式
新增变量
重新选择 v0.1 公式链
代码实现
最终 JSON / YAML 结构
最终 UI 行为
完整工程阈值校准
```

---

### 二、疑义与冲突状态定义

本清单使用以下状态：

| 状态                         | 含义                     |
| -------------------------- | ---------------------- |
| `resolved`                 | 已在本节点确定唯一处理方式          |
| `accepted_v0.1_limitation` | v0.1 明知存在限制，但允许按明确假设继续 |
| `deferred_with_owner`      | 当前不解决，但已经指定后续节点和处理要求   |
| `blocking`                 | 未解决前不得进入开发交付           |

原则：

```text
只要存在 blocking 项，3.9 就不能确认。
```

---

### 三、疑义与冲突总览

| ID | 事项 | 类型 | 严重度 | 状态 | 后续归属 |
|---|---|---|---|---|---|
| C001 | `g = 9.805` 与 `g = 9.80665` | 常数来源差异 | 高 | `resolved` | 3.10 已同步 |
| C002 | 名义轮胎半径与有效滚动半径 | 变量物理语义 | 中 | `resolved` | 第 7 支未来提示 |
| C003 | F008 使用发动机功率还是轮端功率 | 模型输入语义 | 高 | `resolved` | 无 |
| C004 | F008 的低速奇异性与适用阈值 | 模型适用边界 | 高 | `deferred_with_owner` | 第 5 支 |
| C005 | Mass factor 经验式适用范围不明 | 经验公式限制 | 中 | `accepted_v0.1_limitation` | 第 5 / 第 7 支 |
| C006 | `M = W/g` 的临时 `model_group` | 模型分组 | 低 | `accepted_v0.1_limitation` | 第二个复用模块加入时 |
| C007 | 反向搜索深度上限 | 图搜索规则 | 高 | `resolved` | 第 4 支实现 |
| C008 | ASCII 依赖图存在排版歧义 | 文档权威性 | 中 | `resolved` | 3.10 已处理 |
| C009 | 公式 `description` / `source_reference` 尚未结构化 | 元数据完整性 | 高 | `deferred_with_owner` | 3.10 已处理 |
| C010 | 条件和范围字段的数据结构未确定 | 数据格式 | 高 | `deferred_with_owner` | 3.10 已处理 |
| C011 | 单位 token `g`、`lb`、`lbf` 存在歧义 | 单位标识 | 高 | `deferred_with_owner` | 3.10 / 第 5 支 |
| C012 | 合理性范围仍为初始工程范围 | 工程阈值 | 中 | `deferred_with_owner` | 第 5 支 |
| C013 | F003 使用 `5252` 的来源舍入 | 来源舍入 | 低 | `accepted_v0.1_limitation` | 后续 validation 路径 |
| C014 | F008 使用 SI 等价式而非公式表原式 | 来源表达差异 | 中 | `resolved` | 已在 3.6 记录 |

## 四、详细处理结论

### C001：重力常数数值冲突

#### 1. 冲突内容

目前项目材料中存在三个数值：

```text
Part 2 产品规则：
g = 9.80665 m/s²

课程公式表：
g = 9.805 m/s²
g = 32.2 ft/s²

教材常用工程表达：
g ≈ 9.81 m/s²
g ≈ 32.2 ft/s²
```

3.7 曾暂时使用：

```text
constant_value_si = 9.805
```

并将差异交给 3.9 处理。

#### 2. 处理结论

v0.1 内部系统常数统一采用：

```text
gravity.constant_value_si = 9.80665
gravity.internal_unit = m/s²
```

理由：

1. Part 2 已经明确确认系统使用“标准重力加速度”；
2. `9.80665 m/s²` 是系统常数，不是某条来源原生公式中的经验系数；
3. 内部计算应使用统一的高精度常数；
4. 课程公式表中的 `9.805` 和教材中的 `9.81 / 32.2` 属于工程舍入值，应保留在来源说明中，但不作为系统内部唯一常数。

#### 3. 对已有节点的修正

最终汇总文档中，3.7 的以下内容：

```text
constant_value_si: 9.805
```

统一修正为：

```text
constant_value_si: 9.80665
```

课程公式表中的：

```text
g = 9.805 m/s²
```

保留为来源备注：

```text
Course formula sheet uses rounded gravity value 9.805 m/s².
```

#### 4. 状态

```text
status: resolved
```

---

### C002：名义轮胎半径与有效滚动半径

#### 1. 原疑义

F001 从轮胎规格计算的是名义未加载几何半径；现实车辆还可能区分 loaded radius 和 effective rolling radius。F002、F004 从严格工程意义上更接近使用有效滚动半径。

#### 2. 课程核实结果

当前课程材料没有区分这些半径。课程直接由轮胎规格计算 `r_w`，并将其继续用于车辆速度和轮端牵引力关系。因此，v0.1 的单一 `wheel_radius` 处理与课程模型一致，不属于公式误用。

#### 3. 处理结论

v0.1 保留：

```text
variable_id: wheel_radius
```

其含义为：由名义轮胎规格得到，并在 v0.1 课程模型中作为运动学和牵引力计算半径近似使用的车轮半径。

如果用户掌握更准确的有效滚动半径，可以直接输入 `wheel_radius`；用户输入值默认优先于 F001 推导值。

当后续加入轮胎变形、滑移或真实滚动半径模型时，再评估是否拆分：

```text
nominal_tire_radius
effective_rolling_radius
loaded_radius
```

#### 4. 状态

```text
status: resolved
course_consistency: confirmed
future_note_owner: 第 7 支 公式模块扩展
```

### C003：F008 使用发动机功率还是轮端功率

#### 1. 原疑义

F008 使用：

```text
a_x = P / (V M)
```

曾担心理想恒功率模型中的 `P` 应为 wheel power 或扣除传动损失后的可用功率。

#### 2. 课程与教材核实结果

课堂字幕中，老师从 `P = F_x V` 推导 ideal engine acceleration，并直接使用 engine horsepower 绘制恒功率加速度曲线；推导过程中没有引入传动效率，也没有区分发动机功率和轮端功率。教材 Eq. 2.4 同样明确标注 `HP = Engine horsepower`。

因此，F008 使用 `engine_power` 不是项目自行创造的假定，而是课程和教材模型的原意。

#### 3. 处理结论

保持：

```text
required_inputs:
  - engine_power
  - vehicle_speed
  - vehicle_mass

model_name: ideal_constant_power_acceleration
model_type: idealized_model
```

该模型仍是理想化比较模型，不代表真实轮端可用功率，也不作为默认推荐 Active 模型。

课堂字幕定位：

```text
约 16:38–19:06：理想发动机加速度推导
约 1:07:40–1:07:52：constant power at 328 horsepower 曲线
```

#### 4. 状态

```text
status: resolved
course_consistency: confirmed
```

### C004：F008 的低速奇异性

#### 1. 问题内容

F008：

```text
a_x = P / (V M)
```

当 `V → 0` 时，数学结果趋于无穷，不代表真实车辆起步过程。

#### 2. 已确认硬约束

```text
vehicle_speed > 0
```

因此 `vehicle_speed = 0` 必须阻断 F008。

#### 3. 课程锚点

老师绘制理想加速度曲线时将下限设置为：

```text
10 mph ≈ 4.4704 m/s
```

课堂说明包括：

1. `1/V` 使零速结果趋于无穷，老师明确称其为 absurd；
2. 真实车辆零速起步依赖离合器或液力变矩器打滑，理想恒功率模型不覆盖该阶段；
3. 低速实际加速度受轮胎摩擦限制；
4. 课堂提示低速下超过约 `0.8 standard_gravity` 的结果值得怀疑。

字幕定位：

```text
约 1:07:08–1:08:03：绘图从 10 mph 开始并说明零速奇异性
约 1:08:37–1:08:47：轮胎摩擦限制和约 0.8 g 警戒值
```

#### 4. 当前处理结论

```text
V = 0：阻断 F008
0 < V < 10 mph：允许数学计算，但必须标记为低速理想模型高风险区
V >= 10 mph：按普通 F008 理想比较模型规则计算
```

`10 mph` 是课程实践锚点和第 5 支的初始候选阈值。最终采用 Warning、Formula Not Applicable 或其他安全状态，由第 5 支正式确认。

#### 5. 状态

```text
status: deferred_with_owner
owner: 第 5 支 单位与工程安全
blocking_for_3.10: false
blocking_for_release: true
course_anchor: 10 mph
secondary_anchor: approximately 0.8 standard_gravity at low speed
```

### C005：Mass factor 经验式适用范围不明确

#### 1. 疑义内容

F005：

```text
M_f = 1 + 0.04 N_tf + 0.0025 N_tf²
```

是一条经验近似式。

当前来源未给出：

```text
适用车型范围
适用传动系统范围
系数来源
统计样本
推荐 N_tf 范围
误差范围
```

#### 2. v0.1 处理结论

v0.1 保留该公式，因为：

1. 它来自课程公式表；
2. 它是已选加速度闭环中的必要中间公式；
3. 它能测试 empirical formula 和 intermediate result；
4. 它不被表述为精确车辆专属惯量模型。

必须显示或记录：

```text
Typical empirical mass-factor approximation.
Not a vehicle-specific rotating-inertia model.
```

#### 3. 后续要求

第 5 支应通过测试案例检查：

```text
不同 N_tf 下 M_f 的数量级
3.7 初始合理性范围是否合适
是否需要公式级 applicability range
```

第 7 支扩展真实旋转惯量模型时，不得把 F005 结果当作同一精度等级的结果静默覆盖。

#### 4. 状态

```text
status: accepted_v0.1_limitation
owner: 第 5 支 / 第 7 支
```

---

### C006：`M = W/g` 的临时模型分组

#### 1. 疑义内容

F006：

```text
M = W / g
```

是一条跨模块基础物理关系。

它不天然只属于：

```text
Acceleration Performance
```

未来 Axle Loads、Braking、Ride 等模块也可能使用它。

#### 2. v0.1 处理结论

保持 3.6 已确认决定：

```text
model_group: Acceleration Performance
model_name: Weight-to-mass relation
```

理由：

```text
v0.1 当前唯一直接消费者是 Acceleration Performance。
```

#### 3. 重新评估触发条件

当第二个 `model_group` 需要直接复用 F006 时，必须重新评估：

```text
是否建立基础物理关系分组
是否允许跨 model_group 引用同一公式
是否将 F006 设为共享公式
```

在该触发条件出现前，不提前新增模糊的公共分组。

#### 4. 状态

```text
status: accepted_v0.1_limitation
revisit_trigger: second model_group consumes F006
```

---

### C007：反向搜索深度上限

#### 1. 问题来源

Part 2 已明确：

```text
反向展开深度上限由公式与变量系统阶段确定。
```

3.8 已确认的 v0.1 依赖图中，最长公式链深度为 3。

例如：

```text
F001 → F004 → F007
F001 → F002 → F008
```

#### 2. v0.1 处理结论

v0.1 反向搜索上限设为：

```text
max_reverse_formula_depth = 5
```

#### 3. 深度计数规则

每经过一条已登记公式，深度增加 1。

例如：

```text
target variable
← F007              depth 1
← tractive_force
← F004              depth 2
← wheel_radius
← F001              depth 3
```

以下节点不计入公式深度：

```text
变量节点
用户直接输入方案
Assumed 来源
Constant 来源
R001 推荐模型记录
```

#### 4. 超限行为

当某一反向分支超过 5 层时：

1. 停止继续展开该分支；
2. 不影响其他未超限分支；
3. 显示该分支已被截断；
4. 仍允许用户直接输入当前边界变量；
5. 不得误报为“没有计算路径”。

#### 5. 未来重新评估

当第 7 支加入新模块或出现超过 5 层的合法公式链时，应重新评估该值。

不得把 5 层永久硬编码为产品不可修改常数。

#### 6. 状态

```text
status: resolved
owner: 第 4 支 核心推导引擎
```

---

### C008：ASCII 依赖图的权威性

#### 1. 疑义内容

3.8 第五节 ASCII 大图可能因字体、换行或终端宽度导致标签错位。

图示中的位置不能作为程序逻辑依据。

#### 2. 处理结论

依赖关系的权威顺序为：

```text
第一：3.10 交付的结构化公式数据
第二：3.8 第四节公式依赖表
第三：3.8 其他逐条依赖说明
第四：ASCII 图示
```

ASCII 图只用于人工快速理解。

开发、测试和依赖生成不得解析 ASCII 图。

#### 3. 最终文档要求

最终 Markdown 中应保留说明：

```text
依赖关系以结构化数据和公式依赖表为准；
ASCII 图仅作示意，不作为机器可读定义。
```

#### 4. 状态

```text
status: resolved
owner: 3.10
```

---

### C009：公式正式元数据尚未完全结构化

#### 1. 问题内容

3.2 已确认每条 v0.1 公式至少需要：

```text
description
source_reference
```

3.6 已经提供了足够的解释和来源背景，但在每条公式记录中尚未全部以正式键值形式落地。

#### 2. 处理结论

3.10 交付数据中，F001–F008 每条公式必须正式包含：

```text
description
source_reference
```

不得依赖章节标题或散文说明替代字段。

#### 3. 初始来源映射

F001–F005、F007、F008：

```text
source_reference:
  document: Vehicle Dynamics Formulae
  section: Ch 2 - Acceleration Performance
```

F006：

```text
source_reference:
  relation: W = M g
  document: Fundamentals of Vehicle Dynamics, Revised Edition
  note: Fundamental weight-to-mass relation
```

具体页码或定位字段如能确认，应在 3.10 补充；如无法确认，至少保留文档和章节级定位。

#### 4. description 处理

每条公式的 `description` 从 3.6 已确认的名称、目标和说明中提炼，不新增物理含义。

#### 5. 状态

```text
status: deferred_with_owner
owner: 3.10
blocking_for_developer_handoff: true
```

---

### C010：条件和范围字段的结构尚未确定

#### 1. 涉及字段

```text
valid_domain
normal_range
warning_range
invalid_range
applicability_conditions
formula_constraints
default_assumption
fallback_behavior
```

当前文档以人类可读文本表达。

#### 2. 风险

如果最终仍使用任意自然语言字符串：

```text
引擎难以稳定解析
测试难以自动生成
不同公式可能使用不一致语法
```

但如果过早设计复杂表达式语言，也会增加开发范围。

#### 3. 处理结论

具体结构留给 3.10 确认。

3.10 必须明确：

1. 哪些字段机器执行；
2. 哪些字段只用于显示；
3. 范围端点是否包含；
4. AND / OR 条件如何表达；
5. 单位在哪一层保存；
6. 是否允许公式引用其他字段；
7. 条件无法结构化时如何标记人工说明。

#### 4. 状态

```text
status: deferred_with_owner
owner: 3.10
blocking_for_developer_handoff: true
```

---

### C011：单位 token 歧义

#### 1. `g` 的双重含义

当前可能同时存在：

```text
variable symbol g = gravity
unit g = standard gravity multiple
```

例如：

```text
longitudinal_acceleration allowed_units:
  m/s²
  ft/s²
  g
```

这里的单位 `g` 不是变量 `gravity`。

#### 2. `lb` 的歧义

日常资料中的：

```text
lb
```

可能指：

```text
lbm
lbf
```

项目内部不能依赖上下文猜测。

#### 3. 处理结论

3.10 必须为机器数据定义无歧义 token。

建议方向：

```text
gravity variable_id: gravity

standard-gravity acceleration unit token:
  standard_gravity
  或 g0

force unit:
  lbf

mass unit:
  lbm 或 slug
```

最终 token 在 3.10 决定。

UI 可以显示常见符号，但机器 ID 必须唯一。

#### 4. 状态

```text
status: deferred_with_owner
owner: 3.10 / 第 5 支
blocking_for_developer_handoff: true
```

---

### C012：合理性范围仍是初始值

#### 1. 问题内容

3.7 已确认的范围用于 v0.1 初始检查，但尚未经过完整测试案例校准。

特别包括：

```text
combined_gear_ratio
mass_factor
tractive_force
road load forces
longitudinal_acceleration
```

#### 2. 当前处理结论

这些范围可以进入原型数据，但必须标记为：

```text
initial_engineering_range
```

不得描述为认证标准或绝对车辆边界。

#### 3. 第 5 支要求

第 5 支应使用：

```text
课程例题
手算案例
乘用车案例
高性能车辆案例
异常单位案例
```

验证范围是否会产生：

```text
过多误报
漏报明显单位错误
错误阻断特殊车辆数据
```

#### 4. 状态

```text
status: deferred_with_owner
owner: 第 5 支 单位与工程安全
blocking_for_initial_engine: false
blocking_for_release: true
```

---

### C013：F003 中的 `5252` 舍入

#### 1. 疑义内容

来源公式使用：

```text
HP = T × RPM / 5252
```

更高精度的单位换算可能产生略有不同的常数。

#### 2. v0.1 处理结论

F003 保留来源公式中的：

```text
5252
```

理由：

1. 它是课程公式表明确给出的表达；
2. F003 的目标之一是验证来源原生单位公式；
3. 该差异只造成很小的工程舍入误差；
4. 不应静默把来源公式改成另一个常数。

#### 3. 后续验证

未来加入：

```text
P = T_e × ω_e
```

作为 SI validation 路径时，可比较两条功率计算结果，并通过容差处理舍入差异。

#### 4. 状态

```text
status: accepted_v0.1_limitation
```

---

### C014：F008 使用 SI 等价表达

#### 1. 来源差异

公式表原式：

```text
a_x = 550(g/V)(HP/W)
```

v0.1 计算式：

```text
a_x = P / (V M)
```

#### 2. 处理结论

两式在：

```text
P = 550 HP
M = W/g
```

的单位关系下数学等价。

v0.1 采用 SI 式是有意的工程整理，不是来源错误。

必须保留 3.6 已确认的 notes：

```text
本公式为 a_x = 550gHP/(VW) 的 SI 等价简化形式，
原始来源表达式见公式表 Ch2。
```

不得删除来源原式，也不得把 SI 式伪装成公式表原文。

#### 3. 状态

```text
status: resolved
```

---

## 五、已确认不存在的冲突

经过 3.8 依赖图核对，以下项目不存在冲突。

### 1. 公式输入输出覆盖

```text
8 条公式的 required_inputs 和 output
与 20 个变量清单完全一致。
```

没有：

```text
未定义变量
孤立公式输出
多余变量
引用错误 variable_id
```

---

### 2. 依赖图循环

v0.1 的公式图是 DAG。

不存在：

```text
公式直接或间接依赖自身输出
```

---

### 3. F007 中 W 和 M 的关系

以下两条依赖同时存在且都正确：

```text
vehicle_weight → F007
vehicle_weight → F006 → vehicle_mass → F007
```

它们分别对应：

```text
W sinθ
M_f M
```

不得合并。

---

### 4. 不同加速度模型

F007 和 F008 都输出：

```text
longitudinal_acceleration
```

但属于不同 `model_name`。

它们的结果差异：

```text
不是普通 Conflict
不是 validation
不允许静默覆盖
```

由 R001 负责默认模型选择。

---

### 5. `engine_speed` 与 F007

在当前已登记公式中：

```text
engine_speed
```

不直接或间接进入 F007 主模型。

因此修改 `engine_speed` 不使 F007 结果失效。

这是当前公式图的正确行为，不属于遗漏。

---

## 六、交给 3.10 的强制事项

3.10 必须完成以下项目，否则不得交付开发：

1. 将 `gravity.constant_value_si` 统一为 `9.80665`；
2. 为 F001–F008 正式填写 `description`；
3. 为 F001–F008 正式填写 `source_reference`；
4. 定义 `valid_domain` 的结构；
5. 定义三类 range 的结构和边界语义；
6. 定义 `applicability_conditions` 的机器可读结构；
7. 定义 `formula_constraints` 的机器可读结构；
8. 定义 recommendation record 的数据结构；
9. 定义无歧义单位 token；
10. 明确 `g` 单位与 `gravity` 变量的区别；
11. 明确 `lbm / lbf / slug` 的 token；
12. 将结构化依赖表作为开发权威；
13. ASCII 图只作为文档示意；
14. 写入 `max_reverse_formula_depth = 5`；
15. 明确深度计数只计算公式节点。

---

## 七、交给后续阶段的事项

### 第 4 支：核心推导引擎

```text
实现 max_reverse_formula_depth = 5
实现公式图 DAG 检查
实现实际 formula_path 级 stale 传播
实现不同模型结果实例分离
实现 R001 模型选择
```

---

### 第 5 支：单位与工程安全

```text
确认 F008 低速适用阈值
校准初始合理性范围
确认单位误用建议规则
验证 mass factor 数量级
验证 source_native 舍入容差
确认 lbm / lbf / slug 的用户提示
```

---

### 第 7 支：公式模块扩展

```text
评估 nominal radius 与 effective rolling radius 是否拆分
引入 wheel power / available power 时重新定义功率链
第二个模块复用 F006 时重新评估 model_group
加入 P = Tω validation 路径
扩展超过 5 层的公式链时重新评估反向深度
```

---

## 八、3.9 最终建议结论

当前清单中：

```text
blocking: 0
resolved: 6
accepted_v0.1_limitation: 3
deferred_with_owner: 5
```

所有 deferred 项均已指定：

```text
处理节点
处理要求
是否阻断开发交付
是否阻断最终发布
```

v0.1 允许继续进入 3.10，但必须满足：

```text
3.10 完成所有 developer handoff blocking 项。
```

本节点确认的核心原则：

```text
来源差异必须显式记录
系统内部常数与来源舍入值分离
模型近似不能伪装成真实精确模型
临时分组必须有重新评估触发条件
反向查询必须有明确深度上限
结构化数据和依赖表高于 ASCII 图示
所有未解决事项必须指定后续 owner
```

---

### 九、节点状态

```text
3.9 ✅ 已完成```


---


## 3.10 确认交付给开发的数据格式

状态：已确认

---

### 一、节点目标

本节点用于确认第 3 阶段完成后，变量、公式、模型、推荐关系、来源、单位和全局规则以什么结构交付给开发。

本节点处理：

```text
静态变量数据如何存储
静态公式数据如何存储
模型名称和模型分组如何存储
推荐模型记录如何存储
来源引用如何存储
单位及换算因子如何存储
条件和范围如何机器读取
依赖图如何从公式数据生成
文件之间如何引用
开发交付前如何验证
实际数据文件由谁生成和核对
```

本节点不处理：

```text
递归推导算法实现
运行时 Result 对象最终结构
界面组件
完整测试案例
工程合理性阈值最终校准
新增公式或变量
```

运行时对象和推导算法留给第 4 支。

---

### 二、本轮修订解决的问题

本轮修订解决以下五项问题。

#### 1. 条件数组的 AND / OR 歧义

不再使用：

```text
数组默认 AND
```

这一含糊规则。

所有机器执行条件必须显式使用：

```text
all
any
```

例如：

```text
formula_constraints:
  all = 所有约束都必须满足

invalid_range:
  any = 命中任一条件即无效
```

裸条件数组不得作为机器执行结构。

---

#### 2. 补全单位文件结构

`units.v0.1.json` 不再只是单位 token 列表。

每个单位必须记录：

```text
unit_id
display_symbol
dimension
canonical_si_unit
si_conversion
status
```

单位换算因子和量纲匹配均以该文件为权威。

---

#### 3. 模型 token 与显示名称分离

3.4、3.6 中的人类可读名称，例如：

```text
Acceleration Performance
Engine-limited acceleration
```

在机器 JSON 中规范化为：

```text
acceleration_performance
engine_limited_acceleration
```

该变化属于数据表示规范化，不改变已确认的物理含义。

人类显示名称集中保存于：

```text
models.v0.1.json
```

不在每条公式中重复保存 `model_display_name`。

---

#### 4. 明确 `formula_family_id` 为可选

保持 3.2 已确认结论：

```text
formula_family_id 是可选字段。
```

v0.1 的 8 条公式目前都有该字段，但 JSON Schema 不将其列为全局必填项。

---

#### 5. 明确实际数据生产步骤

3.10 不只确认抽象格式。

格式确认后，还必须生成：

```text
实际 JSON 数据文件
实际 JSON Schema
自动生成的 Markdown 文档
校验结果
```

这些文件通过核对后，3.10 ✅ 已完成。

---

### 三、核心结论

v0.1 采用：

```text
JSON 作为运行时权威数据格式
JSON Schema 作为结构验证格式
Markdown 作为自动生成的人类阅读文档
```

核心原则：

```text
JSON 是唯一机器权威来源
Markdown 不手工维护第二份公式真相
依赖图从 formulas 数据自动生成
ASCII 图不作为机器数据
禁止使用 JavaScript eval 执行公式
所有机器条件使用显式 all / any
模型显示名称由独立模型登记表统一管理
```

---

### 四、文件结构

```text
data/
├─ catalog.meta.json
├─ variables.v0.1.json
├─ formulas.v0.1.json
├─ models.v0.1.json
├─ recommendations.v0.1.json
├─ sources.v0.1.json
├─ units.v0.1.json
└─ engine-config.v0.1.json

schemas/
├─ catalog.schema.json
├─ variable.schema.json
├─ formula.schema.json
├─ model.schema.json
├─ recommendation.schema.json
├─ source.schema.json
├─ unit.schema.json
├─ condition.schema.json
└─ engine-config.schema.json

docs/generated/
├─ VARIABLES.generated.md
├─ FORMULAS.generated.md
├─ MODELS.generated.md
└─ DEPENDENCIES.generated.md

validation/
└─ validation-report.v0.1.json
```

说明：

1. `data/*.json` 是运行时权威数据；
2. `schemas/*.schema.json` 用于结构校验；
3. `docs/generated/*.md` 从 JSON 自动生成；
4. generated 文档不得人工修改后反向覆盖 JSON；
5. `validation-report.v0.1.json` 保存自动校验结果；
6. 不设置人工维护的权威 `dependency_graph.json`；
7. 如需调试，可自动生成：

   ```text
   dependency_graph.generated.json
   ```

   但它不是源数据。

---


### 五、`catalog.meta.json` 最小结构

`catalog.meta.json` 是数据包的版本化文件索引，不承载公式或变量内容。

至少包含：

```text
schema_version
data_version
catalog_id
title
files
```

其中 `files` 的每条记录至少包含：

```text
role
path
required
```

如该文件有对应 Schema，还应包含：

```text
schema_path
```

最小示例：

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "catalog_id": "vehicle_dynamics_formula_system_v0_1",
  "title": "Vehicle Dynamics Formula System v0.1",
  "files": [
    {
      "role": "variables",
      "path": "data/variables.v0.1.json",
      "schema_path": "schemas/variable.schema.json",
      "required": true
    }
  ]
}
```

规则：

1. `catalog.meta.json` 只列出文件，不复制被索引文件的业务内容；
2. `path` 使用仓库相对路径；
3. 所有 `required = true` 的文件必须在交付校验时存在；
4. catalog 自身由 `catalog.schema.json` 校验。

### 六、单一事实来源规则

#### 1. 变量定义

唯一来源：

```text
variables.v0.1.json
```

不得在公式文件中重复保存：

```text
变量名称
变量符号
变量维度
变量默认单位
变量允许单位
变量默认假设值
变量合理性范围
变量常数值
```

公式只引用 `variable_id`。

---

#### 2. 公式定义

唯一来源：

```text
formulas.v0.1.json
```

依赖关系由：

```text
required_inputs
output
```

自动生成。

不得手工维护第二份机器依赖表。

---

#### 3. 模型定义和显示名称

唯一来源：

```text
models.v0.1.json
```

该文件负责：

```text
model_group token 与显示名称
model_name token 与显示名称
模型所属分组
模型说明
```

公式只保存：

```text
model_group
model_name
```

两个机器 token。

---

#### 4. 推荐模型

唯一来源：

```text
recommendations.v0.1.json
```

不得在 F007、F008 等单条公式中重复保存推荐结论。

---

#### 5. 默认假设

唯一来源：

```text
变量记录中的 default_assumption
```

公式只通过：

```text
allowed_assumption_inputs
```

声明哪些缺失变量允许使用假设补齐。

---

#### 6. 来源资料

来源文档统一登记于：

```text
sources.v0.1.json
```

公式通过：

```text
source_id
locator
note
```

引用具体来源。

---

#### 7. 单位和换算

唯一来源：

```text
units.v0.1.json
```

变量和公式只能引用 `unit_id`，不得自行保存换算因子。

---

### 七、全局 JSON 规则

#### 1. 编码

```text
UTF-8
```

#### 2. 严格 JSON

```text
不允许注释
不允许尾随逗号
布尔值必须为 true / false
数值必须为 JSON number
空列表使用 []
可选字段不存在时直接省略
```

不得使用：

```text
"none"
"not required"
"true"
"false"
```

代替空值、字段省略或布尔值。

---

#### 3. ID 规则

##### variable_id

```text
纯 snake_case
```

示例：

```text
engine_power
longitudinal_acceleration
```

##### formula_id

```text
F + 三位编号 + "_" + snake_case
```

示例：

```text
F007_engine_limited_acceleration
```

##### recommendation_id

```text
R + 三位编号 + "_" + snake_case
```

##### source_id

```text
S + 三位编号 + "_" + snake_case
```

##### model_group

```text
snake_case token
```

示例：

```text
acceleration_performance
tire_and_wheel_geometry
powertrain_kinematics
```

##### model_name

```text
snake_case token
```

示例：

```text
engine_limited_acceleration
ideal_constant_power_acceleration
```

ID 和 token 一旦进入公开版本，不因显示名称调整而随意改变。

---

### 八、模型 token 的跨节点表示修正

#### 1. 已确认文档中的名称

3.4 和 3.6 使用了人类可读名称：

```text
model_group: Acceleration Performance
model_name: Engine-limited acceleration
```

#### 2. 机器数据中的表示

3.10 规定机器 JSON 使用：

```text
model_group: acceleration_performance
model_name: engine_limited_acceleration
```

这属于：

```text
表示方式规范化
```

不属于：

```text
模型含义变化
模型重新命名
物理模型替换
```

#### 3. 人类显示名称的存储位置

人类显示名称集中放在：

```text
models.v0.1.json
```

公式、推荐关系和依赖图通过 token 引用。

---

### 九、models.v0.1.json

顶层结构：

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "model_groups": [],
  "models": []
}
```

#### 1. model_group 记录

```json
{
  "model_group": "acceleration_performance",
  "display_name": "Acceleration Performance",
  "description": "Models related to longitudinal vehicle acceleration performance.",
  "status": "confirmed"
}
```

#### 2. model 记录

```json
{
  "model_name": "engine_limited_acceleration",
  "display_name": "Engine-limited acceleration",
  "model_group": "acceleration_performance",
  "description": "Longitudinal acceleration calculated from engine-generated tractive force, road-load terms, mass, and mass factor.",
  "status": "confirmed"
}
```

#### 3. v0.1 模型登记要求

至少登记：

```text
Tire size radius model
Powertrain speed relation
Engine power calculation
Engine tractive force at wheels
Mass factor approximation
Weight-to-mass relation
Engine-limited acceleration
Ideal constant-power acceleration
```

及其对应 model_group。

#### 4. 不在公式中保存 model_display_name

不采用：

```text
model_display_name
```

作为每条公式的重复字段。

原因：

```text
同一 model_name 未来可能存在多条 primary / alternative / validation 路径。
```

模型显示名称必须只维护一份。

---

### 十、单位 token 规则

机器单位 token 必须无歧义。

#### 1. v0.1 单位 token

| machine token              | UI 显示  | dimension     |
| -------------------------- | ------ | ------------- |
| `meter`                    | m      | length        |
| `millimeter`               | mm     | length        |
| `inch`                     | in     | length        |
| `meter_per_second`         | m/s    | speed         |
| `mile_per_hour`            | mph    | speed         |
| `kilometer_per_hour`       | km/h   | speed         |
| `radian_per_second`        | rad/s  | angular_speed |
| `revolution_per_minute`    | rpm    | angular_speed |
| `newton_meter`             | N·m    | torque        |
| `foot_pound_force`         | ft·lbf | torque        |
| `watt`                     | W      | power         |
| `kilowatt`                 | kW     | power         |
| `horsepower_mechanical`    | hp     | power         |
| `newton`                   | N      | force         |
| `kilonewton`               | kN     | force         |
| `pound_force`              | lbf    | force         |
| `kilogram`                 | kg     | mass          |
| `pound_mass`               | lbm    | mass          |
| `slug`                     | slug   | mass          |
| `meter_per_second_squared` | m/s²   | acceleration  |
| `foot_per_second_squared`  | ft/s²  | acceleration  |
| `standard_gravity`         | g      | acceleration  |
| `radian`                   | rad    | angle         |
| `degree`                   | deg    | angle         |
| `decimal`                  | —      | dimensionless |
| `percent`                  | %      | dimensionless |

---

#### 2. 禁止机器 token

不得使用：

```text
lb
g
HP
RPM
ft-lb
```

原因：

```text
lb 不区分质量和力
g 可能是变量 gravity，也可能是标准重力单位
HP / RPM 是显示缩写
ft-lb 可能被理解为能量或扭矩
```

特别说明：

```text
foot_pound_force 在 v0.1 中专门表示扭矩单位。
```

未来如果加入英制能量，应使用不同 token，例如：

```text
foot_pound_energy
```

---

### 十一、units.v0.1.json 结构

顶层：

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "units": []
}
```

每条单位记录至少包含：

```text
unit_id
display_symbol
dimension
canonical_si_unit
si_conversion
status
```

---

#### 1. 固定线性换算结构

换算公式：

```text
si_value = input_value × scale + offset
```

结构：

```json
{
  "type": "linear",
  "scale": 0.44704,
  "offset": 0
}
```

例如 mph：

```json
{
  "unit_id": "mile_per_hour",
  "display_symbol": "mph",
  "dimension": "speed",
  "canonical_si_unit": "meter_per_second",
  "si_conversion": {
    "type": "linear",
    "scale": 0.44704,
    "offset": 0
  },
  "status": "confirmed"
}
```

---

#### 2. 标准重力单位的常数引用

`standard_gravity` 与变量 `gravity` 表示同一标准重力数值。

为避免在两个文件中重复维护 `9.80665`，该单位使用常数引用：

```json
{
  "unit_id": "standard_gravity",
  "display_symbol": "g",
  "dimension": "acceleration",
  "canonical_si_unit": "meter_per_second_squared",
  "si_conversion": {
    "type": "constant_reference",
    "variable_id": "gravity"
  },
  "status": "confirmed"
}
```

换算时：

```text
1 standard_gravity
=
gravity.constant_value_si meter_per_second_squared
```

即 v0.1 中：

```text
1 standard_gravity = 9.80665 m/s²
```

这样 `9.80665` 只在变量常数记录中保存一次。

---

#### 3. v0.1 固定换算因子

| unit_id                    | canonical SI             |                scale |
| -------------------------- | ------------------------ | -------------------: |
| `meter`                    | meter                    |                    1 |
| `millimeter`               | meter                    |                0.001 |
| `inch`                     | meter                    |               0.0254 |
| `meter_per_second`         | meter_per_second         |                    1 |
| `mile_per_hour`            | meter_per_second         |              0.44704 |
| `kilometer_per_hour`       | meter_per_second         |   0.2777777777777778 |
| `radian_per_second`        | radian_per_second        |                    1 |
| `revolution_per_minute`    | radian_per_second        |  0.10471975511965977 |
| `newton_meter`             | newton_meter             |                    1 |
| `foot_pound_force`         | newton_meter             |   1.3558179483314004 |
| `watt`                     | watt                     |                    1 |
| `kilowatt`                 | watt                     |                 1000 |
| `horsepower_mechanical`    | watt                     |    745.6998715822702 |
| `newton`                   | newton                   |                    1 |
| `kilonewton`               | newton                   |                 1000 |
| `pound_force`              | newton                   |      4.4482216152605 |
| `kilogram`                 | kilogram                 |                    1 |
| `pound_mass`               | kilogram                 |           0.45359237 |
| `slug`                     | kilogram                 |    14.59390293720636 |
| `meter_per_second_squared` | meter_per_second_squared |                    1 |
| `foot_per_second_squared`  | meter_per_second_squared |               0.3048 |
| `radian`                   | radian                   |                    1 |
| `degree`                   | radian                   | 0.017453292519943295 |
| `decimal`                  | decimal                  |                    1 |
| `percent`                  | decimal                  |                 0.01 |

所有固定换算单位：

```text
offset = 0
```

v0.1 不涉及带非零 offset 的温度单位，但结构保留该能力。

---

#### 4. 单位文件校验

必须检查：

1. `unit_id` 唯一；
2. `canonical_si_unit` 存在；
3. unit dimension 与 canonical SI unit 一致；
4. `scale > 0`；
5. `constant_reference` 指向已存在的常数变量；
6. 被引用变量必须：

   ```text
   is_constant = true
   ```
7. 被引用常数的 dimension 必须与单位 dimension 一致；
8. 所有变量的 `internal_unit`、`default_unit`、`allowed_units` 必须存在于单位文件；
9. 所有公式的 `substitution_units` 和 `native_output_unit` 必须存在于单位文件。

---

### 十二、variables.v0.1.json 结构

顶层：

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "variables": []
}
```

每个变量至少包含：

```text
variable_id
name
symbol
category
description
dimension
internal_unit
default_unit
allowed_units
display_role
importance
normal_range
warning_range
invalid_range
valid_domain
can_be_user_input
unit_misuse_check
status
```

特殊变量按需增加：

```text
sign_convention
can_be_assumed
default_assumption
is_constant
constant_value_si
notes
```

---

### 十三、机器条件的统一结构

#### 1. 禁止裸条件数组

以下写法不得用于机器执行：

```json
[
  { "operator": "gt", "value": 0 },
  { "operator": "lt", "value": 10 }
]
```

原因：

```text
无法从数组本身判断是 AND 还是 OR。
```

所有可执行条件必须显式包装为：

```text
all
```

或：

```text
any
```

---

#### 2. AND 条件

全部条件必须满足：

```json
{
  "all": [
    {
      "variable": "vehicle_mass",
      "operator": "gt",
      "value": 0,
      "unit": "kilogram"
    },
    {
      "variable": "mass_factor",
      "operator": "gt",
      "value": 0,
      "unit": "decimal"
    }
  ]
}
```

适用于：

```text
formula_constraints
applicability_conditions.machine
```

---

#### 3. OR 条件

任一条件命中：

```json
{
  "any": [
    {
      "operator": "lte",
      "value": -90,
      "unit": "degree"
    },
    {
      "operator": "gte",
      "value": 90,
      "unit": "degree"
    }
  ]
}
```

适用于：

```text
invalid_range
```

因此：

```text
road_grade_angle <= -90°
或
road_grade_angle >= 90°
```

任一成立即判为无效。

---

#### 4. 嵌套规则

v0.1 允许：

```text
all 中包含 condition
any 中包含 condition
```

v0.1 暂不需要复杂的多层嵌套布尔表达式。

如以后需要：

```text
(A AND B) OR (C AND D)
```

必须升级 condition schema，不得用隐式数组猜测。

---

#### 5. `valid_domain` 的允许形态

`valid_domain` 可以是：

```text
单个 condition 对象
或显式 all / any 包装对象
```

单条件对象没有布尔歧义，因此不强制再包一层 `all`。`condition.schema.json` 必须同时允许这两种形态。

#### 6. 支持的 operator

```text
gt
gte
lt
lte
eq
neq
between
finite
not_finite
```

---

### 十四、范围语义

#### 1. normal_range

```text
典型工程范围
不触发警告
```

#### 2. warning_range

```text
较宽工程包络
位于 warning_range 内但不在 normal_range 内时触发 Warning
```

#### 3. 超出 warning_range

如果数值：

```text
不在 normal_range
不在 warning_range
未命中 invalid_range
```

则状态为：

```text
extreme_warning
```

处理：

```text
先执行单位误用检查
提示明显异常
允许用户确认继续
```

#### 4. invalid_range

结构必须为：

```text
any
```

语义：

```text
命中任一 invalid condition
→ 阻断依赖该值的公式分支
```

#### 5. 范围单位

每个范围必须显式包含 `unit`。

不得假设范围数值自动采用 `default_unit`。

---

### 十五、变量示例：road_grade_angle

```json
{
  "variable_id": "road_grade_angle",
  "name": "Road grade angle",
  "symbol": "θ",
  "category": "road_loads_external_forces",
  "description": "Road inclination angle, positive for an uphill grade.",
  "dimension": "angle",
  "internal_unit": "radian",
  "default_unit": "degree",
  "allowed_units": [
    "degree",
    "radian"
  ],
  "display_role": "assumption",
  "importance": "medium",
  "normal_range": {
    "min": -15,
    "max": 15,
    "unit": "degree",
    "min_inclusive": true,
    "max_inclusive": true
  },
  "warning_range": {
    "min": -45,
    "max": 45,
    "unit": "degree",
    "min_inclusive": true,
    "max_inclusive": true
  },
  "invalid_range": {
    "any": [
      {
        "operator": "lte",
        "value": -90,
        "unit": "degree"
      },
      {
        "operator": "gte",
        "value": 90,
        "unit": "degree"
      }
    ]
  },
  "valid_domain": {
    "operator": "between",
    "min": -1.5707963267948966,
    "max": 1.5707963267948966,
    "unit": "radian",
    "min_inclusive": false,
    "max_inclusive": false
  },
  "can_be_user_input": true,
  "can_be_assumed": true,
  "default_assumption": {
    "value": 0,
    "unit": "radian",
    "enabled_by_default": true,
    "meaning": "Level road"
  },
  "sign_convention": {
    "positive": "Uphill",
    "negative": "Downhill"
  },
  "unit_misuse_check": true,
  "is_constant": false,
  "status": "confirmed"
}
```

---

### 十六、变量示例：gravity

```json
{
  "variable_id": "gravity",
  "name": "Gravity",
  "symbol": "g",
  "category": "constants",
  "description": "Standard gravitational acceleration used to convert weight to mass.",
  "dimension": "acceleration",
  "internal_unit": "meter_per_second_squared",
  "default_unit": "meter_per_second_squared",
  "allowed_units": [
    "meter_per_second_squared",
    "foot_per_second_squared"
  ],
  "display_role": "constant",
  "importance": "low",
  "normal_range": {
    "min": 9.7,
    "max": 9.9,
    "unit": "meter_per_second_squared",
    "min_inclusive": true,
    "max_inclusive": true
  },
  "warning_range": {
    "min": 1,
    "max": 30,
    "unit": "meter_per_second_squared",
    "min_inclusive": true,
    "max_inclusive": true
  },
  "invalid_range": {
    "any": [
      {
        "operator": "lte",
        "value": 0,
        "unit": "meter_per_second_squared"
      }
    ]
  },
  "valid_domain": {
    "operator": "gt",
    "value": 0,
    "unit": "meter_per_second_squared"
  },
  "can_be_user_input": false,
  "can_be_assumed": false,
  "is_constant": true,
  "constant_value_si": 9.80665,
  "unit_misuse_check": false,
  "status": "confirmed",
  "notes": [
    "The course formula sheet uses the rounded value 9.805 m/s²."
  ]
}
```

---

### 十七、applicability_conditions 的分层

结构：

```json
{
  "machine": {
    "all": []
  },
  "descriptive": [
    "Constant-power approximation is acceptable for comparison."
  ]
}
```

规则：

1. `machine` 由引擎执行；
2. `descriptive` 只用于说明和人工审查；
3. `machine` 必须显式使用 `all` 或 `any`；
4. `required_inputs` 已负责输入是否存在；
5. 不得在 applicability 中重复写“某输入可用”；
6. `allowed_assumption_inputs` 已负责假设补齐权限；
7. 无法自动判断的模型条件放入 `descriptive`。

---

### 十八、formulas.v0.1.json 结构

顶层：

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "formulas": []
}
```

#### 1. 必填字段

每条公式必须包含：

```text
formula_id
name
description
source_reference
status

expression
calculation_expression
formula_type
computability
expression_unit_mode

required_inputs
output

model_group
model_name
path_role
priority

model_assumptions
allowed_assumption_inputs
applicability_conditions
formula_constraints
```

#### 2. 可选字段

```text
formula_family_id
model_type
substitution_units
native_output_unit
known_limitations
notes
```

规则：

```text
formula_family_id 保持 3.2 的可选定位。
known_limitations 和 notes 也保持 3.2 已确认的可选定位；只有存在明确限制或维护备注时才填写。
```

但：

```text
expression_unit_mode = source_native
```

时，以下字段变为条件必填：

```text
substitution_units
native_output_unit
```

#### 3. v0.1 当前情况

F001–F008 当前均有：

```text
formula_family_id
```

但 schema 不要求未来所有公式强制填写。

---

### 十九、expression 与 calculation_expression

#### 1. expression

用于人类展示：

```text
LaTeX 字符串
```

#### 2. calculation_expression

用于机器执行：

```text
只能使用正式 variable_id
```

例如：

```text
(tractive_force - aerodynamic_drag - rolling_resistance - vehicle_weight * sin(road_grade_angle) - hitch_force) / (mass_factor * vehicle_mass)
```

#### 3. v0.1 允许语法

```text
+
-
*
/
^
()
sin()
```

#### 4. 禁止事项

```text
禁止 JavaScript eval
禁止任意函数调用
禁止赋值
禁止访问浏览器或全局对象
禁止使用显示 symbol 作为变量名
```

必须使用受限表达式解析器。

---

### 二十、source_native 执行顺序

当：

```text
expression_unit_mode = source_native
```

引擎必须：

1. 从 Active 输入结果取得内部单位值；
2. 按 `substitution_units` 换算；
3. 代入 `calculation_expression`；
4. 将结果解释为 `native_output_unit`；
5. 换算为输出变量的 `internal_unit`；
6. 写入 Derived 结果对象；
7. 在推导详情中显示单位换算。

当：

```text
expression_unit_mode = si_consistent
```

则：

```text
输入使用各变量 internal_unit
输出解释为 output 的 internal_unit
```

---

### 二十一、公式示例：F003

```json
{
  "formula_id": "F003_engine_power_from_torque_rpm",
  "formula_family_id": "engine_power",
  "name": "Engine power from torque and engine speed",
  "description": "Calculates engine mechanical power from torque and engine speed using the course formula-sheet horsepower relation.",
  "source_reference": [
    {
      "source_id": "S001_vehicle_dynamics_formulae",
      "locator": "Ch 2 - Acceleration Performance",
      "note": "HP = T × RPM / 5252"
    }
  ],
  "status": "confirmed",
  "expression": "HP = \\frac{T_e \\cdot RPM}{5252}",
  "calculation_expression": "(engine_torque * engine_speed) / 5252",
  "formula_type": "algebraic",
  "computability": "direct",
  "expression_unit_mode": "source_native",
  "substitution_units": {
    "engine_torque": "foot_pound_force",
    "engine_speed": "revolution_per_minute"
  },
  "native_output_unit": "horsepower_mechanical",
  "required_inputs": [
    "engine_torque",
    "engine_speed"
  ],
  "output": "engine_power",
  "model_group": "acceleration_performance",
  "model_name": "engine_power_calculation",
  "model_type": "definition",
  "path_role": "primary",
  "priority": 10,
  "model_assumptions": [
    "Torque and engine speed refer to the same operating point."
  ],
  "allowed_assumption_inputs": [],
  "applicability_conditions": {
    "machine": {
      "all": []
    },
    "descriptive": []
  },
  "formula_constraints": {
    "all": [
      {
        "variable": "engine_torque",
        "operator": "gte",
        "value": 0,
        "unit": "newton_meter"
      },
      {
        "variable": "engine_speed",
        "operator": "gte",
        "value": 0,
        "unit": "radian_per_second"
      }
    ]
  },
  "known_limitations": [
    "The denominator 5252 is a rounded course formula-sheet constant."
  ],
  "notes": [
    "Do not substitute SI torque and angular-speed values directly into the source-native expression."
  ]
}
```

---

### 二十二、公式示例：F007

```json
{
  "formula_id": "F007_engine_limited_acceleration",
  "formula_family_id": "engine_limited_acceleration",
  "name": "Engine-limited longitudinal acceleration",
  "description": "Calculates longitudinal acceleration from tractive force, road-load terms, vehicle mass, vehicle weight, and mass factor.",
  "source_reference": [
    {
      "source_id": "S001_vehicle_dynamics_formulae",
      "locator": "Ch 2 - Acceleration Performance",
      "note": "M_f M a_x = F_x - D_A - R_x - W sin(theta) - R_hx"
    }
  ],
  "status": "confirmed",
  "expression": "a_x = \\frac{F_x-D_A-R_x-W\\sin\\theta-R_{hx}}{M_fM}",
  "calculation_expression": "(tractive_force - aerodynamic_drag - rolling_resistance - vehicle_weight * sin(road_grade_angle) - hitch_force) / (mass_factor * vehicle_mass)",
  "formula_type": "algebraic",
  "computability": "direct",
  "expression_unit_mode": "si_consistent",
  "required_inputs": [
    "tractive_force",
    "aerodynamic_drag",
    "rolling_resistance",
    "vehicle_weight",
    "road_grade_angle",
    "hitch_force",
    "mass_factor",
    "vehicle_mass"
  ],
  "output": "longitudinal_acceleration",
  "model_group": "acceleration_performance",
  "model_name": "engine_limited_acceleration",
  "model_type": "force_balance",
  "path_role": "primary",
  "priority": 10,
  "model_assumptions": [
    "Mass factor approximates rotating inertia.",
    "Traction limit is not checked in v0.1.",
    "Road-load terms may be supplied by user input or allowed assumptions."
  ],
  "allowed_assumption_inputs": [
    "aerodynamic_drag",
    "rolling_resistance",
    "road_grade_angle",
    "hitch_force"
  ],
  "applicability_conditions": {
    "machine": {
      "all": []
    },
    "descriptive": [
      "The vehicle is evaluated at a specified operating point."
    ]
  },
  "formula_constraints": {
    "all": [
      {
        "variable": "vehicle_mass",
        "operator": "gt",
        "value": 0,
        "unit": "kilogram"
      },
      {
        "variable": "mass_factor",
        "operator": "gt",
        "value": 0,
        "unit": "decimal"
      }
    ]
  },
  "known_limitations": [
    "No tire traction-limit check is included.",
    "Speed-dependent road loads are not calculated in v0.1."
  ],
  "notes": [
    "Vehicle weight and vehicle mass are separate inputs in this equation.",
    "Default assumption values are stored only in variable metadata."
  ]
}
```

---

### 二十三、F008 的课程证据与低速备注

F008 的 `source_reference` 应同时包含：

```text
公式表或教材来源
课堂字幕来源
```

示例：

```json
"source_reference": [
  {
    "source_id": "S001_vehicle_dynamics_formulae",
    "locator": "Ch 2 - Acceleration Performance",
    "note": "a_x = 550(g/V)(HP/W)"
  },
  {
    "source_id": "S003_course_subtitles",
    "locator": "16:38-19:06",
    "note": "The instructor derives ideal engine acceleration directly from engine horsepower."
  },
  {
    "source_id": "S003_course_subtitles",
    "locator": "1:07:08-1:08:47",
    "note": "The instructor plots from 10 mph, identifies the zero-speed singularity as absurd, and states that values above approximately 0.8 g are suspicious at low speed."
  }
]
```

`known_limitations` 必须包括：

```text
The ideal constant-power model is singular as vehicle speed approaches zero.
The course plot begins at 10 mph.
Low-speed acceleration above approximately 0.8 standard gravity is identified by the instructor as suspicious.
The final warning or applicability rule is deferred to the Unit and Engineering Safety stage.
```

---

### 二十四、recommendations.v0.1.json

顶层：

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "recommendations": []
}
```

R001：

```json
{
  "recommendation_id": "R001_longitudinal_acceleration_recommended_model",
  "output": "longitudinal_acceleration",
  "model_group": "acceleration_performance",
  "recommended_model_name": "engine_limited_acceleration",
  "applicability_reference": {
    "formula_id": "F007_engine_limited_acceleration",
    "require": [
      "computability",
      "required_inputs",
      "applicability_conditions",
      "formula_constraints"
    ]
  },
  "recommendation_reason": [
    "The model directly uses wheel tractive force, mass factor, and road-load terms.",
    "It is the primary model in the selected v0.1 formula chain.",
    "It exercises assumptions, missing-condition reporting, and recursive derivation.",
    "The ideal constant-power model is intended as a different-model comparison."
  ],
  "fallback_behavior": {
    "automatic_switch": false,
    "mode": "require_user_selection",
    "alternative_models": [
      "ideal_constant_power_acceleration"
    ],
    "message": "The recommended model is unavailable. Select another model explicitly to continue."
  },
  "status": "confirmed"
}
```

推荐条件不复制 F007 的详细条件。

---

### 二十五、sources.v0.1.json

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "sources": [
    {
      "source_id": "S001_vehicle_dynamics_formulae",
      "title": "Vehicle Dynamics Formulae",
      "type": "formula_sheet",
      "file_name": "Vehicle Dynamics Formulae.pdf",
      "status": "confirmed"
    },
    {
      "source_id": "S002_fundamentals_vehicle_dynamics",
      "title": "Fundamentals of Vehicle Dynamics, Revised Edition",
      "type": "textbook",
      "file_name": "Fundamentals of Vehicle Dynamics, Revised Edition.pdf",
      "status": "confirmed"
    },
    {
      "source_id": "S003_course_subtitles",
      "title": "Vehicle Dynamics Course Subtitles",
      "type": "course_transcript",
      "file_name": "字幕.txt",
      "status": "confirmed"
    }
  ]
}
```

---

### 二十六、engine-config.v0.1.json

```json
{
  "schema_version": "1.0.0",
  "data_version": "0.1.0",
  "internal_unit_system": "SI",
  "allow_automatic_algebraic_inversion": false,
  "dependency_graph_source": "derive_from_formulas",
  "max_reverse_formula_depth": 5,
  "reverse_depth_counts": "formula_nodes_only",
  "importance_order": [
    "critical",
    "high",
    "medium",
    "low"
  ],
  "path_roles": [
    "primary",
    "alternative",
    "validation",
    "reference"
  ],
  "range_semantics": {
    "normal": "no_warning",
    "warning": "warning_requires_attention",
    "outside_warning_but_not_invalid": "extreme_warning_user_may_confirm",
    "invalid": "block_dependent_branch"
  },
  "condition_semantics": {
    "formula_constraints": "explicit_all",
    "applicability_machine": "explicit_all_or_any",
    "invalid_range": "explicit_any",
    "valid_domain": "single_condition_or_explicit_all_or_any",
    "bare_condition_arrays_allowed": false
  },
  "user_input_default_active": true,
  "reference_paths_can_be_active": false
}
```

---

### 二十七、依赖图生成规则

依赖图不单独手工维护。

对每条公式：

```text
required_inputs 中每个 variable_id：
变量 → 公式

output：
公式 → 变量
```

模型显示信息通过：

```text
model_name → models.v0.1.json
```

查询。

推荐模型记录单独形成：

```text
模型限定结果 → recommendation → Active 选择
```

生成后必须执行：

```text
引用完整性检查
DAG 检查
孤立公式检查
未知 variable_id 检查
未知 model_name 检查
重复 formula_id 检查
```

ASCII 图仅作示意。

---

### 二十八、自动校验规则

#### 1. Catalog 校验

1. `catalog_id` 唯一且为非空 snake_case token；
2. `files` 中的 `path` 不得重复；
3. 所有 `required = true` 的路径必须存在；
4. 如提供 `schema_path`，对应 Schema 必须存在；
5. Catalog 不得复制变量、公式或单位业务数据。

#### 2. 变量校验

1. `variable_id` 唯一；
2. `internal_unit` 与 dimension 匹配；
3. `default_unit` 必须在 `allowed_units` 中；
4. 所有单位必须存在于 `units.v0.1.json`；
5. range 单位必须与变量 dimension 匹配；
6. `can_be_assumed = true` 时必须有 `default_assumption`；
7. `is_constant = true` 时必须有 `constant_value_si`；
8. 常数不得允许用户输入；
9. `invalid_range` 必须使用 `any`；
10. `status` 必须是合法枚举。

#### 3. 公式校验

1. `formula_id` 唯一；
2. `required_inputs` 中所有 variable_id 必须存在；
3. `output` 必须存在；
4. `output` 必须是单个字符串；
5. `model_group` 和 `model_name` 必须存在于模型登记表；
6. `allowed_assumption_inputs` 必须是 `required_inputs` 的子集；
7. 对应变量必须允许假设；
8. `source_native` 必须有 `substitution_units`；
9. `source_native` 必须有 `native_output_unit`；
10. substitution 和 output 单位必须存在；
11. `calculation_expression` 中变量必须全部来自 `required_inputs`；
12. 不得引用显示 symbol；
13. `formula_constraints` 必须使用显式 `all`；v0.1 不允许 OR 型公式约束；
14. constraints 引用变量必须属于 `required_inputs`；
15. recommendation 引用的模型和公式必须存在；
16. `formula_family_id` 可省略；
17. 如存在 `formula_family_id`，必须是非空 snake_case token。

#### 4. 模型校验

1. `model_group` 唯一；
2. `model_name` 唯一；
3. 每个 model 必须引用已登记 model_group；
4. `display_name` 不得为空；
5. 公式引用的模型必须存在。

#### 5. 单位校验

1. `unit_id` 唯一；
2. dimension 合法；
3. canonical SI unit 合法；
4. linear scale 必须大于 0；
5. constant reference 必须指向匹配维度的常数；
6. 所有变量和公式单位引用必须可解析。

#### 6. 图校验

1. v0.1 图必须为 DAG；
2. F007 和 F008 必须保留为不同模型结果；
3. R001 不得被识别为数值公式；
4. 依赖图不得读取 ASCII 文本。

---

### 二十九、版本规则

#### schema_version

表示结构变化。

例如：

```text
1.0.0
```

以下变化需要更新 schema version：

```text
新增必填字段
删除字段
字段类型改变
条件语义改变
ID 语义改变
```

#### data_version

表示内容变化。

例如：

```text
0.1.0
```

以下变化更新 data version：

```text
公式内容
变量范围
来源定位
模型说明
notes
换算因子
```

兼容原则：

```text
同一兼容 schema_version 下，开发代码应能读取对应 data_version。
```

---

### 三十、第三阶段收尾生产步骤

#### 1. 格式确认

先确认本 3.10 文档中的：

```text
文件划分
字段结构
条件语义
单位结构
模型登记方式
校验规则
```

#### 2. 生成实际文件

格式确认后，根据：

```text
3.6 已确认公式清单
3.7 已确认变量清单
3.9 已确认疑义处理
3.10 ✅ 已完成数据格式
```

生成：

```text
全部 data JSON
全部 JSON Schema
全部 generated Markdown
validation report
```

#### 3. 分工

```text
ChatGPT：
生成全部实际数据文件、Schema 和生成文档初稿

用户：
对照 3.6、3.7、3.9 已确认内容逐条核对

开发工具：
执行 JSON Schema 校验、引用完整性校验和 DAG 校验
```

#### 4. 节点完成条件

3.10 ✅ 已完成。

必须同时满足：

```text
格式规则已确认
实际文件已生成
用户核对通过
自动校验通过
不存在 blocking 错误
```

然后才能标记：

```text
3.10 ✅ 已完成
```

该生产步骤属于 3.10 的收尾动作，不新增第一层或第二层树节点。

---

### 三十一、开发交付清单

第三阶段最终应交付：

```text
catalog.meta.json
variables.v0.1.json
formulas.v0.1.json
models.v0.1.json
recommendations.v0.1.json
sources.v0.1.json
units.v0.1.json
engine-config.v0.1.json

对应 JSON Schema

VARIABLES.generated.md
FORMULAS.generated.md
MODELS.generated.md
DEPENDENCIES.generated.md

validation-report.v0.1.json
```

不得直接以以下内容作为运行时数据库：

```text
TXT 讨论记录
手工 Markdown 表格
ASCII 依赖图
课堂字幕全文
PDF 解析文本
```

这些只作为设计记录和来源证据。

---

### 三十二、3.10 最终建议结论

v0.1 开发数据采用：

```text
严格 JSON
+ JSON Schema
+ 独立变量数据
+ 独立公式数据
+ 独立模型登记表
+ 独立推荐模型数据
+ 独立来源登记表
+ 带换算语义的单位登记表
+ 显式 all / any 条件结构
+ 受限 calculation_expression
+ 自动生成依赖图和 Markdown
+ 自动校验报告
```

权威关系：

```text
variables JSON
+ formulas JSON
+ models JSON
+ recommendations JSON
+ sources JSON
+ units JSON
+ engine config JSON
        ↓
Schema 和跨文件校验
        ↓
自动生成依赖图与文档
        ↓
开发引擎读取
```

本格式解决：

1. 同一信息重复维护；
2. 默认假设重复；
3. 推荐模型放错层级；
4. 模型 token 与显示名称混淆；
5. 单位 token 和换算因子缺失；
6. `gravity` 与 `standard_gravity` 混淆；
7. `lb`、`lbf`、`lbm` 混淆；
8. AND / OR 条件语义不明确；
9. 自由文本条件无法执行；
10. 显示表达式与机器表达式混淆；
11. ASCII 图被误作程序定义；
12. 公式扩展后无法自动验证引用；
13. 开发代码依赖旧编号或硬编码顺序；
14. 格式确认后没有实际数据生产负责人；
15. 新对话无法判断哪个文件是权威来源。

---

### 第三阶段实际交付结果

实际数据包已经生成、通过 Schema 与跨文件校验，并提交至 GitHub：

```text
commit: 07a3b89
message: restructure: add Phase 3 v0.1 data package, retire legacy prototype
```

交付结果包括：

```text
8 个权威数据 JSON
9 个 JSON Schema
4 个自动生成 Markdown
1 个 validation report
```

校验结果：

```text
JSON Schema：通过
跨文件引用：通过
单位与量纲：通过
source_native 单位：通过
公式表达式变量：通过
推荐模型引用：通过
依赖图 DAG：通过
最大公式深度：3
反向搜索上限：5
```

### 三十三、节点状态

```text
3.10 ✅ 已完成

```


---
