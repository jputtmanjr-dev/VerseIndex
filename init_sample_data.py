"""
Script to populate the database with sample data
Run this after initializing the database to add sample scripture and topics
"""

import sqlite3

def init_sample_data():
    """Add sample scripture and topics"""
    conn = sqlite3.connect('verseindex.db')
    cursor = conn.cursor()
    
    # Get or create default version (WEB)
    cursor.execute('SELECT id FROM bible_versions WHERE abbreviation = ?', ('WEB',))
    version_row = cursor.fetchone()
    if version_row:
        version_id = version_row[0]
    else:
        cursor.execute('''
            INSERT INTO bible_versions (abbreviation, name, full_name)
            VALUES (?, ?, ?)
        ''', ('WEB', 'World English Bible', 'World English Bible'))
        version_id = cursor.lastrowid
    
    # Sample scripture verses (using version_id)
    sample_scripture = [
        (version_id, 'John', 3, 16, 'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.'),
        (version_id, 'Proverbs', 3, 5, 'Trust in the LORD with all your heart, and do not lean on your own understanding.'),
        (version_id, 'Philippians', 4, 13, 'I can do all things through Christ who strengthens me.'),
        (version_id, 'Romans', 8, 28, 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.'),
        (version_id, 'Matthew', 5, 16, 'In the same way, let your light shine before others, so that they may see your good works and give glory to your Father who is in heaven.'),
        (version_id, 'Isaiah', 40, 31, 'But those who wait for the LORD shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.'),
    ]
    
    # Sample topics
    sample_topics = [
        ('Love', 'God\'s love for humanity and how we should love others'),
        ('Faith', 'Trust and belief in God'),
        ('Strength', 'Finding strength through God'),
        ('Salvation', 'Eternal life and being saved'),
        ('Purpose', 'God\'s plan and purpose for our lives'),
        ('Witness', 'Sharing faith and being a light to others'),
        ('Patience', 'Waiting on God and His timing'),
        ('Hope', 'Hope in God and His promises'),
    ]
    
    # Insert scripture
    print("Adding sample scripture...")
    for v_id, book, chapter, verse, text in sample_scripture:
        try:
            cursor.execute('''
                INSERT INTO scripture (version_id, book, chapter, verse, text)
                VALUES (?, ?, ?, ?, ?)
            ''', (v_id, book, chapter, verse, text))
        except sqlite3.IntegrityError:
            pass  # Skip if already exists
    
    # Insert topics
    print("Adding sample topics...")
    topic_ids = {}
    for name, description in sample_topics:
        try:
            cursor.execute('''
                INSERT INTO topics (name, description)
                VALUES (?, ?)
            ''', (name, description))
            topic_ids[name] = cursor.lastrowid
        except sqlite3.IntegrityError:
            # Get existing topic ID
            cursor.execute('SELECT id FROM topics WHERE name = ?', (name,))
            topic_ids[name] = cursor.fetchone()[0]
    
    # Link scripture to topics
    print("Linking scripture to topics...")
    # John 3:16 -> Love, Salvation
    cursor.execute('SELECT id FROM scripture WHERE version_id = ? AND book = ? AND chapter = ? AND verse = ?', 
                   (version_id, 'John', 3, 16))
    john_id = cursor.fetchone()[0]
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (john_id, topic_ids['Love']))
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (john_id, topic_ids['Salvation']))
    
    # Proverbs 3:5 -> Faith, Trust
    cursor.execute('SELECT id FROM scripture WHERE version_id = ? AND book = ? AND chapter = ? AND verse = ?', 
                   (version_id, 'Proverbs', 3, 5))
    prov_id = cursor.fetchone()[0]
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (prov_id, topic_ids['Faith']))
    
    # Philippians 4:13 -> Strength
    cursor.execute('SELECT id FROM scripture WHERE version_id = ? AND book = ? AND chapter = ? AND verse = ?', 
                   (version_id, 'Philippians', 4, 13))
    phil_id = cursor.fetchone()[0]
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (phil_id, topic_ids['Strength']))
    
    # Romans 8:28 -> Purpose, Hope
    cursor.execute('SELECT id FROM scripture WHERE version_id = ? AND book = ? AND chapter = ? AND verse = ?', 
                   (version_id, 'Romans', 8, 28))
    rom_id = cursor.fetchone()[0]
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (rom_id, topic_ids['Purpose']))
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (rom_id, topic_ids['Hope']))
    
    # Matthew 5:16 -> Witness
    cursor.execute('SELECT id FROM scripture WHERE version_id = ? AND book = ? AND chapter = ? AND verse = ?', 
                   (version_id, 'Matthew', 5, 16))
    matt_id = cursor.fetchone()[0]
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (matt_id, topic_ids['Witness']))
    
    # Isaiah 40:31 -> Strength, Patience, Hope
    cursor.execute('SELECT id FROM scripture WHERE version_id = ? AND book = ? AND chapter = ? AND verse = ?', 
                   (version_id, 'Isaiah', 40, 31))
    isa_id = cursor.fetchone()[0]
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (isa_id, topic_ids['Strength']))
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (isa_id, topic_ids['Patience']))
    cursor.execute('INSERT OR IGNORE INTO scripture_topics VALUES (?, ?)', 
                   (isa_id, topic_ids['Hope']))
    
    conn.commit()
    conn.close()
    print("Sample data added successfully!")

if __name__ == '__main__':
    init_sample_data()

