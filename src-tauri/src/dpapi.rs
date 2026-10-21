//! Windows DPAPI: encrypts bytes so only the current Windows user can decrypt them.

#[cfg(windows)]
mod imp {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 }
    }

    unsafe fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let v = unsafe { std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec() };
        unsafe { LocalFree(Some(HLOCAL(out.pbData as *mut _))) };
        v
    }

    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        let input = blob(data);
        let mut out = CRYPT_INTEGER_BLOB::default();
        unsafe {
            CryptProtectData(&input, PCWSTR::null(), None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out)
                .map_err(|e| format!("DPAPI protect failed: {e}"))?;
            Ok(take(out))
        }
    }

    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        let input = blob(data);
        let mut out = CRYPT_INTEGER_BLOB::default();
        unsafe {
            CryptUnprotectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out)
                .map_err(|e| format!("DPAPI unprotect failed: {e}"))?;
            Ok(take(out))
        }
    }
}

#[cfg(not(windows))]
mod imp {
    // Non-Windows builds only exist for development; data is stored as-is.
    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(data.to_vec())
    }
    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(data.to_vec())
    }
}

pub use imp::{protect, unprotect};

#[cfg(test)]
mod tests {
    #[test]
    fn round_trip() {
        let enc = super::protect(b"hunter2").unwrap();
        assert_ne!(enc, b"hunter2");
        assert_eq!(super::unprotect(&enc).unwrap(), b"hunter2");
    }
}
