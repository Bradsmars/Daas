import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/** Generate fixture-only keys outside the repository; never persist them in test artifacts. */
export function temporaryTlsFixture() {
  const parent = resolve(tmpdir());
  const directory = mkdtempSync(join(parent, 'daas-spec016-tls-'));
  const cleanup = () => {
    const target = resolve(directory);
    if (dirname(target) !== parent || !target.startsWith(join(parent, 'daas-spec016-tls-'))) throw new Error('Refusing to clean an unowned TLS fixture directory.');
    rmSync(target, { recursive: true, force: true });
  };
  try {
    const keyPath = join(directory, 'fixture-key.pem');
    const certPath = join(directory, 'fixture-cert.pem');
    const executable = process.platform === 'win32' ? 'C:/Program Files/Git/mingw64/bin/openssl.exe' : 'openssl';
    execFileSync(executable, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1', '-subj', '/CN=fixture.example.test', '-addext', 'subjectAltName=DNS:fixture.example.test', '-keyout', keyPath, '-out', certPath], { stdio: 'ignore', timeout: 10_000, windowsHide: true });
    return { key: readFileSync(keyPath), cert: readFileSync(certPath), cleanup };
  } catch { cleanup(); throw new Error('Controlled TLS setup requires the existing OpenSSL executable.'); }
}
