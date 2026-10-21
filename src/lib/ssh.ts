export interface SshFields {
  sshHost: string | null;
  sshUser: string | null;
  sshPort: number | null;
  sshKeyPath: string | null;
}

const quote = (s: string) => (/\s/.test(s) ? `"${s}"` : s);

/** Builds `ssh -i key -p 2222 user@host` from the structured fields. */
export function buildSshCommand(f: SshFields): string {
  const host = f.sshHost?.trim();
  if (!host) return "";
  const parts = ["ssh"];
  if (f.sshKeyPath?.trim()) parts.push("-i", quote(f.sshKeyPath.trim()));
  if (f.sshPort && f.sshPort !== 22) parts.push("-p", String(f.sshPort));
  parts.push(f.sshUser?.trim() ? `${f.sshUser.trim()}@${host}` : host);
  return parts.join(" ");
}
