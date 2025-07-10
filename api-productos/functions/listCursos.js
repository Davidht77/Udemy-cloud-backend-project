'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.CURSOS_TABLE_NAME;

// Función para extraer el tenant_id desde query params
const getTenantId = (event) => {
  return event.queryStringParameters ? event.queryStringParameters.tenant_id : null;
};

module.exports.listCursos = async (event) => {
  // Manejo del preflight (verificación CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Auth-Token,tenant-id',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: ''
    };
  }

  try {
    const tenantId = getTenantId(event);
    const { limit, lastEvaluatedKey } = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'Missing tenant_id' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
      },
      Limit: limit ? parseInt(limit) : 10,
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = JSON.parse(
        Buffer.from(lastEvaluatedKey, 'base64').toString('ascii')
      );
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Lista de cursos obtenida',
        cursos: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
          : undefined,
      }),
    };
  } catch (error) {
    console.error('Error listing cursos:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Could not list cursos',
        error: error.message,
      }),
    };
  }
};