#!/bin/bash
# Verba Database Merge Driver Setup
# This script configures Git to use our custom merge driver for changes.db

echo "🔥 Setting up Verba database merge driver..."

# Get the absolute path to the merge script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MERGE_SCRIPT="$SCRIPT_DIR/merge_db.py"

# Check if the merge script exists
if [[ ! -f "$MERGE_SCRIPT" ]]; then
    echo "❌ Error: merge_db.py not found at $MERGE_SCRIPT"
    exit 1
fi

# Make sure the merge script is executable
chmod +x "$MERGE_SCRIPT"

# Configure the merge driver in Git
git config merge.verba-db.name "Verba database merge driver"
git config merge.verba-db.driver "python3 '$MERGE_SCRIPT' %O %A %B"
