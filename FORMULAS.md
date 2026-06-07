# Vehicle Dynamics — Formula Table

> Version: 3.0 | Phase 2 final
> **权威来源**：Vehicle_Dynamics_Formulae.pdf（老师原版 PDF）
> **b/c 定义已修正**：b = 前轴到质心（V003），c = 质心到后轴（V004）
> 优先级：**P1-core**（F201–F208）= v0.1 必做；**P1-check**（F209–F211）= v0.1 可选附着限制检查；**P2**（Ch 1, Ch 3–9）= 扩展索引，公式已记录但变量 ID 未完整补全，不声称完整建模

---

## v0.1 公式依赖链（Ch 2，P1 完整建模）

```
用户输入：tire_width, tire_aspect, rim_dia ──[F201]──► r_w (V009)
用户输入：N_tf (V202) ──[F206]──► M_f (V207)
用户输入：V 或 omega_e ──[F202/F203]──► omega_e(V204) 或 V(V010)（需 r_w, N_tf）
用户输入：T_e, N_tf, eta_tf ──[F205]──► F_x (V209，发动机限制)
用户输入：T_e, omega_e ──[F204]──► P_engine (V206, W)
F_x + M_f + W + D_A + R_x + theta ──[F207]──► a_x (V007，发动机限制)
P_engine + V + W ──[F208]──► a_x (V007，理想恒功率)
mu + W + b/c/L/h ──[F209/F210/F211]──► F_xmax (V214，附着极限，独立存储，不覆盖 V209)
推导引擎：若 V209(F_x) > V214(F_xmax)，警告"附着限制，实际加速受限"
```

---

## Ch 1: Axle Loads

### F101 — 前轴静态载荷（P2）
| | |
|--|--|
| **公式** | $W_{fs} = W\dfrac{c}{L}$ |
| **输入** | V001(W), V004(c), V002(L) |
| **输出** | V016(W_fs) |
| **SI 计算** | 同形式（纯比例，无量纲转换）|
| **可逆** | 是：$c = W_{fs} L / W$ |
| **来源** | PDF p1, Ch 1 |
| **验证** | $W_{fs} + W_{rs} = W$；$b + c = L$ |

### F102 — 后轴静态载荷（P2）
| | |
|--|--|
| **公式** | $W_{rs} = W\dfrac{b}{L}$ |
| **输入** | V001(W), V003(b), V002(L) |
| **输出** | V017(W_rs) |
| **可逆** | 是 |
| **来源** | PDF p1, Ch 1 |

### F103 — 低速加速前轴动态载荷（P2）✅ V1 正确（D001）
| | |
|--|--|
| **公式** | $W_f = W\!\left(\dfrac{c}{L} - \dfrac{a_x h}{gL}\right)$ |
| **输入** | V001(W), V004(c), V002(L), V007(a_x), V005(h), V006(g) |
| **输出** | V014(W_f) |
| **可逆** | 是：$a_x = (W_{fs} - W_f)\,gL/(Wh)$ |
| **适用条件** | 低速（忽略气动），平路 |
| **来源** | PDF p1 |

### F104 — 低速加速后轴动态载荷（P2）
| | |
|--|--|
| **公式** | $W_r = W\!\left(\dfrac{b}{L} + \dfrac{a_x h}{gL}\right)$ |
| **输入** | V001(W), V003(b), V002(L), V007(a_x), V005(h), V006(g) |
| **输出** | V015(W_r) |
| **来源** | PDF p1 |

### F105/F106 — 坡道前/后轴载荷（P2）
$$W_f = W\!\left(\frac{c}{L} - \frac{h}{L}\theta\right);\quad W_r = W\!\left(\frac{b}{L} + \frac{h}{L}\theta\right)$$
- 输入：V001, V003, V004, V002, V005, V013(θ rad)
- 适用条件：小角近似 θ ≤ 12% grade ≈ 0.12 rad

