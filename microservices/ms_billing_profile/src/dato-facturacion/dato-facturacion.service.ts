import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatoFacturacion } from './dato-facturacion.entity.js';
import type {
  DatoFacturacionInput,
  UpdateDatoFacturacionInput,
} from './dato-facturacion.schemas.js';

const isUniqueViolation = (error: unknown) =>
  (error as { driverError?: { code?: string } })?.driverError?.code === '23505';

// Toda operacion filtra por usu_id del JWT: un usuario nunca ve datos ajenos.
@Injectable()
export class DatoFacturacionService {
  constructor(
    @InjectRepository(DatoFacturacion)
    private readonly repository: Repository<DatoFacturacion>,
  ) {}

  list(userId: string): Promise<DatoFacturacion[]> {
    return this.repository.find({
      where: { usu_id: userId, dfa_activo: true },
      order: { dfa_id: 'ASC' },
    });
  }

  async get(userId: string, id: string): Promise<DatoFacturacion> {
    const dato = await this.repository.findOneBy({
      dfa_id: id,
      usu_id: userId,
      dfa_activo: true,
    });
    if (!dato) throw new NotFoundException('Dato de facturacion no existe');
    return dato;
  }

  create(
    userId: string,
    input: DatoFacturacionInput,
  ): Promise<DatoFacturacion> {
    return this.write(userId, () =>
      this.repository.create({
        ...input,
        usu_id: userId,
        dfa_telefono: input.dfa_telefono ?? null,
        dfa_es_principal: input.dfa_es_principal ?? false,
      }),
    );
  }

  async update(
    userId: string,
    id: string,
    input: UpdateDatoFacturacionInput,
  ): Promise<DatoFacturacion> {
    const current = await this.get(userId, id);
    return this.write(userId, () => Object.assign(current, input));
  }

  async remove(userId: string, id: string): Promise<void> {
    const current = await this.get(userId, id);
    current.dfa_activo = false;
    current.dfa_es_principal = false;
    await this.repository.save(current);
  }

  private write(
    userId: string,
    build: () => DatoFacturacion,
  ): Promise<DatoFacturacion> {
    return this.repository.manager
      .transaction(async (manager) => {
        const repository = manager.getRepository(DatoFacturacion);
        const dato = build();
        if (dato.dfa_es_principal) {
          // El indice parcial permite un unico principal por usuario.
          await repository.update(
            { usu_id: userId, dfa_es_principal: true },
            { dfa_es_principal: false },
          );
        }
        return repository.save(dato);
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException('La identificacion ya esta registrada');
        }
        throw error;
      });
  }
}
