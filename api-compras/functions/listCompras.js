'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { validateTokenDirect } = require('./utils/tokenValidator');

const TABLE_NAME = process.env.COMPRAS_TABLE_NAME;
const ACCESS_TOKEN_TABLE_NAME = process.env.ACCESS_TOKEN_TABLE_NAME;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

module.exports.listCompras = async (event) => {
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
    const { user_id, limit, lastEvaluatedKey } = event.queryStringParameters || {};

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
      },
    };

    if (user_id) {
      params.FilterExpression = 'user_id = :user_id';
      params.ExpressionAttributeValues[':user_id'] = user_id;
    }

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
        message: 'Lista de compras obtenida',
        compras: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : undefined,
      }),
    };
  } catch (error) {
    console.error('Error listing compras:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No se pudo obtener la lista de compras', error: error.message }),
    };
  }
};