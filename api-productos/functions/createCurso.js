'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'prod_cursos_curses';

module.exports.createCurso = async (event) => {
  try {
  const body = JSON.parse(event.body);
  const { tenant_id, curso_id, nombre, descripcion, duracion, imagen_url } = body;

  // Validar que los campos requeridos existan
  if (!tenant_id || !curso_id || !nombre || !descripcion || !duracion || !imagen_url) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Faltan campos requeridos. Asegúrate de proporcionar tenant_id, curso_id, nombre, descripcion, duracion e imagen_url.',
      }),
    };
  }

  // Validar que el tenant_id existe en la tabla de usuarios
  const userParams = {
    TableName: 'prod_user_curses',
    KeyConditionExpression: 'tenant_id = :tenant_id',
    ExpressionAttributeValues: {
      ':tenant_id': tenant_id,
    },
  };

  const userResult = await dynamodb.query(userParams).promise();

  if (userResult.Items.length === 0) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'El tenant_id proporcionado no existe.',
      }),
    };
  }

    const params = {
      TableName: TABLE_NAME,
      Item: {
        tenant_id: tenant_id,
        curso_id: curso_id,
        nombre: nombre,
        descripcion: descripcion,
        duracion: duracion,
        imagen_url: imagen_url,
      },
    };

    await dynamodb.put(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Curso creado exitosamente!' }),
    };
  } catch (error) {
    console.error('Error creating curso:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Could not create curso', error: error.message }),
    };
  }
};