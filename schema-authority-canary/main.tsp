// Independently authored TypeSpec authority for this repository-local CI canary.
// The JSON Schema emitted from this file is comparison evidence only.
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace OreSchemaAuthority;

@id("AuthorityKind")
enum AuthorityKind {
  typespec: "typespec",
  jsonSchema: "json-schema",
}

@id("PeerAuthorityRegistration")
model PeerAuthorityRegistration {
  repository: string;
  authority: AuthorityKind;
  generatedWitnessOnly: boolean;
  owner?: string;
}
