console.log('🚀 SERVER FILE CHARGÉ');

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

dotenv.config();

// --- Setup ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// --- Validation email ---
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// --- Nodemailer Transporter (SMTP) ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true pour 465, false pour 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --- Envoi OTP par email ---
const sendOTPEmail = async (email: string, code: string): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Mode dev : affiche le code dans le terminal
    console.log(`📩 [OTP DEV - SMTP non configuré] Code pour ${email}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Freebara" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Votre code de connexion Freebara',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
          <div style="max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: #4F46E5; padding: 32px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 28px;">Freebara</h1>
            </div>
            <div style="padding: 32px; text-align: center;">
              <h2 style="color: #1a1a1a; margin-bottom: 8px;">Votre code de vérification</h2>
              <p style="color: #555; margin-bottom: 24px;">Utilisez ce code pour vous connecter. Il expire dans <strong>10 minutes</strong>.</p>
              <div style="background: #f0f0ff; border-radius: 8px; padding: 24px; display: inline-block; margin-bottom: 24px;">
                <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #4F46E5;">${code}</span>
              </div>
              <p style="color: #999; font-size: 13px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
            </div>
            <div style="background: #f9f9f9; padding: 16px; text-align: center;">
              <p style="color: #bbb; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Freebara. Tous droits réservés.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
  console.log(`📩 Email OTP envoyé à ${email}`);
};

// --- Database ---
// Crée le répertoire data/ s'il n'existe pas (nécessaire sur Render et autres environnements cloud)
const DB_DIR = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : 'data';
const DB_FILE = process.env.DB_PATH || 'data/database.db';
mkdirSync(DB_DIR, { recursive: true });
const db = new Database(DB_FILE);

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    age INTEGER,
    profession TEXT,
    company TEXT,
    maritalStatus TEXT,
    whatsapp TEXT,
    avatarUrl TEXT,
    coverUrl TEXT,
    country TEXT,
    church TEXT,
    groups TEXT,
    interests TEXT,
    skills TEXT,
    marketing TEXT,
    goals TEXT,
    badge TEXT DEFAULT 'Invité',
    referralCode TEXT UNIQUE,
    referredBy INTEGER,
    balance REAL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add default user if none
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (email, name) VALUES ('admin@freebara.com', 'Admin')").run();
}

try {
  db.prepare('SELECT roomId FROM messages LIMIT 1').get();
} catch (e) {
  try {
    db.prepare('ALTER TABLE messages ADD COLUMN roomId INTEGER').run();
  } catch (err) {}
}

try {
  db.prepare('SELECT receiverId FROM messages LIMIT 1').get();
} catch (e) {
  // receiverId should exist, but we might want to make it nullable for group chats
}

db.exec(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(messageId, userId),
    FOREIGN KEY (messageId) REFERENCES messages(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS otps (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expiresAt DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId INTEGER NOT NULL,
    goal TEXT NOT NULL,
    content TEXT NOT NULL,
    targeting TEXT NOT NULL,
    budget REAL NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS communities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS community_members (
    communityId INTEGER,
    userId INTEGER,
    role TEXT DEFAULT 'member',
    PRIMARY KEY (communityId, userId)
  );

  CREATE TABLE IF NOT EXISTS follows (
    followerId INTEGER,
    followingId INTEGER,
    PRIMARY KEY (followerId, followingId)
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ownerId INTEGER NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    description TEXT,
    address TEXT,
    whatsapp TEXT,
    facebook TEXT,
    twitter TEXT,
    linkedin TEXT,
    logoUrl TEXT,
    coverUrl TEXT,
    isShop INTEGER DEFAULT 0,
    specialty TEXT,
    categories TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ownerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS company_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    category TEXT,
    imageUrls TEXT,
    imageUrl TEXT,
    tag TEXT,
    tagValue TEXT,
    shares_count INTEGER DEFAULT 0,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
`);

