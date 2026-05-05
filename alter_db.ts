import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

try {
  db.exec('ALTER TABLE pannels ADD COLUMN logoUrl TEXT;');
  console.log('Added logoUrl');
} catch (e) {
  console.log('logoUrl already exists or error:', e.message);
}

try {
  db.exec('ALTER TABLE pannels ADD COLUMN coverUrl TEXT;');
  console.log('Added coverUrl');
} catch (e) {
  console.log('coverUrl already exists or error:', e.message);
}

console.log('Done');
