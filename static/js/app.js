// Global state
let currentVerseId = null;
let currentBook = null;
let currentChapter = null;
let currentVersionId = null;
let availableVersions = [];

// Standard Protestant Bible books in order
const BIBLE_BOOKS = [
    // Old Testament
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Songs', 'Isaiah', 'Jeremiah', 'Lamentations',
    'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    // New Testament
    'Matthew', 'Mark', 'Luke', 'John', 'Acts',
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy',
    '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
    '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation'
];

// Load Bible navigator on page load
document.addEventListener('DOMContentLoaded', () => {
    loadVersions();
    renderBibleNavigator();
});

// Load available Bible versions
async function loadVersions() {
    try {
        const response = await fetch('/api/versions');
        availableVersions = await response.json();
        
        const selector = document.getElementById('version-selector');
        selector.innerHTML = '<option value="">Select a version...</option>' +
            availableVersions.map(version => 
                `<option value="${version.id}">${version.name}</option>`
            ).join('');
        
        // Set default to WEB version if available, otherwise first version
        const webVersion = availableVersions.find(v => 
            v.abbreviation === 'WEB' || v.name === 'World English Bible'
        );
        
        if (webVersion) {
            currentVersionId = webVersion.id;
            selector.value = currentVersionId;
        } else if (availableVersions.length > 0) {
            currentVersionId = availableVersions[0].id;
            selector.value = currentVersionId;
        }
    } catch (error) {
        console.error('Error loading versions:', error);
        document.getElementById('version-selector').innerHTML = 
            '<option value="">Error loading versions</option>';
    }
}

// Change Bible version
function changeVersion() {
    const selector = document.getElementById('version-selector');
    currentVersionId = selector.value ? parseInt(selector.value) : null;
    
    // If a book and chapter are currently selected, reload them
    if (currentBook && currentChapter) {
        selectChapter(currentBook, currentChapter);
    } else if (currentBook) {
        // Just book selected, reload chapters
        selectBook(currentBook);
    }
}

// Render the Bible navigator (all books)
function renderBibleNavigator() {
    const navigator = document.getElementById('bible-navigator');
    
    navigator.innerHTML = BIBLE_BOOKS.map((book, index) => {
        const isOT = index < 39; // Old Testament has 39 books
        return `
            <div class="book-item ${isOT ? 'old-testament' : 'new-testament'}" 
                 onclick="selectBook('${book}')">
                ${book}
            </div>
        `;
    }).join('');
}

// Select a book
async function selectBook(bookName) {
    currentBook = bookName;
    currentChapter = null;
    currentVerseId = null;
    selectedTagRange = null; // Clear selected tag when selecting a book
    
    try {
        // Get chapters for this book (filter by version if selected)
        let url = `/api/scripture/book/${encodeURIComponent(bookName)}/chapters`;
        if (currentVersionId) {
            url += `?version_id=${currentVersionId}`;
        }
        const response = await fetch(url);
        const chapters = await response.json();
        
        if (chapters.length === 0) {
            document.getElementById('middle-pane-title').textContent = bookName;
            document.getElementById('scripture-content').innerHTML = 
                `<p class="placeholder">No scripture found for ${bookName}. You can add verses for this book.</p>`;
            document.getElementById('topics-content').innerHTML = 
                '<p class="placeholder">Select a scripture verse to see related topics</p>';
            return;
        }
        
        // Hide Bible navigator
        document.getElementById('bible-navigator').style.display = 'none';
        
        // Update middle pane
        document.getElementById('middle-pane-title').textContent = bookName;
        document.getElementById('scripture-content').innerHTML = 
            '<p class="placeholder">Select a chapter to view scripture</p>';
        
        // Clear topics
        document.getElementById('topics-content').innerHTML = 
            '<p class="placeholder">Select a scripture verse to see related topics</p>';
        
        // Show chapters
        renderChapters(bookName, chapters);
        
        // Update active state
        updateActiveBook(bookName);
        
    } catch (error) {
        console.error('Error loading chapters:', error);
        document.getElementById('scripture-content').innerHTML = 
            '<p class="error">Failed to load chapters. Please try again.</p>';
    }
}

// Render chapters for selected book
function renderChapters(bookName, chapters) {
    const chapterList = document.getElementById('chapter-list');
    chapterList.style.display = 'block';
    
    chapterList.innerHTML = `
        <div class="chapter-header">
            <button onclick="goBackToBooks()" class="back-btn">← Back to Books</button>
            <h3>${bookName}</h3>
        </div>
        <div class="chapters-grid">
            ${chapters.map(chapter => `
                <div class="chapter-item" onclick="selectChapter('${bookName}', ${chapter})">
                    ${chapter}
                </div>
            `).join('')}
        </div>
    `;
}

// Go back to book list
function goBackToBooks() {
    currentBook = null;
    currentChapter = null;
    currentVerseId = null;
    selectedTagRange = null; // Clear selected tag when going back to books
    document.getElementById('bible-navigator').style.display = 'flex';
    document.getElementById('chapter-list').style.display = 'none';
    document.getElementById('middle-pane-title').textContent = 'Scripture';
    document.getElementById('scripture-content').innerHTML = 
        '<p class="placeholder">Select a book and chapter to view scripture</p>';
    document.getElementById('topics-content').innerHTML = 
        '<p class="placeholder">Select a scripture verse to see related topics</p>';
    updateActiveBook(null);
}

// Select a chapter
async function selectChapter(bookName, chapter) {
    currentChapter = chapter;
    currentVerseId = null;
    
    try {
        // Get verses for this chapter (filter by version if selected)
        let url = `/api/scripture/book/${encodeURIComponent(bookName)}?chapter=${chapter}`;
        if (currentVersionId) {
            url += `&version_id=${currentVersionId}`;
        }
        const response = await fetch(url);
        const verses = await response.json();
        
        if (verses.length === 0) {
            displayScriptureContent(`<p class="placeholder">No verses found for ${bookName} chapter ${chapter}.</p>`);
            return;
        }
        
        // Update middle pane title
        document.getElementById('middle-pane-title').textContent = `${bookName} ${chapter}`;
        
        // Show verses in middle pane (this will also load and display topics)
        renderVerses(bookName, chapter, verses);
        
    } catch (error) {
        console.error('Error loading verses:', error);
        displayScriptureContent('<p class="error">Failed to load verses. Please try again.</p>');
    }
}

