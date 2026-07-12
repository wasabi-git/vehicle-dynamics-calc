# Vehicle Dynamics Formula — Discrepancy Log

> Version: 3.0 | Phase 2 final
> 来源：Vehicle_Dynamics_Formulae.txt V1（行 1–303）vs V2（行 304–611），已用 PDF 原版和课堂字幕核实

**Claude Code Phase 3 规则**：
- `✅ RESOLVED`：可按标注的权威来源实现
- `⚠️ PENDING`：禁止实现，等待人工确认
- 每条记录对应 FORMULAS.md 中的公式 ID

---

## D001 — Ch 1 · 低速加速轴荷 · ✅ RESOLVED（PDF 确认 V1 正确）

| 版本 | LaTeX | 数学含义 |
|------|-------|----------|
| V1 | `\frac{a_x h}{gL}` | $a_x h/(gL)$ — 分母为 $g \times L$ ✅ |
| V2 | `\frac{a_x h}{g}L` | $a_x h/g \times L$ — 分母只有 $g$ ❌ |

PDF 页 1 清晰显示：$W_f = W\!\left(\dfrac{c}{L} - \dfrac{a_x h}{gL}\right)$

**结论**：使用 V1。

---

## D002 — Ch 2 · 功率公式下标笔误 · ✅ RESOLVED（PDF 确认 V1 正确）

- V1：`\omega_e`（发动机） ✅；V2：`\omega_c`（无意义） ❌
- PDF 页 1 显示 $\omega_e$。**使用 V1**。

---

## D003/D004 — Ch 2 · 格式/顺序问题 · ✅ RESOLVED（仅排版）

V2 的换行合并和标题-公式顺序颠倒均为 OCR 问题。**按 PDF 页 1 排版**。

---

## D005 — Ch 3 · 轴截距公式 · ✅ RESOLVED（PDF 确认正确形式）

PDF 页 2 清晰显示：

$$F_{xfint} = \frac{\mu_p W_{fs}}{1 - \mu_p \dfrac{h}{L}};\qquad F_{xrint} = \frac{\mu_p W_{rs}}{1 + \mu_p \dfrac{h}{L}}$$

两版文本的 LaTeX 均有渲染错误（V1 有 `\overline{{}}` 残留，V2 有 `\overline{{L}}` 错误）。**使用 PDF 原版公式**，不依赖任何文本版本。

---

## D006 — Ch 5 · 非簧载质量固有频率 · ✅ RESOLVED（PDF 确认 V1 正确）

- V1：$f_{nu} = \omega_{nu}/(2\pi)$ ✅；V2：$f_{nu} = \pi\omega_{nu}/2$ ❌
- PDF 页 3 显示 $f_{nu_{f,r}} = \dfrac{1}{2\pi}\omega_{nu_{f,r}}$。**使用 V1**。

---

## D007 — Ch 7 · 四驱独立悬架俯仰角 · ✅ RESOLVED（PDF 确认 **V2 正确**）

| 版本 | LaTeX | 数学含义 |
|------|-------|----------|
| V1 | `\frac{1}{K_r\frac{h}{L}}` | $L/(K_r h)$ ❌ |
| V2 | `\frac{1}{K_r}\frac{h}{L}` | $h/(K_r L)$ ✅ |

PDF 页 5 清晰显示：

$$\theta_p = \frac{1}{L}\frac{W}{g}a_x\left(\frac{1}{K_r}\frac{h}{L} + \frac{1}{K_f}\frac{h}{L} - \frac{(1-\xi)}{K_r}\frac{e_r-r}{d_r} + \frac{\xi}{K_f}\frac{e_f-r}{d_f}\right)$$

**结论**：V2 正确，V1 有括号错误。**使用 PDF 原版 / V2**。

> ⚠️ 注意：D001 中 V1 正确，D007 中 V2 正确。不能笼统说哪个版本全对。

---

## D008 — b/c 符号定义错误 · ✅ RESOLVED（字幕确认，变量表已修正）

