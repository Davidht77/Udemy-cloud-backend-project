import json
import boto3
import os
from datetime import datetime

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    print(f"🔍 Evento recibido: {json.dumps(event, default=str)}")
    
    for record in event['Records']:
        try:
            print(f"🔍 Procesando record: {json.dumps(record, default=str)}")
            
            if record['eventName'] in ['INSERT', 'MODIFY']:
                new_image = record['dynamodb']['NewImage']
                print(f"🔍 NewImage: {json.dumps(new_image, default=str)}")
                
                # Extraer atributos con manejo de errores
                tenant_id = new_image.get('tenant_id', {}).get('S', 'unknown')
                order_id = new_image.get('order_id', {}).get('S', 'unknown')
                user_id = new_image.get('user_id', {}).get('S', 'unknown')
                curso_id = new_image.get('curso_id', {}).get('S', 'unknown')
                quantity = int(new_image.get('quantity', {}).get('N', '0'))
                price = float(new_image.get('price', {}).get('N', '0.0'))
                timestamp = new_image.get('timestamp', {}).get('S', datetime.now().isoformat())
                
                print(f"📊 Datos extraídos: tenant_id={tenant_id}, order_id={order_id}, user_id={user_id}")
                
                # Verificar que tenemos los datos mínimos necesarios
                if tenant_id == 'unknown' or order_id == 'unknown':
                    print(f"⚠️ Datos incompletos - tenant_id: {tenant_id}, order_id: {order_id}")
                    continue
                
                # Armar el JSON de la compra
                compra = {
                    'tenant_id': tenant_id,
                    'order_id': order_id,
                    'user_id': user_id,
                    'curso_id': curso_id,
                    'quantity': quantity,
                    'price': price,
                    'timestamp': timestamp
                }
                
                # Definir ruta del archivo en S3
                fecha = datetime.now().strftime('%Y-%m-%d')
                s3_key = f"compras/{fecha}/tenant_{tenant_id}/order_{order_id}.json"
                
                # Subir archivo a S3
                s3.put_object(
                    Bucket=BUCKET_NAME,
                    Key=s3_key,
                    Body=json.dumps(compra),
                    ContentType='application/json'
                )
                
                print(f"✅ Compra guardada en S3: s3://{BUCKET_NAME}/{s3_key}")
                
        except Exception as e:
            print(f"❌ Error procesando record: {str(e)}")
    
    return {
        'statusCode': 200,
        'body': json.dumps('Eventos procesados correctamente')
    }