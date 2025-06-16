import boto3
import hashlib
import json # Importa la librería json

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

        # Obtener el email y el password del cuerpo parseado
        user_id = body.get('user_id')
        password = body.get('password')
        tenant_id = body.get('tenant_id')
        # Campos adicionales (opcionales)
        nombre = body.get('nombre')
        apellido = body.get('apellido')
        titulo = body.get('titulo')
        biografia = body.get('biografia')
        idioma = body.get('idioma')
        
        # Verificar que el email y el password existen
        if user_id and password and tenant_id:
            # Hashea la contraseña antes de almacenarla
            hashed_password = hash_password(password)
            # Conectar DynamoDB
            dynamodb = boto3.resource('dynamodb')
            t_usuarios = dynamodb.Table('prod_user_curses')

            item = {
                'user_id': user_id,
                'password': hashed_password,
                'tenant_id': tenant_id,
            }

            # Agregar campos opcionales si existen
            if nombre: item['nombre'] = nombre
            if apellido: item['apellido'] = apellido
            if titulo: item['titulo'] = titulo
            if biografia: item['biografia'] = biografia
            if idioma: item['idioma'] = idioma

            # Guardar en la tabla
            response = t_usuarios.put_item(Item=item)
            # Retornar un código de estado HTTP 200 (OK) y un mensaje de éxito
            return {
                'statusCode': 200,
                'response': response
            }
        else:
            return {
                'statusCode': 400,
                'response': {'error': 'Invalid request body: missing user_id, password or tenant_id'}
            }

    except Exception as e:
        # Excepción y retornar un código de error HTTP 500
        print("Exception:", str(e))
        return {
            'statusCode': 500,
            'response': {'error': str(e)}
        }