课堂字幕明确（约 28 分 36 秒）：
> *"this distance between the front axle and the center of mass is called parameter **B**. And the one between the center of mass and the rear axle is called **C**."*

老师在推导完轴荷后再次强调（约 37 分 53 秒）：
> *"**B is the distance between the front axle and the center of mass**... When you do W_FS, C is gonna come into play. When you do W_RS, B is gonna come into play, **the front distance**."*

正确定义：

| 符号 | 正确含义 | 错误定义（已修正）|
|------|----------|-----------------|
| b | 前轴到质心的距离 | ~~质心到后轴~~ |
| c | 质心到后轴的距离 | ~~质心到前轴~~ |

**VARIABLES.md 中 V003/V004 描述已修正。所有使用 b/c 的公式（F101–F108, F209–F211, Ch 5 bounce/pitch, Ch 6 侧偏角, Ch 7 悬架几何）均基于此正确定义。**

验证：$W_{fs} = W \cdot c/L$（前轴载荷用 c，因为 c 越大代表 CG 越靠近前轴，前轴分担越多重量）✓

---

## D009 — Ch 4 · 滚动阻力图 · 已知限制（非 Bug）

PDF 页 3 包含 f_r 与轮胎充气压力的图表。V2 文本中有图片链接（外部 URL，不可用）。
**v0.1 处理**：实现 Stuttgart/Michigan 解析公式；对于图查情况提示用户手动输入 $f_r$。

---

## D010 — Ch 6 · Ackermann 转向精确公式被丢弃 · ✅ RESOLVED

PDF 页 4 显示精确+近似两个形式：

$$\Delta = R\!\left(1 - \cos\frac{L}{R}\right) \approx \frac{L^2}{2R}$$

**FORMULAS.md 中 F601 同时记录精确式和近似式。适用条件：小角近似 $L/R \ll 1$。**

---

## D011 — Ch 7 · Anti-dive 几何条件 · ✅ RESOLVED（PDF 确认）

PDF 页 5 清晰显示：

$$\frac{e_f}{d_f} = -\frac{h}{\xi L};\qquad \frac{e_r}{d_r} = \frac{h}{(1-\xi)L}$$

`\xi_L`（文本中的写法）是排版问题，正确含义是 $\xi \cdot L$（ξ 乘以 L），不是"ξ 的下标 L"。
**使用 PDF 原版**。

---

## D012 — Ch 2 F210 · 非锁止差速 RWD 公式中 $N_f$ 含义 · ✅ RESOLVED（教材符号表确认）

教材符号表明确定义：
- $N_t$：transmission ratio（变速箱传动比）
- $N_f$：**final drive ratio**（最终传动比，即差速器传动比）
- $N_{tf} = N_t \times N_f$（总传动比）

因此 F210 中 $N_f$ 就是最终传动比，已在变量表新增 **V211**。

注意 V211（$N_f$）≠ V202（$N_{tf}$），F210 **只用** $N_f$，不能用 $N_{tf}$ 代替。

---

## D013 — Ch 6 · $K_{llt}$ 中 "b" 符号冲突 · ✅ RESOLVED（变量 ID 系统已处理）

$K_{llt}$ 公式（**F604** 中）：

$$K_{llt} = \frac{W_f}{C_{\alpha f}}\frac{2b\Delta F_{zf}^2}{C_{\alpha f}} - \frac{W_r}{C_{\alpha r}}\frac{2b\Delta F_{zr}^2}{C_{\alpha r}}$$

此处 "b" 来自轮胎侧偏刚度模型 $C_\alpha' = aF_z - bF_z^2$（V613 b_tire），不是车辆几何参数（V003 前轴到质心）。

**处理方式**：符号显示保留 "b"，程序内部使用不同 Variable ID。实现 **F604** 时引用 V613（b_tire），不使用 V003（b）。不阻断任何公式实现。

---

## D014 — Ch 3 · 制动助力公式 $K_{boost}$ 量纲 · ✅ RESOLVED（字幕课堂例子确认）

老师课堂例子：100 lb 踏板力 → 1200 psi 主缸压力，因此每 1 lb 对应 12 psi。

