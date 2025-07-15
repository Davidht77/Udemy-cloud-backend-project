'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.CURSOS_TABLE_NAME;
const STAGE = process.env.STAGE || 'dev';
const VALIDADOR_FN_NAME = `api-usuarios-${STAGE}-validarToken`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS',
};

module.exports.updateCurso = async (event) => {
  // 1. Manejo de preflight (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // 2. Extraer el token de autorización
    const token = event.headers && event.headers.Authorization;
    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Token de autorización no proporcionado' }),
      };
    }

    // 3. Invocar la función Lambda validadora
    const validationResponse = await lambda.invoke({
      FunctionName: VALIDADOR_FN_NAME,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ headers: { Authorization: token } }),
    }).promise();

    const validationResult = JSON.parse(validationResponse.Payload);

    // 4. Verificar si el token es válido
    if (validationResult.statusCode !== 200) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Token inválido o expirado' }),
      };
    }

    // 5. Si el token es válido, obtener el tenant_id y proceder
    const authorizerContext = JSON.parse(validationResult.body);
    const tenantId = authorizerContext.tenant_id;
    const { id } = event.pathParameters;

    if (!id || !tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Falta curso_id o tenant_id no se pudo derivar del token' }),
      };
    }

    const body = JSON.parse(event.body);
    const { nombre, descripcion, duracion, imagen_url, categories, precio, rating } = body;

    // Construir la expresión de actualización dinámicamente
    let updateExpression = 'set ';
    const expressionAttributeValues = {};
    const updates = [];

    if (nombre !== undefined) {
      updates.push('nombre = :n');
      expressionAttributeValues[':n'] = nombre;
    }
    if (descripcion !== undefined) {
      updates.push('descripcion = :d');
      expressionAttributeValues[':d'] = descripcion;
    }
    if (duracion !== undefined) {
      updates.push('duracion = :u');
      expressionAttributeValues[':u'] = duracion;
    }
    if (imagen_url !== undefined) {
      updates.push('imagen_url = :i');
      expressionAttributeValues[':i'] = imagen_url;
    }
    if (categories !== undefined) {
      updates.push('categories = :c');
      expressionAttributeValues[':c'] = categories;
    }
    if (precio !== undefined) {
      updates.push('precio = :p');
      expressionAttributeValues[':p'] = precio;
    }
    if (rating !== undefined) {
      updates.push('rating = :r');
      expressionAttributeValues[':r'] = rating;
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'No se proporcionaron campos para actualizar' }),
      };
    }

    updateExpression += updates.join(', ');

    const params = {
      TableName: TABLE_NAME,
      Key: {
        tenant_id: tenantId,
        curso_id: id,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: `Curso ${id} actualizado`, curso: result.Attributes }),
    };
  } catch (error) {
    console.error('Error updating curso:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No se pudo actualizar el curso', error: error.message }),
    };
  }
};