// Render verses for selected chapter in middle pane
async function renderVerses(bookName, chapter, verses) {
    const scriptureContent = document.getElementById('scripture-content');
    
    // Load tags for this chapter
    let tags = [];
    try {
        let url = `/api/scripture/tags?book=${encodeURIComponent(bookName)}&chapter=${chapter}`;
        if (currentVersionId) {
            url += `&version_id=${currentVersionId}`;
        }
        const response = await fetch(url);
        tags = await response.json();
    } catch (error) {
        console.error('Error loading tags:', error);
    }
    
        // Load topics for this chapter
        let chapterTopics = [];
        try {
            let url = `/api/scripture/topics?book=${encodeURIComponent(bookName)}&chapter=${chapter}`;
            if (currentVersionId) {
                url += `&version_id=${currentVersionId}`;
            }
            const response = await fetch(url);
            chapterTopics = await response.json();
            
            // Store all chapter topics
            allChapterTopics = chapterTopics;
            
            // Build topic-to-verses mapping
            await buildTopicToVersesMap(chapterTopics, verses);
            
            // Clear topic selection when changing chapters
            selectedTopicId = null;
            selectedTagRange = null; // Clear selected tag when changing chapters
            clearTopicHighlight();
            expandedTopics.clear();
            
            // Display topics in topics pane (will be filtered by visibility)
            displayTopics(chapterTopics, true);
        } catch (error) {
            console.error('Error loading chapter topics:', error);
            document.getElementById('topics-content').innerHTML = 
                '<p class="placeholder">No topics found for this chapter.</p>';
        }
    
    // Group verses by format type and organize into paragraphs/poetry
    const formatted = formatScriptureVerses(verses, tags);
    
    scriptureContent.innerHTML = `
        <div class="verse-list-header">
            <h3 class="book-chapter-title">${bookName} ${chapter}</h3>
            <p class="verse-count">${verses.length} verse${verses.length !== 1 ? 's' : ''}</p>
        </div>
        <div class="scripture-formatted">
            ${formatted}
        </div>
    `;
    
    // Set up intersection observer for verse visibility
    setupVerseVisibilityObserver();
}

// Format scripture verses into paragraphs and poetry
function formatScriptureVerses(verses, tags) {
    if (verses.length === 0) return '';
    
    // Group verses by format type
    const paragraphs = [];
    const poetry = [];
    let currentParagraph = [];
    let currentPoetryBlock = [];
    let lastFormatType = null;
    
    verses.forEach((verse, index) => {
        const formatType = verse.format_type || 'paragraph';
        
        if (formatType === 'poetry') {
            // End current paragraph if exists
            if (currentParagraph.length > 0) {
                paragraphs.push({ verses: [...currentParagraph] });
                currentParagraph = [];
            }
            
            // Start new poetry block if format changed or first poetry verse
            if (lastFormatType !== 'poetry' && currentPoetryBlock.length > 0) {
                poetry.push({ verses: [...currentPoetryBlock] });
                currentPoetryBlock = [];
            }
            currentPoetryBlock.push(verse);
        } else {
            // End current poetry block if exists
            if (currentPoetryBlock.length > 0) {
                poetry.push({ verses: [...currentPoetryBlock] });
                currentPoetryBlock = [];
            }
            
            // Create a new paragraph for each verse or small groups
            // This ensures visible spacing between paragraphs
            if (lastFormatType === 'poetry' || 
                (currentParagraph.length > 0 && index > 0 && verses[index - 1].verse + 1 !== verse.verse) ||
                currentParagraph.length >= 5) {  // Limit paragraphs to max 5 verses for readability
                if (currentParagraph.length > 0) {
                    paragraphs.push({ verses: [...currentParagraph] });
                    currentParagraph = [];
                }
            }
            currentParagraph.push(verse);
        }
        
        lastFormatType = formatType;
    });
    
    // Add remaining blocks
    if (currentParagraph.length > 0) {
        paragraphs.push({ verses: [...currentParagraph] });
    }
    if (currentPoetryBlock.length > 0) {
        poetry.push({ verses: [...currentPoetryBlock] });
    }
    
    // If no formatting, default to paragraph grouping
    if (paragraphs.length === 0 && poetry.length === 0) {
        paragraphs.push({ verses: verses });
    }
    
    // Render paragraphs and poetry in order
    let html = '';
    let paraIndex = 0;
    let poetryIndex = 0;
    
    // Process verses in order and render blocks
    verses.forEach((verse, index) => {
        const formatType = verse.format_type || 'paragraph';
        
        if (formatType === 'poetry') {
            // Check if this is the first verse of a poetry block
            if (poetryIndex < poetry.length && poetry[poetryIndex].verses[0].id === verse.id) {
                html += '<div class="scripture-poetry">';
                poetry[poetryIndex].verses.forEach(v => {
                    html += renderVerseWithHighlights(v, tags, true);
                });
                html += '</div>';
                poetryIndex++;
            }
        } else {
            // Check if this is the first verse of a paragraph block
            if (paraIndex < paragraphs.length && paragraphs[paraIndex].verses[0].id === verse.id) {
                html += '<div class="scripture-paragraph">';
                paragraphs[paraIndex].verses.forEach(v => {
                    html += renderVerseWithHighlights(v, tags, false);
                });
                html += '</div>';
                paraIndex++;
            }
        }
    });
    
    return html;
}

// Render a verse with highlights applied
function renderVerseWithHighlights(verse, tags, isPoetry = false) {
    let text = verse.text;
    
    // Split text into words with punctuation handling
    const words = text.match(/\S+/g) || [];
    
    // Apply highlights based on word indices (but don't show them initially)
    // Display uses 1-based indexing (first word = 1), but store as 0-based internally
    let wordHtml = words.map((word, wordIndex) => {
        const displayWordIndex = wordIndex + 1; // Convert to 1-based for display
        
        return `<span class="word" 
                     data-verse-id="${verse.id}" 
                     data-word-index="${wordIndex}"
                     data-display-word-index="${displayWordIndex}"
                     onmousedown="startWordSelection(event)"
                     onmouseenter="continueWordSelection(event)"
                     onmouseup="endWordSelection(event)"
                     oncontextmenu="return false;"
                     onselectstart="return false;"
                     ondragstart="return false;">${escapeHtml(word)}</span>`;
    }).join(' ');
    
    const verseHtml = `<span class="verse-text" data-verse-id="${verse.id}">${wordHtml}</span>`;
    
    if (isPoetry) {
        return `<div class="poetry-line" data-verse-id="${verse.id}">${verseHtml}</div>`;
    } else {
        // Wrap verse number and text together so indent applies to both
        return `<span class="verse-inline" 
                     data-verse-id="${verse.id}">
                    <span class="verse-number-inline" data-verse-id="${verse.id}">${verse.verse}</span>
                    ${verseHtml}
                </span>`;
    }
}

// Text selection state
let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;
let selectedWords = [];

// Start word selection
function startWordSelection(event) {
    if (event.which !== 1 && event.button !== 0) return; // Only left mouse button
    
    // Aggressively prevent all default behaviors that could trigger Look Up
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Prevent macOS Look Up feature - cancel if any modifier keys
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    
    // Cancel any pending text selection
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    if (document.selection) {
        document.selection.empty();
    }
    
    const wordElement = event.target.closest('.word');
    if (!wordElement || !wordElement.classList.contains('word')) return;
    
    // Check if this word is already selected
    if (wordElement.classList.contains('word-selected')) {
        // Clear the entire selection if clicking on an already selected word
        clearWordSelection();
        clearWordSelectionPane();
        selectionStart = null;
        selectionEnd = null;
        return;
    }
    
    isSelecting = true;
    
    // Clear previous selection
    clearWordSelection();
    
    // Set start position
    const verseId = parseInt(wordElement.getAttribute('data-verse-id'));
    const wordIndex = parseInt(wordElement.getAttribute('data-word-index'));
    selectionStart = { verseId, wordIndex, element: wordElement };
    selectionEnd = null; // Will be set on mouseup
    
    // Mark word as selected immediately
    wordElement.classList.add('word-selected');
    selectedWords.push(wordElement);
}

