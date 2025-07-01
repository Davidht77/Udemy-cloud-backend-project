import boto3
import hashlib
import uuid # Genera valores únicos
from datetime import datetime, timedelta
import json

# Hashear contraseña
def hash_password(password):
    # Retorna la contraseña hasheada
    return hashlib.sha256(password.encode()).hexdigest()

def lambda_handler(event, context):
    print("Received event:", event)
    # Entrada (json)
    body = event['body'] # Access the body directly as it's already a dictionary
    user_id = body['user_id']
    password = body['password']
    tenant_id = body['tenant_id']  # Add tenant_id to the input
    hashed_password = hash_password(password)
    # Proceso
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('prod_user_curses')
    response = table.get_item(
        Key={
            'tenant_id': tenant_id,  # Include tenant_id in the key
            'user_id': user_id
        }
    )
    if 'Item' not in response:
        return {
            'statusCode': 403,
            'body': 'Usuario no existe'
        }
    else:
        hashed_password_bd = response['Item']['password']
        if hashed_password == hashed_password_bd:
            # Genera token
            token = str(uuid.uuid4())
            fecha_hora_exp = datetime.now() + timedelta(minutes=60)
            registro = {
                'token': token,
                'expires': fecha_hora_exp.strftime('%Y-%m-%d %H:%M:%S')
            }
            table = dynamodb.Table('prod_accessTokens_curses')
            dynamodbResponse = table.put_item(Item = registro)
        else:
            return {
                'statusCode': 403,
                'body': 'Password incorrecto'
            }
    
    # Salida (json)
    return {
        'statusCode': 200,
        'body': {
            'token': token,
            'user_id': user_id,
            'tenat_id': tenant_id
        }
    }