CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  package_name TEXT,
  used_gb REAL,
  vas_used_gb REAL,
  raw_json TEXT NOT NULL
);

