import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()
const {Pool}=pg;
const pool=new Pool({
  connectionString:process.env.DB_URL,
  ssl:{
    rejectUnauthorized:false
  }
});
pool.on("error", (err) => {
  console.error("Unexpected Database error",err);
});
export default pool;