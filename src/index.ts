import chalk from 'chalk';
import { GitHubClient } from './github';
import { SlackNotifier } from './slack';
import { getConfig } from './config';

async function main() {
  try {
    console.log(chalk.bold.magenta('🎉 Starting PR Merge Celebration Bot...\n'));

    // Load configuration
    const config = getConfig();

    // Initialize clients
    const githubClient = new GitHubClient(config.githubToken);
    const slackNotifier = new SlackNotifier(
      config.slackWebhookUrl,
      config.mergeWindowHours,
      { botToken: config.slackBotToken, channel: config.slackChannel }
    );

    // Fetch merged PRs from the configured time window
    console.log(chalk.blue(`Looking back ${chalk.bold(config.mergeWindowHours.toString())} hours for merged PRs\n`));
    const mergedPRs = await githubClient.getMergedPRsInTimeWindow(config.repos, config.mergeWindowHours);

    console.log(chalk.yellow(`\nTotal merged PRs found: ${chalk.bold(mergedPRs.length.toString())}\n`));

    if (mergedPRs.length > 0) {
      console.log(chalk.green('Merged PRs:'));
      mergedPRs.forEach((pr) => {
        console.log(chalk.white(`  - ${chalk.bold(pr.repository)}#${pr.number}: ${pr.title} ${chalk.gray(`(by ${pr.author})`)}`));
      });
      console.log('');
    }

    // Send celebration to Slack
    await slackNotifier.sendCelebration(mergedPRs);

    console.log(chalk.bold.green('\n✅ PR Celebration complete!'));
  } catch (error) {
    console.error(chalk.bold.red('\n❌ Error running PR celebration:'), error);
    process.exit(1);
  }
}

main();
