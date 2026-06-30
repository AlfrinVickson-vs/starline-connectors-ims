const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_7Nj0RctYzKUP@ep-wandering-brook-atb8jx97.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require' });
client.connect()
  .then(() => client.query("UPDATE users SET role = 'admin' WHERE id = 1;"))
  .then(() => client.query("UPDATE users SET role = 'super_admin' WHERE id = 3;"))
  .then(() => { console.log('Fixed users'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