### F107/F108 — 一般动态前/后轴载荷（P2）
$$W_f = \frac{1}{L}\!\left(Wc\cos\theta - R_{hx}h_h - R_{zh}d_h - \frac{W}{g}a_x h - D_A h_a - Wh\sin\theta\right)$$
$$W_r = \frac{1}{L}\!\left(Wb\cos\theta + R_{hx}h_h + R_{zh}(d_h+L) + \frac{W}{g}a_x h + D_A h_a + Wh\sin\theta\right)$$

---

## Ch 2: Acceleration Performance（P1 — v0.1 核心）

### F201 — 轮胎规格 → 理论半径（P1）✅
| | |
|--|--|
| **展示公式（课程原版）** | $r_w\,[\text{in}] = \dfrac{\text{width[mm]} \times \text{aspect[\%]}}{25.4 \times 100} + \dfrac{\text{rim[in]}}{2}$ |
| **SI 计算公式** | $r_w\,[\text{m}] = \dfrac{\text{width[mm]} \times \text{aspect[\%]}}{100 \times 1000} + \dfrac{\text{rim[in]} \times 0.0254}{2}$ |
| **输入** | V221(width mm), V222(aspect %), V223(rim in) |
| **输出** | V009(r_w) |
| **可逆** | 否（3 输入→1 输出）|
| **验证** | 195/55 R16：r_w = (195×0.55)/25.4 + 16/2 = **12.22 in = 0.3104 m** |
| **注意** | 结果为**规格理论半径**，非实际滚动半径 |
| **来源** | PDF p1, Ch 2 |

### F202 — 车速（由发动机转速）（P1）✅
| | |
|--|--|
| **展示公式** | $V = r_w\omega_w = \dfrac{r_w\omega_e}{N_{tf}}$ |
| **SI 计算** | V [m/s] = r_w [m] × omega_e [rad/s] / N_tf |
| **输入** | V009(r_w), V204(omega_e), V202(N_tf) |
| **输出** | V010(V) |
| **可逆** | 是 → F203 |
| **来源** | PDF p1 |

### F203 — 发动机转速（由车速）（P1）✅
| | |
|--|--|
| **展示公式** | $\omega_e = \dfrac{V \cdot N_{tf}}{r_w};\quad \text{RPM} = \dfrac{60\,\omega_e}{2\pi}$ |
| **SI 计算** | omega_e [rad/s] = V [m/s] × N_tf / r_w [m] |
| **输入** | V010(V), V202(N_tf), V009(r_w) |
| **输出** | V204(omega_e) |
| **来源** | PDF p1 |

### F204 — 发动机功率（P1）✅
| | |
|--|--|
| **展示公式（US）** | $HP = \dfrac{T_e[\text{ft·lb}] \times \omega_e[\text{rad/s}]}{550} = \dfrac{T_e \times \text{RPM}}{5252}$ |
| **SI 计算（代码内部）** | $P_{engine}[\text{W}] = T_e[\text{N·m}] \times \omega_e[\text{rad/s}]$ |
| **显示换算** | $HP = P_{engine}/745.7$；$kW = P_{engine}/1000$ |
| **输入** | V201(T_e), V204(omega_e) |
| **输出** | **V206(P_engine，单位 W)**；HP/kW 为显示单位，不独立存储 |
| **可逆** | 是：$T_e = P_{engine}/\omega_e$ |
| **来源** | PDF p1 |

### F205 — 牵引力（P1）✅
| | |
|--|--|
| **展示公式** | $F_x = \dfrac{T_e N_{tf}\,\eta_{tf}}{r_w}$ |
| **SI 计算** | F_x [N] = T_e [N·m] × N_tf × eta_tf / r_w [m] |
| **US 验证** | T_e [ft·lb] / r_w [ft] × N_tf × eta_tf = F_x [lb] |
| **输入** | V201(T_e), V202(N_tf), V203(eta_tf), V009(r_w) |
| **输出** | **V209(F_x，发动机限制牵引力)**；注意 V209 ≠ V214(F_xmax 附着极限) |
| **可逆** | 是：T_e = F_x × r_w / (N_tf × eta_tf) |
| **来源** | PDF p1 |

