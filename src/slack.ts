import chalk from "chalk";
import axios from "axios";
import {
  MergedPR,
  SlackBlock,
  WebhookType,
  SlackBlockMessage,
  SlackWorkflowMessage,
  DeliveryMode,
  SlackChatPostMessageRequest,
  SlackChatPostMessageResponse,
} from "./types";

const SLACK_API_BASE = "https://slack.com/api";

export interface SlackBotOptions {
  botToken?: string;
  channel?: string;
}

export class SlackNotifier {
  private webhookUrl?: string;
  private botToken?: string;
  private channel?: string;
  private mergeWindowHours: number;
  private mode: DeliveryMode;

  constructor(
    webhookUrl: string | undefined,
    mergeWindowHours: number = 24,
    options: SlackBotOptions = {}
  ) {
    this.webhookUrl = webhookUrl;
    this.botToken = options.botToken;
    this.channel = options.channel;
    this.mergeWindowHours = mergeWindowHours;

    if (this.botToken && this.channel) {
      this.mode = DeliveryMode.BOT_API;
    } else if (this.webhookUrl) {
      this.mode = DeliveryMode.WEBHOOK;
    } else {
      throw new Error(
        "SlackNotifier requires either a webhook URL or a bot token + channel"
      );
    }
  }

  /**
   * Detect webhook type from URL pattern (only used in WEBHOOK mode).
   * Incoming Webhooks: https://hooks.slack.com/services/...
   * Workflow Webhooks: https://hooks.slack.com/workflows/... or .../triggers/...
   */
  private detectWebhookType(): WebhookType {
    if (
      this.webhookUrl!.includes("/workflows/") ||
      this.webhookUrl!.includes("/triggers/")
    ) {
      return WebhookType.WORKFLOW;
    }
    return WebhookType.INCOMING;
  }

  async sendCelebration(prs: MergedPR[]): Promise<void> {
    if (prs.length === 0) {
      console.log(
        chalk.yellow("No merged PRs found - skipping Slack notification")
      );
      return;
    }

    if (this.mode === DeliveryMode.BOT_API) {
      await this.sendThreadedCelebration(prs);
      return;
    }

    await this.sendWebhookCelebration(prs);
  }

  private async sendWebhookCelebration(prs: MergedPR[]): Promise<void> {
    const webhookType = this.detectWebhookType();
    const message =
      webhookType === WebhookType.WORKFLOW
        ? this.buildSimpleTextMessage(prs)
        : this.buildCelebrationMessage(prs);

    try {
      await axios.post(this.webhookUrl!, message);
      const formatType =
        webhookType === WebhookType.WORKFLOW
          ? "workflow webhook"
          : "incoming webhook";
      console.log(
        chalk.green(
          `Successfully sent celebration for ${chalk.bold(
            prs.length.toString()
          )} PRs to Slack (${formatType})!`
        )
      );
    } catch (error) {
      console.error(chalk.red("Error sending message to Slack:"), error);
      throw error;
    }
  }

  /**
   * Post a parent celebration message and one threaded reply per repo group,
   * plus a final threaded footer reply.
   */
  private async sendThreadedCelebration(prs: MergedPR[]): Promise<void> {
    const repoGroups = this.groupPRsByRepo(prs);
    const summaryText = this.buildSummaryFallbackText(prs);

    try {
      const parentTs = await this.postMessage({
        channel: this.channel!,
        text: summaryText,
        blocks: this.buildParentBlocks(prs),
      });

      for (const [repo, repoPRs] of Object.entries(repoGroups)) {
        await this.postMessage({
          channel: this.channel!,
          text: `${repo}: ${repoPRs.length} PR${repoPRs.length > 1 ? "s" : ""}`,
          blocks: this.buildRepoReplyBlocks(repo, repoPRs),
          thread_ts: parentTs,
        });
      }

      await this.postMessage({
        channel: this.channel!,
        text: "Amazing work everyone! Keep shipping!",
        blocks: this.buildFooterBlocks(),
        thread_ts: parentTs,
      });

      console.log(
        chalk.green(
          `Successfully sent threaded celebration for ${chalk.bold(
            prs.length.toString()
          )} PRs to Slack (bot API, ${
            Object.keys(repoGroups).length
          } repo replies)!`
        )
      );
    } catch (error) {
      console.error(chalk.red("Error sending message to Slack:"), error);
      throw error;
    }
  }

