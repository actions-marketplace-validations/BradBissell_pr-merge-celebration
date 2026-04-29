import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig } from './config';

describe('getConfig', () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_CHANNEL;
    delete process.env.REPOS_TO_CHECK;
    delete process.env.MERGE_WINDOW;
  });

  it('should throw error when GITHUB_TOKEN is missing', () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'owner/repo';

    expect(() => getConfig()).toThrow('GITHUB_TOKEN environment variable is required');
  });

  it('should throw error when neither webhook URL nor bot token+channel are set', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.REPOS_TO_CHECK = 'owner/repo';

    expect(() => getConfig()).toThrow(
      'Either SLACK_BOT_TOKEN + SLACK_CHANNEL (for threaded messages) or SLACK_WEBHOOK_URL is required'
    );
  });

  it('should throw error when SLACK_WEBHOOK_URL is invalid format', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://example.com/webhook';
    process.env.REPOS_TO_CHECK = 'owner/repo';

    expect(() => getConfig()).toThrow('SLACK_WEBHOOK_URL must be a valid Slack webhook URL (should start with https://hooks.slack.com/)');
  });

  it('should accept valid Slack webhook URL', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX';
    process.env.REPOS_TO_CHECK = 'owner/repo';

    const config = getConfig();

    expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX');
  });

  describe('Slack webhook URL validation edge cases', () => {
    it('should reject http:// URLs (only https:// allowed)', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'http://hooks.slack.com/services/T/B/X';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow('SLACK_WEBHOOK_URL must be a valid Slack webhook URL (should start with https://hooks.slack.com/)');
    });

    it('should reject URL with wrong subdomain', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://api.slack.com/webhook';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow('SLACK_WEBHOOK_URL must be a valid Slack webhook URL (should start with https://hooks.slack.com/)');
    });

    it('should reject URL without proper prefix', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://slack.com/hooks/services/T/B/X';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow('SLACK_WEBHOOK_URL must be a valid Slack webhook URL (should start with https://hooks.slack.com/)');
    });

    it('should accept Slack webhook URL with trailing slash', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX/';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      const config = getConfig();

      expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX/');
    });

    it('should accept Slack webhook URL with query parameters', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX?foo=bar';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      const config = getConfig();

      expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX?foo=bar');
    });

    it('should accept short Slack webhook URL format', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      const config = getConfig();

      expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/test');
    });

    it('should reject empty string as webhook URL when no bot token configured', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = '';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow(
        'Either SLACK_BOT_TOKEN + SLACK_CHANNEL (for threaded messages) or SLACK_WEBHOOK_URL is required'
      );
    });

    it('should reject URL with typo in domain', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slak.com/services/T/B/X';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow('SLACK_WEBHOOK_URL must be a valid Slack webhook URL (should start with https://hooks.slack.com/)');
    });
  });

  describe('Slack bot token mode', () => {
    it('should accept bot token + channel without webhook URL', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      process.env.SLACK_CHANNEL = 'C0123ABC456';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      const config = getConfig();

      expect(config.slackBotToken).toBe('xoxb-test-token');
      expect(config.slackChannel).toBe('C0123ABC456');
      expect(config.slackWebhookUrl).toBeUndefined();
    });

    it('should reject bot token without xoxb- prefix', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_BOT_TOKEN = 'xoxp-user-token';
      process.env.SLACK_CHANNEL = 'C0123ABC456';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow(
        'SLACK_BOT_TOKEN must be a valid Slack bot token (should start with xoxb-)'
      );
    });

    it('should reject bot token without channel', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      expect(() => getConfig()).toThrow(
        'SLACK_CHANNEL is required when SLACK_BOT_TOKEN is set'
      );
    });

    it('should prefer bot config over webhook when both are present', () => {
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/X';
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      process.env.SLACK_CHANNEL = 'C0123ABC456';
      process.env.REPOS_TO_CHECK = 'owner/repo';

      const config = getConfig();

      expect(config.slackBotToken).toBe('xoxb-test-token');
      expect(config.slackChannel).toBe('C0123ABC456');
      expect(config.slackWebhookUrl).toBeUndefined();
    });
  });

  it('should throw error when REPOS_TO_CHECK is missing', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

    expect(() => getConfig()).toThrow(
      'REPOS_TO_CHECK environment variable is required (format: owner/repo,owner/repo)'
    );
  });

  it('should parse single repository correctly', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';

    const config = getConfig();

    expect(config.githubToken).toBe('ghp_token123');
    expect(config.slackWebhookUrl).toBe('https://hooks.slack.com/test');
    expect(config.repos).toEqual([{ owner: 'octocat', repo: 'hello-world' }]);
    expect(config.mergeWindowHours).toBe(24);
  });

  it('should parse multiple repositories correctly', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world,microsoft/vscode,facebook/react';

    const config = getConfig();

    expect(config.repos).toEqual([
      { owner: 'octocat', repo: 'hello-world' },
      { owner: 'microsoft', repo: 'vscode' },
      { owner: 'facebook', repo: 'react' },
    ]);
  });

  it('should handle whitespace in repository list', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = ' octocat/hello-world , microsoft/vscode ';

    const config = getConfig();

    expect(config.repos).toEqual([
      { owner: 'octocat', repo: 'hello-world' },
      { owner: 'microsoft', repo: 'vscode' },
    ]);
  });

  it('should filter out empty repository strings', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world,,microsoft/vscode';

    const config = getConfig();

    expect(config.repos).toEqual([
      { owner: 'octocat', repo: 'hello-world' },
      { owner: 'microsoft', repo: 'vscode' },
    ]);
  });

  it('should throw error for invalid repository format (missing slash)', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'invalid-repo';

    expect(() => getConfig()).toThrow('Invalid repo format: invalid-repo. Expected format: owner/repo');
  });

  it('should throw error for invalid repository format (only owner)', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/';

    expect(() => getConfig()).toThrow('Invalid repo format: octocat/. Expected format: owner/repo');
  });

  it('should throw error for invalid repository format (only repo)', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = '/hello-world';

    expect(() => getConfig()).toThrow('Invalid repo format: /hello-world. Expected format: owner/repo');
  });

  it('should use default merge window of 24 hours when not specified', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';

    const config = getConfig();

    expect(config.mergeWindowHours).toBe(24);
  });

  it('should use custom merge window when specified', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    process.env.MERGE_WINDOW = '12';

    const config = getConfig();

    expect(config.mergeWindowHours).toBe(12);
  });

  it('should throw error for invalid merge window (not a number)', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    process.env.MERGE_WINDOW = 'invalid';

    expect(() => getConfig()).toThrow('MERGE_WINDOW must be a positive number between 1 and 720 hours (30 days)');
  });

  it('should throw error for negative merge window', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    process.env.MERGE_WINDOW = '-5';

    expect(() => getConfig()).toThrow('MERGE_WINDOW must be a positive number between 1 and 720 hours (30 days)');
  });

  it('should throw error for zero merge window', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    process.env.MERGE_WINDOW = '0';

    expect(() => getConfig()).toThrow('MERGE_WINDOW must be a positive number between 1 and 720 hours (30 days)');
  });

  it('should throw error for merge window exceeding 720 hours', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    process.env.MERGE_WINDOW = '721';

    expect(() => getConfig()).toThrow('MERGE_WINDOW must be a positive number between 1 and 720 hours (30 days)');
  });

  it('should accept merge window at maximum bound (720 hours)', () => {
    process.env.GITHUB_TOKEN = 'ghp_token123';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    process.env.MERGE_WINDOW = '720';

    const config = getConfig();

    expect(config.mergeWindowHours).toBe(720);
  });

  describe('weekendCatchup', () => {
    beforeEach(() => {
      delete process.env.WEEKEND_CATCHUP;
      process.env.GITHUB_TOKEN = 'ghp_token123';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.REPOS_TO_CHECK = 'octocat/hello-world';
    });

    it('defaults to false when not set', () => {
      expect(getConfig().weekendCatchup).toBe(false);
    });

    it('parses "true" as true', () => {
      process.env.WEEKEND_CATCHUP = 'true';
      expect(getConfig().weekendCatchup).toBe(true);
    });

    it('parses "1" as true', () => {
      process.env.WEEKEND_CATCHUP = '1';
      expect(getConfig().weekendCatchup).toBe(true);
    });

    it('parses "yes" as true', () => {
      process.env.WEEKEND_CATCHUP = 'yes';
      expect(getConfig().weekendCatchup).toBe(true);
    });

    it('treats arbitrary strings as false', () => {
      process.env.WEEKEND_CATCHUP = 'maybe';
      expect(getConfig().weekendCatchup).toBe(false);
    });

    it('parses "false" as false', () => {
      process.env.WEEKEND_CATCHUP = 'false';
      expect(getConfig().weekendCatchup).toBe(false);
    });

    it('is case-insensitive', () => {
      process.env.WEEKEND_CATCHUP = 'TRUE';
      expect(getConfig().weekendCatchup).toBe(true);
    });

    it('handles whitespace', () => {
      process.env.WEEKEND_CATCHUP = '  true  ';
      expect(getConfig().weekendCatchup).toBe(true);
    });
  });
});