// Continue word selection
function continueWordSelection(event) {
    if (!isSelecting) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const wordElement = event.target.closest('.word');
    if (!wordElement || !wordElement.classList.contains('word')) return;
    
    const verseId = parseInt(wordElement.getAttribute('data-verse-id'));
    const wordIndex = parseInt(wordElement.getAttribute('data-word-index'));
    
    // Update end position
    selectionEnd = { verseId, wordIndex, element: wordElement };
    
    // Update selection visually
    updateWordSelection();
}

// End word selection
function endWordSelection(event) {
    if (!isSelecting) return;
    
    isSelecting = false;
    
    // Ensure we have both start and end
    if (!selectionEnd) {
        selectionEnd = selectionStart;
    }
    
    if (selectionStart && selectionEnd) {
        // Update selection visually one last time
        updateWordSelection();
        
        // Show selection in selection pane
        showSelection();
    }
    
    // Prevent verse click
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
}

// Update word selection visually
function updateWordSelection() {
    if (!selectionStart || !selectionEnd) return;
    
    // Clear current selection
    clearWordSelection();
    selectedWords = [];
    
    // Get all words in the scripture content
    const allWords = Array.from(document.querySelectorAll('.word'));
    
    // Find start and end words
    const startIdx = allWords.findIndex(w => 
        parseInt(w.getAttribute('data-verse-id')) === selectionStart.verseId &&
        parseInt(w.getAttribute('data-word-index')) === selectionStart.wordIndex
    );
    
    const endIdx = allWords.findIndex(w => 
        parseInt(w.getAttribute('data-verse-id')) === selectionEnd.verseId &&
        parseInt(w.getAttribute('data-word-index')) === selectionEnd.wordIndex
    );
    
    if (startIdx === -1 || endIdx === -1) return;
    
    // Select all words between start and end (inclusive)
    const start = Math.min(startIdx, endIdx);
    const end = Math.max(startIdx, endIdx);
    
    for (let i = start; i <= end; i++) {
        allWords[i].classList.add('word-selected');
        selectedWords.push(allWords[i]);
    }
}

// Clear word selection
function clearWordSelection() {
    document.querySelectorAll('.word-selected').forEach(word => {
        word.classList.remove('word-selected');
    });
    selectedWords = [];
}

