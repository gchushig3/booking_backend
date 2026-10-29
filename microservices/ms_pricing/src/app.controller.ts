import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Observable } from 'rxjs';

interface PrecioRequest {
  tarId: number;
}

interface PrecioResponse {
  tarId: number;
  atrId: number;
  tarTipo: string;
  tarPrecio: number;
  tarMoneda: string;
}

interface PrecioPorTipoRequest {
  tarTipo: string;
}

@Controller()
export class AppController {
  private readonly precios: PrecioResponse[] = [
    {
      tarId: 1,
      atrId: 1,
      tarTipo: 'ADULTO',
      tarPrecio: 45.9,
      tarMoneda: 'USD',
    },
    {
      tarId: 2,
      atrId: 1,
      tarTipo: 'NINO',
      tarPrecio: 20.0,
      tarMoneda: 'USD',
    },
    {
      tarId: 3,
      atrId: 2,
      tarTipo: 'ADULTO',
      tarPrecio: 12.5,
      tarMoneda: 'USD',
    },
  ];

  @GrpcMethod('PricingService', 'ObtenerPrecio')
  obtenerPrecio(data: PrecioRequest): PrecioResponse {
    const precio = this.precios.find((p) => p.tarId === data.tarId);
    if (!precio) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Precio con id ${data.tarId} no existe`,
      });
    }
    return precio;
  }

  @GrpcMethod('PricingService', 'ListarPrecios')
  listarPrecios(): Observable<PrecioResponse> {
    return new Observable((subscriber) => {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= this.precios.length) {
          clearInterval(interval);
          subscriber.complete();
          return;
        }
        subscriber.next(this.precios[i]);
        i++;
      }, 300);
    });
  }

  @GrpcMethod('PricingService', 'ListarPreciosPorTipo')
  listarPreciosPorTipo(data: PrecioPorTipoRequest): Observable<PrecioResponse> {
    const filtrados = this.precios.filter((p) => p.tarTipo === data.tarTipo);

    return new Observable((subscriber) => {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= filtrados.length) {
          clearInterval(interval);
          subscriber.complete();
          return;
        }
        subscriber.next(filtrados[i]);
        i++;
      }, 300);
    });
  }
}
