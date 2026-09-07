import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'sqlite_schema.dart';

class AppDatabase {
  AppDatabase._();

  static final AppDatabase instance = AppDatabase._();

  Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _open();
    return _database!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    final fullPath = p.join(dbPath, 'poszxor_app.db');

    return openDatabase(
      fullPath,
      version: SqliteSchema.version,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON;');
      },
      onCreate: (db, _) async {
        for (final statement in SqliteSchema.createStatements) {
          await db.execute(statement);
        }
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        // For now, keep migrations simple for v1.
        // Future versions should apply incremental migrations here.
        if (oldVersion < newVersion) {
          for (final statement in SqliteSchema.createStatements) {
            await db.execute(statement);
          }
        }
      },
    );
  }
}
