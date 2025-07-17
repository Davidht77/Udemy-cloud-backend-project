'use strict';

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const TABLE_NAME = process.env.CURSOS_TABLE_NAME;
const STAGE = process.env.STAGE || 'dev';
const VALIDADOR_FN_NAME = `api-usuarios-${STAGE}-validarToken`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

module.exports.createCurso = async (event) => {
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
    console.log('Validation result:', JSON.stringify(validationResult, null, 2));
    const authorizerContext = JSON.parse(validationResult.body);
    console.log('Authorizer context:', JSON.stringify(authorizerContext, null, 2));
    const tenantId = authorizerContext.tenant_id;
    console.log('Extracted tenant_id:', tenantId);

    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'No se pudo obtener tenant_id del token' }),
      };
    }

    console.log('Received event body:', event.body);
    const body = JSON.parse(event.body);
    console.log('Parsed event body:', body);
    const { nombre, descripcion, instructor, duracion, imagen_url, categories, precio, rating, nivel } = body;
    const curso_id = uuidv4();

    // Validar que los campos requeridos existan
    if (!nombre || !descripcion || !instructor || !duracion || !imagen_url || !categories || !Array.isArray(categories) || categories.length === 0 || precio === undefined || rating === undefined || !nivel) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Faltan campos requeridos. Asegúrate de proporcionar nombre, descripcion, instructor, duracion, imagen_url, categories (como un array no vacío), precio, rating y nivel.',
        }),
      };
    }

    const params = {
      TableName: TABLE_NAME,
      Item: {
        tenant_id: tenantId,
        curso_id: curso_id,
        nombre: nombre,
        descripcion: descripcion,
        instructor: instructor,
        duracion: duracion,
        imagen_url: imagen_url,
        categories: categories,
        precio: precio,
        rating: rating,
        nivel: nivel,
      },
    };

    console.log('Attempting to put item with params:', params);
    await dynamodb.put(params).promise();
    console.log('Item successfully put into DynamoDB.');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Curso creado exitosamente!', curso_id: curso_id }),
    };
  } catch (error) {
    console.error('Error creating curso:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No se pudo crear el curso', error: error.message }),
    };
  }
};