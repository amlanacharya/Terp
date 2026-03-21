import { Express, Request } from 'express';
import listEndpoints from 'express-list-endpoints';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options'
  | 'head';

interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses: Record<string, unknown>;
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
}

interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: Record<string, unknown>;
  paths: Record<string, OpenApiPathItem>;
}

const defaultResponses = {
  '200': { description: 'Success' },
  '400': { description: 'Bad request' },
  '401': { description: 'Unauthorized' },
  '403': { description: 'Forbidden' },
  '404': { description: 'Not found' },
  '500': { description: 'Server error' },
};

function titleCase(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveTagName(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  const resource = apiIndex >= 0 ? segments[apiIndex + 1] : segments[0];

  if (!resource) {
    return 'General';
  }

  return titleCase(resource);
}

function buildPathParameters(pathname: string): Array<Record<string, unknown>> {
  return pathname
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => ({
      name: segment.slice(1),
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
}

function requiresBearerAuth(pathname: string): boolean {
  return ![
    '/api/health',
    '/api/auth/login',
    '/api/auth/signup',
    '/api/docs',
    '/api/docs.json',
    '/api/routes',
  ].includes(pathname);
}

function buildAutoOperation(method: HttpMethod, pathname: string): OpenApiOperation {
  const pathParameters = buildPathParameters(pathname);

  return {
    tags: [deriveTagName(pathname)],
    summary: `${method.toUpperCase()} ${pathname}`,
    description: 'Auto-generated from mounted Express routes. Add explicit schema details here as needed.',
    security: requiresBearerAuth(pathname) ? [{ bearerAuth: [] }] : undefined,
    parameters: pathParameters.length > 0 ? pathParameters : undefined,
    responses: defaultResponses,
  };
}

function createManualPaths(): Record<string, OpenApiPathItem> {
  return {
    '/api/health': {
      get: {
        tags: ['General'],
        summary: 'Health check',
        description: 'Simple backend health endpoint.',
        responses: {
          '200': {
            description: 'Backend is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                  },
                  required: ['status'],
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description: 'Authenticate a user and return a JWT token with profile details.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated successfully',
          },
          '400': { description: 'Email and password are required' },
          '401': { description: 'Invalid email or password' },
          '500': { description: 'Unable to sign in right now' },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Signup',
        description: 'Create a viewer account and return a JWT token with profile details.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  fullName: { type: 'string' },
                  phone: { type: 'string', nullable: true },
                },
                required: ['email', 'password', 'fullName'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Account created successfully' },
          '400': { description: 'Missing required fields' },
          '409': { description: 'User already exists' },
          '500': { description: 'Unable to create the account' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user profile',
        description: 'Return the currently authenticated user and profile.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user profile' },
          '401': { description: 'Missing, invalid, or expired token' },
          '404': { description: 'User profile not found' },
          '500': { description: 'Unable to fetch your profile' },
        },
      },
    },
    '/api/routes': {
      get: {
        tags: ['General'],
        summary: 'List mounted API routes',
        description: 'Return a simple JSON listing of mounted Express API routes.',
        responses: {
          '200': { description: 'Mounted routes list' },
        },
      },
    },
    '/api/docs.json': {
      get: {
        tags: ['General'],
        summary: 'OpenAPI JSON',
        description: 'Return the generated OpenAPI specification JSON.',
        responses: {
          '200': { description: 'OpenAPI document' },
        },
      },
    },
  };
}

function buildTags(paths: Record<string, OpenApiPathItem>): Array<{ name: string; description: string }> {
  const tagNames = new Set<string>();

  for (const pathItem of Object.values(paths)) {
    for (const operation of Object.values(pathItem)) {
      if (!operation?.tags) {
        continue;
      }

      for (const tag of operation.tags) {
        tagNames.add(tag);
      }
    }
  }

  return Array.from(tagNames)
    .sort((left, right) => left.localeCompare(right))
    .map((tag) => ({
      name: tag,
      description: `${tag} endpoints`,
    }));
}

function getServerBaseUrl(req: Request): string {
  const explicitBaseUrl = process.env.PUBLIC_API_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, '');
  }

  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = req.get('host');

  if (!host) {
    return 'http://localhost:3001';
  }

  return `${protocol}://${host}`;
}

export function buildOpenApiSpec(app: Express, req: Request): OpenApiDocument {
  const baseSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'TravelERP Backend API',
        version: '1.0.0',
        description:
          'Browser-friendly API reference for the TravelERP Express backend. Start with /api/routes for the raw list and use this Swagger UI for exploration.',
      },
      servers: [
        {
          url: getServerBaseUrl(req),
          description: 'Current server origin',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    apis: [],
  }) as OpenApiDocument;

  const paths: Record<string, OpenApiPathItem> = {
    ...createManualPaths(),
  };

  for (const endpoint of listEndpoints(app)) {
    if (!endpoint.path.startsWith('/api')) {
      continue;
    }

    if (endpoint.path === '/api') {
      continue;
    }

    const pathItem = paths[endpoint.path] ?? {};
    for (const rawMethod of endpoint.methods) {
      const method = rawMethod.toLowerCase() as HttpMethod;
      if (pathItem[method]) {
        continue;
      }

      pathItem[method] = buildAutoOperation(method, endpoint.path);
    }
    paths[endpoint.path] = pathItem;
  }

  return {
    ...baseSpec,
    paths,
    tags: buildTags(paths),
  };
}

export function buildRoutesIndex(app: Express) {
  return listEndpoints(app)
    .filter((endpoint) => endpoint.path.startsWith('/api') && endpoint.path !== '/api')
    .map((endpoint) => ({
      path: endpoint.path,
      methods: endpoint.methods,
      middlewares: endpoint.middlewares,
      tag: deriveTagName(endpoint.path),
      authLikelyRequired: requiresBearerAuth(endpoint.path),
    }));
}

export const swaggerUiHandlers = swaggerUi.serve;
export const createSwaggerUiHandler = () =>
  swaggerUi.setup(undefined, {
    customSiteTitle: 'TravelERP API Docs',
    explorer: true,
    swaggerOptions: {
      url: '/api/docs.json',
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
    },
  });
