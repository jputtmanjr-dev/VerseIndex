# VerseIndex

A web application for displaying scripture verses and their related topics with precise word-level tagging capabilities.

## Features

- **Three-Pane Layout**: Bible navigator (left), scripture content (middle), topics and selection (right)
- **Bible Navigator**: Browse all books and chapters in standard Protestant order
- **Version Selector**: Switch between different Bible versions (WEB, NET, etc.)
- **Interactive Selection**: Select words or word ranges across verses to create highlights
- **Tags/Highlights**: Create precise word-level tags linking scripture ranges to topics
- **Topic-Based Filtering**: Topics automatically show/hide based on visible verses in the middle pane
- **Expandable Topics**: View individual tags for each topic and highlight specific ranges
- **RESTful API**: Full API for managing scripture, topics, versions, and tags
- **SQLite Database**: Lightweight, file-based database (no separate server needed)

## Technology Stack

- **Backend**: Python 3.x + Flask
- **Database**: SQLite
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Deployment Ready**: Works with any Python hosting service

## Setup Instructions

### Prerequisites

- Python 3.7 or higher
- pip (Python package manager)

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd VerseIndex
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
   After activating the virtual environment, you can use `pip` and `python` instead of `pip3` and `python3`.

3. **Install dependencies:**
   ```bash
   pip3 install -r requirements.txt
   ```
   (Note: On macOS/Linux, use `pip3` instead of `pip`)

4. **Initialize the database:**
   The database will be created automatically when you first run the app. To add sample data:
   ```bash
   python3 init_sample_data.py
   ```

5. **Run the application:**
   ```bash
   python3 app.py
   ```

6. **Open your browser:**
   Navigate to `http://localhost:5001`
   
   **Note:** If port 5001 is also in use, you can change it in `app.py` (look for `port=5001`). On macOS, port 5000 is often used by AirPlay Receiver.

## Project Structure

```
VerseIndex/
├── app.py                 # Main Flask application
├── init_sample_data.py    # Script to add sample data
├── download_bible.py      # Script to download Bible versions from bible-api.com
├── migrate_to_tags.py     # Migration script for converting highlights to tags
├── requirements.txt       # Python dependencies
├── verseindex.db         # SQLite database (created on first run)
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Stylesheet
│   └── js/
│       └── app.js        # Frontend JavaScript
└── README.md             # This file
```

## API Endpoints

### Scripture

- `GET /api/scripture` - Get all scripture (with optional `?book=` and `?chapter=` query parameters)
- `GET /api/scripture/<id>` - Get a specific verse by ID
- `POST /api/scripture` - Add a new scripture verse
  ```json
  {
    "book": "John",
    "chapter": 3,
    "verse": 16,
    "text": "For God so loved the world..."
  }
  ```

### Topics

- `GET /api/topics` - Get all topics
- `POST /api/topics` - Add a new topic
  ```json
  {
    "name": "Love",
    "description": "God's love for humanity"
  }
  ```

### Relationships

- `GET /api/scripture/<id>/topics` - Get topics for a specific verse
- `POST /api/scripture/<id>/topics` - Link a topic to a verse
  ```json
  {
    "topic_id": 1
  }
  ```

### Tags (Highlights)

- `GET /api/scripture/tags` - Get all tags for a chapter (optional query params: `?book=Genesis&chapter=1&version_id=1`)
- `POST /api/scripture/tags` - Create a new tag
  ```json
  {
    "topic_id": 1,
    "version": "WEB",
    "start_position": "Gen 1:1.0",
    "end_position": "Gen 1:5.10"
  }
  ```
  
Tags use position strings in the format `"Book Chapter:Verse.WordIndex"` where:
- `Book` is the book abbreviation (e.g., "Gen", "Ex")
- `Chapter` is the chapter number
- `Verse` is the verse number
- `WordIndex` is the word index (0-based)

### Versions

- `GET /api/versions` - Get all available Bible versions

## Deployment Options

### Free/Low-Cost Hosting

1. **Railway** (~$5/month after free trial)
   - Easy deployment with Git
   - Automatic HTTPS
   - https://railway.app

2. **Render** (Free tier available)
   - Free tier with limitations
   - Easy setup
   - https://render.com

3. **PythonAnywhere** (Free tier available)
   - Free tier with some limitations
   - Simple setup
   - https://www.pythonanywhere.com

4. **Fly.io** (Free tier available)
   - Generous free tier
   - Good for Flask apps
   - https://fly.io

5. **Heroku** (Free tier discontinued, but affordable paid tier)
   - Easy deployment
   - https://heroku.com

### Deployment Steps (Railway Example)

1. Create account on Railway
2. Connect your GitHub repository
3. Add Python buildpack
4. Set start command: `python app.py`
5. Deploy!

**Note**: For production, you should:
- Use `gunicorn` or `waitress` as the WSGI server instead of Flask's development server
- Set up environment variables for configuration
- Use a production-grade database (PostgreSQL) if needed (Railway provides this)

## Development

### Adding Sample Data

Run the sample data script to populate the database with example scripture and topics:

```bash
python init_sample_data.py
```

### Downloading Bible Versions

The application includes scripts to download Bible versions from the bible-api.com service:

1. **Download specific books and versions:**
   ```bash
   python download_bible.py
   ```
   This script downloads WEB and NET versions for Genesis and Exodus.

2. **Download specific chapters:**
   ```bash
   python download_exodus_web.py
   ```
   This script downloads all chapters of Exodus for the WEB version.

Note: The bible-api.com service has rate limits, so the scripts include delays between requests.

### Database Schema

- **scripture**: Stores scripture verses (id, book, chapter, verse, text, version_id, format_type)
- **topics**: Stores topics (id, name, description)
- **scripture_topics**: Junction table linking verses to topics
- **scripture_tags**: Stores word-level tags/highlights (id, topic_id, version, start_position, end_position, created_at)
- **bible_versions**: Stores Bible version information (id, name, abbreviation, full_name)

## License

This project is open source and available for personal use.

## Support

For issues or questions, please create an issue in the repository or contact the maintainer.

