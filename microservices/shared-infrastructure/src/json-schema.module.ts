import {
  BadRequestException,
  Injectable,
  Module,
  PipeTransform,
} from "@nestjs/common";
import Ajv, { AnySchema, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

function createAjv(): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    coerceTypes: false,
    removeAdditional: false,
    useDefaults: false,
  });
  addFormats(ajv);
  return ajv;
}

export class JsonSchemaValidationPipe<T = unknown>
  implements PipeTransform<unknown, T>
{
  private readonly validate: ValidateFunction<T>;

  constructor(schema: AnySchema, ajv: Ajv = createAjv()) {
    if (typeof schema === "object" && schema.$async) {
      throw new Error("REST validation requires synchronous schemas");
    }
    this.validate = ajv.compile<T>(schema); // Compilar una sola vez por pipe.
  }

  transform(value: unknown): T {
    if (!this.validate(value)) {
      throw new BadRequestException({
        statusCode: 400,
        message: "El payload viola el contrato JSON Schema",
        errors: this.validate.errors?.map(
          ({ instancePath, message, keyword, params }) => ({
            field: instancePath || "root",
            message,
            rule: keyword,
            params,
          }),
        ),
      });
    }
    return value as T;
  }
}

@Injectable()
export class JsonSchemaValidator {
  private readonly ajv = createAjv();

  addSchema(schema: AnySchema, key?: string): this {
    this.ajv.addSchema(schema, key);
    return this;
  }

  pipe<T = unknown>(schema: AnySchema): JsonSchemaValidationPipe<T> {
    return new JsonSchemaValidationPipe<T>(schema, this.ajv);
  }
}

@Module({ providers: [JsonSchemaValidator], exports: [JsonSchemaValidator] })
export class JsonSchemaModule {}
