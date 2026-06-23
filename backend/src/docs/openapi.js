/**
 * OpenAPI 3.1 specification for the Swarm backend API.
 *
 * This documents the ACTUAL mounted surface (see index.js). Every path below is
 * also available under the additive `/api/v1` prefix. Endpoints flagged
 * "⚠️ Unauthenticated" are exposed without auth today and are tracked for the
 * security-hardening pass — the flag is intentional so the gap is visible.
 */

const bearer = [{ bearerAuth: [] }];

// Standard error envelope produced by the central error handler.
const errorResponse = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' }
    }
  }
});

export const buildOpenApiSpec = () => ({
  openapi: '3.1.0',
  info: {
    title: 'Swarm Agentic Platform API',
    version: '1.0.0',
    description: [
      'REST + SSE API for the multi-agent LiveKit "Swarm" console: authentication,',
      'agent dispatch, LLM telemetry/tracing, security & compliance audits, web/GitHub',
      'knowledge ingestion, careers, and the battle arena.',
      '',
      '**Versioning:** every path is also served under `/api/v1/...` (additive alias).',
      '**Errors:** all handled errors share the envelope `{ error, code, traceId }`.',
      '**Correlation:** every response carries an `X-Request-Id` header (echo of an',
      'inbound `X-Request-Id` when provided).'
    ].join('\n')
  },
  servers: [
    { url: '/', description: 'Current host — legacy/stable paths' },
    { url: '/api/v1', description: 'Versioned alias (prefix the resource paths below)' }
  ],
  tags: [
    { name: 'Auth', description: 'Registration, login, password reset, session identity' },
    { name: 'Rooms & Agents', description: 'LiveKit token issuance, agent dispatch, copilot' },
    { name: 'Telemetry', description: 'LLM trace ingestion and retrieval' },
    { name: 'Security & Compliance', description: 'Agent security scans, NIST/OWASP audits' },
    { name: 'Knowledge Ingestion', description: 'Web crawler and GitHub repo ingestion' },
    { name: 'Careers', description: 'Job applications and resume OCR' },
    { name: 'Battle Arena', description: 'Token verification and leaderboard' },
    { name: 'Changelog', description: 'Commit feed like counts' },
    { name: 'Config', description: 'White-label runtime configuration' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT issued by `/api/auth/login` or `/api/auth/register`. Send as `Authorization: Bearer <token>`.'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error', 'code'],
        properties: {
          error: { type: 'string', description: 'Human-readable message. Masked to a generic string for 5xx.' },
          code: { type: 'string', description: 'Machine-readable error code.', examples: ['VALIDATION_ERROR', 'EMAIL_TAKEN', 'RATE_LIMITED'] },
          traceId: { type: ['string', 'null'], description: 'Correlation id, mirrors the X-Request-Id header.' },
          details: {
            type: 'array',
            description: 'Field-level breakdown for 422 validation errors.',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'operator', 'viewer'] },
          companyName: { type: ['string', 'null'] },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AuthSuccess: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT, 2h expiry.' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      Trace: {
        type: 'object',
        properties: {
          run_id: { type: 'string' },
          input_id: { type: ['string', 'null'] },
          output_id: { type: ['string', 'null'] },
          agent: { type: ['string', 'null'] },
          model: { type: 'string' },
          inputs: { type: 'array', items: { type: 'object', additionalProperties: true } },
          outputs: { type: 'string' },
          prompt_tokens: { type: 'integer' },
          completion_tokens: { type: 'integer' },
          input_cost: { type: 'number' },
          output_cost: { type: 'number' },
          stt_cost: { type: 'number' },
          tts_cost: { type: 'number' },
          total_cost: { type: 'number' },
          status: { type: 'string', enum: ['streaming', 'completed', 'failed'] },
          timestamp: { type: 'string', format: 'date-time' },
          total_latency: { type: 'number' },
          ttft: { type: 'number' },
          tool_latency: { type: 'number' },
          otps: { type: 'number' },
          tool_calls: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }
      }
    },
    responses: {
      Unauthorized: errorResponse('Missing or invalid authentication token.'),
      Forbidden: errorResponse('Authenticated but lacking the required role.'),
      ValidationError: errorResponse('Request failed schema validation (code: VALIDATION_ERROR).'),
      RateLimited: errorResponse('Too many requests (code: RATE_LIMITED).'),
      NotFound: errorResponse('Resource or route not found.'),
      ServerError: errorResponse('Internal server error (message masked).')
    }
  },
  security: [],
  paths: {
    // ──────────────────────────── Auth ────────────────────────────
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account',
        description: 'Public. The first ever account becomes `admin`; subsequent accounts default to `operator`. Rate limited (5 / 15 min).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', maxLength: 255 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', description: '≥8 chars incl. upper, lower, number, special.' },
                  role: { type: 'string', enum: ['admin', 'operator', 'viewer'] },
                  companyName: { type: 'string', maxLength: 255 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSuccess' } } } },
          400: errorResponse('Weak password (code: WEAK_PASSWORD).'),
          409: errorResponse('Email already registered (code: EMAIL_TAKEN).'),
          422: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimited' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive a JWT',
        description: 'Public. Rate limited (5 / 15 min). Constant-time comparison guards against user enumeration.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSuccess' } } } },
          401: errorResponse('Invalid credentials (code: INVALID_CREDENTIALS).'),
          422: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimited' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current authenticated user',
        security: bearer,
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        description: 'Public. Always returns 200 to prevent email enumeration. Rate limited (3 / 15 min).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } }
        },
        responses: {
          200: { description: 'Accepted (generic message regardless of account existence).' },
          422: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimited' }
        }
      }
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Complete a password reset',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string' } } } } }
        },
        responses: {
          200: { description: 'Password updated.' },
          400: errorResponse('Invalid/expired token or weak password.'),
          422: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimited' }
        }
      }
    },

    // ──────────────────────── Rooms & Agents ────────────────────────
    '/talk-to-ai': {
      post: {
        tags: ['Rooms & Agents'],
        summary: 'Dispatch an agent and mint a LiveKit token',
        security: bearer,
        description: 'Roles: admin, operator. Creates a room, dispatches the selected agent, returns a publish-capable LiveKit token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['agentType'],
                properties: {
                  agentType: { type: 'string', enum: ['lina', 'bi', 'bi2', 'nova', 'astra', 'rehearsal', 'seva', 'martech', 'aivyuh', 'octane', 'DEVOPS_GENI', 'shoppe'] },
                  userName: { type: 'string', description: 'Optional; a Guest id is generated when omitted.' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, roomName: { type: 'string' }, identity: { type: 'string' }, isAI: { type: 'boolean' } } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/copilot/chat': {
      post: {
        tags: ['Rooms & Agents'],
        summary: 'Streaming copilot chat (Server-Sent Events)',
        security: bearer,
        description: 'Roles: admin, operator. Responds with `text/event-stream`. Each `data:` frame is `{chunk}`, then `{sessionId}`, terminating with `data: [DONE]`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, sessionId: { type: 'string' } } } } }
        },
        responses: {
          200: { description: 'SSE stream', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          400: errorResponse('Query is required.'),
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/copilot/session/clear': {
      post: {
        tags: ['Rooms & Agents'],
        summary: 'Clear a copilot session',
        security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['sessionId'], properties: { sessionId: { type: 'string' } } } } } },
        responses: { 200: { description: 'Cleared.' }, 400: errorResponse('Session ID is required.'), 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } }
      }
    },
    '/trigger-reels': {
      post: {
        tags: ['Rooms & Agents'],
        summary: 'Spawn a background reels-generation agent',
        security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentType'], properties: { agentType: { type: 'string' }, blogPath: { type: 'string' }, freeIdea: { type: 'string' } } } } } },
        responses: { 200: { description: 'Agent deployed.' }, 400: errorResponse('blogPath/freeIdea and agentType required.'), 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } }
      }
    },
    '/insights': {
      get: { tags: ['Rooms & Agents'], summary: 'List published Astra insight blogs', responses: { 200: { description: 'Array of insight objects.' } } }
    },
    '/weather': {
      get: {
        tags: ['Rooms & Agents'],
        summary: 'Proxy current weather for a coordinate',
        parameters: [
          { name: 'latitude', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'longitude', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Weather data.' }, 400: errorResponse('latitude and longitude required.') }
      }
    },

    // ──────────────────────────── Telemetry ────────────────────────────
    '/api/llm-trace': {
      post: {
        tags: ['Telemetry'],
        summary: 'Ingest an LLM trace event',
        description: '⚠️ Unauthenticated. High-frequency endpoint emitted by agent processes; exempt from the global rate limiter.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['event', 'run_id'], properties: { event: { type: 'string', enum: ['llm_start', 'llm_chunk', 'llm_end', 'llm_error'] }, run_id: { type: 'string' }, data: { type: 'object', additionalProperties: true } } } } } },
        responses: { 200: { description: 'Recorded.' }, 500: { $ref: '#/components/responses/ServerError' } }
      }
    },
    '/api/llm-trace/tool-call': {
      post: {
        tags: ['Telemetry'],
        summary: 'Append a tool-call to a trace',
        description: '⚠️ Unauthenticated.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['run_id', 'name'], properties: { run_id: { type: 'string' }, name: { type: 'string' }, duration: { type: 'number' } } } } } },
        responses: { 200: { description: 'Recorded.' }, 400: errorResponse('run_id and name required.') }
      }
    },
    '/api/llm-traces': {
      get: {
        tags: ['Telemetry'],
        summary: 'List recent traces (paginated, filterable)',
        security: bearer,
        description: 'Roles: admin, operator, viewer. Returns a plain array (no envelope) for client compatibility.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          { name: 'agent', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['streaming', 'completed', 'failed'] } }
        ],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Trace' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          422: { $ref: '#/components/responses/ValidationError' }
        }
      },
      delete: {
        tags: ['Telemetry'],
        summary: 'Clear all traces',
        security: bearer,
        description: 'Role: admin only.',
        responses: { 200: { description: 'Truncated.' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } }
      }
    },
    '/api/evaluate-hallucination': {
      post: {
        tags: ['Telemetry'],
        summary: 'LLM-judge hallucination score for a run',
        security: bearer,
        description: 'Roles: admin, operator.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['run_id', 'outputs'], properties: { run_id: { type: 'string' }, inputs: { type: 'array', items: { type: 'object', additionalProperties: true } }, outputs: { type: 'string' } } } } } },
        responses: { 200: { description: 'Score + reasoning + flags.' }, 400: errorResponse('run_id and outputs required.'), 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } }
      }
    },
    '/api/hallucination-results': {
      get: { tags: ['Telemetry'], summary: 'Map of evaluated hallucination results', security: bearer, responses: { 200: { description: 'OK' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },

    // ─────────────────── Security & Compliance ───────────────────
    '/security/status': {
      get: { tags: ['Security & Compliance'], summary: 'Aggregated agent security + scope status', security: bearer, description: 'Roles: admin, operator, viewer.', responses: { 200: { description: 'OK' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/security/scan': {
      post: { tags: ['Security & Compliance'], summary: 'Run the Aivyuh swarm security scan', security: bearer, description: 'Roles: admin, operator.', responses: { 200: { description: 'Scan result.' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/security/aivyuh-scan': {
      post: { tags: ['Security & Compliance'], summary: 'Run the Aivyuh scan (alias)', security: bearer, responses: { 200: { description: 'Scan result.' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/security/nist-scan': {
      post: { tags: ['Security & Compliance'], summary: 'Run NIST AI RMF scope + compliance scan', security: bearer, parameters: [{ name: 'agent', in: 'query', schema: { type: 'string' }, description: 'Optional targeted agent.' }], responses: { 200: { description: 'Analysis items.' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/security/remediate': {
      post: { tags: ['Security & Compliance'], summary: 'Update an OWASP-LLM control state', security: bearer, description: 'Role: admin only.', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { vulnId: { type: 'string', description: 'A control id (llm01..llm10) or "all".' }, status: { type: 'string' } } } } } }, responses: { 200: { description: 'Updated scan.' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/detokenize': {
      post: { tags: ['Security & Compliance'], summary: 'Reverse Securelytix tokenization', security: bearer, description: '⚠️ Any authenticated role today (no role gate) — sensitive-data exposure tracked for the security pass.', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { data: {} } } } } }, responses: { 200: { description: 'Detokenized payload.' }, 401: { $ref: '#/components/responses/Unauthorized' } } }
    },
    '/compliance/summary': {
      get: { tags: ['Security & Compliance'], summary: 'Compliance KPI summary', security: bearer, responses: { 200: { description: 'OK' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/compliance/logs': {
      get: { tags: ['Security & Compliance'], summary: 'Paginated compliance log feed', security: bearer, parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: { 200: { description: '{ logs, total, page, limit }' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },
    '/compliance/log': {
      post: { tags: ['Security & Compliance'], summary: 'Append a compliance log entry', security: bearer, description: 'Roles: admin, operator.', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['event_type', 'severity'], properties: { event_type: { type: 'string' }, severity: { type: 'string' }, agent: { type: 'string' }, details: { type: 'object', additionalProperties: true } } } } } }, responses: { 201: { description: 'Created.' }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } }
    },

    // ───────────────────── Knowledge Ingestion ─────────────────────
    '/api/crawler/config': {
      get: { tags: ['Knowledge Ingestion'], summary: 'Get crawler configuration', description: '⚠️ Unauthenticated.', responses: { 200: { description: 'Config.' } } },
      post: {
        tags: ['Knowledge Ingestion'], summary: 'Save crawler configuration',
        description: '⚠️ Unauthenticated.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['startUrl'], properties: { startUrl: { type: 'string', format: 'uri' }, includePattern: { type: 'string' }, excludePattern: { type: 'string' }, sitemapEnabled: { type: 'boolean' }, customSitemap: { type: 'string' }, jsRendering: { type: 'boolean' }, proxyEnabled: { type: 'boolean' }, extractPdfs: { type: 'boolean' }, mainCss: { type: 'string' }, excludeCss: { type: 'string' }, template: { type: 'string' } } } } } },
        responses: { 200: { description: 'Saved.' }, 400: errorResponse('startUrl is required.') }
      }
    },
    '/api/crawler/run': {
      post: { tags: ['Knowledge Ingestion'], summary: 'Trigger a crawl', description: '⚠️ Unauthenticated. Server-side fetch of the configured start URL (SSRF risk tracked for the security pass).', responses: { 200: { description: 'Crawl triggered.' }, 400: errorResponse('No crawl configuration found.') } }
    },
    '/api/crawler/status': {
      get: { tags: ['Knowledge Ingestion'], summary: 'Crawler status', description: '⚠️ Unauthenticated.', responses: { 200: { description: '{ status, last_crawled_at, last_error, pages_crawled }' } } }
    },
    '/api/github/config': {
      get: { tags: ['Knowledge Ingestion'], summary: 'Get GitHub ingestion config', description: '⚠️ Unauthenticated.', responses: { 200: { description: 'Config.' } } },
      post: { tags: ['Knowledge Ingestion'], summary: 'Save GitHub ingestion config', description: '⚠️ Unauthenticated. Stores a PAT — handle with care.', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['owner', 'name'], properties: { owner: { type: 'string' }, name: { type: 'string' }, token: { type: 'string' }, branchOrTag: { type: 'string' }, fileTypes: { type: 'array', items: { type: 'string' } }, directories: { type: 'array', items: { type: 'string' } }, fileIncludeRegex: { type: 'string' }, fileExcludeRegex: { type: 'string' } } } } } }, responses: { 200: { description: 'Saved.' } } }
    },
    '/api/github/run': {
      post: { tags: ['Knowledge Ingestion'], summary: 'Trigger GitHub repo ingestion', description: '⚠️ Unauthenticated.', responses: { 200: { description: 'Ingestion triggered.' } } }
    },
    '/api/github/status': {
      get: { tags: ['Knowledge Ingestion'], summary: 'GitHub ingestion status', description: '⚠️ Unauthenticated.', responses: { 200: { description: 'Status.' } } }
    },
    '/api/github/tree': {
      get: { tags: ['Knowledge Ingestion'], summary: 'Fetch a repository file tree', description: '⚠️ Unauthenticated.', parameters: [{ name: 'owner', in: 'query', schema: { type: 'string' } }, { name: 'name', in: 'query', schema: { type: 'string' } }, { name: 'branchOrTag', in: 'query', schema: { type: 'string' } }, { name: 'token', in: 'query', schema: { type: 'string' }, description: '⚠️ PAT in query string — avoid in production.' }], responses: { 200: { description: 'Tree.' } } }
    },

    // ──────────────────────────── Careers ────────────────────────────
    '/api/careers/apply': {
      post: {
        tags: ['Careers'],
        summary: 'Submit a job application (with optional resume OCR)',
        description: '⚠️ Unauthenticated. Resume is parsed via OCR + LLM in the background after a 201 is returned.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['roleId', 'roleTitle', 'name', 'email', 'mobile', 'message'], properties: { roleId: { type: 'string' }, roleTitle: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, mobile: { type: 'string' }, message: { type: 'string' }, portfolio: { type: 'string' }, resumeBase64: { type: 'string', description: 'Base64 data URL, ≤5MB.' }, resumeName: { type: 'string' } } } } } },
        responses: { 201: { description: '{ success, applicationId, submittedAt, battleToken }' }, 400: errorResponse('Missing required fields or invalid email.') }
      }
    },

    // ────────────────────────── Battle Arena ──────────────────────────
    '/api/battle/verify-token': {
      post: { tags: ['Battle Arena'], summary: 'Verify a battle token', description: '⚠️ Unauthenticated.', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } } }, responses: { 200: { description: '{ success, name, maskedEmail, role }' }, 400: errorResponse('Token is required.'), 404: errorResponse('Battle Token not found.') } }
    },
    '/api/battle/leaderboard': {
      get: { tags: ['Battle Arena'], summary: 'Top leaderboard (Redis ZSET)', responses: { 200: { description: '{ success, leaderboard }' } } }
    },

    // ──────────────────────────── Changelog ────────────────────────────
    '/api/changelog/likes': {
      get: { tags: ['Changelog'], summary: 'Like counts + this visitor’s liked SHAs', responses: { 200: { description: '{ counts, likedByMe, visitorId }' } } }
    },
    '/api/changelog/likes/{sha}/toggle': {
      post: { tags: ['Changelog'], summary: 'Toggle like for a commit SHA', parameters: [{ name: 'sha', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-f0-9]{7,40}$' } }], responses: { 200: { description: '{ sha, liked, count }' }, 400: errorResponse('Invalid SHA.') } }
    },

    // ──────────────────────────── Config ────────────────────────────
    '/api/whitelabel/config': {
      get: { tags: ['Config'], summary: 'Public white-label theme/config', description: 'Public — used to theme the login page pre-auth.', responses: { 200: { description: '{ clientName, theme, enabledAgents }' } } }
    }
  }
});

export default buildOpenApiSpec;
