'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');
const TABLE_NAME = 'prod_compras_curses';

const getTenantId = (event) => {
  return event.headers ? event.headers['tenant-id'] : 'default_tenant';
};

module.exports.createCompra = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body);
    let { user_id, curso_id, quantity, price } = body;

    quantity = parseFloat(quantity);
    price = parseFloat(price);
    const order_id = uuidv4(); // Generar un UUID para order_id

    if (!user_id || !curso_id || isNaN(quantity) || isNaN(price) || !tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields or invalid number format for quantity/price' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Item: {
        tenant_id: tenantId,
        order_id: order_id,
        user_id: user_id,
        curso_id: curso_id,
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