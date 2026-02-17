require("dotenv").config();
const { Client } = require("pg");

(async () => {
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    const result = await client.query("select 1 as ok");
    console.log("PG OK", result.rows);

    await client.end();
  } catch (err) {
    console.error("PG FAIL", err.message);
  }
})();

