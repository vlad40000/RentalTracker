import { Pool } from "@neondatabase/serverless";
import { resetDemoPortfolio } from "../lib/demo-seed.ts";

const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error("DATABASE_URL is required");
const pool=new Pool({connectionString});
const client=await pool.connect();
try{
  await client.query("BEGIN");
  await resetDemoPortfolio(client,new Date());
  await client.query("COMMIT");
  console.log("Sales-demo portfolio seeded");
}catch(error){
  await client.query("ROLLBACK");
  throw error;
}finally{
  client.release();
  await pool.end();
}
