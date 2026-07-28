import assert from "node:assert/strict";
import test from "node:test";

import { fetchRecentPublicCommits } from "../lib/github-commits.mjs";

test("recent commit fetcher paginates, removes merges, and deduplicates", async () => {
  const calls = [];
  const pages = [
    {
      total_count: 4,
      items: [
        { sha: "one", parents: [{}], repository: { full_name: "octo/one" }, commit: { committer: { date: "2026-07-02T10:00:00Z" }, message: "one" }, html_url: "https://example.com/one" },
        { sha: "merge", parents: [{}, {}], repository: { full_name: "octo/one" }, commit: { committer: { date: "2026-07-01T10:00:00Z" }, message: "merge" } },
      ],
    },
    {
      total_count: 4,
      items: [
        { sha: "one", parents: [{}], repository: { full_name: "octo/one" }, commit: { committer: { date: "2026-07-02T10:00:00Z" }, message: "duplicate" } },
        { sha: "two", parents: [{}], repository: { full_name: "octo/two" }, commit: { author: { date: "2026-06-30T10:00:00Z" }, message: "two" }, html_url: "https://example.com/two" },
      ],
    },
    { total_count: 4, items: [] },
  ];
  const commits = await fetchRecentPublicCommits("octocat", {
    limit: 3,
    token: "test-token",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    },
  });

  assert.deepEqual(commits.map(({ sha }) => sha), ["one", "two"]);
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /author%3Aoctocat\+merge%3Afalse\+is%3Apublic/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
});

test("recent commit fetcher validates usernames and reports API failures", async () => {
  await assert.rejects(() => fetchRecentPublicCommits("-bad"), /valid GitHub username/);
  await assert.rejects(
    () => fetchRecentPublicCommits("octocat", {
      fetchImpl: async () => new Response("rate limited", { status: 403 }),
    }),
    /GitHub commit search failed \(403\): rate limited/,
  );
});
