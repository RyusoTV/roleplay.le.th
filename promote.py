"""Set a user's rank by alias, using the Supabase REST API with the service_role key.

Run this on YOUR machine only. The service_role key bypasses RLS: never put it in
the browser code, the repo, or a commit. Store it in an env var or a GitHub secret.

Usage:
    export SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
    export SUPABASE_SERVICE_KEY="eyJ..."          # Settings > API > service_role
    python scripts/promote.py some_alias staff
    python scripts/promote.py some_alias --ban
"""
import os
import re
import sys

import requests

ROLES = {"member", "staff", "admin", "vice_ceo", "ceo"}
ALIAS_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 3:
        die("usage: promote.py <alias> <role|--ban|--unban>")

    alias, action = sys.argv[1], sys.argv[2]
    if not ALIAS_RE.match(alias):
        die("alias must be 3-20 characters: a-z, 0-9, _")

    if action in ("--ban", "--unban"):
        patch = {"banned": action == "--ban"}
    elif action in ROLES:
        patch = {"role": action}
    else:
        die(f"unknown action '{action}'. Use one of: {', '.join(sorted(ROLES))}, --ban, --unban")

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not base or not key:
        die("set SUPABASE_URL and SUPABASE_SERVICE_KEY first")

    # ilike with escaped underscore so "user_1" does not match "userX1"
    pattern = alias.replace("_", r"\_")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = requests.patch(
        f"{base}/rest/v1/profiles",
        params={"alias": f"ilike.{pattern}"},
        json=patch,
        headers=headers,
        timeout=15,
    )
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        die("no profile with that alias")
    print(f"updated {len(rows)} profile(s): {patch}")


if __name__ == "__main__":
    main()
