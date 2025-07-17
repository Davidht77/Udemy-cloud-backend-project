'use strict';

const AWS = require('aws-sdk');
const http = require('http');
const lambda = new AWS.Lambda();

const STAGE = process.env.STAGE || 'dev';
const VALIDADOR_FN_NAME = `api-usuarios-${STAGE}-validarToken`;

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

    // 3. Invocar la función Lambda validadora
    const validationResponse = await lambda.invoke({
      FunctionName: VALIDADOR_FN_NAME,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ headers: { Authorization: token } }),
    }).promise();

    const validationResult = JSON.parse(validationResponse.Payload);

    // 4. Verificar si el token es válido
    if (validationResult.statusCode !== 200) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Token inválido o expirado' }),
      };
    }

    // 5. Si el token es válido, obtener el tenant_id y proceder
    const authorizerContext = JSON.parse(validationResult.body);
    const tenantId = authorizerContext.tenant_id;

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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Búsqueda realizada exitosamente',
        search_term: searchTerm,
        results: elasticsearchResponse,
        tenant_id: tenantId
      }),
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