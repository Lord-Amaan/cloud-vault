# ☁️ Cloud-Native Document & Media Vault

A secure personal document and media storage vault built for my Cloud Computing course. Think of it like a lightweight, self-hosted Google Drive or Dropbox.

Users can register, log in, and upload documents (PDFs), images (PNG/JPG), and videos (MP4). Instead of dumping heavy files onto a server hard drive or choking a database, files are streamed directly into private **Microsoft Azure Blob Storage**, while **MongoDB Atlas** keeps track of user accounts and file metadata.

Live deployment runs inside a **Docker** container on an **Ubuntu Linux Virtual Machine in Microsoft Azure** with an automated **GitHub Actions CI/CD pipeline**.

---

## 🚀 Live Demo

- **Live Web App:** [http://projectvault.centralindia.cloudapp.azure.com:5000](http://projectvault.centralindia.cloudapp.azure.com:5000)
- **Health Probe:** [http://projectvault.centralindia.cloudapp.azure.com:5000/api/health](http://projectvault.centralindia.cloudapp.azure.com:5000/api/health)

*(Feel free to register an account, upload a test PDF or image, and try generating a secure download link!)*

---

## 💡 How It Works (The Architecture)

```
[ User Browser / Phone ]
          │
     HTTP / REST
          ▼
 [ Azure Virtual Machine ]
   Docker Container (Node.js 20 Alpine)
   ├── JWT Auth & Multer (In-Memory Buffer)
   │
   ├──▶ Streams heavy files directly to ──▶ [ Azure Blob Storage ]
   │    (Stored in a 100% private container)   (Standard LRS)
   │
   └──▶ Saves lightweight JSON records to ──▶ [ MongoDB Atlas ]
        (Owner ID, filename, size, date)       (Free M0 Cluster)
```

### The Key Idea:
1. **Never save uploads to the container's disk:** Docker containers have temporary hard drives that get wiped when restarted. Multer holds the file in RAM for just a few milliseconds and streams it straight to Azure Blob.
2. **Never store raw media inside a database:** Storing a 10 MB video in MongoDB slows down queries. We keep the database lean by storing only text metadata.
3. **No public URLs:** The Azure container allows zero anonymous public access. When you want to view or download a file, the server checks if you own it and gives you a temporary **10-minute Shared Access Signature (SAS) URL**. After 10 minutes, that link permanently expires.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express 5
- **File Handling:** Multer (`memoryStorage`) with 10 MB size limits and file-type whitelisting
- **Database:** MongoDB Atlas (M0 Free Tier) with Mongoose
- **Cloud Storage:** Azure Blob Storage (`@azure/storage-blob`) with private containers & SAS tokens
- **Auth & Security:** JWT (JSON Web Tokens), `bcryptjs` password hashing, and Helmet headers
- **Deployment:** Docker, Docker Compose, Linux (Ubuntu 22.04 LTS), Azure Virtual Machine (B-series)
- **CI/CD:** GitHub Actions automated deployment on push to `main`
- **Frontend:** Neo-Brutalism + Claymorphism responsive dashboard (Vanilla HTML, CSS, JavaScript)

---

## ⚡ Automated CI/CD Pipeline (GitHub Actions)

This repository includes a continuous deployment workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
- Whenever changes are pushed to `main`, GitHub Actions triggers automatically.
- GitHub securely authenticates with the Azure VM via SSH.
- It pulls the latest code, rebuilds the container, and brings the service back up with zero manual server management.

---

## 🔒 Security Highlights

- **Least Privilege:** Private Azure Blob container. No anonymous internet access.
- **Expiring Links (SAS):** Read-only download URLs that auto-expire after 10 minutes.
- **Tenant Isolation:** User A can never view, download, or delete User B's files (enforced in code with HTTP 403 Forbidden).
- **Network Firewall:** Azure Network Security Group (NSG) blocks all ports except SSH and application ports.
- **Stateless Authentication:** Passwords are encrypted with 10 rounds of salt using bcrypt. All file requests require a valid Bearer JWT.

---

## 💻 Running It Locally

If you want to clone and run this on your own machine:

### 1. Clone the repository
```bash
git clone https://github.com/Lord-Amaan/cloud-vault.git
cd cloud-vault
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create your `.env` file
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection_string
AZURE_STORAGE_CONTAINER_NAME=vault-files
JWT_SECRET=any_long_random_secret_key
SAS_EXPIRY_MINUTES=10
```

### 4. Start the server
```bash
# Development mode (auto-reload)
npm run dev

# Or normal start
npm start
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🐳 Running with Docker

```bash
docker compose up -d --build
```

Check logs:
```bash
docker compose logs -f
```

---

## 📖 Course Documentation

For university presentation notes and academic syllabus mapping (Modules 1 to 6), check out:
- [VIVA_EXPLANATION.md](VIVA_EXPLANATION.md) — Plain-English guide for teachers and examiners.
- [SECURITY.md](SECURITY.md) — Detailed threat matrix and least-privilege security model.

---

## 👤 Author

- **Aman Khan** ([@Lord-Amaan](https://github.com/Lord-Amaan))
- Built for Cloud Computing Mini-Project / Coursework
