//! Password-protected export files (.ronan).
//!
//! Layout: MAGIC (6) | VERSION (1) | salt (16) | nonce (12) | AES-256-GCM ciphertext.
//! The key is derived from the password with Argon2id. MAGIC + VERSION are bound
//! as associated data, so any tampering fails authentication.

use std::collections::HashMap;

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use serde::{Deserialize, Serialize};

use crate::db::{Folder, PortableItem};

const MAGIC: &[u8; 6] = b"RONANX";
const VERSION: u8 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = MAGIC.len() + 1 + SALT_LEN + NONCE_LEN;

pub const BAD_PASSWORD: &str = "Wrong password, or the file is damaged.";

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub app: String,
    pub exported_at: String,
    pub folders: Vec<Folder>,
    pub items: Vec<PortableItem>,
    pub settings: HashMap<String, String>,
}

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("key derivation failed: {e}"))?;
    Ok(key)
}

fn aad() -> [u8; 7] {
    let mut a = [0u8; 7];
    a[..6].copy_from_slice(MAGIC);
    a[6] = VERSION;
    a
}

pub fn encrypt(plain: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::getrandom(&mut salt).map_err(|e| e.to_string())?;
    getrandom::getrandom(&mut nonce).map_err(|e| e.to_string())?;

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: plain, aad: &aad() })
        .map_err(|_| "encryption failed".to_string())?;

    let mut out = Vec::with_capacity(HEADER_LEN + ct.len());
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

pub fn decrypt(data: &[u8], password: &str) -> Result<Vec<u8>, String> {
    if data.len() < HEADER_LEN || &data[..6] != MAGIC {
        return Err("This is not a Ronan Launcher export file.".into());
    }
    if data[6] != VERSION {
        return Err(format!("Unsupported export file version {}.", data[6]));
    }
    let salt = &data[7..7 + SALT_LEN];
    let nonce = &data[7 + SALT_LEN..HEADER_LEN];
    let key = derive_key(password, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    cipher
        .decrypt(Nonce::from_slice(nonce), Payload { msg: &data[HEADER_LEN..], aad: &aad() })
        .map_err(|_| BAD_PASSWORD.to_string())
}

pub fn encode(data: &ExportData, password: &str) -> Result<Vec<u8>, String> {
    let json = serde_json::to_vec(data).map_err(|e| e.to_string())?;
    encrypt(&json, password)
}

pub fn decode(bytes: &[u8], password: &str) -> Result<ExportData, String> {
    let json = decrypt(bytes, password)?;
    serde_json::from_slice(&json).map_err(|e| format!("Export file content is invalid: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let enc = encrypt(b"{\"hello\":1}", "correct horse").unwrap();
        assert_eq!(&enc[..6], MAGIC);
        assert_eq!(decrypt(&enc, "correct horse").unwrap(), b"{\"hello\":1}");
    }

    #[test]
    fn wrong_password_rejected() {
        let enc = encrypt(b"secret", "right").unwrap();
        assert_eq!(decrypt(&enc, "wrong").unwrap_err(), BAD_PASSWORD);
    }

    #[test]
    fn tampering_rejected() {
        let mut enc = encrypt(b"secret data", "pw").unwrap();
        let last = enc.len() - 1;
        enc[last] ^= 0x01;
        assert_eq!(decrypt(&enc, "pw").unwrap_err(), BAD_PASSWORD);

        let mut enc = encrypt(b"secret data", "pw").unwrap();
        enc[8] ^= 0x01; // salt byte
        assert!(decrypt(&enc, "pw").is_err());
    }

    #[test]
    fn not_an_export_file() {
        assert!(decrypt(b"hello world, this is not it at all....", "pw").is_err());
    }

    #[test]
    fn export_data_round_trip() {
        let data = ExportData {
            app: "ronan-launcher".into(),
            exported_at: "2026-10-21T09:00:00.000Z".into(),
            folders: vec![],
            items: vec![],
            settings: HashMap::from([("theme".into(), "dark".into())]),
        };
        let bytes = encode(&data, "pw").unwrap();
        assert_eq!(decode(&bytes, "pw").unwrap(), data);
    }
}
