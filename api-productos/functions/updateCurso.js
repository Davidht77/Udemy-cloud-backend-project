'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.CURSOS_TABLE_NAME;

const getTenantId = (event) => {
  return event.headers ? event.headers['tenant-id'] : 'default_tenant';
};

module.exports.updateCurso = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const { id } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { nombre, descripcion, duracion } = body;

    if (!id || !tenantId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'Missing curso_id or tenant_id' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id: tenantId,
        curso_id: id,
      },
      UpdateExpression: 'set nombre = :n, descripcion = :d, duracion = :u',
      ExpressionAttributeValues: {
        ':n': nombre,
        ':d': descripcion,
        ':u': duracion,
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ message: `Curso ${id} actualizado`, curso: result.Attributes }),
    };
  } catch (error) {
    console.error('Error updating curso:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ message: 'Could not update curso', error: error.message }),
    };
  }
};