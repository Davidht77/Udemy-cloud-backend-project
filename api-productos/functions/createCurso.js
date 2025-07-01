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

  // Validar que el tenant_id exista en la tabla de accessTokens
  const userTableParams = {
    TableName: 'prod_user_curses',
    Key: {
      tenant_id: tenant_id,
    },
  };

  const userResult = await dynamoDb.get(userTableParams).promise();

  if (!userResult.Item) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Tenant ID no encontrado. No se puede crear un curso para un tenant_id inexistente.',
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