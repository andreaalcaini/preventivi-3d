import { NextRequest, NextResponse } from 'next/server';
import pkg from '../../../../../package.json';
import { RESOURCES } from '@/lib/apiScopes';

/**
 * Specifica OpenAPI 3.1 dell'API per integrazioni. Pubblica (non contiene dati):
 * la importano ChatGPT Actions, agenti MCP con bridge OpenAPI, n8n, LangChain e simili.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const statusEnum = ['richiesta', 'in_attesa', 'in_stampa', 'pronto', 'saldato'];
  const json = (schema: object) => ({ 'application/json': { schema } });
  const errors = {
    '401': { description: 'Chiave mancante, non valida, revocata o scaduta', content: json({ $ref: '#/components/schemas/Error' }) },
    '403': { description: 'Permesso mancante o IP non consentito', content: json({ $ref: '#/components/schemas/Error' }) },
    '429': { description: 'Limite di richieste al minuto superato (vedi Retry-After)', content: json({ $ref: '#/components/schemas/Error' }) },
  };
  const op = (operationId: string, summary: string, scope: string, extra: object = {}) => ({
    operationId,
    summary,
    description: `Permesso richiesto: \`${scope}\`.`,
    'x-required-scope': scope,
    ...extra,
    responses: { '200': { description: 'OK' }, ...errors, ...((extra as { responses?: object }).responses || {}) },
  });

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Preventivi 3D API',
      version: pkg.version,
      description: [
        'API del gestionale di stampa 3D: lavori e preventivi, clienti, magazzino, manutenzione e statistiche.',
        'Autenticazione con una chiave personale creata in Integrazioni API: header `Authorization: Bearer p3d_...` oppure `X-API-Key`.',
        'Ogni chiave ha permessi per risorsa (`risorsa:read` / `risorsa:write`), può essere limitata a indirizzi IP e ha un limite di richieste al minuto, segnalato dagli header `X-RateLimit-Limit` e `X-RateLimit-Remaining`.',
        'Chiama prima `getMe` per sapere quali permessi ha la chiave.',
        `Permessi disponibili: ${RESOURCES.map(r => `${r.id} (${r.actions.join('/')}): ${r.description}`).join(' | ')}`,
      ].join('\n\n'),
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Chiave API p3d_...' },
        apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        QuoteSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', description: 'Nome del lavoro o del pezzo' },
            clientName: { type: 'string' },
            clientContact: { type: 'string' },
            material: { type: 'string', examples: ['PLA', 'PETG'] },
            quantity: { type: 'integer' },
            weightGrams: { type: 'number' },
            printTimeMinutes: { type: 'number' },
            total: { type: 'number', description: 'Prezzo totale in euro' },
            status: { type: 'string', enum: statusEnum },
            savedAt: { type: 'string' },
          },
        },
        Error: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
    paths: {
      '/api/v1/me': {
        get: op('getMe', 'Identità della chiave, proprietario e permessi effettivi', 'nessuno (basta una chiave valida)'),
      },
      '/api/v1/quotes': {
        get: op('listQuotes', 'Elenca lavori e preventivi, dal più recente', 'quotes:read', {
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: statusEnum } },
            { name: 'client', in: 'query', schema: { type: 'string' }, description: 'Filtro parziale sul nome cliente' },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Ricerca su nome, materiale e cliente' },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 50 } },
          ],
          responses: {
            '200': {
              description: 'Elenco',
              content: json({
                type: 'object',
                properties: { total: { type: 'integer' }, items: { type: 'array', items: { $ref: '#/components/schemas/QuoteSummary' } } },
              }),
            },
          },
        }),
        post: op('createQuoteRequest', 'Registra una nuova richiesta di preventivo da quotare', 'quotes:write', {
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['name', 'clientName'],
              properties: {
                name: { type: 'string' }, clientName: { type: 'string' }, clientContact: { type: 'string' },
                material: { type: 'string' }, color: { type: 'string' }, quantity: { type: 'integer', minimum: 1 },
                description: { type: 'string' }, weightGrams: { type: 'number' }, printTimeMinutes: { type: 'number' },
                makerWorldUrl: { type: 'string' },
              },
            }),
          },
          responses: { '201': { description: 'Creata' } },
        }),
      },
      '/api/v1/quotes/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        get: op('getQuote', 'Dettaglio completo di un lavoro (costi, distinta, file)', 'quotes:read', { responses: { '404': { description: 'Non trovato' } } }),
        patch: op('updateQuoteStatus', 'Cambia lo stato di un lavoro', 'quotes:write', {
          requestBody: {
            required: true,
            content: json({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: statusEnum } } }),
          },
          description: 'Permesso richiesto: `quotes:write`. Il primo passaggio a in_stampa o saldato scarica bobina e componenti dal magazzino.',
        }),
      },
      '/api/v1/clients': {
        get: op('listClients', 'Clienti con numero di lavori, totale speso e importo da saldare', 'clients:read', {
          parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        }),
      },
      '/api/v1/inventory': {
        get: op('getInventory', 'Bobine di filamento e componenti in magazzino', 'inventory:read', {
          parameters: [
            { name: 'material', in: 'query', schema: { type: 'string' } },
            { name: 'lowStock', in: 'query', schema: { type: 'boolean' }, description: 'Solo bobine sotto 200 g' },
          ],
        }),
      },
      '/api/v1/inventory/spools/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        patch: op('updateSpool', 'Imposta o scala il peso residuo di una bobina', 'inventory:write', {
          requestBody: {
            required: true,
            content: json({ type: 'object', properties: { weightRemaining: { type: 'number', minimum: 0 }, gramsUsed: { type: 'number', exclusiveMinimum: 0 } } }),
          },
        }),
      },
      '/api/v1/maintenance': {
        get: op('getMaintenance', 'Stampanti, contatori ore e interventi di manutenzione', 'maintenance:read'),
      },
      '/api/v1/analytics': {
        get: op('getAnalytics', 'Fatturato, utile, margine, ore di stampa, materiali e clienti principali', 'analytics:read'),
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
  });
}
