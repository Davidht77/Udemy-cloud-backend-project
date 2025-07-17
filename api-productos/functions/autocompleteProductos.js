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

module.exports.autocompleteProductos = async (event) => {
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

    // 6. Extraer el parámetro de autocompletado del query string
    const queryParams = event.queryStringParameters || {};
    const prefix = queryParams.q;
    const size = parseInt(queryParams.size) || 5; // Número de sugerencias por defecto

    if (!prefix) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Parámetro de búsqueda "q" es requerido' }),
      };
    }

    // Validar que el prefix tenga al menos 2 caracteres para evitar demasiadas sugerencias
    if (prefix.length < 2) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Mínimo 2 caracteres requeridos',
          prefix: prefix,
          suggestions: []
        }),
      };
    }

    // 7. Construir la query de autocompletado de Elasticsearch
    const elasticsearchQuery = buildAutocompleteQuery(prefix, size, tenantId);

    console.log('Query de autocompletado enviada a Elasticsearch:', JSON.stringify(elasticsearchQuery, null, 2));

    // 8. Reenviar la petición a Elasticsearch
    const elasticsearchResponse = await forwardToElasticsearch(elasticsearchQuery);

    // 9. Formatear la respuesta para que sea consistente con el resto del API
    const formattedResponse = formatAutocompleteResponse(elasticsearchResponse, prefix, tenantId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(formattedResponse),
    };

  } catch (error) {
    console.error('Error en autocompleteProductos:', error);
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
 * Construye la query de autocompletado de Elasticsearch
 * Usa la estructura: {"suggest": {"my_suggestions": {"prefix": "nft", "completion": {"field": "nombre.completion_suggester", "size": 5}}}}
 * Pero también incluye filtro de tenant_id
 */
function buildAutocompleteQuery(prefix, size, tenantId) {
  return {
    suggest: {
      my_suggestions: {
        prefix: prefix,
        completion: {
          field: "nombre.completion_suggester",
          size: size,
          contexts: {
            tenant_id: [tenantId] // Filtro de tenant_id en el contexto
          }
        }
      }
    }
  };
}

/**
 * Formatea la respuesta de autocompletado de Elasticsearch para que sea consistente con el resto del API
 */
function formatAutocompleteResponse(elasticsearchResponse, prefix, tenantId) {
  // Extraer las sugerencias de la respuesta de Elasticsearch
  const suggestions = elasticsearchResponse.suggest?.my_suggestions?.[0]?.options || [];
  
  // Transformar cada sugerencia a formato limpio
  const formattedSuggestions = suggestions.map(suggestion => {
    const source = suggestion._source || {};
    return {
      text: suggestion.text,
      score: suggestion._score,
      curso: {
        curso_id: source.sku || suggestion._id,
        tenant_id: tenantId,
        nombre: source.nombre,
        instructor: source.instructor,
        duracion: source.duracion,
        precio: source.precio,
        rating: source.rating,
        nivel: source.nivel,
        imagen_url: source.imagen_url
      }
    };
  });

  return {
    message: `Autocompletado para "${prefix}"`,
    prefix: prefix,
    suggestions_count: formattedSuggestions.length,
    suggestions: formattedSuggestions
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

    console.log(`Enviando petición de autocompletado a: http://${ES_HOST}:${ES_PORT}/${ES_INDEX}/_search`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Respuesta de autocompletado de Elasticsearch:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('Error parsing Elasticsearch autocomplete response:', error);
          reject(new Error('Error parsing Elasticsearch autocomplete response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error connecting to Elasticsearch for autocomplete:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}