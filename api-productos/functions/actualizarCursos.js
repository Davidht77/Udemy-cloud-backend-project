'use strict';

const http = require('http');
const AWS = require('aws-sdk');

exports.handler = async (event) => {
  console.log('Lambda triggered:', event); // Log para verificar que Lambda se activó correctamente

  // Iterar sobre cada registro del evento de DynamoDB Streams
  for (const record of event.Records) {
    console.log('Record eventName:', record.eventName); // Log para verificar el tipo de evento (INSERT/MODIFY/REMOVE)

    // --- Manejo de eventos INSERT y MODIFY ---
    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      console.log('New product data (unmarshalled):', newImage); // Log para ver los datos que estamos recibiendo de DynamoDB

      // Construir el objeto 'producto' para Elasticsearch, incluyendo solo los campos presentes
      const producto = {
        sku: newImage.curso_id, // Usamos curso_id como ID en Elasticsearch
      };

      // Añadir campos opcionales si existen en el NewImage de DynamoDB
      if (newImage.nombre !== undefined) {
        producto.nombre = newImage.nombre;
      }
      if (newImage.descripcion !== undefined) {
        producto.descripcion = newImage.descripcion;
      }
      if (newImage.duracion !== undefined) {
        producto.duracion = newImage.duracion;
      }
      if (newImage.precio !== undefined) {
        producto.precio = newImage.precio;
      }
      if (newImage.rating !== undefined) {
        producto.rating = newImage.rating;
      }
      if (newImage.imagen_url !== undefined) {
        producto.imagen_url = newImage.imagen_url;
      }
      if (newImage.instructor !== undefined) {
        producto.instructor = newImage.instructor;
      }
      if (newImage.nivel !== undefined) {
        producto.nivel = newImage.nivel;
      }
      if (newImage.estudiantes !== undefined) {
        producto.estudiantes = newImage.estudiantes;
      }
      // Asegurarse de que 'categories' sea un array si está presente
      if (newImage.categories !== undefined && Array.isArray(newImage.categories)) {
        producto.categories = newImage.categories;
      } else if (newImage.categories !== undefined) {
        // Si 'categories' existe pero no es un array, loguear una advertencia o manejar según la lógica de negocio
        console.warn('Categories field is not an array:', newImage.categories);
        // Opcional: convertir a array de un solo elemento si es un string, o ignorar
        // producto.categories = [newImage.categories.toString()];
      }


      const data = JSON.stringify(producto);
      console.log('Prepared data for Elasticsearch:', data); // Log para verificar los datos a enviar a Elasticsearch

      const options = {
        hostname: process.env.ES_HOST,
        port: process.env.ES_PORT,
        path: `/${process.env.ES_INDEX}/_doc/${producto.sku}?refresh=true`, // refresh=true para que los cambios sean visibles inmediatamente
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data) // Usar Buffer.byteLength para la longitud correcta en bytes
        },
        timeout: 30000 // Aumentamos el timeout a 30 segundos
      };

      console.log('Trying to send data to Elasticsearch:', data);

      // Envolver la solicitud HTTP en una Promise para manejarla de forma asíncrona
      try {
        await new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (d) => {
              responseBody += d.toString();
            });

            res.on('end', () => {
              console.log(`ElasticSearch status: ${res.statusCode}`); // Log para el estado de la respuesta
              console.log(`ElasticSearch response data: ${responseBody}`); // Log para ver la respuesta completa de Elasticsearch

              // Resolver o rechazar la Promise basándose en el código de estado de la respuesta
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`Elasticsearch returned status ${res.statusCode}: ${responseBody}`));
              }
            });
          });

          req.on('error', (e) => {
            console.error(`Error sending to ElasticSearch: ${e.message}`); // Log para errores de red o conexión
            reject(e);
          });

          req.write(data); // Escribir el cuerpo de la solicitud
          req.end(); // Finalizar la solicitud
        });
        console.log(`Successfully updated/inserted document with SKU: ${producto.sku}`);
      } catch (error) {
        console.error(`Failed to update/insert document with SKU: ${producto.sku}. Error: ${error.message}`);
        // Puedes decidir si quieres re-lanzar el error o simplemente loguearlo y continuar
        // throw error;
      }

    // --- Manejo de eventos REMOVE ---
    } else if (record.eventName === 'REMOVE') {
      const oldImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      console.log('Product data to be removed from Elasticsearch:', oldImage); // Log para ver los datos a eliminar

      const options = {
        hostname: process.env.ES_HOST,
        port: process.env.ES_PORT,
        path: `/${process.env.ES_INDEX}/_doc/${oldImage.curso_id}?refresh=true`, // Usamos curso_id para identificar el producto a eliminar
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json', // Aunque no se envía body, es buena práctica mantener el Content-Type
        },
        timeout: 30000 // Aumentamos el timeout a 30 segundos
      };

      console.log('Trying to send DELETE request to Elasticsearch for SKU:', oldImage.curso_id);

      // Envolver la solicitud HTTP en una Promise para manejarla de forma asíncrona
      try {
        await new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (d) => {
              responseBody += d.toString();
            });

            res.on('end', () => {
              console.log(`ElasticSearch status: ${res.statusCode}`); // Log para el estado de la respuesta
              console.log(`ElasticSearch response data: ${responseBody}`); // Log para ver la respuesta completa de Elasticsearch

              // Resolver o rechazar la Promise basándose en el código de estado de la respuesta
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`Elasticsearch returned status ${res.statusCode}: ${responseBody}`));
              }
            });
          });

          req.on('error', (e) => {
            console.error(`Error deleting from ElasticSearch: ${e.message}`); // Log para errores de red o conexión
            reject(e);
          });

          req.end(); // No necesitamos enviar datos en la eliminación, solo el ID en la URL
        });
        console.log(`Successfully deleted document with SKU: ${oldImage.curso_id}`);
      } catch (error) {
        console.error(`Failed to delete document with SKU: ${oldImage.curso_id}. Error: ${error.message}`);
        // Puedes decidir si quieres re-lanzar el error o simplemente loguearlo y continuar
        // throw error;
      }
    }
  }

  return { statusCode: 200, body: 'OK' }; // El Lambda siempre devuelve OK si no hay un error no capturado
};