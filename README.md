# PR Merge Celebration Bot

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-PR%20Merge%20Celebration-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=github)](https://github.com/marketplace/actions/pr-merge-celebration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A GitHub Action that celebrates merged pull requests by posting celebratory messages to Slack. Pair it with a github cron workflow (example included) to regularly celebrate your colleagues' work by checking your repositories daily and sending a  summary of all PRs merged in the past given window (defaults to 1 day).

## Features

- Automatically checks multiple repositories for merged PRs
- Runs on a daily cron schedule (configurable)
- Configurable time window for checking merged PRs (default: 24 hours)
- Posts fun, celebratory messages to Slack
- Groups PRs by repository
- Shows contributor statistics
- Manual trigger support for testing

## Setup Instructions

### 1. Choose Your Slack Delivery Method

This action supports three ways to post to Slack. Pick one:

| Option | What it sends | Threaded? | Auth |
|---|---|---|---|
| **A: Bot Token** (Recommended) | Rich Block Kit, summary as parent, one threaded reply per repo | ✅ | `xoxb-` token + channel ID |
| **B: Incoming Webhook** | Single rich Block Kit message | ❌ | Webhook URL |
| **C: Workflow Webhook** | Single plain-text message | ❌ | Webhook URL |

If both a bot token and a webhook URL are provided, the bot token wins (threaded mode). The action auto-detects which webhook type you're using based on the URL.

#### Option A: Bot Token (Recommended — Threaded Messages)

Posts a clean summary message to the channel, then posts one threaded reply per repository so the channel stays uncluttered when many PRs land at once.

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "PR Celebration Bot") and select your workspace
4. Click "OAuth & Permissions" from the left sidebar
5. Under **Bot Token Scopes**, add `chat:write` (and optionally `chat:write.public` if you want to post to channels the bot hasn't been invited to)
6. Click "Install to Workspace" at the top of the OAuth & Permissions page
7. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
8. In Slack, invite the bot to the channel: `/invite @YourBotName`
9. Get the channel ID: in Slack, right-click the channel → "View channel details" → copy the ID at the bottom (looks like `C0123ABC456`). You can also pass `#channel-name`.

#### Option B: Incoming Webhook (Rich Formatting, No Threading)

Creates beautifully formatted messages with headers, dividers, clickable links, and rich formatting.

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "PR Celebration Bot") and select your workspace
4. Click "Incoming Webhooks" from the left sidebar
5. Toggle "Activate Incoming Webhooks" to **On**
6. Click "Add New Webhook to Workspace"
7. Select the channel where you want celebrations posted
8. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

#### Option C: Workflow Webhook (Simple Text)

Uses plain text formatting with emojis and unicode characters. Good for existing workflow integrations.

1. Go to https://slack.com/apps → Search for "Workflow Builder"
2. Create a new workflow or edit an existing one
3. Add a "Webhook" trigger or variable
4. Copy the webhook URL (starts with `https://hooks.slack.com/workflows/...` or `https://hooks.slack.com/triggers/...`)
5. Configure your workflow to accept a variable named `message` (string type)

### 2. Configure GitHub Repository Secrets

Go to your repository's Settings → Secrets and variables → Actions, then add the secrets that match your chosen option from step 1.

**For Option A (Bot Token — Threaded):**
- `SLACK_BOT_TOKEN` — your `xoxb-...` Bot User OAuth Token
- `SLACK_CHANNEL` — channel ID (e.g. `C0123ABC456`) or `#channel-name`

**For Option B or C (Webhook):**
- `SLACK_WEBHOOK_URL` — your Slack webhook URL

**Always required:**
- `REPOS_TO_CHECK` — comma-separated list of repos to monitor (e.g., `owner/repo1,owner/repo2`)

**Optional:**
- `MERGE_WINDOW` — number of hours to look back for merged PRs (default: 24)
- `WEEKEND_CATCHUP` — set to `true` to extend the merge window by 48 hours on Mondays so a Monday-morning run picks up Saturday and Sunday merges. No-op on other days. (default: `false`)

The `GITHUB_TOKEN` is automatically provided by GitHub Actions, but if you need to check private repos or repos outside your organization, create a Personal Access Token with `repo` scope and add it as a secret.

### 3. Install Dependencies and Build

```bash
pnpm install
pnpm run build
```

### 4. Create the GitHub Actions Workflow

