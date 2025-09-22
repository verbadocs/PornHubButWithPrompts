#!/usr/bin/env python3
"""
Verba Database Merge Driver - Custom Git merge driver for changes.db

This script handles merge conflicts in the SQLite database by:
1. Reading records from all three versions (base, current, other)
2. Merging them using INSERT OR IGNORE to handle duplicates
3. Writing the merged result to the current branch location

Usage: git config merge.verba-db.driver "python3 verba/merge_db.py %O %A %B"

Arguments:
    %O: Ancestor's version (base/original)
    %A: Current branch version (ours)
    %B: Other branch version (theirs)
"""

import sqlite3
import sys
import os
from pathlib import Path

def get_records_from_db(db_path):
    """Extract all records from a database file"""
    if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
        return []
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute('''
                SELECT change_hash, filename, file_change, timestamp, prompt, is_committed, commit_hash
                FROM code_changes
                ORDER BY timestamp ASC
            ''')
            return cursor.fetchall()
    except Exception as e:
        print(f"Warning: Could not read from {db_path}: {e}", file=sys.stderr)
        return []

def merge_databases(base_path, current_path, other_path, output_path):
    """Merge three database versions into output database"""
    
    # Get records from all three versions
    base_records = get_records_from_db(base_path)
    current_records = get_records_from_db(current_path)
    other_records = get_records_from_db(other_path)
    
    print(f"Base records: {len(base_records)}")
    print(f"Current records: {len(current_records)}")
    print(f"Other records: {len(other_records)}")
    
    # Create/initialize the output database
    with sqlite3.connect(output_path) as conn:
        # Create the table structure
        conn.execute('''
            CREATE TABLE IF NOT EXISTS code_changes (
                change_hash TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_change TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                prompt TEXT NOT NULL,
                is_committed BOOLEAN DEFAULT FALSE,
                commit_hash TEXT NULL
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_filename ON code_changes(filename)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_committed ON code_changes(is_committed)')
        
        # Combine all records (base + current + other)
        all_records = []
        all_records.extend(base_records)
        all_records.extend(current_records)
        all_records.extend(other_records)
        
        # Insert all records, using INSERT OR IGNORE to handle duplicates
        # The change_hash PRIMARY KEY will automatically deduplicate
        inserted_count = 0
        for record in all_records:
            try:
                conn.execute('''
                    INSERT OR IGNORE INTO code_changes 
                    (change_hash, filename, file_change, timestamp, prompt, is_committed, commit_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', record)
                if conn.total_changes > 0:
                    inserted_count += 1
            except Exception as e:
                print(f"Warning: Could not insert record {record[0][:8]}: {e}", file=sys.stderr)
        
        print(f"Merged {inserted_count} unique records into database")
    
    return True

def main():
    if len(sys.argv) != 4:
        print("Usage: merge_db.py <base> <current> <other>", file=sys.stderr)
        sys.exit(1)
    
    base_path = sys.argv[1]      # %O - ancestor's version
    current_path = sys.argv[2]   # %A - current branch version (output location)
    other_path = sys.argv[3]     # %B - other branch version
    
    print(f"🔥 Verba Database Merge Driver")
    print(f"Base: {base_path}")
    print(f"Current: {current_path}")
    print(f"Other: {other_path}")
    
    try:
        # Merge all three databases into the current path
        merge_databases(base_path, current_path, other_path, current_path)
        print("✅ Database merge completed successfully")
        sys.exit(0)  # Success
    except Exception as e:
        print(f"❌ Database merge failed: {e}", file=sys.stderr)
        sys.exit(1)  # Failure

if __name__ == '__main__':
    main()
