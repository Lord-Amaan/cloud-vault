# Security Architecture & Threat Model
## Cloud-Native Document & Media Vault

This document provides the theoretical, architectural, and practical security framework implemented in the Cloud-Native Document & Media Vault project for Azure and MongoDB Atlas.

---

## 1. Principle of Least Privilege: Azure RBAC vs Account Keys

### 1.1 The Risk of Storage Account Keys in Production
In Azure, a Storage Account Key (e.g. `key1` or `key2`) is a **master root credential**:
- **Unscoped:** Anyone possessing the account key has full administrative control over all storage services (Blobs, Files, Queues, Tables) across the entire account.
- **Permanent:** Account keys do not have built-in expiration dates.
- **All-or-Nothing Revocation:** Rotating an account key breaks every service and application using it until they are all reconfigured.
- **Accidental Exfiltration:** Placing account keys in `.env` or application configuration files creates high exposure risk if code or containers are leaked.

### 1.2 Enterprise Best Practice: Azure RBAC with Managed Identity
Instead of sharing account keys, cloud-native deployments utilize **Role-Based Access Control (RBAC)** coupled with **Azure Managed Identities**:
- **No Shared Secrets:** The Azure VM hosting the application is assigned a **System-Assigned Managed Identity**. Azure internally handles token issuance and rotation through Azure Instance Metadata Service (IMDS).
- **Fine-Grained Scope:** The role is granted *only* to the specific container (`vault-files`), not the storage account or resource group.
- **Appropriate Role:** **Storage Blob Data Contributor** (read/write/delete blobs) or **Storage Blob Data Reader** (read-only).

#### Azure Portal Steps to Configure RBAC:
1. **Enable Managed Identity on the Azure VM:**
   - In Azure Portal, navigate to your Virtual Machine.
   - Under **Settings** in the left sidebar, click **Identity**.
   - Under the **System assigned** tab, toggle **Status** to **On**.
   - Click **Save** and confirm (Azure registers an identity in Microsoft Entra ID).
2. **Assign Role Scoped to Container:**
   - Navigate to your Storage Account -> **Containers** -> select `vault-files`.
   - In the left container menu, click **Access Control (IAM)**.
   - Click **+ Add** -> **Add role assignment**.
   - Under **Role**, select **Storage Blob Data Contributor** and click **Next**.
   - Under **Assign access to**, select **Managed identity**.
   - Click **+ Select members**, choose your subscription, select `Virtual machine`, and choose your VM.
   - Click **Review + assign**.
3. **Application Code Integration:**
   - Instead of a connection string, the app uses `@azure/identity`'s `DefaultAzureCredential()` with `new BlobServiceClient("https://<storage-account>.blob.core.windows.net", new DefaultAzureCredential())`.

---

## 2. Network Security Group (NSG) Rules for the Azure VM

A Network Security Group acts as a stateful distributed firewall operating at Layers 3 and 4 of the OSI model.

### 2.1 Recommended Inbound Security Rules

| Priority | Name | Port(s) | Protocol | Source | Destination | Action | Security Rationale |
|---|---|---|---|---|---|---|---|
| **300** | `Allow-SSH-Admin` | `22` | TCP | `My IP Address` (e.g. `203.0.113.4/32`) | Any | **Allow** | Eliminates automated botnet SSH brute-force attacks by restricting management access strictly to the administrator's public IP. |
| **310** | `Allow-HTTP` | `80` | TCP | `Internet` (`0.0.0.0/0`) | Any | **Allow** | Allows web visitors to reach the reverse proxy / application. |
| **320** | `Allow-HTTPS` | `443` | TCP | `Internet` (`0.0.0.0/0`) | Any | **Allow** | TLS/SSL encrypted public web traffic. |
| **330** | `Allow-Vault-App` | `5000` | TCP | `Internet` (or restricted) | Any | **Allow** | Direct application access (if running without Nginx reverse proxy). |
| **65500** | `DenyAllInbound` | `*` | Any | Any | Any | **Deny** | Azure's default inbound rule: immediately drops traffic on unexposed ports (e.g. database ports 27017, RDP 3389). |

### 2.2 Portal Steps to Lock Down NSG:
1. Open the Azure Portal and navigate to your VM.
2. In the left menu under **Networking**, click **Network settings**.
3. Locate the existing SSH rule:
   - Click on the rule -> change **Source** from `Any` to `IP Addresses`.
   - In **Source IP addresses/CIDR ranges**, enter your current public IP (or click "My IP").
   - Click **Save**.
