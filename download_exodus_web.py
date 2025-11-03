"""
Script to download WEB Bible version for Exodus
and save it to the database
"""

import sqlite3
import requests
import time
import sys
import os

DATABASE = 'verseindex.db'

# Import init_db from app.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from app import init_db
except ImportError:
    print("Error: Could not import init_db from app.py")
    sys.exit(1)

# Bible API endpoint
BIBLE_API_BASE = 'https://bible-api.com'

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def get_web_version_id():
    """Get WEB version ID from database"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM bible_versions WHERE abbreviation = ?', ('WEB',))
    result = cursor.fetchone()
    conn.close()
    
    if result:
        return result[0]
    else:
        print("Error: WEB version not found in database. Please run download_bible.py first to initialize versions.")
        return None

def fetch_book_chapter(book, chapter, version='web'):
    """Fetch a chapter from bible-api.com"""
    book_lower = book.lower().replace(' ', '%20')
    url = f"{BIBLE_API_BASE}/{book_lower}%20{chapter}?translation={version}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.RequestException as e:
        print(f"Error fetching {book} {chapter} ({version}): {e}")
        return None

def save_verses_to_db(verses_data, version_id, book_name):
    """Save verses to database"""
    conn = get_db()
    cursor = conn.cursor()
    
    saved_count = 0
    error_count = 0
    
    if not verses_data or 'verses' not in verses_data:
        conn.close()
        return 0, 0
    
    for verse_data in verses_data['verses']:
        try:
            book = verse_data.get('book_name', book_name)
            chapter = int(verse_data.get('chapter', 0))
            verse_num = int(verse_data.get('verse', 0))
            text = verse_data.get('text', '')
            
            if chapter > 0 and verse_num > 0 and text:
                try:
                    cursor.execute('''
                        INSERT INTO scripture (version_id, book, chapter, verse, text, format_type)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (version_id, book, chapter, verse_num, text.strip(), 'paragraph'))
                    saved_count += 1
                except sqlite3.IntegrityError:
                    # Verse already exists, skip
                    error_count += 1
                    pass
        except Exception as e:
            print(f"Error processing verse: {e}")
            error_count += 1
    
    conn.commit()
    conn.close()
    return saved_count, error_count

def download_exodus_web():
    """Download WEB version for Exodus"""
    # Initialize database if needed
    if not os.path.exists(DATABASE):
        print("Initializing database...")
        init_db()
        print("Database initialized!")
    
    # Get WEB version ID
    version_id = get_web_version_id()
    if not version_id:
        return
    
    print(f"Downloading Exodus from WEB (Version ID: {version_id})...\n")
    
    book = 'Exodus'
    max_chapters = 40  # Exodus has 40 chapters
    book_chapters = 0
    total_verses = 0
    
    for chapter in range(1, max_chapters + 1):
        print(f"Chapter {chapter}...", end=' ', flush=True)
        
        data = fetch_book_chapter(book, chapter, 'web')
        
        if data and 'verses' in data and len(data['verses']) > 0:
            saved, errors = save_verses_to_db(data, version_id, book)
            if saved > 0:
                print(f"✓ Saved {saved} verses")
                book_chapters += 1
                total_verses += saved
            else:
                print(f"✗ No new verses (may already exist)")
        else:
            # Check if it's a rate limit error
            if data and ('429' in str(data) or 'rate limit' in str(data).lower()):
                print(f"⚠ Rate limited - waiting 5 seconds...")
                time.sleep(5)
                # Try once more
                data = fetch_book_chapter(book, chapter, 'web')
                if data and 'verses' in data and len(data['verses']) > 0:
                    saved, errors = save_verses_to_db(data, version_id, book)
                    if saved > 0:
                        print(f"✓ Saved {saved} verses (retry)")
                        book_chapters += 1
                        total_verses += saved
                        time.sleep(2)
                        continue
            print(f"✗ Not found or error")
            # If chapter not found, likely reached the end
            break
        
        # Be nice to the API - delay to avoid rate limits
        time.sleep(2)
    
    print(f"\n=== Download Complete ===")
    print(f"Exodus: {book_chapters} chapters, {total_verses} verses downloaded")

if __name__ == '__main__':
    download_exodus_web()

