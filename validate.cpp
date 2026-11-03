// ตรวจข้อมูลสมัครเบื้องต้นจากบรรทัดคำสั่ง (ตัวอย่างการใช้ C++ ในโปรเจกต์)
// build: g++ -O2 -o validate validate.cpp
// use:   ./validate "ชื่อ" 18 "password123"   (exit 0 = ผ่าน)
#include <cctype>
#include <cstdlib>
#include <iostream>
#include <string>
int main(int argc, char** argv) {
    if (argc < 4) { std::cerr << "usage: validate NAME AGE PASSWORD\n"; return 2; }
    std::string name = argv[1], pw = argv[3];
    int age = std::atoi(argv[2]);
    bool digit = false, alpha = false;
    for (unsigned char c : pw) { digit |= std::isdigit(c) != 0; alpha |= std::isalpha(c) != 0; }
    if (name.empty() || name.size() > 90) { std::cout << "ชื่อไม่ถูกต้อง\n"; return 1; }
    if (age < 1 || age > 120)             { std::cout << "อายุไม่ถูกต้อง\n"; return 1; }
    if (pw.size() < 8 || !digit || !alpha) { std::cout << "รหัสผ่านต้องยาว 8+ และมีทั้งตัวอักษรและตัวเลข\n"; return 1; }
    std::cout << "ผ่าน\n";
    return 0;
}