try {
  db.prepare('SELECT shares_count FROM company_catalog LIMIT 1').get();
} catch (e) {
  db.prepare('ALTER TABLE company_catalog ADD COLUMN shares_count INTEGER DEFAULT 0').run();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    productId INTEGER PRIMARY KEY,
    quantity INTEGER DEFAULT 0,
    minQuantity INTEGER DEFAULT 5,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES company_catalog(id)
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (productId) REFERENCES company_catalog(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    sponsorId INTEGER,
    creatorId INTEGER NOT NULL,
    coverUrl TEXT,
    latitude REAL,
    longitude REAL,
    city TEXT,
    country TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorId INTEGER NOT NULL,
    cellId INTEGER,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'Tous',
    mediaUrls TEXT,
    views INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cellId) REFERENCES cells(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    imageUrl TEXT,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    category TEXT NOT NULL,
    communityId INTEGER,
    creatorId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pannels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    theme TEXT,
    ownerId INTEGER NOT NULL,
    avatarUrl TEXT,
    logoUrl TEXT,
    coverUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pannel_members (
    pannelId INTEGER,
    userId INTEGER,
    role TEXT DEFAULT 'member',
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pannelId, userId)
  );

  CREATE TABLE IF NOT EXISTS pannel_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pannelId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    fileUrl TEXT NOT NULL,
    fileType TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pannel_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pannelId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    courseTitle TEXT,
    grade INTEGER,
    feedback TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pannel_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pannelId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    badgeType TEXT NOT NULL,
    unlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pannel_progress (
    pannelId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    status TEXT DEFAULT 'non_commence',
    position REAL DEFAULT 0,
    notes TEXT,
    stickyNotes TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pannelId, userId, courseId)
  );

  CREATE TABLE IF NOT EXISTS pannel_forum (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pannelId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pannelId) REFERENCES pannels(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_participants (
    eventId INTEGER,
    userId INTEGER,
    PRIMARY KEY (eventId, userId)
  );

  CREATE TABLE IF NOT EXISTS event_likes (
    eventId INTEGER,
    userId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (eventId, userId)
  );

  CREATE TABLE IF NOT EXISTS funding_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    companyId INTEGER NOT NULL,
    institutionId INTEGER,
    fundingType TEXT NOT NULL,
    amount REAL,
    reason TEXT,
    strategicData TEXT, -- JSON holding IA Score, sales, etc.
    status TEXT DEFAULT 'En attente',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (institutionId) REFERENCES credit_institutions(id)
  );

  CREATE TABLE IF NOT EXISTS credit_institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creatorId INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Banque', 'IMF', 'Programme', 'RiCi'
    description TEXT,
    terms TEXT, -- Conditions générales
    eligibility TEXT, -- Conditions d'éligibilité
    targets TEXT, -- Cibles (profils)
    processingTime TEXT, -- Délais
    logoUrl TEXT,
    coverUrl TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    isHabilitated INTEGER DEFAULT 0, -- Status de validation réglementaire
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creatorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    userId INTEGER,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    providerId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    availability TEXT,
    budget TEXT,
    type TEXT DEFAULT 'projet',
    companyName TEXT,
    location TEXT,
    contractType TEXT,
    fileUrl TEXT,
    category TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_applications (
    serviceId INTEGER,
    userId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (serviceId, userId)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER NOT NULL,
    receiverId INTEGER,
    roomId INTEGER,
    content TEXT NOT NULL,
    fileUrl TEXT,
    fileType TEXT,
    fileName TEXT,
    read INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (roomId) REFERENCES chat_rooms(id)
  );

  CREATE TABLE IF NOT EXISTS chat_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT DEFAULT 'direct', -- 'direct' or 'group'
    avatarUrl TEXT,
    creatorId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_room_members (
    roomId INTEGER,
    userId INTEGER,
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (roomId, userId),
    FOREIGN KEY (roomId) REFERENCES chat_rooms(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS churches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pastor TEXT,
    hq TEXT,
    description TEXT,
    programs TEXT,
    coverUrl TEXT,
    latitude REAL,
    longitude REAL,
    city TEXT,
    country TEXT,
    creatorId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cell_members (
    cellId INTEGER,
    userId INTEGER,
    role TEXT DEFAULT 'member',
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cellId, userId)
  );

  CREATE TABLE IF NOT EXISTS post_likes (
    postId INTEGER,
    userId INTEGER,
    type TEXT DEFAULT 'like',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (postId, userId)
  );

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postId INTEGER,
    userId INTEGER,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    relatedId INTEGER,
    read BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS connection_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER NOT NULL,
    receiverId INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    mediaUrl TEXT NOT NULL,
    mediaType TEXT DEFAULT 'image',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS story_views (
    storyId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    viewedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (storyId, userId),
    FOREIGN KEY(storyId) REFERENCES stories(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS story_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(storyId) REFERENCES stories(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS post_boosts (
    postId INTEGER PRIMARY KEY,
    userId INTEGER NOT NULL,
    amount REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postId) REFERENCES posts(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS favorite_companies (
    userId INTEGER,
    companyId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, companyId),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS favorite_products (
    userId INTEGER,
    productId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, productId),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (productId) REFERENCES company_catalog(id)
  );

  CREATE TABLE IF NOT EXISTS favorite_events (
    userId INTEGER,
    eventId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, eventId),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    dateObtained TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId INTEGER NOT NULL,
    customerId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    totalPrice REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    customerName TEXT,
    customerWhatsapp TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (customerId) REFERENCES users(id),
    FOREIGN KEY (productId) REFERENCES company_catalog(id)
  );

  CREATE TABLE IF NOT EXISTS pannel_course_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courseId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (courseId) REFERENCES pannel_courses(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    targetType TEXT NOT NULL, -- 'company' or 'product'
    targetId INTEGER NOT NULL,
    rating INTEGER NOT NULL, -- 1 to 5
    comment TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    dueDate TEXT,
    reminderTime TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'Général',
    assignedUserId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (assignedUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS task_subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (taskId) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS task_dependencies (
    taskId INTEGER NOT NULL,
    dependsOnTaskId INTEGER NOT NULL,
    PRIMARY KEY (taskId, dependsOnTaskId),
    FOREIGN KEY (taskId) REFERENCES tasks(id),
    FOREIGN KEY (dependsOnTaskId) REFERENCES tasks(id)
  );
`);

// Helper to add columns safely
const addColumn = (table: string, column: string, type: string) => {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    const columnNames = columns.map(c => c.name);
    if (columnNames.length > 0 && !columnNames.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  } catch (e) {
    // Table might not exist or other error
  }
};

// Ensure new columns exist
addColumn('users', 'church', 'TEXT');
addColumn('users', 'groups', 'TEXT');
addColumn('users', 'interests', 'TEXT');
addColumn('users', 'skills', 'TEXT');
addColumn('users', 'marketing', 'TEXT');
addColumn('users', 'goals', 'TEXT');
addColumn('users', 'coverUrl', 'TEXT');
addColumn('users', 'notificationPreferences', 'TEXT');
addColumn('users', 'visibility', "TEXT DEFAULT 'public'");
addColumn('users', 'country', 'TEXT');

addColumn('cells', 'coverUrl', 'TEXT');
addColumn('cells', 'description', 'TEXT');
addColumn('cells', 'sponsorId', 'INTEGER');
addColumn('cells', 'latitude', 'REAL');
addColumn('cells', 'longitude', 'REAL');
addColumn('cells', 'city', 'TEXT');
addColumn('cells', 'country', 'TEXT');

addColumn('tasks', 'isArchived', 'INTEGER DEFAULT 0');
addColumn('tasks', 'priority', "TEXT DEFAULT 'medium'");
addColumn('tasks', 'category', "TEXT DEFAULT 'Général'");
addColumn('tasks', 'assignedUserId', 'INTEGER');

addColumn('churches', 'latitude', 'REAL');
addColumn('churches', 'longitude', 'REAL');
addColumn('churches', 'city', 'TEXT');
addColumn('churches', 'country', 'TEXT');

addColumn('companies', 'country', 'TEXT');
addColumn('companies', 'city', 'TEXT');
addColumn('companies', 'latitude', 'REAL');
addColumn('companies', 'longitude', 'REAL');

addColumn('posts', 'views', 'INTEGER DEFAULT 0');
addColumn('posts', 'category', "TEXT DEFAULT 'Tous'");
addColumn('posts', 'mediaUrls', 'TEXT');
addColumn('posts', 'cellId', 'INTEGER');
addColumn('stocks', 'costPrice', 'REAL DEFAULT 0');

addColumn('pannel_courses', 'views', 'INTEGER DEFAULT 0');

addColumn('pannel_progress', 'status', "TEXT DEFAULT 'non_commence'");
addColumn('pannel_progress', 'position', 'REAL DEFAULT 0');
addColumn('pannel_progress', 'notes', 'TEXT');
addColumn('pannel_progress', 'stickyNotes', 'TEXT');

addColumn('messages', 'fileUrl', 'TEXT');
addColumn('messages', 'fileType', 'TEXT');
addColumn('messages', 'fileName', 'TEXT');
addColumn('messages', 'read', 'INTEGER DEFAULT 0');
addColumn('messages', 'isPinned', 'BOOLEAN DEFAULT 0');
addColumn('messages', 'replyToId', 'INTEGER');

addColumn('post_likes', 'type', "TEXT DEFAULT 'like'");
addColumn('notifications', 'read', 'BOOLEAN DEFAULT 0');
addColumn('service_applications', 'message', 'TEXT');
addColumn('service_applications', 'contactDetails', 'TEXT');
addColumn('events', 'latitude', 'REAL');
addColumn('events', 'longitude', 'REAL');
addColumn('events', 'price', 'REAL DEFAULT 0');
addColumn('events', 'visualUrl', 'TEXT');
addColumn('events', 'shares_count', 'INTEGER DEFAULT 0');
addColumn('services', 'type', "TEXT DEFAULT 'projet'");
addColumn('services', 'companyName', 'TEXT');
addColumn('services', 'location', 'TEXT');
addColumn('services', 'contractType', 'TEXT');
addColumn('services', 'fileUrl', 'TEXT');
addColumn('company_catalog', 'tag', 'TEXT');
addColumn('company_catalog', 'tagValue', 'TEXT');
addColumn('companies', 'managerId', 'INTEGER');
addColumn('funding_requests', 'institutionId', 'INTEGER');
addColumn('funding_requests', 'strategicData', 'TEXT');
addColumn('credit_institutions', 'city', 'TEXT');
addColumn('credit_institutions', 'country', 'TEXT');

async function startServer() {
  try {
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      path: "/socket.io",
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    // Seed Community Data
    try {
      const instCount = db.prepare('SELECT COUNT(*) as count FROM credit_institutions').get() as { count: number };
      if (instCount.count === 0) {
        db.prepare(`
          INSERT INTO credit_institutions (creatorId, name, type, description, terms, eligibility, targets, processingTime, city, country, isHabilitated)
          VALUES (1, 'Banque de l''Entrepreneuriat Freebara', 'Banque', 'Institution financière dédiée au soutien des PME et startups de l''écosystème.', 'Taux préférentiel de 5%, différé de 6 mois.', 'Être membre Freebara actif, avoir un Shop avec transactions.', 'VSE, SME, Startups', '48h - 72h', 'Abidjan', 'Côte d''Ivoire', 1)
        `).run();
      }

      const cellCount = db.prepare('SELECT COUNT(*) as count FROM cells').get() as { count: number };
      if (cellCount.count === 0) {
        // En s'assurant qu'un utilisateur existe pour le creatorId
        const firstUser = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
        const creatorId = firstUser ? firstUser.id : 1;
        
        db.prepare(`
          INSERT INTO cells (name, description, creatorId, latitude, longitude, city, country, coverUrl)
          VALUES 
            ('Cellule d''Impact Paris', 'Une communauté dynamique au cœur de Paris.', ?, 48.8566, 2.3522, 'Paris', 'France', 'https://picsum.photos/seed/paris/800/400'),
            ('Cellule Lyon Leadership', 'Développement du leadership à Lyon.', ?, 45.7640, 4.8357, 'Lyon', 'France', 'https://picsum.photos/seed/lyon/800/400'),
            ('Cellule Abidjan Business', 'Réseautage d''affaires à Abidjan.', ?, 5.3097, -4.0127, 'Abidjan', 'Côte d''Ivoire', 'https://picsum.photos/seed/abidjan/800/400')
        `).run(creatorId, creatorId, creatorId);
      } else {
        // Mettre à jour les cellules existantes sans coordonnées pour la démo
        db.prepare("UPDATE cells SET latitude = 48.8566, longitude = 2.3522, city = 'Paris', country = 'France' WHERE latitude IS NULL").run();
      }

      const churchCount = db.prepare('SELECT COUNT(*) as count FROM churches').get() as { count: number };
      if (churchCount.count === 0) {
        const firstUser = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
        const creatorId = firstUser ? firstUser.id : 1;
        
        db.prepare(`
          INSERT INTO churches (name, pastor, hq, description, creatorId, latitude, longitude, city, country, coverUrl)
          VALUES 
            ('Église de la Victoire', 'Pasteur Jean', 'Paris Centre', 'Une église accueillante pour tous.', ?, 48.8647, 2.3292, 'Paris', 'France', 'https://picsum.photos/seed/church1/800/400'),
            ('Centre Apostolique Lyon', 'Pasteur Pierre', 'Lyon Sud', 'Focus sur le leadership chrétien.', ?, 45.7500, 4.8500, 'Lyon', 'France', 'https://picsum.photos/seed/church2/800/400')
        `).run(creatorId, creatorId);
      } else {
        db.prepare("UPDATE churches SET latitude = 48.8647, longitude = 2.3292, city = 'Paris', country = 'France' WHERE latitude IS NULL").run();
      }
      
      // Update companies with country/city if missing for filtering demo
      db.prepare("UPDATE companies SET country = 'France', city = 'Paris' WHERE country IS NULL OR country = ''").run();
    } catch (err: any) {
      console.error('Error seeding communities:', err.message);
    }
    
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Request Logger
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    // Authentication Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.userId);
      if (!userExists) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }
      req.userId = decoded.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token invalide' });
    }
  };

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Tasks Routes
    app.get('/api/tasks', authenticate, (req: any, res) => {
      const tasks = db.prepare('SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC').all(req.userId);
      res.json(tasks);
    });

    app.post('/api/tasks', authenticate, (req: any, res) => {
      const { title, description, dueDate, reminderTime, status, priority, category, assignedUserId } = req.body;
      const stmt = db.prepare('INSERT INTO tasks (userId, title, description, dueDate, reminderTime, status, priority, category, assignedUserId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(req.userId, title, description, dueDate, reminderTime, status || 'todo', priority || 'medium', category || 'Général', assignedUserId || null);
      res.json({ id: info.lastInsertRowid, userId: req.userId, title, description, dueDate, reminderTime, status: status || 'todo', priority: priority || 'medium', category: category || 'Général', assignedUserId: assignedUserId || null });
    });

    app.put('/api/tasks/:id', authenticate, (req: any, res: any) => {
  const { status, title, description, dueDate, reminderTime, priority, category, assignedUserId } = req.body;

  // Dependency Check Logic
  if (status === 'in_progress' || status === 'done') {
    const dependencies = db
      .prepare('SELECT dependsOnTaskId FROM task_dependencies WHERE taskId = ?')
      .all(req.params.id) as { dependsOnTaskId: number }[];

    for (const dep of dependencies) {
      const depTask = db
        .prepare('SELECT status FROM tasks WHERE id = ?')
        .get(dep.dependsOnTaskId) as any;

      if (!depTask || depTask.status !== 'done') {
        return res.status(400).json({
          error: 'Une ou plusieurs tâches dépendantes ne sont pas terminées.'
        });
      }
    }
  }

  const stmt = db.prepare(`
    UPDATE tasks 
    SET status = ?, title = ?, description = ?, dueDate = ?, reminderTime = ?, priority = ?, category = ?, assignedUserId = ? 
    WHERE id = ? AND userId = ?
  `);

  stmt.run(
    status,
    title,
    description,
    dueDate,
    reminderTime,
    priority,
    category,
    assignedUserId || null,
    req.params.id,
    req.userId
  );

  res.json({ success: true });
});
    app.post('/api/tasks/:taskId/subtasks', authenticate, (req: any, res) => {
      const { title } = req.body;
      const stmt = db.prepare('INSERT INTO task_subtasks (taskId, title) VALUES (?, ?)');
      const info = stmt.run(req.params.taskId, title);
      res.json({ id: info.lastInsertRowid, taskId: req.params.taskId, title, status: 'todo' });
    });
    app.get('/api/tasks/:taskId/subtasks', authenticate, (req: any, res) => {
        const subtasks = db.prepare('SELECT * FROM task_subtasks WHERE taskId = ?').all(req.params.taskId);
        res.json(subtasks);
    });
    
    app.put('/api/subtasks/:id', authenticate, (req: any, res) => {
      const { status } = req.body;
      const stmt = db.prepare('UPDATE task_subtasks SET status = ? WHERE id = ?');
      stmt.run(status, req.params.id);
      res.json({ success: true });
    });

    // Dependencies Routes
    app.post('/api/tasks/:taskId/dependencies', authenticate, (req: any, res) => {
        const { dependsOnTaskId } = req.body;
        const stmt = db.prepare('INSERT INTO task_dependencies (taskId, dependsOnTaskId) VALUES (?, ?)');
        stmt.run(req.params.taskId, dependsOnTaskId);
        res.json({ success: true });
    });
    app.get('/api/tasks/:taskId/dependencies', authenticate, (req: any, res) => {
        const deps = db.prepare('SELECT * FROM task_dependencies WHERE taskId = ?').all(req.params.taskId);
        res.json(deps);
    });

    app.delete('/api/tasks/:id', authenticate, (req: any, res) => {
      db.prepare('DELETE FROM tasks WHERE id = ? AND userId = ?').run(req.params.id, req.userId);
      res.json({ success: true });
    });

    // Socket.io Authentication Middleware
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token || typeof token !== 'string') {
          console.error('Socket Auth: Missing or invalid token');
          return next(new Error('Authentication error'));
        }
        
        jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
          if (err) {
            console.error('Socket Auth: JWT verification failed', err.message, 'Secret:', JWT_SECRET);
            return next(new Error('Authentication error'));
          }
          if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
            console.error('Socket Auth: Invalid token payload');
            return next(new Error('Authentication error'));
          }
          (socket as any).userId = decoded.userId;
          next();
        });
      } catch (err) {
        console.error('Socket Auth: Unexpected error', err);
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket: any) => {
      console.log(`User connected: ${socket.userId}`);
      socket.join(`user_${socket.userId}`);

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
      });

      socket.on('pin_message', (data: { messageId: number, roomId?: number, receiverId?: number }) => {
        io.emit('message_pinned', data);
      });

      socket.on('unpin_message', (data: { messageId: number, roomId?: number, receiverId?: number }) => {
        io.emit('message_unpinned', data);
      });

      socket.on('message_reaction', (data: { messageId: number, userId: number, emoji: string, type: 'add' | 'remove', roomId?: number, receiverId?: number }) => {
        io.emit('message_reaction_updated', data);
      });

      socket.on('message_edit', (data: { messageId: number, content: string, roomId?: number, receiverId?: number }) => {
        io.emit('message_updated', data);
      });

      socket.on('message_delete', (data: { messageId: number, roomId?: number, receiverId?: number }) => {
        io.emit('message_deleted', data);
      });
    });

    // --- API Routes ---

  // AI Endpoints
  // All AI logic has been moved to the frontend.

  app.put('/api/users/me/budget-proposals/:id', authenticate, (req: any, res) => {
    const { category, amount, note } = req.body;
    const proposalId = req.params.id;
    
    // Vérifier si la proposition appartient bien à l'utilisateur
    const proposal = db.prepare('SELECT userId FROM budget_proposals WHERE id = ?').get(proposalId) as any;
    if (!proposal || proposal.userId !== req.userId) {
      return res.status(404).json({ error: 'Proposition de budget non trouvée' });
    }

    db.prepare('UPDATE budget_proposals SET category = ?, amount = ?, note = ? WHERE id = ?')
      .run(category, amount, note, proposalId);
      
    res.json({ success: true });
  });

  // Pannels API
  app.get('/api/pannels', authenticate, (req: any, res) => {
    const pannels = db.prepare(`
      SELECT p.*, u.name as ownerName,
      (SELECT COUNT(*) FROM pannel_members WHERE pannelId = p.id) as membersCount,
      (SELECT role FROM pannel_members WHERE pannelId = p.id AND userId = ?) as userRole
      FROM pannels p
      JOIN users u ON p.ownerId = u.id
    `).all(req.userId);
    res.json(pannels);
  });

  app.get('/api/pannels/my', authenticate, (req: any, res) => {
    const pannels = db.prepare(`
      SELECT p.*, u.name as ownerName,
      (SELECT COUNT(*) FROM pannel_members WHERE pannelId = p.id) as membersCount,
      pm.role as userRole
      FROM pannels p
      JOIN pannel_members pm ON p.id = pm.pannelId
      JOIN users u ON p.ownerId = u.id
      WHERE pm.userId = ?
    `).all(req.userId);
    res.json(pannels);
  });

  // Get all courses from all pannels
  app.get('/api/courses/all', authenticate, (req: any, res) => {
    const courses = db.prepare(`
      SELECT c.*, p.name as pannelName, p.theme as pannelTheme,
      (SELECT status FROM pannel_progress WHERE courseId = c.id AND userId = ?) as progressStatus
      FROM pannel_courses c
      JOIN pannels p ON c.pannelId = p.id
      ORDER BY c.createdAt DESC
    `).all(req.userId);
    res.json(courses);
  });

  app.post('/api/pannels', authenticate, (req: any, res) => {
    const { name, description, theme, logoUrl, coverUrl } = req.body;
    const result = db.prepare('INSERT INTO pannels (name, description, theme, ownerId, logoUrl, coverUrl) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, description, theme, req.userId, logoUrl, coverUrl);
    
    const pannelId = result.lastInsertRowid;
    db.prepare('INSERT INTO pannel_members (pannelId, userId, role) VALUES (?, ?, ?)').run(pannelId, req.userId, 'admin');
    
    res.json({ id: pannelId });
  });

  app.put('/api/pannels/:id', authenticate, (req: any, res) => {
    const { name, description, theme, logoUrl, coverUrl } = req.body;
    const pannelId = req.params.id;
    
    // Check if user is admin or owner
    const member = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(pannelId, req.userId) as any;
    const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(pannelId) as any;
    
    if (pannel.ownerId !== req.userId && (!member || member.role !== 'admin')) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    db.prepare('UPDATE pannels SET name = ?, description = ?, theme = ?, logoUrl = ?, coverUrl = ? WHERE id = ?')
      .run(name, description, theme, logoUrl, coverUrl, pannelId);
      
    res.json({ success: true });
  });

  app.get('/api/pannels/:id', authenticate, (req: any, res) => {
    const pannel = db.prepare(`
      SELECT p.*, u.name as ownerName,
      (SELECT role FROM pannel_members WHERE pannelId = p.id AND userId = ?) as userRole
      FROM pannels p
      JOIN users u ON p.ownerId = u.id
      WHERE p.id = ?
    `).get(req.userId, req.params.id);
    
    if (!pannel) return res.status(404).json({ error: 'Pannel non trouvé' });
    res.json(pannel);
  });

  app.post('/api/pannels/:id/join', authenticate, (req: any, res) => {
    const pannelId = req.params.id;
    try {
      db.prepare('INSERT INTO pannel_members (pannelId, userId) VALUES (?, ?)').run(pannelId, req.userId);
      
      // Create notification for pannel owner
      const pannel = db.prepare('SELECT ownerId, name FROM pannels WHERE id = ?').get(pannelId) as any;
      if (pannel && pannel.ownerId !== req.userId) {
        const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
        const notificationContent = `${user.name} a rejoint votre pannel: ${pannel.name}`;
        const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
          pannel.ownerId, 'pannel_join', notificationContent, pannelId
        );

        // Emit real-time notification
        io.to(`user_${pannel.ownerId}`).emit('notification', {
          id: notifResult.lastInsertRowid,
          userId: pannel.ownerId,
          type: 'pannel_join',
          content: notificationContent,
          relatedId: Number(pannelId),
          read: 0,
          createdAt: new Date().toISOString()
        });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Déjà membre ou erreur' });
    }
  });

  app.post('/api/pannels/:id/add-member', authenticate, (req: any, res) => {
    const pannelId = req.params.id;
    const pannel = db.prepare('SELECT ownerId, name FROM pannels WHERE id = ?').get(pannelId) as any;
    const admin = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(pannelId, req.userId) as any;
    
    if (pannel.ownerId !== req.userId && admin?.role !== 'admin') {
      return res.status(403).json({ error: 'Seuls les admins peuvent ajouter des membres' });
    }
    
    const { userId } = req.body;
    try {
      db.prepare('INSERT INTO pannel_members (pannelId, userId) VALUES (?, ?)').run(pannelId, userId);
      
      // Create notification for added user
      const notificationContent = `Vous avez été ajouté au pannel: ${pannel.name}`;
      const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
        userId, 'pannel_add_member', notificationContent, pannelId
      );

      // Emit real-time notification
      io.to(`user_${userId}`).emit('notification', {
        id: notifResult.lastInsertRowid,
        userId: Number(userId),
        type: 'pannel_add_member',
        content: notificationContent,
        relatedId: Number(pannelId),
        read: 0,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Déjà membre ou erreur' });
    }
  });

  app.get('/api/pannels/:id/courses', authenticate, (req: any, res) => {
    const courses = db.prepare(`
      SELECT pc.*, 
      (SELECT status FROM pannel_progress WHERE courseId = pc.id AND userId = ?) as progressStatus
      FROM pannel_courses pc 
      WHERE pc.pannelId = ? 
      ORDER BY pc.createdAt DESC
    `).all(req.userId, req.params.id);
    res.json(courses);
  });

  app.post('/api/pannels/:id/courses', authenticate, (req: any, res) => {
    try {
      const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(req.params.id) as any;
      if (!pannel) return res.status(404).json({ error: 'Pannel introuvable' });

      const member = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(req.params.id, req.userId) as any;
      
      if (pannel.ownerId !== req.userId && member?.role !== 'admin') {
        return res.status(403).json({ error: 'Seuls les admins peuvent publier des cours' });
      }
      
      const { title, description, duration, fileUrl, fileType, url, type } = req.body;
      const finalUrl = fileUrl || url;
      const finalType = fileType || type;

      if (!title || !finalUrl || !finalType) {
        return res.status(400).json({ error: 'Titre, fichier et type sont requis' });
      }

      db.prepare('INSERT INTO pannel_courses (pannelId, title, description, duration, fileUrl, fileType) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.params.id, title, description, duration, finalUrl, finalType);
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding course:', error);
      res.status(500).json({ error: 'Erreur lors de l\'ajout du cours' });
    }
  });

  app.delete('/api/pannels/:id/courses/:courseId', authenticate, (req: any, res) => {
    try {
      const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(req.params.id) as any;
      if (!pannel) {
        return res.status(404).json({ error: 'Pannel introuvable' });
      }

      const member = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(req.params.id, req.userId) as any;
      
      if (pannel.ownerId !== req.userId && member?.role !== 'admin') {
        return res.status(403).json({ error: 'Seuls les admins peuvent supprimer des cours' });
      }
      
      db.prepare('DELETE FROM pannel_courses WHERE id = ? AND pannelId = ?').run(req.params.courseId, req.params.id);
      db.prepare('DELETE FROM pannel_progress WHERE courseId = ?').run(req.params.courseId);
      db.prepare('DELETE FROM pannel_course_comments WHERE courseId = ?').run(req.params.courseId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du cours' });
    }
  });

  app.get('/api/pannels/:id/courses/:courseId/comments', authenticate, (req: any, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.name as userName, u.avatarUrl as userAvatar
      FROM pannel_course_comments c
      JOIN users u ON c.userId = u.id
      WHERE c.courseId = ?
      ORDER BY c.createdAt ASC
    `).all(req.params.courseId);
    res.json(comments);
  });

  app.post('/api/pannels/:id/courses/:courseId/comments', authenticate, (req: any, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Le contenu est requis' });
    
    db.prepare('INSERT INTO pannel_course_comments (courseId, userId, content) VALUES (?, ?, ?)')
      .run(req.params.courseId, req.userId, content);
    res.json({ success: true });
  });

  app.post('/api/pannels/:id/courses/:courseId/learn', authenticate, (req: any, res) => {
    const { status, position, notes, stickyNotes } = req.body;
    const finalStatus = status || 'en_cours';
    
    const existing = db.prepare('SELECT status FROM pannel_progress WHERE userId = ? AND courseId = ?').get(req.userId, req.params.courseId);
    if (!existing) {
      db.prepare('UPDATE pannel_courses SET views = views + 1 WHERE id = ?').run(req.params.courseId);
    }

    db.prepare(`
      INSERT OR REPLACE INTO pannel_progress (pannelId, userId, courseId, status, position, notes, stickyNotes, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(req.params.id, req.userId, req.params.courseId, finalStatus, position || 0, notes || null, stickyNotes || null);
    
    res.json({ success: true });
  });

  app.get('/api/pannels/:id/courses/:courseId/progress', authenticate, (req: any, res) => {
    const progress = db.prepare('SELECT * FROM pannel_progress WHERE userId = ? AND courseId = ?')
      .get(req.userId, req.params.courseId);
    res.json(progress || { status: 'non_commence', position: 0, notes: '', stickyNotes: '[]' });
  });

  app.get('/api/pannels/:id/evaluations', authenticate, (req: any, res) => {
    const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(req.params.id) as any;
    const member = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(req.params.id, req.userId) as any;
    
    let evaluations;
    if (pannel.ownerId === req.userId || member?.role === 'admin') {
      evaluations = db.prepare(`
        SELECT e.*, u.name as userName, u.avatarUrl as userAvatar
        FROM pannel_evaluations e
        JOIN users u ON e.userId = u.id
        WHERE e.pannelId = ?
        ORDER BY e.createdAt DESC
      `).all(req.params.id);
    } else {
      evaluations = db.prepare('SELECT * FROM pannel_evaluations WHERE pannelId = ? AND userId = ? ORDER BY createdAt DESC')
        .all(req.params.id, req.userId);
    }
    res.json(evaluations);
  });

  app.post('/api/pannels/:id/evaluations', authenticate, (req: any, res) => {
    const { courseTitle, grade, feedback } = req.body;
    db.prepare('INSERT INTO pannel_evaluations (pannelId, userId, courseTitle, grade, feedback) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.id, req.userId, courseTitle, grade, feedback);
    res.json({ success: true });
  });

  app.get('/api/pannels/:id/badges', authenticate, (req: any, res) => {
    const badges = db.prepare('SELECT * FROM pannel_badges WHERE pannelId = ? AND userId = ?').all(req.params.id, req.userId);
    res.json(badges);
  });

  app.post('/api/pannels/:id/badges', authenticate, (req: any, res) => {
    const { badgeType } = req.body;
    try {
      db.prepare('INSERT INTO pannel_badges (pannelId, userId, badgeType) VALUES (?, ?, ?)').run(req.params.id, req.userId, badgeType);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Badge déjà débloqué' });
    }
  });

  app.get('/api/pannels/:id/members', authenticate, (req: any, res) => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl, u.profession, pm.role,
      (SELECT GROUP_CONCAT(badgeType) FROM pannel_badges WHERE pannelId = ? AND userId = u.id) as badges
      FROM pannel_members pm
      JOIN users u ON pm.userId = u.id
      WHERE pm.pannelId = ?
    `).all(req.params.id, req.params.id);
    res.json(members);
  });

  app.delete('/api/pannels/:id/members/:userId', authenticate, (req: any, res) => {
    const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(req.params.id) as any;
    const admin = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(req.params.id, req.userId) as any;
    
    if (pannel.ownerId !== req.userId && admin?.role !== 'admin') {
      return res.status(403).json({ error: 'Seuls les admins peuvent supprimer des membres' });
    }
    
    db.prepare('DELETE FROM pannel_members WHERE pannelId = ? AND userId = ?').run(req.params.id, req.params.userId);
    res.json({ success: true });
  });

  app.put('/api/pannels/:id/members/:userId/role', authenticate, (req: any, res) => {
    const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(req.params.id) as any;
    const admin = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(req.params.id, req.userId) as any;
    
    if (pannel.ownerId !== req.userId && admin?.role !== 'admin') {
      return res.status(403).json({ error: 'Seuls les admins peuvent modifier les rôles' });
    }
    
    const { role } = req.body;
    db.prepare('UPDATE pannel_members SET role = ? WHERE pannelId = ? AND userId = ?').run(role, req.params.id, req.params.userId);
    res.json({ success: true });
  });

  app.get('/api/pannels/:id/stats', authenticate, (req: any, res) => {
    const pannel = db.prepare('SELECT ownerId FROM pannels WHERE id = ?').get(req.params.id) as any;
    const member = db.prepare('SELECT role FROM pannel_members WHERE pannelId = ? AND userId = ?').get(req.params.id, req.userId) as any;
    
    if (pannel.ownerId !== req.userId && member?.role !== 'admin') {
      return res.status(403).json({ error: 'Seuls les admins peuvent voir les stats' });
    }

    const totalMembers = db.prepare('SELECT COUNT(*) as count FROM pannel_members WHERE pannelId = ?').get(req.params.id) as any;
    const completedCourses = db.prepare('SELECT COUNT(*) as count FROM pannel_progress WHERE pannelId = ?').get(req.params.id) as any;
    const avgGrade = db.prepare('SELECT AVG(grade) as avg FROM pannel_evaluations WHERE pannelId = ?').get(req.params.id) as any;
    const topBadges = db.prepare(`
      SELECT badgeType, COUNT(*) as count 
      FROM pannel_badges 
      WHERE pannelId = ? 
      GROUP BY badgeType 
      ORDER BY count DESC 
      LIMIT 3
    `).all(req.params.id);

    res.json({
      totalMembers: totalMembers.count,
      completedCourses: completedCourses.count,
      averageGrade: avgGrade.avg || 0,
      topBadges
    });
  });

  app.get('/api/pannels/:id/forum', authenticate, (req: any, res) => {
    const messages = db.prepare(`
      SELECT f.*, u.name as userName, u.avatarUrl as userAvatar
      FROM pannel_forum f
      JOIN users u ON f.userId = u.id
      WHERE f.pannelId = ?
      ORDER BY f.createdAt ASC
    `).all(req.params.id);
    res.json(messages);
  });

  app.post('/api/pannels/:id/forum', authenticate, (req: any, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Le contenu est requis' });
    
    db.prepare('INSERT INTO pannel_forum (pannelId, userId, content) VALUES (?, ?, ?)')
      .run(req.params.id, req.userId, content);
    res.json({ success: true });
  });

  // 1. Request OTP
  app.post('/api/auth/request-otp', (req, res) => {
    const { email, isRegister } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (isRegister && user) {
      return res.status(400).json({ error: 'Un compte existe déjà avec cet email. Veuillez vous connecter.' });
    }
    if (!isRegister && !user) {
      return res.status(400).json({ error: 'Aucun compte trouvé avec cet email. Veuillez vous inscrire.' });
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins
    
    db.prepare('INSERT OR REPLACE INTO otps (email, code, expiresAt) VALUES (?, ?, ?)').run(email, code, expiresAt);
    
    // Envoyer le code par email (console.log en mode dev si SMTP_USER/SMTP_PASS non configurés)
    sendOTPEmail(email, code)
      .then(() => {
        const isDev = !process.env.SMTP_USER || !process.env.SMTP_PASS;
        res.json({
          message: 'Code envoyé avec succès',
          ...(isDev && { devCode: code }),
        });
      })
      .catch((err: any) => {
        console.error('Erreur envoi email OTP:', err);
        res.status(500).json({ error: "Impossible d'envoyer le code par email. Vérifiez SMTP_USER et SMTP_PASS dans .env" });
      });
  });

  // 2. Verify OTP & Login/Register
  app.post('/api/auth/verify-otp', (req, res) => {
    const { email, code, referralCode, isRegister, country } = req.body;
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    
    const otpRecord = db.prepare('SELECT * FROM otps WHERE email = ?').get(email) as any;
    if (!otpRecord || otpRecord.code !== code || new Date(otpRecord.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Code invalide ou expiré' });
    }
    
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    
    if (isRegister) {
      if (user) {
        return res.status(400).json({ error: 'Un compte existe déjà avec cet email. Veuillez vous connecter.' });
      }
      // Register new user
      let referredBy = null;
      if (referralCode) {
        const referrer = db.prepare('SELECT id FROM users WHERE referralCode = ?').get(referralCode) as any;
        if (referrer) referredBy = referrer.id;
      }
      
      const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const insert = db.prepare('INSERT INTO users (email, referralCode, referredBy, country) VALUES (?, ?, ?, ?)');
      const info = insert.run(email, newReferralCode, referredBy, country || null);
      const newUserId = info.lastInsertRowid;
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);

      // Cell Logic
      if (referredBy) {
        // 1. Find or create sponsor's cell
        let sponsorCell = db.prepare('SELECT * FROM cells WHERE creatorId = ?').get(referredBy) as any;
        if (!sponsorCell) {
          const sponsor = db.prepare('SELECT name, referredBy FROM users WHERE id = ?').get(referredBy) as any;
          const cellName = sponsor.name ? `Cellule de ${sponsor.name}` : 'Nouvelle cellule';
          const cellInsert = db.prepare('INSERT INTO cells (name, creatorId) VALUES (?, ?)');
          const cellInfo = cellInsert.run(cellName, referredBy);
          const cellId = cellInfo.lastInsertRowid;
          sponsorCell = { id: cellId, name: cellName, creatorId: referredBy };

          // Add sponsor to their own cell as admin
          db.prepare('INSERT INTO cell_members (cellId, userId, role) VALUES (?, ?, ?)').run(cellId, referredBy, 'admin');

          // Hierarchy: The sponsor of the creator joins the cell automatically
          if (sponsor.referredBy) {
            db.prepare('INSERT OR IGNORE INTO cell_members (cellId, userId, role) VALUES (?, ?, ?)').run(cellId, sponsor.referredBy, 'member');
          }
        }

        // 2. Add new user to sponsor's cell
        db.prepare('INSERT OR IGNORE INTO cell_members (cellId, userId, role) VALUES (?, ?, ?)').run(sponsorCell.id, newUserId, 'member');
      }
    } else {
      if (!user) {
        return res.status(400).json({ error: 'Aucun compte trouvé avec cet email. Veuillez vous inscrire.' });
      }
    }
    
    db.prepare('DELETE FROM otps WHERE email = ?').run(email);
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  });

  // User Search for Mentions
  app.get('/api/users/search', authenticate, (req: any, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    const users = db.prepare('SELECT id, name, avatarUrl FROM users WHERE name LIKE ? LIMIT 10')
      .all(`%${query}%`);
    res.json(users);
  });

  function handleMentions(content: string, senderId: number, relatedId: number, type: 'post' | 'comment' | 'message') {
    if (!content) return;
    // Regex to find @[Name](userId)
    const mentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;
    let match;
    const notifiedUserIds = new Set<number>();

    while ((match = mentionRegex.exec(content)) !== null) {
      const userId = parseInt(match[2]);
      if (userId && userId !== senderId && !notifiedUserIds.has(userId)) {
        try {
          const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(senderId) as any;
          if (!sender) continue;
          
          let typeLabel = '';
          let notifSubtype = 'mention';
          if (type === 'post') {
            typeLabel = 'post';
            notifSubtype = 'post_mention';
          } else if (type === 'comment') {
            typeLabel = 'commentaire';
            notifSubtype = 'comment_mention';
          } else if (type === 'message') {
            typeLabel = 'message';
            notifSubtype = 'message_mention';
          }

          const notificationContent = `${sender.name} vous a mentionné dans un ${typeLabel}.`;
          
          const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
            userId, notifSubtype, notificationContent, relatedId
          );

          if (io) {
            io.to(`user_${userId}`).emit('notification', {
              id: notifResult.lastInsertRowid,
              userId: userId,
              type: notifSubtype,
              content: notificationContent,
              relatedId: Number(relatedId),
              read: 0,
              createdAt: new Date().toISOString()
            });
          }
          notifiedUserIds.add(userId);
        } catch (err) {
          console.error('Error creating mention notification:', err);
        }
      }
    }
  }

  // 3. Get Current User
  app.get('/api/users/me', authenticate, (req: any, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (user.notificationPreferences) {
      try {
        user.notificationPreferences = JSON.parse(user.notificationPreferences);
      } catch (e) {
        user.notificationPreferences = {};
      }
    } else {
      user.notificationPreferences = {
        connections: true,
        comments: true,
        events: true,
        offers: true,
        messages: true
      };
    }

    // Calculate badges based on connections
    const connectionsCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followerId = ? OR followingId = ?').get(req.userId, req.userId) as { count: number };
    const badges = [];
    if (connectionsCount.count >= 100) badges.push('Super Connecteur');
    if (connectionsCount.count >= 50) badges.push('Réseauteur Actif');
    if (connectionsCount.count >= 10) badges.push('Sociable');
    
    user.badges = badges;
    
    res.json(user);
  });

  app.get('/api/users/me/transactions', authenticate, (req: any, res) => {
    const transactions = db.prepare('SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC, createdAt DESC').all(req.userId);
    res.json(transactions);
  });

  app.post('/api/users/me/transactions', authenticate, (req: any, res) => {
    const { date, description, category, amount, type } = req.body;
    const result = db.prepare('INSERT INTO transactions (userId, date, description, category, amount, type) VALUES (?, ?, ?, ?, ?, ?)').run(req.userId, date, description, category, amount, type);
    const newTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    
    // Emit real-time update
    io.to(`user_${req.userId}`).emit('transaction_update', newTransaction);
    
    res.json(newTransaction);
  });

  app.delete('/api/users/me', authenticate, (req: any, res) => {
    const userId = req.userId;
    try {
      const deleteTransaction = db.transaction(() => {
        // 1. Delete Social & Profile related
        db.prepare('DELETE FROM community_members WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM follows WHERE followerId = ? OR followingId = ?').run(userId, userId);
        db.prepare('DELETE FROM connection_requests WHERE senderId = ? OR receiverId = ?').run(userId, userId);
        db.prepare('DELETE FROM notifications WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM certifications WHERE userId = ?').run(userId);

        // 2. Delete Business & Shop related
        const userCompanies = db.prepare('SELECT id FROM companies WHERE ownerId = ?').all(userId) as { id: number }[];
        for (const company of userCompanies) {
          db.prepare('DELETE FROM company_catalog WHERE companyId = ?').run(company.id);
          db.prepare('DELETE FROM shop_orders WHERE companyId = ?').run(company.id);
        }
        db.prepare('DELETE FROM companies WHERE ownerId = ?').run(userId);
        db.prepare('DELETE FROM shop_orders WHERE customerId = ?').run(userId);
        db.prepare('DELETE FROM favorite_companies WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM transactions WHERE userId = ?').run(userId);

        // 3. Delete JCE & Communities related
        db.prepare('DELETE FROM cell_members WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM cells WHERE creatorId = ?').run(userId);
        db.prepare('DELETE FROM churches WHERE creatorId = ?').run(userId);

        // 4. Delete Posts & Interactions
        db.prepare('DELETE FROM post_likes WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM post_comments WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM posts WHERE authorId = ?').run(userId);
        db.prepare('DELETE FROM post_boosts WHERE userId = ?').run(userId);

        // 5. Delete Events
        db.prepare('DELETE FROM event_participants WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM event_likes WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM event_comments WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM events WHERE creatorId = ?').run(userId);

        // 6. Delete Pannels (Learning)
        db.prepare('DELETE FROM pannel_members WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM pannel_evaluations WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM pannel_badges WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM pannel_progress WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM pannel_forum WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM pannel_course_comments WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM pannels WHERE ownerId = ?').run(userId);

        // 7. Delete Services
        db.prepare('DELETE FROM service_applications WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM services WHERE providerId = ?').run(userId);

        // 8. Delete Messages & Stories
        db.prepare('DELETE FROM messages WHERE senderId = ? OR receiverId = ?').run(userId, userId);
        db.prepare('DELETE FROM story_views WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM story_reactions WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM stories WHERE userId = ?').run(userId);

        // 9. Finally delete the user
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      });

      deleteTransaction();
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
    }
  });

  app.get('/api/users/me/certifications', authenticate, (req: any, res) => {
    const certifications = db.prepare('SELECT * FROM certifications WHERE userId = ? ORDER BY dateObtained DESC').all(req.userId);
    res.json(certifications);
  });

  app.post('/api/users/me/certifications', authenticate, (req: any, res) => {
    const { name, organization, dateObtained } = req.body;
    const result = db.prepare('INSERT INTO certifications (userId, name, organization, dateObtained) VALUES (?, ?, ?, ?)').run(req.userId, name, organization, dateObtained);
    res.json({ id: result.lastInsertRowid, name, organization, dateObtained });
  });

  app.delete('/api/users/me/certifications/:id', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM certifications WHERE id = ? AND userId = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  });

  app.get('/api/users/me/favorite-companies', authenticate, (req: any, res) => {
    const companies = db.prepare(`
      SELECT c.* FROM companies c
      JOIN favorite_companies fc ON c.id = fc.companyId
      WHERE fc.userId = ?
    `).all(req.userId);
    res.json(companies);
  });

  app.post('/api/companies/:id/favorite', authenticate, (req: any, res) => {
    db.prepare('INSERT OR IGNORE INTO favorite_companies (userId, companyId) VALUES (?, ?)').run(req.userId, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/companies/:id/favorite', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM favorite_companies WHERE userId = ? AND companyId = ?').run(req.userId, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/users/me/favorite-products', authenticate, (req: any, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as companyName,
      (SELECT COUNT(*) FROM favorite_products WHERE productId = p.id) as favoritesCount
      FROM company_catalog p
      JOIN companies c ON p.companyId = c.id
      JOIN favorite_products fp ON p.id = fp.productId
      WHERE fp.userId = ?
    `).all(req.userId);
    res.json(products);
  });

  app.post('/api/products/:id/favorite', authenticate, (req: any, res) => {
    db.prepare('INSERT OR IGNORE INTO favorite_products (userId, productId) VALUES (?, ?)').run(req.userId, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/products/:id/favorite', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM favorite_products WHERE userId = ? AND productId = ?').run(req.userId, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/products/:id/share', authenticate, (req: any, res) => {
    db.prepare('UPDATE company_catalog SET shares_count = shares_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // 3.1 Get User by ID
  app.get('/api/users/:id', authenticate, (req: any, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    // Visibility check
    if (user.visibility === 'private' && req.userId !== Number(req.params.id)) {
      return res.status(403).json({ error: 'Profil privé' });
    }
    if (user.visibility === 'network' && req.userId !== Number(req.params.id)) {
      const connection = db.prepare('SELECT status FROM connection_requests WHERE ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)) AND status = ?').get(req.userId, req.params.id, req.params.id, req.userId, 'accepted');
      if (!connection) {
        // Return limited information
        return res.json({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, visibility: 'network' });
      }
    }
    
    res.json(user);
  });

  // 4. Update Profile
  app.put('/api/users/me', authenticate, (req: any, res) => {
    const { name, age, profession, company, maritalStatus, whatsapp, avatarUrl, coverUrl, country, church, groups, interests, skills, marketing, goals, notificationPreferences, visibility } = req.body;
    const stmt = db.prepare(`
      UPDATE users 
      SET name = ?, age = ?, profession = ?, company = ?, maritalStatus = ?, whatsapp = ?, avatarUrl = ?, coverUrl = ?, country = ?, church = ?, groups = ?, interests = ?, skills = ?, marketing = ?, goals = ?, notificationPreferences = ?, visibility = ?
      WHERE id = ?
    `);
    stmt.run(name, age, profession, company, maritalStatus, whatsapp, avatarUrl, coverUrl, country, church, groups, interests, skills, marketing, goals, notificationPreferences ? JSON.stringify(notificationPreferences) : null, visibility || 'public', req.userId);
    res.json({ message: 'Profil mis à jour' });
  });

  // 5. Get All Users (Directory)
  app.get('/api/users', authenticate, (req: any, res) => {
    const { name, country, church, profession, skills } = req.query;
    let query = `
      SELECT u.id, u.name, u.profession, u.company, u.avatarUrl, u.badge, u.country, u.church, u.createdAt, u.skills,
             (SELECT COUNT(*) FROM follows WHERE followingId = u.id) as followersCount,
             EXISTS(SELECT 1 FROM connection_requests WHERE senderId = ? AND receiverId = u.id AND status = 'pending') as requestSent,
             EXISTS(SELECT 1 FROM follows WHERE followerId = ? AND followingId = u.id) as isFollowing
      FROM users u 
      WHERE u.name IS NOT NULL AND u.id != ?
    `;
    const params: any[] = [req.userId, req.userId, req.userId];

    if (name) {
      query += ` AND u.name LIKE ? `;
      params.push(`%${name}%`);
    }
    if (country && country !== 'Tous') {
      query += ` AND u.country = ? `;
      params.push(country);
    }
    if (church && church !== 'Toutes') {
      query += ` AND u.church = ? `;
      params.push(church);
    }
    if (profession && profession !== 'Toutes') {
      query += ` AND u.profession = ? `;
      params.push(profession);
    }
    if (skills) {
      query += ` AND u.skills LIKE ? `;
      params.push(`%${skills}%`);
    }

    query += ` ORDER BY u.createdAt DESC `;
    const users = db.prepare(query).all(...params);
    res.json(users);
  });

  // 5.1 Send Connection Request
  app.post('/api/users/:id/connect', authenticate, (req: any, res) => {
    const receiverId = req.params.id;
    const senderId = req.userId;
    
    // Check if already connected or request sent
    const existing = db.prepare('SELECT * FROM connection_requests WHERE senderId = ? AND receiverId = ?').get(senderId, receiverId);
    if (existing) return res.status(400).json({ error: 'Demande déjà envoyée' });

    db.prepare('INSERT INTO connection_requests (senderId, receiverId) VALUES (?, ?)').run(senderId, receiverId);
    
    // Create notification for receiver
    const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(senderId) as any;
    const notificationContent = `${sender.name} souhaite se connecter avec vous.`;
    const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
      receiverId, 'connection_request', notificationContent, senderId
    );

    // Emit real-time notification
    io.to(`user_${receiverId}`).emit('notification', {
      id: notifResult.lastInsertRowid,
      userId: Number(receiverId),
      type: 'connection_request',
      content: notificationContent,
      relatedId: senderId,
      read: 0,
      createdAt: new Date().toISOString()
    });

    res.json({ message: 'Demande envoyée' });
  });

  // 5.2 Get Notifications
  app.get('/api/notifications', authenticate, (req: any, res) => {
    const notifs = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC').all(req.userId);
    res.json(notifs);
  });

  // 5.2.1 Get Network Requests (alias)
  app.get('/api/users/me/network-requests', authenticate, (req: any, res) => {
    const requests = db.prepare(`
      SELECT cr.*, u.name as senderName, u.avatarUrl as senderAvatar
      FROM connection_requests cr
      JOIN users u ON cr.senderId = u.id
      WHERE cr.receiverId = ? AND cr.status = 'pending'
    `).all(req.userId);
    res.json(requests);
  });

  app.get('/api/users/me/connections', authenticate, (req: any, res) => {
    const connections = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.avatarUrl, u.profession, u.company
      FROM users u
      JOIN connection_requests cr ON (u.id = cr.senderId OR u.id = cr.receiverId)
      WHERE (cr.senderId = ? OR cr.receiverId = ?) 
      AND cr.status = 'accepted'
      AND u.id != ?
    `).all(req.userId, req.userId, req.userId);
    res.json(connections);
  });

  // 5.3 Mark Notification as Read
  app.put('/api/notifications/:id/read', authenticate, (req: any, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  });

  // 5.4 Follow User (Accept Connection)
  app.post('/api/users/:id/follow', authenticate, (req: any, res) => {
    const followingId = req.params.id;
    const followerId = req.userId;
    
    try {
      db.prepare('INSERT INTO follows (followerId, followingId) VALUES (?, ?)').run(followerId, followingId);
      // Update request status if exists
      db.prepare("UPDATE connection_requests SET status = 'accepted' WHERE senderId = ? AND receiverId = ?").run(followingId, followerId);
      res.json({ message: 'Connecté avec succès' });
    } catch (e) {
      res.status(400).json({ error: 'Déjà connecté' });
    }
  });

  // 6. Get Events
  app.get('/api/events', authenticate, (req: any, res) => {
    const events = db.prepare(`
      SELECT e.*, 
             (SELECT COUNT(*) FROM event_participants WHERE eventId = e.id) as participantsCount,
             (SELECT COUNT(*) FROM event_participants WHERE eventId = e.id AND userId = ?) as isParticipating,
             (SELECT COUNT(*) FROM favorite_events WHERE eventId = e.id) as favoritesCount,
             (SELECT COUNT(*) FROM favorite_events WHERE eventId = e.id AND userId = ?) as isFavorite
      FROM events e 
      ORDER BY startDate ASC
    `).all(req.userId, req.userId);
    res.json(events);
  });

  app.get('/api/events/:id', authenticate, (req: any, res) => {
    const event = db.prepare(`
      SELECT e.*, 
             (SELECT COUNT(*) FROM event_participants WHERE eventId = e.id) as participantsCount,
             (SELECT COUNT(*) FROM event_participants WHERE eventId = e.id AND userId = ?) as isParticipating,
             (SELECT COUNT(*) FROM favorite_events WHERE eventId = e.id) as favoritesCount,
             (SELECT COUNT(*) FROM favorite_events WHERE eventId = e.id AND userId = ?) as isFavorite
      FROM events e 
      WHERE e.id = ?
    `).get(req.userId, req.userId, req.params.id);
    if (!event) return res.status(404).json({ error: 'Événement non trouvé' });
    res.json(event);
  });

  app.post('/api/events/:id/favorite', authenticate, (req: any, res) => {
    const { id } = req.params;
    const favorite = db.prepare('SELECT 1 FROM favorite_events WHERE userId = ? AND eventId = ?').get(req.userId, id);

    if (favorite) {
      db.prepare('DELETE FROM favorite_events WHERE userId = ? AND eventId = ?').run(req.userId, id);
      res.json({ isFavorite: false });
    } else {
      db.prepare('INSERT INTO favorite_events (userId, eventId) VALUES (?, ?)').run(req.userId, id);
      res.json({ isFavorite: true });
    }
  });

  app.post('/api/events/:id/share', authenticate, (req: any, res) => {
    const { id } = req.params;
    db.prepare('UPDATE events SET shares_count = shares_count + 1 WHERE id = ?').run(id);
    const updated = db.prepare('SELECT shares_count FROM events WHERE id = ?').get(id) as any;
    res.json({ shares_count: updated.shares_count });
  });

  // 7. Create Event
  app.post('/api/events', authenticate, (req: any, res) => {
    try {
      const { title, description, imageUrl, visualUrl, country, city, location, latitude, longitude, startDate, endDate, category, communityId, price } = req.body;
      
      if (!title || !description || !country || !city || !location || !startDate || !endDate || !category) {
        return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
      }

      const stmt = db.prepare(`
        INSERT INTO events (title, description, imageUrl, visualUrl, country, city, location, latitude, longitude, startDate, endDate, category, communityId, creatorId, price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(title, description, imageUrl || null, visualUrl || null, country, city, location, latitude || null, longitude || null, startDate, endDate, category, communityId || null, req.userId, price || 0);
      
      // Auto-post to feed
      db.prepare(`
        INSERT INTO posts (authorId, content, category, mediaUrls)
        VALUES (?, ?, ?, ?)
      `).run(req.userId, `🎉 Nouvel événement : ${title}\n\n${description}\n\n📍 Lieu : ${location}\n📅 Date : ${startDate}`, 'Programme', imageUrl ? JSON.stringify([{url: imageUrl, type: 'image'}]) : null);
      
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      console.error('Error creating event:', err);
      res.status(500).json({ error: 'Erreur lors de la création de l\'événement: ' + err.message });
    }
  });

  app.put('/api/events/:id', authenticate, (req: any, res) => {
    const event = db.prepare('SELECT creatorId FROM events WHERE id = ?').get(req.params.id) as any;
    if (!event || event.creatorId !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    const { title, description, location, latitude, longitude, startDate, endDate, category, city, country, price, imageUrl, visualUrl, communityId } = req.body;
    db.prepare('UPDATE events SET title = ?, description = ?, location = ?, latitude = ?, longitude = ?, startDate = ?, endDate = ?, category = ?, city = ?, country = ?, price = ?, imageUrl = ?, visualUrl = ?, communityId = ? WHERE id = ?')
      .run(title, description, location, latitude, longitude, startDate, endDate, category, city, country, price, imageUrl || null, visualUrl || null, communityId || null, req.params.id);
    res.json({ message: 'Événement mis à jour' });
  });

  app.delete('/api/events/:id', authenticate, (req: any, res) => {
    const event = db.prepare('SELECT creatorId FROM events WHERE id = ?').get(req.params.id) as any;
    if (!event || event.creatorId !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM event_participants WHERE eventId = ?').run(req.params.id);
    res.json({ message: 'Événement supprimé' });
  });

  // 8. Participate in Event
  app.post('/api/events/:id/participate', authenticate, (req: any, res) => {
    const eventId = req.params.id;
    try {
      db.prepare('INSERT INTO event_participants (eventId, userId) VALUES (?, ?)').run(eventId, req.userId);
      
      // Create notification for event organizer
      const event = db.prepare('SELECT creatorId as organizerId, title FROM events WHERE id = ?').get(eventId) as any;
      if (event && event.organizerId !== req.userId) {
        const participant = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
        const notificationContent = `${participant.name} participe à votre événement: ${event.title}`;
        const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
          event.organizerId, 'event_participation', notificationContent, eventId
        );

        // Emit real-time notification
        io.to(`user_${event.organizerId}`).emit('notification', {
          id: notifResult.lastInsertRowid,
          userId: event.organizerId,
          type: 'event_participation',
          content: notificationContent,
          relatedId: Number(eventId),
          read: 0,
          createdAt: new Date().toISOString()
        });
      }

      res.json({ message: 'Participation confirmée' });
    } catch (e) {
      res.status(400).json({ error: 'Déjà participant' });
    }
  });

  app.delete('/api/events/:id/participate', authenticate, (req: any, res) => {
    const eventId = req.params.id;
    try {
      db.prepare('DELETE FROM event_participants WHERE eventId = ? AND userId = ?').run(eventId, req.userId);
      res.json({ message: 'Participation annulée' });
    } catch (e) {
      res.status(500).json({ error: 'Erreur lors de l\'annulation' });
    }
  });

  // 8.1 Get Event Participants
  app.get('/api/events/:id/participants', authenticate, (req: any, res) => {
    const participants = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl
      FROM event_participants ep
      JOIN users u ON ep.userId = u.id
      WHERE ep.eventId = ?
    `).all(req.params.id);
    res.json(participants);
  });

  // 8.2 Get Single Event
  app.get('/api/events/:id', authenticate, (req: any, res) => {
    const event = db.prepare(`
      SELECT e.*, u.name as creatorName, u.avatarUrl as creatorAvatar,
             (SELECT COUNT(*) FROM event_participants WHERE eventId = e.id) as participantsCount,
             (SELECT COUNT(*) FROM event_participants WHERE eventId = e.id AND userId = ?) as isParticipating,
             (SELECT COUNT(*) FROM event_likes WHERE eventId = e.id) as likesCount,
             (SELECT COUNT(*) FROM event_likes WHERE eventId = e.id AND userId = ?) as isLiked
      FROM events e
      JOIN users u ON e.creatorId = u.id
      WHERE e.id = ?
    `).get(req.userId, req.userId, req.params.id);
    
    if (!event) return res.status(404).json({ error: 'Événement non trouvé' });
    res.json(event);
  });

  // 8.3 Toggle Like Event
  app.post('/api/events/:id/like', authenticate, (req: any, res) => {
    const eventId = req.params.id;
    const isLiked = db.prepare('SELECT 1 FROM event_likes WHERE eventId = ? AND userId = ?').get(eventId, req.userId);
    
    if (isLiked) {
      db.prepare('DELETE FROM event_likes WHERE eventId = ? AND userId = ?').run(eventId, req.userId);
      res.json({ liked: false });
    } else {
      db.prepare('INSERT INTO event_likes (eventId, userId) VALUES (?, ?)').run(eventId, req.userId);
      res.json({ liked: true });
    }
  });

  // 8.4 Get Event Comments
  app.get('/api/events/:id/comments', authenticate, (req: any, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.name as userName, u.avatarUrl as userAvatar
      FROM event_comments c
      JOIN users u ON c.userId = u.id
      WHERE c.eventId = ?
      ORDER BY c.createdAt DESC
    `).all(req.params.id);
    res.json(comments);
  });

  // 8.5 Add Event Comment
  app.post('/api/events/:id/comments', authenticate, (req: any, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Le contenu est requis' });
    
    const result = db.prepare('INSERT INTO event_comments (eventId, userId, content) VALUES (?, ?, ?)')
      .run(req.params.id, req.userId, content);
    
    const comment = db.prepare(`
      SELECT c.*, u.name as userName, u.avatarUrl as userAvatar
      FROM event_comments c
      JOIN users u ON c.userId = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);
    
    res.json(comment);
  });

  // 8.6 Invite Users to Event
  app.post('/api/events/:id/invite', authenticate, (req: any, res) => {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) return res.status(400).json({ error: 'Liste d\'utilisateurs invalide' });
    
    const event = db.prepare('SELECT title FROM events WHERE id = ?').get(req.params.id) as any;
    const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    
    userIds.forEach(userId => {
      const content = `${sender.name} vous invite à participer à l'événement : ${event.title}`;
      const result = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)')
        .run(userId, 'event_invite', content, req.params.id);
        
      io.to(`user_${userId}`).emit('notification', {
        id: result.lastInsertRowid,
        userId,
        type: 'event_invite',
        content,
        relatedId: Number(req.params.id),
        read: 0,
        createdAt: new Date().toISOString()
      });
    });
    
    res.json({ success: true });
  });

  // 9. Get Posts (Feed)
  app.get('/api/posts', authenticate, (req: any, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const country = req.query.country as string;
    const cellId = req.query.cellId ? parseInt(req.query.cellId as string) : null;
    const authorId = req.query.authorId ? parseInt(req.query.authorId as string) : null;
    const feedType = req.query.feedType as string;
    const search = req.query.search as string;

    // If cellId is provided, verify membership
    if (cellId) {
      const isMember = db.prepare('SELECT 1 FROM cell_members WHERE cellId = ? AND userId = ?').get(cellId, req.userId);
      if (!isMember) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette cellule' });
    }

    let query = `
      SELECT p.*, u.name as authorName, u.avatarUrl as authorAvatar, u.profession as authorProfession, u.country as authorCountry,
             (SELECT COUNT(*) FROM post_likes WHERE postId = p.id) as likesCount,
             (SELECT COUNT(*) FROM post_likes WHERE postId = p.id AND type = 'like') as reactionLikeCount,
             (SELECT COUNT(*) FROM post_likes WHERE postId = p.id AND type = 'applause') as reactionApplauseCount,
             (SELECT COUNT(*) FROM post_likes WHERE postId = p.id AND type = 'inspiration') as reactionInspirationCount,
             (SELECT COUNT(*) FROM post_comments WHERE postId = p.id) as commentsCount,
             (SELECT type FROM post_likes WHERE postId = p.id AND userId = ?) as myReactionType,
             (SELECT 1 FROM post_boosts WHERE postId = p.id) as isBoosted
      FROM posts p
      JOIN users u ON p.authorId = u.id
      WHERE 1=1
    `;
    const params: any[] = [req.userId];

    if (authorId) {
      query += ` AND p.authorId = ? `;
      params.push(authorId);
    }

    if (cellId) {
      query += ` AND p.cellId = ? `;
      params.push(cellId);
    } else if (!authorId) {
      query += ` AND (p.cellId IS NULL OR p.cellId IN (SELECT cellId FROM cell_members WHERE userId = ?)) `;
      params.push(req.userId);
    }

    if (feedType === 'network') {
      query += ` AND (
        p.authorId IN (SELECT followingId FROM follows WHERE followerId = ?) OR
        p.authorId IN (SELECT userId FROM cell_members WHERE cellId IN (SELECT cellId FROM cell_members WHERE userId = ?)) OR
        p.authorId IN (SELECT userId FROM pannel_members WHERE pannelId IN (SELECT pannelId FROM pannel_members WHERE userId = ?)) OR
        p.authorId IN (SELECT userId FROM community_members WHERE communityId IN (SELECT communityId FROM community_members WHERE userId = ?))
      ) `;
      params.push(req.userId, req.userId, req.userId, req.userId);
    }

    if (category && category !== 'Tous') {
      query += ` AND p.category = ? `;
      params.push(category);
    }

    if (search) {
      query += ` AND (p.content LIKE ? OR u.name LIKE ?) `;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (country && country !== 'Tous') {
      query += ` AND u.country = ? `;
      params.push(country);
    }

    query += ` ORDER BY isBoosted DESC, p.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const posts = db.prepare(query).all(...params);
    res.json(posts);
  });

  // 9.1 Increment Post Views
  app.post('/api/posts/:id/boost', authenticate, (req: any, res) => {
    const { amount } = req.body;
    const postId = req.params.id;
    
    // Check if post exists and user is author
    const post = db.prepare('SELECT authorId FROM posts WHERE id = ?').get(postId) as any;
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    if (post.authorId !== req.userId) return res.status(403).json({ error: 'Seul l\'auteur peut booster son post' });

    try {
      db.prepare('INSERT INTO post_boosts (postId, userId, amount) VALUES (?, ?, ?)').run(postId, req.userId, amount);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Ce post est déjà boosté' });
    }
  });

  app.post('/api/posts/:id/view', authenticate, (req: any, res) => {
    const postId = req.params.id;
    db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(postId);
    res.json({ success: true });
  });

  // 9.2 Get All Countries from Users
  app.get('/api/countries', authenticate, (req: any, res) => {
    const countries = db.prepare("SELECT DISTINCT country FROM users WHERE country IS NOT NULL AND country != '' ORDER BY country ASC").all();
    res.json(countries.map((c: any) => c.country));
  });

  // 10. Create Post
  app.post('/api/posts', authenticate, (req: any, res) => {
    try {
      const { content, category, mediaUrls, cellId } = req.body;
      if (!content && (!mediaUrls || mediaUrls.length === 0)) {
        return res.status(400).json({ error: 'Le contenu ou un média est requis' });
      }

      // If cellId is provided, verify membership
      if (cellId) {
        const isMember = db.prepare('SELECT 1 FROM cell_members WHERE cellId = ? AND userId = ?').get(cellId, req.userId);
        if (!isMember) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette cellule' });
      }

      const stmt = db.prepare('INSERT INTO posts (authorId, content, category, mediaUrls, cellId) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(req.userId, content || '', category || 'Tous', mediaUrls ? JSON.stringify(mediaUrls) : null, cellId || null);
      const postId = info.lastInsertRowid;

      // Handle mentions in post content
      if (content) {
        handleMentions(content, req.userId, Number(postId), 'post');
      }

      res.json({ id: postId });
    } catch (err: any) {
      console.error('Error creating post:', err);
      res.status(500).json({ error: 'Erreur lors de la création du post' });
    }
  });

  app.put('/api/posts/:id', authenticate, (req: any, res) => {
    const post = db.prepare('SELECT authorId FROM posts WHERE id = ?').get(req.params.id) as any;
    if (!post || post.authorId !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    db.prepare('UPDATE posts SET content = ? WHERE id = ?').run(req.body.content, req.params.id);
    
    // Handle mentions in updated post
    if (req.body.content) {
      handleMentions(req.body.content, req.userId, Number(req.params.id), 'post');
    }
    
    res.json({ message: 'Post mis à jour' });
  });

  app.delete('/api/posts/:id', authenticate, (req: any, res) => {
    const post = db.prepare('SELECT authorId FROM posts WHERE id = ?').get(req.params.id) as any;
    if (!post || post.authorId !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM post_likes WHERE postId = ?').run(req.params.id);
    db.prepare('DELETE FROM post_comments WHERE postId = ?').run(req.params.id);
    res.json({ message: 'Post supprimé' });
  });

  // 10.1 Toggle Like Post
  app.post('/api/posts/:id/like', authenticate, (req: any, res) => {
    const postId = req.params.id;
    const userId = req.userId;
    const type = req.body.type || 'like';
    
    const existingLike = db.prepare('SELECT * FROM post_likes WHERE postId = ? AND userId = ?').get(postId, userId) as any;
    
    if (existingLike) {
      if (existingLike.type === type) {
        db.prepare('DELETE FROM post_likes WHERE postId = ? AND userId = ?').run(postId, userId);
        res.json({ liked: false, type: null });
      } else {
        db.prepare('UPDATE post_likes SET type = ? WHERE postId = ? AND userId = ?').run(type, postId, userId);
        res.json({ liked: true, type });
      }
    } else {
      db.prepare('INSERT INTO post_likes (postId, userId, type) VALUES (?, ?, ?)').run(postId, userId, type);
      
      // Create notification for post author
      const post = db.prepare('SELECT authorId FROM posts WHERE id = ?').get(postId) as any;
      if (post && post.authorId !== userId) {
        const liker = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
        const notificationContent = `${liker.name} a aimé votre publication.`;
        const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
          post.authorId, 'like', notificationContent, postId
        );

        // Emit real-time notification
        io.to(`user_${post.authorId}`).emit('notification', {
          id: notifResult.lastInsertRowid,
          userId: post.authorId,
          type: 'like',
          content: notificationContent,
          relatedId: Number(postId),
          read: 0,
          createdAt: new Date().toISOString()
        });
      }
      
      res.json({ liked: true, type });
    }
  });

  // 10.2 Get Post Comments
  app.get('/api/posts/:id/comments', authenticate, (req: any, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.name as authorName, u.avatarUrl as authorAvatar 
      FROM post_comments c
      JOIN users u ON c.userId = u.id
      WHERE c.postId = ?
      ORDER BY c.createdAt ASC
    `).all(req.params.id);
    res.json(comments);
  });

  // 10.2.1 Get Post Reactions
  app.get('/api/posts/:id/reactions', authenticate, (req: any, res) => {
    const reactions = db.prepare(`
      SELECT l.type, u.id as userId, u.name as userName, u.avatarUrl as userAvatar
      FROM post_likes l
      JOIN users u ON l.userId = u.id
      WHERE l.postId = ?
      ORDER BY l.createdAt DESC
    `).all(req.params.id);
    res.json(reactions);
  });

  // 10.3 Add Comment
  app.post('/api/posts/:id/comments', authenticate, (req: any, res) => {
    const { content } = req.body;
    const postId = req.params.id;
    const stmt = db.prepare('INSERT INTO post_comments (postId, userId, content) VALUES (?, ?, ?)');
    const info = stmt.run(postId, req.userId, content);
    const commentId = info.lastInsertRowid;

    // Handle mentions in comment content
    handleMentions(content, req.userId, Number(postId), 'comment');

    // Create notification for post author
    const post = db.prepare('SELECT authorId FROM posts WHERE id = ?').get(postId) as any;
    if (post && post.authorId !== req.userId) {
      const commenter = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
      const notificationContent = `${commenter.name} a commenté votre publication.`;
      const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
        post.authorId, 'comment', notificationContent, postId
      );

      // Emit real-time notification
      io.to(`user_${post.authorId}`).emit('notification', {
        id: notifResult.lastInsertRowid,
        userId: post.authorId,
        type: 'comment',
        content: notificationContent,
        relatedId: Number(postId),
        read: 0,
        createdAt: new Date().toISOString()
      });
    }

    res.json({ id: info.lastInsertRowid });
  });

  // 10.3.1 Update Comment
  app.put('/api/posts/:postId/comments/:commentId', authenticate, (req: any, res) => {
    const { content } = req.body;
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = db.prepare('SELECT userId, postId FROM post_comments WHERE id = ?').get(commentId) as any;
    if (!comment) return res.status(404).json({ error: 'Commentaire non trouvé' });
    if (comment.userId !== userId) return res.status(403).json({ error: 'Non autorisé' });

    db.prepare('UPDATE post_comments SET content = ? WHERE id = ?').run(content, commentId);

    // Handle mentions in updated comment
    if (content) {
      handleMentions(content, userId, comment.postId, 'comment');
    }

    res.json({ success: true });
  });

  // 10.3.2 Delete Comment
  app.delete('/api/posts/:postId/comments/:commentId', authenticate, (req: any, res) => {
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = db.prepare('SELECT userId FROM post_comments WHERE id = ?').get(commentId) as any;
    if (!comment) return res.status(404).json({ error: 'Commentaire non trouvé' });
    if (comment.userId !== userId) return res.status(403).json({ error: 'Non autorisé' });

    db.prepare('DELETE FROM post_comments WHERE id = ?').run(commentId);
    res.json({ success: true });
  });

  // 11. Create Service
  app.post('/api/services', authenticate, (req: any, res) => {
    const { title, description, availability, budget, type, companyName, location, contractType, fileUrl, category } = req.body;
    const stmt = db.prepare('INSERT INTO services (providerId, title, description, availability, budget, type, companyName, location, contractType, fileUrl, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(req.userId, title, description, availability, budget, type || 'projet', companyName, location, contractType, fileUrl, category);
    res.json({ id: info.lastInsertRowid });
  });

  app.put('/api/services/:id', authenticate, (req: any, res) => {
    const service = db.prepare('SELECT providerId FROM services WHERE id = ?').get(req.params.id) as any;
    if (!service || service.providerId !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    const { title, description, budget, availability, type, companyName, location, contractType, fileUrl, category } = req.body;
    db.prepare('UPDATE services SET title = ?, description = ?, budget = ?, availability = ?, type = ?, companyName = ?, location = ?, contractType = ?, fileUrl = ?, category = ? WHERE id = ?').run(
      title, description, budget, availability, type, companyName, location, contractType, fileUrl, category, req.params.id
    );
    res.json({ message: 'Service mis à jour' });
  });

  app.delete('/api/services/:id', authenticate, (req: any, res) => {
    const service = db.prepare('SELECT providerId FROM services WHERE id = ?').get(req.params.id) as any;
    if (!service || service.providerId !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM service_applications WHERE serviceId = ?').run(req.params.id);
    res.json({ message: 'Service supprimé' });
  });

  // 10.4 Get Stories
  app.get('/api/stories', authenticate, (req: any, res) => {
    // Get stories from the last 24 hours from followed users OR own stories
    const stories = db.prepare(`
      SELECT DISTINCT s.*, u.name as authorName, u.avatarUrl as authorAvatar,
             (SELECT COUNT(*) FROM story_views WHERE storyId = s.id) as viewsCount,
             (SELECT COUNT(*) FROM story_reactions WHERE storyId = s.id) as reactionsCount,
             EXISTS(SELECT 1 FROM story_views WHERE storyId = s.id AND userId = ?) as isViewed
      FROM stories s
      JOIN users u ON s.userId = u.id
      LEFT JOIN follows f ON f.followingId = s.userId
      WHERE (f.followerId = ? OR s.userId = ?) AND s.expiresAt > datetime('now')
      ORDER BY s.createdAt DESC
    `).all(req.userId, req.userId, req.userId);
    res.json(stories);
  });

  // 10.4.1 Get Story Archives
  app.get('/api/stories/archives', authenticate, (req: any, res) => {
    const archives = db.prepare(`
      SELECT DISTINCT s.*, u.name as authorName, u.avatarUrl as authorAvatar,
             (SELECT COUNT(*) FROM story_views WHERE storyId = s.id) as viewsCount,
             (SELECT COUNT(*) FROM story_reactions WHERE storyId = s.id) as reactionsCount,
             1 as isViewed
      FROM stories s
      JOIN users u ON s.userId = u.id
      LEFT JOIN story_views sv ON sv.storyId = s.id
      WHERE s.userId = ? OR sv.userId = ?
      ORDER BY s.createdAt DESC
    `).all(req.userId, req.userId);
    res.json(archives);
  });

  // 10.5 Create Story
  app.post('/api/stories', authenticate, (req: any, res) => {
    const { mediaUrl, mediaType } = req.body;
    const stmt = db.prepare(`
      INSERT INTO stories (userId, mediaUrl, mediaType, expiresAt)
      VALUES (?, ?, ?, datetime('now', '+24 hours'))
    `);
    const info = stmt.run(req.userId, mediaUrl, mediaType || 'image');
    res.json({ id: info.lastInsertRowid });
  });

  // 10.6 View Story
  app.post('/api/stories/:id/view', authenticate, (req: any, res) => {
    try {
      db.prepare('INSERT INTO story_views (storyId, userId) VALUES (?, ?)').run(req.params.id, req.userId);
      res.json({ success: true });
    } catch (e) {
      // Already viewed
      res.json({ success: true });
    }
  });

  // 10.8 Get Story Viewers
  app.get('/api/stories/:id/viewers', authenticate, (req: any, res) => {
    const viewers = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl
      FROM story_views sv
      JOIN users u ON sv.userId = u.id
      WHERE sv.storyId = ?
    `).all(req.params.id);
    res.json(viewers);
  });

  // 10.9 Get Story Reactions
  app.get('/api/stories/:id/reactions', authenticate, (req: any, res) => {
    const reactions = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl, sr.emoji
      FROM story_reactions sr
      JOIN users u ON sr.userId = u.id
      WHERE sr.storyId = ?
    `).all(req.params.id);
    res.json(reactions);
  });

  // 10.7 React to Story
  app.post('/api/stories/:id/react', authenticate, (req: any, res) => {
    const { emoji } = req.body;
    db.prepare('INSERT INTO story_reactions (storyId, userId, emoji) VALUES (?, ?, ?)').run(req.params.id, req.userId, emoji);
    res.json({ success: true });
  });

  // 12. Get Services
  app.get('/api/services', authenticate, (req, res) => {
    const services = db.prepare(`
      SELECT s.*, u.name as providerName, u.avatarUrl as providerAvatar 
      FROM services s 
      JOIN users u ON s.providerId = u.id 
      ORDER BY s.createdAt DESC
    `).all();
    res.json(services);
  });

  // 13. Apply to Service
  app.post('/api/services/:id/apply', authenticate, (req: any, res) => {
    const { message, contactDetails } = req.body;
    const serviceId = req.params.id;
    try {
      db.prepare('INSERT INTO service_applications (serviceId, userId, message, contactDetails) VALUES (?, ?, ?, ?)').run(serviceId, req.userId, message, contactDetails);
      
      // Create notification for service provider
      const service = db.prepare('SELECT providerId, title FROM services WHERE id = ?').get(serviceId) as any;
      if (service && service.providerId !== req.userId) {
        const applicant = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
        const notificationContent = `${applicant.name} a postulé à votre service: ${service.title}`;
        const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
          service.providerId, 'service_application', notificationContent, serviceId
        );

        // Emit real-time notification
        io.to(`user_${service.providerId}`).emit('notification', {
          id: notifResult.lastInsertRowid,
          userId: service.providerId,
          type: 'service_application',
          content: notificationContent,
          relatedId: Number(serviceId),
          read: 0,
          createdAt: new Date().toISOString()
        });
      }

      res.json({ message: 'Candidature envoyée' });
    } catch (e) {
      res.status(400).json({ error: 'Vous avez déjà postulé à cette offre' });
    }
  });

  // 14. Follow User
  app.post('/api/users/:id/follow', authenticate, (req: any, res) => {
    const followingId = req.params.id;
    try {
      db.prepare('INSERT INTO follows (followerId, followingId) VALUES (?, ?)').run(req.userId, followingId);
      
      // Create notification for followed user
      const follower = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
      const notificationContent = `${follower.name} a commencé à vous suivre.`;
      const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
        followingId, 'follow', notificationContent, req.userId
      );

      // Emit real-time notification
      io.to(`user_${followingId}`).emit('notification', {
        id: notifResult.lastInsertRowid,
        userId: Number(followingId),
        type: 'follow',
        content: notificationContent,
        relatedId: req.userId,
        read: 0,
        createdAt: new Date().toISOString()
      });

      res.json({ message: 'Utilisateur suivi' });
    } catch (e) {
      res.status(400).json({ error: 'Déjà suivi' });
    }
  });

  // 15. Get My Events
  app.get('/api/users/me/events', authenticate, (req: any, res) => {
    const events = db.prepare(`
      SELECT e.* FROM events e
      JOIN event_participants ep ON e.id = ep.eventId
      WHERE ep.userId = ?
      ORDER BY e.startDate ASC
    `).all(req.userId);
    res.json(events);
  });

  app.get('/api/users/:id/events', authenticate, (req: any, res) => {
    const events = db.prepare(`
      SELECT e.* FROM events e
      JOIN event_participants ep ON e.id = ep.eventId
      WHERE ep.userId = ?
      ORDER BY e.startDate ASC
    `).all(req.params.id);
    res.json(events);
  });

  // 16. Get My Services (Created & Applied)
  app.get('/api/users/me/services', authenticate, (req: any, res) => {
    const created = db.prepare('SELECT * FROM services WHERE providerId = ? ORDER BY createdAt DESC').all(req.userId);
    const applied = db.prepare(`
      SELECT s.* FROM services s
      JOIN service_applications sa ON s.id = sa.serviceId
      WHERE sa.userId = ?
      ORDER BY sa.createdAt DESC
    `).all(req.userId);
    res.json({ created, applied });
  });

  // 17. Get My Network (Following)
  app.get('/api/users/me/following', authenticate, (req: any, res) => {
    const following = db.prepare(`
      SELECT u.id, u.name, u.profession, u.avatarUrl, u.company, u.badge 
      FROM users u
      JOIN follows f ON u.id = f.followingId
      WHERE f.followerId = ?
    `).all(req.userId);
    res.json(following);
  });

  // 18. Get Conversations List (Updated to include rooms)
  app.get('/api/conversations', authenticate, (req: any, res) => {
    // 1-on-1 conversations (legacy/direct)
    const directConversations = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl, MAX(m.createdAt) as lastMessageAt,
             (SELECT content FROM messages WHERE ((senderId = u.id AND receiverId = ?) OR (senderId = ? AND receiverId = u.id)) AND roomId IS NULL ORDER BY createdAt DESC LIMIT 1) as lastMessage,
             (SELECT COUNT(*) FROM messages WHERE senderId = u.id AND receiverId = ? AND read = 0 AND roomId IS NULL) as unreadCount,
             'direct' as type
      FROM users u
      JOIN messages m ON u.id = m.senderId OR u.id = m.receiverId
      WHERE (m.senderId = ? OR m.receiverId = ?) AND u.id != ? AND m.roomId IS NULL
      GROUP BY u.id
    `).all(req.userId, req.userId, req.userId, req.userId, req.userId, req.userId);

    // Group conversations (rooms)
    const roomConversations = db.prepare(`
      SELECT cr.id, cr.name, cr.avatarUrl, MAX(m.createdAt) as lastMessageAt,
             (SELECT content FROM messages WHERE roomId = cr.id ORDER BY createdAt DESC LIMIT 1) as lastMessage,
             (SELECT COUNT(*) FROM messages WHERE roomId = cr.id AND read = 0 AND senderId != ?) as unreadCount,
             cr.type
      FROM chat_rooms cr
      JOIN chat_room_members crm ON cr.id = crm.roomId
      LEFT JOIN messages m ON cr.id = m.roomId
      WHERE crm.userId = ?
      GROUP BY cr.id
    `).all(req.userId, req.userId);

    const allConversations = [...directConversations, ...roomConversations].sort((a: any, b: any) => 
      new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );

    res.json(allConversations);
  });

  // 18.1 Create Chat Room
  app.post('/api/chat-rooms', authenticate, (req: any, res) => {
    const { name, type, memberIds, avatarUrl } = req.body;
    const info = db.prepare('INSERT INTO chat_rooms (name, type, avatarUrl, creatorId) VALUES (?, ?, ?, ?)').run(
      name || null, type || 'group', avatarUrl || null, req.userId
    );
    const roomId = info.lastInsertRowid;

    // Add creator as member
    db.prepare('INSERT INTO chat_room_members (roomId, userId) VALUES (?, ?)').run(roomId, req.userId);

    // Add other members
    if (memberIds && Array.isArray(memberIds)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO chat_room_members (roomId, userId) VALUES (?, ?)');
      memberIds.forEach(id => stmt.run(roomId, id));
    }

    res.json({ id: roomId, name, type, avatarUrl });
  });

  // 18.2 Add Members to Room
  app.post('/api/chat-rooms/:id/members', authenticate, (req: any, res) => {
    const { userIds } = req.body;
    const roomId = req.params.id;

    if (!userIds || !Array.isArray(userIds)) return res.status(400).json({ error: 'userIds requis' });

    const stmt = db.prepare('INSERT OR IGNORE INTO chat_room_members (roomId, userId) VALUES (?, ?)');
    userIds.forEach(id => stmt.run(roomId, id));

    res.json({ success: true });
  });

  // 18.3 Get Room Messages
  app.get('/api/chat-rooms/:id/messages', authenticate, (req: any, res) => {
    const roomId = req.params.id;
    const messages = db.prepare(`
      SELECT m.*, u.name as senderName, u.avatarUrl as senderAvatar,
             (SELECT json_group_array(json_object('userId', userId, 'emoji', emoji)) 
              FROM message_reactions WHERE messageId = m.id) as reactions,
             (SELECT content FROM messages WHERE id = m.replyToId) as replyContent,
             (SELECT name FROM users WHERE id = (SELECT senderId FROM messages WHERE id = m.replyToId)) as replySenderName
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.roomId = ?
      ORDER BY m.createdAt ASC
    `).all(roomId);
    
    const parsedMessages = messages.map((m: any) => ({
      ...m,
      reactions: m.reactions ? JSON.parse(m.reactions) : []
    }));
    res.json(parsedMessages);
  });

  // 18.4 Send Room Message
  app.post('/api/chat-rooms/:id/messages', authenticate, (req: any, res) => {
    const roomId = req.params.id;
    const { content, fileUrl, fileType, fileName, replyToId } = req.body;

    const info = db.prepare('INSERT INTO messages (senderId, roomId, content, fileUrl, fileType, fileName, replyToId) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.userId, roomId, content || '', fileUrl || null, fileType || null, fileName || null, replyToId || null);

    const sender = db.prepare('SELECT name, avatarUrl FROM users WHERE id = ?').get(req.userId) as any;
    
    let replyContent = null;
    let replySenderName = null;
    if (replyToId) {
      const parentMsg = db.prepare('SELECT m.content, u.name FROM messages m JOIN users u ON m.senderId = u.id WHERE m.id = ?').get(replyToId) as any;
      if (parentMsg) {
        replyContent = parentMsg.content;
        replySenderName = parentMsg.name;
      }
    }

    const message = {
      id: info.lastInsertRowid,
      senderId: req.userId,
      roomId: Number(roomId),
      content: content || '',
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
      replyToId: replyToId || null,
      replyContent,
      replySenderName,
      senderName: sender.name,
      senderAvatar: sender.avatarUrl,
      createdAt: new Date().toISOString(),
      read: 0,
      reactions: []
    };

    // Emit to all room members
    const members = db.prepare('SELECT userId FROM chat_room_members WHERE roomId = ?').all(roomId) as any[];
    members.forEach(m => {
      io.to(`user_${m.userId}`).emit('message', message);
    });

    // Handle mentions in group message
    if (content) {
      handleMentions(content, req.userId, Number(roomId), 'message');
    }

    res.json(message);
  });

  // 18.5 Get Room Members
  app.get('/api/chat-rooms/:id/members', authenticate, (req: any, res) => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl, u.profession
      FROM users u
      JOIN chat_room_members crm ON u.id = crm.userId
      WHERE crm.roomId = ?
    `).all(req.params.id);
    res.json(members);
  });

  // 18.6 Update Room Settings
  app.put('/api/chat-rooms/:id', authenticate, (req: any, res) => {
    const { name, avatarUrl } = req.body;
    const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(req.params.id) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    db.prepare('UPDATE chat_rooms SET name = ?, avatarUrl = ? WHERE id = ?').run(
      name !== undefined ? name : room.name,
      avatarUrl !== undefined ? avatarUrl : room.avatarUrl,
      req.params.id
    );
    res.json({ success: true });
  });

  // 19. Get Conversation with User
  app.get('/api/messages/:userId', authenticate, (req: any, res) => {
    console.log(`Fetching conversation with user: ${req.params.userId}, current user: ${req.userId}`);
    const messages = db.prepare(`
      SELECT m.*,
             (SELECT json_group_array(json_object('userId', userId, 'emoji', emoji)) 
              FROM message_reactions WHERE messageId = m.id) as reactions,
             (SELECT content FROM messages WHERE id = m.replyToId) as replyContent,
             (SELECT name FROM users WHERE id = (SELECT senderId FROM messages WHERE id = m.replyToId)) as replySenderName
      FROM messages m 
      WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?)
      ORDER BY m.createdAt ASC
    `).all(req.userId, req.params.userId, req.params.userId, req.userId);
    
    const parsedMessages = messages.map((m: any) => ({
      ...m,
      reactions: m.reactions ? JSON.parse(m.reactions) : []
    }));
    res.json(parsedMessages);
  });

  app.put('/api/messages/:id/pin', authenticate, (req: any, res) => {
    const messageId = req.params.id;
    const userId = req.userId;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
    if (!message) return res.status(404).json({ error: 'Message non trouvé' });

    let allow = false;
    if (message.roomId) {
      const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(message.roomId) as any;
      if (room.creatorId === userId) allow = true;
      else {
        const membership = db.prepare('SELECT * FROM chat_room_members WHERE roomId = ? AND userId = ?').get(message.roomId, userId);
        if (membership) allow = true; 
      }
    } else {
      if (message.senderId === userId || message.receiverId === userId) allow = true;
    }

    if (!allow) return res.status(403).json({ error: 'Non autorisé' });

    let pinnedCount = 0;
    if (message.roomId) {
      pinnedCount = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE roomId = ? AND isPinned = 1').get(message.roomId) as any).count;
    } else {
      const pair = [message.senderId, message.receiverId].sort();
      pinnedCount = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE roomId IS NULL AND isPinned = 1 AND ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?))').get(pair[0], pair[1], pair[1], pair[0]) as any).count;
    }

    if (pinnedCount >= 3) return res.status(400).json({ error: 'Maximum 3 messages épinglés' });

    db.prepare('UPDATE messages SET isPinned = 1 WHERE id = ?').run(messageId);
    res.json({ success: true });
  });

  app.put('/api/messages/:id/unpin', authenticate, (req: any, res) => {
    const messageId = req.params.id;
    db.prepare('UPDATE messages SET isPinned = 0 WHERE id = ?').run(messageId);
    res.json({ success: true });
  });

  app.post('/api/messages/:id/react', authenticate, (req: any, res) => {
    const { emoji } = req.body;
    const messageId = req.params.id;
    const userId = req.userId;

    try {
      const existing = db.prepare('SELECT emoji FROM message_reactions WHERE messageId = ? AND userId = ?').get(messageId, userId) as any;
      
      if (existing) {
        if (existing.emoji === emoji) {
          // Remove reaction if same emoji
          db.prepare('DELETE FROM message_reactions WHERE messageId = ? AND userId = ?').run(messageId, userId);
          return res.json({ action: 'removed', emoji });
        } else {
          // Update reaction if different emoji
          db.prepare('UPDATE message_reactions SET emoji = ? WHERE messageId = ? AND userId = ?').run(emoji, messageId, userId);
          return res.json({ action: 'updated', emoji });
        }
      } else {
        // Add new reaction
        db.prepare('INSERT INTO message_reactions (messageId, userId, emoji) VALUES (?, ?, ?)').run(messageId, userId, emoji);
        return res.json({ action: 'added', emoji });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la réaction' });
    }
  });

  app.put('/api/messages/item/:id', authenticate, (req: any, res) => {
    const { content } = req.body;
    const messageId = req.params.id;
    const userId = req.userId;

    const message = db.prepare('SELECT senderId FROM messages WHERE id = ?').get(messageId) as any;
    if (!message) return res.status(404).json({ error: 'Message non trouvé' });
    if (message.senderId !== userId) return res.status(403).json({ error: 'Non autorisé' });

    db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, messageId);

    // Handle mentions in updated message
    if (content) {
      const msg = db.prepare('SELECT roomId, receiverId FROM messages WHERE id = ?').get(messageId) as any;
      const relatedId = msg.roomId || msg.receiverId || messageId;
      handleMentions(content, userId, relatedId, 'message');
    }

    res.json({ success: true });
  });

  app.delete('/api/messages/item/:id', authenticate, (req: any, res) => {
    const messageId = req.params.id;
    const userId = req.userId;

    const message = db.prepare('SELECT senderId FROM messages WHERE id = ?').get(messageId) as any;
    if (!message) return res.status(404).json({ error: 'Message non trouvé' });
    if (message.senderId !== userId) return res.status(403).json({ error: 'Non autorisé' });

    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
    db.prepare('DELETE FROM message_reactions WHERE messageId = ?').run(messageId);
    res.json({ success: true });
  });

  // 20. Send Message
  app.post('/api/messages/:userId', authenticate, (req: any, res) => {
    const { content, fileUrl, fileType, url, type, name, fileName, replyToId } = req.body;
    const finalFileUrl = fileUrl || url;
    const finalFileType = fileType || type;
    const finalFileName = fileName || name;
    
    // Check if connected
    const connection = db.prepare('SELECT status FROM connection_requests WHERE ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)) AND status = ?').get(req.userId, req.params.userId, req.params.userId, req.userId, 'accepted');
    if (!connection && req.userId !== 1) { // Admin can bypass
      return res.status(403).json({ error: 'Vous devez être connectés pour échanger des messages.' });
    }
    
    const stmt = db.prepare('INSERT INTO messages (senderId, receiverId, content, fileUrl, fileType, fileName, replyToId) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(req.userId, req.params.userId, content || '', finalFileUrl || null, finalFileType || null, finalFileName || null, replyToId || null);
    
    let replyContent = null;
    let replySenderName = null;
    if (replyToId) {
      const parentMsg = db.prepare('SELECT m.content, u.name FROM messages m JOIN users u ON m.senderId = u.id WHERE m.id = ?').get(replyToId) as any;
      if (parentMsg) {
        replyContent = parentMsg.content;
        replySenderName = parentMsg.name;
      }
    }

    const message = { 
      id: info.lastInsertRowid, 
      content: content || '', 
      fileUrl: finalFileUrl || null,
      fileType: finalFileType || null,
      fileName: finalFileName || null,
      replyToId: replyToId || null,
      replyContent,
      replySenderName,
      senderId: req.userId, 
      receiverId: Number(req.params.userId), 
      createdAt: new Date().toISOString(),
      read: 0,
      reactions: []
    };
    
    // Emit to receiver and sender (for multi-tab sync)
    io.to(`user_${req.params.userId}`).emit('message', message);
    io.to(`user_${req.userId}`).emit('message', message);
    
    // Handle mentions in direct message
    if (content) {
      handleMentions(content, req.userId, req.userId, 'message');
    }

    // Create notification for receiver
    const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    const notificationContent = `Nouveau message de ${sender.name}`;
    const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
      req.params.userId, 'message', notificationContent, req.userId
    );

    // Emit real-time notification
    io.to(`user_${req.params.userId}`).emit('notification', {
      id: notifResult.lastInsertRowid,
      userId: Number(req.params.userId),
      type: 'message',
      content: notificationContent,
      relatedId: req.userId,
      read: 0,
      createdAt: new Date().toISOString()
    });
    
    res.json(message);
  });

  // 21. Mark Messages as Read
  app.put('/api/messages/:userId/read', authenticate, (req: any, res) => {
    db.prepare('UPDATE messages SET read = 1 WHERE senderId = ? AND receiverId = ?').run(req.params.userId, req.userId);
    res.json({ success: true });
  });

  // 22. Clear Chat History
  app.delete('/api/messages/:userId/history', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)')
      .run(req.userId, req.params.userId, req.params.userId, req.userId);
    res.json({ success: true });
  });

  // 23. Delete Conversation (actually alias for Clear History as conversations are implicitly created by messages)
  app.delete('/api/messages/:userId', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)')
      .run(req.userId, req.params.userId, req.params.userId, req.userId);
    res.json({ success: true });
  });

  // 24. Get My Cells
  app.get('/api/cells/me', authenticate, (req: any, res) => {
    const cells = db.prepare(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM cell_members WHERE cellId = c.id) as membersCount,
             cm.role as currentUserRole,
             s.name as sponsorName
      FROM cells c
      JOIN cell_members cm ON c.id = cm.cellId
      LEFT JOIN users s ON c.sponsorId = s.id
      WHERE cm.userId = ?
      ORDER BY c.createdAt DESC
    `).all(req.userId);
    res.json(cells);
  });

  // 23. Get All Cells
  app.get('/api/cells/all', authenticate, (req: any, res) => {
    const cells = db.prepare(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM cell_members WHERE cellId = c.id) as membersCount,
             (SELECT role FROM cell_members WHERE cellId = c.id AND userId = ?) as currentUserRole,
             u.name as creatorName,
             u.avatarUrl as creatorAvatar,
             s.name as sponsorName
      FROM cells c
      JOIN users u ON c.creatorId = u.id
      LEFT JOIN users s ON c.sponsorId = s.id
      ORDER BY c.createdAt DESC
    `).all(req.userId);
    res.json((cells as any[]).map((cell: any) => {
      if (cell.currentUserRole) return cell;
      return {
        id: cell.id,
        name: cell.name,
        coverUrl: cell.coverUrl,
        membersCount: cell.membersCount
      };
    }));
  });

  // Create Cell
  app.post('/api/cells', authenticate, (req: any, res) => {
    const { name, description, sponsorId, coverUrl } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }
    
    try {
      const cellInsert = db.prepare('INSERT INTO cells (name, description, sponsorId, creatorId, coverUrl) VALUES (?, ?, ?, ?, ?)');
      const cellInfo = cellInsert.run(name, description || null, sponsorId || null, req.userId, coverUrl || null);
      const cellId = cellInfo.lastInsertRowid;
      
      // Add creator as admin
      db.prepare('INSERT INTO cell_members (cellId, userId, role) VALUES (?, ?, ?)').run(cellId, req.userId, 'admin');
      
      // Add sponsor as member if provided
      if (sponsorId && sponsorId !== req.userId) {
        db.prepare('INSERT OR IGNORE INTO cell_members (cellId, userId, role) VALUES (?, ?, ?)').run(cellId, sponsorId, 'member');
        
        // Create notification for sponsor
        const creator = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
        const notificationContent = `${creator.name} vous a sélectionné comme parrain pour la cellule: ${name}`;
        const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
          sponsorId, 'cell_sponsor', notificationContent, cellId
        );

        // Emit real-time notification
        io.to(`user_${sponsorId}`).emit('notification', {
          id: notifResult.lastInsertRowid,
          userId: Number(sponsorId),
          type: 'cell_sponsor',
          content: notificationContent,
          relatedId: Number(cellId),
          read: 0,
          createdAt: new Date().toISOString()
        });
      }
      
      res.json({ success: true, id: cellId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la création de la cellule' });
    }
  });

  // 24. Update Cell
  app.put('/api/cells/:id', authenticate, (req: any, res) => {
    const { name } = req.body;
    const cell = db.prepare('SELECT * FROM cells WHERE id = ?').get(req.params.id) as any;
    if (!cell || cell.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Seul le créateur peut modifier la cellule' });
    }
    db.prepare('UPDATE cells SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json({ success: true });
  });

  // 25. Add Member to Cell
  app.post('/api/cells/:id/members', authenticate, (req: any, res) => {
    const { userId } = req.body;
    const cellId = req.params.id;
    const cell = db.prepare('SELECT * FROM cells WHERE id = ?').get(cellId) as any;
    if (!cell || cell.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Seul le créateur peut ajouter des membres' });
    }
    db.prepare('INSERT OR IGNORE INTO cell_members (cellId, userId) VALUES (?, ?)').run(cellId, userId);
    
    // Create notification for added user
    const notificationContent = `Vous avez été ajouté au groupe: ${cell.name}`;
    const notifResult = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
      userId, 'cell_add_member', notificationContent, cellId
    );

    // Emit real-time notification
    io.to(`user_${userId}`).emit('notification', {
      id: notifResult.lastInsertRowid,
      userId: Number(userId),
      type: 'cell_add_member',
      content: notificationContent,
      relatedId: Number(cellId),
      read: 0,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  });

  // 25.1 Update Cell
  app.put('/api/cells/:id', authenticate, (req: any, res) => {
    const { name, description, coverUrl } = req.body;
    const cell = db.prepare('SELECT * FROM cells WHERE id = ?').get(req.params.id) as any;
    if (!cell || cell.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    db.prepare('UPDATE cells SET name = ?, description = ?, coverUrl = ? WHERE id = ?').run(name, description, coverUrl, req.params.id);
    res.json({ success: true });
  });

  // 26. Get Cell Members
  app.get('/api/cells/:id/members', authenticate, (req: any, res) => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.avatarUrl, u.profession, cm.role, cm.joinedAt
      FROM users u
      JOIN cell_members cm ON u.id = cm.userId
      WHERE cm.cellId = ?
      ORDER BY cm.joinedAt ASC
    `).all(req.params.id);
    res.json(members);
  });

  // 27. Delete Cell
  app.delete('/api/cells/:id', authenticate, (req: any, res) => {
    const cell = db.prepare('SELECT * FROM cells WHERE id = ?').get(req.params.id) as any;
    if (!cell) {
      return res.status(404).json({ error: 'Cellule introuvable' });
    }

    // Check if user is creator, global admin, or cell admin
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
    const cellMember = db.prepare('SELECT role FROM cell_members WHERE cellId = ? AND userId = ?').get(req.params.id, req.userId) as any;
    
    const isGlobalAdmin = user?.role === 'admin';
    const isCreator = cell.creatorId === req.userId;
    const isCellAdmin = cellMember?.role === 'admin';

    if (!isCreator && !isGlobalAdmin && !isCellAdmin) {
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour supprimer cette cellule' });
    }
    
    // Delete cell and its members
    db.prepare('DELETE FROM cell_members WHERE cellId = ?').run(req.params.id);
    db.prepare('DELETE FROM cells WHERE id = ?').run(req.params.id);
    // Also delete posts associated with the cell
    db.prepare('DELETE FROM posts WHERE cellId = ?').run(req.params.id);
    
    res.json({ success: true });
  });

  // 28. Get All Companies
  app.get('/api/companies', authenticate, (req: any, res) => {
    const companies = db.prepare(`
      SELECT c.*, 
      (SELECT COUNT(*) FROM favorite_companies WHERE companyId = c.id) as followers,
      (SELECT AVG(rating) FROM reviews WHERE targetType = 'company' AND targetId = c.id) as averageRating,
      (SELECT COUNT(*) FROM reviews WHERE targetType = 'company' AND targetId = c.id) as reviewCount
      FROM companies c
    `).all();
    res.json(companies);
  });

  // 28.1 Get New Companies
  app.get('/api/companies/new', authenticate, (req: any, res) => {
    const companies = db.prepare(`
      SELECT c.*, 
      (SELECT COUNT(*) FROM favorite_companies WHERE companyId = c.id) as followers,
      (SELECT AVG(rating) FROM reviews WHERE targetType = 'company' AND targetId = c.id) as averageRating,
      (SELECT COUNT(*) FROM reviews WHERE targetType = 'company' AND targetId = c.id) as reviewCount
      FROM companies c 
      ORDER BY c.id DESC LIMIT 10
    `).all();
    res.json(companies);
  });

  // Get Promotional Products
  app.get('/api/products/promotions', authenticate, (req: any, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as companyName, c.logoUrl as companyLogo,
      (SELECT 1 FROM favorite_products WHERE productId = p.id AND userId = ?) as isFavorite,
      (SELECT COUNT(*) FROM favorite_products WHERE productId = p.id) as favoritesCount,
      (SELECT AVG(rating) FROM reviews WHERE targetType = 'product' AND targetId = p.id) as averageRating,
      (SELECT COUNT(*) FROM reviews WHERE targetType = 'product' AND targetId = p.id) as reviewCount
      FROM company_catalog p
      JOIN companies c ON p.companyId = c.id
      WHERE p.tag = 'Promotion' OR p.tag = 'Offre flash'
      ORDER BY RANDOM()
    `).all(req.userId);
    res.json(products);
  });

  // Get Recent Products
  app.get('/api/products/recent', authenticate, (req: any, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as companyName, c.logoUrl as companyLogo,
      (SELECT 1 FROM favorite_products WHERE productId = p.id AND userId = ?) as isFavorite,
      (SELECT COUNT(*) FROM favorite_products WHERE productId = p.id) as favoritesCount,
      (SELECT AVG(rating) FROM reviews WHERE targetType = 'product' AND targetId = p.id) as averageRating,
      (SELECT COUNT(*) FROM reviews WHERE targetType = 'product' AND targetId = p.id) as reviewCount
      FROM company_catalog p
      JOIN companies c ON p.companyId = c.id
      ORDER BY p.id DESC LIMIT 12
    `).all(req.userId);
    res.json(products);
  });

  // Get Trending Companies (based on followers/favorites)
  app.get('/api/companies/trending', authenticate, (req: any, res) => {
    const companies = db.prepare(`
      SELECT c.*, 
      (SELECT COUNT(*) FROM favorite_companies WHERE companyId = c.id) as followers,
      (SELECT AVG(rating) FROM reviews WHERE targetType = 'company' AND targetId = c.id) as averageRating,
      (SELECT COUNT(*) FROM reviews WHERE targetType = 'company' AND targetId = c.id) as reviewCount
      FROM companies c 
      ORDER BY followers DESC LIMIT 10
    `).all();
    res.json(companies);
  });

  // 29. Create Company
  app.post('/api/companies', authenticate, (req: any, res) => {
    const { name, sector, description, address, whatsapp, facebook, twitter, linkedin, logoUrl, coverUrl, isShop, specialty, categories } = req.body;
    
    // Restriction: Manager cannot create own shop
    const isManager = db.prepare('SELECT 1 FROM companies WHERE managerId = ?').get(req.userId);
    if (isManager) {
      return res.status(403).json({ error: 'Un gestionnaire ne peut pas créer sa propre boutique tant qu\'il occupe ce poste.' });
    }

    const stmt = db.prepare('INSERT INTO companies (ownerId, name, sector, description, address, whatsapp, facebook, twitter, linkedin, logoUrl, coverUrl, isShop, specialty, categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(req.userId, name, sector, description, address, whatsapp, facebook, twitter, linkedin, logoUrl, coverUrl, isShop || 0, specialty, categories);
    res.json({ id: info.lastInsertRowid });
  });

  // 30. Update Company
  app.put('/api/companies/:id', authenticate, (req: any, res) => {
    const { name, sector, description, address, whatsapp, facebook, twitter, linkedin, logoUrl, coverUrl, isShop, specialty, categories } = req.body;
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Seul le propriétaire ou le gestionnaire peut modifier l\'entreprise' });
    }
    db.prepare('UPDATE companies SET name = ?, sector = ?, description = ?, address = ?, whatsapp = ?, facebook = ?, twitter = ?, linkedin = ?, logoUrl = ?, coverUrl = ?, isShop = ?, specialty = ?, categories = ? WHERE id = ?')
      .run(name, sector, description, address, whatsapp, facebook, twitter, linkedin, logoUrl, coverUrl, isShop || 0, specialty, categories, req.params.id);
    res.json({ success: true });
  });

  // 30.1 Update Company Manager
  app.put('/api/companies/:id/manager', authenticate, (req: any, res) => {
    const { managerId } = req.body;
    const company = db.prepare('SELECT ownerId, name, managerId as currentManagerId FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company) return res.status(404).json({ error: 'Entreprise non trouvée' });
    if (company.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Seul le propriétaire peut désigner un gestionnaire' });
    }

    // If revoking
    if (!managerId && company.currentManagerId) {
      const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
      const content = `${owner.name} a révoqué votre rôle de gestionnaire pour sa boutique "${company.name}".`;
      const notif = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(company.currentManagerId, 'manager_revoked', content, req.params.id);
      
      io.to(`user_${company.currentManagerId}`).emit('notification', {
        id: notif.lastInsertRowid,
        userId: company.currentManagerId,
        type: 'manager_revoked',
        content,
        relatedId: Number(req.params.id),
        read: 0,
        createdAt: new Date().toISOString()
      });
    }

    db.prepare('UPDATE companies SET managerId = ? WHERE id = ?').run(managerId || null, req.params.id);
    
    if (managerId) {
      const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
      const content = `${owner.name} vous a désigné comme gestionnaire pour sa boutique.`;
      const notif = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(managerId, 'company_manager', content, req.params.id);
      
      io.to(`user_${managerId}`).emit('notification', {
        id: notif.lastInsertRowid,
        userId: managerId,
        type: 'company_manager',
        content,
        relatedId: Number(req.params.id),
        read: 0,
        createdAt: new Date().toISOString()
      });
    }

    res.json({ success: true });
  });

  // 30.2 Resign as Company Manager
  app.post('/api/companies/:id/resign-manager', authenticate, (req: any, res) => {
    const companyId = req.params.id;
    const company = db.prepare('SELECT ownerId, name FROM companies WHERE id = ? AND managerId = ?').get(companyId, req.userId) as any;
    
    if (!company) {
      return res.status(403).json({ error: 'Vous n\'êtes pas le gestionnaire de cette boutique.' });
    }

    db.prepare('UPDATE companies SET managerId = NULL WHERE id = ?').run(companyId);

    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    const content = `${user.name} a renoncé à son rôle de gestionnaire pour votre boutique "${company.name}".`;
    const notif = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(company.ownerId, 'manager_resigned', content, companyId);
    
    io.to(`user_${company.ownerId}`).emit('notification', {
      id: notif.lastInsertRowid,
      userId: company.ownerId,
      type: 'manager_resigned',
      content,
      relatedId: Number(companyId),
      read: 0,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  });

  // 31. Delete Company
  app.delete('/api/companies/:id', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company || company.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Seul le propriétaire peut supprimer l\'entreprise' });
    }
    db.prepare('DELETE FROM company_catalog WHERE companyId = ?').run(req.params.id);
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // 32. Create Ad
  app.post('/api/ads', authenticate, (req: any, res) => {
    const { companyId, goal, content, targeting, budget, duration } = req.body;
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(companyId) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Seul le propriétaire ou le gestionnaire peut créer une publicité' });
    }
    const stmt = db.prepare('INSERT INTO ads (companyId, goal, content, targeting, budget, duration) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(companyId, goal, JSON.stringify(content), JSON.stringify(targeting), budget, duration);
    res.json({ id: info.lastInsertRowid });
  });

  // 33. Get Ads for Company
  app.get('/api/ads/:companyId', authenticate, (req: any, res) => {
    const ads = db.prepare('SELECT * FROM ads WHERE companyId = ? ORDER BY createdAt DESC').all(req.params.companyId) as any[];
    res.json(ads.map(ad => ({
      ...ad,
      content: JSON.parse(ad.content as string),
      targeting: JSON.parse(ad.targeting as string)
    })));
  });

  // Shop Orders & Insights
  app.get('/api/companies/:id/orders', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const orders = db.prepare(`
      SELECT o.*, u.name as customerName, u.whatsapp as customerWhatsapp, p.name as productName
      FROM shop_orders o
      JOIN users u ON o.customerId = u.id
      JOIN company_catalog p ON o.productId = p.id
      WHERE o.companyId = ?
      ORDER BY o.createdAt DESC
    `).all(req.params.id);
    res.json(orders);
  });

  app.post('/api/companies/:id/orders', authenticate, (req: any, res) => {
    const { productId, quantity, totalPrice } = req.body;
    const companyId = req.params.id;
    
    try {
      db.prepare('BEGIN TRANSACTION').run();
      
      // 1. Check stock
      const stock = db.prepare('SELECT * FROM stocks WHERE productId = ?').get(productId) as any;
      
      let newQuantity: number | undefined;
      
      // 2. Decrement stock
      if (stock) {
        newQuantity = stock.quantity - quantity;
        db.prepare('UPDATE stocks SET quantity = ?, lastUpdated = CURRENT_TIMESTAMP WHERE productId = ?').run(newQuantity, productId);
      }
      
      // Check for low stock alert
      if (stock && newQuantity !== undefined && newQuantity <= stock.minQuantity) {
        const product = db.prepare('SELECT name FROM company_catalog WHERE id = ?').get(productId) as any;
        const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(companyId) as any;
        const notificationContent = `Stock bas pour '${product.name}': il reste ${newQuantity} unités.`;
        const notifType = 'stock_alert';

        const owners = [company.ownerId, company.managerId].filter(id => id && id !== req.userId);
        owners.forEach(userId => {
            db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
                userId, notifType, notificationContent, productId
            );
            io.to(`user_${userId}`).emit('notification', {
                id: (db.prepare('SELECT last_insert_rowid() AS id').get() as any).id,
                userId: userId,
                type: notifType,
                content: notificationContent,
                relatedId: Number(productId),
                read: 0,
                createdAt: new Date().toISOString()
            });
        });
      }
      
      // 3. Create order
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
      const stmt = db.prepare('INSERT INTO shop_orders (companyId, customerId, productId, quantity, totalPrice, customerName, customerWhatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const info = stmt.run(companyId, req.userId, productId, quantity, totalPrice, user.name, user.whatsapp);
      
      db.prepare('COMMIT').run();

      const orderId = info.lastInsertRowid;
      const order = db.prepare(`
        SELECT o.*, u.name as customerName, u.whatsapp as customerWhatsapp, p.name as productName
        FROM shop_orders o
        JOIN users u ON o.customerId = u.id
        JOIN company_catalog p ON o.productId = p.id
        WHERE o.id = ?
      `).get(orderId);

      // Create notification for company owner and manager
      const company = db.prepare('SELECT ownerId, managerId, name FROM companies WHERE id = ?').get(companyId) as any;
      if (company) {
        const notificationContent = `Nouvelle commande pour ${company.name}: ${(order as any).productName} (x${quantity})`;
        
        // Notify Owner
        if (company.ownerId !== req.userId) {
          const notifOwner = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
            company.ownerId, 'shop_order', notificationContent, orderId
          );
          io.to(`user_${company.ownerId}`).emit('notification', {
            id: notifOwner.lastInsertRowid,
            userId: company.ownerId,
            type: 'shop_order',
            content: notificationContent,
            relatedId: Number(orderId),
            read: 0,
            createdAt: new Date().toISOString()
          });
        }

        // Notify Manager if exists
        if (company.managerId && company.managerId !== req.userId) {
          const notifManager = db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
            company.managerId, 'shop_order', notificationContent, orderId
          );
          io.to(`user_${company.managerId}`).emit('notification', {
            id: notifManager.lastInsertRowid,
            userId: company.managerId,
            type: 'shop_order',
            content: notificationContent,
            relatedId: Number(orderId),
            read: 0,
            createdAt: new Date().toISOString()
          });
        }
      }

      io.emit('new_shop_order', { companyId, order });
      res.json({ id: orderId });
    } catch (err) {
      db.prepare('ROLLBACK').run();
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la commande.' });
    }
  });

  app.put('/api/companies/:companyId/catalog/:productId', authenticate, (req: any, res) => {
    const { name, description, price, category, imageUrls, tag, tagValue } = req.body;
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.companyId) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    db.prepare('UPDATE company_catalog SET name = ?, description = ?, price = ?, category = ?, imageUrls = ?, tag = ?, tagValue = ? WHERE id = ? AND companyId = ?')
      .run(name, description, price, category, JSON.stringify(imageUrls), tag || null, tagValue || null, req.params.productId, req.params.companyId);
    res.json({ success: true });
  });

  app.put('/api/orders/:id/status', authenticate, (req: any, res) => {
    const { status } = req.body;
    const order = db.prepare('SELECT o.*, c.ownerId, c.managerId FROM shop_orders o JOIN companies c ON o.companyId = c.id WHERE o.id = ?').get(req.params.id) as any;
    if (!order || (order.ownerId !== req.userId && order.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    db.prepare('UPDATE shop_orders SET status = ? WHERE id = ?').run(status, req.params.id);
    io.emit('shop_order_status_updated', { orderId: req.params.id, status, companyId: order.companyId });
    res.json({ success: true });
  });

  app.get('/api/companies/:id/insights', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    const totalSales = db.prepare("SELECT SUM(totalPrice) as total FROM shop_orders WHERE companyId = ? AND status != 'cancelled'").get(req.params.id) as any;
    const ordersCount = db.prepare('SELECT COUNT(*) as count FROM shop_orders WHERE companyId = ?').get(req.params.id) as any;
    const customersCount = db.prepare('SELECT COUNT(DISTINCT customerId) as count FROM shop_orders WHERE companyId = ?').get(req.params.id) as any;
    
    const salesByDay = db.prepare(`
      SELECT date(createdAt) as date, SUM(totalPrice) as amount
      FROM shop_orders
      WHERE companyId = ? AND status != 'cancelled'
      GROUP BY date(createdAt)
      ORDER BY date ASC
      LIMIT 30
    `).all(req.params.id);

    const topProducts = db.prepare(`
      SELECT p.name, SUM(o.quantity) as totalQuantity, SUM(o.totalPrice) as totalRevenue
      FROM shop_orders o
      JOIN company_catalog p ON o.productId = p.id
      WHERE o.companyId = ? AND o.status != 'cancelled'
      GROUP BY p.id
      ORDER BY totalQuantity DESC
      LIMIT 5
    `).all(req.params.id);

    const peakSalesDay = db.prepare(`
      SELECT date(createdAt) as date, SUM(totalPrice) as amount
      FROM shop_orders
      WHERE companyId = ? AND status != 'cancelled'
      GROUP BY date(createdAt)
      ORDER BY amount DESC
      LIMIT 1
    `).get(req.params.id);

    res.json({
      totalSales: totalSales.total || 0,
      ordersCount: ordersCount.count || 0,
      customersCount: customersCount.count || 0,
      salesByDay,
      topProducts,
      peakSalesDay
    });
  });

  app.get('/api/companies/:id/catalog', authenticate, (req: any, res) => {
    const catalog = db.prepare(`
      SELECT p.*, 
      (SELECT 1 FROM favorite_products WHERE productId = p.id AND userId = ?) as isFavorite,
      (SELECT COUNT(*) FROM favorite_products WHERE productId = p.id) as favoritesCount,
      (SELECT AVG(rating) FROM reviews WHERE targetType = 'product' AND targetId = p.id) as averageRating,
      (SELECT COUNT(*) FROM reviews WHERE targetType = 'product' AND targetId = p.id) as reviewCount,
      (SELECT quantity FROM stocks WHERE productId = p.id) as quantity
      FROM company_catalog p WHERE companyId = ?
    `).all(req.userId, req.params.id);
    res.json(catalog);
  });

  app.post('/api/companies/:id/catalog', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { name, description, price, category, imageUrls, tag, tagValue } = req.body;
    const result = db.prepare('INSERT INTO company_catalog (companyId, name, description, price, category, imageUrls, tag, tagValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, name, description, price, category, JSON.stringify(imageUrls), tag || null, tagValue || null);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete('/api/companies/:id/catalog/:productId', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.id) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    db.prepare('DELETE FROM company_catalog WHERE id = ? AND companyId = ?').run(req.params.productId, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/companies/:id/stock', authenticate, (req: any, res) => {
    const stock = db.prepare(`
      SELECT s.*, c.name as productName 
      FROM stocks s 
      JOIN company_catalog c ON s.productId = c.id
      WHERE c.companyId = ?
    `).all(req.params.id);
    res.json(stock);
  });
  
  app.get('/api/credit-institutions', authenticate, (req: any, res) => {
    const institutions = db.prepare('SELECT * FROM credit_institutions ORDER BY name ASC').all();
    res.json(institutions);
  });

  app.post('/api/credit-institutions', authenticate, (req: any, res) => {
    const { name, type, description, terms, eligibility, targets, processingTime, logoUrl, coverUrl, address, city, country, isConfirmed } = req.body;
    
    if (!isConfirmed) {
      return res.status(403).json({ error: "Confirmation réglementaire requise." });
    }

    const result = db.prepare(`
      INSERT INTO credit_institutions (creatorId, name, type, description, terms, eligibility, targets, processingTime, logoUrl, coverUrl, address, city, country, isHabilitated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(req.userId, name, type, description, terms, eligibility, targets, processingTime, logoUrl, coverUrl, address, city, country);

    res.json({ id: result.lastInsertRowid, success: true });
  });

  app.get('/api/credit-institutions/my', authenticate, (req: any, res) => {
    const institutions = db.prepare('SELECT * FROM credit_institutions WHERE creatorId = ?').all(req.userId);
    res.json(institutions);
  });

  app.put('/api/credit-institutions/:id', authenticate, (req: any, res) => {
    const { name, type, description, terms, eligibility, targets, processingTime, logoUrl, coverUrl, address, city, country } = req.body;
    
    const institution = db.prepare('SELECT creatorId FROM credit_institutions WHERE id = ?').get(req.params.id) as any;
    if (!institution || institution.creatorId !== req.userId) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    db.prepare(`
      UPDATE credit_institutions 
      SET name = ?, type = ?, description = ?, terms = ?, eligibility = ?, targets = ?, processingTime = ?, logoUrl = ?, coverUrl = ?, address = ?, city = ?, country = ?
      WHERE id = ?
    `).run(name, type, description, terms, eligibility, targets, processingTime, logoUrl, coverUrl, address, city, country, req.params.id);

    res.json({ success: true });
  });

  app.get('/api/credit-institutions/:id/requests', authenticate, (req: any, res) => {
    const institution = db.prepare('SELECT creatorId FROM credit_institutions WHERE id = ?').get(req.params.id) as any;
    if (!institution || institution.creatorId !== req.userId) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const requests = db.prepare(`
      SELECT fr.*, u.name as userName, c.name as companyName 
      FROM funding_requests fr
      JOIN users u ON fr.userId = u.id
      JOIN companies c ON fr.companyId = c.id
      WHERE fr.institutionId = ?
      ORDER BY fr.createdAt DESC
    `).all(req.params.id);

    res.json(requests);
  });

  app.post('/api/companies/:id/funding-request', authenticate, (req: any, res) => {
    const { fundingType, amount, reason, institutionId, strategicData } = req.body;
    const companyId = req.params.id;
    const userId = req.userId;

    const result = db.prepare(`
      INSERT INTO funding_requests (userId, companyId, institutionId, fundingType, amount, reason, strategicData)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, companyId, institutionId, fundingType, amount, reason, JSON.stringify(strategicData));

    res.json({ id: result.lastInsertRowid, success: true });
  });

  app.put('/api/funding-requests/:id/status', authenticate, (req: any, res) => {
    const { status } = req.body;
    
    // Check if user owns the institution specified in the request
    const request = db.prepare(`
      SELECT ci.creatorId 
      FROM funding_requests fr
      JOIN credit_institutions ci ON fr.institutionId = ci.id
      WHERE fr.id = ?
    `).get(req.params.id) as any;

    if (!request || request.creatorId !== req.userId) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    db.prepare('UPDATE funding_requests SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/funding-requests/my', authenticate, (req: any, res) => {
     const requests = db.prepare(`
      SELECT fr.*, ci.name as institutionName, ci.type as institutionType
      FROM funding_requests fr
      LEFT JOIN credit_institutions ci ON fr.institutionId = ci.id
      WHERE fr.userId = ?
      ORDER BY fr.createdAt DESC
    `).all(req.userId);
    res.json(requests);
  });

  app.get('/api/companies/:companyId/stock-movements/:productId', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.companyId) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const movements = db.prepare('SELECT * FROM stock_movements WHERE productId = ? ORDER BY createdAt DESC').all(req.params.productId);
    res.json(movements);
  });
  
  app.put('/api/companies/:companyId/stock/:productId', authenticate, (req: any, res) => {
    const company = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(req.params.companyId) as any;
    if (!company || (company.ownerId !== req.userId && company.managerId !== req.userId)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const { quantity, minQuantity, reason, costPrice } = req.body;
    
    try {
      db.prepare('BEGIN TRANSACTION').run();
      
      const currentStock = db.prepare('SELECT quantity FROM stocks WHERE productId = ?').get(req.params.productId) as any;
      const oldQuantity = currentStock ? currentStock.quantity : 0;
      const diff = quantity - oldQuantity;

      db.prepare(`
        INSERT INTO stocks (productId, quantity, minQuantity, costPrice)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(productId) DO UPDATE SET
          quantity = excluded.quantity,
          minQuantity = excluded.minQuantity,
          costPrice = excluded.costPrice,
          lastUpdated = CURRENT_TIMESTAMP
      `).run(req.params.productId, quantity, minQuantity || 5, costPrice || 0);
      
      if (diff !== 0) {
          db.prepare('INSERT INTO stock_movements (productId, quantity, type, reason) VALUES (?, ?, ?, ?)').run(
              req.params.productId,
              Math.abs(diff),
              diff > 0 ? 'purchase' : 'adjustment',
              reason || 'Manual adjustment'
          );
      }
      
      // Check for low stock alert
      if (quantity <= (minQuantity || 5)) {
        const product = db.prepare('SELECT name, companyId FROM company_catalog WHERE id = ?').get(req.params.productId) as any;
        const companyData = db.prepare('SELECT ownerId, managerId FROM companies WHERE id = ?').get(product.companyId) as any;
        
        const notificationContent = `Stock bas pour '${product.name}': il reste ${quantity} unités.`;
        const notifType = 'stock_alert';

        const owners = [companyData.ownerId, companyData.managerId].filter(id => id && id !== req.userId);
        owners.forEach(userId => {
            db.prepare('INSERT INTO notifications (userId, type, content, relatedId) VALUES (?, ?, ?, ?)').run(
                userId, notifType, notificationContent, req.params.productId
            );
            io.to(`user_${userId}`).emit('notification', {
                id: (db.prepare('SELECT last_insert_rowid() AS id').get() as any).id,
                userId: userId,
                type: notifType,
                content: notificationContent,
                relatedId: Number(req.params.productId),
                read: 0,
                createdAt: new Date().toISOString()
            });
        });
      }
      
      db.prepare('COMMIT').run();
      res.json({ success: true });
    } catch (err) {
      db.prepare('ROLLBACK').run();
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du stock.' });
    }
  });

  // 27. Churches API
  app.get('/api/churches', authenticate, (req, res) => {
    const churches = db.prepare('SELECT * FROM churches ORDER BY name ASC').all();
    res.json(churches);
  });

  app.post('/api/churches', authenticate, (req: any, res) => {
    const { name, pastor, hq, description, programs, coverUrl } = req.body;
    const result = db.prepare('INSERT INTO churches (name, pastor, hq, description, programs, coverUrl, creatorId) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      name, pastor, hq, description, programs, coverUrl, req.userId
    );
    res.json({ id: result.lastInsertRowid });
  });

  app.put('/api/churches/:id', authenticate, (req: any, res) => {
    const { name, pastor, hq, description, programs, coverUrl } = req.body;
    const church = db.prepare('SELECT * FROM churches WHERE id = ?').get(req.params.id) as any;
    if (!church || church.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    db.prepare('UPDATE churches SET name = ?, pastor = ?, hq = ?, description = ?, programs = ?, coverUrl = ? WHERE id = ?').run(
      name, pastor, hq, description, programs, coverUrl, req.params.id
    );
    res.json({ success: true });
  });

  app.delete('/api/churches/:id', authenticate, (req: any, res) => {
    const church = db.prepare('SELECT * FROM churches WHERE id = ?').get(req.params.id) as any;
    if (!church || church.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    db.prepare('DELETE FROM churches WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/users/me/claim-church', authenticate, (req: any, res) => {
    const { churchName } = req.body;
    db.prepare('UPDATE users SET church = ? WHERE id = ?').run(churchName, req.userId);
    res.json({ success: true });
  });

  // --- Review Routes ---
  app.get('/api/reviews/:targetType/:targetId', authenticate, (req: any, res) => {
    const { targetType, targetId } = req.params;
    const reviews = db.prepare(`
      SELECT r.*, u.name as userName, u.avatarUrl as userAvatar
      FROM reviews r
      JOIN users u ON r.userId = u.id
      WHERE r.targetType = ? AND r.targetId = ?
      ORDER BY r.createdAt DESC
    `).all(targetType, targetId);
    
    const stats = db.prepare(`
      SELECT AVG(rating) as averageRating, COUNT(*) as reviewCount
      FROM reviews
      WHERE targetType = ? AND targetId = ?
    `).get(targetType, targetId) as any;
    
    res.json({
      reviews,
      stats: {
        averageRating: stats.averageRating || 0,
        reviewCount: stats.reviewCount || 0
      }
    });
  });

  app.post('/api/reviews', authenticate, (req: any, res) => {
    const { targetType, targetId, rating, comment } = req.body;
    
    if (!targetType || !targetId || !rating) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'La note doit être entre 1 et 5' });
    }

    // Check if user already reviewed
    const existing = db.prepare('SELECT id FROM reviews WHERE userId = ? AND targetType = ? AND targetId = ?').get(req.userId, targetType, targetId);
    if (existing) {
      db.prepare('UPDATE reviews SET rating = ?, comment = ?, createdAt = CURRENT_TIMESTAMP WHERE id = ?')
        .run(rating, comment, (existing as any).id);
      return res.json({ success: true, updated: true });
    }

    const stmt = db.prepare('INSERT INTO reviews (userId, targetType, targetId, rating, comment) VALUES (?, ?, ?, ?, ?)');
    stmt.run(req.userId, targetType, targetId, rating, comment);
    res.json({ success: true });
  });

  // Catch-all for API 404s
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // FRONTEND (PRODUCTION CLEAN)
import * as path from 'path';

const buildPath = path.join(process.cwd(), 'dist');

app.use(express.static(buildPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found' });
  }

  res.sendFile(path.join(buildPath, 'index.html'));
});


  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();