Create `.github/workflows/pr-celebration.yml` in your repository:

```yaml
name: PR Merge Celebration

on:
  schedule:
    # Default: 11 AM Eastern Time (EST)
    - cron: '0 16 * * *'  # 11 AM EST / 12 PM EDT (4 PM UTC)
  workflow_dispatch:  # Allow manual triggers
    inputs:
      merge-window:
        description: 'Hours to look back for merged PRs (optional, defaults to 24)'
        required: false
        type: string

jobs:
  celebrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Celebrate Merged PRs
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # Option A (Bot Token, threaded — recommended):
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel: ${{ secrets.SLACK_CHANNEL }}
          # Option B/C (Webhook — fallback). Either supply this OR the bot
          # token + channel above. If both are set, the bot token takes
          # precedence (threaded messages).
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          repos-to-check: ${{ secrets.REPOS_TO_CHECK }}
          merge-window: ${{ inputs.merge-window || '24' }}
          weekend-catchup: 'true'  # Mondays auto-extend by 48h to cover Sat+Sun
```

### 5. Configure the Cron Schedule (Optional)

The action defaults to running at **11 AM Eastern Time** (EST). To change the schedule, edit `.github/workflows/pr-celebration.yml` and uncomment/modify one of the provided time options:

```yaml
on:
  schedule:
    # Default: 11 AM Eastern Time (EST)
    - cron: '0 16 * * *'  # 11 AM EST / 12 PM EDT (4 PM UTC)
    # - cron: '0 15 * * *'  # 10 AM EST / 11 AM EDT (3 PM UTC)
    # - cron: '0 13 * * *'  # 8 AM EST / 9 AM EDT (1 PM UTC)
    # - cron: '0 17 * * *'  # 12 PM EST / 1 PM EDT (5 PM UTC)
    # - cron: '0 21 * * *'  # 4 PM EST / 5 PM EDT (9 PM UTC)
```

Simply comment out the current line and uncomment your preferred time.

**Note**: GitHub Actions cron uses UTC time and doesn't adjust for Daylight Saving Time. Use [crontab.guru](https://crontab.guru/) for calculating custom times.

**Important**: Align your `merge-window` parameter with your cron schedule. For example:
- Daily cron (24 hours) → `merge-window: '24'` (default)
- Every 12 hours → `merge-window: '12'`
- Every 6 hours → `merge-window: '6'`

### Weekend Catchup (Monday Coverage)

If you run a daily cron and want Monday's celebration to also include PRs merged Saturday and Sunday, set:

```yaml
weekend-catchup: 'true'
```

When enabled, the action checks the runner's day of the week. **Only on Mondays**, the merge window is auto-extended by 48 hours — so `merge-window: '24'` becomes a 72-hour lookback on Monday and stays at 24 hours every other day. The summary message and Slack header reflect the extended window automatically.

**Timezone note**: Day-of-week is taken from the runner's clock, which is **UTC** on GitHub-hosted runners. If your cron fires near UTC midnight, the runner's "Monday" may not match your local Monday. For most schedules (e.g. 11 AM Eastern → 16:00 UTC), Monday-UTC and your local Monday line up.

### 6. Enable GitHub Actions

1. Go to your repository's Actions tab
2. Enable workflows if prompted
3. The celebration will run automatically on schedule

## Manual Testing

You can manually trigger the workflow to test it:

1. Go to Actions tab in your repository
2. Select "PR Merge Celebration" workflow
3. Click "Run workflow"
4. Optionally specify the merge window in hours (e.g., 12, 48)
5. Click "Run workflow"

## Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env`. Use either bot-token mode (threaded) or webhook mode:
   ```
   GITHUB_TOKEN=ghp_your_token_here

   # Option A — bot token (threaded). Preferred when both modes are set.
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_CHANNEL=C0123ABC456

   # Option B/C — webhook (single message, no threading)
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

   REPOS_TO_CHECK=owner/repo1,owner/repo2
   MERGE_WINDOW=24
   ```

3. Run locally:
   ```bash
   pnpm run dev
   ```

## Example Slack Messages

The bot automatically formats messages based on the delivery method you configured:

### Bot Token (Threaded — Option A)

The summary is the parent message; details land in the thread, one reply per repository:

