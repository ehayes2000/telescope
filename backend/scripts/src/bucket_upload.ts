// AI GENERATED WITH CLAUDE
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadFile(
  bucketName: string,
  localPath: string,
  s3Key: string
): Promise<void> {
  const fileContent = readFileSync(localPath);

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
    })
  );

  console.log(`✓ Uploaded: ${s3Key}`);
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = join(dirPath, file);
    if (statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function uploadDirectory(
  bucketName: string,
  localDir: string,
  s3Prefix: string = ""
): Promise<void> {
  const files = getAllFiles(localDir);

  console.log(`Found ${files.length} files to upload...`);

  for (const filePath of files) {
    const relativePath = relative(localDir, filePath);
    const s3Key = s3Prefix
      ? `${s3Prefix}/${relativePath}`
      : relativePath;

    await uploadFile(bucketName, filePath, s3Key);
  }

  console.log(`\n✓ Successfully uploaded ${files.length} files`);
}

// Usage
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "telescope";
const LOCAL_DIR = "../search_index/raw";
const S3_PREFIX = ""; // Optional prefix in S3

uploadDirectory(BUCKET_NAME, LOCAL_DIR, S3_PREFIX)
  .then(() => console.log("Done!"))
  .catch((err) => console.error("Error:", err));
