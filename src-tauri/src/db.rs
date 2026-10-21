//! SQLite storage: folders, items and settings.
//!
//! Item passwords are stored DPAPI-encrypted in `secret_enc` and are never sent
//! to the UI as part of an item; the UI only sees `has_secret`.

use std::collections::HashMap;
use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::dpapi;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    parent_id   TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    folder_id     TEXT,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL DEFAULT '',
    language      TEXT,
    notes         TEXT NOT NULL DEFAULT '',
    ssh_host      TEXT,
    ssh_user      TEXT,
    ssh_port      INTEGER,
    ssh_key_path  TEXT,
    secret_enc    BLOB,
    tags          TEXT NOT NULL DEFAULT '[]',
    favorite      INTEGER NOT NULL DEFAULT 0,
    use_count     INTEGER NOT NULL DEFAULT 0,
    last_used_at  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    init(&conn)?;
    Ok(conn)
}

pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;")?;
    conn.execute_batch(SCHEMA)
}

// ---------- types ----------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// An item as the UI sees it (no secret, only a flag).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub kind: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: String,
    pub language: Option<String>,
    pub notes: String,
    pub ssh_host: Option<String>,
    pub ssh_user: Option<String>,
    pub ssh_port: Option<i64>,
    pub ssh_key_path: Option<String>,
    pub has_secret: bool,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub use_count: i64,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Payload for create/update. `secret`: None = keep as is, Some("") = clear, Some(x) = set.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemInput {
    pub id: Option<String>,
    pub kind: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: String,
    pub language: Option<String>,
    pub notes: String,
    pub ssh_host: Option<String>,
    pub ssh_user: Option<String>,
    pub ssh_port: Option<i64>,
    pub ssh_key_path: Option<String>,
    pub secret: Option<String>,
    pub tags: Vec<String>,
    pub favorite: bool,
}

/// An item with its secret in plain text, used only inside export files.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortableItem {
    #[serde(flatten)]
    pub item: Item,
    pub secret: Option<String>,
}

// ---------- folders ----------

fn row_folder(r: &Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: r.get(0)?,
        name: r.get(1)?,
        parent_id: r.get(2)?,
        sort_order: r.get(3)?,
        created_at: r.get(4)?,
        updated_at: r.get(5)?,
    })
}

pub fn list_folders(conn: &Connection) -> rusqlite::Result<Vec<Folder>> {
    let mut st = conn.prepare(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders ORDER BY sort_order, name COLLATE NOCASE",
    )?;
    let rows = st.query_map([], row_folder)?;
    rows.collect()
}

pub fn save_folder(
    conn: &Connection,
    id: Option<String>,
    name: &str,
    parent_id: Option<String>,
) -> rusqlite::Result<Folder> {
    let ts = now();
    let id = match id {
        Some(id) => {
            conn.execute(
                "UPDATE folders SET name = ?2, parent_id = ?3, updated_at = ?4 WHERE id = ?1",
                params![id, name, parent_id, ts],
            )?;
            id
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?4)",
                params![id, name, parent_id, ts],
            )?;
            id
        }
    };
    conn.query_row(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders WHERE id = ?1",
        [&id],
        row_folder,
    )
}

