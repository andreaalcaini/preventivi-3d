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
    
    let totalSeconds = 0;
    const predMatch = xmlText.match(/<prediction\s+value="(\d+)"/i) || 
                      xmlText.match(/prediction="(\d+)"/i) ||
                      xmlText.match(/<prediction>(\d+)<\/prediction>/i);
    if (predMatch) {
      totalSeconds = parseInt(predMatch[1], 10);
    }

    let totalWeight = 0;
    const weightMatch = xmlText.match(/<weight\s+value="([0-9.]+)"/i) ||
                        xmlText.match(/weight="([0-9.]+)"/i) ||
                        xmlText.match(/<weight>([0-9.]+)<\/weight>/i);
    if (weightMatch) {
      totalWeight = parseFloat(weightMatch[1]);
    }

    const filaments: ParsedSlicerData['filaments'] = [];
    const filamentMatches = xmlText.matchAll(/<filament\s+([^>]+)>/gi);
    for (const match of filamentMatches) {
      const attrs = match[1];
      const idMatch = attrs.match(/id="(\d+)"/i);
      const typeMatch = attrs.match(/type="([^"]+)"/i);
      const colorMatch = attrs.match(/color="([^"]+)"/i);
      const usedGMatch = attrs.match(/used_g="([0-9.]+)"/i);

      if (usedGMatch) {
        const fWeight = parseFloat(usedGMatch[1]);
        if (fWeight > 0) {
          filaments.push({
            id: idMatch ? parseInt(idMatch[1], 10) : filaments.length + 1,
            type: typeMatch ? typeMatch[1].toUpperCase() : 'PLA',
            color: colorMatch ? colorMatch[1] : undefined,
            weightGrams: Math.round(fWeight * 10) / 10
          });
        }
      }
    }

    if (totalWeight === 0 && filaments.length > 0) {
      totalWeight = filaments.reduce((acc, f) => acc + f.weightGrams, 0);
    }

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.round((totalSeconds % 3600) / 60);
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
