import { ValidationPipe } from "@nestjs/common";
import type { ArgumentMetadata } from "@nestjs/common";
import type { AnySchema } from "ajv";
import { JsonSchemaValidationPipe } from "./json-schema.module.js";

/** Validar el JSON original antes de transformar DTOs o aplicar valores predeterminados. */
export class SchemaFirstValidationPipe extends ValidationPipe {
  private readonly contracts = new Map<Function, JsonSchemaValidationPipe>();

  constructor(schemas: ReadonlyMap<Function, AnySchema>) {
    super({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    for (const [type, schema] of schemas)
      this.contracts.set(type, new JsonSchemaValidationPipe(schema));
  }

  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (metadata.type === "body" && metadata.metatype) {
      this.contracts.get(metadata.metatype)?.transform(value);
    }
    return super.transform(value, metadata);
  }
}
