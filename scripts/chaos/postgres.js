const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

// Creates a new cluster owned by this test user; never discovers or uses existing clusters.
async function postgres(directory) {
  const bin = process.env.CHAOS_PG_BIN || '/usr/lib/postgresql/16/bin';
  const data = path.join(directory, 'pgdata');
  const socket = path.join(directory, 'socket');
  await fs.mkdir(socket, { mode: 0o700 });
  await run(path.join(bin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'chaos', '--no-locale', '--encoding=UTF8']);
  let running = false;
  const stop = async () => {
    if (running) {
      await run(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
      running = false;
    }
  };
  const start = async () => {
    await run(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(directory, 'postgres.log'),
      '-o', `-k ${socket} -c listen_addresses='' -c unix_socket_permissions=0700`, '-w', 'start']);
    running = true;
  };
  await start();
  return { stop, start, env: { CHAOS_STORAGE: 'postgres', PGHOST: socket, PGUSER: 'chaos',
    PGDATABASE: 'postgres', PGPORT: '5432', DB_TIMEOUT_MS: '500' } };
}
module.exports = { postgres };