### F206 — 质量因子（P1）✅
| | |
|--|--|
| **公式** | $M_f = 1 + 0.04\,N_{tf} + 0.0025\,N_{tf}^2$ |
| **输入** | V202(N_tf) |
| **输出** | V207(M_f) |
| **物理意义** | 考虑传动系旋转惯性的等效质量放大系数（经验拟合公式）|
| **验证范围** | N_tf=3 → M_f≈1.14；N_tf=10 → M_f≈1.65 |
| **来源** | PDF p1 |

### F207 — 发动机限制加速度（P1）✅
| | |
|--|--|
| **展示公式** | $M_f M\,a_x = F_x - D_A - R_x - W\sin\theta - R_{hx}$ |
| **SI 计算** | a_x [m/s²] = (F_x − D_A − R_x − W·sinθ − R_hx) / (M_f × M) |
| **输入** | V209(F_x), V011(D_A), V012(R_x), V001(W), V013(θ), V101(R_hx), V207(M_f) |
| **输出** | V007(a_x) |
| **质量关系** | M = W/g；代码中 M [kg] = W [N] / 9.80665 |
| **简化形式** | 平路、无挂钩、**忽略气动和滚动阻力**：$a_x/g = F_x/(M_f W)$ |
| **可逆** | 是：F_x = a_x × M_f × M + D_A + R_x + W·sinθ + R_hx |
| **来源** | PDF p1 |

> ⚠️ F207 简化形式要求同时忽略 D_A **和** R_x（之前文档漏掉了 R_x 条件）。

### F208 — 理想恒功率电机加速度（P1）✅
| | |
|--|--|
| **展示公式（US）** | $a_x = 550\dfrac{g}{V}\dfrac{HP}{W}\ \ [\text{ft/s}^2,\ V\text{ in ft/s}]$ |
| **SI 计算（代码内部）** | $a_x[\text{m/s}^2] = P_{engine}[\text{W}] / (M[\text{kg}] \times V[\text{m/s}])$ |
| **常用换算形式** | $a_x/g \approx 375.7 \times HP / (W[\text{lb}] \times V[\text{mph}])$ |
| **输入** | **V206(P_engine W)**, V010(V), V001(W) |
| **输出** | V007(a_x) |
| **适用条件** | 假设恒功率输出；实际低速受扭矩限制，高速受阻力影响 |
| **来源** | PDF p1 |

### F209 — 附着限制牵引力·RWD 独立/锁定（**P1-check**）✅
$$F_{x,\max} = \frac{\mu\,W(b/L)}{1 - (h/L)\mu}$$
- 输入：V018(μ), V001(W), V003(b), V002(L), V005(h)
- **输出：V214(F_xmax)**（不覆盖 V209；推导引擎分别保存，可做附着 vs 发动机比较）
- 适用：RWD + 独立后悬架 或 整体桥 + 锁止差速器

### F210 — 附着限制牵引力·RWD 整体桥非锁止（**P1-check**）✅ D012
$$F_{x,\max} = \frac{\mu\,W(b/L)}{1 - (h/L)\mu + \frac{2\mu r_w}{t \cdot N_f}\frac{K_{\phi f}}{K_\phi}}$$
- 输入：V018(μ), V001(W), V003(b), V002(L), V005(h), V009(r_w), V210(t), **V211(N_f)**, V212(K_phi_f), V213(K_phi_total)
- **输出：V214(F_xmax)**
- $N_f$ = 最终传动比（V211，≠ V202 $N_{tf}$）

### F211 — 附着限制牵引力·FWD 独立前轴（**P1-check**）✅
$$F_{x,\max} = \frac{\mu\,W(c/L)}{1 + (h/L)\mu}$$
- 输入：V018(μ), V001(W), V004(c), V002(L), V005(h)
- **输出：V214(F_xmax)**

---

## Ch 3: Braking Performance（P2）

