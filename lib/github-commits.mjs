const API_VERSION = "2022-11-28";

export async function fetchRecentPublicCommits(user, {
  limit = 500,
  token,
  fetchImpl = fetch,
} = {}) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(user)) {
    throw new Error("PROFILE_USER must be a valid GitHub username");
  }
  const target = Math.min(1000, Math.max(1, Math.trunc(limit) || 500));
  const commits = [];
  const seen = new Set();

  for (let page = 1; commits.length < target && page <= 10; page += 1) {
    const params = new URLSearchParams({
      q: `author:${user} merge:false is:public`,
      sort: "author-date",
      order: "desc",
      per_page: String(Math.min(100, target - commits.length)),
      page: String(page),
    });
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "okturan-github-blocks",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(`https://api.github.com/search/commits?${params}`, { headers });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub commit search failed (${response.status}): ${detail.slice(0, 240)}`);
    }
    const data = await response.json();
    for (const item of data.items ?? []) {
      if ((item.parents?.length ?? 1) > 1) continue;
      const key = `${item.repository?.full_name ?? ""}:${item.sha}`;
      if (seen.has(key)) continue;
      seen.add(key);
      commits.push({
        sha: item.sha,
        repository: item.repository?.full_name ?? "",
        date: item.commit?.author?.date ?? item.commit?.committer?.date,
        message: item.commit?.message ?? "",
        url: item.html_url ?? "",
      });
      if (commits.length === target) break;
    }
    if (!data.items?.length || commits.length >= Math.min(target, data.total_count ?? target)) break;
  }

  return commits;
}
