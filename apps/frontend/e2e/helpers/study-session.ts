import mysql from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2/promise';

/** Makes a running Study Session look five minutes old, so stopping it early awards XP without waiting. */
export async function backdateStudySessionForE2e(studySessionId: string): Promise<void> {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: Number(process.env.E2E_DB_PORT),
    user: 'wise',
    password: 'wise-e2e-password',
    database: 'wise_e2e',
  });

  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE study_sessions
       SET started_at = DATE_SUB(NOW(3), INTERVAL 300 SECOND),
           run_deadline_at = DATE_ADD(
             DATE_SUB(NOW(3), INTERVAL 300 SECOND),
             INTERVAL planned_duration_seconds SECOND
           )
       WHERE id = ? AND state = 'running'`,
      [studySessionId],
    );
    if (result.affectedRows !== 1) throw new Error('Could not prepare the E2E Study Session');
  } finally {
    await connection.end();
  }
}
