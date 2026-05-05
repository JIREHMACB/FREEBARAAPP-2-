import Database from 'better-sqlite3';
const db = new Database('test.sqlite');
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS test (
      id INTEGER PRIMARY KEY,
      country TEXT
    );
  `);
  console.log('Success');
} catch (e) {
  console.error(e);
}
