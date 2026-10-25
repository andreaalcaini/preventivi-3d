import { NextResponse } from 'next/server';
import pkg from '../../../../../package.json';

// Letto a runtime: GIT_SHA e BUILD_TIME vengono iniettati nell'immagine Docker dalla CI
export const dynamic = 'force-dynamic';

export async function GET() {
  const commit = process.env.GIT_SHA || 'dev';

  return NextResponse.json(
    {
      version: pkg.version,
      commit,
      commitShort: commit.slice(0, 7),
      buildTime: process.env.BUILD_TIME || null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
