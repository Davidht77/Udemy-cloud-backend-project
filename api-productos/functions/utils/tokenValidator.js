'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Valida el token directamente contra DynamoDB (sin invocar otro Lambda)
 * @param {string} token - Token JWT a validar
 * @param {string} accessTokenTableName - Nombre de la tabla de tokens
 * @returns {Object} Resultado de la validación
 */
async function validateTokenDirect(token, accessTokenTableName) {
  try {
    // Remover 'Bearer ' si está presente
    const cleanToken = token.replace('Bearer ', '').trim();
    
    console.log(`🔐 Validando token directamente: ${cleanToken.substring(0, 10)}...`);
    
    const response = await dynamodb.get({
      TableName: accessTokenTableName,
      Key: { token: cleanToken }
    }).promise();
    
    if (!response.Item) {
      console.log('🚫 Token no encontrado en DynamoDB');
      return { valid: false, message: 'Token no encontrado' };
    }
    
    const tokenData = response.Item;
    const expiresStr = tokenData.expires;
    
    if (!expiresStr) {
      console.log('⚠️ Token sin fecha de expiración');
      return { valid: false, message: 'Token sin fecha de expiración' };
    }
    
    const expires = new Date(expiresStr);
    const now = new Date();
    
    if (now > expires) {
      console.log(`⌛ Token expirado. Expira: ${expiresStr}, Ahora: ${now.toISOString()}`);
      return { valid: false, message: 'Token expirado' };
    }
    
    console.log(`✅ Token válido. tenant_id: ${tokenData.tenant_id}, user_id: ${tokenData.user_id}`);
    
    return {
      valid: true,
      tenant_id: tokenData.tenant_id,
      user_id: tokenData.user_id,
      message: 'Token válido'
    };
    
  } catch (error) {
    console.error('❌ Error validando token:', error);
    return { valid: false, message: 'Error al validar token' };
  }
}

module.exports = {
  validateTokenDirect
};