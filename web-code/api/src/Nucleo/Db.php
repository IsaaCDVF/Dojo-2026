<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

use PDO;

/** Conexión única a MySQL. Siempre consultas preparadas: nunca concatenar datos del usuario. */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                Config::get('DB_HOST', '127.0.0.1'), Config::get('DB_PORT', '3306'), Config::get('DB_NAME', 'dojo'));
            self::$pdo = new PDO($dsn, Config::get('DB_USER', 'root'), Config::get('DB_PASS', ''), [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            // La base usa la misma zona horaria que PHP para que NOW() y date() coincidan
            self::$pdo->exec("SET time_zone = '" . date('P') . "'");
        }
        return self::$pdo;
    }

    public static function uno(string $sql, array $p = []): ?array
    {
        $st = self::pdo()->prepare($sql); $st->execute($p);
        return $st->fetch() ?: null;
    }

    public static function todos(string $sql, array $p = []): array
    {
        $st = self::pdo()->prepare($sql); $st->execute($p);
        return $st->fetchAll();
    }

    public static function ejecutar(string $sql, array $p = []): int
    {
        $st = self::pdo()->prepare($sql); $st->execute($p);
        return $st->rowCount();
    }

    public static function insertar(string $sql, array $p = []): int
    {
        self::ejecutar($sql, $p);
        return (int) self::pdo()->lastInsertId();
    }

    /** Ejecuta $fn dentro de una transacción; si algo falla, deshace todo. */
    public static function transaccion(callable $fn): mixed
    {
        $pdo = self::pdo(); $pdo->beginTransaction();
        try { $r = $fn(); $pdo->commit(); return $r; }
        catch (\Throwable $e) { $pdo->rollBack(); throw $e; }
    }
}
