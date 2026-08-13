const { pool } = require('../lib/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');


function mapUser(row) {
  if (!row) return null;
  return {
    id:          row.id,
    name:        row.name,
    email:       row.email,
    password:    row.password_hash,
    role:        row.role,
    avatar:      row.avatar,
    etec:        row.etec,
    studentType: row.student_type,
    cpf:         row.cpf,
    phone:       row.phone,
    imageRightsConsentAt: row.image_rights_consent_at,
    createdAt:   row.created_at,
  };
}

function mapPhoto(row) {
  if (!row) return null;
  return {
    id:           row.id,
    userId:       row.user_id,
    filename:     row.filename,
    originalName: row.original_name,
    url:          row.url,
    location:     row.location,
    equipment:    row.equipment,
    description:  row.description,
    createdAt:    row.created_at,
  };
}


async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return mapUser(rows[0]);
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return mapUser(rows[0]);
}

async function createUser({ name, email, password, role = 'participant', etec = null, studentType = null, cpf = null, phone = null, imageRightsConsent = false }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, etec, student_type, cpf, phone, image_rights_consent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $9 THEN NOW() ELSE NULL END) RETURNING *`,
    [name, email, hash, role, etec, studentType, cpf, phone, imageRightsConsent]
  );
  return mapUser(rows[0]);
}

async function deleteUser(id) {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

async function updateUserRole(userId, role) {
  const { rows } = await pool.query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
    [role, userId]
  );
  return mapUser(rows[0]);
}

async function updateUserProfile(userId, { name }) {
  const { rows } = await pool.query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
    [name, userId]
  );
  return mapUser(rows[0]);
}

async function updateUserAvatar(userId, avatarUrl) {
  const { rowCount } = await pool.query(
    'UPDATE users SET avatar = $1 WHERE id = $2',
    [avatarUrl, userId]
  );
  return rowCount > 0;
}

async function changeUserPassword(userId, newPassword) {
  const hash = await bcrypt.hash(newPassword, 10);
  const { rowCount } = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [hash, userId]
  );
  return rowCount > 0;
}

async function getAllUsers() {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
  return rows.map(mapUser);
}


async function createResetToken(email) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const token = uuidv4().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 3_600_000);
  await pool.query('DELETE FROM password_reset_tokens WHERE email = $1', [email]);
  await pool.query(
    'INSERT INTO password_reset_tokens (token, email, expires_at) VALUES ($1, $2, $3)',
    [token, email, expiresAt]
  );
  return token;
}

async function validateResetToken(token) {
  const { rows } = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return rows[0]?.email ?? null;
}

async function consumeResetToken(token, newPassword) {
  const email = await validateResetToken(token);
  if (!email) return false;
  const user = await findUserByEmail(email);
  if (!user) return false;
  await changeUserPassword(user.id, newPassword);
  await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
  return true;
}


async function getPhotosByUser(userId) {
  const { rows } = await pool.query(
    `SELECT p.*,
            COUNT(DISTINCT g.teacher_id)::int AS grade_count,
            ROUND(AVG(g.score)::numeric, 1)   AS avg_score,
            COALESCE(
              json_agg(
                jsonb_build_object('score', g.score, 'comment', g.comment)
                ORDER BY g.created_at ASC
              ) FILTER (WHERE g.id IS NOT NULL),
              '[]'
            ) AS feedbacks
     FROM photos p
     LEFT JOIN grades g ON g.photo_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at ASC`,
    [userId]
  );
  return rows.map((r) => ({
    ...mapPhoto(r),
    gradeCount: r.grade_count,
    avgScore:   r.avg_score !== null ? parseFloat(r.avg_score) : null,
    feedbacks:  r.feedbacks,
  }));
}

async function getAllPhotos() {
  const { rows } = await pool.query('SELECT * FROM photos ORDER BY created_at ASC');
  return rows.map(mapPhoto);
}

async function findPhotoById(id) {
  const { rows } = await pool.query('SELECT * FROM photos WHERE id = $1', [id]);
  return mapPhoto(rows[0]);
}

async function createPhoto({ userId, filename, originalName, url, location = null, equipment = null, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO photos (user_id, filename, original_name, url, location, equipment, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, filename, originalName, url, location, equipment, description]
  );
  return mapPhoto(rows[0]);
}

async function deletePhoto(id, userId) {
  const { rows } = await pool.query(
    'DELETE FROM photos WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return mapPhoto(rows[0]);
}


async function deleteGrade(teacherId, photoId) {
  const { rowCount } = await pool.query(
    'DELETE FROM grades WHERE teacher_id = $1 AND photo_id = $2',
    [teacherId, photoId]
  );
  return rowCount > 0;
}

async function createOrUpdateGrade({ teacherId, photoId, score, comment }) {
  const { rows } = await pool.query(
    `INSERT INTO grades (teacher_id, photo_id, score, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (teacher_id, photo_id)
     DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, updated_at = NOW()
     RETURNING *`,
    [teacherId, photoId, score, comment || '']
  );
  const r = rows[0];
  return {
    id:        r.id,
    teacherId: r.teacher_id,
    photoId:   r.photo_id,
    score:     parseFloat(r.score),
    comment:   r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function getPhotosWithGrades(teacherId) {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.user_id AS "userId", p.filename, p.original_name AS "originalName",
       p.url, p.location, p.equipment, p.description, p.created_at AS "createdAt",
       u.name AS "ownerName", u.avatar AS "ownerAvatar",
       g.id AS "gradeId", g.score, g.comment, g.created_at AS "gradeCreatedAt"
     FROM photos p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN grades g ON g.photo_id = p.id AND g.teacher_id = $1
     WHERE p.user_id != $1
     ORDER BY p.created_at ASC`,
    [teacherId]
  );
  return rows.map((r) => ({
    id:           r.id,
    userId:       r.userId,
    filename:     r.filename,
    originalName: r.originalName,
    url:          r.url,
    location:     r.location,
    equipment:    r.equipment,
    description:  r.description,
    createdAt:    r.createdAt,
    ownerName:    r.ownerName,
    ownerAvatar:  r.ownerAvatar,
    myGrade:      r.gradeId
      ? { id: r.gradeId, teacherId, photoId: r.id, score: parseFloat(r.score), comment: r.comment, createdAt: r.gradeCreatedAt }
      : null,
  }));
}


