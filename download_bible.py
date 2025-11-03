"""
Script to download WEB and NET Bible versions for Genesis and Exodus
and save them to the database
"""

import sqlite3
import requests
import time
import re
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

# Books to download
BOOKS_TO_DOWNLOAD = ['Genesis', 'Exodus']

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_versions():
    """Initialize Bible versions in the database"""
    conn = get_db()
    cursor = conn.cursor()
    
    versions = [
        ('WEB', 'World English Bible', 'World English Bible'),
        ('NET', 'New English Translation', 'New English Translation (NET Bible)')
    ]
    
    version_ids = {}
    for abbr, name, full_name in versions:
        try:
            cursor.execute('''
                INSERT INTO bible_versions (abbreviation, name, full_name)
                VALUES (?, ?, ?)
            ''', (abbr, name, full_name))
            version_ids[abbr] = cursor.lastrowid
            print(f"Added version: {name} (ID: {version_ids[abbr]})")
        except sqlite3.IntegrityError:
            # Version already exists, get its ID
            cursor.execute('SELECT id FROM bible_versions WHERE abbreviation = ?', (abbr,))
            version_ids[abbr] = cursor.fetchone()[0]
            print(f"Version {name} already exists (ID: {version_ids[abbr]})")
    
    conn.commit()
    conn.close()
    return version_ids

def parse_bible_verse(reference, text):
    """Parse Bible reference to extract book, chapter, verse"""
    # Reference format: "Genesis 1:1" or "Exodus 2:3"
    match = re.match(r'(\w+(?:\s+\w+)?)\s+(\d+):(\d+)', reference)
    if match:
        book = match.group(1)
        chapter = int(match.group(2))
        verse = int(match.group(3))
        return book, chapter, verse, text
    return None, None, None, text

def fetch_book_chapter(book, chapter, version='web'):
    """Fetch a chapter from bible-api.com"""
    # Convert book name for API (lowercase, spaces as %20)
    book_lower = book.lower().replace(' ', '%20')
    # bible-api.com uses 'web' for WEB 
    # For NET, we'll try 'net' but it may not be available
    url = f"{BIBLE_API_BASE}/{book_lower}%20{chapter}?translation={version}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.RequestException as e:
        # If NET fails, try without translation parameter (defaults to KJV)
        # Then note that NET may not be available from this API
        if version.lower() == 'net':
            print(f"Note: NET may not be available from bible-api.com. Error: {e}")
        else:
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
            # bible-api.com returns verses in this format
            book = verse_data.get('book_name', book_name)
            chapter = int(verse_data.get('chapter', 0))
            verse_num = int(verse_data.get('verse', 0))
            text = verse_data.get('text', '')
            
            if chapter > 0 and verse_num > 0 and text:
                try:
                    cursor.execute('''
                        INSERT INTO scripture (version_id, book, chapter, verse, text)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (version_id, book, chapter, verse_num, text.strip()))
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

def download_bible_versions():
    """Download WEB and NET versions for Genesis and Exodus"""
    # Initialize database if needed
    if not os.path.exists(DATABASE):
        print("Initializing database...")
        init_db()
        print("Database initialized!")
    
    print("Initializing Bible versions...")
    version_ids = init_versions()
    
    # Note: bible-api.com supports 'web' but may not support 'net'
    # We'll download WEB from the API and try NET
    # If NET isn't available, you may need to import it from another source
    versions_to_download = [
        ('web', version_ids['WEB'], 'WEB'),
        ('net', version_ids['NET'], 'NET')
    ]
    
    total_chapters = {book: 0 for book in BOOKS_TO_DOWNLOAD}
    
    # Get chapter counts (approximate - Genesis has 50, Exodus has 40)
    # We'll try to fetch and see what's available
    chapter_counts = {
        'Genesis': 50,
        'Exodus': 40
    }
    
    for version_abbr, version_id, version_name in versions_to_download:
        print(f"\n=== Downloading {version_name} ===")
        
        for book in BOOKS_TO_DOWNLOAD:
            print(f"\nDownloading {book}...")
            book_chapters = 0
            max_chapters = chapter_counts.get(book, 50)
            
            for chapter in range(1, max_chapters + 1):
                print(f"  Chapter {chapter}...", end=' ', flush=True)
                
                data = fetch_book_chapter(book, chapter, version_abbr)
                
                if data and 'verses' in data and len(data['verses']) > 0:
                    saved, errors = save_verses_to_db(data, version_id, book)
                    if saved > 0:
                        print(f"✓ Saved {saved} verses")
                        book_chapters += 1
                    else:
                        print(f"✗ No new verses (may already exist)")
                else:
                    # Check if it's a rate limit error
                    if data and ('429' in str(data) or 'rate limit' in str(data).lower()):
                        print(f"⚠ Rate limited - waiting 5 seconds...")
                        time.sleep(5)
                        # Try once more
                        data = fetch_book_chapter(book, chapter, version_abbr)
                        if data and 'verses' in data and len(data['verses']) > 0:
                            saved, errors = save_verses_to_db(data, version_id, book)
                            if saved > 0:
                                print(f"✓ Saved {saved} verses (retry)")
                                book_chapters += 1
                                time.sleep(2)  # Longer delay after retry
                                continue
                    print(f"✗ Not found or error")
                    # If chapter not found, likely reached the end
                    break
                
                # Be nice to the API - longer delay to avoid rate limits
                time.sleep(2)
            
            total_chapters[book] += book_chapters
            print(f"\n{book}: {book_chapters} chapters downloaded")
    
    print("\n=== Download Complete ===")
    print("\nSummary:")
    for book in BOOKS_TO_DOWNLOAD:
        print(f"  {book}: {total_chapters[book]} chapters")

if __name__ == '__main__':
    download_bible_versions()

