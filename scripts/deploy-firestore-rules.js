// Deploy Firestore security rules via REST API menggunakan service account.
// Menjalankan: node scripts/deploy-firestore-rules.js
const { readFileSync } = require("fs");
const path = require("path");

const SA_PATH = path.join(__dirname, "..", "firebase-service-account.json");

async function main() {
  const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
  const projectId = sa.project_id;

  const { JWT } = require("google-auth-library");
  const jwtClient = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  await jwtClient.authorize();
  const token = jwtClient.credentials.access_token;

  const rulesSource = readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

  // Buat ruleset
  const createResp = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { files: [{ name: "firestore.rules", content: rulesSource }] },
    }),
  });
  const body = await createResp.json();
  if (createResp.status !== 200) {
    console.error("Gagal buat ruleset:", createResp.status, JSON.stringify(body));
    process.exit(1);
  }
  const rulesetName = body.name;
  console.log("Ruleset dibuat:", rulesetName);

  // Rilis ke Firestore
  const name = `projects/${projectId}/releases/cloud.firestore`;
  const releaseResp = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases?name=${encodeURIComponent(name)}&updateMask=rulesetName`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, release: { name, rulesetName } }),
    },
  );
  const releaseBody = await releaseResp.json();
  if (releaseResp.status !== 200) {
    console.error("Gagal rilis rules:", releaseResp.status, JSON.stringify(releaseBody));
    process.exit(1);
  }
  console.log("Rules Firestore berhasil di-deploy:", releaseBody.name);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});