import Database from 'better-sqlite3';
const db = new Database('database.sqlite');
try {
  db.exec("ALTER TABLE services ADD COLUMN fileUrl TEXT;");
  console.log("Added fileUrl to services");
} catch (e: any) {
  console.log("Error or already exists:", e.message);
}
