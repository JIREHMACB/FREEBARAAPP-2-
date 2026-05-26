import { pool } from '../config/db.js';

export async function initDB() {
  // ── Tables utilisateurs & auth ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                      SERIAL PRIMARY KEY,
      email                   TEXT UNIQUE NOT NULL,
      name                    TEXT,
      profession              TEXT,
      bio                     TEXT,
      company                 TEXT,
      "avatarUrl"             TEXT,
      "coverUrl"              TEXT,
      phone                   TEXT,
      location                TEXT,
      website                 TEXT,
      church                  TEXT,
      groups                  TEXT,
      interests               TEXT,
      skills                  TEXT,
      marketing               TEXT,
      goals                   TEXT,
      badge                   TEXT DEFAULT 'Invité',
      "referralCode"          TEXT UNIQUE,
      "referredBy"            INTEGER,
      balance                 NUMERIC(10,2) DEFAULT 0,
      role                    TEXT DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
      status                  TEXT DEFAULT 'active' CHECK (status IN ('active','banned','inactive')),
      "bannedReason"          TEXT,
      "notificationPreferences" JSONB DEFAULT '{}',
      visibility              TEXT DEFAULT 'public',
      country                 TEXT,
      "createdAt"             TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS otps (
      email       TEXT PRIMARY KEY,
      code        TEXT NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL
    );
  `);

  // ── Tables réseau & social ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      "followerId"  INTEGER NOT NULL,
      "followingId" INTEGER NOT NULL,
      PRIMARY KEY ("followerId","followingId")
    );
    CREATE TABLE IF NOT EXISTS connection_requests (
      id           SERIAL PRIMARY KEY,
      "senderId"   INTEGER NOT NULL,
      "receiverId" INTEGER NOT NULL,
      status       TEXT DEFAULT 'pending',
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      "userId"    INTEGER NOT NULL,
      type        TEXT NOT NULL,
      content     TEXT NOT NULL,
      "relatedId" INTEGER,
      read        BOOLEAN DEFAULT FALSE,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS certifications (
      id              SERIAL PRIMARY KEY,
      "userId"        INTEGER NOT NULL,
      name            TEXT NOT NULL,
      organization    TEXT NOT NULL,
      "dateObtained"  TEXT NOT NULL,
      "createdAt"     TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables posts & interactions ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id          SERIAL PRIMARY KEY,
      "authorId"  INTEGER NOT NULL,
      "cellId"    INTEGER,
      content     TEXT NOT NULL,
      category    TEXT DEFAULT 'Tous',
      "mediaUrls" JSONB,
      views       INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      "postId"    INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      type        TEXT DEFAULT 'like',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("postId","userId")
    );
    CREATE TABLE IF NOT EXISTS post_comments (
      id          SERIAL PRIMARY KEY,
      "postId"    INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_boosts (
      "postId"    INTEGER PRIMARY KEY,
      "userId"    INTEGER NOT NULL,
      amount      NUMERIC(10,2) NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stories (
      id          SERIAL PRIMARY KEY,
      "userId"    INTEGER NOT NULL,
      "mediaUrl"  TEXT NOT NULL,
      "mediaType" TEXT DEFAULT 'image',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "expiresAt" TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS story_views (
      "storyId"  INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      "viewedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("storyId","userId")
    );
    CREATE TABLE IF NOT EXISTS story_reactions (
      id          SERIAL PRIMARY KEY,
      "storyId"   INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      emoji       TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables événements ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id              SERIAL PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      "imageUrl"      TEXT,
      country         TEXT NOT NULL,
      city            TEXT NOT NULL,
      location        TEXT NOT NULL,
      latitude        REAL,
      longitude       REAL,
      "startDate"     TIMESTAMP NOT NULL,
      "endDate"       TIMESTAMP NOT NULL,
      category        TEXT NOT NULL,
      "communityId"   INTEGER,
      "creatorId"     INTEGER NOT NULL,
      price           NUMERIC(10,2) DEFAULT 0,
      "visualUrl"     TEXT,
      "shares_count"  INTEGER DEFAULT 0,
      "createdAt"     TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS event_participants (
      "eventId"   INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      PRIMARY KEY ("eventId","userId")
    );
    CREATE TABLE IF NOT EXISTS event_likes (
      "eventId"   INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("eventId","userId")
    );
    CREATE TABLE IF NOT EXISTS event_comments (
      id          SERIAL PRIMARY KEY,
      "eventId"   INTEGER,
      "userId"    INTEGER,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS favorite_events (
      "userId"    INTEGER NOT NULL,
      "eventId"   INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("userId","eventId")
    );
  `);

  // ── Tables business & entreprises ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id           SERIAL PRIMARY KEY,
      "ownerId"    INTEGER NOT NULL,
      name         TEXT NOT NULL,
      sector       TEXT,
      description  TEXT,
      address      TEXT,
      whatsapp     TEXT,
      facebook     TEXT,
      twitter      TEXT,
      linkedin     TEXT,
      "logoUrl"    TEXT,
      "coverUrl"   TEXT,
      "isShop"     BOOLEAN DEFAULT FALSE,
      specialty    TEXT,
      categories   TEXT,
      country      TEXT,
      city         TEXT,
      latitude     REAL,
      longitude    REAL,
      "managerId"  INTEGER,
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS company_catalog (
      id             SERIAL PRIMARY KEY,
      "companyId"    INTEGER NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT,
      price          NUMERIC(10,2),
      "imageUrl"     TEXT,
      category       TEXT,
      tag            TEXT,
      "tagValue"     TEXT,
      "shares_count" INTEGER DEFAULT 0,
      "createdAt"    TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stocks (
      "productId"   INTEGER PRIMARY KEY,
      quantity      INTEGER DEFAULT 0,
      "minQuantity" INTEGER DEFAULT 5,
      "costPrice"   NUMERIC(10,2) DEFAULT 0,
      "lastUpdated" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id          SERIAL PRIMARY KEY,
      "productId" INTEGER NOT NULL,
      quantity    INTEGER NOT NULL,
      type        TEXT NOT NULL,
      reason      TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS shop_orders (
      id                 SERIAL PRIMARY KEY,
      "companyId"        INTEGER NOT NULL,
      "customerId"       INTEGER NOT NULL,
      "productId"        INTEGER NOT NULL,
      quantity           INTEGER DEFAULT 1,
      "totalPrice"       NUMERIC(10,2) NOT NULL,
      status             TEXT DEFAULT 'pending',
      "customerName"     TEXT,
      "customerWhatsapp" TEXT,
      "createdAt"        TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS favorite_companies (
      "userId"    INTEGER NOT NULL,
      "companyId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("userId","companyId")
    );
    CREATE TABLE IF NOT EXISTS favorite_products (
      "userId"    INTEGER NOT NULL,
      "productId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("userId","productId")
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      "userId"    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        DATE NOT NULL,
      description TEXT NOT NULL,
      category    TEXT NOT NULL,
      amount      NUMERIC(10,2) NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('income','expense')),
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS funding_requests (
      id             SERIAL PRIMARY KEY,
      "userId"       INTEGER NOT NULL,
      "companyId"    INTEGER NOT NULL,
      "institutionId" INTEGER,
      "fundingType"  TEXT NOT NULL,
      amount         NUMERIC(10,2),
      reason         TEXT,
      "strategicData" JSONB,
      status         TEXT DEFAULT 'En attente',
      "createdAt"    TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS credit_institutions (
      id               SERIAL PRIMARY KEY,
      "creatorId"      INTEGER NOT NULL,
      name             TEXT NOT NULL,
      type             TEXT NOT NULL,
      description      TEXT,
      terms            TEXT,
      eligibility      TEXT,
      targets          TEXT,
      "processingTime" TEXT,
      "logoUrl"        TEXT,
      "coverUrl"       TEXT,
      address          TEXT,
      city             TEXT,
      country          TEXT,
      "isHabilitated"  INTEGER DEFAULT 0,
      "createdAt"      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ads (
      id          SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      goal        TEXT NOT NULL,
      content     TEXT NOT NULL,
      targeting   TEXT NOT NULL,
      budget      NUMERIC(10,2) NOT NULL,
      duration    INTEGER NOT NULL,
      status      TEXT DEFAULT 'pending',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id           SERIAL PRIMARY KEY,
      "userId"     INTEGER NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId"   INTEGER NOT NULL,
      rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment      TEXT,
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables messages & chat ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      "senderId"   INTEGER NOT NULL,
      "receiverId" INTEGER,
      "roomId"     INTEGER,
      content      TEXT NOT NULL,
      "fileUrl"    TEXT,
      "fileType"   TEXT,
      "fileName"   TEXT,
      read         BOOLEAN DEFAULT FALSE,
      "isPinned"   BOOLEAN DEFAULT FALSE,
      "replyToId"  INTEGER,
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_reactions (
      id          SERIAL PRIMARY KEY,
      "messageId" INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      emoji       TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      UNIQUE("messageId","userId")
    );
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id          SERIAL PRIMARY KEY,
      name        TEXT,
      type        TEXT DEFAULT 'direct',
      "avatarUrl" TEXT,
      "creatorId" INTEGER,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_room_members (
      "roomId"   INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      "joinedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("roomId","userId")
    );
  `);

  // ── Tables communautés & cellules ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cells (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      "sponsorId" INTEGER,
      "creatorId" INTEGER NOT NULL,
      "coverUrl"  TEXT,
      latitude    REAL,
      longitude   REAL,
      city        TEXT,
      country     TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cell_members (
      "cellId"   INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      role       TEXT DEFAULT 'member',
      "joinedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("cellId","userId")
    );
    CREATE TABLE IF NOT EXISTS communities (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS community_members (
      "communityId" INTEGER NOT NULL,
      "userId"      INTEGER NOT NULL,
      role          TEXT DEFAULT 'member',
      PRIMARY KEY ("communityId","userId")
    );
    CREATE TABLE IF NOT EXISTS churches (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      pastor      TEXT,
      hq          TEXT,
      description TEXT,
      programs    TEXT,
      "coverUrl"  TEXT,
      latitude    REAL,
      longitude   REAL,
      city        TEXT,
      country     TEXT,
      "creatorId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables formation (Pannels) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pannels (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      theme       TEXT,
      "ownerId"   INTEGER NOT NULL,
      "avatarUrl" TEXT,
      "logoUrl"   TEXT,
      "coverUrl"  TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_members (
      "pannelId" INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      role       TEXT DEFAULT 'member',
      "joinedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("pannelId","userId")
    );
    CREATE TABLE IF NOT EXISTS pannel_courses (
      id          SERIAL PRIMARY KEY,
      "pannelId"  INTEGER NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      duration    TEXT,
      "fileUrl"   TEXT NOT NULL,
      "fileType"  TEXT NOT NULL,
      views       INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_progress (
      "pannelId"    INTEGER NOT NULL,
      "userId"      INTEGER NOT NULL,
      "courseId"    INTEGER NOT NULL,
      status        TEXT DEFAULT 'non_commence',
      position      REAL DEFAULT 0,
      notes         TEXT,
      "stickyNotes" JSONB,
      "updatedAt"   TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("pannelId","userId","courseId")
    );
    CREATE TABLE IF NOT EXISTS pannel_evaluations (
      id            SERIAL PRIMARY KEY,
      "pannelId"    INTEGER NOT NULL,
      "userId"      INTEGER NOT NULL,
      "courseTitle" TEXT,
      grade         INTEGER,
      feedback      TEXT,
      "createdAt"   TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_badges (
      id          SERIAL PRIMARY KEY,
      "pannelId"  INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      "badgeType" TEXT NOT NULL,
      "unlockedAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_forum (
      id          SERIAL PRIMARY KEY,
      "pannelId"  INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_course_comments (
      id          SERIAL PRIMARY KEY,
      "courseId"  INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables tâches ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id               SERIAL PRIMARY KEY,
      "userId"         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      description      TEXT,
      "dueDate"        DATE,
      "reminderTime"   TEXT,
      status           TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
      priority         TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
      category         TEXT DEFAULT 'Général',
      "assignedUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
      "isArchived"     BOOLEAN DEFAULT FALSE,
      "createdAt"      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS task_subtasks (
      id          SERIAL PRIMARY KEY,
      "taskId"    INTEGER NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT DEFAULT 'todo',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS task_dependencies (
      "taskId"          INTEGER NOT NULL,
      "dependsOnTaskId" INTEGER NOT NULL,
      PRIMARY KEY ("taskId","dependsOnTaskId")
    );
  `);

  // ── Tables admin & sécurité ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id           SERIAL PRIMARY KEY,
      "reporterId" INTEGER NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId"   INTEGER NOT NULL,
      reason       TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_logs (
      id          SERIAL PRIMARY KEY,
      "adminId"   INTEGER NOT NULL,
      action      TEXT NOT NULL,
      "targetId"  INTEGER,
      details     TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS db_logs (
      id          SERIAL PRIMARY KEY,
      level       TEXT NOT NULL,
      action      TEXT NOT NULL,
      "userId"    INTEGER,
      ip          TEXT,
      details     TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);
  // ── Table services (complète) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id               SERIAL PRIMARY KEY,
      "providerId"     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      description      TEXT,
      availability     TEXT,
      budget           NUMERIC(10,2) DEFAULT 0,
      type             TEXT DEFAULT 'projet',
      "companyName"    TEXT,
      location         TEXT,
      "contractType"   TEXT,
      "fileUrl"        TEXT,
      category         TEXT,
      "createdAt"      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_applications (
      id               SERIAL PRIMARY KEY,
      "serviceId"      INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      "userId"         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message          TEXT,
      "contactDetails" JSONB,
      status           TEXT DEFAULT 'pending',
      "createdAt"      TIMESTAMP DEFAULT NOW(),
      UNIQUE("serviceId","userId")
    );
  `);

  // ── Index de performance ──
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_author        ON posts("authorId");
      CREATE INDEX IF NOT EXISTS idx_posts_created       ON posts("createdAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_category      ON posts(category);
      CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages("senderId");
      CREATE INDEX IF NOT EXISTS idx_messages_receiver   ON messages("receiverId");
      CREATE INDEX IF NOT EXISTS idx_messages_room       ON messages("roomId");
      CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications("userId");
      CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications("userId", read) WHERE read = FALSE;
      CREATE INDEX IF NOT EXISTS idx_follows_follower    ON follows("followerId");
      CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows("followingId");
      CREATE INDEX IF NOT EXISTS idx_tasks_user          ON tasks("userId");
      CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks("userId", status);
      CREATE INDEX IF NOT EXISTS idx_services_provider   ON services("providerId");
      CREATE INDEX IF NOT EXISTS idx_services_category   ON services(category);
      CREATE INDEX IF NOT EXISTS idx_service_apps_service ON service_applications("serviceId");
      CREATE INDEX IF NOT EXISTS idx_service_apps_user    ON service_applications("userId");
      CREATE INDEX IF NOT EXISTS idx_companies_owner     ON companies("ownerId");
      CREATE INDEX IF NOT EXISTS idx_catalog_company     ON company_catalog("companyId");
      CREATE INDEX IF NOT EXISTS idx_catalog_category    ON company_catalog(category);
      CREATE INDEX IF NOT EXISTS idx_events_creator      ON events("creatorId");
      CREATE INDEX IF NOT EXISTS idx_events_start        ON events("startDate");
      CREATE INDEX IF NOT EXISTS idx_pannel_members_user ON pannel_members("userId");
      CREATE INDEX IF NOT EXISTS idx_pannel_courses_panel ON pannel_courses("pannelId");
      CREATE INDEX IF NOT EXISTS idx_pannel_progress_user ON pannel_progress("userId");
      CREATE INDEX IF NOT EXISTS idx_cell_members_user   ON cell_members("userId");
      CREATE INDEX IF NOT EXISTS idx_stories_user        ON stories("userId");
      CREATE INDEX IF NOT EXISTS idx_stories_expires     ON stories("expiresAt");
      CREATE INDEX IF NOT EXISTS idx_post_likes_post     ON post_likes("postId");
      CREATE INDEX IF NOT EXISTS idx_post_comments_post  ON post_comments("postId");
    `);
    console.log('✅ Index créés');
  } catch (e: any) {
    console.warn('⚠️  Certains index non créés (migration requise?):', e.message);
  }

  console.log('✅ Toutes les tables PostgreSQL sont prêtes');
}