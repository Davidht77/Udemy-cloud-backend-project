'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'prod_compras_curses';

const getTenantId = (event) => {
  return event.queryStringParameters ? event.queryStringParameters.tenant_id : null;
};

module.exports.listCompras = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const { user_id, limit, lastEvaluatedKey } = event.queryStringParameters || {};

    if (!tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Missing tenant_id',
          queryStringParameters: event.queryStringParameters || 'not found'
        }),
      };
    }



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
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lista de compras obtenida',
        compras: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : undefined,
      }),
    };
  } catch (error) {
    console.error('Error listing compras:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Could not list compras', error: error.message }),
    };
  }
};