#!/usr/bin/env python3
"""
Verba Database Initializer - Creates the SQLite database for tracking code changes
"""

import sqlite3
import argparse
import os
import sys
from pathlib import Path

class VerbaDatabase:
    def __init__(self, project_root=None):
        self.project_root = Path(project_root or os.getcwd())
        self.verba_dir = self.project_root / 'verba'
        self.db_path = self.verba_dir / 'changes.db'
        
    def init_database(self):
        """Initialize the SQLite database"""
        self.verba_dir.mkdir(exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
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
            
        print(f"Database initialized: {self.db_path}")
    
def main():
    parser = argparse.ArgumentParser(description='Verba Database - Initialize database for tracking code changes')
    parser.add_argument('--init-db', action='store_true', help='Initialize database')
    parser.add_argument('--project-root', help='Project root directory')
    
    args = parser.parse_args()
    
    db = VerbaDatabase(args.project_root)
    
    if args.init_db:
        db.init_database()
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
