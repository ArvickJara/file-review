const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'producto-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB límite
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF, DOC y DOCX'));
        }
    }
});

// Obtener todos los productos de un entregable
router.get('/entregable/:entregableId/productos', async (req, res) => {
    try {
        const { entregableId } = req.params;

        const productos = await db('tdr_producto')
            .where('entregable_id', entregableId)
            .orderBy('orden', 'asc')
            .select('*');

        return res.status(200).json({
            success: true,
            productos
        });
    } catch (error) {
        logger.error(`Error obteniendo productos: ${error.message}`, 'GetProductos');
        return res.status(500).json({
            success: false,
            message: 'Error al obtener productos',
            error: error.message
        });
    }
});

// Crear un nuevo producto
router.post('/entregable/:entregableId/productos', async (req, res) => {
    try {
        const { entregableId } = req.params;
        const { nombre_producto, descripcion, orden } = req.body;

        if (!nombre_producto) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del producto es obligatorio'
            });
        }

        // Verificar que el entregable existe
        const entregable = await db('tdr_entregable')
            .where('id', entregableId)
            .first();

        if (!entregable) {
            return res.status(404).json({
                success: false,
                message: 'Entregable no encontrado'
            });
        }

        const [productoId] = await db('tdr_producto').insert({
            entregable_id: entregableId,
            nombre_producto,
            descripcion: descripcion || null,
            orden: orden || 1
        });

        const producto = await db('tdr_producto')
            .where('id', productoId)
            .first();

        return res.status(201).json({
            success: true,
            producto,
            message: 'Producto creado exitosamente'
        });
    } catch (error) {
        logger.error(`Error creando producto: ${error.message}`, 'CrearProducto');
        return res.status(500).json({
            success: false,
            message: 'Error al crear producto',
            error: error.message
        });
    }
});

// Actualizar un producto
router.put('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_producto, descripcion, orden } = req.body;

        const producto = await db('tdr_producto')
            .where('id', id)
            .first();

        if (!producto) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        await db('tdr_producto')
            .where('id', id)
            .update({
                nombre_producto: nombre_producto || producto.nombre_producto,
                descripcion: descripcion !== undefined ? descripcion : producto.descripcion,
                orden: orden !== undefined ? orden : producto.orden
            });

        const updatedProducto = await db('tdr_producto')
            .where('id', id)
            .first();

        return res.status(200).json({
            success: true,
            producto: updatedProducto,
            message: 'Producto actualizado exitosamente'
        });
    } catch (error) {
        logger.error(`Error actualizando producto: ${error.message}`, 'ActualizarProducto');
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar producto',
            error: error.message
        });
    }
});

// Eliminar un producto
router.delete('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const producto = await db('tdr_producto')
            .where('id', id)
            .first();

        if (!producto) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        // Verificar si hay documentos asociados
        const documentos = await db('documentos')
            .where('producto_id', id)
            .count('id as count')
            .first();

        if (documentos && documentos.count > 0) {
            return res.status(409).json({
                success: false,
                message: `No se puede eliminar el producto porque tiene ${documentos.count} documento(s) asociado(s)`
            });
        }

        await db('tdr_producto')
            .where('id', id)
            .delete();

        return res.status(200).json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });
    } catch (error) {
        logger.error(`Error eliminando producto: ${error.message}`, 'EliminarProducto');
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar producto',
            error: error.message
        });
    }
});

// Obtener archivos de un producto
router.get('/productos/:id/archivos', async (req, res) => {
    try {
        const { id } = req.params;

        const archivos = await db('documentos')
            .where('producto_id', id)
            .orderBy('orden', 'asc')
            .select('*');

        return res.status(200).json({
            success: true,
            archivos
        });
    } catch (error) {
        logger.error(`Error obteniendo archivos del producto: ${error.message}`, 'GetArchivosProducto');
        return res.status(500).json({
            success: false,
            message: 'Error al obtener archivos',
            error: error.message
        });
    }
});

// Subir archivos para un producto
router.post('/productos/:id/archivos', upload.array('archivos', 10), async (req, res) => {
    try {
        const { id: productoId } = req.params;
        const { proyecto_id } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron archivos'
            });
        }

        // Verificar que el producto existe
        const producto = await db('tdr_producto')
            .where('id', productoId)
            .first();

        if (!producto) {
            // Eliminar archivos subidos
            files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        // Insertar archivos en la base de datos
        const archivosInsertados = [];
        for (const file of files) {
            const [id] = await db('documentos').insert({
                proyecto_id: proyecto_id,
                producto_id: productoId,
                nombre_archivo: file.originalname,
                ruta_archivo: `/uploads/${file.filename}`,
                tipo_documento: 'archivo_producto',
                orden: 0,
                fecha_subida: new Date()
            });

            archivosInsertados.push({
                id,
                nombre_archivo: file.originalname,
                ruta_archivo: `/uploads/${file.filename}`
            });
        }

        logger.info(`${files.length} archivos subidos para producto ${productoId}`, 'UploadArchivosProducto');

        return res.status(200).json({
            success: true,
            message: `${files.length} archivo(s) guardado(s) correctamente`,
            archivos: archivosInsertados
        });

    } catch (error) {
        logger.error(`Error guardando archivos: ${error.message}`, 'UploadArchivosProducto');

        // Limpiar archivos si hubo error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Error guardando archivos',
            error: error.message
        });
    }
});

module.exports = router;
