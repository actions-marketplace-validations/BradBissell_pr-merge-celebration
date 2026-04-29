import chalk from 'chalk';
import { GitHubClient } from './github';
import { SlackNotifier } from './slack';
import { getConfig } from './config';
import { computeEffectiveMergeWindow } from './window';

async function main() {
  try {
    console.log(chalk.bold.magenta('🎉 Starting PR Merge Celebration Bot...\n'));

    const config = getConfig();

    const effectiveWindowHours = computeEffectiveMergeWindow(
      config.mergeWindowHours,
      config.weekendCatchup
    );

    if (effectiveWindowHours !== config.mergeWindowHours) {
      console.log(
        chalk.cyan(
          `📅 Monday weekend-catchup active — extending merge window from ${chalk.bold(
            config.mergeWindowHours.toString()
          )}h to ${chalk.bold(effectiveWindowHours.toString())}h\n`
        )
      );
    }

    const githubClient = new GitHubClient(config.githubToken);
    const slackNotifier = new SlackNotifier(
      config.slackWebhookUrl,
      effectiveWindowHours,
      { botToken: config.slackBotToken, channel: config.slackChannel }
    );

    console.log(chalk.blue(`Looking back ${chalk.bold(effectiveWindowHours.toString())} hours for merged PRs\n`));
    const mergedPRs = await githubClient.getMergedPRsInTimeWindow(config.repos, effectiveWindowHours);

    console.log(chalk.yellow(`\nTotal merged PRs found: ${chalk.bold(mergedPRs.length.toString())}\n`));

    if (mergedPRs.length > 0) {
      console.log(chalk.green('Merged PRs:'));
      mergedPRs.forEach((pr) => {
        console.log(chalk.white(`  - ${chalk.bold(pr.repository)}#${pr.number}: ${pr.title} ${chalk.gray(`(by ${pr.author})`)}`));
      });
      console.log('');
    }

    await slackNotifier.sendCelebration(mergedPRs);

    console.log(chalk.bold.green('\n✅ PR Celebration complete!'));
  } catch (error) {
    console.error(chalk.bold.red('\n❌ Error running PR celebration:'), error);
    process.exit(1);
  }
}

main();
