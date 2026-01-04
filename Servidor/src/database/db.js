// ============================================
// CONEXIÓN A LA BASE DE DATOS MYSQL
// ============================================

const mysql = require("mysql2/promise");

// Configuración de la conexión
const dbConfig = {
    host: "localhost",
    user: "root",
    password: "user",
    database: "ColumnsOnlineDB",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para probar la conexión
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log("✅ Conexión a MySQL establecida correctamente");
        connection.release();
        return true;
    } catch (error) {
        console.error("❌ Error al conectar con MySQL:", error.message);
        return false;
    }
}

// Función auxiliar para ejecutar queries
async function query(sql, params) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error("❌ Error en query:", error.message);
        throw error;
    }
}

// Función auxiliar para ejecutar stored procedures
async function callProcedure(procedureName, params = []) {
    try {
        const placeholders = params.map(() => "?").join(", ");
        const sql = `CALL ${procedureName}(${placeholders})`;
        const [results] = await pool.execute(sql, params);
        return results[0]; // Los SP devuelven un array de arrays
    } catch (error) {
        console.error(`❌ Error en stored procedure ${procedureName}:`, error.message);
        throw error;
    }
}

module.exports = {
    pool,
    query,
    callProcedure,
    testConnection
};