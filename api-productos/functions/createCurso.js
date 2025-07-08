'use strict';

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.CURSOS_TABLE_NAME;

module.exports.createCurso = async (event) => {
  try {
  const body = JSON.parse(event.body);
  const { tenant_id, nombre, descripcion, duracion, imagen_url, categories, precio, rating } = body;
  const curso_id = uuidv4();

  // Validar que los campos requeridos existan
  if (!tenant_id || !nombre || !descripcion || !duracion || !imagen_url || !categories || !Array.isArray(categories) || categories.length === 0 || precio === undefined || rating === undefined) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Faltan campos requeridos. Asegúrate de proporcionar tenant_id, nombre, descripcion, duracion, imagen_url, categories (como un array no vacío), precio y rating.',
      }),
    };
  }

  // Validar que el tenant_id existe en la tabla de usuarios
  const userParams = {
    TableName: process.env.USERS_TABLE_NAME,
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
        categories: categories,
        precio: precio,
        rating: rating,
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