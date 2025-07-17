'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.CURSOS_TABLE_NAME;
const STAGE = process.env.STAGE || 'dev';
const VALIDADOR_FN_NAME = `api-usuarios-${STAGE}-validarToken`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

module.exports.searchCursosByName = async (event) => {
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
    const { name, limit, lastEvaluatedKey } = event.queryStringParameters || {};

    if (!name) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Falta el parámetro name para la búsqueda' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenant_id = :tenantId',
      FilterExpression: 'contains(nombre, :name)',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':name': name,
      },
    };

    if (limit) {
      params.Limit = parseInt(limit);
    }

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString('ascii'));
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Cursos encontrados con el nombre que contiene '${name}'`,
        cursos: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : undefined,
      }),
    };
  } catch (error) {
    console.error('Error searching cursos by name:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No se pudo buscar cursos por nombre', error: error.message }),
    };
  }
};