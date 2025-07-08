import boto3
import hashlib
import uuid # Genera valores únicos
from datetime import datetime, timedelta
import json
import os

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
    user_table_name = os.environ.get('USER_TABLE_NAME')
    table = dynamodb.Table(user_table_name)
    response = table.get_item(
        Key={
            'tenant_id': tenant_id,  # Include tenant_id in the key
            'user_id': user_id
        }
    )
    if 'Item' not in response:
        return {
            'statusCode': 403,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps({'error': 'Usuario no existe'})
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
            access_token_table_name = os.environ.get('ACCESS_TOKEN_TABLE_NAME')
            table = dynamodb.Table(access_token_table_name)
            dynamodbResponse = table.put_item(Item = registro)
        else:
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': True
                },
                'body': json.dumps({'error': 'Password incorrecto'})
            }
    
    # Salida (json)
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': True
        },
        'body': json.dumps({
            'token': token,
            'user_id': user_id,
            'tenant_id': tenant_id
        })
    }