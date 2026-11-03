// ตรวจข้อมูลสมัครสมาชิกแบบเดียวกับหน้าเว็บ (เครื่องมือทดสอบ/สคริปต์ CI)
// คอมไพล์: g++ -O2 -o validate validate.cpp   ใช้: ./validate "xbox" 18 "นามแฝง" "a@b.com" "password"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
using namespace std;
static bool email_ok(const string& e){size_t at=e.find('@');if(at==string::npos||at==0||at>64)return false;size_t dot=e.find('.',at);return dot!=string::npos&&dot>at+1&&dot<e.size()-1&&e.find(' ')==string::npos;}
int main(int c,char**v){
  if(c!=6){puts("usage: validate xbox age alias email password");return 2;}
  string x=v[1],al=v[3],em=v[4],pw=v[5];int age=atoi(v[2]);int bad=0;
  if(x.empty()||x.size()>32){puts("xbox: 1-32 ตัวอักษร");bad++;}
  if(age<1||age>150){puts("อายุ(oc): 1-150");bad++;}
  if(al.empty()||al.size()>32){puts("นามแฝง: 1-32 ตัวอักษร");bad++;}
  if(!email_ok(em)){puts("อีเมลไม่ถูกต้อง");bad++;}
  if(pw.size()<8){puts("รหัสผ่านอย่างน้อย 8 ตัว");bad++;}
  if(!bad)puts("OK");return bad?1:0;}
