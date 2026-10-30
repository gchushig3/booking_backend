import { ConfigService } from "@nestjs/config";
import { GrpcOptions, Transport } from "@nestjs/microservices";
import { credentials, ServerCredentials } from "@grpc/grpc-js";
import { positiveInteger } from "./config.js";

export function inventoryGrpcOptions(
  config: ConfigService,
  server = false,
): GrpcOptions {
  const tls = config.get<string>("INVENTORY_GRPC_TLS") ?? "false";
  if (!["true", "false"].includes(tls))
    throw new Error("Invalid INVENTORY_GRPC_TLS");
  const port = positiveInteger(config, "GRPC_PORT", 50051);
  if (port > 65535) throw new Error("Invalid GRPC_PORT");
  return {
    transport: Transport.GRPC,
    options: {
      package: "inventory",
      protoPath: config.getOrThrow<string>("INVENTORY_PROTO_PATH"),
      url: server
        ? `${config.get<string>("GRPC_HOST") ?? "0.0.0.0"}:${port}`
        : config.getOrThrow<string>("INVENTORY_GRPC_URL"),
      ...(server
        ? { credentials: ServerCredentials.createInsecure() }
        : {
            credentials:
              tls === "true"
                ? credentials.createSsl()
                : credentials.createInsecure(),
          }),
    },
  };
}
