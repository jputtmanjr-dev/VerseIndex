from flask import Flask, render_template, jsonify, request
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
app.config['DATABASE'] = 'verseindex.db'

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with schema"""
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    
    # Bible versions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bible_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            abbreviation TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            full_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Scripture table (updated to include version_id and formatting)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scripture (
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
    
    # Topics table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Junction table for scripture-topic relationships
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scripture_topics (
            scripture_id INTEGER NOT NULL,
            topic_id INTEGER NOT NULL,
            PRIMARY KEY (scripture_id, topic_id),
            FOREIGN KEY (scripture_id) REFERENCES scripture (id) ON DELETE CASCADE,
            FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
        )
    ''')
    
    # Scripture tags table
    # Allows tagging specific word ranges that can span across verses
    # Positions are stored as "Gen 1:1.0" format (book chapter:verse.word)
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

def check_db_tables():
    """Check if database tables exist"""
    try:
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        cursor.execute('''
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='scripture'
        ''')
        exists = cursor.fetchone() is not None
        conn.close()
        return exists
    except:
        return False

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/api/scripture', methods=['GET'])
def get_scripture():
    """Get all scripture verses"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get optional search parameters
    book = request.args.get('book', '')
    chapter = request.args.get('chapter', '')
    
    query = 'SELECT * FROM scripture WHERE 1=1'
    params = []
    
    if book:
        query += ' AND book LIKE ?'
        params.append(f'%{book}%')
    
    if chapter:
        query += ' AND chapter = ?'
        params.append(int(chapter))
    
    query += ' ORDER BY book, chapter, verse'
    
    cursor.execute(query, params)
    scripture = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(scripture)

@app.route('/api/scripture/book/<book_name>', methods=['GET'])
def get_scripture_by_book(book_name):
    """Get all verses for a specific book"""
    chapter = request.args.get('chapter', None)
    version_id = request.args.get('version_id', None)
    conn = get_db()
    cursor = conn.cursor()
    
    query = '''
        SELECT s.*, bv.abbreviation as version_abbr, bv.name as version_name
        FROM scripture s
        JOIN bible_versions bv ON s.version_id = bv.id
        WHERE s.book = ?
    '''
    params = [book_name]
    
    if version_id:
        query += ' AND s.version_id = ?'
        params.append(int(version_id))
    
    if chapter:
        query += ' AND s.chapter = ?'
        params.append(int(chapter))
    
    query += ' ORDER BY s.chapter, s.verse'
    
    cursor.execute(query, params)
    scripture = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(scripture)

@app.route('/api/scripture/book/<book_name>/chapters', methods=['GET'])
def get_chapters_for_book(book_name):
    """Get list of chapters available for a book"""
    version_id = request.args.get('version_id', None)
    conn = get_db()
    cursor = conn.cursor()
    
    if version_id:
        cursor.execute('''
            SELECT DISTINCT chapter 
            FROM scripture 
            WHERE book = ? AND version_id = ?
            ORDER BY chapter
        ''', (book_name, version_id))
    else:
        cursor.execute('''
            SELECT DISTINCT chapter 
            FROM scripture 
            WHERE book = ? 
            ORDER BY chapter
        ''', (book_name,))
    
    chapters = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(chapters)

@app.route('/api/versions', methods=['GET'])
def get_versions():
    """Get all Bible versions"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM bible_versions ORDER BY name')
    versions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(versions)

@app.route('/api/scripture/<int:verse_id>', methods=['GET'])
def get_verse(verse_id):
    """Get a specific verse by ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM scripture WHERE id = ?', (verse_id,))
    verse = cursor.fetchone()
    conn.close()
    
    if verse:
        return jsonify(dict(verse))
    return jsonify({'error': 'Verse not found'}), 404

