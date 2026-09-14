import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'operatore';
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash' | 'salt'>;

export interface SessionPayload {
  userId: string;
  username: string;
  displayName: string;
  role: 'admin' | 'operatore';
  exp: number;
}

export const SESSION_COOKIE_NAME = 'pq_session';

const dataDir = path.join(process.cwd(), 'data');
const usersFilePath = path.join(dataDir, 'users.json');
const secretFilePath = path.join(dataDir, '.session_secret');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getSessionSecret(): string {
  ensureDataDir();
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (fs.existsSync(secretFilePath)) {
    return fs.readFileSync(secretFilePath, 'utf-8').trim();
  }
  const newSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFilePath, newSecret, 'utf-8');
  return newSecret;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

export function initUsersFile(): User[] {
  ensureDataDir();
  if (!fs.existsSync(usersFilePath)) {
    const { hash, salt } = hashPassword('admin');
    const defaultAdmin: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      displayName: 'Amministratore',
      role: 'admin',
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(usersFilePath, JSON.stringify([defaultAdmin], null, 2), 'utf-8');
    return [defaultAdmin];
  }

  try {
    const data = fs.readFileSync(usersFilePath, 'utf-8');
    const users: User[] = JSON.parse(data);
    if (!Array.isArray(users) || users.length === 0) {
      const { hash, salt } = hashPassword('admin');
      const defaultAdmin: User = {
        id: crypto.randomUUID(),
        username: 'admin',
        displayName: 'Amministratore',
        role: 'admin',
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString()
      };
      fs.writeFileSync(usersFilePath, JSON.stringify([defaultAdmin], null, 2), 'utf-8');
      return [defaultAdmin];
    }
    return users;
  } catch {
    return [];
  }
}

export function getAllUsers(): User[] {
  return initUsersFile();
}

export function getAllPublicUsers(): PublicUser[] {
  const users = getAllUsers();
  return users.map(({ passwordHash: _, salt: __, ...pub }) => pub);
}

export function getUserByUsername(username: string): User | null {
  const users = getAllUsers();
  const normalized = username.trim().toLowerCase();
  return users.find(u => u.username.toLowerCase() === normalized) || null;
}

export function getUserById(id: string): User | null {
  const users = getAllUsers();
  return users.find(u => u.id === id) || null;
}

export function createUser(data: {
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'operatore';
}): { user?: PublicUser; error?: string } {
  const users = getAllUsers();
  const normalized = data.username.trim().toLowerCase();

  if (!normalized || data.password.length < 4) {
    return { error: 'Username valido e password di almeno 4 caratteri richiesti' };
  }

  if (users.some(u => u.username.toLowerCase() === normalized)) {
    return { error: 'Username già esistente' };
  }

  const { hash, salt } = hashPassword(data.password);
  const newUser: User = {
    id: crypto.randomUUID(),
    username: normalized,
    displayName: data.displayName.trim() || normalized,
    role: data.role || 'operatore',
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  const updated = [...users, newUser];
  fs.writeFileSync(usersFilePath, JSON.stringify(updated, null, 2), 'utf-8');

  const { passwordHash: _, salt: __, ...pub } = newUser;
  return { user: pub };
}

export function updateUserPassword(id: string, newPassword: string): { success: boolean; error?: string } {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'La password deve avere almeno 4 caratteri' };
  }

  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    return { success: false, error: 'Utente non trovato' };
  }

  const { hash, salt } = hashPassword(newPassword);
  users[index].passwordHash = hash;
  users[index].salt = salt;

  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
  return { success: true };
}

export function deleteUser(id: string): { success: boolean; error?: string } {
  const users = getAllUsers();
  const userToDelete = users.find(u => u.id === id);
  if (!userToDelete) {
    return { success: false, error: 'Utente non trovato' };
  }

  const adminCount = users.filter(u => u.role === 'admin').length;
  if (userToDelete.role === 'admin' && adminCount <= 1) {
    return { success: false, error: 'Non è possibile eliminare l\'unico amministratore rimasto' };
  }

  const filtered = users.filter(u => u.id !== id);
  fs.writeFileSync(usersFilePath, JSON.stringify(filtered, null, 2), 'utf-8');
  return { success: true };
}

// Token di sessione HMAC-SHA256 (30 giorni di validità)
export function createSessionToken(user: User): string {
  const secret = getSessionSecret();
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 giorni
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const secret = getSessionSecret();

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
