import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔥 ===== FIREBASE ADMIN INITIALIZATION =====');

// ✅ Check multiple possible locations for Firebase credentials
const possiblePaths = [
  '/etc/secrets/firebase-admin.json',  // Render secret files location
  path.join(__dirname, 'firebase-admin.json'),  // Local development
  path.join(process.cwd(), 'firebase-admin.json'),  // Alternative location
  path.join(process.cwd(), 'src/config/firebase-admin.json')  // Another alternative
];

let jsonKeyPath = null;
let serviceAccount = null;

// Try each path until we find the file
for (const filePath of possiblePaths) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`✅ Found Firebase credentials at: ${filePath}`);
      jsonKeyPath = filePath;
      serviceAccount = JSON.parse(fs.readFileSync(jsonKeyPath, 'utf8'));
      break;
    }
  } catch (error) {
    // Continue to next path
    continue;
  }
}

// If no file found, show error
if (!serviceAccount) {
  console.error('\n❌ Firebase credentials file not found!');
  console.error('\n📍 Checked locations:');
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  console.error('\n📝 Steps to fix:');
  console.error('  1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('  2. Click "Generate new private key"');
  console.error('  3. Download the JSON file');
  console.error('  4. On Render: Add as Secret File with name "firebase-admin.json"');
  console.error('  5. For local: Save as src/config/firebase-admin.json');
  console.error('=========================================\n');
  process.exit(1);
}

try {
  console.log('✅ Loading Firebase credentials from JSON file...');
  console.log('📧 Project ID:', serviceAccount.project_id);
  console.log('👤 Client Email:', serviceAccount.client_email);
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('\n✅ Firebase Admin SDK initialized successfully!');
  console.log('=========================================\n');
  
} catch (error) {
  console.error('\n❌ Failed to load Firebase credentials:', error.message);
  console.error('\n🔍 Make sure:');
  console.error('  1. The JSON file is valid');
  console.error('  2. The private key is complete and not corrupted');
  console.error('=========================================\n');
  process.exit(1);
}

export default admin;