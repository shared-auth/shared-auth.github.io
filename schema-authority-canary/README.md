# Independent schema-authority CI canary

`main.tsp` and `authored.schema.json` are independently maintained peer authorities. Neither file is generated from, ranked below, or allowed to overwrite the other.

The CI gate generates JSON Schema B from TypeSpec into `.typespec-json-schema-validator/generated/`, validates both JSON Schema lanes as Draft 2020-12, compares top-level declarations and normalized semantics, and executes bidirectional instance probes. The generated schema and deterministic receipt are evidence only.

A passing canary proves that this marketing-site repository executes the fleet gate. It does not move Shared Auth product-contract ownership into the site, and it does not certify unrelated identity, session, organization, or authorization contracts. Those contracts remain subject to independent authorship and convergence in their owning repositories.
