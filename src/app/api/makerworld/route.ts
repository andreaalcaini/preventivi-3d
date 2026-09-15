import { NextRequest, NextResponse } from 'next/server';

export interface MakerWorldPlateInfo {
  index: number;
  name: string;
  thumbnailUrl: string;
  topPictureUrl: string;
  pickPictureUrl: string;
  weightGrams: number;
  predictionSeconds: number;
  filaments: Array<{ type: string; color: string; usedG?: number }>;
}

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
  plates?: MakerWorldPlateInfo[];
}

export interface MakerWorldPicture {
  url: string;
  name?: string;
}

export interface MakerWorldResponseData {
  success: boolean;
  modelId: string;
  modelTitle: string;
  modelSummary: string;
  coverUrl: string;
  authorName: string;
  pictures?: MakerWorldPicture[];
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
    const endpointUrls = [
      `https://api.bambulab.com/v1/design-service/design/${encodeURIComponent(modelId)}`,
      `https://makerworld.com/api/v1/design-service/design/${encodeURIComponent(modelId)}`
    ];

    let response: Response | null = null;
    for (const testUrl of endpointUrls) {
      try {
        const res = await fetch(testUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://makerworld.com/',
          },
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          response = res;
          break;
        }
      } catch {
        // prova il prossimo endpoint
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { success: false, error: `MakerWorld non ha risposto correttamente` },
        { status: response ? response.status : 502 }
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

      const platesRaw: any[] = inst.extention?.modelInfo?.plates || [];
      const plates: MakerWorldPlateInfo[] = platesRaw.map((p: any, idx: number) => ({
        index: p.index ?? (idx + 1),
        name: p.name || `Piatto ${p.index ?? (idx + 1)}`,
        thumbnailUrl: p.thumbnail?.url || '',
        topPictureUrl: p.top_picture?.url || p.thumbnail?.url || '',
        pickPictureUrl: p.pick_picture?.url || '',
        weightGrams: Math.round(Number(p.weight) || 0),
        predictionSeconds: Number(p.prediction) || 0,
        filaments: Array.isArray(p.filaments) ? p.filaments.map((f: any) => ({
          type: (f.type || 'PLA').toUpperCase(),
          color: f.color || '#10b981',
          usedG: Math.round(Number(f.usedG) || 0)
        })) : []
      }));

      const firstFilament = platesRaw.flatMap((p: any) => p.filaments || [])[0];

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
        plates
      };
    });

    // Raccoglie immagini e render del modello
    const instancePics: MakerWorldPicture[] = Array.isArray(instances[0]?.pictures)
      ? instances[0].pictures.filter((p: any) => p && p.url).map((p: any) => ({ url: p.url, name: p.name || 'Foto' }))
      : [];
    const designPics: MakerWorldPicture[] = Array.isArray(data.designExtension?.design_pictures)
      ? data.designExtension.design_pictures.filter((p: any) => p && p.url).map((p: any) => ({ url: p.url, name: p.name || 'Render' }))
      : [];
    
    const allPicsMap = new Map<string, MakerWorldPicture>();
    if (data.coverUrl) allPicsMap.set(data.coverUrl, { url: data.coverUrl, name: 'Copertina Principale' });
    [...instancePics, ...designPics].forEach(p => {
      if (p.url && !allPicsMap.has(p.url)) {
        allPicsMap.set(p.url, p);
      }
    });
    const pictures = Array.from(allPicsMap.values());

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
      pictures,
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
