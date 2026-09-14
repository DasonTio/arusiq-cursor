#!/bin/sh
# afterFileEdit hook — the Cursor half of the enforcement loop.
#
# .claude/settings.json hooks do NOT run in Cursor. Without this, a Cursor agent
# can write hundreds of lines of token-violating, unlabelled, hardcoded-English
# JSX and nothing objects until someone manually runs `npm run verify`.
#
# Schema and event name verified against the installed Cursor CLI
# (2026.04.29): `afterFileEdit`, payload key `file_path`, config `.cursor/hooks.json`
# of the form { "version": 1, "hooks": { "<event>": [ { "type": "command", ... } ] } }.
#
# Exits 0 deliberately. This is an *after* hook: the edit has already happened,
# so the job is to make the violation impossible to miss, not to abort the turn.
# The hard gates are the pre-commit hook and CI. If violations are not surfacing
# in your Cursor build, flip the final `exit 0` to `exit 1`.

cd "$(dirname "$0")/../.." || exit 0

PAYLOAD=$(cat)
FILE=$(printf '%s' "$PAYLOAD" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# Only lint what these verifiers understand.
case "$FILE" in
  *.ts|*.tsx|*.css) ;;
  "") ;;                      # payload shape changed — run anyway, cheap
  *) exit 0 ;;
esac

OUT=$( { node tools/verify-tokens.mjs; node tools/verify-provenance.mjs; node tools/verify-i18n.mjs; } 2>&1 )
STATUS=$?

# tokens.css drives the whole contrast matrix; re-derive it when it changes.
case "$FILE" in
  *design-system/tokens.css)
    CONTRAST=$(node tools/verify-contrast.mjs 2>&1) || {
      OUT="$OUT
$CONTRAST"
      STATUS=1
    }
    ;;
esac

if [ $STATUS -ne 0 ]; then
  printf '\n=== ARUSIQ design-system gate: violations in this edit ===\n%s\n' "$OUT" >&2
  printf 'Fix these before continuing. Rules and their source documents: context/30-design-system.md\n' >&2
fi

exit 0
