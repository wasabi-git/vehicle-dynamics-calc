# Vehicle Dynamics — Variable Table

> Version: 3.0 | Phase 2 final
> **b/c 已按课堂字幕确认修正**：b = 前轴到质心，c = 质心到后轴
> 代码中引用变量必须使用唯一 ID，不得直接用符号（避免跨章节冲突）。

---

## 全局变量（跨章节共用）

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 正常范围（US）| 来源章节 |
|----|------|------|------|---------|---------|--------------|---------|
| V001 | W | 整车重量 | Force | N | lb | 1500–8000 lb | Ch 1–9 |
| V002 | L | 轴距（wheelbase） | Length | m | ft | 7–14 ft | Ch 1–7 |
| **V003** | **b** | **前轴到质心距离** | Length | m | ft | 0.3L–0.6L | Ch 1/2/5/7 |
| **V004** | **c** | **质心到后轴距离** | Length | m | ft | 0.4L–0.7L | Ch 1/2/5 |
| V005 | h | CG 离地高度 | Length | m | ft | 1.0–3.5 ft | Ch 1–9 |
| V006 | g | 重力加速度（代码统一：9.80665 m/s²） | Accel | m/s² | ft/s² | 9.80665 m/s² = 32.174 ft/s² | All |
| V007 | a_x | 纵向加速度 | Accel | m/s² | ft/s² or g | −1.2 g ~ +0.5 g | Ch 1/2/3 |
| V008 | a_y | 横向加速度 | Accel | m/s² | ft/s² or g | 0–0.85 g（正常转弯）| Ch 6/9 |
| V009 | r_w | 轮胎规格理论半径（nominal unloaded radius） | Length | m | ft or in | 10–18 in | Ch 2/3/5/7 |
| V010 | V | 整车速度 | Velocity | m/s | mph or ft/s | 0–150 mph | Ch 2–6/9 |
| V011 | D_A | 气动阻力 | Force | N | lb | 0–300 lb @ 60 mph | Ch 1–4 |
| V012 | R_x | 总滚动阻力 | Force | N | lb | 0–100 lb | Ch 2/4 |
| V013 | theta | 坡度角 | Angle | rad | rad or % | −15%~+15% grade | Ch 1/2/4 |
| V014 | W_f | 前轴动态载荷 | Force | N | lb | 0–W | Ch 1/2/3/6 |
| V015 | W_r | 后轴动态载荷 | Force | N | lb | 0–W | Ch 1/2/3/6 |
| V016 | W_fs | 前轴静态载荷 | Force | N | lb | 0.3W–0.6W | Ch 1/3/6 |
| V017 | W_rs | 后轴静态载荷 | Force | N | lb | 0.4W–0.7W | Ch 1/3/6 |
| V018 | mu | 峰值路面摩擦系数 | Dimensionless | — | — | 0.3（冰）–1.1（赛道）| Ch 2/3 |

> **V003/V004 说明**（字幕原话约 28:36–37:55）：
> - **b（V003）= 前轴到质心** → W_rs 使用 b，因为 b 越大代表 CG 越靠近后轴，后轴承重越多
> - **c（V004）= 质心到后轴** → W_fs 使用 c，因为 c 越大代表 CG 越靠近前轴，前轴承重越多
> - 约束：b + c = L

> **V006 说明**：代码内部统一使用 $g_0 = 9.80665\ \text{m/s}^2$（标准重力加速度）。
> 显示时可转换为 32.174 ft/s²。课程原始近似 "32.2 ft/s²" 仅用于来源标注，不用于计算。

> **V009 说明**：F201 计算的是**规格理论半径**（nominal radius = 未加载几何半径），
> 不等于实际滚动半径（effective rolling radius，受载荷/胎压影响）。
> v0.1 将两者近似等同，需在代码注释中明确标注此近似。

---

## Ch 1 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 正常范围（US）|
|----|------|------|------|---------|---------|--------------|
| V101 | R_hx | 挂钩水平拉力 | Force | N | lb | 0–5000 lb |
| V102 | R_zh | 挂钩竖向力（舌重） | Force | N | lb | −2000–2000 lb |
| V103 | h_h | 挂钩离地高度 | Length | m | ft | 1–3 ft |
| V104 | d_h | 挂钩距后轴水平距离 | Length | m | ft | 0–8 ft |
| V105 | h_a | 气动阻力中心离地高度 | Length | m | ft | 1–4 ft |

---

