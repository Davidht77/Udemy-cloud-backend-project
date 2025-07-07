const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const CURSOS_TABLE_NAME = process.env.CURSOS_TABLE_NAME;

const getTenantId = (event) => {
    return event.requestContext.authorizer.claims['custom:tenant_id'];
};

module.exports.searchCursosByCategory = async (event) => {
    const tenant_id = getTenantId(event);
    const category = event.queryStringParameters.category;

    if (!category) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Category is required' }),
        };
    }

    const params = {
        TableName: CURSOS_TABLE_NAME,
        FilterExpression: 'contains(categories, :category) AND tenant_id = :tenant_id',
        ExpressionAttributeValues: {
            ':category': category,
            ':tenant_id': tenant_id,
        },
    };

    try {
        const result = await dynamodb.scan(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify(result.Items),
        };
    } catch (error) {
        console.error('Error searching courses by category:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Could not search courses by category', error: error.message }),
        };
    }
};