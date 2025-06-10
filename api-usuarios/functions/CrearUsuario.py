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
            body = json.loads(event['body'])
        else:
            body = event

        # Obtener el email y el password del cuerpo parseado
        user_id = body.get('user_id')
        password = body.get('password')
        tenant_id = body.get('tenant_id')
        
        # Verificar que el email y el password existen
        if user_id and password and tenant_id:
            # Hashea la contraseña antes de almacenarla
            hashed_password = hash_password(password)
            # Conectar DynamoDB
            dynamodb = boto3.resource('dynamodb')
            t_usuarios = dynamodb.Table('prod_users_curses')
            # Almacena los datos del user en la tabla de usuarios en DynamoDB
            t_usuarios.put_item(
                Item={
                    'user_id': user_id,
                    'password': hashed_password,
                    'tenant_id': tenant_id,
                }
            )
            # Retornar un código de estado HTTP 200 (OK) y un mensaje de éxito
            mensaje = {
                'message': 'User registered successfully',
                'user_id': user_id,
                'tenant_id': tenant_id
            }
            return {
                'statusCode': 200,
                'body': json.dumps(mensaje) # Asegúrate de serializar el mensaje a JSON
            }
        else:
            mensaje = {
                'error': 'Invalid request body: missing user_id, password or tenant_id'
            }
            return {
                'statusCode': 400,
                'body': json.dumps(mensaje) # Asegúrate de serializar el mensaje a JSON
            }

    except Exception as e:
        # Excepción y retornar un código de error HTTP 500
        print("Exception:", str(e))
        mensaje = {
            'error': str(e)
        }        
        return {
            'statusCode': 500,
            'body': json.dumps(mensaje) # Asegúrate de serializar el mensaje a JSON
        }