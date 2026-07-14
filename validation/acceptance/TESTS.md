# TESTS — 验收套件 v0.1（公开侧说明页）

数据文件：**cases.v0.1.json**（本目录，唯一公共用例数据源）。独立复核脚本：**validation/tools/cross_check.py**。

Source: *derived from instructor-verified coursework of a graduate vehicle-dynamics course; provenance records kept privately.*

## 规模

- 8 个匿名用例（A1–A8）：数值判定用例 6（A1、A2、A3、A4、A6、A8），行为断言用例 1（A5），只存不判用例 1（A7，待低速阈值政策）。
- 数值判定值 24 项；行为断言 2 项（可达性诊断 + 缺输入清单）。
- 覆盖：F001×4、F002×3、F003×2、F004×3、F005×3、F006×4、F007×4（另 A5 负向诊断）、F008×1（另 A7 低速存档点）。

## 验收语义（总则九条）

1. **运行/池语义**：每用例定义 Run（全局输入 + 段追加）；每个 Run 为一次独立求解；池内同一变量至多一个用户输入值。
2. **判定 = 子集匹配**：期望值列表所列值须在容差内命中；引擎额外派生的未列值不构成失败。该语义顺延至行为断言用例的缺输入诊断——列出多于最低要求的缺失项不构成失败。
3. **容差**：全局相对 1%（`tolerance_default`）。铁律——任何冲突不得通过放宽容差解决。
4. **零/近零期望值**（备用政策）：期望值为 0 或近零时改用绝对容差，数值由维护者逐例确认；当前套件无适用例。
5. **F008 低速阈值**：属后续工作支（第 5 支）政策，未启用前 A7 只存不判。
6. **常量**：gravity 为注册常量（is_constant = true、can_be_user_input = false），不得出现在输入表；期望值按惯用值 g = 32.2 ft/s² 推得，与注册常量（折 32.174 ft/s²）的差异计入容差。
7. **降级直接输入**：注册范围外公式的产物一律以直接输入形式给出（如 A3 的 engine_torque、aerodynamic_drag、rolling_resistance），不要求引擎复算其来源。
8. **单位**：cases.v0.1.json 仅使用注册单位的 ASCII 记法（"-" = 无量纲），按 data/units.v0.1.json 解析；未注册单位不出现在公共侧。
9. **权威与复核**：期望值经人工评审与独立脚本双重复核后定判；判定口径的裁决与出处记录留私档。

## 独立复核结果（2026-07-13）

cross_check.py：纯 Python 标准库，独立于 JS 引擎实现；以注册公式英制原生形从各用例输入直接重算期望值；重力用注册常量折 32.17405 ft/s²；任何 FAIL 退出码非零。

**23/23 PASS，FAIL = 0**（最大偏差 A4-2 0.583%）：