@app.route('/api/scripture/<int:verse_id>/topics', methods=['GET'])
def get_verse_topics(verse_id):
    """Get topics related to a specific verse"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.id, t.name, t.description 
        FROM topics t
        JOIN scripture_topics st ON t.id = st.topic_id
        WHERE st.scripture_id = ?
        ORDER BY t.name
    ''', (verse_id,))
    
    topics = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(topics)

@app.route('/api/scripture/topics', methods=['GET'])
def get_chapter_topics():
    """Get all topics related to verses in a chapter"""
    book = request.args.get('book', None)
    chapter = request.args.get('chapter', None)
    version_id = request.args.get('version_id', None)
    
    if not book or not chapter:
        return jsonify({'error': 'book and chapter are required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Get version abbreviation if version_id is provided
    version_abbr = None
    if version_id:
        cursor.execute('SELECT abbreviation FROM bible_versions WHERE id = ?', (int(version_id),))
        version_row = cursor.fetchone()
        if version_row:
            version_abbr = version_row[0]
    
    # Build query to get all topics for verses in this chapter
    # Topics come from two sources:
    # 1. scripture_topics table (direct links to verses)
    # 2. scripture_tags table (topics linked via tags)
    
    query = '''
        SELECT DISTINCT t.id, t.name, t.description
        FROM topics t
        WHERE t.id IN (
            -- Topics from scripture_topics
            SELECT DISTINCT st.topic_id
            FROM scripture_topics st
            JOIN scripture s ON st.scripture_id = s.id
            WHERE s.book = ? AND s.chapter = ?
    '''
    params = [book, int(chapter)]
    
    if version_id:
        query += ' AND s.version_id = ?'
        params.append(int(version_id))
    
    query += '''
            UNION
            -- Topics from scripture_tags
            SELECT DISTINCT st.topic_id
            FROM scripture_tags st
            WHERE st.topic_id IS NOT NULL
    '''
    # Match positions like "Gen 1:" or "Ex 1:" for the chapter
    # Build proper book abbreviation patterns based on the book name
    book_abbr_patterns = []
    # Try first 3 characters with space
    book_abbr_patterns.append(f'{book[:3]} {chapter}:')
    # Try common abbreviations
    if book.startswith('Genesis'):
        book_abbr_patterns.append(f'Gen {chapter}:')
    elif book.startswith('Exodus'):
        book_abbr_patterns.append(f'Ex {chapter}:')
    elif book.startswith('Leviticus'):
        book_abbr_patterns.append(f'Lev {chapter}:')
    elif book.startswith('Numbers'):
        book_abbr_patterns.append(f'Num {chapter}:')
    elif book.startswith('Deuteronomy'):
        book_abbr_patterns.append(f'Deut {chapter}:')
    elif 'Samuel' in book:
        book_abbr_patterns.append(f'{book[:2]} Sam {chapter}:')
    elif 'Kings' in book:
        book_abbr_patterns.append(f'{book[:2]} Kgs {chapter}:')
    elif 'Chronicles' in book:
        book_abbr_patterns.append(f'{book[:2]} Chr {chapter}:')
    elif 'Corinthians' in book:
        book_abbr_patterns.append(f'{book[:2]} Cor {chapter}:')
    elif 'Thessalonians' in book:
        book_abbr_patterns.append(f'{book[:2]} Thess {chapter}:')
    elif 'Timothy' in book:
        book_abbr_patterns.append(f'{book[:2]} Tim {chapter}:')
    elif 'Peter' in book:
        book_abbr_patterns.append(f'{book[:2]} Pet {chapter}:')
    elif 'John' in book and book != 'John':
        book_abbr_patterns.append(f'{book[:2]} John {chapter}:')
    
    # Build LIKE conditions for all patterns
    like_conditions = []
    for pattern in book_abbr_patterns:
        like_conditions.append(f'st.start_position LIKE ?')
        like_conditions.append(f'st.end_position LIKE ?')
        params.extend([f'{pattern}%', f'{pattern}%'])
    
    query += ' AND (' + ' OR '.join(like_conditions) + ')'
    
    if version_abbr:
        query += ' AND st.version = ?'
        params.append(version_abbr)
    
    query += ') ORDER BY t.name'
    
    cursor.execute(query, params)
    topics = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(topics)

@app.route('/api/scripture/tags', methods=['GET'])
def get_tags():
    """Get all tags for scripture in a given range"""
    book = request.args.get('book', None)
    chapter = request.args.get('chapter', None)
    version_id = request.args.get('version_id', None)
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Get version abbreviation if version_id is provided
    version_abbr = None
    if version_id:
        cursor.execute('SELECT abbreviation FROM bible_versions WHERE id = ?', (int(version_id),))
        version_row = cursor.fetchone()
        if version_row:
            version_abbr = version_row[0]
    
    query = 'SELECT * FROM scripture_tags WHERE 1=1'
    params = []
    
    # Filter by book and chapter using position strings
    if book and chapter:
        # Match positions like "Gen 1:" for Genesis chapter 1
        book_abbr = book[:3] + ' '  # Simple abbreviation matching
        chapter_pattern = f'{book_abbr}{chapter}:'
        query += ' AND (start_position LIKE ? OR end_position LIKE ?)'
        params.extend([f'{chapter_pattern}%', f'{chapter_pattern}%'])
    
    if version_abbr:
        query += ' AND version = ?'
        params.append(version_abbr)
    
    query += ' ORDER BY start_position'
    
    cursor.execute(query, params)
    tags = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(tags)

@app.route('/api/scripture/tags', methods=['POST'])
def create_tag():
    """Create a new tag"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Validate required fields
        if 'start_position' not in data or 'end_position' not in data:
            return jsonify({'error': 'start_position and end_position are required'}), 400
        
        if 'version' not in data:
            return jsonify({'error': 'version is required'}), 400
        
        cursor.execute('''
            INSERT INTO scripture_tags 
            (topic_id, version, start_position, end_position)
            VALUES (?, ?, ?, ?)
        ''', (
            data.get('topic_id'),
            data['version'],
            data['start_position'],
            data['end_position']
        ))
        conn.commit()
        tag_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': tag_id, 'message': 'Tag created successfully'}), 201
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 400

