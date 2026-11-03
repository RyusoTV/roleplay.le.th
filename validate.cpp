// em++ validate.cpp -O2 -o validate.wasm --no-entry -s STANDALONE_WASM
// ตรวจตัวอักษรที่อนุญาตในชื่อ Xbox (A-Z a-z 0-9 เว้นวรรค _ . -)
#include <emscripten.h>
extern "C" EMSCRIPTEN_KEEPALIVE int ok_char(int c){
  return (c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c==' '||c=='_'||c=='.'||c=='-';
}
