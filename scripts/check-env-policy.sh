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
if git grep -I -q -e 'AGE-SE''CRET-KEY-1' -e '-----BEGIN PRIVATE KEY-----' -e '-----BEGIN OPENSSH PRIVATE KEY-----' -- .; then fail "private-key material detected"; fi
variables=$(awk -F= '/^[A-Z][A-Z0-9_]*=/{print $1}' .env.example | sort -u)
test "$variables" = 'PUBLIC_DASHBOARD_URL' || fail "static-site schema may contain only PUBLIC_DASHBOARD_URL"
for forbidden in DATABASE_URL SENDGRID TWILIO SERVICE_ROLE SIGNING_KEY TOKEN SECRET KEY AWS_ CLOUDFLARE_; do ! grep -Eq "^[A-Z0-9_]*${forbidden}[A-Z0-9_]*=" .env.example || fail "credential variable forbidden in static-site schema: $forbidden"; done
# Pages deployment must remain keyless; do not introduce a SOPS decrypt step.
if grep -RIEq '(^|[[:space:]])(sops|ores-sops)[[:space:]].*(decrypt|exec-env|use)' .github/workflows; then fail "Pages workflows must not decrypt environment profiles"; fi
echo "credential-free static-site environment policy is valid"