```
======================================================================
A1-a  wheel_radius [in]     got=    13.16339  exp=   13.1600  dev= 0.026%  PASS
A1-a  vehicle_speed [mph]   got=   137.49856  exp=  137.5000  dev= 0.001%  PASS
A1-a  engine_power [HP]     got=   103.90937  exp=  103.9000  dev= 0.009%  PASS
A1-b  tractive_force [lb]   got=  2339.94509  exp= 2339.9500  dev= 0.000%  PASS
A1-b  mass_factor [-]       got=     1.56250  exp=    1.5625  dev= 0.000%  PASS
A1-b  vehicle_mass [slug]   got=   114.56438  exp=  114.4720  dev= 0.081%  PASS
A1-b  long_accel [ft/s2]    got=    13.07182  exp=   13.0800  dev= 0.063%  PASS
A1-c1  vehicle_speed [mph]  got=    41.77171  exp=   41.7700  dev= 0.004%  PASS
A1-c2  vehicle_speed [mph]  got=    50.47415  exp=   50.4700  dev= 0.008%  PASS
A2  wheel_radius [in]       got=    16.20079  exp=   16.2000  dev= 0.005%  PASS
A2  vehicle_mass [slug]     got=   447.87649  exp=  447.5200  dev= 0.080%  PASS
A3  tractive_force [lb]     got=  1384.20445  exp= 1384.4290  dev= 0.016%  PASS
A3  mass_factor [-]         got=     1.17141  exp=    1.1714  dev= 0.000%  PASS
A3  vehicle_mass [slug]     got=   447.87649  exp=  447.5160  dev= 0.081%  PASS
A3  long_accel [ft/s2]      got=     0.31977  exp=    0.3190  dev= 0.240%  PASS
A4-1  wheel_radius [in]     got=    13.81496  exp=   13.8200  dev= 0.036%  PASS
A4-1  tractive_force [lb]   got=   336.15637  exp=  336.2300  dev= 0.022%  PASS
A4-1  mass_factor [-]       got=     1.11186  exp=    1.1100  dev= 0.167%  PASS
A4-1  vehicle_mass [slug]   got=   108.78333  exp=  108.7000  dev= 0.077%  PASS
A4-1  long_accel [ft/s2]    got=     2.77926  exp=    2.7800  dev= 0.026%  PASS
A4-2  long_accel [ft/s2]    got=    -0.10964  exp=   -0.1090  dev= 0.583%  PASS
A6  long_accel [ft/s2]      got=     2.47540  exp=    2.4750  dev= 0.016%  PASS
A8  engine_power [HP]       got=   283.32064  exp=  283.3000  dev= 0.007%  PASS
======================================================================
行为断言/无判定值用例（脚本不判）：A5（候选路径+缺输入清单断言）、A7（低速只存不判，待第 5 支阈值政策）
合计 23 项判定，FAIL = 0
```

## 引擎实测结果（第 4 支 M6 追加，2026-07-14；本章 append-only，上文未改动）

引擎实现：`engine/`（M0 `9aa91bf` → M1 `4bd2555` → M2 `f1b775a` → M3 `7f3e771` + 修正 `274bd1e` → M4 `59c3531` → M5 `5db4579` → M6 本章随之提交）。环境：Node v24.18.0 / Python 3.11.9。一键全跑入口：`node engine/tests/run.js`。

### 汇总

- 机制单元测试（M0–M5，六个模块）：**83/83 通过**。
- 数值判定：**24/24 PASS，FAIL = 0**（公共 cases 全量 24 项；其中 23 项与 cross_check.py 逐项对账一致，另 1 项 A3 wheel_radius 为 cases-only duplicate judgment，cross_check 未复查该与 A2 同值的重复判定）。
- 行为断言（A5，2 项）：可达性诊断 PASS（tractive_force 与 longitudinal_acceleration 均 not_computable_in_pool；tractive_force 仅返回 F004——F007 的 a_x=0 反解未注册故不出现）；diagnostics_minimum 子集 PASS（F004 缺输入 ⊇ [engine_torque]，实报 engine_torque, combined_gear_ratio, drivetrain_efficiency, wheel_radius；F007 缺输入 ⊇ [tractive_force, mass_factor]，实报恰为两者）。
- A7 只存不判：longitudinal_acceleration = 20.74878 m/s²（F008，active=false，仅存档；待第 5 支低速阈值政策）。
- validate_catalog.py 回归（裸数组约束）：PASS（exit 1、结构化错误、无 traceback）。
- 浏览器 ES Module smoke（/engine/smoke.html，静态服务仓库根）：PASS（fetch reader 加载 catalog 0 诊断；solve ok；engine_power = 283.32064 hp；反向查询 not_computable_in_pool、2 候选路径）。
- 一键闸门总判：**ALL GREEN**。

### 数值判定全文（引擎跑器输出）

