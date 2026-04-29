import * as core from "@actions/core";
import chalk from "chalk";
import { RepoConfig } from "./types";

export function getConfig() {
  // Read GitHub Actions inputs if available, otherwise fall back to env vars
  const githubToken = core.getInput("github-token") || process.env.GITHUB_TOKEN;
  const slackWebhookUrl =
    core.getInput("slack-webhook-url") || process.env.SLACK_WEBHOOK_URL;
  const slackBotToken =
    core.getInput("slack-bot-token") || process.env.SLACK_BOT_TOKEN;
  const slackChannel =
    core.getInput("slack-channel") || process.env.SLACK_CHANNEL;
  const reposToCheck =
    core.getInput("repos-to-check") || process.env.REPOS_TO_CHECK;
  const mergeWindow =
    core.getInput("merge-window") || process.env.MERGE_WINDOW || "24";

  if (!githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Either bot token + channel OR webhook URL must be configured.
  // Bot token mode takes precedence (enables threaded replies).
  const hasBotConfig = Boolean(slackBotToken && slackChannel);
  const hasWebhookConfig = Boolean(slackWebhookUrl);

  if (slackBotToken && !slackChannel) {
    throw new Error(
      "SLACK_CHANNEL is required when SLACK_BOT_TOKEN is set (channel ID like C0123ABC456 or #channel-name)"
    );
  }

  if (!hasBotConfig && !hasWebhookConfig) {
    throw new Error(
      "Either SLACK_BOT_TOKEN + SLACK_CHANNEL (for threaded messages) or SLACK_WEBHOOK_URL is required"
    );
  }

  if (slackBotToken && !slackBotToken.startsWith("xoxb-")) {
    throw new Error(
      "SLACK_BOT_TOKEN must be a valid Slack bot token (should start with xoxb-)"
    );
  }

  if (
    hasWebhookConfig &&
    !slackWebhookUrl!.startsWith("https://hooks.slack.com/")
  ) {
    throw new Error(
      "SLACK_WEBHOOK_URL must be a valid Slack webhook URL (should start with https://hooks.slack.com/)"
    );
  }

  if (!reposToCheck) {
    throw new Error(
      "REPOS_TO_CHECK environment variable is required (format: owner/repo,owner/repo)"
    );
  }

  const mergeWindowHours = parseInt(mergeWindow, 10);
  if (
    isNaN(mergeWindowHours) ||
    mergeWindowHours <= 0 ||
    mergeWindowHours > 720
  ) {
    throw new Error(
      "MERGE_WINDOW must be a positive number between 1 and 720 hours (30 days)"
    );
  }

  const repos = parseRepos(reposToCheck);

  console.log(
    chalk.cyan(
      `Checking ${chalk.bold(repos.length.toString())} repository(ies):`
    )
  );
  repos.forEach((repo) =>
    console.log(chalk.gray(`  - ${repo.owner}/${repo.repo}`))
  );
  console.log(
    chalk.cyan(
      `Slack mode: ${chalk.bold(hasBotConfig ? "bot token (threaded)" : "webhook")}`
    )
  );
  console.log("");

  return {
    githubToken,
    slackWebhookUrl: hasBotConfig ? undefined : slackWebhookUrl,
    slackBotToken: hasBotConfig ? slackBotToken : undefined,
    slackChannel: hasBotConfig ? slackChannel : undefined,
    repos,
    mergeWindowHours,
  };
}

function parseRepos(reposString: string): RepoConfig[] {
  const repos = reposString
    .split(",")
    .map((repo) => repo.trim())
    .filter((repo) => repo.length > 0);

  return repos.map((repo) => {
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
      throw new Error(
        `Invalid repo format: ${repo}. Expected format: owner/repo`
      );
    }
    return { owner, repo: name };
  });
}
