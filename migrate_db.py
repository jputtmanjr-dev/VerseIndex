"""
Migration script to remove paragraph_number and poetry_line_number columns
"""

import sqlite3
import os

DATABASE = 'verseindex.db'

def migrate_database():
    """Remove paragraph_number and poetry_line_number columns"""
    if not os.path.exists(DATABASE):
        print("Database doesn't exist. It will be created on first run.")
        return
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # SQLite doesn't support DROP COLUMN directly in older versions
        # We'll need to recreate the table
        print("Checking for columns to remove...")
        
        # Check if columns exist
        cursor.execute("PRAGMA table_info(scripture)")
        columns = {row[1]: row[0] for row in cursor.fetchall()}
        
        if 'paragraph_number' in columns or 'poetry_line_number' in columns:
            print("Recreating scripture table without paragraph_number and poetry_line_number...")
            
            # Get all scripture data
            cursor.execute('SELECT id, version_id, book, chapter, verse, text, format_type, created_at FROM scripture')
            scripture_data = cursor.fetchall()
            
            # Drop old table
            cursor.execute('DROP TABLE IF EXISTS scripture_old')
            cursor.execute('ALTER TABLE scripture RENAME TO scripture_old')
            
            # Create new table without those columns
            cursor.execute('''
                CREATE TABLE scripture (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version_id INTEGER NOT NULL,
                    book TEXT NOT NULL,
                    chapter INTEGER NOT NULL,
                    verse INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    format_type TEXT DEFAULT 'paragraph',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (version_id) REFERENCES bible_versions (id) ON DELETE CASCADE,
                    UNIQUE(version_id, book, chapter, verse)
                )
            ''')
            
            # Re-insert data
            for row in scripture_data:
                cursor.execute('''
                    INSERT INTO scripture (id, version_id, book, chapter, verse, text, format_type, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', row)
            
            # Drop old table
            cursor.execute('DROP TABLE scripture_old')
            print("Successfully removed paragraph_number and poetry_line_number columns!")
        else:
            print("Columns already removed or never existed.")
        
        # Ensure scripture_highlights table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scripture_highlights'")
        if not cursor.fetchone():
            print("Creating scripture_highlights table...")
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scripture_highlights (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic_id INTEGER,
                    start_scripture_id INTEGER NOT NULL,
                    start_word_index INTEGER NOT NULL,
                    end_scripture_id INTEGER NOT NULL,
                    end_word_index INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE,
                    FOREIGN KEY (start_scripture_id) REFERENCES scripture (id) ON DELETE CASCADE,
                    FOREIGN KEY (end_scripture_id) REFERENCES scripture (id) ON DELETE CASCADE
                )
            ''')
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_database()
