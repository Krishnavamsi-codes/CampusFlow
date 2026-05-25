const fs = require('fs');
const path = require('path');

const prismaSchemaPath = path.join(__dirname, '../prisma/schema.prisma');
const envPath = path.join(__dirname, '../.env');

const target = process.argv[2];

if (target !== 'sqlite' && target !== 'postgres') {
  console.error('Usage: node scripts/toggle-db.js [sqlite|postgres]');
  process.exit(1);
}

// 1. Update schema.prisma
let schemaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
if (target === 'sqlite') {
  schemaContent = schemaContent.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  console.log('Swapped schema provider to sqlite.');
} else {
  schemaContent = schemaContent.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  console.log('Swapped schema provider to postgresql.');
}
fs.writeFileSync(prismaSchemaPath, schemaContent, 'utf8');

// 2. Update .env
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const postgresUrl = 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iiits_live_rooms?schema=public"';
const sqliteUrl = 'DATABASE_URL="file:./dev.db"';

if (target === 'sqlite') {
  if (envContent.includes('DATABASE_URL')) {
    envContent = envContent.replace(/DATABASE_URL\s*=\s*".*"/g, sqliteUrl);
  } else {
    envContent += `\n${sqliteUrl}\n`;
  }
  console.log('Swapped DATABASE_URL to sqlite local file.');
} else {
  if (envContent.includes('DATABASE_URL')) {
    envContent = envContent.replace(/DATABASE_URL\s*=\s*".*"/g, postgresUrl);
  } else {
    envContent += `\n${postgresUrl}\n`;
  }
  console.log('Swapped DATABASE_URL to postgresql connection string.');
}
fs.writeFileSync(envPath, envContent, 'utf8');

console.log(`Database provider toggled to ${target.toUpperCase()} successfully.`);
