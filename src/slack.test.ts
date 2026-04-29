import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { SlackNotifier } from './slack';
import { MergedPR } from './types';

// Mock axios
vi.mock('axios');

// Mock chalk to return plain strings without ANSI codes
vi.mock('chalk', () => ({
  default: {
    yellow: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    bold: (str: string) => str,
  },
}));

describe('SlackNotifier', () => {
  let slackNotifier: SlackNotifier;
  const mockWebhookUrl = 'https://hooks.slack.com/services/test';
  const defaultMergeWindowHours = 24;

  beforeEach(() => {
    vi.clearAllMocks();
    slackNotifier = new SlackNotifier(mockWebhookUrl, defaultMergeWindowHours);
  });

  describe('sendCelebration', () => {
    it('should not send message when there are no PRs', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await slackNotifier.sendCelebration([]);

      expect(axios.post).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('No merged PRs found - skipping Slack notification');

      consoleLogSpy.mockRestore();
    });

    it('should send celebration message for single PR', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Add amazing feature',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      expect(axios.post).toHaveBeenCalledWith(mockWebhookUrl, expect.any(Object));

      const sentMessage = (axios.post as any).mock.calls[0][1];
      expect(sentMessage.blocks).toBeDefined();
      expect(sentMessage.blocks.length).toBeGreaterThan(0);
    });

    it('should send celebration message for multiple PRs', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Add feature A',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
        {
          title: 'Fix bug B',
          number: 124,
          author: 'bob',
          authorAvatar: 'https://avatar.com/bob',
          url: 'https://github.com/octocat/hello-world/pull/124',
          mergedAt: '2024-01-01T13:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      expect(axios.post).toHaveBeenCalledWith(mockWebhookUrl, expect.any(Object));
    });

    it('should group PRs by repository', async () => {
      const prs: MergedPR[] = [
        {
          title: 'PR from repo 1',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
        {
          title: 'PR from repo 2',
          number: 456,
          author: 'bob',
          authorAvatar: 'https://avatar.com/bob',
          url: 'https://github.com/microsoft/vscode/pull/456',
          mergedAt: '2024-01-01T13:00:00Z',
          repository: 'microsoft/vscode',
        },
        {
          title: 'Another PR from repo 1',
          number: 124,
          author: 'charlie',
          authorAvatar: 'https://avatar.com/charlie',
          url: 'https://github.com/octocat/hello-world/pull/124',
          mergedAt: '2024-01-01T14:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const blocks = sentMessage.blocks;

      const repoSections = blocks.filter(
        (block: any) => block.type === 'section' && block.text?.text?.includes('📦')
      );

      expect(repoSections.length).toBe(2);
    });

    it('should include correct contributor count', async () => {
      const prs: MergedPR[] = [
        {
          title: 'PR 1',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
        {
          title: 'PR 2',
          number: 124,
          author: 'bob',
          authorAvatar: 'https://avatar.com/bob',
          url: 'https://github.com/octocat/hello-world/pull/124',
          mergedAt: '2024-01-01T13:00:00Z',
          repository: 'octocat/hello-world',
        },
        {
          title: 'PR 3',
          number: 125,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/125',
          mergedAt: '2024-01-01T14:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const summaryBlock = sentMessage.blocks.find(
        (block: any) => block.type === 'section' && block.text?.text?.includes('contributor')
      );

      expect(summaryBlock.text.text).toContain('*3* awesome PRs');
      expect(summaryBlock.text.text).toContain('*2* contributors');
    });

    it('should use singular form for single PR and contributor', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Single PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const summaryBlock = sentMessage.blocks.find(
        (block: any) => block.type === 'section' && block.text?.text?.includes('contributor')
      );

      expect(summaryBlock.text.text).toContain('*1* awesome PR merged');
      expect(summaryBlock.text.text).toContain('*1* contributor!');
    });

    it('should include PR details in message', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Add amazing feature',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const prSections = sentMessage.blocks.filter(
        (block: any) => block.type === 'section' && block.text?.text?.includes('#123')
      );

      expect(prSections.length).toBeGreaterThan(0);
      const prBlock = prSections[0];
      expect(prBlock.text.text).toContain('🔀');
      expect(prBlock.text.text).toContain('Add amazing feature');
      expect(prBlock.text.text).toContain('👤 @alice');
      expect(prBlock.text.text).toContain('https://github.com/octocat/hello-world/pull/123');
    });

    it('should include header with random emoji and message', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const headerBlock = sentMessage.blocks.find((block: any) => block.type === 'header');

      expect(headerBlock).toBeDefined();
      expect(headerBlock.text.text).toBeTruthy();
    });

    it('should include footer with encouraging message', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const contextBlock = sentMessage.blocks.find((block: any) => block.type === 'context');

      expect(contextBlock).toBeDefined();
      expect(contextBlock.elements[0].text).toContain('Amazing work everyone! Keep shipping!');
    });

    it('should throw error when Slack API fails', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      const error = new Error('Slack API Error');
      (axios.post as any).mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(slackNotifier.sendCelebration(prs)).rejects.toThrow('Slack API Error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending message to Slack:', error);

      consoleErrorSpy.mockRestore();
    });

    it('should log success message when celebration is sent', async () => {
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await slackNotifier.sendCelebration(prs);

      expect(consoleLogSpy).toHaveBeenCalledWith('Successfully sent celebration for 1 PRs to Slack (incoming webhook)!');

      consoleLogSpy.mockRestore();
    });

    it('should use configured merge window hours in message', async () => {
      const customMergeWindow = 12;
      const customNotifier = new SlackNotifier(mockWebhookUrl, customMergeWindow);
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await customNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const summaryBlock = sentMessage.blocks.find(
        (block: any) => block.type === 'section' && block.text?.text?.includes('merged in the last')
      );

      expect(summaryBlock.text.text).toContain('merged in the last 12 hours');
    });

    it('should use singular hour when merge window is 1', async () => {
      const singleHourNotifier = new SlackNotifier(mockWebhookUrl, 1);
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await singleHourNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const summaryBlock = sentMessage.blocks.find(
        (block: any) => block.type === 'section' && block.text?.text?.includes('merged in the last')
      );

      expect(summaryBlock.text.text).toContain('merged in the last 1 hour by');
    });
  });

  describe('groupPRsByRepo (via integration)', () => {
    it('should correctly group multiple PRs from the same repository', async () => {
      const prs: MergedPR[] = [
        {
          title: 'PR 1',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
        {
          title: 'PR 2',
          number: 124,
          author: 'bob',
          authorAvatar: 'https://avatar.com/bob',
          url: 'https://github.com/octocat/hello-world/pull/124',
          mergedAt: '2024-01-01T13:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await slackNotifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      const prSections = sentMessage.blocks.filter(
        (block: any) =>
          block.type === 'section' && (block.text?.text?.includes('#123') || block.text?.text?.includes('#124'))
      );

      expect(prSections.length).toBe(2);
    });
  });

  describe('Webhook type detection and formatting', () => {
    it('should detect incoming webhook from URL and send Block Kit format', async () => {
      const incomingWebhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXX';
      const notifier = new SlackNotifier(incomingWebhookUrl);
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      expect(sentMessage).toHaveProperty('blocks');
      expect(Array.isArray(sentMessage.blocks)).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('incoming webhook')
      );

      consoleLogSpy.mockRestore();
    });

    it('should detect workflow webhook from URL with /workflows/ and send simple text format', async () => {
      const workflowWebhookUrl = 'https://hooks.slack.com/workflows/T00000000/A00000000/XXXX';
      const notifier = new SlackNotifier(workflowWebhookUrl);
      const prs: MergedPR[] = [
        {
          title: 'Test PR',
          number: 123,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/octocat/hello-world/pull/123',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'octocat/hello-world',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      expect(sentMessage).toHaveProperty('message');
      expect(typeof sentMessage.message).toBe('string');
      expect(sentMessage.message).toContain('🔀');
      expect(sentMessage.message).toContain('Test PR');
      expect(sentMessage.message).toContain('👤 @alice');
      expect(sentMessage.message).toContain('https://github.com/octocat/hello-world/pull/123');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('workflow webhook')
      );

      consoleLogSpy.mockRestore();
    });

    it('should detect workflow webhook from URL with /triggers/ and send simple text format', async () => {
      const triggerWebhookUrl = 'https://hooks.slack.com/triggers/T00000000/1234567890/XXXX';
      const notifier = new SlackNotifier(triggerWebhookUrl);
      const prs: MergedPR[] = [
        {
          title: 'Fix bug',
          number: 456,
          author: 'bob',
          authorAvatar: 'https://avatar.com/bob',
          url: 'https://github.com/microsoft/vscode/pull/456',
          mergedAt: '2024-01-01T14:00:00Z',
          repository: 'microsoft/vscode',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await notifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];
      expect(sentMessage).toHaveProperty('message');
      expect(typeof sentMessage.message).toBe('string');
      expect(sentMessage.message).toContain('🔀');
      expect(sentMessage.message).toContain('Fix bug');
      expect(sentMessage.message).toContain('👤 @bob');
    });

    it('should include all PR details in workflow webhook text message', async () => {
      const workflowWebhookUrl = 'https://hooks.slack.com/workflows/T00000000/A00000000/XXXX';
      const notifier = new SlackNotifier(workflowWebhookUrl, 48);
      const prs: MergedPR[] = [
        {
          title: 'Add feature A',
          number: 100,
          author: 'alice',
          authorAvatar: 'https://avatar.com/alice',
          url: 'https://github.com/org/repo1/pull/100',
          mergedAt: '2024-01-01T12:00:00Z',
          repository: 'org/repo1',
        },
        {
          title: 'Fix bug B',
          number: 200,
          author: 'bob',
          authorAvatar: 'https://avatar.com/bob',
          url: 'https://github.com/org/repo2/pull/200',
          mergedAt: '2024-01-01T14:00:00Z',
          repository: 'org/repo2',
        },
      ];

      (axios.post as any).mockResolvedValue({ status: 200 });

      await notifier.sendCelebration(prs);

      const sentMessage = (axios.post as any).mock.calls[0][1];

      expect(sentMessage.message).toMatch(/[🎉🚀✨🎊🎈🌟💫🔥]/);

      expect(sentMessage.message).toContain('*2* awesome PR');
      expect(sentMessage.message).toContain('48 hours');
      expect(sentMessage.message).toContain('*2* contributor');

      expect(sentMessage.message).toContain('📦 org/repo1');
      expect(sentMessage.message).toContain('📦 org/repo2');

      expect(sentMessage.message).toContain('🔀 #100: Add feature A');
      expect(sentMessage.message).toContain('https://github.com/org/repo1/pull/100');
      expect(sentMessage.message).toContain('👤 @alice');

      expect(sentMessage.message).toContain('🔀 #200: Fix bug B');
      expect(sentMessage.message).toContain('https://github.com/org/repo2/pull/200');
      expect(sentMessage.message).toContain('👤 @bob');

      expect(sentMessage.message).toContain('🙌 Amazing work everyone! Keep shipping! 🙌');
    });
  });

  describe('Constructor validation', () => {
    it('should throw when neither webhook nor bot+channel are provided', () => {
      expect(() => new SlackNotifier(undefined, 24)).toThrow(
        'SlackNotifier requires either a webhook URL or a bot token + channel'
      );
    });

    it('should accept bot token + channel without a webhook URL', () => {
      expect(
        () =>
          new SlackNotifier(undefined, 24, {
            botToken: 'xoxb-test',
            channel: 'C123',
          })
      ).not.toThrow();
    });

    it('should throw when bot token is provided without channel and no webhook', () => {
      expect(
        () =>
          new SlackNotifier(undefined, 24, {
            botToken: 'xoxb-test',
          })
      ).toThrow('SlackNotifier requires either a webhook URL or a bot token + channel');
    });
  });

  describe('Bot API mode (threaded messages)', () => {
    const botToken = 'xoxb-test-token';
    const channel = 'C0123ABC456';

    function makeBotNotifier(mergeWindow: number = 24) {
      return new SlackNotifier(undefined, mergeWindow, { botToken, channel });
    }

    function mockChatPost(parentTs: string, replyTs: string = '999.000') {
      // First call returns parent ts; subsequent calls return reply ts
      let call = 0;
      (axios.post as any).mockImplementation(async () => {
        call += 1;
        return {
          status: 200,
          data: {
            ok: true,
            ts: call === 1 ? parentTs : `${replyTs}-${call}`,
            channel,
          },
        };
      });
    }

    it('should call chat.postMessage with bot token auth header', async () => {
      const notifier = makeBotNotifier();
      mockChatPost('1700000000.000100');

      await notifier.sendCelebration([
        {
          title: 'PR 1',
          number: 1,
          author: 'alice',
          authorAvatar: '',
          url: 'https://github.com/o/r/pull/1',
          mergedAt: '2024-01-01T00:00:00Z',
          repository: 'o/r',
        },
      ]);

      expect(axios.post).toHaveBeenCalled();
      const [url, _body, options] = (axios.post as any).mock.calls[0];
      expect(url).toBe('https://slack.com/api/chat.postMessage');
      expect(options.headers.Authorization).toBe(`Bearer ${botToken}`);
      expect(options.headers['Content-Type']).toContain('application/json');
    });

    it('should post a parent message and one threaded reply per repo group + footer', async () => {
      const notifier = makeBotNotifier();
      mockChatPost('1700000000.000100');

      const prs: MergedPR[] = [
        {
          title: 'PR a1',
          number: 11,
          author: 'alice',
          authorAvatar: '',
          url: 'https://github.com/o/repo-a/pull/11',
          mergedAt: '2024-01-01T00:00:00Z',
          repository: 'o/repo-a',
        },
        {
          title: 'PR a2',
          number: 12,
          author: 'bob',
          authorAvatar: '',
          url: 'https://github.com/o/repo-a/pull/12',
          mergedAt: '2024-01-01T01:00:00Z',
          repository: 'o/repo-a',
        },
        {
          title: 'PR b1',
          number: 21,
          author: 'carol',
          authorAvatar: '',
          url: 'https://github.com/o/repo-b/pull/21',
          mergedAt: '2024-01-01T02:00:00Z',
          repository: 'o/repo-b',
        },
      ];

      await notifier.sendCelebration(prs);

      // 1 parent + 2 repo replies + 1 footer = 4 calls
      expect((axios.post as any).mock.calls.length).toBe(4);

      const calls = (axios.post as any).mock.calls;
      const parentBody = calls[0][1];
      expect(parentBody.channel).toBe(channel);
      expect(parentBody.thread_ts).toBeUndefined();
      expect(parentBody.blocks).toBeDefined();
      // Parent should NOT contain repo blocks
      expect(
        parentBody.blocks.some(
          (b: any) => b.type === 'section' && b.text?.text?.includes('📦')
        )
      ).toBe(false);

      // Replies 2 and 3 are repo replies; reply 4 is footer
      const replyA = calls[1][1];
      const replyB = calls[2][1];
      const footer = calls[3][1];

      expect(replyA.thread_ts).toBe('1700000000.000100');
      expect(replyB.thread_ts).toBe('1700000000.000100');
      expect(footer.thread_ts).toBe('1700000000.000100');

      const replyARepoBlock = replyA.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('📦')
      );
      expect(replyARepoBlock.text.text).toContain('o/repo-a');

      const replyBRepoBlock = replyB.blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('📦')
      );
      expect(replyBRepoBlock.text.text).toContain('o/repo-b');

      // repo-a reply uses a single section block whose text contains both
      // PRs from that repo (one block per repo, blank line between PRs).
      const repoASections = replyA.blocks.filter(
        (b: any) =>
          b.type === 'section' &&
          (b.text?.text?.includes('#11') || b.text?.text?.includes('#12'))
      );
      expect(repoASections.length).toBe(1);
      expect(repoASections[0].text.text).toContain('#11');
      expect(repoASections[0].text.text).toContain('#12');
      expect(repoASections[0].text.text).toContain('@alice');
      expect(repoASections[0].text.text).toContain('@bob');

      // footer should contain encouragement
      expect(JSON.stringify(footer.blocks)).toContain('Amazing work everyone');
    });

    it('should throw when chat.postMessage returns ok: false', async () => {
      const notifier = makeBotNotifier();
      (axios.post as any).mockResolvedValue({
        status: 200,
        data: { ok: false, error: 'channel_not_found' },
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        notifier.sendCelebration([
          {
            title: 'PR',
            number: 1,
            author: 'alice',
            authorAvatar: '',
            url: 'https://github.com/o/r/pull/1',
            mergedAt: '2024-01-01T00:00:00Z',
            repository: 'o/r',
          },
        ])
      ).rejects.toThrow('channel_not_found');

      consoleErrorSpy.mockRestore();
    });

    it('should prefer bot API when both webhook and bot config are provided', async () => {
      const notifier = new SlackNotifier(mockWebhookUrl, 24, { botToken, channel });
      mockChatPost('1700000000.000200');

      await notifier.sendCelebration([
        {
          title: 'PR',
          number: 1,
          author: 'alice',
          authorAvatar: '',
          url: 'https://github.com/o/r/pull/1',
          mergedAt: '2024-01-01T00:00:00Z',
          repository: 'o/r',
        },
      ]);

      const firstCall = (axios.post as any).mock.calls[0];
      expect(firstCall[0]).toBe('https://slack.com/api/chat.postMessage');
    });
  });
});
