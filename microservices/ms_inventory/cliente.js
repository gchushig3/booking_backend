import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, 'src', 'pricing.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const pricing = grpc.loadPackageDefinition(packageDef).pricing;
const client = new pricing.PricingService('localhost:50051', grpc.credentials.createInsecure());

console.log('== ObtenerPrecio (unary) ==');
client.obtenerPrecio({ tarId: 1 }, (err, precio) => {
  if (err) {
    console.error('Error gRPC:', err.code, err.details);
    return;
  }

  console.log(`${precio.tarId} - ${precio.tarTipo} - $${precio.tarPrecio} (${precio.tarMoneda})`);

  console.log('\n== ListarPrecios (server streaming) ==');
  const call = client.listarPrecios({});

  call.on('data', (p) => {
    console.log(`${p.tarId} - ${p.tarTipo} - $${p.tarPrecio} (llegó en streaming)`);
  });
  call.on('end', () => console.log('Streaming finalizado.'));
  call.on('error', (err) => console.error('Error en el stream:', err.code, err.details));

  console.log('\n== ListarPreciosPorTipo (server streaming) ==');
  const callPorTipo = client.listarPreciosPorTipo({ tarTipo: 'ADULTO' });

  callPorTipo.on('data', (p) => {
    console.log(`${p.tarId} - ${p.tarTipo} - $${p.tarPrecio} (filtrado por tipo)`);
  });
  callPorTipo.on('end', () => console.log('Streaming por tipo finalizado.'));
  callPorTipo.on('error', (err) => console.error('Error en el stream por tipo:', err.code, err.details));
});
