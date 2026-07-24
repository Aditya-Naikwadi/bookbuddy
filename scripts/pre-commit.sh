#!/bin/sh
# Pre-commit secret scanning hook

echo "🔍 Running pre-commit secret scan..."

# Pattern matching secret signatures
SECRET_PATTERNS='(AIzaSy[A-Za-z0-9_-]{33}|rzp_live_[A-Za-z0-9]{14}|rzp_test_[A-Za-z0-9]{14}|mongodb\+srv://[^\s]+:[^\s]+@|supersecret[0-9]*)'

# Check staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -n "$STAGED_FILES" ]; then
    FORBIDDEN_FILES=$(echo "$STAGED_FILES" | grep -E '(\.env|\.env\..*)$')
    if [ -n "$FORBIDDEN_FILES" ]; then
        echo "❌ ERROR: Attempting to commit environment secret file(s):"
        echo "$FORBIDDEN_FILES"
        echo "Aborting commit."
        exit 1
    fi

    # Scan content of staged files for secret patterns
    MATCHES=$(git grep -I -i -E "$SECRET_PATTERNS" --cached -- $STAGED_FILES)
    if [ -n "$MATCHES" ]; then
        echo "❌ ERROR: Hardcoded credential or secret detected in staged files:"
        echo "$MATCHES"
        echo "Please remove hardcoded secrets before committing."
        exit 1
    fi
fi

echo "✓ Pre-commit secret scan passed."
exit 0
