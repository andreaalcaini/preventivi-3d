import JSZip from 'jszip';

export interface ParsedSlicerData {
  fileName: string;
  slicerName?: string;
  hours: number;
  mins: number;
  weightGrams: number;
  material?: string;
  multiColor?: boolean;
  colorCount?: number;
  filaments?: Array<{
    id: number;
    type: string;
    color?: string;
    weightGrams: number;
  }>;
}

/**
 * Parsing di file G-Code (testo puro o estratto da zip)
 */
export function parseGcodeContent(text: string, fileName: string): ParsedSlicerData {
  let seconds = 0;
  let weight = 0;
  let material = '';
  let slicer = 'G-Code';

  // 1. Riconoscimento Slicer
  if (text.includes('BambuStudio') || text.includes('Bambu Studio')) slicer = 'Bambu Studio';
  else if (text.includes('OrcaSlicer') || text.includes('Orca Slicer')) slicer = 'OrcaSlicer';
  else if (text.includes('PrusaSlicer')) slicer = 'PrusaSlicer';
  else if (text.includes('Cura_SteamEngine') || text.includes('UltiMaker')) slicer = 'UltiMaker Cura';
  else if (text.includes('Creality')) slicer = 'Creality Print';

  // 2. Tempo di Stampa
  const prusaTimeMatch = text.match(/;\s*estimated printing time(?:\s*\(normal mode\))?\s*=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
  if (prusaTimeMatch) {
    const days = parseInt(prusaTimeMatch[1] || '0', 10);
    const hours = parseInt(prusaTimeMatch[2] || '0', 10);
    const mins = parseInt(prusaTimeMatch[3] || '0', 10);
    const secs = parseInt(prusaTimeMatch[4] || '0', 10);
    seconds = (days * 86400) + (hours * 3600) + (mins * 60) + secs;
  }

  if (seconds === 0) {
    const curaTimeMatch = text.match(/;TIME:(\d+)/i);
    if (curaTimeMatch) {
      seconds = parseInt(curaTimeMatch[1], 10);
    }
  }

  if (seconds === 0) {
    const genSecMatch = text.match(/;\s*(?:total_)?print_time\s*=\s*(\d+)/i);
    if (genSecMatch) {
      seconds = parseInt(genSecMatch[1], 10);
    }
  }

  // 3. Peso Filamento (grammi)
  const prusaWeightMatch = text.match(/;\s*(?:total\s+)?filament\s+used\s+\[g\]\s*=\s*([0-9.]+)/i);
  if (prusaWeightMatch) {
    weight = parseFloat(prusaWeightMatch[1]);
  }

  if (weight === 0) {
    const bambuWeightMatch = text.match(/;\s*total_filament_used_g\s*=\s*([0-9.]+)/i);
    if (bambuWeightMatch) {
      weight = parseFloat(bambuWeightMatch[1]);
    }
  }

  if (weight === 0) {
    const curaWeightMatch = text.match(/;Filament weight\s*=\s*([0-9.]+)/i);
    if (curaWeightMatch) {
      weight = parseFloat(curaWeightMatch[1]);
    }
  }

  // 4. Materiale
  const matMatch = text.match(/;\s*filament_type\s*=\s*([A-Za-z0-9_-]+)/i) ||
                   text.match(/;\s*material\s*=\s*([A-Za-z0-9_-]+)/i);
  if (matMatch) {
    material = matMatch[1].trim().toUpperCase();
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);

  return {
    fileName,
    slicerName: slicer,
    hours,
    mins,
    weightGrams: Math.round(weight * 10) / 10,
    material: material || undefined
  };
}

/**
 * Parsing di file .3mf (Bambu Studio, OrcaSlicer, PrusaSlicer)
 */
export async function parse3mfFile(file: File): Promise<ParsedSlicerData> {
  const zip = await JSZip.loadAsync(file);

  const sliceInfoFile = zip.file('Metadata/slice_info.config') || zip.file('slice_info.config');
  if (sliceInfoFile) {
    const xmlText = await sliceInfoFile.async('string');
    
    // Un progetto può contenere più piatti: tempi e pesi vanno sommati,
    // i filamenti deduplicati per id (lo stesso slot AMS può comparire su più piatti)
    const plateBlocks = Array.from(xmlText.matchAll(/<plate>([\s\S]*?)<\/plate>/gi), m => m[1]);
    if (plateBlocks.length === 0) plateBlocks.push(xmlText);

    let totalSeconds = 0;
    let totalWeight = 0;
    const filamentsById = new Map<number, NonNullable<ParsedSlicerData['filaments']>[number]>();

    for (const plate of plateBlocks) {
      const predMatch = plate.match(/<metadata\s+key="prediction"\s+value="(\d+(?:\.\d+)?)"/i) ||
                        plate.match(/<prediction\s+value="(\d+)"/i) ||
                        plate.match(/prediction="(\d+)"/i) ||
                        plate.match(/<prediction>(\d+)<\/prediction>/i);
      if (predMatch) {
        totalSeconds += Number(predMatch[1]) || 0;
      }

      const weightMatch = plate.match(/<metadata\s+key="weight"\s+value="([0-9.]+)"/i) ||
                          plate.match(/<weight\s+value="([0-9.]+)"/i) ||
                          plate.match(/<weight>([0-9.]+)<\/weight>/i);
      if (weightMatch) {
        totalWeight += parseFloat(weightMatch[1]) || 0;
      }

      const filamentMatches = plate.matchAll(/<filament\s+([^>]+)>/gi);
      for (const match of filamentMatches) {
        const attrs = match[1];
        const idMatch = attrs.match(/\bid="(\d+)"/i);
        const typeMatch = attrs.match(/\btype="([^"]+)"/i);
        const colorMatch = attrs.match(/\bcolor="([^"]+)"/i);
        const usedGMatch = attrs.match(/\bused_g="([0-9.]+)"/i);

        if (!usedGMatch) continue;
        const fWeight = parseFloat(usedGMatch[1]);
        if (!(fWeight > 0)) continue;

        const id = idMatch ? parseInt(idMatch[1], 10) : filamentsById.size + 1;
        const existing = filamentsById.get(id);
        if (existing) {
          existing.weightGrams += fWeight;
        } else {
          filamentsById.set(id, {
            id,
            type: typeMatch ? typeMatch[1].toUpperCase() : 'PLA',
            color: colorMatch ? colorMatch[1] : undefined,
            weightGrams: fWeight
          });
        }
      }
    }

    const filaments = Array.from(filamentsById.values())
      .sort((a, b) => a.id - b.id)
      .map(f => ({ ...f, weightGrams: Math.round(f.weightGrams * 10) / 10 }));

    if (totalWeight === 0 && filaments.length > 0) {
      totalWeight = filaments.reduce((acc, f) => acc + f.weightGrams, 0);
    }

    const totalMinutes = Math.round(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const primaryMaterial = filaments.length > 0 ? filaments[0].type : undefined;

    return {
      fileName: file.name,
      slicerName: xmlText.includes('Bambu') ? 'Bambu Studio' : 'OrcaSlicer',
      hours,
      mins,
      weightGrams: Math.round(totalWeight * 10) / 10,
      material: primaryMaterial,
      multiColor: filaments.length > 1,
      colorCount: filaments.length,
      filaments
    };
  }

  const gcodeFileEntry = Object.keys(zip.files).find(name => name.endsWith('.gcode'));
  if (gcodeFileEntry) {
    const gcodeFile = zip.file(gcodeFileEntry);
    if (gcodeFile) {
      const gcodeText = await gcodeFile.async('string');
      return parseGcodeContent(gcodeText, file.name);
    }
  }

  const modelSettings = zip.file('Metadata/model_settings.config');
  if (modelSettings) {
    const text = await modelSettings.async('string');
    return parseGcodeContent(text, file.name);
  }

  throw new Error("Impossibile trovare dati di slicing all'interno del file .3mf. Assicurati di aver salvato o esportato il file dopo aver eseguito lo slicing.");
}

