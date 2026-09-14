export interface SpoolTarePreset {
  id: string;
  brand: string;
  model: string;
  materialType: 'cardboard' | 'plastic' | 'reusable' | 'other';
  tareWeight: number; // in grammi
  description: string;
}

export const SPOOL_TARE_PRESETS: SpoolTarePreset[] = [
  // --- BAMBU LAB ---
  {
    id: 'bambu-reusable',
    brand: 'Bambu Lab',
    model: 'Reusable Spool (Plastica Ufficiale con Chiusura)',
    materialType: 'reusable',
    tareWeight: 250,
    description: 'Rocchetto originale Bambu Lab scomponibile per ricariche Refill'
  },
  {
    id: 'bambu-high-temp',
    brand: 'Bambu Lab',
    model: 'High Temperature Spool (PC/ABS)',
    materialType: 'reusable',
    tareWeight: 253,
    description: 'Rocchetto ad alta resistenza termica per essiccazione ad alte temperature'
  },
  {
    id: 'bambu-refill-core',
    brand: 'Bambu Lab',
    model: 'Refill Core (Sola Anima in Cartoncino)',
    materialType: 'cardboard',
    tareWeight: 28,
    description: 'Anima interna di cartone per ricariche senza rocchetto'
  },

  // --- SUNLU ---
  {
    id: 'sunlu-plastic',
    brand: 'Sunlu',
    model: 'Plastica Standard (Nera o Trasparente)',
    materialType: 'plastic',
    tareWeight: 130,
    description: 'Rocchetto leggero classico Sunlu per PLA, PLA+, PETG, TPU'
  },
  {
    id: 'sunlu-cardboard',
    brand: 'Sunlu',
    model: 'Cartone Eco-Spool',
    materialType: 'cardboard',
    tareWeight: 145,
    description: 'Nuove bobine ecologiche Sunlu in cartone riciclato'
  },
  {
    id: 'sunlu-masterspool',
    brand: 'Sunlu',
    model: 'Master Spool Riutilizzabile',
    materialType: 'reusable',
    tareWeight: 170,
    description: 'Rocchetto riutilizzabile Sunlu per matasse refill'
  },
  {
    id: 'sunlu-large',
    brand: 'Sunlu',
    model: 'Bobina Grande 2kg/3kg (Plastica)',
    materialType: 'plastic',
    tareWeight: 350,
    description: 'Formati professionali ad alta capacità'
  },

  // --- ESUN ---
  {
    id: 'esun-cardboard',
    brand: 'eSUN',
    model: 'Cartone (Serie Recente ePLA / ePETG)',
    materialType: 'cardboard',
    tareWeight: 170,
    description: 'Nuovo standard eSUN in cartoncino spesso'
  },
  {
    id: 'esun-plastic-black',
    brand: 'eSUN',
    model: 'Plastica Nera (Serie Classica)',
    materialType: 'plastic',
    tareWeight: 220,
    description: 'Rocchetto storico eSUN in plastica nera rigida'
  },
  {
    id: 'esun-plastic-clear',
    brand: 'eSUN',
    model: 'Plastica Trasparente (ePA / Ingegneristici)',
    materialType: 'plastic',
    tareWeight: 210,
    description: 'Rocchetto trasparente per nylon e filamenti tecnici'
  },
  {
    id: 'esun-mini',
    brand: 'eSUN',
    model: 'Bobina Piccola 0.5kg (Plastica)',
    materialType: 'plastic',
    tareWeight: 120,
    description: 'Formati ridotti da mezzo chilo'
  },

  // --- POLYMAKER ---
  {
    id: 'polymaker-cardboard-1kg',
    brand: 'Polymaker',
    model: 'Cartone 1kg (PolyTerra / PolyLite)',
    materialType: 'cardboard',
    tareWeight: 140,
    description: 'Bobina ecologica ufficiale in cartone con righello graduato'
  },
  {
    id: 'polymaker-cardboard-small',
    brand: 'Polymaker',
    model: 'Cartone 500g / 750g (Fiberon / Tecnico)',
    materialType: 'cardboard',
    tareWeight: 130,
    description: 'Bobina cartone per filamenti caricati a fibra di carbonio'
  },
  {
    id: 'polymaker-plastic',
    brand: 'Polymaker',
    model: 'Plastica Classica (Serie Precedente)',
    materialType: 'plastic',
    tareWeight: 210,
    description: 'Rocchetto originale in plastica trasparente rigida'
  },

  // --- PRUSAMENT ---
  {
    id: 'prusament-1kg',
    brand: 'Prusament',
    model: '1kg Nido d’Ape (Plastica + Anima Cartone)',
    materialType: 'reusable',
    tareWeight: 195,
    description: 'Fianchi esagonali a nido d’ape alleggeriti con anima centrale in cartoncino'
  },
  {
    id: 'prusament-2kg',
    brand: 'Prusament',
    model: '2kg Formato Extra',
    materialType: 'plastic',
    tareWeight: 220,
    description: 'Bobina grande Prusa Research per stampe lunghe'
  },

  // --- CREALITY ---
  {
    id: 'creality-hyper-cardboard',
    brand: 'Creality',
    model: 'Hyper PLA (Cartone Compatto)',
    materialType: 'cardboard',
    tareWeight: 125,
    description: 'Bobina leggera in cartoncino per filamenti alta velocità'
  },
  {
    id: 'creality-plastic',
    brand: 'Creality',
    model: 'CR / Ender Plastica (Bianca o Nera)',
    materialType: 'plastic',
    tareWeight: 155,
    description: 'Rocchetto standard fornito con stampanti Ender / serie K1'
  },

  // --- ELEGOO ---
  {
    id: 'elegoo-cardboard',
    brand: 'ELEGOO',
    model: 'Cartone Rapid (PLA+ / Rapid PETG)',
    materialType: 'cardboard',
    tareWeight: 154,
    description: 'Bobina in cartoncino Elegoo serie rapida per Neptune/Centauri'
  },
  {
    id: 'elegoo-plastic',
    brand: 'ELEGOO',
    model: 'Plastica Classica',
    materialType: 'plastic',
    tareWeight: 160,
    description: 'Rocchetto in plastica standard Elegoo'
  },

  // --- OVERTURE ---
  {
    id: 'overture-cardboard',
    brand: 'Overture',
    model: 'Cartone Eco-Spool',
    materialType: 'cardboard',
    tareWeight: 155,
    description: 'Bobina in cartone riciclato con finestrelle per la misurazione'
  },
  {
    id: 'overture-plastic',
    brand: 'Overture',
    model: 'Plastica Classica Trasparente',
    materialType: 'plastic',
    tareWeight: 220,
    description: 'Rocchetto trasparente prima serie'
  },

  // --- ANYCUBIC ---
  {
    id: 'anycubic-plastic',
    brand: 'Anycubic',
    model: 'Plastica Standard (Nera con fori)',
    materialType: 'plastic',
    tareWeight: 127,
    description: 'Rocchetto leggero originale Anycubic serie Kobra'
  },
  {
    id: 'anycubic-cardboard',
    brand: 'Anycubic',
    model: 'Cartone Recente',
    materialType: 'cardboard',
    tareWeight: 140,
    description: 'Nuove bobine ecologiche Anycubic'
  },

  // --- ERYONE ---
  {
    id: 'eryone-plastic',
    brand: 'Eryone',
    model: 'Plastica Trasparente / Nera',
    materialType: 'plastic',
    tareWeight: 187,
    description: 'Rocchetto rigido standard per PLA Silk e bicolore'
  },
  {
    id: 'eryone-cardboard',
    brand: 'Eryone',
    model: 'Cartone',
    materialType: 'cardboard',
    tareWeight: 140,
    description: 'Bobina in cartoncino riciclato'
  },

  // --- AMAZON BASICS ---
  {
    id: 'amazon-basics',
    brand: 'Amazon Basics',
    model: 'Plastica Rigida Nera',
    materialType: 'plastic',
    tareWeight: 225,
    description: 'Rocchetto pesante in plastica solida'
  },

  // --- GEEETECH ---
  {
    id: 'geeetech-plastic',
    brand: 'Geeetech',
    model: 'Plastica',
    materialType: 'plastic',
    tareWeight: 165,
    description: 'Rocchetto standard Geeetech'
  },
  {
    id: 'geeetech-cardboard',
    brand: 'Geeetech',
    model: 'Cartone',
    materialType: 'cardboard',
    tareWeight: 140,
    description: 'Bobina in cartone'
  },

  // --- FORMFUTURA ---
  {
    id: 'formfutura-cardboard',
    brand: 'FormFutura',
    model: 'EasyFil Cartone',
    materialType: 'cardboard',
    tareWeight: 145,
    description: 'Bobina in cartoncino olandese'
  },

  // --- FILLAMENTUM ---
  {
    id: 'fillamentum-plastic',
    brand: 'Fillamentum',
    model: 'Plastica Premium',
    materialType: 'plastic',
    tareWeight: 215,
    description: 'Rocchetto ceco di alta precisione'
  },

  // --- FIBERLOGY ---
  {
    id: 'fiberlogy-plastic',
    brand: 'Fiberlogy',
    model: 'Plastica Bianca Premium',
    materialType: 'plastic',
    tareWeight: 245,
    description: 'Rocchetto solido e pesante per filamenti tecnici'
  },

  // --- EXTRUDR ---
  {
    id: 'extrudr-plastic',
    brand: 'Extrudr',
    model: 'Plastica Bio / GreenTec',
    materialType: 'plastic',
    tareWeight: 235,
    description: 'Rocchetto austriaco per materiali tecnici'
  },

  // --- GENERICHE DI DEFAULT ---
  {
    id: 'generic-plastic',
    brand: 'Generico',
    model: 'Rocchetto Standard in Plastica',
    materialType: 'plastic',
    tareWeight: 200,
    description: 'Valore medio tipico per rocchetti in plastica generici non marchiati'
  },
  {
    id: 'generic-cardboard',
    brand: 'Generico',
    model: 'Rocchetto Standard in Cartone',
    materialType: 'cardboard',
    tareWeight: 140,
    description: 'Valore medio tipico per rocchetti in cartone generici'
  }
];

