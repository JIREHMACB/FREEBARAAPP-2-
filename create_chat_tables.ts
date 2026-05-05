import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        type TEXT DEFAULT 'direct', -- 'direct' or 'group'
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS conversation_members (
        conversationId INTEGER,
        userId INTEGER,
        PRIMARY KEY (conversationId, userId),
        FOREIGN KEY (conversationId) REFERENCES conversations(id),
        FOREIGN KEY (userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,3000      conversationId INTEGER,
        senderId INTEGER,
        content TEXT,
        isPinned INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversationId) REFERENCES conversations(id),
        FOREIGN KEY (senderId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS message_reactions (
        messageId INTEGER,
        userId INTEGER,
        emoji TEXT,
        PRIMARY KEY (messageId, userId),
        FOREIGN KEY (messageId) REFERENCES messages(id),
        FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);
  console.log('Chat tables created');
} catch (e: any) {
  console.error('Error creating chat tables:', e.message);
}
