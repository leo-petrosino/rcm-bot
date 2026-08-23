# RCM Command & Personnel Management Bot

Custom Discord bot for the Royal Canadian Army (RCM) Roblox community.

## Features
- Bloxlink-based Roblox verification
- Bot-initiated Roblox group rank changes
- Rank-based command permissions (hard-coded chain of command)
- Strike and discipline tracking
- Immutable audit logging
- Auto LWA (Left Without Discharge) detection
- Multi-sheet Google Sheets database organized by class

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in all values.

### 3. Deploy slash commands
```bash
npm run deploy
```

### 4. Start the bot
```bash
npm start
```

## Commands
- `/verify [roblox_username]` — Link Roblox account
- `/profile [@user]` — View service record
- `/promote [@user] [reason]` — Promote one rank (Officer Cadet+)
- `/demote [@user] [reason]` — Demote one rank (Officer Cadet+)
- `/strike [@user] [severity] [reason]` — Issue strike (Captain+)
- `/pardon [@user] [strike_id] [reason]` — Remove strike
- `/discharge [@user] [type] [reason]` — Discharge member (Captain+)
- `/audit [@user] [limit]` — View action history (Sergeant+)
- `/loa [start] [end] [reason]` — Request leave
- `/editprofile [@user] [field] [value] [reason]` — Edit records (Major+)
- `/batchpromote [@users] [rank] [reason]` — Mass promote (Captain+)

## Database Sheets
Create these tabs in your Google Sheet:
- `Personnel_Index`, `Audit_Log`, `Strike_Log`, `LWA`, `Discharged`
- `Senior_Generals`, `Division_Commanders`, `Senior_Formation`
- `Senior_Officers`, `Junior_Officers`, `Subordinate_Officers`
- `Senior_NCOs`, `Junior_NCOs`, `Enlisted`

## Finding Roblox Rank IDs
Run `npm run list-roles` after setting `ROBLOX_COOKIE` to see your group's rank IDs.