### F301–F303 — 制动压力
| ID | 公式 | 备注 |
|----|------|------|
| F301 | $p_{mc} = \dfrac{F_{pedal} \times pedal\_ratio}{\pi D_{mc}^2/4}$ | 无助力 |
| F302 | $p_{mc}[\text{psi}] = K_{boost\_100}[\text{psi}] \times F_{pedal}[\text{lb}]/100$ | 有助力；V305 K_boost_100 单位 psi ✅ D014 |
| F303 | $p_{af}=p_{mc}$；$p_{ar} = p_{mc}$ 或 $p_{pv}+k_{pv}(p_{mc}-p_{pv})$ | 比例阀分配 |

### F304–F305 — 制动力（D015 已解决：结果为整轴合力）
| ID | 公式 |
|----|------|
| F304 | $F_{pad}=p_{af}\frac{\pi D_{wcyl}^2}{4}N_{cp}$；$T_{disk}=N_{pad}\mu_l F_{pad}r_{pad}$；$F_{b,disk}=2T_{disk}/r_w$ |
| F305 | $F_{drum}=p_{ar}\frac{\pi D_{drcyl}^2}{4}$；$T_{drum}=F_{drum}(BF_l+BF_t)r_{drum}$；$F_{b,drum}=2T_{drum}/r_w$ |

### F306–F311 — 制动性能（P2）✅（D005 已解决）
| ID | 公式 |
|----|------|
| F306 | $D_x = (F_{xf}+F_{xr}+D_A+W\sin\theta)/M$ |
| F307 | $t_s = V_o/D_x$；$SD = V_o^2/(2D_x)$ |
| F308 | $F_{xmf} = \mu_p(W_{fs}+\frac{h}{L}F_{xr})/(1-\mu_p\frac{h}{L})$ |
| F309 | $F_{xmr} = \mu_p(W_{rs}-\frac{h}{L}F_{xf})/(1+\mu_p\frac{h}{L})$ |
| F310 | $F_{xfint}=\mu_p W_{fs}/(1-\mu_p h/L)$；$F_{xrint}=\mu_p W_{rs}/(1+\mu_p h/L)$ ✅ D005 |
| F311 | $F_{xfi}=\mu_p(W_{fs}+\mu_p\frac{h}{L}W)$；$F_{xri}=\mu_p(W_{rs}-\mu_p\frac{h}{L}W)$ |

---

## Ch 4: Road Loads（P2）

| ID | 公式 | 单位注意 |
|----|------|---------|
| F401 | $\rho=0.00236\,\frac{P_r}{29.92}\,\frac{519}{460+T_r}$ | US: P_r [in Hg], T_r [°F] → ρ [slug/ft³] |
| F402 | $D_A=\frac{1}{2}\rho V_r^2 C_D A$ | V_r [ft/s] 或 [m/s] 对应 ρ 单位 |
| F403–F407 | 升力、侧力、各力矩：同形式 | — |
| F408 | $f_r=f_0+3.24\,f_s(V/100)^{2.5}$ | V [mph]（Stuttgart）|
| F409 | $f_r=(0.0041+0.000041\,V)C_h$ | V [mph]（Michigan 子午线）|
| F410 | $f_r=(0.0066+0.000046\,V)C_h$ | V [mph]（Michigan 斜交胎）|
| F411 | $R_{RL}=f_r W+D_A+W\sin\theta$ | — |
| F412 | $HP_{RL}=R_{RL}V/550$ | V [ft/s] |

---

## Ch 5: Ride（P2）

| ID | 公式 | 备注 |
|----|------|------|
| F501 | $RR=K_sK_t/(K_s+K_t)$ | 骑乘率 |
| F502 | $\omega_{ns}=\sqrt{RR/M_{sp}}$；$f_{ns}=\omega_{ns}/(2\pi)$ | 簧载固有频率 |
| F503 | $\xi_s=C_s/(2\sqrt{K_s M_{sp}})$；$\omega_{ds}=\omega_{ns}\sqrt{1-\xi_s^2}$ | |
| F504 | $\omega_{nu}=\sqrt{(K_t+K_s)/m_{us}}$；$f_{nu}=\omega_{nu}/(2\pi)$ | ✅ V1 正确 (D006) |
| F505 | $\omega_{1,2}=\sqrt{(\alpha+\gamma)/2 \pm \sqrt{(\alpha-\gamma)^2/4+\beta^2/\kappa^2}}$ | |
| F506 | $\alpha=(K_f+K_r)/M$；$\beta=(K_r c-K_f b)/M$；$\gamma=(K_f b^2+K_r c^2)/(M\kappa^2)$ | b=前轴到CG, c=CG到后轴 |
| F507 | $l_o=\beta/(\omega_{1,2}^2-\alpha)$；$DI=\kappa^2/(bc)$ | |

