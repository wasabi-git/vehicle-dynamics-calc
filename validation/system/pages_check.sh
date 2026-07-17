#!/bin/sh
# pages_check.sh <path...> — GitHub Pages 内容指纹核验（只读，fail-closed）
# 在仓库根以 Git Bash 执行：sh validation/system/pages_check.sh path1 path2 ...
# 判定：sha256(git show HEAD:path) 与 sha256(线上同路径响应体) 逐字相等。
# 抗缓存：每路径唯一 nonce 查询串 + no-cache 请求头 + 跟随重定向
#（线上实测 Cache-Control: max-age=600，唯一查询串为可靠绕缓存手段）。
# 网络时限：--connect-timeout 10 --max-time 60（D60 第 4 项）。
# 退出码：0=PASS；1=FAIL（任一指纹不一致）；2=ERROR（git/网络/工具/空哈希异常）
set -u
BASE="https://wasabi-git.github.io/vehicle-dynamics-calc"
[ "$#" -ge 1 ] || { echo "PAGES ERROR: no paths given"; exit 2; }
HEADSHA="$(git rev-parse HEAD)" || { echo "PAGES ERROR: git rev-parse failed"; exit 2; }
NONCE="$(date +%s)-$$" || { echo "PAGES ERROR: date failed"; exit 2; }
echo "HEAD = $HEADSHA"
fail=0
i=0
for p in "$@"; do
  i=$((i+1))
  T="$(mktemp)" || { echo "PAGES ERROR: mktemp"; exit 2; }
  R="$(mktemp)" || { echo "PAGES ERROR: mktemp"; rm -f "$T"; exit 2; }
  git show "HEAD:$p" >"$T" || { echo "PAGES ERROR: git show $p"; rm -f "$T" "$R"; exit 2; }
  curl -fsSL --connect-timeout 10 --max-time 60 -H "Cache-Control: no-cache" -H "Pragma: no-cache" \
    "$BASE/$p?nonce=$NONCE-$i" -o "$R" \
    || { echo "PAGES ERROR: fetch $p"; rm -f "$T" "$R"; exit 2; }
  LH="$(sha256sum <"$T")" || { echo "PAGES ERROR: sha256 local $p"; rm -f "$T" "$R"; exit 2; }
  RH="$(sha256sum <"$R")" || { echo "PAGES ERROR: sha256 remote $p"; rm -f "$T" "$R"; exit 2; }
  rm -f "$T" "$R"
  LH="${LH%% *}"; RH="${RH%% *}"
  { [ "${#LH}" -eq 64 ] && [ "${#RH}" -eq 64 ]; } || { echo "PAGES ERROR: bad hash length $p"; exit 2; }
  if [ "$LH" = "$RH" ]; then
    echo "PASS  $p  $LH"
  else
    echo "FAIL  $p  local=$LH remote=$RH"
    fail=1
  fi
done
if [ "$fail" -eq 0 ]; then echo "PAGES FINGERPRINT PASS"; else echo "PAGES FINGERPRINT FAIL"; fi
exit "$fail"
