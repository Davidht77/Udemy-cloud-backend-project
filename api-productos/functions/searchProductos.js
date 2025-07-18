'use strict';

const AWS = require('aws-sdk');
const http = require('http');
const { validateTokenDirect } = require('./utils/tokenValidator');

const ACCESS_TOKEN_TABLE_NAME = process.env.ACCESS_TOKEN_TABLE_NAME;

// Configuración de Elasticsearch
const ES_HOST = process.env.ES_HOST || '34.206.17.81';
const ES_PORT = process.env.ES_PORT || 9200;
const ES_INDEX = process.env.ES_INDEX || 'productos';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

module.exports.searchProductos = async (event) => {
  // 1. Manejo de preflight (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // 2. Extraer el token de autorización
    const token = event.headers && event.headers.Authorization;
    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Token de autorización no proporcionado' }),
      };
    }

    // 3. Validar el token directamente contra DynamoDB
    const validationResult = await validateTokenDirect(token, ACCESS_TOKEN_TABLE_NAME);

    // 4. Verificar si el token es válido
    if (!validationResult.valid) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: validationResult.message }),
      };
    }

    // 5. Si el token es válido, obtener el tenant_id y proceder
    const tenantId = validationResult.tenant_id;

    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'No se pudo obtener tenant_id del token' }),
      };
    }

    // 6. Extraer el parámetro de búsqueda del query string
    const queryParams = event.queryStringParameters || {};
    const searchTerm = queryParams.q;

    if (!searchTerm) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Parámetro de búsqueda "q" es requerido' }),
      };
    }

    // 7. Construir la query de Elasticsearch automáticamente
    const elasticsearchQuery = buildElasticsearchQuery(searchTerm, tenantId);

    console.log('Query enviada a Elasticsearch:', JSON.stringify(elasticsearchQuery, null, 2));

    // 8. Reenviar la petición a Elasticsearch
    const elasticsearchResponse = await forwardToElasticsearch(elasticsearchQuery);

    // 9. Formatear la respuesta para que sea consistente con el resto del API
    const formattedResponse = formatSearchResponse(elasticsearchResponse, searchTerm, tenantId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(formattedResponse),
    };

  } catch (error) {
    console.error('Error en searchProductos:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error interno del servidor',
        error: error.message
      }),
    };
  }
};

/**
 * Construye la query de Elasticsearch con el término de búsqueda
 * Siempre usa la estructura: {"query": {"match": {"nombre.autocomplete": {"query": "término"}}}}
 */
function buildElasticsearchQuery(searchTerm, tenantId) {
  return {
    query: {
      bool: {
        must: [
          {
            match: {
              "nombre.autocomplete": {
                query: searchTerm
              }
            }
          }
        ]
      }
    }
  };
}

/**
 * Formatea la respuesta de Elasticsearch para que sea consistente con el resto del API
 */
function formatSearchResponse(elasticsearchResponse, searchTerm, tenantId) {
  // Extraer los productos de la respuesta de Elasticsearch
  const hits = elasticsearchResponse.hits?.hits || [];

  // Transformar cada hit a formato de curso estándar
  const cursos = hits.map(hit => {
    const source = hit._source;
    return {
      curso_id: source.sku || hit._id,
      tenant_id: tenantId,
      nombre: source.nombre,
      descripcion: source.descripcion,
      instructor: source.instructor,
      duracion: source.duracion,
      imagen_url: source.imagen_url,
      categories: source.categories,
      precio: source.precio,
      rating: source.rating,
      nivel: source.nivel,
      estudiantes: source.estudiantes
    };
  });

  // Información de paginación y estadísticas
  const total = elasticsearchResponse.hits?.total?.value || 0;
  const took = elasticsearchResponse.took || 0;

  return {
    message: `Búsqueda completada para "${searchTerm}"`,
    search_term: searchTerm,
    total_results: total,
    results_count: cursos.length,
    search_time_ms: took,
    cursos: cursos
  };
}

/**
 * Reenvía la petición a Elasticsearch
 */
function forwardToElasticsearch(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(query);

    const options = {
      hostname: ES_HOST,
      port: ES_PORT,
      path: `/${ES_INDEX}/_search`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`Enviando petición a: http://${ES_HOST}:${ES_PORT}/${ES_INDEX}/_search`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Respuesta de Elasticsearch:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('Error parsing Elasticsearch response:', error);
          reject(new Error('Error parsing Elasticsearch response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error connecting to Elasticsearch:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}