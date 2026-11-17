import { NextRequest, NextResponse } from 'next/server';
import pkg from '../../../../../package.json';

/**
 * Specifica OpenAPI 3.1 dell'API per integrazioni. Pubblica (non contiene dati):
 * la importano ChatGPT Actions, agenti MCP con bridge OpenAPI, n8n, LangChain e simili.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const statusEnum = ['richiesta', 'in_attesa', 'in_stampa', 'pronto', 'saldato'];

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Preventivi 3D API',
      version: pkg.version,
      description:
        'API del gestionale di stampa 3D: preventivi e lavori, magazzino bobine e statistiche. ' +
        'Autenticazione con chiave API creata in Integrazioni: header "Authorization: Bearer p3d_..." oppure "X-API-Key". ' +
        'Le chiavi "read" accedono solo in GET, le chiavi "write" possono anche modificare.',
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
      '/api/v1/quotes': {
        get: {
          operationId: 'listQuotes',
          summary: 'Elenca preventivi e lavori, dal più recente',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: statusEnum } },
            { name: 'client', in: 'query', schema: { type: 'string' }, description: 'Filtro parziale sul nome cliente' },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Ricerca su nome, materiale e cliente' },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 50 } },
          ],
          responses: {
            '200': {
              description: 'Elenco',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      items: { type: 'array', items: { $ref: '#/components/schemas/QuoteSummary' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/quotes/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        get: {
          operationId: 'getQuote',
          summary: 'Dettaglio completo di un preventivo (costi, distinta materiali, file)',
          responses: { '200': { description: 'Preventivo' }, '404': { description: 'Non trovato' } },
        },
        patch: {
          operationId: 'updateQuoteStatus',
          summary: 'Cambia lo stato di un lavoro (richiede chiave write)',
          description: 'Il primo passaggio a in_stampa o saldato scarica bobina e componenti dal magazzino.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string', enum: statusEnum } },
                },
              },
            },
          },
          responses: { '200': { description: 'Aggiornato' }, '403': { description: 'Chiave in sola lettura' } },
        },
      },
      '/api/v1/inventory': {
        get: {
          operationId: 'getInventory',
          summary: 'Bobine di filamento e componenti in magazzino',
          parameters: [
            { name: 'material', in: 'query', schema: { type: 'string' } },
            { name: 'lowStock', in: 'query', schema: { type: 'boolean' }, description: 'Solo bobine sotto 200 g' },
          ],
          responses: { '200': { description: 'Magazzino' } },
        },
      },
      '/api/analytics': {
        get: {
          operationId: 'getAnalytics',
          summary: 'KPI: fatturato, margine, ore di stampa, materiali e clienti principali',
          responses: { '200': { description: 'Statistiche' } },
        },
      },
      '/api/maintenance': {
        get: {
          operationId: 'getMaintenance',
          summary: 'Stampanti, contatori ore e interventi di manutenzione',
          responses: { '200': { description: 'Manutenzione' } },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
  });
}
