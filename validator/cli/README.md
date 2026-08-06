# @openresult/cli

Validate and inspect [OpenResult](https://openresult.dev) documents from the command line.

```sh
npm install -g @openresult/cli
# or, without installing
npx @openresult/cli validate results.json
```

## Validate

```sh
openresult validate results.json
```

```
  OR-201  /results/12/participant
          This result belongs to "ghost", which is not a declared participant.
          → Add "ghost" to "participants", or correct the reference.
          spec §7.1.1

  1 error
```

Exits non-zero when a document has errors, so it drops into CI as it stands. `--strict` treats
warnings as errors, `--schema-only` skips the semantic rules, `--quiet` prints nothing and leaves
you the exit code, and `--format json` prints the report for a machine to read.

Exit codes: `0` conforming, `1` validation errors, `2` usage error, `3` unsupported major version.

## Rank

```sh
openresult rank results.json --ranking final
openresult rank results.json --format csv
```

Derives the standings and prints them, which is the quickest way to see what a consumer will show —
including who ends up unranked, and why. `--format json` and `--format csv` are there for
pipelines.

There is also `openresult info results.json`, which summarises what a document contains without
ranking anything.

A source is a file path, a glob, an `http(s)` URL, or `-` for standard input.

## Licence

Apache-2.0.
