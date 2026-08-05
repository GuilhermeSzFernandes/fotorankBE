const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const SALT = bcrypt.genSaltSync(10);

const users = [
  {
    id: 'admin-1',
    name: 'Administrador',
    email: 'admin@fotorank.com',
    password: bcrypt.hashSync('admin123', SALT),
    role: 'admin',
    avatar: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'teacher-1',
    name: 'Prof. Ana Lima',
    email: 'ana@fotorank.com',
    password: bcrypt.hashSync('prof123', SALT),
    role: 'teacher',
    avatar: null,
    createdAt: new Date().toISOString(),
  },
];

const photos = [];
const grades = [];
const resetTokens = []; // { token, email, expiresAt }

// ── Users ────────────────────────────────────────────────────────
function findUserByEmail(email) {
  return users.find((u) => u.email === email);
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

function createUser({ name, email, password, role = 'participant', etec = null, studentType = null, rm = null, imageRightsConsent = false }) {
  const user = {
    id: uuidv4(),
    name,
    email,
    password: bcrypt.hashSync(password, SALT),
    role,
    avatar: null,
    etec,
    studentType,
    rm,
    imageRightsConsentAt: imageRightsConsent ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

function deleteUser(id) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  users.splice(idx, 1);
  return true;
}

function updateUserProfile(userId, updates) {
  const user = findUserById(userId);
  if (!user) return null;
  if (updates.name) user.name = updates.name;
  return user;
}

function updateUserAvatar(userId, avatarUrl) {
  const user = findUserById(userId);
  if (!user) return false;
  user.avatar = avatarUrl;
  return true;
}

function changeUserPassword(userId, newPassword) {
  const user = findUserById(userId);
  if (!user) return false;
  user.password = bcrypt.hashSync(newPassword, SALT);
  return true;
}

// ── Password reset ────────────────────────────────────────────────
function createResetToken(email) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const token = uuidv4().replace(/-/g, '');
  const idx = resetTokens.findIndex((t) => t.email === email);
  if (idx !== -1) resetTokens.splice(idx, 1);
  resetTokens.push({ token, email, expiresAt: Date.now() + 3_600_000 });
  return token;
}

function consumeResetToken(token, newPassword) {
  const entry = resetTokens.find((t) => t.token === token);
  if (!entry || Date.now() > entry.expiresAt) return false;
  const user = findUserByEmail(entry.email);
  if (!user) return false;
  user.password = bcrypt.hashSync(newPassword, SALT);
  const idx = resetTokens.findIndex((t) => t.token === token);
  if (idx !== -1) resetTokens.splice(idx, 1);
  return true;
}

function validateResetToken(token) {
  const entry = resetTokens.find((t) => t.token === token);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.email;
}

// ── Photos ────────────────────────────────────────────────────────
function getPhotosByUser(userId) {
  return photos.filter((p) => p.userId === userId);
}

function createPhoto({ userId, filename, originalName, url, location = null, equipment = null, description = null }) {
  const photo = {
    id: uuidv4(),
    userId,
    filename,
    originalName,
    url: url || `/uploads/${filename}`,
    location,
    equipment,
    description,
    createdAt: new Date().toISOString(),
  };
  photos.push(photo);
  return photo;
}

// ── Grades ────────────────────────────────────────────────────────
function createOrUpdateGrade({ teacherId, photoId, score, comment }) {
  const existing = grades.find(
    (g) => g.teacherId === teacherId && g.photoId === photoId
  );
  if (existing) {
    existing.score = score;
    existing.comment = comment || '';
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const grade = {
    id: uuidv4(),
    teacherId,
    photoId,
    score,
    comment: comment || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  grades.push(grade);
  return grade;
}

// ── Ranking ───────────────────────────────────────────────────────
function getRanking() {
  return users
    .filter((u) => u.role === 'participant')
    .map((participant) => {
      const userPhotos = photos.filter((p) => p.userId === participant.id);
      const photoIds = userPhotos.map((p) => p.id);
      const userGrades = grades.filter((g) => photoIds.includes(g.photoId));
      const avgScore =
        userGrades.length > 0
          ? userGrades.reduce((sum, g) => sum + g.score, 0) / userGrades.length
          : null;
      return {
        userId: participant.id,
        name: participant.name,
        avatar: participant.avatar,
        photoCount: userPhotos.length,
        gradeCount: userGrades.length,
        avgScore: avgScore !== null ? parseFloat(avgScore.toFixed(2)) : null,
        photos: userPhotos,
      };
    })
    .sort((a, b) => {
      if (a.avgScore === null && b.avgScore === null) return 0;
      if (a.avgScore === null) return 1;
      if (b.avgScore === null) return -1;
      return b.avgScore - a.avgScore;
    });
}

// ── Metrics ───────────────────────────────────────────────────────
function getMetrics() {
  const participants = users.filter((u) => u.role === 'participant');
  const teachers = users.filter((u) => u.role === 'teacher');
  const avgGrade =
    grades.length > 0
      ? parseFloat(
          (grades.reduce((s, g) => s + g.score, 0) / grades.length).toFixed(2)
        )
      : null;
  const gradedPhotos = [...new Set(grades.map((g) => g.photoId))];
  return {
    totalParticipants: participants.length,
    totalTeachers: teachers.length,
    totalPhotos: photos.length,
    totalGrades: grades.length,
    gradedPhotos: gradedPhotos.length,
    ungradedPhotos: photos.length - gradedPhotos.length,
    avgGrade,
  };
}

module.exports = {
  users,
  photos,
  grades,
  findUserByEmail,
  findUserById,
  createUser,
  deleteUser,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
  createResetToken,
  consumeResetToken,
  validateResetToken,
  getPhotosByUser,
  createPhoto,
  createOrUpdateGrade,
  getRanking,
  getMetrics,
};
