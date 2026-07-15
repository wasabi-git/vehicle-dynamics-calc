# Vehicle Dynamics — Formula Notes（Phase 2 历史参考）

> [!IMPORTANT]
> **文档定位：历史参考，不是当前运行时权威公式库。**  
> 本文保留旧项目结构下完成的公式清洗、来源判断、OCR 修正和未来模块参考材料。  
> 当前 v0.1 机器权威公式数据位于 `data/formulas.v0.1.json`；变量数据位于 `data/variables.v0.1.json`；模型显示名称位于 `data/models.v0.1.json`。  
> 文中的 F101、F201、F207 等编号属于 Phase 2 旧编号体系，仅用于历史追溯，不得作为新引擎的 `formula_id`。  
> OCR 与版本差异的正式处置记录见 `DISCREPANCIES.md`。

---

> Version: 3.0 | Phase 2 final
> **原始公式来源**：课程公式表 PDF 原版+ 课堂字幕（争议处以字幕为准）
> **b/c 定义（字幕确认）**：b = 前轴到质心；c = 质心到后轴
> 旧版符号冲突、变量 ID 与公式 ID 曾记录于 `VARIABLES.md` 和 `FORMULAS.md`；这两份旧文件已被当前结构取代。现行定义以 `data/*.json` 为准。

---

## Ch 1: Axle Loads

**变量**（本章）：W, L, b（前轴→CG）, c（CG→后轴）, h（CG高度）, a_x, g, θ

### 静态载荷（水平路面）[F101/F102]

$$W_{fs} = W\frac{c}{L};\qquad W_{rs} = W\frac{b}{L}$$

约束：$b + c = L$；$W_{fs} + W_{rs} = W$

### 低速加速（动态载荷）[F103/F104] ✅ D001 确认（PDF 页 1）

$$W_f = W\!\left(\frac{c}{L} - \frac{a_x h}{gL}\right);\qquad W_r = W\!\left(\frac{b}{L} + \frac{a_x h}{gL}\right)$$

加速时前轴减重，后轴增重（纵向载荷转移 = $W a_x h/(gL)$）。

### 坡道载荷 [F105/F106]

$$W_f = W\!\left(\frac{c}{L} - \frac{h\theta}{L}\right);\qquad W_r = W\!\left(\frac{b}{L} + \frac{h\theta}{L}\right)$$

小角近似：$\sin\theta \approx \theta$（θ 单位 rad），适用 grade ≤ 12%。

### 一般动态载荷 [F107/F108]

$$W_f = \frac{1}{L}\!\left(Wc\cos\theta - R_{hx}h_h - R_{zh}d_h - \frac{W}{g}a_x h - D_A h_a - Wh\sin\theta\right)$$

$$W_r = \frac{1}{L}\!\left(Wb\cos\theta + R_{hx}h_h + R_{zh}(d_h+L) + \frac{W}{g}a_x h + D_A h_a + Wh\sin\theta\right)$$

---

## Ch 2: Acceleration Performance

### 换算常数（已确认，代码统一 SI）

| 量 | 展示值（课程）| 精确值（代码）|
|----|------------|------------|
| 1 hp | 550 ft·lb/s | 745.7 W |
| HP = T×RPM/? | 5252 | 5252.1 |
| 1 mph | 1.466 ft/s | 0.44704 m/s |
| g | 32.2 ft/s² | 9.80665 m/s² |

### 轮胎规格 → 理论半径 [F201]

$$r_w\,[\text{in}] = \frac{\text{width[mm]} \times \text{aspect[\%]/100}}{25.4} + \frac{\text{rim[in]}}{2}$$

**注意**：结果为未加载几何半径（nominal radius），非实际滚动半径。

### 车速 / 发动机转速 [F202/F203]

$$V = r_w \omega_w = \frac{r_w\,\omega_e}{N_{tf}};\qquad \omega_e = \frac{V \cdot N_{tf}}{r_w};\qquad \text{RPM} = \frac{60\,\omega_e}{2\pi}$$

