#!/usr/bin/env python3
"""
Verba Log Processor - Processes all prompts.txt content and stores changes in database
Used by pre-commit hook to process logs in one pass instead of continuous monitoring
"""

import sqlite3
import hashlib
import re
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

class LogProcessor:
    def __init__(self, db_path, prompts_file):
        self.db_path = db_path
        self.prompts_file = prompts_file
        
    # Position tracking methods removed - now processing entire file each time
    
    def process_all_logs(self):
        """Process entire prompts.txt content and clear the file afterwards"""
        if not os.path.exists(self.prompts_file):
            print(f"Prompts file not found: {self.prompts_file}", file=sys.stderr)
            return 0
        
        # Read entire file content
        try:
            with open(self.prompts_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading prompts file: {e}", file=sys.stderr)
            return 0
        
        if not content.strip():
            print("No content to process")
            return 0
        
        print(f"Processing entire prompts.txt ({len(content)} characters)...")
        
        # Process all content
        changes_processed = self._parse_and_store_changes(content)
        
        # Clear the prompts file after successful processing
        try:
            with open(self.prompts_file, 'w', encoding='utf-8') as f:
                f.write('')
            print(f"Cleared prompts.txt after processing")
        except Exception as e:
            print(f"Error clearing prompts file: {e}", file=sys.stderr)
        
        print(f"Processed {changes_processed} changes")
        return changes_processed
    
    def _parse_and_store_changes(self, content):
        """Parse content and extract code changes (adapted from monitor.py)"""
        lines = content.split('\n')
        changes_count = 0
        
        # State tracking
        current_timestamp = None
        current_prompt = None
        current_file = None
        file_changes = []
        pending_file = None
        pending_file_changes = []
        
        for line in lines:
            # Extract timestamp and prompt
            timestamp_match = re.match(r'^\[([^\]]+)\] User Prompt: (.+)$', line)
            if timestamp_match:
                # Store any pending changes with the OLD timestamp/prompt before updating
                if current_file and file_changes and current_timestamp and current_prompt:
                    self._store_change(current_file, '\n'.join(file_changes), current_timestamp, current_prompt)
                    changes_count += 1
                
                # Store pending file if we have one
                if pending_file and pending_file_changes and current_timestamp and current_prompt:
                    self._store_change(pending_file, '\n'.join(pending_file_changes), current_timestamp, current_prompt)
                    changes_count += 1
                
                # Clear state for new prompt
                file_changes = []
                current_file = None
                pending_file = None
                pending_file_changes = []
                
                # Update to new timestamp/prompt
                current_timestamp = timestamp_match.group(1)
                current_prompt = timestamp_match.group(2)
                continue
            
            # Extract file name
            file_match = re.match(r'^FILE: (.+)$', line)
            if file_match:
                # Store previous file if we have changes
                if current_file and file_changes and current_timestamp and current_prompt:
                    self._store_change(current_file, '\n'.join(file_changes), current_timestamp, current_prompt)
                    changes_count += 1
                
                # Store pending file if we have one
                if pending_file and pending_file_changes and current_timestamp and current_prompt:
                    self._store_change(pending_file, '\n'.join(pending_file_changes), current_timestamp, current_prompt)
                    changes_count += 1
                
                # Start new file
                new_file = file_match.group(1)
                if current_file:
                    # We already had a file, so the new one becomes pending
                    pending_file = new_file
                    pending_file_changes = []
                else:
                    # This is the first file for this prompt
                    current_file = new_file
                    file_changes = []
                continue
            
            # Skip separator lines
            if re.match(r'^-+$', line):
                continue
            
            # Collect content for current file or pending file
            if current_file:
                # Add to current file if it's a diff line or regular content
                if (re.match(r'^\s*\d+\s*[+→-]\s+', line) or 
                    (line.strip() and not line.startswith('FILE:') and not re.match(r'^-+$', line) and not re.match(r'^\[([^\]]+)\] User Prompt:', line))):
                    file_changes.append(line)
                elif line.strip() == "":  # Include empty lines as part of content
                    file_changes.append(line)
            
            # If we have a pending file, collect content for it
            if pending_file and not re.match(r'^\[([^\]]+)\] User Prompt:', line) and not line.startswith('FILE:') and not re.match(r'^-+$', line):
                pending_file_changes.append(line)
        
        # Store final changes if we have them
        if current_file and file_changes and current_timestamp and current_prompt:
            self._store_change(current_file, '\n'.join(file_changes), current_timestamp, current_prompt)
            changes_count += 1
        
        if pending_file and pending_file_changes and current_timestamp and current_prompt:
            self._store_change(pending_file, '\n'.join(pending_file_changes), current_timestamp, current_prompt)
            changes_count += 1
        
        return changes_count
    
    def _store_change(self, filename, file_change, timestamp, prompt):
        """Store a code change in the database (same as monitor.py)"""
        if not all([filename, file_change, timestamp, prompt]):
            return
        
        # Skip if content is just empty lines
        if not file_change.strip():
            return
            
        # Create hash
        hash_input = f"{filename}{file_change}{timestamp}"
        change_hash = hashlib.sha256(hash_input.encode()).hexdigest()
        
        # Parse timestamp
        try:
            # Convert ISO timestamp to datetime
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            dt = datetime.now()
        
        # Store in database
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR IGNORE INTO code_changes 
                    (change_hash, filename, file_change, timestamp, prompt, is_committed, commit_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (change_hash, filename, file_change, dt, prompt, False, None))
                
                # Check if we actually inserted (not ignored due to duplicate)
                if conn.total_changes > 0:
                    print(f"🔥 STORED CHANGE:")
                    print(f"   File: {filename}")
                    print(f"   Timestamp: {timestamp}")
                    print(f"   Prompt: {prompt[:50]}..." if len(prompt) > 50 else f"   Prompt: {prompt}")
                    print(f"   Hash: {change_hash[:8]}...")
                    print("="*50)
                
        except Exception as e:
            print(f"Error storing change: {e}", file=sys.stderr)

    # Reset position method removed - no longer needed

def main():
    parser = argparse.ArgumentParser(description='Process prompts.txt logs and store changes in database')
    parser.add_argument('--project-root', help='Project root directory', default='.')
    
    args = parser.parse_args()
    
    project_root = Path(args.project_root)
    db_path = project_root / 'verba' / 'changes.db'
    prompts_file = project_root / 'verba' / 'prompts.txt'
    
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        print("Please initialize the database first with: python3 verba/monitor.py --init-db")
        sys.exit(1)
    
    processor = LogProcessor(str(db_path), str(prompts_file))
    
    changes_processed = processor.process_all_logs()
    
    if changes_processed == 0:
        print("No changes to process")
    else:
        print(f"Successfully processed {changes_processed} changes")
        print("prompts.txt has been cleared for next cycle")

if __name__ == '__main__':
    main()
