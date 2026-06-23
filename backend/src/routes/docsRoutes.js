import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '../docs/openapi.js';

/**
 * API documentation surface:
 *   GET /api/docs          → interactive Swagger UI (OpenAPI 3.1)
 *   GET /api/openapi.json  → the raw machine-readable spec
 *
 * The spec is built once at module load. Docs can be disabled in an
 * environment by setting ENABLE_API_DOCS=false.
 */
const router = express.Router();

const spec = buildOpenApiSpec();

// Raw spec endpoint (useful for codegen / Postman / external gateways).
router.get('/openapi.json', (req, res) => {
  res.json(spec);
});

// Interactive Swagger UI.
router.use(
  '/docs',
  swaggerUi.serveFiles(spec),
  swaggerUi.setup(spec, {
    customSiteTitle: 'Swarm API — Reference',
    swaggerOptions: {
      docExpansion: 'none',
      defaultModelsExpandDepth: 1,
      tryItOutEnabled: true,
      persistAuthorization: true
    }
  })
);

export default router;
