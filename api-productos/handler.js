'use strict';

module.exports.createProduct = async (event) => {
  // Lógica para crear un producto
  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'Producto creado exitosamente', input: event }),
  };
};

module.exports.getProduct = async (event) => {
  // Lógica para obtener un producto por ID
  const productId = event.pathParameters.id;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Producto ${productId} obtenido`, input: event }),
  };
};

module.exports.updateProduct = async (event) => {
  // Lógica para actualizar un producto por ID
  const productId = event.pathParameters.id;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Producto ${productId} actualizado`, input: event }),
  };
};

module.exports.deleteProduct = async (event) => {
  // Lógica para eliminar un producto por ID
  const productId = event.pathParameters.id;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Producto ${productId} eliminado`, input: event }),
  };
};

module.exports.listProducts = async (event) => {
  // Lógica para listar todos los productos
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Lista de productos obtenida', input: event }),
  };
};