### 发动机功率 [F204]

$$HP = \frac{T_e[\text{ft·lb}]\times\omega_e[\text{rad/s}]}{550} = \frac{T_e\times\text{RPM}}{5252};\qquad P_{kW} = 0.7457 \times HP$$

### 牵引力 [F205]

$$F_x = \frac{T_e\,N_{tf}\,\eta_{tf}}{r_w}$$

### 质量因子 [F206]

$$M_f = 1 + 0.04\,N_{tf} + 0.0025\,N_{tf}^2$$

经验拟合公式，反映传动系旋转惯性对加速的影响。

### 发动机限制加速度 [F207]

$$M_f M\,a_x = F_x - D_A - R_x - W\sin\theta - R_{hx}$$

$$\therefore\quad a_x = \frac{F_x - D_A - R_x - W\sin\theta - R_{hx}}{M_f \cdot M}$$

**SI 计算**：M [kg] = W [N] / 9.80665；所有力换算为 N，结果 a_x 单位 m/s²。

简化形式（平路、无挂车、**同时忽略气动阻力和滚动阻力**）：$a_x/g = F_x/(M_f\,W)$

### 理想电机（恒功率）加速度 [F208]

$$a_x = 550\frac{g}{V}\frac{HP}{W}\quad[\text{ft/s}^2,\ V\text{ 单位 ft/s}]$$

**SI 形式**：$a_x = P/(M \cdot V)$（P 单位 W，M 单位 kg，V 单位 m/s）

### 附着限制牵引力

| 驱动形式 | 公式 |
|---------|------|
| RWD 独立/锁定 | $F_{x,\max} = \mu W(b/L)\,/\,[1-(h/L)\mu]$ |
| FWD 独立 | $F_{x,\max} = \mu W(c/L)\,/\,[1+(h/L)\mu]$ |
| AWD（理想）| $F_{x,\max} = \mu W$ |

---

## Ch 3: Braking Performance

### 制动压力

$$p_{mc} = \frac{F_{pedal} \times pedal\_ratio}{\pi D_{mc}^2/4};\qquad \text{（助力）}\quad p_{mc}[\text{psi}] = K_{boost\_100}[\text{psi}]\times\frac{F_{pedal}[\text{lb}]}{100}\quad\text{✅ D014}$$

轴压力分配：

$$p_{af} = p_{mc};\qquad p_{ar} = \begin{cases} p_{mc} & p_{mc} \leq p_{pv} \\ p_{pv}+k_{pv}(p_{mc}-p_{pv}) & p_{mc} > p_{pv} \end{cases}$$

### 盘式制动力（D015 已解决：结果为整轴合力）✅

$$F_{pad} = p_{af}\frac{\pi D_{wcyl}^2}{4}N_{cp};\quad T_{disk} = N_{pad}\,\mu_l F_{pad} r_{pad}\text{（单轮扭矩）};\quad F_{b,disk\_axle} = 2\frac{T_{disk}}{r_w}\text{（整轴合力）}$$

### 鼓式制动力 ✅

$$F_{drum} = p_{ar}\frac{\pi D_{drcyl}^2}{4};\quad T_{drum} = F_{drum}(BF_l+BF_t)r_{drum}\text{（单轮扭矩）};\quad F_{b,drum\_axle} = 2\frac{T_{drum}}{r_w}\text{（整轴合力）}$$

### 制动减速度、时间、距离

$$D_x = \frac{F_{xf}+F_{xr}+D_A+W\sin\theta}{M};\qquad t_s = \frac{V_o}{D_x};\qquad SD = \frac{V_o^2}{2D_x}$$

### 最大制动力

$$F_{xmf} = \frac{\mu_p(W_{fs}+\frac{h}{L}F_{xr})}{1-\mu_p\frac{h}{L}};\qquad F_{xmr} = \frac{\mu_p(W_{rs}-\frac{h}{L}F_{xf})}{1+\mu_p\frac{h}{L}}$$

### 轴截距（D005 已解决，PDF 确认）✅

