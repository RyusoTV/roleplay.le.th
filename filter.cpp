// C++ ตรวจสแปม -> WebAssembly:
// emcc cpp/filter.cpp -O2 --no-entry -s EXPORTED_FUNCTIONS="['_is_spam']" -o filter.wasm
#include <cstring>
extern "C" int is_spam(const char* s){
  int n=strlen(s), run=1, mx=1, caps=0, letters=0;
  for(int i=0;i<n;i++){ if(i&&s[i]==s[i-1]){run++; if(run>mx)mx=run;} else run=1;
    if(s[i]>='A'&&s[i]<='Z')caps++; if((s[i]|32)>='a'&&(s[i]|32)<='z')letters++; }
  return (mx>=25) || (letters>20 && caps*10>letters*9);
}
