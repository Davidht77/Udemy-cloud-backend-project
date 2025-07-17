'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.CURSOS_TABLE_NAME;
// El nombre de la función validadora se construye dinámicamente
const STAGE = process.env.STAGE || 'dev';
const VALIDADOR_FN_NAME = `api-usuarios-${STAGE}-validarToken`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

module.exports.getCurso = async (event) => {
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
      Payload: JSON.stringify({ headers: { Authorization: token } }), // El validador espera el token en este formato
    }).promise();

    const validationResult = JSON.parse(validationResponse.Payload);

    // 4. Verificar si el token es válido
    if (validationResult.statusCode !== 200) {
      return {
        statusCode: 403, // Forbidden
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Token inválido o expirado' }),
      };
    }

    // 5. Si el token es válido, obtener el tenant_id y proceder
    const authorizerContext = JSON.parse(validationResult.body);
    const tenantId = authorizerContext.tenant_id;
    const { id } = event.pathParameters;

    if (!id || !tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Falta curso_id o tenant_id no se pudo derivar del token' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id: tenantId,
        curso_id: id,
      },
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Curso no encontrado' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: `Curso ${id} obtenido`, curso: result.Item }),
    };

  } catch (error) {
    console.error('Error en getCurso:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No se pudo obtener el curso', error: error.message }),
    };
  }
};