$$F_{xfint} = \frac{\mu_p W_{fs}}{1-\mu_p\frac{h}{L}};\qquad F_{xrint} = \frac{\mu_p W_{rs}}{1+\mu_p\frac{h}{L}}$$

### 理想制动点

$$F_{xfi} = \mu_p\!\left(W_{fs}+\mu_p\frac{h}{L}W\right);\qquad F_{xri} = \mu_p\!\left(W_{rs}-\mu_p\frac{h}{L}W\right)$$

---

## Ch 4: Road Loads

### 空气密度（US 单位）

$$\rho = 0.00236\,\frac{P_r}{29.92}\,\frac{519}{460+T_r}\quad[\text{slug/ft}^3,\ P_r\text{ in Hg},\ T_r\text{ °F}]$$

### 气动力

$$D_A = \tfrac{1}{2}\rho V_r^2 C_D A;\quad L_A = \tfrac{1}{2}\rho V_r^2 C_L A;\quad S_A = \tfrac{1}{2}\rho V_r^2 C_S A;\quad C_S = \Delta C_S\,\theta_r$$

### 气动力矩

$$PM = \tfrac{1}{2}\rho V_r^2 C_{PM} AL;\quad YM = \tfrac{1}{2}\rho V_r^2 C_{YM} AL;\quad RM = \tfrac{1}{2}\rho V_r^2 C_{RM} AL$$

### 滚动阻力系数（V 单位 mph）

**Stuttgart**：$f_r = f_0 + 3.24\,f_s(V/100)^{2.5}$

**Michigan 子午线胎**：$f_r = (0.0041 + 0.000041\,V)C_h$

**Michigan 斜交胎**：$f_r = (0.0066 + 0.000046\,V)C_h$

路面系数：$C_h = 1.0$（光滑混凝土）/ $1.2$（磨损混凝土/冷沥青）/ $1.5$（热沥青）

> 如需图查 $f_r$，v0.1 中用户手动输入。

### 总道路载荷

$$R_{RL} = f_r W + D_A + W\sin\theta;\qquad HP_{RL} = R_{RL}\,V/550\quad(V\text{ [ft/s]})$$

---

## Ch 5: Ride

### 四分之一车模型

$$RR = \frac{K_s K_t}{K_s+K_t};\quad r_K = \frac{K_t}{K_s};\quad \chi = \frac{m}{M}$$

**簧载质量固有频率**：

$$\omega_{ns} = \sqrt{\frac{RR}{M_{sp}}};\quad f_{ns} = \frac{\omega_{ns}}{2\pi};\quad \omega_{ds} = \omega_{ns}\sqrt{1-\xi_s^2};\quad \xi_s = \frac{C_s}{2\sqrt{K_s M_{sp}}}$$

**非簧载质量固有频率** ✅（D006，V1 正确）：

$$\omega_{nu} = \sqrt{\frac{K_t+K_s}{m_{us}}};\qquad f_{nu} = \frac{\omega_{nu}}{2\pi}$$

### 弹跳/俯仰模型

$$\omega_{1,2} = \sqrt{\frac{\alpha+\gamma}{2}\pm\sqrt{\frac{(\alpha-\gamma)^2}{4}+\frac{\beta^2}{\kappa^2}}}$$

$$\alpha = \frac{K_f+K_r}{M};\quad \beta = \frac{K_r\,c-K_f\,b}{M};\quad \gamma = \frac{K_f b^2+K_r c^2}{M\kappa^2};\quad \kappa = \sqrt{\frac{I_y}{M}}$$

振荡中心：$l_o = \beta/(\omega_{1,2}^2-\alpha)$；动态指数：$DI = \kappa^2/(bc)$

---

## Ch 6: Steady State Cornering

### 低速转向（Ackermann）

$$\delta_o = \frac{L}{R+t/2};\quad \delta_i = \frac{L}{R-t/2};\quad \delta_A = \frac{L}{R}\ [\text{rad}]$$

