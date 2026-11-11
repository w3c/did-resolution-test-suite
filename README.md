# DID Resolution Test Suite

## Table of Contents

- [DID Resolution Test Suite](#did-resolution-test-suite)
  - [Table of Contents](#table-of-contents)
  - [Background](#background)
  - [Install](#install)
  - [Usage](#usage)
  - [Implementations](#implementations)
    - [Adding a resolver](#adding-a-resolver)
    - [Adding test DIDs for a DID method](#adding-test-dids-for-a-did-method)
    - [How resolvers appear in the report](#how-resolvers-appear-in-the-report)
  - [LICENSE](#license)


## Background

Provides interoperability tests for the [DID Resolution specification](https://www.w3.org/TR/did-resolution/)

## Install

```sh
$ npm i
```

## Usage

```sh
$ npm test
```

## Implementations

Each DID resolver tested by this suite is described by one JSON file in
[`resolvers/`](resolvers/). The DIDs it is tested against are not chosen by the
implementer: the DID WG defines a shared set of test DIDs for each DID method in
[`did-methods/`](did-methods/), and every resolver that supports a method is
tested against the same DIDs.

### Adding a resolver

Open a pull request that adds `resolvers/<YourName>.json`:

```json
{
  "name": "ExampleOrg",
  "implementation": "Example Resolver",
  "endpoint": "https://resolver.example/1.0/identifiers",
  "supportedDidMethods": [
    "did:key",
    "did:example"
  ]
}
```

- `name`: the column heading for your resolver in the report. It must be unique.
- `implementation`: the name of your resolver software.
- `endpoint`: the base URL of your resolver's
  [HTTPS binding](https://w3c.github.io/did-resolution/#bindings-https). It must
  use `https://`. The suite resolves a DID with `GET <endpoint>/<did>`.
- `supportedDidMethods`: the DID methods your resolver supports, written with the
  `did:` prefix.

Every method you list needs test DIDs in `did-methods/`. If one is missing, your
resolver fails the "Every supported DID method has test DIDs defined" test until
someone adds them. See [Adding test DIDs for a DID method](#adding-test-dids-for-a-did-method).

Run `npm test` to check your resolver before opening the pull request.

### Adding test DIDs for a DID method

Test DIDs for `did:<method>` live in `did-methods/<method>.json`. The file name,
without `.json`, is the method name: `did-methods/key.json` holds the test DIDs
for `did:key`.

```json
{
  "valid": [
    {"did": "did:example:123", "resolutionOptions": {}}
  ],
  "notFound": [
    {"did": "did:example:does-not-exist", "resolutionOptions": {}}
  ],
  "deactivated": [
    {"did": "did:example:deactivated", "resolutionOptions": {}}
  ]
}
```

- `valid` (required, at least one entry): DIDs that resolve successfully.
- `notFound` (optional): well-formed DIDs that do not exist. These must be
  syntactically valid for the method, or a resolver may correctly return
  `INVALID_DID` instead of `NOT_FOUND`.
- `deactivated` (optional): DIDs that have been deactivated.

Each entry gives a `did` and the `resolutionOptions` needed to resolve it,
which may be empty (`{}`). The suite sends the options as query parameters,
so their values must be strings. Every resolver that supports the method must
be able to resolve these DIDs, so avoid options that only one resolver
understands.

### How resolvers appear in the report

The report has one section per part of the specification (for example
"4. DID Resolution" and "10.1 HTTPS Binding"), with a column for every
resolver. By default each result covers all of a resolver's test DIDs: a test
fails if it fails for any of them. Use the DID method selector above a table to
see results for a single DID method; resolvers that don't support that method
show "—". The selector is added by this repository's [`matrix.hbs`](matrix.hbs).

## LICENSE

[BSD-3-Clause](LICENSE) Copyright 2022-2025 Digital Bazaar, Inc.
