const { test }=require('node:test');
const assert=require('node:assert/strict');
const {buildPoolConfig,needsSsl}=require('../src/db/poolConfig');
const {Pool}=require('pg');
test('external TLS stays verified after pg parses sslmode',()=>{
  const old=process.env.DATABASE_URL; const privateUrl=process.env.DATABASE_PRIVATE_URL;
  delete process.env.DATABASE_PRIVATE_URL;
  try {
    for (const mode of ['require','prefer','verify-full']) {
      process.env.DATABASE_URL=`postgresql://user:password@db.example.com/app?sslmode=${mode}`;
      const pool=new Pool(buildPoolConfig());
      const client=new pool.Client(pool.options);
      assert.equal(client.connectionParameters.ssl.rejectUnauthorized,true);
      assert.doesNotMatch(pool.options.connectionString,/sslmode/);
    }
    assert.equal(needsSsl('postgresql://u@localhost/app'),false);
    assert.equal(needsSsl('postgresql://u@db.railway.internal/app'),false);
    assert.equal(needsSsl('postgresql://u@localhost.attacker.example/app'),true);
    assert.equal(needsSsl('postgresql://localhost@external.example/app'),true);
    assert.throws(()=>needsSsl('postgresql://u@external.example/app?sslmode=no-verify'));
    process.env.DATABASE_URL='postgresql://u@external.example/app'; process.env.PGSSLROOTCERT='/nonexistent/ca.pem';
    assert.throws(()=>buildPoolConfig());
  } finally {
    delete process.env.PGSSLROOTCERT;
    if(old===undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=old;
    if(privateUrl!==undefined) process.env.DATABASE_PRIVATE_URL=privateUrl;
  }
});