  /**
   * POST to chat.postMessage. Returns the parent message ts on success.
   * Throws on transport errors or `ok: false` API responses.
   */
  private async postMessage(
    request: SlackChatPostMessageRequest
  ): Promise<string> {
    const response = await axios.post<SlackChatPostMessageResponse>(
      `${SLACK_API_BASE}/chat.postMessage`,
      request,
      {
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );

    const data = response.data;
    if (!data || !data.ok) {
      throw new Error(
        `Slack chat.postMessage failed: ${data?.error ?? "unknown error"}`
      );
    }
    if (!data.ts) {
      throw new Error(
        "Slack chat.postMessage succeeded but did not return a ts"
      );
    }
    return data.ts;
  }

  private getDayHeader(): string {
    const dayOfWeek = new Date().getDay();
    const headers: Record<number, string> = {
      1: "Monday Merge Magic!",
      2: "Turbo Tuesday!",
      3: "Winning Wednesday!",
      4: "Throwdown Thursday!",
      5: "Fantastic Friday!",
    };
    return headers[dayOfWeek] || "Time to Celebrate!";
  }

  private pickRandomEmoji(): string {
    const emojis = ["🎉", "🚀", "✨", "🎊", "🎈", "🌟", "💫", "🔥"];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  private buildSummaryText(prs: MergedPR[]): string {
    const uniqueAuthors = new Set(prs.map((pr) => pr.author));
    return `*${prs.length}* awesome PR${
      prs.length > 1 ? "s" : ""
    } merged in the last ${this.mergeWindowHours} hour${
      this.mergeWindowHours !== 1 ? "s" : ""
    } by *${uniqueAuthors.size}* contributor${
      uniqueAuthors.size > 1 ? "s" : ""
    }!`;
  }

  /**
   * Plain-text fallback used as the `text` field on chat.postMessage parent —
   * shown in notifications and accessible contexts.
   */
  private buildSummaryFallbackText(prs: MergedPR[]): string {
    const uniqueAuthors = new Set(prs.map((pr) => pr.author));
    return `${this.getDayHeader()} ${prs.length} PR${
      prs.length > 1 ? "s" : ""
    } merged by ${uniqueAuthors.size} contributor${
      uniqueAuthors.size > 1 ? "s" : ""
    }`;
  }

  /**
   * Parent message blocks — header + summary stats + a hint pointing to the thread.
   */
  private buildParentBlocks(prs: MergedPR[]): SlackBlock[] {
    const randomEmoji = this.pickRandomEmoji();
    const headerText = this.getDayHeader();

    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${randomEmoji} ${headerText} ${randomEmoji}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: this.buildSummaryText(prs),
        },
      },
    ];
  }

  /**
   * One repo group's worth of blocks — used as a threaded reply.
   *
   * Renders all PRs in a single section block with explicit blank lines
   * between entries. This gives reliable visual spacing in both the rendered
   * channel view and in plain-text contexts (mobile notifications, copy-paste,
   * screen readers) where consecutive section blocks would otherwise collapse.
   */
  private buildRepoReplyBlocks(repo: string, repoPRs: MergedPR[]): SlackBlock[] {
    const lines: string[] = [`*📦 ${repo}*`, ""];

    repoPRs.forEach((pr, index) => {
      lines.push(
        `🔀 <${pr.url}|#${pr.number}: ${pr.title}>`,
        `   👤 @${pr.author}`
      );
      if (index < repoPRs.length - 1) {
        lines.push("");
      }
    });

    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: lines.join("\n"),
        },
      },
    ];
  }

  private buildFooterBlocks(): SlackBlock[] {
    return [
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "🙌 Amazing work everyone! Keep shipping! 🙌",
          },
        ],
      },
    ];
  }

  /**
   * Build a simple text message for Slack Workflow Webhooks
   */
  private buildSimpleTextMessage(prs: MergedPR[]): SlackWorkflowMessage {
    const uniqueAuthors = new Set(prs.map((pr) => pr.author));
    const repoGroups = this.groupPRsByRepo(prs);

    const randomEmoji = this.pickRandomEmoji();
    const headerText = this.getDayHeader();

    let message = `${randomEmoji} ${headerText} ${randomEmoji}\n\n`;

    message += `*${prs.length}* awesome PR${
      prs.length > 1 ? "s" : ""
    } merged in the last ${this.mergeWindowHours} hour${
      this.mergeWindowHours !== 1 ? "s" : ""
    } by *${uniqueAuthors.size}* contributor${
      uniqueAuthors.size > 1 ? "s" : ""
    }!\n\n`;

    message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    Object.entries(repoGroups).forEach(([repo, repoPRs]) => {
      message += `📦 ${repo}\n\n`;

      repoPRs.forEach((pr) => {
        message += `  • 🔀 #${pr.number}: ${pr.title}\n`;
        message += `        - 👤 @${pr.author}\n`;
        message += `        - ${pr.url}\n\n`;
      });
    });

    message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    message += "🙌 Amazing work everyone! Keep shipping! 🙌";

    return { message };
  }

  /**
   * Build a rich Block Kit message for Slack Incoming Webhooks
   */
  private buildCelebrationMessage(prs: MergedPR[]): SlackBlockMessage {
    const randomEmoji = this.pickRandomEmoji();
    const headerText = this.getDayHeader();
    const repoGroups = this.groupPRsByRepo(prs);

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${randomEmoji} ${headerText} ${randomEmoji}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: this.buildSummaryText(prs),
        },
      },
      {
        type: "divider",
      },
    ];

    Object.entries(repoGroups).forEach(([repo, repoPRs]) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📦 ${repo}*`,
        },
      });

      repoPRs.forEach((pr) => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• 🔀 <${pr.url}|#${pr.number}: ${pr.title}>\n  _👤 @${pr.author}_`,
          },
        });
      });
    });

    blocks.push(
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "🙌 Amazing work everyone! Keep shipping! 🙌",
          },
        ],
      }
    );

    return { blocks };
  }

  private groupPRsByRepo(prs: MergedPR[]): Record<string, MergedPR[]> {
    return prs.reduce((acc, pr) => {
      if (!acc[pr.repository]) {
        acc[pr.repository] = [];
      }
      acc[pr.repository].push(pr);
      return acc;
    }, {} as Record<string, MergedPR[]>);
  }
}