/**
 * Cerca la tara consigliata in base al nome del produttore
 */
export function findSuggestedTare(brandName: string): SpoolTarePreset | undefined {
  if (!brandName) return undefined;
  const clean = brandName.trim().toLowerCase();

  // Corrispondenze prioritarie
  if (clean.includes('bambu')) return SPOOL_TARE_PRESETS.find(p => p.id === 'bambu-reusable');
  if (clean.includes('sunlu') || clean.includes('sunclu')) return SPOOL_TARE_PRESETS.find(p => p.id === 'sunlu-plastic');
  if (clean.includes('esun')) return SPOOL_TARE_PRESETS.find(p => p.id === 'esun-cardboard');
  if (clean.includes('poly')) return SPOOL_TARE_PRESETS.find(p => p.id === 'polymaker-cardboard-1kg');
  if (clean.includes('prusa')) return SPOOL_TARE_PRESETS.find(p => p.id === 'prusament-1kg');
  if (clean.includes('creality')) return SPOOL_TARE_PRESETS.find(p => p.id === 'creality-hyper-cardboard');
  if (clean.includes('elegoo')) return SPOOL_TARE_PRESETS.find(p => p.id === 'elegoo-cardboard');
  if (clean.includes('overture')) return SPOOL_TARE_PRESETS.find(p => p.id === 'overture-cardboard');
  if (clean.includes('anycubic')) return SPOOL_TARE_PRESETS.find(p => p.id === 'anycubic-plastic');
  if (clean.includes('eryone')) return SPOOL_TARE_PRESETS.find(p => p.id === 'eryone-plastic');
  if (clean.includes('amazon')) return SPOOL_TARE_PRESETS.find(p => p.id === 'amazon-basics');
  if (clean.includes('geeetech')) return SPOOL_TARE_PRESETS.find(p => p.id === 'geeetech-plastic');
  if (clean.includes('formfutura')) return SPOOL_TARE_PRESETS.find(p => p.id === 'formfutura-cardboard');
  if (clean.includes('fillamentum')) return SPOOL_TARE_PRESETS.find(p => p.id === 'fillamentum-plastic');
  if (clean.includes('fiberlogy')) return SPOOL_TARE_PRESETS.find(p => p.id === 'fiberlogy-plastic');
  if (clean.includes('extrudr')) return SPOOL_TARE_PRESETS.find(p => p.id === 'extrudr-plastic');

  return undefined;
}

/**
 * Calcola il peso netto del filamento rimanente a partire dal peso letto sulla bilancia
 */
export function calculateNetFilamentWeight(grossWeight: number, tareWeight: number): number {
  return Math.max(0, Math.round(grossWeight - tareWeight));
}
