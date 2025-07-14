import boto3
import os
import json
from datetime import datetime
import logging

# Configuración de logs
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info("🔐 Iniciando validación de token...")
    logger.info(f"🔐 Event recibido: {json.dumps(event)}")

    # Determinar si es invocación directa de Lambda o API Gateway authorizer
    is_direct_invocation = 'headers' in event and 'Authorization' in event.get('headers', {})
    
    if is_direct_invocation:
        # Invocación directa desde otro Lambda
        return handle_direct_invocation(event)
    else:
        # API Gateway authorizer (formato original)
        return handle_api_gateway_authorizer(event)

def handle_direct_invocation(event):
    """Maneja invocaciones directas desde otros Lambdas"""
    try:
        # 1. Extraer el token del header Authorization
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization', '')
        
        # Remover 'Bearer ' si está presente
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else auth_header
        
        logger.info(f"🔐 Token extraído: {token}")

        if not token:
            logger.warning("⚠ Token no proporcionado.")
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Token no proporcionado'})
            }

        # 2. Validar el token
        validation_result = validate_token(token)
        
        if validation_result['valid']:
            logger.info("✅ Token válido, devolviendo datos del usuario.")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'tenant_id': validation_result['tenant_id'],
                    'user_id': validation_result['user_id'],
                    'message': 'Token válido'
                })
            }
        else:
            logger.info("🚫 Token inválido o expirado.")
            return {
                'statusCode': 403,
                'body': json.dumps({'message': validation_result['message']})
            }
            
    except Exception as e:
        logger.error(f"❌ Error en validación directa: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Error interno del servidor'})
        }

def handle_api_gateway_authorizer(event):
    """Maneja el formato original de API Gateway authorizer"""
    # 1. Extraer el token y el ARN del método
    token = event.get('authorizationToken')
    method_arn = event.get('methodArn')

    logger.info(f"🔐 Token recibido (API Gateway): {token}")

    if not token:
        logger.warning("⚠ Token no proporcionado.")
        return generate_policy("user", "Deny", method_arn)

    # 2. Validar el token
    validation_result = validate_token(token)
    
    if validation_result['valid']:
        logger.info("✅ Token válido, acceso permitido.")
        return generate_policy("user", "Allow", method_arn, validation_result)
    else:
        logger.info(f"🚫 Token inválido: {validation_result['message']}")
        return generate_policy("user", "Deny", method_arn)

def validate_token(token):
    """Valida el token contra DynamoDB"""
    try:
        # Acceder a DynamoDB
        dynamodb = boto3.resource('dynamodb')
        table_name = os.environ.get('ACCESS_TOKEN_TABLE_NAME')
        logger.info(f"🔍 Consultando tabla: {table_name}")
        table = dynamodb.Table(table_name)

        response = table.get_item(Key={'token': token})
        logger.info(f"🔍 Respuesta de DynamoDB: {json.dumps(response, default=str)}")
        
        if 'Item' not in response:
            logger.warning("🚫 Token no encontrado en DynamoDB")
            return {'valid': False, 'message': 'Token no encontrado'}

        # Validar expiración
        item = response['Item']
        logger.info(f"🔍 Item encontrado: {json.dumps(item, default=str)}")
        expires_str = item.get('expires')

        if not expires_str:
            logger.warning("⚠ Token sin fecha de expiración")
            return {'valid': False, 'message': 'Token sin fecha de expiración'}

        expires = datetime.strptime(expires_str, "%Y-%m-%d %H:%M:%S")
        now = datetime.now()

        if now > expires:
            logger.info(f"⌛ Token expirado. Expira: {expires_str}, Ahora: {now}")
            return {'valid': False, 'message': 'Token expirado'}

        # Token válido, devolver datos del usuario
        tenant_id = item.get('tenant_id')
        user_id = item.get('user_id')
        
        logger.info(f"✅ Token válido. tenant_id: {tenant_id}, user_id: {user_id}")
        
        return {
            'valid': True,
            'tenant_id': tenant_id,
            'user_id': user_id,
            'message': 'Token válido'
        }
        
    except Exception as e:
        logger.error(f"❌ Error al validar token: {str(e)}")
        return {'valid': False, 'message': 'Error al validar token'}

def generate_policy(principal_id, effect, resource, user_data=None):
    policy = {
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
    
    # Agregar contexto del usuario si está disponible
    if user_data and effect == "Allow":
        policy["context"] = {
            "tenant_id": user_data.get('tenant_id', ''),
            "user_id": user_data.get('user_id', '')
        }
    
    return policy