// Show selection in the selection pane
async function showSelection() {
    if (!selectionStart || !selectionEnd) {
        document.getElementById('selection-content').innerHTML = 
            '<p class="placeholder">Select words to create a highlight</p>';
        return;
    }
    
    // Normalize selection (start should be before end)
    const startVerseId = selectionStart.verseId;
    const endVerseId = selectionEnd.verseId;
    const startWordIndex = selectionStart.wordIndex;
    const endWordIndex = selectionEnd.wordIndex;
    
    let normalizedStart = { verseId: startVerseId, wordIndex: startWordIndex };
    let normalizedEnd = { verseId: endVerseId, wordIndex: endWordIndex };
    
    // If selection is backwards, swap
    if (startVerseId > endVerseId || 
        (startVerseId === endVerseId && startWordIndex > endWordIndex)) {
        normalizedStart = { verseId: endVerseId, wordIndex: endWordIndex };
        normalizedEnd = { verseId: startVerseId, wordIndex: startWordIndex };
    }
    
    // Get verse details to display book, chapter, verse
    try {
        const startVerseResponse = await fetch(`/api/scripture/${normalizedStart.verseId}`);
        const startVerse = await startVerseResponse.json();
        
        const endVerseResponse = await fetch(`/api/scripture/${normalizedEnd.verseId}`);
        const endVerse = await endVerseResponse.json();
        
        const startAbbr = getBookAbbreviation(startVerse.book);
        const endAbbr = getBookAbbreviation(endVerse.book);
        
        // Convert to 1-based display (wordIndex is 0-based internally)
        const startDisplayWordIndex = normalizedStart.wordIndex + 1;
        const endDisplayWordIndex = normalizedEnd.wordIndex + 1;
        
        // Format: Gen 1:1.1 - Gen 1:2.5 (1-based display)
        const selectionText = `${startAbbr} ${startVerse.chapter}:${startVerse.verse}.${startDisplayWordIndex} - ${endAbbr} ${endVerse.chapter}:${endVerse.verse}.${endDisplayWordIndex}`;
        
        // Get topics for selection pane
        const topicsResponse = await fetch('/api/topics');
        const topics = await topicsResponse.json();
        
        const selectionContent = document.getElementById('selection-content');
        selectionContent.innerHTML = `
            <div class="selection-display">
                <div class="selection-reference">${selectionText}</div>
                <label class="selection-label">Link to Topic (optional):</label>
                <select id="highlight-topic-select" class="selection-topic-select" onchange="toggleNewTopicInput()">
                    <option value="">No topic</option>
                    <option value="__new__">+ Create New Topic</option>
                    ${topics.map(topic => 
                        `<option value="${topic.id}">${topic.name}</option>`
                    ).join('')}
                </select>
                <div id="new-topic-form" class="new-topic-form" style="display: none;">
                    <label class="selection-label">Topic Name:</label>
                    <input type="text" id="new-topic-name" class="new-topic-input" placeholder="Enter topic name" />
                    <label class="selection-label">Description (optional):</label>
                    <textarea id="new-topic-description" class="new-topic-textarea" placeholder="Enter topic description"></textarea>
                </div>
                <div class="selection-buttons">
                    <button onclick="createHighlight(${normalizedStart.verseId}, ${normalizedStart.wordIndex}, ${normalizedEnd.verseId}, ${normalizedEnd.wordIndex})" class="create-highlight-btn">Create Highlight</button>
                    <button onclick="clearWordSelectionPane()" class="clear-selection-btn">Clear</button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading verse details:', error);
        document.getElementById('selection-content').innerHTML = 
            '<p class="error">Error loading selection details</p>';
    }
}


// Toggle new topic input form
function toggleNewTopicInput() {
    const select = document.getElementById('highlight-topic-select');
    const newTopicForm = document.getElementById('new-topic-form');
    
    if (select.value === '__new__') {
        newTopicForm.style.display = 'block';
    } else {
        newTopicForm.style.display = 'none';
    }
}

// Create tag (highlight)
async function createHighlight(startVerseId, startWordIndex, endVerseId, endWordIndex) {
    const topicSelect = document.getElementById('highlight-topic-select');
    let topicId = topicSelect.value;
    
    // If creating a new topic
    if (topicSelect.value === '__new__') {
        const topicName = document.getElementById('new-topic-name').value.trim();
        const topicDescription = document.getElementById('new-topic-description').value.trim();
        
        if (!topicName) {
            alert('Please enter a topic name');
            return;
        }
        
        try {
            // Create the new topic
            const topicResponse = await fetch('/api/topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: topicName,
                    description: topicDescription || ''
                })
            });
            
            if (topicResponse.ok) {
                const newTopic = await topicResponse.json();
                topicId = newTopic.id;
            } else {
                const error = await topicResponse.json();
                alert('Error creating topic: ' + (error.error || 'Unknown error'));
                return;
            }
        } catch (error) {
            console.error('Error creating topic:', error);
            alert('Error creating topic. Please try again.');
            return;
        }
    }
    
    // Get verse details to create position strings
    try {
        const startVerseResponse = await fetch(`/api/scripture/${startVerseId}`);
        const startVerse = await startVerseResponse.json();
        
        const endVerseResponse = await fetch(`/api/scripture/${endVerseId}`);
        const endVerse = await endVerseResponse.json();
        
        // Get current version abbreviation
        const version = availableVersions.find(v => v.id === currentVersionId);
        if (!version) {
            alert('No version selected');
            return;
        }
        
        // Create position strings (word index is 0-based)
        const startPosition = createPosition(startVerse.book, startVerse.chapter, startVerse.verse, startWordIndex);
        const endPosition = createPosition(endVerse.book, endVerse.chapter, endVerse.verse, endWordIndex);
        
        // Create the tag
        const response = await fetch('/api/scripture/tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic_id: topicId || null,
                version: version.abbreviation,
                start_position: startPosition,
                end_position: endPosition
            })
        });
        
        if (response.ok) {
            // Reload the chapter to show highlights
            if (currentBook && currentChapter) {
                await selectChapter(currentBook, currentChapter);
            }
            
            // Clear selection
            clearWordSelectionPane();
            
            // Show success message briefly
            const selectionContent = document.getElementById('selection-content');
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = 'Tag created successfully!';
            selectionContent.appendChild(successMsg);
            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.remove();
                }
            }, 2000);
        } else {
            const error = await response.json();
            alert('Error creating tag: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating tag:', error);
        alert('Error creating tag. Please try again.');
    }
}

// Clear word selection
function clearWordSelectionPane() {
    clearWordSelection();
    selectionStart = null;
    selectionEnd = null;
    document.getElementById('selection-content').innerHTML = 
        '<p class="placeholder">Select words to create a highlight</p>';
}

// Handle mouse up globally to end selection
document.addEventListener('mouseup', (event) => {
    if (isSelecting) {
        // If no end was set, use start (single word selection)
        if (!selectionEnd && selectionStart) {
            selectionEnd = selectionStart;
        }
        endWordSelection(event);
    }
});

// Prevent text selection on scripture to allow word selection
document.addEventListener('selectstart', (event) => {
    // Prevent macOS Look Up on word elements
    if (event.target && (event.target.classList.contains('word') || 
                         event.target.closest('.word'))) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    // Prevent default text selection on verse elements
    if (event.target && (event.target.classList.contains('verse-inline') || 
                         event.target.classList.contains('poetry-line') ||
                         event.target.closest('.verse-inline') ||
                         event.target.closest('.poetry-line'))) {
        event.preventDefault();
        return false;
    }
}, true);

// Prevent macOS Look Up feature (three-finger tap or force click)
document.addEventListener('contextmenu', (event) => {
    if (event.target && (event.target.classList.contains('word') || 
                         event.target.closest('.word'))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
    }
}, true);

// Prevent force touch / 3D touch lookup
document.addEventListener('webkitmouseforcedown', (event) => {
    if (event.target && (event.target.classList.contains('word') || 
                         event.target.closest('.word'))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
    }
}, true);

// Prevent macOS force click lookup
document.addEventListener('webkitmouseforcewillbegin', (event) => {
    if (event.target && (event.target.classList.contains('word') || 
                         event.target.closest('.word'))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
    }
}, true);

// Prevent mouseup after force click
document.addEventListener('webkitmouseforcechanged', (event) => {
    if (event.target && (event.target.classList.contains('word') || 
                         event.target.closest('.word'))) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
}, true);

// Additional event prevention
document.addEventListener('dragstart', (event) => {
    if (event.target && (event.target.classList.contains('word') || 
                         event.target.closest('.word'))) {
        event.preventDefault();
        return false;
    }
}, true);

// Display content in middle pane
function displayScriptureContent(html) {
    document.getElementById('scripture-content').innerHTML = html;
}

// Go back to chapter list
async function goBackToChapters() {
    if (currentBook) {
        currentChapter = null;
        currentVerseId = null;
        
        try {
            // Get chapters for this book (filter by version if selected)
            let url = `/api/scripture/book/${encodeURIComponent(currentBook)}/chapters`;
            if (currentVersionId) {
                url += `?version_id=${currentVersionId}`;
            }
            const response = await fetch(url);
            const chapters = await response.json();
            
            // Clear middle pane
            document.getElementById('middle-pane-title').textContent = currentBook;
            document.getElementById('scripture-content').innerHTML = 
                '<p class="placeholder">Select a chapter to view scripture</p>';
            
            // Clear topics
            document.getElementById('topics-content').innerHTML = 
                '<p class="placeholder">Select a scripture verse to see related topics</p>';
            
            // Show chapters
            renderChapters(currentBook, chapters);
            
        } catch (error) {
            console.error('Error loading chapters:', error);
            alert('Failed to load chapters. Please try again.');
        }
    }
}

// Select a verse and load its topics
async function selectVerse(verseId) {
    currentVerseId = verseId;
    
    try {
        // Get verse details
        const verseResponse = await fetch(`/api/scripture/${verseId}`);
        const verse = await verseResponse.json();
        
        // Get related topics
        const topicsResponse = await fetch(`/api/scripture/${verseId}/topics`);
        const topics = await topicsResponse.json();
        
        // Display topics in right pane
        displayTopics(topics);
        
        // Update active state in verse list
        updateActiveVerse(verseId);
        
        // Highlight the selected verse
        const verseElement = document.querySelector(`[data-verse-id="${verseId}"]`);
        if (verseElement) {
            verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (error) {
        console.error('Error loading verse details:', error);
        document.getElementById('topics-content').innerHTML = 
            '<p class="error">Failed to load verse details. Please try again.</p>';
    }
}

// Store all chapter topics and verse-to-topic mapping
let allChapterTopics = [];
let topicToVersesMap = new Map(); // Map<topicId, Set<verseId>>
let topicToHighlightsMap = new Map(); // Map<topicId, Array<highlight>> - stores highlight details for formatting
let visibleVerseIds = new Set();
let topicsIntersectionObserver = null;
let expandedTopics = new Set(); // Set of topic IDs that are expanded to show verses

// Display topics (filtered by visible verses)
function displayTopics(topics, filterByVisibility = false) {
    const topicsContent = document.getElementById('topics-content');
    
    // If filtering by visibility, only show topics for visible verses
    let topicsToShow = topics;
    if (filterByVisibility && visibleVerseIds.size > 0) {
        topicsToShow = topics.filter(topic => {
            const topicVerses = topicToVersesMap.get(topic.id);
            if (!topicVerses || topicVerses.size === 0) return false;
            // Show topic if any of its verses are visible
            for (const verseId of topicVerses) {
                if (visibleVerseIds.has(verseId)) {
                    return true;
                }
            }
            return false;
        });
    }
    
    if (topicsToShow.length === 0) {
        topicsContent.innerHTML = '<p class="placeholder">No topics found for visible verses.</p>';
        return;
    }
    
    // Build verse details map for display
    const verseDetailsMap = new Map(); // Will be populated asynchronously
    
    topicsContent.innerHTML = topicsToShow.map(topic => {
        // Check if this topic is currently selected
        const isActive = selectedTopicId !== null && selectedTopicId === topic.id;
        const isExpanded = expandedTopics.has(topic.id);
        const topicTags = topicToHighlightsMap.get(topic.id) || [];
        const hasTags = topicTags.length > 0;
        const showToggle = hasTags && isActive;
        
        let versesHtml = '';
        if (isExpanded && hasTags && isActive) {
            // Get tags for this topic - show tags instead of all verses
            // Create one entry per tag (not per verse)
            const tagListItems = topicTags.map((tag, index) => {
                // Use a unique identifier for each tag (use tag id if available, or index)
                const tagKey = tag.id || `tag-${topic.id}-${index}`;
                return `<div class="topic-verse-item" onclick="event.stopPropagation(); highlightTagRange('${tag.start_position}', '${tag.end_position}')" data-tag-id="${tagKey}" data-start-pos="${tag.start_position}" data-end-pos="${tag.end_position}">Loading...</div>`;
            }).join('');
            
            versesHtml = `<div class="topic-verses-list">${tagListItems}</div>`;
        }
        
        return `
        <div class="topic-item${isActive ? ' active' : ''}" data-topic-id="${topic.id}">
            <div class="topic-header" onclick="selectTopic(${topic.id})">
                ${showToggle ? `<span class="topic-expand-toggle" onclick="event.stopPropagation(); toggleTopicVerses(${topic.id})">${isExpanded ? '−' : '+'}</span>` : ''}
                <div class="topic-content">
                    <div class="topic-name">${escapeHtml(topic.name)}</div>
                    ${topic.description ? `<div class="topic-description">${escapeHtml(topic.description)}</div>` : ''}
                </div>
            </div>
            ${versesHtml}
        </div>
    `;
    }).join('');
    
    // Load verse details for expanded topics asynchronously
    if (topicsToShow.some(t => expandedTopics.has(t.id) && selectedTopicId === t.id)) {
        loadVerseDetailsForTopics(topicsToShow);
    }
}

// Get book abbreviation helper function
function getBookAbbreviation(bookName) {
    const abbrevs = {
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
    };
    return abbrevs[bookName] || bookName.substring(0, 4);
}

// Parse position string "Gen 1:1.0" into {bookAbbr, chapter, verse, wordIndex}
function parsePosition(positionString) {
    // Format: "Gen 1:1.0" or "Gen 1:18.8"
    const match = positionString.match(/^(\w+(?:\s+\w+)?)\s+(\d+):(\d+)\.(\d+)$/);
    if (!match) return null;
    
    return {
        bookAbbr: match[1],
        chapter: parseInt(match[2]),
        verse: parseInt(match[3]),
        wordIndex: parseInt(match[4])
    };
}

// Create position string from verse and word index (word index is 0-based)
function createPosition(bookName, chapter, verse, wordIndex) {
    const bookAbbr = getBookAbbreviation(bookName);
    return `${bookAbbr} ${chapter}:${verse}.${wordIndex}`;
}

// Check if a verse matches a position string
function verseMatchesPosition(verse, positionString) {
    const pos = parsePosition(positionString);
    if (!pos) return false;
    
    const verseBookAbbr = getBookAbbreviation(verse.book);
    return verseBookAbbr === pos.bookAbbr && 
           verse.chapter === pos.chapter && 
           verse.verse === pos.verse;
}

// Load verse details for expanded topics
async function loadVerseDetailsForTopics(topics) {
    for (const topic of topics) {
        if (!expandedTopics.has(topic.id) || selectedTopicId !== topic.id) continue;
        
        const topicTags = topicToHighlightsMap.get(topic.id) || []; // These are actually tags now
        
        // Process each tag - show one entry per tag (not per verse)
        const processedTagIds = new Set();
        for (const tag of topicTags) {
            // Skip if we've already processed this tag
            const tagKey = tag.id || `tag-${topic.id}-${topicTags.indexOf(tag)}`;
            if (processedTagIds.has(tagKey)) continue;
            processedTagIds.add(tagKey);
            
            // Get ALL matching elements (in case of duplicates) and process only the first one
            const tagItems = document.querySelectorAll(`.topic-verse-item[data-tag-id="${tagKey}"]`);
            if (tagItems.length === 0) continue;
            
            // Only process the first element (remove any duplicates)
            const tagItem = tagItems[0];
            // Remove any duplicate elements
            for (let i = 1; i < tagItems.length; i++) {
                tagItems[i].remove();
            }
            
            // Parse position strings
            const startPos = parsePosition(tag.start_position);
            const endPos = parsePosition(tag.end_position);
            
            if (startPos && endPos) {
                // Format position strings (word index is 0-based, convert to 1-based for display)
                const startDisplayWordIndex = startPos.wordIndex + 1;
                const endDisplayWordIndex = endPos.wordIndex + 1;
                
                // Format: Gen 1:1.1 - Gen 1:2.5
                if (startPos.chapter === endPos.chapter && startPos.verse === endPos.verse && 
                    startPos.wordIndex === endPos.wordIndex) {
                    // Single word
                    tagItem.textContent = `${startPos.bookAbbr} ${startPos.chapter}:${startPos.verse}.${startDisplayWordIndex}`;
                } else if (startPos.chapter === endPos.chapter && startPos.verse === endPos.verse) {
                    // Same verse, word range
                    tagItem.textContent = `${startPos.bookAbbr} ${startPos.chapter}:${startPos.verse}.${startDisplayWordIndex} - ${startPos.verse}.${endDisplayWordIndex}`;
                } else {
                    // Cross verse range - show the range
                    tagItem.textContent = `${startPos.bookAbbr} ${startPos.chapter}:${startPos.verse}.${startDisplayWordIndex} - ${endPos.bookAbbr} ${endPos.chapter}:${endPos.verse}.${endDisplayWordIndex}`;
                }
            } else {
                // Fallback if position parsing fails
                tagItem.textContent = `${tag.start_position} - ${tag.end_position}`;
            }
        }
    }
}

// Highlight a tag range (used when clicking on a tag in the expanded list)
async function highlightTagRange(startPosition, endPosition) {
    // Check if this tag is already selected
    if (selectedTagRange && 
        selectedTagRange.startPosition === startPosition && 
        selectedTagRange.endPosition === endPosition) {
        // Already selected - clear highlights
        clearTopicHighlight();
        selectedTagRange = null;
        return;
    }
    
    // Clear any existing highlights and select this tag
    clearTopicHighlight();
    selectedTagRange = { startPosition, endPosition };
    
    // Parse positions to find which words to highlight
    const startPos = parsePosition(startPosition);
    const endPos = parsePosition(endPosition);
    
    if (!startPos || !endPos) return;
    
    // Get all verses in the current chapter to match positions
    const allVerses = Array.from(document.querySelectorAll('.verse-inline, .poetry-line'));
    const verseDetailsMap = new Map();
    
    // First, fetch all verse details we need
    for (const verseEl of allVerses) {
        const verseId = parseInt(verseEl.getAttribute('data-verse-id'));
        if (!verseId || verseDetailsMap.has(verseId)) continue;
        
        try {
            const response = await fetch(`/api/scripture/${verseId}`);
            const verse = await response.json();
            verseDetailsMap.set(verseId, verse);
        } catch (error) {
            console.error(`Error loading verse ${verseId}:`, error);
        }
    }
    
    // Now find and highlight words using the same logic as highlightWordsForTopic
    const allWords = Array.from(document.querySelectorAll('.word'));
    const highlightedVerseIds = new Set();
    
    allWords.forEach(word => {
        const verseId = parseInt(word.getAttribute('data-verse-id'));
        const wordIndex = parseInt(word.getAttribute('data-word-index'));
        const verse = verseDetailsMap.get(verseId);
        
        if (!verse) return;
        
        // Check if this word is in the tag range
        let shouldHighlight = false;
        
        const verseBookAbbr = getBookAbbreviation(verse.book);
        const verseChapter = verse.chapter;
        const verseVerse = verse.verse;
        const startChapter = startPos.chapter;
        const startVerse = startPos.verse;
        const endChapter = endPos.chapter;
        const endVerse = endPos.verse;
        
        // First check if the book abbreviation matches
        if (verseBookAbbr !== startPos.bookAbbr || verseBookAbbr !== endPos.bookAbbr) {
            return; // Not in the same book, skip this word
        }
        
        // Check if verse is in the tag range
        if (verseChapter === startChapter && verseChapter === endChapter) {
            // Start and end are in the same chapter
            if (verseVerse === startVerse && verseVerse === endVerse) {
                // Same verse - check word index range
                if (wordIndex >= startPos.wordIndex && wordIndex <= endPos.wordIndex) {
                    shouldHighlight = true;
                }
            } else if (verseVerse === startVerse) {
                // This is the start verse - only highlight words from startPos.wordIndex onwards
                if (wordIndex >= startPos.wordIndex) {
                    shouldHighlight = true;
                }
            } else if (verseVerse === endVerse) {
                // This is the end verse - only highlight words up to endPos.wordIndex
                if (wordIndex <= endPos.wordIndex) {
                    shouldHighlight = true;
                }
            } else if (verseVerse > startVerse && verseVerse < endVerse) {
                // Verse is completely between start and end - highlight all words
                shouldHighlight = true;
            }
        } else if (verseChapter === startChapter) {
            // Verse is in the start chapter
            if (verseVerse === startVerse) {
                // This is the start verse - only highlight words from startPos.wordIndex onwards
                if (wordIndex >= startPos.wordIndex) {
                    shouldHighlight = true;
                }
            } else if (verseVerse > startVerse) {
                // Verse is after start verse in start chapter - highlight all words
                shouldHighlight = true;
            }
        } else if (verseChapter === endChapter) {
            // Verse is in the end chapter
            if (verseVerse === endVerse) {
                // This is the end verse - only highlight words up to endPos.wordIndex
                if (wordIndex <= endPos.wordIndex) {
                    shouldHighlight = true;
                }
            } else if (verseVerse < endVerse) {
                // Verse is before end verse in end chapter - highlight all words
                shouldHighlight = true;
            }
        } else if (verseChapter > startChapter && verseChapter < endChapter) {
            // Verse is in a chapter completely between start and end - highlight all words
            shouldHighlight = true;
        }
        
        if (shouldHighlight) {
            word.classList.add('word-highlighted');
            highlightedVerseIds.add(verseId);
        }
    });
    
    // Highlight verse numbers for verses that have highlighted words
    highlightedVerseIds.forEach(verseId => {
        const verseNumbers = document.querySelectorAll(`.verse-number-inline[data-verse-id="${verseId}"]`);
        verseNumbers.forEach(num => {
            num.classList.add('verse-number-highlighted');
        });
    });
    
    // Add rounded corners to first and last elements in highlight sequences
    applyHighlightCorners();
}

// Selected topic state
let selectedTopicId = null;
// Selected tag state (for individual tag highlighting)
let selectedTagRange = null; // Format: {startPosition, endPosition}

// Build mapping from topics to verses
async function buildTopicToVersesMap(topics, verses) {
    topicToVersesMap.clear();
    topicToHighlightsMap.clear();
    
    // Initialize map with all topics
    topics.forEach(topic => {
        topicToVersesMap.set(topic.id, new Set());
        topicToHighlightsMap.set(topic.id, []);
    });
    
    // Get verse-to-topic mappings from two sources:
    // 1. scripture_topics table (direct links)
    // 2. scripture_tags table (topics via tags)
    
    // Get topics for each verse from scripture_topics
    for (const verse of verses) {
        try {
            const topicsResponse = await fetch(`/api/scripture/${verse.id}/topics`);
            const verseTopics = await topicsResponse.json();
            verseTopics.forEach(topic => {
                if (topicToVersesMap.has(topic.id)) {
                    topicToVersesMap.get(topic.id).add(verse.id);
                }
            });
        } catch (error) {
            console.error(`Error loading topics for verse ${verse.id}:`, error);
        }
    }
    
    // Get tags and map topics to verses via tags
    try {
        if (!currentBook || !currentChapter) return;
        
        let url = `/api/scripture/tags?book=${encodeURIComponent(currentBook)}&chapter=${currentChapter}`;
        if (currentVersionId) {
            url += `&version_id=${currentVersionId}`;
        }
        const response = await fetch(url);
        const tags = await response.json();
        
        tags.forEach(tag => {
            if (tag.topic_id) {
                // Store tag details for formatting
                if (topicToHighlightsMap.has(tag.topic_id)) {
                    topicToHighlightsMap.get(tag.topic_id).push(tag);
                }
                
                // Parse position strings to find which verses are in this tag range
                const startPos = parsePosition(tag.start_position);
                const endPos = parsePosition(tag.end_position);
                
                if (startPos && endPos) {
                    // Add all verses that fall within this tag range
                    for (const verse of verses) {
                        if (verseMatchesPosition(verse, tag.start_position) ||
                            verseMatchesPosition(verse, tag.end_position)) {
                            // This verse is at the start or end of the tag
                            if (topicToVersesMap.has(tag.topic_id)) {
                                topicToVersesMap.get(tag.topic_id).add(verse.id);
                            }
                        } else {
                            // Check if verse is between start and end positions
                            const verseBookAbbr = getBookAbbreviation(verse.book);
                            const startBookAbbr = startPos.bookAbbr;
                            const endBookAbbr = endPos.bookAbbr;
                            
                            // Check if verse is in the same book and between start/end chapters/verses
                            if (verseBookAbbr === startBookAbbr && verseBookAbbr === endBookAbbr) {
                                const verseChapter = verse.chapter;
                                const verseVerse = verse.verse;
                                const startChapter = startPos.chapter;
                                const startVerse = startPos.verse;
                                const endChapter = endPos.chapter;
                                const endVerse = endPos.verse;
                                
                                // Check if verse is between start and end
                                if ((verseChapter === startChapter && verseChapter === endChapter && 
                                     verseVerse >= startVerse && verseVerse <= endVerse) ||
                                    (verseChapter === startChapter && verseVerse >= startVerse) ||
                                    (verseChapter === endChapter && verseVerse <= endVerse) ||
                                    (verseChapter > startChapter && verseChapter < endChapter)) {
                                    if (topicToVersesMap.has(tag.topic_id)) {
                                        topicToVersesMap.get(tag.topic_id).add(verse.id);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading tags for topic mapping:', error);
    }
}

// Set up intersection observer to track visible verses
function setupVerseVisibilityObserver() {
    // Clean up existing observer
    if (topicsIntersectionObserver) {
        topicsIntersectionObserver.disconnect();
    }
    
    visibleVerseIds.clear();
    
    // Find the scripture pane container
    const scripturePane = document.querySelector('.scripture-pane .pane-body');
    if (!scripturePane) return;
    
    // Create intersection observer
    topicsIntersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const verseElement = entry.target;
            const verseId = parseInt(verseElement.getAttribute('data-verse-id'));
            
            if (!verseId) return;
            
            if (entry.isIntersecting) {
                visibleVerseIds.add(verseId);
            } else {
                visibleVerseIds.delete(verseId);
            }
        });
        
        // Update topics display based on visible verses
        displayTopics(allChapterTopics, true);
        
        // Preserve active state for selected topic
        if (selectedTopicId !== null) {
            updateTopicSelection(selectedTopicId);
        }
    }, {
        root: scripturePane,
        rootMargin: '0px',
        threshold: 0.1 // Consider visible if at least 10% is shown
    });
    
    // Observe all verse elements
    const verseElements = document.querySelectorAll('.verse-inline, .poetry-line');
    verseElements.forEach(verseEl => {
        const verseId = verseEl.getAttribute('data-verse-id');
        if (verseId) {
            topicsIntersectionObserver.observe(verseEl);
            // Check initial visibility
            if (verseEl.getBoundingClientRect().top < scripturePane.getBoundingClientRect().bottom &&
                verseEl.getBoundingClientRect().bottom > scripturePane.getBoundingClientRect().top) {
                visibleVerseIds.add(parseInt(verseId));
            }
        }
    });
    
    // Initial display update
    displayTopics(allChapterTopics, true);
}

// Toggle topic verses visibility
function toggleTopicVerses(topicId) {
    if (expandedTopics.has(topicId)) {
        expandedTopics.delete(topicId);
    } else {
        expandedTopics.add(topicId);
    }
    // Re-render topics to show/hide verses
    displayTopics(allChapterTopics, true);
    // Preserve active state
    if (selectedTopicId !== null) {
        updateTopicSelection(selectedTopicId);
    }
}

// Highlight a single verse
async function highlightSingleVerse(verseId) {
    // Clear any existing highlights
    clearTopicHighlight();
    
    // Highlight just this verse
    highlightVersesForTopic([verseId]);
    
    // Scroll to the verse if not visible
    const verseElement = document.querySelector(`.verse-inline[data-verse-id="${verseId}"], .poetry-line[data-verse-id="${verseId}"]`);
    if (verseElement) {
        verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Select a topic and highlight related verses
async function selectTopic(topicId) {
    // If clicking the same topic, deselect it
    if (selectedTopicId === topicId) {
        clearTopicHighlight();
        selectedTopicId = null;
        selectedTagRange = null; // Clear selected tag when deselecting topic
        updateTopicSelection(null);
        expandedTopics.clear();
        displayTopics(allChapterTopics, true);
        return;
    }
    
    // Clear previous topic's expanded state when switching topics
    expandedTopics.clear();
    selectedTagRange = null; // Clear selected tag when switching topics
    
    selectedTopicId = topicId;
    updateTopicSelection(topicId);
    
    // Re-render topics to update + symbol visibility
    displayTopics(allChapterTopics, true);
    
    try {
        // Get all highlights for this topic in the current chapter
        if (!currentBook || !currentChapter) return;
        
        let url = `/api/scripture/tags?book=${encodeURIComponent(currentBook)}&chapter=${currentChapter}`;
        if (currentVersionId) {
            url += `&version_id=${currentVersionId}`;
        }
        const response = await fetch(url);
        const tags = await response.json();
        
        // Filter tags for this topic
        const topicTags = tags.filter(t => t.topic_id === topicId);
        
        // Highlight the words for all tags in this topic
        await highlightWordsForTopic(topicTags);
        
        // Also get verses directly linked to this topic via scripture_topics
        const verseIds = await getVerseIdsForTopic(topicId);
        if (verseIds.length > 0) {
            highlightVersesForTopic(verseIds);
        }
    } catch (error) {
        console.error('Error loading topic highlights:', error);
    }
}

// Get verse IDs for a topic from scripture_topics table
async function getVerseIdsForTopic(topicId) {
    if (!currentBook || !currentChapter) return [];
    
    try {
        // Get all verses for this chapter
        let url = `/api/scripture/book/${encodeURIComponent(currentBook)}?chapter=${currentChapter}`;
        if (currentVersionId) {
            url += `&version_id=${currentVersionId}`;
        }
        const response = await fetch(url);
        const verses = await response.json();
        
        // Get topics for each verse and find which are linked to this topic
        const verseIds = [];
        for (const verse of verses) {
            try {
                const topicsResponse = await fetch(`/api/scripture/${verse.id}/topics`);
                const topics = await topicsResponse.json();
                if (topics.some(t => t.id === topicId)) {
                    verseIds.push(verse.id);
                }
            } catch (error) {
                console.error(`Error loading topics for verse ${verse.id}:`, error);
            }
        }
        return verseIds;
    } catch (error) {
        console.error('Error getting verses for topic:', error);
        return [];
    }
}

// Highlight words for a topic based on tags
async function highlightWordsForTopic(tags) {
    // Clear any existing highlights first
    document.querySelectorAll('.word-highlighted, .verse-number-highlighted').forEach(el => {
        el.classList.remove('word-highlighted', 'verse-number-highlighted');
    });
    
    if (tags.length === 0) return;
    
    // Get all verses in the current chapter to match positions
    const allVerses = Array.from(document.querySelectorAll('.verse-inline, .poetry-line'));
    const verseDetailsMap = new Map();
    
    // First, fetch all verse details we need
    for (const verseEl of allVerses) {
        const verseId = parseInt(verseEl.getAttribute('data-verse-id'));
        if (!verseId || verseDetailsMap.has(verseId)) continue;
        
        try {
            const response = await fetch(`/api/scripture/${verseId}`);
            const verse = await response.json();
            verseDetailsMap.set(verseId, verse);
        } catch (error) {
            console.error(`Error loading verse ${verseId}:`, error);
        }
    }
    
    // Now find and highlight words for each tag
    const allWords = Array.from(document.querySelectorAll('.word'));
    const highlightedVerseIds = new Set();
    
    tags.forEach(tag => {
        // Parse position strings
        const startPos = parsePosition(tag.start_position);
        const endPos = parsePosition(tag.end_position);
        
        if (!startPos || !endPos) return;
        
        allWords.forEach(word => {
            const verseId = parseInt(word.getAttribute('data-verse-id'));
            const wordIndex = parseInt(word.getAttribute('data-word-index'));
            const verse = verseDetailsMap.get(verseId);
            
            if (!verse) return;
            
            // Check if this word is in the tag range
            let shouldHighlight = false;
            
            const verseBookAbbr = getBookAbbreviation(verse.book);
            const verseChapter = verse.chapter;
            const verseVerse = verse.verse;
            const startChapter = startPos.chapter;
            const startVerse = startPos.verse;
            const endChapter = endPos.chapter;
            const endVerse = endPos.verse;
            
            // First check if the book abbreviation matches
            if (verseBookAbbr !== startPos.bookAbbr || verseBookAbbr !== endPos.bookAbbr) {
                return; // Not in the same book, skip this word
            }
            
            // Check if verse is in the tag range
            if (verseChapter === startChapter && verseChapter === endChapter) {
                // Start and end are in the same chapter
                if (verseVerse === startVerse && verseVerse === endVerse) {
                    // Same verse - check word index range
                    if (wordIndex >= startPos.wordIndex && wordIndex <= endPos.wordIndex) {
                        shouldHighlight = true;
                    }
                } else if (verseVerse === startVerse) {
                    // This is the start verse - only highlight words from startPos.wordIndex onwards
                    if (wordIndex >= startPos.wordIndex) {
                        shouldHighlight = true;
                    }
                } else if (verseVerse === endVerse) {
                    // This is the end verse - only highlight words up to endPos.wordIndex
                    if (wordIndex <= endPos.wordIndex) {
                        shouldHighlight = true;
                    }
                } else if (verseVerse > startVerse && verseVerse < endVerse) {
                    // Verse is completely between start and end - highlight all words
                    shouldHighlight = true;
                }
            } else if (verseChapter === startChapter) {
                // Verse is in the start chapter
                if (verseVerse === startVerse) {
                    // This is the start verse - only highlight words from startPos.wordIndex onwards
                    if (wordIndex >= startPos.wordIndex) {
                        shouldHighlight = true;
                    }
                } else if (verseVerse > startVerse) {
                    // Verse is after start verse in start chapter - highlight all words
                    shouldHighlight = true;
                }
            } else if (verseChapter === endChapter) {
                // Verse is in the end chapter
                if (verseVerse === endVerse) {
                    // This is the end verse - only highlight words up to endPos.wordIndex
                    if (wordIndex <= endPos.wordIndex) {
                        shouldHighlight = true;
                    }
                } else if (verseVerse < endVerse) {
                    // Verse is before end verse in end chapter - highlight all words
                    shouldHighlight = true;
                }
            } else if (verseChapter > startChapter && verseChapter < endChapter) {
                // Verse is in a chapter completely between start and end - highlight all words
                shouldHighlight = true;
            }
            
            if (shouldHighlight) {
                word.classList.add('word-highlighted');
                highlightedVerseIds.add(verseId);
            }
        });
    });
    
    // Highlight verse numbers for verses that have highlighted words
    highlightedVerseIds.forEach(verseId => {
        const verseNumbers = document.querySelectorAll(`.verse-number-inline[data-verse-id="${verseId}"]`);
        verseNumbers.forEach(num => {
            num.classList.add('verse-number-highlighted');
        });
    });
    
    // Add rounded corners to first and last elements in highlight sequences
    applyHighlightCorners();
}

// Apply rounded corners to highlight sequences
function applyHighlightCorners() {
    // Remove any existing corner classes
    document.querySelectorAll('.word-highlighted, .verse-number-highlighted').forEach(el => {
        el.classList.remove('highlight-start', 'highlight-end');
    });
    
    // Get all highlightable elements in order (verse numbers and words)
    const allElements = [];
    
    // Get all verse-inline elements and process their children in order
    document.querySelectorAll('.verse-inline').forEach(verseInline => {
        const verseId = parseInt(verseInline.getAttribute('data-verse-id'));
        const verseNumber = verseInline.querySelector(`.verse-number-inline[data-verse-id="${verseId}"]`);
        const verseText = verseInline.querySelector('.verse-text');
        
        if (verseNumber) {
            allElements.push({
                element: verseNumber,
                type: 'verse-number',
                verseId: verseId
            });
        }
        
        if (verseText) {
            const words = Array.from(verseText.querySelectorAll('.word'));
            words.forEach(word => {
                allElements.push({
                    element: word,
                    type: 'word',
                    verseId: parseInt(word.getAttribute('data-verse-id'))
                });
            });
        }
    });
    
    // Find highlight sequences and mark first/last elements
    for (let i = 0; i < allElements.length; i++) {
        const item = allElements[i];
        const isHighlighted = item.element.classList.contains('word-highlighted') || 
                            item.element.classList.contains('verse-number-highlighted');
        
        if (isHighlighted) {
            // Check if this is the start of a sequence
            const prevItem = i > 0 ? allElements[i - 1] : null;
            const prevIsHighlighted = prevItem && 
                (prevItem.element.classList.contains('word-highlighted') || 
                 prevItem.element.classList.contains('verse-number-highlighted'));
            const isStart = !prevItem || !prevIsHighlighted;
            
            // Check if this is the end of a sequence
            const nextItem = i < allElements.length - 1 ? allElements[i + 1] : null;
            const nextIsHighlighted = nextItem && 
                (nextItem.element.classList.contains('word-highlighted') || 
                 nextItem.element.classList.contains('verse-number-highlighted'));
            const isEnd = !nextItem || !nextIsHighlighted;
            
            if (isStart) {
                item.element.classList.add('highlight-start');
            }
            if (isEnd) {
                item.element.classList.add('highlight-end');
            }
        }
    }
}

// Highlight entire verses for a topic (from scripture_topics)
function highlightVersesForTopic(verseIds) {
    verseIds.forEach(verseId => {
        // Highlight all words in these verses
        const verseWords = document.querySelectorAll(`.word[data-verse-id="${verseId}"]`);
        verseWords.forEach(word => {
            word.classList.add('word-highlighted');
        });
        
        // Highlight verse numbers for these verses
        const verseNumbers = document.querySelectorAll(`.verse-number-inline[data-verse-id="${verseId}"]`);
        verseNumbers.forEach(num => {
            num.classList.add('verse-number-highlighted');
        });
    });
    
    // Apply rounded corners to highlight sequences
    applyHighlightCorners();
}

// Clear topic highlight
function clearTopicHighlight() {
    document.querySelectorAll('.word-highlighted, .verse-number-highlighted').forEach(el => {
        el.classList.remove('word-highlighted', 'verse-number-highlighted', 'highlight-start', 'highlight-end');
    });
}

// Update topic selection styling
function updateTopicSelection(topicId) {
    const topics = document.querySelectorAll('.topic-item');
    topics.forEach(topic => {
        const topicIdAttr = parseInt(topic.getAttribute('data-topic-id'));
        if (topicId !== null && topicIdAttr === topicId) {
            topic.classList.add('active');
        } else {
            topic.classList.remove('active');
        }
    });
}

// Clear selection
function clearSelection() {
    currentVerseId = null;
    document.getElementById('topics-content').innerHTML = 
        '<p class="placeholder">Select a scripture verse to see related topics</p>';
    updateActiveVerse(null);
}

// Update active book styling
function updateActiveBook(bookName) {
    const books = document.querySelectorAll('.book-item');
    books.forEach(book => {
        if (book.textContent === bookName) {
            book.classList.add('active');
        } else {
            book.classList.remove('active');
        }
    });
}

// Update active verse styling
function updateActiveVerse(verseId) {
    // Update verse items (old format)
    const verseItems = document.querySelectorAll('.verse-item');
    verseItems.forEach(verse => {
        const verseIdAttr = verse.getAttribute('data-verse-id');
        if (verseIdAttr && parseInt(verseIdAttr) === verseId) {
            verse.classList.add('active');
        } else {
            verse.classList.remove('active');
        }
    });
    
    // Update verse inline (new paragraph format)
    const verseInlines = document.querySelectorAll('.verse-inline');
    verseInlines.forEach(verse => {
        const verseIdAttr = verse.getAttribute('data-verse-id');
        if (verseIdAttr && parseInt(verseIdAttr) === verseId) {
            verse.classList.add('active');
        } else {
            verse.classList.remove('active');
        }
    });
    
    // Update poetry lines
    const poetryLines = document.querySelectorAll('.poetry-line');
    poetryLines.forEach(line => {
        const verseText = line.querySelector('[data-verse-id]');
        if (verseText) {
            const verseIdAttr = verseText.getAttribute('data-verse-id');
            if (verseIdAttr && parseInt(verseIdAttr) === verseId) {
                line.classList.add('active');
                line.style.backgroundColor = '#667eea';
                line.style.color = 'white';
            } else {
                line.classList.remove('active');
                line.style.backgroundColor = '';
                line.style.color = '';
            }
        }
    });
}

// Utility functions
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    alert(message);
}