## Ch 2 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 正常范围（US）| 备注 |
|----|------|------|------|---------|---------|--------------|------|
| V201 | T_e | 发动机输出扭矩 | Torque | N·m | ft·lb | 50–1000 ft·lb | |
| V202 | N_tf | 总传动比（= N_T × N_F） | Dimensionless | — | — | 2.5–20 | |
| V203 | eta_tf | 传动系效率 | Dimensionless | — | — | 0.82–0.97 | |
| V204 | omega_e | 发动机角速度 | Ang vel | rad/s | RPM | 600–8000 RPM（ICE）| 1 RPM = 2π/60 rad/s |
| V205 | omega_w | 车轮角速度 | Ang vel | rad/s | rad/s | 0–200 rad/s | |
| V206 | P_engine | 发动机功率（SI 内部存储 W，显示换算 hp/kW）| Power | **W** | hp or kW | 37,000–746,000 W（50–1000 hp）| 代码内部统一 W；HP = P/745.7 |
| V207 | M_f | 质量因子（mass factor） | Dimensionless | — | — | 1.05–1.5 | F206 计算 |
| V208 | M | 整车质量（M = W/g） | Mass | kg | slug | 62–248 slug | ⚠️ Ch 5 中 M = 簧载质量，见 V507 |
| V209 | F_x | **发动机限制**牵引力（F205 输出）| Force | N | lb | 0–F_xmax | 不等于 F_xmax |
| V210 | t | 轮距（左右轮心距） | Length | m | ft | 4–6 ft | ⚠️ Ch 6 分前后 t_f/t_r |
| V211 | N_f | **最终传动比**（final drive ratio，差速器）| Dimensionless | — | — | 2.5–5.0 | $N_{tf} = N_t \times N_f$；F210 仅用 $N_f$ |
| V212 | K_phi_f | 前悬架侧倾刚度（F210 用）| Torque/rad | N·m/rad | ft·lb/rad | — | |
| V213 | K_phi_total | 总侧倾刚度（F210 用）| Torque/rad | N·m/rad | ft·lb/rad | — | |
| V214 | F_xmax | **附着极限**牵引力（F209–F211 输出）| Force | N | lb | — | 与 V209 不同物理量，推导引擎分别保存 |
| V221 | tire_width | 轮胎断面宽度 | Length | mm | mm | 155–335 mm | 轮胎规格输入 |
| V222 | tire_aspect | 轮胎扁平比 | % | % | % | 30–80% | 轮胎规格输入 |
| V223 | rim_dia | 轮辋直径 | Length | in | in | 14–22 in | 轮胎规格输入 |

---

## Ch 3 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 正常范围（US）|
|----|------|------|------|---------|---------|--------------|
| V301 | F_pedal | 踏板力 | Force | N | lb | 10–120 lb |
| V302 | pedal_ratio | 踏板杠杆比 | Dimensionless | — | — | 3–6 |
| V303 | D_mc | 主缸孔径 | Length | mm | in | 0.75–1.25 in |
| V304 | p_mc | 主缸压力 | Pressure | kPa | psi | 0–1500 psi |
| V305 | K_boost_100 | 制动助力标定系数（100 lbf 踏板力对应的主缸压力）✅ D014 | Pressure | kPa | **psi** | 800–2000 psi（典型）|
| V306 | p_af | 前轴制动压力 | Pressure | kPa | psi | = p_mc |
| V307 | p_ar | 后轴制动压力 | Pressure | kPa | psi | ≤ p_mc |
| V308 | p_pv | 比例阀阈值压力 | Pressure | kPa | psi | 200–600 psi |
| V309 | k_pv | 比例阀斜率 | Dimensionless | — | — | 0.2–0.5 |
| V310 | D_wcyl | 制动轮缸孔径 | Length | mm | in | 1–3 in |
| V311 | N_cp | 制动钳活塞数 | Count | — | — | 1–6 |
| V312 | mu_l | 摩擦衬片系数 | Dimensionless | — | — | 0.3–0.5 |
| V313 | r_pad | 等效摩擦半径 | Length | m | in | 3–7 in |
| V314 | N_pad | 制动片数（单钳内）| Count | — | — | 2–4 |
| V315 | T_disk | **单个车轮**制动盘扭矩 ✅ D015 | Torque | N·m | ft·lb | — |
| V316 | F_b_disk_axle | **整轴**盘式制动力（= 2T_disk/r_w，左+右）✅ D015 | Force | N | lb | — |
| V317 | D_drcyl | 鼓式轮缸孔径 | Length | mm | in | 0.75–1.5 in |
| V318 | BF_l | 领蹄制动因数 | Dimensionless | — | — | 1.5–4 |
| V319 | BF_t | 从蹄制动因数 | Dimensionless | — | — | 0.5–1.5 |
| V320 | r_drum | 制动鼓半径 | Length | m | in | 4–9 in |
| V321 | T_drum | **单个车轮**制动鼓扭矩 ✅ D015 | Torque | N·m | ft·lb | — |
| V322 | F_b_drum_axle | **整轴**鼓式制动力（= 2T_drum/r_w）✅ D015 | Force | N | lb | — |
| V325 | D_x | 制动减速度 | Accel | m/s² | ft/s² | 0–1.0 g |
| V326 | V_o | 初速度 | Velocity | m/s | mph | 0–120 mph |
| V327 | t_stop | 制动时间 | Time | s | s | 1–15 s |
| V328 | SD | 制动距离 | Length | m | ft | 10–600 ft |
| V329 | mu_p | 峰值附着系数（制动）| Dimensionless | — | — | 0.3–1.0 |

