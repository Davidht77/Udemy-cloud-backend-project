'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'prod_cursos_curses';

const getTenantId = (event) => {
  return event.headers ? event.headers['tenant-id'] : 'default_tenant';
};

module.exports.createCurso = async (event) => {
  try {
    const tenantId = getTenantId(event);
    const body = JSON.parse(event.body);
    const { curso_id, nombre, descripcion, duracion } = body;

    if (!curso_id || !nombre || !tenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing curso_id, nombre, or tenant_id' }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Item: {
        tenant_id: tenantId,
        curso_id: curso_id,
        nombre: nombre,
        descripcion: descripcion,
        duracion: duracion,
      },
    };

    await dynamodb.put(params).promise();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Curso creado exitosamente', curso: params.Item }),
    };
  } catch (error) {
    console.error('Error creating curso:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Could not create curso', error: error.message }),
    };
  }
};