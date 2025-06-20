/**
 * HistoryManager - Manages correction history storage and retrieval
 * 
 * Handles persistence, search, and management of correction history entries.
 */

import { CorrectionHistory, CorrectionMode } from '../../types/interfaces';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

export interface HistorySearchOptions {
  query?: string;
  mode?: CorrectionMode;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  onlyFavorites?: boolean;
}

export interface HistoryStats {
  totalCount: number;
  byMode: Record<CorrectionMode, number>;
  averageTextLength: number;
  mostActiveDay: string;
  favoriteCount: number;
}

export class HistoryManager {
  private db: Database;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(userDataPath: string) {
    this.dbPath = path.join(userDataPath, 'correction_history.db');
    this.ensureDirectoryExists(userDataPath);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      this.db = new Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.createTables()
          .then(() => {
            this.initialized = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS correction_history (
        id TEXT PRIMARY KEY,
        original_text TEXT NOT NULL,
        corrected_text TEXT NOT NULL,
        mode TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        model TEXT NOT NULL,
        favorite BOOLEAN DEFAULT 0,
        metadata TEXT,
        UNIQUE(original_text, corrected_text, mode)
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON correction_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mode ON correction_history(mode);
      CREATE INDEX IF NOT EXISTS idx_favorite ON correction_history(favorite);
      CREATE INDEX IF NOT EXISTS idx_text_search ON correction_history(original_text, corrected_text);
    `;

    await this.runAsync(createTableSQL);
  }

  async addEntry(entry: Omit<CorrectionHistory, 'id' | 'timestamp'>): Promise<string> {
    await this.ensureInitialized();

    const id = this.generateId();
    const timestamp = new Date();

    const sql = `
      INSERT OR REPLACE INTO correction_history 
      (id, original_text, corrected_text, mode, timestamp, model, favorite, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const metadata = JSON.stringify({
      textLength: entry.originalText.length,
      correctionLength: entry.correctedText.length,
      addedAt: timestamp.toISOString()
    });

    await this.runAsync(sql, [
      id,
      entry.originalText,
      entry.correctedText,
      entry.mode,
      timestamp.toISOString(),
      entry.model,
      entry.favorite ? 1 : 0,
      metadata
    ]);

    return id;
  }

  async getEntry(id: string): Promise<CorrectionHistory | null> {
    await this.ensureInitialized();

    const sql = `SELECT * FROM correction_history WHERE id = ?`;
    const row = await this.getAsync(sql, [id]);

    return row ? this.rowToHistory(row) : null;
  }

  async getHistory(limit: number = 100, offset: number = 0): Promise<CorrectionHistory[]> {
    await this.ensureInitialized();

    const sql = `
      SELECT * FROM correction_history 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;

    const rows = await this.allAsync(sql, [limit, offset]);
    return rows.map(row => this.rowToHistory(row));
  }

  async searchHistory(options: HistorySearchOptions): Promise<CorrectionHistory[]> {
    await this.ensureInitialized();

    let sql = 'SELECT * FROM correction_history WHERE 1=1';
    const params: any[] = [];

    if (options.query) {
      sql += ' AND (original_text LIKE ? OR corrected_text LIKE ?)';
      const searchQuery = `%${options.query}%`;
      params.push(searchQuery, searchQuery);
    }

    if (options.mode) {
      sql += ' AND mode = ?';
      params.push(options.mode);
    }

    if (options.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(options.startDate.toISOString());
    }

    if (options.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(options.endDate.toISOString());
    }

    if (options.onlyFavorites) {
      sql += ' AND favorite = 1';
    }

    sql += ' ORDER BY timestamp DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await this.allAsync(sql, params);
    return rows.map(row => this.rowToHistory(row));
  }

  async updateFavorite(id: string, favorite: boolean): Promise<void> {
    await this.ensureInitialized();

    const sql = 'UPDATE correction_history SET favorite = ? WHERE id = ?';
    await this.runAsync(sql, [favorite ? 1 : 0, id]);
  }

  async deleteEntry(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const sql = 'DELETE FROM correction_history WHERE id = ?';
    const result = await this.runAsync(sql, [id]);
    
    return result.changes > 0;
  }

  async clearHistory(): Promise<void> {
    await this.ensureInitialized();

    await this.runAsync('DELETE FROM correction_history');
  }

  async getStats(): Promise<HistoryStats> {
    await this.ensureInitialized();

    const totalCountSQL = 'SELECT COUNT(*) as count FROM correction_history';
    const byModeSQL = 'SELECT mode, COUNT(*) as count FROM correction_history GROUP BY mode';
    const avgLengthSQL = 'SELECT AVG(LENGTH(original_text)) as avg_length FROM correction_history';
    const mostActiveDaySQL = `
      SELECT DATE(timestamp) as day, COUNT(*) as count 
      FROM correction_history 
      GROUP BY DATE(timestamp) 
      ORDER BY count DESC 
      LIMIT 1
    `;
    const favoriteCountSQL = 'SELECT COUNT(*) as count FROM correction_history WHERE favorite = 1';

    const [totalCount, byMode, avgLength, mostActiveDay, favoriteCount] = await Promise.all([
      this.getAsync(totalCountSQL),
      this.allAsync(byModeSQL),
      this.getAsync(avgLengthSQL),
      this.getAsync(mostActiveDaySQL),
      this.getAsync(favoriteCountSQL)
    ]);

    const modeStats: Record<CorrectionMode, number> = {
      business: 0,
      academic: 0,
      casual: 0,
      presentation: 0
    };

    byMode.forEach(row => {
      modeStats[row.mode as CorrectionMode] = row.count;
    });

    return {
      totalCount: totalCount?.count || 0,
      byMode: modeStats,
      averageTextLength: Math.round(avgLength?.avg_length || 0),
      mostActiveDay: mostActiveDay?.day || 'N/A',
      favoriteCount: favoriteCount?.count || 0
    };
  }

  async exportHistory(outputPath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    await this.ensureInitialized();

    const history = await this.getHistory(10000); // Export up to 10k entries

    if (format === 'json') {
      const jsonData = JSON.stringify(history, null, 2);
      fs.writeFileSync(outputPath, jsonData, 'utf8');
    } else {
      const csvHeaders = ['ID', 'Original Text', 'Corrected Text', 'Mode', 'Timestamp', 'Model', 'Favorite'];
      const csvRows = history.map(h => [
        h.id,
        `"${h.originalText.replace(/"/g, '""')}"`,
        `"${h.correctedText.replace(/"/g, '""')}"`,
        h.mode,
        h.timestamp.toISOString(),
        h.model,
        h.favorite ? 'Yes' : 'No'
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      fs.writeFileSync(outputPath, csvContent, 'utf8');
    }
  }

  async importHistory(inputPath: string): Promise<number> {
    await this.ensureInitialized();

    const fileContent = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(fileContent) as CorrectionHistory[];

    let imported = 0;
    for (const entry of data) {
      try {
        await this.addEntry({
          originalText: entry.originalText,
          correctedText: entry.correctedText,
          mode: entry.mode,
          model: entry.model,
          favorite: entry.favorite
        });
        imported++;
      } catch (error) {
        // Skip duplicates or invalid entries
        console.warn(`Failed to import entry: ${error}`);
      }
    }

    return imported;
  }

  private rowToHistory(row: any): CorrectionHistory {
    return {
      id: row.id,
      originalText: row.original_text,
      correctedText: row.corrected_text,
      mode: row.mode as CorrectionMode,
      timestamp: new Date(row.timestamp),
      model: row.model,
      favorite: row.favorite === 1
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private runAsync(sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params || [], function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  private getAsync(sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params || [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private allAsync(sql: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            this.initialized = false;
            resolve();
          }
        });
      });
    }
  }
}