---

## Ch 4 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 |
|----|------|------|------|---------|---------|
| V401 | rho | 空气密度 | Density | kg/m³ | slug/ft³ |
| V402 | P_r | 大气压力 | Pressure | kPa | in Hg |
| V403 | T_r | 气温 | Temperature | °C | °F |
| V404 | V_r | 相对风速（整车坐标系）| Velocity | m/s | mph |
| V405 | C_D | 气动阻力系数 | Dimensionless | — | — |
| V406 | A | 迎风面积 | Area | m² | ft² |
| V407 | C_L | 气动升力系数 | Dimensionless | — | — |
| V408 | L_A | 气动升力 | Force | N | lb |
| V409 | C_S | 气动侧力系数 | Dimensionless | — | — |
| V410 | S_A | 气动侧力 | Force | N | lb |
| V411 | theta_r | 侧风偏航角 | Angle | rad | deg |
| V412 | C_PM | 俯仰力矩系数 | Dimensionless | — | — |
| V413 | C_YM | 偏航力矩系数 | Dimensionless | — | — |
| V414 | C_RM | 侧倾力矩系数 | Dimensionless | — | — |
| V415 | f_r | 滚动阻力系数 | Dimensionless | — | — |
| V416 | f_0 | Stuttgart 基础系数 | Dimensionless | — | — |
| V417 | f_s | Stuttgart 速度系数 | Dimensionless | — | — |
| V418 | C_h | 路面修正系数 | Dimensionless | — | — |
| V419 | R_RL | 总道路阻力 | Force | N | lb |
| V420 | HP_RL | 道路阻力功率 | Power | kW | hp |

---

## Ch 5 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 备注 |
|----|------|------|------|---------|---------|------|
| V501 | K_s | 悬架弹簧刚度（每侧）| Stiffness | N/m | lb/ft | |
| V502 | K_t | 轮胎径向刚度 | Stiffness | N/m | lb/ft | |
| V503 | RR | 骑乘率 | Stiffness | N/m | lb/ft | |
| V504 | r_K | 刚度比 K_t/K_s | Dimensionless | — | — | |
| V505 | chi | 非簧/簧载质量比 | Dimensionless | — | — | |
| V506 | m_us | 非簧载质量（每轮）| Mass | kg | slug | |
| V507 | M_sp | 簧载质量 | Mass | kg | slug | ⚠️ Ch 5 符号 M，≠ V208 整车质量 |
| V508 | W_sf | 前轴簧载重量 | Force | N | lb | |
| V509 | W_sr | 后轴簧载重量 | Force | N | lb | |
| V510 | omega_ns | 簧载固有角频率 | Ang freq | rad/s | rad/s | |
| V511 | xi_s | 簧载阻尼比 | Dimensionless | — | — | ⚠️ 符号 ξ，在 Ch 7 为制动比例 |
| V512 | omega_nu | 非簧载固有角频率 | Ang freq | rad/s | rad/s | |
| V513 | kappa | 回转半径 | Length | m | ft | κ = √(I_y/M) |
| V514 | I_y | 俯仰转动惯量 | Inertia | kg·m² | slug·ft² | |
| V515 | K_f_sp | 前悬架弹簧刚度（每轴）| Stiffness | N/m | lb/ft | bounce/pitch 用 |
| V516 | K_r_sp | 后悬架弹簧刚度（每轴）| Stiffness | N/m | lb/ft | bounce/pitch 用 |
| V517 | DI | 动态指数 κ²/(b·c) | Dimensionless | — | — | |

---

