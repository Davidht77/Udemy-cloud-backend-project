import boto3
import os
import json
import logging
from datetime import datetime

# Configuración de logs
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info("🔍 Iniciando obtención de usuario...")
    logger.info(f"🔍 Event recibido: {json.dumps(event)}")
    
    # Manejo de preflight (CORS)
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,tenant-id',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            'body': ''
        }
    
    try:
        # 1. Determinar si es invocación directa o desde API Gateway
        # Las invocaciones directas de Lambda NO tienen httpMethod, pathParameters, etc.
        # Las invocaciones de API Gateway SÍ tienen estos campos
        is_api_gateway_request = 'httpMethod' in event or 'requestContext' in event
        
        if is_api_gateway_request:
            # Invocación desde API Gateway - necesitamos validar el token manualmente
            return handle_api_gateway_request(event)
        else:
            # Invocación directa desde otro Lambda
            return handle_direct_invocation(event)
            
    except Exception as e:
        logger.error(f"❌ Error en getUsuario: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'message': 'Error interno del servidor'})
        }

def handle_direct_invocation(event):
    """Maneja invocaciones directas desde otros Lambdas"""
    try:
        # Extraer información del token ya validado
        headers = event.get('headers', {})
        tenant_id = headers.get('tenant_id')
        user_id = headers.get('user_id')
        
        if not tenant_id or not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'tenant_id y user_id son requeridos'})
            }
        
        # Obtener información del usuario
        user_info = get_user_info(tenant_id, user_id)
        
        if user_info:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Usuario encontrado',
                    'usuario': user_info
                })
            }
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({'message': 'Usuario no encontrado'})
            }
            
    except Exception as e:
        logger.error(f"❌ Error en invocación directa: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Error interno del servidor'})
        }

def handle_api_gateway_request(event):
    """Maneja requests desde API Gateway"""
    try:
        # 1. Extraer el token de autorización
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization', '') or headers.get('authorization', '')
        
        if not auth_header:
            return {
                'statusCode': 401,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'message': 'Token de autorización no proporcionado'})
            }
        
        # Remover 'Bearer ' si está presente
        token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else auth_header
        
        # 2. Validar el token usando la misma lógica que ValidarTokenAcceso
        validation_result = validate_token(token)
        
        if not validation_result['valid']:
            return {
                'statusCode': 403,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'message': validation_result['message']})
            }
        
        # 3. Obtener información del usuario
        tenant_id = validation_result['tenant_id']
        user_id = validation_result['user_id']
        
        user_info = get_user_info(tenant_id, user_id)
        
        if user_info:
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({
                    'message': 'Usuario encontrado',
                    'usuario': user_info
                })
            }
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'message': 'Usuario no encontrado'})
            }
            
    except Exception as e:
        logger.error(f"❌ Error en request de API Gateway: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'message': 'Error interno del servidor'})
        }

def validate_token(token):
    """Valida el token contra DynamoDB - Misma lógica que ValidarTokenAcceso.py"""
    try:
        # Acceder a DynamoDB
        dynamodb = boto3.resource('dynamodb')
        table_name = os.environ.get('ACCESS_TOKEN_TABLE_NAME')
        logger.info(f"🔍 Consultando tabla de tokens: {table_name}")
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

def get_user_info(tenant_id, user_id):
    """Obtiene la información del usuario desde DynamoDB"""
    try:
        dynamodb = boto3.resource('dynamodb')
        table_name = os.environ.get('USER_TABLE_NAME')
        table = dynamodb.Table(table_name)
        
        logger.info(f"🔍 Consultando usuario: tenant_id={tenant_id}, user_id={user_id}")
        
        response = table.get_item(
            Key={
                'tenant_id': tenant_id,
                'user_id': user_id
            }
        )
        
        if 'Item' in response:
            user_item = response['Item']
            # Remover la contraseña de la respuesta por seguridad
            if 'password' in user_item:
                del user_item['password']
            
            logger.info(f"✅ Usuario encontrado: {user_id}")
            return user_item
        else:
            logger.info(f"🚫 Usuario no encontrado: {user_id}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error al consultar usuario: {str(e)}")
        return None