/**
 * Parser principale unificato per .gcode, .3mf, .gcode.3mf
 */
export async function parseSlicerFile(file: File): Promise<ParsedSlicerData> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.3mf')) {
    return await parse3mfFile(file);
  } else if (lowerName.endsWith('.gcode') || lowerName.endsWith('.gco') || lowerName.endsWith('.g')) {
    const text = await file.text();
    return parseGcodeContent(text, file.name);
  } else {
    throw new Error("Formato non supportato. Trascina un file .3mf (Bambu/Orca) oppure .gcode.");
  }
}

export function isSlicerFileName(name: string): boolean {
  return /\.(3mf|gcode|gco|g)$/i.test(name);
}

/**
 * Unisce i dati di più file slicer in un unico totale: tempi e pesi sommati,
 * filamenti con stesso tipo+colore considerati la stessa bobina anche tra file diversi
 */
export function mergeSlicerData(items: ParsedSlicerData[]): ParsedSlicerData | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  let totalMinutes = 0;
  let totalWeight = 0;
  const filamentsByKey = new Map<string, NonNullable<ParsedSlicerData['filaments']>[number]>();

  for (const item of items) {
    totalMinutes += item.hours * 60 + item.mins;
    totalWeight += item.weightGrams;

    for (const f of item.filaments || []) {
      const key = `${f.type}|${(f.color || '').toUpperCase()}`;
      const existing = filamentsByKey.get(key);
      if (existing) {
        existing.weightGrams += f.weightGrams;
      } else {
        filamentsByKey.set(key, { ...f, id: filamentsByKey.size + 1 });
      }
    }
  }

  const filaments = Array.from(filamentsByKey.values())
    .map(f => ({ ...f, weightGrams: Math.round(f.weightGrams * 10) / 10 }));
  const slicerNames = Array.from(new Set(items.map(i => i.slicerName).filter(Boolean)));
  // Senza dati sui filamenti (es. G-Code puro) si ricade sul conteggio colori dichiarato da ciascun file
  const colorCount = filaments.length > 0
    ? filaments.length
    : Math.max(...items.map(i => i.colorCount || 1));

  return {
    fileName: items.map(i => i.fileName).join(', '),
    slicerName: slicerNames.join(' + ') || undefined,
    hours: Math.floor(totalMinutes / 60),
    mins: totalMinutes % 60,
    weightGrams: Math.round(totalWeight * 10) / 10,
    material: filaments[0]?.type || items.find(i => i.material)?.material,
    multiColor: colorCount > 1,
    colorCount,
    filaments: filaments.length > 0 ? filaments : undefined
  };
}

/**
 * Analizza più file slicer e ne restituisce il totale; i file illeggibili vengono riportati in `errors`
 */
export async function parseSlicerFiles(files: File[]): Promise<{
  merged: ParsedSlicerData | null;
  parsed: ParsedSlicerData[];
  errors: Array<{ fileName: string; message: string }>;
}> {
  const results = await Promise.allSettled(files.map(f => parseSlicerFile(f)));
  const parsed: ParsedSlicerData[] = [];
  const errors: Array<{ fileName: string; message: string }> = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const d = r.value;
      if (d.hours === 0 && d.mins === 0 && d.weightGrams === 0) {
        errors.push({ fileName: files[i].name, message: 'Nessun dato di tempo o peso trovato nel file' });
      } else {
        parsed.push(d);
      }
    } else {
      errors.push({
        fileName: files[i].name,
        message: r.reason instanceof Error ? r.reason.message : String(r.reason)
      });
    }
  });

  return { merged: mergeSlicerData(parsed), parsed, errors };
}