4. Click **+ Add inbound port rule**:
   - Destination port ranges: `80, 443, 5000`
   - Protocol: `TCP`
   - Action: `Allow`
   - Priority: `310`
   - Name: `Allow-Web-Traffic`
   - Click **Add**.

---

## 3. Encryption in Transit vs Encryption at Rest

| Security Dimension | Technology Applied | Scope in Document Vault | Key Management |
|---|---|---|---|
| **Encryption in Transit** (Data in Motion) | **TLS 1.2 / TLS 1.3** | 1. Client to Express API (`HTTPS`)<br>2. Express to Azure Blob Storage REST API (`https://*.blob.core.windows.net`)<br>3. Express to MongoDB Atlas (`mongodb+srv://` with TLS enabled) | Public Key Infrastructure (PKI) certificates managed by Microsoft and Let's Encrypt. |
| **Encryption at Rest** (Data at Rest) | **AES-256 (Azure Storage SSE)** | Every physical block written to Azure SSD disks is automatically encrypted before persisting. | **Microsoft-Managed Keys (MMK)** by default. Hardware security modules (HSM) compliant with FIPS 140-2. |
| **Database Encryption at Rest** | **WiredTiger Encryption & Cryptographic Salting** | 1. MongoDB Atlas storage volumes encrypted with AES-256.<br>2. User passwords hashed with `bcryptjs` and 10 salt rounds. | Atlas cloud infrastructure keys + irreversible one-way application-level password derivation. |

---

## 4. Application-Level Security Controls in Source Code

The codebase enforces multiple defense-in-depth security layers:

1. **One-Way Password Hashing (`models/User.js`):**
   - Uses `bcryptjs` with salt work factor of 10.
   - Defends against rainbow table attacks and credential database leaks.
   - Custom `toJSON` method guarantees the password hash is excluded from all API responses.
2. **Stateless JWT Authorization (`middleware/auth.js`):**
   - Verifies digital signatures with `HMAC-SHA256` (`JWT_SECRET`).
   - Short lifespans (`7d` limit) with signature tampering protection.
3. **Multi-Tenant Ownership & Tenant Isolation (`routes/files.js`):**
   - Validates `file.owner.toString() === req.user.id` on every download, SAS generation, and deletion request.
   - Cross-user attempts immediately return `403 Forbidden`.
4. **File Whitelisting & Size Caps (`middleware/upload.js`):**
   - Rejects non-whitelisted extensions and MIME types (`.pdf`, `.png`, `.jpg`, `.mp4`).
   - Caps payload size at **10 MB** to prevent buffer overflow and RAM exhaustion DoS.
5. **Zero Anonymous Access & Short-Lived SAS URLs (`config/azureStorage.js`):**
   - Container has no public anonymous read access (`access: undefined`).
   - SAS tokens are minted on-demand with read-only (`r`) permissions and expire in **10 minutes**.
6. **HTTP Security Headers (`server.js`):**
   - Uses `helmet` to mitigate Clickjacking (`X-Frame-Options`), MIME-sniffing (`X-Content-Type-Options`), and cross-site scripting (XSS).

---

## 5. Security Threat Matrix

| Threat | Security Control | Where It Is Implemented |
|---|---|---|
| **Brute-Force & Credential Stuffing** | One-way cryptographic salting with `bcrypt` (10 rounds); strong password length validation | [models/User.js](file:///c:/Users/amank/Desktop/CC'-MP/models/User.js) & [routes/auth.js](file:///c:/Users/amank/Desktop/CC'-MP/routes/auth.js) |
| **Cross-Tenant Unauthorized File Access** | Multi-tenant ownership verification (`file.owner === req.user.id`) returning `403 Forbidden` | [routes/files.js](file:///c:/Users/amank/Desktop/CC'-MP/routes/files.js#L120-L135) |
| **Public Data Leakage via URL Scraping** | Private Azure container + 10-minute short-lived, read-only (`r`) SAS signatures | [config/azureStorage.js](file:///c:/Users/amank/Desktop/CC'-MP/config/azureStorage.js) |
| **Denial of Service (DoS) & Remote Code Execution** | Multer memory storage 10 MB size limit and strict MIME/extension whitelist (`pdf`, `png`, `jpg`, `mp4`) | [middleware/upload.js](file:///c:/Users/amank/Desktop/CC'-MP/middleware/upload.js) |
| **Network Eavesdropping & Man-in-the-Middle (MitM)** | TLS 1.2+ encryption in transit across all HTTP, MongoDB Atlas, and Azure Storage REST calls | [server.js](file:///c:/Users/amank/Desktop/CC'-MP/server.js), [config/db.js](file:///c:/Users/amank/Desktop/CC'-MP/config/db.js), Azure Network |
