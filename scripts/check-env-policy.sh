#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail(){ echo "static-site env policy: $*" >&2; exit 1; }
for f in .gitignore .gitattributes .sops.yaml .env.example justfile env/README.md scripts/verify-sops-release-policy.py; do test -f "$f" || fail "missing $f"; done
git check-ignore --no-index -q .env || fail ".env not ignored"
git check-ignore --no-index -q nested/sample.env.local || fail "nested dotenv not ignored"
git check-ignore --no-index -q env/dec/dev.env || fail "env/dec not ignored"
! git check-ignore --no-index -q env/enc/dev.env.enc || fail "dev ciphertext ignored"
! git check-ignore --no-index -q env/enc/prod.env.enc || fail "prod ciphertext ignored"
grep -Fq 'path_regex: ^env/enc/dev\.env\.enc$' .sops.yaml || fail "missing dev rule"
grep -Fq 'path_regex: ^env/enc/prod\.env\.enc$' .sops.yaml || fail "missing prod rule"
python3 scripts/verify-sops-release-policy.py .sops.yaml prod
while IFS= read -r -d '' p; do case "$p" in env/enc/dev.env.enc|env/enc/prod.env.enc) ;; env/enc/*) fail "unexpected encrypted path $p" ;; .env|*.env|.env.*|*.env.*|env/dec/*) case "$p" in .env.example|*/.env.example) ;; *) fail "tracked plaintext $p" ;; esac ;; esac; done < <(git ls-files -z)
age_private='AGE-SE''CRET-KEY-1'
pem_private='-----BEGIN ''PRIVATE KEY-----'
openssh_private='-----BEGIN OPENSSH ''PRIVATE KEY-----'
if git grep -I -q -e "$age_private" -e "$pem_private" -e "$openssh_private" -- .; then fail "private-key material detected"; fi
variables=$(awk -F= '/^[A-Z][A-Z0-9_]*=/{print $1}' .env.example | sort -u)
expected_variables=$(printf '%s\n' 'PUBLIC_DASHBOARD_URL' 'PUBLIC_DASHBOARD_URL_ALLOWLIST' 'PUBLIC_TURNSTILE_SITE_KEY')
test "$variables" = "$expected_variables" || fail "static-site schema may contain only the dashboard metadata and public Turnstile site key"
grep -Fxq 'PUBLIC_TURNSTILE_SITE_KEY=' .env.example || fail "the example Turnstile site key must remain blank"
for forbidden in DATABASE_URL SENDGRID TWILIO SERVICE_ROLE SIGNING_KEY PRIVATE_KEY SECRET_KEY CLIENT_SECRET TOKEN SECRET AWS_ CLOUDFLARE_; do ! grep -Eq "^[A-Z0-9_]*${forbidden}[A-Z0-9_]*=" .env.example || fail "credential variable forbidden in static-site schema: $forbidden"; done
# Pages deployment must remain keyless; do not introduce a SOPS decrypt step.
if grep -RIEq '(^|[[:space:]])(sops|ores-sops)[[:space:]].*(decrypt|exec-env|use)' .github/workflows; then fail "Pages workflows must not decrypt environment profiles"; fi
echo "credential-free static-site environment policy is valid"
