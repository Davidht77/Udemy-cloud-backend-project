import boto3
import os
from datetime import datetime

def lambda_handler(event, context):
    # Entrada (json)
    token = event['authorizationToken']
    # Proceso
    dynamodb = boto3.resource('dynamodb')
    table_name = os.environ.get('ACCESS_TOKEN_TABLE_NAME')
    table = dynamodb.Table(table_name)
    response = table.get_item(
        Key={
            'token': token
        }
    )
    if 'Item' not in response:
        return {
            "principalId": "user",
            "policyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "execute-api:Invoke",
                        "Effect": "Deny",
                        "Resource": event['methodArn']
                    }
                ]
            }
        }
    else:
        expires = response['Item']['expires']
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if now > expires:
            return {
                "principalId": "user",
                "policyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Action": "execute-api:Invoke",
                            "Effect": "Deny",
                            "Resource": event['methodArn']
                        }
                    ]
                }
            }
    
    # Salida (json)
    return {
        "principalId": "user",
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": "Allow",
                    "Resource": event['methodArn']
                }
            ]
        },
        "context": {
            "tenant_id": response['Item']['tenant_id']
        }
    }