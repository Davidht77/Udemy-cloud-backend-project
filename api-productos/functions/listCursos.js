'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'prod_cursos_curses';

const getTenantId = (event) => {
  return event.queryStringParameters ? event.queryStringParameters.tenant_id : null;
};

module.exports.listCursos = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const { limit, lastEvaluatedKey } = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing tenant_id' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenant_id = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
      },
      Limit: limit ? parseInt(limit) : 10, // Default limit to 10
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lista de cursos obtenida',
        cursos: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : undefined,
      }),
    };
  } catch (error) {
    console.error('Error listing cursos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Could not list cursos', error: error.message }),
    };
  }
};