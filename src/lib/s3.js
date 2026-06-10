const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const BUCKET = process.env.AWS_S3_BUCKET || 'amzn-s3-fotorank-s3';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function uploadToS3(buffer, originalName, folder = 'photos') {
  const ext = path.extname(originalName).toLowerCase();
  const key = `${folder}/${uuidv4()}${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: MIME[ext] || 'application/octet-stream',
  }));

  return {
    key,
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
  };
}

async function deleteFromS3(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadToS3, deleteFromS3 };
