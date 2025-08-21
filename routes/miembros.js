const express = require('express');
const knex = require('knex')(require('../knexfile'));
const protect = require('../middleware/auth');
const { parseBody } = require('../middleware/parseBody');
const logger = require('../utils/logger');

const router = express.Router();

// Obtener todos los miembros (público)
router.get('/', async (req, res) => {
  const { activo = true } = req.query;
  
  logger.startOperation('Obtener miembros', { activo }, 'Miembros');
  
  try {
    const miembros = await knex('miembros')
      .where('activo', activo === 'false' ? false : Boolean(activo))
      .orderBy('orden', 'asc')
      .orderBy('id', 'asc');

    logger.endOperation('Obtener miembros', { count: miembros.length }, 'Miembros');
    res.status(200).json(miembros);
  } catch (err) {
    logger.operationError('Obtener miembros', err, 'Miembros');
    res.status(500).json({ error: 'Error obteniendo miembros.', details: err.message });
  }
});

// Obtener un miembro por ID (público)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  logger.startOperation('Obtener miembro por ID', { id }, 'Miembros');

  try {
    const miembro = await knex('miembros').where('id', id).first();

    if (!miembro) {
      logger.warn(`Miembro con ID ${id} no encontrado`, 'Miembros');
      return res.status(404).json({ message: 'Miembro no encontrado.' });
    }

    logger.endOperation('Obtener miembro por ID', { cargo: miembro.cargo, nombre: miembro.nombres }, 'Miembros');
    res.status(200).json({ miembro });
  } catch (err) {
    logger.operationError('Obtener miembro por ID', err, 'Miembros');
    res.status(500).json({ error: 'Error obteniendo el miembro.', details: err.message });
  }
});

// Crear nuevo miembro (solo admin)
router.post('/', protect(['admin']), parseBody('imagen'), async (req, res) => {
  try {
    const { cargo, nombres, apellidos, activo, orden } = req.body;
    
    logger.startOperation('Crear miembro', { cargo, nombres, apellidos }, 'Miembros');
    
    if (!cargo || !nombres || !apellidos) {
      logger.warn('Intento de crear miembro con datos incompletos', 'Miembros');
      return res.status(400).json({ message: 'Cargo, nombres y apellidos son requeridos.' });
    }

    // Construir URL de imagen si se subió archivo
    let imagen_url = null;
    if (req.file) {
      imagen_url = `${req.protocol}://${req.get('host')}/public/uploads/${req.file.filename}`;
      logger.info(`Imagen adjunta a miembro: ${imagen_url}`, 'Miembros');
    }

    const [miembroId] = await knex('miembros').insert({
      cargo,
      nombres,
      apellidos,
      imagen_url,
      activo: activo !== undefined ? (activo === 'true' || activo === true) : true,
      orden: orden || 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });

    logger.endOperation('Crear miembro', { id: miembroId, cargo, nombres, apellidos }, 'Miembros');
    logger.info(`Nuevo miembro creado: "${nombres} ${apellidos}" (ID: ${miembroId})`, 'Miembros');

    res.status(201).json({ 
      message: 'Miembro creado exitosamente', 
      miembroId,
      imagen_url 
    });
  } catch (err) {
    logger.operationError('Crear miembro', err, 'Miembros');
    res.status(500).json({ error: 'Error creando el miembro.', details: err.message });
  }
});

// Actualizar miembro (solo admin)
router.put('/:id', protect(['admin']), parseBody('imagen'), async (req, res) => {
  const { id } = req.params;
  
  logger.startOperation('Actualizar miembro', { id }, 'Miembros');
  
  try {
    const miembro = await knex('miembros').where('id', id).first();
    if (!miembro) {
      logger.warn(`Intento de actualizar miembro inexistente ID: ${id}`, 'Miembros');
      return res.status(404).json({ message: 'Miembro no encontrado.' });
    }

    const { cargo, nombres, apellidos, activo, orden } = req.body;

    const updateData = {};
    if (cargo) updateData.cargo = cargo;
    if (nombres) updateData.nombres = nombres;
    if (apellidos) updateData.apellidos = apellidos;
    if (activo !== undefined) updateData.activo = activo === 'true' || activo === true;
    if (orden !== undefined) updateData.orden = orden;
    
    // Si se subió nueva imagen, actualizar URL
    if (req.file) {
      updateData.imagen_url = `${req.protocol}://${req.get('host')}/public/uploads/${req.file.filename}`;
      logger.info(`Nueva imagen para miembro ID ${id}: ${updateData.imagen_url}`, 'Miembros');
    }
    
    updateData.updated_at = knex.fn.now();

    await knex('miembros').where('id', id).update(updateData);

    logger.endOperation('Actualizar miembro', { id, cambios: Object.keys(updateData) }, 'Miembros');
    logger.info(`Miembro ID ${id} actualizado. Campos modificados: ${Object.keys(updateData).join(', ')}`, 'Miembros');

    res.status(200).json({ 
      message: 'Miembro actualizado exitosamente',
      imagen_url: updateData.imagen_url || miembro.imagen_url
    });
  } catch (err) {
    logger.operationError('Actualizar miembro', err, 'Miembros');
    res.status(500).json({ error: 'Error actualizando el miembro.', details: err.message });
  }
});

// Eliminar miembro (solo admin)
router.delete('/:id', protect(['admin']), async (req, res) => {
  const { id } = req.params;

  logger.startOperation('Eliminar miembro', { id }, 'Miembros');

  try {
    const miembro = await knex('miembros').where('id', id).first();
    if (!miembro) {
      logger.warn(`Intento de eliminar miembro inexistente ID: ${id}`, 'Miembros');
      return res.status(404).json({ message: 'Miembro no encontrado.' });
    }

    await knex('miembros').where('id', id).del();
    
    logger.endOperation('Eliminar miembro', { id, nombre: `${miembro.nombres} ${miembro.apellidos}` }, 'Miembros');
    logger.info(`Miembro ID ${id} "${miembro.nombres} ${miembro.apellidos}" eliminado`, 'Miembros');
    
    res.status(200).json({ message: 'Miembro eliminado exitosamente.' });
  } catch (err) {
    logger.operationError('Eliminar miembro', err, 'Miembros');
    res.status(500).json({ error: 'Error eliminando el miembro.', details: err.message });
  }
});

module.exports = router;
