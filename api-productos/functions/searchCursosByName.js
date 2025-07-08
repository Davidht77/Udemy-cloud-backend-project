'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.CURSOS_TABLE_NAME;

const getTenantId = (event) => {
  return event.queryStringParameters ? event.queryStringParameters.tenant_id : null;
};

module.exports.searchCursosByName = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const { name, limit, lastEvaluatedKey } = event.queryStringParameters || {};

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

    if (!name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'Missing name query parameter for search' }),
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true
      },
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ message: 'Could not search cursos by name', error: error.message }),
    };
  }
};