**已确认定义（采用定义 B）**：

$K_{boost\_{100}}$ = 100 lb 踏板力所对应的主缸压力，**单位：psi**（不是无量纲）

$$p_{mc}[\text{psi}] = K_{boost\_100}[\text{psi}] \times \frac{F_{pedal}[\text{lb}]}{100[\text{lb}]}$$

量纲验证：$[\text{psi}] \times [\text{lb}]/[\text{lb}] = [\text{psi}]$ ✓

**SI canonical**：$p_{mc}[\text{Pa}] = K_{boost\_100}[\text{psi}] \times 6894.76 \times F_{pedal}[\text{N}]/(100 \times 4.448)$

变量表：V305 `K_boost_100`，单位 psi（不是无量纲），含义"100 lbf 踏板力对应的主缸压力"。

---

## D015 — Ch 3 · 制动力公式"单轮 vs 整轴" · ✅ RESOLVED（字幕课堂明确）

老师课堂明确：$F_{b,disk} = 2T_{disk}/r_w$ 中"2"代表**同轴左右两个车轮**，结果是**整轴制动力**。

- $T_{disk}$ = 单个车轮制动盘产生的扭矩（$N_{pad}$ 已处理单制动器内多摩擦片）
- $F_{b,disk} = 2T_{disk}/r_w$ = 该车轴（左+右）合计盘式制动力
- 鼓式同理：$T_{drum}$ 为单轮扭矩，$F_{b,drum} = 2T_{drum}/r_w$ 为整轴合力

**变量表已按此更新命名**：V315/T_disk（单轮）、V316/F_b_disk_axle（整轴）、V321/V322 同理。

---

## 汇总表

| ID | 章节 | 严重程度 | 状态 |
|----|------|---------|------|
| D001 | Ch 1 加速轴荷 | 🔴 Critical | ✅ V1 正确（PDF） |
| D002 | Ch 2 功率下标 | 🟡 Minor | ✅ V1 正确（PDF） |
| D003/D004 | Ch 2 格式 | ⚪ Cosmetic | ✅ 按 PDF 排版 |
| D005 | Ch 3 轴截距 | 🔴 Critical | ✅ PDF 已确认 |
| D006 | Ch 5 非簧载频率 | 🔴 Critical | ✅ V1 正确（PDF） |
| D007 | Ch 7 俯仰角 | 🔴 Critical | ✅ **V2 正确**（PDF） |
| D008 | b/c 符号定义 | 🔴 Critical | ✅ 字幕确认，已修正 |
| D009 | Ch 4 滚动阻力图 | 🟡 Limitation | 已知限制 |
| D010 | Ch 6 Ackermann 精确式 | 🟡 Completeness | ✅ 两式均已收录 |
| D011 | Ch 7 Anti-dive | 🟡 Ambiguous | ✅ PDF 确认 ξ·L |
| D012 | Ch 2 F210 $N_f$ | 🟡 Minor | ✅ 教材确认 = 最终传动比 |
| D013 | Ch 6 F604 b_tire 冲突 | 🟡 Symbol | ✅ 变量 ID 系统已处理 |
| D014 | Ch 3 $K_{boost}$ 量纲 | 🟡 Units | ✅ 字幕确认：单位 psi |
| D015 | Ch 3 制动力 单轮/整轴 | 🟡 Semantics | ✅ 字幕确认：整轴合力 |

**所有已知差异条目已全部关闭。Phase 2 文档无 PENDING 项。**

---

## 公式 ID 命名约定

所有三份文档（FORMULAS.md、FORMULA_NOTES.md、DISCREPANCIES.md）使用同一套 ID：

| 章节 | 范围 |
|------|------|
| Ch 1 | F101–F108 |
| Ch 2 | F201–F211 |
| Ch 3 | F301–F315 |
| Ch 4 | F401–F412 |
| Ch 5 | F501–F511 |
| Ch 6 | F601–F612（F601=Δ偏移，F602=低速转向角，F603=高速转向角，F604=K_us分量）|
| Ch 7 | F701–F707 |
| Ch 9 | F901–F903 |