```
[parent message]
🎉 Time to Celebrate! 🎉

3 awesome PRs merged in the last 24 hours by 2 contributors!

🧵 PR details in thread below
   │
   ├── [thread reply 1]
   │   📦 octocat/Hello-World
   │   • 🔀 #123: Add amazing new feature
   │     👤 @alice
   │   • 🔀 #124: Fix critical bug
   │     👤 @bob
   │
   ├── [thread reply 2]
   │   📦 acme/widgets
   │   • 🔀 #45: Bump dependency versions
   │     👤 @alice
   │
   └── [thread reply 3]
       🙌 Amazing work everyone! Keep shipping! 🙌
```

### Incoming Webhook (Rich Format — Option B)

Includes clickable PR links, rich formatting, and Block Kit elements:

```
🎉 Time to Celebrate! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3 awesome PRs merged in the last 24 hours by 2 contributors!

────────────────────────────────

📦 octocat/Hello-World

• 🔀 #123: Add amazing new feature    [clickable link]
  👤 @alice

• 🔀 #124: Fix critical bug           [clickable link]
  👤 @bob

────────────────────────────────

🙌 Amazing work everyone! Keep shipping! 🙌
```

### Workflow Webhook (Text Format — Option C)

Simple text with emojis and unicode formatting:

```
🎉 Time to Celebrate! 🎉

*3* awesome PRs merged in the last 24 hours by *2* contributors!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 octocat/Hello-World

  • 🔀 #123: Add amazing new feature
    👤 @alice
    https://github.com/octocat/Hello-World/pull/123

  • 🔀 #124: Fix critical bug
    👤 @bob
    https://github.com/octocat/Hello-World/pull/124

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🙌 Amazing work everyone! Keep shipping! 🙌
```

## How It Works

1. The GitHub Action runs on a cron schedule (default: daily at 11 AM Eastern Time)
2. The TypeScript script fetches all PRs from specified repositories
3. Filters for PRs merged in the configured time window (default: 24 hours)
4. Formats a fun celebration message
5. Posts to Slack:
   - **Bot Token mode**: posts a parent summary via `chat.postMessage`, then one threaded reply per repository, then a footer reply — all using the parent's `thread_ts`.
   - **Webhook mode**: posts a single message (rich or text, depending on webhook type).

## Customization

### Change Message Style

Edit `src/slack.ts` to customize:
- Header messages (line 30-37)
- Emojis (line 28)
- Message format (line 40-90)

### Check Different Time Ranges

Set the `MERGE_WINDOW` environment variable or use the `merge-window` action input:
```yaml
- name: Celebrate Merged PRs
  uses: ./
  with:
    merge-window: '12'  # Check last 12 hours instead of 24
```

## Troubleshooting

**No message is sent**
- Check that PRs were actually merged in the last 24 hours
- Verify your `REPOS_TO_CHECK` secret is correctly formatted
- Check the Actions logs for error messages

**Authentication errors**
- Ensure your `GITHUB_TOKEN` has appropriate permissions
- For private repos, use a Personal Access Token with `repo` scope

**Slack webhook errors**
- Verify your `SLACK_WEBHOOK_URL` is correct
- Check that the Slack app is still installed in your workspace
- The action automatically detects and supports both webhook types:
  - **Incoming Webhooks**: `https://hooks.slack.com/services/...` (rich formatting with Block Kit)
  - **Workflow Webhooks**: `https://hooks.slack.com/workflows/...` or `https://hooks.slack.com/triggers/...` (simple text)
- For workflow webhooks, ensure your workflow is configured to accept a `message` variable (string type)

**Bot token / threaded message errors**
- `channel_not_found` — the bot is not a member of the channel. In Slack, run `/invite @YourBotName` in the target channel, or set `chat:write.public` scope.
- `not_in_channel` — same fix as above.
- `invalid_auth` / `not_authed` — the `SLACK_BOT_TOKEN` is wrong, revoked, or not actually a bot token. Bot tokens start with `xoxb-`.
- `missing_scope` — re-install the app with the `chat:write` scope under OAuth & Permissions, then update the secret with the new token.
- The bot must be re-invited to a channel after being kicked, or after the channel is recreated with the same name.

## Releasing to GitHub Marketplace

This section is for maintainers who want to publish updates to the GitHub Marketplace.

### Prerequisites

- Repository must be public
- All tests must pass: `pnpm test`
- Code must be committed and pushed to `main` branch