@app.route('/api/topics', methods=['GET'])
def get_topics():
    """Get all topics"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM topics ORDER BY name')
    topics = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(topics)

@app.route('/api/scripture', methods=['POST'])
def add_scripture():
    """Add a new scripture verse"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        version_id = data.get('version_id', 1)  # Default to first version
        format_type = data.get('format_type', 'paragraph')
        
        cursor.execute('''
            INSERT INTO scripture (version_id, book, chapter, verse, text, format_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (version_id, data['book'], data['chapter'], data['verse'], data['text'], format_type))
        conn.commit()
        verse_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': verse_id, 'message': 'Scripture added successfully'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'This verse already exists for this version'}), 400

@app.route('/api/topics', methods=['POST'])
def add_topic():
    """Add a new topic"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO topics (name, description)
            VALUES (?, ?)
        ''', (data['name'], data.get('description', '')))
        conn.commit()
        topic_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': topic_id, 'message': 'Topic added successfully'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Topic name already exists'}), 400

@app.route('/api/scripture/<int:verse_id>/topics', methods=['POST'])
def link_topic_to_verse(verse_id):
    """Link a topic to a scripture verse"""
    data = request.json
    topic_id = data.get('topic_id')
    
    if not topic_id:
        return jsonify({'error': 'topic_id is required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO scripture_topics (scripture_id, topic_id)
            VALUES (?, ?)
        ''', (verse_id, topic_id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Topic linked successfully'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'This relationship already exists'}), 400

if __name__ == '__main__':
    # Initialize database on first run or if tables don't exist
    if not os.path.exists(app.config['DATABASE']) or not check_db_tables():
        init_db()
        print("Database initialized!")
    
    # Run the app
    app.run(debug=True, host='0.0.0.0', port=5001)

