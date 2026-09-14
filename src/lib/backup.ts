import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

const CRITICAL_FILES = [
  'quotes.json',
  'inventory.json',
  'users.json',
  'maintenance.json'
];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export async function createBackupZip(): Promise<Buffer> {
  ensureDir(DATA_DIR);
  const zip = new JSZip();

  const manifest = {
    appName: 'PrintQuote 3D',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    files: [] as string[]
  };

  for (const file of CRITICAL_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      zip.file(file, content);
      manifest.files.push(file);
    }
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return buffer;
}

export async function createLocalSnapshot(): Promise<string> {
  ensureDir(BACKUPS_DIR);
  const buffer = await createBackupZip();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.zip`;
  const filePath = path.join(BACKUPS_DIR, filename);

  fs.writeFileSync(filePath, buffer);

  // Mantieni solo gli ultimi 15 snapshot locali
  try {
    const existing = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (existing.length > 15) {
      const toDelete = existing.slice(15);
      for (const item of toDelete) {
        fs.unlinkSync(path.join(BACKUPS_DIR, item.name));
      }
    }
  } catch (err) {
    console.error('Errore rotazione backup:', err);
  }

  return filename;
}

export function listLocalSnapshots(): BackupInfo[] {
  ensureDir(BACKUPS_DIR);
  try {
    return fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stat = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function restoreFromZip(zipBuffer: Buffer): Promise<{ success: boolean; restoredFiles: string[]; error?: string }> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const restoredFiles: string[] = [];

    // Fai un backup di sicurezza prima di sovrascrivere
    await createLocalSnapshot();

    for (const file of CRITICAL_FILES) {
      const zipEntry = zip.file(file);
      if (zipEntry) {
        const content = await zipEntry.async('string');
        // Validazione JSON
        JSON.parse(content);
        fs.writeFileSync(path.join(DATA_DIR, file), content, 'utf-8');
        restoredFiles.push(file);
      }
    }

    if (restoredFiles.length === 0) {
      return { success: false, restoredFiles: [], error: 'Nessun file valido trovato nel backup caricato.' };
    }

    return { success: true, restoredFiles };
  } catch (err) {
    return { 
      success: false, 
      restoredFiles: [], 
      error: err instanceof Error ? err.message : 'Errore durante il ripristino del file zip' 
    };
  }
}
