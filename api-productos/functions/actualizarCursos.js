'use strict';

const http = require('http');
const AWS = require('aws-sdk');

exports.handler = async (event) => {
  console.log('Lambda triggered:', event); // Log para verificar que Lambda se activó correctamente

  for (const record of event.Records) {
    console.log('Record eventName:', record.eventName); // Log para verificar el tipo de evento (INSERT/MODIFY)

    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      console.log('New product data:', newImage); // Log para ver los datos que estamos recibiendo

      const producto = {
        sku: newImage.curso_id,  // Usamos curso_id como ID en Elasticsearch
        nombre: newImage.nombre,
        descripcion: newImage.descripcion,
        duracion: newImage.duracion
      };

      const data = JSON.stringify(producto);
      console.log('Prepared data for Elasticsearch:', data); // Log para verificar los datos a enviar

      const options = {
        hostname: process.env.ES_HOST,
        port: process.env.ES_PORT,
        path: `/${process.env.ES_INDEX}/_doc/${producto.sku}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        },
        timeout: 10000  // Aumentamos el timeout a 5 segundos
      };

      console.log('Sending data to Elasticsearch:', data);
      const req = http.request(options, (res) => {
        // Aquí confirmamos que la respuesta de Elasticsearch se está recibiendo correctamente
        res.on('data', (d) => {
          console.log(`ElasticSearch response data: ${d.toString()}`);  // Log para ver la respuesta
        });

        res.on('end', () => {
          console.log(`ElasticSearch status: ${res.statusCode}`);  // Log para el estado de la respuesta
        });
      });

      req.on('error', (e) => {
        console.error(`Error enviando a ElasticSearch: ${e.message}`);
      });

      console.log('Preparing to send data to Elasticsearch...');
      req.write(data);
      req.end();
    }
  }

  return { statusCode: 200, body: 'OK' };
};