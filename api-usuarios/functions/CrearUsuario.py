import boto3
import hashlib
import json # Importa la librería json
import os

# Hashear contraseña
def hash_password(password):
    # Retorna la contraseña hasheada
    return hashlib.sha256(password.encode()).hexdigest()

# Función que maneja el registro de user y validación del password
def lambda_handler(event, context):
    try:
        # Parsear el cuerpo del evento si viene como string
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body'] # Si ya es un diccionario, usarlo directamente
        else:
            body = event

        # Obtener los campos del cuerpo parseado
        user_id = body.get('user_id')
        password = body.get('password')
        tenant_id = body.get('tenant_id')
        # Campos obligatorios
        nombre = body.get('nombre')
        apellido = body.get('apellido')
        telefono = body.get('telefono')
        # Campos adicionales (opcionales)
        titulo = body.get('titulo')
        biografia = body.get('biografia')
        idioma = body.get('idioma')
        
        # Verificar que todos los campos obligatorios existen
        if user_id and password and tenant_id and nombre and apellido and telefono:
            # Hashea la contraseña antes de almacenarla
            hashed_password = hash_password(password)
            # Conectar DynamoDB
            dynamodb = boto3.resource('dynamodb')
            table_name = os.environ.get('TABLE_NAME')
            t_usuarios = dynamodb.Table(table_name)

            item = {
                'user_id': user_id,
                'password': hashed_password,
                'tenant_id': tenant_id,
                'nombre': nombre,
                'apellido': apellido,
                'telefono': telefono,
            }

            # Agregar campos opcionales si existen
            if titulo: item['titulo'] = titulo
            if biografia: item['biografia'] = biografia
            if idioma: item['idioma'] = idioma

            # Guardar en la tabla
            response = t_usuarios.put_item(Item=item)
            # Retornar un código de estado HTTP 200 (OK) y un mensaje de éxito
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'message': 'Usuario creado exitosamente', 'response': response}),
                'isBase64Encoded': False
            }
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': 'Faltan campos obligatorios: user_id, password, tenant_id, nombre, apellido y telefono son requeridos'}),
                'isBase64Encoded': False
            }

    except Exception as e:
        # Excepción y retornar un código de error HTTP 500
        print("Exception:", str(e))
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }