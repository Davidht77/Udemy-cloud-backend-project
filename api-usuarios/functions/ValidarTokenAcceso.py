import boto3
import os
from datetime import datetime
import logging

# Configuración de logs
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info("🔐 Iniciando validación de token...")

    # 1. Extraer el token y el ARN del método
    token = event.get('authorizationToken')
    method_arn = event.get('methodArn')

    # Mostrar el token recibido
    logger.info(f"🔐 Token recibido: {token}")

    if not token:
        logger.warning("⚠ Token no proporcionado.")
        return generate_policy("user", "Deny", method_arn)

    # 2. Acceder a DynamoDB
    dynamodb = boto3.resource('dynamodb')
    table_name = os.environ.get('ACCESS_TOKEN_TABLE_NAME')
    table = dynamodb.Table(table_name)

    try:
        response = table.get_item(Key={'token': token})
    except Exception as e:
        logger.error(f"❌ Error al consultar DynamoDB: {str(e)}")
        return generate_policy("user", "Deny", method_arn)

    if 'Item' not in response:
        logger.info("🚫 Token no encontrado en la base de datos.")
        return generate_policy("user", "Deny", method_arn)

    # 3. Validar expiración
    item = response['Item']
    expires_str = item.get('expires')

    if not expires_str:
        logger.warning("⚠ El token no tiene fecha de expiración.")
        return generate_policy("user", "Deny", method_arn)

    try:
        expires = datetime.strptime(expires_str, "%Y-%m-%d %H:%M:%S")
        now = datetime.now()
    except Exception as e:
        logger.error(f"❌ Error al convertir fecha: {str(e)}")
        return generate_policy("user", "Deny", method_arn)

    if now > expires:
        logger.info(f"⌛ Token expirado. Fecha de expiración: {expires_str}")
        return generate_policy("user", "Deny", method_arn)

    # 4. Token válido
    logger.info("✅ Token válido, acceso permitido.")
    return generate_policy("user", "Allow", method_arn)

def generate_policy(principal_id, effect, resource):
    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource
                }
            ]
        }
    }