async function getRankingByPhoto() {
  const { rows } = await pool.query(
    `SELECT
       p.id AS "photoId", p.url, p.original_name AS "originalName", p.created_at AS "createdAt",
       u.id AS "userId", u.name, u.avatar,
       COUNT(DISTINCT g.teacher_id)::int      AS "gradeCount",
       ROUND(AVG(g.score)::numeric, 2)        AS "avgScore"
     FROM photos p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN grades g ON g.photo_id = p.id
     GROUP BY p.id, p.url, p.original_name, p.created_at, u.id, u.name, u.avatar
     ORDER BY "avgScore" DESC NULLS LAST, p.created_at ASC`
  );
  return rows.map((r) => ({
    ...r,
    avgScore: r.avgScore !== null ? parseFloat(r.avgScore) : null,
  }));
}

async function getRanking() {
  const { rows } = await pool.query(
    `SELECT
       u.id AS "userId", u.name, u.avatar,
       COUNT(DISTINCT p.id)::int                                              AS "photoCount",
       COUNT(DISTINCT g.teacher_id)::int                                      AS "gradeCount",
       ROUND(AVG(g.score)::numeric, 2)                                        AS "avgScore",
       COALESCE(
         json_agg(
           DISTINCT jsonb_build_object(
             'id', p.id, 'url', p.url,
             'originalName', p.original_name, 'createdAt', p.created_at
           )
         ) FILTER (WHERE p.id IS NOT NULL),
         '[]'
       )                                                                      AS photos
     FROM users u
     LEFT JOIN photos p ON p.user_id = u.id
     LEFT JOIN grades g ON g.photo_id = p.id
     WHERE u.role = 'participant'
     GROUP BY u.id, u.name, u.avatar
     ORDER BY "avgScore" DESC NULLS LAST`
  );
  return rows.map((r) => ({
    ...r,
    avgScore: r.avgScore !== null ? parseFloat(r.avgScore) : null,
  }));
}

async function getPhotoGrades(photoId) {
  const { rows } = await pool.query(
    `SELECT g.score, g.comment, g.updated_at AS "updatedAt"
     FROM grades g
     WHERE g.photo_id = $1
     ORDER BY g.score DESC, g.updated_at ASC`,
    [photoId]
  );
  return rows.map((r) => ({ ...r, score: parseFloat(r.score) }));
}


async function getMetrics() {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE role = 'participant')        AS "totalParticipants",
       (SELECT COUNT(*)::int FROM users WHERE role = 'teacher')            AS "totalTeachers",
       (SELECT COUNT(*)::int FROM photos)                                  AS "totalPhotos",
       (SELECT COUNT(*)::int FROM (SELECT DISTINCT teacher_id, photo_id FROM grades) _g) AS "totalGrades",
       (SELECT COUNT(DISTINCT photo_id)::int FROM grades)                  AS "gradedPhotos",
       (SELECT ROUND(AVG(score)::numeric, 2)
          FROM (SELECT DISTINCT ON (teacher_id, photo_id) score
                FROM grades ORDER BY teacher_id, photo_id, updated_at DESC) sub) AS "avgGrade"`
  );
  const m = rows[0];
  return {
    ...m,
    ungradedPhotos: m.totalPhotos - m.gradedPhotos,
    avgGrade: m.avgGrade !== null ? parseFloat(m.avgGrade) : null,
  };
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  deleteUser,
  updateUserRole,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
  getAllUsers,
  createResetToken,
  validateResetToken,
  consumeResetToken,
  getPhotosByUser,
  getAllPhotos,
  findPhotoById,
  createPhoto,
  deletePhoto,
  deleteGrade,
  createOrUpdateGrade,
  getPhotosWithGrades,
  getRankingByPhoto,
  getRanking,
  getPhotoGrades,
  getMetrics,
};