---

## Ch 6: Steady State Cornering（P2）

| ID | 公式 | 备注 |
|----|------|------|
| F601 | **精确式**：$\Delta=R(1-\cos(L/R))$；**近似式**：$\Delta\approx L^2/(2R)$（$L/R\ll1$）| ✅ D010 两式均收录 |
| F602 | $\delta_o=L/(R+t/2)$；$\delta_i=L/(R-t/2)$；$\delta_A=L/R$ | Ackermann 低速转向角 |
| F603 | $\delta=\frac{180}{\pi}\frac{L}{R}\frac{1}{1+F_{xf}/C_{\alpha f}}+K_{us}\frac{V^2}{Rg}$ | 高速转向角 |
| **F604** | $K_{tires}=W_f/C_{af}-W_r/C_{ar}$；$K_{us}=K_{tires}+K_{llt}-K_{tractive}$ | **$K_{llt}$ 中 b = V613(b_tire)，≠ V003(b)** ✅ D013 |
| F605 | $\Delta F_{zf,r}=F_{yf,r}h_{rf,r}/t_{f,r}+K_{\phi f,r}\phi/t_{f,r}$ | 侧倾载荷转移（扩展索引）|
| F606 | $F_{yf,r}=W_{f,r}V^2/(Rg)$；$\phi=R_\phi V^2/(Rg)$ | （扩展索引）|
| F607 | $R_\phi=Wh_1/(K_{\phi f}+K_{\phi r}-Wh_1)$；$K_{\phi f,r}=\frac{1}{2}K_{sf,r}s_{f,r}^2$ | 侧倾梯度/刚度（扩展索引）|
| F608 | $\beta_{ss}=\frac{180c}{\pi R}-\frac{W_r V^2}{C_{\alpha r}Rg}$ | 侧偏角（扩展索引）|
| F609 | $V_{char}=\sqrt{180Lg/(\pi K_{us})}$；$V_{crit}=\sqrt{-180Lg/(\pi K_{us})}$ | 特征/临界车速 |

---

## Ch 9: Rollover（P2）

| ID | 公式 |
|----|------|
| F901 | $a_y/g = t/(2h)$（刚体，无横坡）|
| F902 | $a_y/g = (t/2+\varphi h)/h$（刚体，含横坡 φ）|
| F903 | $a_y/g = \frac{t}{2h}\cdot\frac{1}{1+R_\phi(1-h_r/h)}$（弹性车辆）|

---

## Ch 7: Suspension（P2）

| ID | 公式 | 状态 |
|----|------|------|
| F701 | 后整体桥反蹲：$e/d=h/L$ | ✅ |
| F702 | 后整体桥反俯仰：$e/d\cong 2h/L$ | ✅ |
| F703 | 独立后轴反蹲：$(e-r)/d=h/L$ | ✅ |
| F704 | 独立后轴反俯仰：$(e-r)/d\cong 2h/L$ | ✅ |
| F705 | 独立前轴反俯仰：$(e-r)/d\cong -2h/L$ | ✅ |
| F706 | 四驱俯仰角：$\theta_p=\frac{W}{gL}a_x\!\left(\frac{1}{K_r}\frac{h}{L}+\frac{1}{K_f}\frac{h}{L}-\frac{1-\xi}{K_r}\frac{e_r-r}{d_r}+\frac{\xi}{K_f}\frac{e_f-r}{d_f}\right)$ | ✅ **V2 正确** (D007) |
| F707 | Anti-dive：$e_f/d_f=-h/(\xi L)$；$e_r/d_r=h/((1-\xi)L)$ | ✅ (D011) |