/// Deletes a folder; its items and sub-folders move up to the folder's parent.
pub fn delete_folder(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    let parent: Option<String> = conn
        .query_row("SELECT parent_id FROM folders WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .flatten();
    let ts = now();
    conn.execute(
        "UPDATE items SET folder_id = ?2, updated_at = ?3 WHERE folder_id = ?1",
        params![id, parent, ts],
    )?;
    conn.execute(
        "UPDATE folders SET parent_id = ?2, updated_at = ?3 WHERE parent_id = ?1",
        params![id, parent, ts],
    )?;
    conn.execute("DELETE FROM folders WHERE id = ?1", [id])?;
    Ok(())
}

// ---------- items ----------

const ITEM_COLS: &str = "id, kind, folder_id, title, content, language, notes, ssh_host, ssh_user, ssh_port, ssh_key_path, secret_enc IS NOT NULL, tags, favorite, use_count, last_used_at, created_at, updated_at";

fn row_item(r: &Row) -> rusqlite::Result<Item> {
    let tags: String = r.get(12)?;
    Ok(Item {
        id: r.get(0)?,
        kind: r.get(1)?,
        folder_id: r.get(2)?,
        title: r.get(3)?,
        content: r.get(4)?,
        language: r.get(5)?,
        notes: r.get(6)?,
        ssh_host: r.get(7)?,
        ssh_user: r.get(8)?,
        ssh_port: r.get(9)?,
        ssh_key_path: r.get(10)?,
        has_secret: r.get(11)?,
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        favorite: r.get(13)?,
        use_count: r.get(14)?,
        last_used_at: r.get(15)?,
        created_at: r.get(16)?,
        updated_at: r.get(17)?,
    })
}

pub fn list_items(conn: &Connection) -> rusqlite::Result<Vec<Item>> {
    let mut st = conn.prepare(&format!(
        "SELECT {ITEM_COLS} FROM items ORDER BY title COLLATE NOCASE"
    ))?;
    let rows = st.query_map([], row_item)?;
    rows.collect()
}

pub fn get_item(conn: &Connection, id: &str) -> rusqlite::Result<Option<Item>> {
    conn.query_row(
        &format!("SELECT {ITEM_COLS} FROM items WHERE id = ?1"),
        [id],
        row_item,
    )
    .optional()
}

pub fn save_item(conn: &Connection, input: ItemInput) -> Result<Item, String> {
    let ts = now();
    let tags = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;
    let id = input.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let exists = get_item(conn, &id).map_err(|e| e.to_string())?.is_some();

    if exists {
        conn.execute(
            "UPDATE items SET kind = ?2, folder_id = ?3, title = ?4, content = ?5, language = ?6, notes = ?7,
                ssh_host = ?8, ssh_user = ?9, ssh_port = ?10, ssh_key_path = ?11, tags = ?12, favorite = ?13,
                updated_at = ?14 WHERE id = ?1",
            params![
                id, input.kind, input.folder_id, input.title, input.content, input.language, input.notes,
                input.ssh_host, input.ssh_user, input.ssh_port, input.ssh_key_path, tags, input.favorite, ts
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO items (id, kind, folder_id, title, content, language, notes, ssh_host, ssh_user, ssh_port,
                ssh_key_path, tags, favorite, use_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0, ?14, ?14)",
            params![
                id, input.kind, input.folder_id, input.title, input.content, input.language, input.notes,
                input.ssh_host, input.ssh_user, input.ssh_port, input.ssh_key_path, tags, input.favorite, ts
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(secret) = input.secret {
        set_secret(conn, &id, &secret)?;
    }
    get_item(conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "item vanished after save".into())
}

pub fn set_secret(conn: &Connection, id: &str, secret: &str) -> Result<(), String> {
    let enc = if secret.is_empty() {
        None
    } else {
        Some(dpapi::protect(secret.as_bytes())?)
    };
    conn.execute("UPDATE items SET secret_enc = ?2 WHERE id = ?1", params![id, enc])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_secret(conn: &Connection, id: &str) -> Result<Option<String>, String> {
    let enc: Option<Vec<u8>> = conn
        .query_row("SELECT secret_enc FROM items WHERE id = ?1", [id], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    match enc {
        None => Ok(None),
        Some(bytes) => {
            let plain = dpapi::unprotect(&bytes)?;
            Ok(Some(String::from_utf8(plain).map_err(|e| e.to_string())?))
        }
    }
}

pub fn delete_item(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
    Ok(())
}

pub fn move_item(conn: &Connection, id: &str, folder_id: Option<String>) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE items SET folder_id = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, folder_id, now()],
    )?;
    Ok(())
}

/// Usage stats are local only and do not bump `updated_at` (so they don't win merges).
pub fn mark_used(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE items SET use_count = use_count + 1, last_used_at = ?2 WHERE id = ?1",
        params![id, now()],
    )?;
    Ok(())
}

// ---------- settings ----------

pub fn get_settings(conn: &Connection) -> rusqlite::Result<HashMap<String, String>> {
    let mut st = conn.prepare("SELECT key, value FROM settings")?;
    let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

// ---------- export / import ----------

pub fn export_items(conn: &Connection) -> Result<Vec<PortableItem>, String> {
    let items = list_items(conn).map_err(|e| e.to_string())?;
    items
        .into_iter()
        .map(|item| {
            let secret = if item.has_secret { get_secret(conn, &item.id)? } else { None };
            Ok(PortableItem { item, secret })
        })
        .collect()
}

fn upsert_folder(conn: &Connection, f: &Folder) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, parent_id = excluded.parent_id,
            sort_order = excluded.sort_order, updated_at = excluded.updated_at",
        params![f.id, f.name, f.parent_id, f.sort_order, f.created_at, f.updated_at],
    )?;
    Ok(())
}

fn upsert_item(conn: &Connection, p: &PortableItem) -> Result<(), String> {
    let i = &p.item;
    let tags = serde_json::to_string(&i.tags).map_err(|e| e.to_string())?;
    let enc = match &p.secret {
        Some(s) if !s.is_empty() => Some(dpapi::protect(s.as_bytes())?),
        _ => None,
    };
    conn.execute(
        "INSERT INTO items (id, kind, folder_id, title, content, language, notes, ssh_host, ssh_user, ssh_port,
            ssh_key_path, secret_enc, tags, favorite, use_count, last_used_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
         ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, folder_id = excluded.folder_id, title = excluded.title,
            content = excluded.content, language = excluded.language, notes = excluded.notes,
            ssh_host = excluded.ssh_host, ssh_user = excluded.ssh_user, ssh_port = excluded.ssh_port,
            ssh_key_path = excluded.ssh_key_path, secret_enc = excluded.secret_enc, tags = excluded.tags,
            favorite = excluded.favorite, updated_at = excluded.updated_at",
        params![
            i.id, i.kind, i.folder_id, i.title, i.content, i.language, i.notes, i.ssh_host, i.ssh_user,
            i.ssh_port, i.ssh_key_path, enc, tags, i.favorite, i.use_count, i.last_used_at, i.created_at,
            i.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportStats {
    pub added: usize,
    pub updated: usize,
    pub skipped: usize,
}

fn updated_at(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        &format!("SELECT updated_at FROM {table} WHERE id = ?1"),
        [id],
        |r| r.get(0),
    )
    .optional()
}

/// Merge: unknown ids are added; known ids are overwritten only if the incoming copy is newer.
/// Replace: everything is wiped first.
pub fn import(
    conn: &mut Connection,
    folders: &[Folder],
    items: &[PortableItem],
    replace: bool,
) -> Result<ImportStats, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut stats = ImportStats::default();
    if replace {
        tx.execute_batch("DELETE FROM items; DELETE FROM folders;")
            .map_err(|e| e.to_string())?;
    }
    for f in folders {
        match updated_at(&tx, "folders", &f.id).map_err(|e| e.to_string())? {
            Some(cur) if cur >= f.updated_at => {}
            _ => upsert_folder(&tx, f).map_err(|e| e.to_string())?,
        }
    }
    for p in items {
        match updated_at(&tx, "items", &p.item.id).map_err(|e| e.to_string())? {
            None => {
                upsert_item(&tx, p)?;
                stats.added += 1;
            }
            Some(cur) if cur < p.item.updated_at => {
                upsert_item(&tx, p)?;
                stats.updated += 1;
            }
            Some(_) => stats.skipped += 1,
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        init(&c).unwrap();
        c
    }

    fn input(title: &str) -> ItemInput {
        ItemInput {
            id: None,
            kind: "ssh".into(),
            folder_id: None,
            title: title.into(),
            content: "ssh root@1.2.3.4".into(),
            language: None,
            notes: String::new(),
            ssh_host: Some("1.2.3.4".into()),
            ssh_user: Some("root".into()),
            ssh_port: Some(22),
            ssh_key_path: None,
            secret: Some("hunter2".into()),
            tags: vec!["prod".into()],
            favorite: false,
        }
    }

    #[test]
    fn crud_and_secret() {
        let c = mem();
        let item = save_item(&c, input("Ronan SSH")).unwrap();
        assert!(item.has_secret);
        assert_eq!(item.tags, vec!["prod".to_string()]);
        assert_eq!(get_secret(&c, &item.id).unwrap().as_deref(), Some("hunter2"));

        let mut upd = input("Ronan SSH 2");
        upd.id = Some(item.id.clone());
        upd.secret = None; // keep
        let item2 = save_item(&c, upd).unwrap();
        assert_eq!(item2.title, "Ronan SSH 2");
        assert!(item2.has_secret);

        let mut clear = input("Ronan SSH 2");
        clear.id = Some(item.id.clone());
        clear.secret = Some(String::new());
        assert!(!save_item(&c, clear).unwrap().has_secret);

        mark_used(&c, &item.id).unwrap();
        assert_eq!(get_item(&c, &item.id).unwrap().unwrap().use_count, 1);

        delete_item(&c, &item.id).unwrap();
        assert!(list_items(&c).unwrap().is_empty());
    }

    #[test]
    fn delete_folder_moves_children_up() {
        let c = mem();
        let parent = save_folder(&c, None, "Personal", None).unwrap();
        let child = save_folder(&c, None, "Notes", Some(parent.id.clone())).unwrap();
        let mut i = input("x");
        i.folder_id = Some(child.id.clone());
        let item = save_item(&c, i).unwrap();
        delete_folder(&c, &child.id).unwrap();
        assert_eq!(get_item(&c, &item.id).unwrap().unwrap().folder_id, Some(parent.id));
        assert_eq!(list_folders(&c).unwrap().len(), 1);
    }

    #[test]
    fn merge_newer_wins_and_adds_new() {
        let mut c = mem();
        let local = save_item(&c, input("Local")).unwrap();
        let exported = export_items(&c).unwrap();

        // older incoming copy is skipped
        let mut older = exported[0].clone();
        older.item.title = "Older".into();
        older.item.updated_at = "2000-01-01T00:00:00.000Z".into();
        // newer incoming copy wins
        let mut newer = exported[0].clone();
        newer.item.title = "Newer".into();
        newer.item.updated_at = "2999-01-01T00:00:00.000Z".into();
        // brand new item is added
        let mut fresh = exported[0].clone();
        fresh.item.id = "fresh-id".into();
        fresh.item.title = "Fresh".into();

        let s = import(&mut c, &[], &[older], false).unwrap();
        assert_eq!(s, ImportStats { added: 0, updated: 0, skipped: 1 });
        assert_eq!(get_item(&c, &local.id).unwrap().unwrap().title, "Local");

        let s = import(&mut c, &[], &[newer, fresh], false).unwrap();
        assert_eq!(s, ImportStats { added: 1, updated: 1, skipped: 0 });
        assert_eq!(get_item(&c, &local.id).unwrap().unwrap().title, "Newer");
        assert_eq!(get_secret(&c, "fresh-id").unwrap().as_deref(), Some("hunter2"));
    }

    #[test]
    fn replace_wipes_existing() {
        let mut c = mem();
        save_item(&c, input("Old")).unwrap();
        let mut p = export_items(&c).unwrap()[0].clone();
        p.item.id = "other".into();
        import(&mut c, &[], &[p], true).unwrap();
        let all = list_items(&c).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, "other");
    }
}