```
A1-a  wheel_radius [in]                   got=    13.16339  exp=   13.1600  dev= 0.026%  PASS
A1-a  vehicle_speed [mph]                 got=   137.49856  exp=  137.5000  dev= 0.001%  PASS
A1-a  engine_power [HP]                   got=   103.90937  exp=  103.9000  dev= 0.009%  PASS
A1-b  tractive_force [lb]                 got=  2339.94509  exp= 2339.9500  dev= 0.000%  PASS
A1-b  mass_factor [-]                     got=     1.56250  exp=    1.5625  dev= 0.000%  PASS
A1-b  vehicle_mass [slug]                 got=   114.56438  exp=  114.4720  dev= 0.081%  PASS
A1-b  longitudinal_acceleration [ft/s^2]  got=    13.07182  exp=   13.0800  dev= 0.063%  PASS
A1-c1  vehicle_speed [mph]                got=    41.77171  exp=   41.7700  dev= 0.004%  PASS
A1-c2  vehicle_speed [mph]                got=    50.47415  exp=   50.4700  dev= 0.008%  PASS
A2  wheel_radius [in]                     got=    16.20079  exp=   16.2000  dev= 0.005%  PASS
A2  vehicle_mass [slug]                   got=   447.87649  exp=  447.5200  dev= 0.080%  PASS
A3  wheel_radius [in]                     got=    16.20079  exp=   16.2000  dev= 0.005%  PASS
A3  tractive_force [lb]                   got=  1384.20445  exp= 1384.4290  dev= 0.016%  PASS
A3  mass_factor [-]                       got=     1.17141  exp=    1.1714  dev= 0.000%  PASS
A3  vehicle_mass [slug]                   got=   447.87649  exp=  447.5160  dev= 0.081%  PASS
A3  longitudinal_acceleration [ft/s^2]    got=     0.31978  exp=    0.3190  dev= 0.243%  PASS
A4-1  wheel_radius [in]                   got=    13.81496  exp=   13.8200  dev= 0.036%  PASS
A4-1  tractive_force [lb]                 got=   336.15637  exp=  336.2300  dev= 0.022%  PASS
A4-1  mass_factor [-]                     got=     1.11186  exp=    1.1100  dev= 0.167%  PASS
A4-1  vehicle_mass [slug]                 got=   108.78333  exp=  108.7000  dev= 0.077%  PASS
A4-1  longitudinal_acceleration [ft/s^2]  got=     2.77926  exp=    2.7800  dev= 0.026%  PASS
A4-2  longitudinal_acceleration [ft/s^2]  got=    -0.10964  exp=   -0.1090  dev= 0.583%  PASS
A6  longitudinal_acceleration [ft/s^2]    got=     2.47540  exp=    2.4750  dev= 0.016%  PASS
A8  engine_power [HP]                     got=   283.32064  exp=  283.3000  dev= 0.007%  PASS
numeric: 24 judged, FAIL = 0
```

### 24↔23 对账表（引擎 ↔ cross_check.py，逐项）

cross_check 全部 23 项均有唯一引擎对应项，判定标签全部一致（双 PASS）；got 值除 A3 longitudinal_acceleration 外逐位一致（0.31978 vs 0.31977：脚本用 atan(0.05) 全精度，题库输入为 0.049958 rad，两者均在容差内、判定一致）。第 24 项：

```
A3 wheel_radius [in]  —  cases-only duplicate judgment（引擎 PASS；cross_check 未单列该与 A2 同输入同值的重复判定）
```

处理口径照检查点一评审：公共 cases 数据 24 项全部运行；cross_check 23 项逐项对应；A3 wheel_radius 单列，不删除。

### 差异与备注

- A3 longitudinal_acceleration 引擎偏差 0.243%（脚本 0.240%）：来源同上（atan 精度 vs 题库截断输入），容差铁律未动。
- A5 缺输入清单按子集语义判定：引擎对 F004 额外列出 wheel_radius 等真实缺失项，不构成失败。
- 本章为第 4 支交付时的实测存档；后续里程碑如再追加实测，续写于本章之后，不改动既有内容。