### Release Process

Follow [semantic versioning](https://semver.org/) (MAJOR.MINOR.PATCH):
- **PATCH** (e.g., 1.0.1) - Bug fixes and small improvements
- **MINOR** (e.g., 1.1.0) - New features, backwards compatible
- **MAJOR** (e.g., 2.0.0) - Breaking changes

#### Step 1: Prepare the Release

1. Make your code changes and commit them
2. Run tests to ensure everything works:
   ```bash
   pnpm test
   ```
3. Rebuild the distribution bundle:
   ```bash
   pnpm run package
   ```
4. Commit the updated `dist/` directory:
   ```bash
   git add dist/
   git commit -m "build: update dist bundle for v1.x.x"
   git push origin main
   ```

#### Step 2: Create Git Tags

Create both a specific version tag and update the major version tag:

```bash
# For a new patch version (e.g., v1.0.1)
git tag -a v1.0.1 -m "Bug fixes and improvements"
git tag -fa v1 -m "Latest v1.x.x release"

# For a new minor version (e.g., v1.1.0)
git tag -a v1.1.0 -m "Add new features"
git tag -fa v1 -m "Latest v1.x.x release"

# For a new major version (e.g., v2.0.0)
git tag -a v2.0.0 -m "Breaking changes"
git tag -a v2 -m "Latest v2.x.x release"

# Push tags to GitHub (force push for floating major version tag)
git push origin v1.0.1  # or your specific version
git push origin v1 --force
```

**Why two tags?**
- `v1.0.1` - Specific version users can pin to for stability
- `v1` - "Floating" tag that users reference to get automatic updates

#### Step 3: Create GitHub Release

1. Go to your repository on GitHub
2. Click **Releases** → **Draft a new release**
3. Fill in the release form:
   - **Choose a tag**: Select the version tag (e.g., `v1.0.1`)
   - **Release title**: Same as tag (e.g., `v1.0.1`)
   - **Description**: Add detailed release notes

   Example release notes template:
   ```markdown
   ## 🎉 What's Changed

   ### ✨ New Features
   - Added feature X
   - Improved Y

   ### 🐛 Bug Fixes
   - Fixed issue with Z

   ### 🔧 Maintenance
   - Updated dependencies
   - Improved test coverage

   ## 📦 Usage

   ```yaml
   - uses: <username>/pr-merge-celebration@v1
     with:
       github-token: ${{ secrets.GITHUB_TOKEN }}
       slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
       repos-to-check: 'owner/repo1,owner/repo2'
   ```

   **Full Changelog**: https://github.com/<username>/pr-merge-celebration/compare/v1.0.0...v1.0.1
   ```

4. **Important**: Check ☑️ **"Publish this Action to the GitHub Marketplace"**
5. Select **Primary Category** (e.g., "Utilities" or "Deployment")
6. Click **Publish release**

#### Step 4: Verify Publication

1. Visit https://github.com/marketplace
2. Search for "PR Merge Celebration"
3. Verify your action appears with the new version

### Quick Release Commands

For convenience, here's a complete release workflow:

```bash
# 1. Make changes, test, and commit
pnpm test
pnpm run package
git add .
git commit -m "feat: add new feature"
git push origin main

# 2. Tag and push (replace with your version)
VERSION="v1.0.1"
git tag -a $VERSION -m "Release $VERSION"
git tag -fa v1 -m "Latest v1.x.x release"
git push origin $VERSION
git push origin v1 --force

# 3. Create GitHub Release via web UI
# Then verify on GitHub Marketplace
```

### Version Management

Users can reference your action in three ways:

```yaml
# Recommended: Major version (gets automatic updates)
- uses: <username>/pr-merge-celebration@v1

# Pinned to specific version (no automatic updates)
- uses: <username>/pr-merge-celebration@v1.0.1

# Most secure: Pinned to commit SHA
- uses: <username>/pr-merge-celebration@abc123
```

### Breaking Changes

When releasing a major version with breaking changes:

1. Document all breaking changes in the release notes
2. Provide migration guide for users
3. Update README with new usage examples
4. Consider maintaining the previous major version for a deprecation period

Example:
```bash
git tag -a v2.0.0 -m "BREAKING: New major version"
git tag -a v2 -m "Latest v2.x.x release"
git push origin v2.0.0
git push origin v2
```

## License

MIT
