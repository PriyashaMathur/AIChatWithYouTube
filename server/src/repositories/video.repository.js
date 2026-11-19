import pool from "../config/db.js";

export async function findVideoById(videoId) {
  const result=pool.query(
    "SELECT * FROM videos WHERE videoId=$1",
    [videoId]
  )
  return result.rows[0] || null;
}
export async function createVideo(videoId){
  const result=pool.query(
    `INSERT INTO videos(video_id,status)
     VALUES($1,'processing')
     ON CONFLICT (video_id) DO NOTHING
     RETURNING *`,
     [videoId]
  )
  return result.rows[0] || null;
}

export async function updateVideoStatus(videoId,status,title=null){
  const result=pool.query(
    `UPDATE videos
    SET STATUS=$2,
    title=COALESCE($3,title),
    update_at=CURRENT_TIMESTAMP
    WHERE video_id=$1
    RETURNING *`,
    [videoId,status,title]
  );
  return result.rows[0] || null;
}

export async function retryFailedVideo(videoId){
  const result=await pool.query(
    `UPDATE videos
    SET status='processing
    updated_at=CURRENT_TIMESTAMP
    WHERE video_id=$1 and status='failed'
    RETURNING *`,
    [videoId]
  );
  return result.rows[0] || null;
}
