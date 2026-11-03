/* ตัวกรองคำต้องห้าม (C) คอมไพล์เป็น WebAssembly:
   emcc filter.c -O2 -o filter.js -s MODULARIZE=1 -s EXPORT_NAME=createFilter -s EXPORTED_FUNCTIONS=_has_bad -s EXPORTED_RUNTIME_METHODS=ccall
   วาง filter.js + filter.wasm ไว้โฟลเดอร์เดียวกับ index.html (ถ้าไม่มี เว็บยังทำงานได้ตามปกติ) */
#include <string.h>
#include <ctype.h>
static const char *W[] = {"badword1", "badword2"}; /* แก้รายการคำตามต้องการ */
int has_bad(const char *s) {
  char b[512]; size_t n = strlen(s); if (n > 511) n = 511;
  for (size_t i = 0; i < n; i++) b[i] = tolower((unsigned char)s[i]);
  b[n] = 0;
  for (size_t i = 0; i < sizeof W / sizeof *W; i++) if (strstr(b, W[i])) return 1;
  return 0;
}
