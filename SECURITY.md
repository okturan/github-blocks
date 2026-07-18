# Security policy

## Supported version

Security fixes target the `main` branch, the configurator currently published
on GitHub Pages, and SVG output generated from that branch. Older copied
renderers and consumer workflows pinned to historical commits are not patched
in place.

## Reporting a vulnerability

Please use [GitHub's private vulnerability reporting form](https://github.com/okturan/github-blocks/security/advisories/new)
instead of opening a public issue. Include the affected renderer or page, the
input that triggers the problem, the generated SVG when relevant, and the
browser or GitHub surface where you confirmed the impact.

Reports are especially useful when they demonstrate:

- executable content, unsafe links, XML injection, or markup escaping failures
  in generated SVG;
- a data URI or media input escaping the documented image-only boundary;
- workflow-generation output that grants unnecessary permissions, exposes a
  token, or executes an untrusted revision;
- a dependency, GitHub Pages, or Actions supply-chain weakness in this
  repository.

Visual glitches, malformed third-party contribution data that only causes a
render failure, and issues in a consumer's modified copy can be filed as normal
bugs. GitHub's image proxy and README rendering rules are also outside this
repository's control unless the generated output bypasses one of those
boundaries.

Use synthetic profile and media data in reports; do not submit other people's
private information or active credentials. The maintainer will coordinate
validation, remediation, and disclosure through the private advisory.
