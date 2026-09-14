import { NextRequest, NextResponse } from 'next/server';

export interface MakerWorldProfileSummary {
  id: number;
  title: string;
  predictionSeconds: number;
  printHours: number;
  printMinutes: number;
  weightGrams: number;
  material: string;
  colorHex: string;
  needAms: boolean;
  plateCount: number;
  isDefault: boolean;
}

export interface MakerWorldResponseData {
  success: boolean;
  modelId: string;
  modelTitle: string;
  modelSummary: string;
  coverUrl: string;
  authorName: string;
  selectedProfile: MakerWorldProfileSummary | null;
  availableProfiles: MakerWorldProfileSummary[];
}

// Regex per estrarre modelId e profileId da vari formati URL MakerWorld
export function parseMakerWorldUrl(inputUrl: string): { modelId: string | null; profileId: string | null } {
  if (!inputUrl) return { modelId: null, profileId: null };

  const trimmed = inputUrl.trim();
  const modelMatch = trimmed.match(/makerworld\.com\/(?:[a-z]{2}(?:-[a-zA-Z]+)?\/)?models\/(\d+)/i);
  const profileMatch = trimmed.match(/(?:#profileId-|profileId[=-])(\d+)/i);

  return {
    modelId: modelMatch ? modelMatch[1] : null,
    profileId: profileMatch ? profileMatch[1] : null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get('url');
  let modelId = searchParams.get('modelId');
  let profileId = searchParams.get('profileId');

  if (urlParam) {
    const parsed = parseMakerWorldUrl(urlParam);
    if (parsed.modelId) modelId = parsed.modelId;
    if (parsed.profileId && !profileId) profileId = parsed.profileId;
  }

  if (!modelId) {
    return NextResponse.json(
      { success: false, error: 'ID modello o link MakerWorld non valido o mancante' },
      { status: 400 }
    );
  }

  try {
    const mwApiUrl = `https://makerworld.com/api/v1/design-service/design/${encodeURIComponent(modelId)}`;
    
    const response = await fetch(mwApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://makerworld.com/',
      },
      next: { revalidate: 3600 }, // Cache 1 ora
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `MakerWorld ha risposto con codice ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data || !data.title) {
      return NextResponse.json(
        { success: false, error: 'Modello non trovato o rimosso da MakerWorld' },
        { status: 404 }
      );
    }

    const instances: any[] = Array.isArray(data.instances) ? data.instances : [];

    const availableProfiles: MakerWorldProfileSummary[] = instances.map(inst => {
      const predictionSeconds = Number(inst.prediction) || 0;
      const printHours = Math.floor(predictionSeconds / 3600);
      const printMinutes = Math.round((predictionSeconds % 3600) / 60);
      const weightGrams = Math.round(Number(inst.weight) || 0);

      const plates: any[] = inst.extention?.modelInfo?.plates || [];
      const firstFilament = plates.flatMap((p: any) => p.filaments || [])[0];

      const material = (firstFilament?.type || 'PLA').toUpperCase();
      const colorHex = firstFilament?.color || '#10b981';
      const needAms = Boolean(inst.needAms || (inst.materialColorCnt && inst.materialColorCnt > 1));

      return {
        id: inst.id,
        title: inst.title || 'Profilo Standard',
        predictionSeconds,
        printHours,
        printMinutes,
        weightGrams,
        material,
        colorHex,
        needAms,
        plateCount: plates.length || 1,
        isDefault: Boolean(inst.isDefault || inst.id === data.defaultInstanceId),
      };
    });

    // Seleziona il profilo richiesto tramite profileId o quello di default
    let selectedProfile: MakerWorldProfileSummary | null = null;
    if (profileId) {
      selectedProfile = availableProfiles.find(p => String(p.id) === String(profileId)) || null;
    }
    if (!selectedProfile && data.defaultInstanceId) {
      selectedProfile = availableProfiles.find(p => String(p.id) === String(data.defaultInstanceId)) || null;
    }
    if (!selectedProfile && availableProfiles.length > 0) {
      selectedProfile = availableProfiles.find(p => p.isDefault) || availableProfiles[0];
    }

    const result: MakerWorldResponseData = {
      success: true,
      modelId,
      modelTitle: data.title || 'Modello MakerWorld',
      modelSummary: data.summary ? data.summary.replace(/<[^>]+>/g, '').slice(0, 300) : '',
      coverUrl: data.coverUrl || (instances[0]?.cover) || '',
      authorName: data.designCreator?.name || 'MakerWorld Creator',
      selectedProfile,
      availableProfiles,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Errore chiamata MakerWorld API:', error);
    return NextResponse.json(
      { success: false, error: 'Errore di connessione a MakerWorld: ' + (error?.message || 'sconosciuto') },
      { status: 500 }
    );
  }
}
