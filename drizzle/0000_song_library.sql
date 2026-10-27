CREATE TABLE songs (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL,
 title TEXT NOT NULL,
 creator TEXT NOT NULL,
 difficulty TEXT NOT NULL,
 duration REAL NOT NULL,
 note_count INTEGER NOT NULL,
 chart_json TEXT NOT NULL,
 audio_key TEXT NOT NULL,
 audio_type TEXT NOT NULL,
 background_key TEXT,
 background_type TEXT,
 shared INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE INDEX songs_owner_created ON songs (owner_id, created_at);
CREATE INDEX songs_shared_created ON songs (shared, created_at);