## Ch 6 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 备注 |
|----|------|------|------|---------|---------|------|
| V601 | delta_o | 外侧转向轮转角 | Angle | rad | deg | |
| V602 | delta_i | 内侧转向轮转角 | Angle | rad | deg | |
| V603 | delta_A | Ackermann 转角 | Angle | rad | deg | |
| V604 | delta | 前轴平均转向角 | Angle | deg | deg | |
| V605 | R_turn | 转弯半径 | Length | m | ft | |
| V606 | C_af | 前轴侧偏刚度 | lb/deg | N/deg | lb/deg | |
| V607 | C_ar | 后轴侧偏刚度 | lb/deg | N/deg | lb/deg | |
| V608 | K_us | 不足转向梯度 | deg/g | deg/g | deg/g | ⚠️ 符号 K，≠ 弹簧刚度 K |
| V609 | a_tire | 轮胎刚度线性系数 | lb/deg/lb | — | — | ⚠️ 符号 a，≠ 加速度 a |
| V613 | b_tire | 轮胎刚度二次系数 | lb/deg/lb² | — | — | ⚠️ 符号 b，≠ V003 前轴到质心 |
| V614 | h_rf | 前轴侧倾中心高度 | Length | m | ft | |
| V615 | h_rr | 后轴侧倾中心高度 | Length | m | ft | |
| V616 | t_f | 前轮距 | Length | m | ft | |
| V617 | t_r | 后轮距 | Length | m | ft | |
| V618 | K_phi_f | 前悬侧倾刚度 | Torque/rad | N·m/rad | ft·lb/rad | |
| V619 | K_phi_r | 后悬侧倾刚度 | Torque/rad | N·m/rad | ft·lb/rad | |
| V620 | phi_roll | 车身侧倾角 | Angle | rad | rad | ⚠️ 符号 φ，Ch 9 为横坡角 |
| V621 | R_phi | 侧倾梯度 | rad/g | rad/g | rad/g | |
| V622 | h_1 | CG 到侧倾轴高度 | Length | m | ft | |
| V623 | V_char | 特征车速 | Velocity | m/s | mph | K_us > 0 |
| V624 | V_crit | 临界车速 | Velocity | m/s | mph | K_us < 0 |
| V625 | beta_ss | 整车侧偏角 | Angle | rad | deg | ⚠️ 符号 β，Ch 5 为 bounce/pitch 参数 |

---

## Ch 9 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 备注 |
|----|------|------|------|---------|---------|------|
| V901 | ay_threshold | 侧翻阈值（g 单位）| g | g | g | |
| V902 | phi_slope | 横向坡面角 | Angle | rad | deg | ⚠️ 符号 φ，≠ V620 侧倾角 |
| V903 | h_r | 侧倾中心高度（rollover 专用）| Length | m | ft | 与 V614/V615 的对应关系在 Ch 9 实现时确认 |

---

## Ch 7 专用变量

| ID | 符号 | 名称 | 量纲 | SI 单位 | US 单位 | 备注 |
|----|------|------|------|---------|---------|------|
| V701 | e_f | 前悬架几何线截距高度 | Length | m | ft | ⚠️ 符号 e，≠ Ch 6 稳定裕度 |
| V702 | e_r | 后悬架几何线截距高度 | Length | m | ft | |
| V703 | d_f | 前悬架几何水平距离 | Length | m | ft | |
| V704 | d_r | 后悬架几何水平距离 | Length | m | ft | |
| V705 | r_susp | 独立悬架中的轮胎半径偏置 | Length | m | ft | ⚠️ ≠ V009 规格半径 |
| V706 | xi_fwd | 前轮制动力分配比例 | Dimensionless | — | — | ⚠️ 符号 ξ，≠ V511 阻尼比 |

---

## 符号冲突速查

| 符号 | 含义 A（ID）| 含义 B（ID）| 解决方案 |
|------|-----------|-----------|---------|
| b | 前轴到质心（V003）| 轮胎刚度二次系数（V613）| 用 ID 区分 |
| a | — | 轮胎刚度线性系数（V609）| 用 ID 区分 |
| K | 弹簧刚度（V501）| 不足转向梯度（V608）| 用 ID 区分 |
| M | 整车质量（V208）| 簧载质量（V507）| 用 ID 区分 |
| φ/phi | 侧倾角（V620）| 横坡角（V902）| 用 ID 区分 |
| α | — | 轮胎侧偏角（Ch 6 内）| 命名空间隔离 |
| β | bounce/pitch 参数（Ch 5）| 整车侧偏角（V625）| 用 ID 区分 |
| ξ | 阻尼比（V511）| 制动比例（V706）| 用 ID 区分 |
| e | 稳定裕度分子（Ch 6）| 悬架几何（V701/702）| 用 ID 区分 |

---

## 单位换算常数（代码内统一）

| 换算 | 精确值（代码用）| 课程近似（来源标注）|
|------|--------------|----------------|
| g | 9.80665 m/s² | 9.805 m/s² 或 32.2 ft/s² |
| 1 in | 25.4 mm | 25.4 mm |
| 1 ft | 0.3048 m | — |
| 1 mph | 0.44704 m/s = 1.4667 ft/s | 1.466 ft/s |
| 1 hp | 745.7 W = 550 ft·lb/s | 550 ft·lb/s |
| 1 lb_f | 4.44822 N | — |
| 1 slug | 14.5939 kg | — |
| 1 ft·lb | 1.35582 N·m | — |
| RPM→rad/s | × π/30 | × 2π/60 |
| hp→T (ft·lb) | T = HP × 5252.1 / RPM | HP×5252/RPM |
