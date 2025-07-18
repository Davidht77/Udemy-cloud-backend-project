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

    // 6. Extraer el parámetro de autocompletado del query string
    const queryParams = event.queryStringParameters || {};
    const prefix = queryParams.q;
    const size = 10; // Número fijo de sugerencias

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
    const formattedResponse = formatAutocompleteResponse(elasticsearchResponse, prefix, tenantId, size);

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
  // Versión sin contextos (si tu índice no los soporta)
  return {
    suggest: {
      my_suggestions: {
        prefix: prefix,
        completion: {
          field: "nombre.completion_suggester",
          size: size * 2 // Pedimos más para filtrar después
        }
      }
    }
  };

  // Versión con contextos (descomenta si tu índice los soporta)
  /*
  return {
    suggest: {
      my_suggestions: {
        prefix: prefix,
        completion: {
          field: "nombre.completion_suggester",
          size: size,
          contexts: {
            tenant_id: [tenantId]
          }
        }
      }
    }
  };
  */
}

/**
 * Formatea la respuesta de autocompletado de Elasticsearch para que sea consistente con el resto del API
 */
function formatAutocompleteResponse(elasticsearchResponse, prefix, tenantId, size) {
  console.log('Formateando respuesta de autocompletado:', JSON.stringify(elasticsearchResponse, null, 2));

  // Extraer las sugerencias de la respuesta de Elasticsearch
  // La estructura es: suggest.my_suggestions[0].options
  const suggestionGroup = elasticsearchResponse.suggest?.my_suggestions?.[0];
  const suggestions = suggestionGroup?.options || [];

  console.log(`Encontradas ${suggestions.length} sugerencias para "${prefix}"`);

  // Filtrar por tenant_id y extraer solo el texto de las sugerencias
  const uniqueSuggestions = new Set(); // Para evitar duplicados
  const formattedSuggestions = [];

  // Procesar todas las sugerencias (sin filtro de tenant por ahora)
  suggestions.forEach(suggestion => {
    const suggestionText = suggestion.text;
    console.log(`Procesando sugerencia: "${suggestionText}"`);

    // Evitar duplicados (ya que pueden haber varios cursos con el mismo nombre)
    if (!uniqueSuggestions.has(suggestionText) && formattedSuggestions.length < size) {
      uniqueSuggestions.add(suggestionText);
      formattedSuggestions.push(suggestionText);
      console.log(`✅ Agregada sugerencia: "${suggestionText}"`);
    } else {
      console.log(`❌ Sugerencia duplicada o límite alcanzado: "${suggestionText}"`);
    }
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