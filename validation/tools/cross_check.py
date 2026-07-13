#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cross_check.py — 验收套件独立复核脚本（独立于 JS 引擎实现）
用注册公式 F001–F008 的英制原生形，从 validation/acceptance/cases.v0.1.json
所载各匿名用例（A1–A8）的入库输入直接重算期望值，按容差比对。
任何 FAIL 退出码非零。
重力使用引擎注册常量 9.80665 m/s²（折 32.174 ft/s²），
因此 PASS 含义 = 「正确实现的引擎输出将落在判定值容差内」。
用法:  python cross_check.py
"""
import math, sys

G_FT = 9.80665 / 0.3048          # 32.17405 ft/s^2（引擎常量折英制）
MPH_TO_FTS = 5280.0 / 3600.0     # 1.46667

# ---- 注册公式（英制原生独立实现） ----
def F001(w_mm, ar_dec, rim_in):            # wheel radius [in]
    return w_mm * ar_dec / 25.4 + rim_in / 2.0
def F002(r_ft, rpm, N):                    # vehicle speed [ft/s]
    return r_ft * (rpm * 2.0 * math.pi / 60.0) / N
def F003(T_ftlb, rpm):                     # engine power [HP]
    return T_ftlb * rpm / 5252.0
def F004(T_ftlb, N, eta, r_ft):            # tractive force [lb]
    return T_ftlb * N * eta / r_ft
def F005(N):                               # mass factor [-]
    return 1.0 + 0.04 * N + 0.0025 * N * N
def F006(W_lb):                            # vehicle mass [slug]
    return W_lb / G_FT
def F007(Fx, DA, Rx, W, theta_rad, Rhx, Mf, M):   # accel [ft/s^2]
    return (Fx - DA - Rx - W * math.sin(theta_rad) - Rhx) / (Mf * M)
def F008(P_hp, V_fts, M_slug):             # ideal const-power accel [ft/s^2]
    return 550.0 * P_hp / (V_fts * M_slug)

results = []
def check(case, name, got, exp, tol=0.01):
    dev = abs(got - exp) / abs(exp)
    results.append((case, name, got, exp, dev, dev <= tol))

# ---------- A1 ----------
r_in = F001(235, 0.45, 18); r_ft = r_in / 12.0
check("A1-a", "wheel_radius [in]", r_in, 13.16)
check("A1-a", "vehicle_speed [mph]", F002(r_ft, 15800, 9) / MPH_TO_FTS, 137.5)
check("A1-a", "engine_power [HP]", F003(34.54, 15800), 103.9)
Fx_b = F004(310, 9, 0.92, r_ft)
Mf_b = F005(9)
M_b  = F006(3686)
check("A1-b", "tractive_force [lb]", Fx_b, 2339.95)
check("A1-b", "mass_factor [-]", Mf_b, 1.5625)
check("A1-b", "vehicle_mass [slug]", M_b, 114.472)
check("A1-b", "long_accel [ft/s2]", F007(Fx_b, 0, 0, 3686, 0, 0, Mf_b, M_b), 13.08)
check("A1-c1", "vehicle_speed [mph]", F002(r_ft, 4800, 9) / MPH_TO_FTS, 41.77)
check("A1-c2", "vehicle_speed [mph]", F002(r_ft, 5800, 9) / MPH_TO_FTS, 50.47)

# ---------- A2 ----------
check("A2", "wheel_radius [in]", F001(225, 0.70, 20), 16.2)
check("A2", "vehicle_mass [slug]", F006(14410), 447.52)

# ---------- A3 ----------
r3_ft = F001(225, 0.70, 20) / 12.0
Fx_3 = F004(590.963, 3.5136, 0.9, r3_ft)
Mf_3 = F005(3.5136)
M_3  = F006(14410)
check("A3", "tractive_force [lb]", Fx_3, 1384.429)
check("A3", "mass_factor [-]", Mf_3, 1.17141)
check("A3", "vehicle_mass [slug]", M_3, 447.516)
check("A3", "long_accel [ft/s2]",
      F007(Fx_3, 309.510, 187.33, 14410, math.atan(0.05), 0, Mf_3, M_3), 0.319)

# ---------- A4 ----------
r4_in = F001(225, 0.60, 17); r4_ft = r4_in / 12.0
Fx_4 = F004(177.1, 2.428, 0.9, r4_ft)
Mf_4 = F005(2.428)
M_4  = F006(3500)
check("A4-1", "wheel_radius [in]", r4_in, 13.82)
check("A4-1", "tractive_force [lb]", Fx_4, 336.23)
check("A4-1", "mass_factor [-]", Mf_4, 1.11)
check("A4-1", "vehicle_mass [slug]", M_4, 108.7)
check("A4-1", "long_accel [ft/s2]", F007(Fx_4, 0, 0, 3500, 0, 0, Mf_4, M_4), 2.78)
check("A4-2", "long_accel [ft/s2]",
      F007(Fx_4, 0, 0, 3500, 0.1, 0, Mf_4, M_4), -0.109)

# ---------- A6 / A8 ----------
check("A6", "long_accel [ft/s2]",
      F008(103.9, 137.5 * MPH_TO_FTS, 114.472), 2.475)
check("A8", "engine_power [HP]", F003(310, 4800), 283.3)

# ---------- 报告 ----------
w = max(len(c + "  " + n) for c, n, *_ in results)
fails = 0
print("=" * (w + 44))
for c, n, got, exp, dev, ok in results:
    tag = "PASS" if ok else "FAIL"
    if not ok:
        fails += 1
    print(f"{(c + '  ' + n).ljust(w)}  got={got:12.5f}  exp={exp:10.4f}  dev={dev*100:6.3f}%  {tag}")
print("=" * (w + 44))
print("行为断言/无判定值用例（脚本不判）：A5（候选路径+缺输入清单断言）、A7（低速只存不判，待第 5 支阈值政策）")
print(f"合计 {len(results)} 项判定，FAIL = {fails}")
sys.exit(1 if fails else 0)