$$\Delta = R\!\left(1 - \cos\frac{L}{R}\right) \approx \frac{L^2}{2R}\quad(L/R\ll 1)$$

### 高速转向

$$\delta = \frac{180}{\pi}\frac{L}{R}\frac{1}{1+F_{xf}/C_{\alpha f}} + K_{us}\frac{V^2}{Rg}\ [\text{deg}]$$

$$K_{tires} = \frac{W_f}{C_{af}} - \frac{W_r}{C_{ar}};\quad K_{us} = K_{tires}+K_{llt}-K_{tractive}\ [\text{deg/g}]$$

### 侧倾载荷转移

$$\Delta F_{zf,r} = F_{yf,r}\frac{h_{rf,r}}{t_{f,r}} + K_{\phi f,r}\frac{\phi}{t_{f,r}};\quad F_{yf,r} = W_{f,r}\frac{V^2}{Rg};\quad \phi = R_\phi\frac{V^2}{Rg}$$

$$R_\phi = \frac{W h_1}{K_{\phi f}+K_{\phi r}-Wh_1};\quad K_{\phi f,r} = \frac{1}{2}K_{sf,r}s_{f,r}^2$$

### 特征速度/临界速度

$$V_{char} = \sqrt{\frac{180Lg}{\pi K_{us}}}\ (K_{us}>0);\quad V_{crit} = \sqrt{\frac{-180Lg}{\pi K_{us}}}\ (K_{us}<0)$$

### 侧偏角

$$\beta_{ss} = \frac{180c}{\pi R} - \frac{W_r V^2}{C_{\alpha r}Rg};\quad V_{\beta=0} = \sqrt{\frac{180gc\,C_{\alpha r}}{\pi W_r}}$$

---

## Ch 9: Rollover

**刚体（无横坡）**：$a_y/g = t/(2h)$

**刚体（含横坡 $\varphi$）**：$a_y/g = (t/2+\varphi h)/h$

**弹性车辆**：$a_y/g = \dfrac{t}{2h}\cdot\dfrac{1}{1+R_\phi(1-h_r/h)}$

---

## Ch 7: Suspension Geometry

### 反蹲/反俯仰几何条件

| 悬架类型 | 反蹲 | 反俯仰 |
|---------|------|--------|
| 后整体桥 | $e/d = h/L$ | $e/d \cong 2h/L$ |
| 独立后驱 | $(e-r)/d = h/L$ | $(e-r)/d \cong 2h/L$ |
| 独立前驱 | — | $(e-r)/d \cong -2h/L$ |

### 四驱独立悬架俯仰角（D007 已解决，V2/PDF 正确）✅

$$\theta_p = \frac{1}{L}\frac{W}{g}a_x\!\left(\frac{1}{K_r}\frac{h}{L}+\frac{1}{K_f}\frac{h}{L}-\frac{1-\xi}{K_r}\frac{e_r-r}{d_r}+\frac{\xi}{K_f}\frac{e_f-r}{d_f}\right)$$

### Anti-dive 几何条件（D011 已解决，PDF 确认）✅

$$\frac{e_f}{d_f} = -\frac{h}{\xi L};\qquad \frac{e_r}{d_r} = \frac{h}{(1-\xi)L}$$

ξ = 前轮制动力分配比例（0~1）。

---

## 已知近似与限制

| 限制 | 说明 |
|------|------|
| 小角近似 | Ch 1 坡道公式，Ch 6 Ackermann ΔΔ 近似，适用 θ ≤ 12% grade |
| 规格半径近似 | r_w（F201）≠ 实际滚动半径，v0.1 视为相同 |
| 恒功率近似 | F208 假设理想恒功率，实际受扭矩峰值和换挡限制 |
| RPM → 扭矩 | 不能从 RPM 单独推出 T_e，需用户另行提供扭矩值或扭矩曲线 |
| 滚动阻力系数 | 图查情况需用户手动输入 f_r |
| D007 | F706 已解决（V2/PDF 正确）；D011 F707 已解决 |
| D012–D015 | 全部已解决，不阻断任何公式实现 |
