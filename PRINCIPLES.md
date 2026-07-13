# PRINCIPLES — 工程与 AI 治理原则
**Engineering & AI-Governance Principles**

> **What this is.** Ten portable principles for human-directed, AI-executed engineering work — each born from a real incident in this project — plus the project-specific gates that enforce them. Layer 1 travels to the next project unchanged; Layer 2 is re-instantiated per project. A principle without an enforcing gate is treated as not yet closed.

本文件双层：**上层为可移植原则**（项目无关，下个项目原样搬走），**下层为本项目闸门**（逐条挂靠原则、可机器检查）。每条原则附出生记录——它们不是抄来的格言，是这个项目里真实发生过的事。出生记录在本公开文件中按脱敏模式书写（依 G8）；完整事件细节存于私有决策日志。

本文件自身也是一次事件的产物（见 P10 出生记录）。修订经 git 追溯，新增条目须带日期。

---

## 上层：可移植原则（Layer 1 — Portable Principles）

**P1 · Decisions precede code; one named owner; every decision logged.**
决定先于代码；唯一决策人；每个决定以决策人自己的话入日志。
实现可以外包，判断不能。"拥有一个项目"的判据不是读过每一行代码，而是知道自己批过哪些决定、并能复述其理由。
出生记录：项目早期一次 AI 会话越权做产品决定、边规划边写码，导致返工——本工作流据此建立；"知道自己批了什么"的判据成文于 2026-07。

**P2 · Keep the behavior space finite and enumerable.**
行为空间必须有限、可枚举：能力只能经登记获得，不得运行时即兴发明。
可验证性来自有限性——行为空间一旦无穷，任何测试集当场失效。想要新能力，走登记流程，不走"顺手实现"。
出生记录：关于"自动代数反解"的争论——放开即兴求解将使验收基准瞬间作废；共识落为"只登记源材料实际使用过的方向"（2026-07）。

**P3 · Verify against evidence that predates the system.**
验收基准取自系统诞生之前、独立于实现者的外部证据。
先于项目存在的材料不可能被项目污染；尺子不在被量的东西旁边打造。
出生记录："复杂度超出直接理解"的失控危机，以数年前经批改的课程作业为验收基准而化解（2026-07）。

**P4 · Test the refusals, not only the answers.**
规格的一半是"必须拒绝什么"。只测正向，一个到处越权的实现也能全部通过。
每条禁止性规则至少配一道负向／行为断言用例；"正确地拒绝"与"正确地计算"同等入库。
出生记录：验收设计阶段发现既有测试全为正向题，据此建立镜像用例制度（2026-07）。

**P5 · Record faithfully, judge explicitly; never loosen criteria to bury a conflict.**
誊录不纠错，判定不含糊；冲突以证据与内部自洽裁决，禁止放宽标准和稀泥。
"来源写了什么"与"系统必须复现什么"是两个问题：前者照录存档，后者单列判定值并署裁定依据。数据自身的下游结果是最有力的证人。
出生记录：一次源材料内部不一致的裁决——同页三处下游结果一致驳倒其中间量写法，判定值据内部自洽改定，而非放宽容差（2026-07）。

**P6 · Separate the examiner from the implementer.**
出题人、判卷人与考生互相隔离：实现方不得起草或控制验收标准，且验收保留实现方事先不可见的检验手段。
共享上下文即共享盲区；独立复核必须是独立实现，而非对同一份代码的第二次阅读。
出生记录：双 AI 分工（执行者／评审者）设立之初；预留密题因源材料曝光而换防，后由独立脚本的现场出题能力接管（2026-07）。

**P7 · AI verifies inside its quadrant; consequence judgment stays human.**
AI 可靠于内向校验（对照既定标准：数值、格式、逻辑一致性）；发布、隐私、对人的后果等外向判断必须留给人——人是最后一道防线，且必须真实在岗。
出生记录：一次隐私疏漏在两道 AI 校验放行之后由人拦下（2026-07-13）；本文件的直接起因。

**P8 · Split public value from private provenance — default private.**
一切产物默认拆分：价值数据（脱敏的输入、期望、结论）可公开；出处、第三方知识产权、身份信息永久私有。公共侧维护"禁现清单"，逐次提交前扫描。
出生记录：同 P7 事件——公开侧误含原始文件名、第三方解答重建与个人签字，整改建立公私双轨（2026-07-13）。

**P9 · Ship a bounded whole; set a redline with an unconditional stop.**
交付一个有边界的完整物，胜过一个雄心勃勃的半成品。设红线日期与无条件停机条款——超期即停、如实归档，把不确定性变成有界风险。
出生记录：项目两次动摇均以收窄终点而非放弃化解；红线条款成文于 2026-07。

**P10 · Every incident becomes a permanent gate.（元原则）**
留在对话里的教训等于没有教训。每次事件三件套：记录事实、在本文件新增或修订条目（带日期）、落成机器可查的闸门。无闸门的教训视为未关闭。
出生记录：P7/P8 事件后的追问——"为什么没有一份文件记录这些规矩"；本文件即答案（2026-07-13）。

---

## 下层：本项目闸门（Layer 2 — Project Gates）

| 闸门 | 挂靠 | 内容（可检查） |
|---|---|---|
| G1 | P1 | 每个产品决定入 DECISIONS.md（私有），含决策人与日期；无对应决策记录的范围变更不得实现。 |
| G2 | P2 | 引擎实现冻结 data/ 与 schemas/（引擎适配数据，不反向）；engine-config 之 `allow_automatic_algebraic_inversion = false` 永不翻转；新增公式／变量／单位／模型／方向的唯一途径＝新登记记录＋决策日志。 |
| G3 | P3 | 验收题库来源仅限：源材料誊录（按权威序标注）或评审方自命题（reviewer-computed）；实现会话禁读 validation/raw/ 与 validation/private/。 |
| G4 | P4 | 每条禁止性规则至少一道负向／行为断言用例；现役：未注册方向查询断言、缺输入诊断断言、低速域只存不判。 |
| G5 | P5 | 用例模板强制三列语义：稿面照录／判定值／依据与裁定；容差铁律（禁以放宽掩盖冲突）常驻验收语义总则。 |
| G6 | P6 | 执行与评审为不同会话／系统；独立复核脚本由评审方维护、实现方不得改动；验收含实现方事先不可见的现场出题环节。 |
| G7 | P7 | 停报条件（触碰 data/schemas、范围变更、不可自洽裁决的冲突、偏离既定语义）及一切发布类动作一律停下等人；里程碑检查点报告制度。 |
| G8 | P8 | 公共侧禁现清单：课程编号、学校名、作业／考试编号、原始文件名、第三方解答步骤与笔迹叙述、个人签字、raw／private 路径、本机路径。每次 commit 前全库扫描；validation/raw/ 与 validation/private/ 永久 gitignore；署名仅限 README 作者栏。 |
| G9 | P9 | 红线日期与无条件停机条款写入 README 里程碑；范围变更只减不增，且须有决策记录。 |
| G10 | P10 | 事件闭环三件套齐备方可销案：事实记录（登记册或私有事件档）＋本文件条目（带日期）＋对应闸门。 |

---

修订记录：2026-07-13 v1.0 建档（起草：评审方；批准：项目决策人）。
