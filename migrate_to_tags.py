#!/usr/bin/env python3
"""
Migration script to convert scripture_highlights to scripture_tags
Converts from scripture_id/word_index structure to position string format
"""

import sqlite3
import sys
import os

DATABASE = 'verseindex.db'

def get_book_abbreviation(book_name):
    """Get book abbreviation from full name"""
    abbrevs = {
        'Genesis': 'Gen', 'Exodus': 'Ex', 'Leviticus': 'Lev', 'Numbers': 'Num',
        'Deuteronomy': 'Deut', 'Joshua': 'Josh', 'Judges': 'Judg', 'Ruth': 'Ruth',
        '1 Samuel': '1 Sam', '2 Samuel': '2 Sam', '1 Kings': '1 Kgs', '2 Kings': '2 Kgs',
        '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr', 'Ezra': 'Ezra',
        'Nehemiah': 'Neh', 'Esther': 'Esth', 'Job': 'Job', 'Psalms': 'Ps',
        'Proverbs': 'Prov', 'Ecclesiastes': 'Eccl', 'Song of Songs': 'Song',
        'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Ezek',
        'Daniel': 'Dan', 'Hosea': 'Hos', 'Joel': 'Joel', 'Amos': 'Amos',
        'Obadiah': 'Obad', 'Jonah': 'Jonah', 'Micah': 'Mic', 'Nahum': 'Nah',
        'Habakkuk': 'Hab', 'Zephaniah': 'Zeph', 'Haggai': 'Hag', 'Zechariah': 'Zech',
        'Malachi': 'Mal', 'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke',
        'John': 'John', 'Acts': 'Acts', 'Romans': 'Rom', '1 Corinthians': '1 Cor',
        '2 Corinthians': '2 Cor', 'Galatians': 'Gal', 'Ephesians': 'Eph',
        'Philippians': 'Phil', 'Colossians': 'Col', '1 Thessalonians': '1 Thess',
        '2 Thessalonians': '2 Thess', '1 Timothy': '1 Tim', '2 Timothy': '2 Tim',
        'Titus': 'Titus', 'Philemon': 'Phlm', 'Hebrews': 'Heb', 'James': 'James',
        '1 Peter': '1 Pet', '2 Peter': '2 Pet', '1 John': '1 John', '2 John': '2 John',
        '3 John': '3 John', 'Jude': 'Jude', 'Revelation': 'Rev'
    }
    return abbrevs.get(book_name, book_name[:4])

def migrate_to_tags():
    """Migrate scripture_highlights to scripture_tags"""
    if not os.path.exists(DATABASE):
        print(f"Database {DATABASE} not found!")
        return
    
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Check if scripture_highlights table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scripture_highlights'")
        if not cursor.fetchone():
            print("No scripture_highlights table found. Migration not needed.")
            # Create scripture_tags table if it doesn't exist
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scripture_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic_id INTEGER,
                    version TEXT NOT NULL,
                    start_position TEXT NOT NULL,
                    end_position TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
                )
            ''')
            conn.commit()
            conn.close()
            return
        
        # Check if scripture_tags already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scripture_tags'")
        if cursor.fetchone():
            print("scripture_tags table already exists. Skipping migration.")
            conn.close()
            return
        
        print("Migrating scripture_highlights to scripture_tags...")
        
        # Get all highlights with scripture details
        cursor.execute('''
            SELECT h.id, h.topic_id, h.start_scripture_id, h.start_word_index,
                   h.end_scripture_id, h.end_word_index, h.created_at,
                   s1.book as start_book, s1.chapter as start_chapter, s1.verse as start_verse,
                   s1.version_id as start_version_id,
                   s2.book as end_book, s2.chapter as end_chapter, s2.verse as end_verse,
                   s2.version_id as end_version_id
            FROM scripture_highlights h
            JOIN scripture s1 ON h.start_scripture_id = s1.id
            JOIN scripture s2 ON h.end_scripture_id = s2.id
        ''')
        highlights = cursor.fetchall()
        
        print(f"Found {len(highlights)} highlights to migrate...")
        
        # Create scripture_tags table
        cursor.execute('''
            CREATE TABLE scripture_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic_id INTEGER,
                version TEXT NOT NULL,
                start_position TEXT NOT NULL,
                end_position TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
            )
        ''')
        
        # Get version abbreviations
        cursor.execute('SELECT id, abbreviation FROM bible_versions')
        version_map = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Migrate each highlight
        migrated = 0
        skipped = 0
        
        for highlight in highlights:
            try:
                # Get version for start verse
                start_version_id = highlight['start_version_id']
                end_version_id = highlight['end_version_id']
                
                # Use start version, fallback to end version
                version_id = start_version_id or end_version_id
                if not version_id:
                    print(f"Warning: Highlight {highlight['id']} has no version, skipping...")
                    skipped += 1
                    continue
                
                version_abbr = version_map.get(version_id, 'WEB')
                
                # Get book abbreviations
                start_book_abbr = get_book_abbreviation(highlight['start_book'])
                end_book_abbr = get_book_abbreviation(highlight['end_book'])
                
                # Create position strings (word index is 0-based, so use as-is)
                start_position = f"{start_book_abbr} {highlight['start_chapter']}:{highlight['start_verse']}.{highlight['start_word_index']}"
                end_position = f"{end_book_abbr} {highlight['end_chapter']}:{highlight['end_verse']}.{highlight['end_word_index']}"
                
                # Insert into scripture_tags
                cursor.execute('''
                    INSERT INTO scripture_tags (topic_id, version, start_position, end_position, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    highlight['topic_id'],
                    version_abbr,
                    start_position,
                    end_position,
                    highlight['created_at']
                ))
                migrated += 1
                
            except Exception as e:
                print(f"Error migrating highlight {highlight.get('id', 'unknown')}: {e}")
                skipped += 1
        
        print(f"\nMigration complete!")
        print(f"  Migrated: {migrated} tags")
        print(f"  Skipped: {skipped} tags")
        
        # Drop old table (commented out for safety - uncomment after verifying)
        # cursor.execute('DROP TABLE scripture_highlights')
        
        conn.commit()
        print("\nMigration completed successfully!")
        print("Note: The old scripture_highlights table has been preserved.")
        print("You can drop it manually after verifying the migration.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_to_tags()

