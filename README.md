# Royal Canadian Military (RCM) — Logistics & Personnel Command Bot

Custom Discord & Roblox logistics bot for the **Royal Canadian Military** (mil-sim & roleplay community). 

Built to handle all personnel logistics: dynamic ranking, multi-regiment commands, disciplinary actions, service record dossiers, Leave of Absence, community blacklists, anti-deserter watchdog (LWA), and automated Google Sheets formatting.

---

## 🎖️ Key Features

- **Dynamic Rank Matrix**: Synchronizes the 19-tier Canadian Armed Forces (CAF) hierarchy across Discord roles, Roblox Group ranks, and Google Sheets without hardcoding IDs.
- **Regimental Formations**: Full command structure for the 5 official regiments:
  1. **GGHG** — Governor General's Horse Guards *(Armoured Reconnaissance & Cavalry)*
  2. **JTF2** — Joint Task Force 2 *(Special Operations & Counter-Terrorism)*
  3. **CMTC** — Canadian Military Training Company *(Doctrine & Training)*
  4. **CFMP** — Canadian Forces Military Police *(Force Protection & Military Justice)*
  5. **GGFG** — Governor General's Foot Guards *(Senior Household Infantry)*
- **Executive Google Sheets Dashboard**: Transforms standard Google Sheets into an executive CAF military dashboard with colored title banners, real-time KPI cards, custom column widths, alternating zebra rows, status badges, and regimental roster blocks.
- **Disciplinary Justice**:
  - Formal minor (+1) and major (+2) strikes with docket IDs.
  - Threshold escalations: $\ge 3$ strikes blocks promotions, $\ge 5$ triggers review, $\ge 6$ mandates discharge.
  - Rank-gated pardon system (pardoners must outrank the citing officer).
- **Separation & Blacklists**:
  - Three-tier discharge: *Honorable*, *General*, and *Dishonorable*.
  - Permanent community and Roblox group blacklists with proof link logging and automatic group exiles.
  - Left Without Discharge (**LWA**) watchdog detects deserters who leave Discord unexcused.
- **Service Record Dossiers**: Rich military personnel profiles displaying ranks, regimental badges, service duration, disciplinary standing, Roblox avatars, and recent audit history.

---

## 📋 Slash Commands

### 1. Personnel & Identification
- `/verify [username]` — Link Roblox account to the RCM database, automatically detect group rank, and grant corresponding role.
- `/profile [user]` — Inspect an official Canadian Armed Forces military service dossier.
- `/editprofile [user] [field] [value] [reason]` — Amend service record fields (Major+).

### 2. Career & Ranking Logistics
- `/promote [user] [reason]` — Advance a member one rank up the CAF ladder with dual-sync and promotion citation (Officer Cadet+).
- `/demote [user] [reason]` — Demote a member one rank down the hierarchy with dual-sync (Officer Cadet+).
- `/setrank [user] [rank] [reason]` — Directly commission or adjust a member to an exact rank (Major+).
- `/batchpromote [users] [rank] [reason]` — Mass promote multiple members during ceremonies (Captain+).
- `/sync-ranks` — Dynamically pull all roles and ranks from Roblox & Discord and update the matrix (High Command).

### 3. Regimental Commands
- `/regiment list` — View all 5 regiments, mottos, specializations, and active personnel counts.
- `/regiment view [regiment]` — View a regiment's full dossier and active member roster.
- `/regiment assign [user] [regiment] [role] [notes]` — Post a member to a regiment (Captain+).
- `/regiment remove [user] [reason]` — Relieve a member from their regiment.
- `/regiment transfer [user] [target_regiment] [reason]` — Transfer between regiments.

### 4. Discipline & Justice
- `/strike [user] [severity] [reason]` — Issue a minor (+1) or major (+2) strike citation (Captain+).
- `/pardon [user] [strike_id] [reason]` — Pardon an active strike (requires equal or higher rank than issuer).
- `/discharge [user] [type] [reason]` — Formally discharge a member (Honorable, General, Dishonorable).
- `/blacklist add [target] [reason] [proof] [exile_roblox]` — Place a user on the blacklist and exile them from Roblox (Colonel+).
- `/blacklist remove [target] [reason]` — Revoke a blacklist restriction.
- `/blacklist check [target]` — Check if a user is blacklisted.
- `/audit [user] [limit] [action]` — Search and inspect administrative audit dockets (Sergeant+).

### 5. Readiness & Leave
- `/loa request [start] [end] [reason]` — Log a Leave of Absence.
- `/loa return` — Conclude LOA and return to active status.

### 6. Administration & Styling
- `/format-sheets` — One-click executive formatting of the Google Spreadsheet into themed blocks, KPI cards, and custom widths (High Command).

---

## 🛠️ Environment Configuration (`.env`)

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id
GUILD_ID=1536920332903125036
AUDIT_CHANNEL_ID=your_audit_channel_id_optional

# Google Sheets Integration
GOOGLE_SHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Roblox Logistics Account
ROBLOX_COOKIE=your_roblox_security_cookie
ROBLOX_GROUP_ID=10872992

# Optional Regimental Roblox Groups (if separate from main)
ROBLOX_GGHG_GROUP_ID=
ROBLOX_JTF2_GROUP_ID=
ROBLOX_CMTC_GROUP_ID=
ROBLOX_CFMP_GROUP_ID=
ROBLOX_GGFG_GROUP_ID=
```

---

## 🚀 Setup & Deployment

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Deploy Slash Commands**:
   ```bash
   npm run deploy
   ```

3. **Start the Bot**:
   ```bash
   npm start
   ```

4. **Format Spreadsheet**:
   Once the bot joins your server, run `/format-sheets` to generate the executive blocks and layout!
