'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.CURSOS_TABLE_NAME;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

module.exports.searchCursosByCategory = async (event) => {
  // 1. Manejo de preflight (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // 2. Obtener parámetros de la consulta
    const category = event.queryStringParameters ? event.queryStringParameters.category : null;
    const tenantId = event.queryStringParameters ? event.queryStringParameters.tenant_id : null;

    if (!category) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Falta el parámetro category para la búsqueda' }),
      };
    }

    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Falta el parámetro tenant_id para la búsqueda' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'contains(categories, :category) AND tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':category': category,
        ':tenant_id': tenantId,
      },
    };

    const result = await dynamodb.scan(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Cursos encontrados en la categoría '${category}'`,
        cursos: result.Items,
      }),
    };
  } catch (error) {
    console.error('Error searching cursos by category:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No se pudo buscar cursos por categoría', error: error.message }),
    };
  }
};