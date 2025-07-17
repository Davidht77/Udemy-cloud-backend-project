import json
import boto3
import os
from datetime import datetime

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    for record in event['Records']:
        try:
            if record['eventName'] in ['INSERT', 'MODIFY']:
                new_image = record['dynamodb']['NewImage']
                
                # Extraer atributos
                tenant_id = new_image['tenant_id']['S']
                order_id = new_image['order_id']['S']
                user_id = new_image['user_id']['S']
                curso_id = new_image['curso_id']['S']
                quantity = int(new_image['quantity']['N'])
                price = float(new_image['price']['N'])
                timestamp = new_image['timestamp']['S']
                
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