'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'prod_compras_curses';

const getTenantId = (event) => {
  return event.headers ? event.headers['tenant-id'] : 'default_tenant';
};

module.exports.createCompra = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body);
    const { order_id, user_id, product_id, quantity, price } = body;

    if (!order_id || !user_id || !product_id || !quantity || !price || !tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Item: {
        tenant_id: tenantId,
        order_id: order_id,
        user_id: user_id,
        product_id: product_id,
        quantity: quantity,
        price: price,
        timestamp: new Date().toISOString(),
      },
    };

    await dynamodb.put(params).promise();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Compra creada exitosamente', compra: params.Item }),
    };
  } catch (error) {
    console.error('Error creating compra:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Could not create compra', error: error.message }),
    };
  }
};