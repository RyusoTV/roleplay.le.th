// alias_check: validates LuminaEther aliases with the same rules as the web form and the DB.
//
//   g++ -std=c++17 -O2 -Wall -Wextra -o alias_check native/alias_check.cpp
//   ./alias_check --test          # run built-in tests (used by CI)
//   echo "some_name" | ./alias_check   # one alias per line, prints OK or REJECT
#include <cctype>
#include <iostream>
#include <set>
#include <string>

namespace {

const std::set<std::string> kReserved = {
    "admin", "ceo", "staff", "lumina", "luminaether", "system"};

// Returns an empty string when the alias is valid, otherwise the reason.
std::string check_alias(const std::string& s) {
    if (s.size() < 3 || s.size() > 20) return "length must be 3-20";
    for (unsigned char c : s) {
        if (!(std::isalnum(c) || c == '_')) return "only a-z, 0-9 and _ are allowed";
    }
    std::string lower = s;
    for (auto& c : lower) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    if (kReserved.count(lower)) return "reserved name";
    return "";
}

int run_tests() {
    struct Case { std::string input; bool valid; };
    const Case cases[] = {
        {"abc", true},
        {"user_01", true},
        {"A_B_C_D_E_F_G_H_I_J", true},  // 19 chars
        {"ab", false},                  // too short
        {"abcdefghijklmnopqrstu", false},  // 21 chars
        {"a-b-c", false},
        {"hello world", false},
        {"Admin", false},               // reserved, case-insensitive
        {"CEO", false},
        {"\xE0\xB8\xAA\xE0\xB8\xA7", false},  // Thai letters are not allowed
    };

    int failed = 0;
    for (const auto& c : cases) {
        const bool ok = check_alias(c.input).empty();
        if (ok != c.valid) {
            std::cerr << "FAIL: '" << c.input << "' expected " << (c.valid ? "valid" : "invalid") << "\n";
            ++failed;
        }
    }
    if (failed == 0) std::cout << "all " << (sizeof(cases) / sizeof(cases[0])) << " tests passed\n";
    return failed == 0 ? 0 : 1;
}

}  // namespace

int main(int argc, char** argv) {
    if (argc > 1 && std::string(argv[1]) == "--test") return run_tests();

    std::string line;
    while (std::getline(std::cin, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        const std::string reason = check_alias(line);
        if (reason.empty()) {
            std::cout << "OK " << line << "\n";
        } else {
            std::cout << "REJECT " << line << " (" << reason << ")\n";
        }
    }
    return 0;
}
