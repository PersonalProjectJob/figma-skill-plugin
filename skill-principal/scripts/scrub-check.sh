#!/usr/bin/env bash
# scrub-check.sh — cổng chống rò rỉ cho package public.
#
# Chạy TRƯỚC mỗi commit và trong CI. Fail (exit 1) nếu tìm thấy bất kỳ token
# nhận dạng nào: tên client, tên người thật, đường dẫn máy, id vận hành nội bộ.
#
#   bash scripts/scrub-check.sh          # quét toàn bộ package
#   bash scripts/scrub-check.sh path...  # quét file/thư mục cụ thể
#
# Vì sao cần script: bản scrub đầu tiên luôn sạch. Rò rỉ xảy ra ở commit thứ 5,
# khi ai đó paste lại một đoạn từ repo nội bộ. Đừng dựa vào mắt người.

set -uo pipefail

# Không có tham số  -> quét cả package (đường dẫn suy từ vị trí script).
# Có tham số        -> quét đúng path đó, hiểu theo cwd của người gọi (KHÔNG cd).
if [ "$#" -eq 0 ]; then
  cd "$(dirname "$0")/.." || exit 2
  TARGETS=(".")
else
  TARGETS=("$@")
fi

# Path không tồn tại phải là lỗi cứng. Nếu bỏ qua, grep fail trong im lặng và
# script in "OK" cho một thứ nó chưa bao giờ đọc — false pass nguy hiểm hơn không có gate.
for t in "${TARGETS[@]}"; do
  if [ ! -e "$t" ]; then
    echo "ERROR: không tìm thấy '$t' (cwd: $PWD)" >&2
    exit 2
  fi
done

# Mỗi dòng: <nhãn>|<regex ERE>
DENYLIST=(
  "tên client/org|vlink|nexora|NEXORA"
  "domain nội bộ|nexoratouch|vlinkhub"
  "tên người thật|SotaThao|pthngoc|tnsthao94"
  "đường dẫn máy|C:.(Users|Shared).[^<]|/c/Users/|Users.AD|Obsidian.shancao"
  "id vận hành|Thread [0-9]{3}|\(#5[0-9]\)"
  "ticket/vòng nội bộ|Round[[:space:]]+[0-9]"
  "epic nội bộ|community-341"
  "codename model nội bộ|gpt-5\.[0-9]+-(sol|terra|luna)"
  "email/credential|@gmail|@vlink|(api_secret|api_key|password|token)[[:space:]]*[:=][[:space:]]*['"'"'\"][^'"'"'\"<$]{8,}|Bearer [A-Za-z0-9]{8,}|[0-9]{8,10}:[A-Za-z0-9_-]{30,}"
)

fail=0
for entry in "${DENYLIST[@]}"; do
  label="${entry%%|*}"
  pattern="${entry#*|}"
  # Bỏ qua bundle sinh tự động: chúng build từ src (đã quét), và code minified
  # match ngẫu nhiên mọi pattern credential -> nhiễu tới mức gate thành vô dụng.
  hits=$(grep -rInE --exclude-dir=.git --exclude-dir=dist --exclude-dir=build     --exclude-dir=node_modules --exclude="*.min.*" --exclude="scrub-check.sh"     "$pattern" "${TARGETS[@]}" 2>/dev/null)
  if [ -n "$hits" ]; then
    echo "FAIL [$label]"
    echo "$hits" | sed 's/^/    /'
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "OK — không tìm thấy token nhận dạng nào trong ${TARGETS[*]}"
else
  echo
  echo "Sửa các dòng trên trước khi commit. Bảng thay thế nằm trong docs/case-study-brief.md §Denylist."
fi
exit "$fail"
