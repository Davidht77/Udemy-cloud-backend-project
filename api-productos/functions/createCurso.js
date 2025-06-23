'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'prod_cursos_curses';

module.exports.createCurso = async (event) => {
  try {
  const { tenant_id, curso_id, nombre, descripcion, duracion, imagen_url } = event.body;

  // Validar que los campos requeridos existan
  if (!tenant_id || !curso_id || !nombre || !descripcion || !duracion || !imagen_url) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Faltan campos requeridos. Asegúrate de proporcionar tenant_id, curso_id, nombre, descripcion, duracion e imagen_url.',
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