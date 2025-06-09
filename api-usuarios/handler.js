'use strict';

module.exports.createUsuario = async (event) => {
  // Lógica para crear un usuario
  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'Usuario creado exitosamente', input: event }),
  };
};

module.exports.getUsuario = async (event) => {
  // Lógica para obtener un usuario por ID
  const usuarioId = event.pathParameters.id;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Usuario ${usuarioId} obtenido`, input: event }),
  };
};

module.exports.updateUsuario = async (event) => {
  // Lógica para actualizar un usuario por ID
  const usuarioId = event.pathParameters.id;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Usuario ${usuarioId} actualizado`, input: event }),
  };
};

module.exports.deleteUsuario = async (event) => {
  // Lógica para eliminar un usuario por ID
  const usuarioId = event.pathParameters.id;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Usuario ${usuarioId} eliminado`, input: event }),
  };
};

module.exports.listUsuarios = async (event) => {
  // Lógica para listar todos los usuarios
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Lista de usuarios obtenida', input: event }),
  };
};